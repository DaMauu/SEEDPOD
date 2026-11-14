<template>
  <div class="queue-bar">
    <div class="seg-tabs" id="queue-tabs">
      <button v-for="t in tabs" :key="t.v" type="button" :class="{ active: tab === t.v }" @click="setTab(t.v)">{{ t.label }}</button>
    </div>
    <input v-model="q" class="input slim" id="queue-q" placeholder="搜标题 / 中文名" style="width:220px" @input="debounced">
    <div class="spacer"></div>
    <span class="t-sub" id="queue-count">共 {{ matched }} 条</span>
    <button class="btn ghost slim" id="q-bulkcheck" type="button" :disabled="busy.check" @click="bulkCheck">{{ busy.check ? '查重中…' : '批量查重' }}</button>
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
          <span class="badge" :class="tone(it.status)">{{ label(it.status) }}</span>
        </button>
      </div>
      <div class="queue-page">
        <button class="btn ghost slim" type="button" :disabled="page <= 1" @click="load(page - 1)">上一页</button>
        <span class="t-sub">第 {{ page }} / {{ pages }} 页</span>
        <button class="btn ghost slim" type="button" :disabled="page >= pages" @click="load(page + 1)">下一页</button>
      </div>
    </aside>

    <div class="queue-detail" id="queue-detail">
      <div v-if="!sel" class="sites-empty">选一条看发布预览</div>
      <div v-else>
        <div class="qd-head">
          <div class="qd-id">
            <div class="qd-title-row">
              <h2>{{ sel.cn || sel.title }}</h2>
              <span class="badge" :class="tone(sel.status)">{{ label(sel.status) }}</span>
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

        <div class="qd-grid">
          <section class="sd-card qd-pubinfo">
            <h3>发布信息</h3>
            <div class="qd-field">
              <span>目标站</span>
              <select v-model="form.targetSite" class="input">
                <option value="">未选择</option>
                <option v-if="form.targetSite && !sites.some(s => s.name === form.targetSite)" :value="form.targetSite">{{ form.targetSite }}</option>
                <option v-for="s in sites" :key="s.name" :value="s.name">{{ s.title || s.name }}</option>
              </select>
            </div>
            <div class="qd-field"><span>标题</span><input v-model="form.title" class="input"></div>
            <div class="qd-field"><span>副标题</span><input v-model="form.cn" class="input"></div>
            <div class="qd-field">
              <span>图床</span>
              <select v-model="form.imageHost" class="input">
                <option v-for="h in hosts" :key="h">{{ h }}</option>
              </select>
            </div>
            <div class="qd-field"><span>匿名发布</span><input v-model="form.anonymous" type="checkbox"></div>
            <div class="qd-field"><span>查重</span><b :class="(sel.checkCls || '') + '-t'">{{ sel.check || '' }}</b></div>
          </section>

          <section class="sd-card qd-desc-card">
            <h3>简介</h3>
            <textarea v-model="form.intro" class="input sd-note" rows="3"></textarea>
            <div class="qd-tags">
              <template v-if="tags.chips.length">
                <em v-for="c in tags.chips" :key="c" class="chip np">{{ c }}</em>
              </template>
              <span v-else class="soft">点「草稿预览」后显示发布标签</span>
              <div v-if="tags.warnings.length" class="qd-warn">缺项：{{ tags.warnings.join('；') }}</div>
            </div>
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
          </section>

          <section class="sd-card qd-media">
            <h3>媒体</h3>
            <div class="qd-field">
              <span>文件</span>
              <input v-model="media.path" class="input" :placeholder="media.root ? media.root + '/...' : '服务器上的文件路径'">
            </div>
            <div class="qd-field">
              <span>Tracker</span>
              <input v-model="media.announce" class="input" placeholder="http://tracker.example/announce">
            </div>
            <div class="qd-actions">
              <button class="btn ghost slim" type="button" :disabled="media.probing" @click="probeMedia">{{ media.probing ? '探测中…' : '探测' }}</button>
              <button class="btn ghost slim" type="button" :disabled="media.shooting" @click="shootMedia">{{ media.shooting ? '截图中…' : '生成截图' }}</button>
              <button class="btn ghost slim" type="button" :disabled="media.making" @click="makeMediaTorrent">{{ media.making ? '生成中…' : '生成种子' }}</button>
            </div>
            <div v-if="media.probe" class="t-sub">{{ media.probe.summary }} · {{ media.probe.durationText }} · {{ fmtSize(media.probe.size) }}</div>
            <div v-if="media.torrent" class="t-sub">种子 {{ String(media.torrent.infohash).slice(0, 12) }}… · {{ fmtSize(media.torrent.size) }}</div>
            <div v-else class="soft">先填 {{ media.root || 'PTA_MEDIA_ROOT' }} 下的文件路径；生成种子后可随“提交目标站”一起用。</div>
          </section>
        </div>

        <div v-if="sel.pubMsg" class="qd-status" :class="sel.status === 'failed' ? 'bad' : 'ok'">{{ sel.pubMsg }}</div>
        <div v-if="sel.targetUpload" class="qd-status" :class="sel.targetVerify && sel.targetVerify.found ? 'ok' : ''">
          目标站 {{ sel.targetUpload.host }} · {{ sel.targetUpload.message || '已提交' }}
          <a v-if="sel.targetUpload.detailsUrl" :href="sel.targetUpload.detailsUrl" target="_blank" rel="noopener noreferrer">详情</a>
          <span v-if="sel.targetVerify"> · 回查：{{ sel.targetVerify.found ? '已找到' : '未找到' }}</span>
        </div>

        <div class="qd-actions">
          <button class="btn primary slim" type="button" :disabled="busy.act" @click="act('publish')">{{ sel.status === 'failed' ? '重试发布' : '通过并发布' }}</button>
          <button class="btn ghost slim" type="button" :disabled="busy.target || !form.targetSite" title="把种子提交到目标站；真发布关闭时会提示" @click="submitTarget">{{ busy.target ? '提交中…' : '提交目标站' }}</button>
          <button class="btn ghost slim" type="button" :disabled="busy.act" @click="act('reject')">驳回</button>
          <button class="btn ghost slim" type="button" :disabled="busy.act" @click="preview">草稿预览</button>
          <button class="btn ghost slim" type="button" :disabled="busy.act" @click="fetchMeta">查资料</button>
          <div class="spacer"></div>
          <input v-model="reason" class="input slim" placeholder="驳回理由（可留空）" style="width:200px">
          <button class="btn ghost slim" type="button" :disabled="busy.act" @click="act('skip')">跳过</button>
        </div>
      </div>
    </div>
  </div>

  <input ref="filePick" type="file" accept="image/*" multiple hidden @change="onFiles">
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'

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
const form = reactive({ title: '', cn: '', intro: '', targetSite: '', imageHost: '站内', anonymous: false })
const tags = reactive({ chips: [], warnings: [] })
const busy = reactive({ act: false, check: false, approve: false, publish: false, target: false })
const media = reactive({ path: '', announce: '', probing: false, shooting: false, making: false, probe: null, torrent: null, root: '' })
let mediaCfgLoaded = false
const filePick = ref(null)
let timer = null
let qTimer = null
let loaded = false

