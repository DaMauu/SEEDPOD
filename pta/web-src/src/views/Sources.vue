<template>
  <div class="dl-wrap">
    <div class="dl-bar">
      <input v-model="q" class="input" id="dl-q" placeholder="搜标题 / 分辨率" style="width:220px">
      <select v-model="site" class="select slim" id="dl-site">
        <option value="">全部站点</option>
        <option v-for="s in siteOptions" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="type" class="select slim" id="dl-type">
        <option value="">全部类型</option>
        <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="status" class="select slim" id="dl-status" @change="reload">
        <option value="">全部状态</option>
        <option value="new">待筛选</option>
        <option value="selected">已送审</option>
        <option value="published">已发布</option>
        <option value="skipped">跳过</option>
        <option value="archived">归档</option>
      </select>
      <select v-model="mark" class="select slim" id="dl-mark" title="禁转 / 独占 / DIY / 限转 按标题关键词判；未满 7 天按站上发布时间判；都只打标不过滤，点行内标签可手动开关">
        <option value="">全部标记</option>
        <option value="any">有任意标记</option>
        <option value="noRedistribute">禁转</option>
        <option value="exclusive">独占</option>
        <option value="diy">DIY</option>
        <option value="limited">限转</option>
        <option value="limitedDays">未满 7 天</option>
        <option value="existing">已有（重复）</option>
      </select>
      <select v-model="target" class="select slim" id="dl-target" title="向这个目标站查：站里是不是已经有这张原盘">
        <option value="">选目标站</option>
        <option v-for="h in targetHosts" :key="h" :value="h">{{ h }}</option>
      </select>
      <div class="spacer"></div>
      <button class="btn slim" id="dl-dupe" :disabled="busy.dupe" @click="dupeCheck">{{ busy.dupe ? '查重中…' : '向目标站查重' }}</button>
      <button class="btn slim" id="dl-check" :disabled="busy.check" @click="localCheck">{{ busy.check ? '查重中…' : '查重' }}</button>
      <button class="btn slim" id="dl-screen" :disabled="busy.screen" @click="screenAll">按条件送审</button>
      <button class="btn ghost slim" id="dl-archive" :disabled="busy.archive" @click="archiveSkipped">归档已跳过/已有</button>
      <button class="btn ghost slim" id="dl-export" @click="exportJson">导出 JSON</button>
    </div>

    <div class="dl-panel">
      <div class="dl-head">
        <span>标题</span><span>类型</span><span>分辨率</span><span>大小</span><span>入库</span><span>状态</span><span class="ta-r">操作</span>
      </div>
      <div id="dl-body">
        <div v-if="!pageRows.length" class="sites-empty">{{ emptyText }}</div>
        <div v-for="r in pageRows" :key="r.id" class="dl-row" :class="{ 'is-archived': r.status === 'archived' }">
          <span class="dl-title">
            <b>
              <a v-if="r.href" class="t-link" :href="r.href" target="_blank" rel="noopener noreferrer">{{ r.title }}</a>
              <template v-else>{{ r.title }}</template>
            </b>
            <span class="mark-row">
              <i v-if="r.site" class="cat-site">{{ r.site }}</i>
              <i v-if="r.seeders" class="cat-site">做种 {{ r.seeders }}</i>
              <em v-if="r.existing" class="chip warn" :title="r.dupNote || '跟队列/本地库/已发布里的某条重复'">已有</em>
              <template v-if="r.dupe">
                <a v-if="r.dupeUrl" class="chip" :class="dupeTone(r.dupe)" :href="r.dupeUrl" target="_blank" rel="noopener noreferrer" :title="dupeTip(r)">{{ dupeText(r) }}</a>
                <em v-else class="chip" :class="dupeTone(r.dupe)" :title="dupeTip(r)">{{ dupeText(r) }}</em>
              </template>
              <button v-for="k in markKeys" :key="k" class="mark-btn" :class="{ on: r.marks[k] }" type="button" @click="toggleMark(r, k)">{{ markLabel(k, r.marks[k]) }}</button>
            </span>
          </span>
          <span>
            <em v-if="r.type" class="chip np">{{ r.type }}</em>
            <span v-else class="soft">—</span>
          </span>
          <span class="soft">{{ r.res }}</span>
          <span class="soft">{{ r.size }}</span>
          <span class="soft">{{ r.time }}</span>
          <span><span class="badge" :class="r.status === 'published' ? 'green' : r.status === 'selected' ? 'amber' : ''">{{ r.statusTxt }}</span></span>
          <span class="dl-ops">
            <template v-if="r.status === 'archived'">
              <span class="soft">已归档</span>
              <button class="link-btn" type="button" @click="setStatus(r, 'new')">恢复</button>
            </template>
            <template v-else-if="r.status === 'published' || r.status === 'selected'">
              <span class="soft">{{ r.status === 'published' ? '已发布' : '已送审' }}</span>
            </template>
            <template v-else>
              <button class="link-btn" type="button" @click="sendOne(r)">送审</button>
              <button class="link-btn" type="button" @click="setStatus(r, 'archived')">归档</button>
            </template>
          </span>
        </div>
      </div>
      <div class="dl-foot">
        <span>共 <b id="dl-count">{{ countText }}</b> 条</span>
        <div class="spacer"></div>
        <button class="link-btn" id="dl-prev" :disabled="page <= 0" @click="page--">上一页</button>
        <span class="soft" id="dl-page">第 {{ page + 1 }} / {{ pages }} 页</span>
        <button class="link-btn" id="dl-next" :disabled="page >= pages - 1" @click="page++">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { reportError } from '../utils/errors'
