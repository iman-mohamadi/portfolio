import * as THREE from 'three'
import { instanceModel } from './kits.js'
import { seeded } from './helpers.js'

/* ------------------------------------------------------------------ map constants */
export const T = 12 // world units per Kenney city tile (the kits are 1 unit per tile)
export const G = 33 // tiles per side → roads on every 4th line, 8×8 blocks of 3×3 tiles
export const HALF = (G * T) / 2 // 198
export const NAT = 5 // nature-kit scale
export const tileX = (i) => (i - (G - 1) / 2) * T
export const tileZ = (j) => (j - (G - 1) / 2) * T
export const blockCenter = (b) => tileX(b * 4 + 2) // block index 0..7 → world coordinate

/** District per block, rows = z (north → south), columns = x (west → east).
 *  D downtown · C commercial · T tech park · S suburb · P park · H harbour · X stunt arena · Z plaza · R racing */
export const BLOCKS = [
  'PDDCCTTP',
  'PADCCTKP',
  'SCCCCCTP',
  'XXXZZCCP',
  'XXXZZCCP',
  'SSCWWCHH',
  'SSCWWCQH',
  'SSPWWRHH',
]
/** A about plaza · K skills plaza · Q contact plaza · W gallery-avenue flank (kept open for the project boards) */

const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }
const ORDER = ['W', 'S', 'E', 'N'] // +90° of yaw moves W→S→E→N→W (verified against the kit)
const idx = (d) => ORDER.indexOf(d)

/** Which piece + rotation matches a set of connected sides. Base orientations (rotation 0): straight W–E, bend W+S, T missing N, end W. */
function roadPiece(conn) {
  const n = conn.length
  if (n === 4) return { name: 'road-crossroad', k: 0 }
  if (n === 3) { const miss = ORDER.find((d) => !conn.includes(d)); for (let k = 0; k < 4; k++) if (ORDER[(idx('N') + k) % 4] === miss) return { name: 'road-intersection', k } }
  if (n === 2) {
    if (conn.includes('W') && conn.includes('E')) return { name: 'road-straight', k: 0 }
    if (conn.includes('N') && conn.includes('S')) return { name: 'road-straight', k: 1 }
    for (let k = 0; k < 4; k++) { const a = ORDER[k % 4], b = ORDER[(1 + k) % 4]; if (conn.includes(a) && conn.includes(b)) return { name: 'road-bend', k } }
  }
  if (n === 1) for (let k = 0; k < 4; k++) if (ORDER[k % 4] === conn[0]) return { name: 'road-end', k }
  return null
}

/** Uniform-grid spatial hash for circle + box colliders, so the physics only ever tests what is nearby. */
const clampI = (v, a, b) => Math.min(b, Math.max(a, v))
export class SpatialGrid {
  constructor(cell = 24) { this.cell = cell; this.map = new Map() }
  key(cx, cz) { return cx * 73856093 ^ cz * 19349663 }
  add(item, x0, z0, x1, z1) {
    const c = this.cell
    for (let cx = Math.floor(x0 / c); cx <= Math.floor(x1 / c); cx++) for (let cz = Math.floor(z0 / c); cz <= Math.floor(z1 / c); cz++) { const k = this.key(cx, cz); let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(item) }
  }
  addCircle(x, z, r, data) { const it = { kind: 'c', x, z, r, ...data }; this.add(it, x - r, z - r, x + r, z + r); return it }
  addBox(x, z, hx, hz, data) { const it = { kind: 'b', x, z, hx, hz, ...data }; this.add(it, x - hx, z - hz, x + hx, z + hz); return it }
  query(x, z, r, out = []) {
    out.length = 0; const c = this.cell, seen = this.seen || (this.seen = new Set()); seen.clear()
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++) for (let cz = Math.floor((z - r) / c); cz <= Math.floor((z + r) / c); cz++) {
      const a = this.map.get(this.key(cx, cz)); if (!a) continue
      for (const it of a) if (!seen.has(it)) { seen.add(it); out.push(it) }
    }
    return out
  }
}

/**
 * Builds the whole city: roads (chosen by connectivity), district buildings, trees, street lights, ground and outskirts.
 * Everything is drawn with InstancedMesh (one draw call per model part). Returns layout data other systems need.
 */
