import { LOCATIONS, PROFILE, STATS, SKILLS } from './portfolio.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const linkHTML = (l, loc) => {
  const ext = /^https?:/.test(l.url)
  return `<a class="btn ${l.kind === 'primary' ? 'btn--primary' : ''} mono" href="${esc(l.url)}" ${ext ? 'target="_blank" rel="noopener"' : ''} ${l.download ? 'download' : ''} data-ev="${esc(l.ev || 'link')}" data-loc="${esc(loc.id)}">${esc(l.label)}${ext ? ' <span class="arr">↗</span>' : ''}</a>`
}

/**
 * The whole portfolio as a calm one-page layout, generated from the same data as the 3D world.
 * Used by recruiters who would rather read than drive, and as the fallback when WebGL is unavailable or too slow.
 */
export function createPortfolio2D({ root, inner, canEnter, onEnter, onClose, onEvent }) {
  const by = (t) => LOCATIONS.filter((l) => l.type === t)
  const about = by('about')[0], lab = by('lab')[0], contact = by('contact')[0]
  const jobs = by('experience').slice().reverse()
  let open = false, lastFocus = null

  inner.innerHTML = `
    <header class="p2d__top mono"><span class="brand">${esc(PROFILE.name)}</span>
      <nav aria-label="Sections"><a href="#p2d-about">About</a><a href="#p2d-experience">Experience</a><a href="#p2d-projects">Projects</a><a href="#p2d-lab">3D Lab</a><a href="#p2d-contact">Contact</a></nav></header>
    <h1>${esc(PROFILE.name.split(' ')[0])} <em>${esc(PROFILE.name.split(' ').slice(1).join(' '))}</em></h1>
    <p class="lead">${esc(PROFILE.title)} — ${esc(PROFILE.place)}. ${esc(PROFILE.availability)}.</p>
    <div class="acts">${contact.links.slice(0, 1).map((l) => linkHTML({ ...l, label: 'Get in touch' }, contact)).join('')}${contact.links.filter((l) => l.download).map((l) => linkHTML(l, contact)).join('')}<button class="btn mono" type="button" data-enter3d hidden>Explore the 3D world →</button></div>

    <section id="p2d-about"><h2>About</h2><div class="cols"><div><p class="lead" style="margin-top:0">${esc(about.summary)}</p><ul class="pts">${about.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
      <div><div class="stats">${STATS.map(([a, b]) => `<div><b>${esc(a)}</b><span class="mono">${esc(b)}</span></div>`).join('')}</div></div></div>
      <ul class="groups" style="margin-top:1.6rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.9rem 2rem">${SKILLS.map((s) => `<li><b>${esc(s.g)}</b><span>${esc(s.t)}</span></li>`).join('')}</ul></section>

    <section id="p2d-experience"><h2>Experience</h2>${jobs.map((j) => `<article class="job"><div class="when mono">${esc(j.period)}</div><div><h3>${esc(j.title)}</h3><p class="role">${esc(j.role)}</p><ul class="pts"><li>${esc(j.summary)}</li>${j.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></article>`).join('')}</section>

    <section id="p2d-projects"><h2>Projects</h2><div class="grid">${by('project').map((p) => `<article class="card"><span class="mono dim">${esc(p.n)} — ${esc(p.kicker)}</span><h3>${esc(p.title)}</h3><p class="sub">${esc(p.subtitle)}</p><p>${esc(p.summary)}</p><div class="chips">${p.tech.map((t) => `<i class="mono">${esc(t)}</i>`).join('')}</div><div class="acts">${p.links.map((l) => linkHTML(l, p)).join('')}</div></article>`).join('')}</div></section>

    <section id="p2d-lab"><h2>3D Lab</h2><article class="card"><h3>${esc(lab.title)}</h3><p class="sub">${esc(lab.subtitle)}</p><p>${esc(lab.summary)}</p><ul class="pts">${lab.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul><div class="chips">${lab.tech.map((t) => `<i class="mono">${esc(t)}</i>`).join('')}</div><div class="acts">${lab.links.map((l) => linkHTML(l, lab)).join('')}</div></article></section>

    <section id="p2d-contact"><h2>Contact</h2><p class="lead" style="margin-top:0">${esc(contact.summary)} ${esc(contact.subtitle)}.</p>
      ${contact.links.filter((l) => l.big).map((l) => `<a class="biglink" href="${esc(l.url)}" data-ev="${esc(l.ev)}" data-loc="contact">${esc(l.big)}</a>`).join('')}
      <div class="acts" style="margin-top:1.4rem">${contact.links.filter((l) => !l.big).map((l) => linkHTML(l, contact)).join('')}</div></section>
    <div class="enter"><button class="btn btn--primary mono" type="button" data-enter3d hidden>Explore the 3D world →</button></div>
    <button class="btn mono p2d__close" type="button" data-close2d>Close ✕</button>`

  function show() {
    if (open) return
    open = true; lastFocus = document.activeElement; root.hidden = false; root.scrollTop = 0
    root.querySelectorAll('[data-enter3d]').forEach((b) => { b.hidden = !canEnter() })
    root.querySelector('[data-close2d]').hidden = !canEnter()
    setTimeout(() => root.querySelector('a,button')?.focus({ preventScroll: true }), 30)
  }
  function hide() { if (!open) return; open = false; root.hidden = true; try { lastFocus?.focus?.() } catch (_) { /* ignore */ } onClose?.() }
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close2d]')) return hide()
    if (e.target.closest('[data-enter3d]')) { hide(); onEnter?.(); return }
    const a = e.target.closest('.p2d__top nav a'); if (a) { e.preventDefault(); root.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return }
    const ev = e.target.closest('[data-ev]'); if (ev) onEvent?.(ev.dataset.ev, ev.dataset.loc)
  })
  addEventListener('keydown', (e) => { if (open && e.key === 'Escape' && canEnter()) hide() })
  return { show, hide, get isOpen() { return open } }
}
