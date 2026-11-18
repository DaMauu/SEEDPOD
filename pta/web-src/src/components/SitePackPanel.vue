<template>
  <section class="set-card pack-card">
    <div class="set-card-head">
      <div class="set-card-t">
        <h2 class="set-h2">站点包</h2>
        <p class="set-desc">随程序发布的加密包；例外确认后只写私有 data/，不改密文包。</p>
      </div>
      <button class="btn ghost slim" type="button" :disabled="loading" @click="loadPack">{{ loading ? '读取中…' : '刷新' }}</button>
    </div>

    <div v-if="!available" class="pack-empty">
      站点包未解密：{{ reasonText }}
    </div>
    <template v-else>
      <div class="pack-stats">
        <span>覆盖 <b>{{ data.status.sites }}</b> 站</span>
        <span>分类 <b>{{ coverage.mapped }}/{{ coverage.total }}</b> · {{ coverage.percent }}%</span>
        <span>待确认 <b class="warn">{{ data.totalExceptions }}</b></span>
        <span>私有覆盖 <b>{{ data.privateSites }}</b> 站</span>
      </div>
      <div class="pack-tools">
        <input v-model="q" class="input slim" placeholder="搜分类 / 站点 / ID" @keyup.enter="load">
        <button class="btn ghost slim" type="button" @click="loadPack">筛选</button>
      </div>
      <div v-if="rows.length" class="pack-list">
        <div v-for="e in rows" :key="e.host + '|' + e.id" class="pack-row">
          <div class="pack-label">
            <b>{{ e.label || e.id }}</b>
            <span>{{ e.host }} · #{{ e.id }}<i v-if="e.suggested && e.suggested.confidence === 'high'"> · 建议 {{ purposeLabel(e.suggested.purpose) }}</i></span>
          </div>
          <select v-model="e.pick" class="select slim">
            <option value="">选择用途</option>
            <option v-for="p in purposes" :key="p.v" :value="p.v">{{ p.label }}</option>
          </select>
          <button class="btn primary slim" type="button" :disabled="!e.pick || saving === e.host + '|' + e.id" @click="confirmOne(e)">
            {{ saving === e.host + '|' + e.id ? '保存中…' : '确认' }}
          </button>
        </div>
      </div>
      <div v-else class="pack-empty">没有待确认例外；当前覆盖率 {{ coverage.percent }}%。</div>
      <div v-if="msg" class="pack-msg">{{ msg }}</div>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { reportError } from '../utils/errors'
import { toast } from '../utils/ui'

const data = ref(null)
const rows = ref([])
const q = ref('')
const loading = ref(false)
const saving = ref('')
const msg = ref('')

const available = computed(function () { return !!(data.value && data.value.available) })
const coverage = computed(function () { return (data.value && data.value.coverage) || { total: 0, mapped: 0, other: 0, percent: 0 } })
const purposes = computed(function () { return (data.value && data.value.purposes) || [] })
const reasonText = computed(function () {
  const reason = (data.value && data.value.reason) || ''
  if (reason === 'NO_KEY') return '缺 PTA_SITE_PACK_KEY'
  if (reason === 'NO_PACK') return '找不到密文包'
  if (reason === 'BAD_PACK') return '密文包解不开'
  return reason || '未知原因'
})

function purposeLabel(v) {
  const hit = purposes.value.filter(function (p) { return p.v === v; })[0]
  return hit ? hit.label : v
}
async function loadPack() {
  if (loading.value) return
  loading.value = true
  msg.value = ''
  try {
    const qs = new URLSearchParams({ limit: '200' })
    if (q.value.trim()) qs.set('q', q.value.trim())
    const j = await (await fetch('/api/site-pack?' + qs.toString(), { credentials: 'same-origin' })).json()
    if (!j || !j.ok) {
      msg.value = (j && j.error && j.error.message) || '站点包状态读取失败'
      rows.value = []
      return
    }
    data.value = j.data
    rows.value = (j.data.exceptions || []).map(function (e) { return Object.assign({}, e, { pick: '' }) })
  } catch (e) {
    reportError('SitePack', e)
    msg.value = '站点包请求发不出去'
  }
  loading.value = false
}
async function confirmOne(e) {
  if (!e || !e.pick || saving.value) return
  const key = e.host + '|' + e.id
  saving.value = key
  msg.value = ''
  try {
    const j = await (await fetch('/api/site-pack/exception', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: e.host, id: e.id, purpose: e.pick })
    })).json()
    if (j && j.ok) {
      toast('已保存私有覆盖：' + (e.label || e.id))
      await loadPack()
    } else msg.value = (j && j.error && j.error.message) || '保存失败'
  } catch (err) {
    reportError('SitePack.confirm', err)
    msg.value = '保存请求发不出去'
  }
  saving.value = ''
}

onMounted(loadPack)
</script>

<style scoped>
.pack-card { display: flex; flex-direction: column; gap: 10px; }
.set-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.set-card-t { min-width: 0; }
.set-h2 { margin: 0 0 4px; font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
.set-desc { margin: 0; font-size: 11.5px; color: var(--muted); }
.pack-stats { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 12px; color: var(--muted); }
.pack-stats b { color: var(--ink); font-variant-numeric: tabular-nums; }
.pack-stats b.warn { color: var(--amber); }
.pack-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pack-tools .input { width: 240px; }
.pack-list { max-height: 360px; overflow-y: auto; border-top: 1px solid var(--line); }
.pack-row { display: grid; grid-template-columns: minmax(0, 1fr) 150px auto; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid #f4f5f8; }
.pack-row:last-child { border-bottom: 0; }
.pack-label { min-width: 0; }
.pack-label b { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pack-label span { display: block; margin-top: 2px; font-size: 11px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pack-label i { font-style: normal; color: var(--accent); }
.pack-empty { padding: 18px 0; font-size: 12px; color: var(--muted-2); }
.pack-msg { font-size: 12px; color: var(--amber); }
@media (max-width: 700px) {
  .pack-row { grid-template-columns: minmax(0, 1fr) 120px; }
  .pack-row .btn { grid-column: 1 / -1; justify-self: start; }
  .pack-tools .input { width: 100%; }
}
</style>
