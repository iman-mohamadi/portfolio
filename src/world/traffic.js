import * as THREE from 'three'
import { dynamicInstances } from './kits.js'
import { seeded, clamp, damp } from './helpers.js'

/**
 * Cars that live on the city's road graph. `laneWaypoints` turns a sequence of intersections into right-hand-lane
 * waypoints with smooth corners; `Driver` follows them (used by both ambient traffic and the race rivals).
 */
export const LANE = 3.2
const norm = (dx, dz) => { const l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l] }

/** Waypoints for passing node `n` coming from `prev`, heading on to `next` (all {x,z}). */
export function passNode(prev, n, next) {
  const [ix, iz] = norm(n.x - prev.x, n.z - prev.z), [ox, oz] = norm(next.x - n.x, next.z - n.z)
  const rix = -iz, riz = ix, rox = -oz, roz = ox
  if (Math.abs(ix - ox) < 1e-3 && Math.abs(iz - oz) < 1e-3) return [{ x: n.x + rix * LANE, z: n.z + riz * LANE, turn: 0 }]
  const A = { x: n.x - ix * 9 + rix * LANE, z: n.z - iz * 9 + riz * LANE }, X = { x: n.x + rix * LANE + rox * LANE, z: n.z + riz * LANE + roz * LANE }, C = { x: n.x + ox * 9 + rox * LANE, z: n.z + oz * 9 + roz * LANE }
  const cross = ix * oz - iz * ox // sign tells left/right; magnitude is 1 for a perfect right angle
  const out = [{ ...A, turn: 1 }]
  for (const t of [0.25, 0.5, 0.75]) { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; out.push({ x: a * A.x + b * X.x + c * C.x, z: a * A.z + b * X.z + c * C.z, turn: 1, right: cross > 0 }) }
  out.push({ ...C, turn: 1 })
  return out
}
/** Waypoints for a whole node route (list of {x,z}); a U-turn at a dead end is not expected on circuits. */
export function routeWaypoints(nodes, loop = false) {
  const out = [], n = nodes.length
  for (let i = 0; i < n; i++) {
    const prev = nodes[(i - 1 + n) % n], cur = nodes[i], next = nodes[(i + 1) % n]
    if (!loop && (i === 0 || i === n - 1)) { out.push({ x: cur.x, z: cur.z, turn: 0 }); continue }
    out.push(...passNode(prev, cur, next))
  }
  return out
}

/** Pure-pursuit driver: steers at the next waypoint and returns the desired speed. */
export class Driver {
  constructor() { this.x = 0; this.z = 0; this.ang = 0; this.v = 0; this.wp = []; this.stuck = 0; this.ghost = 0 }
  steer(dt, turnRate = 2.6) {
    const w = this.wp[0]; if (!w) return 0
    const dx = w.x - this.x, dz = w.z - this.z
    let err = Math.atan2(-dx, -dz) - this.ang; err = Math.atan2(Math.sin(err), Math.cos(err))
    this.ang += clamp(err * 3, -1, 1) * turnRate * dt
    if (dx * dx + dz * dz < 20) this.wp.shift()
    return err
  }
  move(dt) { this.x += -Math.sin(this.ang) * this.v * dt; this.z += -Math.cos(this.ang) * this.v * dt }
}

const MODELS = [['car/sedan', 5], ['car/sedan-sports', 3], ['car/hatchback-sports', 3], ['car/suv', 3], ['car/suv-luxury', 2], ['car/taxi', 4], ['car/van', 3], ['car/truck', 2], ['car/delivery', 2], ['car/police', 1], ['car/ambulance', 1], ['car/garbage-truck', 1]]
const SCALE = 1.6, RADIUS = 1.55

