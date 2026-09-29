import * as THREE from 'three'
import gsap from 'gsap'
import { palette } from './core.js'

const TRI_MS = 1 / 420000 // model: ms of GPU time per triangle (tuned on integrated graphics)

/**
 * The boss: a warehouse of spinning crates rendered the naive way. Its "health" is the *measured* frame cost:
 * CPU submit time of the real render call + a triangle-throughput model. Three levers genuinely change how the
 * scene is drawn — instancing (draw calls), frustum culling (submitted work) and LOD (triangles).
 */
export function createPerf({ core, dock, state }) {
  const mobile = core.mobile, soft = core.soft
  const group = new THREE.Group(); group.position.set(0, 0, 0); dock.group.add(group)
  const P = state.perf
  const geo = { hi: new THREE.IcosahedronGeometry(0.85, 7), mid: new THREE.IcosahedronGeometry(0.85, 1), lo: new THREE.OctahedronGeometry(0.85, 0) }
  const tri = { hi: 1280, mid: 80, lo: 8 }
  const mat = new THREE.MeshStandardMaterial({ color: 0x141724, roughness: 0.35, metalness: 0.7, flatShading: true }); mat.emissive = palette.primary; mat.emissiveIntensity = 0.35

  let N = 0, data = null, meshes = [], inst = null, built = { n: -1, instancing: null }
  const dummy = new THREE.Object3D(), frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere(new THREE.Vector3(), 1.2), tmp = new THREE.Vector3()

  function gen(n) {
    const nx = Math.ceil(Math.sqrt(n * 1.6)), nz = Math.ceil(n / nx / 2)
    data = new Float32Array(n * 5) // x, y, z, phase, size
    for (let k = 0; k < n; k++) {
      const i = k % nx, j = Math.floor(k / nx) % nz, l = Math.floor(k / (nx * nz))
      data[k * 5] = (i - nx / 2) * 2.5; data[k * 5 + 1] = 1 + l * 3.4; data[k * 5 + 2] = -14 - j * 2.4; data[k * 5 + 3] = Math.random() * 6.28; data[k * 5 + 4] = 0.7 + Math.random() * 0.6
    }
  }
  function clear() {
    for (const m of meshes) group.remove(m); meshes = []
    if (inst) { inst.forEach((m) => group.remove(m)); inst = null }
  }
  function build(n) {
    clear(); N = n; gen(n); built = { n, instancing: P.instancing }; P.count = n
    if (P.instancing) {
      inst = ['hi', 'mid', 'lo'].map((k) => { const m = new THREE.InstancedMesh(geo[k], mat, n); m.frustumCulled = false; m.userData.k = k; group.add(m); return m })
    } else {
      for (let k = 0; k < n; k++) { const m = new THREE.Mesh(geo.hi, mat); m.frustumCulled = false; m.position.set(data[k * 5], data[k * 5 + 1], data[k * 5 + 2]); m.scale.setScalar(data[k * 5 + 4]); group.add(m); meshes.push(m) }
    }
  }

  let phase = 'idle', calibT = 0, base = 0, won = 0, report = 0
  function update(t, dt) {
    if (!group.visible) return
    // apply lever changes that need a rebuild
    if (built.instancing !== P.instancing && phase !== 'idle') build(N)
    const camPos = core.camera.position
    if (P.instancing) {
      pv.multiplyMatrices(core.camera.projectionMatrix, core.camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv)
      const cnt = { hi: 0, mid: 0, lo: 0 }
      for (let k = 0; k < N; k++) {
        const x = data[k * 5], y = data[k * 5 + 1] + Math.sin(t * 1.2 + data[k * 5 + 3]) * 0.25, z = data[k * 5 + 2] - 0, s = data[k * 5 + 4]
        tmp.set(x + dock.X, y, z)
        if (P.culling) { sph.center.copy(tmp); if (!frustum.intersectsSphere(sph)) continue }
        let key = 'hi'; if (P.lod) { const d = tmp.distanceTo(camPos); key = d < 24 ? 'hi' : d < 52 ? 'mid' : 'lo' }
        dummy.position.set(x, y, z); dummy.rotation.set(t * 0.4 + data[k * 5 + 3], t * 0.6 + data[k * 5 + 3] * 2, 0); dummy.scale.setScalar(s); dummy.updateMatrix()
        const m = inst[key === 'hi' ? 0 : key === 'mid' ? 1 : 2]; m.setMatrixAt(cnt[key]++, dummy.matrix)
      }
      inst[0].count = cnt.hi; inst[1].count = cnt.mid; inst[2].count = cnt.lo; inst.forEach((m) => (m.instanceMatrix.needsUpdate = true))
    } else {
      for (let k = 0; k < N; k++) {
        const m = meshes[k]; m.frustumCulled = P.culling
        m.position.y = data[k * 5 + 1] + Math.sin(t * 1.2 + data[k * 5 + 3]) * 0.25; m.rotation.x = t * 0.4 + data[k * 5 + 3]; m.rotation.y = t * 0.6 + data[k * 5 + 3] * 2
        if (P.lod) { tmp.set(m.position.x + dock.X, m.position.y, m.position.z); const d = tmp.distanceTo(camPos); m.geometry = d < 24 ? geo.hi : d < 52 ? geo.mid : geo.lo } else if (m.geometry !== geo.hi) m.geometry = geo.hi
      }
    }
    // live measurements → shared state (5 Hz)
    report += dt
    if (report > 0.2) {
      report = 0
      const cpu = core.stats.renderMs, tris = core.stats.tris, calls = core.stats.calls
      P.calls = calls; P.tris = tris; P.cpu = +cpu.toFixed(1); P.fps = Math.round(core.stats.fps)
      P.ms = +(cpu + tris * TRI_MS).toFixed(1)
    }
    // calibration: size the boss so the naive scene costs ~34 ms on *this* device
    if (phase === 'calib1' || phase === 'calib2') {
      calibT += dt
      if (calibT > 1.3) {
        const c = P.ms, per = Math.max(0.0005, (c - base) / N)
        if (phase === 'calib1') { const want = THREE.MathUtils.clamp(Math.round((34 - base) / per), soft ? 200 : mobile ? 300 : 600, soft ? 500 : mobile ? 3000 : 12000); build(want); phase = 'calib2'; calibT = 0 }
        else {
          P.base = P.ms
          // a very fast device may not reach 34 ms even at the cap: scale the budget so the fight is still real
          P.target = P.ms < 26 ? +Math.max(4, P.ms * 0.5).toFixed(1) : 16.6
          P.baseCalls = P.calls; P.baseTris = P.tris; P.baseFps = P.fps
          P.phase = phase = 'fight'
        }
      }
    } else if (phase === 'fight') {
      if (P.ms <= P.target && P.ms > 0) { won += dt; if (won > 1.4 && !P.won) { P.won = true; P.phase = 'won'; celebrate() } } else won = 0
    }
  }
  const unsub = core.add(update)
  function celebrate() {
    gsap.fromTo(mat, { emissiveIntensity: 3 }, { emissiveIntensity: 0.35, duration: 1.8, ease: 'power2.out' })
  }

  return {
    group,
    enter() {
      group.visible = true; Object.assign(P, { instancing: false, culling: false, lod: false, won: false, phase: 'calib1', base: 0, target: 16.6 })
      base = 2.2; calibT = 0; phase = 'calib1'; build(soft ? 200 : mobile ? 700 : 1400)
    },
    leave() { phase = 'idle'; clear(); group.visible = false },
    reset() { this.enter() },
    dispose: unsub,
  }
}
