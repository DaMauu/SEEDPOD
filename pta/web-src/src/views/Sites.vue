<template>
  <div class="sites-wrap">
    <SitesStats :stats="stats" />

    <SitesToolbar
      :q="q"
      :status-filter="statusFilter"
      :arch-filter="archFilter"
      :login-filter="loginFilter"
      :preset-filter="presetFilter"
      :crawl-filter="crawlFilter"
      :status-tabs="statusTabs"
      :picks-count="picks.length"
      :cookie-count="cookieCount"
      :busy-selfcheck="busy.selfcheck"
      @update:q="q = $event"
      @update:status-filter="statusFilter = $event"
      @update:arch-filter="archFilter = $event"
      @update:login-filter="loginFilter = $event"
      @update:preset-filter="presetFilter = $event"
      @update:crawl-filter="crawlFilter = $event"
      @bulk="openBulk"
      @selfcheck="selfcheckAll"
      @add="openAddSite"
      @pack="packOpen = true"
    />

    <SitesList
      :page-rows="pageRows"
      :sel="sel || ''"
      :picks="picks"
      :all-picked="allPicked"
      :some-picked="somePicked"
      :page="page"
      :pages="pages"
      :filtered-count="filtered.length"
      @open="openSite"
      @pick="togglePick"
      @toggle-all="toggleAll"
      @page="page = $event"
    >
      <template #detail>
        <SiteDetail v-if="selSite" :key="selSite.name + ':' + detailNonce" :site="selSite" @close="clearSelected" @changed="loadAll" @removed="onSiteRemoved" />
      </template>
    </SitesList>

    <SitesModals
      :bulk-open="bulkOpen"
      :picks-count="picks.length"
      :bulk-form="bulkForm"
      :busy-bulk="busy.bulk"
      :add-open="addOpen"
      :add-form="addForm"
      @close-bulk="bulkOpen = false"
      @apply-bulk="applyBulk"
      @close-add="addOpen = false"
      @add="addSite"
    />

    <Teleport to="body">
      <div v-if="packOpen" class="modal-mask" id="site-pack-modal">
        <div class="modal wide">
          <div class="modal-head">
            <h2>站点包与覆盖</h2>
            <button class="btn ghost slim" type="button" @click="packOpen = false">关闭</button>
          </div>
          <div class="modal-scroll pack-modal-body">
            <SitePackPanel />
            <SiteCoveragePanel />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import SitesToolbar from '../components/SitesToolbar.vue'
import SitesStats from '../components/SitesStats.vue'
import SitesModals from '../components/SitesModals.vue'
import SitesList from '../components/SitesList.vue'
import SiteDetail from '../components/SiteDetail.vue'
import SitePackPanel from '../components/SitePackPanel.vue'
import SiteCoveragePanel from '../components/SiteCoveragePanel.vue'
import { reportError } from '../utils/errors'
import { toast, confirmBox, loggedIn, viewVisible, initialsOf } from '../utils/ui'

const PER_PAGE = 13
const baseSites = ref([])
const configs = ref({})
const hidden = ref([])
const presets = ref({})
const defs = ref({})
const creds = ref({})
const crawlState = ref({})
const statusMap = ref({})
const q = ref('')
const statusFilter = ref('all')
const archFilter = ref('all')
const loginFilter = ref('all')
const presetFilter = ref('all')
const crawlFilter = ref('all')
const picks = ref([])
const page = ref(1)
const sel = ref(null)
const detailNonce = ref(0)
const packOpen = ref(false)
const addOpen = ref(false)
const addForm = reactive({ url: '', arch: '?', title: '' })
const busy = reactive({ selfcheck: false, bulk: false })
const bulkOpen = ref(false)
const bulkForm = reactive({ ovr: 'keep', iv: 'keep', det: 'keep', prio: 'keep' })
let loaded = false
let loadBusy = false
let bootTimer = null
let qTimer = null

const sites = computed(() => baseSites.value
  .filter(x => !hidden.value.includes(x.host))
  .map(x => {
    const c = configs.value[x.host] || {}
    const st = statusMap.value[x.host] || null
    const cr = crawlState.value[x.host] || {}
    const cd = creds.value[x.host] || null
    return {
      name: x.host,
      title: x.title || x.host,
      url: c.url || x.url || ('https://' + x.host),
      arch: c.arch || x.arch || '?',
      added: !!x.added,
      enabled: c.enabled !== false,
      mode: c.mode || 'incremental',
      override: !!c.override,
      ovInterval: c.ovInterval == null ? '' : String(c.ovInterval),
      ovDetail: !!c.ovDetail,
      priority: c.priority || 'normal',
      config: c,
      cookieSaved: !!(cd && cd.hasCookie),
      cookieReadable: !!(cd && cd.readable),
      cookieUpdatedAt: (cd && cd.updatedAt) || '',
      login: st ? (st.pass ? 'ok' : 'fail') : 'none',
      loginAt: st ? st.at : '',
      lastAt: Number(cr.lastAt) || 0,
      todayCount: Number(cr.dayCount) || 0,
      preset: presets.value[x.host] || null,
      def: defs.value[x.host] || null
    }
  }))