export function createTraffic({ scene, kits, city, count, plainMat, seed = 31 }) {
  const rnd = seeded(seed), g = city.graph, N = g.N, blockedTiles = city.jumpTiles
  // ---- graph helpers ----
  const edgeBlocked = (a, b, a2, b2) => {
    const i0 = Math.min(a, a2) * 4, i1 = Math.max(a, a2) * 4, j0 = Math.min(b, b2) * 4, j1 = Math.max(b, b2) * 4
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (blockedTiles.has(i + ',' + j)) return true
    return false
  }
  const nbrs = (n) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => g.nodes[n.b + dz]?.[n.a + dx]).filter((m) => m && !edgeBlocked(n.a, n.b, m.a, m.b))
  // the tight roundabout / centre tile never blocks cars; the map's outer ring is closed off by the boundary (dead ends turn around)

  // ---- instanced rendering: one dynamic mesh per model ----
  const pickModel = () => { let t = rnd() * MODELS.reduce((s, m) => s + m[1], 0); for (const [n, w] of MODELS) { t -= w; if (t <= 0) return n } return MODELS[0][0] }
  const agents = [], groups = new Map()
  for (let i = 0; i < count; i++) {
    const name = pickModel(), model = kits.cars.get(name); if (!model) continue
    let grp = groups.get(name); if (!grp) groups.set(name, (grp = { model, agents: [] }))
    const a = new Driver(); Object.assign(a, { id: i, name, cruise: 8.5 + rnd() * 5.5, hit: 0, vx: 0, vz: 0, spin: 0, nm: 0, from: null, to: null, r: RADIUS, grp, slot: grp.agents.length })
    grp.agents.push(a); agents.push(a)
  }
  for (const grp of groups.values()) { grp.di = dynamicInstances(grp.model, grp.agents.length, { material: plainMat }); grp.di.use(grp.agents.length); grp.di.meshes.forEach((m) => scene.add(m)) }

  // ---- lights: head / tail glow points ----
  const lp = new Float32Array(agents.length * 4 * 3), lc = new Float32Array(agents.length * 4 * 3)
  for (let i = 0; i < agents.length; i++) { for (let k = 0; k < 4; k++) { const o = (i * 4 + k) * 3; if (k < 2) { lc[o] = 1; lc[o + 1] = 0.92; lc[o + 2] = 0.75 } else { lc[o] = 1; lc[o + 1] = 0.12; lc[o + 2] = 0.1 } } }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3))
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c) })()
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ size: 1.9, map: glowTex, vertexColors: true, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  lights.frustumCulled = false; scene.add(lights)

  // ---- placing & routing ----
  function extend(a) {
    while (a.wp.length < 7) {
      const opts = nbrs(a.to).filter((m) => m !== a.from), next = opts.length ? opts[Math.floor(rnd() * opts.length)] : a.from
      // slight preference to keep going straight
      const straight = opts.find((m) => Math.abs((m.x - a.to.x) - (a.to.x - a.from.x)) < 1 && Math.abs((m.z - a.to.z) - (a.to.z - a.from.z)) < 1)
      const pick = straight && rnd() < 0.55 ? straight : next
      a.wp.push(...passNode(a.from, a.to, pick)); a.from = a.to; a.to = pick
    }
  }
  function place(a, cx, cz, minD, maxD) {
    for (let tries = 0; tries < 40; tries++) {
      const n = g.nodes[Math.floor(rnd() * N)][Math.floor(rnd() * N)], o = nbrs(n); if (!o.length) continue
      const m = o[Math.floor(rnd() * o.length)], t = 0.12 + rnd() * 0.7, [dx, dz] = norm(m.x - n.x, m.z - n.z)
      const x = n.x + (m.x - n.x) * t - dz * LANE, z = n.z + (m.z - n.z) * t + dx * LANE
      const d = Math.hypot(x - cx, z - cz); if (d < minD || d > maxD) continue
      Object.assign(a, { x, z, ang: Math.atan2(-dx, -dz), v: a.cruise * 0.8, from: n, to: m, wp: [], hit: 0, vx: 0, vz: 0, ghost: 0, stuck: 0 })
      extend(a); return true
    }
    return false
  }
  return {
    agents, RADIUS,
    /** Scatter the initial fleet around a point. */
    init(cx, cz) { for (const a of agents) { if (!place(a, cx, cz, 30, 260)) place(a, cx, cz, 0, 1e9) } },
    /** Ambient traffic step. `car` is the player ({pos,vel,speed,y,radius}); `fx` hooks: { onHit(agent, nx, nz, rel), onNear(agent) }. */
    update(dt, car, night, fx) {
      const cars = agents
      for (const a of cars) {
        const fwx = -Math.sin(a.ang), fwz = -Math.cos(a.ang)
        if (a.hit > 0) { // knocked about by the player: coast, spin, then rejoin the network
          a.hit -= dt; a.vx *= Math.exp(-2 * dt); a.vz *= Math.exp(-2 * dt); a.x += a.vx * dt; a.z += a.vz * dt; a.ang += a.spin * dt; a.spin *= Math.exp(-1.6 * dt)
          if (a.hit <= 0) { relink(a) }
          continue
        }
        // steering
        const err = a.steer(dt)
        // obstacle ahead: other cars and the player
        let front = 1e9
        if (a.ghost <= 0) {
          for (const b of cars) {
            if (b === a || b.hit > 0) continue
            const rx = b.x - a.x, rz = b.z - a.z; if (rx * rx + rz * rz > 400) continue
            const f = rx * fwx + rz * fwz, l = rx * -fwz + rz * fwx
            if (f > 0.5 && f < 15 && Math.abs(l) < 2.7) front = Math.min(front, f)
          }
          const rx = car.pos.x - a.x, rz = car.pos.z - a.z, f = rx * fwx + rz * fwz, l = rx * -fwz + rz * fwx
          if (car.y < 1.5 && f > 0.5 && f < 17 && Math.abs(l) < 2.9) front = Math.min(front, f)
        }
        const corner = 1 - clamp(Math.abs(err) / 1.1, 0, 0.62)
        const target = Math.min(a.cruise * corner, front < 1e8 ? Math.max(0, (front - 6) * 1.1) : 99)
        a.v += (target - a.v) * damp(dt, target < a.v ? 3.2 : 1.1)
        a.move(dt)
        if (a.v < 0.4) { a.stuck += dt; if (a.stuck > 2.6) { a.ghost = 2.4; a.stuck = 0 } } else a.stuck = 0
        if (a.ghost > 0) a.ghost -= dt
        if (a.wp.length < 4) extend(a)
        // far away → respawn ahead of the player, out of sight
        const dx = a.x - car.pos.x, dz = a.z - car.pos.z
        if (dx * dx + dz * dz > 300 * 300) { place(a, car.pos.x, car.pos.z, 110, 240) }
        // contact with the player
        if (car.y < 1.6) {
          const d2 = (a.x - car.pos.x) ** 2 + (a.z - car.pos.z) ** 2, m = a.r + car.radius
          if (d2 < m * m && d2 > 1e-4) {
            const d = Math.sqrt(d2), nx = (a.x - car.pos.x) / d, nz = (a.z - car.pos.z) / d, rel = car.vel.x * nx + car.vel.y * nz
            a.x = car.pos.x + nx * m; a.z = car.pos.z + nz * m
            const push = Math.max(rel, 3)
            a.hit = 1.5; a.vx = nx * push * 1.15 + fwx * a.v * 0.4; a.vz = nz * push * 1.15 + fwz * a.v * 0.4; a.spin = (Math.random() - 0.5) * 6; a.v = 0
            car.vel.x -= nx * Math.max(rel, 0) * 0.22; car.vel.y -= nz * Math.max(rel, 0) * 0.22
            fx?.onHit(a, nx, nz, rel)
          } else if (a.nm <= 0 && d2 < 4.2 * 4.2 && Math.abs(car.speed) > 14) { a.nm = 3; fx?.onNear(a) }
        }
        if (a.nm > 0) a.nm -= dt
      }
      // write matrices
      for (const grp of groups.values()) { for (const a of grp.agents) grp.di.set(a.slot, a.x, 0.1, a.z, a.ang + Math.PI, SCALE); grp.di.commit() }
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i], f = [-Math.sin(a.ang), -Math.cos(a.ang)], r = [-f[1], f[0]]
        const o = i * 12
        lp[o] = a.x + f[0] * 2.3 + r[0] * 0.85; lp[o + 1] = 0.75; lp[o + 2] = a.z + f[1] * 2.3 + r[1] * 0.85
        lp[o + 3] = a.x + f[0] * 2.3 - r[0] * 0.85; lp[o + 4] = 0.75; lp[o + 5] = a.z + f[1] * 2.3 - r[1] * 0.85
        lp[o + 6] = a.x - f[0] * 2.1 + r[0] * 0.85; lp[o + 7] = 0.8; lp[o + 8] = a.z - f[1] * 2.1 + r[1] * 0.85
        lp[o + 9] = a.x - f[0] * 2.1 - r[0] * 0.85; lp[o + 10] = 0.8; lp[o + 11] = a.z - f[1] * 2.1 - r[1] * 0.85
      }
      lg.attributes.position.needsUpdate = true; lights.material.opacity = 0.22 + night * 0.75
    },
  }
  /** After a collision, snap back onto the nearest road segment heading roughly the way the car faces. */
  function relink(a) {
    const n = city.nearestNode(a.x, a.z), o = nbrs(n); if (!o.length) return
    const fwx = -Math.sin(a.ang), fwz = -Math.cos(a.ang)
    let best = o[0], bs = -2; for (const m of o) { const [dx, dz] = norm(m.x - n.x, m.z - n.z), s = dx * fwx + dz * fwz; if (s > bs) { bs = s; best = m } }
    const [dx, dz] = norm(best.x - n.x, best.z - n.z), rx = -dz, rz = dx
    // project onto that lane
    const t = clamp(((a.x - n.x) * dx + (a.z - n.z) * dz) / Math.hypot(best.x - n.x, best.z - n.z), 0.08, 0.9)
    a.x = n.x + (best.x - n.x) * t + rx * LANE; a.z = n.z + (best.z - n.z) * t + rz * LANE; a.ang = Math.atan2(-dx, -dz); a.v = 4; a.from = n; a.to = best; a.wp = []; extend(a)
  }
}
