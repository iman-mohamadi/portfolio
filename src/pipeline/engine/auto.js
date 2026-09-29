import gsap from 'gsap'
import { STATIONS } from '../store.js'

/**
 * Recruiter mode: plays the whole pipeline by driving the exact same reactive state a human would edit,
 * so it is a live demo of the real code, not a video. Any interaction takes back control.
 */
export function createAuto({ engine, state }) {
  let run = null
  const cancelled = () => !run || run.cancelled
  const sleep = (ms) => new Promise((res, rej) => { const t = setTimeout(() => (cancelled() ? rej(new Error('cancel')) : res()), ms); run?.timers.push(t) })
  const say = (t) => { state.caption = t }
  const tween = (obj, vars, dur = 1.2) => new Promise((res) => gsap.to(obj, { ...vars, duration: dur, ease: 'power2.inOut', onComplete: res }))
  const waitFor = async (fn, max = 15000) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > max) return; await sleep(200) } }

  async function script() {
    say('Station 1 — Design: three tokens re-theme the 3D scene, the UI kit and this very interface.'); await sleep(1500)
    await tween(state.tokens, { hue: 205, radius: 0.9 }, 1.6); await sleep(600); await tween(state.tokens, { hue: 18, radius: 0.06, density: 0.85 }, 1.6); await sleep(600)
    await tween(state.tokens, { hue: 322, radius: 0.28, density: 1.1 }, 1.6); await sleep(700)
    await engine.advance(); await sleep(3200)
    say('Station 2 — Build: a parametric cabinet. Every slider regenerates the boards, the cut list and the sheet nesting.'); await sleep(1200)
    const c = state.cabinet
    await tween(c, { w: 140, h: 190 }, 1.2); await sleep(400); await tween(c, { d: 40 }, 1); c.shelves = 4; await sleep(600); c.finish = 1; await sleep(1200)
    c.exploded = true; say('Flat-pack: boards nest onto real 8×4 ft sheets — yield is computed, not faked.'); await sleep(3800); c.exploded = false; await sleep(1300)
    await engine.advance(); await sleep(3200)
    say('Station 3 — Render: each effect is real GLSL. Watch the same mesh gain reflections, iridescence, displacement.'); await sleep(1200)
    for (const id of ['pbr', 'rim', 'iridescence', 'displace']) { state.layers[id] = true; await sleep(1500) }
    await sleep(800); await engine.advance(); await sleep(3200)
    say('Station 4 — the frame-budget boss. Calibrating a scene that is genuinely too heavy for this device…')
    await waitFor(() => state.perf.phase === 'fight'); await sleep(1400)
    say(`Naive rendering: ${state.perf.calls.toLocaleString()} draw calls, ${(state.perf.tris / 1e6).toFixed(1)}M triangles.`); await sleep(2200)
    state.perf.instancing = true; say('Instancing: thousands of draw calls become a handful — but the GPU is still drowning in triangles.'); await sleep(3800)
    state.perf.culling = true; say('Frustum culling: stop submitting what nobody can see.'); await sleep(3000)
    state.perf.lod = true; say('Level of detail: far crates drop to a few triangles. Budget defeated.'); await waitFor(() => state.perf.won, 8000); await sleep(2600)
    await engine.advance(); await sleep(3200)
    say('Station 5 — Deploy: placing edge nodes cuts real great-circle latency for users on four continents.'); await sleep(1500)
    for (const r of state.deploy.best.set) { state.deploy.nodes.push({ ...r }); await sleep(1500) }
    say(`Average TTFB ${state.deploy.base} → ${state.deploy.ttfb} ms. The optimum for four nodes.`); await sleep(3000)
    await engine.advance()
  }

  return {
    start() {
      run = { cancelled: false, timers: [] }; state.auto = true
      script().catch((e) => { if (e.message !== 'cancel') console.error(e) }).finally(() => { state.auto = false; state.caption = '' })
    },
    cancel() { if (!run) return; run.cancelled = true; run.timers.forEach(clearTimeout); gsap.killTweensOf(state.tokens); gsap.killTweensOf(state.cabinet); state.auto = false; state.caption = ''; run = null },
    get running() { return !!run && !run.cancelled },
  }
}
