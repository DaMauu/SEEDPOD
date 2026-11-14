<template>
  <div class="drawers">
    <div id="crawl-panel">
      <section class="drawer open crawl-dry">
        <div class="drawer-head">
          <div class="drawer-t">
            <div class="drawer-title">本地演练（不发请求）</div>
            <div class="drawer-desc">按设置跑一遍抓取 → 查重 → 发布的步骤，只走本地步骤，不发真实请求。</div>
          </div>
          <div class="drawer-head-right">
            <span class="drawer-meta" id="crawl-dry-meta">{{ dryMeta }}</span>
            <select v-model="sourceHost" class="input slim" id="crawl-site" title="从哪个站抓" @change="saveSource">
              <option value="">选来源站</option>
              <option v-for="s in siteOptions" :key="s.host" :value="s.host">{{ s.title }}</option>
            </select>
            <select v-model="limit" class="input slim" id="crawl-limit" title="这一轮抓多少条词条（是条数，不是页数）" @change="saveLimit">
              <option value="5">5 条（试）</option>
              <option value="10">10 条</option>
              <option value="50">50 条</option>
              <option value="100">100 条</option>
              <option value="200">200 条</option>
            </select>
            <button class="btn ghost slim" id="crawl-plan-btn" title="只读本地配置，不发请求" :disabled="busy.plan" @click="showPlan">{{ busy.plan ? '读取中…' : '看地址' }}</button>
            <button class="btn slim" id="crawl-live-run" :disabled="busy.live" @click="liveRun">{{ busy.live ? '抓取中…' : '抓一页' }}</button>
            <button class="btn primary slim" id="crawl-dry-run" :disabled="busy.dry" @click="dryRun">{{ busy.dry ? '演练中…' : '开始演练' }}</button>
          </div>
        </div>
        <div class="drawer-body" id="crawl-dry-body" :hidden="!plan.on && !dry.on">
          <div class="dl-dry" id="crawl-dry-box">
            <template v-if="dry.on">
              <div class="dl-dry-head"><b>演练 · {{ dry.host }}</b><span class="dl-dry-p">{{ dry.progress }}%</span></div>
              <ul>
                <li v-for="(s, i) in dry.steps" :key="i" :class="s.state === 'done' ? 'done' : 'wait'"><i></i>{{ s.name }}</li>
              </ul>
              <em>只跑本地步骤，不访问任何真实站点</em>
            </template>
            <template v-else-if="plan.on">
              <div class="dl-dry-head"><b>抓取计划 · {{ plan.host }}</b><span class="dl-dry-p">{{ plan.catGroups }} 组 / {{ plan.catIds }} 个 id</span></div>
              <div class="dl-dry-note">引擎 {{ plan.engine || '未识别' }} · 间隔至少 {{ plan.interval }} 秒 · 单站每天最多 {{ plan.dailyMax }} 次 · 预估 {{ plan.estimatedQueries }} 次查询</div>
              <div class="dl-dry-note" id="crawl-plan-today">{{ plan.today }}</div>
              <div v-for="u in plan.urls" :key="u.cat + '-' + u.catId" class="dl-dry-note" style="word-break:break-all">
                GET {{ u.url }}
              </div>
              <ul v-if="plan.warnings.length" class="dl-dry-warn">
                <li v-for="(w, i) in plan.warnings" :key="i">{{ w }}</li>
              </ul>
              <em>只是读出本地配置拼的地址，没有发请求；抓一页会按类目轮转</em>
            </template>
            <em v-else>还没跑过</em>
          </div>
        </div>
      </section>

      <section class="drawer open vue-card crawl-card">
        <div class="drawer-head">
          <div class="drawer-t"><div class="drawer-title">抓取</div></div>
          <div class="drawer-head-right">
            <span class="drawer-meta">{{ fetchSum }}</span>
            <button class="btn primary slim" type="button" :disabled="busy.fetch" @click="saveFetch">{{ busy.fetch ? '保存中…' : '保存' }}</button>
          </div>
        </div>
        <div class="drawer-body">
          <div class="preset-block">
            <div v-for="r in fetchRows" :key="r.t" class="preset-row" :class="{ todo: r.todo }">
              <div class="lbl"><span>{{ r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
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
          <div class="drawer-t"><div class="drawer-title">查重</div></div>
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
                <div class="lbl"><span>{{ r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
                <div class="ctl"><RuleControl :r="r" /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="drawer open vue-card">
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
                      <span class="pair-lbl">{{ r.t }}<em v-if="r.todo" class="todo-badge">未接</em></span>
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
                  <div class="lbl"><span>{{ cell.rows[0].t }}</span><em v-if="cell.rows[0].todo" class="todo-badge">未接</em></div>
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
const limit = ref('100')
const targetHost = ref('')
const targetOpen = ref(false)
const targetQ = ref('')
const dryMeta = ref('未运行')
const plan = reactive({ on: false, host: '', urls: [], warnings: [], dailyMax: 0, interval: 0, engine: '', catGroups: 0, catIds: 0, estimatedQueries: 0, today: '' })
const dry = reactive({ on: false, host: '', progress: 0, steps: [], done: false })
const busy = reactive({ fetch: false, dedupe: false, pub: false, plan: false, live: false, dry: false, screen: false })
let dryTimer = null

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
function saveLimit() {
  try { localStorage.setItem('pta.crawlLimit', limit.value) } catch (e) { reportError('Crawl', e) }
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
    putFlow({ fetch: serialize(rules.fetch) })
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
    limit.value = localStorage.getItem('pta.crawlLimit') || '100'
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
  dry.on = false
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

async function liveRun() {
  if (!sourceHost.value) { toast('先在右上角「选来源站」里挑一个站'); return }
  if (busy.live) return
  busy.live = true
  dryMeta.value = '正在抓 ' + sourceHost.value + ' …'
  const j = await getJson('/api/crawl/run', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ host: sourceHost.value, limit: Number(limit.value) || 100, dryRun: false })
  })
  busy.live = false
  if (!j || !j.ok) {
    const code = j && j.error && j.error.code
    let msg = (j && j.error && j.error.message) || '抓取失败'
    if (code === 'NO_COOKIE' || code === 'LOGIN_REQUIRED') msg += '：去站点页的「登录」页签把这个站的 cookie 存进来'
    dryMeta.value = msg
    toast(msg)
    return
  }
  const d = j.data || {}
  const line = '第 ' + d.page + ' 页 · 抓回 ' + d.rows + ' 行 · 新增 ' + d.added + ' · 更新 ' + d.updated +
    (d.daily ? ' · 今日第 ' + d.daily.count + ' 次' : '') + (d.nextPage ? ' · 下次第 ' + d.nextPage + ' 页' : '')
  dryMeta.value = line
  toast(line)
  if (window.__ptaLoadOverview) window.__ptaLoadOverview()
}

function stopDry() {
  if (dryTimer) { clearInterval(dryTimer); dryTimer = null }
  busy.dry = false
}
async function dryRun() {
  if (!sourceHost.value) { toast('先在右上角「选来源站」里挑一个站，再开始演练'); return }
  if (busy.dry) return
  busy.dry = true
  const j = await getJson('/api/tasks', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'crawl', siteHost: sourceHost.value, dryRun: true })
  })
  if (!j || !j.ok) {
    busy.dry = false
    toast((j && j.error && j.error.message) || '提交演练失败')
    return
  }
  dry.on = true
  plan.on = false
  dry.host = sourceHost.value
  dry.progress = 0
  dry.done = false
  dry.steps = (j.data.steps || []).map(s => ({ name: s.name, state: s.state }))
  dryMeta.value = '0%'
  const id = j.data.id
  if (dryTimer) clearInterval(dryTimer)
  dryTimer = setInterval(async () => {
    const t = await getJson('/api/tasks/' + encodeURIComponent(id))
    if (!t || !t.ok) { stopDry(); toast('任务查询失败'); return }
    const d = t.data || {}
    dry.progress = d.progress || 0
    dry.steps = (d.steps || []).map(s => ({ name: s.name, state: s.state }))
    dry.done = d.state === 'done'
    dryMeta.value = d.state === 'done' ? '已完成' : dry.progress + '%'
    if (['done', 'failed', 'canceled'].indexOf(d.state) >= 0) {
      stopDry()
      toast(d.state === 'done' ? '演练完成 · ' + dry.steps.length + ' 步' : '演练中断：' + d.state)
    }
  }, 400)
}
async function loadLastDry() {
  const j = await getJson('/api/tasks')
  if (!j || !j.ok || !Array.isArray(j.data)) return
  const list = j.data.filter(t => t && t.dryRun && t.type === 'crawl')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  const last = list[0]
  if (!last) return
  const when = String(last.createdAt || '').slice(5, 16).replace('T', ' ')
  dryMeta.value = '上次 ' + when + ' · ' + (last.state === 'done' ? '完成' : last.state)
  dry.on = true
  dry.host = last.siteHost || ''
  dry.progress = last.progress || 0
  dry.done = last.state === 'done'
  dry.steps = (last.steps || []).map(s => ({ name: s.name, state: s.state }))
}

const RuleOrSpecial = (props) => {
  const r = props.r
  const kind = specialOf(r)
  if (kind === 'target') {
    return h('div', { class: 'target-pick' }, [
      h('em', { class: 'tp-ava', id: 'tp-ava' }, targetSite.value ? initialsOf(targetSite.value.title || targetSite.value.host) : '?'),
      h('div', { class: 'tp-info' }, [
        h('b', { id: 'tp-name' }, targetSite.value ? (targetSite.value.title || targetSite.value.host) : '未选择'),
        h('span', { id: 'tp-host' }, targetSite.value ? targetSite.value.host : '')
      ]),
      h('button', { class: 'btn ghost slim', id: 'tp-change', type: 'button', onClick: () => { targetQ.value = ''; targetOpen.value = true } }, '更换')
    ])
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

function ensure() {
  if (!viewVisible('crawl') || !loggedIn()) return
  if (!sites.value.length) loadSites()
  loadFlow()
}
onMounted(() => {
  window.addEventListener('hashchange', ensure)
  ensure()
  loadLastDry()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  stopDry()
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
.drawers .drawer-body, .drawers :deep(.drawer-body) { padding: 2px 22px 10px; }</style>