import { toast, confirmBox, loggedIn, viewVisible } from '../utils/ui'

const PAGE_SIZE = 100
const LOAD_MAX = 2000
const ST_TXT = { new: '待筛选', selected: '已送审', published: '已发布', skipped: '跳过', archived: '归档' }
const CAT_CN = { movie: '电影', tv: '剧集', show: '综艺', anime: '动漫', doc: '纪录', music: '音乐', sport: '体育', other: '其他' }
const markKeys = ['noRedistribute', 'exclusive', 'diy', 'limited', 'limitedDays']
const MARK_LABEL = { noRedistribute: '禁转', exclusive: '独占', diy: 'DIY', limited: '限转', limitedDays: '未满 7 天' }

const q = ref('')
const site = ref('')
const type = ref('')
const status = ref('')
const mark = ref('')
const target = ref('')
const page = ref(0)
const total = ref(0)
const rowsAll = ref([])
const targetHosts = ref([])
const busy = reactive({ dupe: false, check: false, screen: false, archive: false })
const defs = ref({})
let loaded = false
let bootTimer = null
let loadBusy = false

function matchRes(title) {
  const m = /\b(2160p|1080p|1080i|720p|576p|480p)\b/i.exec(String(title || ''))
  return m ? m[1] : ''
}
function defOf(host) {
  const d = defs.value || {}
  if (d[host]) return d[host]
  const key = Object.keys(d).find(k => k.toLowerCase() === String(host || '').toLowerCase())
  return key ? d[key] : null
}
function catNameOf(host, catId) {
  const d = defOf(host)
  if (!d || !d.cats || !catId) return ''
  let hit = ''
  Object.keys(d.cats).forEach(g => {
    if (hit) return
    if ((d.cats[g] || []).map(String).indexOf(String(catId)) >= 0) hit = CAT_CN[g] || g
  })
  return hit
}
function absUrl(host, p) {
  const raw = String(p || '').trim().replace(/&amp;/g, '&')
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (!host) return ''
  const d = defOf(host)
  const base = (d && d.base) || ('https://' + host)
  let origin = base
  try { origin = new URL(base).origin } catch (e) { origin = base.replace(/\/+$/, '') }
  return origin.replace(/\/+$/, '') + '/' + raw.replace(/^\/+/, '')
}
function mapRow(it) {
  return {
    id: it.id,
    title: it.title,
    site: it.site || '',
    res: it.res || matchRes(it.title),
    size: it.size || '',
    time: it.createdAt ? String(it.createdAt).slice(5, 16).replace('T', ' ') : '',
    status: it.status || '',
    statusTxt: ST_TXT[it.status] || it.status || '',
    marks: it.marks || {},
    type: it.catName || catNameOf(it.site, it.cat) || '',
    detailsUrl: it.detailsUrl || '',
    href: absUrl(it.site, it.detailsUrl),
    seeders: Number(it.seeders) || 0,
    existing: !!(it.marks && it.marks.existing),
    dupNote: it.dupNote || '',
    dupe: it.dupe || '',
    dupeUrl: it.dupeUrl || '',
    dupeTitle: it.dupeTitle || '',
    dupeTarget: it.dupeTarget || '',
    dupeAt: String(it.dupeAt || '').slice(0, 16).replace('T', ' '),
    dupeSizeGB: it.dupeSizeGB || 0
  }
}
async function loadDefs() {
  try {
    const j = await (await fetch('/api/site-defs', { credentials: 'same-origin' })).json()
    if (!j || !j.ok) return
    const out = {}
    if (Array.isArray(j.data)) j.data.forEach(d => { if (d && d.host) out[d.host] = d })
    else if (j.data && typeof j.data === 'object') Object.keys(j.data).forEach(h => { out[h] = j.data[h] })
    defs.value = out
  } catch (e) { reportError('Sources', e) }
}
async function loadTargets() {
  try {
    const j = await (await fetch('/api/credentials', { credentials: 'same-origin' })).json()
    if (!j || !j.ok || !Array.isArray(j.data)) return
    targetHosts.value = j.data.filter(c => c.hasCookie).map(c => c.host).sort()
  } catch (e) { reportError('Sources', e) }
}
async function load() {
  if (loadBusy || !loggedIn()) return
  loadBusy = true
  try {
    const qs = new URLSearchParams({ limit: String(LOAD_MAX) })
    if (status.value) qs.set('status', status.value)
    const j = await (await fetch('/api/catalog?' + qs.toString(), { credentials: 'same-origin' })).json()
    if (!j || !j.ok) return
    rowsAll.value = (j.data.items || []).map(mapRow)
    total.value = Number(j.data.total) || 0
    loaded = true
  } catch (e) { reportError('Sources', e) } finally { loadBusy = false }
}
function ensure() {
  if (viewVisible('sources') && loggedIn()) load()
}
function reload() {
  page.value = 0
  load()
}

