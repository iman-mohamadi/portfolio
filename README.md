# Iman Mohammadi — Drive My Portfolio

A portfolio that is a **3D city you can drive**. Cruise a Lamborghini through a living low-poly city built from real 3D models;
each district is a section of the CV (About, Skills, Work, Career path, Contact) and a hologram "Iman" introduces himself at spawn.
Between the sections there is a proper game: a stunt park, street races, delivery jobs, traffic, weather and a garage.

## What is in the world

- **A real 3D city** — 33×33 tiles of roads picked by connectivity, districts (downtown, tech park, suburbs, harbour, parks…) made from
  [Kenney](https://kenney.nl) CC0 kits, ~1,300 instanced models, street lights, trees and a ring of outskirts
- **Living sky** — 24 h day/night cycle (dawn → noon → dusk → neon night), rain and storms with lightning, lit windows and street
  glow at night, a wet-city look in the rain, music that follows the time of day (`N` time · `B` weather)
- **Stunt Park** — ramps over the crossroads, plateaus, boost hoops, real airborne physics: `W`/`S` flip and `A`/`D` barrel-roll in the air,
  land clean to multiply the chain. Drifts, jumps, flips, near misses and smashes stack into a combo that banks as cash
- **Street Circuit** — 3 laps around the avenues against three AI rivals (rubber-banded, lane-following) with checkpoints and prize money
- **Delivery Rush** — pick up parcels and drop them across town against the clock
- **Traffic** — ~28 cars that follow lanes on the road graph, brake for each other and for you, and can be smashed
- **Garage** — eight cars (the hero Lamborghini + Kenney cars) with different handling, bought with the cash you earn
- **Recruiter mode** — press `T`: the car drives itself through every zone. There is also a CV time trial, photo mode, hidden orbs,
  gamepad + touch controls and a fully keyboard-accessible text version of the CV (`#text-version`)

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

Controls: `WASD` / arrows drive · `Shift` boost · `Space` drift · `E` interact · `1–6` fast travel · `G` play menu · `C` garage · `T` auto tour ·
`R` time trial · `N` time of day · `B` weather · `P` photo. Gamepad: sticks/triggers drive, `RB`/`B` boost, `X`/`LB` drift, `A` interact/start, `Y` tour.
Touch: floating joystick + Boost / Drift buttons.

Quality: the ⚙ button cycles Auto / High / Med / Low (Auto adapts resolution to the display's refresh rate). `?quality=high` forces full quality.

## How it is built

- **Assets** — `tools/build-kits.mjs` merges the Kenney kits into four compressed GLBs (`public/models/kits/`, ≈2.7 MB total: gltf-transform
  dedup/weld/quantize + meshopt). Re-run with `KENNEY_DIR=<folder with the unzipped packs> node tools/build-kits.mjs` after `npm install` in `tools/`.
- **Rendering** — everything is drawn with `InstancedMesh`, chunked into 96 m cells so three.js can frustum-cull them; the sky is baked to a small
  cubemap (one face per frame); dynamic resolution scaling; phones get Lambert shading instead of PBR.
- **Physics** — arcade 2D car on a spatial hash of circles/boxes, plus an analytic height field for the kit's ramp pieces (takeoff, ballistic flight, landing).
- **AI** — cars and rivals follow right-hand-lane waypoints with Bézier corners generated from the city's intersection graph (`src/world/traffic.js`).

## Project layout

```
index.html            entry point
src/world/world.js    scene, car physics, zones, UI glue
city.js  kits.js      procedural city + kit loader (instancing)
atmosphere.js sky.js  day/night, weather, sky dome
traffic.js modes.js   ambient traffic, race + delivery modes
stunts.js garage.js   scoring chain, hoops, car garage
stations.js content.js tour.js  the CV sections, copy and auto tour
fx.js models.js audio.js analytics.js helpers.js
public/               models, project screenshots (shots/), icons, sw.js, og.jpg, CV
tools/                asset pipeline (Kenney kits → compressed GLBs)
tests/smoke.mjs       end-to-end smoke test
```

## Checks

```bash
npm run build && npm run smoke     # smoke test needs Chromium: CHROME_PATH=/path/to/chrome, or `npx playwright-core install chromium`
```

CI (`.github/workflows/ci.yml`) runs both on every push. `vercel.json` sets caching + security headers (framework: Vite).
Analytics are cookieless (Vercel Web Analytics), off on localhost / Do-Not-Track / `VITE_ANALYTICS=off`.

## 3D model credits

- City, car, nature and racing kits — [Kenney](https://kenney.nl/assets) — **CC0** (public domain), see `public/models/kits/LICENSE.txt`.
- Hero car: *( FREE ) Lamborghini Terzo Millennio* by [SDC PERFORMANCE](https://sketchfab.com/3Duae) — [CC-BY-NC-4.0](https://creativecommons.org/licenses/by-nc/4.0/), via [Sketchfab](https://sketchfab.com/3d-models/free-lamborghini-terzo-millennio-7ad3dffa9d344c3c978eafcc220cb709). Non-commercial licence: swap it out (or get the author's permission) before using this site commercially.

## License

MIT
