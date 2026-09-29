import * as THREE from 'three'
import { dynamicInstances } from './kits.js'
import { Driver, routeWaypoints } from './traffic.js'
import { tileX, tileZ } from './city.js'
import { seeded, clamp, damp, sprite, F_SERIF } from './helpers.js'

/** Pulsing beam + ground ring that marks a destination. */
export function createMarker(scene, color, { height = 70, radius = 4 } = {}) {
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.3, height, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.7, radius, 44), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }))
  ring.rotation.x = -Math.PI / 2; beam.position.y = height / 2
  const g = new THREE.Group(); g.add(beam, ring); g.visible = false; scene.add(g)
  return {
    g, x: 0, z: 0,
    set(x, z, y = 0.4) { g.position.set(x, y, z); this.x = x; this.z = z; g.visible = true },
    hide() { g.visible = false },
    update(t) { if (!g.visible) return; ring.scale.setScalar(1 + Math.sin(t * 4) * 0.07); beam.material.opacity = 0.22 + Math.sin(t * 3) * 0.05 },
  }
}

/** A permanent landmark for a game hub: glowing ring on the tarmac, tall thin beam and a floating name. */
export function createLandmark(scene, { x, z, label, sub, color = 0xff2d8a, radius = 7 }) {
  const g = new THREE.Group(); g.position.set(x, 0, z)
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.5, radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.32
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.31
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 42, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); beam.position.y = 21
  const tag = sprite(label, { size: 1.5, font: `italic 400 130px ${F_SERIF}`, accent: '#' + new THREE.Color(color).getHexString() }); tag.position.y = 13
  g.add(ring, disc, beam, tag)
  if (sub) { const s2 = sprite(sub, { size: 0.55, font: "300 92px 'JetBrains Mono', monospace", color: '#cfd6ff' }); s2.position.y = 10.2; g.add(s2) }
  scene.add(g)
  return { g, update(t) { ring.rotation.z = t * 0.5; tag.position.y = 13 + Math.sin(t * 1.6) * 0.3 } }
}

