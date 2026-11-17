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

    <section class="fail-panel" id="fail-panel">
      <div class="fail-bar">
        <b>失败队列</b>
        <span class="fail-meta">{{ failText }}</span>
        <button class="btn ghost slim" type="button" @click="toggleDead">{{ deadOnly ? '看全部' : '只看死信' }}</button>
        <button class="btn ghost slim" type="button" :disabled="failLoading" @click="loadFailures">{{ failLoading ? '读取中…' : '刷新' }}</button>
      </div>
      <div v-if="!failRows.length" class="fail-empty">没有待处理的失败</div>
      <div v-else class="fail-list">
        <div v-for="(f, i) in failRows" :key="f.id + '-' + i" class="fail-row">
          <span class="fail-id" :title="f.id">{{ f.id }}</span>
          <span class="fail-stage">{{ f.stage }}</span>
          <span class="fail-code">{{ f.code }}</span>
          <span class="fail-attempts">{{ f.attempts }} 次</span>
          <span class="fail-next">{{ f.nextRetryAt || '—' }}</span>
          <em v-if="f.dead" class="fail-dead">死信</em>
          <button class="btn ghost slim" type="button" @click="replay(f.id)">重放</button>
        </div>
        <div v-if="failTotal > failRows.length" class="fail-more">共 {{ failTotal }} 条，显示前 {{ failRows.length }} 条</div>
      </div>
    </section>
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
import { reportError } from '../utils/errors'
import { loggedIn, viewVisible, toast } from '../utils/ui'
import { getJson } from '../utils/api'

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
const failures = ref([])
const failTotal = ref(0)
const failDead = ref(0)
const deadOnly = ref(false)
const failLoading = ref(false)
let failLoaded = false
const failRows = computed(() => {
  const out = []
  failures.value.forEach(it => {
    (it.failures || []).forEach(f => out.push({
      id: it.id, dead: !!it.dead, stage: f.stage || it.stage || '',
      code: f.code || '', attempts: Number(f.attempts) || 0,
      nextRetryAt: f.nextRetryAt || '', host: f.host || '', message: f.message || ''
    }))
  })
  return out
})
const failText = computed(() => {
  if (!failLoaded) return '读取中…'
  return '共 ' + failTotal.value + ' 条' + (failDead.value ? ' · 死信 ' + failDead.value : '')
})

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
async function loadLogs() {
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
  } catch (e) { reportError('Logs', e) }
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
    } catch (e) { reportError('Logs', e) }
  }
  es.onerror = () => { if (es) { es.close(); es = null } }
}
async function loadFailures() {
  if (!loggedIn()) return
  failLoading.value = true
  const j = await getJson('/api/failures?limit=20&dead=' + (deadOnly.value ? '1' : '0'))
  failLoading.value = false
  if (!j || !j.ok) { toast((j && j.error && j.error.message) || '失败队列读取失败'); return }
  failures.value = Array.isArray(j.data.items) ? j.data.items : []
  failTotal.value = Number(j.data.total) || 0
  failDead.value = Number(j.data.dead) || 0
  failLoaded = true
}
function toggleDead() {
  deadOnly.value = !deadOnly.value
  loadFailures()
}
async function replay(id) {
  const r = await fetch('/api/failures/' + encodeURIComponent(id) + '/replay', { method: 'POST', credentials: 'same-origin' })
  const j = await r.json().catch(() => null)
  toast(j && j.ok ? '已重放：' + id : ((j && j.error && j.error.message) || '重放失败'))
  await loadFailures()
}
function ensureLogs() {
  if (!viewVisible('logs') || !loggedIn()) return
  if (!loaded) loadLogs()
  else connect()
  if (!failLoaded) loadFailures()
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
  window.addEventListener('hashchange', ensureLogs)
  timer = setInterval(ensureLogs, 1500)
  ensureLogs()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensureLogs)
  if (timer) clearInterval(timer)
  if (es) es.close()
})
</script>

