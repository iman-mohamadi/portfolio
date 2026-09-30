/**
 * Discovery + objective state for the portfolio journey. Pure logic (no DOM): the HUD, menu and 2D layer render from this.
 *  - "discovered" is the set of locations the visitor has reached (or opened from the menu); it persists between visits.
 *  - the objective is always a suggestion: the first unfinished journey step, nearest undiscovered location first —
 *    unless the visitor picked a destination themselves.
 */
export function createJourney({ locations, steps, key = 'im-journey-v2' }) {
  const items = locations.filter((l) => !l.hidden)
  const byId = new Map(locations.map((l) => [l.id, l]))
  let seen = new Set(), manual = null, sticky = null
  try { const raw = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(raw)) seen = new Set(raw.filter((id) => byId.has(id))) } catch (_) { /* private mode */ }
  const save = () => { try { localStorage.setItem(key, JSON.stringify([...seen])) } catch (_) { /* ignore */ } }
  const remaining = (s) => s.ids.filter((id) => !seen.has(id))

  const api = {
    steps, total: items.length,
    get count() { return seen.size },
    get explored() { return seen.size >= items.length },
    get fresh() { return seen.size === 0 },
    has: (id) => seen.has(id),
    /** Mark a location as visited. Returns true the first time. */
    discover(id) {
      if (!byId.get(id) || byId.get(id).hidden || seen.has(id)) return false
      seen.add(id); save(); if (sticky === id) sticky = null; if (manual === id) manual = null; return true
    },
    stepStates() { return steps.map((s) => { const done = s.ids.filter((id) => seen.has(id)).length; return { ...s, done, total: s.ids.length, complete: done === s.ids.length } }) },
    /** Index of the first journey step that still has something to discover (or steps.length when finished). */
    currentStep() { const i = steps.findIndex((s) => remaining(s).length); return i < 0 ? steps.length : i },
    stepOf: (id) => steps.findIndex((s) => s.ids.includes(id)),
    get manual() { return manual },
    /** Pick a destination yourself (even one already visited). It stays the objective until you arrive. */
    setManual(id) { manual = byId.has(id) && !byId.get(id).hidden ? id : null; sticky = null; return manual },
    arrive(id) { if (manual === id) manual = null },
    clearManual() { manual = null },
    /** The location the HUD should point at, or null once everything has been discovered. */
    objective(x, z) {
      if (manual) return byId.get(manual)
      if (sticky && !seen.has(sticky)) return byId.get(sticky)
      const i = api.currentStep(); if (i >= steps.length) return null
      let best = null, bd = Infinity
      for (const id of remaining(steps[i])) { const l = byId.get(id), d = Math.hypot(l.pos[0] - x, l.pos[1] - z); if (d < bd) { bd = d; best = l } }
      sticky = best?.id ?? null
      return best
    },
    reset() { seen = new Set(); manual = sticky = null; save() },
  }
  return api
}
