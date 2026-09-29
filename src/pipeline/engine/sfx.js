// Tiny WebAudio sound design: UI ticks, whooshes, a win chord and a soft ambient drone. No audio files.
export function createSfx() {
  let ctx, master, on = false, muted = false
  try { muted = localStorage.getItem('pl-muted') === '1' } catch (_) { /* private mode */ }
  const init = () => {
    if (ctx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination)
    // ambient drone
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.connect(master)
    for (const [f, d, v] of [[55, 0, 0.09], [82.41, 5, 0.06], [110, -4, 0.04], [164.8, 3, 0.02]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; const g = ctx.createGain(); g.gain.value = v; o.connect(g); g.connect(lp); o.start() }
    on = true
  }
  const tone = (f, dur = 0.12, type = 'sine', vol = 0.12, slide) => {
    if (!on || muted) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05)
  }
  let lastTick = 0
  return {
    start() { init(); if (ctx?.state === 'suspended') ctx.resume() },
    tick(f = 1200) { const n = performance.now(); if (n - lastTick < 45) return; lastTick = n; tone(f, 0.05, 'triangle', 0.05) },
    click() { tone(660, 0.09, 'triangle', 0.08); setTimeout(() => tone(990, 0.1, 'triangle', 0.06), 50) },
    whoosh() { tone(180, 0.7, 'sawtooth', 0.05, 1400); tone(90, 0.9, 'sine', 0.08, 300) },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => tone(f, 0.6, 'sine', 0.1), i * 110)) },
    get muted() { return muted },
    setMuted(m) { muted = m; try { localStorage.setItem('pl-muted', m ? '1' : '0') } catch (_) { /* ignore */ } if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05) },
  }
}
