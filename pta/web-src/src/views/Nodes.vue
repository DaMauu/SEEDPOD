<template>
  <section class="drawer open" data-i="nodes" data-name="下载器">
    <div class="drawer-head">
      <div class="drawer-t">
        <div class="drawer-title">下载器</div>
        <div class="drawer-desc">qBittorrent 的 Web 地址；密码只存密文，不回显。</div>
      </div>
      <div class="drawer-head-right">
        <span class="drawer-meta" id="nodes-drawer-meta">{{ meta }}</span>
        <button type="button" class="btn primary slim" id="node-add" @click="openAdd">新增下载器</button>
      </div>
    </div>
    <div class="drawer-body drawer-body-flush">
      <div class="nodes-inner">
        <div class="nodes-sum" id="nodes-sum">
          <span>共 {{ nodes.length }} 台</span>
          <span>{{ onlineCount }} 在线</span>
          <span v-if="freeAll">余量 {{ fmtBytes(freeAll) }}</span>
        </div>
        <div class="nodes-grid" id="nodes-grid">
          <div v-if="!nodes.length" class="empty">还没有下载器，点右上角「新增下载器」，填 qBittorrent 的地址和账号密码。</div>
          <div v-for="nd in nodes" :key="nd.id" class="node-row" :class="tone(nd)">
            <div class="nr-name">
              <b>{{ nd.name || hostOf(nd.url) }}</b>
              <span class="nr-tag">{{ nd.kind === 'watch' ? 'watch' : (nd.user || 'qB') }}</span>
            </div>
            <div class="nr-host mono">{{ nd.kind === 'watch' ? nd.watchPath : hostOf(nd.url) }}</div>
            <div class="nr-disk">
              <span class="nr-cap">{{ diskTxt(nd) }}</span>
              <div v-if="totalOf(nd)" class="nr-bar"><i :style="{ width: pct(nd).toFixed(0) + '%' }"></i></div>
              <span v-if="totalOf(nd)" class="nr-pct">已用 {{ pct(nd).toFixed(0) }}%</span>
            </div>
            <span v-if="online(nd)" class="badge green">在线</span>
            <span v-else class="badge red">离线</span>
            <button class="link-btn nr-set" type="button" @click="openEdit(nd)">设置</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <Teleport to="body">
    <div v-if="modalOpen" class="modal-mask" id="node-modal-vue">
      <div class="modal">
        <div class="modal-head">
          <h2>{{ editing ? '下载器设置' : '新增下载器' }}</h2>
          <button class="btn ghost slim" type="button" @click="modalOpen = false">关闭</button>
        </div>
        <label class="field"><span>名称</span>
          <input v-model="form.name" class="input" placeholder="留空就用地址"></label>
        <label class="field"><span>类型</span>
          <select v-model="form.kind" class="select">
            <option value="qb">qBittorrent</option>
            <option value="rtorrent">rTorrent</option>
            <option value="deluge">Deluge</option>
            <option value="watch">watch 目录</option>
          </select></label>
        <template v-if="form.kind === 'qb'">
          <label class="field"><span>Web 地址</span>
            <input v-model="form.url" class="input" placeholder="http://主机:端口，qB 的 Web 地址就是它的 API 地址"></label>
          <div class="modal-two">
            <label class="field"><span>用户名（qB / rTorrent）</span>
              <input v-model="form.user" class="input" placeholder="admin"></label>
            <label class="field"><span>密码（qB / Deluge / rTorrent）</span>
              <input v-model="form.pass" class="input" type="password" :placeholder="editing ? '留空表示不改已存的密码' : '不设置就留空'" autocomplete="new-password"></label>
          </div>
          <div class="set-field">
            <div class="lbl"><span>免密登录</span></div>
            <div class="ctl">
              <button class="switch" :class="{ on: form.disableAuth }" type="button" @click="form.disableAuth = !form.disableAuth"><i></i></button>
            </div>
          </div>
        </template>
        <label v-else class="field"><span>watch 目录</span>
          <input v-model="form.watchPath" class="input" placeholder="/data/watch">
          <span class="soft">绝对路径；外部客户端监视这个目录，种子写入后由它接管。</span></label>
        <div class="sd-cookie-bar">
          <button class="btn ghost slim" type="button" :disabled="busy.test" @click="testConn">{{ busy.test ? '连接中…' : '测试连接' }}</button>
          <span class="sd-cookie-res">{{ testResult || '还没测试' }}</span>
        </div>
        <div v-if="editing && form.kind === 'qb'" class="nd-cats">
          <div class="lbl"><span>下载器分类</span><i>只读：发种暂不按分类</i></div>
          <div class="nd-cats-list" id="nd-cat-list">
            <span v-for="c in cats" :key="c.name" class="cat-chip">{{ c.name }}<i>{{ c.count }}</i></span>
            <span v-if="!cats.length" class="soft">{{ catsMsg || '还没读取' }}</span>
          </div>
          <button class="btn ghost slim" type="button" :disabled="busy.cats" @click="loadCats()">{{ busy.cats ? '读取中…' : '读取分类' }}</button>
        </div>
        <div class="modal-foot">
          <button v-if="editing" class="btn ghost slim danger" type="button" :disabled="busy.save" @click="removeNode">删除</button>
          <div class="spacer"></div>
          <button class="btn ghost slim" type="button" @click="modalOpen = false">取消</button>
          <button class="btn primary slim" type="button" :disabled="busy.save" @click="save">{{ busy.save ? '保存中…' : '保存' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { fmtBytes } from '../utils/format'
import { reportError } from '../utils/errors'
import { toast, confirmBox, viewVisible } from '../utils/ui'

const nodes = ref([])
const modalOpen = ref(false)
const editing = ref('')
const form = reactive({ kind: 'qb', name: '', url: '', user: '', pass: '', disableAuth: false, watchPath: '' })
const busy = reactive({ save: false, test: false, cats: false })
const testResult = ref('')
const cats = ref([])
const catsMsg = ref('')
let timer = null

function hostOf(url) {
  return String(url || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
}
function freeOf(nd) { return Number(nd.lastProbe && nd.lastProbe.freeSpace) || 0 }
function totalOf(nd) { return Number(nd.lastProbe && nd.lastProbe.totalSpace) || 0 }
function online(nd) { return !!(nd.lastProbe && nd.lastProbe.pass) }
function pct(nd) {
  const t = totalOf(nd)
  if (!t) return 0
  return Math.max(0, Math.min(100, (t - freeOf(nd)) / t * 100))
}
function tone(nd) { return !online(nd) ? 'off' : pct(nd) > 85 ? 'warn' : 'ok' }
function diskTxt(nd) {
  const f = freeOf(nd), t = totalOf(nd)
  if (!f && !t) return nd.lastProbe ? '—' : '还没探测'
  return fmtBytes(f) + ' 剩余' + (t ? ' / 共 ' + fmtBytes(t) : '')
}
const onlineCount = computed(() => nodes.value.filter(online).length)
const freeAll = computed(() => nodes.value.reduce((a, nd) => a + freeOf(nd), 0))
const meta = computed(() => nodes.value.length
  ? (onlineCount.value + ' / ' + nodes.value.length + ' 在线' + (freeAll.value ? ' · 余量 ' + fmtBytes(freeAll.value) : ''))
  : '还没有下载器')

async function load() {
  try {
    const j = await (await fetch('/api/downloaders', { credentials: 'same-origin' })).json()
    if (j && j.ok && Array.isArray(j.data)) {
      nodes.value = j.data
      window.__ptaDownloaderCount = j.data.length
      if (window.__ptaPaintTopbar) window.__ptaPaintTopbar()
    }
  } catch (e) { reportError('Nodes', e) }
}
function ensure() { load() }
function openAdd() {
  editing.value = ''
  Object.assign(form, { kind: 'qb', name: '', url: '', user: '', pass: '', disableAuth: false, watchPath: '' })
  testResult.value = ''
  cats.value = []
  catsMsg.value = ''
  modalOpen.value = true
}
function openEdit(nd) {
  editing.value = nd.id
  Object.assign(form, {
    kind: nd.kind || 'qb',
    name: nd.name || '',
    url: nd.url || '',
    user: nd.user || '',
    pass: '',
    disableAuth: !!nd.disableAuth,
    watchPath: nd.watchPath || ''
  })
  testResult.value = ''
  cats.value = []
  catsMsg.value = ''
  modalOpen.value = true
  if (form.kind === 'qb') loadCats(nd)
}
function normUrl(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'http://' + s
  return s.replace(/\/+$/, '')
}
async function save() {
  if (busy.save) return
  const kind = form.kind === 'watch' ? 'watch' : 'qb'
  const body = { kind }
  if (kind === 'watch') {
    const wp = String(form.watchPath || '').trim()
    if (!wp || wp[0] !== '/') { toast('watch 目录要填绝对路径'); return }
    body.watchPath = wp
    body.name = String(form.name || '').trim() || wp.split('/').filter(Boolean).pop() || 'watch'
  } else {
    const url = normUrl(form.url)
    if (!url) { toast('先填地址（下载器 Web 地址）'); return }
    if (!/^https?:\/\/[^\s/]+/i.test(url)) { toast('地址要像 http://主机:端口'); return }
    body.name = String(form.name || '').trim() || hostOf(url)
    body.url = url
    body.user = String(form.user || '').trim()
    body.disableAuth = !!form.disableAuth
    if (form.pass) body.pass = form.pass
  }
  busy.save = true
  const res = await fetch(editing.value ? '/api/downloaders/' + encodeURIComponent(editing.value) : '/api/downloaders', {
    method: editing.value ? 'PUT' : 'POST', credentials: 'same-origin',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json()).catch(() => null)
  busy.save = false
  if (!res || !res.ok) { toast((res && res.error && res.error.message) || '服务端没写进去'); return }
  const id = res.data.id
  modalOpen.value = false
  await load()
  toast('已保存到服务端：' + (res.data.name || res.data.watchPath || hostOf(res.data.url)))
  if (id) {
    await fetch('/api/downloaders/' + encodeURIComponent(id) + '/test', { method: 'POST', credentials: 'same-origin' }).catch(() => null)
    await load()
    if (window.__ptaLoadOverview) window.__ptaLoadOverview()
  }
}
async function testConn() {
  if (busy.test) return
  if (form.kind === 'watch') {
    const wp = String(form.watchPath || '').trim()
    if (!wp || wp[0] !== '/') { toast('watch 目录要填绝对路径'); return }
    busy.test = true
    testResult.value = '正在检查…'
    const out = await fetch('/api/downloaders/probe', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'watch', watchPath: wp })
    }).then(r => r.json()).catch(() => null)
    busy.test = false
    if (!out || !out.ok) { testResult.value = (out && out.error && out.error.message) || '检查失败'; return }
    const d = out.data || {}
    testResult.value = d.pass ? ('可写 · ' + (d.freeSpace ? '剩余 ' + fmtBytes(d.freeSpace) : '目录可用')) : ('不可写：' + (d.error || ''))
    toast(d.pass ? 'watch 目录可写' : 'watch 目录不可写')
    return
  }
  const url = normUrl(form.url)
  if (!url) { toast('先填地址'); return }
  if (!/^https?:\/\/[^\s/]+/i.test(url)) { toast('地址要像 http://主机:端口'); return }
  busy.test = true
  testResult.value = '正在连接…'
  let req
  if (editing.value && !form.pass) {
    req = fetch('/api/downloaders/' + encodeURIComponent(editing.value) + '/test', { method: 'POST', credentials: 'same-origin' })
  } else {
    req = fetch('/api/downloaders/probe', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: form.kind, url, user: form.user, pass: form.pass })
    })
  }
  const out = await req.then(r => r.json()).catch(() => null)
  busy.test = false
  if (!out || !out.ok) {
    testResult.value = (out && out.error && out.error.message) || '探测失败'
    toast(testResult.value)
    return
  }
  const d = out.data || {}
  const steps = (d.steps || []).map(s => s.step + ':' + (s.status || '—') + (s.error ? '(' + s.error + ')' : '') + ' ' + (s.ms || 0) + 'ms').join(' · ')
  testResult.value = (d.pass ? '通过 · ' + (d.version || '') + (d.freeSpace ? ' · 剩余 ' + fmtBytes(d.freeSpace) : '') : '不通') + (steps ? ' · ' + steps : '')
  toast(d.pass ? ('连接通过 · ' + (d.version || '')) : '连接失败')
  if (editing.value) { await load(); if (window.__ptaLoadOverview) window.__ptaLoadOverview() }
}
async function loadCats(nd) {
  if (form.kind === 'watch') { cats.value = []; catsMsg.value = 'watch 目录没有分类'; return }
  const node = nd || nodes.value.find(x => x.id === editing.value)
  if (!node || !node.id) { catsMsg.value = '先保存下载器，再读它的分类'; return }
  if (busy.cats) return
  busy.cats = true
  const j = await fetch('/api/downloaders/' + encodeURIComponent(node.id) + '/cats', { credentials: 'same-origin' })
    .then(r => r.json()).catch(() => null)
  busy.cats = false
  if (!j || !j.ok) { catsMsg.value = (j && j.error && j.error.message) || '读取失败'; return }
  cats.value = (j.data && j.data.cats) || []
  catsMsg.value = cats.value.length ? ('已读取 ' + cats.value.length + ' 个') : '下载器里还没有分类'
}
function removeNode() {
  const node = nodes.value.find(x => x.id === editing.value)
  if (!node) return
  confirmBox('删除下载器', '确定删除「' + (node.name || hostOf(node.url)) + '」吗？这台机器上的做种记录会从列表里移除。', async () => {
    const j = await fetch('/api/downloaders/' + encodeURIComponent(node.id), { method: 'DELETE', credentials: 'same-origin' })
      .then(r => r.json()).catch(() => null)
    if (!j || !j.ok) { toast((j && j.error && j.error.message) || '删除失败'); return }
    modalOpen.value = false
    await load()
    if (window.__ptaLoadOverview) window.__ptaLoadOverview()
    toast('已删除：' + (node.name || hostOf(node.url)))
  })
}

