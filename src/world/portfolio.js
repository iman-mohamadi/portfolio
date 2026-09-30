import { PROJECTS, JOBS, SKILLS, STATS, PROFILE, LINKS } from './content.js'

/**
 * The portfolio as data. The 3D world, HUD, menu, chapters and the 2D fallback all read this — nothing about
 * Iman's work is hard-coded in scene code. Positions are [x, z] on the ground plane; the car arrives at `spawn`
 * facing `pos`.
 *
 * Progressive disclosure per location:  L1 title · L2 subtitle + tech · L3 summary + points · L4 links.
 */
export { PROFILE, LINKS, STATS, SKILLS }

export const GATES = [72, 120, 168] // experience gates span the east boulevard (z = 0)
export const AVENUE = { z0: 58, dz: 26 } // project avenue: the south road (x = 0)
const mail = `mailto:${LINKS.email}?subject=Let%27s%20talk%20%E2%80%94%20from%20your%20portfolio&body=Hi%20Iman%2C%0A%0A`

/* ---------------------------------------------------------------- districts (for "where am I?") */
export const DISTRICTS = [
  { id: 'arrival', name: 'Arrival', blurb: 'Where the journey starts', shape: ['circle', 0, 0, 44] },
  { id: 'profile', name: 'Profile District', blurb: 'Who I am', shape: ['rect', -102, -102, -42, -42] },
  { id: 'experience', name: 'Experience District', blurb: 'Where I have worked', shape: ['rect', 52, -30, 198, 30] },
  { id: 'projects', name: 'Project District', blurb: 'What I have built', shape: ['rect', -42, 34, 42, 198] },
  { id: 'lab', name: '3D Lab', blurb: 'Experiments in WebGL', shape: ['rect', -102, 42, -42, 102] },
  { id: 'contact', name: 'Communication Terminal', short: 'Contact', blurb: 'Get in touch', shape: ['rect', 42, 42, 102, 102] },
  { id: 'play', name: 'Stunt Park', blurb: 'Optional — just for fun', shape: ['rect', -198, -50, -50, 50] },
]
export const CITY_NAME = "Iman's Digital City"
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    const [k, a, b, c, e] = d.shape
    if (k === 'circle' ? Math.hypot(x - a, z - b) < c : x > a && x < c && z > b && z < e) return d
  }
  return null
}
export const districtById = (id) => DISTRICTS.find((d) => d.id === id)

/* ---------------------------------------------------------------- locations */
const KIND = { raya: 'Design system', hotelyar: 'Reservation platform', woodcoder: '3D configurator', rizo: 'Server-components platform', tricup: 'World Cup 2026 hub', tinyhub: 'Developer tools' } // one-word gloss taken from each project's own description
const project = (p, i) => {
  const z = AVENUE.z0 + i * AVENUE.dz, side = i % 2 ? 1 : -1
  const links = [{ label: 'Explore website', url: p.url, kind: 'primary', ev: 'project_visit' }]
  if (p.id === 'raya') links.push({ label: 'View GitHub', url: LINKS.github, kind: 'ghost', ev: 'github' }) // Raya UI is open source
  return {
    id: p.id, type: 'project', district: 'projects', n: p.n,
    title: p.name, kicker: `Selected work · ${p.role}`, subtitle: `${KIND[p.id]} · ${p.chips.slice(0, 2).join(' · ')}`,
    summary: p.text, points: p.points, tech: p.chips, badge: p.chip, links, host: p.host, shot: p.img, viz: p.viz,
    enter: { raya: 'Enter the Raya UI studio', hotelyar: 'Enter Hotelyar', woodcoder: 'Enter the Woodcoder workshop', rizo: 'Enter Rizo', tricup: 'Enter the Tricup stadium', tinyhub: 'Enter the TinyHub lab' }[p.id] || `Explore ${p.name}`,
    pos: [0, z], r: 11, spawn: [0, z - 8], board: [side * 9.5, z - 11], side, face: side > 0 ? -Math.PI / 2 : Math.PI / 2, index: i,
  }
}
const job = (j, i) => ({
  id: j.id, type: 'experience', district: 'experience', n: `0${i + 1}`,
  title: j.co, kicker: 'Experience', subtitle: `${j.role} · ${j.date}`, period: j.date, role: j.role,
  summary: j.pts[0], points: j.pts.slice(1), tech: [], links: [], enter: `Explore ${j.co}`,
  pos: [GATES[i], 0], r: 15, spawn: [GATES[i] - 11, 0], index: i,
})
const current = JOBS[JOBS.length - 1]
const lab3d = SKILLS.find((s) => s.g.startsWith('3D'))
const woodcoder = PROJECTS.find((p) => p.id === 'woodcoder')

