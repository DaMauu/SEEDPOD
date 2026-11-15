<template>
  <div class="drawers">
    <div id="crawl-panel">
      <section class="flow-gates" id="flow-gates">
        <div class="fg-main">
          <span class="fg-title">发布闸门</span>
          <span class="fg-note">自动发布关闭时，只准备/预览，不提交目标站。</span>
        </div>
        <div class="fg-switches">
          <label>真抓取 <button class="switch" id="gate-crawl" :class="{ on: gates.realCrawl }" type="button" role="switch" :aria-checked="String(gates.realCrawl)" @click="toggleGate('realCrawl')"><i></i></button></label>
          <label>自动发布 <button class="switch" id="gate-publish" :class="{ on: gates.realPublish }" type="button" role="switch" :aria-checked="String(gates.realPublish)" @click="toggleGate('realPublish')"><i></i></button></label>
          <label>图床实传 <button class="switch" id="gate-images" :class="{ on: gates.realImages }" type="button" role="switch" :aria-checked="String(gates.realImages)" @click="toggleGate('realImages')"><i></i></button></label>
        </div>
        <div class="fg-actions">
          <button class="btn primary slim" id="flow-prepare" type="button" :disabled="busy.prepare" @click="prepareNext">{{ busy.prepare ? '准备中…' : '准备下一批（不发布）' }}</button>
          <a class="btn ghost slim" href="#queue">去待审核</a>
        </div>
      </section>
      <section class="drawer open vue-card crawl-card">
        <div class="drawer-head">
          <div class="drawer-t"><div class="drawer-title">① 抓取</div></div>
          <div class="drawer-head-right crawl-head-tools">
            <select v-model="sourceHost" class="input slim crawl-source" id="crawl-site" title="从哪个站看抓取计划" @change="saveSource">
              <option value="">选来源站</option>
              <option v-for="s in siteOptions" :key="s.host" :value="s.host">{{ s.title }}</option>
            </select>
            <button class="btn ghost slim" id="crawl-plan-btn" type="button" title="只读本地配置，不发请求" :disabled="busy.plan" @click="showPlan">{{ busy.plan ? '读取中…' : '看地址' }}</button>
            <span class="drawer-meta">{{ fetchSum }}</span>
            <button class="btn primary slim" type="button" :disabled="busy.fetch" @click="saveFetch">{{ busy.fetch ? '保存中…' : '保存' }}</button>
          </div>
        </div>
        <div class="drawer-body">
          <div v-if="plan.on" class="crawl-plan-box" id="crawl-plan-box">
            <div class="crawl-plan-head">
              <b>抓取计划 · {{ plan.host }}</b>
              <span>{{ plan.catGroups }} 组 / {{ plan.catIds }} 个 id</span>
              <button class="btn ghost slim" type="button" @click="plan.on = false">收起</button>
            </div>
            <div class="crawl-plan-note">引擎 {{ plan.engine || '未识别' }} · 间隔至少 {{ plan.interval }} 秒 · 单站每天最多 {{ plan.dailyMax }} 次 · 预估 {{ plan.estimatedQueries }} 次查询</div>
            <div class="crawl-plan-note" id="crawl-plan-today">{{ plan.today }}</div>
            <div v-for="u in plan.urls" :key="u.cat + '-' + u.catId" class="crawl-plan-note crawl-plan-url">GET {{ u.url }}</div>
            <ul v-if="plan.warnings.length" class="crawl-plan-warn">
              <li v-for="(w, i) in plan.warnings" :key="i">{{ w }}</li>
            </ul>
            <em>只读本地配置拼的地址，没有发请求；要抓某一页去站点页点「抓一页」</em>
          </div>
          <div class="preset-block">
            <div v-for="r in fetchRows" :key="r.t" class="preset-row" :class="{ todo: r.todo }">
              <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
              <div class="cat-row pick-row">
                <button v-for="c in (r.chips || [])" :key="c" class="cat-chip" :class="{ on: (r.sel || []).includes(c) }" type="button" :disabled="r.todo" @click="toggleFetchChip(r, c)">{{ c }}</button>
              </div>
            </div>
          </div>
          <div class="limits-panel">
            <div v-for="l in limitItems" :key="l.k" class="limit-item">
              <div class="lbl">{{ l.label }}</div>
              <input v-model.number="limits[l.k]" class="input num" type="number" :min="limitRanges[l.k][0]" :max="limitRanges[l.k][1]" @change="clampLimit(l.k, $event)">
            </div>
          </div>
          <div class="crawl-foot">
            <div class="crawl-note">{{ fetchNote }}</div>
            <label class="detail-sw">
              <span>抓详情页</span>
              <button class="switch" :class="{ on: detail }" type="button" role="switch" :aria-checked="String(detail)" @click="toggleDetail"><i></i></button>
            </label>
          </div>
        </div>
      </section>

      <section class="drawer open vue-card dedupe-card">
        <div class="drawer-head">
          <div class="drawer-t"><div class="drawer-title">③ 查重</div></div>
          <div class="drawer-head-right">
            <span class="drawer-meta">{{ autoDupe ? '自动查重已开' : '自动查重已关' }}</span>
            <button class="btn primary slim" id="crawl-screen-run" type="button" :disabled="busy.screen" @click="screenRun">{{ busy.screen ? '筛选中…' : '按条件筛选' }}</button>
            <button class="btn primary slim" type="button" :disabled="busy.dedupe" @click="saveDedupe">{{ busy.dedupe ? '保存中…' : '保存' }}</button>
          </div>
        </div>
        <div class="drawer-body">
          <div v-for="(g, gi) in rules.dedupe" :key="g.name" class="flow-group" :class="g.cls">
            <div class="flow-ttl">{{ g.name }}</div>
            <div class="set-fields">
              <div v-if="gi === 0" class="set-field">
                <div class="lbl"><span>自动查重</span></div>
                <div class="ctl">
                  <button class="switch" :class="{ on: autoDupe }" type="button" @click="autoDupe = !autoDupe"><i></i></button>
                </div>
              </div>
              <div v-for="r in (g.rows || [])" :key="r.t" class="set-field" :class="{ todo: r.todo }">
                <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
                <div class="ctl"><RuleControl :r="r" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="drawer open vue-card">
        <div class="drawer-head">
          <div class="drawer-t"><div class="drawer-title">③ 初筛</div></div>
          <div class="drawer-head-right">
            <span class="drawer-meta">标题级条件 · 不通过不进队列</span>
            <button class="btn primary slim" type="button" :disabled="busy.fetch" @click="saveFetch">{{ busy.fetch ? '保存中…' : '保存' }}</button>
          </div>
        </div>
        <div class="drawer-body">
          <div class="preset-block">
            <div v-for="r in rxRows" :key="r.t" class="preset-row" :class="{ todo: r.todo }">
              <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
              <div class="ctl"><RuleOrSpecial :r="r" /></div>
            </div>
          </div>
        </div>
      </section>

      <section class="drawer open vue-card pub-card">
        <div class="drawer-head">
          <div class="drawer-t"><div class="drawer-title">发布</div></div>
          <div class="drawer-head-right">
            <button class="btn primary slim" type="button" :disabled="busy.pub" @click="savePub">{{ busy.pub ? '保存中…' : '保存' }}</button>
          </div>
        </div>
        <div class="drawer-body">
          <div v-for="g in pubGroups" :key="g.name" class="flow-group" :class="g.cls">
            <div class="flow-ttl">{{ g.name }}</div>
            <div class="set-fields">
              <template v-for="(cell, ci) in g.cells" :key="cell.same || ci">
                <div v-if="cell.rows.length > 1" class="set-field pair">
                  <div v-for="r in cell.rows" :key="r.t" class="pair-item" :class="{ grow: r.type !== 'switch', todo: r.todo }">
                    <template v-if="r.type === 'switch'">
                      <span class="pair-lbl">{{ r.label || r.t }}<em v-if="r.todo" class="todo-badge">未接</em></span>
                      <button class="switch" :class="{ on: r.on }" type="button" :disabled="r.todo" @click="r.on = !r.on"><i></i></button>
                    </template>
                    <template v-else>
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

    <Nodes />
  </div>

  <Teleport to="body">
    <div v-if="targetOpen" class="modal-mask" id="crawl-target-modal">
      <div class="modal wide">
        <div class="modal-head">
          <h2>选择主站</h2>
          <button class="btn ghost slim" type="button" @click="targetOpen = false">关闭</button>
        </div>
        <p class="modal-sub">发布前会先查这个站有没有同样的资源；只列已启用且自检通过的站。</p>
        <input v-model="targetQ" class="input" placeholder="搜索站点名 / 域名" autocomplete="off">
        <div class="target-list" id="target-list">
          <button v-for="t in targetOptions" :key="t.host" class="target-item" :class="{ on: targetHost === t.host }" type="button" @click="pickTarget(t.host)">
            <span class="ti-name">{{ t.title }}</span>
            <span class="ti-host">{{ t.host }}</span>
          </button>
          <div v-if="!targetOptions.length" class="sites-empty">没有可用的目标站（先在站点页存 cookie 并自检通过）</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, h, onMounted, onUnmounted, reactive, ref } from 'vue'
