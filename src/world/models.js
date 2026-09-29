import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const DEFAULTS = { car: { size: 4.4, axis: 'z' }, avatar: { size: 4.2, axis: 'y' }, prop: { size: 1.6, axis: 'max' } }

let loader
function getLoader() {
  if (loader) return loader
  loader = new GLTFLoader()
  const draco = new DRACOLoader(); draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
  loader.setDRACOLoader(draco); loader.setMeshoptDecoder(MeshoptDecoder)
  return loader
}

/** Fit a loaded scene into a wrapper: scaled to `size` on `axis`, centred on x/z, sitting on y=0. */
function fit(scene, { size, axis, rotY = 0 }) {
  const wrap = new THREE.Group(), inner = new THREE.Group()
  inner.add(scene); inner.rotation.y = THREE.MathUtils.degToRad(rotY); wrap.add(inner)
  const box = new THREE.Box3().setFromObject(inner), d = box.getSize(new THREE.Vector3())
  const ref = axis === 'y' ? d.y : axis === 'z' ? Math.max(d.z, d.x) : Math.max(d.x, d.y, d.z)
  wrap.scale.setScalar(size / (ref || 1))
  const c = box.getCenter(new THREE.Vector3())
  inner.position.set(-c.x, -box.min.y, -c.z)
  return wrap
}

/* ------------------------------------------------------------------ car post-processing */
/** Copy position/normal/uv into a clean, indexed, float geometry so different meshes can be merged. */
function clean(src) {
  const g = new THREE.BufferGeometry(), n = src.attributes.position.count
  const copy = (name, size) => {
    const a = src.attributes[name], arr = new Float32Array(n * size)
    if (a) for (let i = 0; i < n; i++) { arr[i * size] = a.getX(i); arr[i * size + 1] = a.getY(i); if (size > 2) arr[i * size + 2] = a.getZ(i) }
    g.setAttribute(name, new THREE.BufferAttribute(arr, size)); return !!a
  }
  copy('position', 3); const hasN = copy('normal', 3); copy('uv', 2)
  const idx = src.index ? Uint32Array.from(src.index.array) : Uint32Array.from({ length: n }, (_, i) => i)
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  if (!hasN) g.computeVertexNormals()
  return g
}
const diag = (g) => { g.computeBoundingBox(); return g.boundingBox.getSize(new THREE.Vector3()).length() }

/** Split an indexed geometry into 4 buckets by triangle centroid (x < xc?, z < zc?). */
function splitQuadrants(g, xc, zc) {
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index.array
  const b = Array.from({ length: 4 }, () => ({ pos: [], nor: [], uv: [], idx: [], map: new Map() }))
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], c = I[t + 1], d = I[t + 2]
    const q = ((P.getX(a) + P.getX(c) + P.getX(d)) / 3 < xc ? 0 : 1) + ((P.getZ(a) + P.getZ(c) + P.getZ(d)) / 3 < zc ? 0 : 2), k = b[q]
    for (const v of [a, c, d]) {
      let ni = k.map.get(v)
      if (ni === undefined) { ni = k.pos.length / 3; k.map.set(v, ni); k.pos.push(P.getX(v), P.getY(v), P.getZ(v)); k.nor.push(N.getX(v), N.getY(v), N.getZ(v)); k.uv.push(U.getX(v), U.getY(v)) }
      k.idx.push(ni)
    }
  }
  return b.map((k) => { if (!k.idx.length) return null; const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(k.pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(k.nor, 3)); o.setAttribute('uv', new THREE.Float32BufferAttribute(k.uv, 2)); o.setIndex(k.idx); return o })
}

/**
 * Turns a 115-mesh CAD-style car into ~40 draw calls: static meshes are baked and merged per material,
 * tyres/rims are split into four pivoted wheel groups (so they can spin and steer), and meshes that belong
 * to animated nodes (active-aero wing) are left untouched so the clip still plays.
 */
