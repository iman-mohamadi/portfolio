<script setup>
import { computed } from 'vue'
import { state } from '../store.js'
const P = state.perf
const pct = computed(() => Math.max(0, Math.min(100, (P.ms / Math.max(P.base || 34, 1)) * 100)))
const target = computed(() => (P.target / Math.max(P.base || 34, 1)) * 100)
const label = computed(() => (P.phase === 'calib1' || P.phase === 'calib2' ? 'Spawning the boss to fit this device…' : P.won ? 'Frame budget defeated' : 'Bring the frame under budget'))
</script>

<template>
  <div class="boss" :class="{ won: P.won }" role="status" aria-live="polite">
    <div class="mono row"><span>THE FRAME-BUDGET BOSS</span><span>{{ label }}</span></div>
    <div class="track"><i class="hp" :style="{ width: pct + '%' }"></i><b class="line" :style="{ left: target + '%' }"></b></div>
    <div class="mono row nums"><span><b>{{ P.ms.toFixed(1) }}</b> ms est. frame cost</span><span>budget {{ P.target }} ms{{ P.target < 16.6 ? ' (scaled to your GPU)' : '' }}</span></div>
  </div>
</template>

<style scoped>
.boss{position:fixed;z-index:13;left:var(--pad);top:calc(4.6rem + env(safe-area-inset-top,0px));width:min(520px,calc(100vw - 2*var(--pad) - 400px));min-width:340px;display:grid;gap:.45rem;padding:.8rem 1rem;border:1px solid hsl(var(--h) 92% 58% / .5);border-radius:calc(var(--radius) + 2px);background:rgba(8,9,13,.78);backdrop-filter:blur(12px)}
.row{display:flex;justify-content:space-between;color:var(--dim);gap:1rem}.nums b{color:var(--fg);font-weight:400;font-size:1.1rem}
.track{position:relative;height:14px;border-radius:14px;background:rgba(255,255,255,.08);overflow:hidden}
.hp{display:block;height:100%;border-radius:14px;background:linear-gradient(90deg,#ff3b5c,var(--primary));transition:width .35s var(--ease),background .6s}
.line{position:absolute;top:-3px;bottom:-3px;width:2px;background:#7ee0ff;box-shadow:0 0 10px #7ee0ff}
.boss.won .hp{background:linear-gradient(90deg,#3dff9a,#7ee0ff)}.boss.won{border-color:#3dff9a}
@media (max-width:820px){.boss{width:calc(100vw - 2*var(--pad));min-width:0}}
</style>
