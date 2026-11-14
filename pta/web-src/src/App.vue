<template>
  <div class="layout">
    <main class="main">
      <div class="topbar">
        <a class="brand" href="#dashboard" title="回总览">
          <img class="top-logo" :src="whale" alt="">
          <span class="brand-name">SEEDPOD</span>
          <span class="brand-sub">原盘转载面板</span>
        </a>
        <div class="topbar-right">
          <div class="pills-row" id="status-pills">
            <span class="pill" id="pill-service"><span class="dot" :class="{ ok: serviceOnline }"></span>{{ serviceOnline ? '后端已连接' : '未连接后端' }}</span>
            <span class="pill" id="pill-pending" v-show="pendingCount"><span class="dot warn"></span>{{ pendingCount }} 条待审核</span>
            <span class="pill" id="pill-nodes"><span class="dot ok"></span>下载器 {{ downloaderCount }}</span>
          </div>
          <div class="pills-row" id="page-pills"><span class="pill">{{ currentMeta.title }}</span></div>
        </div>
      </div>

      <section class="view" data-view="dashboard" :hidden="current !== 'dashboard'"><Dashboard /></section>
      <section class="view" data-view="sites" :hidden="current !== 'sites'"><Sites /></section>
      <section class="view" data-view="crawl" :hidden="current !== 'crawl'"><Crawl /></section>
      <section class="view" data-view="queue" :hidden="current !== 'queue'"><Queue /></section>
      <section class="view" data-view="sources" :hidden="current !== 'sources'"><Sources /></section>
      <section class="view" data-view="logs" :hidden="current !== 'logs'"><Logs /></section>
      <section class="view" data-view="changelog" :hidden="current !== 'changelog'"><Changelog /></section>
      <section class="view" data-view="settings" :hidden="current !== 'settings'"><Settings /></section>

      <footer class="dev-foot" id="dev-foot"><span>{{ devText }}</span></footer>
    </main>
  </div>

  <nav class="dock" id="dock-root">
    <a v-for="v in navViews" :key="v.key" class="dock-item" :class="{ active: current === v.key }" :href="'#' + v.key" :data-view="v.key" :title="v.label">
      <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="v.icon" /></svg>
      <span class="dock-label">{{ v.label }}</span>
    </a>
  </nav>

  <div v-if="loginOpen" class="login-mask" id="login-mask">
    <form class="login-card" id="login-form" autocomplete="on" @submit.prevent="submitLogin">
      <div class="login-brand"><img :src="whale" alt=""><b>SEEDPOD</b><span>原盘转载面板</span></div>
      <h2>登录</h2>
      <label class="login-field"><span>用户名</span>
        <input id="login-user" v-model="login.user" class="input" autocomplete="username" placeholder="admin"></label>
      <label class="login-field"><span>密码</span>
        <input id="login-pass" v-model="login.pass" class="input" type="password" autocomplete="current-password"></label>
      <div class="login-row">
        <em class="login-err" id="login-err">{{ login.err }}</em>
      </div>
      <button class="btn primary login-btn" type="submit" id="login-submit" :disabled="login.busy">{{ login.busy ? '登录中…' : '登录' }}</button>
    </form>
  </div>

  <div v-if="confirmState.open" class="modal-mask" id="confirm-modal">
    <div class="modal" style="width:390px">
      <div class="modal-head"><h2 id="confirm-title">{{ confirmState.title }}</h2></div>
      <p class="modal-sub" id="confirm-text">{{ confirmState.text }}</p>
      <div class="modal-foot">
        <button class="btn ghost slim" id="confirm-no" type="button" @click="closeConfirm">取消</button>
        <button class="btn primary slim" id="confirm-yes" type="button" @click="okConfirm">确认</button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import whale from './assets/whale.png'
import Dashboard from './views/Dashboard.vue'
import Sites from './views/Sites.vue'
import Crawl from './views/Crawl.vue'
import Queue from './views/Queue.vue'
import Sources from './views/Sources.vue'
import Logs from './views/Logs.vue'
import Changelog from './views/Changelog.vue'
import Settings from './views/Settings.vue'

