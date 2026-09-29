import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

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

/** Reads /models/models.json and loads every slot that is configured. Never throws. */
export async function loadModels(manifest = {}, onProgress = () => {}) {
  const result = { credits: [] }
  const slots = Object.keys(DEFAULTS).filter((k) => manifest[k]?.file)
  let done = 0
  await Promise.all(slots.map(async (k) => {
    const cfg = { ...DEFAULTS[k], ...manifest[k] }
    try {
      const gltf = await getLoader().loadAsync('/models/' + cfg.file)
      gltf.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = true; if (o.material) o.material.envMapIntensity = 0.7 } })
      result[k] = { object: fit(gltf.scene, cfg), clips: gltf.animations || [], scene: gltf.scene }
      if (cfg.credit) result.credits.push(cfg.credit)
    } catch (e) { console.warn(`[models] "${k}" failed to load (${cfg.file}) — using built-in model`, e?.message || e) }
    onProgress(++done / slots.length)
  }))
  return result
}
