<script setup>
import { inject } from 'vue'
import { state } from '../store.js'
const engine = inject('engine')
const ready = () => state.phase === 'start' && engine.value
</script>

<template>
  <section class="start" aria-label="Welcome">
    <div class="start__top mono"><span>Iman Mohammadi</span><a href="/">Drive the 3D world →</a><a href="/classic.html">Classic →</a></div>
    <div class="start__mid">
      <p class="mono tag">Senior front-end architect · WebGL &amp; 3D web</p>
      <h1>The <span class="serif">Pipeline</span></h1>
      <p class="lead">Ship a website in five stations. Design tokens, a parametric build, shaders, a frame-budget boss fight and a global deploy — every skill on my CV, as something you can play.</p>
      <div class="cta">
        <button class="btn primary mono" :disabled="!ready()" @click="engine.start()">{{ ready() ? 'Start the line' : 'Building the factory…' }}</button>
        <button class="btn mono" :disabled="!ready()" @click="engine.startAuto?.()">▶ Watch it build itself · 60s</button>
      </div>
      <p class="hint mono">Drag sliders · toggle switches · click the globe · ~3 minutes</p>
    </div>
  </section>
</template>
