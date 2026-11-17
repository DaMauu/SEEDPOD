<template>
  <section class="sched-bar" id="sched-bar">
    <div class="sb-main"><span class="sb-title">调度</span><span class="sb-note">{{ schedText }}</span></div>
    <div class="sb-actions">
      <label class="sb-sw">自动跑 <button class="switch" :class="{ on: sched.on }" type="button" role="switch" :aria-checked="String(sched.on)" @click="$emit('toggle')"><i></i></button></label>
      <select class="select slim sb-every" :value="String(sched.everyMinutes)" @change="$emit('every', Number($event.target.value) || 60)">
        <option v-for="n in [30, 60, 120, 240]" :key="n" :value="String(n)">{{ n }} 分钟</option>
      </select>
      <label class="sb-f">请求间隔 <input v-model.number="limits.interval" class="input num sb-num" type="number" :min="8" :max="600" @change="$emit('save')"> 秒</label>
      <label class="sb-f">窗口 <input v-model.number="limits.windowMinutes" class="input num sb-num" type="number" :min="1" :max="1440" @change="$emit('save')"> 分钟</label>
      <label class="sb-f">窗口最多 <input v-model.number="limits.maxPerWindow" class="input num sb-num" type="number" :min="1" :max="1000" @change="$emit('save')"> 次</label>
      <label class="sb-f">失败暂停 <input v-model.number="limits.breaker" class="input num sb-num" type="number" :min="1" :max="10" @change="$emit('save')"> 次</label>
      <button class="btn ghost slim" type="button" :disabled="sched.running" @click="$emit('run')">{{ sched.running ? '跑着呢…' : '立即跑一次' }}</button>
    </div>
  </section>
</template>

<script setup>
defineProps({
  sched: { type: Object, required: true },
  schedText: { type: String, default: '' },
  limits: { type: Object, required: true }
})
defineEmits(['toggle', 'every', 'save', 'run'])
</script>

<style scoped>
.sched-bar { display:flex; align-items:center; justify-content:space-between; gap:8px 14px; flex-wrap:nowrap; background:#fff; border-radius:12px; box-shadow:var(--shadow); padding:7px 14px; }
.sb-main { display:flex; align-items:baseline; gap:10px; min-width:0; }
.sb-title { font-size:12px; font-weight:600; color:var(--ink); }
.sb-note { font-size:11px; color:var(--muted-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sb-actions { display:flex; align-items:center; gap:10px; flex:0 0 auto; }
.sb-sw { display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--muted); }
.sb-every { height:26px; font-size:11.5px; width:96px; }
.sb-f { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--muted); white-space:nowrap; }
.sb-num { width:56px; height:26px; font-size:11px; text-align:center; }
@media (max-width:900px){
  .sched-bar { flex-wrap:wrap; padding:7px 11px; }
  .sb-main { flex:1 1 100%; }
  .sb-actions { width:100%; justify-content:flex-start; flex-wrap:wrap; gap:6px 12px; }
  .sb-every { flex:0 1 96px; }
  .sb-f { flex:1 1 auto; }
}
</style>
