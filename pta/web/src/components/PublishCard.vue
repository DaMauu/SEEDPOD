<template>
  <section class="drawer open vue-card pub-card">
    <div class="drawer-head">
      <div class="drawer-t"><div class="drawer-title">发布</div></div>
      <div class="drawer-head-right">
        <button class="btn ghost slim" type="button" @click="$emit('maps')">站点映射</button>
        <button class="btn primary slim" type="button" :disabled="busy.pub" @click="$emit('save')">{{ busy.pub ? '保存中…' : '保存' }}</button>
      </div>
    </div>
    <div class="drawer-body">
      <div v-for="g in groups" :key="g.name" class="flow-group" :class="g.cls">
        <div class="flow-ttl">{{ g.name }}</div>
        <div class="set-fields">
          <template v-for="(cell, ci) in g.cells" :key="cell.same || ci">
            <div v-if="cell.rows.length > 1" class="set-field pair">
              <div v-for="r in cell.rows" :key="r.t" class="pair-item" :class="{ grow: r.type !== 'switch', target: r.t === '发布到', todo: r.todo }">
                <template v-if="r.type === 'switch'">
                  <span class="pair-lbl">{{ r.label || r.t }}<em v-if="r.todo" class="todo-badge">未接</em></span>
                  <button class="switch" :class="{ on: r.on }" type="button" :disabled="r.todo" @click="r.on = !r.on"><i></i></button>
                </template>
                <template v-else>
                  <span class="pair-lbl">{{ r.label || r.t }}<em v-if="r.todo" class="todo-badge">未接</em></span>
                  <div class="ctl"><component :is="ruleComponent" :r="r" /></div>
                </template>
              </div>
            </div>
            <div v-else-if="cell.rows[0].type === 'section'" class="set-field sec">
              <div class="sec-ttl">{{ cell.rows[0].t }}</div>
            </div>
            <div v-else class="set-field" :class="{ wide: cell.rows[0].wide, pick: cell.rows[0].type === 'pick' || cell.rows[0].inline, todo: cell.rows[0].todo }">
              <div class="lbl"><span>{{ cell.rows[0].label || cell.rows[0].t }}</span><em v-if="cell.rows[0].todo" class="todo-badge">未接</em></div>
              <div class="ctl"><component :is="ruleComponent" :r="cell.rows[0]" /></div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  groups: { type: Array, default: () => [] },
  busy: { type: Object, required: true },
  ruleComponent: { type: [Object, Function], required: true }
})
defineEmits(['maps', 'save'])
</script>

