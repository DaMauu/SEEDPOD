<template>
  <div class="queue-bar">
    <div class="seg-tabs" id="queue-tabs">
      <button v-for="t in tabs" :key="t.v" type="button" :class="{ active: tab === t.v }" @click="setTab(t.v)">{{ t.label }}</button>
    </div>
    <input v-model="q" class="input slim" id="queue-q" placeholder="搜标题 / 中文名" style="width:220px" @input="debounced">
    <div class="spacer"></div>
    <span class="t-sub" id="queue-count">共 {{ matched }} 条</span>
    <button class="btn ghost slim" id="q-bulkapprove" type="button" :disabled="busy.approve" @click="bulkApprove">全部批准</button>
    <button class="btn ghost slim" id="q-bulkpublish" type="button" :disabled="busy.publish" @click="bulkPublish">全部发布</button>
  </div>

  <div class="queue-split">
    <aside class="queue-list">
      <div class="queue-items" id="queue-items">
        <div v-if="!items.length" class="sites-empty">没有匹配的条目</div>
        <button v-for="it in items" :key="it.id" class="q-item" :class="{ on: sel && sel.id === it.id }" type="button" @click="select(it.id)">
          <span class="q-title">
            <b>{{ it.title }}</b>
            <i>{{ sub(it) }}</i>
          </span>
          <span class="badge" :class="statusTone(it.status)">{{ label(it.status) }}</span>
        </button>
      </div>
      <div class="queue-page">
        <div class="queue-pager">
          <span class="pager-link" :class="{ off: page <= 1 }" @click="page > 1 && loadQueuePage(page - 1)">上一页</span>
          <span class="pager-meta">第 {{ page }} / {{ pages }} 页 · 共 {{ matched }} 条</span>
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

        <div class="qd-grid">
          <section class="sd-card qd-pubinfo">
            <h3>发布信息</h3>
            <div class="qd-field">
              <span>目标站</span>
              <select v-model="form.targetSite" class="input" @change="loadPreview">
                <option value="">未选择</option>
                <option v-if="form.targetSite && !sites.some(s => s.name === form.targetSite)" :value="form.targetSite">{{ form.targetSite }}</option>
                <option v-for="s in sites" :key="s.name" :value="s.name">{{ s.title || s.name }}</option>
              </select>
            </div>
            <div class="qd-field"><span>标题</span><div class="qd-path-row"><input v-model="form.title" class="input"><button class="btn ghost slim" type="button" title="只回填标题：源种里只有文件名；副标题和简介来自源站页面" @click="fillSourceTitle">回填源标题</button></div></div>
            <div class="qd-field"><span>副标题</span><div class="qd-path-row"><input v-model="form.cn" class="input"><button class="btn ghost slim" type="button" :disabled="metaBusy" title="用公开元数据填中文名和简介" @click="fetchMeta">{{ metaBusy ? '查询中…' : '查资料' }}</button></div></div>
            <div v-if="metaMsg" class="t-sub qd-meta-msg">{{ metaMsg }}</div>
            <div class="qd-field">
              <span>图床</span>
              <select v-model="form.imageHost" class="input">
                <option v-for="h in hosts" :key="h">{{ h }}</option>
              </select>
            </div>
            <div class="qd-field"><span>匿名发布</span><input v-model="form.anonymous" type="checkbox"></div>
          </section>

          <section class="sd-card qd-desc-card">
            <div class="qd-desc-head"><h3>简介</h3><button class="btn ghost slim" type="button" :disabled="media.preparing" title="用当前标题/简介和 MediaInfo 生成最终发布内容" @click="prepareRelease">{{ media.preparing ? '整理中…' : '整理发布资料' }}</button></div>
            <textarea v-model="form.intro" class="input sd-note" rows="3"></textarea>
            <div v-if="media.prepareMsg" class="t-sub">{{ media.prepareMsg }}</div>
            <details v-if="sel.prepared && sel.prepared.description" class="qd-final-desc">
              <summary>最终简介预览（发布时用这份）</summary>
              <pre>{{ sel.prepared.description }}</pre>
            </details>
          </section>

          <section class="sd-card qd-shots">
            <h3>截图</h3>
            <div class="shots">
              <template v-for="(shot, i) in (sel.shots || [])" :key="i">
                <div class="shot has">
                  <img :src="shot.url" alt="">
                  <span>{{ i + 1 }}</span>
                  <button class="shot-del" type="button" title="删除" @click.stop="removeShot(i)">×</button>
                </div>
              </template>
              <button class="shot add" type="button" @click="pickFiles">上传</button>
            </div>
            <div class="qd-actions">
              <button class="btn ghost slim" type="button" :disabled="busy.images" @click="imageAction(true)">图床演练</button>
              <button class="btn ghost slim" type="button" :disabled="busy.images" @click="imageAction(false)">上传截图</button>
            </div>
            <div v-if="sel.imagePlan" class="t-sub">图床：{{ hostLabel(sel.imagePlan.provider) }} · {{ sel.imagePlan.total }} 张 · {{ sel.imagePlan.dryRun ? '演练' : (sel.imagePlan.uploaded + ' 张已传' + (sel.imagePlan.failed ? '，' + sel.imagePlan.failed + ' 张失败' : '')) }}</div>
          </section>

          <details class="qd-advanced">
          <summary>高级：MediaInfo / 截图（日常可忽略）</summary>
          <section class="sd-card qd-media">
            <div class="qd-media-head"><h3>MediaInfo / BDInfo</h3><button class="btn ghost slim" type="button" :disabled="media.parsing || !media.infoText.trim()" @click="parseMediaInfo">{{ media.parsing ? '解析中…' : '解析 MediaInfo' }}</button></div>
            <div class="soft">目标站要求简介带媒体信息时才用；不填也能发布。粘贴完整文本后点右上角「解析 MediaInfo」。</div>
            <div class="qd-field qd-media-info">
              <textarea v-model="media.infoText" class="input sd-note" rows="4" placeholder="粘贴完整 MediaInfo（从 General 开始）或 BDInfo（从 Disc Title 开始）"></textarea>
            </div>
            <div v-if="media.parseMsg" class="t-sub">{{ media.parseMsg }}</div>
            <div v-if="media.info" class="t-sub">已识别：{{ media.info.summary || media.info.kind }}<span v-if="media.info.kind"> · {{ media.info.kind }}</span></div>

            <details class="qd-advanced-sub">
              <summary>从视频文件读取信息 / 截图（可选）</summary>
              <div class="qd-field">
                <span>文件路径</span>
                <div class="qd-path-row">
                  <input v-model="media.path" class="input" :placeholder="media.root ? media.root + '/...' : '服务器上的文件路径'">
                  <button class="btn ghost slim" type="button" :disabled="media.pathLoading" @click="fillMediaPath">{{ media.pathLoading ? '读取中…' : '从 qB 取路径' }}</button>
                </div>
              </div>
              <div class="soft">文件必须在 {{ media.root || 'PTA_MEDIA_ROOT' }} 下；不填也能发布。</div>
              <div class="qd-actions">
                <button class="btn ghost slim" type="button" :disabled="media.probing || !media.path.trim()" title="读取分辨率、编码、时长等；只用于预览" @click="probeMedia">{{ media.probing ? '读取中…' : '读取视频信息' }}</button>
                <button class="btn ghost slim" type="button" :disabled="media.shooting || !media.path.trim()" title="从视频里截 3 张图；日常可不做" @click="shootMedia">{{ media.shooting ? '截图中…' : '从视频截图' }}</button>
              </div>
              <div v-if="!media.path.trim()" class="soft">这两个按钮要先填文件路径，或点「从 qB 取路径」。</div>
              <div v-if="media.probe" class="t-sub">{{ media.probe.summary }} · {{ media.probe.durationText }} · {{ fmtSize(media.probe.size) }}</div>
            </details>

            <details class="qd-advanced-sub">
              <summary>临时种子 / 下载器预检（排错用，一般不用）</summary>
              <div class="soft">正常发布用源种，不用生成临时种子。下载器预检只检查会不会加进 qB，不会发布。</div>
              <div class="qd-field">
                <span>Tracker（仅生成临时种子）</span>
                <div class="qd-path-row">
                  <input v-model="media.announce" class="input" placeholder="http://tracker.example/announce">
                  <button class="btn ghost slim" type="button" :disabled="media.making || !media.path.trim() || !media.announce.trim()" title="生成一个临时种子；正常发布用源种，不需要这个" @click="makeMediaTorrent">{{ media.making ? '生成中…' : '生成临时种子' }}</button>
                </div>
              </div>
              <div class="qd-actions">
                <button class="btn ghost slim" type="button" :disabled="busy.inject" title="只检查会不会加进 qB，不会真的发布" @click="runInjectPlan">{{ busy.inject ? '预检中…' : '预检下载器' }}</button>
              </div>
              <div v-if="sel.injectPlan" class="t-sub">下载器预检 · {{ sel.injectPlan.client === 'watch' ? 'watch' : 'qB' }}：{{ injectNote(sel) }}（只检查，不会发布）</div>
              <div v-if="media.torrent" class="t-sub">临时种子 {{ String(media.torrent.infohash).slice(0, 12) }}… · {{ fmtSize(media.torrent.size) }}</div>
            </details>
          </section>
          </details>
        </div>

        <div v-if="sel.qb || sel.sourceState" class="t-sub qd-download">qB：{{ qbText() }}</div>
        <section v-if="preflight" class="sd-card qd-preflight">
          <div class="qd-preflight-head">
            <h3>发布前检查</h3>
            <span class="badge" :class="preflight.ready ? 'green' : 'amber'">{{ preflight.ready ? '可提交' : '有缺项' }}</span>
          </div>
          <div class="qd-preflight-row">
            <span>目标站 <b>{{ preflight.host }}</b></span>
            <span>分类 <b>{{ preflight.labels.type || preflight.fields.type || '未映射' }}</b></span>
            <span>制作组 <b>{{ preflight.labels.team_sel || preflight.fields.team_sel || '未映射' }}</b></span>
            <span>媒介 <b>{{ preflight.labels.medium_sel || preflight.labels.source_sel || preflight.fields.medium_sel || preflight.fields.source_sel || '—' }}</b></span>
            <span>目标站查重 <b :class="preflight.dupe.state === 'exists' || preflight.dupe.state === 'error' ? 'qd-stage-err' : (preflight.dupe.state === 'passed' ? 'qd-ok' : '')">{{ preflight.dupe.label }}</b></span>
          </div>
          <div class="qd-preflight-row">
            <span>种子 <b>{{ preflight.torrent.name || '先下载种子' }}</b></span>
            <span v-if="preflight.torrent.hash">infohash <b>{{ preflight.torrent.hash.slice(0, 12) }}…</b>
              <em v-if="preflight.checked" :class="preflight.hashUnchanged ? 'qd-ok' : 'qd-stage-err'">{{ preflight.hashUnchanged ? '清洗后不变' : '清洗后变了' }}</em>
              <em v-else class="soft">清洗只换 announce，应不变</em>
            </span>
          </div>
          <div class="qd-preflight-row"><span>Tracker <b>{{ preflight.trackerNote }}</b></span></div>
          <div v-if="preflight.warnings && preflight.warnings.length" class="qd-warn">需处理：{{ preflight.warnings.join('；') }}</div>
        </section>
        <div v-if="pubNote(sel)" class="qd-status" :class="sel.status === 'failed' ? 'bad' : 'ok'">{{ pubNote(sel) }}</div>
        <div v-if="sel.targetUpload" class="qd-status" :class="sel.targetVerify && sel.targetVerify.found ? 'ok' : ''">
          目标站 {{ sel.targetUpload.host }} · {{ sel.targetUpload.message || '已提交' }}
          <a v-if="sel.targetUpload.detailsUrl" :href="sel.targetUpload.detailsUrl" target="_blank" rel="noopener noreferrer">详情</a>
          <span v-if="sel.targetVerify"> · 回查：{{ sel.targetVerify.found ? '已找到' : '未找到' }}</span>
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
          <button class="btn ghost slim" type="button" :disabled="busy.act" @click="act('reject')">驳回</button>
          <div class="spacer"></div>
          <input v-model="reason" class="input slim" placeholder="驳回理由（可留空）" style="width:200px">
          <button class="btn ghost slim" type="button" :disabled="busy.act" @click="act('skip')">跳过</button>
        </div>
      </div>
    </div>
  </div>

  <input ref="filePick" type="file" accept="image/*" multiple hidden @change="onFiles">

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
import { toast, loggedIn, viewVisible, confirmBox } from '../utils/ui'

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
const busy = reactive({ act: false, approve: false, publish: false, target: false, images: false, inject: false })
const lock = reactive({ open: false, host: '', hosts: [], targets: [], typed: '', fn: null })
const media = reactive({ path: '', announce: '', infoText: '', info: null, parseMsg: '', prepareMsg: '', parsing: false, preparing: false, probing: false, shooting: false, making: false, pathLoading: false, probe: null, torrent: null, root: '' })
const preflight = ref(null)
const metaBusy = ref(false)
const metaMsg = ref('')
let previewSeq = 0
let mediaCfgLoaded = false
const filePick = ref(null)
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
const STAGE_LABEL = { draft: '草稿', prepared: '已准备', previewed: '已预览', submitted: '已提交', injected: '已注入', failed: '失败' }
const STAGE_TONE = { prepared: 'blue', previewed: 'amber', submitted: 'blue', injected: 'green', failed: 'red' }
function hostLabel(s) { return ({ none: '站内', local: '本地图床', pixhost: 'Pixhost', imgbox: 'Imgbox', custom: '自定义' })[s] || s || '—' }
function stageLabel(s) { return STAGE_LABEL[s] || s || '草稿' }
function stageTone(s) { return STAGE_TONE[s] || '' }
function targetTone(s) { return STAGE_TONE[s] || '' }
function retryTarget(host) {
  if (!/^(test[.-]|127\.0\.0\.1$|localhost$)/i.test(host)) {
    lock.open = true; lock.host = host; lock.hosts = [host]; lock.targets = [host]; lock.typed = ''
    lock.fn = function () { doRetryTarget(host) }
    return
  }
  doRetryTarget(host)
}
async function doRetryTarget(host) {
  if (!sel.value || busy.target) return
  busy.target = true
  try {
    const body = { queueId: sel.value.id, targets: [host], dryRun: false }
    if (media.torrent && media.torrent.base64) body.torrentBase64 = media.torrent.base64
    const r = await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/targets/upload', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    })
    const j = await r.json().catch(() => null)
    toast(j && j.ok ? '目标站重试完成' : ((j && j.error && j.error.message) || '重试失败'))
    await refresh()
  } catch (e) { reportError('Queue.retryTarget', e); toast('重试请求发不出去') }
  busy.target = false
}
function stageTime(iso) { return String(iso || '').slice(5, 16).replace('T', ' ') }
async function retryStage() {
  if (!sel.value) return
  try {
    const r = await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/advance', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}'
    })
    const j = await r.json()
    if (!j || !j.ok) { toast((j && j.error && j.error.message) || '重试失败'); return }
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
    const j = await (await fetch('/api/targets', { credentials: 'same-origin' })).json()
    const list = (j && j.ok && Array.isArray(j.data)) ? j.data.filter(t => t.hasCookie) : []
    if (list.length) sites.value = list.map(t => ({ name: t.host, title: t.host }))
    else {
      const s = await (await fetch('/api/sites', { credentials: 'same-origin' })).json()
      if (s && s.ok && s.data) sites.value = s.data.sites || []
    }
  } catch (e) { reportError('Queue', e) }
}
async function loadQueuePage(p) {
  if (!loggedIn()) return
  if (p) page.value = p
  const status = tab.value === 'all' ? '' : tab.value === 'approved' ? 'approved,published' : tab.value
  const qs = new URLSearchParams({ limit: '50', offset: String((page.value - 1) * 50) })
  if (status) qs.set('status', status)
  if (q.value.trim()) qs.set('q', q.value.trim())
  try {
    const j = await (await fetch('/api/queue?' + qs.toString(), { credentials: 'same-origin' })).json()
    if (!j || !j.ok) return
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
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
  try {
    const j = await (await fetch('/api/queue/' + encodeURIComponent(id), { credentials: 'same-origin' })).json()
    if (!j || !j.ok) return
    sel.value = j.data
    media.path = ''
    media.announce = ''
    media.infoText = j.data.mediaInfo || j.data.bdinfo || ''
    media.info = (j.data.prepared && j.data.prepared.media) || null
    media.parseMsg = ''
    media.prepareMsg = ''
    media.probe = null
    media.torrent = null
    loadMediaConfig()
    form.title = j.data.title || ''
    form.cn = j.data.cn || ''
    form.intro = j.data.intro || ''
    form.targetSite = j.data.targetSite || ''
    form.targets = Array.isArray(j.data.targets) ? j.data.targets.slice() : (j.data.targetSite ? [j.data.targetSite] : [])
    form.imageHost = j.data.imageHost || '站内'
    form.anonymous = !!j.data.anonymous
    reason.value = ''
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
  const r = await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/fill-source-title', { method: 'POST', credentials: 'same-origin' })
  const j = await r.json().catch(() => null)
  if (j && j.ok) { toast('标题已回填：' + j.data.title); await refresh() }
  else toast((j && j.error && j.error.message) || '回填失败')
}
async function refresh() {
  if (sel.value) await select(sel.value.id)
  await loadQueuePage()
}
async function apiAction(body) {
  const r = await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/action', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}
async function loadPreview() {
  if (!sel.value) { preflight.value = null; return }
  const id = sel.value.id
  const host = form.targetSite || sel.value.targetSite || ''
  const seq = ++previewSeq
  try {
    const q = host ? '?host=' + encodeURIComponent(host) : ''
    const j = await (await fetch('/api/queue/' + encodeURIComponent(id) + '/publish-preview' + q, { credentials: 'same-origin' })).json()
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
async function saveFields() {
  if (!sel.value) return { ok: false, error: { message: '没选中条目' } }
  try {
    const j = await (await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/action', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'save', title: form.title, cn: form.cn, intro: form.intro,
        targetSite: form.targetSite, targets: form.targets, imageHost: form.imageHost, anonymous: form.anonymous
      })
    })).json()
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
    try {
      /* 重新让服务端查一次 qB 进度；只查已记录的 infohash，不再打源站 */
      const r = await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/action', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'download' })
      })
      const j = await r.json().catch(() => null)
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
  busy.act = true
  const body = { action }
  if (action === 'publish') Object.assign(body, {
    title: form.title, cn: form.cn, intro: form.intro,
    targetSite: form.targetSite, imageHost: form.imageHost, anonymous: form.anonymous
  })
  if (action === 'reject') body.reason = reason.value
  try {
    const r = await apiAction(body)
    const j = r.body
    if (j && j.ok) {
      if (action === 'download') toast((j.data && j.data.message ? j.data.message : '已加入 qB') + (j.data && j.data.progress != null ? ' · ' + Math.round(Number(j.data.progress) * 100) + '%' : ''))
      else toast(action === 'publish' ? '已发布：' + (sel.value.cn || sel.value.title) : '操作完成')
    }
    else toast((j && j.error && j.error.message) || ('操作失败 ' + r.status))
    await refresh()
    if (action === 'download' && !downloadReady()) startProgressPoll()
  } catch (e) { toast('请求发不出去') }
  busy.act = false
}
async function fetchMeta() {
  if (!sel.value || metaBusy.value) return
  metaBusy.value = true
  metaMsg.value = ''
  try {
    const j = await (await fetch('/api/meta/fetch', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: form.title || sel.value.title, year: sel.value.year, type: sel.value.cat === 'tv' ? 'tv' : 'movie' })
    })).json()
    if (j && j.ok && j.data) {
      const filled = []
      if (j.data.title) { form.cn = j.data.title; filled.push('中文名') }
      if (j.data.overview) { form.intro = j.data.overview; filled.push('简介') }
      metaMsg.value = filled.length ? ('已填入 ' + filled.join(' / ') + ' · 来源 ' + (j.provider || '公开资料')) : '查到了，但没有中文名或简介；可以手动补'
      toast(metaMsg.value)
    } else {
      metaMsg.value = '没查到：' + ((j && j.error && j.error.message) || '换个片名或年份再试')
      toast(metaMsg.value)
    }
  } catch (e) {
    reportError('Queue.fetchMeta', e)
    metaMsg.value = '资料请求发不出去'
    toast(metaMsg.value)
  }
  metaBusy.value = false
}
function submitTarget() {
  if (!sel.value || busy.target) return
  const primary = form.targetSite || sel.value.targetSite
  const targets = (form.targets && form.targets.length ? form.targets.slice() : (primary ? [primary] : []))
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
  busy.target = true
  try {
    const saved = await saveFields()
    if (!saved.ok) {
      toast('标题/简介没保存上：' + ((saved.error && saved.error.message) || '先检查标题'))
      busy.target = false
      return
    }
    /* 发布前用当前表单重新整理一次，确保简介/MediaInfo 和图床链接是最新的 */
    const prep = await (await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/prepare', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mediaInfo: media.infoText, targets: form.targets, host: form.targetSite })
    })).json()
    if (!prep || !prep.ok) {
      toast('发布资料没整理好：' + ((prep && prep.error && prep.error.message) || '检查简介/媒体信息'))
      busy.target = false
      return
    }
    const body = { queueId: sel.value.id, dryRun: false, confirmHosts: Array.isArray(confirmHosts) ? confirmHosts : [] }
    if (media.torrent && media.torrent.base64) body.torrentBase64 = media.torrent.base64
    const multi = targets.length > 1
    const url = multi ? '/api/queue/' + encodeURIComponent(sel.value.id) + '/targets/upload'
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
function fmtSize(n) {
  let v = Number(n) || 0
  if (!v) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + u[i]
}
async function loadMediaConfig() {
  if (mediaCfgLoaded || !loggedIn()) return
  try {
    const j = await (await fetch('/api/media/config', { credentials: 'same-origin' })).json()
    if (j && j.ok) { media.root = j.data.root || ''; mediaCfgLoaded = true }
  } catch (e) { reportError('Queue', e) }
}
async function fillMediaPath() {
  if (!sel.value || media.pathLoading) return
  media.pathLoading = true
  try {
    const j = await (await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/media-path', { method: 'POST', credentials: 'same-origin' })).json()
    if (j && j.ok && j.data && j.data.path) {
      media.path = j.data.path
      toast('已从 qB 填入路径：' + j.data.path)
    } else if (j && j.ok && j.data && j.data.added) {
      toast(j.data.message || '已加入 qB，下载完成后再点一次')
    } else toast((j && j.error && j.error.message) || '没取到路径')
  } catch (e) { toast('读取路径请求发不出去') }
  media.pathLoading = false
}
async function probeMedia() {
  if (!sel.value || media.probing) return
  if (!media.path.trim()) { toast('先填媒体文件路径'); return }
  media.probing = true
  try {
    const j = await (await fetch('/api/media/probe', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: media.path.trim() })
    })).json()
    if (j && j.ok) { media.probe = j.data; toast('探测完成：' + (j.data.summary || j.data.format || 'OK')) }
    else toast((j && j.error && j.error.message) || '探测失败')
  } catch (e) { toast('探测请求发不出去') }
  media.probing = false
}
async function runInjectPlan() {
  if (!sel.value || busy.inject) return
  busy.inject = true
  try {
    const j = await (await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/inject', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dryRun: true })
    })).json()
    if (j && j.ok) { toast('注入检查：' + (j.data.message || 'OK')); await refresh() }
    else toast((j && j.error && j.error.message) || '注入检查失败')
  } catch (e) { reportError('Queue.runInjectPlan', e); toast('注入检查请求发不出去') }
  busy.inject = false
}
async function imageAction(dryRun) {
  if (!sel.value || busy.images) return
  if (!(sel.value.shots || []).length) { toast('先加截图'); return }
  busy.images = true
  try {
    const j = await (await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/images', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageHost: form.imageHost, dryRun })
    })).json()
    if (j && j.ok) {
      toast(dryRun ? ('图床演练：' + j.data.total + ' 张，没有上传') : ('图床上传：成功 ' + j.data.uploaded + '，失败 ' + j.data.failed))
      await refresh()
    } else toast((j && j.error && j.error.message) || '图床操作失败')
  } catch (e) { reportError('Queue.imageAction', e); toast('图床请求发不出去') }
  busy.images = false
}
async function parseMediaInfo() {
  if (!sel.value || media.parsing) return
  if (!media.infoText.trim()) { toast('先粘贴 MediaInfo 或 BDInfo'); return }
  media.parsing = true
  try {
    const j = await (await fetch('/api/meta/mediainfo', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: media.infoText })
    })).json()
    if (j && j.ok) {
      media.info = j.data
      media.parseMsg = '已识别 ' + (j.data.kind === 'bdinfo' ? 'BDInfo' : 'MediaInfo') + '：' + (j.data.summary || 'OK')
      toast(media.parseMsg)
    } else {
      media.parseMsg = (j && j.error && j.error.message) || '没认出格式：请粘贴完整 MediaInfo（从 General 开始）或 BDInfo（从 Disc Title 开始）'
      toast(media.parseMsg)
    }
  } catch (e) { reportError('Queue.parseMediaInfo', e); media.parseMsg = '解析请求发不出去'; toast(media.parseMsg) }
  media.parsing = false
}
async function prepareRelease() {
  if (!sel.value || media.preparing) return
  media.preparing = true
  media.prepareMsg = ''
  try {
    const saved = await saveFields()
    if (!saved.ok) {
      media.prepareMsg = '整理失败：' + ((saved.error && saved.error.message) || '标题/简介没保存上')
      toast(media.prepareMsg)
      media.preparing = false
      return
    }
    const j = await (await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/prepare', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mediaInfo: media.infoText, targets: form.targets, host: form.targetSite })
    })).json()
    if (j && j.ok) {
      media.info = (j.data.prepared && j.data.prepared.media) || media.info
      media.prepareMsg = '已整理：发布时会用当前标题/简介和 MediaInfo；点上方「简介」里的「最终简介预览」查看。'
      toast('发布资料已整理' + (media.info && media.info.summary ? '：' + media.info.summary : ''))
      await refresh()
      media.prepareMsg = '已整理：发布时会用当前标题/简介和 MediaInfo；点上方「简介」里的「最终简介预览」查看。'
    } else {
      media.prepareMsg = '整理失败：' + ((j && j.error && j.error.message) || '服务端没返回结果')
      toast(media.prepareMsg)
    }
  } catch (e) {
    reportError('Queue.prepareRelease', e)
    media.prepareMsg = '整理请求发不出去'
    toast(media.prepareMsg)
  }
  media.preparing = false
}
async function shootMedia() {
  if (!sel.value || media.shooting) return
  if (!media.path.trim()) { toast('先填媒体文件路径'); return }
  media.shooting = true
  try {
    const j = await (await fetch('/api/media/shots', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: media.path.trim(), count: 3, width: 1280 })
    })).json()
    if (!j || !j.ok) { toast((j && j.error && j.error.message) || '截图失败'); media.shooting = false; return }
    const shots = (j.data.items || []).map(x => ({ name: x.name, url: x.dataUrl }))
    if (!shots.length) { toast('没有生成截图'); media.shooting = false; return }
    const add = await (await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/shots', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ shots })
    })).json()
    toast(add && add.ok ? ('已加入 ' + shots.length + ' 张截图') : ((add && add.error && add.error.message) || '截图没存进队列'))
    await refresh()
  } catch (e) { toast('截图请求发不出去') }
  media.shooting = false
}
async function makeMediaTorrent() {
  if (!sel.value || media.making) return
  if (!media.path.trim()) { toast('先填媒体文件路径'); return }
  if (!media.announce.trim()) { toast('先填 tracker announce'); return }
  media.making = true
  try {
    const j = await (await fetch('/api/media/torrent', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: media.path.trim(), announce: media.announce.trim(), name: sel.value.title })
    })).json()
    if (j && j.ok) { media.torrent = j.data; toast('种子已生成：' + j.data.infohash) }
    else toast((j && j.error && j.error.message) || '生成种子失败')
  } catch (e) { toast('种子请求发不出去') }
  media.making = false
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
  } catch (e) { toast('批量批准请求发不出去') }
  busy.approve = false
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
      toast(j && j.ok ? '已发布 ' + j.data.changed + ' 条' + (j.data.skipped ? '，跳过 ' + j.data.skipped + ' 条' : '') : ((j && j.error && j.error.message) || '批量发布失败'))
      await refresh()
    } catch (e) { toast('批量发布请求发不出去') }
    busy.publish = false
  }
  if (go) go('批量发布', '会把「已通过」的条目逐条走发布链路；真发布关闭时会逐条失败。继续？', fn)
  else fn()
}
function pickFiles() { if (filePick.value) filePick.value.click() }
function shrink(file) {
  return new Promise(resolve => {
    const fr = new FileReader()
    fr.onload = () => {
      const img = new Image()
      img.onload = () => {
        try {
          const max = 1600
          const scale = Math.min(1, max / Math.max(img.width, img.height))
          const cw = Math.round(img.width * scale), ch = Math.round(img.height * scale)
          const cv = document.createElement('canvas')
          cv.width = cw; cv.height = ch
          cv.getContext('2d').drawImage(img, 0, 0, cw, ch)
          resolve(cv.toDataURL('image/jpeg', 0.82))
        } catch (e) { resolve(String(fr.result)) }
      }
      img.onerror = () => resolve(String(fr.result))
      img.src = String(fr.result)
    }
    fr.readAsDataURL(file)
  })
}
async function onFiles(e) {
  const files = Array.from(e.target.files || []).slice(0, 6)
  if (!sel.value || !files.length) return
  const shots = []
  for (const f of files) shots.push({ name: f.name, url: await shrink(f) })
  try {
    const j = await (await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/shots', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ shots })
    })).json()
    toast(j && j.ok ? '已加入 ' + shots.length + ' 张截图' : ((j && j.error && j.error.message) || '上传失败'))
    await refresh()
  } catch (err) { toast('截图上传失败') }
  e.target.value = ''
}
async function removeShot(i) {
  if (!sel.value) return
  try {
    await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/shots/' + i, { method: 'DELETE', credentials: 'same-origin' })
    await refresh()
  } catch (e) { toast('删除失败') }
}
function ensureQueue() { if (viewVisible('queue') && loggedIn()) { loadSites(); loadMediaConfig(); loadQueuePage() } }
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
.qd-preflight { display:flex; flex-direction:column; gap:5px; }
.qd-preflight-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.qd-preflight-head h3 { margin:0; }
.qd-preflight-row { display:flex; flex-wrap:wrap; gap:2px 14px; font-size:11.5px; color:var(--muted); }
.qd-preflight-row b { color:var(--text); font-weight:600; }
.qd-preflight-row em { font-style:normal; }
.qd-ok { color:var(--green); }
.shot { position: relative; }
.shot-del {
  position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
  border: 0; border-radius: 50%; background: rgba(0,0,0,.6); color: #fff;
  font-size: 12px; line-height: 18px; cursor: pointer;
}

