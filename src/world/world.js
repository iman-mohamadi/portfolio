import './world.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createSky } from './sky.js'
import { createAtmosphere } from './atmosphere.js'
import { loadKits, dynamicInstances } from './kits.js'
import { createCity, HALF, T, NAT, tileX, tileZ } from './city.js'
import { createFxPass, Trail } from './fx.js'
import { createAudio } from './audio.js'
import { initAnalytics, track } from './analytics.js'
import { $, clamp, lerp, damp, PINK, VIOLET, F_SANS, F_SERIF, F_MONO, canvasTex, basic, glow, dark, sprite, seeded } from './helpers.js'
import { createStations } from './stations.js'
import { createScore, createRings, createDebris } from './stunts.js'
import { createTraffic } from './traffic.js'
import { createModes } from './modes.js'
import { createGarage } from './garage.js'
import { buildTourRoute } from './tour.js'
import { ZONES, PROJECTS, projZones, JOBS, SKILLS, STATS, DIALOGUE, ORB_NAMES, GATES } from './content.js'

/* ---- capability gate: no WebGL2 → friendly message; software renderer → low quality + notice */
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
if (!gpuProbe.ok) { document.getElementById('noGl').classList.add('is-on'); throw new Error('WebGL2 unavailable') }
const coarse = matchMedia('(pointer:coarse)').matches
const isMobile = coarse || Math.min(innerWidth, innerHeight) < 600
const forceHQ = qs.get('quality') === 'high'
const lowEnd = !forceHQ && ((isMobile && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3)) || gpuProbe.soft)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
let qMode = qs.get('quality') || ''
if (!['auto', 'high', 'med', 'low'].includes(qMode)) { try { qMode = localStorage.getItem('im-quality') || 'auto' } catch (_) { qMode = 'auto' } }
if (!['auto', 'high', 'med', 'low'].includes(qMode)) qMode = 'auto'

/* ------------------------------------------------------------------ renderer */
const canvas = $('#world')
let renderer
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }) } catch (e) { document.getElementById('noGl').classList.add('is-on'); throw e }
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
scene.background = new THREE.Color(0x070a14)
scene.fog = new THREE.FogExp2(0x0a0e1e, 0.0048)
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1100)
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

const hemi = new THREE.HemisphereLight(0x6a78c8, 0x1a1626, 1.35); scene.add(hemi)
const moon = new THREE.DirectionalLight(0xa9b8ff, 1.7)
moon.position.set(-80, 140, 60)
scene.add(moon)

/* ------------------------------------------------------------------ helpers */
let grid = null // SpatialGrid from the city (circles + boxes)
const camObs = [] // extra camera-only obstacles: billboard faces (statics only cover their poles)
const tickers = []
const addStatic = (x, z, r) => grid.addCircle(x, z, r, { tag: 'station' })
const uniforms = { uNight: { value: 1 }, uTime: { value: 0 } }

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

// sky + GPU-animated particles (no per-frame CPU work)
const sky = createSky(scene, { mobile: isMobile, renderer })
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
const motes = gpuPoints({ N: isMobile ? 260 : 650, radius: 60, height: 16, color: 0xb9a8ff, size: 0.22, speed: 0.5 }) // follows the car

/* ------------------------------------------------------------------ car */
const car = { pos: new THREE.Vector3(0, 0, 28), y: 0.14, vy: 0, vyG: 0, air: false, airT: 0, peak: 0, spinP: 0, spinR: 0, baseP: 0, pitch: 0, viewY: 0.14, stats: { acc: 30, max: 27, grip: 7.5, turn: 2.15 }, hero: null, heroWheels: null, heroAero: null, procedural: [], pool: null, carId: 'lambo', ang: 0, vel: new THREE.Vector2(), radius: 1.25, rearOff: 1.3, track: 0.85, mw: null, aero: null, speed: 0, fwd: 0, turn: 0, drift: 0, boost: 0, energy: 1, padKick: 0, group: new THREE.Group(), body: new THREE.Group(), wheels: [] }
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
  car.group.rotation.order = 'YXZ'; car.procedural = [...b.children]; car.group.add(b); scene.add(car.group)
}
const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), basic(canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,45,138,.55)'); g.addColorStop(1, 'rgba(255,45,138,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w) }), { blending: THREE.AdditiveBlending, depthWrite: false }))
pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; scene.add(pool); car.pool = pool
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
  seg(0, -40, 0, -180, [0.12, 0.4, 0.7]); seg(0, 40, 0, 52, [0.5]); seg(46, 0, 60, 0, [0.5]); seg(80, 0, 112, 0, [0.5]); seg(128, 0, 160, 0, [0.5]); seg(-40, 0, -180, 0, [0.15, 0.45, 0.75]); seg(-98, 96, 98, 96, [0.2, 0.5, 0.8]); seg(-96, -98, -98, -98, [0.5])
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
  avatar.scale.setScalar(2.4); avatar.position.set(0, 0, 0)
  scene.add(avatar) // hologram: intentionally not solid
  const stream = gpuPoints({ N: isMobile ? 60 : 130, radius: 1.3, height: 5.5, color: 0x62e6ff, size: 0.16, speed: 0.9, opacity: 0.95, seed: 4, cylinder: true }); stream.scale.setScalar(2.4)
}
let avatarNear = 0
tickers.push((t, dt) => {
  avatar.children[0].position.y = 1.1 + Math.sin(t * 2) * 0.05
  avatar.rotation.y = lerp(avatar.rotation.y, Math.atan2(car.pos.x - avatar.position.x, car.pos.z - avatar.position.z), damp(dt, 3))
  avatar.armR.rotation.z = -0.4 - avatarNear * (1.6 + Math.sin(t * 9) * 0.5) + Math.sin(t * 1.5) * 0.05
  avatar.armL.rotation.z = 0.15 + Math.sin(t * 1.3) * 0.05
  avatar.halo.rotation.z = t * 0.8
})

const stations = createStations({ scene, addStatic, tickers, camObs, isMobile })
const boards = stations.boards

