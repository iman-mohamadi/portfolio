<script setup>
import { onMounted, provide, ref, shallowRef } from 'vue'
import { state } from './store.js'
import { createEngine } from './engine/index.js'
import { createDesign } from './engine/design.js'
import { createBuild } from './engine/build.js'
import { createRenderStation } from './engine/render.js'
import { createPerf } from './engine/perf.js'
import { createDeploy } from './engine/deploy.js'
import BossBar from './components/BossBar.vue'
import Start from './components/Start.vue'
import Hud from './components/Hud.vue'
import Panel from './components/Panel.vue'
import Finale from './components/Finale.vue'
import DesignPanel from './components/DesignPanel.vue'
import BuildPanel from './components/BuildPanel.vue'
import RenderPanel from './components/RenderPanel.vue'
import PerfPanel from './components/PerfPanel.vue'
import DeployPanel from './components/DeployPanel.vue'
const panels = [DesignPanel, BuildPanel, RenderPanel, PerfPanel, DeployPanel]

const canvas = ref(null), engine = shallowRef(null), lost = ref(false)
const reload = () => location.reload()
provide('engine', engine)

onMounted(async () => {
  try { await document.fonts?.ready } catch (_) { /* fonts optional */ }
  const e = await createEngine(canvas.value, state, { modules: [createDesign, createBuild, createRenderStation, createPerf, createDeploy] })
  e.core.onContextLost(() => (lost.value = true))
  engine.value = e
  document.addEventListener('pointerdown', (ev) => { if (ev.target.closest?.('button, .seg')) e.sfx.click() })
  document.addEventListener('input', (ev) => { if (ev.target.type === 'range') e.sfx.tick(500 + Number(ev.target.value % 100) * 6) })
  if (import.meta.env.DEV) window.__pl = { engine: e, state }
})
</script>

<template>
  <canvas ref="canvas" class="gl" aria-hidden="true" />
  <Start v-if="state.phase === 'loading' || state.phase === 'start'" />
  <template v-if="state.phase === 'play'"><Hud /><Panel><component :is="panels[state.station]" /></Panel><BossBar v-if="state.station === 3" /></template>
  <Finale v-if="state.phase === 'finale'" />
  <div v-if="lost" class="lost" role="alert"><div><h2>Graphics interrupted</h2><p>The GPU reset this page.</p><button @click="reload">Reload</button> <a href="/classic.html">Classic version</a></div></div>
</template>