/* Queue 页面样式：迁入 scoped，shared/shell 保留全局 */
.queue-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.queue-bar .spacer { flex: 1; }
.queue-split { flex: 1; min-height: 0; display: flex; gap: 12px; }
.queue-list { width: 320px; flex: 0 0 320px; background: #fff; border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; }
.queue-items { flex: 1; overflow-y: auto; padding: 6px; }
.qd-advanced { margin-top: 4px; }
.qd-advanced > summary { cursor: pointer; font-size: 11.5px; color: var(--muted); padding: 6px 0; }
.qd-advanced > summary:hover { color: var(--accent); }
.qd-advanced > .sd-card { margin-top: 4px; }
.qd-advanced-sub { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--line); }
.qd-advanced-sub > summary { cursor: pointer; font-size: 11.5px; color: var(--muted); }
.qd-advanced-sub > summary:hover { color: var(--accent); }
.qd-meta-msg { margin-top: -2px; }
.qd-desc-head, .qd-media-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.qd-desc-head h3, .qd-media-head h3 { margin: 0; }
.qd-final-desc { margin-top: 8px; font-size: 12px; }
.qd-final-desc > summary { cursor: pointer; color: var(--muted); font-size: 11.5px; }
.qd-final-desc > summary:hover { color: var(--accent); }
.qd-final-desc pre { white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto; background: var(--panel-2); padding: 10px; border-radius: 8px; font-size: 11.5px; }
.qd-download { padding: 4px 0 6px; }
.qd-path-row { display: flex; align-items: center; gap: 6px; flex: 1 1 auto; min-width: 0; }
.qd-path-row .input { flex: 1 1 auto; min-width: 0; }
.queue-page { flex: 0 0 auto; padding: 8px 10px 10px; border-top: 1px solid var(--line); background: #fff; }
.queue-pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 9px; background: #fafbfd; }
.queue-pager .pager-link { font-size: 11.5px; color: var(--accent); cursor: pointer; user-select: none; white-space: nowrap; }
.queue-pager .pager-link.off { color: var(--muted-2); cursor: default; opacity: .55; }
.queue-pager .pager-meta { flex: 1; text-align: center; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.q-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 0; background: none; padding: 9px 10px; border-radius: 10px; cursor: pointer; font: inherit; }
.q-item:hover { background: #f7f8fa; }
.q-item.on { background: var(--accent-soft); }
.q-title { flex: 1; min-width: 0; }
.q-title b { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-title i { display: block; margin-top: 2px; font-style: normal; font-size: 10.5px; color: var(--muted-2); }
.queue-detail { flex: 1; min-width: 0; background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 20px 22px 16px; display: flex; flex-direction: column; overflow: hidden; }
.qd-body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.qd-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
.qd-head { display: flex; align-items: center; gap: 12px; }
.qd-id { min-width: 0; }
.qd-id h2 { margin: 0; font-size: 15.5px; font-weight: 600; }
.qd-field { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 0; font-size: 12.5px; color: var(--muted); }
.qd-field .input, .qd-field .select { width: 220px; height: 30px; font-size: 12px; }
.qd-actions { display: flex; align-items: center; gap: 8px; padding-top: 12px; margin-top: 10px; border-top: 1px solid var(--line); }
.qd-actions .spacer { flex: 1; }
.qd-field .input, .qd-field .select { height: 32px; }
.queue-detail { display: flex; flex-direction: column; min-height: 0; }
.qd-head { align-items: flex-start; gap: 12px; }
.qd-title-row { display: flex; align-items: center; gap: 8px; }
.qd-title-row h2 { font-size: 16px; }
.qd-meta { display: flex; align-items: center; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
.qd-meta span { font-size: 11px; color: var(--muted-2); }
.qd-meta b { margin-left: 5px; font-size: 11.5px; font-weight: 500; color: var(--ink); }
.qd-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 10px; margin-top: 12px; align-content: start; }
.qd-grid .sd-card { padding: 12px 14px 10px; border-radius: 10px; }
.qd-grid .sd-card h3 { margin-bottom: 6px; font-size: 10px; letter-spacing: .6px; }
.qd-field { padding: 3px 0; font-size: 12px; }
.qd-field .input, .qd-field .select { width: 250px; height: 28px; font-size: 11.5px; }
.qd-grid .sd-note { width: 100%; height: 92px; font-size: 11.5px; line-height: 1.5; }
.qd-grid .shots { gap: 6px; }
.qd-grid .shot { width: 62px; height: 42px; font-size: 10px; }
.qd-status { margin-top: 10px; }
.qd-targets-foot { margin-top: auto; display: flex; align-items: flex-start; gap: 8px; padding-top: 10px; border-top: 1px solid var(--line); flex-wrap: wrap; }
.qd-targets-lbl { font-size: 11px; color: var(--muted); white-space: nowrap; padding-top: 4px; }
.qd-targets-foot .pick-row { flex: 1 1 auto; min-width: 0; }
.qd-actions { margin-top: 0; padding-top: 8px; border-top: 0; }
.qd-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; min-height: 26px; align-items: center; }
.qd-warn { flex-basis: 100%; font-size: 11.5px; color: #b45309; line-height: 1.6; }
@media (max-width: 900px) {
.queue-bar { flex-wrap: wrap; gap: 8px; }
}
@media (max-width: 900px) {
.queue-split { flex-direction: column; gap: 10px; }
}
@media (max-width: 900px) {
.queue-list, .queue-detail { width: 100%; max-width: none; }
.qd-head { flex-direction: column; gap: 6px; }
.qd-id { width: 100%; }
.qd-meta { margin-top: 4px; gap: 6px 14px; }
}

.q-item { padding: 6px 9px; }
.qd-head { margin-bottom: 2px; }
.qd-field { padding: 4px 0; font-size: 12px; }
.qd-field .input, .qd-field .select { height: 30px; }
.qd-actions { padding-top: 8px; margin-top: 8px; }
.queue-list { width: 264px; flex: 0 0 264px; }
.q-item { padding: 7px 10px; gap: 8px; }
.q-title b { font-size: 12px; }
.q-title i { font-size: 10px; margin-top: 1px; }
.queue-list { max-height: calc(100vh - 210px); }
.queue-split { align-items: stretch; height: calc(100vh - 208px); }
.qd-grid { flex: 1; min-height: 0; }
.qd-actions { margin-top: 10px; }
.qd-grid { grid-template-rows: minmax(0, 1fr); align-content: stretch; }
.qd-shots { margin-top: auto; }
.queue-detail { align-self: flex-start; display: block; }
.qd-grid { flex: none; grid-template-rows: auto; align-content: start; }
.qd-shots { margin-top: 0; }
.qd-field { display: flex; align-items: center; gap: 12px; }
.qd-field > span { flex: 0 0 48px; }
.qd-field .input, .qd-field .select { flex: 1 1 auto; width: auto; min-width: 0; }
.queue-split { height: auto; flex: 0 0 auto; align-items: flex-start; }
.queue-list { max-height: none; }
.qd-side .sd-card, .qd-shots { height: 152px; display: flex; flex-direction: column; }
.qd-shots { height: auto; flex: 1 1 auto; justify-content: center; }
.qd-grid { grid-template-rows: minmax(0, 1fr); }
.qd-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px; align-items: stretch; height: auto; }
.qd-pubinfo { grid-column: 1 / -1; }
.qd-desc-card { display: flex; flex-direction: column; }
.qd-desc-card textarea { flex: 1; height: auto; min-height: 84px; }
.qd-shots { display: flex; flex-direction: column; justify-content: flex-start; height: auto; }
.queue-split { align-items: stretch; }
.queue-detail { align-self: stretch; display: flex; flex-direction: column; }
.qd-actions { margin-top: auto; }

@media (max-width: 600px) {
.qd-grid { grid-template-columns: 1fr; min-width: 0; }
.qd-grid .sd-card { min-width: 0; }
}

@media (max-width: 900px) {
.queue-split { height: auto; flex: 0 0 auto; align-items: stretch; }
.queue-list, .queue-detail { width: 100%; max-width: none; flex: 0 0 auto; }
.queue-list { max-height: none; }
}

/* 桌面：固定高度双栏，列表/详情各自滚动，页脚不会被长列表推走 */
@media (min-width: 901px) {
  :global(.view[data-view="queue"]) { height: calc(100vh - 150px); min-height: 520px; display: flex; flex-direction: column; justify-content: flex-start; overflow: hidden; }
  .queue-split { flex: 1 1 auto; height: auto; min-height: 0; align-items: stretch; }
  .queue-list { height: auto; max-height: none; min-height: 0; flex: 0 0 264px; overflow: hidden; }
  .queue-items { min-height: 0; overflow-y: auto; }
  .queue-detail { height: auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .qd-scroll { min-height: 0; overflow-y: auto; }
}
/* 手机：列表给固定视窗，详情在下面；页脚仍在内容末尾 */
@media (max-width: 900px) {
  .queue-list { max-height: 46vh; }
  .queue-items { overflow-y: auto; }
}
:global(.view[data-view="queue"]) { justify-content: flex-start; overflow: hidden; }
/* 手机端让整页自然滚动，避免详情内部滚动把顶部查重卡住 */
@media (max-width: 900px) {
  :global(.view[data-view="queue"]) { height: auto; min-height: calc(100vh - 150px); justify-content: flex-start; }
  .queue-split { height: auto !important; }
  .queue-detail { height: auto; overflow: visible; }
  .qd-body { display: block; }
  .qd-scroll { height: auto; overflow: visible; }
}

/* Queue 媒体截图：页面专属 */
.shots { display: flex; gap: 8px; }
.shot { width: 96px; height: 60px; border-radius: 8px; background: var(--panel-2); display: grid; place-items: center; font-size: 11px; color: var(--muted-2); border: 1px dashed var(--line-2); }
.shot.add { cursor: pointer; }
.shot.add:hover { color: var(--accent); border-color: var(--accent); }
.shot.has { padding: 0; overflow: hidden; border-style: solid; border-color: var(--line-2); }
.shot.has img { width: 100%; height: 100%; object-fit: cover; display: block; }
.shot.has span { display: none; }
.qd-stage { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); }
.qd-stage .t-sub { font-size: 11px; }
.qd-stage-err { flex: 1 1 100%; font-size: 11.5px; color: var(--red); line-height: 1.5; overflow-wrap: anywhere; }
.qd-targets-row { align-items: flex-start; }
.qd-target-chips { justify-content: flex-start; gap: 6px; }
.qd-target-check { display: none; }
.qd-target-results { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.qd-target-result { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 9px; background: #fff; }
.qd-target-result .qd-stage-err { flex: 1 1 100%; }
.qd-media-info { flex-direction: column; align-items: stretch; gap: 6px; }
.qd-media-info > span { flex: none; }
.qd-media-info .sd-note { width: 100%; height: auto; min-height: 78px; }
</style>