import { reportError } from '../utils/errors'
import { toast, confirmBox, loggedIn, viewVisible, initialsOf } from '../utils/ui'
import RuleControl from '../components/RuleControl.vue'
import Nodes from './Nodes.vue'

const clone = x => JSON.parse(JSON.stringify(x || []))
const RULES = (typeof window !== 'undefined' && window.PTA_RULES) || {}
const rules = reactive({
  fetch: clone(RULES.fetch),
  dedupe: clone(RULES.dedupe),
  pub: clone(RULES.pub)
})
const TPL_DEMO = { 电影名: '金瓶双艳', 地区: '港版', 导演: '李翰祥', 主演1: '胡锦', 主演2: '恬妮', 主演3: '陈萍', 音轨: '国语 2.0', 字幕: '中文字幕' }
const SPECIAL = { 发布到: 'target', 中文副标题模板: 'tpl', 排除匹配: 'deny', 白名单匹配: 'allow', 测试匹配: 'rx' }

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
const fetchSum = computed(() => {
  let n = 0
  fetchRows.value.forEach(r => { n += (r.sel || []).length })
  return n ? n + ' 项条件' : '跟随默认'
})
const fetchNote = computed(() => '每 ' + limits.interval + ' 秒最多一次 · ' + limits.windowMinutes + ' 分钟内最多 ' + limits.maxPerWindow + ' 次请求')

