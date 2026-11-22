<template>
  <section class="drawer open vue-card screen-card">
    <div class="drawer-head">
      <div class="drawer-t"><div class="drawer-title">② 初筛与查重</div></div>
      <div class="drawer-head-right">
        <span class="drawer-meta">标题级条件 + 重复处理</span>
        <button class="btn primary slim" type="button" :disabled="busy.dedupe" @click="$emit('save')">{{ busy.dedupe ? '保存中…' : '保存' }}</button>
      </div>
    </div>
    <div class="drawer-body screen-body">
      <div class="flow-group screen-col">
        <div class="flow-ttl">初筛</div>
        <div class="screen-list">
          <div v-for="r in rxRows" :key="r.t" class="set-field screen-field" :class="{ todo: r.todo, wide: r.t === '测试匹配' }">
            <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
            <div class="ctl"><component :is="ruleComponent" :r="r" /></div>
          </div>
        </div>
      </div>
      <div class="flow-group screen-col dedupe-body">
        <div class="flow-ttl">查重</div>
        <div class="screen-list">
          <div class="set-field screen-field">
            <div class="lbl"><span>自动查重</span></div>
            <button class="switch" :class="{ on: autoDupe }" type="button" role="switch" :aria-checked="String(autoDupe)" @click="$emit('toggle-auto-dupe')"><i></i></button>
          </div>
          <div v-for="r in dedupeSwitches" :key="r.t" class="set-field screen-field" :class="{ todo: r.todo }">
            <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
            <button class="switch" :class="{ on: !!r.on }" type="button" role="switch" :aria-checked="String(!!r.on)" :disabled="r.todo" @click="r.on = !r.on"><i></i></button>
          </div>
          <div v-for="r in dedupeInputs" :key="r.t" class="set-field screen-field" :class="{ todo: r.todo }">
            <div class="lbl"><span>{{ r.label || r.t }}</span><em v-if="r.todo" class="todo-badge">未接</em></div>
            <div class="ctl"><component :is="ruleControl" :r="r" /></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  busy: { type: Object, required: true },
  rxRows: { type: Array, default: () => [] },
  autoDupe: { type: Boolean, default: false },
  dedupeSwitches: { type: Array, default: () => [] },
  dedupeInputs: { type: Array, default: () => [] },
  ruleComponent: { type: [Object, Function], required: true },
  ruleControl: { type: [Object, Function], required: true }
})
defineEmits(['save', 'toggle-auto-dupe'])
</script>

<style scoped>
/* 还原拆分前的最终计算样式：父级以 .flow-group 为锚的规则不再命中子组件内部 */
.screen-card.screen-card .drawer-body { padding: 2px 22px 10px; }
.screen-card.screen-card .flow-ttl { margin: 0 0 1px; font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: normal; }
.screen-card.screen-card .screen-field { padding: 3px 0; border-bottom: 0; justify-content: space-between; }
.screen-card.screen-card .screen-field .lbl { display: flex; align-items: center; gap: 2px 6px; margin: 0 0 2px; }
.screen-card.screen-card .screen-field .lbl span { font-size: 12px; line-height: 1.3; color: #5b6573; }
.screen-card.screen-card .screen-field .ctl { display: flex; align-items: center; justify-content: flex-start; gap: 6px; min-width: 0; width: 100%; }
.screen-card.screen-card :deep(.screen-field .switch i) { width: 30px; height: 17px; }
.screen-card.screen-card :deep(.screen-field .switch i::after) { width: 13px; height: 13px; top: 2px; left: 2px; }
.screen-card.screen-card :deep(.screen-field .switch.on i::after) { left: 15px; }
.screen-card.screen-card :deep(.screen-field .cat-chip) { height: auto; padding: 4px 9px; line-height: 1.6; border-radius: 8px; }
.screen-card.screen-card :deep(.rx-test) { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
.screen-card.screen-card :deep(.screen-field.wide .rx-test .input) { flex: 1 1 auto; width: auto; min-width: 200px; height: 28px; font-size: 12px; }
.screen-card.screen-card :deep(.screen-field.wide .rx-test em) { white-space: nowrap; }
.screen-card.screen-card :deep(.screen-field .ctl > .input), .screen-card.screen-card :deep(.screen-field .ctl > .select) { height: 28px; font-size: 12px; padding: 0 8px; }
.screen-card.screen-card :deep(.screen-field .cat-row), .screen-card.screen-card :deep(.screen-field .pick-row) { justify-content: flex-start; }
</style>