/* ------------------------------------------------------------------ props you can smash (real Kenney models) + collectible orbs */
const dummy = new THREE.Object3D()
const pushables = []
const props = { groups: [] }
const plainMats = new Map()
let envTex = null
const plainMat = (part) => {
  const src = part.material
  if (!plainMats.has(src)) { const m = new THREE.MeshStandardMaterial({ map: src.map, color: src.color, roughness: 0.7, metalness: 0.05 }); city?.mats.push(m); plainMats.set(src, m) }
  return plainMats.get(src)
}
const orbs = []
const orbInfo = { got: 0 }
const orbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: 0xa892ff, toneMapped: false }), 40)
const haloMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.9, 0.04, 6, 20), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false }), 40)
orbMesh.frustumCulled = haloMesh.frustumCulled = false; scene.add(orbMesh, haloMesh)

/** Random points on the road network, spread apart and away from the given spots. */
function roadSpots(city, n, minSep, rnd, avoid = []) {
  const tiles = [...city.roadTiles].map((s) => s.split(',').map(Number)), out = []
  for (let tries = 0; tries < 4000 && out.length < n; tries++) {
    const [i, j] = tiles[Math.floor(rnd() * tiles.length)], x = tileX(i) + (rnd() - 0.5) * 8, z = tileZ(j) + (rnd() - 0.5) * 8
    if (Math.hypot(x, z) < 24 || out.some((p) => Math.hypot(p[0] - x, p[1] - z) < minSep) || avoid.some((p) => Math.hypot(p[0] - x, p[1] - z) < 14)) continue
    out.push([x, z])
  }
  return out
}
function spawnProps(city, kits) {
  const rnd = seeded(21), avoid = ZONES.map((z) => z.spawn || z.pos)
  const defs = [['car/box', 34, 1.7, 0.8], ['car/cone', 48, 1.7, 0.55]]
  for (const [name, n, s, r] of defs) {
    const model = kits.cars.get(name); if (!model) continue
    const di = dynamicInstances(model, n, { material: plainMat }); di.use(n)
    di.meshes.forEach((m) => scene.add(m)); props.groups.push(di)
    roadSpots(city, n, 6, rnd, avoid).forEach(([x, z], k) => pushables.push({ x, z, vx: 0, vz: 0, r, y: 0.22, s, rx: 0, ry: rnd() * 6.28, rz: 0, di, idx: k }))
  }
  // orbs sit on the roads, spread across the whole map
  const spots = roadSpots(city, 32, 42, seeded(77), avoid)
  spots.forEach(([x, z], i) => orbs.push({ x, z, y: 1.3, alive: true, name: ORB_NAMES[i % ORB_NAMES.length], phase: rnd() * 6 }))
  // a few sit in mid-air along the stunt jumps: only reachable by flying
  for (const [x, y, z] of [[-144, 4.6, -7], [-144, 4.9, 5], [-96, 9.4, -5], [-96, 10.4, 8], [-120, 4.8, -24], [-72, 7.2, -24]]) orbs.push({ x, z, y, alive: true, name: 'Big air', phase: rnd() * 6 })
  $('#orbTotal').textContent = orbs.length
}

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
  if (e.code === 'KeyN') cycleTime()
  if (e.code === 'KeyG') toggleHub()
  if (e.code === 'KeyC') garage?.toggle()
  if (e.code === 'Escape') closeMenus()
  if (e.code === 'KeyB') cycleWeather()
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
navEl.innerHTML = NAV.map((n, i) => `<button data-nav="${n.id}"><b>${i + 1}</b>${n.label}</button>`).join('') + '<button data-tour class="tour">▶ Tour</button><button data-hub class="tour">◈ Play</button><button data-nav="contact" class="hire">Hire me</button>'
const seen = new Set(); let allSeen = false
const navKey = (z) => (z.kind === 'project' ? 'work' : z.kind === 'job' ? 'gsi' : z.id)
document.addEventListener('click', (e) => { const hb = e.target.closest('[data-hub]'); if (hb) { e.preventDefault(); toggleHub(); return } const run = e.target.closest('[data-run],a[data-act]'); if (run) { e.preventDefault(); runAct(run.dataset.run || run.dataset.act); return } const tr = e.target.closest('[data-trial]'); if (tr) { e.preventDefault(); trial.on ? stopTrial('Trial cancelled') : startTrial(); return } const t = e.target.closest('[data-tour]'); if (t) { e.preventDefault(); tour.on ? cancelTour() : startTour(); return } const b = e.target.closest('[data-nav]'); if (!b) return; e.preventDefault(); warp(b.dataset.nav) })
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
  actBtn.classList.toggle('is-on', !!z && (z.id === 'home' || !!z.url || z.kind === 'game')); actBtn.textContent = z?.url ? 'Visit ↗' : z?.kind === 'game' ? 'Go' : 'Next'
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
  if (active.kind === 'game') return runAct(active.act)
  if (active.id === 'home') return nextLine()
  if (active.url) { track('project_open', { project: active.id, via: 'key' }); window.open(active.url, '_blank', 'noopener') }
}
function warp(id, keepTour = false) {
  const z = ZONES.find((k) => k.id === id); if (!z || !started) return
  if (!keepTour) { cancelTour(); stopTrial() }
  const [sx, sz] = z.spawn || z.pos, [tx, tz] = z.pos
  car.pos.set(sx, 0, sz); car.vel.set(0, 0); car.y = car.viewY = city.BASE; car.air = false; car.vy = car.vyG = car.spinP = car.spinR = 0
  car.ang = Math.atan2(-(tx - sx), -(tz - sz))
  camSnap = true
  const f = $('#flash'); f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on')
}

