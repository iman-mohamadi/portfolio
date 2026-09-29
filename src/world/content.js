// All copy + layout for the 3D world. Positions are [x, z] on the ground plane; the car spawns at (0, 6) facing north (-z).

export const ORB_NAMES = ['Vue 3', 'Nuxt', 'Next.js', 'React', 'Three.js', 'GLSL', 'GSAP', 'WebGL', 'Pinia', 'Tailwind', 'Node.js', 'TypeScript', 'FastAPI', 'GraphQL', 'Nitro', 'VueUse', 'R3F', 'Zustand']

export const DIALOGUE = [
  "Hey — I'm Iman Mohammadi. Welcome to my world.",
  "By day I'm a senior front-end architect: Vue, Nuxt, Next.js and a lot of WebGL. Nine-plus years, 93 systems shipped, four continents served.",
  'This whole site is a live Three.js city. Drive around — About is north-west, Skills north-east, my Work lines the avenue to the south.',
  'East along the boulevard is my career, and the contact harbour waits far south-east. Collect the orbs, jump the ramps, race the rivals. Have fun!',
]

export const PROJECTS = [
  { id: 'raya', n: '01', name: 'Raya UI', role: 'Author / Creator', stack: 'Vue.js · Nuxt · Tailwind CSS', chips: ['Vue 3', 'Nuxt 3', 'Tailwind', 'TypeScript'], chip: '40 teams', img: 'raya', url: 'https://raya-ui.com', host: 'raya-ui.com', text: 'Open-source, tokenised design system built to stay coherent across 40 product teams.', points: ['High-performance, interactive Vue primitives — black, bold and strictly typed', 'Design tokens keep 40 product teams visually coherent', 'Open source on GitHub'], viz: 'grid' },
  { id: 'hotelyar', n: '02', name: 'Hotelyar', role: 'Senior Architect', stack: 'Vue.js · Nuxt · SSR', chips: ['Vue 3', 'Nuxt 3', 'SSR / SSG', 'Tailwind'], chip: '1.2M queries/s', img: 'hotelyar', url: 'https://hotelyar.com', host: 'hotelyar.com', text: 'Enterprise reservation platform engineered to route 1.2M queries/sec at low TTFB.', points: ['Built to route 1.2M queries per second', 'Low TTFB through SSR/SSG, code splitting and asset caching', 'Figma prototypes turned into production Nuxt + Tailwind'], viz: 'bars' },
  { id: 'woodcoder', n: '03', name: 'Woodcoder', role: 'Lead 3D Engineer', stack: 'Vue.js · Three.js · WebGL', chips: ['Vue 3', 'Three.js', 'WebGL', 'GSAP'], chip: '60 fps · WebGL', img: 'woodcoder', url: 'https://woodcoder.com', host: 'woodcoder.com', text: 'Live parametric 3D furniture configurator holding 60fps on integrated GPUs.', points: ['Live parametric modeling — change the size, see the furniture rebuild', 'Holds 60fps even on integrated GPUs', 'GSAP-driven UI animation on top of the 3D scene'], viz: 'cube' },
  { id: 'rizo', n: '04', name: 'Rizo', role: 'Lead Engineer', stack: 'Next.js · Server Components', chips: ['Next.js', 'React Server Components', 'TypeScript'], chip: 'RSC · edge', img: null, url: 'https://rizo.top', host: 'rizo.top', text: 'Edge-deployed platform on React Server Components for maximum speed & SEO.', points: ['Edge-deployed on the Next.js App Router', 'React Server Components keep client JavaScript minimal', 'Tuned for speed and SEO'], viz: 'tree' },
  { id: 'tricup', n: '05', name: 'Tricup', role: 'Founder / Full-Stack', stack: 'React.js · Tailwind CSS', chips: ['React', 'Tailwind CSS', 'Full-stack'], chip: 'World Cup 2026', img: null, url: 'https://tricup.ir', host: 'tricup.ir', text: 'World Cup 2026 live coverage hub with an interactive match prediction & scoring system.', points: ['Live coverage hub for the 2026 World Cup', 'Interactive match predictions with a scoring system', 'Designed, built and run end to end'], viz: 'ball' },
  { id: 'tinyhub', n: '06', name: 'TinyHub', role: 'Developer tools', stack: 'Next.js · Node.js · Micro-tools', chips: ['Next.js', 'Node.js', 'Micro-tools'], chip: 'JSON · fast · free', img: 'tinyhub', url: 'https://tinyhub.ir', host: 'tinyhub.ir', text: 'Developer productivity suite — JSON formatter, live syntax highlighter & more.', points: ['JSON formatter with validation and prettifying', 'Live syntax highlighter and code sharing', 'Minimal, fast and free'], viz: 'json' },
]

export const JOBS = [
  { id: 'gsi', date: 'May 2017 — Jan 2020', role: 'Frontend Developer', co: 'GSI Telecom', pts: ['Built cross-browser UIs for enterprise telecom management platforms with Vue.js and Bootstrap.', 'Modernized legacy HTML/CSS into current structures, improving load speed and accessibility.'] },
  { id: 'dew', date: 'Nov 2020 — Oct 2023', role: 'Frontend Web Developer', co: 'Dewzilla', pts: ['Built and scaled responsive enterprise apps across the Vue.js and Nuxt.js ecosystem.', 'Engineered state management with Pinia and integrated microservices via REST.', 'Developed a scalable UI component system with Tailwind CSS and Vuetify.'] },
  { id: 'arn', date: 'Jan 2024 — Present', role: 'Senior Frontend Developer', co: 'Arnika Mehr Kish', pts: ['Leading front-end for high-traffic platforms including Hotelyar.com and Woodcoder.com.', 'Pioneering interactive 3D web experiences with WebGL and Three.js for parametric furniture configurators.', 'Turning Figma prototypes into fast Nuxt + Tailwind apps; deep performance and GSAP animation work.'] },
]

