<template>
  <section class="drawer open vue-card crawl-card">
    <div class="drawer-head">
      <div class="drawer-t"><div class="drawer-title">① 抓取</div></div>
      <div class="drawer-head-right crawl-head-tools">
        <select :value="sourceHost" class="input slim crawl-source" id="crawl-site" title="从哪个站看抓取计划" @change="$emit('update:sourceHost', $event.target.value)">
          <option value="">选来源站</option>
          <option v-for="s in siteOptions" :key="s.host" :value="s.host">{{ s.title }}</option>
        </select>
        <button class="btn ghost slim" id="crawl-plan-btn" type="button" title="只读本地配置，不发请求" :disabled="busy.plan" @click="$emit('show-plan')">{{ busy.plan ? '读取中…' : '看地址' }}</button>
        <span class="drawer-meta">{{ fetchSum }}</span>
        <button class="btn primary slim" type="button" :disabled="busy.fetch" @click="$emit('save-fetch')">{{ busy.fetch ? '保存中…' : '保存' }}</button>
      </div>
    </div>
    <div class="drawer-body">
      <div v-if="plan.on" class="crawl-plan-box" id="crawl-plan-box">
        <div class="crawl-plan-head">
          <b>抓取计划 · {{ plan.host }}</b>
          <span>{{ plan.catGroups }} 组 / {{ plan.catIds }} 个 id</span>
          <button class="btn ghost slim" type="button" @click="plan.on = false">收起</button>
        </div>
        <div class="crawl-plan-note">引擎 {{ plan.engine || '未识别' }} · 间隔至少 {{ plan.interval }} 秒 · 单站每天最多 {{ plan.dailyMax }} 次 · 预估 {{ plan.estimatedQueries }} 次查询</div>
        <div class="crawl-plan-note" id="crawl-plan-today">{{ plan.today }}</div>
        <div v-for="u in plan.urls" :key="u.cat + '-' + u.catId" class="crawl-plan-note crawl-plan-url">GET {{ u.url }}</div>
        <ul v-if="plan.warnings.length" class="crawl-plan-warn">
          <li v-for="(w, i) in plan.warnings" :key="i">{{ w }}</li>
        </ul>
        <em>只读本地配置拼的地址，没有发请求；要抓某一页去站点页点「抓一页」</em>
      </div>
      <div class="preset-block">
        <div v-for="r in fetchRows" :key="r.t" class="preset-row" :class="{ todo: r.todo }">
          <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
          <div class="cat-row pick-row">
            <button v-for="c in (r.chips || [])" :key="c" class="cat-chip" :class="{ on: (r.sel || []).includes(c) }" type="button" :disabled="r.todo" @click="$emit('toggle-fetch-chip', r, c)">{{ c }}</button>
          </div>
        </div>
      </div>

      <div class="crawl-foot">
        <label class="detail-sw">
          <span>抓详情页</span>
          <button class="switch" :class="{ on: detail }" type="button" role="switch" :aria-checked="String(detail)" @click="$emit('toggle-detail')"><i></i></button>
        </label>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  sourceHost: { type: String, default: '' },
  siteOptions: { type: Array, default: () => [] },
  busy: { type: Object, required: true },
  fetchSum: { type: String, default: '' },
  plan: { type: Object, required: true },
  fetchRows: { type: Array, default: () => [] },
  detail: { type: Boolean, default: false }
})
defineEmits(['update:sourceHost', 'show-plan', 'save-fetch', 'toggle-fetch-chip', 'toggle-detail'])
</script>

<style scoped>
/* 抓取计划：并入抓取卡，不再单开“本地演练” */
.crawl-head-tools { flex-wrap: wrap; }
.crawl-source { width: 150px; max-width: 180px; height: 28px; font-size: 11.5px; }
.crawl-plan-box { margin: 8px 0 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: #fafbfd; }
.crawl-plan-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.crawl-plan-head b { font-size: 12.5px; color: var(--ink); }
.crawl-plan-head span { font-size: 11px; color: var(--muted); }
.crawl-plan-head .btn { margin-left: auto; height: 24px; padding: 0 8px; font-size: 11px; }
.crawl-plan-note { margin-top: 4px; font-size: 11px; color: var(--muted); line-height: 1.5; }
.crawl-plan-url { word-break: break-all; }
.crawl-plan-warn { margin: 6px 0 0 16px; color: var(--amber); font-size: 11px; }
.crawl-plan-box em { display: block; margin-top: 6px; font-style: normal; font-size: 10.5px; color: var(--muted-2); }
@media (max-width: 900px) {
  .crawl-head-tools { width: 100%; }
  .crawl-source { width: 100%; max-width: none; }
}
</style>
