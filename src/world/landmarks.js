import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvasTex, basic, glow, dark, F_SANS, F_SERIF, F_MONO, PINK, VIOLET, seeded } from './helpers.js'
import { instanceModel, dynamicInstances } from './kits.js'
import { LOCATIONS, PROFILE, STATS, GATES, byId } from './portfolio.js'

const INK = '#0a0c10', PAPER = '#f2efe8', ACC = '#ffb562', MUTE = 'rgba(242,239,232,.62)', LINE = 'rgba(242,239,232,.18)'
const TAU = Math.PI * 2

/**
 * The physical portfolio: a welcome gantry, the Profile monolith, Experience gates, one small environment per project,
 * the 3D Lab and the Contact tower. Built from portfolio data; each location also gets a `view` (hero camera shot).
 */
export function createLandmarks({ scene, addStatic, tickers, camObs, isMobile, kits, plainMat }) {
  const projects = LOCATIONS.filter((l) => l.type === 'project')
  const live = new Map() // project id → animated board
  const tex = (w, h, draw) => canvasTex(w, h, draw)
  const plate = (w, h, pw, ph, draw, opts = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(tex(pw, ph, draw), { depthWrite: opts.depthWrite ?? true, transparent: opts.transparent ?? false, ...(opts.mat || {}) }))
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m }
  const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra })
  const roots = [] // every landmark group, merged into few draw calls once built
  const group = (x, z, ry = 0, s = 1) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); scene.add(g); roots.push(g); return g }
  const animated = new Set() // objects a ticker moves — never baked into a merged mesh
  const anim = (o) => { animated.add(o); return o }
  const MERGEABLE = new Set(['BoxGeometry', 'CylinderGeometry'])
  const matKey = (m) => `${m.type}|${m.color.r.toFixed(3)},${m.color.g.toFixed(3)},${m.color.b.toFixed(3)}|${m.emissive ? `${m.emissive.r.toFixed(3)},${m.emissive.g.toFixed(3)},${m.emissive.b.toFixed(3)}` : ''}|${m.emissiveIntensity ?? ''}|${m.roughness ?? ''}|${m.metalness ?? ''}|${m.flatShading ? 1 : 0}|${m.toneMapped ? 1 : 0}`
  /** Bake a group's static, untextured boxes and cylinders into one mesh per material (dozens of draw calls → a handful). */
  function mergeStatic(g) {
    g.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), local = new THREE.Matrix4(), buckets = new Map(), gone = []
    const moves = (o) => { for (let p = o; p && p !== g.parent; p = p.parent) if (animated.has(p)) return true; return false }
    g.traverse((o) => {
      const m = o.material
      if (!o.isMesh || o.isInstancedMesh || !MERGEABLE.has(o.geometry.type) || !m || Array.isArray(m) || !m.color || m.map || m.transparent || m.wireframe || m.side !== THREE.FrontSide || moves(o)) return
      const key = matKey(m), geo = o.geometry.clone(); geo.applyMatrix4(local.multiplyMatrices(inv, o.matrixWorld))
      let b = buckets.get(key); if (!b) buckets.set(key, (b = { mat: m, geos: [] })); b.geos.push(geo); gone.push(o)
    })
    for (const o of gone) o.removeFromParent()
    for (const { mat, geos } of buckets.values()) { const merged = mergeGeometries(geos); if (merged) g.add(new THREE.Mesh(merged, mat)); geos.forEach((x) => x.dispose()) }
  }
  const view = (id, from, at) => { const l = byId(id); if (l) l.view = { from, at } }
  const text = (x, str, xx, yy, { font, color = PAPER, align = 'left', max } = {}) => { x.font = font; x.fillStyle = color; x.textAlign = align; x.fillText(str, xx, yy, max) }

  /* ------------------------------------------------------------------ overhead signs */
  function gantry(cx, cz, yaw, span, label, sub) {
    const g = group(cx, cz, yaw)
    for (const s of [-1, 1]) { g.add(box(0.5, 9, 0.5, dark(0x14171c, 0.4, 0.6), s * (span / 2 + 0.6), 4.5, 0)); addStatic(cx + Math.cos(yaw) * s * (span / 2 + 0.6), cz - Math.sin(yaw) * s * (span / 2 + 0.6), 0.6) }
    g.add(box(span + 1.7, 0.4, 0.6, dark(0x14171c, 0.4, 0.6), 0, 9.1, 0))
    g.add(box(span + 1.7, 0.06, 0.66, glow(PINK, 2.2), 0, 8.86, 0))
    for (const side of [1, -1]) {
      const p = plate(span * 0.7, 1.9, 1200, 320, (x, w, h) => {
        x.fillStyle = INK; x.fillRect(0, 0, w, h); x.fillStyle = ACC; x.fillRect(0, 0, w, 6)
        text(x, label.toUpperCase(), 44, 150, { font: `300 92px ${F_SANS}`, max: w - 88 }); text(x, sub.toUpperCase(), 46, 250, { font: `300 38px ${F_MONO}`, color: MUTE, max: w - 92 })
      })
      p.position.set(0, 7.9, side * 0.34); if (side < 0) p.rotation.y = Math.PI; g.add(p)
    }
    return g
  }

  /* ------------------------------------------------------------------ arrival sign (north avenue, seen from the roundabout) */
  function buildArrival() {
    const Z = -28, g = group(0, Z)
    for (const s of [-1, 1]) { g.add(box(0.5, 13, 0.5, dark(0x14171c, 0.4, 0.6), s * 8.4, 6.5, 0)); addStatic(s * 8.4, Z, 0.6) }
    g.add(box(17.6, 0.36, 0.6, dark(0x14171c, 0.4, 0.6), 0, 13, 0)); g.add(box(17.6, 0.06, 0.66, glow(PINK, 2.2), 0, 12.78, 0))
    const p = plate(15.6, 5.2, 1800, 600, (x, w, h) => {
      x.fillStyle = 'rgba(8,10,14,.92)'; x.fillRect(0, 0, w, h); x.fillStyle = ACC; x.fillRect(0, 0, w, 7)
      text(x, PROFILE.name.split(' ')[0], 70, 270, { font: `200 250px ${F_SANS}` }); text(x, PROFILE.name.split(' ')[1], 810, 270, { font: `italic 400 250px ${F_SERIF}`, color: '#ffe2bd' })
      text(x, PROFILE.title.toUpperCase(), 76, 380, { font: `300 46px ${F_MONO}`, color: ACC }); text(x, 'WELCOME TO MY DIGITAL WORLD', 76, 470, { font: `300 40px ${F_MONO}`, color: MUTE })
      text(x, `${PROFILE.place.toUpperCase()}  ·  ${PROFILE.availability.toUpperCase()}`, 76, 540, { font: `300 32px ${F_MONO}`, color: MUTE })
    })
    p.position.set(0, 9.6, 0.32); g.add(p); const q = p.clone(); q.rotation.y = Math.PI; q.position.z = -0.32; g.add(q)
  }

  /* ------------------------------------------------------------------ profile: a quiet monolith */
  function buildAbout() {
    const l = byId('about'), [cx, cz] = l.pos, g = group(cx, cz)
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.6, 8.8, 96), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.34; g.add(ring)
    const slab = box(6.4, 13.5, 0.9, dark(0x0d0f13, 0.35, 0.5), 0, 6.75, 0); g.add(slab)
    const face = plate(6.0, 13.1, 900, 1960, (x, w, h) => {
      x.fillStyle = '#0b0d11'; x.fillRect(0, 0, w, h); x.fillStyle = ACC; x.fillRect(60, 80, 90, 3)
      text(x, 'PROFILE', 60, 150, { font: `300 38px ${F_MONO}`, color: ACC }); text(x, PROFILE.name.split(' ')[0], 60, 330, { font: `200 150px ${F_SANS}` }); text(x, PROFILE.name.split(' ').slice(1).join(' '), 60, 470, { font: `italic 400 150px ${F_SERIF}`, color: '#ffe2bd' })
      text(x, PROFILE.title.toUpperCase(), 62, 550, { font: `300 30px ${F_MONO}`, color: MUTE, max: w - 120 })
      STATS.forEach(([a, b], i) => { const y = 780 + i * 250; text(x, a, 60, y, { font: `200 170px ${F_SANS}` }); text(x, b.toUpperCase(), 62, y + 62, { font: `300 32px ${F_MONO}`, color: MUTE }); x.fillStyle = LINE; x.fillRect(60, y + 105, w - 120, 2) })
    })
    face.position.set(0, 6.75, 0.47); g.add(face); const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -0.47; g.add(back)
    g.add(box(6.4, 0.16, 0.95, glow(PINK, 2.4), 0, 13.6, 0))
    g.lookAt(l.spawn[0], 0, l.spawn[1]) // the front faces the road you arrive on
    addStatic(cx, cz, 4.4)
    view('about', [cx + 27, 8.5, cz + 14], [cx, 6.5, cz])
  }

  /* ------------------------------------------------------------------ experience: three gates across the boulevard */
  function buildExperience() {
    gantry(GATES[0] - 20, 0, Math.PI / 2, 12, 'Experience District', 'Where I have worked')
    LOCATIONS.filter((l) => l.type === 'experience').forEach((j, i) => {
      const x = GATES[i], g = group(x, 0, Math.PI / 2)
      for (const s of [-1, 1]) { g.add(box(0.7, 10, 0.7, dark(0x14171c, 0.4, 0.6), s * 7.8, 5, 0)); g.add(box(0.08, 10.1, 0.08, glow(PINK, 2.4), s * 7.8, 5.05, -0.4)); addStatic(x, s * 7.8, 0.8) }
      g.add(box(16.8, 0.5, 0.8, dark(0x14171c, 0.4, 0.6), 0, 10.2, 0)); g.add(box(16.8, 0.06, 0.86, glow(PINK, 2.4), 0, 9.92, 0))
      const mk = () => plate(11.4, 3.4, 1500, 450, (c, w, h) => {
        c.fillStyle = 'rgba(8,10,14,.94)'; c.fillRect(0, 0, w, h); c.fillStyle = ACC; c.fillRect(0, 0, w, 6)
        text(c, j.period.toUpperCase(), 56, 84, { font: `300 40px ${F_MONO}`, color: ACC }); text(c, j.title, 56, 235, { font: `200 118px ${F_SANS}`, max: w - 220 }); text(c, j.role, 58, 340, { font: `italic 400 66px ${F_SERIF}`, color: MUTE, max: w - 120 })
        text(c, `0${i + 1} / 03`, w - 56, 84, { font: `300 36px ${F_MONO}`, color: MUTE, align: 'right' })
      })
      const a = mk(); a.position.set(0, 8.2, -0.45); a.rotation.y = Math.PI; g.add(a); const b = mk(); b.position.set(0, 8.2, 0.45); g.add(b)
      view(j.id, [x - 20, 7, 1.5], [x, 6.5, 0]) // over the boulevard: the south side is a wall of buildings
    })
  }

  /* ------------------------------------------------------------------ project boards (screenshot or live visual) */
  const BW = 1024, BH = 600
  function drawViz(kind, x, X, Y, W, H, tt) {
    x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip(); x.fillStyle = '#0d1014'; x.fillRect(X, Y, W, H)
    if (kind === 'grid') { const cols = 12, rows = 5, sz = W / cols; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const hot = tt ? Math.sin(tt * 2.4 - i * 0.55 - j * 0.9) > 0.55 : (i * 7 + j * 3) % 5 === 0; x.fillStyle = hot ? ACC : 'rgba(255,255,255,.10)'; x.beginPath(); x.roundRect(X + i * sz + 8, Y + j * sz + 14, sz - 16, sz - 16, hot ? (sz - 16) / 2 : 8); x.fill() } }
    if (kind === 'bars') { const n = 28, sz = W / n; for (let i = 0; i < n; i++) { const h = (0.25 + 0.7 * Math.abs(Math.sin(i * 0.7 + tt * 1.6) * Math.cos(i * 0.31 - tt * 0.9))) * H; x.fillStyle = 'rgba(157,184,255,.65)'; x.fillRect(X + i * sz + 4, Y + H - h, sz - 8, h) } text(x, '1.2M q/s', X + 40, Y + 90, { font: `300 60px ${F_MONO}` }) }
    if (kind === 'cube') { const cx = X + W / 2, cy = Y + H / 2, sc = 100, ay = tt * 0.9, ax = 0.55, ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax)
      const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([px, py, pz]) => { const x1 = px * ca + pz * sa, z1 = -px * sa + pz * ca, y2 = py * cb - z1 * sb, z2 = py * sb + z1 * cb, f = 1 / (1 + z2 * 0.12); return [cx + x1 * sc * f, cy + y2 * sc * f] })
      x.strokeStyle = ACC; x.lineWidth = 4; for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { x.beginPath(); x.moveTo(...v[a]); x.lineTo(...v[b]); x.stroke() } }
    if (kind === 'tree') { [[0, 0, 40], [6, 1, 30], [6, 2, 52], [12, 3, 26], [12, 4, 44], [18, 5, 34]].forEach(([ind, r, w], i) => { x.fillStyle = tt && i === Math.floor(tt * 2) % 6 ? ACC : 'rgba(157,184,255,.35)'; x.beginPath(); x.roundRect(X + 50 + ind * 14, Y + 30 + r * 46, w * 9, 30, 6); x.fill() }) }
    if (kind === 'ball') { const cx = X + W / 3 + (tt ? Math.sin(tt * 1.2) * 60 : 0), cy = Y + H / 2; x.fillStyle = '#eee'; x.beginPath(); x.arc(cx, cy, 90, 0, 7); x.fill(); x.fillStyle = '#111'; for (let i = 0; i < 5; i++) { const a = i * 1.2566 + tt * 2.2; x.beginPath(); x.arc(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, 20, 0, 7); x.fill() } text(x, '2026', X + W / 2 + 10, cy + 60, { font: `italic 400 190px ${F_SERIF}`, color: ACC }) }
    if (kind === 'json') { const L = [['{', '#888'], ['  "tool": "json",', ACC], ['  "fast": true,', '#9db8ff'], ['  "free": true', '#9db8ff'], ['}', '#888']]; let left = tt ? Math.floor(tt * 16) % 110 : 999; L.forEach(([t2, c], i) => { text(x, t2.slice(0, Math.max(0, left)), X + 60, Y + 70 + i * 62, { font: `300 46px ${F_MONO}`, color: c }); left -= t2.length }) }
    x.restore()
  }
  const VZ = { x: 36, y: 74, w: BW - 72, h: 382 }
  function makeBoard(p) {
    const S = document.createElement('canvas'); S.width = BW; S.height = BH
    const x = S.getContext('2d'); x.fillStyle = '#0a0c10'; x.fillRect(0, 0, BW, BH); x.fillStyle = ACC; x.fillRect(0, 0, BW, 5)
    text(x, `${p.n} — ${p.kicker.split(' · ')[0]}`.toUpperCase(), 36, 50, { font: `300 26px ${F_MONO}`, color: ACC }); text(x, p.host.toUpperCase() + ' ↗', BW - 36, 50, { font: `300 26px ${F_MONO}`, color: MUTE, align: 'right' })
    text(x, p.title, 36, 540, { font: `200 84px ${F_SANS}` }); text(x, p.subtitle.toUpperCase(), 38, 580, { font: `300 24px ${F_MONO}`, color: MUTE, max: BW - 76 })
    const L = document.createElement('canvas'); L.width = BW; L.height = BH; const lx = L.getContext('2d')
    const t = new THREE.CanvasTexture(L); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = isMobile ? 4 : 8
    let img = null
    const render = (tt) => {
      lx.drawImage(S, 0, 0)
      if (img) { const ih = VZ.w * (img.height / img.width), pan = Math.max(0, ih - VZ.h) * (tt ? 0.5 - 0.5 * Math.cos(tt * 0.45) : 0); lx.save(); lx.beginPath(); lx.rect(VZ.x, VZ.y, VZ.w, VZ.h); lx.clip(); lx.drawImage(img, VZ.x, VZ.y - pan, VZ.w, ih); lx.restore() }
      else drawViz(p.viz, lx, VZ.x, VZ.y, VZ.w, VZ.h, tt)
      lx.strokeStyle = LINE; lx.strokeRect(VZ.x, VZ.y, VZ.w, VZ.h); t.needsUpdate = true
    }
    render(0)
    if (p.shot) { const im = new Image(); im.onload = () => { img = im; render(0) }; im.src = `/shots/${p.shot}.webp` }
    return { tex: t, render, last: -1 }
  }
  function board(p) {
    const [bx, bz] = p.board, g = group(bx, bz, p.face)
    g.add(box(0.26, 2.9, 0.26, dark(0x14171c, 0.4, 0.6), 0, 1.45, 0))
    g.add(box(6.6, 3.9, 0.2, dark(0x0d0f13, 0.4, 0.5), 0, 4.6, 0)); g.add(box(6.6, 0.06, 0.24, glow(PINK, 2), 0, 6.58, 0))
    const lv = makeBoard(p); const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.35, 3.7), basic(lv.tex, { transparent: false })); scr.position.set(0, 4.6, 0.11); g.add(scr)
    addStatic(bx, bz, 0.5); for (const k of [-2.4, 0, 2.4]) camObs.push({ x: bx, z: bz + k, r: 1.6, top: 7 })
    live.set(p.id, lv)
  }

  /* ------------------------------------------------------------------ one environment per project */
  const SET_X = 22
  function setGroup(p) { return group(p.side * SET_X, p.pos[1], p.face) }
  function uiCard(kind) {
    return tex(512, 352, (x, w, h) => {
      x.fillStyle = 'rgba(250,248,243,.96)'; x.beginPath(); x.roundRect(6, 6, w - 12, h - 12, 26); x.fill(); x.strokeStyle = 'rgba(10,12,16,.12)'; x.lineWidth = 3; x.stroke()
      const dk = '#15181d'
      if (kind === 0) { x.fillStyle = dk; x.beginPath(); x.roundRect(60, 120, 250, 96, 20); x.fill(); text(x, 'Button', 185, 182, { font: `400 46px ${F_SANS}`, color: '#fff', align: 'center' }); x.strokeStyle = dk; x.lineWidth = 4; x.beginPath(); x.roundRect(340, 120, 120, 96, 20); x.stroke() }
      if (kind === 1) { x.fillStyle = dk; x.beginPath(); x.roundRect(70, 130, 170, 84, 42); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(198, 172, 32, 0, 7); x.fill(); x.strokeStyle = dk; x.lineWidth = 4; x.beginPath(); x.roundRect(290, 130, 170, 84, 42); x.stroke(); x.beginPath(); x.arc(332, 172, 32, 0, 7); x.stroke() }
      if (kind === 2) { x.strokeStyle = dk; x.lineWidth = 4; x.beginPath(); x.roundRect(50, 110, w - 100, 100, 16); x.stroke(); text(x, 'Email address', 80, 178, { font: `300 42px ${F_SANS}`, color: 'rgba(20,24,29,.45)' }); x.fillStyle = ACC; x.fillRect(50, 226, 190, 8) }
      if (kind === 3) { ['Tokens', 'Themes', 'Motion'].forEach((s, i) => { x.fillStyle = i < 2 ? dk : 'transparent'; x.strokeStyle = dk; x.lineWidth = 4; x.beginPath(); x.roundRect(70, 60 + i * 84, 44, 44, 10); x.fill(); x.stroke(); if (i < 2) { x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(80, 82 + i * 84); x.lineTo(90, 92 + i * 84); x.lineTo(106, 72 + i * 84); x.stroke() } text(x, s, 140, 96 + i * 84, { font: `300 44px ${F_SANS}`, color: dk }) }) }
      if (kind === 4) { ['Vue', 'Nuxt', 'TS', 'UI'].forEach((s, i) => { x.fillStyle = i % 2 ? '#e5e0d4' : dk; x.beginPath(); x.roundRect(40 + (i % 2) * 220, 70 + Math.floor(i / 2) * 120, 200, 90, 45); x.fill(); text(x, s, 140 + (i % 2) * 220, 132 + Math.floor(i / 2) * 120, { font: `400 44px ${F_SANS}`, color: i % 2 ? dk : '#fff', align: 'center' }) }) }
      if (kind === 5) { x.fillStyle = 'rgba(20,24,29,.12)'; x.fillRect(60, 170, w - 120, 10); x.fillStyle = ACC; x.fillRect(60, 170, 260, 10); x.fillStyle = dk; x.beginPath(); x.arc(320, 175, 24, 0, 7); x.fill(); text(x, '64%', 60, 120, { font: `300 46px ${F_MONO}`, color: dk }) }
    })
  }
  const setBuilders = {
    raya(p) { // a component studio: floating UI cards over a white plinth
      const g = setGroup(p); g.add(box(15, 0.36, 10.5, lam(0xb9b6ae), 0, 0.18, 0)); g.add(box(15.4, 0.06, 10.9, glow(PINK, 1.6), 0, 0.02, 0))
      const cards = [[-4.6, 2.6, 0.4], [0, 4.5, -0.6], [4.6, 2.6, 0.3], [-2.4, 5.6, -1.8], [2.6, 6.2, -2], [0, 2.3, 2.4]]
      cards.forEach(([x, y, z], i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.48), new THREE.MeshBasicMaterial({ map: uiCard(i), color: 0xb8b8b8, transparent: true, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = (i % 2 ? -1 : 1) * 0.16; g.add(m); tickers.push((t) => { m.position.y = y + Math.sin(t * 0.9 + i * 1.3) * 0.16 }) })
      g.add(box(0.08, 8, 0.08, glow(PINK, 1.4), -6.9, 4, -4.5)); g.add(box(0.08, 8, 0.08, glow(PINK, 1.4), 6.9, 4, -4.5)); g.add(box(13.9, 0.08, 0.08, glow(PINK, 1.4), 0, 8, -4.5))
      addStatic(p.side * SET_X, p.pos[1], 5.5)
    },
    hotelyar(p) { // a small hotel: facade, entrance awning and parasols
      const g = setGroup(p); const wall = lam(0xb7b1a5)
      g.add(box(12, 9.2, 6.6, wall, 0, 4.6, -2.4)); g.add(box(12.3, 0.4, 6.9, lam(0x2b2e34), 0, 9.3, -2.4))
      const fac = plate(11.6, 9, 1160, 900, (x, w, h) => {
        x.fillStyle = '#d9d3c7'; x.fillRect(0, 0, w, h); const r = seeded(9)
        for (let row = 0; row < 3; row++) for (let c = 0; c < 6; c++) { const lit = r() > 0.42; x.fillStyle = lit ? '#ffd9a0' : '#2c3542'; x.fillRect(50 + c * 180, 60 + row * 220, 110, 150); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(50 + c * 180, 60 + row * 220 + 74, 110, 4) }
        x.fillStyle = '#20252d'; x.fillRect(w / 2 - 130, h - 240, 260, 240); x.fillStyle = 'rgba(255,217,160,.5)'; x.fillRect(w / 2 - 118, h - 228, 236, 228)
      }); fac.position.set(0, 4.55, 0.92); g.add(fac)
      g.add(box(6, 0.22, 2.6, glow(PINK, 0.7), 0, 3.6, 2.2)); g.add(box(0.14, 3.6, 0.14, dark(0x20252d), -2.7, 1.8, 3.3)); g.add(box(0.14, 3.6, 0.14, dark(0x20252d), 2.7, 1.8, 3.3))
      const sign = plate(6, 1.2, 900, 180, (x, w, h) => { x.fillStyle = '#0d0f13'; x.fillRect(0, 0, w, h); x.fillStyle = ACC; x.fillRect(0, h - 8, w, 8); text(x, 'HOTELYAR', w / 2, 118, { font: `300 92px ${F_SANS}`, align: 'center' }) }); sign.position.set(0, 10.4, 1); g.add(sign)
      const para = kits.city.get('com/detail-parasol-a'); if (para) for (const s of [-1, 1]) for (const m of instanceModel(para, [{ x: 0, y: 0, z: 0, ry: 0, s: 10 }], { material: (pt) => plainMat(pt) })) { m.position.set(s * 4.2, 0, 5); g.add(m) }
      addStatic(p.side * SET_X, p.pos[1] - 2, 6.2)
    },
    woodcoder(p) { // a workshop with a table whose width keeps changing — the configurator idea, physically
      const g = setGroup(p), wood = lam(0xb98b5e), dwood = lam(0x6b4a32)
      for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) g.add(box(0.36, 4.4, 0.36, dwood, x, 2.2, z))
      g.add(box(11.2, 0.3, 7.4, dwood, 0, 4.5, 0)); g.add(box(11.5, 0.06, 7.7, glow(PINK, 1.4), 0, 4.32, 0))
      g.add(box(8, 0.2, 3, wood, 0, 1.05, -0.4))
      const top = anim(box(1, 0.16, 2.2, lam(0xe2c79f), 0, 1.66, -0.4)); g.add(top)
      const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => { const l = anim(box(0.14, 0.55, 0.14, lam(0xe2c79f), 0, 1.3, -0.4 + sz * 0.9)); g.add(l); return { l, sx } })
      const dim = anim(box(1, 0.05, 0.05, glow(0x9db8ff, 2.4), 0, 2.15, 1.2)); g.add(dim)
      tickers.push((t) => { const w = 2.4 + (Math.sin(t * 0.8) * 0.5 + 0.5) * 2.6; top.scale.x = w; dim.scale.x = w; for (const { l, sx } of legs) l.position.x = sx * (w / 2 - 0.15) })
      const logs = kits.nature; const lg = [['nat/log_stack', -8, -2, 5.2], ['nat/log', 8, 1.5, 5], ['nat/log_large', 8.5, -3, 5]]
      for (const [n, x, z, s] of lg) { const m = logs.get(n); if (m) for (const im of instanceModel(m, [{ x: 0, y: 0, z: 0, ry: 0.6, s }], { material: (pt) => plainMat(pt) })) { im.position.set(x, 0, z); g.add(im) } }
      addStatic(p.side * SET_X, p.pos[1], 5.4)
    },
    rizo(p) { // an edge platform: server racks with an orbit of nodes around them
      const g = setGroup(p); const disc = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.6, 0.3, 48), lam(0x4a505b)); disc.position.y = 0.15; g.add(disc)
      const led = tex(128, 256, (x, w, h) => { x.fillStyle = '#0d0f13'; x.fillRect(0, 0, w, h); const r = seeded(5); for (let i = 0; i < 14; i++) for (let j = 0; j < 3; j++) { x.fillStyle = r() > 0.6 ? ACC : r() > 0.5 ? '#9db8ff' : '#2a2f38'; x.fillRect(16 + j * 34, 10 + i * 17, 24, 8) } })
      for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.5, x = Math.sin(a) * 4.4, z = -Math.cos(a) * 4.4 + 4.4; const rack = box(1.5, 4.2, 1.3, lam(0x2d323b), x, 2.4, z - 1.2); rack.rotation.y = -a; g.add(rack); const f = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 3.9), new THREE.MeshBasicMaterial({ map: led, toneMapped: false })); f.position.set(0, 0, 0.66); rack.add(f) }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.05, 6, 80), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 6.4; g.add(ring)
      const nodes = Array.from({ length: 6 }, (_, i) => { const n = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9db8ff : PINK, toneMapped: false })); g.add(n); return n })
      tickers.push((t) => { ring.rotation.z = t * 0.2; nodes.forEach((n, i) => { const a = t * 0.5 + (i / 6) * TAU; n.position.set(Math.cos(a) * 6.6, 6.4 + Math.sin(a * 2 + i) * 0.4, Math.sin(a) * 6.6) }) })
      addStatic(p.side * SET_X, p.pos[1], 5.2)
    },
    tricup(p) { // a mini stadium: pitch, goals, stand and a hovering match ball
      const g = setGroup(p)
      const pitch = plate(13, 8.4, 1300, 840, (x, w, h) => { x.fillStyle = '#3d7a4b'; x.fillRect(0, 0, w, h); for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'; x.fillRect(i * 130, 0, 130, h) } x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 6; x.strokeRect(30, 30, w - 60, h - 60); x.beginPath(); x.moveTo(w / 2, 30); x.lineTo(w / 2, h - 30); x.stroke(); x.beginPath(); x.arc(w / 2, h / 2, 90, 0, 7); x.stroke(); x.strokeRect(30, h / 2 - 150, 150, 300); x.strokeRect(w - 180, h / 2 - 150, 150, 300) }, { mat: { toneMapped: true } })
      pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0.1, 1.4); g.add(pitch)
      for (const s of [-1, 1]) { const goal = new THREE.Group(); goal.position.set(s * 6.3, 0, 1.4); goal.add(box(0.12, 2.2, 0.12, lam(0xffffff), 0, 1.1, -1.5)); goal.add(box(0.12, 2.2, 0.12, lam(0xffffff), 0, 1.1, 1.5)); goal.add(box(0.12, 0.12, 3.1, lam(0xffffff), 0, 2.2, 0)); g.add(goal) }
      const st = kits.racing.get('race/grandStand'); if (st) for (const im of instanceModel(st, [{ x: 0, y: 0, z: 0, ry: 0, s: 8 }], { material: (pt) => plainMat(pt) })) { im.position.set(0, 0, -4.4); g.add(im) }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 16), new THREE.MeshLambertMaterial({ map: tex(256, 128, (x, w, h) => { x.fillStyle = '#f4f2ee'; x.fillRect(0, 0, w, h); x.fillStyle = '#15181d'; for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { x.beginPath(); x.arc(20 + i * 44 + (j % 2) * 22, 22 + j * 44, 11, 0, 7); x.fill() } }) })); g.add(ball)
      const flagM = kits.racing.get('race/flagCheckers'); if (flagM) for (const [fx, fz] of [[-6.6, 5.4], [6.6, 5.4]]) for (const im of instanceModel(flagM, [{ x: 0, y: 0, z: 0, ry: 0, s: 5 }], { material: (pt) => plainMat(pt) })) { im.position.set(fx, 0, fz); g.add(im) }
      tickers.push((t) => { ball.position.set(Math.sin(t * 0.6) * 2.2, 3.4 + Math.sin(t * 1.4) * 0.35, 1.4); ball.rotation.y = t * 1.6; ball.rotation.x = t * 0.7 })
      addStatic(p.side * SET_X, p.pos[1], 5.8)
    },
    tinyhub(p) { // a developer lab: monitors full of tools and a turning gear
      const g = setGroup(p); g.add(box(11.2, 4.6, 5.2, lam(0x2a2f3a), 0, 2.3, -2.8)); g.add(box(11.5, 0.07, 5.5, glow(PINK, 1.6), 0, 4.62, -2.8))
      const screens = [
        (x, w, h) => { x.fillStyle = '#0c0e12'; x.fillRect(0, 0, w, h); ['{', '  "tool": "json",', '  "fast": true,', '  "free": true', '}'].forEach((s, i) => text(x, s, 26, 60 + i * 52, { font: `300 34px ${F_MONO}`, color: i % 2 ? ACC : '#9db8ff' })) },
        (x, w, h) => { x.fillStyle = '#0c0e12'; x.fillRect(0, 0, w, h); ['$ npm run format', '✓ 3 files prettified', '✓ syntax highlighted', '$ share --link'].forEach((s, i) => text(x, s, 26, 60 + i * 56, { font: `300 32px ${F_MONO}`, color: i % 2 ? '#8fe3b1' : PAPER })) },
        (x, w, h) => { x.fillStyle = '#0c0e12'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { x.fillStyle = i % 3 === 0 ? 'rgba(255,181,98,.28)' : 'rgba(157,184,255,.2)'; x.fillRect(20, 20 + i * 46, 60 + ((i * 97) % 300), 30) } },
      ]
      screens.forEach((d, i) => { const s = plate(2.9, 1.9, 512, 336, d, { mat: { toneMapped: false } }); s.position.set(-3.6 + i * 3.6, 2.5, 0.03 - 0.2); g.add(s) })
      g.add(box(11.6, 0.16, 2.2, lam(0x8d949f), 0, 1.2, 1.4)); g.add(box(0.2, 1.2, 0.2, lam(0x666c77), -5, 0.6, 1.9)); g.add(box(0.2, 1.2, 0.2, lam(0x666c77), 5, 0.6, 1.9))
      const gear = anim(new THREE.Group()); gear.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.35, 16), glow(PINK, 1.6))); for (let i = 0; i < 10; i++) { const t2 = box(0.45, 0.35, 0.6, glow(PINK, 1.6), Math.cos((i / 10) * TAU) * 1.45, 0, Math.sin((i / 10) * TAU) * 1.45); t2.rotation.y = -(i / 10) * TAU; gear.add(t2) }
      gear.rotation.x = Math.PI / 2; gear.position.set(0, 6.4, -2.8); g.add(gear); tickers.push((t) => { gear.rotation.z = t * 0.6 })
      addStatic(p.side * SET_X, p.pos[1] - 2, 5.8)
    },
  }

  /* ------------------------------------------------------------------ 3D lab: a dome and four live exhibits */
  const lab = { orb: null, field: null, balls: null, turntable: null, near: 0 }
  const labU = { uTime: { value: 0 }, uNear: { value: 0 } }
  function plinth(g, x, z, label, h = 1.1) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, h, 8), lam(0x1a1d23)); p.position.set(x, h / 2, z); g.add(p)
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.42, 48), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.05, z); g.add(ring)
    const tag = plate(2.1, 0.5, 400, 96, (c, w, h) => { c.fillStyle = 'rgba(8,10,14,.92)'; c.fillRect(0, 0, w, h); text(c, label.toUpperCase(), w / 2, 62, { font: `300 38px ${F_MONO}`, align: 'center', color: ACC }) })
    tag.position.set(x, h * 0.55, z + 2.05); tag.rotation.x = -0.25; g.add(tag)
  }
  function buildLab() {
    const l = byId('lab'), [cx, cz] = l.pos, g = group(cx, cz)
    const slab = new THREE.Group(); slab.position.set(14, 0, 0); slab.rotation.y = Math.PI / 2; g.add(slab)
    slab.add(box(7.4, 3.4, 0.4, dark(0x0d0f13, 0.35, 0.5), 0, 1.7, 0)); slab.add(box(7.4, 0.06, 0.46, glow(PINK, 2.2), 0, 3.42, 0))
    const lsign = plate(7.1, 3.1, 1420, 620, (x, w, h) => { x.fillStyle = '#0b0d11'; x.fillRect(0, 0, w, h); text(x, 'EXPERIMENTS IN WEBGL', 50, 80, { font: `300 38px ${F_MONO}`, color: ACC }); text(x, '3D Lab', 50, 300, { font: `200 210px ${F_SANS}` }); text(x, 'THREE.JS  ·  GLSL  ·  GSAP  ·  GLTF', 54, 470, { font: `300 40px ${F_MONO}`, color: MUTE }) }); lsign.position.set(0, 1.7, 0.22); slab.add(lsign)
    addStatic(cx + 14, cz, 3.6)
    // dome + gyroscope
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(5.6, 1), new THREE.MeshBasicMaterial({ color: 0x9db8ff, wireframe: true, transparent: true, opacity: 0.55, toneMapped: false })); dome.position.y = 3.2; dome.scale.y = 0.85; g.add(dome)
    const glass = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5, 1), new THREE.MeshBasicMaterial({ color: 0x9db8ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })); glass.position.copy(dome.position); glass.scale.copy(dome.scale); g.add(glass)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6, 0.4, 24), lam(0x4a505b)); base.position.y = 0.2; g.add(base)
    const gyro = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * 0.6, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: i === 1 ? 0x9db8ff : PINK, toneMapped: false })); r.position.y = 11; g.add(r); return r })
    g.add(box(0.5, 6.6, 0.5, dark(0x14171c, 0.4, 0.6), 0, 7.6, 0))
    tickers.push((t) => { gyro.forEach((r, i) => { r.rotation.x = t * (0.6 + i * 0.25) + i; r.rotation.y = t * (0.4 - i * 0.2) }); dome.rotation.y = t * 0.05 })
    addStatic(cx, cz, 6.2)
    // exhibit 1: shader orb
    plinth(g, 9, -9, 'Shaders')
    lab.orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 5), new THREE.ShaderMaterial({ uniforms: labU, vertexShader: `uniform float uTime,uNear;varying vec3 vN;varying float vD;
      float h(vec3 p){return fract(sin(dot(p,vec3(12.9,78.2,37.7)))*43758.5);}
      float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vN=normal;float d=n(normal*2.2+uTime*(.5+uNear))*.45*(.6+uNear);vD=d;vec3 p=position+normal*d;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `varying vec3 vN;varying float vD;uniform float uNear;void main(){vec3 c=mix(vec3(.95,.92,.86),vec3(1.,.66,.28),smoothstep(0.,.5,vD));c=mix(c,vec3(.6,.72,1.),smoothstep(.3,.6,vD)*.7);float l=.55+.45*dot(normalize(vN),normalize(vec3(.4,.8,.5)));gl_FragColor=vec4(c*l*(1.1+uNear*.5),1.);}` }))
    lab.orb.position.set(9, 3, -9); g.add(lab.orb); addStatic(cx + 9, cz - 9, 2)
    // exhibit 2: particle field
    plinth(g, 9, 9, 'Particles')
    const N = isMobile ? 700 : 1600, pp = new Float32Array(N * 3), pr = new Float32Array(N), r = seeded(3)
    for (let i = 0; i < N; i++) { const rad = 0.3 + Math.pow(r(), 0.7) * 2.6, arm = Math.floor(r() * 3), a = (arm / 3) * TAU + rad * 1.4 + (r() - 0.5) * 0.5; pp[i * 3] = Math.cos(a) * rad; pp[i * 3 + 1] = (r() - 0.5) * 0.4 * (3 - rad); pp[i * 3 + 2] = Math.sin(a) * rad; pr[i] = rad }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); fg.setAttribute('aR', new THREE.BufferAttribute(pr, 1))
    lab.field = new THREE.Points(fg, new THREE.ShaderMaterial({ uniforms: { ...labU, uPx: { value: Math.min(devicePixelRatio || 1, 1.5) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aR;uniform float uTime,uNear,uPx;varying float vR;void main(){float a=uTime*(.5+uNear*1.6)/(.6+aR*.5);float c=cos(a),s=sin(a);vec3 p=vec3(position.x*c-position.z*s,position.y,position.x*s+position.z*c);vR=aR;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(2.4+uNear*1.2)*uPx*(28./-mv.z);}',
      fragmentShader: 'varying float vR;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;vec3 c=mix(vec3(1.,.72,.36),vec3(.6,.75,1.),smoothstep(.4,2.8,vR));gl_FragColor=vec4(c,smoothstep(.5,0.,d)*.9);}' }))
    lab.field.position.set(9, 3.4, 9); g.add(lab.field); addStatic(cx + 9, cz + 9, 2)
    // exhibit 3: glTF turntable
    plinth(g, -9, -9, 'glTF', 0.5)
    const car = kits.cars.get('car/race-future')
    if (car) { lab.turntable = dynamicInstances(car, 1, { material: plainMat }); lab.turntable.use(1); lab.turntable.meshes.forEach((m) => scene.add(m)); lab.turntable.pos = [cx - 9, 0.7, cz - 9] }
    addStatic(cx - 9, cz - 9, 2)
    // exhibit 4: physics balls to knock around
    plinth(g, -9, 9, 'Physics', 0.5)
    const count = isMobile ? 10 : 16
    lab.balls = { mesh: new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf2efe8 }), count), items: Array.from({ length: count }, (_, i) => ({ x: cx - 9 + Math.cos(i * 2.4) * (1.5 + (i % 5)), z: cz + 9 + Math.sin(i * 2.4) * (1.5 + (i % 5)) + 5, vx: 0, vz: 0, y: 0.8, vy: 0 })), c: [cx, cz] }
    lab.balls.mesh.frustumCulled = false; scene.add(lab.balls.mesh)
    view('lab', [cx + 26, 10, cz + 12], [cx, 4.5, cz])
  }
  const dm = new THREE.Object3D()
  function updateLab(t, dt, car) {
    labU.uTime.value = t
    const l = byId('lab'), [cx, cz] = l.pos, d = Math.min(Math.hypot(car.x - (cx + 9), car.z - (cz - 9)), Math.hypot(car.x - (cx + 9), car.z - (cz + 9)))
    lab.near += ((d < 22 ? 1 - d / 22 : 0) - lab.near) * Math.min(1, dt * 3); labU.uNear.value = lab.near
    if (lab.orb) lab.orb.rotation.y = t * 0.3
    if (lab.field) lab.field.rotation.y = t * 0.1
    if (lab.turntable) { const [x, y, z] = lab.turntable.pos; lab.turntable.set(0, x, y, z, t * 0.7 + Math.PI, 2.3); lab.turntable.commit() }
    const B = lab.balls; if (!B) return
    B.items.forEach((b, i) => {
      b.vx *= Math.exp(-1.3 * dt); b.vz *= Math.exp(-1.3 * dt); b.x += b.vx * dt; b.z += b.vz * dt; b.vy -= 22 * dt; b.y += b.vy * dt; if (b.y < 0.8) { b.y = 0.8; b.vy = Math.abs(b.vy) > 3 ? -b.vy * 0.4 : 0 }
      const dx = b.x - car.x, dz = b.z - car.z, dd = Math.hypot(dx, dz), m = 0.8 + 1.5
      if (dd < m && dd > 1e-3 && car.y < 1.6) { const nx = dx / dd, nz = dz / dd, rel = Math.max(0, car.vx * nx + car.vz * nz); b.x = car.x + nx * m; b.z = car.z + nz * m; b.vx += nx * (rel * 1.2 + 2); b.vz += nz * (rel * 1.2 + 2); b.vy = Math.max(b.vy, 2 + rel * 0.2) }
      for (let j = i + 1; j < B.items.length; j++) { const o = B.items[j], ex = o.x - b.x, ez = o.z - b.z, ed = Math.hypot(ex, ez); if (ed < 1.6 && ed > 1e-3) { const push = (1.6 - ed) * 0.5, nx = ex / ed, nz = ez / ed; b.x -= nx * push; b.z -= nz * push; o.x += nx * push; o.z += nz * push; const rv = (b.vx - o.vx) * nx + (b.vz - o.vz) * nz; if (rv > 0) { b.vx -= nx * rv * 0.5; b.vz -= nz * rv * 0.5; o.vx += nx * rv * 0.5; o.vz += nz * rv * 0.5 } } }
      const rx = b.x - cx, rz = b.z - cz; if (Math.abs(rx) > 15) { b.x = cx + Math.sign(rx) * 15; b.vx *= -0.5 } if (Math.abs(rz) > 15) { b.z = cz + Math.sign(rz) * 15; b.vz *= -0.5 }
      const dr = Math.hypot(rx, rz); if (dr < 7) { const k = 7 / (dr || 1); b.x = cx + rx * k; b.z = cz + rz * k; b.vx += rx / (dr || 1); b.vz += rz / (dr || 1) } // stay clear of the dome
      dm.position.set(b.x, b.y, b.z); dm.updateMatrix(); B.mesh.setMatrixAt(i, dm.matrix)
    })
    B.mesh.instanceMatrix.needsUpdate = true
  }

  /* ------------------------------------------------------------------ contact: a communication tower and terminal */
  function buildContact() {
    const l = byId('contact'), [cx, cz] = l.pos, g = group(cx, cz)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5, 0.5, 32), lam(0x4a505b)); base.position.y = 0.25; g.add(base)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 30, 10), lam(0x8a919c)); mast.position.y = 15.3; g.add(mast)
    const rings = [0, 1, 2, 3].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.8 + i * 0.8, 0.14, 8, 64), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9db8ff : PINK, toneMapped: false })); r.position.y = 12 + i * 5; g.add(r); return r })
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshBasicMaterial({ color: PINK, toneMapped: false })); beacon.position.y = 31.8; g.add(beacon)
    tickers.push((t) => { rings.forEach((r, i) => { r.rotation.x = Math.PI / 2 + Math.sin(t * 0.6 + i) * 0.3; r.rotation.z = t * (0.3 + i * 0.1) * (i % 2 ? -1 : 1) }); beacon.scale.setScalar(1 + Math.sin(t * 3) * 0.18) })
    // the terminal, facing the road you arrive on
    const k = new THREE.Group(); k.position.set(-9, 0, 0); k.rotation.y = -Math.PI / 2; g.add(k)
    k.add(box(4.6, 3.1, 0.6, dark(0x0d0f13, 0.35, 0.5), 0, 2.4, 0)); k.add(box(0.5, 0.9, 0.5, dark(0x14171c), 0, 0.45, -0.1)); k.add(box(4.6, 0.06, 0.66, glow(PINK, 2.2), 0, 3.98, 0))
    const scr = plate(4.3, 2.8, 1290, 840, (x, w, h) => {
      x.fillStyle = '#0a0c10'; x.fillRect(0, 0, w, h); x.fillStyle = ACC; x.fillRect(50, 60, 90, 3); text(x, 'COMMUNICATION TERMINAL', 50, 50, { font: `300 30px ${F_MONO}`, color: ACC })
      text(x, "Let's build", 50, 250, { font: `200 130px ${F_SANS}` }); text(x, 'something that moves.', 50, 380, { font: `italic 400 110px ${F_SERIF}`, color: '#ffe2bd', max: w - 100 })
      text(x, 'im.enzo.021@gmail.com', 52, 520, { font: `300 46px ${F_MONO}`, color: PAPER }); text(x, 'GITHUB  ·  TELEGRAM  ·  CV  —  PRESS E', 52, 640, { font: `300 30px ${F_MONO}`, color: MUTE })
    }, { mat: { toneMapped: false } })
    scr.position.set(0, 2.4, 0.32); k.add(scr)
    addStatic(cx, cz, 4.4); addStatic(cx - 9, cz, 2.6)
    view('contact', [cx - 27, 6.5, cz + 5], [cx - 6, 8, cz])
  }

  /* ------------------------------------------------------------------ project district */
  function buildProjects() {
    gantry(0, 40, 0, 12, 'Project District', 'What I have built')
    for (const p of projects) {
      board(p); setBuilders[p.id]?.(p)
      view(p.id, [-p.side * 6, 16, p.pos[1] - Math.max(14, Math.min(24, p.pos[1] - 44))], [p.side * SET_X, 3.6, p.pos[1] + 1]) // the first project sits close behind the district gantry, so its camera moves in past the beam
    }
  }

  return {
    buildAll() { buildArrival(); buildAbout(); buildExperience(); buildProjects(); buildLab(); buildContact(); roots.forEach(mergeStatic) },
    /** Per frame: animate the board of the active project and drive the lab exhibits. */
    update(t, dt, car, activeId) {
      for (const [id, lv] of live) { const on = id === activeId; if (on) { if (t - lv.last > (isMobile ? 1 / 12 : 1 / 24)) { lv.render(t); lv.last = t; lv.on = true } } else if (lv.on) { lv.render(0); lv.on = false } }
      updateLab(t, dt, car)
    },
  }
}
