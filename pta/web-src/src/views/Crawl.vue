<template>
  <div class="drawers">
    <div id="crawl-panel">
      <FlowGates :gates="gates" :busy="busy" @toggle="toggleGate" @prepare="prepareNext" />
      <SchedulerBar :sched="sched" :sched-text="schedText" :limits="limits" @toggle="toggleSched" @every="setEveryValue" @save="saveLimits" @run="runSched" />
      <CrawlCard v-model:source-host="sourceHost" :site-options="siteOptions" :busy="busy" :fetch-sum="fetchSum" :plan="plan" :fetch-rows="fetchRows" :detail="detail" @show-plan="showPlan" @save-fetch="saveFetch" @toggle-fetch-chip="toggleFetchChip" @toggle-detail="toggleDetail" />
      <ScreenDedupeCard :busy="busy" :rx-rows="rxRows" :auto-dupe="autoDupe" :dedupe-switches="dedupeSwitches" :dedupe-inputs="dedupeInputs" :rule-component="RuleOrSpecial" :rule-control="RuleControl" @save="saveScreen" @toggle-auto-dupe="autoDupe = !autoDupe" />
      <PublishCard :groups="pubGroups" :busy="busy" :rule-component="RuleOrSpecial" @maps="mapOpen = true" @save="savePub" />
    </div>

    <SiteMapModal v-model:open="mapOpen" />

    <Nodes />
  </div>

  <TargetPickerModal :open="targetOpen" :query="targetQ" :options="targetOptions" :current="targetHost" @close="targetOpen = false" @update:query="targetQ = $event" @pick="pickTarget" />
</template>

<script setup>
import { computed, h, onMounted, onUnmounted, reactive, ref } from 'vue'
import { reportError } from '../utils/errors'
import { toast, confirmBox, loggedIn, viewVisible, initialsOf } from '../utils/ui'
import RuleControl from '../components/RuleControl.vue'
import Nodes from './Nodes.vue'
import FlowGates from '../components/FlowGates.vue'
import SchedulerBar from '../components/SchedulerBar.vue'
import TargetPickerModal from '../components/TargetPickerModal.vue'
import CrawlCard from '../components/CrawlCard.vue'
import ScreenDedupeCard from '../components/ScreenDedupeCard.vue'
import PublishCard from '../components/PublishCard.vue'
import SiteMapModal from '../components/SiteMapModal.vue'
import { getJson } from '../utils/api'
import { useCrawlPlan } from '../composables/useCrawlPlan'

const clone = x => JSON.parse(JSON.stringify(x || []))
const RULES = (typeof window !== 'undefined' && window.PTA_RULES) || {}
const rules = reactive({
  fetch: clone(RULES.fetch),
  dedupe: clone(RULES.dedupe),
  pub: clone(RULES.pub)
})
const TPL_DEMO = { 电影名: '金瓶双艳', 地区: '港版', 导演: '李翰祥', 主演1: '胡锦', 主演2: '恬妮', 主演3: '陈萍', 音轨: '国语 2.0', 字幕: '中文字幕' }
const SPECIAL = { 发布到: 'target', 中文副标题模板: 'tpl', 排除匹配: 'deny', 测试匹配: 'rx' }

const limits = reactive({ interval: 60, windowMinutes: 60, maxPerWindow: 20, breaker: 3 })
const limitRanges = { interval: [8, 600], windowMinutes: [1, 1440], maxPerWindow: [1, 1000], breaker: [1, 10] }
const limitItems = [
  { k: 'interval', label: '请求间隔（秒）' },
  { k: 'windowMinutes', label: '窗口（分钟）' },
  { k: 'maxPerWindow', label: '窗口内最多' },
  { k: 'breaker', label: '连续失败暂停' }
]
const detail = ref(false)
const autoDupe = ref(false)
const fetchRows = computed(() => (rules.fetch[0] && rules.fetch[0].rows) || [])
const rxRows = computed(() => (rules.fetch[1] && rules.fetch[1].rows) || [])
const dedupeRows = computed(() => (rules.dedupe[0] && rules.dedupe[0].rows) || [])
const dedupeSwitches = computed(() => dedupeRows.value.filter(r => r.type === 'switch'))
const dedupeInputs = computed(() => dedupeRows.value.filter(r => r.type !== 'switch'))
const fetchSum = computed(() => {
  let n = 0
  fetchRows.value.forEach(r => { n += (r.sel || []).length })
  return n ? n + ' 项条件' : '跟随默认'
})
const fetchNote = computed(() => '每 ' + limits.interval + ' 秒最多一次 · ' + limits.windowMinutes + ' 分钟内最多 ' + limits.maxPerWindow + ' 次请求')