export function createCity({ scene, kits, uniforms, mobile, seed = 42 }) {
  const rnd = seeded(seed), city = kits.city, nature = kits.nature, racing = kits.racing
  const grid = new SpatialGrid(24)
  const lists = new Map() // model name → [{x,y,z,ry,s}]
  const put = (kit, name, x, z, ry = 0, s = 1, y = 0, extra = {}) => { const k = kit + '|' + name; let a = lists.get(k); if (!a) lists.set(k, (a = [])); a.push({ x, y, z, ry, s, ...extra }) }
  const layout = { roadTiles: new Set(), lamps: [], graph: null, blocks: [], spawnPoints: [], parkSpots: [] }

  /* ---- materials: one per kit texture, patched so windows glow at night (uNight) ---- */
  const matCache = new Map()
  function gameMat(src, { windows = !!src.map } = {}) {
    if (matCache.has(src)) return matCache.get(src)
    // Kenney's nature/racing kits flag every material metallic; with no env map that renders black, so metalness is forced off.
    const opts = { map: src.map, color: src.color, transparent: src.transparent, side: src.side, alphaTest: src.alphaTest, depthWrite: !src.transparent }
    // phones get diffuse-only Lambert shading (no PBR / wet reflections): a big fill-rate saving
    const m = mobile ? new THREE.MeshLambertMaterial(opts) : new THREE.MeshStandardMaterial({ ...opts, roughness: 0.85, metalness: 0.02 })
    if (src.map) src.map.anisotropy = mobile ? 2 : 8
    if (windows) m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = uniforms.uNight; sh.uniforms.uTime = uniforms.uTime
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n vWp=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;\n#else\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;\n#endif')
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;uniform float uNight,uTime;float hh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          // window glass lives in one block of the colour atlas: light a random subset of panes on warm/cool tints
          float win=0.;
          #ifdef USE_MAP
          vec2 pc=floor(vMapUv*vec2(16.,4.)); // palette cell: dark glass (3,2) and pale-blue glass (11,1)
          win=step(abs(pc.x-3.),.1)*step(abs(pc.y-2.),.1)+step(abs(pc.x-11.),.1)*step(abs(pc.y-1.),.1);
          #endif
          if(win>0.&&uNight>.02){
          vec3 cell=floor(vec3(vWp.x+vWp.z,vWp.y*.9,vWp.x-vWp.z)*.75);float h=hh(cell);
          float on=step(.42,h)*(.8+.2*sin(uTime*.6+h*40.));
          vec3 tint=mix(vec3(1.,.72,.38),vec3(.6,.82,1.),step(.78,hh(cell+7.)));
          totalEmissiveRadiance+=win*on*uNight*tint*1.9;}
        }`)
    }
    matCache.set(src, m); return m
  }
  const matFor = (part) => gameMat(part.material)

  /* ---- stunt jumps: road tiles that are swapped for the kit's slant pieces (rising along local +x) ----
   * ry: 0 → rises toward +x · π → -x · -π/2 → +z · π/2 → -z.  Launch/landing pairs sit either side of an intersection. */
  const RAMP_KIT = { slant: ['road/road-slant', 0.27], high: ['road/road-slant-high', 0.52] }
  const jumpTiles = new Map()
  const jump = (i, j, kind, ry) => jumpTiles.set(i + ',' + j, { kind, ry })
  // J1 · x=-144 southbound over the z=0 crossroad (small)   J2 · x=-96 southbound (big, lands on a second big ramp)   J3 · z=0 eastbound over x=-96 (small)
  jump(4, 15, 'slant', -Math.PI / 2); jump(4, 17, 'slant', Math.PI / 2)
  jump(8, 15, 'high', -Math.PI / 2); jump(8, 18, 'high', Math.PI / 2)
  jump(7, 16, 'slant', 0); jump(9, 16, 'slant', Math.PI)

  /* ---- roads ---- */
  const isRoadTile = (i, j) => i >= 0 && j >= 0 && i < G && j < G && (i % 4 === 0 || j % 4 === 0)
  const inRound = (i, j) => Math.abs(i - 16) <= 1 && Math.abs(j - 16) <= 1
  const road = (i, j) => isRoadTile(i, j) || inRound(i, j)
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    if (!isRoadTile(i, j) || inRound(i, j) || jumpTiles.has(i + ',' + j)) continue
    const conn = Object.entries(DIRS).filter(([, [dx, dz]]) => road(i + dx, j + dz)).map(([d]) => d)
    const piece = roadPiece(conn); if (!piece) continue
    const x = tileX(i), z = tileZ(j)
    // zebra crossings on straights that touch an intersection
    let name = piece.name
    if (name === 'road-straight') { const ax = piece.k === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]]; if (ax.some(([dx, dz]) => { const a = i + dx, b = j + dz; return isRoadTile(a, b) && a % 4 === 0 && b % 4 === 0 }) && rnd() < 0.7) name = 'road-crossing' }
    put('city', 'road/' + name, x, z, piece.k * Math.PI / 2, T)
    layout.roadTiles.add(i + ',' + j)
  }
  put('city', 'road/road-roundabout', 0, 0, 0, T) // spawn plaza

  /* ---- stunt arena: analytic height field that matches the kit meshes (slants rise linearly along their local +x) ---- */
  const BASE = 0.14 // wheels-on-tarmac height; the kit's road slab is 0.24 high, the car model sinks in slightly
  const pieces = new Map(), tkey = (x, z) => Math.round(x / T + (G - 1) / 2) + ',' + Math.round(z / T + (G - 1) / 2)
  layout.rings = []
  const slant = (x, z, ry, top) => { pieces.set(tkey(x, z), { x, z, c: Math.cos(ry), s: Math.sin(ry), top: top * T }) }
  for (const [k, r] of jumpTiles) { const [i, j] = k.split(',').map(Number), x = tileX(i), z = tileZ(j), [name, top] = RAMP_KIT[r.kind]; put('city', name, x, z, r.ry, T); slant(x, z, r.ry, top) }
  const bxy = (bx, bz, col, row) => [blockCenter(bx) + (col - 1) * T, blockCenter(bz) + (row - 1) * T]
  const blockRamp = (kind, bx, bz, col, row, ry) => { const [x, z] = bxy(bx, bz, col, row), [name, top] = RAMP_KIT[kind]; put('city', name, x, z, ry, T); slant(x, z, ry, top) }
  const plateau = (bx, bz, col, row, levels = 1) => {
    const [x, z] = bxy(bx, bz, col, row); for (let k = 0; k < levels; k++) put('city', 'road/tile-high', x, z, 0, T, k * 0.25 * T); pieces.set(tkey(x, z), { flat: true, top: 0.25 * T * levels })
    // flags on the corners so the plateaus read from across town
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) put('racing', levels > 1 ? 'race/flagCheckers' : 'race/flagRed', x + dx, z + dz, rnd() * 6.28, 5, 0.25 * T * levels)
  }
  const hoop = (x, y, z, yaw) => layout.rings.push({ x, y, z, yaw })
  /** Ground height under a world point (ramps and plateaus, otherwise the flat base). */
  layout.heightAt = (x, z) => {
    const p = pieces.get(tkey(x, z)); if (!p) return BASE
    if (p.flat) return p.top
    const lx = (x - p.x) * p.c - (z - p.z) * p.s, u = Math.min(1, Math.max(0, lx / T + 0.5))
    return Math.max(BASE, 0.24 + (p.top - 0.24) * u)
  }
  layout.BASE = BASE
  layout.jumpTiles = jumpTiles
  // rings hang over the flight paths of the road jumps
  hoop(-144, 4.5, 0, 0); hoop(-96, 8.7, 0, 0); hoop(-96, 9.9, 12, 0)
  const arenaPieces = (bx, bz) => {
    const k = bx + ',' + bz, P = Math.PI
    if (k === '0,3') { plateau(bx, bz, 1, 1); blockRamp('slant', bx, bz, 0, 1, 0); blockRamp('slant', bx, bz, 2, 1, P); blockRamp('slant', bx, bz, 1, 0, -P / 2); blockRamp('slant', bx, bz, 1, 2, P / 2); hoop(-168, 6.2, -24, P / 2) }
    else if (k === '0,4') { blockRamp('high', bx, bz, 0, 1, 0); plateau(bx, bz, 1, 1, 2); hoop(-152, 4.4, 24, P / 2) }
    else if (k === '1,3') { blockRamp('slant', bx, bz, 0, 0, 0); blockRamp('slant', bx, bz, 2, 0, P); blockRamp('slant', bx, bz, 0, 2, 0); blockRamp('slant', bx, bz, 2, 2, P); hoop(-120, 4.4, -36, P / 2); hoop(-120, 4.4, -12, P / 2) }
    else if (k === '1,4') { blockRamp('high', bx, bz, 0, 1, 0); plateau(bx, bz, 1, 1, 2); plateau(bx, bz, 2, 1, 2); hoop(-96, 5.4, 24, P / 2) }
    else if (k === '2,3') { plateau(bx, bz, 1, 1); blockRamp('slant', bx, bz, 0, 1, 0); blockRamp('slant', bx, bz, 2, 1, P); blockRamp('slant', bx, bz, 1, 0, -P / 2); blockRamp('slant', bx, bz, 1, 2, P / 2); hoop(-72, 6.2, -24, P / 2) }
    else if (k === '2,4') { blockRamp('slant', bx, bz, 0, 1, P); hoop(-86, 3.2, 24, P / 2) }
  }
  const arenaBlock = (bx, bz) => {
    arenaPieces(bx, bz)
    // traffic cones along the block edges and hazard barriers at the corners — only where no ramp / plateau stands
    const cx = blockCenter(bx), cz = blockCenter(bz), free = (x, z) => !pieces.has(tkey(x, z))
    const cone = (x, z) => { if (free(x, z)) put('city', 'road/construction-cone', x, z, 0, T) }
    for (let i = 0; i < 6; i++) { const t = -15 + i * 6; cone(cx + t, cz - 16.6); cone(cx + t, cz + 16.6); cone(cx - 16.6, cz + t); cone(cx + 16.6, cz + t) }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (free(cx + sx * 16, cz + sz * 16)) put('city', 'road/construction-barrier', cx + sx * 16, cz + sz * 16, Math.atan2(sx, sz), T)
  }

  /* ---- lamps along the roads ---- */
  const lampModel = 'road/light-curved'
  const lampAt = (x, z, ry) => { put('city', lampModel, x, z, ry, T); layout.lamps.push({ x, z, ry }); grid.addCircle(x, z, 0.5, { tag: 'lamp' }) }
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    if (!isRoadTile(i, j) || inRound(i, j) || jumpTiles.has(i + ',' + j)) continue
    const x = tileX(i), z = tileZ(j), alongX = j % 4 === 0 && i % 4 !== 0, alongZ = i % 4 === 0 && j % 4 !== 0
    if (alongX && i % 2 === 0) { const s = (i / 2) % 2 ? 1 : -1; lampAt(x, z + s * (T * 0.44), s > 0 ? 0 : Math.PI) }
    if (alongZ && j % 2 === 0) { const s = (j / 2) % 2 ? 1 : -1; lampAt(x + s * (T * 0.44), z, s > 0 ? -Math.PI / 2 : Math.PI / 2) }
  }

  /* ---- buildings per district ---- */
  const bModels = (prefix, re) => [...(prefix === 'com' ? city : city).models.keys()].filter((n) => n.startsWith(prefix + '/') && re.test(n))
  const SKY = bModels('com', /skyscraper/), MID = bModels('com', /building-[a-m]$/), WIDE = bModels('com', /building-n$/), SUB = bModels('sub', /building-type-[a-u]$/), LOW = bModels('com', /low-detail-building-[a-n]$/)
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  const footprint = (name, ry) => { const m = city.get(name); const [sx, , sz] = m.size; const quarter = Math.round(ry / (Math.PI / 2)) % 2 !== 0; return quarter ? [sz * T, sx * T] : [sx * T, sz * T] }
  function building(name, x, z, ry, extra) {
    const m = city.get(name); if (!m) return
    put('city', name, x, z, ry, T)
    const [fx, fz] = footprint(name, ry)
    grid.addBox(x, z, fx / 2 * 0.92, fz / 2 * 0.92, { tag: 'building', name, h: m.size[1] * T, ...extra })
  }
  const tree = (kit, name, x, z, s = 1, r = 1.2) => { put(kit, name, x, z, rnd() * 6.28, s); if (r) grid.addCircle(x, z, r * s / NAT, { tag: 'tree' }) }
  const TREES = ['nat/tree_default', 'nat/tree_oak', 'nat/tree_tall', 'nat/tree_simple', 'nat/tree_fat', 'nat/tree_small', 'nat/tree_thin', 'nat/tree_detailed']
  const PINES = ['nat/tree_pineTallA', 'nat/tree_pineTallB', 'nat/tree_pineRoundA', 'nat/tree_pineDefaultA', 'nat/tree_pineSmallA']
  const ROCKS = ['nat/rock_largeA', 'nat/rock_largeB', 'nat/rock_smallA', 'nat/rock_smallB', 'nat/rock_tallA', 'nat/rock_smallC']
  const BUSH = ['nat/plant_bushLarge', 'nat/plant_bush', 'nat/plant_bushSmall', 'nat/plant_bushDetailed']
  const has = (n) => nature.has(n)

  for (let bz = 0; bz < 8; bz++) for (let bx = 0; bx < 8; bx++) {
    const t = BLOCKS[bz][bx], cx = blockCenter(bx), cz = blockCenter(bz)
    layout.blocks.push({ bx, bz, type: t, x: cx, z: cz })
    const slots = [[-9, -9], [9, -9], [-9, 9], [9, 9]]
    const facing = (sx, sz) => { // rotate so the building's front (kit +z) faces the nearest road edge of the block
      const ax = Math.abs(sx) > Math.abs(sz) ? (sx > 0 ? Math.PI / 2 : -Math.PI / 2) : (sz > 0 ? 0 : Math.PI); return ax
    }
    if (t === 'D') for (const [sx, sz] of slots) building(pick(SKY), cx + sx + (rnd() - 0.5) * 2, cz + sz + (rnd() - 0.5) * 2, Math.floor(rnd() * 4) * Math.PI / 2, { district: 'D' })
    else if (t === 'T') slots.forEach(([sx, sz], k) => { if (k === 0 || k === 3) building(pick(SKY), cx + sx, cz + sz, Math.floor(rnd() * 4) * Math.PI / 2); else building(pick(MID), cx + sx, cz + sz, facing(sx, sz)) })
    else if (t === 'C') { const blvd = (bz === 3 || bz === 4) && bx >= 5 // boulevard blocks stay low so the gates read clearly
      if (!blvd && rnd() < 0.25 && WIDE.length) building(pick(WIDE), cx, cz, Math.floor(rnd() * 2) * Math.PI / 2); else for (const [sx, sz] of slots) { if (rnd() < 0.9) building(!blvd && rnd() < 0.2 ? pick(SKY) : pick(MID), cx + sx, cz + sz, facing(sx, sz) + (rnd() < 0.15 ? Math.PI : 0)) } }
    else if (t === 'S') { slots.forEach(([sx, sz]) => { building(pick(SUB), cx + sx * 0.95, cz + sz * 0.95, facing(sx, sz)); if (has('nat/tree_default')) tree('nature', pick(TREES), cx + sx * 1.6, cz + sz * 0.4, NAT * 0.8) }) }
    else if (t === 'H') slots.forEach(([sx, sz], k) => { if (k % 2 === 0) building(pick(LOW), cx + sx, cz + sz, Math.floor(rnd() * 4) * Math.PI / 2); else building(pick(MID), cx + sx, cz + sz, facing(sx, sz)) })
    else if (t === 'W') { // open inner half for the boards; buildings only on the outer side of the avenue
      const outer = bx === 3 ? -9 : 9
      for (const sz of [-9, 9]) { building(pick(rnd() < 0.5 ? MID : LOW), cx + outer * 1.4, cz + sz, bx === 3 ? Math.PI / 2 : -Math.PI / 2) }
      for (let k = 0; k < 6; k++) { const x = cx + (bx === 3 ? -1 : 1) * (2 + rnd() * 6), z = cz + (rnd() - 0.5) * 30; if (has('nat/tree_small')) tree('nature', pick(TREES), x, z, NAT * 0.6) }
    } else if (t === 'A' || t === 'K' || t === 'Q') { // open plazas with a ring of trees; the landmark is added by stations.js
      for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283 + rnd() * 0.3, r = 15 + rnd() * 2; if (has('nat/tree_default')) tree('nature', pick(TREES), cx + Math.cos(a) * r, cz + Math.sin(a) * r, NAT * (0.7 + rnd() * 0.4)) }
    } else if (t === 'P' || t === 'Z') {
      const n = mobile ? 10 : 18
      for (let k = 0; k < n; k++) { const x = cx + (rnd() - 0.5) * 32, z = cz + (rnd() - 0.5) * 32; if (Math.hypot(x, z) < 24) continue; const r = rnd(); if (r < 0.62) tree('nature', pick(rnd() < 0.25 ? PINES : TREES), x, z, NAT * (0.7 + rnd() * 0.5)); else if (r < 0.8 && has(ROCKS[0])) { put('nature', pick(ROCKS), x, z, rnd() * 6.28, NAT * (0.6 + rnd() * 0.6)); grid.addCircle(x, z, 2.2, { tag: 'rock' }) } else put('nature', pick(BUSH), x, z, rnd() * 6.28, NAT * (0.8 + rnd() * 0.5)) }
    } else if (t === 'X') arenaBlock(bx, bz)
    else if (t === 'R') { for (let k = 0; k < 3; k++) { put('racing', 'race/grandStand', cx - 12 + k * 12, cz - 11, Math.PI, T); grid.addBox(cx - 12 + k * 12, cz - 11, 5.6, 3.6, { tag: 'stand', h: 8 }) } }
    // sparse street trees along every block edge (skip the stunt arena)
    if (t !== 'X') for (let k = 0; k < (mobile ? 3 : 6); k++) { const e = Math.floor(rnd() * 4), u = (rnd() - 0.5) * 30, x = cx + (e % 2 ? (e === 1 ? 16.4 : -16.4) : u), z = cz + (e % 2 ? u : (e === 0 ? -16.4 : 16.4)); if (has('nat/tree_small')) tree('nature', 'nat/tree_small', x, z, NAT * 0.6, 0.8) }
  }

  /* ---- outskirts: a dense ring of trees, rocks and cliffs beyond the map edge ---- */
  const ring = mobile ? 380 : 900
  for (let k = 0; k < ring; k++) {
    const a = rnd() * 6.283, d = HALF + 14 + rnd() * 70, x = Math.cos(a) * d * 1.05, z = Math.sin(a) * d * 1.05
    if (Math.abs(x) < HALF + 8 && Math.abs(z) < HALF + 8) continue
    const r = rnd(); if (r < 0.7) tree('nature', pick(rnd() < 0.5 ? PINES : TREES), x, z, NAT * (0.8 + rnd() * 0.9), 0); else put('nature', pick(ROCKS), x, z, rnd() * 6.28, NAT * (1 + rnd() * 1.4))
  }

  /* ---- street-light glow: one Points cloud for the lamp heads + instanced pools on the tarmac; both fade in with uNight ---- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c) })()
  const lampHead = (l) => [l.x - 2.4 * Math.sin(l.ry), 0.675 * T - 0.35, l.z - 2.4 * Math.cos(l.ry)]
  const glowPts = new THREE.BufferGeometry(); glowPts.setAttribute('position', new THREE.Float32BufferAttribute(layout.lamps.flatMap(lampHead), 3))
  const lampGlow = new THREE.Points(glowPts, new THREE.PointsMaterial({ size: 4.2, map: glowTex, color: 0xffd08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }))
  lampGlow.frustumCulled = false
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffb870, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, layout.lamps.length)
  { const m = new THREE.Matrix4(), sc = new THREE.Vector3(13, 1, 13), q = new THREE.Quaternion(); layout.lamps.forEach((l, i) => { const [hx, , hz] = lampHead(l); m.compose(new THREE.Vector3(hx, 0.09, hz), q, sc); pools.setMatrixAt(i, m) }) }
  pools.frustumCulled = false; pools.renderOrder = 2
  layout.lampGlow = { points: lampGlow, pools }

  /* ---- distant mountains: oversized cliffs on a ring well beyond the trees (mostly swallowed by fog) ---- */
  for (let k = 0; k < (mobile ? 22 : 40); k++) {
    const a = (k / (mobile ? 22 : 40)) * 6.283 + rnd() * 0.12, d = 330 + rnd() * 90
    put('nature', pick(['nat/rock_largeA', 'nat/rock_largeB', 'nat/rock_tallA']), Math.cos(a) * d, Math.sin(a) * d, rnd() * 6.28, NAT * (9 + rnd() * 9), -6)
  }

  /* ---- draw everything: one InstancedMesh per model part ---- */
  const group = new THREE.Group(); group.name = 'city'; scene.add(group); group.add(lampGlow, pools)
  const stats = { instances: 0, drawCalls: 0 }
  // instances are bucketed into 96 m chunks so three.js can frustum-cull everything behind / beside the camera
  const CH = 96
  for (const [key, list] of lists) {
    const [kitName, name] = key.split('|'), kit = kits[kitName], model = kit.get(name); if (!model) continue
    const chunks = new Map()
    for (const it of list) { const k = Math.floor(it.x / CH) + ',' + Math.floor(it.z / CH); let a = chunks.get(k); if (!a) chunks.set(k, (a = [])); a.push(it) }
    for (const part of chunks.values()) for (const im of instanceModel(model, part, { material: matFor, frustumCulled: true })) { group.add(im); stats.drawCalls++ }
    stats.instances += list.length
  }

  /* ---- ground: lawn with a soft procedural speckle, huge so the horizon is never bare ---- */
  const gt = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#4f7d45'; x.fillRect(0, 0, 256, 256); const r = seeded(3); for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${30 + r() * 40 | 0},${70 + r() * 60 | 0},${30 + r() * 30 | 0},${0.15 + r() * 0.3})`; x.fillRect(r() * 256, r() * 256, 2 + r() * 4, 2 + r() * 4) } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 90); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = mobile ? 1 : 2; return t })()
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ map: gt }))
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground)
  // pavement under every block so buildings sit on a plinth of concrete rather than raw lawn
  const pave = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x8c8f98, roughness: 1 }), 64)
  const dm = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
  layout.blocks.forEach((b, k) => { const s = b.type === 'P' ? 0 : 35.4; dm.compose(new THREE.Vector3(b.x, 0.03, b.z), q, new THREE.Vector3(s, s, 1)); pave.setMatrixAt(k, dm) })
  pave.frustumCulled = false; group.add(pave)

  /* ---- road graph (intersections every 4 tiles) for traffic, racing and the auto tour ---- */
  const N = 9, nodes = [] // 9×9 intersections
  for (let b = 0; b < N; b++) { nodes[b] = []; for (let a = 0; a < N; a++) nodes[b][a] = { a, b, x: tileX(a * 4), z: tileZ(b * 4) } }
  layout.graph = { N, nodes, at: (a, b) => nodes[b]?.[a] }
  /** Nearest intersection node to a world position. */
  layout.nearestNode = (x, z) => { const a = clampI(Math.round((x / T + (G - 1) / 2) / 4), 0, N - 1), b = clampI(Math.round((z / T + (G - 1) / 2) / 4), 0, N - 1); return nodes[b][a] }
  /** Shortest road route between two world positions (BFS over intersections), as a list of [x, z] points. */
  layout.route = (ax, az, bx, bz) => {
    const s = layout.nearestNode(ax, az), e = layout.nearestNode(bx, bz), prev = new Map([[s, null]]), q = [s]
    while (q.length) { const n = q.shift(); if (n === e) break; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const m = nodes[n.b + dz]?.[n.a + dx]; if (m && !prev.has(m)) { prev.set(m, n); q.push(m) } } }
    const out = []; for (let n = e; n; n = prev.get(n)) out.push([n.x, n.z]); return out.reverse()
  }
  layout.mats = [...matCache.values()]
  layout.stats = stats; layout.grid = grid; layout.group = group; layout.isRoad = (x, z) => { const i = Math.round(x / T + (G - 1) / 2), j = Math.round(z / T + (G - 1) / 2); return road(i, j) }
  return layout
}
