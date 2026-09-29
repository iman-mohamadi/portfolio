<script setup>
import { computed } from 'vue'
import { state } from '../store.js'
import { REGIONS } from '../engine/geo.js'
import { MAX_NODES } from '../engine/deploy.js'

const D = state.deploy
const has = (id) => D.nodes.some((n) => n.id === id)
function toggle(r) {
  const i = D.nodes.findIndex((n) => n.id === r.id)
  if (i >= 0) D.nodes.splice(i, 1)
  else if (D.nodes.length < MAX_NODES) D.nodes.push({ id: r.id, name: r.name, lat: r.lat, lon: r.lon })
}
function suggest() {
  D.nodes.splice(0)
  D.best.set.forEach((r, i) => setTimeout(() => D.nodes.push({ ...r }), 350 * (i + 1)))
}
const worst = computed(() => [...(D.rows || [])].sort((a, b) => b.ttfb - a.ttfb).slice(0, 5))
const pct = computed(() => Math.max(0, Math.min(100, 100 - ((D.ttfb - D.target) / Math.max(D.base - D.target, 1)) * 100)))
const heat = (ms) => (ms < 90 ? 'g' : ms < 170 ? 'a' : 'r')
</script>

<template>
  <div class="hero mono">
    <div><span>Average TTFB</span><b :class="{ ok: D.won }">{{ D.ttfb }} ms</b><small>from {{ D.base }} ms with no edge</small></div>
    <div><span>Nodes</span><b>{{ D.nodes.length }}/{{ MAX_NODES }}</b><small>click the globe too</small></div>
  </div>
  <div class="goal"><div class="bar"><i :style="{ width: pct + '%' }" :class="{ ok: D.won }"></i></div><span class="mono">Goal: under {{ D.target }} ms<template v-if="D.won"> — <b class="okc">deployed ✓</b></template></span></div>
  <p v-if="D.optimal" class="mono badge">✦ Optimal placement — nobody can do better ({{ Math.round(D.best.mean) }} ms)</p>
  <div class="regions" role="group" aria-label="Edge regions"><button v-for="r in REGIONS" :key="r.id" class="mono" :class="{ on: has(r.id) }" :aria-pressed="has(r.id)" :disabled="!has(r.id) && D.nodes.length >= MAX_NODES" @click="toggle(r)">{{ r.name }}</button></div>
  <div class="rows">
    <div v-for="w in worst" :key="w.name" class="row"><span>{{ w.name }}</span><span class="mono via">{{ w.edge ? '→ ' + w.via : '→ origin' }}</span><b class="mono" :class="heat(w.ttfb)">{{ w.ttfb }} ms</b></div>
  </div>
  <button class="btn mono" @click="suggest">✦ Show me the optimal placement</button>
  <p class="mono note">Hotelyar routes 1.2M queries/sec in production. Here: great-circle distance, fibre speed, cached edge HTML vs an origin render — a model, not a benchmark.</p>
</template>

<style scoped>
.hero{display:grid;grid-template-columns:1.4fr 1fr;gap:.6rem}.hero>div{display:grid;gap:.15rem;padding:.7rem .8rem;border:1px solid var(--faint);border-radius:var(--radius)}
.hero span{color:var(--dim);font-size:.58rem}.hero b{font:200 1.9rem/1 var(--sans);letter-spacing:-.04em;color:var(--fg)}.hero b.ok{color:#3dff9a}.hero small{color:var(--dim);font-size:.55rem;text-transform:none;letter-spacing:.02em}
.goal{display:grid;gap:.4rem}.bar{height:6px;border-radius:6px;background:var(--faint);overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#ff3b5c,var(--primary));transition:width .5s}.bar i.ok{background:linear-gradient(90deg,#3dff9a,#7ee0ff)}
.goal span{color:var(--dim);font-size:.6rem}.okc{color:#3dff9a;font-weight:400}
.badge{padding:.5rem .7rem;border:1px solid #3dff9a;border-radius:var(--radius);color:#3dff9a;font-size:.6rem;text-transform:none;letter-spacing:.02em}
.regions{display:flex;flex-wrap:wrap;gap:.35rem}.regions button{padding:.4rem .65rem;border:1px solid var(--faint);border-radius:99px;background:transparent;color:var(--dim);font-size:.6rem;transition:all .25s}
.regions button.on{border-color:var(--accent);background:hsl(calc(var(--h) + 180) 90% 60% / .16);color:var(--fg)}.regions button:disabled{opacity:.35}
.rows{display:grid;gap:.15rem}.row{display:grid;grid-template-columns:1fr auto auto;gap:.8rem;font-size:.82rem;color:var(--fg);padding:.2rem 0;border-bottom:1px solid var(--faint)}.via{color:var(--dim);font-size:.58rem;text-transform:none}.row b{font-weight:400;font-size:.68rem;min-width:4.2rem;text-align:right}.g{color:#3dff9a}.a{color:#ffbf3f}.r{color:#ff5470}
.note{color:var(--dim);font-size:.56rem;text-transform:none;letter-spacing:.02em;line-height:1.5}
</style>
