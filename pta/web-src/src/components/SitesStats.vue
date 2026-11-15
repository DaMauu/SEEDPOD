<template>
  <div class="sites-stats" id="sites-stats">
    <div class="ss-progress">
      <div class="ss-bar" :title="'共 ' + stats.total + ' 个站'">
        <i v-for="(x, i) in stats.segs" :key="i" class="sbar-seg" :style="{ width: x.w + '%', background: x.color }"></i>
      </div>
      <div class="ss-legend">
        <span v-for="x in stats.legend" :key="x.name"><i class="dot" :style="{ background: x.color }"></i>{{ x.name }} {{ x.count }}</span>
      </div>
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
defineProps({
  stats: { type: Object, default: function () { return { total: 0, enabled: 0, loginFail: 0, unknown: 0, segs: [], legend: [] } } }
})
</script>

<style scoped>
.sites-stats {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
  gap: 8px 28px; flex-wrap: nowrap;
  background: #fff; border-radius: 12px; box-shadow: var(--shadow);
  padding: 8px 14px; margin-bottom: 8px;
}
.ss-progress { flex: 0 1 auto; min-width: 0; display: flex; align-items: center; gap: 12px; }
.ss-bar { flex: 0 0 200px; width: 200px; max-width: 42%; display: flex; gap: 2px; height: 7px; border-radius: 99px; overflow: hidden; background: #eef0f6; }
.ss-bar .sbar-seg { display: block; height: 100%; border-radius: 0; padding: 0; background: none; }
.ss-legend { flex: 1 1 auto; display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 10px; color: var(--muted-2); line-height: 1.2; }
.ss-legend .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: 0; }
.ss-nums { display: flex; align-items: center; gap: 18px; flex: 0 0 auto; margin-left: 0; }
.ss-nums div { display: flex; align-items: baseline; gap: 5px; white-space: nowrap; }
.ss-nums span { font-size: 10px; color: var(--muted-2); }
.ss-nums b { font-size: 15px; font-weight: 650; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1; }
.ss-nums b.warn { color: var(--amber); }
@media (max-width: 900px) {
  .sites-stats { padding: 8px 11px; gap: 6px 12px; }
  .ss-progress { flex: 1 1 100%; max-width: none; flex-wrap: wrap; justify-content: center; gap: 6px 10px; }
  .ss-bar { flex: 0 0 160px; width: 160px; max-width: 58%; }
  .ss-legend { flex: 0 1 auto; justify-content: center; }
  .ss-nums { width: 100%; justify-content: space-around; gap: 10px; margin-left: 0; align-items: center; }
  .ss-nums b { font-size: 14px; }
}
</style>
