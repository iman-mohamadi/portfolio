import { reactive } from 'vue'

export const STATIONS = [
  { id: 'design', n: '01', name: 'Design', sub: 'Figma → tokens', skills: ['Design systems', 'Vue / Nuxt', 'Tailwind'], proof: 'Raya UI — one token set kept 40 product teams coherent.' },
  { id: 'build', n: '02', name: 'Build', sub: 'Parametric assembly', skills: ['Parametric modeling', 'Three.js', 'Vue'], proof: 'Woodcoder — a live 3D furniture configurator holding 60fps on integrated GPUs.' },
  { id: 'render', n: '03', name: 'Render', sub: 'Shader polish', skills: ['GLSL / TSL', 'Three.js', 'GSAP'], proof: 'Every glow, sky and hologram on this site is hand-written shader code.' },
  { id: 'perf', n: '04', name: 'Perf', sub: 'Frame-budget boss', skills: ['Performance budgets', 'Instancing', 'LOD'], proof: 'Real measurements: draw calls, triangles and render time — not a fake meter.' },
  { id: 'deploy', n: '05', name: 'Deploy', sub: 'Edge network', skills: ['SSR / SSG', 'Edge', 'Node · FastAPI'], proof: 'Hotelyar — 1.2M queries/sec routed at low TTFB, four continents served.' },
]

/** Single source of truth. The Vue UI edits it; the Three.js engine watches it. */
export const state = reactive({
  phase: 'loading', // loading → start → play → finale
  station: 0,
  done: [false, false, false, false, false],
  auto: false,
  caption: '',
  muted: false,
  t0: 0,
  // 01 Design
  tokens: { hue: 322, radius: 0.28, density: 1 },
  // 02 Build
  cabinet: { w: 120, h: 180, d: 42, shelves: 3, finish: 0, exploded: false },
  // 03 Render
  layers: { pbr: false, rim: false, iridescence: false, displace: false, bloom: true },
  // 04 Perf
  perf: { instancing: false, culling: false, lod: false, ms: 0, calls: 0, tris: 0, cpu: 0, fps: 0, base: 0, target: 16.6, count: 0, phase: 'idle', won: false },
  // 05 Deploy
  deploy: { nodes: [], ttfb: 0, p95: 0, base: 0, target: 125, won: false, optimal: false, best: { mean: 0, set: [] }, rows: [] },
  stats: {},
})

export const defaults = () => JSON.parse(JSON.stringify({
  tokens: state.tokens, cabinet: state.cabinet, layers: state.layers,
}))