const selSite = computed(() => sites.value.find(s => s.name === sel.value) || null)

const filtered = computed(() => sites.value.filter(s => {
  if (statusFilter.value === 'on' && !s.enabled) return false
  if (statusFilter.value === 'off' && s.enabled) return false
  if (archFilter.value !== 'all' && (s.arch || '?') !== archFilter.value) return false
  if (loginFilter.value !== 'all' && s.login !== loginFilter.value) return false
  if (presetFilter.value !== 'all') {
    const p = s.preset
    if (presetFilter.value === 'confirmed' && !(p && p.confirmed)) return false
    if (presetFilter.value === 'pending' && !(p && !p.confirmed)) return false
    if (presetFilter.value === 'nocats' && !(p && !p.ids)) return false
  }
  if (crawlFilter.value !== 'all') {
    if (crawlFilter.value === 'crawled' && !s.lastAt) return false
    if (crawlFilter.value === 'never' && s.lastAt) return false
    if (crawlFilter.value === 'today' && !s.todayCount) return false
  }
  const needle = q.value.trim().toLowerCase()
  if (needle && (s.title + ' ' + s.name + ' ' + s.url).toLowerCase().includes(needle) === false) return false
  return true
}))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER_PAGE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))
const statusTabs = computed(() => [
  { v: 'all', label: '全部', n: sites.value.length },
  { v: 'on', label: '启用', n: sites.value.filter(s => s.enabled).length },
  { v: 'off', label: '停用', n: sites.value.filter(s => !s.enabled).length }
])
const allPicked = computed(() => pageRows.value.length > 0 && pageRows.value.every(s => picks.value.includes(s.name)))
const somePicked = computed(() => pageRows.value.some(s => picks.value.includes(s.name)) && !allPicked.value)
const cookieCount = computed(() => sites.value.filter(s => s.cookieSaved).length)
const stats = computed(() => {
  const list = sites.value
  const total = list.length
  const unknown = list.filter(s => s.login === 'none').length
  const count = { NP: 0, UNIT3D: 0, GZ: 0, OTHER: 0, '?': 0 }
  list.forEach(s => {
    const k = ['NP', 'UNIT3D', 'GZ', 'OTHER'].includes(s.arch) ? s.arch : '?'
    count[k]++
  })
  const names = { NP: 'NexusPHP', UNIT3D: 'UNIT3D', GZ: 'Gazelle', OTHER: '其它', '?': '未确认' }
  const colors = { NP: '#4f46e5', UNIT3D: '#6b62e8', GZ: '#8b84ee', OTHER: '#b3adf3', '?': '#c9cedb' }
  const order = ['NP', 'UNIT3D', 'GZ', 'OTHER', '?']
  const segs = order.filter(k => count[k]).map(k => ({ w: total ? (count[k] / total * 100).toFixed(2) : 0, color: colors[k] }))
  const legend = order.filter(k => count[k]).map(k => ({ name: names[k], count: count[k], color: colors[k] }))
  return {
    total: total,
    enabled: list.filter(s => s.enabled).length,
    loginFail: list.filter(s => s.login === 'fail').length,
    unknown: unknown,
    checkedPct: total ? Math.round((total - unknown) / total * 100) : 0,
    segs, legend
  }
})
watch([q, statusFilter, archFilter, loginFilter, presetFilter, crawlFilter], () => { page.value = 1 })
watch(pages, p => { if (page.value > p) page.value = p })
watch(filtered, list => { if (sel.value && !list.some(s => s.name === sel.value)) sel.value = null })
watch(q, () => {
  if (qTimer) clearTimeout(qTimer)
  qTimer = setTimeout(() => { page.value = 1 }, 200)
})

