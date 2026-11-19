<template>
  <div class="qf-wrap">
    <div v-if="!visible.length" class="sites-empty">{{ loading ? '读取中…' : '没有卡住的条目' }}</div>
    <div v-else class="qf-list">
      <div v-for="it in pageRows" :key="it.id" class="qf-row" :class="{ on: it.id === activeId }" @click="$emit('select', it.id)">
        <div class="qf-main">
          <div class="qf-title">{{ it.title || it.id }}</div>
          <div class="qf-meta">
            <span class="badge" :class="it.dead ? 'red' : 'amber'">{{ it.dead ? '自动重试用完' : '待重试' }}</span>
            <span class="qf-sum">{{ summary(it) }}</span>
            <span v-if="it.nextRetryAt" class="qf-next">下次 {{ whenText(it.nextRetryAt) }}</span>
          </div>
        </div>
        <button class="btn ghost slim qf-replay" type="button" title="清掉错误和次数，放回待处理，下一轮重新跑" @click.stop="replay(it)">重新排队</button>
      </div>
    </div>
    <div v-if="visible.length" class="qf-pager-wrap">
      <div class="qf-pager">
        <span class="pager-link" :class="{ off: page <= 1 }" @click="page > 1 && (page = page - 1)">上一页</span>
        <span class="qf-page-meta" :title="'第 ' + page + ' / ' + pages + ' 页 · 共 ' + visible.length + ' 条'">{{ page }}/{{ pages }} 页 · {{ visible.length }} 条</span>
        <span class="pager-link" :class="{ off: page >= pages }" @click="page < pages && (page = page + 1)">下一页</span>
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
const loading = ref(true)
const page = ref(1)
const pageSize = 20

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
const visible = computed(() => {
  const t = term.value
  return (items.value || []).filter((it) => !t || String(it.title || '').toLowerCase().indexOf(t) >= 0 || String(it.id || '').toLowerCase().indexOf(t) >= 0)
})
const pages = computed(() => Math.max(1, Math.ceil(visible.value.length / pageSize)))
const pageRows = computed(() => visible.value.slice((page.value - 1) * pageSize, page.value * pageSize))
async function load() {
  loading.value = true
  try {
    const j = await (await fetch('/api/failures?limit=200', { credentials: 'same-origin' })).json()
    if (j && j.ok) {
      items.value = Array.isArray(j.data.items) ? j.data.items : []
      if (page.value > pages.value) page.value = pages.value
    } else toast((j && j.error && j.error.message) || '失败队列读取失败')
  } catch (e) {
    toast('失败队列请求发不出去')
  }
  loading.value = false
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
.qf-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; width: 100%; }
.qf-list { display: flex; flex-direction: column; gap: 2px; overflow: auto; padding-top: 6px; flex: 1; min-height: 0; }
.qf-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 7px 9px; border: 0; border-radius: 9px; background: none; cursor: pointer; text-align: left; }
.qf-row:hover { background: #f7f8fa; }
.qf-row.on { background: var(--accent-soft); box-shadow: none; }
.qf-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.qf-title { font-size: 11.5px; font-weight: 600; color: var(--ink); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qf-meta { display: flex; align-items: center; gap: 4px 6px; min-width: 0; font-size: 10.5px; color: var(--muted); line-height: 1.35; white-space: nowrap; overflow: hidden; }
.qf-meta .badge { flex: 0 0 auto; }
.qf-sum { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.qf-next { flex: 0 0 auto; font-size: 10px; color: var(--muted-2); }
.qf-replay { align-self: center; white-space: nowrap; height: 24px; min-height: 24px; padding: 0 7px; font-size: 10.5px; line-height: 22px; border-radius: 6px; }
.qf-pager-wrap { flex: 0 0 auto; width: 100%; box-sizing: border-box; padding: 8px 10px 10px; border-top: 1px solid var(--line); background: #fff; }
.qf-pager { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px; width: 100%; box-sizing: border-box; padding: 5px 8px; border: 1px solid var(--line); border-radius: 9px; background: #fafbfd; }
.qf-pager .pager-link { font-size: 11.5px; color: var(--accent); cursor: pointer; user-select: none; white-space: nowrap; }
.qf-pager .pager-link.off { color: var(--muted-2); cursor: default; opacity: .55; }
.qf-page-meta { flex: 1; min-width: 0; text-align: center; font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 600px) {
  .qf-next { display: none; }
  .qf-row { gap: 6px; padding: 6px; }
}
</style>