function processCar(gltf, cfg) {
  const root = gltf.scene; root.updateMatrixWorld(true)
  const ignore = new Set(cfg.ignore || []), minPart = cfg.minPart ?? 0.05
  const animNodes = new Set(gltf.animations.flatMap((c) => c.tracks.map((t) => t.name.split('.')[0])))
  const ancestor = (o, test) => { for (let p = o; p; p = p.parent) if (test(p)) return true; return false }
  const isWheel = (o) => ancestor(o, (p) => /^wheel/i.test(p.name)) || /^Tire/.test(o.material?.name || '')
  const body = new Map(), wheelParts = [], drop = []
  root.traverse((o) => {
    if (!o.isMesh) return
    if (ignore.has(o.name)) { drop.push(o); return }
    if (ancestor(o, (p) => animNodes.has(p.name))) return
    const g = clean(o.geometry); g.applyMatrix4(o.matrixWorld); drop.push(o)
    if (isWheel(o)) wheelParts.push({ g, mat: o.material })
    else { const k = o.material.uuid; if (!body.has(k)) body.set(k, { mat: o.material, list: [] }); body.get(k).list.push(g) }
  })
  drop.forEach((o) => o.parent?.remove(o))

  const all = new THREE.Box3(); body.forEach(({ list }) => list.forEach((g) => { g.computeBoundingBox(); all.union(g.boundingBox) }))
  const len = Math.max(all.max.x - all.min.x, all.max.z - all.min.z), stats = { merged: 0, culled: 0, wheels: 0 }
  body.forEach(({ mat, list }) => {
    const m = mergeGeometries(list, false); if (!m) return
    if (diag(m) < len * minPart && !mat.transparent) { stats.culled++; return }
    root.add(new THREE.Mesh(m, mat)); stats.merged++
  })

  // wheels: split by quadrant around the wheel-set centre, pivot at each tyre's centre
  const wb = new THREE.Box3(); wheelParts.forEach(({ g }) => { g.computeBoundingBox(); wb.union(g.boundingBox) })
  const xc = (wb.min.x + wb.max.x) / 2, zc = (wb.min.z + wb.max.z) / 2
  const quads = [[], [], [], []]
  for (const { g, mat } of wheelParts) splitQuadrants(g, xc, zc).forEach((sg, q) => { if (sg) quads[q].push({ g: sg, mat }) })
  const wheels = []
  quads.forEach((parts, q) => {
    if (!parts.length) return
    const tb = new THREE.Box3(), ab = new THREE.Box3()
    parts.forEach(({ g, mat }) => { g.computeBoundingBox(); ab.union(g.boundingBox); if (/^Tire/.test(mat.name)) tb.union(g.boundingBox) })
    const ref = tb.isEmpty() ? ab : tb, pivot = ref.getCenter(new THREE.Vector3()), radius = (ref.max.y - ref.min.y) / 2
    const byMat = new Map()
    parts.forEach(({ g, mat }) => { g.translate(-pivot.x, -pivot.y, -pivot.z); if (!byMat.has(mat.uuid)) byMat.set(mat.uuid, { mat, list: [] }); byMat.get(mat.uuid).list.push(g) })
    const grp = new THREE.Group(); grp.rotation.order = 'YXZ'; grp.position.copy(pivot)
    byMat.forEach(({ mat, list }) => { const m = mergeGeometries(list, false); if (m) grp.add(new THREE.Mesh(m, mat)) })
    root.add(grp); stats.wheels++
    wheels.push({ group: grp, front: (q >> 1) === 1, right: (q & 1) === 1, radius })
  })
  console.info('[models] car processed', stats)
  return { wheels }
}

/** Reads /models/models.json and loads every slot that is configured. Never throws. */
export async function loadModels(manifest = {}, { skip = [], tune = {} } = {}) {
  const result = { credits: [] }
  const slots = Object.keys(DEFAULTS).filter((k) => manifest[k]?.file && !skip.includes(k))
  await Promise.all(slots.map(async (k) => {
    const cfg = { ...DEFAULTS[k], ...manifest[k], ...(tune[k] || {}) }
    try {
      const gltf = await getLoader().loadAsync('/models/' + cfg.file)
      gltf.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = true; if (o.material) o.material.envMapIntensity = 0.7 } })
      const extra = k === 'car' ? processCar(gltf, cfg) : {}
      result[k] = { object: fit(gltf.scene, cfg), clips: gltf.animations || [], scene: gltf.scene, ...extra }
      if (cfg.credit) result.credits.push(cfg.credit)
    } catch (e) { console.warn(`[models] "${k}" failed to load (${cfg.file}) — using built-in model`, e?.message || e) }
  }))
  return result
}
