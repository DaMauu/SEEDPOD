<template>
  <div class="changelog-wrap">
    <div class="changelog-body" id="changelog-body">
      <p v-if="loading">加载中…</p>
      <p v-else-if="error">{{ error }}</p>
      <template v-else>
        <template v-for="(b, i) in blocks" :key="i">
          <h3 v-if="b.type === 'h2'">{{ b.text }}</h3>
          <h4 v-else-if="b.type === 'h3'">{{ b.text }}</h4>
          <ul v-else-if="b.type === 'ul'">
            <li v-for="(li, j) in b.items" :key="j">{{ li }}</li>
          </ul>
          <p v-else>{{ b.text }}</p>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const blocks = ref([])
const error = ref('')
const loading = ref(true)
let loaded = false
let busy = false

function parseChangelog(text) {
  const out = []
  let cur = null
  String(text || '').split(/\r?\n/).forEach(function (line) {
    const t = line.trim()
    if (!t) { cur = null; return }
    if (/^###\s+/.test(t)) out.push({ type: 'h3', text: t.replace(/^###\s+/, '') })
    else if (/^##\s+/.test(t)) out.push({ type: 'h2', text: t.replace(/^##\s+/, '') })
    else if (/^#\s+/.test(t)) out.push({ type: 'h2', text: t.replace(/^#\s+/, '') })
    else if (/^[-*]\s+/.test(t)) {
      const item = t.replace(/^[-*]\s+/, '')
      if (!cur || cur.type !== 'ul') { cur = { type: 'ul', items: [] }; out.push(cur) }
      cur.items.push(item)
    } else { out.push({ type: 'p', text: t }); cur = null }
  })
  return out
}

function visible() {
  const v = document.querySelector('[data-view="changelog"]')
  return !!(v && !v.hidden)
}
function loggedIn() {
  return !document.querySelector('#login-mask')
}
async function load() {
  if (busy || loaded || !loggedIn()) return
  busy = true
  loading.value = true
  error.value = ''
  try {
    const r = await fetch('/api/changelog', { credentials: 'same-origin' })
    const j = await r.json()
    if (!j || !j.ok) { error.value = '读不到更新日志'; return }
    blocks.value = parseChangelog(j.data && j.data.text)
    loaded = true
  } catch (e) {
    error.value = '读不到更新日志'
  } finally {
    busy = false
    loading.value = false
  }
}
function ensure() {
  if (visible() && loggedIn()) load()
}
onMounted(() => {
  window.addEventListener('hashchange', ensure)
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
})
</script>

<style scoped>
.changelog-wrap{max-width:900px;margin:0 auto;padding:8px 4px 40px}
.changelog-body{background:var(--card,#fff);border:1px solid var(--line,#eef0f4);border-radius:14px;padding:18px 22px;line-height:1.75;font-size:13px;color:var(--text,#2b2f38);overflow-wrap:anywhere}
.changelog-body h3{font-size:15px;margin:18px 0 8px;padding-top:12px;border-top:1px solid var(--line,#eef0f4)}
.changelog-body h3:first-child{margin-top:0;padding-top:0;border-top:0}
.changelog-body h4{font-size:13px;margin:12px 0 4px;color:var(--muted,#6b7280)}
.changelog-body ul{margin:4px 0 8px;padding-left:18px}
.changelog-body li{margin:2px 0}
.changelog-body p{margin:6px 0}
@media (max-width:900px){.changelog-body{padding:14px}}
</style>
