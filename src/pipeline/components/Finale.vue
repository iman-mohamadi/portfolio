<script setup>
import { computed, inject } from 'vue'
import { state } from '../store.js'
const engine = inject('engine')
const clock = computed(() => { const s = state.stats.seconds || 0; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` })
const T = state.tokens, C = computed(() => state.stats.cabinet || {}), P = state.perf, D = state.deploy
const px = computed(() => Math.round(6 + T.radius * 36))
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n))
const cards = computed(() => [
  { n: '01', t: 'Design', big: `${Math.round(T.hue)}° · ${px.value}px`, sub: 'hue · corner radius — one token set re-themed the world, the UI kit and this page.', tag: 'Raya UI' },
  { n: '02', t: 'Build', big: `${C.value.parts ?? '–'} boards`, sub: `${C.value.w}×${C.value.h}×${C.value.d} cm cabinet nested on ${C.value.sheets} sheets, ${C.value.yield}% plywood yield.`, tag: 'Woodcoder' },
  { n: '03', t: 'Render', big: `${state.stats.layersOn ?? 0} layers`, sub: `${state.stats.shaderMs ?? 0} ms of hand-written GLSL — reflection, iridescence, displacement, bloom.`, tag: 'GLSL / TSL' },
  { n: '04', t: 'Perf', big: `${P.base ? P.base.toFixed(0) : '–'} → ${P.ms.toFixed(1)} ms`, sub: `${fmt(P.baseCalls || 0)} → ${fmt(P.calls)} draw calls, ${fmt(P.baseTris || 0)} → ${fmt(P.tris)} triangles. Measured, not mocked.`, tag: '60fps budgets' },
  { n: '05', t: 'Deploy', big: `${D.base} → ${D.ttfb} ms`, sub: `${D.nodes.length} edge nodes, four continents.${D.optimal ? ' The optimal placement.' : ''} Hotelyar does 1.2M queries/sec.`, tag: 'SSR · Edge' },
])
</script>

<template>
  <section class="finale" aria-label="Pipeline complete">
    <div class="head">
      <p class="mono tag">Release v1.0 shipped</p>
      <h2>Shipped in <span class="serif">{{ clock }}</span></h2>
      <p class="lead">Five stations, every one running live code — Vue 3, Three.js, GLSL and GSAP. This is how I work: from tokens to the edge, with the frame budget in mind.</p>
      <div class="cta">
        <a class="btn primary mono" data-ev="hire" href="mailto:im.enzo.021@gmail.com?subject=Let%27s%20talk%20%E2%80%94%20The%20Pipeline&body=Hi%20Iman%2C%0A%0A">Hire me — email ↗</a>
        <a class="btn mono" href="/Iman-Mohammadi-CV.pdf" download>Download CV ↓</a>
        <a class="btn mono" href="https://github.com/iman-mohamadi" target="_blank" rel="noopener">GitHub ↗</a>
        <button class="btn mono" @click="engine.restart()">↺ Run it again</button>
        <a class="btn mono" href="/">Drive the 3D world →</a>
      </div>
    </div>
    <ol class="cards">
      <li v-for="c in cards" :key="c.n"><span class="mono n">{{ c.n }} · {{ c.t }}</span><b>{{ c.big }}</b><p>{{ c.sub }}</p><i class="mono">{{ c.tag }}</i></li>
    </ol>
  </section>
</template>

<style scoped>
.finale{position:fixed;z-index:20;inset:0;overflow:auto;padding:calc(var(--pad) * 3.2) var(--pad) var(--pad);display:flex;flex-direction:column;gap:1.6rem;background:linear-gradient(180deg,transparent 15%,rgba(5,6,10,.86) 68%)}
.head{max-width:52rem;display:grid;gap:.9rem;margin-top:auto}.tag{color:var(--primary)}
h2{font-weight:200;font-size:clamp(2.8rem,8vw,7rem);letter-spacing:-.06em;line-height:.9}h2 .serif{color:hsl(var(--h) 90% 88%);letter-spacing:-.04em}
.lead{color:var(--dim);max-width:38rem;line-height:1.5;font-size:clamp(1rem,1.4vw,1.2rem)}
.cards{list-style:none;display:grid;grid-template-columns:repeat(5,1fr);gap:.7rem}
.cards li{display:grid;gap:.4rem;padding:1rem 1.1rem;border:1px solid var(--faint);border-radius:calc(var(--radius) + 2px);background:rgba(9,10,14,.72);backdrop-filter:blur(14px);align-content:start}
.n{color:var(--primary)}.cards b{font:200 1.7rem/1.05 var(--sans);letter-spacing:-.04em}.cards p{color:var(--dim);font-size:.8rem;line-height:1.45}.cards i{font-style:normal;color:var(--dim);font-size:.6rem;margin-top:.2rem}
@media (max-width:1100px){.cards{grid-template-columns:repeat(2,1fr)}}@media (max-width:560px){.cards{grid-template-columns:1fr}}
</style>
