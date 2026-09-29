import * as THREE from 'three'
import gsap from 'gsap'
import { palette } from './core.js'
import { sprite } from '../../world/helpers.js'

export const SPACING = 64
export const stationX = (i) => i * SPACING
const N = 5
const WHITE = new THREE.Color(1, 1, 1)

/** Assigns a shared palette colour by reference so it follows token changes. */
const bind = (mat, key, color) => { mat[key] = color; return mat }
export const metal = (c = 0x14161f, r = 0.4, m = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, flatShading: true })
export const glowMat = (color = palette.primary, i = 3) => { const m = new THREE.MeshStandardMaterial({ color: 0x08090d, roughness: 0.4 }); m.emissive = color; m.emissiveIntensity = i; return m }
export const basicMat = (color = palette.primary) => bind(new THREE.MeshBasicMaterial({ toneMapped: false }), 'color', color)

/** Two-bone robot arm with analytic IK, so it genuinely tracks whatever it is pointed at. */
function makeArm(scale = 1) {
  const L1 = 3.4 * scale, L2 = 3.2 * scale, base = 1.1 * scale
  const g = new THREE.Group(), body = metal(0x171a24, 0.35, 0.8), accent = glowMat(palette.primary, 2.6)
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * scale, 1.3 * scale, 0.35, 20), body); g.add(plate)
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * scale, 0.7 * scale, base, 16), body); col.position.y = base / 2; g.add(col)
  const j1 = new THREE.Group(); j1.position.y = base; g.add(j1)
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.62 * scale, L1, 0.62 * scale), body); s1.position.y = L1 / 2; j1.add(s1)
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.42 * scale, 0.07 * scale, 8, 20), accent); ring1.position.y = L1 * 0.55; ring1.rotation.x = Math.PI / 2; j1.add(ring1)
  const j2 = new THREE.Group(); j2.position.y = L1; j1.add(j2)
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.5 * scale, 14, 10), body); j2.add(knuckle)
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, L2, 0.5 * scale), body); s2.position.y = L2 / 2; j2.add(s2)
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 0.9 * scale, 14), accent); head.position.y = L2 + 0.35 * scale; j2.add(head)
  const tip = new THREE.Object3D(); tip.position.y = L2 + 0.85 * scale; j2.add(tip)
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), basicMat(palette.secondary)); beam.material.transparent = true; beam.material.opacity = 0.7; beam.visible = false
  const wp = new THREE.Vector3(), tv = new THREE.Vector3()
  return {
    group: g, beam, tip,
    aim(target, scan = 0) {
      g.updateWorldMatrix(true, false)
      tv.copy(target); g.worldToLocal(tv)
      const yaw = Math.atan2(tv.x, tv.z); g.rotation.y += yaw
      const r = Math.hypot(tv.x, tv.z) + Math.cos(scan) * 0.3, h = tv.y - base + Math.sin(scan * 1.3) * 0.4
      const d = THREE.MathUtils.clamp(Math.hypot(r, h), 0.6, L1 + L2 - 0.02)
      const a1 = Math.atan2(h, r) + Math.acos(THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1))
      const jx = L1 * Math.cos(a1), jy = L1 * Math.sin(a1), a2 = Math.atan2(h - jy, r - jx)
      j1.rotation.x = Math.PI / 2 - a1; j2.rotation.x = Math.PI / 2 - a2 - j1.rotation.x
    },
    laser(target, on) {
      beam.visible = on; if (!on) return
      tip.getWorldPosition(wp); const len = wp.distanceTo(target)
      beam.position.copy(wp).lerp(target, 0.5); beam.scale.set(1, len, 1); beam.lookAt(target); beam.rotateX(Math.PI / 2)
    },
  }
}

