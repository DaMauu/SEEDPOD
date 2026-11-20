<template>
  <section class="set-card cov-card">
    <div class="set-card-head">
      <div class="set-card-t">
        <h2 class="set-h2">站点覆盖</h2>
        <p class="set-desc">离线统计目标站定义、cookie、上传/回查路径和上传计划；不联网、不提交。</p>
      </div>
      <button class="btn ghost slim" type="button" :disabled="loading" @click="loadCoverage">{{ loading ? '读取中…' : '刷新' }}</button>
    </div>
    <div v-if="error" class="cov-empty">{{ error }}</div>
    <div v-else-if="!data" class="cov-empty">读取中…</div>
    <template v-else>
      <div class="cov-stats">
        <span>目标站 <b>{{ data.total }}</b></span>
        <span>有 cookie <b>{{ data.withCookie }}</b></span>
        <span>可发布 <b>{{ data.ready }}</b></span>
        <span>上传/回查 <b>{{ data.upload }}/{{ data.verify }}</b></span>
        <span>上传计划 <b>{{ data.planOk }}/{{ data.total }}</b><i v-if="data.planFail" class="warn"> · 失败 {{ data.planFail }}</i></span>
      </div>
      <div class="cov-bar"><i :style="{ width: percentOf(data.ready, data.total) + '%' }"></i></div>
      <div class="cov-note">可发布 = 有 cookie 且上传字段就绪；计划成功只是 dry-run，不等于真实提交。</div>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { reportError } from '../utils/errors'

const data = ref(null)
const loading = ref(false)
const error = ref('')

function percentOf(n, total) {
  const t = Number(total) || 0
  return t ? Math.max(0, Math.min(100, Math.round((Number(n) || 0) / t * 100))) : 0
}
async function loadCoverage() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const j = await (await fetch('/api/coverage', { credentials: 'same-origin' })).json()
    if (!j || !j.ok) { error.value = (j && j.error && j.error.message) || '覆盖统计读取失败'; return }
    data.value = j.data
  } catch (e) {
    reportError('SiteCoverage', e)
    error.value = '覆盖请求发不出去'
  } finally {
    loading.value = false
  }
}

onMounted(loadCoverage)
</script>

<style scoped>
.cov-card { display: flex; flex-direction: column; gap: 10px; }
.set-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.set-card-t { min-width: 0; }
.set-h2 { margin: 0 0 4px; font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
.set-desc { margin: 0; font-size: 11.5px; color: var(--muted); }
.cov-stats { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 12px; color: var(--muted); }
.cov-stats b { color: var(--ink); font-variant-numeric: tabular-nums; }
.cov-stats i.warn { font-style: normal; color: var(--amber); }
.cov-bar { height: 8px; border-radius: 99px; background: #eef0f6; overflow: hidden; }
.cov-bar i { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
.cov-note { font-size: 11px; color: var(--muted-2); }
.cov-empty { padding: 16px 0; font-size: 12px; color: var(--muted-2); }
</style>
