<script setup>
import { ref, computed } from 'vue'
import { state } from '../store.js'
import { CHUNKS, LAYER_ORDER } from '../engine/render.js'

const open = ref('pbr')
const total = computed(() => state.stats.shaderMs ?? 0)
const NAMES = { pbr: 'PBR reflection', rim: 'Fresnel rim', iridescence: 'Iridescence', displace: 'Displacement', bloom: 'Bloom' }
function toggle(id) { state.layers[id] = !state.layers[id]; open.value = id }
const kw = /\b(vec3|vec4|float|return|uniform|mix|max|dot|pow|reflect|cos|snoise)\b/g
const html = computed(() => CHUNKS[open.value].glsl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(\/\/.*)/g, '<span class="c">$1</span>').replace(kw, '<span class="k">$1</span>').replace(/(\d+\.?\d*)/g, (m, n, off, s) => (s[off - 1] === '>' || /[a-z_]/i.test(s[off - 1] || '') ? m : `<span class="v">${m}</span>`)))
</script>

<template>
  <div class="layers" role="group" aria-label="Shader layers">
    <button v-for="id in LAYER_ORDER" :key="id" class="layer" :class="{ on: state.layers[id], sel: open === id }" @click="toggle(id)" :aria-pressed="state.layers[id]">
      <span class="sw"></span><span class="nm">{{ NAMES[id] }}</span><span class="mono cost">{{ CHUNKS[id].cost.toFixed(1) }} ms</span>
    </button>
  </div>
  <div class="mono budget"><span>GPU cost of your stack</span><b>{{ total.toFixed(1) }} ms</b></div>
  <div class="code" v-html="html" :aria-label="CHUNKS[open].title + ' source'"></div>
  <p class="mono note">This source is the exact string compiled into the material you're looking at.</p>
</template>

<style scoped>
.layers{display:grid;gap:.4rem}
.layer{display:flex;align-items:center;gap:.7rem;padding:.6rem .8rem;border:1px solid var(--faint);border-radius:calc(var(--radius) * 1.4);background:transparent;text-align:left;transition:all .25s}
.layer .sw{width:.9rem;height:.9rem;border-radius:50%;border:2px solid var(--faint);flex:none;transition:all .25s}
.layer.on .sw{background:var(--primary);border-color:var(--primary);box-shadow:0 0 12px var(--primary)}
.layer.on{border-color:hsl(var(--h) 92% 58% / .55);background:var(--primary-soft)}
.layer.sel{outline:1px solid var(--accent);outline-offset:1px}
.nm{flex:1}.cost{color:var(--dim);font-size:.62rem}
.budget{display:flex;justify-content:space-between;color:var(--dim)}.budget b{color:var(--fg);font-weight:400}
.note{color:var(--dim);font-size:.58rem;text-transform:none;letter-spacing:.02em;line-height:1.5}
</style>
