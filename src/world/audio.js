// Tiny WebAudio synth: engine hum, ambient pad, chimes and thuds. No asset files.
export function createAudio() {
  let ctx, master, eng1, eng2, engGain, filt, on = false
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
    on = true
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
      if (!on) return
      const t = ctx.currentTime
      eng1.frequency.setTargetAtTime(46 + speed * 95 + boost * 38, t, 0.08); eng2.frequency.setTargetAtTime((46 + speed * 95 + boost * 38) * 1.5, t, 0.08)
      filt.frequency.setTargetAtTime(260 + speed * 1500 + boost * 700, t, 0.1)
      engGain.gain.setTargetAtTime(0.03 + throttle * 0.035 + speed * 0.06, t, 0.1)
    },
    chime(n = 0) { const f = 587 * Math.pow(1.122, n % 8); tone(f, 0.28, 'sine', 0.16); setTimeout(() => tone(f * 1.5, 0.35, 'sine', 0.1), 70) },
    thud() { tone(120, 0.25, 'sawtooth', 0.2, 40) },
    blip() { tone(880, 0.09, 'triangle', 0.08); setTimeout(() => tone(1320, 0.12, 'triangle', 0.06), 60) },
    get muted() { return muted },
    setMuted(m) { muted = m; try { localStorage.setItem('im-muted', m ? '1' : '0') } catch (_) { /* ignore */ } if (master) master.gain.setTargetAtTime(m ? 0 : 0.4, ctx.currentTime, 0.05) },
  }
}
