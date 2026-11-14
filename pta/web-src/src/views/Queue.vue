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
async function submitTarget() {
  if (!sel.value || busy.target) return
  const host = form.targetSite || sel.value.targetSite
  if (!host) { toast('先选目标站'); return }
  busy.target = true
  try {
    const r = await fetch('/api/targets/' + encodeURIComponent(host) + '/upload', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queueId: sel.value.id, dryRun: false })
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
function ensure() { if (visible() && loggedIn()) { loadSites(); load() } }
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
</style>
