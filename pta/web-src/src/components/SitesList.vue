<template>
  <div class="sites-work">
    <section class="sites-list">
      <div class="st-head">
        <span class="st-all"><input type="checkbox" id="site-all" aria-label="全选本站点" :checked="allPicked" :indeterminate.prop="somePicked" @change="emit('toggle-all', $event.target.checked)"></span>
        <span>架构</span><span>站点</span><span></span>
      </div>
      <div class="sites-rows" id="sites-list">
        <div v-for="s in pageRows" :key="s.name" class="site-item" :class="{ on: sel === s.name }" @click="emit('open', s.name)">
          <input type="checkbox" class="site-pick" :checked="picks.includes(s.name)" @click.stop @change="emit('pick', s.name)">
          <span class="si-arch"><em class="chip" :class="archCls(s)">{{ archLabel(s) }}</em></span>
          <span class="si-txt"><b>{{ s.title }}</b></span>
          <span class="st" :class="dotCls(s)"><i></i></span>
          <span class="si-mode">{{ modeTxt(s) }}</span>
          <span class="si-last">{{ lastCrawlTxt(s) }}</span>
        </div>
        <div v-if="!pageRows.length" class="sites-empty">没有匹配的站点</div>
      </div>
      <div class="sites-pager-wrap" id="sites-pager">
        <div class="sites-pager">
          <span class="pager-link" :class="{ off: page <= 1 }" @click="go(page - 1)">上一页</span>
          <span class="pager-meta">第 {{ page }} / {{ pages }} 页 · 共 {{ filteredCount }} 站</span>
          <span class="pager-link" :class="{ off: page >= pages }" @click="go(page + 1)">下一页</span>
        </div>
      </div>
    </section>
    <aside class="sites-detail-pane" :class="{ empty: !sel }">
      <slot name="detail"></slot>
      <div v-if="!sel" class="sites-detail-empty">选一个站点看概览和设置</div>
    </aside>
  </div>
</template>


<script setup>
const ARCH = {
  NP: ['np', 'NexusPHP'], UNIT3D: ['u3d', 'UNIT3D'], GZ: ['gz', 'Gazelle'],
  OTHER: ['oth', '其它'], '?': ['unk', '未确认'], U3D: ['u3d', 'UNIT3D']
}
const ENG_CODE = { nexusphp: 'NP', unit3d: 'U3D', gazelle: 'GZ' }

const props = defineProps({
  pageRows: { type: Array, default: function () { return [] } },
  sel: { type: String, default: '' },
  picks: { type: Array, default: function () { return [] } },
  allPicked: Boolean,
  somePicked: Boolean,
  page: { type: Number, default: 1 },
  pages: { type: Number, default: 1 },
  filteredCount: { type: Number, default: 0 }
})
const emit = defineEmits(['open', 'pick', 'toggle-all', 'page'])

function fmtWhen(raw) {
  if (!raw) return '—'
  const t = typeof raw === 'number' ? new Date(raw) : new Date(String(raw))
  if (isNaN(t.getTime())) return '—'
  const p2 = n => String(n).padStart(2, '0')
  const now = new Date()
  const sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate()
  return (sameDay ? '今日 ' : p2(t.getMonth() + 1) + '-' + p2(t.getDate()) + ' ') + p2(t.getHours()) + ':' + p2(t.getMinutes())
}
function archOf(s) { return ARCH[s.arch] || ARCH['?'] }
function archCls(s) { return archOf(s)[0] }
function archLabel(s) { return archOf(s)[1] }
function dotCls(s) { return s.login === 'ok' ? 'ok' : s.login === 'fail' ? 'bad' : 'idle' }
function loginTxt(s) { return s.login === 'ok' ? '可用' : s.login === 'fail' ? '失效' : '未自检' }
function modeTxt(s) {
  if (!s.enabled) return '停用'
  if (s.mode === 'full') return '全量'
  if (s.mode === 'mixed') return '增量+定期全量'
  return '增量'
}
function presetTxt(s) {
  if (!s.preset) return '—'
  const code = ENG_CODE[s.preset.engine] || (s.preset.engine || '').toUpperCase() || '?'
  return code + (s.preset.groups ? ' ' + s.preset.groups + '组' : '') + (s.preset.confirmed ? '' : ' · 待确认')
}
function lastCrawlTxt(s) { return s.lastAt ? fmtWhen(s.lastAt) : '未抓取' }
function go(n) {
  const p = Number(props.pages) || 1
  if (n < 1 || n > p || n === Number(props.page)) return
  emit('page', n)
}
</script>