const VIEWS = [
  { key: 'dashboard', label: '总览', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
  { key: 'sites', label: '站点', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z' },
  { key: 'crawl', label: '流程', icon: 'M4 6h16M7 12h10M10 18h4' },
  { key: 'queue', label: '待审核', icon: 'M4 5h16v14H4zM4 13h4l2 3h4l2-3h4' },
  { key: 'sources', label: '数据清单', icon: 'M4 6c0 1.7 3.6 3 8 3s8-1.3 8-3M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3V6z' },
  { key: 'logs', label: '日志', icon: 'M4 5h16v14H4zM7 9l3 3-3 3M12 15h5' },
  { key: 'changelog', label: '更新日志', icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7' },
  { key: 'settings', label: '设置', icon: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M11 16v4' }
]
const mode = (function () { try { return localStorage.getItem('pta.mode') === 'dev' ? 'dev' : 'basic'; } catch (e) { return 'basic'; } })()
const navViews = VIEWS.filter(function (v) { return v.key !== 'changelog' || mode === 'dev' })
const current = ref('dashboard')
const currentMeta = computed(function () { return VIEWS.filter(function (v) { return v.key === current.value; })[0] || VIEWS[0] })
const serviceOnline = ref(false)
const pendingCount = ref(0)
const downloaderCount = ref(0)
const devText = ref('加载中…')
const loginOpen = ref(false)
const authed = ref(false)
const login = reactive({ user: '', pass: '', err: '', busy: false })
const confirmState = reactive({ open: false, title: '', text: '', fn: null })

function toast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(t._tm)
  t._tm = setTimeout(function () { t.classList.remove('show'); }, 1800)
}
function confirmBox(title, text, fn) {
  confirmState.title = title || '确认操作'
  confirmState.text = text || ''
  confirmState.fn = fn || null
  confirmState.open = true
}
function closeConfirm() { confirmState.open = false; confirmState.fn = null }
function okConfirm() { const fn = confirmState.fn; closeConfirm(); if (fn) fn() }
window.PTA = { toast: toast, confirm: confirmBox, MOCK: {} }

let synthetic = false
function applyHash() {
  if (synthetic) { synthetic = false; return }
  let key = (location.hash || '#dashboard').slice(1).split('?')[0]
  if (key === 'changelog' && mode !== 'dev') key = 'dashboard'
  if (!VIEWS.some(function (v) { return v.key === key; })) key = 'dashboard'
  current.value = key
  window.__ptaCurrent = key
  document.title = currentMeta.value.title + ' · SEEDPOD'
  loadStats()
  /* Vue 更新 hidden 是异步的；下一拍再发一次事件，让页面组件在可见后拉数据 */
  setTimeout(function () {
    synthetic = true
    window.dispatchEvent(new Event('hashchange'))
  }, 0)
}
function submitLogin() {
  const u = String(login.user || '').trim()
  const p = String(login.pass || '')
  if (!u || !p) { login.err = '用户名和密码都要填'; return }
  if (login.busy) return
  login.busy = true
  login.err = ''
  fetch('/api/login', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: u, pass: p })
  }).then(function (r) {
    return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; })
  }).then(function (res) {
    login.busy = false
    if (res.ok) {
      authed.value = true
      loginOpen.value = false
      login.pass = ''
      login.err = ''
      applyHash()
      window.dispatchEvent(new Event('hashchange'))
      loadStats()
      loadDev()
      return
    }
    login.err = (res.j && res.j.error && res.j.error.message) || '用户名或密码不对'
  }).catch(function () { login.busy = false; login.err = '网络不通，稍后再试' })
}
function probeAuth() {
  fetch('/api/session', { credentials: 'same-origin' }).then(function (r) {
    authed.value = r.ok
    if (authed.value) { loginOpen.value = false; loadStats(); loadDev() }
    else loginOpen.value = true
  }).catch(function () {
    authed.value = false
    loginOpen.value = true
  })
}
function loadStats() {
  fetch('/api/health', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { serviceOnline.value = !!(j && j.ok); }).catch(function () { serviceOnline.value = false })
  if (!authed.value) return
  fetch('/api/queue?limit=1', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      const c = j && j.ok && j.data && j.data.counts ? j.data.counts : {}
      pendingCount.value = Number(c.pending) || 0
    }).catch(function () {})
  fetch('/api/downloaders', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { downloaderCount.value = Array.isArray(j && j.data) ? j.data.length : 0; }).catch(function () {})
}
function loadDev() {
  if (!authed.value) return
  fetch('/api/dev', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.ok || !j.data) return
      const d = j.data, c = d.counts || {}
      devText.value = 'SEEDPOD v' + (d.version || '—') + ' · 开发 ' + (d.devDate || '—') +
        ' · 前端 ' + ((d.stack && d.stack.front) || '—') + ' · 后端 ' + ((d.stack && d.stack.back) || '—') +
        ' · 页面 ' + (c.pages || 0) + ' · 接口 ' + (c.endpoints || 0) +
        ' · 站点 ' + (c.sites || 0) + ' · 待审 ' + (c.queue || 0) + ' · 下载器 ' + (c.downloaders || 0) +
        ' · 已运行 ' + (d.uptime || 0) + ' 秒'
    }).catch(function () {})
}
window.__ptaLoadOverview = function () {
  fetch('/api/stats/overview', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && j.ok) window.__ptaOverview = j.data; }).catch(function () {})
}
let timer = null
onMounted(function () {
  window.addEventListener('hashchange', applyHash)
  applyHash()
  probeAuth()
  timer = setInterval(loadStats, 30000)
})
onUnmounted(function () {
  window.removeEventListener('hashchange', applyHash)
  if (timer) clearInterval(timer)
})
</script>
