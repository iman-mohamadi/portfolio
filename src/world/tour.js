/**
 * Auto-tour route: visits every zone by following the real road network (BFS over intersections),
 * keeping to the right-hand lane. Waypoints with `dwell` stop for that many seconds so the info panel can be read.
 */
export function buildTourRoute(city, zones) {
  const by = (id) => zones.find((z) => z.id === id)
  const stops = [
    { z: by('home'), dwell: 11 }, { z: by('about'), dwell: 8 }, { z: by('skills'), dwell: 8 },
    ...zones.filter((z) => z.kind === 'project').map((z) => ({ z, dwell: 4.6 })),
    ...zones.filter((z) => z.kind === 'job').map((z) => ({ z, dwell: 6.5 })),
    { z: by('contact'), dwell: 10 },
  ]
  const at = (z) => (z.kind === 'project' || z.kind === 'job' ? z.pos : z.spawn || z.pos)
  const out = []; let cur = by('home').spawn
  const lane = (pts) => pts.map((p, i) => {
    const a = pts[i - 1] || p, b = pts[i + 1] || p, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1
    return [p[0] + (-dz / L) * 3, p[1] + (dx / L) * 3] // right of travel = (-dz, dx)
  })
  for (const s of stops) {
    const t = at(s.z), route = city.route(cur[0], cur[1], t[0], t[1])
    lane([[cur[0], cur[1]], ...route, t]).slice(1, -1).forEach((p) => out.push({ p }))
    out.push({ p: [t[0], t[1]], dwell: s.dwell }); cur = t
  }
  return out
}
