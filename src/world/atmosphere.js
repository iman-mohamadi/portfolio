import * as THREE from 'three'
import { clamp, lerp, damp, seeded } from './helpers.js'

/**
 * Living sky: a 24 h day/night cycle (dawn → noon → dusk → neon night), weather (clear / rain / storm with lightning),
 * lit windows and street lights at night, and a wet-city look when it rains. Everything is driven from one place so the
 * lighting, fog, sky dome, post-processing and sound always agree.
 */
const TAU = Math.PI * 2
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const C = (h) => new THREE.Color(h)

const PRESETS = { dawn: 6.4, day: 12.5, dusk: 18.55, night: 23.2 }
export const TIME_MODES = ['auto', 'dawn', 'day', 'dusk', 'night']
export const WEATHER_MODES = ['auto', 'clear', 'rain', 'storm']
const DAY_SECONDS = 420 // one full 24 h cycle in auto mode

// palette: [night, day]
const P = {
  hor: [C(0x1c0a2c), C(0xb4d2f2)], zen: [C(0x03030c), C(0x2f6fd6)],
  fog: [C(0x0a0e1e), C(0xa9c6e6)], hemiSky: [C(0x6a78c8), C(0xcfe2ff)], hemiGround: [C(0x1a1626), C(0x6f7a5c)],
  sun: [C(0xa9b8ff), C(0xfff0d2)],
}
const OVERCAST = { hor: C(0x8a929c), zen: C(0x5a6270), fog: C(0x7d8590), sun: C(0xb9c2d4) }
const TW = C(0xff7440), TW_FOG = C(0x5a2a30)
const tmp = new THREE.Color(), tmp2 = new THREE.Color()