const rx = reactive({ deny: '', sample: '', out: '未测试', outClass: '' })
const mapOpen = ref(false)
const tpl = ref('')
const tplPreview = computed(() => {
  let t = tpl.value || ''
  Object.keys(TPL_DEMO).forEach(k => { t = t.split('{' + k + '}').join(TPL_DEMO[k]) })
  return t
})

const sites = ref([])
const siteStatus = ref({})
const siteCfg = ref({})
const sourceHost = ref('')
const targetHost = ref('')
const targetOpen = ref(false)
const targetQ = ref('')
const busy = reactive({ fetch: false, dedupe: false, pub: false, plan: false, prepare: false })
const { plan, showPlan } = useCrawlPlan({ sourceHost: sourceHost, busy: busy, toast: toast })
const sched = reactive({ on: false, everyMinutes: 60, running: false, lastRunAt: 0, lastError: '' })
const schedText = computed(() => {
  if (!sched.lastRunAt) return '还没跑过'
  const t = new Date(sched.lastRunAt).toLocaleString('zh-CN', { hour12: false })
  return '上次 ' + t + (sched.lastError ? ' · ' + sched.lastError : '')
})
function applySched(d) {
  if (!d) return
  Object.assign(sched, { on: !!d.on, everyMinutes: Number(d.everyMinutes) || 60, running: !!d.running, lastRunAt: Number(d.lastRunAt) || 0, lastError: d.lastError || '' })
}
async function loadSched() {
  const j = await getJson('/api/scheduler')
  if (j && j.ok) applySched(j.data)
}
async function saveSched() {
  const r = await fetch('/api/scheduler', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: !!sched.on, everyMinutes: Number(sched.everyMinutes) || 60 }) })
  const j = await r.json().catch(() => null)
  if (j && j.ok) applySched(j.data)
  else toast((j && j.error && j.error.message) || '调度设置保存失败')
}
function toggleSched() { sched.on = !sched.on; saveSched() }
function setEveryValue(n) { sched.everyMinutes = Number(n) || 60; saveSched() }
async function saveLimits() {
  limits.interval = Math.min(600, Math.max(8, Number(limits.interval) || 60))
  limits.windowMinutes = Math.min(1440, Math.max(1, Number(limits.windowMinutes) || 60))
  limits.maxPerWindow = Math.min(1000, Math.max(1, Number(limits.maxPerWindow) || 20))
  limits.breaker = Math.min(10, Math.max(1, Number(limits.breaker) || 3))
  await patchUser({ interval: limits.interval, windowMinutes: limits.windowMinutes, maxPerWindow: limits.maxPerWindow, breaker: limits.breaker, detail: !!detail.value })
  toast('请求限制已保存')
}
async function runSched() {
  if (sched.running) return
  sched.running = true
  const r = await fetch('/api/scheduler/run', { method: 'POST', credentials: 'same-origin' })
  const j = await r.json().catch(() => null)
  toast(j && j.ok ? '调度已跑完一轮' : ((j && j.error && j.error.message) || '调度跑失败'))
  await loadSched()
  sched.running = false
}
const gates = reactive({ realCrawl: false, realPublish: false, realImages: false, loaded: false })

