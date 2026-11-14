<template>
  <div class="set-panel" id="set-panel">
    <div class="set-stack">
      <section class="set-card">
        <div class="set-card-head">
          <div class="set-card-t">
            <h2 class="set-h2">版本模式</h2>
            <p class="set-desc">基础版只留日常要用的；开发版多出更新日志页。切换后自动刷新。</p>
          </div>
          <button class="btn primary slim set-save" type="button" @click="saveMode">保存</button>
        </div>
        <div class="set-fields">
          <div class="set-field">
            <div class="lbl"><span>界面模式</span><i>开发版才显示更新日志</i></div>
            <div class="ctl">
              <select v-model="mode" class="select">
                <option value="basic">基础版</option>
                <option value="dev">开发版</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section class="set-card">
        <div class="set-card-head">
          <div class="set-card-t">
            <h2 class="set-h2">面板账号</h2>
            <p class="set-desc">面板账号由服务器环境变量决定，面板里不改密码，也不存明文。</p>
          </div>
        </div>
        <div class="set-fields">
          <div class="set-field">
            <div class="lbl"><span>面板用户名</span></div>
            <div class="ctl"><span class="fixed-val ref">{{ user }}</span></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>面板密码</span></div>
            <div class="ctl"><span class="fixed-val ref">只放在测试机的 systemd 环境变量 PTA_PASS，面板读不到也不回显；要改就去测试机改环境变量后重启服务</span></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>会话</span></div>
            <div class="ctl"><span class="fixed-val ref">HttpOnly cookie，已落 SQLite，重启服务不需要重新登录</span></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>退出登录</span><i>清掉当前浏览器的会话 cookie</i></div>
            <div class="ctl"><button class="btn ghost slim" type="button" @click="logout">退出</button></div>
          </div>
        </div>
      </section>

      <section class="set-card">
        <div class="set-card-head">
          <div class="set-card-t">
            <h2 class="set-h2">调度</h2>
            <p class="set-desc">按间隔自动跑一轮抓取/送审/发布；默认关，真抓真发仍受各自开关约束。</p>
          </div>
          <button class="btn primary slim set-save" type="button" :disabled="sched.running" @click="runSched">
            {{ sched.running ? '跑着呢…' : '立即跑一次' }}
          </button>
        </div>
        <div class="set-fields">
          <div class="set-field">
            <div class="lbl"><span>定时任务</span><i>关掉就是暂停</i></div>
            <div class="ctl">
              <button class="switch" :class="{ on: sched.on }" type="button" @click="toggleSched"><i></i></button>
            </div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>间隔</span></div>
            <div class="ctl">
              <select class="select" :value="String(sched.everyMinutes)" @change="setEvery">
                <option v-for="n in [30, 60, 120, 240]" :key="n" :value="String(n)">{{ n }} 分钟</option>
              </select>
            </div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>上次结果</span></div>
            <div class="ctl"><span class="fixed-val ref">{{ lastText }}</span></div>
          </div>
        </div>
      </section>

      <section class="set-card">
        <div class="set-card-head">
          <div class="set-card-t">
            <h2 class="set-h2">通知</h2>
            <p class="set-desc">环境变量优先；也可以在这里填 Bot Token（加密保存，只写不读）。</p>
          </div>
          <button class="btn primary slim set-save" type="button" :disabled="notify.saving" @click="saveNotify">{{ notify.saving ? '保存中…' : '保存' }}</button>
          <button class="btn ghost slim" type="button" :disabled="notify.testing || (!notify.telegram && !notify.webhook)" @click="testNotify">{{ notify.testing ? '发送中…' : '发送测试' }}</button>
        </div>
        <div class="set-fields">
          <div class="set-field">
            <div class="lbl"><span>Telegram</span><i>环境变量或面板配置</i></div>
            <div class="ctl"><span class="fixed-val ref">{{ notify.telegram ? ('已配置 · ' + (notify.source === 'env' ? '环境变量' : '面板')) : '未配置' }}</span></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>Bot Token</span><i>环境变量优先；面板保存后 AES-GCM 加密，不回显</i></div>
            <div class="ctl"><input v-model="notify.token" class="input" type="password" :disabled="notify.source === 'env'" :placeholder="notify.source === 'env' ? '由环境变量提供' : (notify.telegram ? '已保存；留空不改' : '粘贴 Bot Token')" autocomplete="new-password"></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>Chat ID</span><i>你的 Telegram 用户 ID；群组可填负数</i></div>
            <div class="ctl"><input v-model="notify.chat" class="input" :disabled="notify.source === 'env'" placeholder="如 123456789"></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>发送时机</span></div>
            <div class="ctl">
              <select v-model="notify.events" class="select">
                <option value="off">关闭</option>
                <option value="error">仅失败</option>
                <option value="always">每轮都发</option>
              </select>
            </div>
          </div>
          <div v-if="notify.source === 'config'" class="set-field">
            <div class="lbl"><span>清除面板凭据</span><i>不影响环境变量</i></div>
            <div class="ctl"><button class="btn ghost slim danger" type="button" @click="clearNotify">清除</button></div>
          </div>
          <div v-if="notify.testMsg" class="set-field">
            <div class="lbl"><span>上次测试</span></div>
            <div class="ctl"><span class="fixed-val ref">{{ notify.testMsg }}</span></div>
          </div>
        </div>
      </section>

      <section class="set-card">
        <div class="set-card-head">
          <div class="set-card-t">
            <h2 class="set-h2">系统</h2>
            <p class="set-desc">版本、存储和这台浏览器里的数据。</p>
          </div>
        </div>
        <div class="set-fields">
          <div class="set-field">
            <div class="lbl"><span>当前版本</span></div>
            <div class="ctl"><span class="fixed-val ref">{{ version }}</span></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>数据目录</span></div>
            <div class="ctl"><span class="fixed-val ref">由服务端 PTA_DATA 指定，站点定义、词条库、队列、日志都在里面</span></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>日志上限</span></div>
            <div class="ctl"><span class="fixed-val ref">2 MB，超过自动轮转一份旧日志</span></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>清空本地缓存</span><i>只会清掉浏览器里的设置，不动服务器数据</i></div>
            <div class="ctl"><button class="btn ghost slim" type="button" @click="clearCache">清空</button></div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