<style scoped>
/* Sites 页面样式：迁入 scoped，shared 组件/shell 保留全局 */
.sites-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.sites-empty { padding: 48px 0; text-align: center; color: var(--muted-2); font-size: 12.5px; }
@media (max-width: 1100px) {
.sites-panel { overflow-x: auto; }
}
.sites-panel { overflow: clip; }
.site-item { display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 10px; cursor: pointer; transition: background .13s ease; }
.site-item + .site-item { margin-top: 2px; }
.site-item:hover { background: #f7f8fa; }
.site-item.on .si-txt b { color: var(--accent); }
.si-txt { flex: 1; min-width: 0; }
.si-txt b { display: block; font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.si-txt span { display: block; margin-top: 2px; font-size: 11px; color: var(--muted-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.site-item .site-pick { width: 14px; height: 14px; flex: 0 0 14px; accent-color: var(--accent); cursor: pointer; opacity: .45; transition: opacity .12s; }
.site-item:hover .site-pick, .site-item .site-pick:checked { opacity: 1; }
.drawer-body-flush .sites-bar { padding: 16px 20px 0; margin-bottom: 12px; }
.drawer-body-flush .sites-bar { padding: 14px 20px 12px; margin-bottom: 0; }
.drawer-body-flush .site-item.on { background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
.drawer-body-flush .sites-bar { flex: 0 0 auto; }
.sites-pager { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
.sites-pager span { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.site-item { padding: 7px 10px; }
.si-txt b { font-size: 12.5px; }
:global(.view[data-view="sites"]) { height: calc(100vh - 150px); display: flex; flex-direction: column; }
.sites-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
.sites-wrap .sites-bar { padding: 0; margin-bottom: 0; }
.sites-wrap .site-item { padding: 8px 10px; }
.sites-wrap .site-item + .site-item { margin-top: 1px; }
.sites-wrap .si-txt b { font-size: 13px; }
.sites-wrap .si-txt span { font-size: 11px; }
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
.site-item { height: 42px; }
.sites-wrap { display: flex; flex-direction: column; height: calc(100vh - 150px); }
.sites-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.sites-rows { flex: 1; max-height: none; min-height: 0; overflow-y: auto; }
.st-head, .site-item { grid-template-columns: 28px minmax(0, 1fr) 86px 92px 116px 40px; gap: 16px; padding: 0 22px; }
.site-item .site-pick { margin-right: 2px; }
.st-head, .site-item { grid-template-columns: 28px minmax(0, 1fr) 104px 86px 92px 116px 40px; }
.st-head, .site-item { padding: 0 22px; }
.site-item, .site-item.on { border-radius: 0; }
.st-head { border-bottom: 1px solid var(--line); }
.st-all { display: flex; align-items: center; }
.st-all input { width: 14px; height: 14px; accent-color: var(--accent); }
.si-preset{flex:0 0 58px;font-size:10px;color:#aeb4c2;text-align:center;letter-spacing:.02em}
.si-preset.on{color:var(--accent);font-weight:600}
.site-item .st{flex:0 0 8px;width:8px;justify-content:center}
.site-item .st i{width:7px;height:7px}
.st-head, .site-item{grid-template-columns:26px 84px minmax(0,1fr) 10px 56px 92px;gap:12px}
.site-item .st{justify-self:start}
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
.sites-bar .input, .sites-bar .select { max-width: 100%; }
}
@media (max-width: 600px) {
.sites-wrap { height: auto; }
.sites-panel { flex: 0 0 auto; }
.sites-rows { flex: 0 0 auto; max-height: none; overflow: visible; }
}

/* ===== 站点列 + 右侧详情：布满卡片 ===== */
.sites-work { flex: 1; min-height: 0; display: flex; background: #fff; border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
.sites-work .sites-list { width: clamp(280px, 30%, 400px); flex: 0 0 clamp(280px, 30%, 400px); min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--line); background: #fff; }
.sites-work .st-head { grid-template-columns: 24px 64px minmax(0, 1fr) 10px; gap: 10px; padding: 0 16px; height: 34px; }
.sites-work .site-item { grid-template-columns: 24px 64px minmax(0, 1fr) 10px; gap: 10px; padding: 4px 16px; height: auto; min-height: 42px; }
.sites-work .si-txt b { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; line-height: 1.3; }
.sites-work .si-mode, .sites-work .si-last { display: none; }
.sites-work .sites-rows { flex: 1; min-height: 0; max-height: none; overflow: hidden; }
.sites-work .sites-pager-wrap { flex: 0 0 auto; padding: 8px 10px 10px; border-top: 1px solid var(--line); background: #fff; }
.sites-work .sites-pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0; padding: 6px 10px; border: 1px solid var(--line); border-radius: 9px; background: #fafbfd; }
.sites-work .pager-link { font-size: 11.5px; color: var(--accent); cursor: pointer; user-select: none; white-space: nowrap; }
.sites-work .pager-link.off { color: var(--muted-2); cursor: default; opacity: .55; }
.sites-work .pager-meta { flex: 1; text-align: center; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.sites-detail-pane { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #fff; }
.sites-detail-empty { margin: auto; color: var(--muted-2); font-size: 12.5px; }
@media (max-width: 1100px) {
  .sites-work .sites-list { width: 44%; flex-basis: 44%; }
}
@media (max-width: 900px) {
  .sites-work { display: block; overflow: visible; }
  .sites-work .si-preset { display: none; }
  .sites-work .sites-list { width: auto; flex: none; max-height: none; border-right: 0; border-bottom: 1px solid var(--line); }
  .sites-work .sites-rows { max-height: none; overflow: visible; }
  .sites-detail-pane { min-height: 0; }
}
</style>
