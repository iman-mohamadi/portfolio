/**
 * Guided-tour route: visits every location by following the real road network (BFS over intersections),
 * keeping to the right-hand lane. Waypoints with `dwell` stop for that many seconds so the info panel can be read.
 */
export function buildTourRoute(city, locations) {
  const by = (id) => locations.find((z) => z.id === id)
  // the guided tour follows the journey: Meet Iman → Experience → Projects → 3D Lab → Get in touch
  const stops = [
    { z: by('home'), dwell: 3 }, { z: by('about'), dwell: 9 },
    ...locations.filter((z) => z.type === 'experience').map((z) => ({ z, dwell: 7 })),
    ...locations.filter((z) => z.type === 'project').map((z) => ({ z, dwell: 6 })),
    { z: by('lab'), dwell: 8 }, { z: by('contact'), dwell: 10 },
  ]
  const at = (z) => (z.type === 'project' || z.type === 'experience' ? z.pos : z.spawn || z.pos)
  const out = []; let cur = by('home').spawn
  const lane = (pts) => pts.map((p, i) => {
    const a = pts[i - 1] || p, b = pts[i + 1] || p, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1
    return [p[0] + (-dz / L) * 3, p[1] + (dx / L) * 3] // right of travel = (-dz, dx)
  })
  for (const s of stops) {
    const t = at(s.z), route = city.route(cur[0], cur[1], t[0], t[1])
    // the nearest intersection can lie past the stop (or behind the start): don't overshoot and double back
    const between = (a, b, p) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2, off = Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / Math.sqrt(L2); return u > 0 && u < 1 && off < 9 }
    if (route.length >= 2 && between(route[route.length - 2], route[route.length - 1], t)) route.pop()
    if (route.length >= 2 && between(route[0], route[1], cur)) route.shift()
    lane([[cur[0], cur[1]], ...route, t]).slice(1, -1).forEach((p) => out.push({ p }))
    out.push({ p: [t[0], t[1]], dwell: s.dwell }); cur = t
  }
  return out
}
