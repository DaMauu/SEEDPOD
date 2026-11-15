<template>
  <div class="sites-stats" id="sites-stats">
    <div class="ss-progress">
      <div class="ss-bar" :title="'已自检 ' + checked + ' / ' + stats.total">
        <i :style="{ width: stats.checkedPct + '%' }"></i>
      </div>
      <span class="ss-cap">自检进度 {{ stats.checkedPct }}%</span>
    </div>
    <div class="ss-nums">
      <div><span>总站点</span><b>{{ stats.total }}</b></div>
      <div><span>启用</span><b>{{ stats.enabled }}</b></div>
      <div><span>登录失效</span><b class="warn">{{ stats.loginFail }}</b></div>
      <div><span>还没自检</span><b>{{ stats.unknown }}</b></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  stats: { type: Object, default: function () { return { total: 0, enabled: 0, loginFail: 0, unknown: 0, checkedPct: 0 } } }
})
const checked = computed(() => Math.max(0, (Number(props.stats.total) || 0) - (Number(props.stats.unknown) || 0)))
</script>

<style scoped>
.sites-stats {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
  gap: 10px 28px; flex-wrap: wrap;
  background: #fff; border-radius: 12px; box-shadow: var(--shadow);
  padding: 9px 16px; margin-bottom: 8px;
}
.ss-progress { flex: 1 1 260px; min-width: 180px; max-width: 520px; display: flex; align-items: center; gap: 10px; }
.ss-bar { flex: 1 1 auto; height: 7px; border-radius: 99px; overflow: hidden; background: #eef0f6; }
.ss-bar i { display: block; height: 100%; border-radius: 99px; background: var(--accent); transition: width .25s ease; }
.ss-cap { flex: 0 0 auto; font-size: 10.5px; color: var(--muted-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ss-nums { display: flex; align-items: center; gap: 22px; flex: 0 0 auto; margin-left: auto; }
.ss-nums div { display: flex; align-items: baseline; gap: 6px; white-space: nowrap; }
.ss-nums span { font-size: 10.5px; color: var(--muted-2); }
.ss-nums b { font-size: 16px; font-weight: 650; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1; }
.ss-nums b.warn { color: var(--amber); }
@media (max-width: 900px) {
  .sites-stats { padding: 9px 12px; gap: 8px 16px; }
  .ss-progress { flex: 1 1 100%; max-width: none; }
  .ss-nums { width: 100%; justify-content: space-between; gap: 10px; margin-left: 0; }
  .ss-nums b { font-size: 15px; }
}
</style>
