<template>
  <div class="set-panel" id="set-panel">
    <div class="set-stack">
      <section class="set-card">
        <div class="set-card-head">
          <div class="set-card-t">
            <h2 class="set-h2">面板账号</h2>
            <p class="set-desc">账号和密码在面板内管理；密码只存 scrypt 哈希，不存明文。</p>
          </div>
          <button class="btn primary slim set-save" id="set-account-save" type="button" :disabled="account.saving" @click="saveAccount">{{ account.saving ? '保存中…' : '保存' }}</button>
        </div>
        <div class="set-fields">
          <div class="set-field">
            <div class="lbl"><span>面板用户名</span></div>
            <div class="ctl"><input id="set-account-user" v-model="account.user" class="input" autocomplete="username" maxlength="64"></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>当前密码</span><i>改用户名或密码都要填</i></div>
            <div class="ctl"><input id="set-account-current" v-model="account.current" class="input" type="password" autocomplete="current-password"></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>新密码</span><i>留空表示不改；至少 8 位</i></div>
            <div class="ctl"><input id="set-account-next" v-model="account.next" class="input" type="password" autocomplete="new-password"></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>确认新密码</span></div>
            <div class="ctl"><input id="set-account-confirm" v-model="account.confirm" class="input" type="password" autocomplete="new-password"></div>
          </div>
          <div v-if="account.msg" class="set-field">
            <div class="lbl"><span>上次操作</span></div>
            <div class="ctl"><span class="fixed-val ref">{{ account.msg }}</span></div>
          </div>
          <div class="set-field">
            <div class="lbl"><span>会话</span></div>
            <div class="ctl"><span class="fixed-val ref">HttpOnly cookie；改密码会清所有会话</span></div>
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
            <div class="lbl"><span>凭据密钥</span><i>密码/cookie 的加密密钥；只显示来源，不显示密钥</i></div>
            <div class="ctl"><span class="fixed-val ref" :class="keyState.ok === false ? 'bad-t' : ''">{{ keyText }}</span></div>
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
import { reportError } from '../utils/errors'
import { toast, confirmBox, loggedIn, viewVisible } from '../utils/ui'

const version = ref('读取中…')
const user = ref('读取中…')
const account = reactive({ user: '', current: '', next: '', confirm: '', saving: false, msg: '' })
const notify = reactive({ telegram: false, webhook: false, source: '', chat: '', token: '', events: 'error', saving: false, testing: false, testMsg: '' })
const keyState = reactive({ ok: null, source: '', reason: '' })
let timer = null
let loaded = false

const keyText = computed(() => {
  if (keyState.ok === false) return '不可用：' + (keyState.reason || '检查 PTA_SECRET_FILE / PTA_SECRET')
  if (keyState.source === 'env') return '环境变量 PTA_SECRET'
  if (keyState.source === 'secret-file') return '独立密钥文件'
  if (keyState.source === 'file') return 'data/.secret'
  if (keyState.source === 'generated') return '首次生成 data/.secret'
  if (keyState.source === 'memory') return '仅内存，重启会丢'
  return keyState.source || '未读取'
})

