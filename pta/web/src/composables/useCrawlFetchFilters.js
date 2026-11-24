import { computed } from 'vue'

export function useCrawlFetchFilters(opts) {
  const rules = opts.rules
  const sourceHost = opts.sourceHost
  const toast = opts.toast
  const getJson = opts.getJson

  const typeRow = computed(() => ((rules.fetch[0] && rules.fetch[0].rows) || []).find(r => r.t === '类型'))

async function loadTypes() {
  const row = typeRow.value
  if (!row) return
  if (!sourceHost.value) { row.sel = []; return }
  const j = await getJson('/api/crawl/types/' + encodeURIComponent(sourceHost.value))
  row.sel = (j && j.ok && j.data && j.data.types) || []
  await loadFilters()
}

/* 保存的是全局 key，界面显示中文；来源站切换时把已保存的选项勾回来 */
async function loadFilters() {
  if (!sourceHost.value) return
  const j = await getJson('/api/crawl/filters/' + encodeURIComponent(sourceHost.value))
  const labels = (j && j.ok && j.data && j.data.selectedLabels) || {}
  const vals = (j && j.ok && j.data && j.data.filters && j.data.filters.values) || {}
  const rows = (rules.fetch[0] && rules.fetch[0].rows) || []
  const byName = { '媒介': 'medium', '编码': 'codec', '音频编码': 'audio', '分辨率': 'resolution', '制作组': 'team', '优惠': 'discount' }
  const MEDIA_MERGE = ['原盘(Full Disc)', 'UHD 原盘', '3D 原盘', 'Blu-ray', 'full_disc', 'uhd_full_disc', '3d_full_disc', 'bluray']
  Object.keys(byName).forEach(name => {
    const r = rows.find(x => x.t === name)
    if (!r) return
    r.sel = labels[byName[name]] || []
    if (name === '媒介') {
      const seen = []
      r.sel = r.sel.map(function (x) { return MEDIA_MERGE.indexOf(x) >= 0 ? 'Blu-ray' : x; }).filter(function (x) { if (seen.indexOf(x) >= 0) return false; seen.push(x); return true; })
    }
    if (name === '制作组') r.chips = Object.keys(vals.team || {})
  })
}

async function saveTypes() {
  const row = typeRow.value
  if (!row) return { ok: true }
  if (!sourceHost.value) {
    if ((row.sel || []).length) { toast('先选来源站：类型是按站保存的'); return { ok: false, error: 'NO_SOURCE' } }
    return { ok: true }
  }
  try {
    const r = await fetch('/api/crawl/types/' + encodeURIComponent(sourceHost.value), {
      method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ types: row.sel || [] })
    })
    const j = await r.json().catch(() => null)
    const unmatched = (j && j.ok && j.data && j.data.unmatched) || []
    if (unmatched.length) toast('这些类型没匹配到本站分类：' + unmatched.join(' / '))
    else if (!(row.sel || []).length) toast('类型已清空：本站会按全部分类抓')
    return { ok: !!(r.ok && j && j.ok), error: j && j.error && j.error.message }
  } catch (e) { toast('类型请求发不出去'); return { ok: false, error: 'NETWORK' } }
}

async function saveFilters() {
  if (!sourceHost.value) return { ok: false, error: 'NO_SOURCE' }
  try {
  const get = (t) => {
    const r = ((rules.fetch[0] && rules.fetch[0].rows) || []).find(x => x.t === t)
    return (r && r.sel) || []
  }
  const body = { selected: { medium: get('媒介'), codec: get('编码'), audio: get('音频编码'), resolution: get('分辨率'), team: get('制作组'), discount: get('优惠') } }
  const r = await fetch('/api/crawl/filters/' + encodeURIComponent(sourceHost.value), {
    method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const j = await r.json().catch(() => null)
  const vals = (j && j.ok && j.data && j.data.filters && j.data.filters.values) || {}
  const missing = Object.keys(body.selected).filter(k => body.selected[k].length && !Object.keys(vals[k] || {}).length)
  if (missing.length) toast('本站搜索页没有这些选项：' + missing.join('/'))
  return { ok: !!(r.ok && j && j.ok), error: j && j.error && j.error.message }
  } catch (e) { toast('过滤条件请求发不出去'); return { ok: false, error: 'NETWORK' } }
}

  return { typeRow, loadTypes, loadFilters, saveTypes, saveFilters };
}
