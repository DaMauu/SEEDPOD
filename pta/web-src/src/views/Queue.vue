<template>
  <div class="queue-bar">
    <div class="seg-tabs" id="queue-tabs">
      <button v-for="t in tabs" :key="t.v" type="button" :class="{ active: tab === t.v }" @click="setTab(t.v)">{{ t.label }}</button>
    </div>
    <input v-model="q" class="input slim" id="queue-q" placeholder="搜标题 / 中文名" style="width:220px" @input="debounced">
    <div class="spacer"></div>
    <span v-if="tab !== 'failed'" class="t-sub" id="queue-count">共 {{ matched }} 条</span>
    <button v-if="tab !== 'failed'" class="btn ghost slim" id="q-bulkapprove" type="button" :disabled="busy.approve" @click="bulkApprove">全部批准</button>
    <button v-if="tab !== 'failed'" class="btn ghost slim" id="q-bulkpublish" type="button" :disabled="busy.publish" @click="bulkPublish">全部发布</button>
  </div>

  <div class="queue-split">
    <aside class="queue-list">
      <QueueFailures v-if="tab === 'failed'" :q="q" :active-id="sel ? sel.id : ''" :reload-key="failReload" @select="select" @replayed="onFailuresReplayed" />
      <div v-else class="queue-items" id="queue-items">
        <div v-if="!items.length" class="sites-empty">没有匹配的条目</div>
        <button v-for="it in items" :key="it.id" class="q-item" :class="{ on: sel && sel.id === it.id }" type="button" @click="select(it.id)">
          <span class="q-title">
            <b>{{ it.title }}</b>
            <i>{{ sub(it) }}</i>
          </span>
          <span class="badge" :class="statusTone(it.status)">{{ label(it.status) }}</span>
        </button>
      </div>
      <div v-if="tab !== 'failed'" class="queue-page">
        <div class="queue-pager">
          <span class="pager-link" :class="{ off: page <= 1 }" @click="page > 1 && loadQueuePage(page - 1)">上一页</span>
          <span class="pager-meta" :title="'第 ' + page + ' / ' + pages + ' 页 · 共 ' + matched + ' 条'">{{ page }}/{{ pages }} 页 · {{ matched }} 条</span>
          <span class="pager-link" :class="{ off: page >= pages }" @click="page < pages && loadQueuePage(page + 1)">下一页</span>
        </div>
      </div>
    </aside>

    <div class="queue-detail" id="queue-detail">
      <div v-if="!sel" class="sites-empty">选一条看发布预览</div>
      <div v-else class="qd-body">
        <div class="qd-head">
          <div class="qd-id">
            <div class="qd-title-row">
              <h2>{{ sel.cn || sel.title }}</h2>
              <span class="badge" :class="statusTone(sel.status)">{{ label(sel.status) }}</span>
            </div>
            <span class="sd-url">{{ sel.title }}</span>
          </div>
          <div class="qd-meta">
            <span>来源站 <b>{{ sel.site || '—' }}</b></span>
            <span>分辨率 <b>{{ sel.res || '' }}</b></span>
            <span>大小 <b>{{ sel.size || '' }}</b></span>
            <span>年份 <b>{{ (sel.year || '—') + ' · ' + (sel.imdb || '') }}</b></span>
          </div>
        </div>

        <div class="qd-scroll">
        <div v-if="sel.stage" class="qd-stage">
          <span class="badge" :class="stageTone(sel.stage)">{{ stageLabel(sel.stage) }}</span>
          <span class="t-sub">尝试 {{ sel.stageAttempts || 0 }}</span>
          <span v-if="sel.stageNextRetryAt" class="t-sub">下次重试 {{ stageTime(sel.stageNextRetryAt) }}</span>
          <span v-if="sel.stageLastError" class="qd-stage-err">{{ sel.stageLastError }}</span>
          <button v-if="sel.stage === 'failed'" class="btn ghost slim" type="button" @click.stop="retryStage">重试</button>
        </div>

        <div v-if="sel.targetResults && Object.keys(sel.targetResults).length" class="qd-target-results">
          <div v-for="(tr, host) in sel.targetResults" :key="host" class="qd-target-result">
            <span class="badge" :class="targetTone(tr.stage)">{{ host }}</span>
            <span class="t-sub">{{ stageLabel(tr.stage) }}</span>
            <span v-if="tr.error" class="qd-stage-err">{{ tr.error }}</span>
            <button v-if="tr.stage === 'failed'" class="btn ghost slim" type="button" @click.stop="retryTarget(host)">重试</button>
          </div>
        </div>

        <section class="sd-card qd-pubinfo">
          <div class="qd-pub-head">
            <h3>发布信息</h3>
            <label class="qd-anon"><input v-model="form.anonymous" type="checkbox"> 匿名发布</label>
          </div>
          <div class="qd-field">
            <span>目标站</span>
            <select v-model="form.targetSite" class="input" @change="onTargetSiteChange">
              <option value="">未选择</option>
              <option v-if="form.targetSite && !sites.some(s => s.name === form.targetSite)" :value="form.targetSite">{{ form.targetSite }}</option>
              <option v-for="s in sites" :key="s.name" :value="s.name">{{ s.title || s.name }}</option>
            </select>
          </div>
          <div class="qd-field">
            <span>标题</span>
            <div class="qd-control"><input v-model="form.title" class="input"></div>
            <button class="btn ghost slim qd-action-btn" type="button" title="只回填标题：源种里只有文件名；副标题和简介来自源站页面" @click="fillSourceTitle">回填源标题</button>
          </div>
          <div class="qd-field">
            <span>副标题</span>
            <div class="qd-control">
              <input v-model="form.cn" class="input">
              <div v-if="metaMsg" class="t-sub qd-meta-msg">{{ metaMsg }}</div>
            </div>
            <button class="btn ghost slim qd-action-btn" type="button" :disabled="metaBusy" title="用公开元数据拼副标题和简介" @click="fetchMeta">{{ metaBusy ? '查询中…' : '查资料' }}</button>
          </div>
          <div class="qd-field">
            <span>图床</span>
            <select v-model="form.imageHost" class="input">
              <option v-for="h in hosts" :key="h">{{ h }}</option>
            </select>
          </div>
          <div class="qd-field qd-field-top">
            <span>简介</span>
            <div class="qd-control qd-desc-control">
              <textarea v-model="form.intro" class="input sd-note" rows="4"></textarea>
              <div v-if="prepMsg" class="t-sub">{{ prepMsg }}</div>
              <div v-if="preflight && preflight.media" class="t-sub">媒体信息：已从源站简介识别 {{ preflight.media.kind === 'bdinfo' ? 'BDInfo' : 'MediaInfo' }} · {{ preflight.media.summary }}</div>
              <details v-if="sel.prepared && sel.prepared.description" class="qd-final-desc">
                <summary>最终简介预览（发布时用这份）</summary>
                <pre>{{ sel.prepared.description }}</pre>
              </details>
            </div>
            <button class="btn ghost slim qd-action-btn" type="button" :disabled="prepBusy" title="用当前标题/简介和源站媒体信息生成最终发布内容" @click="prepareRelease">{{ prepBusy ? '整理中…' : '整理发布资料' }}</button>
          </div>
        </section>

        <div v-if="sel.qb || sel.sourceState" class="t-sub qd-download">qB：{{ qbText() }}</div>
        <QueuePreflight v-if="preflight" :preflight="preflight" />
        <div v-if="pubNote(sel)" class="qd-status" :class="sel.status === 'failed' ? 'bad' : 'ok'">{{ pubNote(sel) }}</div>
        <div v-if="sel.targetUpload" class="qd-status" :class="sel.targetVerify && sel.targetVerify.found ? 'ok' : ''">
          目标站 {{ sel.targetUpload.host }} · {{ sel.targetUpload.message || '已提交' }}
          <a v-if="sel.targetUpload.detailsUrl" :href="sel.targetUpload.detailsUrl" target="_blank" rel="noopener noreferrer">详情</a>
          <span v-if="verifyOf(sel)"> · 回查：{{ verifyOf(sel).found ? '已找到' : '未找到' }}</span>
        </div>

        </div>

        <div v-if="sites.length > 1" class="qd-targets-foot">
          <span class="qd-targets-lbl">同时发布到</span>
          <div class="pick-row qd-target-chips">
            <label v-for="s in sites" :key="s.name" class="cat-chip" :class="{ on: form.targets.includes(s.name) }" :title="s.name">
              <input type="checkbox" :value="s.name" v-model="form.targets" class="qd-target-check">
              {{ s.title || s.name }}
            </label>
          </div>
        </div>
        <div class="qd-actions">
          <button class="btn primary slim" type="button" :disabled="busy.act || downloadReady()" title="从源站取种，加入 qB 开始下载" @click="act('download')">{{ downloadReady() ? '已下载' : '下载种子' }}</button>
          <button class="btn ghost slim" type="button" :disabled="busy.target || !form.targetSite || !downloadReady()" :title="downloadReady() ? '真实提交到目标站' : '先下载种子并等 qB 100%'" @click="submitTarget">{{ busy.target ? '提交中…' : '发布到目标站' }}</button>
          <button v-if="sel.status === 'rejected'" class="btn primary slim" type="button" :disabled="busy.act" title="清掉驳回理由，放回待确认" @click="act('retry')">重新送审</button>
          <button v-else class="btn ghost slim" type="button" :disabled="busy.act" @click="act('reject')">驳回</button>
          <div class="spacer"></div>
          <input v-model="reason" class="input slim" placeholder="驳回理由（必填）" style="width:200px">
          <button class="btn ghost slim" type="button" :disabled="busy.act" @click="act('skip')">跳过</button>
          <button v-if="sel.status !== 'published'" class="btn ghost slim danger" type="button" :disabled="busy.remove" @click="removeItem">{{ busy.remove ? '删除中…' : '删除' }}</button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="lock.open" class="modal-mask" id="main-target-lock">
    <div class="modal">
      <div class="modal-head"><h2>主站真实提交</h2></div>
      <p class="modal-sub">主站不是测试站。请输入目标域名 <b>{{ lock.host }}</b> 确认：</p>
      <input v-model="lock.typed" class="input" :placeholder="lock.host" autocomplete="off">
      <div class="modal-foot">
        <button class="btn ghost slim" type="button" @click="lock.open = false; lock.typed = ''">取消</button>
        <button class="btn primary slim" type="button" :disabled="lock.typed.trim() !== lock.host" @click="confirmLock">确认提交</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { reportError } from '../utils/errors'
