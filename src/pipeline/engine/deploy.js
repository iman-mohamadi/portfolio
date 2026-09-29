import * as THREE from 'three'
import gsap from 'gsap'
import { palette } from './core.js'
import { metal, glowMat } from './world.js'
import { sprite } from '../../world/helpers.js'
import { ORIGIN, USERS, evaluate, best, km } from './geo.js'

const R = 6.4
export const MAX_NODES = 4
export const TARGET = 125

const ll = (lat, lon, r = 1) => { const a = (lat * Math.PI) / 180, o = (lon * Math.PI) / 180; return new THREE.Vector3(Math.cos(a) * Math.sin(o) * r, Math.sin(a) * r, Math.cos(a) * Math.cos(o) * r) }
const toLL = (v) => { const n = v.clone().normalize(); return { lat: (Math.asin(n.y) * 180) / Math.PI, lon: (Math.atan2(n.x, n.z) * 180) / Math.PI } }
const heatOf = (ms) => THREE.MathUtils.clamp((ms - 60) / 260, 0, 1)
const heatColor = (h, out = new THREE.Color()) => (h < 0.5 ? out.setRGB(0.2, 1, 0.6).lerp(new THREE.Color(1, 0.75, 0.2), h * 2) : out.setRGB(1, 0.75, 0.2).lerp(new THREE.Color(1, 0.22, 0.3), (h - 0.5) * 2))