export function createAtmosphere({ scene, sky, hemi, sun, bloom, renderer, uniforms, camera, isMobile, audio, city, onChange = () => {} }) {
  const state = { tod: 19.6, timeMode: 'auto', wxMode: 'auto', rain: 0, rainTarget: 0, wxTimer: 70, day: 0, night: 1, flash: 0, nextBolt: 6, bolts: [] }
  const rnd = seeded(5)
  const haze = new THREE.Color()

  /* ---- rain: GPU-animated streaks that wrap around the camera ---- */
  const N = isMobile ? 1100 : 2600, R = 30, H = 34
  const pos = new Float32Array(N * 6), end = new Float32Array(N * 2), rr = new Float32Array(N * 2)
  for (let i = 0; i < N; i++) {
    const x = (rnd() * 2 - 1) * R, y = rnd() * H, z = (rnd() * 2 - 1) * R, k = rnd()
    for (let v = 0; v < 2; v++) { pos.set([x, y, z], (i * 2 + v) * 3); end[i * 2 + v] = v; rr[i * 2 + v] = k }
  }
  const rg = new THREE.BufferGeometry()
  rg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); rg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1)); rg.setAttribute('aRnd', new THREE.BufferAttribute(rr, 1))
  const rainU = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uI: { value: 0 }, uTint: { value: new THREE.Color(0xbcd0ff) } }
  const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute float aEnd,aRnd;uniform vec3 uCam;uniform float uTime,uI;varying float vA;
      void main(){
        vec3 p=position;
        p.y=mod(p.y-uTime*(24.+aRnd*10.),${H.toFixed(1)});
        p.x=mod(p.x-uCam.x+${R.toFixed(1)},${(2 * R).toFixed(1)})+uCam.x-${R.toFixed(1)};
        p.z=mod(p.z-uCam.z+${R.toFixed(1)},${(2 * R).toFixed(1)})+uCam.z-${R.toFixed(1)};
        p+=vec3(.9,1.,.35)*aEnd*(.9+aRnd*.7);
        vA=step(aRnd,uI)*(1.-aEnd*.55);
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader: 'uniform vec3 uTint;varying float vA;void main(){if(vA<.01)discard;gl_FragColor=vec4(uTint,vA*.5);}',
  }))
  rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 5; scene.add(rain)

  /* ---- wet city: glossy materials that pick up the neon environment ---- */
  const wetMats = city?.mats || [], PBR = !isMobile // phones use Lambert materials: no wet reflections
  let envOn = false, envTex = null
  /** The neon environment only costs fragment time, so it is attached to the city's materials just while it is wet. */
  const setWet = (w) => {
    const want = PBR && w > 0.03
    if (want !== envOn) { envOn = want; for (const m of wetMats) { m.envMap = want ? envTex : null; m.needsUpdate = true } }
    if (want) for (const m of wetMats) { m.roughness = lerp(0.85, 0.32, w); m.envMapIntensity = w * 1.15 }
    else if (wetMats.length && wetMats[0].roughness !== 0.85) for (const m of wetMats) m.roughness = 0.85
  }

  const weatherOf = (mode) => (mode === 'clear' ? 0 : mode === 'rain' ? 0.75 : mode === 'storm' ? 1 : null)

  function setTime(mode, announce = true) {
    state.timeMode = mode
    if (mode !== 'auto') state.target = PRESETS[mode]; else state.target = null
    if (announce) onChange()
  }
  function setWeather(mode) {
    state.wxMode = mode
    const w = weatherOf(mode); if (w !== null) state.rainTarget = w
    onChange()
  }
  const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length]

  function hhmm() { const h = Math.floor(state.tod) % 24, m = Math.floor((state.tod % 1) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') }
  function phase() { const t = state.tod; return t < 5 || t >= 21 ? 'Night' : t < 8 ? 'Dawn' : t < 17 ? 'Day' : t < 21 ? 'Dusk' : 'Night' }

  function update(dt, t) {
    // ---- clock
    if (state.timeMode === 'auto') state.tod = (state.tod + (dt * 24) / DAY_SECONDS) % 24
    else if (state.target != null) { let d = state.target - state.tod; d = ((d + 12) % 24 + 24) % 24 - 12; state.tod = (state.tod + d * damp(dt, 1.6) + 24) % 24 }
    // ---- weather
    if (state.wxMode === 'auto') {
      state.wxTimer -= dt
      if (state.wxTimer <= 0) { state.rainTarget = state.rainTarget > 0.1 ? 0 : (rnd() < 0.55 ? 0.7 : 0.95); state.wxTimer = state.rainTarget > 0.1 ? 40 + rnd() * 50 : 60 + rnd() * 90 }
    }
    state.rain += (state.rainTarget - state.rain) * damp(dt, 0.45)
    const wet = clamp(state.rain, 0, 1), oc = sstep(0.05, 0.8, wet)

    // ---- sun / phase
    const elev = Math.sin(((state.tod - 6) / 24) * TAU)
    const day = sstep(-0.1, 0.22, elev), night = 1 - sstep(-0.2, 0.06, elev), tw = Math.exp(-((elev / 0.17) ** 2))
    state.day = day; state.night = night

    // ---- colours
    const hor = tmp.copy(P.hor[0]).lerp(P.hor[1], day).lerp(OVERCAST.hor, oc * (0.35 + 0.65 * day)); sky.uniforms.uHor.value.copy(hor)
    sky.uniforms.uZen.value.copy(P.zen[0]).lerp(P.zen[1], day).lerp(OVERCAST.zen, oc * (0.4 + 0.6 * day))
    sky.uniforms.uTwCol.value.copy(TW); sky.uniforms.uDay.value = day; sky.uniforms.uTw.value = tw * (1 - oc * 0.6)
    sky.uniforms.uCloud.value = 0.25 + oc * 0.75; sky.uniforms.uDark.value = oc * (0.25 + 0.6 * day)
    const th = ((state.tod - 6) / 12) * Math.PI
    sky.uniforms.uSun.value.set(Math.cos(th) * 0.85, elev * 0.95 + 0.02, 0.45).normalize()

    // fog + background follow the horizon so distant blocks melt into the sky
    tmp2.copy(P.fog[0]).lerp(P.fog[1], day).lerp(OVERCAST.fog, oc * (0.3 + 0.7 * day)).lerp(TW_FOG, tw * 0.55 * (1 - oc))
    scene.fog.color.copy(tmp2); scene.background.copy(tmp2)
    scene.fog.density = lerp(0.0044, 0.0028, day) + wet * 0.0034 + tw * 0.0008
    haze.copy(sky.uniforms.uHor.value); sky.setNight(night * (1 - oc * 0.7), haze)

    // lights
    const flash = state.flash
    hemi.color.copy(P.hemiSky[0]).lerp(P.hemiSky[1], day).lerp(tmp.copy(OVERCAST.sun), oc * 0.5)
    hemi.groundColor.copy(P.hemiGround[0]).lerp(P.hemiGround[1], day)
    hemi.intensity = lerp(1.35, 1.65, day) * (1 - oc * 0.18) + flash * 2.2 + tw * 0.25
    sun.color.copy(P.sun[0]).lerp(P.sun[1], day).lerp(TW, tw * 0.55 * (1 - oc)).lerp(OVERCAST.sun, oc * 0.7)
    sun.intensity = lerp(1.7, 3.3, day) * (1 - oc * 0.62) + flash * 2
    // the moon stays where it was; the sun sweeps the sky (pure direction – no shadows are cast)
    sun.position.set(lerp(-80, Math.cos(th) * 150, day), lerp(140, 30 + elev * 150, day), lerp(60, 70, day))
    renderer.toneMappingExposure = lerp(1.05, 0.92, day) * (1 - oc * 0.06)
    bloom.strength = lerp(0.55, 0.32, day) + oc * 0.06 + flash * 0.4
    bloom.threshold = lerp(0.6, 0.78, day)

    // city lights
    uniforms.uNight.value = night
    if (city?.lampGlow) { const g = city.lampGlow; g.points.material.opacity = night * 0.95; g.points.visible = night > 0.02; g.pools.material.opacity = night * (0.55 + wet * 0.35); g.pools.visible = night > 0.02 }
    setWet(wet)

    // rain + lightning
    rain.visible = wet > 0.03
    if (rain.visible) { rainU.uI.value = clamp(wet * 1.25, 0, 1); rainU.uTime.value = t; rainU.uCam.value.copy(camera.position); rainU.uTint.value.setScalar(lerp(0.85, 0.5, day)).lerp(tmp.set(0xbcd0ff), 0.7) }
    audio.rain?.(wet)
    if (state.wxMode === 'storm' || (state.wxMode === 'auto' && wet > 0.9)) {
      state.nextBolt -= dt
      if (state.nextBolt <= 0) { state.flash = 1; state.nextBolt = 4 + rnd() * 9; state.bolts.push(0.5 + rnd() * 1.6) }
    }
    state.flash = Math.max(0, state.flash - dt * (state.flash > 0.55 ? 7 : 3.2)); sky.uniforms.uFlash.value = state.flash
    if (state.flash > 0.5 && state.flash < 0.62 && rnd() < 0.5) state.flash = 0.95 // double strike
    for (let i = state.bolts.length - 1; i >= 0; i--) { state.bolts[i] -= dt; if (state.bolts[i] <= 0) { state.bolts.splice(i, 1); audio.thunder?.() } }
    audio.mood?.(day)
  }

  /** Compile the wet (env-mapped) shader variants once at boot so the first rain shower does not hitch. */
  function warm() {
    if (!PBR || !envTex || !wetMats.length) return
    for (const m of wetMats) { m.envMap = envTex; m.needsUpdate = true }
    renderer.compile(scene, camera)
    for (const m of wetMats) { m.envMap = null; m.needsUpdate = true }
    renderer.compile(scene, camera)
  }

  return {
    update, state, setTime, setWeather, warm, setEnv(t) { envTex = t },
    cycleTime() { setTime(cycle(TIME_MODES, state.timeMode)); return state.timeMode },
    cycleWeather() { setWeather(cycle(WEATHER_MODES, state.wxMode)); return state.wxMode },
    get clock() { return hhmm() }, get phase() { return phase() },
    get isDark() { return state.night > 0.5 }, get wet() { return state.rain },
  }
}
