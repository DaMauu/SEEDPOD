<template>
  <Teleport to="body">
    <div v-if="open" class="modal-mask" id="crawl-target-modal">
      <div class="modal wide">
        <div class="modal-head">
          <h2>选择主站</h2>
          <button class="btn ghost slim" type="button" @click="$emit('close')">关闭</button>
        </div>
        <p class="modal-sub">显示已添加的站点；cookie 和上传配置在发布时再校验。</p>
        <input :value="query" class="input" placeholder="搜索站点名 / 域名" autocomplete="off" @input="$emit('update:query', $event.target.value)">
        <div class="target-list" id="target-list">
          <button v-for="t in options" :key="t.host" class="target-item" :class="{ on: current === t.host }" type="button" @click="$emit('pick', t.host)">
            <span class="ti-name">{{ t.title }}</span>
            <span class="ti-host">{{ t.host }}</span>
          </button>
          <div v-if="!options.length" class="sites-empty">没有可用的目标站（先在站点页存 cookie 并自检通过）</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  query: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  current: { type: String, default: '' }
})
defineEmits(['close', 'update:query', 'pick'])
</script>

<style scoped>
.target-list { max-height: 46vh; overflow-y: auto; margin-top: 12px; }
.target-item { display: grid; grid-template-columns: 1fr 150px 76px; gap: 12px; align-items: center; width: 100%; text-align: left; border: 0; background: none; padding: 11px 12px; border-radius: 10px; cursor: pointer; font: inherit; }
.target-item:hover { background: #f7f8fa; }
.target-item.on { background: var(--accent-soft); }
.target-item .chip { justify-self: start; }
.ti-name { font-size: 13px; font-weight: 600; color: var(--ink); }
.ti-host { font-size: 11.5px; color: var(--muted-2); font-family: var(--mono, monospace); }
@media (max-width: 600px) {
  .target-item { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; }
  .ti-name { grid-column: 1; }
  .ti-host { grid-column: 1; grid-row: 2; }
  .target-item .chip { grid-column: 2; grid-row: 1 / 3; align-self: center; }
}
</style>
