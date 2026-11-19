<template>
  <div class="qf-wrap">
    <div class="qf-bar">
      <span class="qf-count">{{ countText }}</span>
      <button class="btn ghost slim" type="button" @click="toggleDead">{{ deadOnly ? '看全部' : '只看重试用完' }}</button>
      <button class="btn ghost slim" type="button" :disabled="loading" @click="load">{{ loading ? '读取中…' : '刷新' }}</button>
    </div>
    <div v-if="!rows.length" class="sites-empty">{{ loading ? '读取中…' : '没有卡住的条目' }}</div>
    <div v-else class="qf-list">
      <div v-for="it in rows" :key="it.id" class="qf-row" :class="{ on: it.id === activeId }" @click="$emit('select', it.id)">
        <span class="qf-title">{{ it.title || it.id }}</span>
        <span class="qf-meta">
          <span class="badge" :class="it.dead ? 'red' : 'amber'">{{ it.dead ? '自动重试用完' : '待重试' }}</span>
          <span>{{ summary(it) }}</span>
        </span>
        <span v-if="it.nextRetryAt" class="qf-next">下次 {{ whenText(it.nextRetryAt) }}</span>
        <button class="btn ghost slim" type="button" title="清掉错误和次数，放回待处理，下一轮重新跑" @click.stop="replay(it)">重新排队</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from '../utils/ui'

const props = defineProps({
  q: { type: String, default: '' },
  activeId: { type: String, default: '' },
  reloadKey: { type: Number, default: 0 }
})
const emit = defineEmits(['select', 'replayed'])

const items = ref([])
const total = ref(0)
const dead = ref(0)
const deadOnly = ref(false)
const loading = ref(false)
const loaded = ref(false)

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
function firstFailure(it) {
  const list = Array.isArray(it.failures) ? it.failures : []
  return list[0] || {}
}
function summary(it) {
  const f = firstFailure(it)
  const n = Array.isArray(it.failures) ? it.failures.length : 0
  return [stageText(f.stage || it.stage), codeText(f.code, f.stage), '试了 ' + (Number(f.attempts) || 0) + ' 次'].filter(Boolean).join(' · ') + (n > 1 ? ' · 等 ' + n + ' 项' : '')
}

const term = computed(() => String(props.q || '').trim().toLowerCase())
const rows = computed(() => {
  const t = term.value
  return (items.value || []).filter((it) => !t || String(it.title || '').toLowerCase().indexOf(t) >= 0 || String(it.id || '').toLowerCase().indexOf(t) >= 0)
})
const countText = computed(() => {
  if (!loaded.value) return '读取中…'
  const base = '共 ' + total.value + ' 条' + (dead.value ? ' · 重试用完 ' + dead.value : '')
  return term.value ? base + ' · 匹配 ' + rows.value.length : base
})

async function load() {
  loading.value = true
  try {
    const j = await (await fetch('/api/failures?limit=200&dead=' + (deadOnly.value ? '1' : '0'), { credentials: 'same-origin' })).json()
    if (j && j.ok) {
      items.value = Array.isArray(j.data.items) ? j.data.items : []
      total.value = Number(j.data.total) || 0
      dead.value = Number(j.data.dead) || 0
      loaded.value = true
    } else toast((j && j.error && j.error.message) || '失败队列读取失败')
  } catch (e) {
    toast('失败队列请求发不出去')
  }
  loading.value = false
}
function toggleDead() {
  deadOnly.value = !deadOnly.value
  load()
}
async function replay(it) {
  try {
    const r = await fetch('/api/failures/' + encodeURIComponent(it.id) + '/replay', { method: 'POST', credentials: 'same-origin' })
    const j = await r.json().catch(() => null)
    toast(j && j.ok ? '已重新排队：' + (it.title || it.id) : ((j && j.error && j.error.message) || '重新排队失败'))
    if (j && j.ok) emit('replayed', it.id)
    await load()
  } catch (e) {
    toast('重新排队请求发不出去')
  }
}

watch(() => props.reloadKey, load)
onMounted(load)
</script>

<style scoped>
.qf-wrap { display: flex; flex-direction: column; min-height: 0; }
.qf-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 0 2px 8px; border-bottom: 1px solid var(--line); }
.qf-count { flex: 1 1 auto; font-size: 11.5px; color: var(--muted); }
.qf-list { display: flex; flex-direction: column; gap: 6px; overflow: auto; padding-top: 8px; }
.qf-row { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 9px; background: #fff; cursor: pointer; text-align: left; }
.qf-row.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
.qf-title { font-size: 12.5px; font-weight: 600; color: var(--ink); line-height: 1.4; word-break: break-word; }
.qf-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 11px; color: var(--muted); line-height: 1.4; }
.qf-next { font-size: 10.5px; color: var(--muted-2); }
.qf-row .btn { align-self: flex-start; margin-top: 2px; }
</style>