const pubGroups = computed(() => (rules.pub || []).map(g => {
  const cells = []
  ;(g.rows || []).forEach(r => {
    const last = cells[cells.length - 1]
    if (r.same && last && last.same === r.same) last.rows.push(r)
    else cells.push({ same: r.same || null, rows: [r] })
  })
  return { name: g.name, cls: g.cls || '', cells }
}))
const siteOptions = computed(() => sites.value.map(s => ({ host: s.host, title: s.title || s.host })))
const targetSite = computed(() => sites.value.find(s => s.host === targetHost.value) || null)
const targetOptions = computed(() => {
  const q = targetQ.value.trim().toLowerCase()
  const score = s => (siteCfg.value[s.host] && siteCfg.value[s.host].enabled === false ? 0 : 2) + (siteStatus.value[s.host] && siteStatus.value[s.host].pass ? 1 : 0)
  return sites.value.slice()
    .sort((a, b) => score(b) - score(a) || String(a.title || a.host).localeCompare(String(b.title || b.host), 'zh-CN'))
    .filter(s => !q || ((s.title || '') + ' ' + s.host).toLowerCase().includes(q))
    .map(s => ({ host: s.host, title: s.title || s.host }))
})

function specialOf(r) { return SPECIAL[r.t] || '' }
function toggleFetchChip(r, c) {
  if (r.todo) return
  const sel = Array.isArray(r.sel) ? r.sel.slice() : []
  const i = sel.indexOf(c)
  if (i >= 0) sel.splice(i, 1)
  else sel.push(c)
  r.sel = sel
}
function clampLimit(k, e) {
  const L = limitRanges[k]
  let v = Number(e.target.value) || L[0]
  if (v < L[0]) v = L[0]
  if (v > L[1]) v = L[1]
  limits[k] = v
  e.target.value = String(v)
}
function saveSource() {
  try { localStorage.setItem('pta.crawlSite', sourceHost.value) } catch (e) { reportError('Crawl', e) }
  loadTypes()
}
const typeRow = computed(() => ((rules.fetch[0] && rules.fetch[0].rows) || []).find(r => r.t === '类型'))
async function loadTypes() {
  const row = typeRow.value
  if (!row) return
  if (!sourceHost.value) { row.sel = []; return }
  const j = await getJson('/api/crawl/types/' + encodeURIComponent(sourceHost.value))
  row.sel = (j && j.ok && j.data && j.data.types) || []
}
async function saveTypes() {
  const row = typeRow.value
  if (!row || !sourceHost.value) return
  await fetch('/api/crawl/types/' + encodeURIComponent(sourceHost.value), {
    method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ types: row.sel || [] })
  })
}
async function saveFilters() {
  if (!sourceHost.value) return
  const get = (t) => {
    const r = ((rules.fetch[0] && rules.fetch[0].rows) || []).find(x => x.t === t)
    return (r && r.sel) || []
  }
  const body = { selected: { medium: get('媒介'), standard: get('分辨率'), spstate: get('优惠') } }
  const r = await fetch('/api/crawl/filters/' + encodeURIComponent(sourceHost.value), {
    method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const j = await r.json().catch(() => null)
  const vals = (j && j.ok && j.data && j.data.filters && j.data.filters.selectedValues) || {}
  const missing = Object.keys(body.selected).filter(k => body.selected[k].length && !(vals[k] || []).length)
  if (missing.length) toast('本站搜索页没有这些选项：' + missing.join('/'))
}
function pickTarget(host) {
  targetHost.value = host
  patchUser({ targetHost: host })
  try { localStorage.setItem('pta.target', host) } catch (e) { reportError('Crawl', e) }
  targetOpen.value = false
  toast('发布目标改为：' + ((targetSite.value && targetSite.value.title) || host))
}
function testRx() {
  const sample = String(rx.sample || '').trim()
  if (!sample) { rx.out = '先填一条标题'; rx.outClass = 'rx-warn'; return }
  const compile = (src) => {
    const s = String(src || '').trim()
    if (!s) return { re: null, err: '' }
    if (s.length > 200) return { re: null, err: '超过 200 字，按纯文本处理' }
    try { return { re: new RegExp(s, 'i'), err: '' } } catch (e) { return { re: null, err: '正则写错，按纯文本处理' } }
  }
  const hit = (src) => {
    const c = compile(src)
    if (c.re) return c.re.test(sample)
    const p = String(src || '').trim()
    return p ? sample.toLowerCase().includes(p.toLowerCase()) : false
  }
  const d = compile(rx.deny)
  const deny = hit(rx.deny)
  const msg = deny ? '命中排除规则，不转载' : '通过，可以转载'
  rx.out = msg + (d.err ? '（' + d.err + '）' : '')
  rx.outClass = deny ? 'rx-warn' : 'rx-ok'
}

async function patchUser(body) {
  return getJson('/api/config/user', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
}
async function putFlow(sets, rxBody) {
  const body = { sets }
  if (rxBody) body.rx = rxBody
  return getJson('/api/flow', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
}
function serialize(groups) {
  return (groups || []).map(g => (g.rows || []).map(r => ({ t: r.t, v: r.v, on: r.on, sel: r.sel })))
}
/* 旧下拉值迁成开关：只有明确“不检查/跳过/仍收”的旧值才改开关，其余默认开 */
function migrateDedupeSwitches(saved) {
  if (!Array.isArray(saved)) return
  const rows = (rules.dedupe[0] && rules.dedupe[0].rows) || []
  saved.forEach(group => (group || []).forEach(v => {
    if (!v || v.v === undefined) return
    const r = rows.find(x => x.t === v.t)
    if (!r || r.type !== 'switch') return
    if (r.t === '目标站只有 DIY') r.on = v.v !== '跳过'
    else if (r.t === '禁转/限转处理') r.on = v.v !== '不检查'
    else if (r.t === '目标站已有原盘') r.on = true
  }))
}
/* 旧下拉/数字值迁成发布卡开关 */
function migratePubSwitches(saved) {
  if (!Array.isArray(saved)) return
  const rows = []
  ;(rules.pub || []).forEach(g => (g.rows || []).forEach(r => rows.push(r)))
  const byT = {}
  saved.forEach(group => (group || []).forEach(v => { if (v && v.t) byT[v.t] = v }))
  const set = (t, on) => { const r = rows.find(x => x.t === t); if (r && r.type === 'switch') r.on = !!on }
  if (byT['BDInfo'] && byT['BDInfo'].v !== undefined) set('BDInfo', String(byT['BDInfo'].v) !== '不要求')
  if (byT['截图至少几张'] && byT['截图至少几张'].v !== undefined) set('截图至少几张', Number(byT['截图至少几张'].v) > 0)
  if (byT['简介图片'] && byT['简介图片'].v !== undefined) set('简介图片', !/保留外链|不保留图片/.test(String(byT['简介图片'].v)))
  if (byT['允许联网补简介'] && byT['允许联网补简介'].on === false) set('简介回填', false)
}
function applySaved(groups, saved) {
  if (!Array.isArray(saved)) return
  const byT = {}
  saved.forEach(rows => { if (Array.isArray(rows)) rows.forEach(v => { if (v && v.t) byT[v.t] = v }) })
  const sameShape = saved.length === groups.length
  groups.forEach((g, gi) => (g.rows || []).forEach((r, ri) => {
    const v = byT[r.t] || (sameShape && Array.isArray(saved[gi]) ? saved[gi][ri] : null)
    if (!v) return
    if (v.v !== undefined) r.v = v.v
    if (v.on !== undefined) r.on = v.on
    if (v.sel) r.sel = v.sel
  }))
}
async function loadFlow() {
  const j = await getJson('/api/flow')
  if (j && j.ok) {
    const sets = j.data && j.data.sets
    if (sets) {
      applySaved(rules.fetch, sets.fetch)
      applySaved(rules.dedupe, sets.dedupe)
      migrateDedupeSwitches(sets.dedupe)
      applySaved(rules.pub, sets.pub)
      migratePubSwitches(sets.pub)
    }
    if (j.data && j.data.rx) {
      rx.deny = j.data.rx.deny || ''
    }
  }
  const c = await getJson('/api/config')
  if (c && c.ok) {
    const u = c.data.user || {}
    ;['interval', 'windowMinutes', 'maxPerWindow', 'breaker'].forEach(k => { if (u[k] != null) limits[k] = Number(u[k]) })
    if (u.detail != null) detail.value = !!u.detail
    if (u.autoDupe != null) autoDupe.value = !!u.autoDupe
  }
}
async function saveFetch() {
  if (busy.fetch) return
  busy.fetch = true
  const [a, b] = await Promise.all([
    patchUser({ interval: limits.interval, windowMinutes: limits.windowMinutes, maxPerWindow: limits.maxPerWindow, breaker: limits.breaker, detail: !!detail.value }),
    putFlow({ fetch: serialize(rules.fetch) }, { deny: rx.deny }),
    saveTypes(),
    saveFilters()
  ])
  busy.fetch = false
  const bad = [a, b].find(j => !j || !j.ok)
  toast(bad ? ((bad && bad.error && bad.error.message) || '服务端拒绝了这次保存') : '抓取设置已保存')
}
async function saveScreen() {
  if (busy.dedupe) return
  busy.dedupe = true
  const [a, b] = await Promise.all([
    putFlow({ fetch: serialize(rules.fetch), dedupe: serialize(rules.dedupe) }, { deny: rx.deny }),
    patchUser({ autoDupe: !!autoDupe.value })
  ])
  busy.dedupe = false
  const bad = [a, b].find(j => !j || !j.ok)
  toast(bad ? ((bad && bad.error && bad.error.message) || '服务端拒绝了这次保存') : '初筛与查重已保存')
}
async function savePub() {
  if (busy.pub) return
  busy.pub = true
  const j = await putFlow({ pub: serialize(rules.pub) }, { deny: rx.deny })
  busy.pub = false
  toast(j && j.ok ? '发布设置已保存' : ((j && j.error && j.error.message) || '服务端拒绝了这次保存'))
}
async function toggleDetail() {
  detail.value = !detail.value
  const j = await patchUser({ detail: !!detail.value })
  toast(j && j.ok ? (detail.value ? '已开启抓详情页：每条多一次请求' : '已关闭抓详情页') : '开关没存上')
}

// 页面独立：需要 siteStatus/siteCfg 驱动目标站列表，不能和 Queue 的简化版共用。
async function loadSites() {
  const [sj, cj] = await Promise.all([getJson('/api/sites'), getJson('/api/site-config')])
  if (sj && sj.ok) {
    sites.value = Array.isArray(sj.data.sites) ? sj.data.sites : []
    siteStatus.value = sj.data.status || {}
  }
  if (cj && cj.ok) siteCfg.value = cj.data.sites || {}
  try {
    sourceHost.value = localStorage.getItem('pta.crawlSite') || ''
    targetHost.value = localStorage.getItem('pta.target') || ''
  } catch (e) { reportError('Crawl', e) }
  if (!siteOptions.value.some(s => s.host === sourceHost.value)) sourceHost.value = ''
  if (targetHost.value && !sites.value.some(s => s.host === targetHost.value)) targetHost.value = ''
  loadTypes()
  loadSched()
  if (!siteOptions.value.some(s => s.host === targetHost.value)) targetHost.value = ''
}


const RuleOrSpecial = (props) => {
  const r = props.r
  const kind = specialOf(r)
  if (kind === 'target') {
    const cur = targetSite.value
    const open = () => { targetQ.value = ''; targetOpen.value = true }
    const kids = []
    kids.push(h('b', {
      id: 'tp-name', class: 'tp-link' + (cur ? '' : ' empty'), title: cur ? cur.host : '',
      onClick: open
    }, cur ? (cur.title || cur.host) : '未选择站点'))
    kids.push(h('button', { class: 'tp-change-text', id: 'tp-change', type: 'button', onClick: open }, cur ? '更改' : '选择'))
    return h('div', { class: 'target-pick' + (cur ? '' : ' empty') }, kids)
  }
  if (kind === 'tpl') {
    return h('div', { class: 'tpl-wrap' }, [
      h('input', { class: 'input', id: 'sub-tpl', value: tpl.value, placeholder: '例：{电影名} | {地区}原盘 | 导演:{导演}', onInput: e => { tpl.value = e.target.value } }),
      h('div', { class: 'tpl-eg', id: 'sub-eg' }, tplPreview.value)
    ])
  }
  if (kind === 'deny') {
    return h('input', { class: 'input', id: 'rx-deny', value: rx.deny, placeholder: '命中就不转载，例：DVDRip|枪版|CAM', onInput: e => { rx.deny = e.target.value } })
  }
  if (kind === 'rx') {
    return h('div', { class: 'rx-test' }, [
      h('input', { class: 'input', id: 'rx-sample', value: rx.sample, placeholder: '粘贴一条标题试一下', onInput: e => { rx.sample = e.target.value } }),
      h('button', { class: 'btn ghost slim', id: 'rx-run', type: 'button', onClick: testRx }, '测试'),
      h('em', { id: 'rx-out', class: rx.outClass }, rx.out)
    ])
  }
  return h(RuleControl, { r })
}
RuleOrSpecial.props = { r: { type: Object, required: true } }

async function loadGates() {
  const j = await getJson('/api/config')
  if (j && j.ok && j.data && j.data.user) {
    if (j.data.user.targetHost) targetHost.value = j.data.user.targetHost
    gates.realCrawl = !!j.data.user.realCrawl
    gates.realPublish = !!j.data.user.realPublish
    gates.realImages = !!j.data.user.realImages
    gates.loaded = true
  }
}
async function applyGate(key, next) {
  const body = {}
  body[key] = next
  const j = await patchUser(body)
  if (j && j.ok) {
    gates[key] = next
    toast((next ? '已开启 ' : '已关闭 ') + ({ realCrawl: '真抓取', realPublish: '自动发布', realImages: '图床实传' }[key] || key))
  } else {
    toast((j && j.error && j.error.message) || '闸门保存失败')
  }
}
function toggleGate(key) {
  const next = !gates[key]
  if (next && key === 'realPublish') {
    confirmBox('开启自动发布？', '开启后调度/批量发布会真实提交到目标站；建议保持关闭，先在待审核页手动提交。', () => applyGate(key, true))
    return
  }
  if (next && key === 'realCrawl') {
    confirmBox('开启真抓取？', '开启后会真实访问来源站；请确认站点授权、频率和每天上限。', () => applyGate(key, true))
    return
  }
  if (next && key === 'realImages') {
    confirmBox('开启图床实传？', '开启后截图会真实上传到图床；先确认图床配置和额度。', () => applyGate(key, true))
    return
  }
  applyGate(key, next)
}
async function prepareNext() {
  if (busy.prepare) return
  busy.prepare = true
  const a = await getJson('/api/release/run', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'prepared', limit: 20 })
  })
  if (!a || !a.ok) {
    busy.prepare = false
    toast((a && a.error && a.error.message) || '准备失败')
    return
  }
  const b = await getJson('/api/release/run', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 'previewed', limit: 20 })
  })
  busy.prepare = false
  if (!b || !b.ok) {
    toast('已准备 ' + ((a.data && a.data.prepared) || 0) + ' 条，预览失败；不会自动发布')
    return
  }
  toast('已准备 ' + ((a.data && a.data.prepared) || 0) + ' · 已预览 ' + ((b.data && b.data.previewed) || 0) + ' · 不会自动发布')
}

async function ensure() {
  if (!viewVisible('crawl') || !loggedIn()) return
  if (!sites.value.length) await loadSites()
  if (!gates.loaded) await loadGates()
  loadFlow()
}
onMounted(() => {
  window.addEventListener('hashchange', ensure)
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
})
</script>

<style scoped src="./Crawl.css"></style>

/* 流程页布局冻结：查重卡单行 8/20、发布卡五列；改前先确认，改后 ui-freeze --update */
