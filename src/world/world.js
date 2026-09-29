import './world.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createSky, createSkyline } from './sky.js'
import { createFxPass, Trail } from './fx.js'
import { createAudio } from './audio.js'
import { initAnalytics, track } from './analytics.js'
import { ZONES, PROJECTS, projZones, JOBS, SKILLS, STATS, DIALOGUE, ORB_NAMES, ARC, gateX, GATE_Z } from './content.js'

const $ = (s) => document.querySelector(s)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const damp = (dt, k) => 1 - Math.exp(-k * dt)
/* ---- capability gate: no WebGL2 → classic site; software renderer → low quality + notice */
const qs = new URLSearchParams(location.search)
const gpuProbe = (() => {
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2')
    if (!gl) return { ok: false }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { ok: true, name, soft: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) }
  } catch (_) { return { ok: false } }
})()
if (!gpuProbe.ok) { location.replace('/classic.html?why=webgl'); throw new Error('WebGL2 unavailable — redirecting to the classic version') }
const coarse = matchMedia('(pointer:coarse)').matches
const isMobile = coarse || Math.min(innerWidth, innerHeight) < 600
const forceHQ = qs.get('quality') === 'high'
const lowEnd = !forceHQ && ((isMobile && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3)) || gpuProbe.soft)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
let qMode = qs.get('quality') || ''
if (!['auto', 'high', 'med', 'low'].includes(qMode)) { try { qMode = localStorage.getItem('im-quality') || 'auto' } catch (_) { qMode = 'auto' } }
if (!['auto', 'high', 'med', 'low'].includes(qMode)) qMode = 'auto'
const WORLD_R = 88
const PINK = 0xff2d8a, VIOLET = 0x7a5cff
const F_SANS = "'Inter Tight', sans-serif", F_SERIF = "'Instrument Serif', serif", F_MONO = "'JetBrains Mono', monospace"

/* ------------------------------------------------------------------ renderer */
const canvas = $('#world')
let renderer
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }) } catch (e) { location.replace('/classic.html?why=webgl'); throw e }
const gfxErr = document.getElementById('gfxError')
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gfxErr.classList.add('is-on') })
canvas.addEventListener('webglcontextrestored', () => location.reload())
if (gpuProbe.soft && !forceHQ) document.getElementById('startWarn').hidden = false
let pixelRatio = lowEnd ? 1 : Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 1.75)
renderer.setPixelRatio(pixelRatio)
renderer.setSize(innerWidth, innerHeight, false)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x050508)
scene.fog = new THREE.FogExp2(0x050508, 0.011)
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 700)
camera.position.set(0, 14, 34)

const composer = new EffectComposer(renderer)
composer.setPixelRatio(pixelRatio)
composer.setSize(innerWidth, innerHeight)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.5, 0.6)
bloom.enabled = qMode === 'auto' ? !lowEnd : qMode !== 'low'
composer.addPass(bloom)
composer.addPass(new OutputPass())
const fx = createFxPass(); fx.enabled = !reduceMotion && (qMode === 'auto' ? !lowEnd : qMode !== 'low'); composer.addPass(fx)
renderer.info.autoReset = false
const BASE_RATIO = pixelRatio

scene.add(new THREE.HemisphereLight(0x7a6cff, 0x140812, 0.9))
const moon = new THREE.DirectionalLight(0xc9c0ff, 1.1)
moon.position.set(-30, 60, 20)
scene.add(moon)

/* ------------------------------------------------------------------ helpers */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'); draw(x, w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}
const basic = (map, opts = {}) => new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, ...opts })
const glow = (color, i = 2) => new THREE.MeshStandardMaterial({ color: 0x0a0a10, emissive: color, emissiveIntensity: i, roughness: 0.4 })
const dark = (c = 0x101018, r = 0.45, m = 0.5) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, flatShading: true })
function sprite(text, { size = 3, color = '#f2efec', font = `300 120px ${F_SANS}`, accent } = {}) {
  const tex = canvasTex(1024, 256, (x, w, h) => {
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color
    x.shadowColor = accent || '#ff2d8a'; x.shadowBlur = 24; x.fillText(text, w / 2, h / 2)
  })
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }))
  s.scale.set(size * 4, size, 1)
  return s
}
const statics = []
const camObs = [] // extra camera-only obstacles: billboard faces (statics only cover their poles)
const tickers = []
const addStatic = (x, z, r) => statics.push({ x, z, r })
function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647) }

/* ------------------------------------------------------------------ fonts → build */
async function loadFonts() {
  if (!document.fonts) return
  try {
    await Promise.race([
      Promise.all([`200 60px 'Inter Tight'`, `300 30px 'Inter Tight'`, `italic 400 60px 'Instrument Serif'`, `300 30px 'JetBrains Mono'`].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 4000)),
    ])
  } catch (_) { /* fall back to system fonts */ }
}

/* ------------------------------------------------------------------ ground */
const groundMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uCar: { value: new THREE.Vector3() }, uR: { value: WORLD_R } },
  vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader: /* glsl */ `
  uniform float uTime,uR;uniform vec3 uCar;varying vec3 vW;
  float grid(vec2 p,float s,float w){vec2 q=p/s;vec2 g=abs(fract(q-.5)-.5)/fwidth(q);return 1.-clamp(min(g.x,g.y)/w,0.,1.);}
  void main(){
    vec2 p=vW.xz;float d=length(p-uCar.xz);float r=length(p);
    float g1=grid(p,4.,1.1),g2=grid(p,20.,1.4);
    float near=exp(-d*.022);
    float rip=exp(-d*.1)*(.5+.5*sin(d*1.4-uTime*3.2));
    float wave=.5+.5*sin(r*.35-uTime*.6);
    vec3 pink=vec3(1.,.18,.54),vio=vec3(.48,.36,1.);
    vec3 col=mix(vio,pink,smoothstep(-60.,60.,p.x));
    float fade=smoothstep(uR+8.,uR*.55,r);
    vec3 c=vec3(.012,.008,.02);
    c+=col*g1*(.03+.28*near)*fade;
    c+=col*g2*(.14+.3*near)*fade;
    c+=col*rip*near*.2;
    c+=vio*.018*wave*fade;
    gl_FragColor=vec4(c,1.);
  }`,
})
const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMat)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

// boundary ring + pillars
{
  const ring = new THREE.Mesh(new THREE.TorusGeometry(WORLD_R + 3, 0.14, 6, isMobile ? 120 : 220), glow(PINK, 3))
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; scene.add(ring)
  const n = 80, pil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1, 0.7), glow(VIOLET, 2.2), n)
  const m = new THREE.Matrix4(), rnd = seeded(11)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, h = 3 + rnd() * 9
    m.compose(new THREE.Vector3(Math.cos(a) * (WORLD_R + 3), h / 2, Math.sin(a) * (WORLD_R + 3)), new THREE.Quaternion(), new THREE.Vector3(1, h, 1))
    pil.setMatrixAt(i, m)
  }
  scene.add(pil)
}
// sky, skyline, GPU-animated particles (no per-frame CPU work)
const sky = createSky(scene, { mobile: isMobile })
const skyline = createSkyline(scene, { mobile: isMobile })
const gpuTime = { value: 0 }, pxU = { value: pixelRatio }
/** Rising / drifting point cloud animated entirely in the vertex shader. */
function gpuPoints({ N, radius, height, color, size, speed = 0.4, opacity = 0.6, seed = 9, cylinder = false }) {
  const rnd = seeded(seed), p = new Float32Array(N * 3), sp = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const a = rnd() * 6.283, r = cylinder ? radius * (0.85 + rnd() * 0.3) : Math.sqrt(rnd()) * radius
    p[i * 3] = Math.cos(a) * r; p[i * 3 + 1] = rnd() * height; p[i * 3 + 2] = Math.sin(a) * r; sp[i] = speed * (0.5 + rnd())
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aSpeed', new THREE.BufferAttribute(sp, 1))
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { uTime: gpuTime, uH: { value: height }, uSize: { value: size }, uPx: pxU, uColor: { value: new THREE.Color(color) }, uOp: { value: opacity } },
    vertexShader: 'attribute float aSpeed;uniform float uTime,uH,uSize,uPx;varying float vA;void main(){vec3 p=position;p.y=mod(p.y+uTime*aSpeed,uH);p.x+=sin(uTime*.3+position.z*.7)*.5;vA=smoothstep(0.,1.5,p.y)*smoothstep(uH,uH-2.,p.y);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uSize*uPx*(40./-mv.z);}',
    fragmentShader: 'uniform vec3 uColor;uniform float uOp;varying float vA;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(uColor,smoothstep(.5,0.,d)*vA*uOp);}',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }))
  pts.frustumCulled = false; scene.add(pts)
  return pts
}
gpuPoints({ N: isMobile ? 260 : 650, radius: 85, height: 14, color: 0xb9a8ff, size: 0.2, speed: 0.5 })

/* ------------------------------------------------------------------ car */
const car = { pos: new THREE.Vector3(0, 0, 6), ang: 0, vel: new THREE.Vector2(), radius: 1.25, rearOff: 1.3, track: 0.85, mw: null, aero: null, speed: 0, fwd: 0, turn: 0, drift: 0, boost: 0, energy: 1, padKick: 0, group: new THREE.Group(), body: new THREE.Group(), wheels: [] }
{
  const b = car.body
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.7), dark(0x14141c, 0.35, 0.7)); hull.position.y = 0.45; b.add(hull)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 1.25), dark(0x1d1d2a, 0.25, 0.8)); cab.position.set(0, 0.88, 0.15); b.add(cab)
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.17, 0.26, 1.27), glow(0x2a1c5a, 0.9)); glass.position.set(0, 0.9, 0.15); b.add(glass)
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.5), glow(PINK, 3.5)); strip.position.set(s * 0.77, 0.4, 0); b.add(strip)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.13, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); head.position.set(s * 0.48, 0.5, -1.36); b.add(head)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.06), glow(0xff1030, 4)); tail.position.set(s * 0.48, 0.55, 1.36); b.add(tail)
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.4), glow(VIOLET, 2)); wing.position.set(0, 1.05, 1.25); b.add(wing)
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), basic(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ff2d8a'; x.font = `500 70px ${F_SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('IM', w / 2, h / 2 + 4) }))); roof.rotation.x = -Math.PI / 2; roof.position.set(0, 1.1, 0.15); b.add(roof)
  const wg = new THREE.CylinderGeometry(0.4, 0.4, 0.34, 18), wm = dark(0x08080c, 0.6, 0.2)
  for (const [x, z] of [[-0.88, -0.92], [0.88, -0.92], [-0.88, 0.95], [0.88, 0.95]]) {
    const w = new THREE.Group(); const m = new THREE.Mesh(wg, wm); m.rotation.z = Math.PI / 2; w.add(m)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 8), glow(VIOLET, 2)); rim.rotation.z = Math.PI / 2; w.add(rim)
    w.position.set(x, 0.4, z); car.group.add(w); car.wheels.push(w)
  }
  const light = new THREE.PointLight(PINK, 5, 14, 1.8); light.position.set(0, 0.3, 0); car.group.add(light)
  car.group.add(b); scene.add(car.group)
}
const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), basic(canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,45,138,.55)'); g.addColorStop(1, 'rgba(255,45,138,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w) }), { blending: THREE.AdditiveBlending, depthWrite: false }))
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; scene.add(pool)
const trailL = new Trail(scene, { max: isMobile ? 40 : 64 }), trailR = new Trail(scene, { max: isMobile ? 40 : 64 })
let secret = false