function togglePick(host) {
  const i = picks.value.indexOf(host)
  if (i >= 0) picks.value.splice(i, 1)
  else picks.value.push(host)
}
function toggleAll(on) {
  pageRows.value.forEach(s => {
    const i = picks.value.indexOf(s.name)
    if (on && i < 0) picks.value.push(s.name)
    if (!on && i >= 0) picks.value.splice(i, 1)
  })
}
async function loadAll() {
  if (loadBusy || !loggedIn()) return
  loadBusy = true
  try {
    const [sj, cj, pj, dj, crj, csj] = await Promise.all([
      fetch('/api/sites', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/site-config', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/site-search', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/site-defs', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/credentials', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/crawl/status', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null)
    ])
    if (sj && sj.ok) {
      baseSites.value = Array.isArray(sj.data.sites) ? sj.data.sites : []
      statusMap.value = sj.data.status || {}
    }
    if (cj && cj.ok) {
      configs.value = cj.data.sites || {}
      hidden.value = Array.isArray(cj.data.hidden) ? cj.data.hidden : []
    }
    if (pj && pj.ok && pj.data && typeof pj.data === 'object') presets.value = pj.data
    if (dj && dj.ok) {
      const out = {}
      if (Array.isArray(dj.data)) dj.data.forEach(d => { if (d && d.host) out[d.host] = d })
      else if (dj.data && typeof dj.data === 'object') Object.keys(dj.data).forEach(h => { out[h] = dj.data[h] })
      defs.value = out
    }
    if (crj && crj.ok && Array.isArray(crj.data)) {
      const out = {}
      crj.data.forEach(c => { if (c && c.host) out[c.host] = c })
      creds.value = out
    }
    if (csj && csj.ok && csj.data && csj.data.state) crawlState.value = csj.data.state
    loaded = true
  } catch (e) { reportError('Sites', e) }
  loadBusy = false
}
function ensureSites() {
  if (!viewVisible('sites')) { if (sel.value) sel.value = null; return }
  if (loggedIn()) loadAll()
}
function openSite(host) {
  if (sel.value === host) { sel.value = null; return }
  sel.value = host
  detailNonce.value++
  if (typeof window !== 'undefined' && window.innerWidth <= 900) {
    nextTick(() => {
      const pane = document.querySelector('.sites-detail-pane')
      if (pane && pane.scrollIntoView) pane.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }
}
function openAddSite() { addForm.url = ''; addForm.arch = '?'; addForm.title = ''; addOpen.value = true }
async function addSite() {
  if (!addForm.url.trim()) { toast('先填站点地址'); return }
  try {
    const j = await (await fetch('/api/sites', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: addForm.url.trim(), arch: addForm.arch, title: addForm.title.trim() })
    })).json()
    if (!j || !j.ok) { toast((j && j.error && j.error.message) || '添加失败'); return }
    addOpen.value = false
    await loadAll()
    openSite(j.data.host)
    toast('已添加：' + j.data.host)
  } catch (e) { toast('添加请求发不出去') }
}
function clearSelected() { sel.value = null }
function onSiteRemoved() { sel.value = null; loadAll() }

async function selfcheckAll() {
  if (busy.selfcheck) return
  const hosts = sites.value.filter(s => s.cookieSaved).map(s => s.name)
  if (!hosts.length) { toast('还没有站点存过 cookie'); return }
  busy.selfcheck = true
  let ok = 0, bad = 0
  for (const host of hosts) {
    try {
      const j = await (await fetch('/api/sites/' + encodeURIComponent(host) + '/session-test', { method: 'POST', credentials: 'same-origin' })).json()
      if (j && j.ok && j.data && j.data.pass) ok++
      else bad++
    } catch (e) { bad++ }
  }
  busy.selfcheck = false
  toast('自检完成：可用 ' + ok + ' · 失效 ' + bad)
  await loadAll()
}
function openBulk() {
  if (!picks.value.length) return
  bulkForm.ovr = 'keep'
  bulkForm.iv = 'keep'
  bulkForm.det = 'keep'
  bulkForm.prio = 'keep'
  bulkOpen.value = true
}
async function applyBulk() {
  if (busy.bulk) return
  busy.bulk = true
  let n = 0
  for (const host of picks.value.slice()) {
    const patch = {}
    if (bulkForm.ovr !== 'keep') patch.override = bulkForm.ovr === 'on'
    if (bulkForm.iv !== 'keep') patch.ovInterval = bulkForm.iv
    if (bulkForm.det !== 'keep') patch.ovDetail = bulkForm.det === 'on'
    if (bulkForm.prio !== 'keep') patch.priority = bulkForm.prio
    try {
      const j = await (await fetch('/api/site-config/' + encodeURIComponent(host), {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch)
      })).json()
      if (j && j.ok) n++
    } catch (e) { reportError('Sites', e) }
  }
  busy.bulk = false
  toast('已应用到 ' + n + ' 个站点')
  if (n > 0) { bulkOpen.value = false; picks.value = [] }
  await loadAll()
}
onMounted(() => {
  window.addEventListener('hashchange', ensureSites)
  document.addEventListener('keydown', onKey)
  bootTimer = setInterval(() => { if (!loaded) ensureSites() }, 1500)
  ensureSites()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensureSites)
  document.removeEventListener('keydown', onKey)
  if (bootTimer) clearInterval(bootTimer)
  if (qTimer) clearTimeout(qTimer)
})
function onKey(e) {
  if (e.key !== 'Escape' || !sel.value) return
  const t = e.target && e.target.tagName
  if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || (e.target && e.target.isContentEditable)) return
  clearSelected()
}
</script>

