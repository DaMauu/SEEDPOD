<template>
  <div class="drawers">
    <div id="crawl-panel">
      <FlowGates :gates="gates" :busy="busy" @toggle="toggleGate" @prepare="prepareNext" />
      <SchedulerBar :sched="sched" :sched-text="schedText" :limits="limits" @toggle="toggleSched" @every="setEveryValue" @save="saveLimits" @run="runSched" />
      <CrawlCard v-model:source-host="sourceHost" :site-options="siteOptions" :busy="busy" :fetch-sum="fetchSum" :plan="plan" :fetch-rows="fetchRows" :detail="detail" @show-plan="showPlan" @save-fetch="saveFetch" @toggle-fetch-chip="toggleFetchChip" @toggle-detail="toggleDetail" />
      <section class="drawer open vue-card screen-card">
        <div class="drawer-head">
          <div class="drawer-t"><div class="drawer-title">② 初筛与查重</div></div>
          <div class="drawer-head-right">
            <span class="drawer-meta">标题级条件 + 重复处理</span>
            <button class="btn primary slim" type="button" :disabled="busy.dedupe" @click="saveScreen">{{ busy.dedupe ? '保存中…' : '保存' }}</button>
          </div>
        </div>
        <div class="drawer-body screen-body">
          <div class="flow-group screen-col">
            <div class="flow-ttl">初筛</div>
            <div class="screen-list">
              <div v-for="r in rxRows" :key="r.t" class="set-field screen-field" :class="{ todo: r.todo, wide: r.t === '测试匹配' }">
                <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
                <div class="ctl"><RuleOrSpecial :r="r" /></div>
              </div>
            </div>
          </div>
          <div class="flow-group screen-col dedupe-body">
            <div class="flow-ttl">查重</div>
            <div class="screen-list">
              <div class="set-field screen-field">
                <div class="lbl"><span>自动查重</span></div>
                <button class="switch" :class="{ on: autoDupe }" type="button" role="switch" :aria-checked="String(autoDupe)" @click="autoDupe = !autoDupe"><i></i></button>
              </div>
              <div v-for="r in dedupeSwitches" :key="r.t" class="set-field screen-field" :class="{ todo: r.todo }">
                <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
                <button class="switch" :class="{ on: !!r.on }" type="button" role="switch" :aria-checked="String(!!r.on)" :disabled="r.todo" @click="r.on = !r.on"><i></i></button>
              </div>
              <div v-for="r in dedupeInputs" :key="r.t" class="set-field screen-field" :class="{ todo: r.todo }">
                <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
                <div class="ctl"><RuleControl :r="r" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="drawer open vue-card pub-card">
        <div class="drawer-head">
          <div class="drawer-t"><div class="drawer-title">发布</div></div>
          <div class="drawer-head-right">
            <button class="btn ghost slim" type="button" @click="openMaps">站点映射</button>
            <button class="btn primary slim" type="button" :disabled="busy.pub" @click="savePub">{{ busy.pub ? '保存中…' : '保存' }}</button>
          </div>
        </div>
        <div class="drawer-body">
          <div v-for="g in pubGroups" :key="g.name" class="flow-group" :class="g.cls">
            <div class="flow-ttl">{{ g.name }}</div>
            <div class="set-fields">
              <template v-for="(cell, ci) in g.cells" :key="cell.same || ci">
                <div v-if="cell.rows.length > 1" class="set-field pair">
                  <div v-for="r in cell.rows" :key="r.t" class="pair-item" :class="{ grow: r.type !== 'switch', target: r.t === '发布到', todo: r.todo }">
                    <template v-if="r.type === 'switch'">
                      <span class="pair-lbl">{{ r.label || r.t }}<em v-if="r.todo" class="todo-badge">未接</em></span>
                      <button class="switch" :class="{ on: r.on }" type="button" :disabled="r.todo" @click="r.on = !r.on"><i></i></button>
                    </template>
                    <template v-else>
                      <span class="pair-lbl">{{ r.label || r.t }}<em v-if="r.todo" class="todo-badge">未接</em></span>
                      <div class="ctl"><RuleOrSpecial :r="r" /></div>
                    </template>
                  </div>
                </div>
                <div v-else-if="cell.rows[0].type === 'section'" class="set-field sec">
                  <div class="sec-ttl">{{ cell.rows[0].t }}</div>
                </div>
                <div v-else class="set-field" :class="{ wide: cell.rows[0].wide, pick: cell.rows[0].type === 'pick' || cell.rows[0].inline, todo: cell.rows[0].todo }">
                  <div class="lbl"><span>{{ cell.rows[0].label || cell.rows[0].t }}</span><em v-if="cell.rows[0].todo" class="todo-badge">未接</em></div>
                  <div class="ctl"><RuleOrSpecial :r="cell.rows[0]" /></div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-if="mapOpen" class="modal-mask">
      <div class="modal map-modal">
        <div class="modal-head">
          <h2>站点映射（分类 / 制作组）</h2>
          <button class="btn ghost slim" type="button" @click="mapOpen = false">关闭</button>
        </div>
        <div class="map-body">
          <div class="map-top">
            <select v-model="mapHost" class="select" @change="loadMap">
              <option v-for="t in mapTargets" :key="t.host" :value="t.host">{{ t.host }}</option>
            </select>
            <button class="btn ghost slim" type="button" :disabled="mapLoading" @click="detectMap">{{ mapLoading ? '识别中…' : '自动识别' }}</button>
            <button class="btn primary slim" type="button" @click="saveMap">保存</button>
          </div>
          <div v-if="mapMsg" class="rule-hint">{{ mapMsg }}</div>
          <h3>分类（我们这边 → 这个站的值）</h3>
          <div v-for="(row, i) in mapCatRows" :key="'c' + i" class="map-row">
            <input v-model="row.k" class="input" placeholder="电影">
            <input v-model="row.v" class="input" placeholder="401">
            <button class="btn ghost slim" type="button" @click="mapCatRows.splice(i, 1)">删</button>
          </div>
          <button class="btn ghost slim" type="button" @click="mapCatRows.push({ k: '', v: '' })">加一行</button>
          <h3>制作组（组名 → 这个站的值）</h3>
          <div v-for="(row, i) in mapTeamRows" :key="'t' + i" class="map-row">
            <input v-model="row.k" class="input" placeholder="CMCT">
            <input v-model="row.v" class="input" placeholder="8">
            <button class="btn ghost slim" type="button" @click="mapTeamRows.splice(i, 1)">删</button>
          </div>
          <button class="btn ghost slim" type="button" @click="mapTeamRows.push({ k: '', v: '' })">加一行</button>
        </div>
      </div>
    </div>

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
const mapHost = ref('')
const mapTargets = ref([])
const mapCatRows = ref([])
const mapTeamRows = ref([])
const mapMsg = ref('')
const mapForm = ref(null)
const mapLoading = ref(false)
function mapRowsOf(obj) { return Object.keys(obj || {}).map(k => ({ k, v: String(obj[k] || '') })) }
async function openMaps() {
  mapOpen.value = true
  mapMsg.value = ''
  if (!mapTargets.value.length) {
    const j = await getJson('/api/targets')
    mapTargets.value = (j && j.ok && j.data) || []
  }
  if (!mapHost.value && mapTargets.value.length) mapHost.value = mapTargets.value[0].host
  await loadMap()
}
async function loadMap() {
  if (!mapHost.value) return
  const j = await getJson('/api/maps')
  const s = (j && j.ok && j.data && j.data.sites && j.data.sites[mapHost.value]) || {}
  mapCatRows.value = mapRowsOf(s.cat)
  mapTeamRows.value = mapRowsOf(s.team)
}
async function detectMap() {
  if (!mapHost.value || mapLoading.value) return
  mapLoading.value = true
  mapMsg.value = '识别中…'
  const r = await fetch('/api/maps/' + encodeURIComponent(mapHost.value) + '/detect', { method: 'POST', credentials: 'same-origin' })
  const j = await r.json().catch(() => null)
  mapLoading.value = false
  if (!j || !j.ok) { mapMsg.value = (j && j.error && j.error.message) || '识别失败'; return }
  mapCatRows.value = mapRowsOf(j.data.cat)
  mapForm.value = j.data.form || null
  const tc = (j.data.teamOptions || []).length
  mapMsg.value = '识别到分类 ' + Object.keys(j.data.cat || {}).length + ' 项' + (tc ? ' · 制作组选项 ' + tc + ' 个（填组名对应的值）' : '')
}
async function saveMap() {
  if (!mapHost.value) return
  const cat = {}, team = {}
  mapCatRows.value.forEach(r => { if (String(r.k).trim() && String(r.v).trim()) cat[String(r.k).trim()] = String(r.v).trim() })
  mapTeamRows.value.forEach(r => { if (String(r.k).trim() && String(r.v).trim()) team[String(r.k).trim()] = String(r.v).trim() })
  const r = await fetch('/api/maps/' + encodeURIComponent(mapHost.value), { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cat, team, form: mapForm.value }) })
  const j = await r.json().catch(() => null)
  mapMsg.value = j && j.ok ? '已保存到 data/site-maps.json' : ((j && j.error && j.error.message) || '保存失败')
}
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
const plan = reactive({ on: false, host: '', urls: [], warnings: [], dailyMax: 0, interval: 0, engine: '', catGroups: 0, catIds: 0, estimatedQueries: 0, today: '' })
const busy = reactive({ fetch: false, dedupe: false, pub: false, plan: false, prepare: false })
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

