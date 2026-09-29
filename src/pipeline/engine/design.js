import * as THREE from 'three'
import gsap from 'gsap'
import { palette } from './core.js'
import { basicMat } from './world.js'
import { canvasTex } from '../../world/helpers.js'

const MONO = "'JetBrains Mono', monospace", SANS = "'Inter Tight', sans-serif", SERIF = "'Instrument Serif', serif"

/** SDF rounded-rectangle: the corner radius is a uniform, so the whole UI kit morphs when the radius token changes. */
export const roundedMat = (w, h, { color = palette.primary, mode = 0 } = {}) => new THREE.ShaderMaterial({
  uniforms: { uSize: { value: new THREE.Vector2(w, h) }, uR: { value: 0.4 }, uColor: { value: color }, uMode: { value: mode }, uGlow: { value: 0 } },
  transparent: true, depthWrite: false,
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: /* glsl */ `
    uniform vec2 uSize;uniform float uR,uMode,uGlow;uniform vec3 uColor;varying vec2 vUv;
    float sd(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
    void main(){
      vec2 p=(vUv-.5)*uSize;float r=min(uR,min(uSize.x,uSize.y)*.5);float d=sd(p,uSize*.5,r);
      float aa=fwidth(d)*1.3;float fill=1.-smoothstep(-aa,aa,d);float edge=1.-smoothstep(0.,aa*2.2,abs(d+.02)-.015);
      vec3 glass=mix(vec3(.045,.05,.075),uColor*.16,.55+.25*vUv.y);
      vec3 col=uMode>.5&&uMode<1.5?uColor:glass;
      float a=uMode>1.5?0.:fill*(uMode>.5&&uMode<1.5?1.:.9);
      col+=uColor*edge*(uMode>.5&&uMode<1.5?0.:.75)+uColor*uGlow*exp(-max(d,0.)*1.6)*.9;
      gl_FragColor=vec4(col,clamp(a+edge*.9+uGlow*.25*exp(-max(d,0.)*1.6),0.,1.));
    }`,
})

const place = (m, x, y, z) => { m.position.set(x, y, z); return m }
const textPlane = (w, h, draw, scale = 160) => {
  const tex = canvasTex(Math.round(w * scale), Math.round(h * scale), (x, cw, ch) => draw(x, cw, ch, scale))
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })); m.material.color.setScalar(1.5); return m
}

