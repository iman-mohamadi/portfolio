# Iman Mohammadi — Drive My Portfolio

A portfolio that is a **3D world**. Drive a car around a Three.js scene: each zone is a section of the CV
(About, Skills, Work, Career path, Contact), and an "Iman" character introduces himself at spawn.

- **World** — `index.html` + `src/world/` (Three.js, custom GLSL ground, bloom, arcade car physics, minimap, WebAudio synth)
- **Classic version** — `classic.html` (Vite, GSAP, Lenis, WebGL hero) for a regular scrolling site
- **Mobile** — floating joystick, boost / drift / interact buttons, safe-area aware layouts, adaptive quality

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/ (both pages)
```

Controls: `WASD` / arrows drive · `Shift` boost · `Space` drift · `E` interact · `1–6` fast travel.

## Using real 3D models

Drop `.glb` files into `public/models/` and list them in `public/models/models.json`
(slots: `car`, `avatar`, `prop`). See `public/models/README.md`. Credit CC-BY models via the `credit` field.

## License

MIT
