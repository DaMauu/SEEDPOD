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
function loggedIn() {
  return !document.querySelector('#login-mask')
}
function visible() {
  const v = document.querySelector('[data-view="dashboard"]')
  return !!(v && !v.hidden)
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
  } catch (e) {}
  busy = false
}
function ensure() {
  if (visible() && loggedIn()) load()
}
onMounted(() => {
  window.addEventListener('hashchange', ensure)
  bootTimer = setInterval(() => { if (!loaded) ensure() }, 1500)
  refreshTimer = setInterval(() => { if (visible()) load() }, 30000)
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  if (bootTimer) clearInterval(bootTimer)
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>
