<script setup>
import { reactive, computed } from 'vue'
import gsap from 'gsap'
import { state } from '../store.js'

const touched = reactive({ hue: false, radius: false, density: false })
const px = computed(() => Math.round(6 + state.tokens.radius * 36))
const PRESETS = [
  { name: 'Raya', hue: 322, radius: 0.28, density: 1 },
  { name: 'Aurora', hue: 160, radius: 0.62, density: 1.12 },
  { name: 'Ember', hue: 18, radius: 0.06, density: 0.86 },
  { name: 'Ice', hue: 205, radius: 0.95, density: 1.22 },
]
const same = (p) => Math.abs(state.tokens.hue - p.hue) < 3 && Math.abs(state.tokens.radius - p.radius) < 0.03
function preset(p) { Object.keys(touched).forEach((k) => (touched[k] = true)); gsap.to(state.tokens, { hue: p.hue, radius: p.radius, density: p.density, duration: 1.1, ease: 'power3.inOut' }) }
const done = computed(() => touched.hue && touched.radius && touched.density)
</script>

<template>
  <div class="field"><label class="mono">Hue <b>{{ Math.round(state.tokens.hue) }}°</b></label><input type="range" min="0" max="360" step="1" v-model.number="state.tokens.hue" aria-label="Hue" @input="touched.hue = true" /></div>
  <div class="field"><label class="mono">Radius <b>{{ px }}px</b></label><input type="range" min="0" max="1" step="0.01" v-model.number="state.tokens.radius" aria-label="Corner radius" @input="touched.radius = true" /></div>
  <div class="field"><label class="mono">Density <b>{{ state.tokens.density.toFixed(2) }}×</b></label><input type="range" min="0.75" max="1.35" step="0.01" v-model.number="state.tokens.density" aria-label="Density" @input="touched.density = true" /></div>
  <div class="seg" role="group" aria-label="Theme presets"><button v-for="p in PRESETS" :key="p.name" class="mono" :class="{ on: same(p) }" @click="preset(p)">{{ p.name }}</button></div>
  <p class="mono tip" :class="{ ok: done }">{{ done ? '✓ Tokens set — the whole line just re-themed' : 'Move all three tokens — the 3D kit, the factory and this UI share them' }}</p>
</template>

<style scoped>.tip{color:var(--dim);font-size:.62rem;line-height:1.5;text-transform:none;letter-spacing:.02em}.tip.ok{color:var(--primary)}</style>
