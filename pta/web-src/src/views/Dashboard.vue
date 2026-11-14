<template>
  <div class="bento-top">
    <div class="card stat-card">
      <div class="panel-head"><h2>统计</h2><span class="zone-sub">今日 / 本月 / 累计</span></div>
      <div class="stat-grid">
        <div class="stat-hero">
          <span>今日已发</span>
          <b id="hero-num">{{ pubCount }}</b>
          <i id="hero-delta">累计已发布</i>
        </div>
        <div class="stat-list">
          <div class="hstat"><span>本月已发</span><b id="stat-month">{{ pubCount }}</b><i>目标 120</i></div>
          <div class="hstat"><span>总发布数</span><b id="stat-total">{{ pubCount.toLocaleString() }}</b><i>历史累计</i></div>
          <div class="hstat"><span>抓取总数</span><b id="stat-db">{{ catalogTotal.toLocaleString() }}</b><i>词条库累计</i></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="panel-head"><h2>实时日志</h2><span class="live"><i></i>实时</span><a href="#logs">全部</a></div>
      <div class="list" id="dash-logs">
        <div v-if="!logs.length" class="empty">还没有日志，连上后端后这里会实时刷新</div>
        <div v-for="(l, i) in logs" :key="i" class="list-item" :class="l.lvl">
          <span class="time">{{ l.t }}</span><span class="msg">{{ l.msg }}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="bento-bottom">
    <div class="card status-card">
      <div class="panel-head"><h2>系统状态</h2><a href="#crawl">详情</a></div>
      <div class="health-row" id="health-strip">
        <div class="status-hero">
          <span>cookie 可用</span>
          <b :class="{ warn: health.loginFail > 0 }">{{ health.loginOk }}</b>
          <i>共启用 {{ health.enabled }} 个{{ ov ? '' : '（未连接后端）' }}</i>
          <div class="hero-sub"><span>今日抓取</span><b>{{ health.crawlTxt }}</b></div>
        </div>
        <div class="status-list">
          <div v-for="it in health.list" :key="it.label" class="hstat" :class="{ warn: it.warn }">
            <span>{{ it.label }}</span><b>{{ it.value }}</b>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="panel-head"><h2>最近发布</h2><a href="#queue">队列</a></div>
      <div class="list" id="dash-published">
        <div v-if="!published.length" class="empty">还没有发布记录</div>
        <div v-for="(p, i) in published" :key="i" class="list-item">
          <div style="flex:1;min-width:0">
            <div class="t-main">{{ p.cn || p.title }}</div>
            <div class="t-sub">{{ p.site || '未选站点' }} · {{ p.size || '' }}</div>
          </div>
          <span class="t-sub">{{ dateOf(p) }}</span>
          <span class="badge green">已发布</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="panel-head"><h2>待审核</h2><a href="#queue" id="dash-pending-all">全部</a></div>
      <div class="list" id="dash-pending">
        <div v-if="!pending.length" class="empty">没有待审核的条目</div>
        <div v-for="(it, i) in pending" :key="i" class="list-item">
          <div style="flex:1;min-width:0">
            <div class="t-main">{{ it.cn || it.title }}</div>
            <div class="t-sub">{{ it.res || '' }} · {{ it.size || '' }} · {{ it.site || '' }}</div>
          </div>
          <a class="btn ghost sm" href="#queue">审核</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { reportError } from '../utils/errors'
import { loggedIn, viewVisible } from '../utils/ui'

const ov = ref(null)
const logs = ref([])
const pending = ref([])
const published = ref([])
let bootTimer = null
let refreshTimer = null
let loaded = false
let busy = false

const pubCount = computed(() => Number(ov.value && ov.value.queue && ov.value.queue.counts && ov.value.queue.counts.published) || 0)
const catalogTotal = computed(() => Number(ov.value && ov.value.catalog && ov.value.catalog.total) || 0)

