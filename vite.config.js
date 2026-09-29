import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

const r = (p) => resolve(import.meta.dirname, p)
export default defineConfig({
  plugins: [vue()],
  build: { chunkSizeWarningLimit: 900, rollupOptions: { input: { main: r('index.html'), classic: r('classic.html'), pipeline: r('pipeline.html') } } },
})