async function loadSettings() {
  if (loaded || !loggedIn()) return
  try {
    const [h, s, nt, dv, ac] = await Promise.all([
      fetch('/api/health', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null),
      fetch('/api/session', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null),
      fetch('/api/notify', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null),
      fetch('/api/dev', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null),
      fetch('/api/account', { credentials: 'same-origin' }).then(r => r.json()).catch(() => null)
    ])
    if (h && h.ok) version.value = 'v' + h.data.version
    if (s && s.ok) user.value = s.data.user || '—'
    if (ac && ac.ok) { account.user = ac.data.user || ''; if (!user.value || user.value === '读取中…') user.value = account.user }
    if (nt && nt.ok) applyNotify(nt.data)
    if (dv && dv.ok && dv.data && dv.data.crypto) Object.assign(keyState, dv.data.crypto)
    loaded = !!(h && h.ok || s && s.ok || nt && nt.ok || dv && dv.ok)
  } catch (e) { reportError('Settings', e); loaded = false }
}
async function saveAccount() {
  if (account.saving) return
  if (!String(account.current || '').trim()) { toast('先填当前密码'); return }
  if (account.next !== account.confirm) { toast('两次新密码不一致'); return }
  if (account.next && String(account.next).length < 8) { toast('新密码至少 8 位'); return }
  account.saving = true
  account.msg = ''
  try {
    const j = await (await fetch('/api/account', {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: account.user, currentPass: account.current, newPass: account.next })
    })).json()
    if (j && j.ok) {
      user.value = j.data.user || account.user
      account.user = j.data.user || account.user
      account.current = ''
      account.next = ''
      account.confirm = ''
      if (j.data.relogin) {
        account.msg = '密码已改，所有会话已失效，请重新登录'
        toast(account.msg)
        setTimeout(() => location.reload(), 800)
      } else {
        account.msg = '账号已保存'
        toast(account.msg)
      }
    } else {
      account.msg = (j && j.error && j.error.message) || '保存失败'
      toast(account.msg)
    }
  } catch (e) { account.msg = '保存请求发不出去'; toast(account.msg) }
  account.saving = false
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
function ensureSettings() {
  const vis = viewVisible('settings') && loggedIn()
  /* 离开设置页后重置 loaded，下次进来重新拉一次；隐藏期间不发请求 */
  if (!vis) { loaded = false; return }
  if (!loaded) loadSettings()
}
function logout() {
  confirmBox('退出登录', '会清掉当前浏览器的会话 cookie，下次要重新登录。退出？', () => {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) { toast('退出请求失败，会话可能还在'); return }
        toast('已退出，正在刷新'); setTimeout(() => location.reload(), 500)
      })
      .catch(() => toast('退出请求发不出去'))
  })
}
function clearCache() {
  confirmBox('清空本地缓存', '会清掉浏览器里存的站点设置、流程设置和分类映射，服务器数据不动。确定？', () => {
    try { localStorage.clear() } catch (e) { reportError('Settings', e) }
    toast('本地缓存已清空，正在刷新')
    setTimeout(() => location.reload(), 700)
  })
}

