<script setup>
import { reactive } from 'vue'
import { state } from '../store.js'
const P = state.perf
const LEVERS = [
  { id: 'instancing', name: 'GPU instancing', text: 'One draw call for thousands of identical crates instead of one per crate.' },
  { id: 'culling', name: 'Frustum culling', text: 'Skip everything outside the camera view — never submit what nobody can see.' },
  { id: 'lod', name: 'Level of detail', text: 'Far crates use 8–80 triangles instead of 1,280. You cannot tell from here.' },
]
const delta = reactive({})
function flip(id) {
  const before = { calls: P.calls, tris: P.tris, ms: P.ms }
  P[id] = !P[id]
  setTimeout(() => { delta[id] = { calls: P.calls - before.calls, tris: P.tris - before.tris, ms: +(P.ms - before.ms).toFixed(1), on: P[id] } }, 1600)
}
const fmt = (n) => (Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n))
</script>

<template>
  <div class="stats mono">
    <div><b>{{ P.count.toLocaleString() }}</b><span>crates</span></div>
    <div><b>{{ P.calls.toLocaleString() }}</b><span>draw calls</span></div>
    <div><b>{{ fmt(P.tris) }}</b><span>triangles</span></div>
    <div><b>{{ P.cpu }}</b><span>ms CPU</span></div>
  </div>
  <div class="levers" role="group" aria-label="Optimisations">
    <button v-for="l in LEVERS" :key="l.id" class="lever" :class="{ on: P[l.id] }" :aria-pressed="P[l.id]" :disabled="P.phase === 'calib1' || P.phase === 'calib2'" @click="flip(l.id)">
      <span class="sw"></span>
      <span class="body"><b>{{ l.name }}</b><em>{{ l.text }}</em>
        <span v-if="delta[l.id]" class="mono d">{{ delta[l.id].on ? '' : '(off) ' }}{{ delta[l.id].calls > 0 ? '+' : '' }}{{ fmt(delta[l.id].calls) }} calls · {{ delta[l.id].tris > 0 ? '+' : '' }}{{ fmt(delta[l.id].tris) }} tris · {{ delta[l.id].ms > 0 ? '+' : '' }}{{ delta[l.id].ms }} ms</span></span>
    </button>
  </div>
  <p class="mono note">These numbers come straight from the renderer while you play — draw calls and triangles from <code>renderer.info</code>, CPU time from timing the real render call. Only the millisecond total mixes in a triangle-throughput model.</p>
</template>

<style scoped>
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:.4rem;text-align:center}.stats div{padding:.5rem .2rem;border:1px solid var(--faint);border-radius:var(--radius)}.stats b{display:block;font-weight:300;font-size:1.05rem;color:var(--fg);letter-spacing:0}.stats span{color:var(--dim);font-size:.5rem}
.levers{display:grid;gap:.5rem}
.lever{display:flex;gap:.8rem;text-align:left;padding:.7rem .85rem;border:1px solid var(--faint);border-radius:calc(var(--radius) * 1.3);background:transparent;transition:all .25s}
.lever:disabled{opacity:.5}.lever .sw{width:.95rem;height:.95rem;border-radius:50%;border:2px solid var(--faint);flex:none;margin-top:.15rem}
.lever.on{border-color:hsl(var(--h) 92% 58% / .55);background:var(--primary-soft)}.lever.on .sw{background:var(--primary);border-color:var(--primary);box-shadow:0 0 12px var(--primary)}
.body{display:grid;gap:.25rem}.body b{font-weight:400}.body em{font-style:normal;color:var(--dim);font-size:.8rem;line-height:1.4}.d{color:#3dff9a;font-size:.58rem;text-transform:none;letter-spacing:0}
.note{color:var(--dim);font-size:.56rem;text-transform:none;letter-spacing:.02em;line-height:1.5}.note code{color:var(--accent)}
</style>
