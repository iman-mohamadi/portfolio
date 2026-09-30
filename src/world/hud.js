import { $ } from './helpers.js'

/** DOM side of the journey HUD: where am I, what is my objective, what can I do here, what have I discovered. */
export function createHud({ journey, onStep }) {
  const el = {
    district: $('#whereDistrict'), name: $('#whereName'), obj: $('#objective'), objTitle: $('#objTitle'), objDist: $('#objDist'), objCount: $('#objCount'), objBar: $('#objBar'),
    jbar: $('#jbar'), prompt: $('#prompt'), promptText: $('#promptText'), promptSub: $('#promptSub'), discover: $('#discover'), discoverName: $('#discoverName'), discoverCount: $('#discoverCount'),
    intro: $('#introLine'), hint: $('#hint'), srLive: $('#srLive'),
  }
  const last = {}
  const setText = (k, node, v) => { if (last[k] !== v) { last[k] = v; node.textContent = v } }

  function paintJourney() {
    const states = journey.stepStates(), now = journey.currentStep()
    const html = states.map((s, i) => `<button type="button" data-step="${i}" class="${s.complete ? 'is-done' : ''} ${i === now ? 'is-now' : ''}" aria-label="${s.n} ${s.label}${s.complete ? ' (done)' : s.total > 1 ? ` (${s.done} of ${s.total})` : ''}"><i>${s.complete ? '✓' : s.n}</i><span>${s.short}</span></button>`).join('<b class="sep" aria-hidden="true"></b>')
    if (last.jbar !== html) { last.jbar = html; el.jbar.innerHTML = html }
  }
  el.jbar.addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (b) onStep?.(+b.dataset.step) })

  return {
    paintJourney,
    /** District line + (when standing in one) the location name. */
    setWhere(district, name) {
      setText('district', el.district, district)
      if (last.name !== name) { last.name = name; el.name.textContent = name || ''; if (name) el.srLive.textContent = `${district}. ${name}` }
    },
    /** loc = objective location or null. `distance` in metres. */
    setObjective(loc, distance) {
      const done = journey.explored
      el.obj.classList.toggle('is-done', done && !loc)
      el.obj.querySelector('.objective__label').textContent = done && !loc ? 'World explored' : 'Current objective'
      setText('objTitle', el.objTitle, loc ? loc.goal : done ? 'Want to build something together?' : '—')
      setText('objDist', el.objDist, loc && distance != null ? (distance > 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance / 5) * 5} m`) : done ? 'Say hello' : '')
      setText('objCount', el.objCount, `${journey.count} / ${journey.total} discovered`)
      const bar = (journey.count / journey.total).toFixed(3); if (last.bar !== bar) { last.bar = bar; el.objBar.style.transform = `scaleX(${bar})` }
    },
    pulseObjective() { el.obj.classList.remove('is-pulse'); void el.obj.offsetWidth; el.obj.classList.add('is-pulse') },
    /** Contextual prompt: only shown when there is something to do right here. */
    prompt(text, sub) {
      const on = !!text
      el.prompt.classList.toggle('is-on', on)
      if (on) { setText('pt', el.promptText, text); setText('ps', el.promptSub, sub || '') }
    },
    discover(loc) {
      el.discoverName.textContent = loc.title.replace("Let's build something that moves.", 'Communication terminal')
      el.discoverCount.textContent = `${journey.count} / ${journey.total} locations`
      el.discover.classList.remove('is-on'); void el.discover.offsetWidth; el.discover.classList.add('is-on')
      clearTimeout(this._dt); this._dt = setTimeout(() => el.discover.classList.remove('is-on'), 3800)
    },
    hint(html, on) { if (html != null && last.hint !== html) { last.hint = html; el.hint.innerHTML = html } el.hint.classList.toggle('is-on', !!on) },
    /** Short subtitle sequence used for onboarding. Returns a controller. */
    intro(lines, done, { gap = 2700, reduced = false } = {}) {
      let i = 0, timer = 0, dead = false
      const p = el.intro.parentElement.querySelector('p') || el.intro
      const show = (html) => { p.classList.remove('is-on'); setTimeout(() => { if (dead) return; p.innerHTML = html; p.classList.add('is-on') }, reduced ? 0 : 450) }
      const step = () => {
        if (dead) return
        if (i >= lines.length) { p.classList.remove('is-on'); dead = true; done?.(); return }
        show(lines[i++]); timer = setTimeout(step, gap)
      }
      step()
      return { skip() { if (dead) return; dead = true; clearTimeout(timer); p.classList.remove('is-on'); done?.() } }
    },
  }
}
