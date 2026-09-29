import { watch } from 'vue'
import gsap from 'gsap'
import { createCore, applyTokens } from './core.js'
import { createWorld, poseFor, overviewPose, finalePose, stationX } from './world.js'
import { STATIONS } from '../store.js'
import { track } from '../../world/analytics.js'
import { createSfx } from './sfx.js'
import { createAuto } from './auto.js'

/** Wires the Three.js engine to the shared Vue state. Stations plug in through `modules[i]`. */
export async function createEngine(canvas, state, { modules = [] } = {}) {
  const coarse = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 600
  const core = createCore(canvas, { mobile: coarse }), mobile = core.mobile
  const world = createWorld(core)
  const stations = modules.map((make, i) => make?.({ core, world, state, dock: world.docks[i], mobile }) ?? null)
  stations.forEach((s) => s?.group && (s.group.visible = false))

  const sfx = createSfx()
  applyTokens(state.tokens)
  watch(() => state.tokens, (t) => applyTokens(t), { deep: true })

  const ov = overviewPose(); core.setPose(ov.p, ov.l)
  core.start()

  let current = -1
  function showOnly(i) { stations.forEach((s, k) => { if (s?.group) s.group.visible = Math.abs(k - i) <= 1 && k === i || k === i }) }
  function enter(i, { instant = false } = {}) {
    if (current >= 0) stations[current]?.leave?.()
    current = i; state.station = i; world.setActive(i)
    const pose = poseFor(i)
    showOnly(i)
    if (instant) core.setPose(pose.p, pose.l); else core.flyTo(pose.p, pose.l, { dur: 2.6, arc: 4, onDone: () => stations[i]?.enter?.() })
    if (instant) stations[i]?.enter?.()
    track('station_enter', { station: STATIONS[i].id })
  }

  const api = {
    core, world, stations, mobile,
    start() { sfx.start(); state.phase = 'play'; state.t0 = performance.now(); state.done = state.done.map(() => false); world.moveCrateTo(0, 2.6); enter(0) },
    advance() {
      sfx.whoosh()
      const i = state.station
      state.done[i] = true; stations[i]?.leave?.()
      if (i >= STATIONS.length - 1) return api.finish()
      world.moveCrateTo(i + 1, 2.6); enter(i + 1)
    },
    goTo(i) { if (i === state.station || i > state.station) return; world.moveCrateTo(i, 1.6); enter(i) },
    finish() {
      state.stats.seconds = Math.round((performance.now() - state.t0) / 1000)
      stations.forEach((s) => s?.leave?.()); world.setActive(-1)
      const p = finalePose(); core.flyTo(p.p, p.l, { dur: 2.8, arc: 2 })
      state.phase = 'finale'; track('pipeline_complete', { s: state.stats.seconds })
    },
    restart() { location.reload() },
    startAuto() { api.start(); setTimeout(() => auto.start(), 2800) },
    takeControl() { auto.cancel() },
    sfx,
    update: (f) => core.add(f),
  }
  const auto = createAuto({ engine: api, state })
  watch(() => state.perf.won, (v) => v && sfx.win()); watch(() => state.deploy.won, (v) => v && sfx.win())
  state.phase = 'start'
  return api
}
