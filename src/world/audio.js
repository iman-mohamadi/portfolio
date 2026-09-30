// Tiny WebAudio synth: engine hum, ambient pad, generative music, rain, thunder, chimes and thuds. No asset files.
export function createAudio() {
  let skidGain, lastSkid = -1, noiseBuf, ctx, master, eng1, eng2, engGain, filt, on = false, arp, arpLp, rainGain, speedN = 0, lastRain = -1, lastMood = -1
  let muted = false
  try { muted = localStorage.getItem('im-muted') === '1' } catch (_) { /* private mode */ }

  function init() {
    if (ctx) return
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.4; master.connect(ctx.destination)
    filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400
    engGain = ctx.createGain(); engGain.gain.value = 0
    eng1 = ctx.createOscillator(); eng1.type = 'sawtooth'; eng2 = ctx.createOscillator(); eng2.type = 'square'
    const g2 = ctx.createGain(); g2.gain.value = 0.35
    eng1.connect(filt); eng2.connect(g2); g2.connect(filt); filt.connect(engGain); engGain.connect(master)
    eng1.start(); eng2.start()
    // ambient pad
    for (const [f, d] of [[55, 0], [82.4, 4], [110, -3]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = d
      const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(master); o.start()
    }
    // rain bed: looped noise through a band-pass, faded in with the weather
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    const rs = ctx.createBufferSource(); rs.buffer = nb; rs.loop = true
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 700; const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 7000
    rainGain = ctx.createGain(); rainGain.gain.value = 0; rs.connect(rhp); rhp.connect(rlp); rlp.connect(rainGain); rainGain.connect(master); rs.start()
    noiseBuf = nb
    // tyre squeal: the same noise through a resonant band-pass, opened by drifting
    const ss = ctx.createBufferSource(); ss.buffer = nb; ss.loop = true; ss.playbackRate.value = 0.8
    const sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 1500; sbp.Q.value = 6
    skidGain = ctx.createGain(); skidGain.gain.value = 0; ss.connect(sbp); sbp.connect(skidGain); skidGain.connect(master); ss.start()
    on = true
    // generative music: chord-following arpeggio through a feedback delay, tempo rises with speed
    arp = ctx.createGain(); arp.gain.value = 0.5
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.32; const fb = ctx.createGain(); fb.gain.value = 0.38
    const lp = arpLp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200
    arp.connect(master); arp.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master)
    const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]]
    let step = 0, nextT = ctx.currentTime + 0.2
    const note = (f, t, d, v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(arp); o.start(t); o.stop(t + d + 0.05) }
    setInterval(() => {
      if (muted || ctx.state !== 'running') { nextT = ctx.currentTime + 0.1; return }
      while (nextT < ctx.currentTime + 0.15) {
        const ch = chords[(step >> 4) % 4], pat = [0, 1, 2, 1, 2, 1, 0, 2][step % 8]
        if (step % 2 === 0 || Math.random() < 0.45) note(ch[pat] * (step % 8 > 4 ? 2 : 1), nextT, 0.5, 0.055 + Math.random() * 0.02)
        if (step % 16 === 0) note(ch[0] / 2, nextT, 1.6, 0.09)
        step++; nextT += 0.27 - 0.1 * speedN
      }
    }, 45)
    document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume() })
  }
  function tone(f, dur, type = 'sine', vol = 0.15, slideTo) {
    if (!on || muted) return
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05)
  }
  return {
    start() { init(); if (ctx?.state === 'suspended') ctx.resume() },
    engine(speed, throttle, boost) {
      speedN = speed
      if (!on) return
      const t = ctx.currentTime
      eng1.frequency.setTargetAtTime(46 + speed * 95 + boost * 38, t, 0.08); eng2.frequency.setTargetAtTime((46 + speed * 95 + boost * 38) * 1.5, t, 0.08)
      filt.frequency.setTargetAtTime(260 + speed * 1500 + boost * 700, t, 0.1)
      engGain.gain.setTargetAtTime(0.03 + throttle * 0.035 + speed * 0.06, t, 0.1)
    },
    chime(n = 0) { const f = 587 * Math.pow(1.122, n % 8); tone(f, 0.28, 'sine', 0.16); setTimeout(() => tone(f * 1.5, 0.35, 'sine', 0.1), 70) },
    /** 0..1 amount of tyre squeal. */
    skid(v) { if (!on || Math.abs(v - lastSkid) < 0.02) return; lastSkid = v; skidGain.gain.setTargetAtTime(v * 0.07, ctx.currentTime, 0.06) },
    rain(w) { if (!on || Math.abs(w - lastRain) < 0.01) return; lastRain = w; rainGain.gain.setTargetAtTime(w * 0.16, ctx.currentTime, 0.4) },
    /** Distant rumble: low-passed noise that swells and rolls off. */
    thunder() {
      if (!on || muted) return
      const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
      src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(70, t + 2.6)
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + 3)
    },
    /** Brighter, airier arpeggio in daylight; darker and wetter at night. */
    mood(day) { if (!on || Math.abs(day - lastMood) < 0.02) return; lastMood = day; arpLp.frequency.setTargetAtTime(1400 + day * 2600, ctx.currentTime, 0.6) },
    /** Soft "opening" and "closing" whooshes for chapters and menus, and a discovery chime. */
    enter() { tone(260, 0.5, 'sine', 0.07, 620); setTimeout(() => tone(520, 0.4, 'triangle', 0.04, 780), 90) },
    exit() { tone(620, 0.35, 'sine', 0.05, 240) },
    discover() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.55, 'sine', 0.09), i * 110)) },
    thud() { tone(120, 0.25, 'sawtooth', 0.2, 40) },
    blip() { tone(880, 0.09, 'triangle', 0.08); setTimeout(() => tone(1320, 0.12, 'triangle', 0.06), 60) },
    get muted() { return muted },
    setMuted(m) { muted = m; try { localStorage.setItem('im-muted', m ? '1' : '0') } catch (_) { /* ignore */ } if (master) master.gain.setTargetAtTime(m ? 0 : 0.4, ctx.currentTime, 0.05) },
  }
}
