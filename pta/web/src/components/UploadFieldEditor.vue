<template>
  <div v-if="upload" class="upload-fields-editor">
    <div class="cm-actions upload-edit-bar">
      <button class="btn ghost slim" type="button" @click="open = !open">{{ open ? '收起字段' : '编辑字段' }}</button>
      <span class="sd-cookie-res">{{ open ? '字段名和模板可改' : '' }}</span>
    </div>
    <template v-if="open">
      <div v-for="(f, i) in fields" :key="'ue' + i" class="upload-edit-row">
        <input v-model="f.name" class="input" placeholder="字段名">
        <input v-model="f.template" class="input" placeholder="{title}">
        <button class="btn ghost slim upload-del" type="button" title="删除字段" @click="remove(i)">×</button>
      </div>
      <div class="cm-actions"><button class="btn ghost slim" type="button" @click="add">添加字段</button></div>
      <div class="sd-row upload-file-row"><span>文件字段</span><input v-model="fileField" class="input" placeholder="file"></div>
    </template>
    <template v-else>
      <div v-for="f in fields" :key="'r' + f.name" class="sd-row"><span>{{ f.name }}</span><b>{{ f.template || '空' }}</b></div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  upload: { type: Object, default: null }
})
const emit = defineEmits(['change'])

const open = ref(false)
const fields = ref([])
const fileField = ref('')

const effective = computed(function () {
  const u = props.upload || {}
  const out = {}
  fields.value.forEach(function (f) {
    const name = String(f.name || '').trim()
    if (!name || out[name] !== undefined) return
    out[name] = String(f.template == null ? '' : f.template)
  })
  return Object.assign({}, u, { fileField: String(fileField.value || '').trim(), fields: out })
})

const issues = computed(function () {
  const list = []
  const seen = {}
  fields.value.forEach(function (f) {
    const name = String(f.name || '').trim()
    if (!name) { if (list.indexOf('有字段名为空') < 0) list.push('有字段名为空'); return }
    if (!/^[A-Za-z0-9_\[\].-]+$/.test(name)) { const m = '字段名不合法：' + name; if (list.indexOf(m) < 0) list.push(m) }
    if (name.length > 80) { const m = '字段名太长：' + name.slice(0, 20) + '…'; if (list.indexOf(m) < 0) list.push(m) }
    if (seen[name]) { const m = '字段名重复：' + name; if (list.indexOf(m) < 0) list.push(m) }
    seen[name] = true
    if (String(f.template || '').length > 1000) { const m = '模板太长：' + name; if (list.indexOf(m) < 0) list.push(m) }
  })
  return list
})

function emitChange() {
  emit('change', { upload: effective.value, issues: issues.value })
}
function initFields(u) {
  const f = (u && u.fields) || {}
  fields.value = Object.keys(f).map(function (k) { return { name: k, template: String(f[k] || '') } })
  fileField.value = String((u && u.fileField) || '')
  open.value = false
  emitChange()
}
function add() { fields.value.push({ name: '', template: '' }) }
function remove(i) { fields.value.splice(i, 1) }

watch(function () { return props.upload }, initFields, { immediate: true })
watch([fields, fileField], emitChange, { deep: true })
</script>

<style scoped>
.upload-edit-bar { margin: 6px 0 2px; }
.upload-edit-row { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.15fr) 24px; gap: 4px; align-items: center; padding: 2px 0; }
.upload-edit-row .input { width: 100%; height: 24px; font-size: 10.5px; padding: 0 6px; border-radius: 7px; }
.upload-del { width: 22px; height: 22px; padding: 0; line-height: 20px; font-size: 13px; }
.upload-file-row .input { width: 120px; height: 24px; font-size: 10.5px; padding: 0 6px; }
</style>