<style scoped>
/* Sites 页面样式：迁入 scoped，shared 组件/shell 保留全局 */
.sites-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.sites-empty { padding: 48px 0; text-align: center; color: var(--muted-2); font-size: 12.5px; }
@media (max-width: 1100px) {
.sites-panel { overflow-x: auto; }
}
.sites-panel { overflow: clip; }
.site-item { display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 10px; cursor: pointer; transition: background .13s ease; }
.site-item + .site-item { margin-top: 2px; }
.site-item:hover { background: #f7f8fa; }
.site-item.on .si-txt b { color: var(--accent); }
.si-txt { flex: 1; min-width: 0; }
.si-txt b { display: block; font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.si-txt span { display: block; margin-top: 2px; font-size: 11px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.site-item .site-pick { width: 14px; height: 14px; flex: 0 0 14px; accent-color: var(--accent); cursor: pointer; opacity: .45; transition: opacity .12s; }
.site-item:hover .site-pick, .site-item .site-pick:checked { opacity: 1; }
.drawer-body-flush .sites-bar { padding: 16px 20px 0; margin-bottom: 12px; }
.drawer-body-flush .sites-bar { padding: 14px 20px 12px; margin-bottom: 0; }
.drawer-body-flush .site-item.on { background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
.drawer-body-flush .sites-bar { flex: 0 0 auto; }
.sites-pager { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
.sites-pager span { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.site-item { padding: 7px 10px; }
.si-txt b { font-size: 12.5px; }
:global(.view[data-view="sites"]) { height: calc(100vh - 150px); display: flex; flex-direction: column; }
.sites-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.sites-wrap .sites-bar { padding: 0; margin-bottom: 0; }
.sites-wrap .site-item { padding: 8px 10px; }
.sites-wrap .site-item + .site-item { margin-top: 1px; }
.sites-wrap .si-txt b { font-size: 13px; }
.sites-wrap .si-txt span { font-size: 11px; }
.sites-panel { background: #fff; border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
.st-head, .site-item {
  display: grid; grid-template-columns: 26px minmax(0, 1fr) 104px 72px 92px 116px 40px;
  align-items: center; gap: 14px; padding: 0 18px;
}
.st-head { height: 34px; background: #fcfcfd; border-bottom: 1px solid var(--line);
  font-size: 11px; color: var(--muted-2); }
.sites-rows { max-height: calc(100vh - 250px); overflow-y: auto; }
.site-item { height: 46px; border-bottom: 1px solid #f4f5f7; cursor: pointer; }
.site-item:last-child { border-bottom: 0; }
.site-item:hover { background: #fafbfd; }
.site-item.on { background: var(--accent-soft); }
.site-item .site-pick { width: 14px; height: 14px; accent-color: var(--accent); }
.si-txt { min-width: 0; }
.si-txt b { display: block; font-size: 12px; font-weight: 600; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.si-txt span { display: block; font-size: 10.5px; color: var(--muted-2); }
.si-arch .chip { font-size: 10px; }
.si-login { font-size: 11.5px; color: var(--muted); }
.si-login.ok { color: var(--green); }
.si-login.bad { color: var(--red); }
.si-mode, .si-last { font-size: 11.5px; color: var(--muted); }
.site-item { height: 42px; }
.sites-wrap { display: flex; flex-direction: column; height: calc(100vh - 150px); }
.sites-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.sites-rows { flex: 1; max-height: none; min-height: 0; overflow-y: auto; }
.st-head, .site-item { grid-template-columns: 28px minmax(0, 1fr) 86px 92px 116px 40px; gap: 16px; padding: 0 22px; }
.site-item .site-pick { margin-right: 2px; }
.st-head, .site-item { grid-template-columns: 28px minmax(0, 1fr) 104px 86px 92px 116px 40px; }
.st-head, .site-item { padding: 0 22px; }
.site-item, .site-item.on { border-radius: 0; }
.st-head { border-bottom: 1px solid var(--line); }
.st-all { display: flex; align-items: center; }
.st-all input { width: 14px; height: 14px; accent-color: var(--accent); }
.si-preset{flex:0 0 58px;font-size:10px;color:#aeb4c2;text-align:center;letter-spacing:.02em}
.si-preset.on{color:var(--accent);font-weight:600}
.site-item .st{flex:0 0 8px;width:8px;justify-content:center}
.site-item .st i{width:7px;height:7px}
.st-head, .site-item{grid-template-columns:26px 10px minmax(0,1fr) 96px 84px 58px 56px 92px;gap:12px}
.site-item .st{justify-self:start}
.sites-pager { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 0; font-size: 12px; color: var(--muted); }
@media (max-width: 900px) {
.st-head { display: none; }
}
@media (max-width: 900px) {
.site-item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 10px 12px; }
}
@media (max-width: 600px) {
.site-item { height: auto; min-height: 46px; }
.site-item .si-mode, .site-item .si-last { display: none; }
.site-item .si-txt { flex: 1 1 120px; }
.site-item .si-txt b { white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.3; }
}
@media (max-width: 900px) {
.site-item > span { font-size: 11.5px; }
}
@media (max-width: 900px) {
.sites-bar .input, .sites-bar .select { max-width: 100%; }
}
@media (max-width: 600px) {
.sites-wrap { height: auto; }
.sites-panel { flex: 0 0 auto; }
.sites-rows { flex: 0 0 auto; max-height: none; overflow: visible; }
}
.pack-modal-body { display: flex; flex-direction: column; gap: 12px; max-height: 70vh; }

/* ===== 右侧站点详情：概览在上、设置在下，占满卡片 ===== */
.sites-wrap :deep(.sites-detail-pane) { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #fff; }
.sites-wrap :deep(.sites-detail-pane .site-expand) { flex: 1; min-height: 0; height: 100%; display: flex; flex-direction: column; padding: 16px 18px 12px; background: #fff; border: 0; border-radius: 0; }
.sites-wrap :deep(.sites-detail-pane .sd-scroll) { display: block; flex: 1; min-height: 0; overflow-y: auto; padding-right: 6px; margin-right: -6px; }
.sites-wrap :deep(.sites-detail-pane .sd-tabs) { grid-column: auto; margin: 8px 0 10px; }
.sites-wrap :deep(.sites-detail-pane .sd-ov) { grid-column: auto; min-width: 0; }
.sites-wrap :deep(.sites-detail-pane .sd-form) { grid-column: auto; margin-top: 0; min-width: 0; }
.sites-wrap :deep(.sites-detail-pane .sd-compact) { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px 16px; align-items: start; }
.sites-wrap :deep(.sites-detail-pane .sd-recent-wrap) { width: auto; max-width: none; justify-self: stretch; }
.sites-wrap :deep(.sites-detail-pane .sd-form .set-fields) { grid-template-columns: 1fr; }
.sites-wrap :deep(.sites-detail-pane .sd-form .set-field) { grid-template-columns: 120px minmax(0, 1fr); }
.sites-wrap :deep(.sites-detail-pane .sd-form .set-field .ctl) { width: 100%; justify-content: flex-start; }
.sites-wrap :deep(.sites-detail-pane .sd-form .set-field .ctl .input),
.sites-wrap :deep(.sites-detail-pane .sd-form .set-field .ctl .select) { width: 100%; }
.sites-wrap :deep(.sites-detail-pane .sd-form-actions) { padding-top: 10px; margin-top: 8px; }
@media (max-width: 900px) {
  .sites-wrap { height: auto; }
  .sites-wrap :deep(.sites-detail-pane .site-expand) { padding: 12px 12px 10px; }
  .sites-wrap :deep(.sites-detail-pane .sd-compact) { grid-template-columns: 1fr; }
}

/* 移动端：站点页不再锁视口高度，详情和页脚按文档流往下排 */
@media (max-width: 900px) {
  :global(.view[data-view="sites"]) { height: auto; display: block; }
  .sites-wrap { height: auto; }
  .sites-wrap :deep(.sites-detail-pane .sd-top) { display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding-right: 0; }
  .sites-wrap :deep(.sites-detail-pane .sd-id) { width: 100%; padding-right: 32px; }
  .sites-wrap :deep(.sites-detail-pane .sd-title-row) { flex-wrap: wrap; }
  .sites-wrap :deep(.sites-detail-pane .sd-actions) { width: 100%; justify-content: flex-start; }
  .sites-wrap :deep(.sites-detail-pane .sheet-x) { position: absolute; top: 12px; right: 12px; }
}
</style>
