import * as THREE from 'three'
import { createMarker } from './modes.js'
import { canvasTex } from './helpers.js'

const ACCENT = 0xffb562

/**
 * World-space guidance for the current objective: a soft beam + ground ring at the destination and a chevron ribbon
 * that follows the roads from the car. Drawn with restraint — it is a hint, not a highway sign.
 */
export function createGuidance({ scene, city, max = 40 }) {
  const marker = createMarker(scene, ACCENT, { height: 55, radius: 5 })
  const tex = canvasTex(64, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round'
    x.beginPath(); x.moveTo(12, 78); x.lineTo(32, 46); x.lineTo(52, 78); x.stroke()
  })
  tex.wrapT = THREE.RepeatWrapping
  const positions = new Float32Array(max * 2 * 3), uvs = new Float32Array(max * 2 * 2)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage))
  const idx = []; for (let i = 0; i < max - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  geo.setIndex(idx); geo.setDrawRange(0, 0)
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: ACCENT, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const ribbon = new THREE.Mesh(geo, mat); ribbon.frustumCulled = false; ribbon.renderOrder = 3; ribbon.visible = false; scene.add(ribbon)
  let boost = 0, target = null, lastKey = '', lastPos = [1e9, 1e9], lastT = -9, pts = []

  const between = (a, b, p) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2, off = Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / Math.sqrt(L2); return u > 0 && u < 1 && off < 9 }
  /** Road route from the car to the target as world points (trimmed so it never overshoots either end). */
  function route(cx, cz, tx, tz) {
    const r = city.route(cx, cz, tx, tz)
    if (r.length >= 2 && between(r[r.length - 2], r[r.length - 1], [tx, tz])) r.pop()
    if (r.length >= 2 && between(r[0], r[1], [cx, cz])) r.shift()
    return [[cx, cz], ...r, [tx, tz]]
  }
  function build(list) {
    let n = Math.min(list.length, max), dist = 0
    for (let i = 0; i < n; i++) {
      const p = list[i], q = list[Math.min(i + 1, n - 1)], o = list[Math.max(i - 1, 0)]
      let dx = q[0] - o[0], dz = q[1] - o[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L
      if (i) dist += Math.hypot(p[0] - list[i - 1][0], p[1] - list[i - 1][1])
      const w = 0.9
      positions.set([p[0] - dz * w, 0.36, p[1] + dx * w, p[0] + dz * w, 0.36, p[1] - dx * w], i * 6)
      uvs.set([0, dist / 3.2, 1, dist / 3.2], i * 4)
    }
    geo.attributes.position.needsUpdate = geo.attributes.uv.needsUpdate = true; geo.setDrawRange(0, Math.max(0, (n - 1) * 6))
  }

  return {
    get path() { return pts },
    /** Point everything at `loc` ({id,pos}) or clear with null. */
    setTarget(loc) {
      target = loc; lastKey = ''
      if (!loc) { marker.hide(); ribbon.visible = false; pts = []; return }
      marker.set(loc.pos[0], loc.pos[1]); ribbon.visible = true
    },
    pulse() { boost = 1 },
    /** Call every frame with the car position; re-routes at ~2 Hz once the car has moved. */
    update(dt, t, car, hidden = false) {
      marker.g.visible = !!target && !hidden; ribbon.visible = !!target && !hidden
      if (!target) return
      marker.update(t); tex.offset.y -= dt * 1.1
      boost = Math.max(0, boost - dt * 0.6)
      mat.opacity = 0.7 + boost * 0.3; marker.g.scale.set(1 + boost * 0.7, 1 + boost * 0.4, 1 + boost * 0.7)
      const key = target.id, moved = Math.hypot(car.x - lastPos[0], car.z - lastPos[1])
      if (key !== lastKey || (t - lastT > 0.5 && moved > 5)) {
        lastKey = key; lastPos = [car.x, car.z]; lastT = t
        const d = Math.hypot(target.pos[0] - car.x, target.pos[1] - car.z)
        pts = d < 14 ? [] : route(car.x, car.z, target.pos[0], target.pos[1])
        if (pts.length > 1) build(pts); else geo.setDrawRange(0, 0)
      }
    },
  }
}
