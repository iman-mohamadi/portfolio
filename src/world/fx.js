import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

/** Final post pass: speed-reactive chromatic aberration + radial blur, vignette and film grain. */
export function createFxPass() {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSpeed: { value: 0 }, uBoost: { value: 0 }, uHit: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;uniform float uTime,uSpeed,uBoost,uHit;varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uTime)*43758.5453);}
    void main(){
      vec2 c=vUv-.5;float r2=dot(c,c);
      float ab=(.0007+.0035*uSpeed+.006*uBoost+.01*uHit)*(r2*4.+.15);
      vec3 col;
      if(uBoost>.02){
        vec3 acc=vec3(0.);
        for(int i=0;i<6;i++){float k=float(i)/5.*.032*uBoost;
          acc.r+=texture2D(tDiffuse,vUv-c*(k+ab)).r;acc.g+=texture2D(tDiffuse,vUv-c*k).g;acc.b+=texture2D(tDiffuse,vUv-c*(k-ab)).b;}
        col=acc/6.;
      }else{
        col=vec3(texture2D(tDiffuse,vUv-c*ab).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv+c*ab).b);
      }
      col*=1.-smoothstep(.16,.62,r2)*.55;
      col+=(h(vUv*vec2(1920.,1080.))-.5)*.035;
      col=mix(col,col*vec3(1.,.6,.7),uHit*.5);
      gl_FragColor=vec4(col,1.);
    }`,
  })
  return pass
}

/** Neon light ribbon that trails behind a point on the car. */
export class Trail {
  constructor(scene, { max = 64, life = 1.1, width = 0.32 } = {}) {
    this.max = max; this.life = life; this.width = width; this.samples = []; this.acc = 0
    this.pos = new Float32Array(max * 2 * 3); this.col = new Float32Array(max * 2 * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage))
    const idx = []; for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    g.setIndex(idx); g.setDrawRange(0, 0)
    this.geo = g
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
    this.mesh.frustumCulled = false; scene.add(this.mesh)
    this.c = new THREE.Color()
  }
  /** x,z head position; nx,nz unit sideways vector; colour hex; moving flag; w width multiplier */
  update(dt, x, z, nx, nz, hex, moving, w = 1, rainbow = 0, y = 0.16) {
    const s = this.samples
    for (let i = s.length - 1; i >= 0; i--) { s[i].age += dt; if (s[i].age > this.life) s.length = i }
    this.acc += dt
    if (moving && this.acc > 0.02) { this.acc = 0; s.unshift({ x, y, z, nx, nz, age: 0, w }); if (s.length > this.max - 1) s.length = this.max - 1 }
    const head = { x, y, z, nx, nz, age: 0, w }
    const m = moving ? s.length + 1 : s.length
    let v = 0
    for (let i = 0; i < m; i++) {
      const p = moving ? (i === 0 ? head : s[i - 1]) : s[i]
      const k = Math.max(0, 1 - p.age / this.life), hw = this.width * p.w * (0.3 + 0.7 * k)
      this.c.set(hex); if (rainbow) this.c.setHSL((performance.now() * 0.0003 + i * 0.02) % 1, 0.9, 0.55)
      const f = k * k * 1.4
      const o = v * 3
      this.pos[o] = p.x + p.nx * hw; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z + p.nz * hw
      this.pos[o + 3] = p.x - p.nx * hw; this.pos[o + 4] = p.y; this.pos[o + 5] = p.z - p.nz * hw
      this.col[o] = this.col[o + 3] = this.c.r * f; this.col[o + 1] = this.col[o + 4] = this.c.g * f; this.col[o + 2] = this.col[o + 5] = this.c.b * f
      v += 2
    }
    this.geo.setDrawRange(0, Math.max(0, (m - 1) * 6))
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true
  }
}

/** Persistent tyre marks: a ring buffer of dark ribbon quads laid on the road under any wheel that is sliding or spinning. */
export class SkidMarks {
  constructor(scene, { max = 1800, hw = 0.17 } = {}) {
    this.max = max; this.hw = hw; this.head = 0; this.n = 0; this.last = new Map()
    this.pos = new Float32Array(max * 12); this.col = new Float32Array(max * 16)
    for (let i = 0; i < max * 4; i++) { this.col[i * 4] = this.col[i * 4 + 1] = this.col[i * 4 + 2] = 0.015 }
    const idx = new Uint32Array(max * 6); for (let q = 0; q < max; q++) { const a = q * 4; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], q * 6) }
    const g = new THREE.BufferGeometry()
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage); this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setIndex(new THREE.BufferAttribute(idx, 1))
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, toneMapped: false }))
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; scene.add(this.mesh)
  }
  /** wheels: [{ id, x, y, z, k }] — k is the 0..1 skid intensity (0 = lifts the pen). */
  update(wheels) {
    this.aPos.clearUpdateRanges(); this.aCol.clearUpdateRanges(); let wrote = false
    for (const w of wheels) {
      const l = this.last.get(w.id)
      if (w.k < 0.06) { if (l) l.on = false; continue }
      if (!l) { this.last.set(w.id, { x: w.x, y: w.y, z: w.z, nx: 0, nz: 0, a: w.k, on: true, fresh: true }); continue }
      const dx = w.x - l.x, dz = w.z - l.z, d = Math.hypot(dx, dz)
      if (!l.on || d > 4) { l.x = w.x; l.y = w.y; l.z = w.z; l.a = w.k; l.on = true; l.fresh = true; continue }
      if (d < 0.3) continue
      const nx = -dz / d, nz = dx / d
      if (l.fresh) { l.nx = nx; l.nz = nz; l.fresh = false }
      const q = this.head, o = q * 12, c = q * 16, h = this.hw
      this.pos.set([l.x + l.nx * h, l.y, l.z + l.nz * h, l.x - l.nx * h, l.y, l.z - l.nz * h, w.x + nx * h, w.y, w.z + nz * h, w.x - nx * h, w.y, w.z - nz * h], o)
      const a0 = Math.min(0.6, l.a * 0.6), a1 = Math.min(0.6, w.k * 0.6)
      this.col[c + 3] = a0; this.col[c + 7] = a0; this.col[c + 11] = a1; this.col[c + 15] = a1
      this.aPos.addUpdateRange(o, 12); this.aCol.addUpdateRange(c, 16); wrote = true
      this.head = (q + 1) % this.max; this.n = Math.min(this.max, this.n + 1)
      l.x = w.x; l.y = w.y; l.z = w.z; l.nx = nx; l.nz = nz; l.a = w.k
    }
    if (wrote) { this.aPos.needsUpdate = true; this.aCol.needsUpdate = true }
  }
}