// boost pads: chevrons on the ground that point the way between zones
const pads = []
{
  const tex = canvasTex(128, 256, (x, w, h) => { x.clearRect(0, 0, w, h); for (let i = 0; i < 2; i++) { const y = 20 + i * 120; x.strokeStyle = '#7ee0ff'; x.lineWidth = 16; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(20, y + 70); x.lineTo(64, y); x.lineTo(108, y + 70); x.stroke() } })
  tex.wrapT = THREE.RepeatWrapping
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.9 })
  tickers.push((t) => { tex.offset.y = -(t * 0.9 % 1) })
  const seg = (fx, fz, tx, tz, ts) => { const dx = tx - fx, dz = tz - fz, L = Math.hypot(dx, dz); for (const k of ts) pads.push({ x: fx + dx * k, z: fz + dz * k, dx: dx / L, dz: dz / L, cd: 0 }) }
  seg(0, 12, -30, -8, [0.3, 0.55]); seg(0, 12, 30, -8, [0.3, 0.55]); seg(0, -10, 0, -34, [0.55, 0.85]); seg(0, 12, 0, 32, [0.35, 0.65]); seg(0, 42, 0, 62, [0.25, 0.5])
  for (const q of pads) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), mat)
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(q.dx, q.dz) + Math.PI; m.position.set(q.x, 0.07, q.z); scene.add(m)
    const r = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.3, 4), new THREE.MeshBasicMaterial({ color: 0x7ee0ff, transparent: true, opacity: 0.5, toneMapped: false })); r.rotation.x = -Math.PI / 2; r.rotation.z = Math.PI / 4; r.position.set(q.x, 0.06, q.z); scene.add(r)
  }
}

/* sparks */
const sparks = (() => {
  const N = isMobile ? 220 : 420, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N), base = new Float32Array(N * 3)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const tex = canvasTex(32, 32, (x) => { const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32) })
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))
  pts.frustumCulled = false; scene.add(pts)
  let head = 0; const c = new THREE.Color()
  return {
    emit(x, y, z, vx, vy, vz, color, l = 0.6) {
      const i = head++ % N; c.set(color)
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz; life[i] = l
      base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue }
        life[i] -= dt; vel[i * 3 + 1] -= 9 * dt
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] = Math.max(0.05, pos[i * 3 + 1] + vel[i * 3 + 1] * dt); pos[i * 3 + 2] += vel[i * 3 + 2] * dt
        const k = Math.max(life[i], 0) * 2.2
        col[i * 3] = base[i * 3] * k; col[i * 3 + 1] = base[i * 3 + 1] * k; col[i * 3 + 2] = base[i * 3 + 2] * k
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true
    },
    burst(x, y, z, color, n = 14, s = 6) { for (let i = 0; i < n; i++) this.emit(x, y, z, (Math.random() - 0.5) * s, Math.random() * s * 0.8, (Math.random() - 0.5) * s, color, 0.5 + Math.random() * 0.4) },
  }
})()

