import * as THREE from 'three'

/**
 * Garage: the hero Lamborghini plus a handful of Kenney (CC0) cars you can buy with stunt/race/delivery cash.
 * Each car changes the handling constants the physics reads from `car.stats`.
 */
export const CARS = [
  { id: 'lambo', name: 'Terzo Millennio', kit: null, price: 0, acc: 30, max: 27, grip: 7.5, turn: 2.15, r: 1.5, rear: 1.65, track: 0.8, blurb: 'The hero car — balanced, fast and gorgeous.' },
  { id: 'taxi', name: 'City Taxi', kit: 'car/taxi', scale: 1.75, price: 150, acc: 24, max: 22, grip: 6.5, turn: 2.0, r: 1.5, rear: 1.3, track: 0.8, blurb: 'Slow, tall and hilarious. Still gets you there.' },
  { id: 'hatch', name: 'Hot Hatch', kit: 'car/hatchback-sports', scale: 1.8, price: 300, acc: 28, max: 24.5, grip: 9.5, turn: 2.55, r: 1.4, rear: 1.3, track: 0.75, blurb: 'Pointy front end, huge grip. Corners like it is on rails.' },
  { id: 'kart', name: 'Street Kart', kit: 'car/kart-oobi', scale: 2.0, price: 450, acc: 33, max: 23, grip: 11, turn: 3.1, r: 1.15, rear: 1.05, track: 0.65, blurb: 'Tiny, twitchy and stuck to the road.' },
  { id: 'coupe', name: 'Street Coupe', kit: 'car/sedan-sports', scale: 1.8, price: 600, acc: 31, max: 26, grip: 8.2, turn: 2.3, r: 1.45, rear: 1.4, track: 0.8, blurb: 'Quick off the line with a big spoiler.' },
  { id: 'fire', name: 'Fire Truck', kit: 'car/firetruck', scale: 1.65, price: 900, acc: 22, max: 21, grip: 6, turn: 1.8, r: 1.75, rear: 1.7, track: 0.9, blurb: 'Heavy. Nothing on the road can stop you.' },
  { id: 'formula', name: 'Formula', kit: 'car/race', scale: 1.9, price: 1500, acc: 34, max: 30, grip: 8.6, turn: 2.35, r: 1.4, rear: 1.5, track: 0.7, blurb: 'Open-wheel speed. Hold on.' },
  { id: 'future', name: 'Future GT', kit: 'car/race-future', scale: 1.95, price: 2800, acc: 36, max: 32, grip: 9, turn: 2.45, r: 1.4, rear: 1.5, track: 0.7, blurb: 'The fastest thing in the city.' },
]
export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0]