/* minimap: static city layer is painted once, markers on top */
const mini = $('#mini'), mctx = mini.getContext('2d')
const MAP_K = 0.83
let mapCanvas = null
function buildMinimap(city) {
  const c = document.createElement('canvas'); c.width = c.height = 300; const x = c.getContext('2d'); x.translate(150, 150)
  const col = { D: '#39406e', C: '#2c3254', T: '#3f2f66', S: '#28483a', P: '#20402c', H: '#4a3a2a', X: '#5e2a48', Z: '#284040', A: '#642a52', K: '#3a2f74', Q: '#642a52', W: '#283a5a', R: '#4a4a2a' }
  for (const b of city.blocks) { x.fillStyle = col[b.type] || '#2a2f4a'; x.fillRect((b.x - 18) * MAP_K, (b.z - 18) * MAP_K, 36 * MAP_K, 36 * MAP_K) }
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 3
  for (let a = 0; a < 9; a++) { const p = tileX(a * 4) * MAP_K; x.beginPath(); x.moveTo(p, -HALF * MAP_K); x.lineTo(p, HALF * MAP_K); x.stroke(); x.beginPath(); x.moveTo(-HALF * MAP_K, p); x.lineTo(HALF * MAP_K, p); x.stroke() }
  mapCanvas = c
}
function drawMini() {
  const S = 300, c = S / 2, k = MAP_K
  mctx.clearRect(0, 0, S, S)
  if (mapCanvas) mctx.drawImage(mapCanvas, 0, 0)
  for (const z of ZONES) { if (z.silent || z.kind === 'project') continue; mctx.fillStyle = z.id === active?.id ? '#fff' : z.kind === 'job' ? '#7a5cff' : z.kind === 'game' ? '#7ee0ff' : '#ff2d8a'; mctx.beginPath(); mctx.arc(c + z.pos[0] * k, c + z.pos[1] * k, z.id === 'stunt' ? 4 : 5.5, 0, 7); mctx.fill() }
  mctx.fillStyle = 'rgba(255,45,138,.85)'; for (const p of projZones) mctx.fillRect(c + p.pos[0] * k - 3, c + p.pos[1] * k - 3, 6, 6)
  mctx.fillStyle = '#a892ff'; for (const o of orbs) if (o.alive) { mctx.beginPath(); mctx.arc(c + o.x * k, c + o.z * k, 2.6, 0, 7); mctx.fill() }
  modes?.overlay(mctx, c, k)
  mctx.save(); mctx.translate(c + car.pos.x * k, c + car.pos.z * k); mctx.rotate(-car.ang); mctx.fillStyle = '#fff'; mctx.strokeStyle = '#000'; mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo(0, -10); mctx.lineTo(7, 8); mctx.lineTo(-7, 8); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore()
  mctx.strokeStyle = 'rgba(255,45,138,.5)'; mctx.lineWidth = 3; mctx.beginPath(); mctx.arc(c, c, c - 2, 0, 7); mctx.stroke()
}

