<template>
  <div class="sites-bar">
    <label class="sites-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="site-q" :value="q" placeholder="搜索站点 / 域名" @input="emit('update:q', $event.target.value)">
    </label>
    <div class="seg-tabs" id="site-status">
      <button v-for="t in statusTabs" :key="t.v" type="button" :class="{ active: statusFilter === t.v }" @click="emit('update:statusFilter', t.v)">
        {{ t.label }}<i>{{ t.n }}</i>
      </button>
    </div>
    <div class="spacer"></div>
    <select :value="archFilter" class="select slim" id="site-arch" @change="emit('update:archFilter', $event.target.value)">
      <option value="all">全部架构</option>
      <option value="NP">NexusPHP</option>
      <option value="UNIT3D">UNIT3D</option>
      <option value="GZ">Gazelle</option>
      <option value="OTHER">其它</option>
      <option value="?">未确认</option>
    </select>
    <select :value="loginFilter" class="select slim" id="site-login" @change="emit('update:loginFilter', $event.target.value)">
      <option value="all">全部状态</option>
      <option value="ok">可用</option>
      <option value="fail">失效</option>
      <option value="none">未自检</option>
    </select>
    <select :value="presetFilter" class="select slim" id="site-preset" @change="emit('update:presetFilter', $event.target.value)">
      <option value="all">全部预设</option>
      <option value="pending">预设待确认</option>
      <option value="confirmed">预设已确认</option>
      <option value="nocats">没有分类 id</option>
    </select>
    <select :value="crawlFilter" class="select slim" id="site-crawl" @change="emit('update:crawlFilter', $event.target.value)">
      <option value="all">全部抓取</option>
      <option value="crawled">抓过的</option>
      <option value="today">今日抓过</option>
      <option value="never">还没抓过</option>
    </select>
    <button class="btn ghost slim" id="bulk-open" :disabled="!picksCount" @click="emit('bulk')">
      {{ picksCount ? '批量设置（' + picksCount + '）' : '批量设置' }}
    </button>
    <button class="btn ghost slim" id="sites-pack-open" type="button" @click="emit('pack')">站点包</button>
    <button class="btn ghost slim" id="site-selfcheck" :disabled="busySelfcheck || !cookieCount" title="对有 cookie 的站点逐个跑一次会话自检；每个站只发一次 GET" @click="emit('selfcheck')">
      {{ busySelfcheck ? '自检中…' : '自检有 cookie 的站' }}
    </button>
    <button class="btn primary slim" type="button" @click="emit('add')">添加站点</button>
  </div>
</template>

<script setup>
defineProps({
  q: { type: String, default: '' },
  statusFilter: { type: String, default: 'all' },
  archFilter: { type: String, default: 'all' },
  loginFilter: { type: String, default: 'all' },
  presetFilter: { type: String, default: 'all' },
  crawlFilter: { type: String, default: 'all' },
  statusTabs: { type: Array, default: function () { return [] } },
  picksCount: { type: Number, default: 0 },
  cookieCount: { type: Number, default: 0 },
  busySelfcheck: Boolean
})
const emit = defineEmits(['update:q', 'update:statusFilter', 'update:archFilter', 'update:loginFilter', 'update:presetFilter', 'update:crawlFilter', 'bulk', 'selfcheck', 'add', 'pack'])
</script>

<style scoped>
.sites-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.sites-search { position: relative; width: 232px; }
.sites-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 15px; height: 15px; color: var(--muted-2); }
.sites-search input {
  width: 100%; height: 36px; padding: 0 12px 0 33px; border-radius: 10px;
  border: 1px solid var(--line-2); background: #fff; font: inherit; font-size: 12.5px; color: var(--ink);
}
.sites-search input::placeholder { color: var(--muted-2); }
.sites-search input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,70,229,.09); }
@media (max-width: 900px) {
  .sites-bar { flex-wrap: wrap; gap: 8px; }
  .sites-bar .input, .sites-bar .select { max-width: 100%; }
}
</style>
