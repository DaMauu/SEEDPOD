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
}

async function saveTypes() {
  const row = typeRow.value
  if (!row || !sourceHost.value) return
  await fetch('/api/crawl/types/' + encodeURIComponent(sourceHost.value), {
    method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ types: row.sel || [] })
  })
}

async function saveFilters() {
  if (!sourceHost.value) return
  const get = (t) => {
    const r = ((rules.fetch[0] && rules.fetch[0].rows) || []).find(x => x.t === t)
    return (r && r.sel) || []
  }
  const body = { selected: { medium: get('媒介'), standard: get('分辨率'), spstate: get('优惠') } }
  const r = await fetch('/api/crawl/filters/' + encodeURIComponent(sourceHost.value), {
    method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const j = await r.json().catch(() => null)
  const vals = (j && j.ok && j.data && j.data.filters && j.data.filters.selectedValues) || {}
  const missing = Object.keys(body.selected).filter(k => body.selected[k].length && !(vals[k] || []).length)
  if (missing.length) toast('本站搜索页没有这些选项：' + missing.join('/'))
}

  return { typeRow, loadTypes, saveTypes, saveFilters };
}
