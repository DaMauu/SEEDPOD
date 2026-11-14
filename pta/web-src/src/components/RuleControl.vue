<template>
  <div v-if="r.chips" class="cat-row pick-row">
    <button v-for="c in r.chips" :key="c" class="cat-chip" :class="{ on: (r.sel || []).includes(c) }" type="button" :disabled="r.todo" @click="toggleChip(c)">{{ c }}</button>
  </div>
  <div v-else-if="r.type === 'chips'" class="chip-row">
    <button v-for="(it, i) in (r.items || [])" :key="i" class="chip" :class="{ on: it.on }" type="button" :disabled="r.todo" @click="it.on = !it.on">{{ it.t }}</button>
  </div>
  <button v-else-if="r.type === 'switch'" class="switch" :class="{ on: r.on }" type="button" :disabled="r.todo" @click="r.on = !r.on"><i></i></button>
  <div v-else-if="r.type === 'pick'" class="cat-row pick-row">
    <button v-for="o in (r.opts || [])" :key="o" class="cat-chip" :class="{ on: r.v === o }" type="button" :disabled="r.todo" @click="r.v = o">{{ o }}</button>
  </div>
  <select v-else-if="r.type === 'select'" v-model="r.v" class="select" :disabled="r.todo">
    <option v-if="!r.v" value="">未选择</option>
    <option v-for="o in (r.opts || [])" :key="o" :value="o">{{ r.labels && r.labels[o] !== undefined ? r.labels[o] : o }}</option>
  </select>
  <input v-else-if="r.type === 'num'" v-model="r.v" class="input num" type="number" :disabled="r.todo" :placeholder="r.ph">
  <span v-else-if="r.type === 'fixed'" class="tpl-fixed">{{ r.v || '系统固定' }}</span>
  <div v-else-if="r.type === 'fixed-btn'" class="fixed-row">
    <span class="tpl-fixed">{{ r.v || '原生转载不修改' }}</span>
    <button class="btn ghost slim" type="button" :disabled="!!r.on" @click="r.on = true">{{ r.on ? '已应用' : '应用' }}</button>
  </div>
  <button v-else-if="r.type === 'button'" class="btn ghost slim" type="button" @click="onButton">{{ r.v || r.t }}</button>
  <div v-else-if="r.type === 'custom'" v-html="r.html"></div>
  <input v-else v-model="r.v" class="input" :disabled="r.todo" :placeholder="r.ph">
</template>

<script setup>
const props = defineProps({ r: { type: Object, required: true } })

function toggleChip(c) {
  const r = props.r
  const sel = Array.isArray(r.sel) ? r.sel.slice() : []
  const i = sel.indexOf(c)
  if (i >= 0) sel.splice(i, 1)
  else sel.push(c)
  r.sel = sel
}
function onButton() {
  const t = String(props.r.t || '')
  if (t.indexOf('目标站') >= 0 || t.indexOf('站点分类') >= 0) {
    if (window.PTA && window.PTA.toast) window.PTA.toast('分类映射在站点页逐站配置')
    location.hash = '#sites'
    return
  }
  if (window.PTA && window.PTA.toast) window.PTA.toast('这个入口还没接')
}
</script>
