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
.sites-stats { flex: 0 0 auto; display: flex; align-items: center; flex-wrap: wrap; gap: 14px 27px; background: #fff; border-radius: 14px; box-shadow: var(--shadow); padding: 13px 20px; margin-bottom: 12px; }
.ss-nums { display: flex; gap: 26px; flex: 0 0 auto; }
.ss-nums span { display: block; font-size: 10.5px; color: var(--muted-2); }
.ss-nums b { font-size: 19px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--ink); }
.ss-nums b.warn { color: var(--amber); }
.ss-nums b.bad { color: var(--red); }
.ss-arch { flex: 1 1 220px; min-width: 220px; }
.ss-bar { display: flex; gap: 2px; height: 8px; border-radius: 99px; overflow: hidden; background: #eef0f6; }
.ss-bar .seg { display: block; height: 100%; }
.ss-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 7px; font-size: 10.5px; color: var(--muted); }
.ss-legend .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; vertical-align: 0; }
.ss-cov { flex: 1 1 100%; margin-top: 0; font-size: 11px; color: var(--muted); line-height: 1.65; }
</style>
