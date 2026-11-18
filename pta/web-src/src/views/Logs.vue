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
        <div class="fail-title">
          <b>失败与重试</b>
          <span class="fail-sub">卡住的条目；自动重试用完的可以手动重新排队</span>
        </div>
        <span class="fail-meta">{{ failText }}</span>
        <button class="btn ghost slim" type="button" @click="toggleDead">{{ deadOnly ? '看全部' : '只看重试用完' }}</button>
        <button class="btn ghost slim" type="button" :disabled="failLoading" @click="loadFailures">{{ failLoading ? '读取中…' : '刷新' }}</button>
      </div>
      <div v-if="!failRows.length" class="fail-empty">没有卡住的条目</div>
      <div v-else class="fail-list">
        <div v-for="(f, i) in failRows" :key="f.id + '-' + i" class="fail-row">
          <span class="fail-id" :title="f.id">{{ f.id }}</span>
          <span class="fail-stage" :title="f.stage">{{ stageText(f.stage) }}</span>
          <span class="fail-code" :title="f.code">{{ codeText(f.code, f.stage) }}</span>
          <span class="fail-attempts">试了 {{ f.attempts }} 次</span>
          <span class="fail-next" :title="f.nextRetryAt">{{ whenText(f.nextRetryAt) }}</span>
          <em v-if="f.dead" class="fail-dead" title="尝试次数已用完，自动重试不再跑">自动重试用完</em>
          <button class="btn ghost slim" type="button" title="清掉错误和次数，放回待处理，下一轮重新跑" @click="replay(f.id)">重新排队</button>
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
let reconnectTimer = null
let loaded = false
const failures = ref([])
const failTotal = ref(0)
const failDead = ref(0)
const deadOnly = ref(false)
const failLoading = ref(false)
const failLoaded = ref(false)
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
  if (!failLoaded.value) return '读取中…'
  return '共 ' + failTotal.value + ' 条' + (failDead.value ? ' · 自动重试用完 ' + failDead.value : '')
})

const shown = computed(() => level.value === 'all' ? rows.value : rows.value.filter(r => r.lvl === level.value))

const STAGE_TEXT = { review: '补资料', prepared: '准备', previewed: '预览', submitted: '提交', injected: '注入', publish: '发布', target: '目标站', dedupe: '查重', crawl: '抓取' }
function stageText(s) { return STAGE_TEXT[s] || s || '未知' }
function codeText(code, stage) {
  const c = String(code || '')
  if (c === 'TARGET_UNREACHABLE' || c === 'UPSTREAM_FAILED') return stage === 'review' ? '资料服务连不上' : '目标站连不上'
  return ({
    LOGIN_REQUIRED: '登录失效',
    SOURCE_NOT_READY: '源种没下完',
    NO_COOKIE: '没配 cookie',
    NO_DOWNLOADER: '没配下载器',
    CRAWL_FAILED: '抓取失败',
    CRAWL_HTTP_403: '站点拒绝（403）',
    DEDUPE_TIMEOUT: '查重超时',
    UNKNOWN: '未知错误'
  })[c] || c || '未知'
}
function whenText(v) {
  const t = Date.parse(v || '')
  if (!t) return '—'
  return new Date(t).toLocaleString('zh-CN', { hour12: false }).slice(5, 16)
}

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
        t: d.t || '',
        lvl: d.lvl === 'warn' ? 'warn' : d.lvl === 'error' ? 'error' : 'info',
        tag: d.tag || d.src || '服务',
        msg: d.msg || ''
      })
    } catch (e) { reportError('Logs', e) }
  }
  es.onerror = () => {
    if (es) { es.close(); es = null }
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        if (!es && loggedIn() && viewVisible('logs')) connect()
      }, 3000)
    }
  }
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
  failLoaded.value = true
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
  if (!failLoaded.value) loadFailures()
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
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (es) es.close()
})
</script>

<style scoped>
/* Logs 页面样式：迁入 scoped，shell/shared 保留全局 */
.log-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.fail-panel { background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 10px 16px 8px; }
.fail-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fail-title { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.fail-sub { font-size: 11px; color: var(--muted-2); }
.fail-bar b { font-size: 12.5px; color: var(--ink); }
.fail-meta { font-size: 11.5px; color: var(--muted); }
.fail-bar .btn { margin-left: 0; }
.fail-empty { padding: 8px 0 10px; font-size: 12px; color: var(--muted-2); }
.fail-list { display: flex; flex-direction: column; max-height: 200px; overflow-y: auto; }
.fail-row .btn { padding: 0 8px; font-size: 11px; white-space: nowrap; }
.fail-row { display: grid; grid-template-columns: 86px 72px minmax(0, 1fr) 74px 104px 92px 96px; gap: 10px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); font-size: 11.5px; }
.fail-id { color: var(--muted-2); font-family: var(--mono, monospace); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fail-stage { color: var(--muted); }
.fail-code { color: var(--ink); font-family: var(--mono, monospace); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fail-attempts { color: var(--muted); }
.fail-next { color: var(--muted-2); font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fail-dead { font-style: normal; font-size: 10px; color: var(--red); border: 1px solid #f1d4d4; border-radius: 999px; padding: 0 6px; white-space: nowrap; text-align: center; }
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
.log-wrap { flex: 1 1 auto; min-height: 0; height: auto; width: 100%; }
.log-panel { flex: 1 1 0; height: auto; min-height: 0; }
@media (max-width: 900px) {
.log-bar { flex-wrap: wrap; gap: 8px; }
.fail-row { grid-template-columns: 74px 64px minmax(0,1fr) 62px 88px 74px; gap: 6px; }
.fail-next { display: none; }
}
@media (max-width: 600px) {
.fail-row { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; padding: 8px 0; }
.fail-id, .fail-stage, .fail-attempts, .fail-dead, .fail-row .btn { flex: 0 0 auto; }
.fail-code { flex: 1 1 100%; order: 3; white-space: normal; overflow: visible; text-overflow: clip; }
.fail-attempts { order: 1; }
.fail-dead { order: 2; }
.fail-row .btn { order: 2; margin-left: auto; }
.log-bar .seg-tabs { flex: 1 1 100%; }
.log-bar .spacer { display: none; }
.log-bar .btn:first-of-type { margin-left: auto; }
.log-row { grid-template-columns: 70px 52px minmax(0,1fr); gap: 2px 10px; padding: 8px 0; align-items: baseline; }
.log-row .log-msg { grid-column: 1 / -1; line-height: 1.5; overflow-wrap: anywhere; }
.log-row .log-src { text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

:global(.view[data-view="logs"]) { height: calc(100vh - 150px); min-height: 420px; display: flex; flex-direction: column; justify-content: flex-start; overflow: hidden; }
@media (max-width: 900px) {
  :global(.view[data-view="logs"]) { height: auto; min-height: 0; overflow: visible; }
  .log-panel { flex: 0 0 auto; height: 420px; }
}</style>
