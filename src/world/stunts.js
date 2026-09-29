import * as THREE from 'three'
import { dynamicInstances } from './kits.js'

/** Crash debris: real bumper / door / tyre / plate models from the car kit thrown out on a hit, bouncing on the tarmac and shrinking away. */
export function createDebris({ scene, kits, plainMat, perModel = 6 }) {
  const NAMES = ['car/debris-bumper', 'car/debris-door', 'car/debris-tire', 'car/debris-plate-a', 'car/debris-spoiler-a', 'car/debris-bolt']
  const groups = []
  for (const n of NAMES) { const model = kits.cars.get(n); if (!model) continue; const di = dynamicInstances(model, perModel, { material: plainMat }); di.use(perModel); di.meshes.forEach((m) => scene.add(m)); groups.push({ di, items: Array.from({ length: perModel }, () => ({ life: 0, x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, s: 1 })), head: 0 }) }
  return {
    burst(x, y, z, vx, vz, n = 5, s = 1.7) {
      for (let k = 0; k < n; k++) {
        const g = groups[Math.floor(Math.random() * groups.length)]; if (!g) return
        const it = g.items[g.head++ % g.items.length]
        Object.assign(it, { life: 2.6 + Math.random() * 1.2, x, y: y + 0.3, z, vx: vx * 0.5 + (Math.random() - 0.5) * 9, vy: 3 + Math.random() * 6, vz: vz * 0.5 + (Math.random() - 0.5) * 9, wx: (Math.random() - 0.5) * 14, wy: (Math.random() - 0.5) * 14, wz: (Math.random() - 0.5) * 14, s })
      }
    },
    update(dt) {
      for (const g of groups) {
        g.items.forEach((it, i) => {
          if (it.life <= 0) { g.di.set(i, 0, -20, 0, 0, 0); return }
          it.life -= dt; it.vy -= 22 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt
          if (it.y < 0.2) { it.y = 0.2; if (it.vy < -2) { it.vy *= -0.38; it.vx *= 0.7; it.vz *= 0.7; it.wx *= 0.6; it.wz *= 0.6 } else { it.vy = 0; it.vx *= 0.92; it.vz *= 0.92 } }
          it.rx += it.wx * dt; it.ry += it.wy * dt; it.rz += it.wz * dt
          g.di.set(i, it.x, it.y, it.z, it.ry, it.s * Math.min(1, it.life * 1.5), it.rx, it.rz)
        })
        g.di.commit()
      }
    },
  }
}

/** Scoring chain: drifts, jumps, flips, near-misses, smashes and rings stack into a multiplier; the chain banks as cash when it times out. */
export function createScore({ toast, onBank = () => {} }) {
  const el = { box: document.getElementById('combo'), pts: document.getElementById('comboPts'), lbl: document.getElementById('comboLbl'), bar: document.getElementById('comboBar'), cash: document.getElementById('cashN') }
  const KEEP = 2.6
  let cash = 0, bestChain = 0
  try { cash = +localStorage.getItem('im-cash') || 0; bestChain = +localStorage.getItem('im-chain') || 0 } catch (_) { /* private mode */ }
  const s = { chain: 0, timer: 0, kinds: new Set(), last: '', shown: -1 }
  const NAMES = { drift: 'DRIFT', air: 'AIR', flip: 'FLIP', roll: 'ROLL', near: 'NEAR MISS', smash: 'SMASH', ring: 'RING', speed: 'SPEED' }
  const mult = () => Math.min(6, Math.max(1, s.kinds.size))
  const paintCash = () => { if (el.cash) el.cash.textContent = cash.toLocaleString('en-US') }
  const save = () => { try { localStorage.setItem('im-cash', String(cash)); localStorage.setItem('im-chain', String(bestChain)) } catch (_) { /* ignore */ } }
  paintCash()
  function paint() {
    if (!el.box) return
    const on = s.chain > 0
    el.box.classList.toggle('is-on', on)
    if (!on) return
    const v = Math.round(s.chain)
    if (v !== s.shown) { s.shown = v; el.pts.textContent = v.toLocaleString('en-US') }
    el.lbl.textContent = [...s.kinds].map((k) => NAMES[k] || k).join(' · ') + (mult() > 1 ? `  ×${mult()}` : '')
    el.bar.style.transform = `scaleX(${Math.max(0, s.timer / KEEP)})`
  }
  return {
    get cash() { return cash }, get bestChain() { return bestChain }, get active() { return s.chain > 0 },
    /** Add points of a given kind (points are multiplied by the current combo). */
    add(kind, pts) {
      if (!s.kinds.has(kind)) s.kinds.add(kind)
      s.chain += pts * mult(); s.timer = KEEP; s.last = kind; paint()
    },
    /** Continuous source, e.g. a drift: points per second. */
    hold(kind, perSec, dt) { this.add(kind, perSec * dt) },
    bank() {
      if (s.chain <= 0) return 0
      const earned = Math.round(s.chain / 10); cash += earned
      const chain = Math.round(s.chain); let rec = false
      if (chain > bestChain) { bestChain = chain; rec = true }
      s.chain = 0; s.kinds.clear(); s.timer = 0; s.shown = -1; paint(); paintCash(); save()
      onBank(earned, chain, rec)
      return earned
    },
    /** A hard crash throws the chain away. */
    lose() { if (s.chain > 60) toast('Chain lost', 1100); s.chain = 0; s.kinds.clear(); s.timer = 0; s.shown = -1; paint() },
    spend(n) { if (cash < n) return false; cash -= n; paintCash(); save(); return true },
    give(n) { cash += n; paintCash(); save() },
    update(dt) { if (s.chain > 0) { s.timer -= dt; if (s.timer <= 0) this.bank(); else if (el.bar) el.bar.style.transform = `scaleX(${Math.max(0, s.timer / KEEP)})` } },
  }
}

