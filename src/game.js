// "Run Through Iman" — a one-button runner that introduces Iman as you play.
const MILESTONES = [
  { at: 900, tag: 'Hello', title: "Hi, I'm Iman Mohammadi.", text: 'Senior front-end architect & WebGL / 3D web specialist from Tehran. 9+ years shipping fast, high-traffic web systems.' },
  { at: 4200, tag: '2017 — 2020', title: 'GSI Telecom', text: 'Where it began: cross-browser telecom platforms in Vue.js + Bootstrap, and legacy HTML/CSS rebuilt for speed and accessibility.' },
  { at: 8200, tag: '2020 — 2023', title: 'Dewzilla', text: 'Scaled enterprise apps across Vue & Nuxt, Pinia state, microservice APIs and a custom Tailwind + Vuetify component system.' },
  { at: 12200, tag: '2024 — Now', title: 'Arnika Mehr Kish', text: 'Leading Hotelyar (1.2M queries/sec) and Woodcoder — a live parametric 3D configurator holding 60fps on integrated GPUs.' },
  { at: 16200, tag: 'Side quests', title: 'Raya UI · Rizo · Tricup · TinyHub', text: 'An open-source design system used by 40 teams, RSC edge apps, a World Cup 2026 prediction hub and dev micro-tools.' },
  { at: 20200, tag: 'Stack', title: 'Vue · Nuxt · Next · Three.js · GLSL · GSAP', text: 'Component-driven architecture, honest motion, and a rendering budget spent where the eye actually lands.' },
]
const FINISH = 23800
const ORBS = ['Vue', 'Nuxt', 'Next', 'React', 'Three.js', 'GLSL', 'GSAP', 'WebGL', 'Pinia', 'Tailwind', 'Node', 'TS']

