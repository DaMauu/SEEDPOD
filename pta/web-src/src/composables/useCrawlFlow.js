
export function useCrawlFlow(opts) {
  const rules = opts.rules
  const rx = opts.rx
  const limits = opts.limits
  const detail = opts.detail
  const autoDupe = opts.autoDupe
  const busy = opts.busy
  const toast = opts.toast
  const getJson = opts.getJson
  const putFlow = opts.putFlow
  const patchUser = opts.patchUser
  const saveTypes = opts.saveTypes
  const saveFilters = opts.saveFilters

function serialize(groups) {
  return (groups || []).map(g => (g.rows || []).map(r => ({ t: r.t, v: r.v, on: r.on, sel: r.sel })))
}

function migrateDedupeSwitches(saved) {
  if (!Array.isArray(saved)) return
  const rows = (rules.dedupe[0] && rules.dedupe[0].rows) || []
  saved.forEach(group => (group || []).forEach(v => {
    if (!v || v.v === undefined) return
    const r = rows.find(x => x.t === v.t)
    if (!r || r.type !== 'switch') return
    if (r.t === '目标站只有 DIY') r.on = v.v !== '跳过'
    else if (r.t === '禁转/限转处理') r.on = v.v !== '不检查'
    else if (r.t === '目标站已有原盘') r.on = true
  }))
}

function migratePubSwitches(saved) {
  if (!Array.isArray(saved)) return
  const rows = []
  ;(rules.pub || []).forEach(g => (g.rows || []).forEach(r => rows.push(r)))
  const byT = {}
  saved.forEach(group => (group || []).forEach(v => { if (v && v.t) byT[v.t] = v }))
  const set = (t, on) => { const r = rows.find(x => x.t === t); if (r && r.type === 'switch') r.on = !!on }
  if (byT['BDInfo'] && byT['BDInfo'].v !== undefined) set('BDInfo', String(byT['BDInfo'].v) !== '不要求')
  if (byT['截图至少几张'] && byT['截图至少几张'].v !== undefined) set('截图至少几张', Number(byT['截图至少几张'].v) > 0)
  if (byT['简介图片'] && byT['简介图片'].v !== undefined) set('简介图片', !/保留外链|不保留图片/.test(String(byT['简介图片'].v)))
  if (byT['允许联网补简介'] && byT['允许联网补简介'].on === false) set('简介回填', false)
}

function applySaved(groups, saved) {
  if (!Array.isArray(saved)) return
  const byT = {}
  saved.forEach(rows => { if (Array.isArray(rows)) rows.forEach(v => { if (v && v.t) byT[v.t] = v }) })
  const sameShape = saved.length === groups.length
  groups.forEach((g, gi) => (g.rows || []).forEach((r, ri) => {
    const v = byT[r.t] || (sameShape && Array.isArray(saved[gi]) ? saved[gi][ri] : null)
    if (!v) return
    if (v.v !== undefined) r.v = v.v
    if (v.on !== undefined) r.on = v.on
    if (v.sel) r.sel = v.sel
  }))
}

async function loadFlow() {
  const j = await getJson('/api/flow')
  if (j && j.ok) {
    const sets = j.data && j.data.sets
    if (sets) {
      applySaved(rules.fetch, sets.fetch)
      applySaved(rules.dedupe, sets.dedupe)
      migrateDedupeSwitches(sets.dedupe)
      applySaved(rules.pub, sets.pub)
      migratePubSwitches(sets.pub)
    }
    if (j.data && j.data.rx) {
      rx.deny = j.data.rx.deny || ''
    }
  }
  const c = await getJson('/api/config')
  if (c && c.ok) {
    const u = c.data.user || {}
    ;['interval', 'windowMinutes', 'maxPerWindow', 'breaker'].forEach(k => { if (u[k] != null) limits[k] = Number(u[k]) })
    if (u.detail != null) detail.value = !!u.detail
    if (u.autoDupe != null) autoDupe.value = !!u.autoDupe
  }
}

async function saveFetch() {
  if (busy.fetch) return
  busy.fetch = true
  try {
    const [a, b, c, d] = await Promise.all([
      patchUser({ listInterval: limits.listInterval, interval: limits.interval, windowMinutes: limits.windowMinutes, maxPerWindow: limits.maxPerWindow, breaker: limits.breaker, detail: !!detail.value }),
      putFlow({ fetch: serialize(rules.fetch) }, { deny: rx.deny }),
      saveTypes(),
      saveFilters()
    ])
    const bad = [a, b, c, d].find(j => !j || !j.ok)
    toast(bad ? ((bad && bad.error && bad.error.message) || '服务端拒绝了这次保存') : '抓取设置已保存')
  } catch (e) {
    toast('保存请求发不出去')
  } finally {
    busy.fetch = false
  }
}

async function saveScreen() {
  if (busy.dedupe) return
  busy.dedupe = true
  const [a, b] = await Promise.all([
    putFlow({ fetch: serialize(rules.fetch), dedupe: serialize(rules.dedupe) }, { deny: rx.deny }),
    patchUser({ autoDupe: !!autoDupe.value })
  ])
  busy.dedupe = false
  const bad = [a, b].find(j => !j || !j.ok)
  toast(bad ? ((bad && bad.error && bad.error.message) || '服务端拒绝了这次保存') : '初筛与查重已保存')
}

async function savePub() {
  if (busy.pub) return
  busy.pub = true
  const j = await putFlow({ pub: serialize(rules.pub) }, { deny: rx.deny })
  busy.pub = false
  toast(j && j.ok ? '发布设置已保存' : ((j && j.error && j.error.message) || '服务端拒绝了这次保存'))
}

async function toggleDetail() {
  detail.value = !detail.value
  const j = await patchUser({ detail: !!detail.value })
  toast(j && j.ok ? (detail.value ? '已开启抓详情页：每条多一次请求' : '已关闭抓详情页') : '开关没存上')
}

  return { loadFlow, saveFetch, saveScreen, savePub, toggleDetail };
}
