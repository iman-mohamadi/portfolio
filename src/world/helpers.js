import * as THREE from 'three'

export const $ = (s) => document.querySelector(s)
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const damp = (dt, k) => 1 - Math.exp(-k * dt)
export const PINK = 0xff2d8a, VIOLET = 0x7a5cff
export const F_SANS = "'Inter Tight', sans-serif", F_SERIF = "'Instrument Serif', serif", F_MONO = "'JetBrains Mono', monospace"
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'); draw(x, w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  return t
}
export const basic = (map, opts = {}) => new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, ...opts })
export const glow = (color, i = 2) => new THREE.MeshStandardMaterial({ color: 0x0a0a10, emissive: color, emissiveIntensity: i, roughness: 0.4 })
export const dark = (c = 0x101018, r = 0.45, m = 0.5) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, flatShading: true })
export function sprite(text, { size = 3, color = '#f2efec', font = `300 120px ${F_SANS}`, accent } = {}) {
  const tex = canvasTex(1024, 256, (x, w, h) => {
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color
    x.shadowColor = accent || '#ff2d8a'; x.shadowBlur = 24; x.fillText(text, w / 2, h / 2)
  })
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }))
  s.scale.set(size * 4, size, 1)
  return s
}
export function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647) }