import { apiJson, errorText, qs } from '../utils/api'
import { stageTime } from '../utils/format'
import { toast, loggedIn, viewVisible, confirmBox } from '../utils/ui'
import QueueFailures from '../components/QueueFailures.vue'
import QueuePreflight from '../components/QueuePreflight.vue'

const tabs = [
  { v: 'all', label: '全部' },
  { v: 'pending', label: '待确认' },
  { v: 'approved', label: '已通过' },
  { v: 'failed', label: '失败' }
]
const hosts = ['站内', 'Pixhost', 'Imgbox', '本地图床']
const tab = ref('all')
const q = ref('')
const page = ref(1)
const pages = ref(1)
const matched = ref(0)
const items = ref([])
const sel = ref(null)
const sites = ref([])
const reason = ref('')
const form = reactive({ title: '', cn: '', intro: '', targetSite: '', targets: [], imageHost: '站内', anonymous: false })
const busy = reactive({ act: false, approve: false, publish: false, target: false, remove: false })
const lock = reactive({ open: false, host: '', hosts: [], targets: [], typed: '', fn: null })
const prepBusy = ref(false)
const prepMsg = ref('')
const preflight = ref(null)
const failReload = ref(0)
const metaBusy = ref(false)
const metaMsg = ref('')
let previewSeq = 0
let metaSeq = 0
let selectSeq = 0
let queueSeq = 0
let timer = null
let qTimer = null
let progressTimer = null
let loaded = false