export function createWorld(core) {
  const { scene } = core, mobile = core.mobile
  const total = (N - 1) * SPACING, x0 = -44, x1 = total + 44, len = x1 - x0

  /* floor: grid + station pads, tinted by the palette and lit near the camera focus */
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uPrimary: { value: palette.primary }, uSecondary: { value: palette.secondary }, uFocus: { value: 0 }, uTime: { value: 0 }, uSt: { value: Array.from({ length: N }, (_, i) => stationX(i)) } },
    vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: /* glsl */ `
      uniform vec3 uPrimary,uSecondary;uniform float uFocus,uTime;uniform float uSt[${N}];varying vec3 vW;
      float grid(vec2 p,float s,float w){vec2 q=p/s;vec2 g=abs(fract(q-.5)-.5)/fwidth(q);return 1.-clamp(min(g.x,g.y)/w,0.,1.);}
      void main(){
        vec2 p=vW.xz;float near=exp(-abs(p.x-uFocus)*.028)*exp(-abs(p.y)*.012);
        float g1=grid(p,4.,1.1),g2=grid(p,16.,1.4);
        float pad=0.;for(int i=0;i<${N};i++){float d=length(p-vec2(uSt[i],0.));pad+=smoothstep(.6,0.,abs(d-12.)-.05)*.9+smoothstep(.35,0.,abs(d-15.5)-.03)*.6+exp(-d*.09)*.06;}
        vec3 c=vec3(.006,.007,.012);
        c+=uPrimary*g1*(.02+.22*near)+uPrimary*g2*(.1+.28*near);
        c+=mix(uPrimary,uSecondary,.5)*pad*.9;
        c+=uPrimary*.012*near;
        gl_FragColor=vec4(c,1.);
      }`,
  })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(len + 300, 240), floorMat)
  floor.rotation.x = -Math.PI / 2; floor.position.set((x0 + x1) / 2, 0, 0); scene.add(floor)

  /* conveyor: chevrons scroll toward the next station */
  const conveyorMat = new THREE.ShaderMaterial({
    uniforms: { uPrimary: { value: palette.primary }, uTime: { value: 0 }, uLen: { value: len } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform vec3 uPrimary;uniform float uTime,uLen;varying vec2 vUv;
      void main(){float x=vUv.x*uLen/2.4-uTime*.9;float c=abs(vUv.y-.5)*2.;float v=fract(x+c*.5);float ch=smoothstep(.42,.5,v)*smoothstep(.62,.54,v);
        vec3 col=vec3(.02,.022,.03)+uPrimary*ch*.85+uPrimary*smoothstep(.82,1.,c)*.5;gl_FragColor=vec4(col,1.);}`,
  })
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), conveyorMat); belt.rotation.x = -Math.PI / 2; belt.position.set((x0 + x1) / 2, 0.52, 0); scene.add(belt)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 3.2), metal(0x0d0f16, 0.5, 0.8)); frame.position.set((x0 + x1) / 2, 0.25, 0); scene.add(frame)
  for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.1), glowMat(palette.primary, 3.4)); rail.position.set((x0 + x1) / 2, 0.55, s * 1.35); scene.add(rail) }

  /* gantry arches + hanging strip lights (instanced: 3 draw calls for the whole line) */
  const arches = Math.floor((len + 8) / 16), post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 12, 0.7), metal(), arches * 2), beam = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.6, 20), metal(), arches), strip = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 0.14, 0.14), glowMat(palette.secondary, 3), arches)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion()
  for (let i = 0; i < arches; i++) {
    const x = -40 + i * 16 // arches straddle each station so no post stands in front of the camera
    m.compose(new THREE.Vector3(x, 6, -10), q, new THREE.Vector3(1, 1, 1)); post.setMatrixAt(i * 2, m)
    m.compose(new THREE.Vector3(x, 6, 10), q, new THREE.Vector3(1, 1, 1)); post.setMatrixAt(i * 2 + 1, m)
    m.compose(new THREE.Vector3(x, 12.2, 0), q, new THREE.Vector3(1, 1, 1)); beam.setMatrixAt(i, m)
    m.compose(new THREE.Vector3(x, 11.6, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)); strip.setMatrixAt(i, m)
  }
  post.frustumCulled = beam.frustumCulled = strip.frustumCulled = false; scene.add(post, beam, strip)

  /* drifting motes */
  const nm = mobile ? 300 : 900, mp = new Float32Array(nm * 3), ms = new Float32Array(nm)
  for (let i = 0; i < nm; i++) { mp[i * 3] = x0 + Math.random() * len; mp[i * 3 + 1] = Math.random() * 14; mp[i * 3 + 2] = (Math.random() - 0.5) * 34; ms[i] = 0.2 + Math.random() * 0.6 }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('aS', new THREE.BufferAttribute(ms, 1))
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: palette.secondary }, uPx: { value: core.getPixelRatio() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aS;uniform float uTime,uPx;varying float vA;void main(){vec3 p=position;p.y=mod(p.y+uTime*aS,14.);p.x+=sin(uTime*.3+position.z)*.6;vA=smoothstep(0.,1.5,p.y)*smoothstep(14.,12.,p.y);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=.22*uPx*(60./-mv.z);}',
    fragmentShader: 'uniform vec3 uColor;varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(uColor,smoothstep(.5,0.,d)*vA*.6);}',
  })
  const motes = new THREE.Points(mg, moteMat); motes.frustumCulled = false; scene.add(motes)

  /* stations: sign, robot arms, a soft key light each */
  const docks = []
  const titles = ['01  DESIGN', '02  BUILD', '03  RENDER', '04  PERF', '05  DEPLOY']
  for (let i = 0; i < N; i++) {
    const X = stationX(i), group = new THREE.Group(); group.position.set(X, 0, 0); scene.add(group)
    const sign = sprite(titles[i], { size: 2.4, font: `200 120px 'Inter Tight', sans-serif`, accent: '#ffffff' }); sign.position.set(0, 18.4, -9); group.add(sign)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.12), glowMat(palette.primary, 3.6)); bar.position.set(0, 16.7, -9); group.add(bar)
    const arms = [makeArm(1), makeArm(0.9)]
    arms[0].group.position.set(-5.5, 0, 4.5); arms[1].group.position.set(5.5, 0, -4.5)
    arms.forEach((a) => { group.add(a.group); scene.add(a.beam) })
    docks.push({ i, X, group, arms })
  }

  /* the release crate travels the line */
  const crate = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 2.3), metal(0x0d0f18, 0.25, 0.85)); crate.add(body)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.36, 2.36, 2.36)), bind(new THREE.LineBasicMaterial({ toneMapped: false }), 'color', palette.primary)); crate.add(edges)
  const core3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), basicMat(palette.secondary)); crate.add(core3)
  const label = sprite('release v1.0', { size: 0.7, font: `300 76px 'JetBrains Mono', monospace`, color: '#f2efec' }); label.position.set(0, 2.2, 0); crate.add(label)
  const halo = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.55, 48), basicMat(palette.primary)); halo.rotation.x = -Math.PI / 2; halo.position.y = -1.1; halo.material.transparent = true; crate.add(halo)
  crate.position.set(stationX(0) - 22, 1.9, 0); scene.add(crate)
  const cratePos = new THREE.Vector3()
  function moveCrateTo(i, dur = 2.4, onDone) {
    return gsap.to(crate.position, { x: stationX(i), duration: dur, ease: 'power2.inOut', onComplete: onDone })
  }
  const key = new THREE.PointLight(0xffffff, 60, 46, 1.6); key.position.set(0, 9, 8); scene.add(key)

  let active = -1
  const unsub = core.add((t, dt) => {
    floorMat.uniforms.uTime.value = t; floorMat.uniforms.uFocus.value = core.rig.look.x
    conveyorMat.uniforms.uTime.value = t; moteMat.uniforms.uTime.value = t
    crate.rotation.y = t * 0.5; crate.position.y = 1.9 + Math.sin(t * 1.6) * 0.12; core3.rotation.x = t * 1.2; core3.rotation.y = t * 0.9
    halo.scale.setScalar(1 + Math.sin(t * 2) * 0.05)
    key.color.copy(palette.primary).lerp(WHITE, 0.45); key.position.x += (core.rig.look.x - key.position.x) * Math.min(1, dt * 4)
    cratePos.copy(crate.position)
    for (const d of docks) {
      const near = Math.abs(d.X - crate.position.x) < 30
      d.arms.forEach((a, k) => { a.group.visible = near; if (!near) return; a.aim(cratePos, t * 1.5 + k * 2); a.laser(cratePos, d.i === active) })
    }
  })
  return { docks, crate, moveCrateTo, stationX, setActive: (i) => (active = i), dispose: unsub, floorMat }
}

/** Poses for the camera rig. p = position, l = look-at. */
export function poseFor(i) {
  const X = stationX(i), portrait = innerWidth / innerHeight < 0.95
  // desktop: shift the look-at right so the stage sits left of the control panel; phones: look lower so it sits above the sheet
  return portrait
    ? { p: new THREE.Vector3(X, 9, 36), l: new THREE.Vector3(X, 3.4, -6) }
    : { p: new THREE.Vector3(X + 2, 9.2, 34), l: new THREE.Vector3(X + 5.5, 6.4, -6) }
}
export const overviewPose = () => ({ p: new THREE.Vector3(-34, 15, 38), l: new THREE.Vector3(70, 2, -2) })
export const finalePose = () => { const X = stationX(N - 1); return { p: new THREE.Vector3(X - 2, 11, 30), l: new THREE.Vector3(X, 6.5, -6) } }
