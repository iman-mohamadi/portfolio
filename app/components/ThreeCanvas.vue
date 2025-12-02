<template>
  <div
    ref="canvasContainer"
    class="fixed inset-0 w-full h-full -z-10 bg-neutral-950"
  >
    <div class="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80 pointer-events-none" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, } from 'vue'
import { ThreeScene, } from '~/utils/ThreeScene'

const canvasContainer = ref<HTMLElement | null>(null,)
let threeScene: ThreeScene | null = null
let resizeObserver: ResizeObserver | null = null

const handleScroll = () => {
  if (threeScene) {
    threeScene.onScroll(window.scrollY, document.body.scrollHeight,)
  }
}

const handleMouseMove = (event: MouseEvent,) => {
  if (threeScene) {
    threeScene.onMouseMove(event.clientX, event.clientY,)
  }
}

onMounted(() => {
  if (!canvasContainer.value) return

  threeScene = new ThreeScene()
  threeScene.init(canvasContainer.value,)

  // 1. Observe Window Resize
  resizeObserver = new ResizeObserver((entries,) => {
    const { width, height, } = entries[0].contentRect
    threeScene?.updateSize(width, height,)
  },)
  resizeObserver.observe(canvasContainer.value,)

  // 2. Add Event Listeners
  window.addEventListener('scroll', handleScroll,)
  window.addEventListener('mousemove', handleMouseMove,)
},)

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll,)
  window.removeEventListener('mousemove', handleMouseMove,)
  resizeObserver?.disconnect()
  threeScene?.cleanup()
},)
</script>
