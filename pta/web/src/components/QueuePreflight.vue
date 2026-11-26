<template>
  <section class="sd-card qd-preflight">
    <div class="qd-preflight-head">
      <h3>发布前检查</h3>
      <span class="badge" :class="preflight.ready ? (preflight.realPublish ? 'green' : 'amber') : 'amber'">{{ preflight.ready ? (preflight.realPublish ? '可提交' : '可演练') : '有缺项' }}</span>
    </div>
    <div class="qd-check-grid">
      <div class="qd-check-item"><span>目标站</span><b>{{ preflight.host }}</b></div>
      <div class="qd-check-item"><span>发布方式</span><b :class="preflight.realPublish ? 'qd-ok' : ''">{{ preflight.realPublish ? '真发布' : '演练，不会提交' }}</b></div>
      <div class="qd-check-item"><span>字段</span><b>{{ preflight.fieldCount == null ? '—' : preflight.fieldCount + ' 个' }}</b></div>
      <div class="qd-check-item"><span>分类</span><b>{{ preflight.labels.type || preflight.fields.type || '未映射' }}</b></div>
      <div class="qd-check-item"><span>制作组</span><b>{{ preflight.labels.team_sel || preflight.fields.team_sel || '未映射' }}</b></div>
      <div class="qd-check-item"><span>媒介</span><b>{{ preflight.labels.medium_sel || preflight.labels.source_sel || preflight.fields.medium_sel || preflight.fields.source_sel || '—' }}</b></div>
      <div class="qd-check-item"><span>目标站查重</span><b :class="preflight.dupe.state === 'exists' || preflight.dupe.state === 'error' ? 'qd-stage-err' : (preflight.dupe.state === 'passed' ? 'qd-ok' : '')">{{ preflight.dupe.label }}</b></div>
      <div v-if="preflight.retry" class="qd-check-item">
        <span>失败与重试</span>
        <b :class="preflight.retry.dead ? 'qd-stage-err' : ''">
          <template v-if="preflight.retry.dead">自动重试用完，需要重新排队 · 试了 {{ preflight.retry.attempts }} 次</template>
          <template v-else>待重试 · 试了 {{ preflight.retry.attempts }} 次<span v-if="preflight.retry.nextRetryAt"> · 下次 {{ stageTime(preflight.retry.nextRetryAt) }}</span></template>
        </b>
      </div>
      <div class="qd-check-item"><span>infohash</span><b v-if="preflight.torrent.hash">{{ preflight.torrent.hash.slice(0, 12) }}… <em v-if="preflight.checked" :class="preflight.hashUnchanged ? 'qd-ok' : 'qd-stage-err'">{{ preflight.hashUnchanged ? '清洗后不变' : '清洗后变了' }}</em><em v-else class="soft">清洗只换 announce，应不变</em></b><b v-else class="soft">先下载种子</b></div>
      <div class="qd-check-item"><span>种子</span><b>{{ preflight.torrent.name || '先下载种子' }}</b></div>
      <div class="qd-check-item"><span>Tracker</span><b>{{ preflight.trackerNote }}</b></div>
    </div>
    <div v-if="preflight.warnings && preflight.warnings.length" class="qd-warn">需处理：{{ preflight.warnings.join('；') }}</div>
  </section>
</template>

<script setup>
import { stageTime } from '../utils/format'
defineProps({ preflight: { type: Object, required: true } })
</script>

<style scoped>
/* 发布前检查：两列键值，不再散着一行 */
.qd-preflight { margin-top: 10px; padding: 10px 12px; }
.qd-preflight-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.qd-preflight-head h3 { margin: 0; font-size: 10px; letter-spacing: .6px; }
.qd-check-grid { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 5px 12px; align-items: baseline; }
.qd-check-item { display: contents; }
.qd-check-item > span { font-size: 11px; color: var(--muted-2); white-space: nowrap; text-align: right; }
.qd-check-item > b { min-width: 0; color: var(--ink); font-size: 11.5px; font-weight: 600; line-height: 1.45; overflow-wrap: anywhere; }
.qd-check-item em { font-style: normal; font-weight: 500; }
.qd-ok { color: var(--green); }
.qd-warn { margin-top: 6px; font-size: 11.5px; color: #b45309; line-height: 1.6; }
@media (max-width: 600px) {
  .qd-check-grid { grid-template-columns: 68px minmax(0, 1fr); }
}
</style>