const fmt = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}` }
const PAYOUT = [600, 350, 200, 100]
const ORD = ['1st', '2nd', '3rd', '4th']

export function createModes(ctx) {
  const { scene, city, car, traffic, score, toast, audio, sparks, kits, plainMat } = ctx
  const rnd = seeded(2024)

  /* ============================================================ street race */
  // ring of avenues around the east half of the city; start line on the south straight, in front of the grandstands
  const RING = [[6, 7], [7, 7], [7, 6], [7, 5], [7, 4], [7, 3], [7, 2], [7, 1], [6, 1], [5, 1], [4, 1], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [4, 7], [5, 7]]
  const nodes = RING.map(([a, b]) => city.graph.at(a, b))
  const START = { x: (nodes[nodes.length - 1].x + nodes[0].x) / 2, z: nodes[0].z }
  const cps = [{ x: START.x, z: START.z }, ...nodes.map((n) => ({ x: n.x, z: n.z }))]
  const nCp = cps.length, LAPS = 3
  const segLen = cps.map((c, i) => Math.hypot(cps[(i + 1) % nCp].x - c.x, cps[(i + 1) % nCp].z - c.z))
  const RIVALS = [{ model: 'car/race-future', name: 'Nova', skill: 0.92, lane: 2.4, color: '#7ee0ff' }, { model: 'car/race', name: 'Vex', skill: 0.66, lane: -2.6, color: '#ffd27a' }, { model: 'car/sedan-sports', name: 'Rook', skill: 0.4, lane: 4.2, color: '#ff8fc0' }]
  const grid = [[-9, 3.2], [-9, -3.2], [-18, 3.2], [-18, -3.2]] // slot offsets from the start line (x back, z sideways); player takes slot 0
  const race = { on: false, phase: 'idle', cd: 0, t: 0, passed: 0, finished: false, finT: 0, rivals: [], beacons: [createMarker(scene, 0x7ee0ff), createMarker(scene, 0x3a8fb8, { height: 40, radius: 3 })], step: 0, pos: 1, best: 0 }
  try { race.best = +localStorage.getItem('im-race-best') || 0 } catch (_) { /* private mode */ }
  for (const rv of RIVALS) {
    const model = kits.cars.get(rv.model); if (!model) continue
    const di = dynamicInstances(model, 1, { material: plainMat }); di.use(0); di.meshes.forEach((m) => scene.add(m))
    race.rivals.push({ ...rv, di, W: routeWaypoints(nodes, true, rv.lane), wi: 0, d: new Driver(), passed: 0, fin: 0, prog: 0, base: 20 + rv.skill * 7.6 })
  }
  // start line: chequered banner across the road on two posts
  const banner = (() => {
    const g = new THREE.Group(); g.position.set(START.x, 0, START.z)
    const tex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d'); for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#fff' : '#111'; x.fillRect(i * 8, j * 8, 8, 8) } return c })()); tex.colorSpace = THREE.SRGBColorSpace
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 13.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); bar.position.set(0, 7.6, 0)
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x14141c, emissive: 0xff2d8a, emissiveIntensity: 0.8 })); post.position.set(0, 4.1, s * 6.8); g.add(post) }
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2, 12), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, toneMapped: false })); strip.rotation.x = -Math.PI / 2; strip.position.y = 0.34
    g.add(bar, strip); scene.add(g); return g
  })()

  function placeGrid() {
    const ang = -Math.PI / 2 // heading east
    ctx.placeCar(START.x + grid[0][0], START.z + grid[0][1], ang)
    race.rivals.forEach((r, i) => {
      const [gx, gz] = grid[i + 1]
      Object.assign(r.d, { x: START.x + gx, z: START.z + gz, ang, v: 0, wp: [] }); r.passed = 0; r.fin = 0; r.prog = 0
      r.d.wp.push(...r.W.slice(0, 5)); r.wi = 5
      r.di.use(1)
    })
  }
  function raceStart() {
    ctx.cancelOthers('race')
    traffic?.setActive(false)
    Object.assign(race, { on: true, phase: 'countdown', cd: 3.6, t: 0, passed: 0, finished: false, step: 0, pos: 1 })
    placeGrid(); ctx.chip(true); race.beacons[0].set(cps[0].x, cps[0].z); race.beacons[1].hide()
    ctx.track('race_start'); ctx.hideZonePanel()
  }
  function raceStop(msg) {
    if (!race.on) return
    race.on = false; race.phase = 'idle'; race.beacons.forEach((b) => b.hide()); race.rivals.forEach((r) => r.di.use(0)); traffic?.setActive(true); ctx.chip(false)
    if (msg) toast(msg, 2600)
  }
  const progOf = (passed, x, z) => { const i = passed % nCp, nxt = cps[i], L = Math.max(1, segLen[(i - 1 + nCp) % nCp]); return passed + clamp(1 - Math.hypot(nxt.x - x, nxt.z - z) / L, 0, 0.99) }
  function standings() {
    const rows = [{ name: 'You', prog: race.finished ? 1e6 - race.finT : progOf(race.passed, car.pos.x, car.pos.z), me: true }, ...race.rivals.map((r) => ({ name: r.name, prog: r.fin ? 1e6 - r.fin : r.prog, color: r.color }))]
    rows.sort((a, b) => b.prog - a.prog); return rows
  }
  function raceFinish() {
    race.finished = true; race.finT = race.t
    const rows = standings(), pos = rows.findIndex((r) => r.me), pay = PAYOUT[pos] ?? 100
    const newBest = !race.best || race.t < race.best
    if (newBest) { race.best = race.t; try { localStorage.setItem('im-race-best', String(race.t)) } catch (_) { /* ignore */ } }
    score.give(pay); audio.chime(8); ctx.track('race_finish', { pos: pos + 1, sec: Math.round(race.t) })
    for (let i = 0; i < 40; i++) sparks.emit(car.pos.x, 1.5, car.pos.z, (Math.random() - 0.5) * 16, 4 + Math.random() * 9, (Math.random() - 0.5) * 16, new THREE.Color().setHSL(Math.random(), 0.9, 0.6), 1.3)
    ctx.showPanel(`<span class="tag mono">Street Circuit · ${LAPS} laps</span><h3>${ORD[pos] || pos + 1 + 'th'} place</h3><p class="chips">${rows.map((r, i) => `<i class="mono">${i + 1}. ${r.name}</i>`).join('')}</p><p>Time <b>${fmt(race.t)}</b>${newBest ? ' — new personal best!' : race.best ? ` · best ${fmt(race.best)}` : ''}<br>Prize <b>$${pay}</b></p><div class="cta"><a class="btn primary mono" data-act="race" href="#">Race again</a></div>`)
    setTimeout(() => raceStop(), 400)
  }
  function updateRace(dt, t) {
    if (race.phase === 'countdown') {
      race.cd -= dt; const marks = [3.4, 2.6, 1.6, 0.6]
      while (race.step < 4 && race.cd <= marks[race.step]) { toast(race.step < 3 ? String(3 - race.step) : 'GO!', 700); audio.blip(); race.step++ }
      if (race.cd <= 0) race.phase = 'go'
    } else race.t += dt
    const go = race.phase === 'go'
    // player checkpoints
    if (go && !race.finished) {
      const c = cps[race.passed % nCp]
      if (Math.hypot(c.x - car.pos.x, c.z - car.pos.z) < 15 && car.y < 3) {
        race.passed++
        if ((race.passed - 1) % nCp === 0 && race.passed > 1) { const lap = (race.passed - 1) / nCp; if (lap < LAPS) toast(`Lap ${lap + 1}/${LAPS}`, 1400); audio.chime(lap * 2) } else if (race.passed > 1) audio.blip()
        if (race.passed >= 1 + LAPS * nCp) raceFinish()
      }
    }
    if (!race.on) return
    const nx = cps[race.passed % nCp], n2 = cps[(race.passed + 1) % nCp]
    if (!race.finished) { race.beacons[0].set(nx.x, nx.z); race.beacons[1].set(n2.x, n2.z) }
    race.beacons.forEach((b) => b.update(t))
    const myProg = progOf(race.passed, car.pos.x, car.pos.z)
    for (const r of race.rivals) {
      const d = r.d
      if (go) {
        while (d.wp.length < 6) d.wp.push(r.W[r.wi++ % r.W.length])
        const err = d.steer(dt, 3)
        let cap = 99, dist = 0, px = d.x, pz = d.z
        for (let k = 0; k < Math.min(6, d.wp.length); k++) { const w = d.wp[k]; dist += Math.hypot(w.x - px, w.z - pz); px = w.x; pz = w.z; if (w.turn) { cap = 9.5 + clamp(dist - 12, 0, 50) * 0.36; break } }
        let target = Math.min(r.base, cap) * (1 - clamp(Math.abs(err) / 1.2, 0, 0.5))
        const gap = r.prog - myProg; target *= gap > 1.3 ? 0.86 : gap < -1.6 ? 1.07 : 1
        // stay off the bumper of whoever is in front (player and other rivals)
        const fwx = -Math.sin(d.ang), fwz = -Math.cos(d.ang)
        const chk = (x, z) => { const rx = x - d.x, rz = z - d.z, f = rx * fwx + rz * fwz, l = rx * -fwz + rz * fwx; if (f > 0.5 && f < 10 && Math.abs(l) < 2.6) target = Math.min(target, Math.max(7, (f - 4) * 1.7 + 6)) }
        chk(car.pos.x, car.pos.z); for (const o of race.rivals) if (o !== r) chk(o.d.x, o.d.z)
        d.v += (target - d.v) * damp(dt, target < d.v ? 3.4 : 1.5)
        d.move(dt)
        const c = cps[r.passed % nCp]
        if (Math.hypot(c.x - d.x, c.z - d.z) < 16) { r.passed++; if (!r.fin && r.passed >= 1 + LAPS * nCp) r.fin = race.t }
        r.prog = progOf(r.passed, d.x, d.z)
        // rub against the player
        const dx = d.x - car.pos.x, dz = d.z - car.pos.z, m = 3.1, d2 = dx * dx + dz * dz
        if (d2 < m * m && d2 > 1e-4 && car.y < 1.4) {
          const dd = Math.sqrt(d2), nx2 = dx / dd, nz2 = dz / dd; d.x = car.pos.x + nx2 * m; d.z = car.pos.z + nz2 * m; d.v *= 0.93
          const rel = car.vel.x * nx2 + car.vel.y * nz2; if (rel > 0) { car.vel.x -= nx2 * rel * 0.5; car.vel.y -= nz2 * rel * 0.5; if (rel > 5) { audio.thud(); sparks.burst(d.x - nx2 * 1.4, 0.8, d.z - nz2 * 1.4, 0xffd27a, 8, 5) } }
        }
      }
      r.di.set(0, d.x, 0.1, d.z, d.ang + Math.PI, 1.72); r.di.commit()
    }
    const rows = standings(), pos = rows.findIndex((r) => r.me) + 1; race.pos = pos
    if (ctx.frame() % 3 === 0) {
      const lap = clamp(Math.floor((race.passed - 1) / nCp) + 1, 1, LAPS)
      ctx.chipHTML(race.phase === 'countdown' ? '<b>Street Circuit</b> get ready…' : `<b>P${pos}/${rows.length}</b> lap ${lap}/${LAPS} · ${fmt(race.t)} <span>${race.best ? '· best ' + fmt(race.best) : ''}</span>`)
    }
  }

  /* ============================================================ delivery rush */
  const del = { on: false, phase: 0, t: 0, done: 0, earned: 0, job: null, TOTAL: 5, best: 0, marker: createMarker(scene, 0xffd27a), pickMarker: createMarker(scene, 0x5cffb0), parcel: null }
  try { del.best = +localStorage.getItem('im-del-best') || 0 } catch (_) { /* ignore */ }
  const tiles = [...city.roadTiles].map((s) => s.split(',').map(Number))
  const spot = (near, minD, maxD) => {
    for (let k = 0; k < 400; k++) {
      const [i, j] = tiles[Math.floor(rnd() * tiles.length)], x = tileX(i) + (rnd() - 0.5) * 6, z = tileZ(j) + (rnd() - 0.5) * 6
      if (Math.abs(x) > 176 || Math.abs(z) > 176) continue
      const d = Math.hypot(x - near.x, z - near.z); if (d >= minD && d <= maxD) return { x, z }
    }
    return { x: near.x + 60, z: near.z }
  }
  del.parcel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 0.9 })); del.parcel.visible = false; scene.add(del.parcel)
  const pathLen = (a, b) => { const r = city.route(a.x, a.z, b.x, b.z); let L = Math.hypot(r[0][0] - a.x, r[0][1] - a.z); for (let i = 1; i < r.length; i++) L += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); return L + Math.hypot(b.x - r[r.length - 1][0], b.z - r[r.length - 1][1]) }
  function newJob() {
    const a = spot({ x: car.pos.x, z: car.pos.z }, 70, 170), b = spot(a, 150 + del.done * 12, 300)
    del.job = { a, b, limit: Math.round(pathLen(a, b) / 15.5 + 9) }
    del.phase = 0; del.t = del.job.limit
    del.pickMarker.set(a.x, a.z); del.marker.hide(); del.parcel.visible = false
    toast(`Job ${del.done + 1}/${del.TOTAL} — pick up the parcel`, 2200)
  }
  function delStart() {
    ctx.cancelOthers('delivery'); Object.assign(del, { on: true, done: 0, earned: 0 }); newJob(); ctx.chip(true); ctx.track('delivery_start'); ctx.hideZonePanel()
  }
  function delStop(msg) { if (!del.on) return; del.on = false; del.marker.hide(); del.pickMarker.hide(); del.parcel.visible = false; ctx.chip(false); if (msg) toast(msg, 3400) }
  function delEnd(success) {
    const cash = del.earned; if (cash > del.best) { del.best = cash; try { localStorage.setItem('im-del-best', String(cash)) } catch (_) { /* ignore */ } }
    score.give(success ? 150 : 0); audio.chime(success ? 9 : 1)
    ctx.showPanel(`<span class="tag mono">Delivery Rush</span><h3>${success ? 'Shift complete' : 'Out of time'}</h3><p>${del.done}/${del.TOTAL} parcels delivered · earned <b>$${(cash + (success ? 150 : 0)).toLocaleString('en-US')}</b>${success ? ' incl. $150 bonus' : ''}<br>Best shift $${del.best.toLocaleString('en-US')}</p><div class="cta"><a class="btn primary mono" data-act="delivery" href="#">Another shift</a></div>`)
    ctx.track('delivery_end', { done: del.done, cash }); delStop()
  }
  function updateDelivery(dt, t) {
    del.marker.update(t); del.pickMarker.update(t)
    const tgt = del.phase === 0 ? del.job.a : del.job.b
    const d = Math.hypot(tgt.x - car.pos.x, tgt.z - car.pos.z)
    if (del.phase === 0) {
      if (d < 7 && car.y < 3) { del.phase = 1; del.pickMarker.hide(); del.marker.set(del.job.b.x, del.job.b.z); del.parcel.visible = true; audio.chime(3); sparks.burst(tgt.x, 1.2, tgt.z, 0x5cffb0, 22, 8); toast(`Deliver it — ${del.job.limit}s`, 1800) }
    } else {
      del.t -= dt; del.parcel.position.set(car.pos.x, car.y + 1.55, car.pos.z); del.parcel.rotation.y += dt * 2
      if (d < 7 && car.y < 3) {
        const pay = 130 + Math.round(Math.max(0, del.t) * 7); del.done++; del.earned += pay; score.give(pay); audio.chime(6); sparks.burst(tgt.x, 1.2, tgt.z, 0xffd27a, 26, 9); toast(`+$${pay}  ·  ${del.done}/${del.TOTAL}`, 1600)
        if (del.done >= del.TOTAL) return delEnd(true)
        newJob(); return
      }
      if (del.t <= 0) return delEnd(false)
    }
    if (ctx.frame() % 3 === 0) ctx.chipHTML(del.phase === 0 ? `<b>Pick up</b> ${Math.round(d)} m <span>· job ${del.done + 1}/${del.TOTAL} · earned $${del.earned}</span>` : `<b>${Math.max(0, del.t).toFixed(0)}s</b> deliver · ${Math.round(d)} m <span>· job ${del.done + 1}/${del.TOTAL}</span>`)
  }

  /* ============================================================ shared */
  const landmarks = []
  return {
    race, del, START,
    startRace: raceStart, stopRace: raceStop, startDelivery: delStart, stopDelivery: delStop,
    get active() { return race.on ? 'race' : del.on ? 'delivery' : null },
    get locked() { return race.on && race.phase === 'countdown' },
    cancel(except) { if (except !== 'race') raceStop(); if (except !== 'delivery') delStop() },
    update(dt, t) {
      for (const l of landmarks) l.update(t)
      if (race.on) updateRace(dt, t)
      if (del.on) updateDelivery(dt, t)
    },
    addLandmark(opts) { const l = createLandmark(scene, opts); landmarks.push(l); return l },
    /** Current navigation target for the HUD arrow. */
    target() { if (race.on && race.phase === 'go' && !race.finished) { const c = cps[race.passed % nCp]; return { x: c.x, z: c.z } } if (del.on) return del.phase === 0 ? del.job.a : del.job.b; return null },
    /** Minimap overlay: (c, c) is the map centre and k the world→pixel scale. */
    overlay(mctx, c, k) {
      if (race.on) {
        mctx.strokeStyle = 'rgba(126,224,255,.75)'; mctx.lineWidth = 2.5; mctx.beginPath(); cps.slice(1).forEach((p, i) => (i ? mctx.lineTo(c + p.x * k, c + p.z * k) : mctx.moveTo(c + p.x * k, c + p.z * k))); mctx.closePath(); mctx.stroke()
        const nx = cps[race.passed % nCp]; mctx.fillStyle = '#7ee0ff'; mctx.beginPath(); mctx.arc(c + nx.x * k, c + nx.z * k, 5, 0, 7); mctx.fill()
        for (const r of race.rivals) { mctx.fillStyle = r.color; mctx.beginPath(); mctx.arc(c + r.d.x * k, c + r.d.z * k, 4, 0, 7); mctx.fill() }
      }
      if (del.on) { const t = del.phase === 0 ? del.job.a : del.job.b; mctx.fillStyle = del.phase === 0 ? '#5cffb0' : '#ffd27a'; mctx.beginPath(); mctx.arc(c + t.x * k, c + t.z * k, 6, 0, 7); mctx.fill(); mctx.strokeStyle = '#fff'; mctx.lineWidth = 2; mctx.stroke() }
    },
  }
}
