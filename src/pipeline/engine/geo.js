// Pure geography + latency model (no rendering). Used by the globe and by the Vue panel so they always agree.
export const ORIGIN = { id: 'tehran', name: 'Tehran (origin)', lat: 35.69, lon: 51.39 }

/** Regions you can deploy an edge node to. */
export const REGIONS = [
  { id: 'fra', name: 'Frankfurt', lat: 50.11, lon: 8.68 }, { id: 'lon', name: 'London', lat: 51.51, lon: -0.13 },
  { id: 'ist', name: 'Istanbul', lat: 41.01, lon: 28.98 }, { id: 'dxb', name: 'Dubai', lat: 25.2, lon: 55.27 },
  { id: 'bom', name: 'Mumbai', lat: 19.08, lon: 72.88 }, { id: 'sin', name: 'Singapore', lat: 1.35, lon: 103.82 },
  { id: 'nrt', name: 'Tokyo', lat: 35.68, lon: 139.69 }, { id: 'syd', name: 'Sydney', lat: -33.87, lon: 151.21 },
  { id: 'jnb', name: 'Johannesburg', lat: -26.2, lon: 28.04 }, { id: 'gru', name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { id: 'iad', name: 'N. Virginia', lat: 38.95, lon: -77.45 }, { id: 'sfo', name: 'California', lat: 37.77, lon: -122.42 },
]

/** Where the visitors are. w = share of traffic. */
export const USERS = [
  { name: 'Tehran', lat: 35.69, lon: 51.39, w: 3 }, { name: 'Istanbul', lat: 41.01, lon: 28.98, w: 1.4 }, { name: 'Dubai', lat: 25.2, lon: 55.27, w: 1.6 },
  { name: 'London', lat: 51.51, lon: -0.13, w: 1.4 }, { name: 'Frankfurt', lat: 50.11, lon: 8.68, w: 1.4 }, { name: 'Cairo', lat: 30.04, lon: 31.24, w: 1 },
  { name: 'Lagos', lat: 6.52, lon: 3.38, w: 0.8 }, { name: 'Johannesburg', lat: -26.2, lon: 28.04, w: 0.8 }, { name: 'Mumbai', lat: 19.08, lon: 72.88, w: 1.4 },
  { name: 'Singapore', lat: 1.35, lon: 103.82, w: 1.1 }, { name: 'Tokyo', lat: 35.68, lon: 139.69, w: 1.2 }, { name: 'Sydney', lat: -33.87, lon: 151.21, w: 0.8 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63, w: 1 }, { name: 'New York', lat: 40.71, lon: -74.0, w: 1.4 }, { name: 'Los Angeles', lat: 34.05, lon: -118.24, w: 1 },
]

export const toRad = (d) => (d * Math.PI) / 180
export function km(a, b) {
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}
/** Round trip over fibre (~200 km/ms one way, +indirect routes) and the time-to-first-byte a visitor sees. */
export const rtt = (d) => d / 100 * 1.25 + 4
export const ttfb = (d, edge) => (edge ? 22 : 38) + 3 * rtt(d) // edge: cached HTML at the PoP; origin: renders + a long trip

/** Which server (origin or one of the nodes) serves a user, and the resulting TTFB. */
export function serve(user, nodes) {
  let best = { server: ORIGIN, d: km(user, ORIGIN), edge: false }, bt = ttfb(best.d, false)
  for (const n of nodes) { const d = km(user, n), t = ttfb(d, true); if (t < bt) { bt = t; best = { server: n, d, edge: true } } }
  return { ...best, ttfb: bt }
}
export function evaluate(nodes) {
  const rows = USERS.map((u) => ({ user: u, ...serve(u, nodes) }))
  const wsum = USERS.reduce((a, u) => a + u.w, 0)
  return { rows, mean: rows.reduce((a, r) => a + r.ttfb * r.user.w, 0) / wsum, p95: [...rows].sort((a, b) => a.ttfb - b.ttfb)[Math.floor(rows.length * 0.93)].ttfb }
}
/** Brute-force the best k regions (used for the target, the hint and the auto-play). */
export function best(k) {
  let top = { mean: Infinity, set: [] }
  const rec = (start, chosen) => {
    if (chosen.length === k) { const m = evaluate(chosen).mean; if (m < top.mean) top = { mean: m, set: [...chosen] }; return }
    for (let i = start; i < REGIONS.length; i++) rec(i + 1, [...chosen, REGIONS[i]])
  }
  rec(0, []); return top
}
