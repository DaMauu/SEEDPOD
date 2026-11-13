<template>
  <div class="log-wrap">
    <div class="log-bar">
      <div class="seg-tabs">
        <button
          v-for="f in filters"
          :key="f.v"
          type="button"
          :class="{ active: level === f.v }"
          @click="level = f.v"
        >{{ f.label }}</button>
      </div>
      <div class="spacer"></div>
      <button class="btn ghost slim" @click="download">下载 log</button>
      <button class="btn ghost slim" @click="clear">清屏</button>
    </div>
    <div ref="panel" class="log-panel">
      <div v-if="!shown.length" class="sites-empty">还没有日志，连上后端后这里会实时刷新</div>
      <div v-else class="log-rows">
        <div v-for="r in shown" :key="r.id" class="log-row" :class="r.lvl">
          <span class="log-ts">{{ r.t }}</span>
          <span class="log-tag">{{ r.lvl === 'error' ? 'ERROR' : r.lvl === 'warn' ? 'WARN' : 'INFO' }}</span>
          <span class="log-src">{{ r.tag }}</span>
          <span class="log-msg">{{ r.msg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const filters = [
  { v: 'all', label: '全部' },
  { v: 'info', label: 'INFO' },
  { v: 'warn', label: 'WARN' },
  { v: 'error', label: 'ERROR' }
]
const rows = ref([])
const level = ref('all')
const lastId = ref(0)
const panel = ref(null)
let es = null
let timer = null
let loaded = false

const shown = computed(() => level.value === 'all' ? rows.value : rows.value.filter(r => r.lvl === level.value))

function scrollDown() {
  nextTick(() => { if (panel.value) panel.value.scrollTop = panel.value.scrollHeight })
}
function push(r) {
  if (!r) return
  if (r.id && r.id <= lastId.value) return
  if (r.id) lastId.value = r.id
  rows.value.push(r)
  if (rows.value.length > 200) rows.value.splice(0, rows.value.length - 200)
  scrollDown()
}
function loggedIn() {
  return !document.querySelector('#login-mask')
}
function visible() {
  const v = document.querySelector('[data-view="logs"]')
  return !!(v && !v.hidden)
}
async function load() {
  if (loaded || !loggedIn()) return
  try {
    const r = await fetch('/api/logs?limit=100')
    if (!r.ok) return
    const j = await r.json()
    if (j.ok) {
      rows.value = (j.data || []).map(x => ({ id: x.id, t: x.t, lvl: x.lvl, tag: x.tag, msg: x.msg }))
      lastId.value = rows.value.length ? rows.value[rows.value.length - 1].id : 0
      loaded = true
      scrollDown()
      connect()
    }
  } catch (e) {}
}
function connect() {
  if (es || !window.EventSource) return
  es = new EventSource('/api/logs/stream?last=' + lastId.value)
  es.onmessage = ev => {
    try {
      const d = JSON.parse(ev.data)
      push({
        id: d.id,
        t: d.ts ? new Date(d.ts).toTimeString().slice(0, 8) : '',
        lvl: d.level === 'warn' ? 'warn' : d.level === 'error' ? 'error' : 'info',
        tag: d.src || '服务',
        msg: d.msg || ''
      })
    } catch (e) {}
  }
  es.onerror = () => { if (es) { es.close(); es = null } }
}
function ensure() {
  if (!visible() || !loggedIn()) return
  if (!loaded) load()
  else connect()
}
function download() {
  const txt = rows.value.map(r => r.t + ' [' + r.lvl + '] ' + r.tag + ' ' + r.msg).join('\n')
  const a = document.createElement('a')
  const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }))
  a.href = url
  a.download = 'pta.log'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function clear() { rows.value = [] }

onMounted(() => {
  window.addEventListener('hashchange', ensure)
  timer = setInterval(ensure, 1500)
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  if (timer) clearInterval(timer)
  if (es) es.close()
})
</script>
