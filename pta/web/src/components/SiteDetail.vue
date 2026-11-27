<template>
<div class="site-expand" id="site-detail">
            <div class="sd-top">
              <em class="ava lg" :class="archCls(s)">{{ initialsOf(s.title || s.name) }}</em>
              <div class="sd-id">
                <div class="sd-title-row">
                  <h2>{{ s.title }}</h2>
                  <span class="pill2" :class="s.enabled ? 'on' : 'off'">{{ s.enabled ? '启用中' : '已停用' }}</span>
                  <span class="chip" :class="s.preset ? 'np' : 'unk'">搜索预设 {{ s.preset ? (s.preset.confirmed ? '已确认' : '待确认') : '未确认' }}</span>
                </div>
              </div>
              <div class="sd-actions">
                <button class="switch sm" :class="{ on: s.enabled }" type="button" title="启用或停用这个站的抓取" @click.stop="toggleEnabled(s)"><i></i></button>
                <select class="select slim sd-arch-sel" id="sd-arch" :value="s.arch" title="站点架构" @click.stop @change="setArch(s, $event)">
                  <option v-for="a in archOptions" :key="a.v" :value="a.v">{{ a.label }}</option>
                </select>
                <button v-if="s.cookieSaved && s.cookieReadable !== false" id="sd-selfcheck-btn" class="btn slim" type="button" :disabled="busy.selfcheck" title="用已保存的 cookie 做一次会话自检；只发一次 GET" @click.stop="selfcheckOne(s)">连接自检</button>
              </div>
              <button class="sheet-x" type="button" aria-label="关闭" @click.stop="closeDetail">✕</button>
            </div>


            <div class="sd-scroll">
              <div class="sd-form">
                <div class="sd-sec">
                  <h4 class="sd-sec-ttl">站点</h4>
                  <div class="watch-grid watch-all">
                    <div class="watch-tile" :class="[loginStats.state, { open: watchOpen === 'login' }]">
                      <div class="watch-face" role="button" tabindex="0" @click.stop="toggleWatch('login')" @keydown.enter.prevent="toggleWatch('login')">
                        <span class="wf-num">{{ loginStats.num }}</span>
                        <span class="wf-label">登录</span>
                        <span class="wf-sub">{{ loginStats.text }}</span>
                      </div>
                    </div>
                    <div class="watch-tile" :class="[addressStats.state, { open: watchOpen === 'address' }]">
                      <div class="watch-face" role="button" tabindex="0" @click.stop="toggleWatch('address')" @keydown.enter.prevent="toggleWatch('address')">
                        <span class="wf-num small">URL</span>
                        <span class="wf-label">站点</span>
                        <span class="wf-sub">{{ addressStats.text }}</span>
                      </div>
                    </div>
                    <div class="watch-tile" :class="[cookieStats.state, { open: watchOpen === 'cookie' }]">
                      <div class="watch-face" role="button" tabindex="0" @click.stop="toggleWatch('cookie')" @keydown.enter.prevent="toggleWatch('cookie')">
                        <span class="wf-num">{{ cookieStats.num }}</span>
                        <span class="wf-label">Cookie</span>
                        <span class="wf-sub">{{ cookieStats.text }}</span>
                      </div>
                    </div>
                    <div class="watch-tile" :class="[detectStats.state, { open: watchOpen === 'detect' }]">
                      <div class="watch-face" role="button" tabindex="0" @click.stop="toggleWatch('detect')" @keydown.enter.prevent="toggleWatch('detect')">
                        <span class="wf-num">{{ detectStats.num }}</span>
                        <span class="wf-label">识别</span>
                        <span class="wf-sub">{{ detectStats.text }}</span>
                      </div>
                    </div>
                    <div class="watch-tile" :class="[coverStats.state, { open: watchOpen === 'cover' }]">
                      <div class="watch-face" role="button" tabindex="0" @click.stop="toggleWatch('cover')" @keydown.enter.prevent="toggleWatch('cover')">
                        <span class="wf-num small">{{ coverStats.num }}</span>
                        <span class="wf-label">覆盖</span>
                        <span class="wf-sub">{{ coverStats.text }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="watchOpen === 'login'" class="watch-detail">
                    <div class="sd-row"><span>状态</span><b :class="dotCls(s) + '-t'">{{ loginTxt(s) }}</b></div>
                    <div class="sd-row"><span>方式</span><b>Cookie</b></div>
                    <div class="sd-row"><span>登录凭据</span><b :class="s.cookieSaved && s.cookieReadable === false ? 'bad-t' : ''">{{ s.cookieSaved ? (s.cookieReadable ? '已保存' : '已保存但解不开，请重新导入') : '未保存' }}</b></div>
                    <div class="sd-row"><span>引擎</span><b>{{ engineTxt(s) }}</b></div>
                    <div class="sd-row"><span>采样</span><b>{{ sampleTxt(s) }}</b></div>
                    <div class="sd-row"><span>来源</span><b>{{ kindTxt(s) }}</b></div>
                  </div>
                  <div v-if="watchOpen === 'address'" class="watch-detail">
                    <div class="set-field">
                      <div class="lbl"><span>站点地址</span></div>
                      <div class="ctl"><input v-model="form.url" class="input" placeholder="https://站点域名/index.php"></div>
                    </div>
                  </div>
                  <div v-if="watchOpen === 'cookie'" class="watch-detail">
                    <textarea id="sd-cookie-input" v-model="form.cookie" class="input sd-note" rows="3" :placeholder="s.cookieSaved && s.cookieReadable === false ? '旧 cookie 用当前密钥解不开，请整段重新粘贴' : (s.cookieSaved ? '已保存的 cookie 直接显示；要换就整段粘贴覆盖再保存' : '粘贴 name1=value1; name2=value2')"></textarea>
                    <div class="sd-cookie-bar">
                      <button class="btn ghost slim danger" id="sd-cookie-clear" type="button" :disabled="busy.cookie || !s.cookieSaved" title="只删除已保存的 cookie，站点配置和其他设置保留" @click.stop="clearCookie(s)">{{ busy.cookie ? '删除中…' : '删除 Cookie' }}</button>
                      <span class="sd-cookie-res" id="sd-cookie-res">{{ s.loginAt ? '上次自检 ' + fmtWhen(s.loginAt) + ' · ' + loginTxt(s) : '还没自检' }}</span>
                    </div>
                  </div>
                  <div v-if="watchOpen === 'detect'" class="watch-detail">
                    <div class="cm-actions">
                      <button class="btn ghost slim" type="button" :disabled="detectAllBusy || !defReady" @click.stop="detectAll">{{ detectAllBusy ? '识别中…' : '识别全部' }}</button>
                      <span class="sd-cookie-res">{{ detectAllMsg }}</span>
                    </div>
                    <div class="watch-subgrid">
                      <div class="watch-tile sub" :class="[searchSubState, { open: detectSub === 'search' }]">
                        <div class="watch-face" role="button" tabindex="0" @click.stop="detectSub = detectSub === 'search' ? '' : 'search'" @keydown.enter.prevent="detectSub = detectSub === 'search' ? '' : 'search'">
                          <span class="wf-num">{{ searchCount }}</span>
                          <span class="wf-label">搜索分类</span>
                          <span class="wf-sub">{{ detectResult ? '识别结果' : '当前配置' }}</span>
                        </div>
                      </div>
                      <div class="watch-tile sub" :class="[publishSubState, { open: detectSub === 'publish' }]">
                        <div class="watch-face" role="button" tabindex="0" @click.stop="detectSub = detectSub === 'publish' ? '' : 'publish'" @keydown.enter.prevent="detectSub = detectSub === 'publish' ? '' : 'publish'">
                          <span class="wf-num">{{ publishCount }}</span>
                          <span class="wf-label">发布分类</span>
                          <span class="wf-sub">{{ detectResult ? '识别结果' : '当前配置' }}</span>
                        </div>
                      </div>
                      <div class="watch-tile sub" :class="[uploadSubState, { open: detectSub === 'upload' }]">
                        <div class="watch-face" role="button" tabindex="0" @click.stop="detectSub = detectSub === 'upload' ? '' : 'upload'" @keydown.enter.prevent="detectSub = detectSub === 'upload' ? '' : 'upload'">
                          <span class="wf-num">{{ uploadCount }}</span>
                          <span class="wf-label">上传表单</span>
                          <span class="wf-sub">{{ detectResult ? '识别结果' : '当前配置' }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="detectResult && detectResult.errors.length" class="sd-row"><span>失败</span><b>{{ detectResult.errors.join('；') }}</b></div>

                    <div v-if="detectSub === 'search'" class="detect-subdetail">
                      <template v-if="detectResult && detectResult.search">
                        <div v-for="g in previewGroups" :key="g.key" class="sd-row"><span>{{ g.name }}</span><b>{{ g.ids || '空' }}</b></div>
                        <div v-if="previewUnmatchedCount" class="sd-row"><span>未识别</span><b>{{ previewUnmatchedSummary }}</b></div>
                        <details v-if="previewUnmatchedCount" class="sd-unmatched">
                          <summary>展开未识别标签（{{ previewUnmatchedCount }}）</summary>
                          <div v-for="g in previewUnmatchedGroups" :key="g.dim" class="sd-unmatched-row"><span>{{ g.dim }}</span><b>{{ g.labels }}</b></div>
                          <p class="set-desc">这些标签没匹配到全局预设，不会写入；补预设别名后可再识别。</p>
                        </details>
                      </template>
                      <template v-else-if="catGroups.length">
                        <div v-for="g in catGroups" :key="g.name" class="sd-row"><span>{{ g.name }}</span><b>{{ g.ids }}</b></div>
                      </template>
                      <div v-else class="sd-row"><span>状态</span><b>还没有搜索分类</b></div>
                    </div>

                    <div v-if="detectSub === 'publish'" class="detect-subdetail">
                      <template v-if="detectResult && detectResult.publish">
                        <div v-if="detectResult.publish.fieldKind === 'genre'" class="sd-row"><span>状态</span><b>题材/类型字段，不自动映射</b></div>
                        <div v-if="detectResult.publish.ambiguous && detectResult.publish.ambiguous.length" class="sd-row"><span>冲突 ID</span><b>{{ detectResult.publish.ambiguous.map(function (x) { return x.id + '：' + x.types.join('/') }).join('、') }}</b></div>
                        <div v-if="detectResult.publish.unmatched && detectResult.publish.unmatched.length" class="sd-row"><span>未匹配</span><b>{{ detectResult.publish.unmatched.slice(0, 10).join('、') }}</b></div>
                        <template v-else-if="detectedPublishGroups.length">
                          <div v-for="g in detectedPublishGroups" :key="g.name" class="sd-row"><span>{{ g.name }}</span><b>{{ g.ids }}</b></div>
                        </template>
                        <div v-else class="sd-row"><span>状态</span><b>没识别到发布分类</b></div>
                      </template>
                      <template v-else-if="publishGroups.length">
                        <div v-for="g in publishGroups" :key="g.name" class="sd-row"><span>{{ g.name }}</span><b>{{ g.ids }}</b></div>
                      </template>
                      <div v-else class="sd-row"><span>状态</span><b>还没有发布分类</b></div>
                    </div>

                    <div v-if="detectSub === 'upload'" class="detect-subdetail">
                      <template v-if="detectResult && detectResult.publish && detectResult.publish.upload">
                        <div class="sd-row"><span>字段</span><b>{{ Object.keys(detectResult.publish.upload.fields || {}).length }} 个</b></div>
                        <div class="sd-row"><span>提交路径</span><b>{{ detectResult.publish.upload.path || '—' }}</b></div>
                        <div class="sd-row"><span>识别页</span><b>{{ detectResult.publish.upload.formPath || '—' }}</b></div>
                      </template>
                      <template v-else>
                        <div class="sd-row"><span>状态</span><b>{{ uploadStats.count ? '已配置 ' + uploadStats.count + ' 个字段' : (uploadStats.defaultCount ? '引擎默认 ' + uploadStats.defaultCount + ' 个字段' : '未配置') }}</b></div>
                        <div class="sd-row"><span>提交路径</span><b>{{ (detail.def && detail.def.uploadMap && detail.def.uploadMap.path) || '—' }}</b></div>
                      </template>
                    </div>

                    <div v-if="detectResult" class="detect-check" :class="detectValidation.ok ? 'ok' : 'bad'">
                      <b>{{ detectValidation.ok ? '检查通过，可以保存' : '有缺项，先修再保存' }}</b>
                      <span v-for="e in detectValidation.errors" :key="e">{{ e }}</span>
                      <span v-for="w in detectValidation.warnings" :key="w" class="warn">{{ w }}</span>
                    </div>
                    <div v-if="detectResult" class="cm-actions">
                      <button class="btn primary slim" type="button" :disabled="detectSaving || !detectValidation.ok" @click.stop="saveDetected">{{ detectSaving ? '保存中…' : '保存识别结果' }}</button>
                      <span class="sd-cookie-res">{{ detectSaveMsg }}</span>
                    </div>
                  </div>
                  <div v-if="watchOpen === 'cover'" class="watch-detail">
                    <div class="set-field">
                      <div class="lbl"><span>单独设置本站</span></div>
                      <div class="ctl"><button class="switch" :class="{ on: form.override }" type="button" @click.stop="form.override = !form.override"><i></i></button></div>
                    </div>
                    <div :class="{ 'is-off': !form.override }">
                      <div class="set-field">
                        <div class="lbl"><span>抓取间隔</span></div>
                        <div class="ctl">
                          <select v-model="form.ovInterval" class="select">
                            <option value="">跟随全局</option>
                            <option value="1">1 分钟</option>
                            <option value="5">5 分钟</option>
                            <option value="15">15 分钟</option>
                            <option value="60">1 小时</option>
                            <option value="180">3 小时</option>
                          </select>
                        </div>
                      </div>
                      <div class="set-field">
                        <div class="lbl"><span>抓详情页</span></div>
                        <div class="ctl"><button class="switch" :class="{ on: form.ovDetail }" type="button" @click.stop="form.ovDetail = !form.ovDetail"><i></i></button></div>
                      </div>
                      <div class="set-field">
                        <div class="lbl"><span>优先级</span></div>
                        <div class="ctl">
                          <select v-model="form.priority" class="select">
                            <option value="high">高（先抓）</option>
                            <option value="normal">普通</option>
                            <option value="low">低（最后抓）</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="sd-form-actions">
              <button class="btn primary slim" type="button" :disabled="busy.save" @click.stop="saveSite(s)">{{ busy.save ? '保存中…' : '保存设置' }}</button>
              <button class="btn ghost slim" type="button" :disabled="busy.save" @click.stop="resetSite(s)">恢复默认</button>
              <div class="spacer"></div>
              <button class="btn ghost slim danger" type="button" title="从面板移除；基础站点可恢复" @click.stop="removeSite(s)">移除站点</button>
            </div>
          </div>
</template>

<script setup>
import { ARCH, fmtWhen, archOf, archCls, archLabel, dotCls, loginTxt } from '../utils/siteFormat'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { reportError } from '../utils/errors'
import { toast, confirmBox, initialsOf } from '../utils/ui'
import { loadRuntimePresets, runtimePresets } from '../utils/presets-runtime'

const props = defineProps({ site: { type: Object, required: true } })
const emit = defineEmits(['close', 'changed', 'removed'])

const ENG_CODE = { nexusphp: 'NP', unit3d: 'U3D', gazelle: 'GZ' }
const archOptions = [
  { v: 'NP', label: 'NexusPHP' }, { v: 'UNIT3D', label: 'UNIT3D' }, { v: 'GZ', label: 'Gazelle' },
  { v: 'OTHER', label: '其它' }, { v: '?', label: '未确认' }
]
/* 分类 key/中文名来自全局预设，站点只保存 key 和 ID */
const s = computed(function () { return props.site || {} })
const host = computed(function () { return (props.site && props.site.name) || '' })
const detail = reactive({ def: null, preset: null, catalog: null, items: [] })
const form = reactive({ url: '', cookie: '', override: false, ovInterval: '', ovDetail: false, priority: 'normal' })
const defText = ref('')
const defReady = ref(true)
const watchOpen = ref('')
const detectAllBusy = ref(false)
const detectAllMsg = ref('')
const detectResult = ref(null)
const detectSaving = ref(false)
const detectSaveMsg = ref('')
const detectSub = ref('')
const presetPreview = ref(null)
const busy = reactive({ selfcheck: false, save: false, cookie: false })

function cookieWhen(site) { return site.cookieUpdatedAt ? ' · ' + fmtWhen(site.cookieUpdatedAt) : '' }

const previewGroups = computed(() => {
  const p = presetPreview.value
  if (!p) return []
  const labels = p.labels || {}
  return Object.keys(p.cats || {}).map(function (k) {
    return { key: k, name: typeLabelOf(k), ids: (p.cats[k] || []).map(function (id) { return id + (labels[id] ? ' ' + labels[id] : '') }).join('、') }
  })
})
const previewUnmatchedGroups = computed(() => {
  const list = (presetPreview.value && presetPreview.value.unmatched) || []
  const names = { type: '分类', medium: '媒介', resolution: '分辨率', codec: '编码', audio: '音频', discount: '优惠', team: '制作组', restriction: '限制' }
  const groups = {}
  list.forEach(function (x) { const d = names[x.dim] || x.dim || '其它'; (groups[d] = groups[d] || []).push(x.label) })
  return Object.keys(groups).map(function (d) { return { dim: d, labels: groups[d].join('、'), count: groups[d].length } })
})
const previewUnmatchedCount = computed(() => ((presetPreview.value && presetPreview.value.unmatched) || []).length)
const previewUnmatchedSummary = computed(() => previewUnmatchedGroups.value.map(function (g) { return g.dim + ' ' + g.count }).join(' · '))
const previewAmbiguous = computed(() => ((presetPreview.value && presetPreview.value.ambiguous) || []).join('、'))

const cookieStats = computed(function () {
  const site = s.value || {}
  const raw = String(form.cookie || '')
  const count = raw.split(';').map(function (x) { return x.trim() }).filter(function (x) { return x.indexOf('=') > 0 }).length
  let state = 'bad'
  let text = '未保存'
  let num = count || '—'
  if (site.cookieSaved && site.cookieReadable !== false) {
    if (site.login === 'ok') { state = 'ok'; text = '已登录' }
    else if (site.login === 'fail') { state = 'bad'; text = '登录失败' }
    else { state = 'warn'; text = '待验证' }
  } else if (site.cookieSaved) { state = 'bad'; text = '解不开'; num = '—' }
  return { count: count, state: state, text: text, num: num }
})
const loginStats = computed(function () {
  const site = s.value || {}
  if (!site.cookieSaved) return { state: 'bad', num: '—', text: '未导入' }
  if (site.cookieReadable === false) return { state: 'bad', num: '×', text: '解不开' }
  if (site.login === 'ok') return { state: 'ok', num: '✓', text: '已登录' }
  if (site.login === 'fail') return { state: 'bad', num: '×', text: '登录失败' }
  return { state: 'warn', num: '!', text: '待验证' }
})
const addressStats = computed(function () {
  const raw = String(form.url || '').trim()
  const hostText = raw.replace(/^https?:\/\//i, '').split('/')[0]
  return { state: raw ? 'ok' : 'bad', text: hostText || '未填地址' }
})
const coverStats = computed(function () {
  return form.override ? { state: 'warn', num: 'ON', text: '单独设置' } : { state: 'ok', num: 'OFF', text: '跟随全局' }
})
const searchCount = computed(function () {
  if (detectResult.value && detectResult.value.search) return Object.keys((detectResult.value.search.search && detectResult.value.search.search.cats) || {}).length
  return catGroups.value.length
})
const publishCount = computed(function () {
  if (detectResult.value && detectResult.value.publish) return Object.keys(detectResult.value.publish.cat || {}).length
  return publishGroups.value.length
})
const uploadCount = computed(function () {
  if (detectResult.value && detectResult.value.publish && detectResult.value.publish.upload) return Object.keys(detectResult.value.publish.upload.fields || {}).length
  return uploadStats.value.count || uploadStats.value.defaultCount || 0
})
const searchSubState = computed(() => searchCount.value ? 'ok' : 'bad')
const publishSubState = computed(() => {
  if (detectResult.value && detectResult.value.publish && detectResult.value.publish.fieldKind === 'genre') return 'warn'
  return publishCount.value ? 'ok' : 'bad'
})
const uploadSubState = computed(() => detectResult.value && detectResult.value.publish && detectResult.value.publish.upload ? (uploadCount.value ? 'ok' : 'bad') : (uploadStats.value.count ? 'ok' : (uploadStats.value.defaultCount ? 'warn' : 'bad')))
const detectValidation = computed(function () {
  const r = detectResult.value
  if (!r) return { ok: false, errors: [], warnings: [] }
  const errors = []
  const warnings = []
  const search = r.search
  const searchCats = (search && search.search && search.search.cats) || {}
  if (!search) errors.push('搜索页识别失败')
  else if (!Object.keys(searchCats).length) errors.push('搜索分类 0 类')
  if (search && search.ambiguous && search.ambiguous.length) warnings.push('搜索冲突 ID ' + search.ambiguous.length + ' 个未写')
  if (search && search.unmatched && search.unmatched.length) warnings.push('未识别标签 ' + search.unmatched.length + ' 个')
  const pub = r.publish
  const upload = (pub && pub.upload) || {}
  const fields = upload.fields || {}
  if (!pub) errors.push('上传页识别失败')
  else {
    if (pub.ambiguous && pub.ambiguous.length) warnings.push('发布冲突 ID ' + pub.ambiguous.length + ' 个未写')
    if (pub.unmatched && pub.unmatched.length) warnings.push('发布未匹配标签 ' + pub.unmatched.length + ' 个')
    if (pub.fieldKind === 'genre') errors.push('发布分类是题材字段，不能自动映射')
    else if (!Object.keys(pub.cat || {}).length) errors.push('发布分类 0 类')
    if (!Object.keys(fields).length) errors.push('上传字段 0 个')
    if (!upload.fileField) errors.push('缺少种子文件字段')
    if (!upload.path) errors.push('缺少提交路径')
  }
  return { ok: errors.length === 0, errors: errors, warnings: warnings }
})
const detectStats = computed(function () {
  const score = (searchCount.value ? 1 : 0) + (publishCount.value ? 1 : 0) + (uploadCount.value ? 1 : 0)
  return { num: score, text: score + '/3', state: score === 3 ? 'ok' : (score ? 'warn' : 'bad') }
})
const detectedPublishGroups = computed(function () {
  const cat = (detectResult.value && detectResult.value.publish && detectResult.value.publish.cat) || {}
  return Object.keys(cat).map(function (k) { return { name: runtimePresets.value.types[k] || k, ids: String(cat[k]) } })
})
const detectedUploadCount = computed(function () {
  const u = (detectResult.value && detectResult.value.publish && detectResult.value.publish.upload) || {}
  return Object.keys(u.fields || {}).length
})
const publishGroups = computed(function () {
  const d = detail.def || {}
  const cm = Object.prototype.hasOwnProperty.call(d, 'publishCatMap') ? d.publishCatMap : d.catMap
  const types = runtimePresets.value.types || {}
  if (Array.isArray(cm)) {
    return cm.map(function (r) {
      const id = String((r && r.id) || '')
      const label = String((r && r.label) || id || '未命名')
      const purpose = String((r && r.purpose) || 'other')
      return { name: label + (id && label !== id ? ' (' + id + ')' : ''), ids: types[purpose] || purpose }
    })
  }
  if (cm && typeof cm === 'object') {
    return Object.keys(cm).map(function (k) {
      return { name: types[k] || k, ids: String(cm[k] == null ? '' : cm[k]) || '—' }
    })
  }
  return []
})
const uploadStats = computed(function () {
  const d = detail.def || {}
  const u = d.uploadMap || d.upload || {}
  const ed = d.uploadDefaults || {}
  return { count: Object.keys(u.fields || {}).length, defaultCount: Number(ed.fieldCount) || 0 }
})
const catGroups = computed(function () {
  const d = detail.def || {}
  const p = detail.preset || {}
  const groups = (p.cats && Object.keys(p.cats).length ? p.cats : d.cats) || {}
  return Object.keys(groups).map(function (name) { return { name: runtimePresets.value.types[name] || name, ids: (groups[name] || []).join(', ') || '—' } })
})


function engineTxt(site) {
  const raw = (detail.preset && detail.preset.engine) || (detail.def && detail.def.engine) || (site.def && site.def.engine) || ''
  return raw ? (ENG_CODE[raw] || raw.toUpperCase()) + ' · ' + raw : '未识别'
}
function sourceTxt() {
  const src = (detail.preset && detail.preset.source) || ''
  if (!src) return '还没有预设'
  if (src === 'auto') return '采样自动生成，还没人工确认'
  if (src === 'arch') return '按清单架构推断，还没采样'
  if (src === 'manual') return '人工确认过的'
  return src
}
function paramTxt() {
  const d = detail.def || {}
  const mode = d.catMode || ''
  const param = Object.keys(d.params || {}).find(function (k) { return String(d.params[k]).indexOf('{cats}') >= 0 }) || ''
  if (!mode && !param) return Object.keys(catGroups.value).length ? 'cat（按分类 id 筛）' : '—'
  return (mode || '—') + (param ? ' · ' + param : '')
}
function catalogTxt() {
  const c = detail.catalog
  if (!c || !c.total) return '这个站还没有词条'
  const b = c.byStatus || {}
  return '共 ' + c.total + ' 条 · 待筛选 ' + (b.new || 0) + ' · 已送审 ' + (b.selected || 0) + ' · 已发 ' + (b.published || 0)
}
function sampleTxt(site) {
  const d = detail.def
  if (!d) return site.def ? (site.def.groups || 0) + ' 组分类' : '还没采样'
  const rows = (d.source && d.source.rows) || 0
  const groups = Object.keys(d.cats || {}).length
  return rows + ' 行 · ' + groups + ' 组分类'
}
function kindTxt() {
  const d = detail.def
  const kind = d && d.source && d.source.kind
  if (!d) return '没有定义'
  if (kind === 'sample') return '采样确认'
  if (kind === 'shell') return '引擎按页面特征确认，分类待补'
  if (kind === 'arch') return '按清单架构推断，还没采样'
  return d.engine ? '引擎已确认，分类待补' : '按清单架构推断，还没采样'
}
function catRangeTxt(site) {
  const groups = (detail.preset && detail.preset.groups) || (site.def && site.def.groups) || 0
  return groups ? groups + ' 组分类' : '还没有分类'
}
function fillForm(site) {
  if (!site) return
  form.url = site.url
  form.override = site.override
  form.ovInterval = site.ovInterval
  form.ovDetail = site.ovDetail
  form.priority = site.priority
}
function loadDefFallback(h) {
  const site = s.value
  const tpl = { engine: (site && site.def && site.def.engine) || 'nexusphp', base: (site && site.url) || ('https://' + h),
    uploadMap: { path: '/takeupload.php', formPath: '/upload.php', fileField: 'file', fields: { name: '{title}', descr: '{description}', type: '{catId}', anon: '{anonymous}' } },
    verify: { path: '/torrents.php?search={title}' }, catMap: {} }
  defText.value = JSON.stringify(tpl, null, 2)
}
async function loadDetail(target) {
  const h = String(target || host.value || '')
  if (!h) return
  form.cookie = ''
  detail.def = null
  detail.preset = null
  detail.catalog = null
  detail.items = []
  presetPreview.value = null
  try {
    const rs = await Promise.all([
      fetch('/api/site-def/' + encodeURIComponent(h), { credentials: 'same-origin' }).then(function (r) {
        return r.json().catch(function () { return null }).then(function (body) { return { status: r.status, body: body } })
      }).catch(function () { return { status: 0, body: null } }),
      fetch('/api/sites/' + encodeURIComponent(h) + '/search', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null }).catch(function () { return null }),
      fetch('/api/catalog?site=' + encodeURIComponent(h) + '&limit=6', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null }).catch(function () { return null }),
      fetch('/api/credentials/' + encodeURIComponent(h), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null }).catch(function () { return null })
    ])
    if (host.value !== h) return
    const dj = rs[0], pj = rs[1], cj = rs[2], ckj = rs[3]
    if (ckj && ckj.ok && ckj.data) form.cookie = ckj.data.hasCookie ? String(ckj.data.cookie || '') : ''
    defReady.value = false
    if (dj && dj.body && dj.body.ok && dj.body.data) {
      detail.def = dj.body.data
      defText.value = JSON.stringify(dj.body.data, null, 2)
      defReady.value = true
    } else if (dj && dj.status === 404) {
      loadDefFallback(h)
      defReady.value = true
    } else {
      defText.value = ''
    }
    if (pj && pj.ok) detail.preset = (pj.data && pj.data.preset) || null
    if (cj && cj.ok) {
      detail.catalog = { total: cj.data.total || 0, byStatus: cj.data.byStatus || {} }
      detail.items = cj.data.items || []
    }
  } catch (e) { reportError('SiteDetail', e) }
}
async function patchConfig(patch) {
  try {
    const j = await (await fetch('/api/site-config/' + encodeURIComponent(host.value), {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch)
    })).json()
    if (j && j.ok) return true
    toast((j && j.error && j.error.message) || '设置保存失败')
  } catch (e) { toast('设置请求发不出去') }
  return false
}
async function toggleEnabled(site) {
  const ok = await patchConfig({ enabled: !site.enabled })
  if (ok) { toast(site.enabled ? '已停用 ' + site.name : '已启用 ' + site.name); emit('changed') }
}
async function setArch(site, e) {
  const ok = await patchConfig({ arch: e.target.value })
  if (ok) { toast('架构已改为 ' + e.target.value); emit('changed') }
}
async function saveSite(site) {
  if (busy.save) return
  busy.save = true
  const saved = {
    url: form.url, override: !!form.override, ovInterval: form.ovInterval,
    ovDetail: !!form.ovDetail, priority: form.priority
  }
  const ok = await patchConfig(saved)
  if (ok) {
    const cookie = String(form.cookie || '').trim()
    if (cookie) {
      try {
        const j = await (await fetch('/api/credentials/' + encodeURIComponent(site.name), {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: cookie })
        })).json()
        if (j && j.ok) {
          toast('设置与 cookie 都已保存，正在自检…')
          emit('changed')
          await selfcheckHost(site.name)
        } else toast((j && j.error && j.error.message) || 'cookie 没存进服务端')
      } catch (e) { toast('cookie 请求发不出去') }
    } else toast('设置已保存')
    emit('changed')
    await loadDetail(site.name)
    fillForm(s.value)
    /* 父级刷新可能晚于子组件回填，用刚保存的值兜底，避免表单显示旧 URL */
    Object.assign(form, saved)
  }
  busy.save = false
}
function clearCookie(site) {
  if (busy.cookie) return
  confirmBox('删除 Cookie', '只清掉这个站已保存的 cookie；站点配置、分类映射和抓取设置都会保留。继续？', async function () {
    busy.cookie = true
    try {
      const j = await (await fetch('/api/credentials/' + encodeURIComponent(site.name), {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookie: '' })
      })).json()
      if (j && j.ok) {
        form.cookie = ''
        toast('已删除 cookie：' + site.name)
        emit('changed')
        await loadDetail(site.name)
        fillForm(s.value)
      } else toast((j && j.error && j.error.message) || '删除 cookie 失败')
    } catch (e) { toast('删除 cookie 请求发不出去') }
    busy.cookie = false
  })
}
function resetSite(site) {
  confirmBox('恢复默认', '会清掉「' + site.name + '」的服务端配置，回到站点清单里的默认值。继续？', async function () {
    try {
      const j = await (await fetch('/api/site-config/' + encodeURIComponent(site.name), { method: 'DELETE', credentials: 'same-origin' })).json()
      if (j && j.ok) {
        toast('已恢复默认')
        emit('changed')
        await loadDetail(site.name)
        fillForm(s.value)
      } else toast((j && j.error && j.error.message) || '恢复失败')
    } catch (e) { toast('恢复请求发不出去') }
  })
}
function removeSite(site) {
  const text = site.added
    ? '会删除面板里添加的站点和凭据。继续？'
    : '会把这个基础站点从面板移除并删除凭据；之后可在站点页「已移除」里恢复，恢复后要重新导入 cookie。继续？'
  confirmBox('移除站点', text, async function () {
    try {
      const j = await (await fetch('/api/sites/' + encodeURIComponent(site.name), { method: 'DELETE', credentials: 'same-origin' })).json()
      if (j && j.ok) { toast('已移除：' + site.name); emit('removed') }
      else toast((j && j.error && j.error.message) || '移除失败')
    } catch (e) { toast('移除请求发不出去') }
  })
}
async function selfcheckHost(h) {
  try {
    const j = await (await fetch('/api/sites/' + encodeURIComponent(h) + '/session-test', { method: 'POST', credentials: 'same-origin' })).json()
    if (j && j.ok) toast(j.data.pass ? 'cookie 可用' : 'cookie 失效，重新导入后再试')
    else toast((j && j.error && j.error.message) || '自检失败')
    emit('changed')
  } catch (e) { toast('自检请求发不出去') }
}
async function selfcheckOne(site) {
  if (busy.selfcheck || !site.cookieSaved) return
  busy.selfcheck = true
  await selfcheckHost(site.name)
  busy.selfcheck = false
}
function toggleWatch(kind) { watchOpen.value = watchOpen.value === kind ? '' : kind }
function typeLabelOf(key) {
  const t = runtimePresets.value && runtimePresets.value.types
  return (t && t[key]) || key
}
async function detectAll() {
  if (!host.value || detectAllBusy.value) return
  watchOpen.value = 'detect'
  detectAllBusy.value = true
  detectAllMsg.value = '识别中…'
  detectResult.value = null
  presetPreview.value = null
  const out = { search: null, publish: null, errors: [] }
  try {
    const j = await (await fetch('/api/crawl/preset/' + encodeURIComponent(host.value) + '/detect?preview=1', { method: 'POST', credentials: 'same-origin' })).json()
    if (j && j.ok) {
      out.search = j.data
      presetPreview.value = {
        cats: (j.data.search && j.data.search.cats) || {},
        labels: (j.data.detected && j.data.detected.catLabels) || {},
        ambiguous: (j.data && j.data.ambiguous) || [],
        unmatched: (j.data && j.data.unmatched) || []
      }
    } else out.errors.push('搜索：' + String((j && j.error && j.error.message) || '识别失败'))
  } catch (e) { out.errors.push('搜索请求发不出去') }
  try {
    const j = await (await fetch('/api/maps/' + encodeURIComponent(host.value) + '/detect', { method: 'POST', credentials: 'same-origin' })).json()
    if (j && j.ok) out.publish = j.data
    else out.errors.push('上传：' + String((j && j.error && j.error.message) || '识别失败'))
  } catch (e) { out.errors.push('上传请求发不出去') }
  detectResult.value = out
  const n = Object.keys((out.search && out.search.search && out.search.search.cats) || {}).length
  const p = Object.keys((out.publish && out.publish.cat) || {}).length
  const u = Object.keys((out.publish && out.publish.upload && out.publish.upload.fields) || {}).length
  detectAllMsg.value = '搜索 ' + n + ' 类 · 发布 ' + p + ' 类 · 上传 ' + u + ' 字段' + (out.errors.length ? ' · ' + out.errors.length + ' 段失败' : '')
  detectAllBusy.value = false
}