const siteOptions = computed(() => Array.from(new Set(rowsAll.value.map(r => r.site).filter(Boolean))).sort())
const typeOptions = computed(() => Array.from(new Set(rowsAll.value.map(r => r.type).filter(Boolean))).sort())

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return rowsAll.value.filter(r => {
    if (needle && (r.title + ' ' + r.res + ' ' + r.site).toLowerCase().indexOf(needle) === -1) return false
    if (site.value && r.site !== site.value) return false
    if (type.value && r.type !== type.value) return false
    if (mark.value) {
      const mk = r.marks || {}
      if (mark.value === 'any') {
        if (!Object.keys(mk).some(k => mk[k])) return false
      } else if (!mk[mark.value]) return false
    }
    return true
  })
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => filtered.value.slice(page.value * PAGE_SIZE, page.value * PAGE_SIZE + PAGE_SIZE))
const countText = computed(() => {
  let t = String(filtered.value.length)
  if (total.value && filtered.value.length !== total.value) t += ' / ' + total.value
  if (total.value > LOAD_MAX) t += '（只读了前 ' + LOAD_MAX + ' 条）'
  return t
})
const emptyText = computed(() => rowsAll.value.length ? '没有匹配的条目' : '数据清单还是空的，去流程页点「抓一页」')

watch([q, site, type, mark], () => { page.value = 0 })
watch(pages, p => { if (page.value > p - 1) page.value = p - 1 })

