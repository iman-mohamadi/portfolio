# Iman Mohammadi — Interactive 3D Portfolio

A portfolio that is a small digital city. You arrive at a quiet black screen, enter, and drive through **Iman's Digital City**:
every district is a part of the professional profile — who I am, where I have worked, what I have built, my 3D lab, and how to get in touch.
The 3D world is the interface; the car is only the way to get around. A recruiter can read everything in under a minute without driving.

**Discover → Understand → Explore → Connect.** At any moment the HUD answers four questions: *where am I? · what is this? · what can I do here? · where next?*

## The experience

- **Arrival** — black screen, name and role, *Enter my world* (or *Read the portfolio* / a guided tour). Short onboarding, then your first destination is marked.
- **Districts** — Profile (monolith) · Experience (three gates over the east boulevard) · Project District (one small environment per project along the south avenue: a component studio, a hotel, a workshop with a live-resizing table, an edge-server platform, a mini stadium, a developer lab) · 3D Lab (dome with live exhibits: shader orb, particle field, glTF turntable, physics balls) · Communication Terminal (tower + terminal).
- **Always oriented** — district + location label, current objective with distance, a five-step journey bar, a discovery counter, an architectural minimap, a beam + road ribbon to the objective, and a contextual prompt (`E — Enter Raya UI studio`) only when there is something to do.
- **Chapters** — pressing `E` (or *Read* in the menu) opens a location as a chapter: the world eases into slow motion, the camera glides to a hero shot, and a focused card shows title → subtitle/tech → summary → details → links (progressive disclosure). `Esc` returns.
- **Discovery** — first visits fire a *Location discovered* moment and fill the journal. `Tab` opens the menu: journey list (Read · Go · Jump for every location), world map, optional games, settings.
- **Two kinds of visitors** — explorers drive, collect and discover; recruiters use *Hire me*, the menu's *Read* buttons, `1`–`5`, or the 2D reader (also the automatic fallback when WebGL is missing).
- **Optional, never required** — Street Circuit race, Delivery Rush, Stunt Park (real ramp physics and a combo score), a garage of eight cars, traffic, day/night cycle and weather. They live under **Menu → Play**.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

Controls: `WASD` / arrows drive · drag to look · `E` interact · `Tab` menu · `1`–`5` journey steps · `T` guided tour · `G` play menu · `C` garage · `N` time of day · `B` weather · `P` photo · `Esc` back.
Touch: floating joystick, drag the right side to look, Boost / Drift / Enter buttons. Gamepad: sticks/triggers drive, `A` interact, `Y` tour.

Quality: Menu → Settings → Graphics (Auto / High / Medium / Low). `?quality=high` forces full quality.

## Content is data

Nothing about the portfolio is hard-coded in scene code:

```
src/world/content.js      raw copy: projects, jobs, skills, stats, profile, links (LinkedIn is empty until a real URL is added)
src/world/portfolio.js    locations · districts · journey · optional games  → the single source the app reads
```

The world (`landmarks.js`), HUD (`hud.js`), chapters (`chapter.js`), menu + map (`menu.js`, `minimap.js`), guidance (`guidance.js`), guided tour (`tour.js`) and the 2D reader (`portfolio2d.js`) all render from it. To add a location, add it to `portfolio.js` and give it a builder in `landmarks.js`.

## How it is built

- **Assets** — Kenney CC0 kits merged by `tools/build-kits.mjs` into four compressed GLBs (`public/models/kits/`, ≈2.7 MB total).
- **Rendering** — everything is instanced and chunked for frustum/distance culling; dry materials are cheap Lambert with PBR "wet twins" swapped in during rain; the sky is baked to a small cubemap one face per frame; dynamic resolution scaling; phones never leave the cheap path.
- **Rig and props** — the hero car's wheels ride the simulated suspension travel and the tail lights flare under braking. Crates and cones are real Rapier dynamic bodies (they tumble, stack and sleep); wind turbines turn on the horizon (`scenery.js`).
- **Surfaces** — `surfaces.js` generates a tileable grain / bump / puddle map at boot (no texture downloads) and patches it into the road, ground and pavement materials in world space: asphalt grain, normal bump and roughness breakup, puddles that grow in rain. Roads are PBR on desktop and cheap Lambert on phones. `SkidMarks` (in `fx.js`) lays persistent tyre ribbons on tarmac wherever a wheel slides, spins or locks.
- **Physics** — Rapier (WASM) rigid-body car in `physics.js`: one dynamic chassis, four suspension raycasts (spring + damper), per-tyre drive and lateral grip inside a friction circle (power oversteer, handbrake drifts, weight transfer), ramp wedges and plateau boxes that match the height field, real colliders for every building, tree and lamp, and rotation-based air tricks. The old arcade model stays as a fallback: `?physics=arcade`, or automatically if the WASM chunk fails to load. Traffic, props and rivals are still arcade-driven and talk to the car through `car.pos` / `car.vel`.
- **AI** — traffic and race rivals follow right-hand-lane waypoints with Bézier corners built from the city's intersection graph (`traffic.js`).

## Project layout

```
index.html               entry: arrival, HUD, chapter, menu, 2D reader (containers filled from data)
src/world/world.js       scene, car physics, zones, glue
city.js kits.js          procedural city + kit loader (instancing)
portfolio.js content.js  portfolio data
journey.js hud.js        discovery/objective state + HUD
chapter.js menu.js       location chapters, menu (journal, map, play, settings)
minimap.js guidance.js   map renderer, beam + road ribbon
landmarks.js             the physical portfolio (monolith, gates, project environments, lab, terminal)
portfolio2d.js           the whole portfolio as a page
atmosphere.js sky.js     day/night, weather
traffic.js modes.js stunts.js garage.js   optional games
public/                  models, project screenshots (shots/), icons, sw.js, og.jpg, CV
tools/                   asset pipeline
tests/smoke.mjs          end-to-end smoke test
```

## Checks

```bash
npm run build && npm run smoke     # needs Chromium: CHROME_PATH=/path/to/chrome, or `npx playwright-core install chromium`
```

CI (`.github/workflows/ci.yml`) runs both on every push. `vercel.json` sets caching + security headers. Analytics are cookieless (Vercel Web Analytics), off on localhost / Do-Not-Track / `VITE_ANALYTICS=off`.

## 3D model credits

- City, car, nature and racing kits — [Kenney](https://kenney.nl/assets) — **CC0**, see `public/models/kits/LICENSE.txt`. The hero Neon GT is Kenney's `race-future` from the car kit, so every model on the site is CC0.

## License

MIT
