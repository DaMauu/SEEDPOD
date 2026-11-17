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
import { useCrawlScheduler } from '../composables/useCrawlScheduler'
import { useCrawlFlow } from '../composables/useCrawlFlow'
import { useCrawlSites } from '../composables/useCrawlSites'
import { useCrawlFetchFilters } from '../composables/useCrawlFetchFilters'

const clone = x => JSON.parse(JSON.stringify(x || []))
const RULES = (typeof window !== 'undefined' && window.PTA_RULES) || {}
const rules = reactive({
  fetch: clone(RULES.fetch),
  dedupe: clone(RULES.dedupe),
  pub: clone(RULES.pub)
})
const TPL_DEMO = { 电影名: '金瓶双艳', 地区: '港版', 导演: '李翰祥', 主演1: '胡锦', 主演2: '恬妮', 主演3: '陈萍', 音轨: '国语 2.0', 字幕: '中文字幕' }
const SPECIAL = { 发布到: 'target', 中文副标题模板: 'tpl', 排除匹配: 'deny', 测试匹配: 'rx' }

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

const sourceHost = ref('')
const targetHost = ref('')
const busy = reactive({ fetch: false, dedupe: false, pub: false, plan: false, prepare: false })
const { typeRow, loadTypes, saveTypes, saveFilters, prepareNext } = useCrawlFetchFilters({ rules: rules, sourceHost: sourceHost, busy: busy, toast: toast, getJson: getJson })
const { limits, sched, schedText, gates, loadSched, saveSched, toggleSched, setEveryValue, saveLimits, runSched, loadGates, applyGate, toggleGate } = useCrawlScheduler({ getJson: getJson, toast: toast, confirmBox: confirmBox, patchUser: patchUser, targetHost: targetHost, detail: detail })
const { loadFlow, saveFetch, saveScreen, savePub, toggleDetail } = useCrawlFlow({ rules: rules, rx: rx, limits: limits, detail: detail, autoDupe: autoDupe, busy: busy, toast: toast, getJson: getJson, putFlow: putFlow, patchUser: patchUser, saveTypes: saveTypes, saveFilters: saveFilters })
const { plan, showPlan } = useCrawlPlan({ sourceHost: sourceHost, busy: busy, toast: toast })
const { sites, siteStatus, siteCfg, targetOpen, targetQ, siteOptions, targetSite, targetOptions, loadSites, saveSource, pickTarget } = useCrawlSites({ getJson: getJson, patchUser: patchUser, toast: toast, reportError: reportError, loadTypes: loadTypes, loadSched: function () { return loadSched() }, sourceHost: sourceHost, targetHost: targetHost })

const pubGroups = computed(() => (rules.pub || []).map(g => {
  const cells = []
  ;(g.rows || []).forEach(r => {
    const last = cells[cells.length - 1]
    if (r.same && last && last.same === r.same) last.rows.push(r)
    else cells.push({ same: r.same || null, rows: [r] })
  })
  return { name: g.name, cls: g.cls || '', cells }
}))
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

// 页面独立：需要 siteStatus/siteCfg 驱动目标站列表，不能和 Queue 的简化版共用。


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
