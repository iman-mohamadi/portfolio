import * as THREE from 'three'
import gsap from 'gsap'
import { palette } from './core.js'
import { metal, glowMat, basicMat } from './world.js'
import { parts, nest, axes, FINISHES, SHEET } from './cabinet.js'

const S = 0.07 // world units per cm (assembled)
const CAB_X = 1.5
const SX0 = -15.5 // left edge of the flat-pack sheet grid
const MAX = 12

const woodMat = (mats) => new THREE.ShaderMaterial({
  uniforms: { uA: { value: new THREE.Color(FINISHES[0].a) }, uB: { value: new THREE.Color(FINISHES[0].b) }, uPrimary: { value: palette.primary } },
  vertexShader: /* glsl */ `
    attribute vec3 aDim; attribute float aSeed;
    varying vec3 vLocal,vN,vDim,vW;varying float vSeed;
    void main(){vLocal=position+.5;vDim=aDim;vSeed=aSeed;mat4 m=modelMatrix*instanceMatrix;vec4 w=m*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(m)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader: /* glsl */ `
    uniform vec3 uA,uB,uPrimary;varying vec3 vLocal,vN,vDim,vW;varying float vSeed;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    void main(){
      vec3 p=vLocal*vDim;
      // grain runs along the board's longest axis; the ring pattern varies across the other two
      float g,c;
      if(vDim.x>=vDim.y&&vDim.x>=vDim.z){g=p.x;c=vDim.y>vDim.z?p.y:p.z;}
      else if(vDim.y>=vDim.z){g=p.y;c=vDim.x>vDim.z?p.x:p.z;}
      else{g=p.z;c=vDim.x>vDim.y?p.x:p.y;}
      float nz=n(vec2(g*.05,c*.6+vSeed*9.))*.7+n(vec2(g*.4,c*2.))*.3;
      float ring=.5+.5*sin((c*1.5+nz*7.+vSeed*20.));
      vec3 col=mix(uA,uB,smoothstep(.15,.95,ring*.65+nz*.35));
      vec3 N=normalize(vN);float l=max(dot(N,normalize(vec3(-.45,.8,.55))),0.)*.8+.34;
      vec3 q=min(vLocal,1.-vLocal)*vDim;float edge=smoothstep(0.,.28,min(min(q.x,q.y),q.z));
      vec3 V=normalize(cameraPosition-vW);float rim=pow(1.-abs(dot(N,V)),3.);
      vec3 outc=col*l*(.78+.22*edge)+uPrimary*rim*.32;
      gl_FragColor=vec4(outc,1.);
    }`,
})

class Label {
  constructor(w, h, size = 1) {
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace
    this.mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, toneMapped: false, depthWrite: false })); this.mesh.scale.set(size * w / h, size, 1); this.last = ''
  }
  set(text, color = '#f2efec') {
    if (text === this.last) return; this.last = text
    const x = this.c.getContext('2d'); x.clearRect(0, 0, this.c.width, this.c.height); x.font = `300 ${this.c.height * 0.5}px 'JetBrains Mono', monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'
    x.shadowColor = '#000'; x.shadowBlur = 8; x.fillStyle = color; x.fillText(text, this.c.width / 2, this.c.height / 2); this.tex.needsUpdate = true
  }
}

