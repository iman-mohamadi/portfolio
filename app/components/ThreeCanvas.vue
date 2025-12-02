<template>
  <div ref="canvasContainer" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ThreeScene } from '~/utils/ThreeScene'

const canvasContainer = ref<HTMLCanvasElement | null>(null)
let threeScene: ThreeScene | null = null

onMounted(() => {
  if (canvasContainer.value) {
    // Instantiate our class
    threeScene = new ThreeScene()

    // Initialize the scene and pass the container element
    threeScene.init(canvasContainer.value)

    // Add a resize listener
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        threeScene?.updateSize(width, height)
      }
    })

    resizeObserver.observe(canvasContainer.value)

    // Cleanup on unmount
    onBeforeUnmount(() => {
      resizeObserver.disconnect()
      threeScene?.cleanup()
    })
  }
})
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  outline: none;
}
</style>