function fmtBytes(n) {
  let v = Number(n) || 0
  if (!v) return ''
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + ' ' + u[i]
}
const health = computed(() => {
  const o = ov.value
  const s = (o && o.sites) || {}
  const d = (o && o.downloaders) || null
  const loginFail = Number(s.loginFail) || 0
  const loginOk = Number(s.loginOk) || 0
  const enabled = Number(s.enabled) || 0
  const unchecked = Number(s.loginUnknown) || 0
  const free = d ? fmtBytes(d.freeSpace) : ''
  const crawlTxt = (o && o.crawl) ? (o.crawl.runsToday + ' 次 / ' + (o.crawl.hostsToday || 0) + ' 站') : '—'
  return {
    loginFail: loginFail,
    loginOk: loginOk,
    enabled: enabled,
    crawlTxt: crawlTxt,
    list: [
      { label: '登录失效', value: String(loginFail), warn: loginFail > 0 },
      { label: '还没自检', value: String(unchecked), warn: false },
      { label: '下载器在线', value: d ? (d.online + ' / ' + d.total) : '—', warn: !!(d && d.total && d.online < d.total) },
      { label: '磁盘余量', value: free || (d && d.total ? '未知' : '未接'), warn: !!(d && d.total && !free) }
    ]
  }
})
function dateOf(p) {
  const raw = String(p.publishedAt || p.at || '')
  return raw.slice(5, 16).replace('T', ' ')
}
async function load() {
  if (busy || !loggedIn()) return
  busy = true
  try {
    const [o, l, q, p] = await Promise.all([
      fetch('/api/stats/overview', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/logs?limit=4', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/queue?status=pending&limit=3', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/published', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).catch(() => null)
    ])
    if (o && o.ok) ov.value = o.data
    if (l && l.ok) logs.value = (l.data || []).slice(0, 4)
    if (q && q.ok && q.data) pending.value = (q.data.items || []).slice(0, 3)
    if (p && p.ok && p.data) published.value = (p.data.items || []).slice(0, 3)
    loaded = true
  } catch (e) { reportError('Dashboard', e) }
  busy = false
}
function ensure() {
  if (viewVisible('dashboard') && loggedIn()) load()
}
onMounted(() => {
  window.addEventListener('hashchange', ensure)
  bootTimer = setInterval(() => { if (!loaded) ensure() }, 1500)
  refreshTimer = setInterval(() => { if (viewVisible('dashboard')) load() }, 30000)
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  if (bootTimer) clearInterval(bootTimer)
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
/* Dashboard 页面样式：迁入 scoped，shell/dock 保留全局 */
.hstat span { display: block; font-size: 10px; letter-spacing: 1px; color: var(--muted); }
.hstat b { display: block; font-size: 24px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
.hstat i { font-style: normal; font-size: 11px; color: var(--muted-2); }
.panel-head {
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--line); padding-bottom: 10px;
}
.panel-head h2 { font-size: 12.5px; font-weight: 600; color: var(--muted); margin: 0; letter-spacing: .2px; }
.panel-head a { font-size: 11px; color: var(--muted-2); }
.panel-head a:hover { color: var(--accent); }
.list-item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); font-size: 12.5px; }
.list-item:last-child { border-bottom: 0; padding-bottom: 0; }
.list-item { padding: 10px 0; }
.stat-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 10px 16px; }
.bento-top { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; align-items: stretch; }
.bento-bottom { display: grid; grid-template-columns: 300px minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 16px; align-items: stretch; }
.stat-card, .status-card { aspect-ratio: 1 / 1; display: flex; flex-direction: column; }
.stat-card .stat-grid { flex: 1; }
.status-card .health-row { display: grid; flex: 1; grid-template-columns: 1fr 1fr; gap: 14px 18px; align-content: center; }
.bento-top .list-item, .bento-bottom .list-item { padding: 10px 0; }
@media (max-width: 1000px) {
.stat-card, .status-card { aspect-ratio: auto; }
}
.bento-bottom { grid-template-columns: 300px minmax(0, 1fr); align-items: start; }
.status-card { width: 300px; height: 300px; aspect-ratio: auto; }
.bento-top, .bento-bottom { gap: 14px; }
.bento-bottom { margin-top: 14px; }
.panel-head { padding-bottom: 9px; }
.panel-head h2 { font-size: 12.5px; letter-spacing: .2px; }
.list-item { padding: 12px 0; }
.stat-card { padding: 18px 20px; }
.stat-card .stat-grid { gap: 6px 18px; }
.stat-card .hstat span { font-size: 9.5px; letter-spacing: .8px; }
.stat-card .hstat b { font-size: 24px; }
.stat-card .hstat.primary b { font-size: 46px; }
.stat-card .hstat i { font-size: 10.5px; }
.status-card { padding: 18px 20px; }
.status-card .health-row { gap: 10px 18px; }
.stat-grid { grid-template-columns: 1.05fr 1fr; gap: 18px; }
.stat-hero { display: flex; flex-direction: column; justify-content: center; }
.stat-hero span { font-size: 9.5px; letter-spacing: .8px; color: var(--muted); }
.stat-hero b { font-size: 64px; line-height: 1; letter-spacing: -.04em; font-weight: 600; margin: 4px 0 6px; font-variant-numeric: tabular-nums; }
.stat-hero i { font-style: normal; font-size: 10.5px; color: var(--green); }
.stat-list { display: flex; flex-direction: column; justify-content: center; }
.stat-list .hstat { padding: 7px 0; border-bottom: 1px solid var(--line); }
.stat-list .hstat:last-child { border-bottom: 0; }
.stat-list .hstat b { font-size: 19px; }
.stat-list .hstat i { display: none; }
.stat-list .hstat span { font-size: 9px; letter-spacing: .6px; }
.stat-grid { grid-template-rows: 1fr !important; }
.status-card .health-row { display: grid; grid-template-columns: 1fr 1.15fr; gap: 16px; flex: 1; align-content: stretch; }
.status-hero { display: flex; flex-direction: column; justify-content: center; }
.status-hero span { font-size: 9.5px; letter-spacing: .8px; color: var(--muted); }
.status-hero b { font-size: 34px; line-height: 1.1; font-weight: 600; letter-spacing: -.02em; margin-top: 4px; font-variant-numeric: tabular-nums; }
.status-hero b.warn { color: var(--amber); }
.status-list { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.status-list .hstat { padding: 6px 0; border-bottom: 1px solid var(--line); }
.status-list .hstat:last-child { border-bottom: 0; }
.status-list .hstat span { font-size: 9px; letter-spacing: .6px; }
.status-list .hstat b { font-size: 17px; font-variant-numeric: tabular-nums; }
.status-list .hstat.warn b { color: var(--amber); }
.status-hero b { font-size: 28px; white-space: nowrap; }
.status-card .health-row { grid-template-columns: 1.15fr 1fr; }
.stat-grid { grid-template-columns: auto minmax(0, 1fr); gap: 20px; }
.status-card .health-row { grid-template-columns: minmax(0, 1fr) minmax(112px, 1fr); gap: 20px; }
.status-list .hstat { gap: 8px; }
.status-list .hstat b { white-space: nowrap; }
.stat-hero b { margin-right: 0; }
.stat-list .hstat, .status-list .hstat { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.stat-list .hstat b, .status-list .hstat b { margin-left: auto; }
.status-card .health-row { gap: 14px; }
.status-list .hstat { gap: 6px; }
.status-list .hstat span, .status-list .hstat b { white-space: nowrap; }
.status-list .hstat b { font-size: 15.5px; }
.stat-grid { grid-template-columns: 108px minmax(0, 1fr); gap: 16px; }
.status-card .health-row { grid-template-columns: 118px minmax(0, 1fr); gap: 16px; }
.stat-hero, .status-hero { padding-left: 10px; }
.stat-card { width: 300px; height: 236px; aspect-ratio: auto; }
.status-card { width: 300px; height: 236px; aspect-ratio: auto; }
.bento-top, .bento-bottom { grid-template-columns: 300px minmax(0,1fr) minmax(0,1fr); }
.bento-top .panel-head .seg { margin-left: auto; }
.bento-top .t-main { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bento-top .list-item, .bento-bottom .list-item { padding: 9px 0; }
.bento-top, .bento-bottom { grid-template-columns: 300px 444px 444px; }
.bento-top > .card, .bento-bottom > .card { height: 236px; }
.stat-card, .status-card { width: 300px; height: 236px; }
@media (max-width: 1320px) {
.bento-top, .bento-bottom { grid-template-columns: 300px minmax(0,1fr) minmax(0,1fr); }
}
@media (max-width: 1000px) {
.bento-top, .bento-bottom { grid-template-columns: 1fr; }
}
@media (max-width: 1000px) {
.bento-top > .card, .bento-bottom > .card { height: auto; }
}
@media (max-width: 1000px) {
.stat-card, .status-card { width: auto; }
}
.bento-top, .bento-bottom { grid-template-columns: 300px 420px 420px; }
.bento-top, .bento-bottom { grid-template-columns: 300px 400px 400px; }
.bento-bottom { grid-template-columns: 300px 430px 430px; }
@media (max-width: 1320px) {
.bento-top { grid-template-columns: 300px minmax(0,1fr); }
}
@media (max-width: 1320px) {
.bento-bottom { grid-template-columns: 300px minmax(0,1fr) minmax(0,1fr); }
}
.bento-top { grid-template-columns: 300px minmax(0, 1fr); }
.panel-head .live + a { margin-left: auto; }
.bento-bottom { grid-template-columns: 300px 444px 444px; }
.bento-bottom { grid-template-columns: 300px 418px 418px; }
:global(.view[data-view="dashboard"]) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100vh - 126px);
}
@media (max-width: 1319px) {
:global(.view[data-view="dashboard"]) { min-height: calc(100vh - 210px); }
}
.status-hero i { font-style: normal; font-size: 10.5px; color: var(--muted-2); margin-top: 3px; letter-spacing: .2px; }
.status-hero b { font-size: 32px; }
#dash-logs { background: #0b100e; border: 1px solid #16241b; border-radius: 10px; padding: 8px 12px; margin-top: 2px; }
#dash-logs .list-item {
  display: flex; align-items: center; gap: 10px; padding: 6px 0;
  border-bottom: 1px solid rgba(126, 231, 135, .07);
  font-family: ui-monospace, "Cascadia Mono", Consolas, "SF Mono", monospace; font-size: 11px;
}
#dash-logs .list-item:last-child { border-bottom: 0; }
#dash-logs .time { color: #47765a; min-width: 56px; }
#dash-logs .msg { color: #c8f7d6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#dash-logs .list-item.warn .msg { color: #e3b341; }
#dash-logs .list-item.error .msg { color: #ff7b72; }
#dash-logs { margin: 2px -20px -20px; padding: 10px 20px 12px; border-radius: 0 0 12px 12px; }
.card:has(#dash-logs) { display: flex; flex-direction: column; }
.card:has(#dash-logs) .list { display: flex; flex-direction: column; flex: 1; }
#dash-logs { flex: 1; margin: 2px -20px -20px; padding: 10px 20px 12px; }
#dash-logs,
#dash-logs .list-item {
  font-family: ui-monospace, "Cascadia Mono", "Cascadia Code", Consolas, "SF Mono",
    "Sarasa Mono SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}
#dash-logs .list-item { font-size: 11.5px; }
:global(.view[data-view="dashboard"]) { justify-content: flex-start; }
:global(.view[data-view="dashboard"]) { justify-content: center; }
.hero-sub{margin-top:12px;padding-top:10px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:2px}
.hero-sub span{font-size:9.5px;letter-spacing:.8px;color:var(--muted)}
.hero-sub b{font-size:15px;font-weight:600;letter-spacing:0;color:var(--text)}
@media (max-width: 600px) {
.stat-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
.bento-top, .bento-bottom { grid-template-columns: 1fr; }
}
</style>