export function createBuild({ core, dock, state }) {
  const group = new THREE.Group(); group.position.set(0, 0, -8); dock.group.add(group)

  /* dais + gantry with a laser scan plane */
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 9.2, 0.5, 48), metal(0x0d0f16, 0.5, 0.8)); dais.position.set(CAB_X, 0.25, 0); group.add(dais)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.06, 8, 72), glowMat(palette.primary, 3.4)); ring.rotation.x = Math.PI / 2; ring.position.set(CAB_X, 0.52, 0); group.add(ring)
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 16, 0.35), metal()); post.position.set(CAB_X + s * 8.2, 8, -3.2); group.add(post); const led = new THREE.Mesh(new THREE.BoxGeometry(0.1, 15, 0.1), glowMat(palette.secondary, 3)); led.position.set(CAB_X + s * 8.2, 8, -2.95); group.add(led) }
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 0.18), basicMat(palette.secondary)); scan.material.transparent = true; scan.material.opacity = 0; scan.position.set(CAB_X, 0, -3.1); group.add(scan)
  const scanGlow = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 2.4), (() => { const m = basicMat(palette.secondary); m.transparent = true; m.opacity = 0; m.blending = THREE.AdditiveBlending; m.depthWrite = false; return m })()); scanGlow.position.copy(scan.position); group.add(scanGlow)

  /* boards: one instanced mesh, per-instance dimensions drive both scale and the grain shader */
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const aDim = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3), aSeed = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1)
  for (let i = 0; i < MAX; i++) aSeed.array[i] = Math.random()
  geo.setAttribute('aDim', aDim); geo.setAttribute('aSeed', aSeed)
  const mat = woodMat()
  const planks = new THREE.InstancedMesh(geo, mat, MAX); planks.frustumCulled = false; planks.count = 0; group.add(planks)

  /* sheet wall for the flat-pack nesting */
  const wall = new THREE.Group(); wall.position.set(SX0, 13.2, -0.4); group.add(wall)
  const sheetMeshes = Array.from({ length: 6 }, () => {
    const g = new THREE.Group()
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x0b0d14, transparent: true, opacity: 0.85, depthWrite: false }))
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[0, 0], [1, 0], [1, -1], [0, -1]].map(([a, b]) => new THREE.Vector3(a, b, 0))), new THREE.LineBasicMaterial({ toneMapped: false })); edge.material.color = palette.primary
    g.add(bg, edge); bg.position.set(0.5, -0.5, -0.05); g.visible = false; wall.add(g); return { g, bg, edge }
  })
  const sheetTag = new Label(1100, 64, 0.85); sheetTag.mesh.position.set(SX0 + 9.8, 15.2, -0.2); group.add(sheetTag.mesh)

  /* dimension lines with live labels */
  const dimMat = new THREE.LineBasicMaterial({ toneMapped: false }); dimMat.color = palette.accent
  const mkDim = () => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), dimMat); l.frustumCulled = false; group.add(l); const lab = new Label(256, 64, 0.85); group.add(lab.mesh); return { l, lab } }
  const dW = mkDim(), dH = mkDim(), dD = mkDim()
  const setDim = (d, a, b, text) => { const p = d.l.geometry.attributes.position; const t = 0.35; const dir = new THREE.Vector3().subVectors(b, a).normalize(), n = new THREE.Vector3(0, 0, 1).cross(dir).normalize(); p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, a.x, a.y, a.z); p.setXYZ(2, b.x, b.y, b.z); p.setXYZ(3, b.x, b.y, b.z); p.needsUpdate = true; d.lab.mesh.position.copy(a).lerp(b, 0.5).addScaledVector(n, 0.9); d.lab.set(text, '#7ee0ff') }

  /* state → geometry */
  let layout = [], nested = null, key = '', ex = { t: 0 }, scanT = 0
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), flatQ = [], flatP = [], flatS = []
  const asmQ = new THREE.Quaternion()
  function fsFor(n) { return n <= 4 ? 0.04 : 0.032 }
  function rebuild() {
    const c = state.cabinet
    layout = parts(c); nested = nest(layout); planks.count = layout.length
    const fs = fsFor(nested.sheets), cols = 2, gap = 0.7, sw = SHEET.w * fs, sh = SHEET.h * fs
    layout.forEach((p, i) => {
      aDim.array.set(p.dims, i * 3)
      const q = axes(p.dims), pl = nested.place[i]
      // flat pose: long axis → X, mid axis → Y, thin axis → Z (flip to stay right-handed)
      const m = new THREE.Matrix4(), cols3 = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
      cols3[q.L].set(1, 0, 0); cols3[q.M].set(0, 1, 0); cols3[q.Tn].set(0, 0, 1)
      m.makeBasis(cols3[0], cols3[1], cols3[2]); if (m.determinant() < 0) { cols3[q.Tn].set(0, 0, -1); m.makeBasis(cols3[0], cols3[1], cols3[2]) }
      flatQ[i] = new THREE.Quaternion().setFromRotationMatrix(m)
      const col = pl.sheet % cols, row = Math.floor(pl.sheet / cols)
      const ox = SX0 + col * (sw + gap), oy = 13.2 - row * (sh + gap)
      flatP[i] = new THREE.Vector3(ox + (pl.x + q.a / 2) * fs, oy - (pl.y + q.b / 2) * fs, -0.15)
      // scale in *local* axes so the rotated board lands with its long side along X
      flatS[i] = new THREE.Vector3(p.dims[0] * fs, p.dims[1] * fs, p.dims[2] * fs)
    })
    aDim.needsUpdate = true
    sheetMeshes.forEach((s, k) => {
      s.g.visible = k < nested.sheets; if (k >= nested.sheets) return
      const col = k % cols, row = Math.floor(k / cols)
      s.g.position.set(col * (sw + gap), -row * (sh + gap), 0); s.g.scale.set(sw, sh, 1); s.bg.material.color.set(k >= nested.plySheets ? 0x141018 : 0x0b0d14)
    })
    const c2 = state.cabinet
    setDim(dW, new THREE.Vector3(CAB_X - c2.w * S / 2, c2.h * S + 0.9, 0), new THREE.Vector3(CAB_X + c2.w * S / 2, c2.h * S + 0.9, 0), `${c2.w} cm`)
    setDim(dH, new THREE.Vector3(CAB_X + c2.w * S / 2 + 1.1, 0.2, c2.d * S / 2), new THREE.Vector3(CAB_X + c2.w * S / 2 + 1.1, c2.h * S, c2.d * S / 2), `${c2.h} cm`)
    setDim(dD, new THREE.Vector3(CAB_X - c2.w * S / 2 - 1.1, 0.1, -c2.d * S / 2), new THREE.Vector3(CAB_X - c2.w * S / 2 - 1.1, 0.1, c2.d * S / 2), `${c2.d} cm`)
    sheetTag.set(`${nested.plySheets} × 18mm sheet${nested.plySheets > 1 ? 's' : ''} + ${nested.hard} hardboard · yield ${(nested.yield * 100).toFixed(0)}%`, '#f2efec')
    state.stats.cabinet = { ...c, parts: layout.length, sheets: nested.sheets, yield: Math.round(nested.yield * 100) }
    scanT = 0.001 // trigger a laser re-cut sweep
  }
  const fin = { a: new THREE.Color(FINISHES[0].a), b: new THREE.Color(FINISHES[0].b) }, tc = new THREE.Color(), eul = new THREE.Euler()
  let yaw = 0
  const unsub = core.add((t, dt) => {
    if (!group.visible) return
    const c = state.cabinet, k = `${c.w}|${c.h}|${c.d}|${c.shelves}`
    if (k !== key) { key = k; rebuild() }
    // finish colour tween
    const f = FINISHES[c.finish] || FINISHES[0]; fin.a.lerp(tc.set(f.a), Math.min(1, dt * 6)); fin.b.lerp(tc.set(f.b), Math.min(1, dt * 6)); mat.uniforms.uA.value.copy(fin.a); mat.uniforms.uB.value.copy(fin.b)
    // explode progress follows the toggle
    const target = c.exploded ? 1 : 0; ex.t += (target - ex.t) * Math.min(1, dt * 2.2)
    yaw += (((c.exploded ? 0 : Math.sin(t * 0.35) * 0.22)) - yaw) * Math.min(1, dt * 3)
    for (let i = 0; i < layout.length; i++) {
      const p = layout[i], e = THREE.MathUtils.smoothstep(ex.t * 1.5 - i * 0.055, 0, 1)
      tmpP.set(CAB_X + p.pos[0] * S, p.pos[1] * S + 0.5, p.pos[2] * S)
      // apply the cabinet's gentle yaw about its own centre (assembled state only)
      const cx = tmpP.x - CAB_X, cz = tmpP.z; tmpP.x = CAB_X + cx * Math.cos(yaw) + cz * Math.sin(yaw); tmpP.z = -cx * Math.sin(yaw) + cz * Math.cos(yaw)
      asmQ.setFromEuler(eul.set(0, yaw, 0))
      tmpP.lerp(flatP[i], e); tmpQ.copy(asmQ).slerp(flatQ[i], e)
      tmpS.set(p.dims[0] * S, p.dims[1] * S, p.dims[2] * S).lerp(flatS[i], e)
      tmpM.compose(tmpP, tmpQ, tmpS); planks.setMatrixAt(i, tmpM)
    }
    planks.instanceMatrix.needsUpdate = true
    // laser sweep
    if (scanT > 0) { scanT += dt * 1.6; const u = Math.min(scanT, 1), y = c.h * S * u + 0.5; scan.position.y = y; scanGlow.position.y = y; const a = Math.sin(u * Math.PI); scan.material.opacity = a * 0.9; scanGlow.material.opacity = a * 0.5; if (scanT >= 1) { scanT = 0; scan.material.opacity = 0; scanGlow.material.opacity = 0 } }
    const show = ex.t < 0.5; for (const d of [dW, dH, dD]) { d.l.visible = show; d.lab.mesh.visible = show }
    wall.visible = true
    for (const s of sheetMeshes) { s.bg.material.opacity = 0.85 * ex.t; s.edge.visible = ex.t > 0.03 }
    sheetTag.mesh.material.opacity = ex.t
  })

  return {
    group,
    enter() { group.visible = true; key = ''; ex.t = state.cabinet.exploded ? 1 : 0; gsap.fromTo(group.position, { y: -6 }, { y: 0, duration: 0.9, ease: 'power3.out' }) },
    leave() {}, dispose: unsub,
  }
}