const LABELS = {
  pending: ['待确认', 'amber'], approved: ['已通过', 'green'], published: ['已发布', 'green'],
  failed: ['失败', 'red'], rejected: ['已驳回', 'gray'], skipped: ['已跳过', 'gray'], dupe: ['重复', 'amber']
}
function label(s) { return (LABELS[s] || ['未知', 'gray'])[0] }
function tone(s) { return (LABELS[s] || ['未知', 'gray'])[1] }
function sub(it) {
  return (it.cn ? it.cn + ' · ' : '') + (it.res || '') + ' · ' + (it.size || '') + (it.targetSite ? ' · 目标 ' + it.targetSite : '')
}
function toast(msg) {
  if (window.PTA && window.PTA.toast) window.PTA.toast(msg)
}
function loggedIn() { return !document.querySelector('#login-mask') }
function visible() {
  const v = document.querySelector('[data-view="queue"]')
  return !!(v && !v.hidden)
}
async function loadSites() {
  try {
    const j = await (await fetch('/api/sites', { credentials: 'same-origin' })).json()
    if (j && j.ok && j.data) sites.value = j.data.sites || []
  } catch (e) {}
}
async function load(p) {
  if (!loggedIn()) return
  if (p) page.value = p
  const status = tab.value === 'all' ? '' : tab.value === 'approved' ? 'approved,published' : tab.value
  const qs = new URLSearchParams({ limit: '100', offset: String((page.value - 1) * 100) })
  if (status) qs.set('status', status)
  if (q.value.trim()) qs.set('q', q.value.trim())
  try {
    const j = await (await fetch('/api/queue?' + qs.toString(), { credentials: 'same-origin' })).json()
    if (!j || !j.ok) return
    items.value = j.data.items || []
    matched.value = Number(j.data.matched) || 0
    pages.value = Math.max(1, Math.ceil(matched.value / 100))
    if (page.value > pages.value) page.value = pages.value
    loaded = true
    if (!sel.value || !items.value.some(x => x.id === sel.value.id)) {
      if (items.value.length) select(items.value[0].id)
      else sel.value = null
    }
  } catch (e) {}
}
async function select(id) {
  try {
    const j = await (await fetch('/api/queue/' + encodeURIComponent(id), { credentials: 'same-origin' })).json()
    if (!j || !j.ok) return
    sel.value = j.data
    media.path = ''
    media.announce = ''
    media.probe = null
    media.torrent = null
    loadMediaConfig()
    form.title = j.data.title || ''
    form.cn = j.data.cn || ''
    form.intro = j.data.intro || ''
    form.targetSite = j.data.targetSite || ''
    form.imageHost = j.data.imageHost || '站内'
    form.anonymous = !!j.data.anonymous
    tags.chips = []
    tags.warnings = []
    reason.value = ''
  } catch (e) {}
}
function setTab(v) { tab.value = v; page.value = 1; load(1) }
function debounced() {
  if (qTimer) clearTimeout(qTimer)
  qTimer = setTimeout(() => { page.value = 1; load(1) }, 300)
}
async function refresh() {
  if (sel.value) await select(sel.value.id)
  await load()
}
async function apiAction(body) {
  const r = await fetch('/api/queue/' + encodeURIComponent(sel.value.id) + '/action', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { status: r.status, body: await r.json().catch(() => null) }
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
    if (j && j.ok) toast(action === 'publish' ? '已发布：' + (sel.value.cn || sel.value.title) : '操作完成')
    else toast((j && j.error && j.error.message) || ('操作失败 ' + r.status))
    await refresh()
  } catch (e) { toast('请求发不出去') }
  busy.act = false
}
async function fetchMeta() {
  if (!sel.value) return
  try {
    const j = await (await fetch('/api/meta/fetch', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: sel.value.title, year: sel.value.year, type: sel.value.cat === 'tv' ? 'tv' : 'movie' })
    })).json()
    if (j && j.ok && j.data) {
      if (j.data.title) form.cn = j.data.title
      if (j.data.overview) form.intro = j.data.overview
      toast('已填入资料 · ' + j.provider)
    } else toast((j && j.error && j.error.message) || '没查到资料')
  } catch (e) { toast('资料请求发不出去') }
}
async function submitTarget() {
  if (!sel.value || busy.target) return
  const host = form.targetSite || sel.value.targetSite
  if (!host) { toast('先选目标站'); return }
  busy.target = true
  try {
    const body = { queueId: sel.value.id, dryRun: false }
    if (media.torrent && media.torrent.base64) body.torrentBase64 = media.torrent.base64
    const r = await fetch('/api/targets/' + encodeURIComponent(host) + '/upload', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    const j = await r.json().catch(() => null)
    if (j && j.ok) {
      const v = j.data.verify
      toast('已提交目标站' + (v ? (v.found ? '，回查已找到' : '，回查暂未找到') : ''))
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
  } catch (e) {}
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
async function preview() {
  if (!sel.value) return
  try {
    const j = await (await fetch('/api/publish/preview?id=' + encodeURIComponent(sel.value.id), { credentials: 'same-origin' })).json()
    if (!j || !j.ok) { toast((j && j.error && j.error.message) || '草稿生成失败'); return }
    const d = j.data
    form.title = d.title || form.title
    form.cn = d.subtitle || form.cn
    form.intro = d.description || form.intro
    const t = d.tags || {}
    tags.chips = Object.keys(t).filter(k => t[k]).map(k => t[k]).filter((v, i, a) => a.indexOf(v) === i)
    tags.warnings = (d.warnings || []).slice()
    toast(d.ready ? '草稿齐了' : '草稿有缺项：' + tags.warnings.join(' · '))
  } catch (e) { toast('草稿请求发不出去') }
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
    await load()
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
async function bulkCheck() {
  if (busy.check) return
  const list = items.value.filter(x => x.status === 'pending' || x.status === 'approved')
  if (!list.length) { toast('当前列表没有可查重的条目'); return }
  busy.check = true
  let dup = 0
  for (const it of list) {
    try {
      const j = await (await fetch('/api/queue/' + encodeURIComponent(it.id) + '/check', { method: 'POST', credentials: 'same-origin' })).json()
      if (j && j.ok && j.data.duplicate) dup++
    } catch (e) {}
  }
  busy.check = false
  toast('查重完成：' + list.length + ' 条，重复 ' + dup + ' 条')
  await refresh()
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
function ensure() { if (visible() && loggedIn()) { loadSites(); loadMediaConfig(); load() } }
onMounted(() => {
  window.addEventListener('hashchange', ensure)
  timer = setInterval(() => { if (!loaded) ensure() }, 1500)
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  if (timer) clearInterval(timer)
  if (qTimer) clearTimeout(qTimer)
})
</script>

<style scoped>
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
.q-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 0; background: none; padding: 9px 10px; border-radius: 10px; cursor: pointer; font: inherit; }
.q-item:hover { background: #f7f8fa; }
.q-item.on { background: var(--accent-soft); }
.q-title { flex: 1; min-width: 0; }
.q-title b { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-title i { display: block; margin-top: 2px; font-style: normal; font-size: 10.5px; color: var(--muted-2); }
.queue-detail { flex: 1; min-width: 0; background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 20px 22px 16px; display: flex; flex-direction: column; overflow: hidden; }
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
.qd-actions { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--line); }
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
</style>
