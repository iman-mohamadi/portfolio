<script setup>
import { inject, computed } from 'vue'
import { state, STATIONS } from '../store.js'
const engine = inject('engine')
const s = computed(() => STATIONS[state.station])
const last = computed(() => state.station === STATIONS.length - 1)
</script>

<template>
  <aside class="panel" :key="state.station" aria-live="polite" @pointerdown="state.auto && engine.takeControl()">
    <span class="tag mono">{{ s.n }} — {{ s.sub }}</span>
    <h2>{{ s.name }}</h2>
    <p class="chips"><i v-for="k in s.skills" :key="k" class="mono">{{ k }}</i></p>
    <p class="proof">{{ s.proof }}</p>
    <div class="controls"><slot /></div>
    <div class="foot">
      <button class="btn primary mono" :disabled="state.auto" @click="engine.advance()">{{ last ? 'Finish the line' : 'Ship to ' + STATIONS[state.station + 1].name }} →</button>
    </div>
  </aside>
</template>