const mode = ref((localStorage.getItem('pta.mode') === 'dev') ? 'dev' : 'basic')
const version = ref('读取中…')
const user = ref('读取中…')
const sched = reactive({ on: false, everyMinutes: 60, running: false, lastRunAt: 0, lastError: '', lastResult: null })
const notify = reactive({ telegram: false, webhook: false, source: '', chat: '', token: '', events: 'error', saving: false, testing: false, testMsg: '' })
let timer = null
let loaded = false

const lastText = computed(() => {
  if (!sched.lastRunAt) return '还没跑过'
  const t = new Date(sched.lastRunAt).toLocaleString()
  return sched.lastError ? t + ' · ' + sched.lastError : t
})

function toast(msg) {
  if (window.PTA && window.PTA.toast) window.PTA.toast(msg)
}
function confirmBox(title, text, fn) {
  if (window.PTA && window.PTA.confirm) window.PTA.confirm(title, text, fn)
  else if (window.confirm(title + '\n\n' + text)) fn()
}
function loggedIn() {
  return !document.querySelector('#login-mask')
}
function visible() {
  const v = document.querySelector('[data-view="settings"]')
  return !!(v && !v.hidden)
}
function applySched(data) {
  if (!data) return
  Object.assign(sched, {
    on: !!data.on,
    everyMinutes: Number(data.everyMinutes) || 60,
    running: !!data.running,
    lastRunAt: Number(data.lastRunAt) || 0,
    lastError: data.lastError || '',
    lastResult: data.lastResult || null
  })
}
async function load() {
  if (loaded || !loggedIn()) return
  try {
    const [h, s, sc, nt] = await Promise.all([
      fetch('/api/health', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null),
      fetch('/api/session', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null),
      fetch('/api/scheduler', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null),
      fetch('/api/notify', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null)
    ])
    if (h && h.ok) version.value = 'v' + h.data.version
    if (s && s.ok) user.value = s.data.user || '—'
    if (sc && sc.ok) applySched(sc.data)
    if (nt && nt.ok) applyNotify(nt.data)
    loaded = true
  } catch (e) {}
}
function applyNotify(d) {
  if (!d) return
  notify.telegram = !!d.telegram
  notify.webhook = !!d.webhook
  notify.source = d.source || ''
  notify.chat = d.chat || ''
  notify.events = d.events || 'error'
}
async function saveNotify() {
  if (notify.saving) return
  notify.saving = true
  const body = { events: notify.events, telegramChat: notify.chat }
  if (String(notify.token || '').trim()) body.telegramToken = String(notify.token).trim()
  try {
    const j = await (await fetch('/api/notify', {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })).json()
    if (j && j.ok) {
      notify.token = ''
      applyNotify(j.data)
      toast('通知设置已保存')
    } else toast((j && j.error && j.error.message) || '通知设置保存失败')
  } catch (err) { toast('通知设置保存失败') }
  notify.saving = false
}
function clearNotify() {
  confirmBox('清除面板凭据', '只清面板保存的 Telegram token/chat，环境变量不受影响。继续？', async () => {
    try {
      const j = await (await fetch('/api/notify', {
        method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clearTelegram: true })
      })).json()
      if (j && j.ok) { notify.token = ''; notify.chat = ''; applyNotify(j.data); toast('已清除面板凭据') }
      else toast((j && j.error && j.error.message) || '清除失败')
    } catch (err) { toast('清除失败') }
  })
}
async function testNotify() {
  if (notify.testing) return
  notify.testing = true
  notify.testMsg = ''
  try {
    const r = await fetch('/api/notify/test', { method: 'POST', credentials: 'same-origin' })
    const j = await r.json().catch(() => null)
    if (j && j.ok) { notify.testMsg = '已发送 · ' + (j.data.channel || ''); toast('测试通知已发') }
    else { notify.testMsg = (j && j.error && j.error.message) || ('发送失败 ' + r.status); toast(notify.testMsg) }
  } catch (err) { notify.testMsg = '请求发不出去'; toast(notify.testMsg) }
  notify.testing = false
}
function ensure() {
  if (visible() && loggedIn()) load()
}
function saveMode() {
  try { localStorage.setItem('pta.mode', mode.value === 'dev' ? 'dev' : 'basic') } catch (e) {}
  toast('已切到' + (mode.value === 'dev' ? '开发版' : '基础版') + '，正在刷新')
  setTimeout(() => location.reload(), 500)
}
function logout() {
  confirmBox('退出登录', '会清掉当前浏览器的会话 cookie，下次要重新登录。退出？', () => {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .then(() => { toast('已退出，正在刷新'); setTimeout(() => location.reload(), 500) })
      .catch(() => toast('退出请求发不出去'))
  })
}
function clearCache() {
  confirmBox('清空本地缓存', '会清掉浏览器里存的站点设置、流程设置和分类映射，服务器数据不动。确定？', () => {
    try { localStorage.clear() } catch (e) {}
    toast('本地缓存已清空，正在刷新')
    setTimeout(() => location.reload(), 700)
  })
}
async function saveSched() {
  try {
    const j = await (await fetch('/api/scheduler', {
      method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ on: !!sched.on, everyMinutes: Number(sched.everyMinutes) || 60 })
    })).json()
    if (j && j.ok) { applySched(j.data); toast('调度设置已保存') }
    else toast((j && j.error && j.error.message) || '调度设置保存失败')
  } catch (e) { toast('调度设置保存失败') }
}
function toggleSched() {
  sched.on = !sched.on
  saveSched()
}
function setEvery(e) {
  sched.everyMinutes = Number(e.target.value) || 60
  saveSched()
}
async function runSched() {
  if (sched.running) return
  sched.running = true
  try {
    const j = await (await fetch('/api/scheduler/run', { method: 'POST', credentials: 'same-origin' })).json()
    toast(j && j.ok ? '调度已跑完一轮' : ((j && j.error && j.error.message) || '调度跑失败'))
    const s = await (await fetch('/api/scheduler', { credentials: 'same-origin' })).json()
    if (s && s.ok) applySched(s.data)
  } catch (e) { toast('调度请求发不出去') }
  sched.running = false
}

onMounted(() => {
  window.addEventListener('hashchange', ensure)
  timer = setInterval(ensure, 1500)
  ensure()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensure)
  if (timer) clearInterval(timer)
})
</script>
