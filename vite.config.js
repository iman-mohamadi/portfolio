import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: { chunkSizeWarningLimit: 900, rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), classic: resolve(import.meta.dirname, 'classic.html') } } },
})