async function saveDetected() {
  const r = detectResult.value
  if (!r || detectSaving.value || !host.value) return
  detectSaving.value = true
  detectSaveMsg.value = '保存中…'
  const errors = []
  if (r.search && r.search.detected) {
    try {
      const a = await (await fetch('/api/crawl/preset/' + encodeURIComponent(host.value) + '/apply', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ detected: r.search.detected })
      })).json()
      if (!a || !a.ok) errors.push('搜索：' + String((a && a.error && a.error.message) || '保存失败'))
    } catch (e) { errors.push('搜索保存请求发不出去') }
  }
  if (r.publish) {
    const genre = r.publish.fieldKind === 'genre'
    const cat = r.publish.cat || {}
    if (!genre && Object.keys(cat).length) {
      try {
        const a = await (await fetch('/api/maps/' + encodeURIComponent(host.value), {
          method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cat: cat, form: r.publish.form })
        })).json()
        if (!a || !a.ok) errors.push('发布：' + String((a && a.error && a.error.message) || '保存失败'))
      } catch (e) { errors.push('发布保存请求发不出去') }
    }
    if (r.publish.upload) {
      try {
        const d = detail.def || {}
        const a = await (await fetch('/api/site-def/' + encodeURIComponent(host.value), {
          method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ engine: d.engine || '', base: d.base || '', uploadMap: r.publish.upload })
        })).json()
        if (!a || !a.ok) errors.push('上传：' + String((a && a.error && a.error.message) || '保存失败'))
      } catch (e) { errors.push('上传保存请求发不出去') }
    }
  }
  detectSaving.value = false
  if (errors.length) { detectSaveMsg.value = errors.join('；'); toast(detectSaveMsg.value); return }
  detectSaveMsg.value = '已保存'
  toast('站点配置已保存')
  detectResult.value = null
  presetPreview.value = null
  await loadDetail(host.value)
}

