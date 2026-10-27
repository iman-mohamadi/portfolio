import * as THREE from 'three'
import { seeded } from './helpers.js'

/** Wind turbines on the horizon: slow, big and animated, so the edge of the city never feels like a painted backdrop. */
export function createTurbines({ scene, half, count = 9, seed = 5, accent = 0xffcf24 }) {
  const rnd = seeded(seed), turbines = []
  const white = new THREE.MeshLambertMaterial({ color: 0xe9eaee }), grey = new THREE.MeshLambertMaterial({ color: 0x9aa0ab }), tip = new THREE.MeshLambertMaterial({ color: accent })
  const lamp = new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })
  const H = 46
  const tower = new THREE.CylinderGeometry(0.9, 1.7, H, 14, 1, false).translate(0, H / 2, 0)
  const nacelle = new THREE.BoxGeometry(3.4, 3, 7.5).translate(0, 0, -0.6)
  const hub = new THREE.SphereGeometry(1.5, 12, 8)
  const blade = new THREE.BoxGeometry(1.25, 24, 0.35).translate(0, 12.8, 0)
  const bladeTip = new THREE.BoxGeometry(1.27, 4, 0.37).translate(0, 22.9, 0)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.5, d = half + 92 + rnd() * 18
    const g = new THREE.Group(); g.position.set(Math.cos(a) * d, -1, Math.sin(a) * d); g.rotation.y = rnd() * 6.28
    g.add(new THREE.Mesh(tower, white))
    const head = new THREE.Group(); head.position.y = H + 0.6
    head.add(new THREE.Mesh(nacelle, grey))
    const rotor = new THREE.Group(); rotor.position.set(0, 0, 3.6); rotor.add(new THREE.Mesh(hub, grey))
    for (let b = 0; b < 3; b++) { const arm = new THREE.Group(); arm.rotation.z = (b / 3) * Math.PI * 2; arm.add(new THREE.Mesh(blade, white), new THREE.Mesh(bladeTip, tip)); rotor.add(arm) }
    head.add(rotor)
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lamp); beacon.position.set(0, 2.1, -2.2); head.add(beacon)
    g.add(head); g.scale.setScalar(0.9 + rnd() * 0.5); scene.add(g)
    turbines.push({ rotor, head, beacon, speed: 0.55 + rnd() * 0.5, phase: rnd() * 6, yaw: g.rotation.y })
  }
  return {
    /** wind: slowly swings every nacelle into the wind and spins the rotors */
    update(t, dt) {
      for (const k of turbines) {
        k.rotor.rotation.z += dt * k.speed
        k.head.rotation.y = Math.sin(t * 0.03 + k.phase) * 0.5
        k.beacon.visible = Math.sin(t * 2.4 + k.phase) > 0.2
      }
    },
  }
}
