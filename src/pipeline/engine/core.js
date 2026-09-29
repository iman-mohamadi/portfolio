import * as THREE from 'three'
import gsap from 'gsap'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createFxPass } from '../../world/fx.js'

/**
 * The palette is a set of shared THREE.Color instances. Materials reference them (never copy them),
 * so changing the design tokens re-themes the entire factory — and the Vue UI via CSS variables — in one call.
 */
export const palette = {
  primary: new THREE.Color(), secondary: new THREE.Color(), accent: new THREE.Color(), ink: new THREE.Color(0x07080d),
}
export function applyTokens(t) {
  const h = (t.hue % 360) / 360
  palette.primary.setHSL(h, 0.92, 0.58)
  palette.secondary.setHSL((h + 0.13) % 1, 0.85, 0.62)
  palette.accent.setHSL((h + 0.5) % 1, 0.9, 0.6)
  const s = document.documentElement.style
  s.setProperty('--h', Math.round(t.hue)); s.setProperty('--radius', `${Math.round(6 + t.radius * 36)}px`)
}
applyTokens({ hue: 322, radius: 0.28 })

export function createCore(canvas, { mobile: mob = false, quality = 'auto' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  // software rasterisers (no GPU) get the same reduced budgets as a low-end phone
  let gpuName = ''
  try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpuName = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '' } catch (_) { /* unknown GPU */ }
  const soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpuName) && !new URLSearchParams(location.search).has('hq')
  const mobile = mob || soft
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.info.autoReset = false
  let ratio = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75)
  if (quality === 'low' || soft) ratio = 1
  renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight, false)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05060a)
  scene.fog = new THREE.FogExp2(0x05060a, 0.011)
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 900)

  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(ratio); composer.setSize(innerWidth, innerHeight)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.62, 0.55, 0.58)
  composer.addPass(bloom); composer.addPass(new OutputPass())
  const fx = createFxPass(); composer.addPass(fx)

  scene.add(new THREE.HemisphereLight(0x8a7cff, 0x120a14, 0.55))
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(-20, 40, 30); scene.add(key)

  /* camera rig: `pos`/`look` are the eased "director" values; pointer parallax is layered on top */
  const rig = { pos: new THREE.Vector3(0, 8, 30), look: new THREE.Vector3(0, 3, 0), base: null, px: 0, py: 0, sx: 0, sy: 0, spread: 1 }
  addEventListener('pointermove', (e) => { rig.px = (e.clientX / innerWidth - 0.5) * 2; rig.py = (e.clientY / innerHeight - 0.5) * 2 }, { passive: true })
  const tmp = new THREE.Vector3(), tl = new THREE.Vector3()
  function aspectSpread() { return THREE.MathUtils.clamp(1.25 / camera.aspect, 1, 1.9) }

  let flight = null
  function setPose(p, l) { rig.pos.copy(p); rig.look.copy(l) }
  function flyTo(p, l, { dur = 2.4, arc = 3, ease = 'power3.inOut', onDone } = {}) {
    flight?.kill()
    const fp = rig.pos.clone(), fl = rig.look.clone(), o = { t: 0 }
    flight = gsap.to(o, { t: 1, duration: dur, ease, onUpdate() { rig.pos.lerpVectors(fp, p, o.t); rig.pos.y += Math.sin(o.t * Math.PI) * arc; rig.look.lerpVectors(fl, l, o.t) }, onComplete() { rig.pos.copy(p); rig.look.copy(l); onDone?.() } })
    return flight
  }

  const subs = new Set()
  const stats = { fps: 60, renderMs: 0, calls: 0, tris: 0 }
  let last = performance.now(), fpsAcc = 0, fpsN = 0, running = false, paused = false
  function frame() {
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now
    if (paused) return
    const t = now / 1000
    fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { stats.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0 }
    for (const f of subs) f(t, dt)
    // camera = rig + gentle parallax + idle sway
    rig.sx += (rig.px - rig.sx) * Math.min(1, dt * 3); rig.sy += (rig.py - rig.sy) * Math.min(1, dt * 3)
    const k = aspectSpread(), sw = Math.sin(t * 0.3) * 0.15
    tmp.copy(rig.pos).sub(rig.look).multiplyScalar(k).add(rig.look)
    camera.position.set(tmp.x + rig.sx * 1.8 + sw, tmp.y - rig.sy * 0.9, tmp.z)
    tl.copy(rig.look); camera.lookAt(tl)
    fx.uniforms.uTime.value = t % 100
    renderer.info.reset()
    const r0 = performance.now(); composer.render(); const ms = performance.now() - r0
    stats.renderMs += (ms - stats.renderMs) * 0.12; stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles
  }
  function start() { if (running) return; running = true; last = performance.now(); renderer.setAnimationLoop(frame) }
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight)
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix()
  }
  addEventListener('resize', resize); resize()
  document.addEventListener('visibilitychange', () => { paused = document.hidden; last = performance.now() })

  function setPixelRatio(r) { ratio = r; renderer.setPixelRatio(r); composer.setPixelRatio(r); composer.setSize(innerWidth, innerHeight) }
  const lostHandlers = []
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lostHandlers.forEach((f) => f()) })
  canvas.addEventListener('webglcontextrestored', () => location.reload())

  return {
    renderer, scene, camera, composer, bloom, fx, key, rig, stats, palette, mobile, soft, gpuName,
    add: (f) => (subs.add(f), () => subs.delete(f)),
    start, resize, setPose, flyTo, setPixelRatio, getPixelRatio: () => ratio,
    onContextLost: (f) => lostHandlers.push(f),
  }
}