export function createDesign({ core, dock, state, mobile }) {
  const group = new THREE.Group(); group.position.set(0, 0, -8); dock.group.add(group)
  const els = []
  const mats = []
  /** Adds a UI element at a base position. `base` is scaled around the frame centre by the density token. */
  function el(mesh, x, y, z = 0, extra = null) { mesh.position.set(x, y, z); mesh.userData.base = new THREE.Vector2(x, y); group.add(mesh); els.push(mesh); if (extra) extra.forEach((c) => mesh.add(c)); return mesh }
  const card = (w, h, o) => { const m = roundedMat(w, h, o); mats.push(m); return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m) }

  /* Figma-style frame + handles + label */
  const frameW = 26.4, frameH = 12.6, cy = 7.6
  const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(a * frameW / 2, cy + b * frameH / 2, -0.1))), new THREE.LineBasicMaterial({ toneMapped: false }))
  frame.material.color = palette.accent; group.add(frame)
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const hnd = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), basicMat(palette.accent)); hnd.position.set(a * frameW / 2, cy + b * frameH / 2, -0.05); group.add(hnd) }
  const frameLabel = textPlane(6, 0.7, (x, w, h, s) => { x.fillStyle = '#fff'; x.font = `300 ${0.36 * s}px ${MONO}`; x.textBaseline = 'middle'; x.fillText('Frame 1 — Raya UI kit', 6, h / 2) }, 120)
  frameLabel.position.set(-frameW / 2 + 3, cy + frameH / 2 + 0.6, -0.05); group.add(frameLabel)

  /* card A — dashboard */
  const cardA = el(card(9.4, 5.8), -6.2, 8.9)
  cardA.add(place(textPlane(8.4, 1.5, (x, w, h, s) => { x.fillStyle = '#f2efec'; x.font = `200 ${0.62 * s}px ${SANS}`; x.textBaseline = 'top'; x.fillText('Deploy dashboard', 0, 4); x.fillStyle = 'rgba(242,239,236,.55)'; x.font = `300 ${0.3 * s}px ${MONO}`; x.fillText('1.2M REQ/S · 4 CONTINENTS', 2, 0.78 * s) }), 0, 1.75, 0.03))
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 1, 0.16), basicMat(palette.primary), 14); bars.position.set(-3.6, -2.3, 0.1); cardA.add(bars)
  const dummy = new THREE.Object3D()
  /* card B — profile (uses the real photo) */
  const cardB = el(card(6.2, 6.8, { color: palette.secondary }), 4.6, 9.4)
  const avatarMat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: null }, uRing: { value: palette.primary } }, transparent: true, depthWrite: false, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform sampler2D uMap;uniform vec3 uRing;varying vec2 vUv;void main(){float d=length(vUv-.5);float a=1.-smoothstep(.47,.5,d);vec4 t=texture2D(uMap,vUv);vec3 c=mix(t.rgb,uRing,smoothstep(.43,.46,d));gl_FragColor=vec4(c,a);}' })
  new THREE.TextureLoader().load('/iman.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; avatarMat.uniforms.uMap.value = t })
  const avatar = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), avatarMat); avatar.position.set(0, 1.5, 0.05); cardB.add(avatar)
  cardB.add(place(textPlane(5.4, 2.2, (x, w, h, s) => { x.textAlign = 'center'; x.fillStyle = '#f2efec'; x.font = `300 ${0.5 * s}px ${SANS}`; x.fillText('Iman Mohammadi', w / 2, 0.55 * s); x.fillStyle = 'rgba(242,239,236,.6)'; x.font = `300 ${0.26 * s}px ${MONO}`; x.fillText('SENIOR FRONT-END ARCHITECT', w / 2, 1.05 * s); x.fillStyle = '#ffd0e4'; x.font = `italic 400 ${0.4 * s}px ${SERIF}`; x.fillText('Vue · Nuxt · Three.js', w / 2, 1.65 * s) }), 0, -1.55, 0.03))
  /* buttons, toggle, input */
  const btnA = el(card(4.4, 1.5, { mode: 1 }), -9.0, 4.6)
  btnA.add(place(textPlane(4.4, 1.5, (x, w, h, s) => { x.fillStyle = '#0a0710'; x.font = `500 ${0.5 * s}px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Ship it →', w / 2, h / 2 + 2) }), 0, 0, 0.03))
  const btnB = el(card(4.4, 1.5, { mode: 2 }), -3.6, 4.6)
  btnB.add(place(textPlane(4.4, 1.5, (x, w, h, s) => { x.fillStyle = '#f2efec'; x.font = `300 ${0.5 * s}px ${SANS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Preview', w / 2, h / 2 + 2) }), 0, 0, 0.03))
  const toggle = el(card(2.8, 1.4, { mode: 2 }), 0.6, 4.6)
  const knob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), basicMat(palette.primary)); knob.position.set(0.6, 0, 0.05); toggle.add(knob)
  const input = el(card(6.6, 1.5), 5.4, 4.6)
  input.add(place(textPlane(6.2, 1.2, (x, w, h, s) => { x.fillStyle = 'rgba(242,239,236,.45)'; x.font = `300 ${0.4 * s}px ${MONO}`; x.textBaseline = 'middle'; x.fillText('you@company.com', 2, h / 2 + 2) }), 0, 0, 0.03))
  /* swatches float above the frame */
  const swatches = [palette.primary, palette.secondary, palette.accent].map((c, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), basicMat(c)); s.position.set(-1.6 + i * 1.6, cy + frameH / 2 + 1.7, 0.4); group.add(s); return s })
  /* token inspector: live code card */
  const codeCanvas = document.createElement('canvas'); codeCanvas.width = 640; codeCanvas.height = 420
  const codeTex = new THREE.CanvasTexture(codeCanvas); codeTex.colorSpace = THREE.SRGBColorSpace
  const codeCard = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 4.2), new THREE.MeshBasicMaterial({ map: codeTex, transparent: true, toneMapped: false, depthWrite: false }))
  codeCard.position.set(-19.5, 6.6, 1.2); codeCard.rotation.y = 0.32; group.add(codeCard)
  let lastCode = ''
  function paintCode() {
    const t = state.tokens, s = `${Math.round(t.hue)}|${t.radius.toFixed(2)}|${t.density.toFixed(2)}`
    if (s === lastCode) return; lastCode = s
    const x = codeCanvas.getContext('2d'), W = 640, H = 420
    x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(6,7,11,.9)'; x.beginPath(); x.roundRect(0, 0, W, H, 22); x.fill(); x.strokeStyle = `hsl(${t.hue} 92% 58%)`; x.lineWidth = 3; x.stroke()
    x.font = `300 25px ${MONO}`; x.textBaseline = 'top'
    const line = (i, parts) => { let px = 30; parts.forEach(([txt, col]) => { x.fillStyle = col; x.fillText(txt, px, 26 + i * 40); px += x.measureText(txt).width }) }
    const pink = `hsl(${t.hue} 92% 66%)`, cyan = '#7ee0ff', dim = 'rgba(242,239,236,.45)'
    line(0, [['/* design tokens */', dim]]); line(1, [[':root', '#f2efec'], [' {', dim]])
    line(2, [['  --hue', pink], [': ', dim], [`${Math.round(t.hue)}`, cyan], [';', dim]])
    line(3, [['  --radius', pink], [': ', dim], [`${Math.round(6 + t.radius * 36)}px`, cyan], [';', dim]])
    line(4, [['  --space', pink], [': ', dim], [`${t.density.toFixed(2)}`, cyan], [';', dim]]); line(5, [['}', dim]])
    line(7, [['// tailwind.config', dim]]); line(8, [['primary', pink], [': ', dim], [`'hsl(var(--hue) 92% 58%)'`, cyan]])
    codeTex.needsUpdate = true
  }

  /* Figma cursor with a name tag */
  const cursor = textPlane(2.6, 1, (x, w, h, s) => { x.fillStyle = '#7ee0ff'; x.beginPath(); x.moveTo(6, 6); x.lineTo(6, 46); x.lineTo(20, 34); x.lineTo(34, 54); x.lineTo(42, 48); x.lineTo(28, 30); x.lineTo(46, 28); x.closePath(); x.fill(); x.fillRect(48, 34, 108, 34); x.fillStyle = '#04141a'; x.font = `500 24px ${SANS}`; x.textBaseline = 'middle'; x.fillText('Iman', 60, 51) }, 64)
  cursor.position.set(0, 7, 1.5); group.add(cursor)

  const targets = [cardA, cardB, btnA, btnB, toggle, input]
  const radiusU = { v: 0.4 }
  let alive = false, enterT = 0
  const unsub = core.add((t, dt) => {
    if (!group.visible) return
    const tk = state.tokens
    radiusU.v += (tk.radius * 1.9 - radiusU.v) * Math.min(1, dt * 10)
    for (const m of mats) m.uniforms.uR.value = radiusU.v
    const dens = 0.72 + tk.density * 0.28 + (tk.density - 1) * 0.12
    for (const e of els) { e.position.x += (e.userData.base.x * dens - e.position.x) * Math.min(1, dt * 8); e.position.y += (cy + (e.userData.base.y - cy) * dens - e.position.y) * Math.min(1, dt * 8) }
    // cursor wanders between components; the one it visits glows like a Figma selection
    const k = (t * 0.22) % targets.length, a = targets[Math.floor(k) % targets.length], b = targets[(Math.floor(k) + 1) % targets.length], f = THREE.MathUtils.smoothstep(k % 1, 0.15, 0.85)
    cursor.position.x = THREE.MathUtils.lerp(a.position.x, b.position.x, f) + 1.2; cursor.position.y = THREE.MathUtils.lerp(a.position.y, b.position.y, f) - 0.6
    for (const e of targets) { const u = e.material.uniforms.uGlow; const on = (e === a && f < 0.5) || (e === b && f >= 0.5); u.value += ((on ? 1 : 0) - u.value) * Math.min(1, dt * 6) }
    knob.position.x = Math.tanh(Math.sin(t * 0.7) * 4) * 0.6
    for (let i = 0; i < 14; i++) { const h = 0.5 + (0.5 + 0.5 * Math.sin(t * 1.4 + i * 0.7)) * 2.6; dummy.position.set(i * 0.6, h / 2, 0); dummy.scale.set(1, h, 1); dummy.updateMatrix(); bars.setMatrixAt(i, dummy.matrix) }
    bars.instanceMatrix.needsUpdate = true
    swatches.forEach((s, i) => { s.position.y = cy + frameH / 2 + 1.7 + Math.sin(t * 1.5 + i) * 0.15 })
    codeCard.position.y = 6.6 + Math.sin(t * 0.9) * 0.15
    paintCode()
  })

  return {
    group,
    enter() {
      group.visible = true; paintCode()
      els.forEach((e, i) => { e.scale.setScalar(0.001); gsap.to(e.scale, { x: 1, y: 1, z: 1, duration: 0.7, delay: 0.08 * i, ease: 'back.out(1.6)' }) })
      gsap.fromTo(codeCard.position, { x: -26 }, { x: -19.5, duration: 0.9, ease: 'power3.out' })
    },
    leave() {},
    dispose: unsub,
  }
}
