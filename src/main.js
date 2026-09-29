import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { createGL } from './gl.js'
import { initGame } from './game.js'
import { initAnalytics } from './world/analytics.js'
initAnalytics()

gsap.registerPlugin(ScrollTrigger)
gsap.defaults({ ease: 'expo.out' })
const $ = (s, c = document) => c.querySelector(s)
const $$ = (s, c = document) => [...c.querySelectorAll(s)]
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches
history.scrollRestoration = 'manual'
scrollTo(0, 0)

/* ---------- smooth scroll + single shared ticker ---------- */
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: !reduce })
lenis.stop()
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.lagSmoothing(0)
gsap.ticker.fps(-1)

/* ---------- WebGL ---------- */
const gl = createGL($('#gl'))
gsap.ticker.add((t, dt) => gl.render(t, Math.min(dt / 1000, 0.05)))
lenis.on('scroll', ({ velocity }) => { gl.state.vel = velocity })

/* ---------- split text ---------- */
function splitChars(el) {
  const text = el.textContent
  el.setAttribute('aria-label', text)
  el.textContent = ''
  return [...text].map((c) => {
    const s = document.createElement('span')
    s.className = 'ch'
    s.setAttribute('aria-hidden', 'true')
    s.textContent = c === ' ' ? ' ' : c
    el.appendChild(s)
    return s
  })
}
const heroChars = $$('.hero__title .split').flatMap(splitChars)
const contactSplits = $$('.contact__title .split')
gsap.set(heroChars, { yPercent: 115, rotate: 6 })
gsap.set('.reveal-up', { y: 30, opacity: 0 })
gsap.set('.nav', { yPercent: -100 })

/* ---------- preloader ---------- */
const pct = $('#loadPct'), barEl = $('.loader__bar i')
const counter = { v: 0 }
const intro = gsap.timeline({ paused: true })
intro
  .to('.loader__word span', { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 0)
  .to('.loader', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, 0.15)
  .to(gl.state, { intro: 1, duration: 2.4, ease: 'power2.out' }, 0.4)
  .to(heroChars, { yPercent: 0, rotate: 0, duration: 1.4, stagger: 0.035, ease: 'expo.out' }, 0.75)
  .to('.reveal-up', { y: 0, opacity: 1, duration: 1.2, stagger: 0.12 }, 1.1)
  .to('.nav', { yPercent: 0, duration: 1.1 }, 1.2)
  .add(() => { lenis.start(); $('.loader').style.display = 'none' }, 1.3)

const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve()
gsap.to(counter, {
  v: 100, duration: reduce ? 0.3 : 1.8, ease: 'power2.inOut',
  onUpdate: () => { const n = Math.round(counter.v); pct.textContent = String(n).padStart(3, '0'); barEl.style.transform = `scaleX(${n / 100})` },
  onComplete: () => fontsReady.then(() => intro.play()),
})

/* ---------- cursor + magnetic ---------- */
if (fine) {
  const cur = $('.cursor'), dot = $('.dot'), ring = $('.ring'), label = $('.ring span')
  const dx = gsap.quickTo(dot, 'x', { duration: 0.05 }), dy = gsap.quickTo(dot, 'y', { duration: 0.05 })
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' })
  addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY) }, { passive: true })
  const bind = (el) => {
    el.addEventListener('pointerenter', () => { cur.classList.add('is-link'); label.textContent = el.dataset.cursor || ''; gsap.to(ring, { scale: el.dataset.cursor ? 1.7 : 1.3, duration: 0.5 }) })
    el.addEventListener('pointerleave', () => { cur.classList.remove('is-link'); gsap.to(ring, { scale: 1, duration: 0.5 }) })
  }
  $$('a,[data-magnetic],[data-cursor]').forEach(bind)
  $$('[data-magnetic]').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1,.6)' }), my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1,.6)' })
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * 0.3); my((e.clientY - r.top - r.height / 2) * 0.3) })
    el.addEventListener('pointerleave', () => { mx(0); my(0) })
  })
}

/* ---------- anchors + progress + clock ---------- */
$$('a[href^="#"]:not([data-game-open])').forEach((a) => a.addEventListener('click', (e) => {
  const t = $(a.getAttribute('href')); if (!t) return
  e.preventDefault(); lenis.scrollTo(a.getAttribute('href') === '#top' ? 0 : t, { duration: 1.6, easing: (x) => 1 - Math.pow(1 - x, 4) })
}))
const prog = $('.progress i')
ScrollTrigger.create({ trigger: document.body, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { prog.style.transform = `scaleX(${s.progress})`; gl.state.scroll = s.progress } })
const clock = $('#clock')
const tick = () => { clock.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date()) }
tick(); setInterval(tick, 20000)

/* ---------- hero parallax out ---------- */
gsap.to('.hero__title', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
gsap.to('.hero__meta,.hero__foot', { y: -60, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true } })

/* ---------- marquee: velocity-reactive ---------- */
const track = $('.marquee__track')
let mx = 0, dir = -1
const half = () => track.scrollWidth / 2
gsap.ticker.add((_, dt) => {
  const v = Math.abs(lenis.velocity || 0)
  if (lenis.velocity) dir = lenis.velocity > 0 ? -1 : 1
  mx += dir * (0.06 + v * 0.045) * dt
  const h = half(); if (mx <= -h) mx += h; if (mx > 0) mx -= h
  track.style.transform = `translate3d(${mx}px,0,0)`
})

