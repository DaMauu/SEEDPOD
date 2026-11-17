import { computed, reactive } from 'vue'

export function useCrawlScheduler(opts) {
  const getJson = opts.getJson
  const toast = opts.toast
  const confirmBox = opts.confirmBox
  const patchUser = opts.patchUser
  const targetHost = opts.targetHost
  const detail = opts.detail

  const limits = reactive({ interval: 60, windowMinutes: 60, maxPerWindow: 20, breaker: 3 })

const sched = reactive({ on: false, everyMinutes: 60, running: false, lastRunAt: 0, lastError: '' })
const schedText = computed(() => {
  if (!sched.lastRunAt) return '还没跑过'
  const t = new Date(sched.lastRunAt).toLocaleString('zh-CN', { hour12: false })
  return '上次 ' + t + (sched.lastError ? ' · ' + sched.lastError : '')
})
function applySched(d) {
  if (!d) return
  Object.assign(sched, { on: !!d.on, everyMinutes: Number(d.everyMinutes) || 60, running: !!d.running, lastRunAt: Number(d.lastRunAt) || 0, lastError: d.lastError || '' })
}
async function loadSched() {
  const j = await getJson('/api/scheduler')
  if (j && j.ok) applySched(j.data)
}
async function saveSched() {
  const r = await fetch('/api/scheduler', { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: !!sched.on, everyMinutes: Number(sched.everyMinutes) || 60 }) })
  const j = await r.json().catch(() => null)
  if (j && j.ok) applySched(j.data)
  else toast((j && j.error && j.error.message) || '调度设置保存失败')
}
function toggleSched() { sched.on = !sched.on; saveSched() }
function setEveryValue(n) { sched.everyMinutes = Number(n) || 60; saveSched() }
async function saveLimits() {
  limits.interval = Math.min(600, Math.max(8, Number(limits.interval) || 60))
  limits.windowMinutes = Math.min(1440, Math.max(1, Number(limits.windowMinutes) || 60))
  limits.maxPerWindow = Math.min(1000, Math.max(1, Number(limits.maxPerWindow) || 20))
  limits.breaker = Math.min(10, Math.max(1, Number(limits.breaker) || 3))
  await patchUser({ interval: limits.interval, windowMinutes: limits.windowMinutes, maxPerWindow: limits.maxPerWindow, breaker: limits.breaker, detail: !!detail.value })
  toast('请求限制已保存')
}
async function runSched() {
  if (sched.running) return
  sched.running = true
  const r = await fetch('/api/scheduler/run', { method: 'POST', credentials: 'same-origin' })
  const j = await r.json().catch(() => null)
  toast(j && j.ok ? '调度已跑完一轮' : ((j && j.error && j.error.message) || '调度跑失败'))
  await loadSched()
  sched.running = false
}

const gates = reactive({ realCrawl: false, realPublish: false, realImages: false, loaded: false })

async function loadGates() {
  const j = await getJson('/api/config')
  if (j && j.ok && j.data && j.data.user) {
    if (j.data.user.targetHost) targetHost.value = j.data.user.targetHost
    gates.realCrawl = !!j.data.user.realCrawl
    gates.realPublish = !!j.data.user.realPublish
    gates.realImages = !!j.data.user.realImages
    gates.loaded = true
  }
}

async function applyGate(key, next) {
  const body = {}
  body[key] = next
  const j = await patchUser(body)
  if (j && j.ok) {
    gates[key] = next
    toast((next ? '已开启 ' : '已关闭 ') + ({ realCrawl: '真抓取', realPublish: '自动发布', realImages: '图床实传' }[key] || key))
  } else {
    toast((j && j.error && j.error.message) || '闸门保存失败')
  }
}

function toggleGate(key) {
  const next = !gates[key]
  if (next && key === 'realPublish') {
    confirmBox('开启自动发布？', '开启后调度/批量发布会真实提交到目标站；建议保持关闭，先在待审核页手动提交。', () => applyGate(key, true))
    return
  }
  if (next && key === 'realCrawl') {
    confirmBox('开启真抓取？', '开启后会真实访问来源站；请确认站点授权、频率和每天上限。', () => applyGate(key, true))
    return
  }
  if (next && key === 'realImages') {
    confirmBox('开启图床实传？', '开启后截图会真实上传到图床；先确认图床配置和额度。', () => applyGate(key, true))
    return
  }
  applyGate(key, next)
}
  return { limits, sched, schedText, gates, loadSched, saveSched, toggleSched, setEveryValue, saveLimits, runSched, loadGates, applyGate, toggleGate };
}