export function createDeploy({ core, dock, state, mobile }) {
  const D = state.deploy
  const group = new THREE.Group(); group.position.set(0, 0, -7); dock.group.add(group)
  const globe = new THREE.Group(); globe.position.set(0, 8.6, 0); group.add(globe)
  const yaw0 = (40 * Math.PI) / 180
  const view = { yaw: yaw0, pitch: 0.28, vy: 0.05, vp: 0, drag: false }
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 0.6, 32), metal(0x0d0f16, 0.4, 0.85)); pedestal.position.set(0, 0.3, 0); group.add(pedestal)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.05, 8, 64), glowMat(palette.primary, 3.4)); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.62, 0); group.add(ring)
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.2, 8), glowMat(palette.secondary, 3)); beam.position.set(0, 3.2, 0); group.add(beam)

  /* ocean + atmosphere */
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uPrimary: { value: palette.primary } },
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uPrimary;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-max(dot(vN,vV),0.),2.5);vec3 c=vec3(.012,.016,.03)+uPrimary*f*.22;gl_FragColor=vec4(c,1.);}',
  })); globe.add(ocean)
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 48, 32), new THREE.ShaderMaterial({
    uniforms: { uPrimary: { value: palette.primary } }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'uniform vec3 uPrimary;varying vec3 vN;varying vec3 vV;void main(){float f=pow(max(dot(-vN,vV),0.),3.2);gl_FragColor=vec4(uPrimary*f*.75,f*.7);}',
  })); group.add(atmo); atmo.position.copy(globe.position)
  // graticule
  const gl = []; for (let lat = -60; lat <= 60; lat += 30) for (let i = 0; i < 96; i++) gl.push(ll(lat, (i / 96) * 360 - 180, R * 0.99), ll(lat, ((i + 1) / 96) * 360 - 180, R * 0.99))
  for (let lon = -180; lon < 180; lon += 30) for (let i = 0; i < 48; i++) gl.push(ll(-90 + (i / 48) * 180, lon, R * 0.99), ll(-90 + ((i + 1) / 48) * 180, lon, R * 0.99))
  const grat = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gl), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.1, toneMapped: false })); grat.material.color = palette.primary; globe.add(grat)

  /* land as dots, sampled from the Natural Earth mask */
  const pxU = { value: core.getPixelRatio() }
  const landMat = new THREE.ShaderMaterial({
    uniforms: { uPrimary: { value: palette.primary }, uPx: pxU }, transparent: true, depthWrite: false,
    vertexShader: 'uniform float uPx;varying float vF;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vec3 n=normalize(mat3(modelViewMatrix)*position);vF=smoothstep(-.15,.55,dot(n,normalize(-mv.xyz)));gl_Position=projectionMatrix*mv;gl_PointSize=uPx*(.05*' + (mobile ? '1.5' : '1.15') + ')*(600./-mv.z);}',
    fragmentShader: 'uniform vec3 uPrimary;varying float vF;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(mix(uPrimary,vec3(1.),.25),(.2+.8*vF)*smoothstep(.5,.2,d)*.9);}',
  })
  const img = new Image(); img.src = '/globe-land.png'
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0)
    const data = x.getImageData(0, 0, c.width, c.height).data, n = mobile ? 30000 : 70000, pts = []
    for (let i = 0; i < n; i++) {
      const lat = (Math.asin(1 - (2 * (i + 0.5)) / n) * 180) / Math.PI, lon = ((i * 137.508) % 360) - 180
      const px = Math.floor(((lon + 180) / 360) * c.width) % c.width, py = Math.min(c.height - 1, Math.floor(((90 - lat) / 180) * c.height))
      if (data[(py * c.width + px) * 4] > 128) pts.push(ll(lat, lon, R * 1.001))
    }
    const land = new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), landMat); land.frustumCulled = false; globe.add(land)
  }

  /* markers */
  const nodeGroup = new THREE.Group(); globe.add(nodeGroup)
  const originMark = new THREE.Group(); { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), new THREE.MeshBasicMaterial({ toneMapped: false })); m.material.color = palette.secondary; m.position.y = 0.42; originMark.add(m); const s = sprite('ORIGIN · TEHRAN', { size: 0.55, font: `300 80px 'JetBrains Mono', monospace`, accent: '#ffffff' }); s.position.y = 1.15; originMark.add(s) }
  originMark.position.copy(ll(ORIGIN.lat, ORIGIN.lon, R)); originMark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), originMark.position.clone().normalize()); globe.add(originMark)
  const userPts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(USERS.map((u) => ll(u.lat, u.lon, R * 1.006))), new THREE.ShaderMaterial({
    uniforms: { uPx: pxU, uTime: { value: 0 } }, vertexColors: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aCol;attribute float aW;uniform float uPx,uTime;varying vec3 vC;void main(){vC=aCol;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uPx*(.34+aW*.16+.05*sin(uTime*3.+aW*9.))*(600./-mv.z);}',
    fragmentShader: 'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vC*2.2,smoothstep(.5,.05,d));}',
  }))
  const aCol = new THREE.BufferAttribute(new Float32Array(USERS.length * 3), 3), aW = new THREE.BufferAttribute(new Float32Array(USERS.map((u) => u.w)), 1)
  userPts.geometry.setAttribute('aCol', aCol); userPts.geometry.setAttribute('aW', aW); userPts.frustumCulled = false; globe.add(userPts)

  /* connection arcs */
  const SEG = 40, arcGeo = new THREE.BufferGeometry()
  const arcPos = new THREE.BufferAttribute(new Float32Array(USERS.length * SEG * 2 * 3), 3), arcCol = new THREE.BufferAttribute(new Float32Array(USERS.length * SEG * 2 * 3), 3)
  arcGeo.setAttribute('position', arcPos); arcGeo.setAttribute('color', arcCol)
  const arcs = new THREE.LineSegments(arcGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); arcs.frustumCulled = false; globe.add(arcs)
  const slerp = (a, b, t) => { const w = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)); return w < 0.001 ? a.clone().lerp(b, t).normalize() : a.clone().multiplyScalar(Math.sin((1 - t) * w)).addScaledVector(b, Math.sin(t * w)).divideScalar(Math.sin(w)) }

  /* packets: thousands of GPU-animated points flowing along each connection */
  const NP = mobile ? 14000 : 52000
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3))
  const aFrom = new THREE.BufferAttribute(new Float32Array(NP * 3), 3), aTo = new THREE.BufferAttribute(new Float32Array(NP * 3), 3), aP = new THREE.BufferAttribute(new Float32Array(NP * 4), 4)
  pGeo.setAttribute('aFrom', aFrom); pGeo.setAttribute('aTo', aTo); pGeo.setAttribute('aP', aP)
  const packets = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uR: { value: R }, uPx: pxU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aFrom;attribute vec3 aTo;attribute vec4 aP;uniform float uTime,uR,uPx;varying vec3 vCol;varying float vA;
      vec3 slerp3(vec3 a,vec3 b,float t){float w=acos(clamp(dot(a,b),-1.,1.));if(w<.001)return normalize(mix(a,b,t));return (sin((1.-t)*w)*a+sin(t*w)*b)/sin(w);}
      void main(){float t=fract(aP.x+uTime*aP.y);float w=acos(clamp(dot(aFrom,aTo),-1.,1.));vec3 d=slerp3(aFrom,aTo,t);float h=1.006+.2*sin(3.14159*t)*min(1.,w*.9);vec3 p=d*uR*h;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aP.z*uPx*(600./-mv.z);
        vec3 g=vec3(.2,1.,.6),am=vec3(1.,.75,.2),r=vec3(1.,.22,.3);vCol=aP.w<.5?mix(g,am,aP.w*2.):mix(am,r,(aP.w-.5)*2.);vA=sin(3.14159*t);}`,
    fragmentShader: 'varying vec3 vCol;varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vCol*1.05,smoothstep(.5,.1,d)*vA*.55);}',
  })); packets.frustumCulled = false; globe.add(packets)

  /* hover ghost */
  const ghost = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false })); ghost.visible = false; globe.add(ghost)

  /* state → visuals */
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), col = new THREE.Color()
  let sig = '', shock = 0
  const nodeViews = new Map()
  function syncNodes() {
    for (const n of D.nodes) {
      if (nodeViews.has(n.id)) continue
      const g = new THREE.Group(), p = ll(n.lat, n.lon, R)
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 14), new THREE.MeshBasicMaterial({ toneMapped: false })); cone.material.color = palette.accent; cone.position.y = 0.55; g.add(cone)
      const rg = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false })); rg.material.color = palette.accent; rg.rotation.x = -Math.PI / 2; rg.position.y = 0.05; g.add(rg)
      const lab = sprite(n.name, { size: 0.55, font: `300 80px 'JetBrains Mono', monospace`, accent: '#ffffff' }); lab.position.y = 1.55; g.add(lab)
      g.position.copy(p); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize()); g.scale.setScalar(0.01); gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(2)' })
      nodeGroup.add(g); nodeViews.set(n.id, { g, rg })
    }
    for (const [id, v] of nodeViews) if (!D.nodes.some((n) => n.id === id)) { nodeGroup.remove(v.g); nodeViews.delete(id) }
  }
  function recompute() {
    const ev = evaluate(D.nodes); D.ttfb = Math.round(ev.mean); D.p95 = Math.round(ev.p95)
    D.rows = ev.rows.map((r) => ({ name: r.user.name, ttfb: Math.round(r.ttfb), via: r.server.name, edge: r.edge }))
    // arcs + user heat
    let ai = 0
    const wsum = USERS.reduce((a, u) => a + u.w, 0)
    let pi = 0
    ev.rows.forEach((r, k) => {
      const u = r.user, a = ll(u.lat, u.lon, 1), b = ll(r.server.lat, r.server.lon, 1), h = heatOf(r.ttfb); heatColor(h, col)
      aCol.setXYZ(k, col.r, col.g, col.b)
      const w = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1))
      for (let s = 0; s < SEG; s++) for (const tt of [s / SEG, (s + 1) / SEG]) {
        const d = slerp(a, b, tt), hh = 1.006 + 0.2 * Math.sin(Math.PI * tt) * Math.min(1, w * 0.9)
        arcPos.setXYZ(ai, d.x * R * hh, d.y * R * hh, d.z * R * hh); arcCol.setXYZ(ai, col.r * 0.55, col.g * 0.55, col.b * 0.55); ai++
      }
      // packets for this user: share proportional to traffic; nearer servers move faster
      const cnt = w < 0.03 ? 0 : Math.round((NP * u.w) / wsum), spd = 0.55 / (0.45 + w * 1.5)
      for (let q = 0; q < cnt && pi < NP; q++, pi++) {
        aFrom.setXYZ(pi, a.x, a.y, a.z); aTo.setXYZ(pi, b.x, b.y, b.z)
        aP.setXYZW(pi, Math.random(), spd * (0.8 + Math.random() * 0.4), 0.04 + Math.random() * 0.05, h)
      }
    })
    for (; pi < NP; pi++) aP.setXYZW(pi, 0, 0, 0, 0)
    arcPos.needsUpdate = arcCol.needsUpdate = aCol.needsUpdate = aFrom.needsUpdate = aTo.needsUpdate = aP.needsUpdate = true
    if (ev.mean <= TARGET && !D.won && D.nodes.length) { D.won = true; shock = 0.001 }
    D.optimal = D.won && Math.abs(ev.mean - D.best.mean) < 0.6
  }

  /* interaction: drag to rotate, tap to place / remove a node */
  const rc = new THREE.Raycaster(), ndc = new THREE.Vector2(), sphere = new THREE.Sphere(new THREE.Vector3(), R), hit = new THREE.Vector3(), inv = new THREE.Matrix4()
  const dom = core.renderer.domElement
  let down = null
  function pick(e) {
    if (!group.visible || state.station !== 4) return null
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); rc.setFromCamera(ndc, core.camera)
    sphere.center.setFromMatrixPosition(globe.matrixWorld)
    if (!rc.ray.intersectSphere(sphere, hit)) return null
    inv.copy(globe.matrixWorld).invert(); return hit.clone().applyMatrix4(inv)
  }
  const onDown = (e) => { if (state.station !== 4) return; down = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; view.drag = true }
  const onMove = (e) => {
    if (!down && e.target !== dom) { ghost.visible = false; return }
    if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; down.moved += Math.abs(dx) + Math.abs(dy); if (down.moved > 6) { view.yaw += dx * 0.006; view.pitch = THREE.MathUtils.clamp(view.pitch + dy * 0.004, -0.9, 0.9); view.vy = dx * 0.004; down.x = e.clientX; down.y = e.clientY } }
    const p = pick(e); ghost.visible = !!p && !down?.moved
    if (p) { ghost.position.copy(p).setLength(R * 1.012); ghost.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ghost.position.clone().normalize()) }
  }
  const onUp = (e) => {
    const was = down; down = null; view.drag = false
    if (!was || was.moved > 6 || state.station !== 4 || e.target !== dom) return
    const p = pick(e); if (!p) return
    const c = toLL(p), near = D.nodes.find((n) => km(n, c) < 900)
    if (near) D.nodes.splice(D.nodes.indexOf(near), 1)
    else if (D.nodes.length < MAX_NODES) D.nodes.push({ id: 'p' + Math.round(c.lat * 10) + '_' + Math.round(c.lon * 10), name: nameFor(c), lat: c.lat, lon: c.lon })
  }
  function nameFor(c) { let bn = null, bd = 1e9; for (const u of [...USERS]) { const d = km(u, c); if (d < bd) { bd = d; bn = u.name } } return bd < 2500 ? bn : `${c.lat.toFixed(0)}°, ${c.lon.toFixed(0)}°` }
  dom.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp)

  const unsub = core.add((t, dt) => {
    if (!group.visible) return
    const s = D.nodes.map((n) => n.id).join(',')
    if (s !== sig) { sig = s; syncNodes(); recompute() }
    if (!view.drag) { view.yaw += view.vy * dt * 60 * 0.6 + dt * 0.06; view.vy *= 0.94 }
    globe.rotation.set(view.pitch, view.yaw, 0, 'XYZ')
    packets.material.uniforms.uTime.value = t; userPts.material.uniforms.uTime.value = t
    for (const [, v] of nodeViews) v.rg.scale.setScalar(1 + 0.18 * Math.sin(t * 3))
    ring.rotation.z = t * 0.2
    if (shock > 0) { shock += dt * 0.9; const u = Math.min(shock, 1); atmo.scale.setScalar(1 + Math.sin(u * Math.PI) * 0.12); if (shock >= 1) shock = 0 }
  })

  return {
    group,
    enter() {
      group.visible = true; D.nodes.splice(0); D.won = false; D.optimal = false; D.target = TARGET
      D.base = Math.round(evaluate([]).mean); D.best = best(MAX_NODES); D.best = { mean: D.best.mean, set: D.best.set.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lon: r.lon })) }
      sig = '#'; view.yaw = yaw0; view.pitch = 0.28; gsap.fromTo(globe.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 1.2, ease: 'elastic.out(1,.7)' })
    },
    leave() {}, dispose() { unsub(); dom.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp) },
  }
}