function resetAfterAuth() { loaded = false }
onMounted(() => {
  window.addEventListener('hashchange', ensureSettings)
  window.addEventListener('pta-unauthorized', resetAfterAuth)
  timer = setInterval(ensureSettings, 1500)
  ensureSettings()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', ensureSettings)
  window.removeEventListener('pta-unauthorized', resetAfterAuth)
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
/* Settings 页面样式：迁入 scoped，shell/shared 保留全局 */
.set-panel { flex: 1; min-width: 0; background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 24px 28px; overflow-y: auto; }
.set-h2 { margin: 0 0 6px; font-size: 15.5px; font-weight: 600; letter-spacing: -.01em; }
.set-panel { max-height: calc(100vh - 182px); min-height: 320px; }
.set-card { background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 22px 26px; }
.set-card .set-h2 { font-size: 15px; }
#set-panel { background: none; box-shadow: none; padding: 0; overflow: visible; max-height: none; }
.set-stack { display: flex; flex-direction: column; gap: 16px; }
.set-stack .set-card { padding: 20px 26px 8px; }
.set-stack .set-h2 { font-size: 15px; }
.set-stack .set-desc { font-size: 11.5px; margin-bottom: 2px; }
.set-stack .set-fields .set-field { padding: 12px 0; }
.set-stack .set-h2 { font-size: 16px; letter-spacing: -.01em; }
.set-card .set-h2 { font-size: 16px; letter-spacing: -.01em; }
.set-card .set-desc { font-size: 11.5px; }
.set-card .set-fields .set-field { padding: 13px 0; }
.set-card .set-fields .set-field:first-child { padding-top: 14px; }
#set-panel .set-stack { gap: 12px; }
#set-panel .set-stack .set-card { padding: 16px 22px 6px; }
#set-panel .set-h2 { font-size: 14px; margin-bottom: 2px; }
#set-panel .set-desc { font-size: 11.5px; margin-bottom: 6px; }
#set-panel .set-fields { margin-top: 6px; }
#set-panel .set-fields .set-field { min-height: 38px; padding: 4px 0; }
#set-panel .set-fields .set-field:first-child { padding-top: 4px; }
#set-panel .set-fields .set-field .lbl span { font-size: 12px; }
#set-panel .set-fields .set-field .lbl i { font-size: 10.5px; line-height: 14px; }
#set-panel .set-fields .set-field .ctl { width: 220px; }
#set-panel .set-fields .set-field .ctl .input, #set-panel .set-fields .set-field .ctl .select { height: 28px; font-size: 11.5px; }
#set-panel .set-fields .set-field:has(.switch) .lbl span { display: inline-block; vertical-align: middle; }
#set-panel .set-fields .set-field:has(.switch) .lbl i { display: inline-block; margin: 0 0 0 8px; vertical-align: middle; }
#set-panel .set-fields .set-field .lbl { min-width: 0; white-space: nowrap; overflow: hidden; }
#set-panel .set-fields .set-field .lbl span { display: inline-block; vertical-align: middle; }
#set-panel .set-fields .set-field .lbl i { display: inline-block; margin: 0 0 0 8px; vertical-align: middle;
  overflow: hidden; text-overflow: ellipsis; max-width: 460px; }
#set-panel .set-fields .set-field .ctl .input, #set-panel .set-fields .set-field .ctl .select { width: 100%; box-sizing: border-box; }
#set-panel .set-field .ctl .btn { height: 28px; padding: 0 12px; font-size: 11.5px; border-radius: 8px; }
#set-panel .set-field .ctl { display: flex; align-items: center; justify-content: flex-end; width: 220px; }
#set-panel .set-card { padding: 0 0 4px; }
#set-panel .set-card > .set-h2 { margin: 16px 22px 2px; }
#set-panel .set-card > .set-desc { margin: 0 22px 14px; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
#set-panel .set-fields { margin: 0; }
#set-panel .set-fields .set-field {
  min-height: 44px; padding: 0 22px; border-bottom: 1px solid #f3f4f7; }
#set-panel .set-fields .set-field:last-child { border-bottom: 0; }
#set-panel .set-fields .set-field .lbl i { max-width: 620px; }
#set-panel .set-field .ctl .btn { width: 100%; height: 28px; justify-content: center; }
#set-panel .set-field .switch { margin-left: auto; }
#set-panel .set-card-head { display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 16px; padding: 16px 22px 14px; border-bottom: 1px solid var(--line); }
#set-panel .set-card-head > .btn { flex: 0 0 auto; white-space: nowrap; }
#set-panel .set-card-t { min-width: 0; }
#set-panel .set-card-head .set-h2 { margin: 0 0 4px; }
#set-panel .set-card-head .set-desc { margin: 0; border: 0; padding: 0; }
#set-panel .set-card-head .set-save { height: 28px; padding: 0 14px; font-size: 11.5px; border-radius: 8px; flex: 0 0 auto; }
#set-panel .set-card > .set-h2, #set-panel .set-card > .set-desc { display: none; }
@media (max-width: 900px) {
.set-card { padding: 14px; }
#set-panel .set-card-head .set-card-t { flex: 1 1 100%; }
#set-panel .set-card-head > .btn { margin-left: auto; }
}
@media (max-width: 1000px) {
#set-panel .set-fields .set-field .ctl { width: 100%; }
}
@media (max-width: 1000px) {
#set-panel .set-fields .set-field .ctl .fixed-val { white-space: normal; height: auto; min-height: 34px; line-height: 1.5; overflow-wrap: anywhere; }
}
@media (max-width: 1000px) {
#set-panel .set-fields .set-field .ctl .fixed-val.ref { padding: 0; }
}
</style>