const LABELS = {
  pending: ['待确认', 'amber'], approved: ['已通过', 'green'], published: ['已发布', 'green'],
  failed: ['失败', 'red'], rejected: ['已驳回', 'gray'], skipped: ['已跳过', 'gray'], dupe: ['重复', 'amber']
}
function label(s) { return (LABELS[s] || ['未知', 'gray'])[0] }
function statusTone(s) { return (LABELS[s] || ['未知', 'gray'])[1] }
const STAGE_LABEL = { draft: '草稿', prepared: '已准备', previewed: '已预览', submitted: '已提交', injected: '已注入', failed: '失败', skipped: '已跳过' }
const STAGE_TONE = { prepared: 'blue', previewed: 'amber', submitted: 'blue', injected: 'green', failed: 'red', skipped: 'gray' }
function stageLabel(s) { return STAGE_LABEL[s] || s || '草稿' }
function stageTone(s) { return STAGE_TONE[s] || '' }
function targetTone(s) { return STAGE_TONE[s] || '' }
function retryTarget(host) {
  if (!/^(test[.-]|127\.0\.0\.1$|localhost$)/i.test(host)) {
    lock.open = true; lock.host = host; lock.hosts = [host]; lock.targets = [host]; lock.typed = ''
    lock.fn = function () { doRetryTarget(host, [host]) }
    return
  }
  doRetryTarget(host)
}
async function doRetryTarget(host, confirmed) {
  if (!sel.value || busy.target) return
  const id = sel.value.id
  busy.target = true
  try {
    const body = { queueId: id, targets: [host], dryRun: false, confirmHosts: Array.isArray(confirmed) ? confirmed : [] }
    const { body: j } = await apiJson('/api/queue/' + encodeURIComponent(id) + '/targets/upload', { method: 'POST', body: body })
    toast(j && j.ok ? '目标站重试完成' : errorText(j, '重试失败'))
    await refresh()
  } catch (e) { reportError('Queue.retryTarget', e); toast('重试请求发不出去') } finally { busy.target = false }
}
function verifyOf(item) {
  if (!item) return null
  const host = String((item.targetUpload && item.targetUpload.host) || '').toLowerCase()
  const byHost = item.targetVerifyByHost || {}
  if (host && byHost[host]) return byHost[host]
  /* 没有 host 时只有单目标才能沿用旧字段，多目标不能用别人的回查结果 */
  const targets = Array.isArray(item.targets) && item.targets.length ? item.targets : (item.targetSite ? [item.targetSite] : [])
  return targets.length <= 1 ? (item.targetVerify || null) : null
}
function removeItem() {
  if (!sel.value || busy.remove) return
  const id = sel.value.id
  const title = sel.value.cn || sel.value.title || id
  confirmBox('删除条目', '只删面板里的队列记录，不动目标站和下载器里的种子。确定删除「' + title + '」？', async function () {
    busy.remove = true
    try {
      const r = await fetch('/api/queue/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
      const j = await r.json().catch(function () { return null })
      if (!r.ok || !j || !j.ok) { toast((j && j.error && j.error.message) || '删除失败'); return }
      const ce = (j.data && j.data.cleanupErrors) || []
      toast('已删除' + (ce.length ? '，缓存清理失败 ' + ce.length + ' 个' : ''))
      sel.value = null
      failReload.value++
      await loadQueuePage()
    } catch (e) { reportError('Queue.remove', e); toast('删除请求发不出去') } finally { busy.remove = false }
  })
}
async function retryStage() {
  if (!sel.value) return
  const id = sel.value.id
  try {
    const { body: j } = await apiJson('/api/queue/' + encodeURIComponent(id) + '/advance', { method: 'POST', body: {} })
    if (!j || !j.ok) { toast(errorText(j, '重试失败')); return }
    toast(j.data.next ? '下一步：' + j.data.next : '阶段：' + stageLabel(j.data.stage))
    await refresh()
  } catch (e) { reportError('Queue.retryStage', e); toast('重试请求发不出去') }
}
function sub(it) {
  return (it.cn ? it.cn + ' · ' : '') + (it.res || '') + ' · ' + (it.size || '') + (it.targetSite ? ' · 目标 ' + it.targetSite : '')
}
// 页面独立：队列只需要站点列表给下拉，不加载状态/配置。
async function loadSites() {
  try {
    const { body: j } = await apiJson('/api/targets')
    const list = (j && j.ok && Array.isArray(j.data)) ? j.data.filter(t => t.hasCookie) : []
    if (list.length) sites.value = list.map(t => ({ name: t.host, title: t.host }))
    else {
      const { body: s } = await apiJson('/api/sites')
      if (s && s.ok && s.data) sites.value = (s.data.sites || []).map(function (x) { return { name: x.host, title: x.title || x.host } })
    }
  } catch (e) { reportError('Queue', e) }
}
async function loadQueuePage(p) {
  if (!loggedIn()) return
  if (tab.value === 'failed') return
  if (p) page.value = p
  const status = tab.value === 'all' ? '' : tab.value === 'approved' ? 'approved,published' : tab.value
  const query = qs({ limit: 50, offset: (page.value - 1) * 50, status: status, q: q.value.trim() })
  const seq = ++queueSeq
  try {
    const { body: j } = await apiJson('/api/queue?' + query)
    if (seq !== queueSeq) return
    if (!j || !j.ok) { toast(errorText(j, '队列加载失败')); return }
    items.value = j.data.items || []
    matched.value = Number(j.data.matched) || 0
    pages.value = Math.max(1, Math.ceil(matched.value / 50))
    if (page.value > pages.value) page.value = pages.value
    loaded = true
    if (!sel.value || !items.value.some(x => x.id === sel.value.id)) {
      if (items.value.length) select(items.value[0].id)
      else sel.value = null
    }
  } catch (e) { reportError('Queue', e) }
}
async function select(id) {
  const seq = ++selectSeq
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
  try {
    const { body: j } = await apiJson('/api/queue/' + encodeURIComponent(id))
    if (!j || !j.ok) return
    if (seq !== selectSeq) return
    sel.value = j.data
    prepBusy.value = false
    prepMsg.value = ''
    form.title = j.data.title || ''
    form.cn = j.data.cn || ''
    form.intro = j.data.intro || ''
    form.targetSite = j.data.targetSite || ''
    form.targets = mergeTargets(j.data.targetSite, j.data.targets)
    form.imageHost = j.data.imageHost || '站内'
    form.anonymous = !!j.data.anonymous
    reason.value = ''
    metaSeq++
    metaBusy.value = false
    metaMsg.value = ''
    await loadPreview()
  } catch (e) { reportError('Queue', e) }
}
function setTab(v) { tab.value = v; page.value = 1; loadQueuePage(1) }
function debounced() {
  if (qTimer) clearTimeout(qTimer)
  qTimer = setTimeout(() => { page.value = 1; loadQueuePage(1) }, 300)
}
async function fillSourceTitle() {
  if (!sel.value) return
  const id = sel.value.id
  const { body: j } = await apiJson('/api/queue/' + encodeURIComponent(id) + '/fill-source-title', { method: 'POST' })
  if (j && j.ok) { toast('标题已回填：' + j.data.title); await refresh() }
  else toast(errorText(j, '回填失败'))
}
async function refresh() {
  if (tab.value === 'failed') {
    failReload.value++
    if (sel.value) await select(sel.value.id)
    return
  }
  if (sel.value) await select(sel.value.id)
  await loadQueuePage()
}
function onFailuresReplayed() {
  if (sel.value) select(sel.value.id)
}
function stillSelected(id) { return !!(sel.value && sel.value.id === id) }
async function apiAction(body, onlyId) {
  const id = String(onlyId || (sel.value && sel.value.id) || '')
  return apiJson('/api/queue/' + encodeURIComponent(id) + '/action', { method: 'POST', body: body })
}
async function loadPreview() {
  if (!sel.value) { preflight.value = null; return }
  const id = sel.value.id
  const host = form.targetSite || sel.value.targetSite || ''
  const seq = ++previewSeq
  try {
    const q = host ? '?host=' + encodeURIComponent(host) : ''
    const { body: j } = await apiJson('/api/queue/' + encodeURIComponent(id) + '/publish-preview' + q)
    if (seq !== previewSeq || !sel.value || sel.value.id !== id) return
    preflight.value = j && j.ok ? j.data : null
  } catch (e) {
    if (seq === previewSeq) preflight.value = null
  }
}
function pubNote(q) {
  const m = String((q && q.pubMsg) || '')
  return /^演练：/.test(m) ? '' : m
}
function injectNote(q) {
  return String((q && q.injectPlan && q.injectPlan.message) || '').replace(/^演练：/, '')
}
async function saveFields(onlyId) {
  const id = String(onlyId || (sel.value && sel.value.id) || '')
  if (!id) return { ok: false, error: { message: '没选中条目' } }
  try {
    const { body: j } = await apiJson('/api/queue/' + encodeURIComponent(id) + '/action', {
      method: 'POST',
      body: {
        action: 'save', title: form.title, cn: form.cn, intro: form.intro,
        targetSite: form.targetSite, targets: form.targets, imageHost: form.imageHost, anonymous: form.anonymous
      }
    })
    return j || { ok: false, error: { message: '保存没回应' } }
  } catch (e) {
    reportError('Queue.saveFields', e)
    return { ok: false, error: { message: '保存请求发不出去' } }
  }
}
function downloadReady() {
  const q = sel.value || {}
  if (q.sourceState && q.sourceState.complete) return true
  return !!(q.qb && Number(q.qb.progress) >= 0.999)
}
function qbText() {
  const q = sel.value || {}
  if (q.sourceState && q.sourceState.complete) return '已完成'
  if (q.sourceState && q.sourceState.progress != null) {
    const pct = Math.round(Number(q.sourceState.progress) * 100)
    return pct + '%' + (q.sourceState.state ? ' · ' + q.sourceState.state : '')
  }
  if (q.qb && q.qb.state) return Math.round((Number(q.qb.progress) || 0) * 100) + '% · ' + q.qb.state
  return '未加入'
}
function startProgressPoll() {
  if (progressTimer) return
  progressTimer = setInterval(async function () {
    if (!sel.value) { clearInterval(progressTimer); progressTimer = null; return }
    const id = sel.value.id
    try {
      /* 重新让服务端查一次 qB 进度；只查已记录的 infohash，不再打源站 */
      const { body: j } = await apiJson('/api/queue/' + encodeURIComponent(id) + '/action', { method: 'POST', body: { action: 'download' } })
      if (!sel.value || sel.value.id !== id) return
      if (j && j.ok && j.data) {
        sel.value.sourceState = {
          ok: true, at: new Date().toISOString(), hash: j.data.hash || '',
          progress: Number(j.data.progress) || 0, complete: !!j.data.complete, state: ''
        }
        if (downloadReady()) { clearInterval(progressTimer); progressTimer = null; toast('下载完成，可以发布'); loadPreview() }
      }
    } catch (e) { reportError('Queue.progress', e) }
  }, 8000)
}
async function act(action) {
  if (!sel.value || busy.act) return
  if (action === 'reject' && !reason.value.trim()) { toast('驳回要写理由'); return }
  const id = sel.value.id
  const itemTitle = sel.value.cn || sel.value.title
  busy.act = true
  const body = { action }
  if (action === 'publish') Object.assign(body, {
    title: form.title, cn: form.cn, intro: form.intro,
    targetSite: form.targetSite, imageHost: form.imageHost, anonymous: form.anonymous
  })
  if (action === 'reject') body.reason = reason.value
  try {
    const r = await apiAction(body, id)
    const j = r.body
    if (j && j.ok) {
      if (action === 'download') toast((j.data && j.data.message ? j.data.message : '已加入 qB') + (j.data && j.data.progress != null ? ' · ' + Math.round(Number(j.data.progress) * 100) + '%' : ''))
      else toast(action === 'publish' ? '已发布：' + itemTitle : '操作完成')
    }
    else toast(errorText(j, '操作失败 ' + r.status))
    await refresh()
    if (action === 'download' && !downloadReady()) startProgressPoll()
  } catch (e) { toast('请求发不出去') }
  busy.act = false
}
async function fetchMeta() {
  if (!sel.value || metaBusy.value) return
  const id = sel.value.id
  const seq = ++metaSeq
  const queryTitle = form.title || sel.value.title
  metaBusy.value = true
  metaMsg.value = '正在查资料，最多等 20 秒…'
  const ctrl = new AbortController()
  const timer = setTimeout(function () { ctrl.abort() }, 20000)
  try {
    const j = await (await fetch('/api/meta/fetch', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ queueId: id, title: queryTitle, year: sel.value.year, type: sel.value.cat === 'tv' ? 'tv' : 'movie' })
    })).json()
    if (seq !== metaSeq || !sel.value || sel.value.id !== id) return
    if (j && j.ok && j.data) {
      /* 接口返回是 { ok, data: { ok, provider, data: {title, overview} } }，兼容扁平结构 */
      const payload = j.data
      const d = payload.data || payload
      const provider = payload.provider || j.provider || '公开资料'
      const title = d.title || d.name || d.cn || ''
      const cn = payload.cnSubtitle || title
      const overview = d.overview || d.intro || d.summary || d.description || ''
      const got = []
      const changed = []
      const kept = []
      if (cn) {
        got.push('副标题')
        const cur = String(form.cn || '').trim()
        const cnRich = /\|/.test(cn) || cn.length > String(title || '').length + 4
        const curRich = /\|/.test(cur) || cur.length > String(title || '').length + 4
        if (!cur) { form.cn = cn; changed.push('副标题') }
        else if (cur === cn) { /* 一样 */ }
        else if (!curRich || cnRich) { form.cn = cn; changed.push('副标题') }
        else kept.push('副标题')
      }
      if (overview) {
        got.push('简介')
        if (form.intro !== overview) { form.intro = overview; changed.push('简介') }
      }
      if (!got.length) {
        metaMsg.value = '查到了，但资料源没返回中文名或简介；可以手动补'
      } else if (!changed.length) {
        const found = []
        if (cn) found.push('副标题「' + cn.slice(0, 50) + '」')
        if (overview) found.push('简介 ' + overview.length + ' 字')
        metaMsg.value = '查到了 ' + found.join('、') + (kept.length ? '；现有' + kept.join(' / ') + '更完整，已保留' : '；和现有内容一样，没有改动')
      } else {
        const saved = await saveFields(id)
        if (seq !== metaSeq || !sel.value || sel.value.id !== id) return
        metaMsg.value = '已更新 ' + changed.join(' / ') + ' · 来源 ' + provider + (saved.ok ? ' · 已保存' : ' · 保存失败，发布前会再保存一次')
      }
    } else {
      metaMsg.value = '没查到：' + ((j && j.error && j.error.message) || '换个片名或年份再试')
    }
  } catch (e) {
    if (seq !== metaSeq || !sel.value || sel.value.id !== id) return
    if (e && e.name === 'AbortError') metaMsg.value = '查询超时（20 秒），稍后再试'
    else { reportError('Queue.fetchMeta', e); metaMsg.value = '资料请求发不出去' }
  } finally {
    clearTimeout(timer)
    if (seq === metaSeq) metaBusy.value = false
  }
}
function mergeTargets(primary, list) {
  const out = []
  const add = function (h) { h = String(h || '').trim().toLowerCase(); if (h && out.indexOf(h) < 0) out.push(h) }
  add(primary)
  ;(Array.isArray(list) ? list : []).forEach(add)
  return out
}
function onTargetSiteChange() {
  form.targets = form.targetSite ? [form.targetSite] : []
  loadPreview()
}
function submitTarget() {
  if (!sel.value || busy.target) return
  const primary = form.targetSite || sel.value.targetSite
  const targets = mergeTargets(primary, form.targets)
  if (!targets.length) { toast('先选目标站'); return }
  const main = targets.filter(function (h) { return !/^(test[.-]|127\.0\.0\.1$|localhost$)/i.test(h) })
  if (main.length) {
    lock.open = true; lock.host = main[0]; lock.hosts = main; lock.targets = targets; lock.typed = ''; lock.fn = null
    return
  }
  confirmBox('真实提交到测试站？', '会把「' + (form.title || sel.value.title) + '」提交到：' + targets.join('、') + '。\n\n服务端还会查 cookie、源种完成度和目标站查重。', function () { doSubmitTarget(targets, []) })
}
function confirmLock() {
  if (lock.typed.trim() !== lock.host) return
  const fn = lock.fn
  const targets = lock.targets
  const hosts = lock.hosts
  lock.open = false; lock.typed = ''
  if (fn) fn(hosts)
  else doSubmitTarget(targets, hosts)
}
async function doSubmitTarget(targets, confirmHosts) {
  if (!sel.value || busy.target) return
  const id = sel.value.id
  busy.target = true
  try {
    const saved = await saveFields(id)
    if (!saved.ok) {
      toast('标题/简介没保存上：' + ((saved.error && saved.error.message) || '先检查标题'))
      busy.target = false
      return
    }
    if (!stillSelected(id)) { toast('条目已切换，取消发布'); busy.target = false; return }
    /* 发布前用当前表单重新整理一次，确保简介/媒体信息和图床链接是最新的 */
    const prep = await (await fetch('/api/queue/' + encodeURIComponent(id) + '/prepare', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targets: form.targets, host: form.targetSite })
    })).json()
    if (!stillSelected(id)) { toast('条目已切换，取消发布'); busy.target = false; return }
    if (!prep || !prep.ok) {
      toast('发布资料没整理好：' + ((prep && prep.error && prep.error.message) || '检查简介/媒体信息'))
      busy.target = false
      return
    }
    const body = { queueId: id, dryRun: false, confirmHosts: Array.isArray(confirmHosts) ? confirmHosts : [] }
    const multi = targets.length > 1
    const url = multi ? '/api/queue/' + encodeURIComponent(id) + '/targets/upload'
      : '/api/targets/' + encodeURIComponent(targets[0]) + '/upload'
    if (multi) body.targets = targets
    const r = await fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    const j = await r.json().catch(() => null)
    if (j && j.ok) {
      if (multi) {
        const ok = (j.data.targets || []).filter(function (x) { return x.ok }).length
        const bad = (j.data.targets || []).length - ok
        toast('多目标提交：成功 ' + ok + '，失败 ' + bad)
      } else {
        const v = j.data.verify
        toast('已提交目标站' + (v ? (v.found ? '，回查已找到' : '，回查暂未找到') : ''))
      }
      await refresh()
    } else toast((j && j.error && j.error.message) || ('提交失败 ' + r.status))
  } catch (e) { toast('提交请求发不出去') }
  busy.target = false
}
async function prepareRelease() {
  if (!sel.value || prepBusy.value) return
  const id = sel.value.id
  prepBusy.value = true
  prepMsg.value = ''
  try {
    const saved = await saveFields(id)
    if (!saved.ok) {
      prepMsg.value = '整理失败：' + ((saved.error && saved.error.message) || '标题/简介没保存上')
      toast(prepMsg.value)
      return
    }
    if (!stillSelected(id)) { prepBusy.value = false; return }
    const j = await (await fetch('/api/queue/' + encodeURIComponent(id) + '/prepare', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targets: form.targets, host: form.targetSite })
    })).json()
    if (!stillSelected(id)) { prepBusy.value = false; return }
    if (j && j.ok) {
      const m = j.data && j.data.prepared && j.data.prepared.media
      const summary = m && m.summary ? m.summary : ''
      toast('发布资料已整理' + (summary ? '：' + summary : ''))
      await refresh()
      if (stillSelected(id)) {
        prepMsg.value = summary
          ? ('已整理：发布时会用当前标题/简介和源站媒体信息。媒体：' + summary)
          : '已整理：源站简介里没识别到媒体信息，发布时不带。'
      }
    } else {
      prepMsg.value = '整理失败：' + ((j && j.error && j.error.message) || '服务端没返回结果')
      toast(prepMsg.value)
    }
  } catch (e) {
    reportError('Queue.prepareRelease', e)
    prepMsg.value = '整理请求发不出去'
    toast(prepMsg.value)
  } finally {
    prepBusy.value = false
  }
}
async function bulkApprove() {
  if (busy.approve) return
  busy.approve = true
  try {
    const j = await (await fetch('/api/queue/bulk', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'approve', fromStatus: 'pending' })
    })).json()
    toast(j && j.ok ? '已批准 ' + j.data.changed + ' 条' : ((j && j.error && j.error.message) || '批量批准失败'))
    await loadQueuePage()
    /* 批量批准会改当前选中条目的状态，详情也要跟着刷新 */
    if (sel.value) await select(sel.value.id)
  } catch (e) { toast('批量批准请求发不出去') } finally { busy.approve = false }
}
async function bulkPublish() {
  if (busy.publish) return
  const go = window.PTA && window.PTA.confirm
  const fn = async () => {
    busy.publish = true
    try {
      const j = await (await fetch('/api/queue/bulk', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish', fromStatus: 'approved' })
      })).json()
      const firstErr = j && j.ok && j.data && Array.isArray(j.data.errors) && j.data.errors[0]
      toast(j && j.ok ? ('已发布 ' + j.data.changed + ' 条' + (j.data.skipped ? '，跳过 ' + j.data.skipped + ' 条' : '') + (firstErr ? '（' + String(firstErr.message || firstErr.code || '有失败').slice(0, 60) + '）' : '')) : ((j && j.error && j.error.message) || '批量发布失败'))
      await refresh()
    } catch (e) { toast('批量发布请求发不出去') } finally { busy.publish = false }
  }
  if (go) go('批量发布', '会把「已通过」的条目逐条走发布链路；真发布关闭时会逐条失败。继续？', fn)
  else fn()
}
async function ensureQueue() {
  if (!viewVisible('queue') || !loggedIn()) return
  loadSites()
  await loadQueuePage()
  if (sel.value) await select(sel.value.id)
}
onMounted(() => {
  window.addEventListener('hashchange', ensureQueue)
  timer = setInterval(() => { if (!loaded) ensureQueue() }, 1500)
  ensureQueue()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensureQueue)
  if (timer) clearInterval(timer)
  if (qTimer) clearTimeout(qTimer)
  if (progressTimer) clearInterval(progressTimer)
})
</script>