const rx = reactive({ deny: '', allow: '', sample: '', out: '未测试', outClass: '' })
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
const busy = reactive({ fetch: false, dedupe: false, pub: false, plan: false, prepare: false, screen: false })
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
  return sites.value.filter(s => {
    const cfg = siteCfg.value[s.host] || {}
    if (cfg.enabled === false) return false
    const st = siteStatus.value[s.host]
    if (!st || !st.pass) return false
    return !q || ((s.title || '') + ' ' + s.host).toLowerCase().includes(q)
  }).map(s => ({ host: s.host, title: s.title || s.host }))
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
}
function pickTarget(host) {
  targetHost.value = host
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
  const d = compile(rx.deny), a = compile(rx.allow)
  const deny = hit(rx.deny), allow = hit(rx.allow)
  const msg = deny ? '排除命中，不转载' : (String(rx.allow || '').trim() && !allow ? '白名单未命中，不转载' : '通过，可以转载')
  const warn = d.err || a.err
  rx.out = msg + (warn ? '（' + warn + '）' : '')
  rx.outClass = deny || (String(rx.allow || '').trim() && !allow) ? 'rx-warn' : 'rx-ok'
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
      applySaved(rules.pub, sets.pub)
    }
    if (j.data && j.data.rx) {
      rx.deny = j.data.rx.deny || ''
      rx.allow = j.data.rx.allow || ''
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
    putFlow({ fetch: serialize(rules.fetch) }, { deny: rx.deny, allow: rx.allow })
  ])
  busy.fetch = false
  const bad = [a, b].find(j => !j || !j.ok)
  toast(bad ? ((bad && bad.error && bad.error.message) || '服务端拒绝了这次保存') : '抓取设置已保存')
}
async function saveDedupe() {
  if (busy.dedupe) return
  busy.dedupe = true
  const [a, b] = await Promise.all([
    putFlow({ dedupe: serialize(rules.dedupe) }),
    patchUser({ autoDupe: !!autoDupe.value })
  ])
  busy.dedupe = false
  const bad = [a, b].find(j => !j || !j.ok)
  toast(bad ? ((bad && bad.error && bad.error.message) || '服务端拒绝了这次保存') : '查重设置已保存')
}
async function savePub() {
  if (busy.pub) return
  busy.pub = true
  const j = await putFlow({ pub: serialize(rules.pub) }, { deny: rx.deny, allow: rx.allow })
  busy.pub = false
  toast(j && j.ok ? '发布设置已保存' : ((j && j.error && j.error.message) || '服务端拒绝了这次保存'))
}
async function toggleDetail() {
  detail.value = !detail.value
  const j = await patchUser({ detail: !!detail.value })
  toast(j && j.ok ? (detail.value ? '已开启抓详情页：每条多一次请求' : '已关闭抓详情页') : '开关没存上')
}
async function screenRun() {
  if (busy.screen) return
  busy.screen = true
  const j = await getJson('/api/catalog/screen', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 50, rules: {} })
  })
  busy.screen = false
  if (!j || !j.ok) { toast((j && j.error && j.error.message) || '送审失败'); return }
  const d = j.data || {}
  const rs = Object.keys(d.byReason || {}).map(k => k + ' ' + d.byReason[k]).join(' · ')
  toast('检查 ' + d.checked + ' 条 · 入选 ' + d.selected + ' · 跳过 ' + d.skipped + (rs ? '（' + rs + '）' : ''))
  if (window.__ptaLoadOverview) window.__ptaLoadOverview()
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
    const kids = []
    if (cur) kids.push(h('em', { class: 'tp-ava', id: 'tp-ava' }, initialsOf(cur.title || cur.host)))
    kids.push(h('div', { class: 'tp-info' }, cur
      ? [h('b', { id: 'tp-name' }, cur.title || cur.host), h('span', { id: 'tp-host' }, cur.host)]
      : [h('b', { id: 'tp-name' }, '未选择目标站')]))
    kids.push(h('button', { class: 'btn ghost slim', id: 'tp-change', type: 'button', onClick: () => { targetQ.value = ''; targetOpen.value = true } }, cur ? '更换' : '选择站点'))
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
  if (kind === 'allow') {
    return h('input', { class: 'input', id: 'rx-allow', value: rx.allow, placeholder: '留空不限，命中才转载', onInput: e => { rx.allow = e.target.value } })
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

function ensure() {
  if (!viewVisible('crawl') || !loggedIn()) return
  if (!sites.value.length) loadSites()
  if (!gates.loaded) loadGates()
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
.target-list { max-height: 46vh; overflow-y: auto; margin-top: 12px; }
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
.crawl-card :deep(.preset-row){display:grid;grid-template-columns:68px minmax(0,1fr);align-items:center;gap:14px;padding:7px 0}
.crawl-card :deep(.preset-row .lbl){font-size:12.5px;color:var(--muted,#6b7280);min-width:0}
.crawl-card :deep(.preset-row .cat-row){display:flex;flex-wrap:wrap;gap:6px;padding:0}
.crawl-card :deep(.preset-row .cat-chip){height:28px;padding:0 12px;border-radius:6px;font-size:12px;line-height:28px}
.crawl-card :deep(.limits-panel){display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 18px;margin-top:16px;padding:14px 16px;background:var(--panel-2,#f9fafb);border:1px solid var(--line,#eef0f4);border-radius:10px}
.crawl-card :deep(.limit-item){display:flex;flex-direction:column;gap:6px;min-width:0}
.crawl-card :deep(.limit-item .lbl){font-size:12px;color:var(--muted,#6b7280)}
.crawl-card :deep(.limit-item .input){width:100%;height:32px;padding:0 10px;font-size:13px}
.crawl-card :deep(.crawl-foot){display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px;padding-top:12px;border-top:1px solid var(--line,#eef0f4)}
.crawl-card :deep(.crawl-note){font-size:12px;color:var(--muted-2,#9ca3af);line-height:1.5}
.crawl-card :deep(.detail-sw){display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted,#6b7280);cursor:pointer}
.crawl-card :deep(.detail-sw .switch){flex:0 0 auto}
@media (max-width:1100px) {
.crawl-card :deep(.limits-panel){grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:640px) {
.crawl-card :deep(.preset-row){grid-template-columns:1fr;gap:6px}
}
@media (max-width:640px) {
.crawl-card :deep(.limits-panel){grid-template-columns:1fr}
}
@media (max-width:640px) {
.crawl-card :deep(.crawl-foot){flex-direction:column;align-items:flex-start;gap:10px}
}
.flow-group{background:#f9fafb;border:1px solid #edeff2;border-radius:9px;padding:9px 14px 8px;margin:0 0 8px}
.flow-group :deep(.flow-ttl){font-size:12px;font-weight:600;color:var(--muted);margin:0 0 1px}
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
.dedupe-card :deep(.drawer-body){padding:8px 16px 10px}
@media (max-width:700px) {
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

@media (max-width:900px){.flow-group.cond :deep(.set-field),.flow-group :deep(.set-field.pick){grid-template-columns:1fr;gap:2px}}

/* Crawl 目标站弹窗：页面专属规则，迁入 scoped */
.target-item { display: grid; grid-template-columns: 1fr 150px 76px; gap: 12px; align-items: center; width: 100%; text-align: left; border: 0; background: none; padding: 11px 12px; border-radius: 10px; cursor: pointer; font: inherit; }
.target-item:hover { background: #f7f8fa; }
.target-item.on { background: var(--accent-soft); }
.target-item .chip { justify-self: start; }
#crawl-panel { display: flex; flex-direction: column; gap: 14px; }
#crawl-panel { display: contents; }

/* Crawl 目标站弹窗：页面专属规则，迁入 scoped */
.tp-info { text-align: right; }
.tp-info b { display: block; font-size: 13px; font-weight: 600; color: var(--ink); }
.ti-name { font-size: 13px; font-weight: 600; color: var(--ink); }
.ti-host { font-size: 11.5px; color: var(--muted-2); font-family: var(--mono, monospace); }
.tp-ava { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 9px; display: grid; place-items: center; font-style: normal; font-size: 10.5px; font-weight: 600; background: var(--accent-soft); color: var(--accent); }
.tp-ava.u3d { background: #f3e8ff; color: #7e22ce; }
.tp-ava.gz { background: #ecfeff; color: #0e7490; }
.tp-ava.oth { background: #f1f5f9; color: #64748b; }
.tp-info { text-align: left; margin-right: 6px; }
.tp-info b { display: block; font-size: 14px; font-weight: 600; color: var(--ink); letter-spacing: -.01em; }
.tp-info span { display: block; font-size: 11px; color: var(--muted-2); margin-top: 2px; }

@media (max-width: 600px) {
.target-item { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; }
.ti-name { grid-column: 1; }
.ti-host { grid-column: 1; grid-row: 2; }
.target-item .chip { grid-column: 2; grid-row: 1 / 3; align-self: center; }
}

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
.pub-card .flow-group { background: transparent; border: 0; border-radius: 0; padding: 0; margin: 0 0 16px; }
.pub-card .flow-group:last-child { margin-bottom: 0; }
.pub-card .flow-group .flow-ttl {
  display: flex; align-items: center; gap: 7px;
  margin: 0 0 3px; padding: 0;
  font-size: 13px; font-weight: 650; color: var(--ink); letter-spacing: -.01em;
}
.pub-card .flow-group .flow-ttl::before { content: ''; width: 3px; height: 12px; border-radius: 2px; background: var(--accent); flex: 0 0 auto; }
.pub-card .flow-group .set-fields { display: flex; flex-direction: column; gap: 0; padding-left: 10px; }
.pub-card .flow-group .set-fields .set-field,
.pub-card .flow-group .set-fields .set-field.pick {
  display: grid; grid-template-columns: 200px minmax(0, 1fr);
  align-items: center; gap: 16px;
  padding: 4px 0; margin: 0; border: 0; min-width: 0;
}
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
  display: inline-flex; align-items: center; gap: 8px;
  min-height: 34px; max-width: 100%; padding: 4px 5px 4px 9px;
  border: 1px solid var(--line-2); border-radius: 9px; background: #fff;
}
.pub-card .target-pick.empty { border-style: dashed; background: var(--panel-2); }
.pub-card .target-pick .tp-ava { width: 22px; height: 22px; flex: 0 0 22px; border-radius: 6px; font-size: 9.5px; }
.pub-card .target-pick .tp-info { display: flex; align-items: baseline; gap: 7px; min-width: 0; margin: 0 2px 0 0; text-align: left; }
.pub-card .target-pick .tp-info b { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; }
.pub-card .target-pick.empty .tp-info b { font-weight: 500; color: var(--muted); }
.pub-card .target-pick .tp-info span { font-size: 11px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 760px) {
  .pub-card .flow-group .set-fields { padding-left: 0; }
  .pub-card .flow-group .set-fields .set-field,
  .pub-card .flow-group .set-fields .set-field.pick { grid-template-columns: 1fr; gap: 4px; }
  .pub-card .flow-group .set-fields .set-field .ctl { justify-content: flex-start; flex-wrap: wrap; }
  .pub-card .flow-group .set-fields .set-field .ctl > .input,
  .pub-card .flow-group .set-fields .set-field .ctl > .select { max-width: none; }
  .pub-card .flow-group .set-fields .set-field .pick-row { flex-wrap: wrap; justify-content: flex-start; overflow-x: visible; }
  .pub-card .target-pick { width: 100%; }
  .pub-card .target-pick .tp-info { flex-wrap: wrap; }
}

/* 抓取计划：并入抓取卡，不再单开“本地演练” */
.crawl-head-tools { flex-wrap: wrap; }
.crawl-source { width: 150px; max-width: 180px; height: 28px; font-size: 11.5px; }
.crawl-plan-box { margin: 8px 0 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: #fafbfd; }
.crawl-plan-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.crawl-plan-head b { font-size: 12.5px; color: var(--ink); }
.crawl-plan-head span { font-size: 11px; color: var(--muted); }
.crawl-plan-head .btn { margin-left: auto; height: 24px; padding: 0 8px; font-size: 11px; }
.crawl-plan-note { margin-top: 4px; font-size: 11px; color: var(--muted); line-height: 1.5; }
.crawl-plan-url { word-break: break-all; }
.crawl-plan-warn { margin: 6px 0 0 16px; color: var(--amber); font-size: 11px; }
.crawl-plan-box em { display: block; margin-top: 6px; font-style: normal; font-size: 10.5px; color: var(--muted-2); }
@media (max-width: 900px) {
  .crawl-head-tools { width: 100%; }
  .crawl-source { width: 100%; max-width: none; }
}

/* 发布闸门：默认关，准备/预览不提交 */
.flow-gates { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 18px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; box-shadow: var(--shadow); }
.fg-main { display: flex; flex-direction: column; gap: 2px; min-width: 200px; }
.fg-title { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.fg-note { font-size: 10.5px; color: var(--muted-2); }
.fg-switches { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.fg-switches label { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.fg-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.fg-actions .btn { height: 28px; padding: 0 10px; font-size: 11.5px; white-space: nowrap; }
@media (max-width: 900px) {
  .fg-main { min-width: 100%; }
  .fg-actions { margin-left: 0; width: 100%; }
}
</style>