/* ------------------------------------------------------------------ physics */
const cq = []
/** Resolves a circle against nearby circles + axis-aligned boxes (buildings) and the square map bounds. */
function collideCircle(x, z, r, out, y = 0) {
  let hit = false
  for (let pass = 0; pass < 2; pass++) {
    grid.query(x, z, r + 1, cq)
    for (const s of cq) {
      if (y > (s.h ?? (s.kind === 'c' ? 7 : 99)) - 0.4) continue // flying over it
      if (s.kind === 'c') {
        const dx = x - s.x, dz = z - s.z, m = r + s.r, d2 = dx * dx + dz * dz
        if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2), nx = dx / d, nz = dz / d; x = s.x + nx * m; z = s.z + nz * m; out.nx = nx; out.nz = nz; hit = true }
      } else {
        const px = clamp(x, s.x - s.hx, s.x + s.hx), pz = clamp(z, s.z - s.hz, s.z + s.hz), dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz
        if (d2 < r * r) {
          let nx, nz
          if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; x = px + nx * r; z = pz + nz * r }
          else { const ex = s.hx - Math.abs(x - s.x), ez = s.hz - Math.abs(z - s.z); if (ex < ez) { nx = Math.sign(x - s.x) || 1; nz = 0; x = s.x + nx * (s.hx + r) } else { nx = 0; nz = Math.sign(z - s.z) || 1; z = s.z + nz * (s.hz + r) } }
          out.nx = nx; out.nz = nz; hit = true
        }
      }
    }
  }
  const lim = HALF - 3 - r
  if (x > lim) { x = lim; out.nx = -1; out.nz = 0; hit = true } else if (x < -lim) { x = -lim; out.nx = 1; out.nz = 0; hit = true }
  if (z > lim) { z = lim; out.nx = 0; out.nz = -1; hit = true } else if (z < -lim) { z = -lim; out.nx = 0; out.nz = 1; hit = true }
  out.x = x; out.z = z; return hit
}
const hitOut = { x: 0, z: 0, nx: 0, nz: 0 }
let shake = 0
let TOUR = [] // built from the road network once the city exists
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
  cancelTour(); modes?.cancel(); warp('home', true)
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
  modes?.cancel(); warp('home', true); tour.on = true; tour.i = 0; tour.wait = 0; tour.stuck = 0
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
  if (d < (w.dwell ? 4 : 6.5)) { if (w.dwell) tour.wait = w.dwell; else { tour.i++; paintTour() } tour.stuck = 0; return IDLE }
  tour.stuck = Math.abs(car.speed) < 0.6 ? tour.stuck + dt : 0
  if (tour.stuck > 3) { tour.i++; tour.stuck = 0; paintTour() }
  // slow down for the corner after this waypoint
  const nx = TOUR[tour.i + 1]; let corner = 1
  if (nx && !w.dwell) { const a1 = Math.atan2(dx, dz), a2 = Math.atan2(nx.p[0] - w.p[0], nx.p[1] - w.p[1]), da = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))); corner = 1 - clamp(da / 1.2, 0, 0.62) * clamp(1 - d / 34, 0, 1) }
  // ease off behind other cars on the road
  let front = 1e9; const afx = -Math.sin(car.ang), afz = -Math.cos(car.ang)
  if (traffic) for (const a of traffic.agents) { if (a.hit > 0) continue; const rx = a.x - car.pos.x, rz = a.z - car.pos.z, f = rx * afx + rz * afz, l = rx * -afz + rz * afx; if (f > 0 && f < 24 && Math.abs(l) < 3.4) front = Math.min(front, f) }
  const align = Math.max(0, Math.cos(err)), vmax = Math.min((w.dwell ? clamp(d * 1.5, 5, 22) : 22) * corner * (0.35 + 0.65 * align), front < 1e8 ? Math.max(0, (front - 6) * 1.2) : 99)
  return { f: car.speed < vmax ? 1 : car.speed > vmax + 3 ? -0.5 : 0.15, t: clamp(-err * 2.4, -1, 1), boost: d > 70 && align > 0.97 && corner > 0.9 && car.energy > 0.6, drift: false }
}
function getInput(dt) {
  if (menuOpen() || modes?.locked) return IDLE
  if (trial.on && trial.cd > 0) return IDLE
  if (tour.on) { if (userActive()) cancelTour(); else return autopilot(dt) }
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0)
  let t = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)
  if (stick.on) { f = clamp(-stick.y * 1.5, -1, 1); t = clamp(stick.x * 1.5, -1, 1) }
  if (padS) { f = clamp(f + padS.f, -1, 1); t = clamp(t + padS.t, -1, 1) }
  return { f, t, boost: keys.ShiftLeft || keys.ShiftRight || boostBtn || !!padS?.boost, drift: !!keys.Space || driftBtn || !!padS?.drift }
}
const TAU = Math.PI * 2, GRAV = 21
let city = null, score = null, rings = null, traffic = null, debris = null
const blockedAt = (x, z) => city.heightAt(x, z) - car.y > (car.air ? 2.2 : 0.85)
function updateCar(dt, t) {
  const inp = started ? getInput(dt) : IDLE
  car.turn += (inp.t - car.turn) * damp(dt, 9)
  const wantBoost = inp.boost && inp.f > 0 && car.energy > 0.03
  car.boost += ((wantBoost ? 1 : 0) - car.boost) * damp(dt, 6)
  car.energy = clamp(car.energy + (wantBoost ? -0.26 : 0.08) * dt, 0, 1)
  car.padKick = Math.max(0, car.padKick - dt * 1.5)
  const air = car.air
  const fx = -Math.sin(car.ang), fz = -Math.cos(car.ang)
  const fwdSpeed = car.vel.x * fx + car.vel.y * fz
  const st = car.stats
  const acc = (inp.f > 0 ? st.acc : inp.f < 0 ? (fwdSpeed > 1 ? st.acc * 1.5 : st.acc * 0.66) : 0) * (1 + car.boost * 0.9) * (air ? 0.08 : 1)
  car.vel.x += fx * inp.f * acc * dt; car.vel.y += fz * inp.f * acc * dt
  // lateral grip (drifts when handbrake) — none in the air
  const rx = -fz, rz = fx
  const latSpeed = car.vel.x * rx + car.vel.y * rz
  const grip = air ? 0 : inp.drift ? 1.1 : st.grip * (1 - clamp(atmo?.wet ?? 0, 0, 1) * 0.2) // wet roads = a little less grip
  const kill = latSpeed * (1 - Math.exp(-grip * dt))
  car.vel.x -= rx * kill; car.vel.y -= rz * kill
  const drag = air ? 0.04 : inp.f === 0 ? 1.6 : 0.35
  const sp = Math.hypot(car.vel.x, car.vel.y), max = st.max * (1 + car.boost * 0.55)
  const dk = Math.exp(-(drag + (sp > max ? (sp - max) * 0.4 : 0)) * dt)
  car.vel.x *= dk; car.vel.y *= dk
  car.speed = car.vel.x * fx + car.vel.y * fz
  audio.engine(clamp(Math.abs(car.speed) / 30, 0, 1), air ? 0.2 : Math.abs(inp.f), car.boost)
  const steer = clamp(car.speed / 5, -1, 1) * (inp.drift ? 1.5 : 1) * (air ? 0 : 1)
  car.ang -= car.turn * st.turn * steer * dt
  const px = car.pos.x, pz = car.pos.z
  car.pos.x += car.vel.x * dt; car.pos.z += car.vel.y * dt
  for (const q of pads) {
    if (q.cd > 0) { q.cd -= dt; continue }
    if ((car.pos.x - q.x) ** 2 + (car.pos.z - q.z) ** 2 < 6.8) {
      q.cd = 1.4; car.vel.x += q.dx * 15; car.vel.y += q.dz * 15; car.energy = Math.min(1, car.energy + 0.4); car.padKick = 1
      audio.blip(); buzz(15); sparks.burst(q.x, 0.4, q.z, 0x7ee0ff, 16, 8)
    }
  }
  if (collideCircle(car.pos.x, car.pos.z, car.radius, hitOut, car.y)) {
    car.pos.x = hitOut.x; car.pos.z = hitOut.z
    const vn = car.vel.x * hitOut.nx + car.vel.y * hitOut.nz
    if (vn < 0) { car.vel.x -= hitOut.nx * vn * 1.4; car.vel.y -= hitOut.nz * vn * 1.4; if (vn < -5) { audio.thud(); buzz(28); shake = Math.min(0.5, -vn * 0.03); sparks.burst(car.pos.x - hitOut.nx * 1.2, car.y + 0.6, car.pos.z - hitOut.nz * 1.2, 0xffd0e4, 16, 7); if (vn < -9) score.lose() } }
  }
  // ramps / plateaus: a step that is too tall is a wall — slide along it instead of driving through
  if (blockedAt(car.pos.x, car.pos.z)) {
    if (!blockedAt(car.pos.x, pz)) { car.pos.z = pz; car.vel.y *= -0.2 } else if (!blockedAt(px, car.pos.z)) { car.pos.x = px; car.vel.x *= -0.2 } else { car.pos.x = px; car.pos.z = pz; car.vel.multiplyScalar(-0.2) }
    if (Math.abs(car.speed) > 8) { audio.thud(); shake = 0.3; sparks.burst(car.pos.x + fx * 1.4, car.y + 0.5, car.pos.z + fz * 1.4, 0xffd0e4, 12, 6) }
  }
  // vertical: glued to the height field, or ballistic once the ground falls away (ramp lip, plateau edge)
  const gy = city.heightAt(car.pos.x, car.pos.z)
  if (!car.air) {
    if (car.y - gy > 0.5) { car.air = true; car.vy = clamp(car.vyG * 1.15, -8, 18); car.airT = 0; car.spinP = car.spinR = 0; car.peak = car.y; car.baseP = car.pitch }
    else { car.vyG = clamp((gy - car.y) / Math.max(dt, 1e-3), -22, 22); car.y = gy }
  }
  if (car.air) {
    car.vy -= GRAV * dt; car.y += car.vy * dt; car.airT += dt; car.peak = Math.max(car.peak, car.y)
    if (car.airT > 0.2) { car.spinP += -inp.f * 3.7 * dt; car.spinR -= inp.t * 4.6 * dt }
    const hs = Math.max(2, Math.hypot(car.vel.x, car.vel.y)); car.baseP += (Math.atan2(car.vy, hs) * 0.9 - car.baseP) * damp(dt, 3.2)
    if (car.y <= gy) landCar(gy)
  } else {
    car.spinP *= Math.exp(-9 * dt); car.spinR *= Math.exp(-9 * dt)
    const fH = city.heightAt(car.pos.x + fx * 1.8, car.pos.z + fz * 1.8), bH = city.heightAt(car.pos.x - fx * 1.8, car.pos.z - fz * 1.8)
    car.baseP += (clamp(Math.atan2(fH - bH, 3.6), -0.6, 0.6) - car.baseP) * damp(dt, 14)
  }
  car.pos.y = car.y; car.pitch = car.baseP + car.spinP
  // visuals
  car.group.position.set(car.pos.x, car.y, car.pos.z); car.group.rotation.set(car.pitch, car.ang, car.spinR)
  car.viewY += (car.y - car.viewY) * damp(dt, 2.6)
  car.body.rotation.z = lerp(car.body.rotation.z, car.turn * clamp(car.speed / 25, -1, 1) * 0.12, damp(dt, 8))
  car.body.rotation.x = lerp(car.body.rotation.x, -inp.f * 0.05, damp(dt, 6))
  car.body.position.y = Math.sin(t * 40) * 0.006 * clamp(Math.abs(car.speed) / 20, 0, 1) * (air ? 0 : 1)
  if (car.mw) {
    for (const w of car.mw) { w.g.rotation.x += car.speed * dt / w.r; if (w.front) w.g.rotation.y = -car.turn * 0.45 }
    if (car.aero) { const a = car.aero; a.t += ((car.boost > 0.25 || car.air ? 1 : 0) - a.t) * damp(dt, 2.2); a.action.time = a.t * a.dur; a.mixer.update(0) }
  } else {
    for (const w of car.wheels) w.children[0].rotation.x += car.speed * dt / 0.4, w.children[1].rotation.x = w.children[0].rotation.x
    car.wheels[0].rotation.y = car.wheels[1].rotation.y = -car.turn * 0.45
  }
  pool.position.set(car.pos.x, gy + 0.05, car.pos.z); pool.material.opacity = (0.5 + car.boost * 0.4) * clamp(1 - (car.y - gy) / 5, 0.05, 1)
  // light trails from the rear wheels
  {
    const tx = car.pos.x - fx * car.rearOff, tz = car.pos.z - fz * car.rearOff, mv = Math.abs(car.speed) > 3
    const hex = car.boost > 0.3 ? 0x7ee0ff : PINK, w = 1 + car.boost * 0.8, ty = car.y + 0.05
    trailL.update(dt, tx + rx * car.track, tz + rz * car.track, rx, rz, hex, mv, w, secret ? 1 : 0, ty)
    trailR.update(dt, tx - rx * car.track, tz - rz * car.track, rx, rz, hex, mv, w, secret ? 1 : 0, ty)
  }
  // sparks: drift smoke + boost flame
  const drifting = !air && Math.abs(latSpeed) > 4
  audio.skid(drifting && started ? clamp((Math.abs(latSpeed) - 3.5) / 9, 0.15, 1) : 0)
  if (drifting || car.boost > 0.5) {
    for (const s of [-1, 1]) {
      const bx = car.pos.x - fx * car.rearOff + rx * s * car.track, bz = car.pos.z - fz * car.rearOff + rz * s * car.track
      sparks.emit(bx, car.y + 0.15, bz, -fx * 3 + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, -fz * 3 + (Math.random() - 0.5) * 2, car.boost > 0.5 ? 0x7ee0ff : PINK, 0.5)
    }
  }
  // scoring: drifting keeps a chain alive; hoops pay out a boost
  if (started) {
    if (drifting && Math.abs(car.speed) > 9) score.hold('drift', 55 + Math.abs(latSpeed) * 9, dt)
    const hit = rings.update(car.pos, dt, t, car.y + 0.7)
    if (hit) ringHit(hit)
    score.update(dt)
  }
  return latSpeed
}
function ringHit(r) {
  const fx = -Math.sin(car.ang), fz = -Math.cos(car.ang)
  car.vel.x += fx * 9; car.vel.y += fz * 9; car.energy = Math.min(1, car.energy + 0.5); car.padKick = 1
  score.add('ring', 300); audio.chime(4); buzz(20); sparks.burst(r.x, r.y, r.z, 0x7ee0ff, 30, 9)
}
const trafficFx = {
  onHit(a, nx, nz, rel) {
    if (rel > 4) { audio.thud(); buzz(26); shake = Math.max(shake, Math.min(0.5, rel * 0.025)); sparks.burst(a.x - nx * 1.4, 0.9, a.z - nz * 1.4, 0xffd27a, 18, 8); score?.add('smash', 130); debris?.burst(a.x - nx * 1.4, 0.5, a.z - nz * 1.4, car.vel.x, car.vel.y, rel > 12 ? 7 : 4) }
  },
  onNear() { score?.add('near', 110); audio.blip() },
}
function landCar(gy) {
  const impact = -car.vy, airT = car.airT, hgt = car.peak - gy
  car.air = false; car.y = gy; car.vy = 0; car.vyG = 0
  const nP = Math.round(car.spinP / TAU), nR = Math.round(car.spinR / TAU)
  const resP = car.spinP - nP * TAU, resR = car.spinR - nR * TAU
  const clean = Math.abs(resP) < 1.1 && Math.abs(resR) < 1.1
  car.spinP = resP; car.spinR = resR
  const trick = airT > 0.45 && hgt > 1.2
  if (clean) {
    if (trick) score.add('air', Math.round(airT * 170 + hgt * 35))
    if (nP) { score.add('flip', Math.abs(nP) * 500); toast(Math.abs(nP) > 1 ? `${Math.abs(nP)}× ${nP > 0 ? 'BACK' : 'FRONT'}FLIP` : nP > 0 ? 'BACKFLIP' : 'FRONTFLIP', 1200) }
    if (nR) { score.add('roll', Math.abs(nR) * 400); toast(Math.abs(nR) > 1 ? `${Math.abs(nR)}× BARREL ROLL` : 'BARREL ROLL', 1200) }
    if (trick && !nP && !nR && airT > 0.9) toast(`BIG AIR  ${airT.toFixed(1)}s`, 1100)
    if (impact > 13) { car.vel.multiplyScalar(0.8); shake = Math.max(shake, 0.25) }
  } else if (trick) {
    car.vel.multiplyScalar(0.45); shake = 0.55; audio.thud(); score.lose(); toast('Sloppy landing', 1200)
    sparks.burst(car.pos.x, car.y + 0.4, car.pos.z, 0xffd0e4, 24, 9)
  }
  if (impact > 8) { audio.thud(); buzz(24); sparks.burst(car.pos.x, car.y + 0.2, car.pos.z, 0xffe0a0, 14, 7); shake = Math.max(shake, Math.min(0.4, impact * 0.02)) }
}
const pOut = { x: 0, z: 0, nx: 0, nz: 0 }
function updatePushables(dt) {
  for (const p of pushables) {
    p.vx *= Math.exp(-1.5 * dt); p.vz *= Math.exp(-1.5 * dt)
    p.x += p.vx * dt; p.z += p.vz * dt
    const dx = p.x - car.pos.x, dz = p.z - car.pos.z, m = p.r + car.radius - 0.05, d = Math.hypot(dx, dz)
    if (d < m && d > 1e-4 && car.y < 1.6) {
      const nx = dx / d, nz = dz / d; p.x = car.pos.x + nx * m; p.z = car.pos.z + nz * m
      const rel = car.vel.x * nx + car.vel.y * nz
      if (rel > 0) { p.vx += nx * rel * 1.2; p.vz += nz * rel * 1.2; car.vel.x -= nx * rel * 0.08; car.vel.y -= nz * rel * 0.08; if (rel > 6) { sparks.burst(p.x, 0.8, p.z, 0xffd27a, 5, 4); if (!p.hit) { p.hit = 0.4; audio.thud(0.4); score.add('smash', 40) } } }
    }
    if (p.hit) p.hit = Math.max(0, p.hit - dt)
    if (collideCircle(p.x, p.z, p.r, pOut)) { p.x = pOut.x; p.z = pOut.z; const vn = p.vx * pOut.nx + p.vz * pOut.nz; if (vn < 0) { p.vx -= pOut.nx * vn * 1.7; p.vz -= pOut.nz * vn * 1.7 } }
    if (Math.abs(p.vx) + Math.abs(p.vz) < 0.05) p.vx = p.vz = 0
    const sp = Math.hypot(p.vx, p.vz); p.ry += (p.vx * 0.05) * dt * 4; p.rx += p.vz * dt / (p.r * 2.2); p.rz -= p.vx * dt / (p.r * 2.2)
    p.di.set(p.idx, p.x, p.y + Math.min(sp * 0.05, 0.6), p.z, p.ry, p.s, p.rx, p.rz)
  }
  props.groups.forEach((g) => g.commit())
}
function updateOrbs(dt, t) {
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i]
    if (!o.alive) { dummy.scale.setScalar(0); dummy.position.set(0, -50, 0); dummy.updateMatrix(); orbMesh.setMatrixAt(i, dummy.matrix); haloMesh.setMatrixAt(i, dummy.matrix); continue }
    const dx = car.pos.x - o.x, dz = car.pos.z - o.z, d = Math.hypot(dx, dz)
    if (d < 7) { const k = (1 - d / 7) * 14 * dt; o.x += dx * k / Math.max(d, 0.5); o.z += dz * k / Math.max(d, 0.5) }
    if (d < 1.9 && Math.abs(car.y + 0.9 - o.y) < 3.2) {
      o.alive = false; orbInfo.got++
      $('#orbCount').textContent = orbInfo.got
      sparks.burst(o.x, 1.2, o.z, 0xa892ff, 18, 7); audio.chime(orbInfo.got); buzz(12)
      if (orbInfo.got === orbs.length) unlockSecret()
      else toast(`+ ${o.name}  ·  ${orbInfo.got}/${orbs.length}`, 1300)
      continue
    }
    dummy.position.set(o.x, o.y + Math.sin(t * 2 + o.phase) * 0.25, o.z); dummy.rotation.set(0, t * 1.4 + o.phase, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); orbMesh.setMatrixAt(i, dummy.matrix)
    dummy.rotation.set(t * 2, t * 0.7, 0); dummy.updateMatrix(); haloMesh.setMatrixAt(i, dummy.matrix)
  }
  orbMesh.instanceMatrix.needsUpdate = haloMesh.instanceMatrix.needsUpdate = true
}
function unlockSecret() {
  secret = true; track('all_orbs')
  toast(`✦ All ${orbs.length} orbs — secret unlocked: rainbow trails. Now let’s talk →`, 4200)
  for (let i = 0; i < 40; i++) sparks.emit(car.pos.x, 1.5, car.pos.z, (Math.random() - 0.5) * 14, 4 + Math.random() * 8, (Math.random() - 0.5) * 14, new THREE.Color().setHSL(Math.random(), 0.9, 0.6), 1.2)
}