/* ------------------------------------------------------------------ spawn: Iman avatar + welcome sign */
const holoMat = new THREE.ShaderMaterial({
  uniforms: { uTime: gpuTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: 'varying vec3 vN;varying vec3 vV;varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader: `uniform float uTime;varying vec3 vN;varying vec3 vV;varying vec3 vW;
    void main(){float fr=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);
      float scan=.5+.5*sin(vW.y*30.-uTime*3.);float gl=step(.992,sin(vW.y*4.+uTime*1.3)*.5+.5)*.8;
      vec3 col=mix(vec3(.38,.9,1.),vec3(1.,.25,.6),smoothstep(0.,4.,vW.y));
      float a=(fr*1.4+.22+scan*.25+gl)*(.9+.1*sin(uTime*45.));
      gl_FragColor=vec4(col*a,a*.85);}`,
})
const avatar = new THREE.Group()
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.66, 1.5, 14), holoMat); body.position.y = 1.1; avatar.add(body)
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 6, 24), glow(PINK, 3)); trim.rotation.x = Math.PI / 2; trim.position.y = 1.2; avatar.add(trim)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 16), holoMat); head.position.y = 2.25; avatar.add(head)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.3), glow(0x62e6ff, 3.5)); visor.position.set(0, 2.3, 0.36); avatar.add(visor)
  const armGeo = new THREE.BoxGeometry(0.16, 0.9, 0.16)
  const mk = (s) => { const p = new THREE.Group(); const m = new THREE.Mesh(armGeo, holoMat); m.position.y = -0.4; p.add(m); p.position.set(s * 0.72, 1.7, 0); avatar.add(p); return p }
  avatar.armL = mk(-1); avatar.armR = mk(1)
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 8, 40), glow(VIOLET, 3)); halo.rotation.x = Math.PI / 2; halo.position.y = 0.1; avatar.add(halo)
  avatar.halo = halo
  const tag = sprite('Iman', { size: 0.9, font: `italic 400 130px ${F_SERIF}` }); tag.position.y = 3.4; avatar.add(tag); avatar.tag = tag
  avatar.scale.setScalar(1.5); avatar.position.set(0, 0, -6)
  scene.add(avatar) // hologram: intentionally not solid
  const stream = gpuPoints({ N: isMobile ? 60 : 130, radius: 1.3, height: 5.5, color: 0x62e6ff, size: 0.16, speed: 0.9, opacity: 0.95, seed: 4, cylinder: true }); stream.position.set(0, 0, -6)
}
let avatarNear = 0
tickers.push((t, dt) => {
  avatar.children[0].position.y = 1.1 + Math.sin(t * 2) * 0.05
  avatar.rotation.y = lerp(avatar.rotation.y, Math.atan2(car.pos.x - avatar.position.x, car.pos.z - avatar.position.z), damp(dt, 3))
  avatar.armR.rotation.z = -0.4 - avatarNear * (1.6 + Math.sin(t * 9) * 0.5) + Math.sin(t * 1.5) * 0.05
  avatar.armL.rotation.z = 0.15 + Math.sin(t * 1.3) * 0.05
  avatar.halo.rotation.z = t * 0.8
})

function buildSpawnSign() {
  const tex = canvasTex(2048, 700, (x, w, h) => {
    x.textAlign = 'left'; x.textBaseline = 'alphabetic'
    x.font = `200 300px ${F_SANS}`; x.fillStyle = '#f2efec'; x.shadowColor = '#ff2d8a'; x.shadowBlur = 14; x.fillText('Iman', 40, 300)
    x.font = `italic 400 300px ${F_SERIF}`; const g = x.createLinearGradient(700, 0, 1900, 0); g.addColorStop(0, '#ffd0e4'); g.addColorStop(1, '#ff2d8a'); x.fillStyle = g; x.fillText('Mohammadi', 690, 300)
    x.shadowBlur = 0; x.fillStyle = '#ff2d8a'; x.font = `300 46px ${F_MONO}`; x.fillText('SENIOR FRONT-END ARCHITECT  ·  WEBGL & 3D WEB SPECIALIST', 48, 420)
    x.fillStyle = 'rgba(242,239,236,.6)'; x.font = `300 38px ${F_MONO}`; x.fillText('9+ YEARS  ·  VUE / NUXT  ·  NEXT.JS  ·  THREE.JS  ·  GLSL  ·  GSAP', 48, 500)
    x.fillText('TEHRAN, IRAN  ·  AVAILABLE FOR NEW ROLES — 2026', 48, 560)
  })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(22, 7.5), basic(tex, { depthWrite: false })); m.position.set(0, 10.4, -17); scene.add(m)
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 11, 0.4), glow(VIOLET, 2)); p.position.set(s * 11.3, 5.5, -17); scene.add(p); addStatic(s * 11.3, -17, 0.8) }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(22.8, 0.25, 0.4), glow(PINK, 3)); bar.position.set(0, 14.3, -17); scene.add(bar)
}

/* ------------------------------------------------------------------ About station */
function buildAbout() {
  const z = ZONES.find((k) => k.id === 'about'), [cx, cz] = z.pos
  const g = new THREE.Group(); g.position.set(cx, 0, cz); scene.add(g)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.12, 6, 90), glow(PINK, 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.08; g.add(ring)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(6.2, 8.4, 0.7), dark(0x0c0c14, 0.2, 0.8)); slab.position.set(0, 4.4, 0); g.add(slab)
  const tex = canvasTex(1024, 1400, (x, w, h) => {
    x.fillStyle = '#08080d'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ff2d8a'; x.lineWidth = 6; x.strokeRect(20, 20, w - 40, h - 40)
    x.fillStyle = '#ff2d8a'; x.font = `300 40px ${F_MONO}`; x.fillText('01 — ABOUT', 70, 120)
    x.fillStyle = '#f2efec'; x.font = `200 96px ${F_SANS}`; x.fillText('Nine years', 70, 250); x.font = `italic 400 110px ${F_SERIF}`; x.fillText('of shipping.', 70, 360)
    STATS.forEach(([a, b], i) => { const y = 520 + i * 200; x.fillStyle = '#f2efec'; x.font = `200 130px ${F_SANS}`; x.fillText(a, 70, y + 90); x.fillStyle = 'rgba(242,239,236,.55)'; x.font = `300 36px ${F_MONO}`; x.fillText(b.toUpperCase(), 430, y + 80); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(70, y + 130, w - 140, 2) })
  })
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 8.1), basic(tex)); face.position.set(0, 4.4, 0.38); g.add(face)
  g.lookAt(0, 0, 4)
  const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), new THREE.MeshBasicMaterial({ color: PINK, wireframe: true, toneMapped: false })); ico.position.set(cx, 11.5, cz); scene.add(ico)
  tickers.push((t) => { ico.rotation.y = t * 0.5; ico.rotation.x = t * 0.3; ico.position.y = 11.5 + Math.sin(t * 1.5) * 0.3 })
  const s = sprite('ABOUT', { size: 2.2 }); s.position.set(cx, 15.6, cz); scene.add(s)
  addStatic(cx, cz, 3.4)
}

/* ------------------------------------------------------------------ Skills station */
const pylons = []
function buildSkills() {
  const z = ZONES.find((k) => k.id === 'skills'), [cx, cz] = z.pos
  const ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.12, 6, 90), glow(VIOLET, 3)); ring.rotation.x = Math.PI / 2; ring.position.set(cx, 0.08, cz); scene.add(ring)
  SKILLS.forEach((s, i) => {
    const a = (i / SKILLS.length) * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * 6.8, zz = cz + Math.sin(a) * 6.8
    const col = i % 2 ? VIOLET : PINK
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2.2, 8), dark()); pole.position.set(x, 1.1, zz); scene.add(pole)
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), glow(col, 2.6)); gem.scale.y = 1.5; scene.add(gem)
    const wire = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: col, wireframe: true, toneMapped: false, transparent: true, opacity: 0.5 })); scene.add(wire)
    const lab = sprite(s.g, { size: 1.2, font: `300 96px ${F_SANS}`, accent: i % 2 ? '#7a5cff' : '#ff2d8a' }); lab.position.set(x, 6.2, zz); scene.add(lab)
    addStatic(x, zz, 0.9)
    tickers.push((t) => { const y = 3.6 + Math.sin(t * 1.4 + i) * 0.35; gem.position.set(x, y, zz); wire.position.set(x, y, zz); gem.rotation.y = t * 0.9 + i; wire.rotation.y = -t * 0.5; wire.rotation.x = t * 0.3 })
    pylons.push({ gem })
  })
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.1, 0.28, 120, 12), glow(0xff8fc0, 0.9)); knot.position.set(cx, 3.5, cz); scene.add(knot)
  tickers.push((t) => { knot.rotation.x = t * 0.6; knot.rotation.y = t * 0.4 })
  const s = sprite('SKILLS', { size: 2.2, accent: '#7a5cff' }); s.position.set(cx, 10.5, cz); scene.add(s)
}

/* ------------------------------------------------------------------ Work arc */
const boards = []
const BW = 1024, BH = 640
/** Animated visual for each project. tt === 0 draws the calm "resting" frame used for inactive boards. */
function drawViz(kind, x, X, Y, W, H, tt) {
  x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip()
  x.fillStyle = '#0d0d14'; x.fillRect(X, Y, W, H)
  if (kind === 'grid') { const cols = 12, rows = 5, sz = W / cols; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const hot = tt ? Math.sin(tt * 2.4 - i * 0.55 - j * 0.9) > 0.55 : (i * 7 + j * 3) % 5 === 0; const k = tt ? 0.5 + 0.5 * Math.sin(tt * 3 - i * 0.5 - j * 0.6) : 0; const pad = 8 + k * 6; x.fillStyle = hot ? '#ff2d8a' : 'rgba(255,255,255,.10)'; x.beginPath(); x.roundRect(X + i * sz + pad, Y + j * sz + 8 + pad, sz - 2 * pad, sz - 2 * pad, hot ? (sz - 2 * pad) / 2 : 8); x.fill() } }
  if (kind === 'bars') { const n = 28, sz = W / n; for (let i = 0; i < n; i++) { const h = (0.25 + 0.7 * Math.abs(Math.sin(i * 0.7 + tt * 1.6) * Math.cos(i * 0.31 - tt * 0.9))) * H; const g = x.createLinearGradient(0, Y + H, 0, Y + H - h); g.addColorStop(0, '#7a5cff'); g.addColorStop(1, 'rgba(122,92,255,.1)'); x.fillStyle = g; x.fillRect(X + i * sz + 4, Y + H - h, sz - 8, h) } x.fillStyle = '#f2efec'; x.font = `300 60px ${F_MONO}`; x.fillText(tt ? Math.round(1150000 + Math.sin(tt * 3) * 60000).toLocaleString('en') + ' q/s' : '1.2M q/s', X + 40, Y + 90) }
  if (kind === 'cube') {
    const cx = X + W / 2, cy = Y + H / 2, sc = 100, ay = tt * 0.9, ax = 0.55, ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax)
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([px, py, pz]) => { const x1 = px * ca + pz * sa, z1 = -px * sa + pz * ca, y2 = py * cb - z1 * sb, z2 = py * sb + z1 * cb, f = 1 / (1 + z2 * 0.12); return [cx + x1 * sc * f, cy + y2 * sc * f] })
    x.strokeStyle = '#ff2d8a'; x.lineWidth = 4; x.lineJoin = 'round'
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { x.beginPath(); x.moveTo(...v[a]); x.lineTo(...v[b]); x.stroke() }
    x.fillStyle = 'rgba(255,45,138,.10)'; x.beginPath(); [4, 5, 6, 7].forEach((i, k) => (k ? x.lineTo(...v[i]) : x.moveTo(...v[i]))); x.fill()
    if (tt) { x.fillStyle = '#7ee0ff'; x.font = `300 34px ${F_MONO}`; x.fillText(`width ${(120 + Math.sin(tt) * 40).toFixed(0)}cm  ·  60fps`, X + 30, Y + H - 26) }
  }
  if (kind === 'tree') { const hi = tt ? Math.floor(tt * 2) % 6 : -1;[[0, 0, 40], [6, 1, 30], [6, 2, 52], [12, 3, 26], [12, 4, 44], [18, 5, 34]].forEach(([ind, r, w], i) => { x.fillStyle = i === hi ? 'rgba(255,45,138,.85)' : i % 3 === 1 && !tt ? 'rgba(255,45,138,.6)' : 'rgba(122,92,255,.35)'; x.strokeStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.roundRect(X + 50 + ind * 14, Y + 30 + r * 46, w * 9, 30, 6); x.fill(); x.stroke() }) }
  if (kind === 'ball') {
    const cx = X + W / 3 + (tt ? Math.sin(tt * 1.2) * 60 : 0), cy = Y + H / 2, rot = tt * 2.2
    x.fillStyle = '#eee'; x.beginPath(); x.arc(cx, cy, 90, 0, 7); x.fill(); x.fillStyle = '#111'
    for (let i = 0; i < 5; i++) { const a = i * 1.2566 + rot; x.beginPath(); x.arc(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, 20, 0, 7); x.fill() } x.beginPath(); x.arc(cx, cy, 24, 0, 7); x.fill()
    x.fillStyle = '#ff2d8a'; x.font = `italic 400 190px ${F_SERIF}`; x.fillText('2026', X + W / 2 + 10, cy + 60)
    if (tt) { x.fillStyle = '#7ee0ff'; x.font = `300 32px ${F_MONO}`; x.fillText(`PREDICT  ${1 + (Math.floor(tt) % 4)} – ${Math.floor(tt * 0.7) % 3}`, X + 30, Y + 50) }
  }
  if (kind === 'json') {
    x.font = `300 46px ${F_MONO}`
    const L = [['{', '#888'], ['  "tool": "json",', '#ff2d8a'], ['  "fast": true,', '#7ee0ff'], ['  "free": true', '#7ee0ff'], ['}', '#888']]
    let left = tt ? Math.floor(tt * 16) % 110 : 999
    L.forEach(([t, c], i) => { const part = t.slice(0, Math.max(0, left)); left -= t.length; x.fillStyle = c; x.fillText(part, X + 60, Y + 70 + i * 62) })
  }
  x.restore()
}
/** Static layer is painted once; only the visual is redrawn (and only while the board is active). */
const VZ = { x: 44, y: 88, w: BW - 88, h: 400 }
function makeBoard(p) {
  const S = document.createElement('canvas'); S.width = BW; S.height = BH
  const x = S.getContext('2d')
  x.fillStyle = '#08080d'; x.fillRect(0, 0, BW, BH)
  x.fillStyle = '#ff2d8a'; x.font = `300 34px ${F_MONO}`; x.fillText(p.n, 44, 58)
  x.fillStyle = 'rgba(242,239,236,.55)'; x.textAlign = 'right'; x.fillText(p.host.toUpperCase() + ' ↗', BW - 44, 58); x.textAlign = 'left'
  x.strokeStyle = 'rgba(255,255,255,.14)'; x.strokeRect(VZ.x, VZ.y, VZ.w, VZ.h)
  x.fillStyle = '#f2efec'; x.font = `200 96px ${F_SANS}`; x.fillText(p.name, 44, 566)
  x.fillStyle = 'rgba(242,239,236,.55)'; x.font = `300 28px ${F_MONO}`; x.fillText(p.stack.toUpperCase(), 46, 612)
  const L = document.createElement('canvas'); L.width = BW; L.height = BH
  const lx = L.getContext('2d')
  const tex = new THREE.CanvasTexture(L); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = isMobile ? 4 : 8
  let img = null
  const chip = (tt) => {
    lx.font = `300 26px ${F_MONO}`; const label = p.chip.toUpperCase(), tw = lx.measureText(label).width + 44
    lx.fillStyle = 'rgba(5,5,10,.78)'; lx.strokeStyle = '#ff2d8a'; lx.lineWidth = 2; lx.beginPath(); lx.roundRect(VZ.x + 18, VZ.y + 18, tw, 46, 23); lx.fill(); lx.stroke()
    lx.fillStyle = tt ? '#7ee0ff' : '#f2efec'; lx.fillText(label, VZ.x + 40, VZ.y + 50)
  }
  const render = (tt) => {
    lx.drawImage(S, 0, 0)
    if (img) {
      const ih = VZ.w * (img.height / img.width), pan = Math.max(0, ih - VZ.h) * (tt ? 0.5 - 0.5 * Math.cos(tt * 0.45) : 0)
      lx.save(); lx.beginPath(); lx.rect(VZ.x, VZ.y, VZ.w, VZ.h); lx.clip(); lx.drawImage(img, VZ.x, VZ.y - pan, VZ.w, ih)
      const g = lx.createLinearGradient(0, VZ.y + VZ.h - 90, 0, VZ.y + VZ.h); g.addColorStop(0, 'rgba(8,8,13,0)'); g.addColorStop(1, 'rgba(8,8,13,.75)'); lx.fillStyle = g; lx.fillRect(VZ.x, VZ.y + VZ.h - 90, VZ.w, 90); lx.restore()
    } else drawViz(p.viz, lx, VZ.x, VZ.y, VZ.w, VZ.h, tt)
    chip(tt); tex.needsUpdate = true
  }
  render(0)
  if (p.img) { const im = new Image(); im.onload = () => { img = im; render(0) }; im.src = `/shots/${p.img}.webp` }
  return { tex, render, last: -1 }
}
function buildWork() {
  const [cx, cz] = ARC.c
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ARC.r - 4, 0.1, 6, 120), glow(PINK, 2.5)); ring.rotation.x = Math.PI / 2; ring.position.set(cx, 0.08, cz); scene.add(ring)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(ARC.r - 15, 0.06, 6, 100), glow(VIOLET, 2)); ring2.rotation.x = Math.PI / 2; ring2.position.set(cx, 0.08, cz); scene.add(ring2)
  const title = sprite('SELECTED WORK', { size: 3 }); title.position.set(cx, 12, cz - 6); scene.add(title)
  const sub = sprite('drive up to a board — press E to open the site', { size: 0.8, font: `300 64px ${F_MONO}`, color: 'rgba(242,239,236,.7)' }); sub.position.set(cx, 9.4, cz - 6); scene.add(sub)
  projZones.forEach((p, i) => {
    const g = new THREE.Group(); g.position.set(p.board[0], 0, p.board[1]); scene.add(g)
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 0.5), dark()); pole.position.y = 2; g.add(pole)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.5, 6.1, 0.3), glow(i % 2 ? VIOLET : PINK, 1.6)); frame.position.y = 6.8; g.add(frame)
    const live = makeBoard(p)
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.1, 5.7), basic(live.tex, { transparent: false, color: new THREE.Color().setScalar(0.62) })); screen.position.set(0, 6.8, 0.17); g.add(screen)
    g.lookAt(cx, 0, cz)
    addStatic(p.board[0], p.board[1], 1)
    { const tx = -(cz - p.board[1]), tz = cx - p.board[0], L = Math.hypot(tx, tz); for (const k of [-3.6, 0, 3.6]) camObs.push({ x: p.board[0] + (tx / L) * k, z: p.board[1] + (tz / L) * k, r: 1.9, top: 10.5 }) }
    boards.push({ id: p.id, g, frame, live, base: i % 2 ? VIOLET : PINK })
    tickers.push((t) => { g.position.y = Math.sin(t * 1.2 + i) * 0.12 })
  })
}

/* ------------------------------------------------------------------ Career path */
function buildPath() {
  const z0 = GATE_Z
  const line = new THREE.Mesh(new THREE.PlaneGeometry(110, 0.35), glow(VIOLET, 3)); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.06, z0); scene.add(line)
  for (let x = -50; x <= 50; x += 10) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1.6), glow(PINK, 2)); t.rotation.x = -Math.PI / 2; t.position.set(x, 0.06, z0); scene.add(t) }
  const title = sprite('CAREER PATH', { size: 2.6, accent: '#7a5cff' }); title.position.set(0, 14, z0 + 4); scene.add(title)
  JOBS.forEach((j, i) => {
    const x = gateX[i]
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.5, 0.9), dark(0x0d0d14, 0.3, 0.7)); p.position.set(x + s * 6.3, 4.75, z0); scene.add(p); const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 9.6, 0.16), glow(PINK, 3)); e.position.set(x + s * 6.3, 4.8, z0 - 0.5); scene.add(e); addStatic(x + s * 6.3, z0, 0.9) }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.5, 0.9), dark(0x0d0d14, 0.3, 0.7)); beam.position.set(x, 9.6, z0); scene.add(beam)
    const tex = canvasTex(1400, 440, (c, w, h) => {
      c.fillStyle = '#08080d'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7a5cff'; c.lineWidth = 5; c.strokeRect(12, 12, w - 24, h - 24)
      c.fillStyle = '#ff2d8a'; c.font = `300 44px ${F_MONO}`; c.fillText(j.date.toUpperCase(), 60, 90)
      c.fillStyle = '#f2efec'; c.font = `200 110px ${F_SANS}`; c.fillText(j.co, 60, 230)
      c.fillStyle = 'rgba(242,239,236,.6)'; c.font = `italic 400 76px ${F_SERIF}`; c.fillText(j.role, 60, 330)
      c.fillStyle = 'rgba(242,239,236,.35)'; c.font = `300 36px ${F_MONO}`; c.fillText(`0${i + 1} / 03`, w - 220, 90)
    })
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.85), basic(tex, { transparent: false })); board.position.set(x, 7.6, z0 - 0.5); board.rotation.y = Math.PI; scene.add(board)
    const board2 = board.clone(); board2.position.z = z0 + 0.5; board2.rotation.y = 0; scene.add(board2)
    const arch = new THREE.Mesh(new THREE.TorusGeometry(6.3, 0.07, 6, 64, Math.PI), glow(VIOLET, 3)); arch.position.set(x, 9.7, z0); scene.add(arch)
  })
}

/* ------------------------------------------------------------------ Contact portal */
const portal = { rings: [], beam: null }
function buildContact() {
  const [cx, cz] = ZONES.find((k) => k.id === 'contact').pos
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, 0.8, 8), dark(0x0d0d14, 0.3, 0.8)); base.position.set(cx, 0.4, cz); scene.add(base); addStatic(cx, cz, 3.6)
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.55, 0.09, 8, 60), glow(i % 2 ? VIOLET : PINK, 3.5)); r.position.set(cx, 2 + i * 1.6, cz); scene.add(r); portal.rings.push(r)
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 70, 24, 1, true), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); beam.position.set(cx, 35, cz); scene.add(beam)
  tickers.push((t) => { portal.rings.forEach((r, i) => { r.rotation.x = Math.PI / 2 + Math.sin(t * 0.8 + i) * 0.35; r.rotation.y = t * (0.5 + i * 0.15) * (i % 2 ? -1 : 1) }) })
  const tex = canvasTex(2048, 700, (x, w) => {
    x.textAlign = 'center'; x.fillStyle = '#f2efec'; x.shadowColor = '#ff2d8a'; x.shadowBlur = 30
    x.font = `200 210px ${F_SANS}`; x.fillText("Let's build", w / 2, 220); x.font = `italic 400 230px ${F_SERIF}`; x.fillStyle = '#ffd0e4'; x.fillText('something that moves.', w / 2, 460)
    x.shadowBlur = 0; x.fillStyle = '#ff2d8a'; x.font = `300 52px ${F_MONO}`; x.fillText('IM.ENZO.021@GMAIL.COM', w / 2, 590)
  })
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 8.9), basic(tex, { depthWrite: false })); sign.position.set(cx, 17, cz + 16); sign.rotation.y = Math.PI; scene.add(sign)
  const s = sprite('CONTACT', { size: 2.4 }); s.position.set(cx, 12.5, cz - 6); scene.add(s)
}

/* ------------------------------------------------------------------ pushables + orbs (instanced: a handful of draw calls) */
const pushables = []
const dummy = new THREE.Object3D()
const inst = {}
{
  const rnd = seeded(21), boxG = new THREE.BoxGeometry(1.2, 1.2, 1.2), sphG = new THREE.IcosahedronGeometry(0.75, 1)
  const avoid = ZONES.map((z) => z.pos).concat(projZones.map((p) => p.board), [[0, 6]])
  const specs = []
  for (let i = 0; i < 26; i++) {
    let x, z, tries = 0
    do { const a = rnd() * 6.283, r = 10 + Math.sqrt(rnd()) * 70; x = Math.cos(a) * r; z = Math.sin(a) * r * 0.95 + 8 } while (tries++ < 40 && avoid.some((p) => Math.hypot(p[0] - x, p[1] - z) < 13))
    specs.push({ x, z, isBox: rnd() < 0.55, col: rnd() < 0.5 ? PINK : VIOLET })
  }
  const nb = specs.filter((k) => k.isBox).length, ns = specs.length - nb
  const solidMat = () => new THREE.MeshStandardMaterial({ color: 0x14141c, emissive: 0x5a2470, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.6, flatShading: true })
  const mk = (geo, n, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; scene.add(m); return m }
  inst.boxS = mk(boxG, nb, solidMat()); inst.boxW = mk(boxG, nb, new THREE.MeshBasicMaterial({ wireframe: true, toneMapped: false }))
  inst.sphS = mk(sphG, ns, solidMat()); inst.sphW = mk(sphG, ns, new THREE.MeshBasicMaterial({ wireframe: true, toneMapped: false }))
  const c = new THREE.Color(); let bi = 0, si = 0
  for (const k of specs) {
    const idx = k.isBox ? bi++ : si++, w = k.isBox ? inst.boxW : inst.sphW
    w.setColorAt(idx, c.set(k.col))
    pushables.push({ x: k.x, z: k.z, vx: 0, vz: 0, r: k.isBox ? 0.85 : 0.75, y: k.isBox ? 0.6 : 0.75, isBox: k.isBox, idx, rx: 0, rz: 0, obj: null })
  }
  inst.boxW.instanceColor.needsUpdate = true; inst.sphW.instanceColor.needsUpdate = true
}
const orbs = []
const orbInfo = { got: 0 }
const orbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: 0xa892ff, toneMapped: false }), 32)
const haloMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.7, 0.03, 6, 20), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false }), 32)
orbMesh.frustumCulled = haloMesh.frustumCulled = false; scene.add(orbMesh, haloMesh)
{
  const rnd = seeded(77)
  const avoid = ZONES.map((z) => z.pos)
  for (let i = 0; i < 32; i++) {
    let x, z, tries = 0
    do { const a = rnd() * 6.283, r = 8 + Math.sqrt(rnd()) * 74; x = Math.cos(a) * r; z = Math.sin(a) * r * 0.92 + 10 } while (tries++ < 40 && (avoid.some((p) => Math.hypot(p[0] - x, p[1] - z) < 9)))
    orbs.push({ x, z, alive: true, name: ORB_NAMES[i % ORB_NAMES.length], phase: rnd() * 6 })
  }
}
$('#orbTotal').textContent = orbs.length

/* ------------------------------------------------------------------ input */
initAnalytics()
const audio = createAudio()
const buzz = (ms) => { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms) }
const keys = {}
const stick = { on: false, x: 0, y: 0, id: null }
let boostBtn = false, driftBtn = false
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const tg = e.target?.tagName
  if ((tg === 'BUTTON' || tg === 'A') && (e.code === 'Space' || e.code === 'Enter')) return
  keys[e.code] = true
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
  if (!started) { if (e.code === 'Enter' || e.code === 'Space') startGame(); return }
  if (e.code === 'KeyE' || e.code === 'Enter') interact()
  if (e.code === 'KeyT') { tour.on ? cancelTour() : startTour() }
  if (e.code === 'KeyR') { trial.on ? stopTrial('Trial cancelled') : startTrial() }
  if (e.code === 'KeyP') takePhoto()
  const n = +e.code.replace('Digit', ''); if (n >= 1 && n <= NAV.length) warp(NAV[n - 1].id)
})
addEventListener('keyup', (e) => { keys[e.code] = false })
addEventListener('blur', () => { for (const k in keys) keys[k] = false })
{
  const zone = $('#stickZone'), el = $('#stick'), knob = $('#knob'), R = 56
  let ox = 0, oy = 0
  const place = (cx, cy) => { const r = zone.getBoundingClientRect(); el.style.transform = ''; const q = el.getBoundingClientRect(), rx = q.left + q.width / 2, ry = q.top + q.height / 2; ox = clamp(cx, r.left + 70, r.right - 70); oy = clamp(cy, r.top + 70, r.bottom - 70); el.style.transform = `translate(${ox - rx}px, ${oy - ry}px)`; el.classList.add('is-live') }
  const move = (e) => { let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d } const dz = 0.12; stick.x = Math.abs(dx / R) < dz ? 0 : dx / R; stick.y = Math.abs(dy / R) < dz ? 0 : dy / R; knob.style.transform = `translate(${dx}px,${dy}px)` }
  zone.addEventListener('pointerdown', (e) => { if (stick.on) return; stick.on = true; stick.id = e.pointerId; try { zone.setPointerCapture(e.pointerId) } catch (_) { /* synthetic pointer */ } place(e.clientX, e.clientY); move(e); if (!started) startGame() })
  zone.addEventListener('pointermove', (e) => { if (stick.on && e.pointerId === stick.id) move(e) })
  const up = (e) => { if (e.pointerId !== stick.id) return; stick.on = false; stick.x = stick.y = 0; knob.style.transform = ''; el.style.transform = ''; el.classList.remove('is-live') }
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up)
  const hold = (id, set) => { const b = $(id); const on = (e) => { e.preventDefault(); set(true); b.classList.add('is-down') }, off = () => { set(false); b.classList.remove('is-down') }; b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off) }
  hold('#boostBtn', (v) => (boostBtn = v)); hold('#driftBtn', (v) => (driftBtn = v))
  $('#actBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); interact() })
}
document.addEventListener('gesturestart', (e) => e.preventDefault())

/* ------------------------------------------------------------------ zones + UI */
const NAV = ZONES.filter((z) => z.nav).map((z) => ({ id: z.id, label: z.nav }))
const navEl = $('#nav')
navEl.innerHTML = NAV.map((n, i) => `<button data-nav="${n.id}"><b>${i + 1}</b>${n.label}</button>`).join('') + '<button data-tour class="tour">▶ Tour</button><button data-trial class="tour">⏱ Trial</button><button data-nav="contact" class="hire">Hire me</button>'
const seen = new Set(); let allSeen = false
const navKey = (z) => (z.kind === 'project' ? 'work' : z.kind === 'job' ? 'gsi' : z.id)
document.addEventListener('click', (e) => { const tr = e.target.closest('[data-trial]'); if (tr) { e.preventDefault(); trial.on ? stopTrial('Trial cancelled') : startTrial(); return } const t = e.target.closest('[data-tour]'); if (t) { e.preventDefault(); tour.on ? cancelTour() : startTour(); return } const b = e.target.closest('[data-nav]'); if (!b) return; e.preventDefault(); warp(b.dataset.nav) })
const actBtn = $('#actBtn'), panel = $('#panel'), toastEl = $('#toast'), locEl = $('#loc'), hintEl = $('#hint')
let active = null, dlg = { i: 0, timer: 0, auto: 0, done: false, seen: false }

function decorate() {
  panel.classList.remove('is-min')
  if (isMobile && !panel.querySelector('.min')) panel.insertAdjacentHTML('afterbegin', '<button class="min" aria-label="Collapse panel">–</button>')
}
panel.addEventListener('click', (e) => { const ev = e.target.closest('[data-ev]'); if (ev) track('link_click', { kind: ev.dataset.ev }); const pv = e.target.closest('a.btn[href^="http"]'); if (pv && active?.url) track('project_open', { project: active.id }); if (e.target.closest('.min')) { panel.classList.toggle('is-min'); e.target.closest('.min').textContent = panel.classList.contains('is-min') ? '+' : '–' } })
function toast(t, ms = 1600) { toastEl.textContent = t; toastEl.classList.add('is-on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('is-on'), ms) }

function typeLine() {
  clearInterval(dlg.timer); clearTimeout(dlg.auto)
  const line = DIALOGUE[dlg.i], last = dlg.i === DIALOGUE.length - 1
  panel.innerHTML = `<div class="who"><i></i><b>Iman</b><span class="mono dim">${dlg.i + 1}/${DIALOGUE.length}</span></div><p class="typed"></p><div class="next mono">${last ? 'Drive on — the world is yours →' : '<kbd>E</kbd> / tap — next'}</div>`
  const el = panel.querySelector('.typed'); let n = 0; dlg.done = false
  dlg.timer = setInterval(() => {
    n += 1; el.textContent = line.slice(0, n)
    if (n >= line.length) { clearInterval(dlg.timer); dlg.done = true; el.classList.add('done'); if (!last) dlg.auto = setTimeout(nextLine, 3200 + line.length * 18); else dlg.seen = true }
  }, 22)
  panel.querySelector('.next').addEventListener('click', nextLine); decorate()
}
function nextLine() {
  if (active?.id !== 'home') return
  if (!dlg.done) { clearInterval(dlg.timer); const el = panel.querySelector('.typed'); el.textContent = DIALOGUE[dlg.i]; el.classList.add('done'); dlg.done = true; return }
  if (dlg.i < DIALOGUE.length - 1) { dlg.i++; typeLine() }
}
function enterZone(z) {
  active = z
  clearInterval(dlg.timer); clearTimeout(dlg.auto)
  navEl.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', !!z && (b.dataset.nav === z.id || (b.dataset.nav === 'home' && z.id === 'home') || (b.dataset.nav === 'work' && z.kind === 'project') || (b.dataset.nav === 'gsi' && z.kind === 'job'))))
  actBtn.classList.toggle('is-on', !!z && (z.id === 'home' || !!z.url)); actBtn.textContent = z?.url ? 'Visit ↗' : 'Next'
  if (!z) { panel.classList.remove('is-on'); locEl.innerHTML = ''; return }
  locEl.innerHTML = `Now at <b>${z.name}</b>`; audio.blip(); $('#srLive').textContent = `Now at ${z.name}`
  if (trial.on && trial.cd <= 0 && z.id === TRIAL[trial.i]) hitCheckpoint()
  if (!seen.has(navKey(z))) track('zone_first_visit', { zone: navKey(z) }); seen.add(navKey(z)); navEl.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('seen', seen.has(b.dataset.nav)))
  if (!allSeen && NAV.every((n) => seen.has(n.id))) { allSeen = true; setTimeout(() => toast('You’ve seen everything — let’s talk →', 4500), 1800) }
  hintEl.classList.add('is-off')
  if (z.id === 'home') { if (!dlg.seen) { dlg.i = 0; panel.classList.add('is-on'); typeLine() } else { panel.innerHTML = `<div class="who"><i></i><b>Iman</b></div><p class="typed done">Welcome back! Head west for About, east for Skills, north for Work, south for my path.</p>`; panel.classList.add('is-on') } }
  else if (z.html) { panel.innerHTML = z.html; panel.classList.add('is-on') }
  decorate()
}
function interact() {
  if (!active) return
  if (active.id === 'home') return nextLine()
  if (active.url) { track('project_open', { project: active.id, via: 'key' }); window.open(active.url, '_blank', 'noopener') }
}
function warp(id, keepTour = false) {
  const z = ZONES.find((k) => k.id === id); if (!z || !started) return
  if (!keepTour) { cancelTour(); stopTrial() }
  const [sx, sz] = z.spawn || z.pos, [tx, tz] = z.pos
  car.pos.set(sx, 0, sz); car.vel.set(0, 0)
  car.ang = Math.atan2(-(tx - sx), -(tz - sz))
  if (id === 'work') car.ang = 0
  camSnap = true
  const f = $('#flash'); f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on')
}

/* minimap */
const mini = $('#mini'), mctx = mini.getContext('2d')
function drawMini() {
  const S = 300, c = S / 2, k = c / (WORLD_R + 6)
  mctx.clearRect(0, 0, S, S)
  mctx.strokeStyle = 'rgba(255,45,138,.5)'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(c, c, c - 3, 0, 7); mctx.stroke()
  for (const z of ZONES) { if (z.silent || z.kind === 'project') continue; mctx.fillStyle = z.id === active?.id ? '#fff' : z.kind === 'job' ? '#7a5cff' : '#ff2d8a'; mctx.beginPath(); mctx.arc(c + z.pos[0] * k, c + z.pos[1] * k, 5, 0, 7); mctx.fill() }
  mctx.fillStyle = 'rgba(255,45,138,.7)'; for (const p of projZones) mctx.fillRect(c + p.pos[0] * k - 3, c + p.pos[1] * k - 3, 6, 6)
  mctx.fillStyle = '#a892ff'; for (const o of orbs) if (o.alive) { mctx.beginPath(); mctx.arc(c + o.x * k, c + o.z * k, 2.4, 0, 7); mctx.fill() }
  mctx.save(); mctx.translate(c + car.pos.x * k, c + car.pos.z * k); mctx.rotate(-car.ang); mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.moveTo(0, -9); mctx.lineTo(6, 7); mctx.lineTo(-6, 7); mctx.closePath(); mctx.fill(); mctx.restore()
}

/* ------------------------------------------------------------------ physics */
const tmp = new THREE.Vector2()
function collideCircle(x, z, r, out) {
  let hit = false
  for (const s of statics) {
    const dx = x - s.x, dz = z - s.z, m = r + s.r, d2 = dx * dx + dz * dz
    if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2), nx = dx / d, nz = dz / d; x = s.x + nx * m; z = s.z + nz * m; out.nx = nx; out.nz = nz; hit = true }
  }
  const d = Math.hypot(x, z), lim = WORLD_R - r
  if (d > lim) { const nx = -x / d, nz = -z / d; x = -nx * lim; z = -nz * lim; out.nx = nx; out.nz = nz; hit = true }
  out.x = x; out.z = z; return hit
}
const hitOut = { x: 0, z: 0, nx: 0, nz: 0 }
let shake = 0
const TOUR = [
  { p: [0, 4], dwell: 11 },
  { p: [-14, 4] }, { p: [-28, -6], dwell: 8 },
  { p: [-14, 8] }, { p: [0, 10] }, { p: [14, 8] }, { p: [27, -4], dwell: 8 },
  { p: [12, -12] }, { p: [0, -24] },
  ...projZones.map((z) => ({ p: z.pos, dwell: 4.6 })),
  { p: [48, -40] }, { p: [50, 10] }, { p: [-36, 20] },
  { p: [-36, 36], dwell: 6.5 }, { p: [-18, 40] }, { p: [-18, 26] }, { p: [0, 24] }, { p: [0, 36], dwell: 6.5 },
  { p: [18, 40] }, { p: [18, 26] }, { p: [36, 24] }, { p: [36, 36], dwell: 6.5 },
  { p: [24, 50] }, { p: [0, 55], dwell: 10 },
]
const tour = { on: false, i: 0, wait: 0, stuck: 0 }
/* time trial: "speedrun the CV" — hit five checkpoints in order, fastest time is stored locally */
const TRIAL = ['about', 'skills', 'rizo', 'dew', 'contact']
let best = 0; try { best = +localStorage.getItem('im-best') || 0 } catch (_) { /* private mode */ }
const trial = { on: false, i: 0, t: 0, cd: 0, step: 0 }
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 70, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x7ee0ff, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
beacon.visible = false; scene.add(beacon)
const zoneById = (id) => ZONES.find((z) => z.id === id)
const setBeacon = () => { const z = zoneById(TRIAL[trial.i]); beacon.position.set(z.pos[0], 35, z.pos[1]) }
function startTrial() {
  if (!ready) return
  if (!started) startGame()
  cancelTour(); warp('home', true)
  Object.assign(trial, { on: true, i: 0, t: 0, cd: 3.6, step: 0 }); beacon.visible = true; setBeacon(); tourChip.classList.add('is-on'); track('trial_start')
}
function stopTrial(msg) { if (!trial.on) return; trial.on = false; beacon.visible = false; tourChip.classList.remove('is-on'); if (msg) toast(msg, 3000) }
function finishTrial() {
  const ms = trial.t, rec = !best || ms < best
  if (rec) { best = ms; try { localStorage.setItem('im-best', String(ms)) } catch (_) { /* ignore */ } }
  track('trial_finish', { sec: Math.round(ms) }); stopTrial(); toast(`🏁 ${ms.toFixed(1)}s${rec ? ' — new best!' : ` · best ${best.toFixed(1)}s`}`, 5500)
  for (let i = 0; i < 50; i++) sparks.emit(car.pos.x, 1.5, car.pos.z, (Math.random() - 0.5) * 16, 4 + Math.random() * 9, (Math.random() - 0.5) * 16, new THREE.Color().setHSL(Math.random(), 0.9, 0.6), 1.3)
}
function hitCheckpoint() {
  audio.chime(trial.i * 2); sparks.burst(car.pos.x, 1.2, car.pos.z, 0x7ee0ff, 24, 9); trial.i++
  if (trial.i >= TRIAL.length) finishTrial(); else { setBeacon(); toast(`Checkpoint ${trial.i}/${TRIAL.length} ✓`, 1200) }
}
function updateTrial(dt) {
  if (!trial.on) return
  if (trial.cd > 0) {
    trial.cd -= dt; const marks = [3.4, 2.6, 1.6, 0.6]
    while (trial.step < 4 && trial.cd <= marks[trial.step]) { toast(trial.step < 3 ? String(3 - trial.step) : 'GO!', 700); audio.blip(); trial.step++ }
  } else trial.t += dt
  if (frame % 3 === 0) { const z = zoneById(TRIAL[trial.i]), d = Math.round(Math.hypot(car.pos.x - z.pos[0], car.pos.z - z.pos[1])); tourChip.innerHTML = trial.cd > 0 ? '<b>Time trial</b> get ready…' : `<b>${trial.t.toFixed(1)}s</b> → ${z.name} · ${d}m <span>${best ? '· best ' + best.toFixed(1) + 's' : ''}</span>` }
}
const tourChip = $('#tourChip')
const paintTour = () => { tourChip.innerHTML = `<b>Auto tour</b> ${Math.min(tour.i + 1, TOUR.length)}/${TOUR.length} <span>— ${coarse ? 'touch' : 'press any key'} to take the wheel</span>` }
function startTour() {
  if (!ready) return
  if (!started) startGame()
  warp('home', true); tour.on = true; tour.i = 0; tour.wait = 0; tour.stuck = 0
  tourChip.classList.add('is-on'); paintTour(); track('tour_start')
}
function cancelTour(msg) { if (!tour.on) return; tour.on = false; tourChip.classList.remove('is-on'); if (msg) toast(msg, 3200) }
const userActive = () => keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || keys.Space || keys.ShiftLeft || keys.ShiftRight || stick.on || boostBtn || driftBtn || padOn
const IDLE = { f: 0, t: 0, boost: false, drift: false }
/* gamepad (standard mapping): sticks/triggers drive, RB or B boost, X or LB drift, A interact/start, Y tour, Start begins */
const dz = (v, d = 0.16) => (Math.abs(v) < d ? 0 : v)
let padOn = false, padPrev = {}, padS = null
function readPad() { const list = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of list) if (g && g.connected) return g; return null }
function padState() {
  const g = readPad(); if (!g) return null
  const b = (i) => !!g.buttons[i]?.pressed, v = (i) => g.buttons[i]?.value || 0
  let f = v(7) - v(6); const ly = dz(g.axes[1] ?? 0); if (f === 0 && ly) f = -ly
  return { f, t: dz(g.axes[0] ?? 0), boost: b(5) || b(1), drift: b(2) || b(4), a: b(0), y: b(3), start: b(9) }
}
function pollPad() {
  padS = padState()
  if (!padS) { padOn = false; return }
  padOn = Math.abs(padS.f) > 0.25 || Math.abs(padS.t) > 0.25 || padS.boost || padS.drift
  if ((padS.a || padS.start) && !padPrev.a && !padPrev.start && !started) startGame()
  else if (padS.a && !padPrev.a) interact()
  if (padS.y && !padPrev.y && started) { tour.on ? cancelTour() : startTour() }
  padPrev = padS
}
function autopilot(dt) {
  const w = TOUR[tour.i]
  if (!w) { track('tour_complete'); cancelTour('That was the tour — take the wheel and explore ✦'); return IDLE }
  if (tour.wait > 0) { tour.wait -= dt; if (tour.wait <= 0) { tour.i++; paintTour() } return { f: car.speed > 1.5 ? -0.6 : 0, t: 0, boost: false, drift: false } }
  const dx = w.p[0] - car.pos.x, dz = w.p[1] - car.pos.z, d = Math.hypot(dx, dz)
  let err = Math.atan2(-dx, -dz) - car.ang; err = Math.atan2(Math.sin(err), Math.cos(err))
  if (d < (w.dwell ? 3.4 : 5)) { if (w.dwell) tour.wait = w.dwell; else { tour.i++; paintTour() } tour.stuck = 0; return IDLE }
  tour.stuck = Math.abs(car.speed) < 0.6 ? tour.stuck + dt : 0
  if (tour.stuck > 3) { tour.i++; tour.stuck = 0; paintTour() }
  const align = Math.max(0, Math.cos(err)), vmax = (w.dwell ? clamp(d * 1.5, 5, 18) : 18) * (0.35 + 0.65 * align)
  return { f: car.speed < vmax ? 1 : car.speed > vmax + 3 ? -0.5 : 0.15, t: clamp(-err * 2.4, -1, 1), boost: d > 28 && align > 0.95 && car.energy > 0.6, drift: false }
}
function getInput(dt) {
  if (trial.on && trial.cd > 0) return IDLE
  if (tour.on) { if (userActive()) cancelTour(); else return autopilot(dt) }
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0)
  let t = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
  if (stick.on) { f = clamp(-stick.y * 1.5, -1, 1); t = clamp(stick.x * 1.5, -1, 1) }
  if (padS) { f = clamp(f + padS.f, -1, 1); t = clamp(t + padS.t, -1, 1) }
  return { f, t, boost: keys.ShiftLeft || keys.ShiftRight || boostBtn || !!padS?.boost, drift: !!keys.Space || driftBtn || !!padS?.drift }
}
function updateCar(dt, t) {
  const inp = started ? getInput(dt) : IDLE
  car.turn += (inp.t - car.turn) * damp(dt, 9)
  const wantBoost = inp.boost && inp.f > 0 && car.energy > 0.03
  car.boost += ((wantBoost ? 1 : 0) - car.boost) * damp(dt, 6)
  car.energy = clamp(car.energy + (wantBoost ? -0.26 : 0.08) * dt, 0, 1)
  car.padKick = Math.max(0, car.padKick - dt * 1.5)
  const fx = -Math.sin(car.ang), fz = -Math.cos(car.ang)
  const fwdSpeed = car.vel.x * fx + car.vel.y * fz
  const acc = (inp.f > 0 ? 30 : inp.f < 0 ? (fwdSpeed > 1 ? 46 : 20) : 0) * (1 + car.boost * 0.9)
  car.vel.x += fx * inp.f * acc * dt; car.vel.y += fz * inp.f * acc * dt
  // lateral grip (drifts when handbrake)
  const rx = -fz, rz = fx
  const latSpeed = car.vel.x * rx + car.vel.y * rz
  const grip = inp.drift ? 1.1 : 7.5
  const kill = latSpeed * (1 - Math.exp(-grip * dt))
  car.vel.x -= rx * kill; car.vel.y -= rz * kill
  const drag = inp.f === 0 ? 1.6 : 0.35
  const sp = Math.hypot(car.vel.x, car.vel.y), max = 27 * (1 + car.boost * 0.55)
  const dk = Math.exp(-(drag + (sp > max ? (sp - max) * 0.4 : 0)) * dt)
  car.vel.x *= dk; car.vel.y *= dk
  car.speed = car.vel.x * fx + car.vel.y * fz
  audio.engine(clamp(Math.abs(car.speed) / 30, 0, 1), Math.abs(inp.f), car.boost)
  const steer = clamp(car.speed / 5, -1, 1) * (inp.drift ? 1.5 : 1)
  car.ang -= car.turn * 2.15 * steer * dt
  car.pos.x += car.vel.x * dt; car.pos.z += car.vel.y * dt
  for (const q of pads) {
    if (q.cd > 0) { q.cd -= dt; continue }
    if ((car.pos.x - q.x) ** 2 + (car.pos.z - q.z) ** 2 < 6.8) {
      q.cd = 1.4; car.vel.x += q.dx * 15; car.vel.y += q.dz * 15; car.energy = Math.min(1, car.energy + 0.4); car.padKick = 1
      audio.blip(); buzz(15); sparks.burst(q.x, 0.4, q.z, 0x7ee0ff, 16, 8)
    }
  }
  if (collideCircle(car.pos.x, car.pos.z, car.radius, hitOut)) {
    car.pos.x = hitOut.x; car.pos.z = hitOut.z
    const vn = car.vel.x * hitOut.nx + car.vel.y * hitOut.nz
    if (vn < 0) { car.vel.x -= hitOut.nx * vn * 1.4; car.vel.y -= hitOut.nz * vn * 1.4; if (vn < -5) { audio.thud(); buzz(28); shake = Math.min(0.5, -vn * 0.03); sparks.burst(car.pos.x - hitOut.nx * 1.2, 0.6, car.pos.z - hitOut.nz * 1.2, 0xffd0e4, 16, 7) } }
  }
  // visuals
  car.group.position.set(car.pos.x, 0, car.pos.z); car.group.rotation.y = car.ang
  car.body.rotation.z = lerp(car.body.rotation.z, car.turn * clamp(car.speed / 25, -1, 1) * 0.12, damp(dt, 8))
  car.body.rotation.x = lerp(car.body.rotation.x, -inp.f * 0.05, damp(dt, 6))
  car.body.position.y = Math.sin(t * 40) * 0.006 * clamp(Math.abs(car.speed) / 20, 0, 1)
  if (car.mw) {
    for (const w of car.mw) { w.g.rotation.x += car.speed * dt / w.r; if (w.front) w.g.rotation.y = -car.turn * 0.45 }
    if (car.aero) { const a = car.aero; a.t += ((car.boost > 0.25 ? 1 : 0) - a.t) * damp(dt, 2.2); a.action.time = a.t * a.dur; a.mixer.update(0) }
  } else {
    for (const w of car.wheels) w.children[0].rotation.x += car.speed * dt / 0.4, w.children[1].rotation.x = w.children[0].rotation.x
    car.wheels[0].rotation.y = car.wheels[1].rotation.y = -car.turn * 0.45
  }
  pool.position.set(car.pos.x, 0.04, car.pos.z); pool.material.opacity = 0.5 + car.boost * 0.4
  // light trails from the rear wheels
  {
    const tx = car.pos.x - fx * car.rearOff, tz = car.pos.z - fz * car.rearOff, mv = Math.abs(car.speed) > 3
    const hex = car.boost > 0.3 ? 0x7ee0ff : PINK, w = 1 + car.boost * 0.8
    trailL.update(dt, tx + rx * car.track, tz + rz * car.track, rx, rz, hex, mv, w, secret ? 1 : 0)
    trailR.update(dt, tx - rx * car.track, tz - rz * car.track, rx, rz, hex, mv, w, secret ? 1 : 0)
  }
  // sparks: drift smoke + boost flame
  const drifting = Math.abs(latSpeed) > 4
  if (drifting || car.boost > 0.5) {
    for (const s of [-1, 1]) {
      const bx = car.pos.x - fx * car.rearOff + rx * s * car.track, bz = car.pos.z - fz * car.rearOff + rz * s * car.track
      sparks.emit(bx, 0.15, bz, -fx * 3 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, -fz * 3 + (Math.random() - 0.5) * 2, car.boost > 0.5 ? 0x7ee0ff : PINK, 0.5)
    }
  }
  return latSpeed
}
const pOut = { x: 0, z: 0, nx: 0, nz: 0 }
function updatePushables(dt) {
  for (const p of pushables) {
    p.vx *= Math.exp(-1.7 * dt); p.vz *= Math.exp(-1.7 * dt)
    p.x += p.vx * dt; p.z += p.vz * dt
    const dx = p.x - car.pos.x, dz = p.z - car.pos.z, m = p.r + car.radius - 0.05, d = Math.hypot(dx, dz)
    if (d < m && d > 1e-4) {
      const nx = dx / d, nz = dz / d; p.x = car.pos.x + nx * m; p.z = car.pos.z + nz * m
      const rel = car.vel.x * nx + car.vel.y * nz
      if (rel > 0) { p.vx += nx * rel * 1.15; p.vz += nz * rel * 1.15; car.vel.x -= nx * rel * 0.12; car.vel.y -= nz * rel * 0.12; if (rel > 6) sparks.burst(p.x, 0.8, p.z, PINK, 4, 4) }
    }
    if (collideCircle(p.x, p.z, p.r, pOut)) { p.x = pOut.x; p.z = pOut.z; const vn = p.vx * pOut.nx + p.vz * pOut.nz; if (vn < 0) { p.vx -= pOut.nx * vn * 1.7; p.vz -= pOut.nz * vn * 1.7 } }
    if (Math.abs(p.vx) + Math.abs(p.vz) < 0.05) p.vx = p.vz = 0
    p.rx += p.vz * dt / p.r; p.rz -= p.vx * dt / p.r
    const solid = p.isBox ? inst.boxS : inst.sphS, wire = p.isBox ? inst.boxW : inst.sphW
    if (p.obj) { p.obj.position.set(p.x, 0, p.z); p.obj.rotation.set(p.rx, 0, p.rz); continue }
    dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, 0, p.rz); dummy.scale.setScalar(1); dummy.updateMatrix(); solid.setMatrixAt(p.idx, dummy.matrix)
    dummy.scale.setScalar(1.02); dummy.updateMatrix(); wire.setMatrixAt(p.idx, dummy.matrix)
  }
  inst.boxS.instanceMatrix.needsUpdate = inst.boxW.instanceMatrix.needsUpdate = inst.sphS.instanceMatrix.needsUpdate = inst.sphW.instanceMatrix.needsUpdate = true
}
function updateOrbs(dt, t) {
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i]
    if (!o.alive) { dummy.scale.setScalar(0); dummy.position.set(0, -50, 0); dummy.updateMatrix(); orbMesh.setMatrixAt(i, dummy.matrix); haloMesh.setMatrixAt(i, dummy.matrix); continue }
    const dx = car.pos.x - o.x, dz = car.pos.z - o.z, d = Math.hypot(dx, dz)
    if (d < 7) { const k = (1 - d / 7) * 14 * dt; o.x += dx * k / Math.max(d, 0.5); o.z += dz * k / Math.max(d, 0.5) }
    if (d < 1.9) {
      o.alive = false; orbInfo.got++
      $('#orbCount').textContent = orbInfo.got
      sparks.burst(o.x, 1.2, o.z, 0xa892ff, 18, 7); audio.chime(orbInfo.got); buzz(12)
      if (orbInfo.got === orbs.length) unlockSecret()
      else toast(`+ ${o.name}  ·  ${orbInfo.got}/${orbs.length}`, 1300)
      continue
    }
    dummy.position.set(o.x, 1.3 + Math.sin(t * 2 + o.phase) * 0.25, o.z); dummy.rotation.set(0, t * 1.4 + o.phase, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); orbMesh.setMatrixAt(i, dummy.matrix)
    dummy.rotation.set(t * 2, t * 0.7, 0); dummy.updateMatrix(); haloMesh.setMatrixAt(i, dummy.matrix)
  }
  orbMesh.instanceMatrix.needsUpdate = haloMesh.instanceMatrix.needsUpdate = true
}
function unlockSecret() {
  secret = true; track('all_orbs')
  toast('✦ All 32 orbs — secret unlocked: rainbow trails. Now let’s talk →', 4200)
  for (let i = 0; i < 40; i++) sparks.emit(car.pos.x, 1.5, car.pos.z, (Math.random() - 0.5) * 14, 4 + Math.random() * 8, (Math.random() - 0.5) * 14, new THREE.Color().setHSL(Math.random(), 0.9, 0.6), 1.2)
}

/* ------------------------------------------------------------------ camera */
const camHead = new THREE.Vector3()
/** If a large obstacle (billboard, monolith, tower) sits between the car and the desired camera spot, pull the camera in front of it. */
function occlude(des) {
  camHead.set(car.pos.x, 1.5, car.pos.z)
  const sx = des.x - camHead.x, sz = des.z - camHead.z, L = Math.hypot(sx, sz) || 1
  let best = 1
  const test = (o) => {
    if (o.r < 1.2) return
    const t = clamp(((o.x - camHead.x) * sx + (o.z - camHead.z) * sz) / (L * L), 0, 1), d = Math.hypot(camHead.x + sx * t - o.x, camHead.z + sz * t - o.z)
    if (d < o.r + 0.5) { const tt = Math.max(0.1, t - (o.r + 0.9) / L); if (tt < best) best = tt }
  }
  for (const o of camObs) test(o)
  for (const o of statics) test(o)
  if (best < 1) { des.x = camHead.x + sx * best; des.z = camHead.z + sz * best; des.y = lerp(camHead.y + 1.6, des.y, best) }
}
function avoidObstacles() {
  const c = camera.position
  const push = (o, top) => { if (c.y > top) return; const dx = c.x - o.x, dz = c.z - o.z, m = o.r + 0.9, d2 = dx * dx + dz * dz; if (d2 < m * m) { const d = Math.sqrt(d2) || 0.001; c.x = o.x + (dx / d) * m; c.z = o.z + (dz / d) * m } }
  for (const o of statics) push(o, 9)
  for (const o of camObs) push(o, o.top)
}
const camLook = new THREE.Vector3(), camDes = new THREE.Vector3(), tgt = new THREE.Vector3()
let camSnap = true, menuAng = 0.6
function updateCamera(dt, t) {
  if (import.meta.env.DEV && window.__cam) { camera.position.set(...window.__cam.p); camera.lookAt(...window.__cam.l); return }
  const fx = -Math.sin(car.ang), fz = -Math.cos(car.ang), sn = clamp(Math.abs(car.speed) / 30, 0, 1)
  if (!started) {
    menuAng += dt * 0.12
    const pm = clamp(1.15 - camera.aspect, 0, 0.7); camDes.set(car.pos.x + Math.sin(menuAng) * (18 + pm * 14), 6.5 + pm * 4, car.pos.z + Math.cos(menuAng) * (18 + pm * 14))
    camera.position.lerp(camDes, damp(dt, 2)); tgt.set(0, 4, -4)
    camLook.lerp(tgt, damp(dt, 3)); camera.lookAt(camLook); return
  }
  const port = clamp(1.15 - camera.aspect, 0, 0.7)
  const dist = 11 + sn * 3.5 + port * 7, h = 5.4 + sn * 1.5 + port * 3.5
  camDes.set(car.pos.x - fx * dist, h, car.pos.z - fz * dist)
  occlude(camDes)
  tgt.set(car.pos.x + fx * 5, 1.5, car.pos.z + fz * 5)
  if (camSnap) { camera.position.copy(camDes); camLook.copy(tgt); camSnap = false }
  camera.position.lerp(camDes, damp(dt, 3.4)); camLook.lerp(tgt, damp(dt, 7))
  avoidObstacles()
  if (reduceMotion) shake = 0
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake }
  camera.lookAt(camLook)
  const fov = 58 + port * 30 + (reduceMotion ? 2 : sn * 9 + car.boost * 8)
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, damp(dt, 4)); camera.updateProjectionMatrix() }
}

/* ------------------------------------------------------------------ frame loop + adaptive quality */
let started = false, ready = false
const clock = { last: performance.now(), elapsedTime: 0, getDelta() { const n = performance.now(), d = (n - this.last) / 1000; this.last = n; this.elapsedTime += d; return d } }
let fpsAcc = 0, fpsN = 0, fpsShow = 0, frame = 0, startFrame = 0
const fpsEl = $('#fps')
const drs = { level: 0, levels: [1, 0.85, 0.72, 0.6], avg: 1 / 60, below: 0, above: 0, lock: 0, settle: 0, minDt: 1 }
function setRes(l) {
  drs.level = l; pixelRatio = Math.max(0.75, BASE_RATIO * drs.levels[l]); pxU.value = pixelRatio
  renderer.setPixelRatio(pixelRatio); composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight)
  const fxOn = qMode === 'auto' ? !lowEnd && l < 3 : qMode !== 'low'
  bloom.enabled = fxOn; fx.enabled = fxOn && !reduceMotion
  drs.settle = 1.5
}
/** Dynamic resolution: step the render scale down when the frame rate can't hold, back up when there is headroom. */
function updateDRS(dt) {
  if (qMode !== 'auto') return
  if (!started) { if (frame > 40) drs.minDt = Math.min(drs.minDt, dt); return }
  if (frame - startFrame < 150) return
  if (drs.settle > 0) { drs.settle -= dt; drs.avg = dt; return }
  drs.avg += (dt - drs.avg) * 0.05; drs.lock = Math.max(0, drs.lock - dt)
  const fps = 1 / drs.avg, refresh = clamp(1 / (drs.minDt < 1 ? drs.minDt : 1 / 60), 30, 240)
  const lowT = Math.min(refresh * 0.88, 54), highT = Math.min(refresh * 0.97, 58)
  if (fps < lowT) { drs.below += dt; drs.above = 0 } else if (fps > highT) { drs.above += dt; drs.below = 0 } else drs.below = drs.above = 0
  if (drs.below > 1.2 && drs.level < 3) { setRes(drs.level + 1); drs.below = 0; drs.lock = 15 }
  else if (drs.above > 6 && drs.level > 0 && drs.lock <= 0) { setRes(drs.level - 1); drs.above = 0; drs.lock = 25 }
}
const spdEl = $('#spd'), enEl = $('#energy'), boostEl = $('#boostBtn')
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime
  frame++
  fpsAcc += dt; fpsN++
  if (fpsAcc > 0.5) { fpsShow = fpsN / fpsAcc; fpsEl.textContent = Math.round(fpsShow) + ' fps'; fpsAcc = 0; fpsN = 0 }
  renderer.info.reset(); pollPad(); updateDRS(dt)
  gpuTime.value = t; sky.update(camera, t); skyline.update(t)
  groundMat.uniforms.uTime.value = t; groundMat.uniforms.uCar.value.copy(car.pos)
  updateCar(dt, t)
  updatePushables(dt); updateOrbs(dt, t)
  for (const f of tickers) f(t, dt)
  sparks.update(dt)

  // zones
  let best = null, bd = 1e9
  if (started) for (const z of ZONES) { if (z.silent) continue; const d = Math.hypot(car.pos.x - z.pos[0], car.pos.z - z.pos[1]); if (d < z.r && d / z.r < bd) { bd = d / z.r; best = z } }
  if (started && best?.id !== active?.id) enterZone(best)
  avatarNear = lerp(avatarNear, active?.id === 'home' ? 1 : 0, damp(dt, 4))
  for (const b of boards) { const on = active?.id === b.id; if (on) { if (t - b.live.last > (isMobile ? 1 / 12 : 1 / 24)) { b.live.render(t); b.live.last = t } b.wasOn = true } else if (b.wasOn) { b.live.render(0); b.wasOn = false } b.g.scale.setScalar(lerp(b.g.scale.x, on ? 1.08 : 1, damp(dt, 5))); b.frame.material.emissiveIntensity = lerp(b.frame.material.emissiveIntensity, on ? 4.5 : 1.6, damp(dt, 5)) }

  updateTrial(dt)
  updateCamera(dt, t)
  const fu = fx.uniforms; fu.uTime.value = t % 100; fu.uSpeed.value = clamp(Math.abs(car.speed) / 30, 0, 1); fu.uBoost.value = Math.max(car.boost * 0.9, car.padKick); fu.uHit.value = clamp(shake * 1.6, 0, 1)
  if (frame % 2 === 0 && started) drawMini()
  if (frame % 3 === 0 && started) { spdEl.textContent = String(Math.round(Math.abs(car.speed) * 3.6)).padStart(3, '0'); enEl.style.transform = `scaleX(${car.energy})`; boostEl.style.setProperty('--e', car.energy.toFixed(2)) }
  composer.render()
}

function onResize() {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
}
addEventListener('resize', onResize)

/* ------------------------------------------------------------------ boot */
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
/** Photo mode: snapshot of the 3D scene (no UI) with a small watermark; shares on phones, downloads on desktop. */
function takePhoto() {
  if (!started) return
  composer.render()
  const src = canvas, out = document.createElement('canvas'); out.width = src.width; out.height = src.height
  const c = out.getContext('2d'); c.drawImage(src, 0, 0)
  const s = out.height / 720, bh = 56 * s
  c.fillStyle = 'rgba(5,5,10,.6)'; c.fillRect(0, out.height - bh, out.width, bh); c.fillStyle = '#ff2d8a'; c.fillRect(0, out.height - bh, out.width, 2 * s)
  c.font = `300 ${17 * s}px ${F_MONO}`; c.textBaseline = 'middle'; c.fillStyle = '#f2efec'; c.fillText('IMAN MOHAMMADI — DRIVE MY PORTFOLIO', 26 * s, out.height - bh / 2); c.textAlign = 'right'; c.fillStyle = '#ff8fc0'; c.fillText('iman-mhmdi.ir', out.width - 26 * s, out.height - bh / 2)
  const f = $('#flash'); f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on')
  out.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], `iman-portfolio-${Date.now()}.png`, { type: 'image/png' })
    track('photo')
    if (isMobile && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Drive my portfolio', url: location.origin }); return } catch (_) { /* cancelled → fall through to download */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    toast('📷 Photo saved', 1800)
  }, 'image/png')
}
$('#photoBtn').addEventListener('click', takePhoto)
function startGame() {
  if (started || !ready) return
  audio.start(); track('world_start', { mobile: isMobile }); started = true; startFrame = frame; $('#start').classList.add('is-gone'); $('#hud').classList.add('is-on'); camSnap = false
  car.vel.set(0, 0); car.ang = 0
}
const pctEl = $('#loadPct'), barEl = $('#loadBar'), btn = $('#startBtn')
const setPct = (p) => { pctEl.textContent = Math.round(p); barEl.style.transform = `scaleX(${p / 100})` }
const QUAL = { auto: [0, 'Auto'], high: [0, 'High'], med: [1, 'Med'], low: [3, 'Low'] }
const qualBtn = $('#qualBtn')
function applyQuality(mode, announce) {
  qMode = mode; try { localStorage.setItem('im-quality', mode) } catch (_) { /* ignore */ }
  setRes(mode === 'auto' ? (lowEnd ? 1 : 0) : QUAL[mode][0]); drs.settle = 3; drs.lock = 10
  qualBtn.textContent = '⚙ ' + QUAL[mode][1]; track('quality_change', { mode }); if (announce) toast(`Graphics: ${QUAL[mode][1]}`, 1400)
}
qualBtn.addEventListener('click', () => { const order = ['auto', 'high', 'med', 'low']; applyQuality(order[(order.indexOf(qMode) + 1) % 4], true) })
qualBtn.textContent = '⚙ ' + QUAL[qMode][1]
const muteBtn = $('#muteBtn')
const paintMute = () => { muteBtn.textContent = audio.muted ? '♪ off' : '♪ on'; muteBtn.setAttribute('aria-pressed', String(!audio.muted)) }
muteBtn.addEventListener('click', () => { audio.setMuted(!audio.muted); paintMute() }); paintMute()

/** Small studio of neon light panels, baked to a PMREM map so glossy paint reflects the world's pink/violet/cyan glow. */
function neonEnv() {
  const es = new THREE.Scene(); es.background = new THREE.Color(0x06050c)
  const panel = (c, i, w, h, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m) }
  panel(PINK, 7, 14, 3.5, -9, 3, 3); panel(VIOLET, 7, 14, 3.5, 9, 3, -3); panel(0x7ee0ff, 6, 16, 2.5, 0, 10, 0)
  panel(0xffffff, 4, 18, 0.7, 0, 5, -10); panel(0xffffff, 2.2, 18, 0.7, 0, 5, 10); panel(PINK, 3, 24, 4, 0, -3, 0)
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(es, 0.03).texture; pm.dispose()
  return tex
}
function applyModels(m) {
  if (!(m.car || m.avatar || m.prop)) return
  const env = neonEnv()
  const dress = (obj, k = 1) => obj.traverse((o) => { if (o.isMesh) for (const mm of [].concat(o.material)) { if (mm.isMeshStandardMaterial || mm.isMeshPhysicalMaterial) { mm.envMap = env; mm.envMapIntensity = k; mm.needsUpdate = true } } })
  if (m.car) {
    car.body.children.forEach((c) => (c.visible = false)); car.wheels.forEach((w) => (w.visible = false))
    dress(m.car.object, 1.25); car.body.add(m.car.object)
    const sc = m.car.object.scale.x
    car.radius = 1.5; car.rearOff = 1.65; car.track = 0.8
    if (m.car.wheels?.length) car.mw = m.car.wheels.map((w) => ({ g: w.group, front: w.front, r: w.radius * sc }))
    if (m.car.clips.length) {
      const mixer = new THREE.AnimationMixer(m.car.scene), action = mixer.clipAction(m.car.clips[0]); action.play(); action.paused = true; action.time = 0; mixer.update(0)
      car.aero = { mixer, action, dur: m.car.clips[0].duration, t: 0 }
    }
    pool.scale.setScalar(1.25)
  }
  if (m.avatar) {
    avatar.children.forEach((c) => { if (c !== avatar.halo && c !== avatar.tag) c.visible = false })
    avatar.scale.setScalar(1); avatar.tag.position.y = 5; dress(m.avatar.object); avatar.add(m.avatar.object); avatar.model = m.avatar.object
    if (m.avatar.clips.length) { const mixer = new THREE.AnimationMixer(m.avatar.scene); mixer.clipAction(m.avatar.clips[0]).play(); tickers.push((t, dt) => mixer.update(dt)) }
  }
  if (m.prop) { inst.boxS.count = inst.boxW.count = 0; dress(m.prop.object); for (const p of pushables) if (p.isBox) { p.obj = m.prop.object.clone(true); scene.add(p.obj) } }
}
function showCredits(list) {
  if (!list.length) return
  const box = $('#credits'); box.innerHTML = '<b class="mono">3D model credits</b>' + list.map((c) => `<p>${c.title} — ${c.author ? 'by ' + c.author : ''} ${c.license ? '· ' + c.license : ''} ${c.url ? `<a href="${c.url}" target="_blank" rel="noopener">source ↗</a>` : ''}</p>`).join('')
  const b = $('#creditsBtn'); b.hidden = false; b.addEventListener('click', () => box.classList.toggle('is-on'))
}
async function fetchModels() {
  try {
    const r = await fetch('/models/models.json', { cache: 'no-cache' })
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return { credits: [] }
    const manifest = await r.json()
    if (!['car', 'avatar', 'prop'].some((k) => manifest[k]?.file)) return { credits: [] }
    const { loadModels } = await import('./models.js')
    return await loadModels(manifest, { skip: lowEnd ? ['car'] : [], tune: isMobile ? { car: { minPart: 0.09 } } : {} })
  } catch (_) { return { credits: [] } }
}
async function boot() {
  setPct(8)
  const modelsP = fetchModels()
  await loadFonts(); setPct(35)
  await new Promise((r) => setTimeout(r, 30))
  buildSpawnSign(); setPct(55); buildAbout(); buildSkills(); setPct(70); buildWork(); buildPath(); buildContact(); setPct(90)
  const models = await modelsP; applyModels(models); showCredits(models.credits); setPct(97)
  renderer.compile(scene, camera); composer.render(); setPct(100)
  ready = true
  btn.disabled = false; $('#startLabel').textContent = coarse ? 'Tap to start' : 'Press Enter to start'
  btn.addEventListener('click', startGame)
  const tb = $('#tourBtn'); tb.disabled = false; tb.addEventListener('click', startTour)
  if (qMode !== 'auto') setRes(QUAL[qMode][0]); else if (lowEnd) setRes(1)
  if (reduceMotion) $('#motionWarn').hidden = false
  if (coarse) btn.classList.add('is-touch')
  renderer.setAnimationLoop(tick)
}
renderer.setAnimationLoop(() => { clock.getDelta() }) // keep clock sane while loading
boot()

if (import.meta.env.DEV) window.__w = { renderer, scene, car, composer, camera }