export const SKILLS = [
  { g: 'Vue / Nuxt', t: 'Vue.js 3 · Nuxt 3 / Nitro · Pinia · VueUse · Raya UI · Inertia.js' },
  { g: 'React / Next', t: 'Next.js App Router · React Server Components · TypeScript · Zustand / Redux' },
  { g: '3D & Creative Web', t: 'Three.js / R3F · WebGL · GLSL shaders · Parametric modeling · GSAP' },
  { g: 'Architecture', t: 'Tailwind CSS · SSR / SSG · CI/CD · Performance budgets' },
  { g: 'Backend & APIs', t: 'Node.js · Python / FastAPI · GraphQL / Apollo · REST · Microservices' },
]

export const STATS = [['9+', 'years experience'], ['93', 'systems shipped'], ['4', 'continents served'], ['1.2M', 'queries / sec routed']]

/** Gallery Avenue: the south road (x = 0). Boards stand on alternate sides, facing the road. */
export const AVENUE = { z0: 58, dz: 26 }
export const GATES = [72, 120, 168] // career gates span the east boulevard (z = 0)
const projZones = PROJECTS.map((p, i) => {
  const z = AVENUE.z0 + i * AVENUE.dz, side = i % 2 ? 1 : -1
  return { ...p, board: [side * 10.5, z], face: side > 0 ? -Math.PI / 2 : Math.PI / 2, pos: [0, z] }
})

const proj = (p) => ({
  id: p.id, kind: 'project', name: p.name, nav: null, pos: p.pos, r: 11, url: p.url,
  html: `<span class="tag mono">${p.n} — Selected work · ${p.role}</span><h3>${p.name}</h3><p class="chips">${p.chips.map((t) => `<i class="mono">${t}</i>`).join('')}</p><p>${p.text}</p><ul class="pts">${p.points.map((t) => `<li>${t}</li>`).join('')}</ul><a class="btn mono" data-ev="project_visit" href="${p.url}" target="_blank" rel="noopener">${p.host} ↗ <kbd>E</kbd></a>`,
})

export const ZONES = [
  { id: 'home', kind: 'home', name: 'Welcome', nav: 'Home', pos: [0, 0], r: 30, spawn: [0, 28], color: 0xff2d8a },
  {
    id: 'about', kind: 'about', name: 'About', nav: 'About', pos: [-120, -120], r: 24, spawn: [-99, -120], color: 0xff2d8a,
    html: `<span class="tag mono">01 — Summary</span><h3>Nine years of shipping.</h3><p>Senior front-end and full-stack developer architecting high-performance, high-traffic web systems. Creator of <b>Raya UI</b> — an open-source design system — and builder of interactive Three.js / WebGL apps that hold their shape at scale.</p><div class="stats">${STATS.map(([a, b]) => `<div><b>${a}</b><span class="mono">${b}</span></div>`).join('')}</div>`,
  },
  {
    id: 'skills', kind: 'skills', name: 'Skills', nav: 'Skills', pos: [120, -120], r: 24, spawn: [99, -120], color: 0x7a5cff,
    html: `<span class="tag mono">— Technical expertise</span><h3>The toolbox.</h3><ul class="skills">${SKILLS.map((s) => `<li><b>${s.g}</b><span>${s.t}</span></li>`).join('')}</ul>`,
  },
  { id: 'work', kind: 'work', name: 'Work', nav: 'Work', pos: [0, 44], r: 3, spawn: [0, 40], color: 0xff2d8a, silent: true },
  ...projZones.map(proj),
  ...JOBS.map((j, i) => ({
    id: j.id, kind: 'job', name: j.co, nav: i === 0 ? 'Path' : null, pos: [GATES[i], 0], r: 15, spawn: [GATES[i] - 22, 0], color: 0x7a5cff,
    html: `<span class="tag mono">${j.date}</span><h3>${j.role}</h3><h4>${j.co}</h4><ul class="pts">${j.pts.map((p) => `<li>${p}</li>`).join('')}</ul>`,
  })),
  {
    id: 'contact', kind: 'contact', name: 'Contact', nav: 'Contact', pos: [120, 120], r: 24, spawn: [99, 120], color: 0xff2d8a,
    html: `<span class="tag mono">04 — Contact</span><h3>Let's build something that moves.</h3><p>Available for new roles in 2026 · Tehran, Iran · open to remote.</p><div class="cta"><a class="btn primary mono" data-ev="hire_email" href="mailto:im.enzo.021@gmail.com?subject=Let%27s%20talk%20%E2%80%94%20from%20your%20portfolio&body=Hi%20Iman%2C%0A%0A">Hire me — email ↗</a><a class="btn mono" data-ev="cv_download" href="/Iman-Mohammadi-CV.pdf" download>Download CV ↓</a></div><a class="big-link" data-ev="email" href="mailto:im.enzo.021@gmail.com">im.enzo.021@gmail.com</a><div class="links mono"><a data-ev="github" href="https://github.com/iman-mohamadi" target="_blank" rel="noopener">GitHub ↗</a><a data-ev="telegram" href="https://t.me/iEnzO" target="_blank" rel="noopener">Telegram ↗</a><a data-ev="instagram" href="https://instagram.com/im_mhmdi" target="_blank" rel="noopener">Instagram ↗</a><a data-ev="phone" href="tel:+989384249894">+98 938 424 9894</a></div>`,
  },
]

export { projZones }