<style scoped>
/* Logs 页面样式：迁入 scoped，shell/shared 保留全局 */
.log-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.fail-panel { background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 10px 16px 8px; }
.fail-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fail-bar b { font-size: 12.5px; color: var(--ink); }
.fail-meta { font-size: 11.5px; color: var(--muted); }
.fail-bar .btn { margin-left: 0; }
.fail-empty { padding: 8px 0 10px; font-size: 12px; color: var(--muted-2); }
.fail-list { display: flex; flex-direction: column; }
.fail-row { display: grid; grid-template-columns: 96px 90px 150px 56px 160px auto 64px; gap: 10px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); font-size: 11.5px; }
.fail-id { color: var(--muted-2); font-family: var(--mono, monospace); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fail-stage { color: var(--muted); }
.fail-code { color: var(--ink); font-family: var(--mono, monospace); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fail-attempts { color: var(--muted); }
.fail-next { color: var(--muted-2); font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fail-dead { font-style: normal; font-size: 10px; color: var(--red); border: 1px solid #f1d4d4; border-radius: 999px; padding: 0 6px; }
.fail-more { padding: 6px 0 2px; font-size: 11px; color: var(--muted-2); }

.log-bar { display: flex; align-items: center; gap: 10px; }
.log-bar .spacer { flex: 1; }
.log-bar .btn { flex: 0 0 auto; white-space: nowrap; }
.log-panel { flex: 1; min-height: 0; overflow-y: auto; background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 8px 20px; }
.log-row { display: grid; grid-template-columns: 76px 56px 110px minmax(0,1fr); gap: 12px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 12px; }
.log-row:last-child { border-bottom: 0; }
.log-ts { color: var(--muted-2); font-family: var(--mono, ui-monospace, monospace); font-size: 11px; }
.log-tag { font-size: 10px; letter-spacing: .4px; color: var(--muted); }
.log-row.warn .log-tag { color: var(--amber); }
.log-row.error .log-tag { color: var(--red); }
.log-src { color: var(--muted); font-size: 11.5px; }
.log-msg { color: var(--ink); }
.log-row.error .log-msg { color: var(--red); }
.log-panel { padding: 4px 18px; }
.log-panel { padding-right: 24px; }
.log-panel {
  background: #0b100e; border: 1px solid #16241b; border-radius: 14px;
  box-shadow: 0 12px 30px rgba(8, 24, 14, .18); padding: 16px 16px 14px;
  color: #8ef0a8; font-family: ui-monospace, "Cascadia Mono", Consolas, "SF Mono", monospace;
}
.log-row {
  display: grid; grid-template-columns: 76px 56px 96px minmax(0, 1fr); gap: 12px;
  align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(126, 231, 135, .07);
  font-size: 11.5px; color: #a8e6bb;
}
.log-row:last-child { border-bottom: 0; }
.log-ts { color: #47765a; }
.log-tag { color: #63b783; letter-spacing: .06em; }
.log-src { color: #4f9d70; }
.log-msg { color: #c8f7d6; }
.log-row.warn .log-tag, .log-row.warn .log-msg { color: #e3b341; }
.log-row.error .log-tag, .log-row.error .log-msg { color: #ff7b72; }
.log-panel { display: flex; flex-direction: column; justify-content: flex-end; }
.log-panel { justify-content: flex-start; }
.log-row { font-size: 12px; }
.log-wrap { height: auto; flex: 0 0 auto; width: 100%; }
.log-panel { flex: 0 0 auto; height: 560px; }
@media (max-width: 900px) {
.log-bar { flex-wrap: wrap; gap: 8px; }
.fail-row { grid-template-columns: 84px 76px minmax(0,1fr) 50px 120px auto; }
.fail-next { display: none; }
}
@media (max-width: 600px) {
.log-bar .seg-tabs { flex: 1 1 100%; }
.log-bar .spacer { display: none; }
.log-bar .btn:first-of-type { margin-left: auto; }
.log-row { grid-template-columns: 70px 52px minmax(0,1fr); gap: 2px 10px; padding: 8px 0; align-items: baseline; }
.log-row .log-msg { grid-column: 1 / -1; line-height: 1.5; overflow-wrap: anywhere; }
.log-row .log-src { text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

:global(.view[data-view="logs"]) { height: calc(100vh - 150px); display: flex; flex-direction: column; justify-content: center; }</style>
