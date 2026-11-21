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
                <button class="btn slim" type="button" :disabled="busy.selfcheck || !s.cookieSaved || s.cookieReadable === false" title="用已保存的 cookie 做一次会话自检；只发一次 GET" @click.stop="selfcheckOne(s)">连接自检</button>
              </div>
              <button class="sheet-x" type="button" aria-label="关闭" @click.stop="closeDetail">✕</button>
            </div>


            <div class="sd-scroll">
              <div class="sd-ov">
                <div class="sd-compact">
                  <div class="sd-col">
                    <div class="sd-block">
                      <h4>登录</h4>
                      <div class="sd-row"><span>状态</span><b :class="dotCls(s) + '-t'">{{ loginTxt(s) }}</b></div>
                      <div class="sd-row"><span>方式</span><b>Cookie</b></div>
                      <div class="sd-row"><span>登录凭据</span><b :class="s.cookieSaved && s.cookieReadable === false ? 'bad-t' : ''">{{ s.cookieSaved ? (s.cookieReadable ? '已保存' : '已保存但解不开，请重新导入') : '未保存' }}</b></div>
                      <div class="sd-row"><span>引擎</span><b>{{ engineTxt(s) }}</b></div>
                      <div class="sd-row"><span>采样</span><b>{{ sampleTxt(s) }}</b></div>
                      <div class="sd-row"><span>来源</span><b>{{ kindTxt(s) }}</b></div>
                    </div>
                    <div class="sd-block">
                      <h4>抓取参数</h4>
                      <div class="sd-row"><span>预设来源</span><b>{{ kindTxt(s) }}</b></div>
                      <div class="sd-row"><span>分类参数</span><b>{{ catRangeTxt(s) }}</b></div>
                      <div class="sd-row"><span>抓取状态</span><b :class="s.enabled ? (s.lastAt ? 'ok-t' : 'idle-t') : 'idle-t'">{{ s.enabled ? (s.lastAt ? '正常' : '待抓取') : '已停用' }}</b></div>
                      <div class="sd-row"><span>词条</span><b>{{ detail.catalog ? detail.catalog.total : '—' }}</b></div>
                      <div class="sd-test">
                        <button class="btn ghost slim" id="sd-try-crawl" type="button" :disabled="busy.crawl || !s.enabled" title="验证配置：按搜索预设只抓这一站一页；会真实请求，受真抓取开关约束" @click.stop="crawlOne(s)">试抓一页</button>
                        <span class="sd-test-note">验证配置，只抓这一站一页</span>
                      </div>
                    </div>
                    <div class="sd-block">
                      <h4>抓取</h4>
                      <div class="sd-row"><span>上次结果</span><b :class="(s.lastAt ? 'ok' : 'idle') + '-t'">{{ s.lastAt ? '已抓取' : '未抓取' }}</b></div>
                      <div class="sd-row"><span>今日已跑</span><b>{{ s.todayCount }} 次</b></div>
                      <div class="sd-row"><span>方式</span><b>{{ modeTxt(s) }}</b></div>
                    </div>
                  </div>
                  <div class="sd-recent-wrap">
                    <h4>最近收录</h4>
                    <div v-if="!detail.items.length" class="sd-row"><span>状态</span><b>这个站还没有词条</b></div>
                    <div v-for="r in detail.items" :key="r.id" class="sd-recent">
                      <span class="t-main">{{ r.title }}</span>
                      <span class="soft">{{ r.size }}</span>
                      <span class="soft">{{ String(r.createdAt || '').slice(5, 16).replace('T', ' ') }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="sd-form">
                <div class="sd-sec">
                  <h4 class="sd-sec-ttl">概览</h4>
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>站点地址</span></div>
                      <div class="ctl"><input v-model="form.url" class="input" placeholder="https://站点域名/index.php"></div>
                    </div>
                  </div>
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>Cookie（{{ s.cookieSaved ? (s.cookieReadable ? '已保存' + cookieWhen(s) : '已保存但解不开') : '未保存' }}）</span></div>
                      <div class="ctl">
                        <textarea v-model="form.cookie" class="input sd-note" rows="3" :placeholder="s.cookieSaved && s.cookieReadable === false ? '旧 cookie 用当前密钥解不开，请整段重新粘贴' : (s.cookieSaved ? '已保存的 cookie 不回显；要换就整段粘贴覆盖再保存' : '粘贴 name1=value1; name2=value2')"></textarea>
                      </div>
                    </div>
                  </div>
                  <div class="sd-cookie-bar">
                    <button class="btn ghost slim" id="sd-cookie-test" type="button" :disabled="busy.selfcheck || !s.cookieSaved || s.cookieReadable === false" @click.stop="selfcheckOne(s)">自检</button>
                    <span class="sd-cookie-res" id="sd-cookie-res">{{ s.loginAt ? '上次自检 ' + fmtWhen(s.loginAt) + ' · ' + loginTxt(s) : '还没自检' }}</span>
                  </div>
                </div>

                <div class="sd-sec">
                  <h4 class="sd-sec-ttl">搜索预设</h4>
                  <div class="set-fields">
                    <div class="set-field"><div class="lbl"><span>引擎</span></div><div class="ctl"><span class="fixed-val ref">{{ engineTxt(s) }}</span></div></div>
                    <div class="set-field"><div class="lbl"><span>预设来源</span></div><div class="ctl"><span class="fixed-val ref">{{ sourceTxt(s) }}</span></div></div>
                    <div class="set-field"><div class="lbl"><span>分类参数</span></div><div class="ctl"><span class="fixed-val ref">{{ paramTxt(s) }}</span></div></div>
                    <div class="set-field"><div class="lbl"><span>抓取状态</span></div><div class="ctl"><span class="fixed-val ref">{{ crawlTxt(s) }}</span></div></div>
                    <div class="set-field"><div class="lbl"><span>词条</span></div><div class="ctl"><span class="fixed-val ref">{{ catalogTxt(s) }}</span></div></div>
                  </div>
                  <div class="set-fields">
                    <div class="sd-block">
                      <h4>分类 id</h4>
                      <template v-if="catGroups.length">
                        <div v-for="g in catGroups" :key="g.name" class="sd-row"><span>{{ g.name }}</span><b>{{ g.ids }}</b></div>
                      </template>
                      <div v-else class="sd-row"><span>状态</span><b>还没有分类映射</b></div>
                    </div>
                  </div>
                  <div v-if="previewUrls.length" class="set-fields">
                    <div class="sd-block">
                      <h4>搜索链接预览</h4>
                      <a v-for="u in previewUrls" :key="u.url" class="sd-preset-url" :href="u.url" target="_blank" rel="noopener noreferrer">{{ u.tag }} → {{ u.short }}</a>
                      <div class="sd-row"><span>说明</span><b>点开就是该站真实搜索页，确认分类对不对</b></div>
                    </div>
                  </div>
                  <div class="sd-cookie-bar">
                    <span class="sd-cookie-res">预设确认入口未接：这里只读；确认状态来自私有包 site-search.local.json。</span>
                  </div>
                </div>

                <div class="sd-sec">
                  <h4 class="sd-sec-ttl">上传配置</h4>
                  <div class="set-fields">
                    <div class="sd-block cm-block">
                      <h4>分类映射</h4>
                      <p class="set-desc">{{ catKind === 'array' ? '站点分类 → 库内分类；保存后抓取轮转按这张表。' : '库内分类 → 目标站分类 ID；保存后发种按这张表填分类。' }}</p>
                      <div v-if="catRows.length" class="cm-list">
                        <div class="cm-row cm-head">
                          <span>{{ catKind === 'array' ? '站点分类' : '库内分类' }}</span>
                          <span>{{ catKind === 'array' ? '库内分类' : '目标站分类 ID' }}</span>
                          <span></span>
                        </div>
                        <div v-for="(r, i) in catRows" :key="i" class="cm-row">
                          <div v-if="catKind === 'array'" class="cm-src">
                            <input v-model="r.label" class="input" placeholder="分类名称">
                            <input v-model="r.id" class="input num" placeholder="ID">
                          </div>
                          <div v-else class="cm-src">
                            <input v-model="r.key" class="input" placeholder="库内分类，如 movie">
                          </div>
                          <select v-if="catKind === 'array'" v-model="r.purpose" class="select">
                            <option v-for="p in catPurposes" :key="p.v" :value="p.v">{{ p.label }}</option>
                          </select>
                          <input v-else v-model="r.id" class="input" placeholder="目标站分类 ID">
                          <button class="btn ghost slim cm-del" type="button" @click.stop="removeCatRow(i)">删除</button>
                        </div>
                      </div>
                      <div v-else class="sites-empty">这个站还没有分类映射；点「加一条」开始。</div>
                      <div class="cm-actions">
                        <button class="btn ghost slim" type="button" @click.stop="addCatRow">加一条</button>
                        <button class="btn primary slim" type="button" :disabled="catSaving" @click.stop="saveCatMap">{{ catSaving ? '保存中…' : '保存映射' }}</button>
                        <span class="sd-cookie-res">{{ catMsg }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="set-fields">
                    <div class="sd-block cm-block">
                      <h4>上传表单</h4>
                      <p class="set-desc">目标站上传页的字段映射；保存后发种按这张表填。识别只在你点按钮时发一次 GET。</p>
                      <div class="up-pair">
                        <label><span>提交路径</span><input v-model="upForm.path" class="input" placeholder="/takeupload.php"></label>
                        <label><span>识别页路径</span><input v-model="upForm.formPath" class="input" placeholder="/upload.php（留空用提交路径）"></label>
                        <label><span>文件字段</span><input v-model="upForm.fileField" class="input" placeholder="file"></label>
                      </div>
                      <div v-if="upForm.fields.length" class="cm-list">
                        <div class="cm-row cm-head"><span>目标字段</span><span>值模板</span><span></span></div>
                        <div v-for="(f, i) in upForm.fields" :key="i" class="cm-row">
                          <input v-model="f.name" class="input" placeholder="字段名">
                          <input v-model="f.template" class="input" placeholder="{title}">
                          <button class="btn ghost slim cm-del" type="button" @click.stop="removeUpField(i)">删除</button>
                        </div>
                      </div>
                      <div v-else class="sites-empty">还没有上传字段；点「从目标站识别」或「加字段」。</div>
                      <div class="cm-actions">
                        <button class="btn ghost slim" type="button" @click.stop="addUpField">加字段</button>
                        <button class="btn primary slim" type="button" :disabled="upSaving" @click.stop="saveUpForm">{{ upSaving ? '保存中…' : '保存上传映射' }}</button>
                        <button class="btn ghost slim" type="button" :disabled="detectBusy" @click.stop="detectRemote">{{ detectBusy ? '识别中…' : '从目标站识别' }}</button>
                        <span class="sd-cookie-res">{{ upMsg || detectMsg }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>站点定义 JSON</span><i>高级字段；存 data/site-defs，不进仓库</i></div>
                      <div class="ctl"><textarea v-model="defText" class="input sd-note" rows="10" placeholder="{}"></textarea></div>
                    </div>
                  </div>
                  <div class="sd-cookie-bar">
                    <button class="btn primary slim" type="button" :disabled="defSaving" @click.stop="saveDef">{{ defSaving ? '保存中…' : '保存定义' }}</button>
                    <span class="sd-cookie-res">{{ defMsg }}</span>
                  </div>
                </div>

                <div class="sd-sec">
                  <h4 class="sd-sec-ttl">站点覆盖</h4>
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>单独设置本站</span></div>
                      <div class="ctl">
                        <button class="switch" :class="{ on: form.override }" type="button" @click.stop="form.override = !form.override"><i></i></button>
                      </div>
                    </div>
                  </div>
                  <div class="set-fields" :class="{ 'is-off': !form.override }">
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
                      <div class="ctl">
                        <button class="switch" :class="{ on: form.ovDetail }" type="button" @click.stop="form.ovDetail = !form.ovDetail"><i></i></button>
                      </div>
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
                  <div class="set-fields">
                    <div class="set-field">
                      <div class="lbl"><span>分类映射</span></div>
                      <div class="ctl"><span class="fixed-val ref">{{ catMapTxt(s) }}</span></div>
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
import { ARCH, fmtWhen, archOf, archCls, archLabel, dotCls, loginTxt, modeTxt } from '../utils/siteFormat'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { reportError } from '../utils/errors'
import { toast, confirmBox, initialsOf } from '../utils/ui'

const props = defineProps({ site: { type: Object, required: true } })
const emit = defineEmits(['close', 'changed', 'removed'])

const ENG_CODE = { nexusphp: 'NP', unit3d: 'U3D', gazelle: 'GZ' }
const archOptions = [
  { v: 'NP', label: 'NexusPHP' }, { v: 'UNIT3D', label: 'UNIT3D' }, { v: 'GZ', label: 'Gazelle' },
  { v: 'OTHER', label: '其它' }, { v: '?', label: '未确认' }
]
const catPurposes = [
  { v: 'movie', label: '电影' }, { v: 'tv', label: '剧集' }, { v: 'doc', label: '纪录片' },
  { v: 'anime', label: '动漫' }, { v: 'music', label: '音乐' }, { v: 'sport', label: '体育' },
  { v: 'game', label: '游戏' }, { v: 'book', label: '电子书' }, { v: 'software', label: '软件' },
  { v: 'adult', label: '成人' }, { v: 'other', label: '其他' }
]
const s = computed(function () { return props.site || {} })
const host = computed(function () { return (props.site && props.site.name) || '' })
const detail = reactive({ def: null, preset: null, catalog: null, items: [] })
const form = reactive({ url: '', cookie: '', override: false, ovInterval: '', ovDetail: false, priority: 'normal' })
const defText = ref('')
const defSaving = ref(false)
const defReady = ref(true)
const defMsg = ref('')
const catKind = ref('object')
const catRows = ref([])
const catSaving = ref(false)
const catMsg = ref('')
const upForm = reactive({ path: '', formPath: '', fileField: '', fields: [] })
const upSaving = ref(false)
const upMsg = ref('')
const detectBusy = ref(false)
const detectMsg = ref('')
const busy = reactive({ selfcheck: false, crawl: false, save: false })

function cookieWhen(site) { return site.cookieUpdatedAt ? ' · ' + fmtWhen(site.cookieUpdatedAt) : '' }

const catGroups = computed(function () {
  const d = detail.def || {}
  const p = detail.preset || {}
  const groups = (p.cats && Object.keys(p.cats).length ? p.cats : d.cats) || {}
  return Object.keys(groups).map(function (name) { return { name: name, ids: (groups[name] || []).join(', ') || '—' } })
})
const previewUrls = computed(function () {
  const d = detail.def || {}
  const p = detail.preset || {}
  const groups = (p.cats && Object.keys(p.cats).length ? p.cats : d.cats) || {}
  const params = d.params || {}
  const sp = d.searchPath || ''
  const base = String(d.base || '').replace(/\/+$/, '')
  if (!base || !sp || !Object.keys(params).length) return []
  const out = []
  Object.keys(groups).slice(0, 8).forEach(function (g) {
    const first = (groups[g] || [])[0]
    if (first === undefined || first === '') return
    const qs = Object.keys(params).map(function (k) {
      const v = String(params[k]).split('{cats}').join(String(first)).split('{q}').join('')
      return encodeURIComponent(k) + '=' + encodeURIComponent(v)
    }).join('&')
    const url = base + sp + '?' + qs
    out.push({ tag: g, url: url, short: url.replace(/^https?:\/\//, '') })
  })
  return out.slice(0, 6)
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
function crawlTxt(site) {
  if (!site.lastAt) return '还没抓过'
  return '上次 ' + fmtWhen(site.lastAt) + ' · 今日 ' + site.todayCount + ' 次'
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
function catMapTxt() {
  const cm = detail.def && detail.def.catMap
  const n = Array.isArray(cm) ? cm.length : (cm && typeof cm === 'object' ? Object.keys(cm).length : 0)
  return n ? '已配 ' + n + ' 条' : '未配置'
}

function fillForm(site) {
  if (!site) return
  form.url = site.url
  form.cookie = ''
  form.override = site.override
  form.ovInterval = site.ovInterval
  form.ovDetail = site.ovDetail
  form.priority = site.priority
}
function catRowsFromDef(def) {
  if (!def) return { kind: 'object', rows: [] }
  /* 站点包例外写的是 catList；优先展示它，保存时再统一成 catMap */
  if (Array.isArray(def.catList) && def.catList.length) {
    return { kind: 'array', rows: def.catList.map(function (x) {
      return { id: String((x && x.id) || ''), label: String((x && x.label) || ''), purpose: String((x && x.purpose) || 'other') }
    }) }
  }
  const cm = def.catMap
  if (Array.isArray(cm)) {
    return { kind: 'array', rows: cm.map(function (x) {
      return { id: String((x && x.id) || ''), label: String((x && x.label) || ''), purpose: String((x && x.purpose) || 'other') }
    }) }
  }
  if (cm && typeof cm === 'object') {
    return { kind: 'object', rows: Object.keys(cm).map(function (k) {
      return { key: String(k), id: String(cm[k] == null ? '' : cm[k]) }
    }) }
  }
  return { kind: 'object', rows: [] }
}
function syncCatRows(def) {
  const r = catRowsFromDef(def)
  catKind.value = r.kind
  catRows.value = r.rows
  catMsg.value = ''
}
function addCatRow() {
  if (catKind.value === 'array') catRows.value.push({ id: '', label: '', purpose: 'other' })
  else catRows.value.push({ key: '', id: '' })
}
function removeCatRow(i) { catRows.value.splice(i, 1) }
function syncUpForm(def) {
  const um = (def && def.uploadMap) || {}
  upForm.path = String(um.path || '')
  upForm.formPath = String(um.formPath || '')
  upForm.fileField = String(um.fileField || '')
  upForm.fields = Object.keys(um.fields || {}).map(function (k) {
    return { name: k, template: String(um.fields[k] == null ? '' : um.fields[k]) }
  })
  upMsg.value = ''
  detectMsg.value = ''
}
function addUpField() { upForm.fields.push({ name: '', template: '' }) }
function removeUpField(i) { upForm.fields.splice(i, 1) }

function loadDefFallback(h) {
  const site = s.value
  const tpl = { engine: (site && site.def && site.def.engine) || 'nexusphp', base: (site && site.url) || ('https://' + h),
    uploadMap: { path: '/takeupload.php', formPath: '/upload.php', fileField: 'file', fields: { name: '{title}', descr: '{description}', type: '{catId}', anon: '{anonymous}' } },
    verify: { path: '/torrents.php?search={title}' }, catMap: {} }
  defText.value = JSON.stringify(tpl, null, 2)
  defMsg.value = '还没有站点定义，这是模板；按站修改后保存'
}
async function loadDetail(target) {
  const h = String(target || host.value || '')
  if (!h) return
  detail.def = null
  detail.preset = null
  detail.catalog = null
  detail.items = []
  defMsg.value = ''
  try {
    const rs = await Promise.all([
      fetch('/api/site-def/' + encodeURIComponent(h), { credentials: 'same-origin' }).then(function (r) {
        return r.json().catch(function () { return null }).then(function (body) { return { status: r.status, body: body } })
      }).catch(function () { return { status: 0, body: null } }),
      fetch('/api/sites/' + encodeURIComponent(h) + '/search', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null }).catch(function () { return null }),
      fetch('/api/catalog?site=' + encodeURIComponent(h) + '&limit=6', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null }).catch(function () { return null })
    ])
    if (host.value !== h) return
    const dj = rs[0], pj = rs[1], cj = rs[2]
    defReady.value = false
    if (dj && dj.body && dj.body.ok && dj.body.data) {
      detail.def = dj.body.data
      defText.value = JSON.stringify(dj.body.data, null, 2)
      syncCatRows(dj.body.data)
      syncUpForm(dj.body.data)
      defReady.value = true
    } else if (dj && dj.status === 404) {
      loadDefFallback(h)
      defReady.value = true
    } else {
      defText.value = ''
      defMsg.value = '站点定义加载失败；先不要保存，刷新重试'
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
          form.cookie = ''
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
async function crawlOne(site) {
  if (busy.crawl) return
  busy.crawl = true
  try {
    const j = await (await fetch('/api/crawl/run', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ siteHost: site.name, dryRun: false })
    })).json()
    if (j && j.ok) toast('抓取完成：第 ' + (j.data.page || 0) + ' 页 · 新增 ' + (j.data.added || 0) + ' 条')
    else toast((j && j.error && j.error.message) || '抓取失败')
    emit('changed')
    await loadDetail(site.name)
  } catch (e) { toast('抓取请求发不出去') }
  busy.crawl = false
}
async function saveDef() {
  if (!host.value || defSaving.value) return
  if (!defReady.value) { toast('站点定义没加载成功，先刷新重试'); return }
  let def
  try { def = JSON.parse(defText.value) } catch (e) { toast('JSON 格式不对'); return }
  defSaving.value = true
  try {
    const j = await (await fetch('/api/site-def/' + encodeURIComponent(host.value), {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(def)
    })).json()
    if (j && j.ok) {
      detail.def = def
      syncCatRows(def)
      syncUpForm(def)
      defMsg.value = '已保存'
      toast('站点定义已保存')
      emit('changed')
    } else { defMsg.value = (j && j.error && j.error.message) || '保存失败'; toast(defMsg.value) }
  } catch (e) { toast('保存请求发不出去') }
  defSaving.value = false
}
async function saveCatMap() {
  if (!host.value || catSaving.value) return
  if (!defReady.value) { catMsg.value = '站点定义没加载成功，先刷新重试'; return }
  let def
  try { def = JSON.parse(defText.value) } catch (e) { catMsg.value = '上面的 JSON 格式不对，先修好再保存映射'; return }
  if (!def || typeof def !== 'object' || Array.isArray(def)) { catMsg.value = '站点定义必须是 JSON 对象'; return }
  const rows = catRows.value.map(function (r) { return Object.assign({}, r) })
  if (catKind.value === 'array') {
    const seen = {}
    for (const r of rows) {
      r.id = String(r.id || '').trim()
      r.label = String(r.label || '').trim()
      r.purpose = String(r.purpose || 'other')
      if (!r.id || !r.label) { catMsg.value = '站点分类的名称和 ID 都要填'; return }
      if (seen[r.id]) { catMsg.value = '分类 ID 重复：' + r.id; return }
      seen[r.id] = true
      if (!catPurposes.some(function (p) { return p.v === r.purpose })) r.purpose = 'other'
    }
    delete def.catList
    def.catMap = rows
    const cats = {}
    rows.forEach(function (r) { (cats[r.purpose] = cats[r.purpose] || []).push(r.id) })
    def.cats = cats
  } else {
    const seen = {}
    const obj = {}
    for (const r of rows) {
      const key = String(r.key || '').trim()
      const id = String(r.id || '').trim()
      if (!key || !id) { catMsg.value = '库内分类和目标站分类 ID 都要填'; return }
      if (seen[key]) { catMsg.value = '库内分类重复：' + key; return }
      seen[key] = true
      obj[key] = id
    }
    def.catMap = obj
  }
  catSaving.value = true
  try {
    const j = await (await fetch('/api/site-def/' + encodeURIComponent(host.value), {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(def)
    })).json()
    if (j && j.ok) {
      const saved = (j.data && j.data.def) || def
      detail.def = saved
      defText.value = JSON.stringify(saved, null, 2)
      syncCatRows(saved)
      catMsg.value = '已保存 · ' + rows.length + ' 条'
      toast('分类映射已保存')
      emit('changed')
    } else { catMsg.value = (j && j.error && j.error.message) || '保存失败'; toast(catMsg.value) }
  } catch (e) { catMsg.value = '保存请求发不出去'; toast(catMsg.value) }
  catSaving.value = false
}
async function saveUpForm() {
  if (!defReady.value) { toast('站点定义没加载成功，先刷新重试'); return }
  if (!host.value || upSaving.value) return
  let def
  try { def = JSON.parse(defText.value) } catch (e) { upMsg.value = '上面的 JSON 格式不对，先修好再保存上传映射'; return }
  if (!def || typeof def !== 'object' || Array.isArray(def)) { upMsg.value = '站点定义必须是 JSON 对象'; return }
  const fields = {}
  for (const f of upForm.fields) {
    const name = String(f.name || '').trim()
    if (!name) { upMsg.value = '每个字段都要填字段名'; return }
    if (fields[name] !== undefined) { upMsg.value = '字段名重复：' + name; return }
    fields[name] = String(f.template || '')
  }
  def.uploadMap = Object.assign({}, def.uploadMap || {}, {
    path: String(upForm.path || '').trim(),
    formPath: String(upForm.formPath || '').trim(),
    fileField: String(upForm.fileField || '').trim(),
    fields: fields
  })
  upSaving.value = true
  try {
    const j = await (await fetch('/api/site-def/' + encodeURIComponent(host.value), {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(def)
    })).json()
    if (j && j.ok) {
      const saved = (j.data && j.data.def) || def
      detail.def = saved
      defText.value = JSON.stringify(saved, null, 2)
      syncUpForm(saved)
      upMsg.value = '已保存 · ' + Object.keys(fields).length + ' 个字段'
      toast('上传映射已保存')
      emit('changed')
    } else { upMsg.value = (j && j.error && j.error.message) || '保存失败'; toast(upMsg.value) }
  } catch (e) { upMsg.value = '保存请求发不出去'; toast(upMsg.value) }
  upSaving.value = false
}
function detectRemote() {
  if (!host.value || detectBusy.value) return
  const h = host.value
  confirmBox('识别上传表单', '会向 ' + h + ' 的上传页发一次 GET，只读页面，不提交任何东西。继续？', async function () {
    detectBusy.value = true
    detectMsg.value = ''
    try {
      const j = await (await fetch('/api/targets/' + encodeURIComponent(h) + '/detect-form', {
        method: 'POST', credentials: 'same-origin'
      })).json()
      if (!j || !j.ok) {
        detectMsg.value = ((j && j.error && j.error.message) || '识别失败') + '；可以继续手工编辑字段表'
        detectBusy.value = false
        return
      }
      const d = j.data || {}
      if (d.path) upForm.path = d.path
      if (d.formPath) upForm.formPath = d.formPath
      if (d.fileField) upForm.fileField = d.fileField
      upForm.fields = (d.fields || []).map(function (f) { return { name: f.name, template: f.template || '' } })
      detectMsg.value = '识别到 ' + upForm.fields.length + ' 个字段 · ' + (d.url || d.path || '')
      toast('已识别上传表单')
    } catch (e) { detectMsg.value = '识别请求发不出去' }
    detectBusy.value = false
  })
}
function closeDetail() { emit('close') }

onMounted(function () {
  fillForm(s.value)
  loadDetail(host.value)
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
.sd-test { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 8px; margin-top: 4px; border-top: 1px solid #f2f4f8; }
.sd-test-note { font-size: 10.5px; color: var(--muted-2); }
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
.sd-preset-url{display:block;font-size:11px;color:var(--accent);word-break:break-all;margin:5px 0;text-decoration:none}
.sd-preset-url:hover{text-decoration:underline}
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
</style>
