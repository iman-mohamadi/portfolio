# Iman Mohammadi — Drive My Portfolio

A portfolio that is a **3D world**. Drive a car around a Three.js scene: each zone is a section of the CV
(About, Skills, Work, Career path, Contact), and an "Iman" character introduces himself at spawn.

- **World** — `index.html` + `src/world/` (Three.js, custom GLSL ground, bloom, arcade car physics, minimap, WebAudio synth)
- **Classic version** — `classic.html` (Vite, GSAP, Lenis, WebGL hero) for a regular scrolling site
- **Auto tour** — press `T` (or tap *Auto tour*): the car drives itself through every zone, pausing at each for the info panel. Any input takes back control
- **Look** — shader sky (aurora, nebula, ringed planet), lit instanced skyline, hologram Iman, live-animated project boards, neon light trails, boost pads + energy meter
- **Performance** — instanced props/orbs (~95 draw calls), GPU-animated particles, dynamic resolution scaling that adapts to the display's refresh rate, lazy-loaded model pipeline
- **Mobile** — floating joystick, boost / drift / interact buttons, safe-area aware layouts, adaptive quality

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/ (both pages)
```

Controls: `WASD` / arrows drive · `Shift` boost · `Space` drift · `E` interact · `1–6` fast travel · `T` auto tour · `R` time trial · `P` photo.
Gamepad: sticks/triggers drive, `RB`/`B` boost, `X`/`LB` drift, `A` interact/start, `Y` tour. Touch: floating joystick + Boost / Drift buttons.

Quality: the ⚙ button cycles Auto / High / Med / Low (Auto adapts resolution to the display's refresh rate). `?quality=high` forces full quality.

## Project layout

```
index.html            3D world entry          classic.html   scrolling version
src/world/world.js    scene, car, zones, UI   stations.js    the six physical sections
helpers.js  content.js  tour.js  sky.js  fx.js  models.js  audio.js  analytics.js
public/               models, project screenshots (shots/), icons, sw.js, og.jpg, CV
tests/smoke.mjs       end-to-end smoke test
```

## Checks

```bash
npm run build && npm run smoke     # smoke test needs Chromium: CHROME_PATH=/path/to/chrome, or `npx playwright-core install chromium`
```

CI (`.github/workflows/ci.yml`) runs both on every push. `vercel.json` sets caching + security headers (framework: Vite).
Analytics are cookieless (Vercel Web Analytics), off on localhost / Do-Not-Track / `VITE_ANALYTICS=off`.

## Using real 3D models

Drop `.glb` files into `public/models/` and list them in `public/models/models.json`
(slots: `car`, `avatar`, `prop`). See `public/models/README.md`. Credit CC-BY models via the `credit` field.

## 3D model credits

- Car: *( FREE ) Lamborghini Terzo Millennio* by [SDC PERFORMANCE](https://sketchfab.com/3Duae) — [CC-BY-NC-4.0](https://creativecommons.org/licenses/by-nc/4.0/), via [Sketchfab](https://sketchfab.com/3d-models/free-lamborghini-terzo-millennio-7ad3dffa9d344c3c978eafcc220cb709). Non-commercial licence: swap it out (or get the author's permission) before using this site commercially.

## License

MIT
