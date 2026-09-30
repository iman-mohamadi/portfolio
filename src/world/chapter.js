import { STATS } from './content.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const external = (u) => /^https?:/.test(u)

/** Renders one location as a focused, progressively disclosed "chapter" (title → subtitle → summary → details → links). */
export function locationHTML(loc, { index = 0, count = 0, next = null, mode = 'chapter' } = {}) {
  const r = (i, html) => `<div class="rv" style="--i:${i}">${html}</div>`
  const chips = loc.tech?.length ? `<div class="chips">${loc.tech.map((t) => `<i class="mono">${esc(t)}</i>`).join('')}</div>` : ''
  const details = []
  if (loc.points?.length) details.push(`<ul class="pts">${loc.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`)
  if (loc.stats) details.push(`<div class="stats">${STATS.map(([a, b]) => `<div><b>${esc(a)}</b><span class="mono">${esc(b)}</span></div>`).join('')}</div>`)
  if (loc.groups) details.push(`<ul class="groups">${loc.groups.map((g) => `<li><b>${esc(g.g)}</b><span>${esc(g.t)}</span></li>`).join('')}</ul>`)
  if (loc.exhibits) details.push(`<p class="mono dim">Live exhibits: ${loc.exhibits.map(esc).join(' · ')}</p>`)
  const shot = loc.shot ? `<img class="ch__shot rv" style="--i:3" src="/shots/${esc(loc.shot)}.webp" alt="${esc(loc.title)} website" loading="lazy" width="640" height="360" />` : ''
  const links = (loc.links || []).map((l) => {
    if (l.big) return ''
    const ext = external(l.url)
    return `<a class="btn ${l.kind === 'primary' ? 'btn--primary' : ''} mono" href="${esc(l.url)}" ${ext ? 'target="_blank" rel="noopener"' : ''} ${l.download ? 'download' : ''} data-ev="${esc(l.ev || 'link')}" data-loc="${esc(loc.id)}">${esc(l.label)}${ext ? ' <span class="arr">↗</span>' : ''}</a>`
  }).join('')
  const big = (loc.links || []).find((l) => l.big)
  return [
    r(0, `<div class="ch__kicker mono"><span>${esc(loc.kicker || '')}</span><span>${count > 1 ? `${index + 1} / ${count}` : ''}</span></div>`),
    r(1, `<h2 class="ch__title" id="chTitle">${esc(loc.title)}</h2>`),
    r(2, `<p class="ch__sub">${esc(loc.subtitle || '')}</p>${chips}`),
    shot,
    r(4, '<i class="ch__rule"></i>'),
    r(5, `<p class="ch__sum">${esc(loc.summary || '')}</p>`),
    big ? r(6, `<a class="biglink" href="${esc(big.url)}" data-ev="${esc(big.ev)}" data-loc="${esc(loc.id)}">${esc(big.big)}</a>`) : '',
    details.length ? r(6, `<button class="ch__more mono" type="button" aria-expanded="false" aria-controls="chDetails">Details</button><div class="ch__details" id="chDetails">${details.join('')}</div>`) : '',
    links ? r(7, `<div class="acts">${links}</div>`) : '',
    mode === 'chapter' ? r(8, `<footer class="ch__foot">${next ? `<button class="ch__next mono" type="button" data-next="${esc(next.id)}">Next destination<b>${esc(next.goal.replace(/^Visit |^Explore /, ''))} →</b></button>` : '<span></span>'}<button class="ch__close mono" type="button" data-close>Close <kbd>Esc</kbd></button></footer>`) : '',
  ].join('')
}

/** Chapter overlay controller. */
export function createChapter({ root, card, onOpen, onClose, onNext, onEvent }) {
  let open = false, current = null, lastFocus = null
  const focusables = () => [...card.querySelectorAll('a[href],button:not([disabled])')]

  function show(loc, ctx = {}) {
    current = loc; lastFocus = document.activeElement
    card.innerHTML = locationHTML(loc, ctx)
    root.hidden = false
    // next frame so the transitions run
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-on')))
    open = true; card.scrollTop = 0
    setTimeout(() => card.focus({ preventScroll: true }), 60)
    onOpen?.(loc)
  }
  function close() {
    if (!open) return
    open = false; root.classList.remove('is-on')
    setTimeout(() => { if (!open) { root.hidden = true; card.innerHTML = '' } }, 700)
    try { lastFocus?.blur?.() } catch (_) { /* ignore */ }
    const l = current; current = null; onClose?.(l)
  }
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return close()
    const more = e.target.closest('.ch__more')
    if (more) { const d = card.querySelector('.ch__details'), on = !d.classList.contains('is-open'); d.classList.toggle('is-open', on); more.setAttribute('aria-expanded', String(on)); more.firstChild.textContent = on ? 'Hide details' : 'Details'; return }
    const nx = e.target.closest('[data-next]'); if (nx) { const id = nx.dataset.next; close(); onNext?.(id); return }
    const ev = e.target.closest('[data-ev]'); if (ev) onEvent?.(ev.dataset.ev, ev.dataset.loc)
  })
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !open) return
    const f = focusables(); if (!f.length) return
    const first = f[0], lastEl = f[f.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); lastEl.focus() } else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus() }
  })
  /** Show arbitrary HTML (e.g. race results) in the same chapter frame. */
  function showCustom(html) {
    if (open) return
    current = { id: 'custom', custom: true }; lastFocus = document.activeElement
    card.innerHTML = `<div class="rv" style="--i:0">${html}</div><footer class="ch__foot rv" style="--i:2"><span></span><button class="ch__close mono" type="button" data-close>Close <kbd>Esc</kbd></button></footer>`
    root.hidden = false; requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-on'))); open = true; card.scrollTop = 0
    setTimeout(() => card.focus({ preventScroll: true }), 60)
  }
  return { show, showCustom, close, get isOpen() { return open }, get current() { return current } }
}
