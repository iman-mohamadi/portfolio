// Pure parametric-furniture logic (no rendering): shared by the Three.js scene and the Vue cut-list, so both always agree.
export const T = 1.8 // board thickness, cm
export const BACK = 0.6 // back-panel thickness, cm
export const KERF = 0.4 // saw-blade gap when nesting, cm
export const SHEET = { w: 244, h: 122 } // 8×4 ft sheet, cm
export const LIMITS = { w: [50, 150], h: [80, 200], d: [25, 60], shelves: [0, 6] }

/** Parts of a carcass cabinet. dims = [x, y, z] in cm, pos = centre relative to the floor-centre of the cabinet. */
export function parts({ w, h, d, shelves }) {
  const iw = w - 2 * T, list = []
  list.push({ name: 'Side', dims: [T, h, d], pos: [-(w / 2 - T / 2), h / 2, 0] }, { name: 'Side', dims: [T, h, d], pos: [w / 2 - T / 2, h / 2, 0] })
  list.push({ name: 'Top', dims: [iw, T, d], pos: [0, h - T / 2, 0] }, { name: 'Bottom', dims: [iw, T, d], pos: [0, T / 2, 0] })
  list.push({ name: 'Back', dims: [iw, h - 2 * T, BACK], pos: [0, h / 2, -d / 2 + BACK / 2] })
  const inner = h - 2 * T
  for (let k = 0; k < shelves; k++) list.push({ name: 'Shelf', dims: [iw, T, d - BACK], pos: [0, T + ((k + 1) * inner) / (shelves + 1), BACK / 2] })
  return list
}

/** Long / mid / thin dimension of a board and which local axis each one is. */
export function axes(dims) {
  const idx = [0, 1, 2].sort((a, b) => dims[b] - dims[a])
  return { L: idx[0], M: idx[1], Tn: idx[2], a: dims[idx[0]], b: dims[idx[1]], t: dims[idx[2]] }
}

/**
 * First-fit-decreasing shelf packing of every board's largest face onto standard 18 mm sheets.
 * The thin back panel is hardboard, so it gets its own sheet and does not count against plywood yield.
 */
export function nest(list) {
  const ply = list.map((p, i) => ({ i, ...axes(p.dims) })).filter((q) => q.t >= 1).sort((p, q) => q.a * q.b - p.a * p.b || q.a - p.a)
  const sheets = [], place = new Array(list.length)
  for (const it of ply) {
    let done = false
    for (let si = 0; si < sheets.length && !done; si++) {
      const s = sheets[si]
      for (const sh of s.shelves) if (sh.x + it.a <= SHEET.w && it.b <= sh.h) { place[it.i] = { sheet: si, x: sh.x, y: sh.y }; sh.x += it.a + KERF; done = true; break }
      if (!done && s.y + it.b <= SHEET.h) { const sh = { x: it.a + KERF, y: s.y, h: it.b + KERF }; s.shelves.push(sh); place[it.i] = { sheet: si, x: 0, y: s.y }; s.y += it.b + KERF; done = true }
    }
    if (!done) { sheets.push({ shelves: [{ x: it.a + KERF, y: 0, h: it.b + KERF }], y: it.b + KERF }); place[it.i] = { sheet: sheets.length - 1, x: 0, y: 0 } }
  }
  const plySheets = sheets.length
  let hard = 0
  list.forEach((p, i) => { const q = axes(p.dims); if (q.t < 1) { place[i] = { sheet: plySheets + hard, x: 0, y: 0, hardboard: true }; hard++ } })
  const used = ply.reduce((a, q) => a + q.a * q.b, 0)
  return { sheets: plySheets + hard, plySheets, hard, place, yield: plySheets ? used / (plySheets * SHEET.w * SHEET.h) : 0, area: used / 1e4 }
}

/** Grouped cut list rows for the UI. */
export function cutList(list) {
  const map = new Map()
  for (const p of list) { const q = axes(p.dims), key = `${p.name}|${q.a.toFixed(1)}×${q.b.toFixed(1)}×${q.t}`; const r = map.get(key) || { name: p.name, size: `${q.a.toFixed(1)} × ${q.b.toFixed(1)} × ${q.t}`, qty: 0 }; r.qty++; map.set(key, r) }
  return [...map.values()]
}
export const FINISHES = [
  { name: 'Oak', a: '#cfa96d', b: '#9b7440' }, { name: 'Walnut', a: '#6b4630', b: '#3a2416' }, { name: 'Ash', a: '#ece4d3', b: '#cdbfa4' }, { name: 'Charcoal', a: '#353a48', b: '#1b1e27' },
]
