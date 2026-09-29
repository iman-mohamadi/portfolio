import * as THREE from 'three'
import { canvasTex, basic, glow, dark, sprite, PINK, VIOLET, F_SANS, F_SERIF, F_MONO } from './helpers.js'
import { ZONES, STATS, SKILLS, JOBS, projZones, GATES } from './content.js'

/** Builds the landmarks of the six zones inside the city: welcome gantry, About monolith, Skills crystals, Work boards, Career gates, Contact portal. */
export function createStations({ scene, addStatic, tickers, camObs, isMobile }) {
  function buildSpawnSign() {
    const tex = canvasTex(2048, 700, (x, w, h) => {
      x.fillStyle = 'rgba(6,6,10,.82)'; x.beginPath(); x.roundRect(0, 0, w, h, 60); x.fill(); x.strokeStyle = '#ff2d8a'; x.lineWidth = 8; x.stroke()
      x.textAlign = 'left'; x.textBaseline = 'alphabetic'
      x.font = `200 300px ${F_SANS}`; x.fillStyle = '#f2efec'; x.shadowColor = '#ff2d8a'; x.shadowBlur = 14; x.fillText('Iman', 70, 300)
      x.font = `italic 400 300px ${F_SERIF}`; const g = x.createLinearGradient(730, 0, 1900, 0); g.addColorStop(0, '#ffd0e4'); g.addColorStop(1, '#ff2d8a'); x.fillStyle = g; x.fillText('Mohammadi', 720, 300)
      x.shadowBlur = 0; x.fillStyle = '#ff2d8a'; x.font = `300 46px ${F_MONO}`; x.fillText('SENIOR FRONT-END ARCHITECT  ·  WEBGL & 3D WEB SPECIALIST', 78, 420)
      x.fillStyle = 'rgba(242,239,236,.6)'; x.font = `300 38px ${F_MONO}`; x.fillText('9+ YEARS  ·  VUE / NUXT  ·  NEXT.JS  ·  THREE.JS  ·  GLSL  ·  GSAP', 78, 500)
      x.fillText('TEHRAN, IRAN  ·  AVAILABLE FOR NEW ROLES — 2026', 78, 560)
    })
    const Z = -28 // gantry across the north avenue, seen from the spawn roundabout
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 5.6), basic(tex, { depthWrite: false })); m.position.set(0, 12.6, Z); scene.add(m)
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 16, 0.6), glow(VIOLET, 2)); p.position.set(s * 8.6, 8, Z); scene.add(p); addStatic(s * 8.6, Z, 0.7) }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.35, 0.5), glow(PINK, 3)); bar.position.set(0, 16, Z); scene.add(bar)
  }

  /* ------------------------------------------------------------------ About station */
  function buildAbout() {
    const z = ZONES.find((k) => k.id === 'about'), [cx, cz] = z.pos, S = 1.7
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.scale.setScalar(S); scene.add(g)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.12, 6, 90), glow(PINK, 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; g.add(ring)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(6.2, 8.4, 0.7), dark(0x0c0c14, 0.2, 0.8)); slab.position.set(0, 4.4, 0); g.add(slab)
    const tex = canvasTex(1024, 1400, (x, w, h) => {
      x.fillStyle = '#08080d'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ff2d8a'; x.lineWidth = 6; x.strokeRect(20, 20, w - 40, h - 40)
      x.fillStyle = '#ff2d8a'; x.font = `300 40px ${F_MONO}`; x.fillText('01 — ABOUT', 70, 120)
      x.fillStyle = '#f2efec'; x.font = `200 96px ${F_SANS}`; x.fillText('Nine years', 70, 250); x.font = `italic 400 110px ${F_SERIF}`; x.fillText('of shipping.', 70, 360)
      STATS.forEach(([a, b], i) => { const y = 520 + i * 200; x.fillStyle = '#f2efec'; x.font = `200 130px ${F_SANS}`; x.fillText(a, 70, y + 90); x.fillStyle = 'rgba(242,239,236,.55)'; x.font = `300 36px ${F_MONO}`; x.fillText(b.toUpperCase(), 430, y + 80); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(70, y + 130, w - 140, 2) })
    })
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 8.1), basic(tex)); face.position.set(0, 4.4, 0.38); g.add(face)
    const face2 = face.clone(); face2.position.z = -0.38; face2.rotation.y = Math.PI; g.add(face2)
    g.lookAt(z.spawn[0], 0, z.spawn[1]) // the front faces the road you arrive on
    const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 * S, 1), new THREE.MeshBasicMaterial({ color: PINK, wireframe: true, toneMapped: false })); ico.position.set(cx, 20, cz); scene.add(ico)
    tickers.push((t) => { ico.rotation.y = t * 0.5; ico.rotation.x = t * 0.3; ico.position.y = 20 + Math.sin(t * 1.5) * 0.4 })
    const s = sprite('ABOUT', { size: 3.4 }); s.position.set(cx, 26, cz); scene.add(s)
    addStatic(cx, cz, 5.2)
  }

  /* ------------------------------------------------------------------ Skills station */
  const pylons = []
  function buildSkills() {
    const z = ZONES.find((k) => k.id === 'skills'), [cx, cz] = z.pos, S = 1.45
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.scale.setScalar(S); scene.add(g)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10, 0.12, 6, 90), glow(VIOLET, 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; g.add(ring)
    SKILLS.forEach((s, i) => {
      const a = (i / SKILLS.length) * Math.PI * 2 - Math.PI / 2, x = Math.cos(a) * 6.8, zz = Math.sin(a) * 6.8
      const col = i % 2 ? VIOLET : PINK
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2.2, 8), dark()); pole.position.set(x, 1.1, zz); g.add(pole)
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), glow(col, 2.6)); gem.scale.y = 1.5; g.add(gem)
      const wire = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), new THREE.MeshBasicMaterial({ color: col, wireframe: true, toneMapped: false, transparent: true, opacity: 0.5 })); g.add(wire)
      const lab = sprite(s.g, { size: 1.2, font: `300 96px ${F_SANS}`, accent: i % 2 ? '#7a5cff' : '#ff2d8a' }); lab.position.set(x, 6.2, zz); g.add(lab)
      addStatic(cx + x * S, cz + zz * S, 0.9 * S)
      tickers.push((t) => { const y = 3.6 + Math.sin(t * 1.4 + i) * 0.35; gem.position.set(x, y, zz); wire.position.set(x, y, zz); gem.rotation.y = t * 0.9 + i; wire.rotation.y = -t * 0.5; wire.rotation.x = t * 0.3 })
      pylons.push({ gem })
    })
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.1, 0.28, 120, 12), glow(0xff8fc0, 0.9)); knot.position.set(0, 3.5, 0); g.add(knot)
    tickers.push((t) => { knot.rotation.x = t * 0.6; knot.rotation.y = t * 0.4 })
    const s = sprite('SKILLS', { size: 3, accent: '#7a5cff' }); s.position.set(0, 11.5, 0); g.add(s)
  }

  /* ------------------------------------------------------------------ Work arc */
  const boards = []
  const BW = 1024, BH = 640
  /** Animated visual for each project. tt === 0 draws the calm "resting" frame used for inactive boards. */
  function drawViz(kind, x, X, Y, W, H, tt) {
    x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip()
    x.fillStyle = '#0d0d14'; x.fillRect(X, Y, W, H)
    if (kind === 'grid') { const cols = 12, rows = 5, sz = W / cols; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const hot = tt ? Math.sin(tt * 2.4 - i * 0.55 - j * 0.9) > 0.55 : (i * 7 + j * 3) % 5 === 0; const k = tt ? 0.5 + 0.5 * Math.sin(tt * 3 - i * 0.5 - j * 0.6) : 0; const pad = 8 + k * 6; x.fillStyle = hot ? '#ff2d8a' : 'rgba(255,255,255,.10)'; x.beginPath(); x.roundRect(X + i * sz + pad, Y + j * sz + 8 + pad, sz - 2 * pad, sz - 2 * pad, hot ? (sz - 2 * pad) / 2 : 8); x.fill() } }
    if (kind === 'bars') { const n = 28, sz = W / n; for (let i = 0; i < n; i++) { const h = (0.25 + 0.7 * Math.abs(Math.sin(i * 0.7 + tt * 1.6) * Math.cos(i * 0.31 - tt * 0.9))) * H; const g = x.createLinearGradient(0, Y + H, 0, Y + H - h); g.addColorStop(0, '#7a5cff'); g.addColorStop(1, 'rgba(122,92,255,.1)'); x.fillStyle = g; x.fillRect(X + i * sz + 4, Y + H - h, sz - 8, h) } x.fillStyle = '#f2efec'; x.font = `300 60px ${F_MONO}`; x.fillText(tt ? Math.round(1150000 + Math.sin(tt * 3) * 60000).toLocaleString('en') + ' q/s' : '1.2M q/s', X + 40, Y + 90) }
    if (kind === 'cube') {
      const cx = X + W / 2, cy = Y + H / 2, sc = 100, ay = tt * 0.9, ax = 0.55, ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax)
      const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([px, py, pz]) => { const x1 = px * ca + pz * sa, z1 = -px * sa + pz * ca, y2 = py * cb - z1 * sb, z2 = py * sb + z1 * cb, f = 1 / (1 + z2 * 0.12); return [cx + x1 * sc * f, cy + y2 * sc * f] })
      x.strokeStyle = '#ff2d8a'; x.lineWidth = 4; x.lineJoin = 'round'
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { x.beginPath(); x.moveTo(...v[a]); x.lineTo(...v[b]); x.stroke() }
      x.fillStyle = 'rgba(255,45,138,.10)'; x.beginPath(); [4, 5, 6, 7].forEach((i, k) => (k ? x.lineTo(...v[i]) : x.moveTo(...v[i]))); x.fill()
      if (tt) { x.fillStyle = '#7ee0ff'; x.font = `300 34px ${F_MONO}`; x.fillText(`width ${(120 + Math.sin(tt) * 40).toFixed(0)}cm  ·  60fps`, X + 30, Y + H - 26) }
    }
    if (kind === 'tree') { const hi = tt ? Math.floor(tt * 2) % 6 : -1;[[0, 0, 40], [6, 1, 30], [6, 2, 52], [12, 3, 26], [12, 4, 44], [18, 5, 34]].forEach(([ind, r, w], i) => { x.fillStyle = i === hi ? 'rgba(255,45,138,.85)' : i % 3 === 1 && !tt ? 'rgba(255,45,138,.6)' : 'rgba(122,92,255,.35)'; x.strokeStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.roundRect(X + 50 + ind * 14, Y + 30 + r * 46, w * 9, 30, 6); x.fill(); x.stroke() }) }
    if (kind === 'ball') {
      const cx = X + W / 3 + (tt ? Math.sin(tt * 1.2) * 60 : 0), cy = Y + H / 2, rot = tt * 2.2
      x.fillStyle = '#eee'; x.beginPath(); x.arc(cx, cy, 90, 0, 7); x.fill(); x.fillStyle = '#111'
      for (let i = 0; i < 5; i++) { const a = i * 1.2566 + rot; x.beginPath(); x.arc(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, 20, 0, 7); x.fill() } x.beginPath(); x.arc(cx, cy, 24, 0, 7); x.fill()
      x.fillStyle = '#ff2d8a'; x.font = `italic 400 190px ${F_SERIF}`; x.fillText('2026', X + W / 2 + 10, cy + 60)
      if (tt) { x.fillStyle = '#7ee0ff'; x.font = `300 32px ${F_MONO}`; x.fillText(`PREDICT  ${1 + (Math.floor(tt) % 4)} – ${Math.floor(tt * 0.7) % 3}`, X + 30, Y + 50) }
    }
    if (kind === 'json') {
      x.font = `300 46px ${F_MONO}`
      const L = [['{', '#888'], ['  "tool": "json",', '#ff2d8a'], ['  "fast": true,', '#7ee0ff'], ['  "free": true', '#7ee0ff'], ['}', '#888']]
      let left = tt ? Math.floor(tt * 16) % 110 : 999
      L.forEach(([t, c], i) => { const part = t.slice(0, Math.max(0, left)); left -= t.length; x.fillStyle = c; x.fillText(part, X + 60, Y + 70 + i * 62) })
    }
    x.restore()
  }
  /** Static layer is painted once; only the visual is redrawn (and only while the board is active). */
  const VZ = { x: 44, y: 88, w: BW - 88, h: 400 }
  function makeBoard(p) {
    const S = document.createElement('canvas'); S.width = BW; S.height = BH
    const x = S.getContext('2d')
    x.fillStyle = '#08080d'; x.fillRect(0, 0, BW, BH)
    x.fillStyle = '#ff2d8a'; x.font = `300 34px ${F_MONO}`; x.fillText(p.n, 44, 58)
    x.fillStyle = 'rgba(242,239,236,.55)'; x.textAlign = 'right'; x.fillText(p.host.toUpperCase() + ' ↗', BW - 44, 58); x.textAlign = 'left'
    x.strokeStyle = 'rgba(255,255,255,.14)'; x.strokeRect(VZ.x, VZ.y, VZ.w, VZ.h)
    x.fillStyle = '#f2efec'; x.font = `200 96px ${F_SANS}`; x.fillText(p.name, 44, 566)
    x.fillStyle = 'rgba(242,239,236,.55)'; x.font = `300 28px ${F_MONO}`; x.fillText(p.stack.toUpperCase(), 46, 612)
    const L = document.createElement('canvas'); L.width = BW; L.height = BH
    const lx = L.getContext('2d')
    const tex = new THREE.CanvasTexture(L); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = isMobile ? 4 : 8
    let img = null
    const chip = (tt) => {
      lx.font = `300 26px ${F_MONO}`; const label = p.chip.toUpperCase(), tw = lx.measureText(label).width + 44
      lx.fillStyle = 'rgba(5,5,10,.78)'; lx.strokeStyle = '#ff2d8a'; lx.lineWidth = 2; lx.beginPath(); lx.roundRect(VZ.x + 18, VZ.y + 18, tw, 46, 23); lx.fill(); lx.stroke()
      lx.fillStyle = tt ? '#7ee0ff' : '#f2efec'; lx.fillText(label, VZ.x + 40, VZ.y + 50)
    }
    const render = (tt) => {
      lx.drawImage(S, 0, 0)
      if (img) {
        const ih = VZ.w * (img.height / img.width), pan = Math.max(0, ih - VZ.h) * (tt ? 0.5 - 0.5 * Math.cos(tt * 0.45) : 0)
        lx.save(); lx.beginPath(); lx.rect(VZ.x, VZ.y, VZ.w, VZ.h); lx.clip(); lx.drawImage(img, VZ.x, VZ.y - pan, VZ.w, ih)
        const g = lx.createLinearGradient(0, VZ.y + VZ.h - 90, 0, VZ.y + VZ.h); g.addColorStop(0, 'rgba(8,8,13,0)'); g.addColorStop(1, 'rgba(8,8,13,.75)'); lx.fillStyle = g; lx.fillRect(VZ.x, VZ.y + VZ.h - 90, VZ.w, 90); lx.restore()
      } else drawViz(p.viz, lx, VZ.x, VZ.y, VZ.w, VZ.h, tt)
      chip(tt); tex.needsUpdate = true
    }
    render(0)
    if (p.img) { const im = new Image(); im.onload = () => { img = im; render(0) }; im.src = `/shots/${p.img}.webp` }
    return { tex, render, last: -1 }
  }
  function buildWork() {
    const title = sprite('SELECTED WORK', { size: 3.6 }); title.position.set(0, 16, 46); scene.add(title)
    const sub = sprite('drive down the avenue — press E at a board to open the site', { size: 0.95, font: `300 64px ${F_MONO}`, color: 'rgba(242,239,236,.75)' }); sub.position.set(0, 12.2, 46); scene.add(sub)
    projZones.forEach((p, i) => {
      const [bx, bz] = p.board, S = 1.12
      const g = new THREE.Group(); g.position.set(bx, 0, bz); g.rotation.y = p.face; g.scale.setScalar(S); scene.add(g)
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), dark()); pole.position.y = 2.2; g.add(pole)
      const frame = new THREE.Mesh(new THREE.BoxGeometry(9.5, 6.1, 0.3), glow(i % 2 ? VIOLET : PINK, 1.6)); frame.position.y = 7; g.add(frame)
      const live = makeBoard(p)
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.1, 5.7), basic(live.tex, { transparent: false, color: new THREE.Color().setScalar(0.62) })); screen.position.set(0, 7, 0.17); g.add(screen)
      addStatic(bx, bz, 0.8)
      for (const k of [-3.9, 0, 3.9]) camObs.push({ x: bx, z: bz + k, r: 2.2, top: 12 }) // camera-only: the board runs along the road
      boards.push({ id: p.id, g, frame, live, base: i % 2 ? VIOLET : PINK })
      tickers.push((t) => { g.position.y = Math.sin(t * 1.2 + i) * 0.12 })
    })
  }

  /* ------------------------------------------------------------------ Career path */
  function buildPath() {
    const title = sprite('CAREER PATH', { size: 3.2, accent: '#7a5cff' }); title.position.set(GATES[0] - 26, 16, 0); scene.add(title)
    JOBS.forEach((j, i) => {
      const x = GATES[i], g = new THREE.Group(); g.position.set(x, 0, 0); g.rotation.y = Math.PI / 2; scene.add(g) // arch spans the road (world z)
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 11, 0.9), dark(0x0d0d14, 0.3, 0.7)); p.position.set(s * 8.2, 5.5, 0); g.add(p)
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 11.1, 0.16), glow(PINK, 3)); e.position.set(s * 8.2, 5.55, -0.5); g.add(e)
        addStatic(x, s * 8.2, 0.9)
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.6, 0.9), dark(0x0d0d14, 0.3, 0.7)); beam.position.set(0, 11.2, 0); g.add(beam)
      const tex = canvasTex(1400, 440, (c, w, h) => {
        c.fillStyle = '#08080d'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7a5cff'; c.lineWidth = 5; c.strokeRect(12, 12, w - 24, h - 24)
        c.fillStyle = '#ff2d8a'; c.font = `300 44px ${F_MONO}`; c.fillText(j.date.toUpperCase(), 60, 90)
        c.fillStyle = '#f2efec'; c.font = `200 110px ${F_SANS}`; c.fillText(j.co, 60, 230)
        c.fillStyle = 'rgba(242,239,236,.6)'; c.font = `italic 400 76px ${F_SERIF}`; c.fillText(j.role, 60, 330)
        c.fillStyle = 'rgba(242,239,236,.35)'; c.font = `300 36px ${F_MONO}`; c.fillText(`0${i + 1} / 03`, w - 220, 90)
      })
      const board = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.5), basic(tex, { transparent: false })); board.position.set(0, 8.6, -0.5); board.rotation.y = Math.PI; g.add(board)
      const board2 = board.clone(); board2.position.z = 0.5; board2.rotation.y = 0; g.add(board2)
      const arch = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.08, 6, 64, Math.PI), glow(VIOLET, 3)); arch.position.set(0, 11.2, 0); g.add(arch)
    })
  }

  /* ------------------------------------------------------------------ Contact portal */
  const portal = { rings: [], beam: null }
  function buildContact() {
    const z = ZONES.find((k) => k.id === 'contact'), [cx, cz] = z.pos, S = 1.6
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.scale.setScalar(S); scene.add(g)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4, 0.8, 8), dark(0x0d0d14, 0.3, 0.8)); base.position.y = 0.4; g.add(base); addStatic(cx, cz, 3.8 * S)
    for (let i = 0; i < 5; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.55, 0.09, 8, 60), glow(i % 2 ? VIOLET : PINK, 3.5)); r.position.set(0, 2 + i * 1.6, 0); g.add(r); portal.rings.push(r)
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 70, 24, 1, true), new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); beam.position.set(0, 35, 0); g.add(beam)
    tickers.push((t) => { portal.rings.forEach((r, i) => { r.rotation.x = Math.PI / 2 + Math.sin(t * 0.8 + i) * 0.35; r.rotation.y = t * (0.5 + i * 0.15) * (i % 2 ? -1 : 1) }) })
    const tex = canvasTex(2048, 700, (x, w) => {
      x.textAlign = 'center'; x.fillStyle = '#f2efec'; x.shadowColor = '#ff2d8a'; x.shadowBlur = 30
      x.font = `200 210px ${F_SANS}`; x.fillText("Let's build", w / 2, 220); x.font = `italic 400 230px ${F_SERIF}`; x.fillStyle = '#ffd0e4'; x.fillText('something that moves.', w / 2, 460)
      x.shadowBlur = 0; x.fillStyle = '#ff2d8a'; x.font = `300 52px ${F_MONO}`; x.fillText('IM.ENZO.021@GMAIL.COM', w / 2, 590)
    })
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(30, 10.3), basic(tex, { depthWrite: false })); sign.position.set(cx + 27, 19, cz); sign.rotation.y = -Math.PI / 2; scene.add(sign)
    const s = sprite('CONTACT', { size: 3.2 }); s.position.set(cx, 20, cz); scene.add(s)
  }


  return { boards, buildAll() { buildSpawnSign(); buildAbout(); buildSkills(); buildWork(); buildPath(); buildContact() } }
}
