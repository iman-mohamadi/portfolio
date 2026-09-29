import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/**
 * Runtime side of the asset pipeline (tools/build-kits.mjs): loads the compressed Kenney kits and exposes every
 * model as a list of mesh parts, ready to be drawn with InstancedMesh (one draw call per part per model).
 */
export async function loadKits(names = ['city', 'cars', 'nature', 'racing'], onProgress = () => {}) {
  const index = await (await fetch('/models/kits/index.json')).json()
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder)
  const kits = {}
  await Promise.all(names.map(async (n) => {
    const g = await loader.loadAsync(`/models/kits/${n}.glb`)
    kits[n] = buildKit(g.scene, index[n]); onProgress(n)
  }))
  return kits
}

function buildKit(scene, index) {
  scene.updateMatrixWorld(true)
  const models = new Map()
  for (const root of scene.children) {
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), parts = []
    root.traverse((o) => { if (o.isMesh) parts.push({ name: o.name, geometry: o.geometry, material: o.material, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) }) })
    const nm = root.userData.name || root.name // three.js strips '/' from node names; the original is kept in userData
    const meta = index[nm] || { size: [1, 1, 1], min: [0, 0, 0], tris: 0 }
    models.set(nm, { name: nm, parts, size: meta.size, min: meta.min, tris: meta.tris })
  }
  return { models, get: (n) => { const m = models.get(n); if (!m) console.warn('[kits] missing model', n); return m }, has: (n) => models.has(n) }
}

/** `material` may be one material for every part, or a `(part) => material` function (multi-material models such as trees). */
const matOf = (material, part) => (typeof material === 'function' ? material(part) : material || part.material)

/**
 * Draws `list` instances of a model. Each entry: { x, y, z, ry (yaw), s (uniform scale) }.
 * Returns the created InstancedMeshes (one per mesh part) so callers can add them to a scene / update matrices.
 */
export function instanceModel(model, list, { material, scale = 1, frustumCulled = false } = {}) {
  const meshes = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3()
  for (const part of model.parts) {
    const im = new THREE.InstancedMesh(part.geometry, matOf(material, part), list.length)
    list.forEach((it, i) => {
      e.set(it.rx || 0, it.ry || 0, it.rz || 0); q.setFromEuler(e); p.set(it.x, it.y || 0, it.z)
      const k = (it.s ?? 1) * scale; sc.set(k, k, k)
      m.compose(p, q, sc).multiply(part.matrix); im.setMatrixAt(i, m)
    })
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = frustumCulled
    im.computeBoundingSphere?.(); meshes.push(im)
  }
  return meshes
}

/**
 * Instances whose matrices change every frame (props, traffic, rivals). `set` writes one instance; call `commit()` once per frame.
 */
export function dynamicInstances(model, count, { material } = {}) {
  const meshes = model.parts.map((part) => { const im = new THREE.InstancedMesh(part.geometry, matOf(material, part), count); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; return im })
  const m = new THREE.Matrix4(), c = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3()
  return {
    meshes, model,
    /** i: slot; s: uniform scale. Slots must be filled 0..n-1 contiguously; `use(n)` sets how many are drawn. */
    set(i, x, y, z, ry, s = 1, rx = 0, rz = 0) {
      e.set(rx, ry, rz); q.setFromEuler(e); p.set(x, y, z); sc.set(s, s, s); m.compose(p, q, sc)
      meshes.forEach((im, k) => { c.multiplyMatrices(m, model.parts[k].matrix); im.setMatrixAt(i, c) })
    },
    use(n) { meshes.forEach((im) => (im.count = n)) },
    commit() { meshes.forEach((im) => (im.instanceMatrix.needsUpdate = true)) },
  }
}
