<template>
  <Teleport to="body">
    <div v-if="bulkOpen" class="modal-mask" id="site-bulk-modal">
      <div class="modal wide">
        <div class="modal-head">
          <h2>批量设置</h2>
          <button class="btn ghost slim" type="button" @click="emit('close-bulk')">关闭</button>
        </div>
        <p class="modal-sub">只改你选过的项，其余保持原样；应用到已选的 <b>{{ picksCount }}</b> 个站点。</p>
        <div class="modal-scroll">
          <div class="sd-field"><span>覆盖全局抓取</span>
            <select v-model="bulkForm.ovr" class="select"><option value="keep">不改</option><option value="on">开启</option><option value="off">关闭</option></select></div>
          <div class="sd-field"><span>抓取间隔</span>
            <select v-model="bulkForm.iv" class="select"><option value="keep">不改</option><option value="">抓完全部</option><option value="1">1 分钟</option><option value="5">5 分钟</option><option value="15">15 分钟</option><option value="60">1 小时</option></select></div>
          <div class="sd-field"><span>抓详情页</span>
            <select v-model="bulkForm.det" class="select"><option value="keep">不改</option><option value="on">开启</option><option value="off">关闭</option></select></div>
          <div class="sd-field"><span>站点优先级</span>
            <select v-model="bulkForm.prio" class="select"><option value="keep">不改</option><option value="high">高（先抓）</option><option value="normal">普通</option><option value="low">低（最后抓）</option></select></div>
        </div>
        <div class="modal-foot">
          <button class="btn ghost slim" type="button" @click="emit('close-bulk')">取消</button>
          <button class="btn primary slim" type="button" :disabled="busyBulk" @click="emit('apply-bulk')">{{ busyBulk ? '应用中…' : '应用到已选' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
  <Teleport to="body">
    <div v-if="addOpen" class="modal-mask" id="site-add-modal">
      <div class="modal">
        <div class="modal-head">
          <h2>添加站点</h2>
          <button class="btn ghost slim" type="button" @click="emit('close-add')">关闭</button>
        </div>
        <label class="field"><span>站点地址</span>
          <input v-model="addForm.url" class="input" placeholder="https://example.org/index.php" autocomplete="off"></label>
        <label class="field"><span>架构</span>
          <select v-model="addForm.arch" class="select">
            <option value="?">未确认</option>
            <option value="NP">NexusPHP</option>
            <option value="UNIT3D">UNIT3D</option>
            <option value="GZ">Gazelle</option>
            <option value="OTHER">其它</option>
          </select></label>
        <label class="field"><span>名称（可选）</span>
          <input v-model="addForm.title" class="input" placeholder="留空就用域名"></label>
        <div class="modal-foot">
          <button class="btn ghost slim" type="button" @click="emit('close-add')">取消</button>
          <button class="btn primary slim" type="button" @click="emit('add')">添加</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  bulkOpen: Boolean,
  picksCount: { type: Number, default: 0 },
  bulkForm: { type: Object, required: true },
  busyBulk: Boolean,
  addOpen: Boolean,
  addForm: { type: Object, required: true }
})
const emit = defineEmits(['close-bulk', 'apply-bulk', 'close-add', 'add'])
</script>

<style scoped>
.sd-field { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 0; font-size: 12.5px; color: var(--muted); }
.sd-field + .sd-field { border-top: 1px solid #f5f6f8; }
.sd-field .input, .sd-field .select { width: 230px; height: 32px; font-size: 12.5px; }
.modal-scroll { max-height: 46vh; overflow-y: auto; margin-top: 8px; padding-right: 6px; }
.modal-scroll::-webkit-scrollbar { width: 8px; }
.modal-scroll::-webkit-scrollbar-thumb { background: #e3e6ec; border-radius: 99px; border: 2px solid #fff; }
.modal-scroll .sd-field .input, .modal-scroll .sd-field .select { width: 200px; height: 32px; font-size: 12.5px; }
</style>
