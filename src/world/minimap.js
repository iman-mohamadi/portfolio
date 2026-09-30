import { HALF } from './city.js'

/**
 * Architectural map of the city: hairline roads, quiet blocks, dashed district outlines and one pin per portfolio
 * location (hollow = not yet discovered, solid = discovered, amber = the current objective). The same renderer draws
 * the small HUD map and the large map in the menu.
 */
const PAPER = '242,239,232', ACCENT = '255,181,98', OK = '143,227,177', COOL = '157,184,255'

export function createMapRenderer({ city, districts, locations, games }) {
  const statics = new Map() // size|labels → canvas
  const pinsOf = (all) => (all ? [...locations.filter((l) => !l.hidden), ...games] : locations.filter((l) => !l.hidden))

  function paintStatic(size, labels) {
    const c = document.createElement('canvas'); c.width = c.height = size
    const x = c.getContext('2d'), pad = size * 0.05, k = (size - 2 * pad) / (2 * HALF), o = size / 2
    x.translate(o, o)
    // blocks
    for (const b of city.blocks) {
      const s = 34 * k, px = b.x * k - s / 2, pz = b.z * k - s / 2
      const fill = { P: `rgba(${OK},.09)`, D: `rgba(${PAPER},.13)`, X: `rgba(${COOL},.09)`, R: `rgba(${ACCENT},.06)` }[b.type] || `rgba(${PAPER},.06)`
      x.fillStyle = fill; x.fillRect(px, pz, s, s)
      if ('ALQZ'.includes(b.type)) { x.strokeStyle = `rgba(${PAPER},.25)`; x.lineWidth = Math.max(0.6, size / 600); x.strokeRect(px + s * 0.18, pz + s * 0.18, s * 0.64, s * 0.64) }
    }
    // roads
    x.strokeStyle = `rgba(${PAPER},.32)`; x.lineWidth = Math.max(1, 12 * k * 0.3); x.lineCap = 'butt'
    for (let a = 0; a < 9; a++) { const p = ((a * 4 - 16) * 12) * k; x.beginPath(); x.moveTo(p, -HALF * k); x.lineTo(p, HALF * k); x.stroke(); x.beginPath(); x.moveTo(-HALF * k, p); x.lineTo(HALF * k, p); x.stroke() }
    // district outlines
    x.setLineDash([size * 0.012, size * 0.01]); x.lineWidth = Math.max(0.7, size / 520); x.strokeStyle = `rgba(${ACCENT},.4)`
    x.font = `300 ${Math.round(size * 0.024)}px 'JetBrains Mono',monospace`; x.textBaseline = 'top'
    for (const d of districts) {
      if (d.shape[0] !== 'rect' || d.id === 'play') continue
      const [, x0, z0, x1, z1] = d.shape
      x.strokeRect(x0 * k, z0 * k, (x1 - x0) * k, (z1 - z0) * k)
      if (labels) { x.fillStyle = `rgba(${ACCENT},.85)`; x.fillText(d.name.replace(' District', '').toUpperCase(), x0 * k + 4, z0 * k + 4) }
    }
    x.setLineDash([])
    return c
  }

  /**
   * state: { car:{x,z,ang}, has(id), objectiveId, path:[[x,z]], hot, t, labels, games }
   */
  function draw(ctx, size, state) {
    const key = size + (state.labels ? 'L' : ''); let st = statics.get(key)
    if (!st) { st = paintStatic(size, state.labels); statics.set(key, st) }
    const pad = size * 0.05, k = (size - 2 * pad) / (2 * HALF), o = size / 2
    ctx.clearRect(0, 0, size, size); ctx.drawImage(st, 0, 0)
    ctx.save(); ctx.translate(o, o)
    if (state.path?.length > 1) {
      ctx.strokeStyle = `rgba(${ACCENT},.9)`; ctx.lineWidth = Math.max(1.2, size / 240); ctx.setLineDash([size * 0.018, size * 0.014]); ctx.lineDashOffset = -(state.t || 0) * size * 0.03
      ctx.beginPath(); state.path.forEach(([px, pz], i) => (i ? ctx.lineTo(px * k, pz * k) : ctx.moveTo(px * k, pz * k))); ctx.stroke(); ctx.setLineDash([])
    }
    const R = Math.max(2.6, size * 0.014), pulse = 0.5 + 0.5 * Math.sin((state.t || 0) * 3)
    ctx.font = `300 ${Math.round(size * 0.026)}px 'Inter Tight',sans-serif`; ctx.textBaseline = 'middle'
    for (const p of pinsOf(state.games)) {
      const px = p.pos[0] * k, pz = p.pos[1] * k, goal = p.id === state.objectiveId, seen = state.has(p.id), game = p.type === 'game'
      if (game) { ctx.strokeStyle = `rgba(${COOL},.75)`; ctx.lineWidth = Math.max(1, size / 400); ctx.beginPath(); ctx.moveTo(px, pz - R); ctx.lineTo(px + R, pz); ctx.lineTo(px, pz + R); ctx.lineTo(px - R, pz); ctx.closePath(); ctx.stroke() }
      else {
        if (goal) { ctx.strokeStyle = `rgba(${ACCENT},${0.75 - pulse * 0.5})`; ctx.lineWidth = Math.max(1.2, size / 300); ctx.beginPath(); ctx.arc(px, pz, R * (1.8 + pulse * 1.4), 0, 7); ctx.stroke() }
        ctx.beginPath(); ctx.arc(px, pz, goal ? R * 1.25 : R, 0, 7)
        if (goal) { ctx.fillStyle = `rgb(${ACCENT})`; ctx.fill() } else if (seen) { ctx.fillStyle = `rgb(${PAPER})`; ctx.fill() } else { ctx.strokeStyle = `rgba(${PAPER},.85)`; ctx.lineWidth = Math.max(1, size / 380); ctx.stroke() }
        if (state.hot === p.id) { ctx.strokeStyle = `rgb(${ACCENT})`; ctx.beginPath(); ctx.arc(px, pz, R * 2.3, 0, 7); ctx.stroke() }
      }
      if (state.labels && (p.type === 'project' || p.type === 'experience' || (game && state.games))) {
        const side = p.type === 'project' ? (p.side > 0 ? -1 : 1) : 0, up = p.type === 'experience' ? (p.index % 2 ? 1 : -1) : 0
        ctx.fillStyle = `rgba(${PAPER},${seen || goal ? 0.95 : 0.7})`
        ctx.textAlign = side < 0 ? 'right' : side === 0 ? 'center' : 'left'
        ctx.fillText(p.title, px + side * (R + 5), pz + (side === 0 ? up * (R + 9) : 0))
      }
    }
    // the car
    const c = state.car
    ctx.translate(c.x * k, c.z * k); ctx.rotate(-c.ang)
    const s = Math.max(4, size * 0.02)
    ctx.fillStyle = `rgb(${ACCENT})`; ctx.strokeStyle = 'rgba(7,9,12,.9)'; ctx.lineWidth = Math.max(1, size / 300)
    ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s, s); ctx.lineTo(0, s * 0.45); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.restore()
  }

  /** Nearest pin under a pixel of a `size` map (or null). */
  function hit(px, py, size, includeGames = false) {
    const pad = size * 0.05, k = (size - 2 * pad) / (2 * HALF), o = size / 2
    let best = null, bd = size * 0.03
    for (const p of pinsOf(includeGames)) { const d = Math.hypot(px - (o + p.pos[0] * k), py - (o + p.pos[1] * k)); if (d < bd) { bd = d; best = p } }
    return best
  }
  return { draw, hit, scale: (size) => (size - 2 * size * 0.05) / (2 * HALF) }
}
