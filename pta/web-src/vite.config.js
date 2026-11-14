import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

const here = dirname(fileURLToPath(import.meta.url))

/* 构建期给 public/assets/app.css 加内容指纹，避免 Cloudflare/浏览器长期缓存旧 CSS。 */
function cssVersion() {
  return {
    name: 'seedpod-css-version',
    transformIndexHtml(html) {
      try {
        const css = fs.readFileSync(resolve(here, 'public/assets/app.css'))
        const v = crypto.createHash('sha1').update(css).digest('hex').slice(0, 10)
        return html.replace('/assets/app.css', '/assets/app.css?v=' + v)
      } catch (e) { return html }
    }
  }
}

export default defineConfig({
  root: here,
  plugins: [vue(), cssVersion()],
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
