<template>
  <div class="sites-stats" id="sites-stats">
    <div class="ss-nums">
      <div><span>总站点</span><b>{{ stats.total }}</b></div>
      <div><span>启用</span><b>{{ stats.enabled }}</b></div>
      <div><span>登录失效</span><b class="warn">{{ stats.loginFail }}</b></div>
      <div><span>还没自检</span><b>{{ stats.unknown }}</b></div>
    </div>
    <div class="ss-arch">
      <div class="ss-bar">
        <i v-for="(x, i) in stats.segs" :key="i" class="seg" :style="{ width: x.w + '%', background: x.color }"></i>
      </div>
      <div class="ss-legend">
        <span v-for="x in stats.legend" :key="x.name"><i class="dot" :style="{ background: x.color }"></i>{{ x.name }} {{ x.count }}</span>
      </div>
    </div>
    <div class="ss-cov">{{ stats.cov }}</div>
  </div>
</template>

<script setup>
defineProps({
  stats: { type: Object, default: function () { return { total: 0, enabled: 0, loginFail: 0, unknown: 0, segs: [], legend: [], cov: '' } } }
})
</script>

<style scoped>
.sites-stats { flex: 0 0 auto; display: flex; align-items: center; flex-wrap: nowrap; gap: 8px 16px; background: #fff; border-radius: 12px; box-shadow: var(--shadow); padding: 8px 14px; margin-bottom: 8px; }
.ss-nums { display: flex; gap: 16px; flex: 0 0 auto; }
.ss-nums span { display: block; font-size: 10px; color: var(--muted-2); }
.ss-nums b { font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--ink); }
.ss-nums b.warn { color: var(--amber); }
.ss-nums b.bad { color: var(--red); }
.ss-arch { flex: 1 1 180px; min-width: 150px; }
.ss-bar { display: flex; gap: 1px; height: 6px; border-radius: 99px; overflow: hidden; background: #eef0f6; }
.ss-bar .seg { display: block; height: 100%; }
.ss-legend { display: flex; flex-wrap: wrap; gap: 3px 10px; margin-top: 4px; font-size: 10px; color: var(--muted); }
.ss-legend .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: 0; }
.ss-cov { flex: 1 1 280px; margin-top: 0; font-size: 10.5px; color: var(--muted); line-height: 1.4; }
@media (max-width: 900px) {
  .sites-stats { flex-wrap: wrap; padding: 9px 12px; }
  .ss-cov { flex: 1 1 100%; }
}
</style>