onMounted(() => {
  window.addEventListener('hashchange', ensure)
  timer = setInterval(() => { if (viewVisible('crawl')) load() }, 30000)
  load()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
/* Nodes：页面专属规则，迁入 scoped */
.nodes-sum { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line); border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
.nodes-sum span { display: block; font-size: 11px; color: var(--muted); }
.nodes-sum b { display: block; margin-top: 5px; font-size: 18px; font-weight: 600; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.nodes-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 1240px) {
.nodes-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1240px) {
.nodes-sum { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 760px) {
.nodes-grid { grid-template-columns: 1fr; }
}
.nodes-inner { padding: 16px 20px 20px; }
.nodes-inner .nodes-sum { margin-bottom: 14px; }
.nodes-inner .nodes-grid { gap: 12px; }
.nodes-inner { padding: 14px 20px 18px; }
.nodes-inner .nodes-sum { display: flex; gap: 10px; background: none; border-radius: 0; margin-bottom: 12px; }
.nodes-inner { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.modal-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.nodes-inner .nodes-grid { gap: 10px; }
.nodes-inner .nodes-sum { margin-bottom: 10px; }
.nodes-inner .nodes-sum span { font-size: 10px; }
.nodes-inner .nodes-sum b { font-size: 15px; margin-top: 3px; }
.nodes-inner .nodes-sum { display: none; }
.nodes-inner .nodes-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.nd-cats { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 12px; }
.nodes-inner .nodes-grid { display: block; background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.node-row { display: grid; grid-template-columns: 190px 110px 1fr 64px 44px; align-items: center; gap: 12px; padding: 9px 14px; border-bottom: 1px solid var(--line); }
.node-row:last-child { border-bottom: 0; }
.node-row:hover { background: #fafbfd; }
.node-row.warn .nr-bar i { background: var(--amber); }
.node-row.off .nr-bar i { background: #d7dae1; }
.node-row .badge { justify-self: start; font-size: 10px; padding: 1px 6px; }
.node-row.off .nr-name b, .node-row.off .nr-cap { color: var(--muted); }

/* Nodes：页面专属规则，迁入 scoped */
.nd-cats-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.nd-cats-list .cat-chip i { font-style: normal; font-size: 10px; color: var(--muted-2); margin-left: 5px; }
.nd-cats-list .cat-chip.on i { color: var(--accent); }
.nr-name b { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.nr-tag { margin-left: 6px; font-size: 9.5px; color: var(--muted-2); border: 1px solid var(--line-2); border-radius: 5px; padding: 1px 4px; }
.nr-host { font-size: 11px; color: var(--muted); }
.nr-disk { display: flex; align-items: center; gap: 10px; min-width: 0; }
.nr-cap { font-size: 11.5px; color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.nr-bar { flex: 1; height: 4px; border-radius: 99px; background: #f1f3f7; overflow: hidden; min-width: 60px; }
.nr-bar i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
.nr-pct { font-size: 10.5px; color: var(--muted); min-width: 28px; text-align: right; font-variant-numeric: tabular-nums; }
.nr-set { justify-self: end; font-size: 11px; color: var(--muted); }
.nr-set:hover { color: var(--accent); }

/* Nodes：下载器抽屉与卡片规则，迁入 scoped */
.drawer .drawer-body-flush { padding: 0 22px 10px; }
.nodes-inner { border-top: 1px solid var(--line); }
.nodes-inner .nodes-grid { background: transparent; border: 0; border-radius: 0; }
.node-row { padding: 9px 2px; }
.drawer .drawer-body-flush { padding-bottom: 8px; }
.nodes-inner { padding-left: 0; padding-right: 0; }
.node-row {
  grid-template-columns: 200px 118px 1fr 60px 44px; padding: 5.5px 27px; margin: 0 -23px; }
.nr-set { justify-self: end; }
.nr-cap { flex: 0 0 148px; }
.nr-pct { flex: 0 0 34px; }

@media (max-width: 600px) {
.node-row { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "name badge" "disk set"; gap: 4px 8px; padding: 8px 10px; }
.nr-name { grid-area: name; }
.node-row .badge { grid-area: badge; justify-self: end; }
.nr-disk { grid-area: disk; }
.nr-set { grid-area: set; justify-self: end; }
.nr-host { display: none; }
.modal-two { grid-template-columns: 1fr; }
}
</style>
