<script setup>
import { inject, computed, onMounted, onUnmounted, ref } from 'vue'
import { state, STATIONS } from '../store.js'
const engine = inject('engine')
const secs = ref(0); let timer
onMounted(() => (timer = setInterval(() => (secs.value = Math.floor((performance.now() - state.t0) / 1000)), 500)))
onUnmounted(() => clearInterval(timer))
function toggleMute() { state.muted = !state.muted; engine.value.sfx.setMuted(state.muted) }
const clock = computed(() => `${String(Math.floor(secs.value / 60)).padStart(2, '0')}:${String(secs.value % 60).padStart(2, '0')}`)
</script>

<template>
  <header class="hud" aria-label="Progress">
    <a class="brand" href="/pipeline.html" aria-label="Restart The Pipeline">IM<em>.</em></a>
    <ol class="steps mono">
      <li v-for="(s, i) in STATIONS" :key="s.id" :class="{ on: state.station === i, done: state.done[i] }" :aria-current="state.station === i ? 'step' : undefined">
        <button :disabled="i > state.station || state.auto" @click="engine.goTo(i)"><b>{{ s.n }}</b><span>{{ s.name }}</span></button>
      </li>
    </ol>
    <div class="meta mono"><span>{{ clock }}</span><button class="mute" :aria-pressed="!state.muted" @click="toggleMute">{{ state.muted ? '♪ off' : '♪ on' }}</button><a href="/classic.html">Classic</a></div>
  </header>
  <div v-if="state.caption || state.auto" class="caption" role="status"><span class="mono">{{ state.caption }}</span><button v-if="state.auto" class="btn mono" @click="engine.takeControl()">✕ Take control</button></div>
</template>