export function createGarage({ car, kits, plainMat, score, toast, audio, track, isMobile }) {
  const el = document.getElementById('garage'), list = document.getElementById('garageList')
  let owned = new Set(['lambo']), current = 'lambo', preview = null, open = false
  try { const o = JSON.parse(localStorage.getItem('im-cars') || '[]'); if (Array.isArray(o)) o.forEach((i) => owned.add(i)); const c = localStorage.getItem('im-car'); if (c && owned.has(c)) current = c } catch (_) { /* private mode */ }
  const save = () => { try { localStorage.setItem('im-cars', JSON.stringify([...owned])); localStorage.setItem('im-car', current) } catch (_) { /* ignore */ } }
  const alts = new Map() // id → built THREE.Group (lazy)

  /** Build a player-drivable car from a kit model: the body as one mesh set, wheels as spinnable pivots. */
  function build(def) {
    const model = kits.cars.get(def.kit); if (!model) return null
    const g = new THREE.Group(), wheels = [], m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
    for (const part of model.parts) {
      const isWheel = /wheel/i.test(part.name)
      if (isWheel) {
        part.matrix.decompose(p, q, s)
        const pivot = new THREE.Group(); pivot.rotation.order = 'YXZ'; pivot.position.copy(p); pivot.scale.copy(s)
        const mesh = new THREE.Mesh(part.geometry, plainMat(part)); pivot.add(mesh); g.add(pivot)
        part.geometry.computeBoundingBox(); const bb = part.geometry.boundingBox
        wheels.push({ g: pivot, front: p.z > 0, r: ((bb.max.y - bb.min.y) / 2) * s.y * def.scale })
      } else {
        const mesh = new THREE.Mesh(part.geometry, plainMat(part)); mesh.matrixAutoUpdate = false; m4.copy(part.matrix); mesh.matrix.copy(m4); g.add(mesh)
      }
    }
    g.scale.setScalar(def.scale); g.rotation.y = Math.PI // kit cars face +Z; the game drives towards -Z
    g.userData.wheels = wheels
    return g
  }

  function apply(id) {
    const def = carById(id), s = car.stats
    Object.assign(s, { acc: def.acc, max: def.max, grip: def.grip, turn: def.turn })
    car.radius = def.r; car.rearOff = def.rear; car.track = def.track
    // visuals
    for (const g of alts.values()) g.visible = false
    if (!def.kit) {
      car.hero?.traverse?.(() => {}); if (car.hero) car.hero.visible = true
      car.procedural.forEach((c) => (c.visible = !car.hero)); car.wheels.forEach((w) => (w.visible = !car.hero))
      car.mw = car.heroWheels; car.aero = car.heroAero; car.pool.scale.setScalar(car.hero ? 1.25 : 1)
    } else {
      let g = alts.get(id); if (!g) { g = build(def); if (g) { alts.set(id, g); car.body.add(g) } }
      if (!g) return apply('lambo')
      if (car.hero) car.hero.visible = false
      car.procedural.forEach((c) => (c.visible = false)); car.wheels.forEach((w) => (w.visible = false))
      g.visible = true; car.mw = g.userData.wheels; car.aero = null; car.pool.scale.setScalar(def.scale / 1.4)
    }
    car.carId = id
  }

  function paint() {
    if (!list) return
    const max = (k) => Math.max(...CARS.map((c) => c[k]))
    list.innerHTML = CARS.map((c) => {
      const has = owned.has(c.id), on = (preview || current) === c.id, afford = score.cash >= c.price
      const bar = (label, v, m, lo) => `<div class="bar"><span>${label}</span><i><em style="width:${Math.round(((v - lo) / (m - lo)) * 100)}%"></em></i></div>`
      const btn = has ? `<button class="mono" data-car="${c.id}" data-act="equip" ${current === c.id ? 'disabled' : ''}>${current === c.id ? 'Equipped' : 'Equip'}</button>` : `<button class="mono buy" data-car="${c.id}" data-act="buy" ${afford ? '' : 'disabled'}>Buy · $${c.price.toLocaleString('en-US')}</button>`
      return `<li class="${on ? 'is-on' : ''}${has ? '' : ' locked'}" data-car="${c.id}"><div class="hd"><b>${c.name}</b><small class="mono">${has ? (current === c.id ? 'equipped' : 'owned') : 'for sale'}</small></div><p>${c.blurb}</p><div class="bars">${bar('Speed', c.max, max('max'), 18)}${bar('Accel', c.acc, max('acc'), 18)}${bar('Grip', c.grip, max('grip'), 4)}${bar('Handling', c.turn, max('turn'), 1.4)}</div>${btn}</li>`
    }).join('')
    document.getElementById('garageCash').textContent = score.cash.toLocaleString('en-US')
  }

  function onClick(e) {
    const b = e.target.closest('button[data-act]'), li = e.target.closest('li[data-car]')
    if (e.target.closest('[data-close]')) return close()
    if (!li) return
    const id = li.dataset.car, def = carById(id)
    if (b?.dataset.act === 'buy') {
      if (score.spend(def.price)) { owned.add(id); current = id; preview = null; save(); apply(id); audio.chime(7); toast(`${def.name} is yours`, 1800); track('car_buy', { car: id }) } else toast('Not enough cash', 1200)
    } else if (b?.dataset.act === 'equip') { current = id; preview = null; save(); apply(id); audio.blip(); track('car_equip', { car: id }) }
    else { preview = owned.has(id) ? null : id; apply(id); if (owned.has(id)) { current = id; save() } audio.blip() } // clicking a card previews it (owned cars equip)
    paint()
  }
  el?.addEventListener('click', onClick)
  function openG() { if (!el) return; open = true; el.hidden = false; el.classList.add('is-on'); paint(); track('garage_open') }
  function close() { if (!open) return; open = false; el.classList.remove('is-on'); el.hidden = true; if (preview) { preview = null; apply(current) } }
  return {
    CARS, get owned() { return owned }, get current() { return current }, get isOpen() { return open },
    open: openG, close, toggle() { open ? close() : openG() },
    /** Call once the hero model / procedural body is set up. */
    init() { apply(current) },
    apply,
  }
}
