import * as THREE from 'three'
import { clamp } from './helpers.js'

/**
 * Rigid-body driving physics (Rapier, WASM).
 *
 * The car is one dynamic body with a box collider. Four suspension rays against the static world (ground, ramp wedges,
 * plateaus, buildings) give spring + damper forces, and each tyre applies longitudinal drive / braking and lateral grip
 * inside a friction circle, so power-oversteer, handbrake drifts, weight transfer, ramps and flips all come from the
 * simulation instead of being scripted. `car` (pos / vel / ang / speed / air) is kept in sync for every other system.
 */
const GRAV = 21, MASS = 1000, REST = 0.42, WHEEL_R = 0.34, COMP0 = 0.17, SPRING = (MASS * GRAV / 4) / COMP0
const DAMP = 2 * Math.sqrt(SPRING * MASS / 4) * 0.62
export const RIDE = REST - COMP0 + WHEEL_R // body centre → ground at rest

const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion()
const V = { fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), a: new THREE.Vector3(), n: new THREE.Vector3(), wf: new THREE.Vector3(), wr: new THREE.Vector3(), w: new THREE.Vector3(), t: new THREE.Vector3() }

export async function createPhysics({ grid, city, car, half, tile }) {
  const RAPIER = (await import('@dimforge/rapier3d-compat')).default
  await RAPIER.init()
  const world = new RAPIER.World({ x: 0, y: -GRAV, z: 0 })
  const events = new RAPIER.EventQueue(true)
  const BASE = city.BASE

  /* ---- static world ---- */
  const wall = (x, y, z, hx, hy, hz) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0))
  world.createCollider(RAPIER.ColliderDesc.cuboid(900, 5, 900).setTranslation(0, BASE - 5, 0).setFriction(1)) // ground: top face at the tarmac height the city uses
  const lim = half - 3
  wall(lim + 3, 20, 0, 3, 20, half + 8); wall(-lim - 3, 20, 0, 3, 20, half + 8); wall(0, 20, lim + 3, half + 8, 20, 3); wall(0, 20, -lim - 3, half + 8, 20, 3)

  const built = new Set()
  /** Colliders for every circle / box the spatial grid knows about (call again after late additions). */
  function syncStatics() {
    let n = 0
    for (const list of grid.map.values()) for (const s of list) {
      if (built.has(s)) continue
      built.add(s); n++
      if (s.kind === 'c') { const h = Math.min(s.h ?? 7, 30); world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, s.r).setTranslation(s.x, h / 2, s.z).setFriction(0).setRestitution(0.1)) }
      else { const h = Math.min(s.h ?? 99, 60); world.createCollider(RAPIER.ColliderDesc.cuboid(s.hx, h / 2, s.hz).setTranslation(s.x, h / 2, s.z).setFriction(0).setRestitution(0.1)) }
    }
    return n
  }
  // ramps are wedges that match the analytic height field; plateaus are boxes
  const T2 = tile / 2
  for (const p of city.pieces.values()) {
    if (p.flat) { const h = p.top - (BASE - 0.4); world.createCollider(RAPIER.ColliderDesc.cuboid(T2, h / 2, T2).setTranslation(p.x, BASE - 0.4 + h / 2, p.z).setFriction(1)); continue }
    const pts = []
    for (const lx of [-T2, T2]) for (const lz of [-T2, T2]) {
      const x = p.x + lx * p.c + lz * p.s, z = p.z - lx * p.s + lz * p.c, u = lx / tile + 0.5
      pts.push(x, BASE - 0.4, z, x, Math.max(BASE, 0.24 + (p.top - 0.24) * u), z)
    }
    const d = RAPIER.ColliderDesc.convexHull(new Float32Array(pts)); if (d) world.createCollider(d.setFriction(1))
  }

  /* ---- the car ---- */
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, BASE + RIDE + 0.2, 28).setLinearDamping(0).setAngularDamping(0.5).setCanSleep(false).setCcdEnabled(true))
  let shapeKey = '', chassis = null
  function buildChassis() {
    const hx = Math.max(0.7, car.track * 1.05), hz = Math.max(1.3, car.radius * 1.2), key = hx.toFixed(2) + hz.toFixed(2)
    if (key === shapeKey) return
    shapeKey = key; if (chassis) world.removeCollider(chassis, false)
    chassis = world.createCollider(RAPIER.ColliderDesc.roundCuboid(hx - 0.14, 0.2, hz - 0.14, 0.14).setMass(MASS).setFriction(0).setRestitution(0.12).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(MASS * 14), body)
  }
  buildChassis()

  const wheels = [0, 1, 2, 3].map((i) => ({ front: i < 2, side: i % 2 ? 1 : -1, ground: false, comp: 0, steer: 0, load: 0 }))
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
  const st = { grounded: 0, airT: 0, wasAir: false, lastVy: 0, flipT: 0, up: 1, impact: 0, impactN: { x: 0, z: 0 }, lat: 0, slide: 0 }
  let prevVx = 0, prevVz = 0

  function applyInput(q, lv) { // other systems (pads, rings, traffic, ramps) nudge car.vel: push the difference into the body
    const dx = car.vel.x - prevVx, dz = car.vel.y - prevVz
    if (dx * dx + dz * dz > 1e-6) body.setLinvel({ x: lv.x + dx, y: lv.y, z: lv.z + dz }, true)
  }

  function substep(h, inp, ctx) {
    const tr = body.translation(), qr = body.rotation(), lv = body.linvel()
    _q.set(qr.x, qr.y, qr.z, qr.w)
    V.fwd.set(0, 0, -1).applyQuaternion(_q); V.right.set(1, 0, 0).applyQuaternion(_q); V.up.set(0, 1, 0).applyQuaternion(_q)
    const st0 = car.stats, hz = Math.max(1.3, car.radius * 1.2), hx = Math.max(0.7, car.track * 1.05)
    const vF = lv.x * V.fwd.x + lv.y * V.fwd.y + lv.z * V.fwd.z
    const sp = Math.hypot(lv.x, lv.z), maxS = st0.max * 1.12 * (1 + ctx.boost * 0.55)
    const steerMax = (0.58 - 0.4 * clamp(Math.abs(vF) / st0.max, 0, 1)) * (st0.turn / 2.15) * (inp.drift ? 1.35 : 1)
    const steer = ctx.turn * steerMax
    const mu = 1.5 * (1 - clamp(ctx.wet, 0, 1) * 0.2)
    const mw = MASS / 4
    let grounded = 0, latSum = 0

    wheels.forEach((w, i) => {
      V.a.set(w.side * hx, 0, w.front ? -hz * 0.78 : hz * 0.82).applyQuaternion(_q).add(tr) // suspension top, world
      ray.origin.x = V.a.x; ray.origin.y = V.a.y; ray.origin.z = V.a.z; ray.dir.x = -V.up.x; ray.dir.y = -V.up.y; ray.dir.z = -V.up.z
      const hit = world.castRayAndGetNormal(ray, REST + WHEEL_R, true, undefined, undefined, undefined, body)
      if (!hit) { w.ground = false; w.skid = 0; w.comp = Math.max(0, w.comp - 4 * h); w.load = 0; return }
      w.ground = true; grounded++
      const comp = REST + WHEEL_R - hit.timeOfImpact; w.comp = comp
      V.n.set(hit.normal.x, hit.normal.y, hit.normal.z)
      V.t.copy(V.a).addScaledVector(V.up, -hit.timeOfImpact) // contact point
      const v = body.velocityAtPoint(V.t)
      const vUp = v.x * V.up.x + v.y * V.up.y + v.z * V.up.z
      const load = Math.max(0, SPRING * comp - DAMP * vUp); w.load = load
      body.applyImpulseAtPoint({ x: V.up.x * load * h, y: V.up.y * load * h, z: V.up.z * load * h }, V.a, true)

      // tyre axes on the ground plane (front wheels steered)
      const sd = w.front ? steer : 0, cs = Math.cos(sd), sn = Math.sin(sd); w.steer = sd
      V.wf.copy(V.fwd).multiplyScalar(cs).addScaledVector(V.right, sn); V.wr.copy(V.right).multiplyScalar(cs).addScaledVector(V.fwd, -sn)
      V.wf.addScaledVector(V.n, -V.wf.dot(V.n)).normalize(); V.wr.addScaledVector(V.n, -V.wr.dot(V.n)).normalize()
      const vf = v.x * V.wf.x + v.y * V.wf.y + v.z * V.wf.z, vr = v.x * V.wr.x + v.y * V.wr.y + v.z * V.wr.z

      // longitudinal: rear-wheel drive, brakes, engine braking
      let Fx = 0
      if (!w.front || st0.awd) {
        const k = w.front ? 0.5 : 1, ratio = clamp(Math.abs(vF) / maxS, 0, 1.2)
        if (inp.f > 0) Fx = st0.acc * MASS / (st0.awd ? 4 : 2) * k * (1 + ctx.boost * 0.9) * clamp(1 - ratio * ratio, 0, 1) * inp.f
        else if (inp.f < 0) Fx = vF > 1 ? -st0.acc * MASS / 2 * 1.4 : st0.acc * MASS / 2 * 0.66 * clamp(1 - Math.abs(vF) / (maxS * 0.45), 0, 1) * inp.f
      }
      if (inp.f === 0) Fx -= vf * mw * 1.6 // engine braking / rolling resistance
      else Fx -= vf * mw * 0.35
      if (inp.drift && !w.front) Fx -= vf * mw * 0.15

      // lateral grip (the handbrake lets the rear go)
      const rate = st0.grip * (w.front ? (inp.drift ? 0.8 : 1) : (inp.drift ? 0.3 : 1))
      let Fy = -vr * mw * rate
      const cap = mu * load * (!w.front && inp.drift ? 0.42 : 1)
      const mag = Math.hypot(Fx, Fy)
      // skid intensity for tyre marks: sideways slip, wheelspin at launch, locked-up braking
      w.skid = Math.max(clamp((Math.abs(vr) - 2.6) / 5, 0, 1), Fx > 0 && mag > cap * 1.08 ? clamp((1 - Math.abs(vF) / 14), 0, 1) * 0.8 : 0, Fx < 0 && vF > 6 && mag > cap * 1.05 ? 0.7 : 0)
      w.cx = V.t.x; w.cy = V.t.y; w.cz = V.t.z
      if (mag > cap && mag > 1e-6) { const s = cap / mag; Fx *= s; Fy *= s }
      Fy = clamp(Fy, -Math.abs(vr) * mw / h, Math.abs(vr) * mw / h) // never overshoot zero slip in one step
      latSum += vr

      body.applyImpulseAtPoint({ x: (V.wf.x * Fx + V.wr.x * Fy) * h, y: (V.wf.y * Fx + V.wr.y * Fy) * h, z: (V.wf.z * Fx + V.wr.z * Fy) * h }, V.a, true)
    })
    // over the speed limit: bleed it off
    if (sp > maxS && grounded) { const k = Math.exp(-(sp - maxS) * 0.4 * h); const l = body.linvel(); body.setLinvel({ x: l.x * k, y: l.y, z: l.z * k }, true) }
    st.grounded = grounded; st.lat = latSum / 4

    // attitude: gentle self-righting on the ground, arcade air control in the air
    _qi.copy(_q).invert(); const av = body.angvel() // read after the tyre impulses
    V.w.set(av.x, av.y, av.z).applyQuaternion(_qi) // local angular velocity: x = pitch (nose up +), y = yaw, z = roll
    if (grounded >= 2) {
      V.t.crossVectors(V.up, V.a.set(0, 1, 0)) // axis that rotates up toward world up
      const k = 5200 * h * clamp(1 - V.up.y * 0.3, 0.5, 1); body.applyTorqueImpulse({ x: V.t.x * k, y: V.t.y * k, z: V.t.z * k }, true)
      V.w.y *= Math.exp(-(inp.drift ? 1.6 : 0.6) * h); if (inp.drift) V.w.y = clamp(V.w.y, -1.9, 1.9); V.w.x *= Math.exp(-2.2 * h); V.w.z *= Math.exp(-2.2 * h)
      body.setAngvel(V.t.copy(V.w).applyQuaternion(_q), true)
    } else if (st.airT > 0.2) {
      const kk = 1 - Math.exp(-7 * h)
      V.w.x += (-inp.f * 3.7 - V.w.x) * kk; V.w.z += (-ctx.turn * 4.6 - V.w.z) * kk; V.w.y *= Math.exp(-1 * h)
      body.setAngvel(V.t.copy(V.w).applyQuaternion(_q), true)
    }
    st.up = V.up.y
  }

  /* ---- loose props (crates, cones): real dynamic bodies the car can plough through, stack and send flying ---- */
  const props = []
  /** size / center are the model's bounding box (already scaled); the body sits at the box centre, the renderer subtracts `center`. */
  function addProp({ x, z, ry = 0, shape = 'box', size, center, mass = 30 }) {
    const hy = size[1] / 2; _q.setFromAxisAngle(V.a.set(0, 1, 0), ry); V.t.set(center[0], center[1], center[2]).applyQuaternion(_q)
    const bd = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x + V.t.x, BASE + V.t.y + 0.02, z + V.t.z).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }).setLinearDamping(0.25).setAngularDamping(0.5))
    const cd = shape === 'cone' ? RAPIER.ColliderDesc.cone(hy * 0.97, Math.max(size[0], size[2]) / 2 * 0.9) : RAPIER.ColliderDesc.cuboid(size[0] / 2 * 0.95, hy * 0.97, size[2] / 2 * 0.95)
    world.createCollider(cd.setMass(mass).setFriction(0.7).setRestitution(0.3), bd)
    const p = { body: bd, center }; props.push(p); return p
  }

  const acc = { dt: 0 }
  /** Advance the car. dt is the (possibly slowed) frame time; the world is stepped in fixed slices. */
  function step(dt, inp, ctx) {
    buildChassis()
    const q = body.rotation(), lv0 = body.linvel(); applyInput(q, lv0)
    const n = clamp(Math.ceil(dt / (1 / 100)), 1, 5), h = dt / n
    world.timestep = h
    st.impact = 0
    for (let i = 0; i < n; i++) {
      substep(h, inp, ctx)
      world.step(events)
      events.drainContactForceEvents((e) => { const m = e.totalForceMagnitude() * h / MASS; if (m > st.impact) { st.impact = m; const d = e.maxForceDirection(); const L = Math.hypot(d.x, d.z) || 1; st.impactN.x = d.x / L; st.impactN.z = d.z / L } })
    }
    // grounded bookkeeping
    if (st.grounded === 0) { st.airT += dt; st.lastVy = body.linvel().y } else st.airT = 0
    // flipped over and stopped: put it back on its wheels
    const l = body.linvel()
    if (st.up < 0.35 && Math.hypot(l.x, l.z) < 3) st.flipT += dt; else st.flipT = 0
    if (st.flipT > 1.4) { const p = body.translation(), f = V.fwd; teleport(p.x, p.z, Math.atan2(-f.x, -f.z), p.y + 1.2); st.flipT = 0 }
    // publish
    const p = body.translation(), r = body.rotation(), lv = body.linvel()
    return { p, r, lv, airborne: st.airT > 0.1 }
  }
  function publish(lv) { prevVx = lv.x; prevVz = lv.z }
  function teleport(x, z, ang, y = BASE + RIDE + 0.12) {
    _q.setFromAxisAngle(V.a.set(0, 1, 0), ang)
    body.setTranslation({ x, y, z }, true); body.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); prevVx = prevVz = 0; st.airT = 0; st.flipT = 0
  }
  teleport(0, 28, 0)
  return { world, body, wheels, state: st, step, publish, teleport, syncStatics, addProp, props, COMP0, RIDE, WHEEL_R, REST, get bodies() { return world.bodies.len() }, get colliders() { return world.colliders.len() } }
}