/* ---------- about: word reveal + counters ---------- */
const about = $('#aboutText')
about.innerHTML = about.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ')
gsap.to('.about__text .w', { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: about, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 } })
$$('.stat').forEach((s, i) => {
  const b = $('b', s), end = parseFloat(b.dataset.count), dec = +(b.dataset.dec || 0), suf = b.dataset.suffix || ''
  const o = { v: 0 }
  gsap.from(s, { y: 60, opacity: 0, duration: 1.2, delay: i * 0.08, scrollTrigger: { trigger: '.stats', start: 'top 88%' } })
  ScrollTrigger.create({ trigger: '.stats', start: 'top 85%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', delay: i * 0.08, onUpdate: () => { b.textContent = o.v.toFixed(dec) + suf } }) })
})

/* ---------- skills ---------- */
$$('.skill').forEach((el, i) => {
  gsap.from(el, { y: 80, opacity: 0, duration: 1.2, delay: (i % 3) * 0.08, scrollTrigger: { trigger: el, start: 'top 92%' } })
  el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px') })
})
$$('.label').forEach((l) => gsap.from(l, { x: -30, opacity: 0, duration: 1, scrollTrigger: { trigger: l, start: 'top 90%' } }))

/* ---------- card visuals ---------- */
$('.tokens').innerHTML = Array.from({ length: 48 }, (_, i) => `<i style="animation-delay:${((i % 8) + Math.floor(i / 8)) * 0.14}s"></i>`).join('')
$('.bars').innerHTML = Array.from({ length: 22 }, (_, i) => `<i style="animation-delay:${(i * 0.11).toFixed(2)}s"></i>`).join('')
$('.tree').innerHTML = [[0, 0, 40], [14, 22, 30], [14, 44, 50], [28, 66, 26], [28, 88, 44], [42, 110, 34], [0, 132, 60]]
  .map(([x, y, w], i) => `<i style="left:${x}%;top:${y}px;width:${w}%;animation-delay:${i * 0.3}s"></i>`).join('')
const jsonEl = $('#jsonType')
const jsonSrc = '{\n  "tool": "json",\n  "fast": true,\n  "free": true\n}'
{
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const paint = (t) => esc(t).replace(/("[^"]*")(:)?|\btrue\b/g, (m, q, c) => (q ? `<span class="${c ? 'k' : 'v'}">${q}</span>${c || ''}` : `<span class="v">${m}</span>`))
  let i = 0
  const type = () => {
    i++; jsonEl.innerHTML = paint(jsonSrc.slice(0, i)) + '<span class="k">▍</span>'
    if (i >= jsonSrc.length) { i = 0; setTimeout(type, 2400) } else setTimeout(type, 60)
  }
  type()
}

/* ---------- horizontal work section ---------- */
const mm = gsap.matchMedia()
mm.add('(min-width: 0px)', () => {
  const head = $('.work__head'), tr = $('.work__track'), pin = $('.work__pin')
  const dist = () => head.offsetWidth + tr.scrollWidth + 40 - innerWidth
  const tween = gsap.to([head, tr], { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.work', start: 'top top', end: () => '+=' + dist() * 1.05, pin: pin, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 } })
  $$('.card').forEach((c) => gsap.from(c, { y: 50, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: tween, start: 'left 105%', end: 'left 65%', scrub: true } }))
})
if (fine) $$('[data-tilt]').forEach((c) => {
  const rx = gsap.quickTo(c, 'rotationX', { duration: 0.6 }), ry = gsap.quickTo(c, 'rotationY', { duration: 0.6 })
  gsap.set(c, { transformPerspective: 900 })
  c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 12); rx(-((e.clientY - r.top) / r.height - 0.5) * 12) })
  c.addEventListener('pointerleave', () => { rx(0); ry(0) })
})

/* ---------- dim the particle sphere behind dense text ---------- */
$$('.about,.skills,.exp,.contact').forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 60%', end: 'bottom 40%', onToggle: (s) => { gl.state.dim = s.isActive ? (el.classList.contains('contact') ? 0.5 : 1) : 0 } }))

/* ---------- experience ---------- */
$$('.job').forEach((j) => {
  ScrollTrigger.create({ trigger: j, start: 'top 85%', once: true, onEnter: () => gsap.to(j, { '--p': 1, duration: 1.6, ease: 'expo.inOut' }) })
  gsap.from($$('.job__date,h3,h4,li', j), { y: 40, opacity: 0, duration: 1.2, stagger: 0.07, scrollTrigger: { trigger: j, start: 'top 80%' } })
})

/* ---------- contact ---------- */
const cChars = contactSplits.flatMap(splitChars)
gsap.from(cChars, { yPercent: 115, rotate: 5, duration: 1.4, stagger: 0.03, scrollTrigger: { trigger: '.contact__title', start: 'top 75%' } })
gsap.from('.contact__mail,.contact__links a,.foot', { y: 40, opacity: 0, duration: 1.2, stagger: 0.08, scrollTrigger: { trigger: '.contact__mail', start: 'top 95%' } })

initGame({ lenis })

addEventListener('load', () => ScrollTrigger.refresh())