async function getJson(url, opts) {
  try {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}))
    return await r.json()
  } catch (e) { return null }
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

async function showPlan() {
  if (!sourceHost.value) { toast('先在右上角「选来源站」里挑一个站'); return }
  if (busy.plan) return
  busy.plan = true
  const j = await getJson('/api/crawl/plan?host=' + encodeURIComponent(sourceHost.value))
  busy.plan = false
  if (!j || !j.ok) { toast((j && j.error && j.error.message) || '拿不到抓取计划'); return }
  const d = j.data || {}
  Object.assign(plan, {
    on: true, host: d.siteHost || sourceHost.value,
    urls: Array.isArray(d.searchUrls) ? d.searchUrls : [],
    warnings: Array.isArray(d.warnings) ? d.warnings : [],
    dailyMax: d.dailyMax || 0, interval: d.interval || 0, engine: d.engine || '',
    catGroups: d.catGroups || 0, catIds: d.catIds || 0, estimatedQueries: d.estimatedQueries || 0,
    today: '今日情况读取中…'
  })
  const s = await getJson('/api/crawl/status?host=' + encodeURIComponent(sourceHost.value))
  if (s && s.ok) {
    const x = s.data || {}
    const wait = Math.max(0, Math.round((x.waitMs || 0) / 1000))
    plan.today = '今天已抓 ' + (x.count || 0) + '/' + (x.dailyMax || 0) + ' 次' + (wait ? ' · 还要等 ' + wait + ' 秒' : ' · 现在可以抓') +
      ' · 上次 ' + (x.lastAt ? new Date(x.lastAt).toLocaleString('zh-CN', { hour12: false }).slice(5, 16) : '还没抓过')
  } else plan.today = ''
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

<style scoped>
/* Crawl 页面样式：迁入 scoped，shell/dock/shared 保留全局 */
.target-pick { display: flex; align-items: center; gap: 12px; }
.target-pick { display: flex; align-items: center; gap: 10px; }
.drawers { background: #fff; border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
.drawers { display: flex; flex-direction: column; gap: 12px; background: none; box-shadow: none; border-radius: 0; overflow: visible; }
.drawers { gap: 14px; }
.drawers :deep(.drawer) { flex: 0 0 auto; display: flex; flex-direction: column; min-height: 0; }
.drawers :deep(.drawer.open) { flex: 1 1 auto; }
.drawers :deep(.drawer-body) { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.tpl-wrap { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.tpl-wrap .input { width: 460px; height: 32px; font-size: 12px; }
.tpl-eg { font-size: 11px; color: var(--muted); max-width: 460px; text-align: right; line-height: 1.5; }
.set-field .tpl-eg { margin-top: 6px; }
.drawers :deep(.drawer) { flex: 0 0 auto; }
.drawers :deep(.drawer-body) { display: block; overflow: visible; }
.tpl-fixed { font-size: 12.5px; color: var(--muted); line-height:1.4; }
.drawers { gap: 10px; }
.drawers { gap: 8px; }
.rx-test .input { width: 260px; }
.rx-test em { font-style: normal; font-size: 11.5px; color: #9aa0b0; }
.rx-test em.rx-ok { color: #1f8a5a; }
.rx-test em.rx-warn { color: #c0453c; }
.set-field .ctl:has(.rx-test) { flex: 0 1 auto; min-width: 0; justify-content: flex-end; }
.rx-test { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
.rx-test .input { flex: 0 1 240px; width: 240px; min-width: 0; }
.rx-test .btn { flex: 0 0 auto; white-space: nowrap; }
.rx-test em { flex: 0 0 auto; white-space: nowrap; }
.set-field .ctl:has(.rx-test) { flex: 0 0 auto; }
.rx-test .input { flex: 0 0 240px; width: 240px; }
.crawl-dry :deep(.drawer-body){padding-top:0}
.crawl-dry :deep(.dl-dry){margin:0 0 4px}
.crawl-note{margin:4px 0 10px;padding:2px 16px 0;font-size:12px;color:var(--muted-2);line-height:1.6}
.crawl-card :deep(.drawer-head){padding:12px 20px;gap:10px}
.crawl-card :deep(.drawer-title){font-size:15px}

.crawl-card :deep(.drawer-body){padding:4px 20px 18px}
.crawl-card :deep(.preset-block){display:flex;flex-direction:column;gap:2px}
.crawl-card :deep(.preset-row){display:grid;grid-template-columns:116px minmax(0,1fr);align-items:start;gap:12px;padding:7px 0}
.crawl-card :deep(.preset-row .lbl){font-size:12.5px;color:var(--muted,#6b7280);min-width:0}
.crawl-card :deep(.preset-row .cat-row){display:flex;flex-wrap:wrap;gap:6px;padding:0}
.crawl-card :deep(.preset-row .cat-chip){height:24px;padding:0 8px;border-radius:5px;font-size:11px;line-height:24px}
.crawl-card :deep(.preset-row .lbl > span){white-space:normal;overflow:visible;text-overflow:clip;line-height:1.35}
.crawl-card :deep(.preset-row .cat-row){gap:4px;margin-left:50px}
.crawl-card :deep(.preset-row .lbl){align-items:flex-start;padding-top:3px}
.crawl-card :deep(.limits-panel){display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 18px;margin-top:16px;padding:14px 16px;background:var(--panel-2,#f9fafb);border:1px solid var(--line,#eef0f4);border-radius:10px}
.crawl-card :deep(.limit-item){display:flex;flex-direction:column;gap:6px;min-width:0}
.crawl-card :deep(.limit-item .lbl){font-size:12px;color:var(--muted,#6b7280)}
.crawl-card :deep(.limit-item .input){width:100%;height:32px;padding:0 10px;font-size:13px}
.crawl-card :deep(.crawl-foot){display:flex;align-items:center;justify-content:flex-end;gap:16px;margin-top:10px;padding-top:0;border-top:0}
.crawl-card :deep(.crawl-note){font-size:12px;color:var(--muted-2,#9ca3af);line-height:1.5}
.crawl-card :deep(.detail-sw){display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted,#6b7280);cursor:pointer}
.crawl-card :deep(.detail-sw .switch){flex:0 0 auto}
@media (max-width:1100px) {
.crawl-card :deep(.limits-panel){grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:640px) {
.crawl-card :deep(.preset-row){grid-template-columns:96px minmax(0,1fr);gap:8px;align-items:start}
}
@media (max-width:640px) {
.crawl-card :deep(.limits-panel){grid-template-columns:1fr}
}
@media (max-width:640px) {
.crawl-card :deep(.crawl-foot){flex-direction:column;align-items:flex-start;gap:10px}
}
.flow-group{background:#f9fafb;border:1px solid #edeff2;border-radius:9px;padding:9px 14px 8px;margin:0 0 8px}
.screen-card .drawer-body { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 0 24px; padding: 8px 22px 14px; }
.screen-card .screen-col { background: transparent; border: 0; border-right: 1px solid #f2f4f7; border-radius: 0; padding: 0 18px 0 0; margin: 0; }
.screen-card .screen-col:last-child { border-right: 0; padding-right: 0; }
.screen-card .flow-ttl { display: flex; align-items: center; gap: 7px; margin: 0 0 6px; font-size: 13px; font-weight: 650; color: var(--ink); letter-spacing: -.01em; }
.screen-card .flow-ttl::before { content: ''; width: 3px; height: 12px; border-radius: 2px; background: var(--accent); flex: 0 0 auto; }
.screen-card .screen-list { display: flex; flex-direction: column; gap: 0; }
.screen-card .screen-field { display: grid !important; grid-template-columns: 150px minmax(0, 1fr) !important; align-items: center; gap: 10px; padding: 5px 0; margin: 0; border: 0; border-bottom: 1px solid #f5f6f8; min-width: 0; }
.screen-card .screen-field .cat-row { padding: 0; gap: 6px; }
.screen-card .screen-field .cat-chip { height: 26px; padding: 0 9px; line-height: 26px; border-radius: 6px; }
.screen-card .screen-field:last-child { border-bottom: 0; }
.screen-card .screen-field > .switch { grid-column: 2; justify-self: start; }
.screen-card .screen-field .lbl { margin: 0; min-width: 0; }
.screen-card .screen-field .lbl span { font-size: 12.5px; font-weight: 400; color: #5b6573; line-height: 1.4; }
.screen-card .screen-field .ctl { display: flex; align-items: center; justify-content: flex-start; gap: 6px; min-width: 0; width: 100%; }
.screen-card .screen-field .ctl > .input, .screen-card .screen-field .ctl > .select { width: 100%; max-width: 320px; height: 28px; font-size: 12px; }
.screen-card .screen-field.wide { grid-template-columns: 1fr; gap: 4px; }
.screen-card .screen-field.wide .ctl { justify-content: flex-start; flex-wrap: wrap; }
.screen-card .screen-field.wide .rx-test { width: 100%; }
.screen-card .screen-field.wide .rx-test .input { flex: 1 1 auto; min-width: 160px; width: auto; }
@media (max-width: 800px) {
  .screen-card .drawer-body { grid-template-columns: 1fr !important; gap: 12px; padding: 8px 16px 12px; }
  .screen-card .screen-col { border-right: 0; border-bottom: 1px solid #f2f4f7; padding: 0 0 10px; }
  .screen-card .screen-col:last-child { border-bottom: 0; padding-bottom: 0; }
  .screen-card .screen-field { grid-template-columns: 132px minmax(0, 1fr); }
}

.dedupe-card :deep(.drawer-body){display:flex;align-items:center;min-height:54px;gap:0;padding:8px 16px}
.dedupe-switch-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;padding:2px 0 8px}
.dedupe-switch{display:flex !important;flex-direction:row !important;align-items:center;gap:8px;padding:0 !important;flex:0 0 auto;min-width:0}
.dedupe-switch .lbl{margin:0 !important;white-space:nowrap}
.dedupe-input{display:flex !important;flex-direction:row !important;align-items:center;gap:8px;padding:0 !important;flex:0 1 380px;min-width:240px}
.dedupe-input .lbl{margin:0 !important;white-space:nowrap}
.dedupe-input .ctl{flex:1 1 auto;min-width:0;width:auto !important}
.dedupe-input .ctl > .input{width:100% !important;height:28px;font-size:12px}
.dedupe-card :deep(.flow-group){background:transparent;border:0;border-radius:0;padding:0;margin:0}
.dedupe-card :deep(.flow-ttl){margin-bottom:6px}
.flow-group :deep(.flow-ttl){font-size:12px;font-weight:600;color:var(--muted);margin:0 0 1px}
.filter-head { display: flex; align-items: baseline; gap: 10px; padding: 2px 0 8px; border-bottom: 1px solid var(--line); margin-bottom: 6px; }
.filter-title { font-size: 13px; font-weight: 650; color: var(--ink); letter-spacing: -.01em; }
.filter-sub { font-size: 11px; color: var(--muted-2); }
.filter-card :deep(.preset-row){display:grid;grid-template-columns:112px minmax(0,1fr);align-items:center;gap:14px;padding:3px 0}
.filter-card :deep(.preset-row .lbl){font-size:12.5px;color:var(--ink);font-weight:500;min-width:0;white-space:nowrap;line-height:1.3}
.filter-card :deep(.preset-row .ctl){display:flex;align-items:center;gap:4px;padding-left:86px;min-width:0}
.filter-card :deep(.preset-row .cat-row){margin-left:0;gap:4px;justify-content:flex-start}
.filter-card :deep(.preset-row .cat-chip){height:24px;padding:0 8px;border-radius:5px;font-size:11px;line-height:24px}
.flow-sum { font-size: 11px; color: var(--muted); opacity: .85; margin: 0 0 6px; }
/* 未接徽标固定在右侧同一行；右侧芯片行统一左对齐 */
.crawl-card :deep(.preset-row .lbl), .flow-group :deep(.set-field .lbl) { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; min-width: 0; }
.flow-group :deep(.set-field .lbl > span) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crawl-card :deep(.preset-row .lbl > span) { min-width: 0; white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.35; }
.todo-badge { flex: 0 0 auto; margin-left: 0; }
.crawl-card :deep(.preset-row .cat-row), .crawl-card :deep(.preset-row .pick-row),
.flow-group :deep(.set-field .cat-row), .flow-group :deep(.set-field .pick-row) { justify-content: flex-start; }
.rule-hint { font-size: 11px; color: var(--muted); opacity: .85; line-height: 1.45; margin-top: 2px; }
.map-modal { width: 640px; max-width: calc(100vw - 32px); }
.map-body { display: flex; flex-direction: column; gap: 8px; max-height: 70vh; overflow: auto; }
.map-top { display: flex; gap: 8px; align-items: center; }
.map-top .select { flex: 1; }
.map-row { display: flex; gap: 8px; align-items: center; }
.map-row .input { flex: 1; }
.flow-group :deep(.set-fields){display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 18px}
.flow-group :deep(.set-field){display:block;padding:5px 0;border-bottom:0;min-width:0}
.flow-group :deep(.set-field .lbl){margin-bottom:3px}
.flow-group :deep(.set-field .lbl span){font-size:12.5px;line-height:1.35}
.flow-group :deep(.set-field .ctl), .flow-group :deep(.set-field .ctl > .input), .flow-group :deep(.set-field .ctl > .select){width:100%}
.flow-group{padding:7px 12px 6px;margin:0 0 7px}
.flow-group :deep(.set-fields){gap:0 12px}
.flow-group :deep(.set-field){padding:3px 0}
.flow-group :deep(.set-field .lbl){margin-bottom:2px}
.flow-group :deep(.set-field .lbl span){font-size:12px;line-height:1.3}
.flow-group :deep(.set-field .ctl>.input), .flow-group :deep(.set-field .ctl>.select){height:28px;font-size:12px;padding:0 8px}
.flow-group :deep(.switch i){width:30px;height:17px}
.flow-group :deep(.switch i::after){width:13px;height:13px;top:2px;left:2px}
.flow-group :deep(.switch.on i::after){left:15px}
.flow-group :deep(.set-field.sec){grid-column:1/-1;padding:5px 0 2px;margin-top:2px;border-top:1px solid #e9ebef}
.flow-group :deep(.set-field.sec:first-child){margin-top:0;padding-top:0;border-top:0}
.flow-group :deep(.sec-ttl){font-size:11px;font-weight:600;color:#8a94a2;letter-spacing:.4px}
.flow-group :deep(.chip-row){display:flex;flex-wrap:wrap;gap:6px;padding:2px 0 1px}
.flow-group :deep(.chip){border:1px solid #e2e5ea;background:#fff;border-radius:999px;padding:4px 10px;font-size:12px;color:#5b6573;cursor:pointer;line-height:1.2}
.flow-group :deep(.chip.on){background:#eef5ff;border-color:#bfd8ff;color:#1d4ed8}
.flow-group :deep(.set-field.pair){grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:2px 0 4px}
.flow-group :deep(.set-field.wide){grid-column:1/-1}
.flow-group :deep(.set-field.wide .rx-test){width:100%}
.flow-group :deep(.set-field.wide .rx-test .input){width:auto;flex:1 1 auto;min-width:200px;height:28px;font-size:12px}
.flow-group :deep(.set-field.wide .rx-test em){white-space:nowrap}
.flow-group.cond{background:transparent;border:0;padding:0;margin:0 0 4px}
.flow-group.cond :deep(.set-fields){grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}
.flow-group.cond :deep(.set-field){grid-column:auto;display:grid;grid-template-columns:fit-content(220px) minmax(0,1fr);align-items:center;gap:10px;padding:4px 0;border-bottom:1px solid #f3f5f8}
.flow-group.cond :deep(.set-field .lbl){margin:0}
.flow-group.cond :deep(.set-field.sec){grid-column:1/-1;padding:9px 0 3px;margin-top:2px;border-top:1px solid #e9ebef;border-bottom:0}
.flow-group.cond :deep(.set-field.sec .sec-ttl){font-size:11px;color:#98a1ad}
.flow-group.cond :deep(.set-field.pair){grid-column:1/-1;display:flex;align-items:center;gap:14px}
.flow-group.cond :deep(.set-field.wide){grid-column:1/-1}
.flow-group.cond :deep(.set-field.pick){grid-column:auto}
.flow-group.cond :deep(.set-field.pick .cat-chip){height:24px;padding:0 9px;line-height:24px}
.flow-group.cond :deep(.set-field .ctl>.input){height:26px;max-width:180px}
.flow-group :deep(.set-field.pick){grid-column:1/-1;display:grid;grid-template-columns:fit-content(220px) minmax(0,1fr);align-items:center;gap:10px;padding:3px 0}
.flow-group :deep(.set-field.pick .lbl){margin:0}
.flow-group :deep(.set-field.pick .ctl){width:100%}
.flow-group :deep(.set-field.pick .cat-row){display:flex;flex-wrap:wrap;gap:6px;padding:0}
.flow-group :deep(.set-field.pick .cat-chip){height:26px;padding:0 10px;border-radius:6px;font-size:12px;line-height:26px}
.flow-group :deep(.set-field.pick .ctl>.input){height:26px;max-width:180px;font-size:12px}
.flow-group :deep(.set-field.pair .pair-item){display:flex;align-items:center;gap:6px;flex:0 0 auto}
.flow-group :deep(.set-field.pair .pair-lbl){font-size:12px;color:#5b6573}

@media (max-width:700px) {
.dedupe-switch-row{gap:8px 14px}
.dedupe-switch{flex:1 1 calc(50% - 7px)}
.dedupe-switch .lbl > span{white-space:normal !important;overflow:visible !important;text-overflow:clip !important;line-height:1.25}
.dedupe-input{flex:1 1 100%;min-width:0;flex-wrap:nowrap}
.dedupe-input .lbl{flex:0 0 auto}
.dedupe-input .ctl{flex:1 1 auto;min-width:0}
.flow-group :deep(.set-fields){grid-template-columns:1fr}
.flow-group.cond :deep(.set-fields){grid-template-columns:1fr}
.flow-group.cond :deep(.set-field){grid-template-columns:1fr;gap:2px}
.flow-group.cond :deep(.set-field .ctl>.input){max-width:none;width:100%}
.flow-group :deep(.set-field.pair), .flow-group.cond :deep(.set-field.pair){flex-direction:column;align-items:stretch;gap:4px}
.flow-group :deep(.set-field.pair .pair-item){width:100%;flex:1 1 auto}
}
.crawl-dry :deep(.drawer-body:empty){display:none}
.crawl-dry :deep(.drawer-body[hidden]){display:none!important}
.todo-badge{font-style:normal;font-size:10px;line-height:16px;color:#b45309;background:#fef3c7;border:1px solid #fde68a;border-radius:999px;padding:0 6px;margin-left:6px;white-space:nowrap}
.preset-row.todo{opacity:.55;pointer-events:none}
.pair-item.todo{opacity:.55;pointer-events:none}
.set-field.todo{opacity:.55}
.set-field.todo .ctl{pointer-events:none}

.flow-group :deep(.set-field .lbl), .preset-row :deep(.lbl) { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 6px; }
.flow-group :deep(.set-field .lbl span), .preset-row :deep(.lbl span) { min-width: 0; }
.flow-group :deep(.set-field .lbl i) { flex: 1 1 100%; margin-top: 2px; }
.flow-group :deep(.set-field .lbl .todo-badge), .preset-row :deep(.lbl .todo-badge) { flex: 0 0 auto; margin-left: 0; }
.flow-group :deep(.pair-lbl) { display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.flow-group :deep(.pair-lbl .todo-badge) { flex: 0 0 auto; margin-left: 0; }

@media (max-width:900px){.flow-group.cond :deep(.set-field),.flow-group :deep(.set-field.pick){grid-template-columns:92px minmax(0,1fr);gap:8px;align-items:center}}

/* 页面容器本身不参与布局，卡片直接吃 .drawers 的间距 */
#crawl-panel { display: flex; flex-direction: column; gap: 14px; }
#crawl-panel { display: contents; }

:global(.view[data-view="crawl"]) { height: auto; min-height: calc(100vh - 150px); display: flex; flex-direction: column; }
.drawers { gap: 12px; flex: 1; min-height: 0; height: auto; }
.drawers .drawer, .drawers :deep(.drawer) {
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, .04);
  background: #fff;
  overflow: hidden;
}
.drawers .drawer-head, .drawers :deep(.drawer-head) { padding: 13px 22px; gap: 16px; }
.drawers .drawer-t, .drawers :deep(.drawer-t) { display: block; }
.drawers .drawer-title, .drawers :deep(.drawer-title) { font-size: 14px; font-weight: 600; letter-spacing: -.01em; }
.drawers .drawer-desc, .drawers :deep(.drawer-desc) { margin-top: 3px; font-size: 11.5px; color: var(--muted-2); white-space: normal; }
.drawers .drawer-meta, .drawers :deep(.drawer-meta) { font-size: 11.5px; color: var(--muted); }
.drawers .drawer-body, .drawers :deep(.drawer-body) { padding: 2px 22px 10px; }
/* ===== 发布区：三级层级 + 单行左右排布，无内嵌卡片/横线 ===== */
.pub-card > .drawer-head { border-bottom: 0; background: #fff; }
.pub-card .drawer-body {
  display: grid !important; grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  gap: 0 18px; max-width: none; margin: 0; padding: 8px 22px 14px;
}
.pub-card .flow-group {
  display: block; background: transparent; border: 0; border-right: 1px solid #f2f4f7;
  border-radius: 0; padding: 0 16px 0 0; margin: 0; min-width: 0;
}
.pub-card .flow-group:last-child { border-right: 0; padding-right: 0; }
.pub-card .flow-group .flow-ttl {
  display: flex; align-items: center; gap: 7px;
  margin: 0 0 8px; padding: 0;
  font-size: 13px; font-weight: 650; color: var(--ink); letter-spacing: -.01em;
}
.pub-card .flow-group .set-fields { display: flex; flex-direction: column; gap: 6px; padding-left: 0; }
.pub-card .flow-group .set-fields .set-field.pair {
  display: flex !important; flex-direction: column !important; align-items: stretch;
  gap: 6px; padding: 0;
}
.pub-card .flow-group .set-fields .set-field.pair .pair-item {
  width: 100% !important; flex: 1 1 auto !important; justify-content: space-between; gap: 6px;
}
.pub-card .flow-group .set-fields .set-field.pair .pair-item .pair-lbl { white-space: normal; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target { flex-direction: column; align-items: stretch; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target .ctl { width: 100%; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target .target-pick { width: 100%; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target .target-pick .tp-info { flex-wrap: wrap; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow { flex-direction: column; align-items: stretch; min-width: 0; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow .ctl { width: 100%; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow .ctl > .input { width: 100%; max-width: none; }
@media (max-width: 1200px) {
  .pub-card .drawer-body { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 16px 18px; }
  .pub-card .flow-group { border-right: 0; border-bottom: 1px solid #f2f4f7; padding: 0 0 10px; }
}
@media (max-width: 800px) {
  .pub-card .drawer-body { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
@media (max-width: 600px) {
  .pub-card .drawer-body { grid-template-columns: 1fr !important; }
}
.pub-card .flow-group .flow-ttl::before { content: ''; width: 3px; height: 12px; border-radius: 2px; background: var(--accent); flex: 0 0 auto; }
.pub-card .flow-group .set-fields { display: flex; flex-direction: column; gap: 0; padding-left: 10px; }
.pub-card .flow-group .set-fields .set-field,
.pub-card .flow-group .set-fields .set-field.pick {
  display: grid; grid-template-columns: 200px minmax(0, 1fr);
  align-items: center; gap: 16px;
  padding: 4px 0; margin: 0; border: 0; min-width: 0;
}
.pub-card .flow-group .set-fields .set-field.pair { display: flex !important; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 8px 20px; padding: 2px 0; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item { width: auto; flex: 0 0 auto; gap: 8px; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item .pair-lbl { white-space: nowrap; flex: 0 0 auto; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow { flex: 0 1 300px; min-width: 180px; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow .ctl { width: 100%; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow .ctl > .input { width: 100%; max-width: none; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target { flex: 0 0 auto; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target .ctl { width: auto; }
.pub-card .flow-group .set-fields .set-field.sec { display: block; padding: 11px 0 2px; border: 0; }
.pub-card .flow-group .set-fields .set-field.sec:first-child { padding-top: 2px; }
.pub-card .flow-group .set-fields .set-field .lbl { margin: 0; min-width: 0; }
.pub-card .flow-group .set-fields .set-field .lbl span { font-size: 12.5px; font-weight: 400; color: #5b6573; line-height: 1.4; }
.pub-card .flow-group .set-fields .set-field .ctl {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; width: 100%; min-width: 0; flex-wrap: nowrap;
}
.pub-card .flow-group .set-fields .set-field .ctl > .input,
.pub-card .flow-group .set-fields .set-field .ctl > .select { width: 100%; max-width: 460px; height: 30px; font-size: 12px; }
.pub-card .flow-group .set-fields .set-field.wide { grid-column: 1 / -1; }
.pub-card .flow-group .set-fields .set-field.wide .rx-test { width: 100%; }
.pub-card .flow-group .set-fields .set-field.wide .rx-test .input { max-width: none; flex: 1 1 auto; }
.pub-card .flow-group .set-fields .set-field .pick-row { display: flex; flex-wrap: nowrap; justify-content: flex-end; gap: 6px; max-width: none; overflow-x: auto; scrollbar-width: thin; }
.pub-card .flow-group .set-fields .set-field .cat-chip { flex: 0 0 auto; }
.pub-card .flow-group .sec-ttl { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--muted-2); letter-spacing: .06em; }
.pub-card .flow-group .sec-ttl::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: var(--muted-2); flex: 0 0 auto; }
.pub-card .target-pick {
  display: inline-flex; align-items: center; gap: 10px;
  min-height: 28px; max-width: 100%; padding: 0;
  border: 0; border-radius: 0; background: transparent;
}
.pub-card .target-pick.empty { border: 0; background: transparent; }
.pub-card .target-pick .tp-link { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #cbd0d8; }
.pub-card .target-pick .tp-link.empty { font-weight: 400; color: var(--muted); text-decoration: none; }
.pub-card .target-pick .tp-change-text { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; flex: 0 0 auto; }
.pub-card .target-pick .tp-change-text:hover { text-decoration: underline; }
.pub-card :deep(.target-pick .tp-link) { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #cbd0d8; }
.pub-card :deep(.target-pick .tp-link.empty) { font-weight: 400; color: var(--muted); text-decoration: none; }
.pub-card :deep(.target-pick .tp-change-text) { border: 0 !important; background: none !important; padding: 0 !important; color: var(--accent); font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; flex: 0 0 auto; min-width: 0; }
.pub-card :deep(.target-pick .tp-change-text:hover) { text-decoration: underline; }

@media (max-width: 760px) {

  .pub-card .flow-group .set-fields .set-field,
  .pub-card .flow-group .set-fields .set-field.pick { grid-template-columns: 1fr; gap: 4px; }
  .pub-card .flow-group .set-fields .set-field .ctl { justify-content: flex-start; flex-wrap: wrap; }
  .pub-card .flow-group .set-fields .set-field .ctl > .input,
  .pub-card .flow-group .set-fields .set-field .ctl > .select { max-width: none; }
  .pub-card .flow-group .set-fields .set-field .pick-row { flex-wrap: wrap; justify-content: flex-start; overflow-x: visible; }
  .pub-card .target-pick { width: 100%; }
  .pub-card .target-pick .tp-info { flex-wrap: wrap; }
  .pub-card .flow-group .set-fields .set-field.pair { flex-direction: row !important; align-items: center; flex-wrap: wrap; gap: 8px 14px; }
  .pub-card .flow-group .set-fields .set-field.pair .pair-item { width: auto !important; flex: 0 0 auto !important; }
  .pub-card .flow-group .set-fields .set-field.pair .pair-item.grow { flex: 1 1 100% !important; min-width: 0; }
}


</style>
/* 流程页布局冻结：查重卡单行 8/20、发布卡五列；改前先确认，改后 ui-freeze --update */