/** Floating boost hoops over the jumps: fly through for a burst of speed, energy and points. */
export function createRings({ scene, list, isMobile }) {
  const N = list.length, R = 4.2
  const torus = new THREE.TorusGeometry(R, 0.24, 8, isMobile ? 28 : 44)
  const mat = new THREE.MeshBasicMaterial({ color: 0x7ee0ff, toneMapped: false })
  const ringMesh = new THREE.InstancedMesh(torus, mat, N)
  const disc = new THREE.InstancedMesh(new THREE.CircleGeometry(R - 0.2, 28), new THREE.MeshBasicMaterial({ color: 0x38c8ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), N)
  ringMesh.frustumCulled = disc.frustumCulled = false; scene.add(ringMesh, disc)
  const rings = list.map((r) => ({ ...r, cd: 0, flash: 0, prev: 0, sin: Math.sin(r.yaw), cos: Math.cos(r.yaw) }))
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color()
  return {
    rings,
    /** Call each frame with the car position (world) — returns the ring that was just flown through, if any. */
    update(car, dt, t, y) {
      let hit = null
      for (let i = 0; i < N; i++) {
        const r = rings[i]
        // car position in the ring's frame: local +z is the ring's normal
        const dx = car.x - r.x, dy = y - r.y, dz = car.z - r.z
        const lx = dx * r.cos - dz * r.sin, lz = dx * r.sin + dz * r.cos
        if (r.cd > 0) r.cd -= dt
        if (r.cd <= 0 && Math.abs(lz) < 6 && r.prev !== 0 && Math.sign(lz) !== Math.sign(r.prev) && Math.hypot(lx, dy) < R - 0.4) { r.cd = 1.2; r.flash = 1; hit = r }
        r.prev = Math.abs(lz) < 6 ? lz : 0
        r.flash = Math.max(0, r.flash - dt * 2.2)
        const k = 1 + r.flash * 0.25, spin = t * 0.6 + i
        e.set(0, r.yaw, 0); q.setFromEuler(e); p.set(r.x, r.y + Math.sin(spin) * 0.15, r.z); sc.set(k, k, k); m.compose(p, q, sc)
        ringMesh.setMatrixAt(i, m); disc.setMatrixAt(i, m)
        col.setRGB(0.3 + r.flash * 3, 0.85 + r.flash * 2, 1 + r.flash * 2); ringMesh.setColorAt(i, col)
      }
      ringMesh.instanceMatrix.needsUpdate = disc.instanceMatrix.needsUpdate = true
      if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true
      return hit
    },
  }
}
