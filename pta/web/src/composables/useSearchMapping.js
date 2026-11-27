import { computed, ref } from 'vue'

/* 搜索分类人工映射：未识别标签、冲突 ID 的本地选择，以及预览用的合并结果。 */
export function useSearchMapping(presetPreview, detectResult, runtimePresets) {
  const searchAlias = ref({})
  const searchAmbiguousType = ref({})

  const searchTypeChoices = computed(function () {
    const types = (runtimePresets.value && runtimePresets.value.types) || {}
    return Object.keys(types).map(function (key) { return { key: key, label: types[key] } })
  })
  function typeLabelOf(key) {
    const types = (runtimePresets.value && runtimePresets.value.types) || {}
    return types[key] || key
  }
  function searchCatLabel(id) {
    const labels = (presetPreview.value && presetPreview.value.labels) || {}
    return labels[String(id)] || String(id)
  }
  const searchAmbiguousIds = computed(function () {
    const r = detectResult.value
    const ids = (r && r.search && r.search.ambiguous) || []
    return ids.map(String)
  })
  const searchUnmatchedTypes = computed(function () {
    const list = (presetPreview.value && presetPreview.value.unmatched) || []
    return list.filter(function (x) { return x && x.dim === 'type' && x.label })
  })
  const pendingSearchUnmatched = computed(function () {
    return searchUnmatchedTypes.value.filter(function (x) { return !searchAlias.value[x.label] })
  })
  const pendingSearchAmbiguous = computed(function () {
    return searchAmbiguousIds.value.filter(function (id) { return !searchAmbiguousType.value[id] })
  })

  /* 预览里把人工选择的类型合并进来；保存时后端会用同一套覆盖重算。 */
  const effectiveSearchCats = computed(function () {
    const p = presetPreview.value
    const base = (p && p.cats) || {}
    const labels = (p && p.labels) || {}
    const out = {}
    Object.keys(base).forEach(function (k) {
      const list = (base[k] || []).map(String)
      if (list.length) out[k] = list
    })
    function removeId(id) {
      Object.keys(out).forEach(function (k) {
        out[k] = out[k].filter(function (x) { return x !== String(id) })
        if (!out[k].length) delete out[k]
      })
    }
    function addId(type, id) {
      if (!type || type === '__skip__') return
      const list = out[type] || (out[type] = [])
      if (list.indexOf(String(id)) < 0) list.push(String(id))
    }
    Object.keys(searchAlias.value).forEach(function (label) {
      const type = String(searchAlias.value[label] || '')
      if (!type) return
      Object.keys(labels).forEach(function (id) {
        if (String(labels[id]) !== String(label)) return
        removeId(id)
        addId(type, id)
      })
    })
    Object.keys(searchAmbiguousType.value).forEach(function (id) {
      const type = String(searchAmbiguousType.value[id] || '')
      if (!type) return
      removeId(id)
      addId(type, id)
    })
    return out
  })

  const previewGroups = computed(function () {
    const p = presetPreview.value
    if (!p) return []
    const labels = p.labels || {}
    const cats = effectiveSearchCats.value
    return Object.keys(cats).map(function (k) {
      return { key: k, name: typeLabelOf(k), ids: (cats[k] || []).map(function (id) { return id + (labels[id] ? ' ' + labels[id] : '') }).join('、') }
    })
  })
  const previewUnmatchedList = computed(function () {
    const list = (presetPreview.value && presetPreview.value.unmatched) || []
    return list.filter(function (x) { return !(x.dim === 'type' && searchAlias.value[x.label]) })
  })
  const previewUnmatchedGroups = computed(function () {
    const list = previewUnmatchedList.value
    const names = { type: '分类', medium: '媒介', resolution: '分辨率', codec: '编码', audio: '音频', discount: '优惠', team: '制作组', restriction: '限制' }
    const groups = {}
    list.forEach(function (x) { const d = names[x.dim] || x.dim || '其它'; (groups[d] = groups[d] || []).push(x.label) })
    return Object.keys(groups).map(function (d) { return { dim: d, labels: groups[d].join('、'), count: groups[d].length } })
  })
  const previewUnmatchedCount = computed(function () { return previewUnmatchedList.value.length })
  const previewUnmatchedSummary = computed(function () { return previewUnmatchedGroups.value.map(function (g) { return g.dim + ' ' + g.count }).join(' · ') })

  function searchDetectPayload(r) {
    const base = (r && r.search && r.search.search && r.search.search.detect) || {}
    const map = Object.assign({}, base.map || {})
    const skipSet = new Set((Array.isArray(base.skip) ? base.skip : []).map(String))
    Object.keys(searchAlias.value).forEach(function (label) {
      const type = String(searchAlias.value[label] || '')
      if (type) map[label] = type
      else delete map[label]
    })
    Object.keys(searchAmbiguousType.value).forEach(function (id) {
      const type = String(searchAmbiguousType.value[id] || '')
      if (!type) { delete map[id]; skipSet.delete(String(id)); return }
      if (type === '__skip__') { delete map[id]; skipSet.add(String(id)); return }
      map[id] = type
      skipSet.delete(String(id))
    })
    const detect = Object.assign({}, base)
    if (Object.keys(map).length) detect.map = map
    else delete detect.map
    if (skipSet.size) detect.skip = Array.from(skipSet)
    else delete detect.skip
    return detect
  }

  return {
    searchAlias: searchAlias,
    searchAmbiguousType: searchAmbiguousType,
    searchTypeChoices: searchTypeChoices,
    searchCatLabel: searchCatLabel,
    searchAmbiguousIds: searchAmbiguousIds,
    searchUnmatchedTypes: searchUnmatchedTypes,
    pendingSearchUnmatched: pendingSearchUnmatched,
    pendingSearchAmbiguous: pendingSearchAmbiguous,
    effectiveSearchCats: effectiveSearchCats,
    previewGroups: previewGroups,
    previewUnmatchedGroups: previewUnmatchedGroups,
    previewUnmatchedCount: previewUnmatchedCount,
    previewUnmatchedSummary: previewUnmatchedSummary,
    searchDetectPayload: searchDetectPayload
  }
}
