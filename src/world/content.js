// Raw portfolio copy. src/world/portfolio.js turns this into locations, districts and the journey the world is built from.

export const ORB_NAMES = ['Vue 3', 'Nuxt', 'Next.js', 'React', 'Three.js', 'GLSL', 'GSAP', 'WebGL', 'Pinia', 'Tailwind', 'Node.js', 'TypeScript', 'FastAPI', 'GraphQL', 'Nitro', 'VueUse', 'R3F', 'Zustand']

export const PROJECTS = [
  { id: 'raya', n: '01', name: 'Raya UI', role: 'Author / Creator', stack: 'Vue.js · Nuxt · Tailwind CSS', chips: ['Vue 3', 'Nuxt 3', 'Reka UI', 'shadcn-vue', 'Tailwind', 'TypeScript'], chip: '40 teams', img: 'raya', url: 'https://raya-ui.com', host: 'raya-ui.com', text: 'Open-source, tokenised design system built to stay coherent across 40 product teams.', points: ['High-performance, interactive Vue primitives — black, bold and strictly typed', 'Design tokens keep 40 product teams visually coherent', 'Open source on GitHub'], viz: 'grid' },
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

export const PROFILE = {
  name: 'Iman Mohammadi',
  title: 'Senior Full-Stack & 3D Web Engineer',
  aka: 'Senior front-end architect · WebGL & 3D web',
  place: 'Tehran, Iran',
  availability: 'Available for new roles in 2026 · open to remote',
  summary: 'Senior front-end and full-stack developer architecting high-performance, high-traffic web systems. Creator of Raya UI — an open-source design system — and builder of interactive Three.js / WebGL apps that hold their shape at scale.',
}
/** Every outbound link. `linkedin` is intentionally empty until a real URL is added — the UI only renders links that exist. */
export const LINKS = {
  email: 'im.enzo.021@gmail.com',
  github: 'https://github.com/iman-mohamadi',
  telegram: 'https://t.me/iEnzO',
  instagram: 'https://instagram.com/im_mhmdi',
  linkedin: null,
  phone: '+989384249894',
  phoneLabel: '+98 938 424 9894',
  cv: '/Iman-Mohammadi-CV.pdf',
}