/* ------------------------------------------------------------------ camera */
const camHead = new THREE.Vector3(), cq2 = []
/** If a building / billboard / tower sits between the car and the desired camera spot, pull the camera in front of it. */
function occlude(des) {
  camHead.set(car.pos.x, 1.6 + car.viewY, car.pos.z)
  const sx = des.x - camHead.x, sz = des.z - camHead.z, L = Math.hypot(sx, sz) || 1
  let best = 1
  grid.query((camHead.x + des.x) / 2, (camHead.z + des.z) / 2, L / 2 + 8, cq2)
  const circle = (o) => {
    if (o.r < 1.2) return
    const t = clamp(((o.x - camHead.x) * sx + (o.z - camHead.z) * sz) / (L * L), 0, 1), d = Math.hypot(camHead.x + sx * t - o.x, camHead.z + sz * t - o.z)
    if (d < o.r + 0.5) { const tt = Math.max(0.1, t - (o.r + 0.9) / L); if (tt < best) best = tt }
  }
  for (const o of cq2) {
    if (o.kind === 'c') { circle(o); continue }
    if (des.y > (o.h ?? 99)) continue
    // segment vs expanded box (slab test in x/z)
    const ex = o.hx + 0.9, ez = o.hz + 0.9; let t0 = 0, t1 = 1, ok = true
    for (const [p0, d, e] of [[camHead.x - o.x, sx, ex], [camHead.z - o.z, sz, ez]]) {
      if (Math.abs(d) < 1e-6) { if (Math.abs(p0) > e) { ok = false; break } } else { let a1 = (-e - p0) / d, a2 = (e - p0) / d; if (a1 > a2) [a1, a2] = [a2, a1]; t0 = Math.max(t0, a1); t1 = Math.min(t1, a2); if (t0 > t1) { ok = false; break } }
    }
    if (ok && t0 > 0.001 && t0 < best) best = Math.max(0.1, t0 - 0.03)
  }
  for (const o of camObs) circle(o)
  if (best < 1) { des.x = camHead.x + sx * best; des.z = camHead.z + sz * best; des.y = lerp(camHead.y + 1.8, des.y, best) }
}
function avoidObstacles() {
  const c = camera.position
  grid.query(c.x, c.z, 6, cq2)
  for (const o of cq2) {
    if (o.kind === 'c') { if (c.y > 9) continue; const dx = c.x - o.x, dz = c.z - o.z, m = o.r + 0.9, d2 = dx * dx + dz * dz; if (d2 < m * m) { const d = Math.sqrt(d2) || 0.001; c.x = o.x + (dx / d) * m; c.z = o.z + (dz / d) * m } }
    else if (c.y < (o.h ?? 99)) { const ex = o.hx + 0.9, ez = o.hz + 0.9, dx = c.x - o.x, dz = c.z - o.z; if (Math.abs(dx) < ex && Math.abs(dz) < ez) { if (ex - Math.abs(dx) < ez - Math.abs(dz)) c.x = o.x + Math.sign(dx || 1) * ex; else c.z = o.z + Math.sign(dz || 1) * ez } }
  }
  for (const o of camObs) { if (c.y > o.top) continue; const dx = c.x - o.x, dz = c.z - o.z, m = o.r + 0.9, d2 = dx * dx + dz * dz; if (d2 < m * m) { const d = Math.sqrt(d2) || 0.001; c.x = o.x + (dx / d) * m; c.z = o.z + (dz / d) * m } }
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
  if (garage?.isOpen) { // showroom: slow orbit around the parked car
    menuAng += dt * 0.4
    camDes.set(car.pos.x + Math.sin(menuAng) * 8.5, car.y + 3, car.pos.z + Math.cos(menuAng) * 8.5)
    camera.position.lerp(camDes, damp(dt, 3)); tgt.set(car.pos.x, car.y + 0.9, car.pos.z); camLook.lerp(tgt, damp(dt, 6)); camera.lookAt(camLook); return
  }
  const port = clamp(1.15 - camera.aspect, 0, 0.7)
  const dist = 11 + sn * 3.5 + port * 7, h = 5.4 + sn * 1.5 + port * 3.5
  camDes.set(car.pos.x - fx * dist, h + car.viewY, car.pos.z - fz * dist)
  occlude(camDes)
  tgt.set(car.pos.x + fx * 5, 1.5 + car.viewY * 0.9, car.pos.z + fz * 5)
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
  gpuTime.value = t; uniforms.uTime.value = t; atmo?.update(dt, t); sky.update(camera, t); motes.position.set(car.pos.x, 0, car.pos.z)
  if (frame % 30 === 0) paintClock()
  updateCar(dt, t)
  updatePushables(dt); updateOrbs(dt, t)
  traffic?.update(dt, car, atmo ? atmo.state.night : 1, trafficFx); debris?.update(dt)
  for (const f of tickers) f(t, dt)
  sparks.update(dt)

  // zones
  let best = null, bd = 1e9
  if (started) for (const z of ZONES) { if (z.silent) continue; const d = Math.hypot(car.pos.x - z.pos[0], car.pos.z - z.pos[1]); if (d < z.r && d / z.r < bd) { bd = d / z.r; best = z } }
  if (started) {
    if (modes?.active) { if (active) enterZone(null) } // a race / delivery is running: no zone panels
    else if (zoneMute > 0) zoneMute -= dt
    else if (best?.id !== active?.id) enterZone(best)
  }
  avatarNear = lerp(avatarNear, active?.id === 'home' ? 1 : 0, damp(dt, 4))
  for (const b of boards) { const on = active?.id === b.id; if (on) { if (t - b.live.last > (isMobile ? 1 / 12 : 1 / 24)) { b.live.render(t); b.live.last = t } b.wasOn = true } else if (b.wasOn) { b.live.render(0); b.wasOn = false } b.g.scale.setScalar(lerp(b.g.scale.x, on ? 1.08 : 1, damp(dt, 5))); b.frame.material.emissiveIntensity = lerp(b.frame.material.emissiveIntensity, on ? 4.5 : 1.6, damp(dt, 5)) }

  updateTrial(dt); modes?.update(dt, t)
  if (frame % 2 === 0) updateArrow()
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

/* ------------------------------------------------------------------ games: modes, play hub, garage */
let modes = null, garage = null, zoneMute = 0
const hubEl = $('#hub'), hubList = $('#hubList'), arrowEl = $('#navArrow'), arrowSvg = arrowEl.querySelector('svg'), arrowDist = $('#navDist')
const menuOpen = () => !!(garage?.isOpen || hubEl.classList.contains('is-on'))
function closeMenus() { hubEl.classList.remove('is-on'); hubEl.hidden = true; garage?.close() }
function placeCar(x, z, ang) {
  car.pos.set(x, 0, z); car.vel.set(0, 0); car.ang = ang; car.y = car.viewY = city.BASE; car.air = false; car.vy = car.vyG = car.spinP = car.spinR = 0; camSnap = true
  const f = $('#flash'); f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on')
}
const fmtT = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
function paintHub() {
  const rb = modes?.race.best, db = modes?.del.best
  const items = [
    ['race', 'Street Race', `3 laps around the avenues vs 3 rivals${rb ? ' · best ' + fmtT(rb) : ''}`, 'Race'],
    ['delivery', 'Delivery Rush', `Five parcels against the clock${db ? ' · best $' + db.toLocaleString('en-US') : ''}`, 'Start'],
    ['stunt', 'Stunt Park', 'Ramps, plateaus and hoops — chain flips, rolls and drifts', 'Go'],
    ['trial', 'CV Time Trial', `Speedrun the résumé zones${best ? ' · best ' + best.toFixed(1) + 's' : ''}`, 'Start'],
    ['tour', 'Auto Tour', 'Sit back — the car drives you through my work', 'Play'],
    ['garage', 'Garage', `Eight cars, each drives differently · you own ${garage ? garage.owned.size : 1}`, 'Open'],
  ]
  hubList.innerHTML = items.map(([id, name, d, b]) => `<li><b>${name}</b><small>${d}</small><button class="mono" data-run="${id}">${b}</button></li>`).join('')
  $('#hubCash').textContent = score ? score.cash.toLocaleString('en-US') : '0'
}
function openHub() { if (!started) return; garage?.close(); hubEl.hidden = false; hubEl.classList.add('is-on'); paintHub(); track('hub_open') }
function toggleHub() { hubEl.classList.contains('is-on') ? closeMenus() : openHub() }
function runAct(act) {
  if (!started || !ready) return
  if (act === 'garage') { hubEl.classList.remove('is-on'); hubEl.hidden = true; garage?.open(); return }
  closeMenus()
  if (act === 'race') modes.startRace()
  else if (act === 'delivery') modes.startDelivery()
  else if (act === 'stunt') { cancelTour(); stopTrial(); modes.cancel(); placeCar(-144, -44, Math.PI); toast('Stunt Park — floor it over the ramp', 2200) }
  else if (act === 'trial') startTrial()
  else if (act === 'tour') startTour()
}
/** HUD compass arrow pointing at the active objective (checkpoint / parcel). */
function updateArrow() {
  const tg = started ? modes?.target() : null
  if (!tg) { arrowEl.classList.remove('is-on'); return }
  const dx = tg.x - car.pos.x, dz = tg.z - car.pos.z
  let err = Math.atan2(-dx, -dz) - car.ang; err = Math.atan2(Math.sin(err), Math.cos(err))
  arrowEl.classList.add('is-on'); arrowSvg.style.transform = `rotate(${-err}rad)`; arrowDist.textContent = Math.round(Math.hypot(dx, dz)) + ' m'
}

/* ------------------------------------------------------------------ time of day + weather */
let atmo = null
const todBtn = $('#todBtn'), wxBtn = $('#wxBtn')
const WX_LABEL = { auto: 'Auto', clear: 'Clear', rain: 'Rain', storm: 'Storm' }, TIME_LABEL = { auto: 'Auto', dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' }
function paintClock() {
  if (!atmo) return
  const ph = atmo.phase, icon = ph === 'Day' ? '☀' : ph === 'Night' ? '☾' : '◐'
  todBtn.textContent = `${icon} ${atmo.clock}`; todBtn.title = `Time of day — ${TIME_LABEL[atmo.state.timeMode]} (N)`
}
function cycleTime() { if (!atmo) return; const m = atmo.cycleTime(); toast(`Time: ${TIME_LABEL[m]}`, 1300); paintClock(); track('time_cycle', { mode: m }) }
function cycleWeather() { if (!atmo) return; const m = atmo.cycleWeather(); wxBtn.textContent = 'Sky: ' + WX_LABEL[m]; toast(`Weather: ${WX_LABEL[m]}`, 1300); track('weather_cycle', { mode: m }) }
todBtn.addEventListener('click', cycleTime); wxBtn.addEventListener('click', cycleWeather)

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
  if (!(m.car || m.avatar)) return
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
    car.hero = m.car.object; car.heroWheels = car.mw; car.heroAero = car.aero
    pool.scale.setScalar(1.25)
  }
  if (m.avatar) {
    avatar.children.forEach((c) => { if (c !== avatar.halo && c !== avatar.tag) c.visible = false })
    avatar.scale.setScalar(1); avatar.tag.position.y = 5; dress(m.avatar.object); avatar.add(m.avatar.object); avatar.model = m.avatar.object
    if (m.avatar.clips.length) { const mixer = new THREE.AnimationMixer(m.avatar.scene); mixer.clipAction(m.avatar.clips[0]).play(); tickers.push((t, dt) => mixer.update(dt)) }
  }
}
const KENNEY = { title: 'City, car, nature & racing kits', author: 'Kenney', license: 'CC0', url: 'https://kenney.nl/assets' }
function showCredits(list) {
  list = [...list, KENNEY]
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
  const kits = await loadKits(['city', 'cars', 'nature', 'racing']); setPct(60)
  city = createCity({ scene, kits, uniforms, mobile: isMobile }); grid = city.grid; setPct(70)
  score = createScore({ toast, onBank: (cash, chain, rec) => { toast(`+$${cash.toLocaleString('en-US')}  ·  chain ${chain.toLocaleString('en-US')}${rec ? '  ·  new best!' : ''}`, 2600); audio.chime(6); track('chain_bank', { chain }) } })
  rings = createRings({ scene, list: city.rings, isMobile })
  grid.addCircle(0, 0, 4.8, { tag: 'island' }) // the roundabout island under the hologram
  envTex = neonEnv()
  spawnProps(city, kits); stations.buildAll(); TOUR = buildTourRoute(city, ZONES); buildMinimap(city); setPct(90)
  traffic = createTraffic({ scene, kits, city, count: isMobile ? 14 : 28, plainMat }); traffic.init(0, 28)
  debris = createDebris({ scene, kits, plainMat, perModel: isMobile ? 4 : 7 })
  modes = createModes({
    scene, city, car, traffic, score, toast, audio, sparks, kits, plainMat, track, placeCar, frame: () => frame,
    chip: (on) => tourChip.classList.toggle('is-on', on), chipHTML: (h) => { tourChip.innerHTML = h },
    cancelOthers: (m) => { cancelTour(); stopTrial(); modes.cancel(m) },
    showPanel: (html) => { panel.innerHTML = html; panel.classList.add('is-on'); zoneMute = 9; decorate() }, hideZonePanel: () => panel.classList.remove('is-on'),
  })
  garage = createGarage({ car, kits, plainMat, score, toast, audio, track, isMobile })
  const LANDMARKS = { race: ['RACE', '3 LAPS · $600'], delivery: ['DELIVERY', 'PARCELS · CASH'], garage: ['GARAGE', '8 CARS'], stunt: ['STUNT PARK', 'RAMPS · HOOPS'] }
  for (const z of ZONES) if (LANDMARKS[z.id]) modes.addLandmark({ x: z.pos[0], z: z.pos[1], label: LANDMARKS[z.id][0], sub: LANDMARKS[z.id][1], color: z.color, radius: z.id === 'stunt' ? 9 : 7 })
  atmo = createAtmosphere({ scene, sky, hemi, sun: moon, bloom, renderer, uniforms, camera, isMobile, audio, city }); atmo.setEnv(envTex); atmo.update(0, 0); sky.bake(true); paintClock()
  if (import.meta.env.DEV) { window.__city = city; window.__atmo = atmo; window.__kits = kits; window.__modes = modes; window.__garage = garage; window.__score = score }
  const models = await modelsP; applyModels(models); garage.init(); showCredits(models.credits); setPct(97)
  renderer.compile(scene, camera); atmo.warm(); composer.render(); setPct(100)
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
