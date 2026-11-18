import { reactive } from 'vue'
import { getJson } from '../utils/api'

export function useCrawlPlan(opts) {
  const sourceHost = opts.sourceHost
  const busy = opts.busy
  const toast = opts.toast
  const plan = reactive({ on: false, host: '', urls: [], warnings: [], dailyMax: 0, interval: 0, engine: '', catGroups: 0, catIds: 0, estimatedQueries: 0, today: '' })

async function showPlan() {
  if (!sourceHost.value) { toast('先在右上角「选来源站」里挑一个站'); return }
  if (busy.plan) return
  busy.plan = true
  const j = await getJson('/api/crawl/plan?host=' + encodeURIComponent(sourceHost.value))
  busy.plan = false
  if (!j || !j.ok) { toast((j && j.error && j.error.message) || '拿不到抓取计划'); return }
  const d = j.data || {}
  Object.assign(plan, {
    on: true, host: d.siteHost || sourceHost.value,
    urls: Array.isArray(d.searchUrls) ? d.searchUrls : [],
    warnings: Array.isArray(d.warnings) ? d.warnings : [],
    dailyMax: d.dailyMax || 0, interval: d.interval || 0, engine: d.engine || '',
    catGroups: d.catGroups || 0, catIds: d.catIds || 0, estimatedQueries: d.estimatedQueries || 0,
    today: '今日情况读取中…'
  })
  const s = await getJson('/api/crawl/status?host=' + encodeURIComponent(sourceHost.value))
  if (s && s.ok) {
    const x = s.data || {}
    const wait = Math.max(0, Math.round((x.waitMs || 0) / 1000))
    plan.today = '今天已抓 ' + (x.count || 0) + '/' + (x.dailyMax || 0) + ' 次' + (wait ? ' · 还要等 ' + wait + ' 秒' : ' · 现在可以抓') +
      ' · 上次 ' + (x.lastAt ? new Date(x.lastAt).toLocaleString('zh-CN', { hour12: false }).slice(5, 16) : '还没抓过')
  } else plan.today = ''
}

  return { plan: plan, showPlan: showPlan };
}
