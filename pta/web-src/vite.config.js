import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  plugins: [vue()],
  base: '/',
  build: {
    outDir: resolve(here, '../web/dist'),
    emptyOutDir: true,
    assetsDir: 'static'
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8080' }
  }
})