export function initGame({ lenis }) {
  const root = document.getElementById('game')
  const cv = document.getElementById('gameCanvas')
  const ctx = cv.getContext('2d')
  const card = root.querySelector('.game__card')
  const intro = root.querySelector('.game__intro')
  const end = root.querySelector('.game__end')
  const hud = { lives: root.querySelector('[data-lives]'), orbs: root.querySelector('[data-orbs]'), bar: root.querySelector('.game__bar i') }

  let W = 0, H = 0, u = 1, dpr = 1, running = false, raf = 0, last = 0
  let s // game state

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2)
    W = innerWidth; H = innerHeight; u = Math.min(H / 720, W / 900) || 1
    cv.width = W * dpr; cv.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const reset = (fromCheckpoint = false) => {
    const start = fromCheckpoint ? s.checkpoint : 0
    s = {
      x: start, vy: 0, y: 0, jumps: 0, rot: 0, lives: 3, orbs: fromCheckpoint ? s.orbs : 0, hit: 0, shake: 0,
      checkpoint: start, state: 'ready', obs: [], pick: [], parts: [], pops: [], next: start + 700, mi: MILESTONES.findIndex((m) => m.at > start + 50),
      t: 0, cardT: 0, seed: 7,
    }
    if (s.mi < 0) s.mi = MILESTONES.length
    card.classList.remove('is-on'); end.classList.remove('is-on')
    hud.orbs.textContent = s.orbs; drawLives()
  }
  const rnd = () => ((s.seed = (s.seed * 16807) % 2147483647) / 2147483647)
  const drawLives = () => { hud.lives.textContent = '♥'.repeat(Math.max(s.lives, 0)) + '♡'.repeat(3 - Math.max(s.lives, 0)) }
  const ground = () => H * 0.76
  const px = () => Math.max(90, W * 0.2)
  const speed = () => (360 + Math.min(s.x / 24000, 1) * 200) * u

  function jump() {
    if (!running) return
    if (s.state === 'ready') { s.state = 'run'; intro.classList.remove('is-on') }
    if (s.state !== 'run' || s.jumps >= 2) return
    s.vy = -(s.jumps ? 780 : 900) * u; s.jumps++
    for (let i = 0; i < 8; i++) s.parts.push({ x: px(), y: ground() - s.y, vx: (Math.random() - .5) * 200 * u, vy: Math.random() * 120 * u, l: .5, c: 'rgba(255,45,138,' })
  }

  function spawn() {
    // keep obstacles out of milestone reading zones
    const m = MILESTONES[s.mi], nearGate = MILESTONES.some((g) => Math.abs(s.next - g.at) < 500) || Math.abs(s.next - FINISH) < 500
    if (s.next > FINISH - 300) return
    if (!nearGate) {
      const r = rnd()
      if (r < 0.55) { const n = rnd() < .3 ? 2 : 1; for (let i = 0; i < n; i++) s.obs.push({ x: s.next + i * 46, w: 34, h: 40 + rnd() * 30 }) }
      // an arc of orbs above
      const arc = rnd() < .7
      const cx = s.next + (r < .55 ? 0 : 60), h = r < .55 ? 150 : 40 + rnd() * 120
      if (arc) for (let i = 0; i < 4; i++) s.pick.push({ x: cx + i * 42 - 60, y: h + Math.sin(i / 3 * Math.PI) * 60, name: ORBS[(rnd() * ORBS.length) | 0], got: false })
    }
    s.next += 260 + rnd() * 240
  }

  function hurt() {
    if (s.hit > 0) return
    s.lives--; s.hit = 1.4; s.shake = .35; drawLives()
    for (let i = 0; i < 26; i++) s.parts.push({ x: px(), y: ground() - s.y - 20 * u, vx: (Math.random() - .5) * 700 * u, vy: (Math.random() - .8) * 600 * u, l: .8, c: 'rgba(255,90,90,' })
    if (s.lives <= 0) { // respawn softly from the last checkpoint
      s.state = 'reboot'; s.cardT = 0
      showCard('Rebooting', 'Segfault in the wild', 'Back to the last checkpoint — nobody gets a hard fail here.', 1800)
      setTimeout(() => { if (running) { const o = s.orbs, cp = s.checkpoint; reset(true); s.orbs = o; s.checkpoint = cp; s.state = 'run'; hud.orbs.textContent = o } }, 1500)
    }
  }

  let cardTimer
  function showCard(tag, title, text, ms = 6500) {
    card.innerHTML = `<span class="mono">${tag}</span><h3>${title}</h3><p>${text}</p>`
    card.classList.add('is-on'); clearTimeout(cardTimer); cardTimer = setTimeout(() => card.classList.remove('is-on'), ms)
  }

  function finish() {
    s.state = 'done'; card.classList.remove('is-on')
    end.querySelector('[data-final]').textContent = `${s.orbs} tech orbs collected`
    end.classList.add('is-on')
  }

  function update(dt) {
    s.t += dt
    if (s.hit > 0) s.hit -= dt
    if (s.shake > 0) s.shake -= dt
    // player physics
    if (s.state !== 'done') {
      s.vy += 2600 * u * dt; s.y -= s.vy * dt
      if (s.y <= 0) { s.y = 0; s.vy = 0; s.jumps = 0 }
      s.rot = s.y > 0 ? s.rot + dt * 7 : Math.round(s.rot / (Math.PI / 2)) * (Math.PI / 2)
    }
    if (s.state === 'run') {
      const d = speed() * dt / u
      s.x += d
      while (s.next < s.x + W / u + 300) spawn()
      const m = MILESTONES[s.mi]
      if (m && s.x >= m.at) { showCard(m.tag, m.title, m.text); s.checkpoint = m.at; s.mi++ }
      if (s.x >= FINISH) finish()
      // collisions (units → px)
      const pxw = 40 * u, pyb = s.y, pxc = px()
      for (const o of s.obs) {
        const ox = pxc + (o.x - s.x) * u
        if (ox + o.w * u > pxc - pxw * .4 && ox < pxc + pxw * .4 && pyb < o.h * u * .85) hurt()
      }
      for (const p of s.pick) {
        if (p.got) continue
        const ox = pxc + (p.x - s.x) * u, oy = ground() - p.y * u, py = ground() - s.y - 20 * u
        if (Math.hypot(ox - pxc, oy - py) < 34 * u) {
          p.got = true; s.orbs++; hud.orbs.textContent = s.orbs
          s.pops.push({ x: ox, y: oy, t: 0, n: p.name })
          for (let i = 0; i < 10; i++) s.parts.push({ x: ox, y: oy, vx: (Math.random() - .5) * 300 * u, vy: (Math.random() - .5) * 300 * u, l: .5, c: 'rgba(122,92,255,' })
        }
      }
      s.obs = s.obs.filter((o) => o.x > s.x - 200); s.pick = s.pick.filter((p) => p.x > s.x - 200)
      // trail
      if (Math.random() < .6) s.parts.push({ x: px() - 16 * u, y: ground() - s.y - 6 * u - Math.random() * 30 * u, vx: -120 * u, vy: (Math.random() - .5) * 40 * u, l: .45, c: 'rgba(255,45,138,' })
    }
    for (const p of s.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt }
    s.parts = s.parts.filter((p) => p.l > 0)
    for (const p of s.pops) p.t += dt
    s.pops = s.pops.filter((p) => p.t < 1)
    hud.bar.style.transform = `scaleX(${Math.min(s.x / FINISH, 1)})`
  }

  function draw() {
    const g = ground(), sx = s.shake > 0 ? (Math.random() - .5) * 14 * s.shake : 0
    ctx.clearRect(0, 0, W, H)
    ctx.save(); ctx.translate(sx, 0)
    // parallax stars
    for (let l = 0; l < 3; l++) {
      ctx.fillStyle = `rgba(242,239,236,${.15 + l * .12})`
      const gap = 140 - l * 30, sp = (l + 1) * .12
      for (let i = -1; i < W / gap + 2; i++) {
        const x = ((i * gap - s.x * u * sp) % (W + gap) + W + gap) % (W + gap) - gap / 2
        const y = ((i * 97 + l * 61) % 300) / 300 * g * .9
        ctx.fillRect(x, y, 1.4 + l * .6, 1.4 + l * .6)
      }
    }
    // distant contour waves
    ctx.lineWidth = 1
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = `rgba(${k % 2 ? '122,92,255' : '255,45,138'},${.10 - k * .015})`
      ctx.beginPath()
      for (let x = 0; x <= W; x += 16) {
        const y = g - (60 + k * 46) * u + Math.sin((x + s.x * u * (.25 + k * .06)) / (140 + k * 40) + k) * 22 * u
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
      }
      ctx.stroke()
    }
    // ground + perspective ticks
    const grd = ctx.createLinearGradient(0, g, 0, H); grd.addColorStop(0, 'rgba(255,45,138,.12)'); grd.addColorStop(1, 'rgba(255,45,138,0)')
    ctx.fillStyle = grd; ctx.fillRect(0, g, W, H - g)
    ctx.strokeStyle = 'rgba(255,45,138,.7)'; ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.07)'
    for (let i = -2; i < 30; i++) {
      const x = ((i * 90 * u - s.x * u) % (W + 200) + W + 200) % (W + 200) - 100
      ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(W / 2 + (x - W / 2) * 3, H); ctx.stroke()
    }
    // milestone gates
    const pxc = px()
    ;[...MILESTONES.map((m) => m.at), FINISH].forEach((at, i, arr) => {
      const x = pxc + (at - s.x) * u
      if (x < -100 || x > W + 100) return
      const final = i === arr.length - 1, h = 230 * u
      ctx.strokeStyle = final ? '#ff2d8a' : 'rgba(122,92,255,.9)'; ctx.lineWidth = 2
      ctx.shadowColor = final ? '#ff2d8a' : '#7a5cff'; ctx.shadowBlur = 18
      ctx.beginPath(); ctx.moveTo(x - 40 * u, g); ctx.lineTo(x - 40 * u, g - h); ctx.lineTo(x + 40 * u, g - h); ctx.lineTo(x + 40 * u, g); ctx.stroke()
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(242,239,236,.6)'; ctx.font = `300 ${11 * u + 3}px JetBrains Mono, monospace`; ctx.textAlign = 'center'
      ctx.fillText(final ? 'FINISH' : `CHECKPOINT 0${i + 1}`, x, g - h - 12)
      ctx.lineWidth = 1
    })
    // obstacles: glitchy bugs
    for (const o of s.obs) {
      const x = pxc + (o.x - s.x) * u; if (x < -80 || x > W + 80) continue
      const w = o.w * u, h = o.h * u
      ctx.fillStyle = 'rgba(255,60,60,.14)'; ctx.strokeStyle = '#ff4d4d'
      ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(x + w / 2, g - h); ctx.lineTo(x + w, g); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(x + w / 2 - 3 * u, g - h * .55, 2 * u, 5 * u); ctx.fillRect(x + w / 2 + 2 * u, g - h * .55, 2 * u, 5 * u)
    }
    // orbs
    for (const p of s.pick) {
      if (p.got) continue
      const x = pxc + (p.x - s.x) * u; if (x < -40 || x > W + 40) continue
      const y = g - p.y * u + Math.sin(s.t * 4 + p.x) * 4 * u
      ctx.shadowColor = '#7a5cff'; ctx.shadowBlur = 16; ctx.fillStyle = '#9d86ff'
      ctx.beginPath(); ctx.arc(x, y, 9 * u, 0, 7); ctx.fill(); ctx.shadowBlur = 0
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 2 * u, y - 2 * u, 2.5 * u, 0, 7); ctx.fill()
    }
    // particles
    for (const p of s.parts) { ctx.fillStyle = p.c + Math.max(p.l * 1.6, 0) + ')'; ctx.fillRect(p.x, p.y, 3 * u + 1, 3 * u + 1) }
    // player
    const sz = 40 * u, cy = g - s.y - sz / 2
    if (!(s.hit > 0 && Math.floor(s.t * 14) % 2)) {
      ctx.save(); ctx.translate(pxc, cy); ctx.rotate(s.rot)
      ctx.shadowColor = '#ff2d8a'; ctx.shadowBlur = 24
      const pg = ctx.createLinearGradient(-sz / 2, -sz / 2, sz / 2, sz / 2); pg.addColorStop(0, '#ff2d8a'); pg.addColorStop(1, '#7a5cff')
      ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(-sz / 2, -sz / 2, sz, sz, 9 * u); ctx.fill()
      ctx.shadowBlur = 0; ctx.fillStyle = '#050505'; ctx.font = `500 ${15 * u + 2}px Inter Tight, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('IM', 0, 1); ctx.restore()
    }
    // pickups labels
    ctx.textAlign = 'center'; ctx.font = `300 ${12 * u + 3}px JetBrains Mono, monospace`
    for (const p of s.pops) { ctx.fillStyle = `rgba(242,239,236,${1 - p.t})`; ctx.fillText('+ ' + p.n, p.x, p.y - 18 * u - p.t * 40 * u) }
    ctx.restore()
  }

  function loop(now) {
    if (!running) return
    const dt = Math.min((now - last) / 1000, 0.05); last = now
    update(dt); draw(); raf = requestAnimationFrame(loop)
  }

  const onKey = (e) => {
    if (e.code === 'Escape') return close()
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (!e.repeat) jump() }
  }
  const onPointer = (e) => { if (e.target.closest('a,button')) return; jump() }

  function open() {
    if (running) return
    root.classList.add('is-open'); root.setAttribute('aria-hidden', 'false'); lenis.stop()
    resize(); reset(); intro.classList.add('is-on'); running = true; last = performance.now()
    addEventListener('keydown', onKey); root.addEventListener('pointerdown', onPointer); addEventListener('resize', resize)
    raf = requestAnimationFrame(loop)
  }
  function close() {
    running = false; cancelAnimationFrame(raf); clearTimeout(cardTimer)
    root.classList.remove('is-open'); root.setAttribute('aria-hidden', 'true'); lenis.start()
    removeEventListener('keydown', onKey); root.removeEventListener('pointerdown', onPointer); removeEventListener('resize', resize)
  }

  document.querySelectorAll('[data-game-open]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); open() }))
  root.querySelector('[data-game-close]').addEventListener('click', close)
  root.querySelector('[data-game-replay]').addEventListener('click', () => { reset(); s.state = 'run'; end.classList.remove('is-on') })
  root.querySelector('[data-game-contact]').addEventListener('click', () => { close(); setTimeout(() => lenis.scrollTo('#contact', { duration: 1.6 }), 200) })
}
