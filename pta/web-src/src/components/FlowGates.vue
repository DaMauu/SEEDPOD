<template>
  <section class="flow-gates" id="flow-gates">
    <div class="fg-main">
      <span class="fg-title">发布闸门</span>
    </div>
    <div class="fg-switches">
      <label>真抓取 <button class="switch" id="gate-crawl" :class="{ on: gates.realCrawl }" type="button" role="switch" :aria-checked="String(gates.realCrawl)" @click="$emit('toggle', 'realCrawl')"><i></i></button></label>
      <label>自动发布 <button class="switch" id="gate-publish" :class="{ on: gates.realPublish }" type="button" role="switch" :aria-checked="String(gates.realPublish)" @click="$emit('toggle', 'realPublish')"><i></i></button></label>
      <label>图床实传 <button class="switch" id="gate-images" :class="{ on: gates.realImages }" type="button" role="switch" :aria-checked="String(gates.realImages)" @click="$emit('toggle', 'realImages')"><i></i></button></label>
    </div>
    <div class="fg-actions">
      <button class="btn primary slim" id="flow-prepare" type="button" :disabled="busy.prepare" @click="$emit('prepare')">{{ busy.prepare ? '准备中…' : '准备下一批（不发布）' }}</button>
      <a class="btn ghost slim" href="#queue">去待审核</a>
    </div>
  </section>
</template>

<script setup>
defineProps({
  gates: { type: Object, required: true },
  busy: { type: Object, required: true }
})
defineEmits(['toggle', 'prepare'])
</script>

<style scoped>
/* 发布闸门：默认关，准备/预览不提交 */
.flow-gates { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 18px; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; box-shadow: var(--shadow); }
.fg-main { display: flex; flex-direction: column; gap: 2px; min-width: 200px; }
.fg-title { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.fg-note { font-size: 10.5px; color: var(--muted-2); }
.fg-switches { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.fg-switches label { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.fg-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.fg-actions .btn { height: 28px; padding: 0 10px; font-size: 11.5px; white-space: nowrap; }
@media (max-width: 900px) {
  .fg-main { min-width: 100%; }
  .fg-actions { margin-left: 0; width: 100%; }
}
</style>
