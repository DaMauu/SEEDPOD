import { computed, reactive } from 'vue'

export function useCrawlScheduler(opts) {
  const getJson = opts.getJson
  const toast = opts.toast
  const confirmBox = opts.confirmBox
  const patchUser = opts.patchUser
  const targetHost = opts.targetHost
  const detail = opts.detail

  const limits = reactive({ listInterval: 10, interval: 600, windowMinutes: 60, maxPerWindow: 20, breaker: 3 })

const sched = reactive({ on: false, everyMinutes: 60, running: false, lastRunAt: 0, lastError: '' })
const fmtTime = t => new Date(t).toLocaleString('zh-CN', { hour12: false })
const schedText = computed(() => {
  const parts = [sched.on ? '自动抓取已开' : '自动抓取已关']
  if (sched.lastRunAt) {
    parts.push('上次 ' + fmtTime(sched.lastRunAt))
    if (sched.on) parts.push('下轮 ' + fmtTime(sched.lastRunAt + (Number(sched.everyMinutes) || 60) * 60000))
  } else if (sched.on) {
    parts.push('还没跑过')
  }
  if (sched.lastError) parts.push(sched.lastError)
  return parts.join(' · ')
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
function setEveryValue(n) { sched.everyMinutes = Number(n) || 60; saveSched() }
async function saveLimits() {
  limits.interval = Math.min(600, Math.max(8, Number(limits.interval) || 60))
  limits.windowMinutes = Math.min(1440, Math.max(1, Number(limits.windowMinutes) || 60))
  limits.maxPerWindow = Math.min(1000, Math.max(1, Number(limits.maxPerWindow) || 20))
  limits.breaker = Math.min(10, Math.max(1, Number(limits.breaker) || 3))
  await patchUser({ interval: limits.interval, windowMinutes: limits.windowMinutes, maxPerWindow: limits.maxPerWindow, breaker: limits.breaker, detail: !!detail.value })
  toast('请求限制已保存')
}
async function runRound() {
  if (sched.running) return
  sched.running = true
  const j = await getJson('/api/scheduler/run', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ steps: ['crawl', 'screen', 'dedupe', 'review'] })
  })
  sched.running = false
  if (!j || !j.ok) {
    toast((j && j.error && j.error.message) || '这一轮没跑起来')
    await loadSched()
    return
  }
  const d = j.data || {}
  const c = d.crawl || {}
  const sc = d.screen || {}
  const rv = d.review || {}
  let msg
  if (c.skipped) msg = '真抓取没开，只跑了本地阶段'
  else if (!Number(c.sites)) msg = '抓取 0 站（' + (Number(c.waiting) || 0) + ' 站等待间隔）'
  else msg = '抓取 ' + (Number(c.sites) || 0) + ' 站 · 新增 ' + (Number(c.added) || 0) + ' 条 · 初筛 ' + (Number(sc.selected) || 0) + ' · 终审 ready ' + (Number(rv.ready) || 0) + ' / hold ' + (Number(rv.hold) || 0)
  if (d.partial) msg += ' · 有阶段失败'
  toast(msg)
  await loadSched()
}

const gates = reactive({ realCrawl: false, realPublish: false, realImages: false, loaded: false })

async function loadGates() {
  const j = await getJson('/api/config')
  if (j && j.ok && j.data && j.data.user) {
    if (j.data.user.targetHost) targetHost.value = j.data.user.targetHost
    gates.realCrawl = !!j.data.user.realCrawl
    gates.realPublish = !!j.data.user.realPublish
    gates.realImages = !!j.data.user.realImages
    limits.listInterval = Number(j.data.user.listInterval) || 10
    limits.interval = Number(j.data.user.interval) || 600
    limits.windowMinutes = Number(j.data.user.windowMinutes) || 60
    limits.maxPerWindow = Number(j.data.user.maxPerWindow) || 20
    limits.breaker = Number(j.data.user.breaker) || 3
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
    confirmBox('开启真抓取？', '开启后会真实访问来源站；请确认站点授权、频率和窗口上限。', () => applyGate(key, true))
    return
  }
  if (next && key === 'realImages') {
    confirmBox('开启图床实传？', '开启后截图会真实上传到图床；先确认图床配置和额度。', () => applyGate(key, true))
    return
  }
  applyGate(key, next)
}
function toggleAuto() {
  if (sched.on) {
    sched.on = false
    saveSched()
    toast('自动抓取已关闭')
    return
  }
  if (!gates.realCrawl) {
    toast('先打开真抓取，再开自动抓取')
    return
  }
  confirmBox('开启自动抓取？', '每 ' + (Number(sched.everyMinutes) || 60) + ' 分钟自动跑一轮：抓取 → 初筛 → 查重 → 终审；不会自动发布。', () => {
    sched.on = true
    saveSched()
    toast('自动抓取已开启')
  })
}
  return { limits, sched, schedText, gates, loadSched, saveSched, setEveryValue, saveLimits, runRound, loadGates, applyGate, toggleGate, toggleAuto };
}