export const LOCATIONS = [
  {
    id: 'home', type: 'home', district: 'arrival', title: PROFILE.name, kicker: 'Arrival', subtitle: PROFILE.title, summary: PROFILE.summary, points: [], tech: [], links: [],
    enter: 'Say hello', pos: [0, 0], r: 30, spawn: [0, 28], hidden: true, // the start point: not part of the discovery count
  },
  {
    id: 'about', type: 'about', district: 'profile', n: '01',
    title: PROFILE.name, kicker: 'Profile', subtitle: PROFILE.title, summary: PROFILE.summary,
    points: [`Now: ${current.role} at ${current.co} (${current.date})`, ...JOBS.slice().reverse().slice(1).map((j) => `Before: ${j.role} at ${j.co} (${j.date})`)],
    tech: SKILLS.flatMap((s) => s.t.split(' · ')).filter((t) => ['Vue.js 3', 'Nuxt 3 / Nitro', 'Next.js App Router', 'Three.js / R3F', 'WebGL', 'GSAP', 'TypeScript', 'Tailwind CSS'].includes(t)),
    stats: STATS, groups: SKILLS, links: [{ label: 'Download CV', url: LINKS.cv, kind: 'primary', ev: 'cv_download', download: true }, { label: 'GitHub', url: LINKS.github, kind: 'ghost', ev: 'github' }],
    enter: 'Meet Iman', pos: [-72, -72], r: 24, spawn: [-52, -72],
  },
  ...JOBS.map(job),
  ...PROJECTS.map(project),
  {
    id: 'lab', type: 'lab', district: 'lab', n: '04',
    title: '3D Lab', kicker: 'Experiments & 3D work', subtitle: 'Three.js · WebGL · GLSL · GSAP',
    summary: 'The 3D work lives here: shaders, particles, physics and glTF models running live in this city. Woodcoder — a parametric furniture configurator that holds 60fps on integrated GPUs — comes from the same craft.',
    points: [`${lab3d.g}: ${lab3d.t}`, ...woodcoder.points.slice(0, 1), 'This whole city is one live Three.js scene.'],
    tech: ['Three.js / R3F', 'WebGL', 'GLSL shaders', 'Parametric modeling', 'GSAP', 'glTF'],
    exhibits: ['Shader orb', 'Particle field', 'Physics balls', 'glTF turntable'],
    links: [{ label: 'See Woodcoder', url: woodcoder.url, kind: 'primary', ev: 'project_visit' }, { label: 'GitHub', url: LINKS.github, kind: 'ghost', ev: 'github' }],
    enter: 'Enter the 3D Lab', pos: [-72, 72], r: 24, spawn: [-52, 72],
  },
  {
    id: 'contact', type: 'contact', district: 'contact', n: '05',
    title: "Let's build something that moves.", kicker: 'Communication terminal', subtitle: PROFILE.availability,
    summary: `You've explored the world. Want to build something together? ${PROFILE.place}.`, points: [], tech: [],
    links: [
      { label: 'Email', url: mail, kind: 'primary', ev: 'hire_email', big: LINKS.email },
      { label: 'GitHub', url: LINKS.github, kind: 'ghost', ev: 'github' },
      LINKS.linkedin && { label: 'LinkedIn', url: LINKS.linkedin, kind: 'ghost', ev: 'linkedin' },
      { label: 'Telegram', url: LINKS.telegram, kind: 'ghost', ev: 'telegram' },
      { label: 'Instagram', url: LINKS.instagram, kind: 'ghost', ev: 'instagram' },
      { label: 'Download CV', url: LINKS.cv, kind: 'ghost', ev: 'cv_download', download: true },
      { label: LINKS.phoneLabel, url: `tel:${LINKS.phone}`, kind: 'ghost', ev: 'phone' },
    ].filter(Boolean),
    enter: 'Open the terminal', pos: [72, 72], r: 22, spawn: [52, 72],
  },
]
// what the objective card says for each location
const GOALS = { home: 'Say hello', about: 'Meet Iman', lab: 'Enter the 3D Lab', contact: 'Get in touch' }
for (const l of LOCATIONS) l.goal = GOALS[l.id] || (l.type === 'experience' ? `Explore ${l.title}` : `Visit ${l.title}`)
export const byId = (id) => LOCATIONS.find((l) => l.id === id) || GAMES.find((g) => g.id === id)
export const discoverable = LOCATIONS.filter((l) => !l.hidden)

/* ---------------------------------------------------------------- the journey (a guide, never a rigid order) */
export const JOURNEY = [
  { id: 'meet', n: '01', label: 'Meet Iman', short: 'Meet Iman', ids: ['about'] },
  { id: 'experience', n: '02', label: 'Explore Experience', short: 'Experience', ids: JOBS.map((j) => j.id) },
  { id: 'projects', n: '03', label: 'Discover Projects', short: 'Projects', ids: PROJECTS.map((p) => p.id) },
  { id: 'lab', n: '04', label: 'Enter the 3D Lab', short: '3D Lab', ids: ['lab'] },
  { id: 'contact', n: '05', label: 'Get in touch', short: 'Contact', ids: ['contact'] },
]

/* ---------------------------------------------------------------- optional games (never required) */
export const RACE_START = [72, 144]
export const GAMES = [
  { id: 'race', type: 'game', district: 'play', title: 'Street Circuit', subtitle: '3 laps vs 3 rivals', enter: 'Start the race', act: 'race', pos: RACE_START, r: 15, spawn: [RACE_START[0] - 26, RACE_START[1] + 3] },
  { id: 'delivery', type: 'game', district: 'play', title: 'Delivery Depot', subtitle: 'Five parcels against the clock', enter: 'Start a delivery shift', act: 'delivery', pos: [24, -24], r: 11, spawn: [24, -6] },
  { id: 'garage', type: 'game', district: 'play', title: 'Garage', subtitle: 'Choose your car', enter: 'Open the garage', act: 'garage', pos: [-24, 24], r: 11, spawn: [-6, 24] },
  { id: 'stunt', type: 'game', district: 'play', title: 'Stunt Park', subtitle: 'Ramps, hoops and combos', enter: 'Take me to the ramps', act: 'stunt', pos: [-120, 0], r: 60, spawn: [-144, -40] },
]

/** Everything the zone detector and fast travel work with. */
export const ZONES = [...LOCATIONS, ...GAMES]
export const zoneKind = (z) => (z.type === 'experience' ? 'job' : z.type)
