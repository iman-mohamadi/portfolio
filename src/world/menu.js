const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * Menu (Tab): the fast way around. EXPLORE = the journey as a list (with discovered / not yet) beside the world map,
 * PLAY = the optional games, SETTINGS = time of day, weather, graphics, sound, photo.
 * Every location can be read straight away (no driving), navigated to, or jumped to.
 */
export function createMenu({ root, panel, journey, mapRenderer, locations, getMapState, actions, plays, settings }) {
  let open = false, tab = 'explore', hot = null, raf = 0, mapCanvas = null, lastFocus = null
  const byId = new Map(locations.map((l) => [l.id, l]))
  const MAP = 560

  function exploreHTML() {
    const states = journey.stepStates(), goalId = getMapState().objectiveId
    const rows = (s) => s.ids.map((id) => {
      const l = byId.get(id), seen = journey.has(id)
      return `<div class="m2__row ${seen ? 'is-seen' : ''} ${goalId === id ? 'is-goal' : ''} ${hot === id ? 'is-hot' : ''}" data-row="${id}">
        <span class="m2__dot" aria-hidden="true"></span>
        <div class="m2__nm"><b>${esc(l.title.replace("Let's build something that moves.", 'Communication terminal'))}</b><small>${esc(l.subtitle || '')}</small><span class="sr">${seen ? 'discovered' : 'not yet discovered'}</span></div>
        <div class="m2__acts"><button class="mono" type="button" data-act="read" data-id="${id}" title="Read it now, no driving">Read</button><button class="mono" type="button" data-act="go" data-id="${id}" title="Mark it as my destination">Go</button><button class="mono" type="button" data-act="jump" data-id="${id}" title="Travel there instantly">Jump</button></div>
      </div>`
    }).join('')
    const list = states.map((s) => `<section class="m2__step"><header class="mono"><b>${s.n} — ${esc(s.label)}</b><span class="${s.complete ? 'ok' : ''}">${s.complete ? '✓ done' : s.total > 1 ? `${s.done} / ${s.total}` : ''}</span></header>${rows(s)}</section>`).join('')
    return `<div class="m2__explore"><div class="m2__list" id="m2list">${list}</div><div class="m2__mapwrap"><canvas id="m2map" width="${MAP}" height="${MAP}" aria-label="World map: click a location to navigate there" role="img"></canvas><span class="m2__tip mono" id="m2tip"></span></div></div>
      <div class="m2__foot mono"><span><b>${journey.count} / ${journey.total}</b> locations discovered</span><span>Hollow = not yet visited · amber = current objective</span></div>`
  }
  function playHTML() {
    return `<div class="m2__list2">${plays().map((p) => `<div class="m2__item"><b>${esc(p.title)}</b><small>${esc(p.desc)}</small><button class="mono" type="button" data-play="${p.id}">${esc(p.btn)}</button></div>`).join('')}<p class="mono dim">Optional — none of this is needed to read the portfolio.</p></div>`
  }
  function settingsHTML() {
    return `<div class="m2__list2">${settings().map((s, i) => `<div class="m2__item"><b>${esc(s.label)}</b><small>${esc(s.desc || '')}</small><button class="mono" type="button" data-set="${i}">${esc(s.value)}</button></div>`).join('')}</div>`
  }
  function render() {
    const tabs = [['explore', 'Explore'], ['play', 'Play'], ['settings', 'Settings']]
    panel.innerHTML = `<header class="m2__head"><h2>Menu</h2><div class="m2__tabs mono" role="tablist">${tabs.map(([id, l]) => `<button role="tab" type="button" data-tab="${id}" aria-selected="${tab === id}">${l}</button>`).join('')}</div><button class="m2__x mono" type="button" data-close>Close <kbd>Esc</kbd></button></header><div class="m2__body">${tab === 'explore' ? exploreHTML() : tab === 'play' ? playHTML() : settingsHTML()}</div>`
    mapCanvas = panel.querySelector('#m2map')
    cancelAnimationFrame(raf); if (mapCanvas) loop()
  }
  function loop() {
    if (!open || !mapCanvas) return
    const ctx = mapCanvas.getContext('2d'), st = getMapState()
    mapRenderer.draw(ctx, MAP, { ...st, hot, labels: true, games: false })
    raf = requestAnimationFrame(loop)
  }
  const pinAt = (e) => { const r = mapCanvas.getBoundingClientRect(); return mapRenderer.hit((e.clientX - r.left) * (MAP / r.width), (e.clientY - r.top) * (MAP / r.height), MAP) }

  panel.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); return }
    if (e.target.closest('[data-close]')) return close()
    const a = e.target.closest('[data-act]')
    if (a) { const loc = byId.get(a.dataset.id); close(); actions[a.dataset.act]?.(loc); return }
    const p = e.target.closest('[data-play]'); if (p) { close(); actions.play(p.dataset.play); return }
    const s = e.target.closest('[data-set]'); if (s) { settings()[+s.dataset.set].action(); const i = +s.dataset.set; render(); panel.querySelector(`[data-set="${i}"]`)?.focus(); return }
    if (e.target.closest('#m2map')) { const p2 = pinAt(e); if (p2) { close(); actions.go(p2) } }
  })
  panel.addEventListener('pointermove', (e) => {
    if (!e.target.closest || !e.target.closest('#m2map')) return
    const p = pinAt(e), tip = panel.querySelector('#m2tip'), id = p?.id ?? null
    if (id !== hot) { hot = id; panel.querySelector('.m2__row.is-hot')?.classList.remove('is-hot'); if (id) { const row = panel.querySelector(`[data-row="${id}"]`); row?.classList.add('is-hot'); row?.scrollIntoView({ block: 'nearest' }) } }
    tip.textContent = p ? `${p.title.replace("Let's build something that moves.", 'Contact')} — click to navigate` : ''; tip.classList.toggle('is-on', !!p)
  })

  function openMenu(t) {
    if (open && !t) return
    tab = t || tab; hot = null; open = true; lastFocus = document.activeElement
    root.hidden = false; render()
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-on')))
    setTimeout(() => panel.querySelector('[aria-selected=true]')?.focus({ preventScroll: true }), 80)
  }
  function close() {
    if (!open) return
    open = false; root.classList.remove('is-on'); cancelAnimationFrame(raf)
    setTimeout(() => { if (!open) root.hidden = true }, 550)
    try { lastFocus?.blur?.(); document.activeElement?.blur?.() } catch (_) { /* ignore */ }
    actions.closed?.()
  }
  root.addEventListener('click', (e) => { if (e.target.closest('.menu2__veil')) close() })
  return { open: openMenu, close, toggle(t) { open ? close() : openMenu(t) }, get isOpen() { return open }, refresh() { if (open) render() } }
}
