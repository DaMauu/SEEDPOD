<template>
  <div v-if="open" class="modal-mask">
    <div class="modal map-modal">
      <div class="modal-head">
        <h2>站点映射（分类 / 制作组）</h2>
        <button class="btn ghost slim" type="button" @click="$emit('update:open', false)">关闭</button>
      </div>
      <div class="map-body">
        <div class="map-top">
          <select v-model="host" class="select" @change="loadMap">
            <option v-for="t in targets" :key="t.host" :value="t.host">{{ t.host }}</option>
          </select>
          <button class="btn ghost slim" type="button" :disabled="loading" @click="detect">{{ loading ? '识别中…' : '自动识别' }}</button>
          <button class="btn primary slim" type="button" @click="save">保存</button>
        </div>
        <div v-if="msg" class="rule-hint">{{ msg }}</div>
        <h3>分类（我们这边 → 这个站的值）</h3>
        <div v-for="(row, i) in catRows" :key="'c' + i" class="map-row">
          <input v-model="row.k" class="input" placeholder="电影">
          <input v-model="row.v" class="input" placeholder="401">
          <button class="btn ghost slim" type="button" @click="catRows.splice(i, 1)">删</button>
        </div>
        <button class="btn ghost slim" type="button" @click="catRows.push({ k: '', v: '' })">加一行</button>
        <h3>制作组（组名 → 这个站的值）</h3>
        <div v-for="(row, i) in teamRows" :key="'t' + i" class="map-row">
          <input v-model="row.k" class="input" placeholder="CMCT">
          <input v-model="row.v" class="input" placeholder="8">
          <button class="btn ghost slim" type="button" @click="teamRows.splice(i, 1)">删</button>
        </div>
        <button class="btn ghost slim" type="button" @click="teamRows.push({ k: '', v: '' })">加一行</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getJson } from '../utils/api'

const props = defineProps({
  open: { type: Boolean, default: false }
})
defineEmits(['update:open'])

const host = ref('')
const targets = ref([])
const catRows = ref([])
const teamRows = ref([])
const msg = ref('')
const form = ref(null)
const loading = ref(false)

function rowsOf(obj) { return Object.keys(obj || {}).map(k => ({ k, v: String(obj[k] || '') })) }
async function init() {
  msg.value = ''
  if (!targets.value.length) {
    const j = await getJson('/api/targets')
    targets.value = (j && j.ok && j.data) || []
  }
  if (!host.value && targets.value.length) host.value = targets.value[0].host
  await loadMap()
}
async function loadMap() {
  if (!host.value) return
  const j = await getJson('/api/maps')
  const s = (j && j.ok && j.data && j.data.sites && j.data.sites[host.value]) || {}
  catRows.value = rowsOf(s.cat)
  teamRows.value = rowsOf(s.team)
}
async function detect() {
  if (!host.value || loading.value) return
  loading.value = true
  msg.value = '识别中…'
  const r = await fetch('/api/maps/' + encodeURIComponent(host.value) + '/detect', { method: 'POST', credentials: 'same-origin' })
  const j = await r.json().catch(() => null)
  loading.value = false
  if (!j || !j.ok) { msg.value = (j && j.error && j.error.message) || '识别失败'; return }
  catRows.value = rowsOf(j.data.cat)
  form.value = j.data.form || null
  const tc = (j.data.teamOptions || []).length
  msg.value = '识别到分类 ' + Object.keys(j.data.cat || {}).length + ' 项' + (tc ? ' · 制作组选项 ' + tc + ' 个（填组名对应的值）' : '')
}
async function save() {
  if (!host.value) return
  const cat = {}, team = {}
  catRows.value.forEach(r => { if (String(r.k).trim() && String(r.v).trim()) cat[String(r.k).trim()] = String(r.v).trim() })
  teamRows.value.forEach(r => { if (String(r.k).trim() && String(r.v).trim()) team[String(r.k).trim()] = String(r.v).trim() })
  const r = await fetch('/api/maps/' + encodeURIComponent(host.value), { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cat, team, form: form.value }) })
  const j = await r.json().catch(() => null)
  msg.value = j && j.ok ? '已保存到 data/site-maps.json' : ((j && j.error && j.error.message) || '保存失败')
}

watch(() => props.open, function (v) { if (v) init() })
</script>

<style scoped>
.map-modal { width: 640px; max-width: calc(100vw - 32px); }
.map-body { display: flex; flex-direction: column; gap: 8px; max-height: 70vh; overflow: auto; }
.map-top { display: flex; gap: 8px; align-items: center; }
.map-top .select { flex: 1; }
.map-row { display: flex; gap: 8px; align-items: center; }
.map-row .input { flex: 1; }
</style>