function closeDetail() { emit('close') }

onMounted(function () {
  fillForm(s.value)
  loadDetail(host.value)
  loadRuntimePresets()
})
watch(host, function (h, old) {
  if (h && h !== old) {
    fillForm(s.value)
    loadDetail(h)
  }
})
</script>

<style scoped>
/* Sites 页面样式：迁入 scoped，shared 组件/shell 保留全局 */
.sites-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.sites-search { position: relative; width: 232px; }
.sites-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--muted-2); }
.sites-search input {
  width: 100%; height: 36px; padding: 0 12px 0 33px; border-radius: 10px;
  border: 1px solid var(--line-2); background: #fff; font: inherit; font-size: 12.5px; color: var(--ink);
}
.sites-search input::placeholder { color: var(--muted-2); }
.sites-search input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,70,229,.09); }
.sites-empty { padding: 48px 0; text-align: center; color: var(--muted-2); font-size: 12.5px; }
@media (max-width: 1100px) {
.sites-panel { overflow-x: auto; }
}
.sites-panel { overflow: clip; }
.sites-list {
  width: 328px; flex: 0 0 328px; background: #fff; border-radius: 14px;
  box-shadow: var(--shadow); display: flex; flex-direction: column; overflow: hidden;
}
.site-item { display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 10px; cursor: pointer; transition: background .13s ease; }
.site-item + .site-item { margin-top: 2px; }
.site-item:hover { background: #f7f8fa; }
.site-item.on .si-txt b { color: var(--accent); }
.si-txt { flex: 1; min-width: 0; }
.si-txt b { display: block; font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.si-txt span { display: block; margin-top: 2px; font-size: 11px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.site-detail { flex: 1; min-width: 0; background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 24px 26px; overflow-y: auto; }
.sd-top { display: flex; align-items: center; gap: 14px; }
.sd-id { min-width: 0; }
.sd-id h2 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.01em; }
.sd-actions { display: flex; gap: 6px; }
.sd-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12.5px; color: var(--muted); padding: 6px 0; }
.sd-row + .sd-row { border-top: 1px solid #f5f6f8; }
.sd-row b { color: var(--ink); font-weight: 500; }
.sd-recent { display: grid; grid-template-columns: 1fr 84px 74px; gap: 12px; align-items: center; padding: 8px 0; font-size: 12.5px; }
.sd-recent + .sd-recent { border-top: 1px solid #f5f6f8; }
.sd-recent .t-main { color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sd-recent .soft { color: var(--muted-2); font-size: 11.5px; text-align: right; }
@media (max-width: 1100px) {
.sites-list { width: 100%; flex: none; max-height: 360px; }
}
.sd-sec-ttl { margin: 16px 0 4px; font-size: 12px; font-weight: 600; color: var(--muted); }
.sd-sec-ttl:first-child { margin-top: 4px; }
.sd-tabs { display: none; }
.sd-tabs .tabbtn { height: 26px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px; background: #fff; font: inherit; font-size: 11px; color: var(--muted); cursor: pointer; white-space: nowrap; }
.sd-tabs .tabbtn.active { color: var(--accent); border-color: var(--accent); background: var(--accent-soft); font-weight: 600; }
.sd-form { margin-top: 4px; display: grid; gap: 14px; }
.sd-field { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 0; font-size: 12.5px; color: var(--muted); }
.sd-field + .sd-field { border-top: 1px solid #f5f6f8; }
.sd-field .input, .sd-field .select { width: 230px; height: 32px; font-size: 12.5px; }
.sd-form .sd-card h3 { margin-bottom: 4px; }
.sd-form-actions { display: flex; gap: 8px; align-items: center; }
.sd-form-actions { position: sticky; bottom: 0; z-index: 2; background: #fff; padding: 12px 0 2px; box-shadow: 0 -8px 12px -8px rgba(16,24,40,.12); }
.site-detail { display: flex; flex-direction: column; overflow: hidden; }
.sd-scroll { flex: 1; overflow-y: auto; padding-right: 8px; margin-right: -8px; scrollbar-width: thin; }
.sd-scroll::-webkit-scrollbar { width: 8px; }
.sd-scroll::-webkit-scrollbar-thumb { background: #e3e6ec; border-radius: 99px; border: 2px solid #fff; }
.sd-form-actions { position: static; box-shadow: none; border-top: 1px solid var(--line); padding: 14px 0 0; margin-top: 14px; }
.sd-actions { align-items: center; }
.sd-actions .btn.tabbtn { border-color: transparent; background: var(--panel-2); color: var(--muted); }
.sd-actions .btn.tabbtn.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.sd-actions .btn.tabbtn:hover { color: var(--ink); }
.site-item .site-pick { width: 14px; height: 14px; flex: 0 0 14px; accent-color: var(--accent); cursor: pointer; opacity: .45; transition: opacity .12s; }
.site-item:hover .site-pick, .site-item .site-pick:checked { opacity: 1; }
.modal-scroll .sd-field .input, .modal-scroll .sd-field .select { width: 200px; height: 32px; font-size: 12.5px; }
.drawer-body-flush .sites-bar { padding: 16px 20px 0; margin-bottom: 12px; }
.drawer-body-flush .sites-list, .drawer-body-flush .site-detail { box-shadow: none; border: 1px solid var(--line); }
.drawer-body-flush .sites-bar { padding: 14px 20px 12px; margin-bottom: 0; }
.drawer-body-flush .sites-list { width: 300px; flex: 0 0 300px; border: 0; box-shadow: none; background: var(--panel-2); border-radius: 12px; }
.drawer-body-flush .site-detail { border: 0; box-shadow: none; border-radius: 12px; padding: 20px 22px; }
.drawer-body-flush .site-item.on { background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
.drawer-body-flush .sites-bar { flex: 0 0 auto; }
.drawer-body-flush .sites-list { min-height: 0; }
.sites-pager { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
.sites-pager span { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.sd-scroll { overflow: hidden; }
.site-item { padding: 7px 10px; }
.si-txt b { font-size: 12.5px; }
.drawer-body-flush .sd-scroll { overflow-y: auto; overscroll-behavior: contain; }
.drawer-body-flush .sd-scroll::-webkit-scrollbar { width: 0 !important; }
.sd-form .set-fields + .set-fields { margin-top: 4px; }
.drawer-body-flush .sd-form .set-field { padding: 10px 0; }
.drawer-body-flush .sd-form .cat-row { padding: 2px 0 8px; }
.drawer-body-flush .sd-form .sd-note { min-height: 56px; }
.drawer-body-flush .sd-form .set-field { padding: 7px 0; }
.drawer-body-flush .sd-form .set-field .lbl span { font-size: 12.5px; }
.drawer-body-flush .sd-form .set-field .lbl i { font-size: 10.5px; margin-top: 2px; }
.drawer-body-flush .sd-form .set-field .input, .drawer-body-flush .sd-form .set-field .select { height: 30px; width: 200px; font-size: 12px; }
.drawer-body-flush .sd-form .sd-note { min-height: 46px; }
.drawer-body-flush .sd-form .cat-chip { padding: 4px 9px; font-size: 11.5px; }
.drawer-body-flush .sd-form-actions { padding-top: 10px; margin-top: 8px; }
.drawer-body-flush .sd-form .cat-row { gap: 5px; }
.drawer-body-flush .sd-form .ctl textarea { width: 300px; height: 58px; }
:global(.view[data-view="sites"]) { height: calc(100vh - 150px); display: flex; flex-direction: column; }
.sites-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.sites-wrap .sites-bar { padding: 0; margin-bottom: 0; }
.sites-wrap .sites-list { border: 0; box-shadow: var(--shadow); background: #fff; border-radius: 14px; width: 320px; flex: 0 0 320px; }
.sites-wrap .site-detail { border: 0; border-radius: 14px; box-shadow: var(--shadow); padding: 22px 24px; }
.sites-wrap .site-item { padding: 8px 10px; }
.sites-wrap .site-item + .site-item { margin-top: 1px; }
.sites-wrap .ava { width: 26px; height: 26px; flex: 0 0 26px; font-size: 10px; }
.sites-wrap .si-txt b { font-size: 13px; }
.sites-wrap .si-txt span { font-size: 11px; }
.sites-wrap .sd-scroll { overflow-y: auto; }
.sd-field .pick-row { justify-content: flex-start; }
.sd-form .set-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 34px; }
.sd-form .set-field { flex-direction: row; align-items: center; gap: 16px; padding: 11px 0; }
.sd-form .set-field .lbl { flex: 1; min-width: 0; }
.sd-form .set-field .lbl i { display: block; margin-top: 2px; }
.sd-form .set-field .ctl { flex: 0 0 auto; width: 230px; display: flex; justify-content: flex-end; }
.sd-form .set-field .ctl .input, .sd-form .set-field .ctl .select { width: 100%; height: 32px; font-size: 12px; }
.sd-form .set-field:has(textarea), .sd-form .set-field:has(.pick-row) { grid-column: 1 / -1; flex-direction: column; align-items: stretch; gap: 8px; }
.sd-form .set-field:has(textarea) .ctl, .sd-form .set-field:has(.pick-row) .ctl { width: 100%; }
.sd-form .set-field .ctl textarea { width: 100%; min-height: 68px; }
.sites-panel { background: #fff; border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
.st-head, .site-item {
  display: grid; grid-template-columns: 26px minmax(0, 1fr) 104px 72px 92px 116px 40px;
  align-items: center; gap: 14px; padding: 0 18px;
}
.st-head { height: 34px; background: #fcfcfd; border-bottom: 1px solid var(--line);
  font-size: 11px; color: var(--muted-2); }
.sites-rows { max-height: calc(100vh - 250px); overflow-y: auto; }
.site-item { height: 46px; border-bottom: 1px solid #f4f5f7; cursor: pointer; }
.site-item:last-child { border-bottom: 0; }
.site-item:hover { background: #fafbfd; }
.site-item.on { background: var(--accent-soft); }
.site-item .site-pick { width: 14px; height: 14px; accent-color: var(--accent); }
.si-txt { min-width: 0; }
.si-txt b { display: block; font-size: 12px; font-weight: 600; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.si-txt span { display: block; font-size: 10.5px; color: var(--muted-2); }
.si-arch .chip { font-size: 10px; }
.si-login { font-size: 11.5px; color: var(--muted); }
.si-login.ok { color: var(--green); }
.si-login.bad { color: var(--red); }
.si-mode, .si-last { font-size: 11.5px; color: var(--muted); }
.sheet-x { position: absolute; top: 14px; right: 14px; width: 26px; height: 26px; border: 0;
  border-radius: 7px; background: #f3f4f8; color: var(--muted); font-size: 12px; cursor: pointer; }
.sheet-x:hover { background: #e9ebf2; color: var(--ink); }
.site-item { height: 42px; }
.sites-wrap { display: flex; flex-direction: column; height: calc(100vh - 150px); }
.sites-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.sites-rows { flex: 1; max-height: none; min-height: 0; overflow-y: auto; }
.sites-stats { flex: 0 0 auto; display: flex; align-items: center; flex-wrap: wrap;
  gap: 14px 27px; background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 13px 20px; margin-bottom: 12px; }
.ss-nums { display: flex; gap: 26px; flex: 0 0 auto; }
.ss-nums span { display: block; font-size: 10.5px; color: var(--muted-2); }
.ss-nums b { font-size: 19px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--ink); }
.ss-nums b.warn { color: var(--amber); }
.ss-nums b.bad { color: var(--red); }
.ss-arch { flex: 1 1 220px; min-width: 220px; }
.ss-bar .seg.np { background: #8b7cf6; }
.ss-bar .seg.u3d { background: #34c4a0; }
.ss-bar .seg.gz { background: #4aa3f5; }
.ss-bar .seg.oth { background: #f0a93b; }
.ss-bar .seg.unk { background: #c6cbd6; }
.ss-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 7px; font-size: 10.5px; color: var(--muted); }
.ss-legend .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: 0; }
.ss-legend .dot.np { background: #8b7cf6; }
.ss-legend .dot.u3d { background: #34c4a0; }
.ss-cov { flex: 1 1 100%; margin-top: 0; font-size: 11px; color: var(--muted); line-height: 1.65; }
.ss-legend .dot.gz { background: #4aa3f5; }
.ss-legend .dot.oth { background: #f0a93b; }
.ss-legend .dot.unk { background: #c6cbd6; }
.st-head, .site-item { grid-template-columns: 28px minmax(0, 1fr) 86px 92px 116px 40px; gap: 16px; padding: 0 22px; }
.ss-bar { display: flex; gap: 2px; height: 8px; border-radius: 99px; overflow: hidden; background: #eef0f6; }
.ss-bar .seg { display: block; height: 100%; }
.site-item .site-pick { margin-right: 2px; }
.st-head, .site-item { grid-template-columns: 28px minmax(0, 1fr) 104px 86px 92px 116px 40px; }
.st-head, .site-item { padding: 0 22px; }
.ss-bar { gap: 0; border-radius: 3px; }
.ss-bar .seg { height: 100%; border-radius: 0; }
.ss-bar .seg:first-child { border-radius: 3px 0 0 3px; }
.ss-bar .seg:last-child { border-radius: 0 3px 3px 0; }
.site-expand { display: block; padding: 16px 22px 14px; background: #f8f9fc; border-bottom: 1px solid var(--line); }
.site-expand[hidden] { display: none; }
.site-expand .sd-top { position: relative; display: grid; grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 8px 10px; align-items: start; padding-right: 34px; }
.site-expand .sd-top .ava.lg { grid-row: 1 / span 2; }
.site-expand .sd-id { grid-column: 2; }
.site-expand .sd-id h2 { font-size: 16px; margin-bottom: 2px; }
.site-expand .sd-actions { grid-column: 2; display: flex; gap: 5px; flex-wrap: nowrap; align-items: center; }
.site-expand .sd-actions .btn { height: 26px; padding: 0 8px; font-size: 11px; white-space: nowrap; }
.site-expand .sd-actions .select, .site-expand .sd-actions .switch { height: 26px; }
.site-expand .sd-actions { overflow-x: auto; }
.site-expand .sheet-x { position: absolute; top: 0; right: 0; }
.site-expand .sd-scroll { overflow: visible; }
.site-expand .sd-top { grid-template-columns: minmax(0, 1fr) auto; }
.site-expand .sd-top .ava.lg { display: none; }
.site-expand .sd-id h2 { font-size: 15px; }
.site-expand .sd-url { font-size: 11px; }
.site-expand .sd-id, .site-expand .sd-chips, .site-expand .sd-actions { grid-column: 1; }
.site-expand .sd-top { grid-template-columns: minmax(0, 1fr) auto auto; grid-template-rows: auto auto;
  align-items: center; gap: 8px 12px; padding-right: 0; }
.site-expand .sd-id { grid-column: 1; grid-row: 1; }
.site-expand .sd-actions { grid-column: 2; grid-row: 1; justify-self: end; align-self: center; }
.site-expand .sheet-x { position: static; grid-column: 3; grid-row: 1; align-self: center; }
.site-expand .sd-form .set-fields { margin-top: 6px; }
.site-expand .sd-form .set-field { min-height: 38px; padding: 5px 0; gap: 16px; }
.site-expand .sd-form .set-field .lbl { min-width: 0; white-space: nowrap; overflow: hidden; }
.site-expand .sd-form .set-field .lbl span { display: inline-block; vertical-align: middle; font-size: 12px; }
.site-expand .sd-form .set-field .lbl i { display: inline-block; margin: 0 0 0 8px; vertical-align: middle;
  font-size: 10.5px; line-height: 14px; overflow: hidden; text-overflow: ellipsis; max-width: 520px; }
.site-expand .sd-form .set-field .ctl { display: flex; align-items: center; justify-content: flex-end; width: 220px; }
.site-expand .sd-form .set-field .ctl .input, .site-expand .sd-form .set-field .ctl .select { width: 100%; height: 28px; font-size: 11.5px; }
.site-expand .sd-form .set-field .ctl .btn { height: 28px; font-size: 11.5px; }
.site-expand .sd-form .set-field textarea { width: 100%; min-height: 72px; }
.site-expand .sd-form .set-field:has(textarea) { flex-direction: column; align-items: stretch; }
.site-expand .sd-form { max-width: 760px; }
.site-expand .sd-form .set-fields { display: block; }
.site-expand .sd-form .set-field { display: flex; justify-content: space-between; align-items: center; }
.site-expand .sd-form .set-field + .set-field { border-top: 1px solid #f1f3f7; }
.site-item, .site-item.on { border-radius: 0; }
.site-expand .sd-form { max-width: none; }
.site-expand .sd-form .set-field { justify-content: flex-start; gap: 20px; }
.site-expand .sd-form .set-field .lbl { flex: 0 0 180px; }
.site-expand .sd-form .set-field .ctl { width: 280px; }
.site-expand .sd-form .set-field:has(textarea) .ctl { width: 100%; }
.site-expand .sd-strip { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 24px;
  margin-top: 10px; font-size: 11px; color: var(--muted-2); }
.site-expand .sd-strip b { margin-left: 5px; font-size: 12.5px; font-weight: 600; color: var(--ink);
  font-variant-numeric: tabular-nums; }
.site-expand .sd-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 0 32px; margin-top: 12px; }
.site-expand .sd-compact h4, .site-expand .sd-recent-wrap h4 {
  margin: 0 0 4px; font-size: 10px; font-weight: 600; letter-spacing: .6px; color: var(--muted-2); }
.site-expand .sd-compact .sd-row { padding: 4px 0; font-size: 11.5px; border-top: 1px solid #f1f3f7; }
.site-expand .sd-compact > div > .sd-row:first-of-type { border-top: 0; }
.site-expand .sd-recent-wrap { margin-top: 14px; }
.site-expand .sd-recent-wrap .sd-recent { padding: 4px 0; font-size: 11.5px; border-top: 1px solid #f1f3f7; }
.site-expand .sd-recent-wrap .sd-recent:first-of-type { border-top: 0; }
.st-head { border-bottom: 1px solid var(--line); }
.site-expand .sd-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; min-width: 0; }
.site-expand .sd-title-row h2 { margin: 0; font-size: 15px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.site-expand .sd-title-row .pill2, .site-expand .sd-title-row .chip { flex: 0 0 auto; }
.site-expand .sd-id .sd-url { display: block; margin-top: 2px; }
.site-expand .sd-form .set-field .lbl { flex: 0 0 132px; }
.site-expand .sd-form .set-field .ctl { width: 300px; }
.site-expand { background: #f6f7fb; }
.site-expand .sd-title-row h2 { font-size: 15.5px; font-weight: 650; letter-spacing: -.01em; }
.site-expand .sd-strip b { font-size: 13px; font-weight: 650; }
.site-expand .sd-compact h4, .site-expand .sd-recent-wrap h4 { display: flex; align-items: center; color: #6b7280; }
.site-expand .sd-compact h4::before, .site-expand .sd-recent-wrap h4::before {
  content: ""; width: 3px; height: 9px; border-radius: 2px; background: var(--accent); margin-right: 6px; }
.site-expand .sd-form .set-field .lbl span { color: #3d4453; }
.site-expand .tabbtn.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.site-expand .sd-form .set-field { min-height: 34px; padding: 3px 0; }
.site-expand .sd-form .set-fields + .set-fields { margin-top: 0; }
.site-expand .sd-form .set-field + .set-field { border-top: 1px solid #eef0f5; }
.site-expand .sd-form { margin-top: 12px; }
.site-expand .sd-compact { grid-template-columns: 300px minmax(0, 1fr); gap: 0 30px; align-items: start; }
.site-expand .sd-block h4 { margin-bottom: 4px; }
.site-expand .sd-block .sd-row { padding: 3px 0; font-size: 11.5px; }
.site-expand .sd-block .sd-row + .sd-row { border-top: 1px solid #eef0f5; }
.site-expand .sd-recent-wrap { margin-top: 0; }
.site-expand .sd-form .set-field { gap: 16px; }
.site-expand .sd-form .set-field .lbl { flex: 0 0 120px; }
.site-expand .sd-form .set-field .ctl { width: 320px; justify-content: flex-start; }
.site-expand .sd-form .set-field .ctl .input, .site-expand .sd-form .set-field .ctl .select { width: 320px; padding-right: 8px; }
.site-expand .sd-form .set-field .ctl .select { padding-right: 26px; }
.site-expand .sd-form .set-field .ctl .btn { width: auto; }
.site-expand .sd-form .set-field .switch { margin-left: 0; }
.site-expand .sd-form .set-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 36px; }
.site-expand .sd-form .set-field { display: grid; grid-template-columns: 110px minmax(0, 1fr);
  align-items: center; gap: 12px; min-height: 34px; padding: 4px 0; border-top: 0 !important; }
.site-expand .sd-form .set-field .lbl { flex: none; width: auto; }
.site-expand .sd-form .set-field .ctl { width: 100%; justify-content: flex-start; }
.site-expand .sd-form .set-field .ctl .input, .site-expand .sd-form .set-field .ctl .select { width: 100%; }
.site-expand .sd-form .set-field:has(textarea) { display: block; grid-column: 1 / -1; }
.site-expand .sd-form .set-field:has(textarea) .lbl { margin-bottom: 6px; }
.site-expand .sd-compact { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 0 40px; align-items: start; }
.site-expand .sd-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.site-expand .sd-recent-wrap { width: 460px; max-width: 100%; justify-self: end; }
.site-expand .sd-compact { grid-template-columns: 300px 460px; justify-content: start; }
.site-expand .sd-recent-wrap { justify-self: start; }
.site-expand .sd-compact { grid-template-columns: 300px minmax(0, 1fr); justify-content: stretch; }
.site-expand .sd-recent-wrap { justify-self: end; }
.site-expand .sd-compact { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px; align-items: start; margin-top: 12px; }
.site-expand .sd-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; height: 100%; align-self: stretch; }
.site-expand .sd-col .sd-block { flex: 1 1 0; }
.site-expand .sd-block, .site-expand .sd-recent-wrap {
  background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px;
  width: auto; max-width: none; justify-self: stretch; }
.site-expand .sd-block .sd-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.site-expand .sd-block .sd-row + .sd-row { border-top: 1px solid #f2f4f8; }
.st-all { display: flex; align-items: center; }
.st-all input { width: 14px; height: 14px; accent-color: var(--accent); }
.site-expand .sd-compact { align-items: stretch; }
.site-expand .sd-recent-wrap { height: 100%; display: flex; flex-direction: column; }
.si-preset{flex:0 0 58px;font-size:10px;color:#aeb4c2;text-align:center;letter-spacing:.02em}
.si-preset.on{color:var(--accent);font-weight:600}
.sd-selfcheck{display:block;margin-top:4px;font-size:11px;color:#8b90a0}
.site-item .st{flex:0 0 8px;width:8px;justify-content:center}
.site-item .st i{width:7px;height:7px}
.st-head, .site-item{grid-template-columns:26px 10px minmax(0,1fr) 96px 84px 58px 56px 92px;gap:12px}
.site-item .st{justify-self:start}
.sd-actions { flex-wrap: nowrap; }
.sd-arch-sel { width: 96px; height: 26px; font-size: 11px; padding: 0 4px; flex: 0 0 auto; }
.sd-actions > button.switch.sm i { width: 30px; height: 17px; }
.sd-actions > button.switch.sm i::after { width: 13px; height: 13px; }
.sd-actions > button.switch.sm.on i::after { left: 15px; }
.sd-form .set-field .ctl { flex: 1 1 auto; min-width: 0; }
.sd-form .set-field .ctl .input, .sd-form .set-field .ctl .select { width: 240px; }
#site-detail textarea.sd-note { min-height: 84px; }
.sites-pager { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 0; font-size: 12px; color: var(--muted); }
@media (max-width: 900px) {
.st-head { display: none; }
}
@media (max-width: 900px) {
.site-item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 10px 12px; }
}
@media (max-width: 600px) {
.site-item { height: auto; min-height: 46px; }
.site-item .si-mode, .site-item .si-last { display: none; }
.site-item .si-txt { flex: 1 1 120px; }
.site-item .si-txt b { white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.3; }
}
@media (max-width: 900px) {
.site-item > span { font-size: 11.5px; }
}
@media (max-width: 900px) {
.sites-bar { flex-wrap: wrap; gap: 8px; }
}
@media (max-width: 900px) {
.sites-bar .input, .sites-bar .select { max-width: 100%; }
}
@media (max-width: 900px) {
.site-expand .sd-form { padding: 12px; }
}
@media (max-width: 900px) {
.site-expand .sd-form .set-fields { grid-template-columns: 1fr; }
}
.ava.lg { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 12px; font-size: 14px; }
.pill2 { font-size: 11px; padding: 3px 9px; border-radius: 99px; white-space: nowrap; }
.pill2.on { background: var(--green-soft); color: var(--green); }
.pill2.off { background: var(--panel-2); color: var(--muted); }
.modal-scroll { max-height: 46vh; overflow-y: auto; margin-top: 8px; padding-right: 6px; }
.modal-scroll::-webkit-scrollbar { width: 8px; }
.modal-scroll::-webkit-scrollbar-thumb { background: #e3e6ec; border-radius: 99px; border: 2px solid #fff; }

@media (max-width: 600px) {
.sites-wrap { height: auto; }
.sites-panel { flex: 0 0 auto; }
.sites-rows { flex: 0 0 auto; max-height: none; overflow: visible; }
}
/* 概览在左、设置在右，不再用大页签切换 */
.site-expand .sd-scroll { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto 1fr; gap: 0 22px; align-items: start; overflow-y: auto; }
.site-expand .sd-ov { grid-column: 1; grid-row: 1 / span 2; min-width: 0; }
.site-expand .sd-form { grid-column: 2; grid-row: 2; min-width: 0; margin-top: 0; }
.site-expand .sd-scroll .sd-compact { grid-template-columns: 1fr; gap: 12px; }
.site-expand .sd-form .set-fields { grid-template-columns: 1fr; }
.site-expand .sd-form .set-field { display: grid; grid-template-columns: 110px minmax(0, 1fr); align-items: center; gap: 12px; }
.site-expand .sd-form .set-field .ctl { width: 100%; justify-content: flex-start; }
.site-expand .sd-form .set-field .ctl .input, .site-expand .sd-form .set-field .ctl .select { width: 100%; }
.site-expand .sd-form .set-field:has(textarea) { display: block; }
.site-expand .sd-form .set-field:has(textarea) .lbl { margin-bottom: 6px; }
@media (max-width: 1000px) {
  .site-expand .sd-scroll { display: block; overflow-y: auto; }
}
.site-expand .sd-compact.sd-single { grid-template-columns: minmax(0, 1fr); }
.site-expand .sd-scroll { display: block; overflow-y: auto; }
.site-expand .sd-form { grid-column: 1 / -1; max-width: none; }
.watch-grid { display: grid; grid-template-columns: repeat(7, minmax(88px, 1fr)); gap: 10px; margin-top: 10px; overflow-x: auto; padding-bottom: 2px; }
.watch-tile { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.watch-face { width: 100%; aspect-ratio: 1 / 1; padding: 12px 6px 10px; border: 1px solid #e5e8f5;
  border-radius: 50% 50% 18px 18px; background: linear-gradient(180deg, #f5f6ff, #fff);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  cursor: pointer; transition: border-color .15s, box-shadow .15s; }
.watch-face:hover, .watch-tile.open .watch-face { border-color: var(--accent); box-shadow: 0 6px 18px rgba(79,70,229,.08); }
.wf-num { font-size: 26px; font-weight: 700; line-height: 1; color: var(--accent); font-variant-numeric: tabular-nums; }
.wf-num.small { font-size: 17px; }
.watch-tile.ok .wf-num { color: #0a7f45; }
.watch-tile.warn .wf-num { color: #b45309; }
.watch-tile.bad .wf-num { color: #b42318; }
.wf-label { font-size: 11px; font-weight: 600; color: var(--ink); }
.wf-sub { max-width: 100%; font-size: 9px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.watch-detail { margin-top: 10px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: #fcfcfd; }
.watch-detail .sd-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-top: 1px solid #f1f3f7; font-size: 11.5px; }
.watch-detail .sd-row:first-child { border-top: 0; }
@media (max-width: 600px) { .watch-grid { gap: 8px; } .watch-face { padding: 10px 4px 8px; } .wf-num { font-size: 23px; } }
.sd-unmatched { margin-top: 6px; font-size: 11px; color: var(--muted); }
.sd-unmatched summary { cursor: pointer; color: var(--accent); }
.sd-unmatched-row { display: flex; gap: 8px; padding: 3px 0; border-top: 1px solid #f1f3f7; }
.sd-unmatched-row span { flex: 0 0 44px; color: var(--muted-2); }
.sd-unmatched-row b { font-weight: 500; color: var(--ink); word-break: break-all; }
.watch-subgrid { display: grid; grid-template-columns: repeat(3, 112px); gap: 10px; margin: 10px 0 8px; }
.watch-tile.sub .watch-face { width: 112px; height: 112px; border-radius: 56px 56px 14px 14px; }
.watch-tile.sub .wf-num { font-size: 24px; }
.detect-subdetail { margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--line); }
@media (max-width: 600px) { .watch-subgrid { grid-template-columns: repeat(3, minmax(88px, 1fr)); gap: 8px; } .watch-tile.sub .watch-face { width: 100%; height: auto; aspect-ratio: 1 / 1; } }
.detect-check { margin-top: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; display: flex; flex-direction: column; gap: 3px; font-size: 11px; }
.detect-check b { font-size: 11.5px; }
.detect-check span { color: var(--muted); }
.detect-check span.warn { color: #b45309; }
.detect-check.ok { background: #f6fef9; border-color: #c6efd9; }
.detect-check.bad { background: #fff8f7; border-color: #f4c7c3; }
</style>
