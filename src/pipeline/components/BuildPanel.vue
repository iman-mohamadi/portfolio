<script setup>
import { computed } from 'vue'
import { state } from '../store.js'
import { parts, nest, cutList, FINISHES, LIMITS } from '../engine/cabinet.js'

const c = state.cabinet
const list = computed(() => parts(c))
const nested = computed(() => nest(list.value))
const rows = computed(() => cutList(list.value))
const yieldPct = computed(() => Math.round(nested.value.yield * 100))
// parametric optimiser: which depth gives the best sheet yield with everything else unchanged?
const best = computed(() => {
  let bd = c.d, by = nested.value.yield
  for (let d = LIMITS.d[0]; d <= LIMITS.d[1]; d++) { const y = nest(parts({ ...c, d })).yield; if (y > by + 0.005) { by = y; bd = d } }
  return { d: bd, y: Math.round(by * 100) }
})
const tip = computed(() => best.value.d !== c.d && best.value.y >= yieldPct.value + 4)
</script>

<template>
  <div class="field"><label class="mono">Width <b>{{ c.w }} cm</b></label><input type="range" :min="LIMITS.w[0]" :max="LIMITS.w[1]" v-model.number="c.w" aria-label="Width" /></div>
  <div class="field"><label class="mono">Height <b>{{ c.h }} cm</b></label><input type="range" :min="LIMITS.h[0]" :max="LIMITS.h[1]" v-model.number="c.h" aria-label="Height" /></div>
  <div class="field"><label class="mono">Depth <b>{{ c.d }} cm</b></label><input type="range" :min="LIMITS.d[0]" :max="LIMITS.d[1]" v-model.number="c.d" aria-label="Depth" /></div>
  <div class="field"><label class="mono">Shelves <b>{{ c.shelves }}</b></label><input type="range" :min="LIMITS.shelves[0]" :max="LIMITS.shelves[1]" v-model.number="c.shelves" aria-label="Shelves" /></div>
  <div class="seg" role="group" aria-label="Finish"><button v-for="(f, i) in FINISHES" :key="f.name" class="mono" :class="{ on: c.finish === i }" @click="c.finish = i"><i class="sw" :style="{ background: f.a }"></i>{{ f.name }}</button></div>
  <button class="btn mono" :class="{ primary: c.exploded }" @click="c.exploded = !c.exploded">{{ c.exploded ? '↺ Assemble' : '▤ Flat-pack: nest on sheets' }}</button>

  <div class="cut">
    <div class="mono head"><span>Cut list</span><span>{{ list.length }} boards</span></div>
    <table><tbody><tr v-for="r in rows" :key="r.name + r.size"><td>{{ r.qty }}×</td><td>{{ r.name }}</td><td class="mono">{{ r.size }}</td></tr></tbody></table>
    <div class="yield"><div class="bar"><i :style="{ width: yieldPct + '%' }"></i></div><span class="mono">{{ nested.plySheets }} sheets · yield {{ yieldPct }}% · {{ nested.area.toFixed(2) }} m²</span></div>
    <button v-if="tip" class="btn mono tipbtn" @click="c.d = best.d">✦ Depth {{ best.d }} cm lifts yield to {{ best.y }}%</button>
  </div>
</template>

<style scoped>
.sw{display:inline-block;width:.7rem;height:.7rem;border-radius:50%;margin-right:.4rem;vertical-align:-1px}
.cut{border:1px solid var(--faint);border-radius:var(--radius);padding:.8rem .9rem;display:grid;gap:.6rem}
.head{display:flex;justify-content:space-between;color:var(--dim)}
table{width:100%;border-collapse:collapse;font-size:.82rem}td{padding:.2rem .3rem;color:var(--dim)}td:first-child{color:var(--primary);width:2rem}td:nth-child(2){color:var(--fg)}td.mono{text-align:right;font-size:.62rem;text-transform:none;letter-spacing:0}
.yield{display:grid;gap:.4rem}.bar{height:5px;border-radius:5px;background:var(--faint);overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--primary),var(--secondary));transition:width .5s}
.yield span{color:var(--dim);font-size:.62rem}.tipbtn{justify-content:center;border-color:var(--accent);color:var(--accent)}
</style>