<style scoped>
/* 顶部工具栏 */
.queue-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.queue-bar .spacer { flex: 1; }

/* 左侧列表 + 右侧详情 */
.queue-split { flex: 1; min-height: 0; display: flex; gap: 12px; align-items: stretch; }
.queue-list { width: clamp(280px, 30%, 400px); flex: 0 0 clamp(280px, 30%, 400px); background: #fff; border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
.queue-items { flex: 1; overflow-y: auto; padding: 6px; min-height: 0; }
.q-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; border: 0; background: none; padding: 7px 9px; border-radius: 9px; cursor: pointer; font: inherit; }
.q-item:hover { background: #f7f8fa; }
.q-item.on { background: var(--accent-soft); }
.q-title { flex: 1; min-width: 0; }
.q-title b { display: block; font-size: 12px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-title i { display: block; margin-top: 1px; font-style: normal; font-size: 10px; color: var(--muted-2); }

/* 分页 */
.queue-page { flex: 0 0 auto; padding: 8px 10px 10px; border-top: 1px solid var(--line); background: #fff; }
.queue-pager { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid var(--line); border-radius: 0; background: #fafbfd; }
.queue-pager .pager-link { flex: 0 0 auto; font-size: 10.5px; color: var(--accent); cursor: pointer; user-select: none; white-space: nowrap; }
.queue-pager .pager-link.off { color: var(--muted-2); cursor: default; opacity: .55; }
.queue-pager .pager-meta { flex: 1; min-width: 0; text-align: center; font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 详情外壳 */
.queue-detail { flex: 1; min-width: 0; min-height: 0; background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 18px 20px 14px; display: flex; flex-direction: column; overflow: hidden; }
.qd-body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.qd-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
.qd-head { display: flex; align-items: flex-start; gap: 14px; }
.qd-id { min-width: 0; }
.qd-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.qd-title-row h2 { margin: 0; font-size: 16px; font-weight: 600; }
.qd-meta { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 6px; }
.qd-meta span { font-size: 11px; color: var(--muted-2); }
.qd-meta b { margin-left: 5px; font-size: 11.5px; font-weight: 500; color: var(--ink); }

/* 阶段 / 目标站结果 */
.qd-stage { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 8px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); }
.qd-stage .t-sub { font-size: 11px; }
.qd-stage-err { flex: 1 1 100%; font-size: 11.5px; color: var(--red); line-height: 1.5; overflow-wrap: anywhere; }
.qd-target-results { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.qd-target-result { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 6px 9px; border: 1px solid var(--line); border-radius: 9px; background: #fff; }
.qd-target-result .qd-stage-err { flex: 1 1 100%; }

/* 发布信息：标签固定，中间控件，右侧留动作按钮位；外层不再套框 */
.qd-pubinfo { padding: 0; border: 0; border-radius: 0; background: transparent; margin-top: 8px; }
.qd-pub-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
.qd-pub-head h3 { margin: 0; font-size: 10px; letter-spacing: .6px; }
.qd-anon { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--muted); cursor: pointer; }
.qd-field { display: grid; grid-template-columns: 52px minmax(0, 1fr) 92px; align-items: center; gap: 10px; padding: 4px 0; font-size: 12px; color: var(--muted); }
.qd-field-top { align-items: start; }
.qd-field > span { font-size: 11.5px; color: var(--muted); }
.qd-field .input, .qd-field .select { width: 100%; min-width: 0; height: 30px; font-size: 11.5px; }
.qd-control { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.qd-desc-control { gap: 6px; }
.qd-desc-control .sd-note { width: 100%; height: 92px; min-height: 92px; font-size: 11.5px; line-height: 1.5; }
.qd-action-btn { width: 100%; justify-content: center; padding-left: 0; padding-right: 0; font-size: 10.5px; white-space: nowrap; }
.qd-field-top .qd-action-btn { align-self: start; }
.qd-meta-msg { margin-top: 0; }
.qd-download { padding: 4px 0 6px; }
.qd-final-desc { margin-top: 4px; font-size: 12px; }
.qd-final-desc > summary { cursor: pointer; color: var(--muted); font-size: 11.5px; }
.qd-final-desc > summary:hover { color: var(--accent); }
.qd-final-desc pre { white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto; margin: 6px 0 0; padding: 0; background: none; border: 0; font-size: 11.5px; line-height: 1.55; }

.qd-status { margin-top: 8px; }

/* 底栏：去掉边框，保持紧凑 */
.qd-targets-foot { margin-top: 6px; display: flex; align-items: flex-start; gap: 8px; padding-top: 6px; border-top: 0; flex-wrap: wrap; }
.qd-targets-lbl { font-size: 11px; color: var(--muted); white-space: nowrap; padding-top: 4px; }
.qd-targets-foot .pick-row { flex: 1 1 auto; min-width: 0; }
.qd-target-chips { justify-content: flex-start; gap: 6px; }
.qd-target-check { display: none; }
.qd-actions { display: flex; align-items: center; gap: 8px; padding-top: 6px; margin-top: 6px; border-top: 0; flex-wrap: wrap; }
.qd-actions .spacer { flex: 1; }

/* 桌面：固定高度，列表/详情各自滚动 */
@media (min-width: 901px) {
  :global(.view[data-view="queue"]) { height: calc(100vh - 150px); min-height: 520px; display: flex; flex-direction: column; justify-content: flex-start; overflow: hidden; }
  .queue-split { flex: 1 1 auto; min-height: 0; align-items: stretch; }
  .queue-list { height: auto; max-height: none; min-height: 0; overflow: hidden; }
  .queue-items { min-height: 0; overflow-y: auto; }
  .queue-detail { height: auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .qd-scroll { min-height: 0; overflow-y: auto; }
  .qd-actions { margin-top: 0; }
}

@media (max-width: 900px) {
  .queue-split { flex-direction: column; gap: 10px; height: auto; align-items: stretch; }
  .queue-list, .queue-detail { width: 100%; max-width: none; flex: 0 0 auto; }
  .queue-list { max-height: 46vh; }
  .queue-items { overflow-y: auto; }
  .qd-head { flex-direction: column; gap: 6px; }
  .qd-id { width: 100%; }
  .qd-meta { margin-top: 4px; gap: 6px 14px; }
  .queue-detail { height: auto; overflow: visible; }
  .qd-body { display: block; }
  .qd-scroll { height: auto; overflow: visible; }
}

@media (max-width: 600px) {
  .queue-detail { padding: 14px 12px 10px; }
  .qd-field { grid-template-columns: 46px minmax(0, 1fr) 82px; gap: 8px; }
  .qd-action-btn { font-size: 10px; }
  .qd-targets-foot, .qd-actions { gap: 6px; }
}
</style>