function markLabel(key, v) {
  if (key === 'limitedDays' && typeof v === 'number' && v > 0) return '未满7天·剩' + v + '天'
  return MARK_LABEL[key]
}
function dupeTone(v) {
  const map = { clean: 'np', diy: 'warn', dupe: 'warn', error: 'warn' }
  return map[v] || 'np'
}
function dupeText(r) {
  const map = { clean: '可发', diy: '仅DIY可发', dupe: '已有原盘', error: '没查成' }
  return (map[r.dupe] || r.dupe) + (r.dupeSizeGB ? ' ' + r.dupeSizeGB + 'GB' : '')
}
function dupeTip(r) {
  return '向 ' + (r.dupeTarget || '目标站') + ' 查过 · ' + (r.dupeAt || '') + (r.dupeTitle ? ' · 命中：' + r.dupeTitle : '')
}
async function toggleMark(r, key) {
  const cur = Object.assign({}, r.marks)
  if (cur[key]) delete cur[key]
  else cur[key] = true
  try {
    const j = await (await fetch('/api/catalog/' + encodeURIComponent(r.id) + '/marks', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ marks: cur })
    })).json()
    if (j && j.ok) { toast('已改标记'); load(); return }
    toast((j && j.error && j.error.message) || '改标记失败')
  } catch (e) { toast('改标记请求发不出去') }
}
async function setStatus(r, next) {
  try {
    const j = await (await fetch('/api/catalog/' + encodeURIComponent(r.id) + '/status', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: next })
    })).json()
    if (j && j.ok) { toast(next === 'archived' ? '已归档' : '已恢复为待筛选'); load(); return }
    toast((j && j.error && j.error.message) || '操作失败')
  } catch (e) { toast('请求发不出去') }
}
async function sendOne(r) {
  try {
    const j = await (await fetch('/api/catalog/screen', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [r.id], limit: 1 })
    })).json()
    if (j && j.ok) {
      const d = j.data || {}
      const why = Object.keys(d.byReason || {})[0]
      toast(d.selected ? '已送进待审核' : ('没送审：' + (why || '条件不符')))
      load()
      if (window.__ptaLoadOverview) window.__ptaLoadOverview()
      return
    }
    toast((j && j.error && j.error.message) || '送审失败')
  } catch (e) { toast('送审请求发不出去') }
}
async function localCheck() {
  if (busy.check) return
  busy.check = true
  try {
    const j = await (await fetch('/api/catalog/check', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 500, host: site.value || '' })
    })).json()
    if (!j || !j.ok) { toast((j && j.error && j.error.message) || '查重失败'); return }
    const d = j.data || {}
    const sample = (d.items || [])[0]
    toast('查重 ' + d.checked + ' 条 · 已有 ' + d.dup + ' 条' + (sample && sample.hit ? '（例：' + String(sample.hit.title).slice(0, 30) + '）' : ''))
    load()
  } catch (e) { toast('查重请求发不出去') }
  busy.check = false
}
async function dupeCheck() {
  if (!target.value) { toast('先在左边选一个目标站（要有 cookie）'); return }
  if (busy.dupe) return
  busy.dupe = true
  try {
    const j = await (await fetch('/api/dupe/check', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: target.value, limit: 3 })
    })).json()
    if (!j || !j.ok) { toast((j && j.error && j.error.message) || '查重失败'); return }
    const d = j.data || {}
    const s = Object.keys(d.byStatus || {}).map(k => k + ' ' + d.byStatus[k]).join(' · ')
    toast('查了 ' + d.checked + ' 条 · ' + (s || '无结果'))
    load()
  } catch (e) { toast('查重请求发不出去') }
  busy.dupe = false
}
function screenAll() {
  confirmBox('按条件送审', (site.value ? '只处理「' + site.value + '」的待筛选词条，' : '') + '会先查重，再按流程页「查重」里的条件送去待审核，不符合的标成跳过。继续？', async () => {
    if (busy.screen) return
    busy.screen = true
    try {
      const j = await (await fetch('/api/catalog/screen', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ limit: 200, host: site.value || '' })
      })).json()
      if (!j || !j.ok) { toast((j && j.error && j.error.message) || '送审失败'); busy.screen = false; return }
      const d = j.data || {}
      const rs = Object.keys(d.byReason || {}).map(k => k + ' ' + d.byReason[k]).join(' · ')
      const rl = d.rules || {}
      const noRule = !(rl.res && rl.res.length) && !rl.minSizeGB && !rl.maxSizeGB && !rl.requireChinese
      toast((noRule ? '还没设筛选条件，按全部通过 · ' : '') + '检查 ' + d.checked + ' 条 · 送审 ' + d.selected + ' · 跳过 ' + d.skipped + (rs ? '（' + rs + '）' : ''))
      load()
      if (window.__ptaLoadOverview) window.__ptaLoadOverview()
    } catch (e) { toast('筛选请求发不出去') }
    busy.screen = false
  })
}
function archiveSkipped() {
  confirmBox('归档跳过/已有', (site.value ? '只处理「' + site.value + '」的' : '') + '跳过项和查重标了「已有」的新词条会一起归档，之后可在行内点「恢复」退回待筛选。继续？', async () => {
    if (busy.archive) return
    busy.archive = true
    try {
      const j = await (await fetch('/api/catalog/bulk', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fromStatus: 'skipped', status: 'archived', includeDup: true, host: site.value || '' })
      })).json()
      toast(j && j.ok ? ('已归档 ' + j.data.changed + ' 条（跳过 + 标已有的）') : ((j && j.error && j.error.message) || '批量归档失败'))
      load()
    } catch (e) { toast('批量归档请求发不出去') }
    busy.archive = false
  })
}
function exportJson() {
  const rows = rowsAll.value
  if (!rows.length) { toast('数据清单还是空的，没有可导出的'); return }
  const url = URL.createObjectURL(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'pta-catalog.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast('已导出 ' + rows.length + ' 条词条')
}

onMounted(() => {
  window.addEventListener('hashchange', ensure)
  bootTimer = setInterval(() => { if (!loaded) ensure() }, 1500)
  loadDefs()
  loadTargets()
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  if (bootTimer) clearInterval(bootTimer)
})
</script>

<style scoped>
.ta-r { text-align: right; }
.dl-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
#dl-body { flex: 1; overflow-y: auto; overflow-x: hidden; }
.dl-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dl-bar .spacer { flex: 1; }
.dl-panel { flex: 1; min-height: 0; background: #fff; border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; }
.dl-head, .dl-row { display: grid; grid-template-columns: minmax(0,1fr) 96px 90px 96px 96px 92px 104px; align-items: center; gap: 14px; padding: 0 22px; }
.dl-head { height: 40px; background: #fcfcfd; border-bottom: 1px solid var(--line); font-size: 11px; color: var(--muted-2); }
.dl-row { min-height: 58px; border-bottom: 1px solid var(--line); }
.dl-row:last-child { border-bottom: 0; }
.dl-row:hover { background: #fafbfd; }
.dl-title b { font-size: 12.5px; font-weight: 500; color: var(--ink); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dl-foot { display: flex; align-items: center; gap: 8px; padding: 10px 22px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
.dl-foot .spacer { flex: 1; }
.dl-row.is-archived { opacity: .55; }
.dl-row.is-archived .dl-title b { text-decoration: line-through; }
.dl-ops { display: flex; align-items: center; justify-content: flex-end; gap: 8px; white-space: nowrap; }
.dl-title .t-link { color: inherit; text-decoration: none; }
.dl-title .t-link:hover { color: var(--accent); text-decoration: underline; }
.mark-row{display:flex;gap:6px;margin-top:4px;align-items:center;flex-wrap:wrap}
.cat-site{font-style:normal;font-size:10.5px;color:#9aa0b0;margin-right:2px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mark-btn{font-size:11px;padding:1px 6px;border-radius:6px;border:1px solid #d8dbe6;background:#fff;color:#8b90a0}
.mark-btn.on{background:#eef0ff;border-color:#b9bdf0;color:#4f46e5}
@media (max-width: 900px) {
.dl-head { display: none; }
}
@media (max-width: 900px) {
.dl-row { display: grid; grid-template-columns: auto auto auto; gap: 4px 10px;
    padding: 10px 12px; align-items: start; }
}
@media (max-width: 900px) {
.dl-row > span:first-child { grid-column: 1 / -1; }
}
@media (max-width: 900px) {
.dl-row .dl-ops { grid-column: 1 / -1; display: flex; gap: 14px; }
}
@media (max-width: 900px) {
.dl-bar { flex-wrap: wrap; gap: 8px; }
}
@media (max-width: 900px) {
.dl-bar .input, .dl-bar .select { max-width: 100%; }
}
@media (max-width: 600px) {
.dl-row { grid-template-columns: minmax(0, 1fr) auto; }
.dl-row > span { min-width: 0; }
.dl-title { overflow: hidden; }
}
@media (max-width: 900px) {
.dl-ops { min-width: 0; max-width: 100%; flex-wrap: wrap; justify-content: flex-start; white-space: normal; }
}

.dl-head { height: 34px; }
.dl-row { min-height: 44px; font-size: 12px; }
.dl-wrap { height: auto; flex: 0 0 auto; width: 100%; }
.dl-panel { flex: 0 0 auto; height: auto; max-height: 620px; }

@media (max-width: 600px) {
.dl-bar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: stretch; }
.dl-bar .spacer { display: none; }
#dl-q { width: 100% !important; grid-column: 1 / -1; }
.dl-bar .select { width: 100%; min-width: 0; }
#dl-target { grid-column: 1 / -1; }
.dl-bar .btn { width: 100%; }
#dl-export { grid-column: 1 / -1; }
}

:global(.view[data-view="sources"]) { height: calc(100vh - 150px); display: flex; flex-direction: column; justify-content: center; }
@media (max-width: 900px) {
  :global(.view[data-view="sources"]) { height: auto; justify-content: flex-start; }
}</style>