<style scoped>
.flow-group {background:#f9fafb;border:1px solid #edeff2;border-radius:9px;padding:9px 14px 8px;margin:0 0 8px}
.flow-group :deep(.flow-ttl) {font-size:12px;font-weight:600;color:var(--muted);margin:0 0 1px}
.flow-group :deep(.set-field .lbl) { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; min-width: 0; }
.flow-group :deep(.set-field .lbl > span) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flow-group :deep(.set-field .cat-row), .flow-group :deep(.set-field .pick-row) { justify-content: flex-start; }
.flow-group :deep(.set-fields) {display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 18px}
.flow-group :deep(.set-field) {display:block;padding:5px 0;border-bottom:0;min-width:0}
.flow-group :deep(.set-field .lbl) {margin-bottom:3px}
.flow-group :deep(.set-field .lbl span) {font-size:12.5px;line-height:1.35}
.flow-group :deep(.set-field .ctl), .flow-group :deep(.set-field .ctl > .input), .flow-group :deep(.set-field .ctl > .select) {width:100%}
.flow-group {padding:7px 12px 6px;margin:0 0 7px}
.flow-group :deep(.set-fields) {gap:0 12px}
.flow-group :deep(.set-field) {padding:3px 0}
.flow-group :deep(.set-field .lbl) {margin-bottom:2px}
.flow-group :deep(.set-field .lbl span) {font-size:12px;line-height:1.3}
.flow-group :deep(.set-field .ctl>.input), .flow-group :deep(.set-field .ctl>.select) {height:28px;font-size:12px;padding:0 8px}
.flow-group :deep(.switch i) {width:30px;height:17px}
.flow-group :deep(.switch i::after) {width:13px;height:13px;top:2px;left:2px}
.flow-group :deep(.switch.on i::after) {left:15px}
.flow-group :deep(.set-field.sec) {grid-column:1/-1;padding:5px 0 2px;margin-top:2px;border-top:1px solid #e9ebef}
.flow-group :deep(.set-field.sec:first-child) {margin-top:0;padding-top:0;border-top:0}
.flow-group :deep(.sec-ttl) {font-size:11px;font-weight:600;color:#8a94a2;letter-spacing:.4px}
.flow-group :deep(.chip-row) {display:flex;flex-wrap:wrap;gap:6px;padding:2px 0 1px}
.flow-group :deep(.chip) {border:1px solid #e2e5ea;background:#fff;border-radius:999px;padding:4px 10px;font-size:12px;color:#5b6573;cursor:pointer;line-height:1.2}
.flow-group :deep(.chip.on) {background:#eef5ff;border-color:#bfd8ff;color:#1d4ed8}
.flow-group :deep(.set-field.pair) {grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:2px 0 4px}
.flow-group :deep(.set-field.wide) {grid-column:1/-1}
.flow-group :deep(.set-field.wide .rx-test) {width:100%}
.flow-group :deep(.set-field.wide .rx-test .input) {width:auto;flex:1 1 auto;min-width:200px;height:28px;font-size:12px}
.flow-group :deep(.set-field.wide .rx-test em) {white-space:nowrap}
.flow-group.cond {background:transparent;border:0;padding:0;margin:0 0 4px}
.flow-group.cond :deep(.set-fields) {grid-template-columns:repeat(2,minmax(0,1fr));gap:0 18px}
.flow-group.cond :deep(.set-field) {grid-column:auto;display:grid;grid-template-columns:fit-content(220px) minmax(0,1fr);align-items:center;gap:10px;padding:4px 0;border-bottom:1px solid #f3f5f8}
.flow-group.cond :deep(.set-field .lbl) {margin:0}
.flow-group.cond :deep(.set-field.sec) {grid-column:1/-1;padding:9px 0 3px;margin-top:2px;border-top:1px solid #e9ebef;border-bottom:0}
.flow-group.cond :deep(.set-field.sec .sec-ttl) {font-size:11px;color:#98a1ad}
.flow-group.cond :deep(.set-field.pair) {grid-column:1/-1;display:flex;align-items:center;gap:14px}
.flow-group.cond :deep(.set-field.wide) {grid-column:1/-1}
.flow-group.cond :deep(.set-field.pick) {grid-column:auto}
.flow-group.cond :deep(.set-field.pick .cat-chip) {height:24px;padding:0 9px;line-height:24px}
.flow-group.cond :deep(.set-field .ctl>.input) {height:26px;max-width:180px}
.flow-group :deep(.set-field.pick) {grid-column:1/-1;display:grid;grid-template-columns:fit-content(220px) minmax(0,1fr);align-items:center;gap:10px;padding:3px 0}
.flow-group :deep(.set-field.pick .lbl) {margin:0}
.flow-group :deep(.set-field.pick .ctl) {width:100%}
.flow-group :deep(.set-field.pick .cat-row) {display:flex;flex-wrap:wrap;gap:6px;padding:0}
.flow-group :deep(.set-field.pick .cat-chip) {height:26px;padding:0 10px;border-radius:6px;font-size:12px;line-height:26px}
.flow-group :deep(.set-field.pick .ctl>.input) {height:26px;max-width:180px;font-size:12px}
.flow-group :deep(.set-field.pair .pair-item) {display:flex;align-items:center;gap:6px;flex:0 0 auto}
.flow-group :deep(.set-field.pair .pair-lbl) {font-size:12px;color:#5b6573}
@media (max-width:700px) {
.flow-group :deep(.set-fields) {grid-template-columns:1fr}
.flow-group.cond :deep(.set-fields) {grid-template-columns:1fr}
.flow-group.cond :deep(.set-field) {grid-template-columns:1fr;gap:2px}
.flow-group.cond :deep(.set-field .ctl>.input) {max-width:none;width:100%}
.flow-group :deep(.set-field.pair), .flow-group.cond :deep(.set-field.pair) {flex-direction:column;align-items:stretch;gap:4px}
.flow-group :deep(.set-field.pair .pair-item) {width:100%;flex:1 1 auto}
}
.flow-group :deep(.set-field .lbl) { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 6px; }
.flow-group :deep(.set-field .lbl span) { min-width: 0; }
.flow-group :deep(.set-field .lbl i) { flex: 1 1 100%; margin-top: 2px; }
.flow-group :deep(.set-field .lbl .todo-badge) { flex: 0 0 auto; margin-left: 0; }
.flow-group :deep(.pair-lbl) { display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.flow-group :deep(.pair-lbl .todo-badge) { flex: 0 0 auto; margin-left: 0; }
@media (max-width:900px){
.flow-group.cond :deep(.set-field), .flow-group :deep(.set-field.pick) {grid-template-columns:92px minmax(0,1fr);gap:8px;align-items:center}
}
.pub-card > .drawer-head { border-bottom: 0; background: #fff; }
.pub-card.pub-card .drawer-body {
  display: grid !important; grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  gap: 0 18px; max-width: none; margin: 0; padding: 8px 22px 14px;
}
.pub-card .flow-group {
  display: block; background: transparent; border: 0; border-right: 1px solid #f2f4f7;
  border-radius: 0; padding: 0 16px 0 0; margin: 0; min-width: 0;
}
.pub-card .flow-group:last-child { border-right: 0; padding-right: 0; }
.pub-card .flow-group .flow-ttl {
  display: flex; align-items: center; gap: 7px;
  margin: 0 0 8px; padding: 0;
  font-size: 13px; font-weight: 650; color: var(--ink); letter-spacing: -.01em;
}
.pub-card .flow-group .set-fields { display: flex; flex-direction: column; gap: 6px; padding-left: 0; }
.pub-card .flow-group .set-fields .set-field.pair {
  display: flex !important; flex-direction: column !important; align-items: stretch;
  gap: 6px; padding: 0;
}
.pub-card .flow-group .set-fields .set-field.pair .pair-item {
  width: 100% !important; flex: 1 1 auto !important; justify-content: space-between; gap: 6px;
}
.pub-card .flow-group .set-fields .set-field.pair .pair-item .pair-lbl { white-space: normal; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target { flex-direction: column; align-items: stretch; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target .ctl { width: 100%; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target .target-pick { width: 100%; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target .target-pick .tp-info { flex-wrap: wrap; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow { flex-direction: column; align-items: stretch; min-width: 0; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow .ctl { width: 100%; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow .ctl > .input { width: 100%; max-width: none; }
@media (max-width: 1200px) {
.pub-card.pub-card .drawer-body { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 16px 18px; }
.pub-card .flow-group { border-right: 0; border-bottom: 1px solid #f2f4f7; padding: 0 0 10px; }
}
@media (max-width: 800px) {
.pub-card.pub-card .drawer-body { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
@media (max-width: 600px) {
.pub-card.pub-card .drawer-body { grid-template-columns: 1fr !important; }
}
.pub-card .flow-group .flow-ttl::before { content: ''; width: 3px; height: 12px; border-radius: 2px; background: var(--accent); flex: 0 0 auto; }
.pub-card .flow-group .set-fields { display: flex; flex-direction: column; gap: 0; padding-left: 10px; }
.pub-card .flow-group .set-fields .set-field, .pub-card .flow-group .set-fields .set-field.pick {
  display: grid; grid-template-columns: 200px minmax(0, 1fr);
  align-items: center; gap: 16px;
  padding: 4px 0; margin: 0; border: 0; min-width: 0;
}
.pub-card .flow-group .set-fields .set-field.pair { display: flex !important; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 8px 20px; padding: 2px 0; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item { width: auto; flex: 0 0 auto; gap: 8px; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item .pair-lbl { white-space: nowrap; flex: 0 0 auto; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow { flex: 0 1 300px; min-width: 180px; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow .ctl { width: 100%; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow .ctl > .input { width: 100%; max-width: none; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target { flex: 0 0 auto; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.target .ctl { width: auto; }
.pub-card .flow-group .set-fields .set-field.sec { display: block; padding: 11px 0 2px; border: 0; }
.pub-card .flow-group .set-fields .set-field.sec:first-child { padding-top: 2px; }
.pub-card .flow-group .set-fields .set-field .lbl { margin: 0; min-width: 0; }
.pub-card .flow-group .set-fields .set-field .lbl span { font-size: 12.5px; font-weight: 400; color: #5b6573; line-height: 1.4; }
.pub-card .flow-group .set-fields .set-field .ctl {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; width: 100%; min-width: 0; flex-wrap: nowrap;
}
.pub-card .flow-group .set-fields .set-field .ctl > .input, .pub-card .flow-group .set-fields .set-field .ctl > .select { width: 100%; max-width: 460px; height: 30px; font-size: 12px; }
.pub-card .flow-group .set-fields .set-field.wide { grid-column: 1 / -1; }
.pub-card .flow-group .set-fields .set-field.wide .rx-test { width: 100%; }
.pub-card .flow-group .set-fields .set-field.wide .rx-test .input { max-width: none; flex: 1 1 auto; }
.pub-card .flow-group .set-fields .set-field .pick-row { display: flex; flex-wrap: nowrap; justify-content: flex-end; gap: 6px; max-width: none; overflow-x: auto; scrollbar-width: thin; }
.pub-card .flow-group .set-fields .set-field .cat-chip { flex: 0 0 auto; }
.pub-card .flow-group .sec-ttl { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--muted-2); letter-spacing: .06em; }
.pub-card .flow-group .sec-ttl::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: var(--muted-2); flex: 0 0 auto; }
.pub-card .target-pick {
  display: inline-flex; align-items: center; gap: 10px;
  min-height: 28px; max-width: 100%; padding: 0;
  border: 0; border-radius: 0; background: transparent;
}
.pub-card .target-pick.empty { border: 0; background: transparent; }
.pub-card .target-pick .tp-link { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #cbd0d8; }
.pub-card .target-pick .tp-link.empty { font-weight: 400; color: var(--muted); text-decoration: none; }
.pub-card .target-pick .tp-change-text { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; flex: 0 0 auto; }
.pub-card .target-pick .tp-change-text:hover { text-decoration: underline; }
.pub-card :deep(.target-pick .tp-link) { font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: #cbd0d8; }
.pub-card :deep(.target-pick .tp-link.empty) { font-weight: 400; color: var(--muted); text-decoration: none; }
.pub-card :deep(.target-pick .tp-change-text) { border: 0 !important; background: none !important; padding: 0 !important; color: var(--accent); font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; flex: 0 0 auto; min-width: 0; }
.pub-card :deep(.target-pick .tp-change-text:hover) { text-decoration: underline; }
@media (max-width: 760px) {
.pub-card .flow-group .set-fields .set-field, .pub-card .flow-group .set-fields .set-field.pick { grid-template-columns: 1fr; gap: 4px; }
.pub-card .flow-group .set-fields .set-field .ctl { justify-content: flex-start; flex-wrap: wrap; }
.pub-card .flow-group .set-fields .set-field .ctl > .input, .pub-card .flow-group .set-fields .set-field .ctl > .select { max-width: none; }
.pub-card .flow-group .set-fields .set-field .pick-row { flex-wrap: wrap; justify-content: flex-start; overflow-x: visible; }
.pub-card .target-pick { width: 100%; }
.pub-card .target-pick .tp-info { flex-wrap: wrap; }
.pub-card .flow-group .set-fields .set-field.pair { flex-direction: row !important; align-items: center; flex-wrap: wrap; gap: 8px 14px; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item { width: auto !important; flex: 0 0 auto !important; }
.pub-card .flow-group .set-fields .set-field.pair .pair-item.grow { flex: 1 1 100% !important; min-width: 0; }
}
</style>
