/* 搜索预设识别结果的合并：站点页识别和批量脚本共用一份，避免两套逻辑分叉。 */

function clone(x) { return JSON.parse(JSON.stringify(x || {})); }

function summarizeDetection(d) {
  const types = Object.keys((d && d.cats) || {});
  const idTypes = {};
  types.forEach(function (t) { ((d.cats[t]) || []).forEach(function (id) { const v = String(id); (idTypes[v] = idTypes[v] || []).push(t); }); });
  const ambiguous = Object.keys(idTypes).filter(function (id) { return idTypes[id].length > 1; });
  const dims = {};
  ['values', 'params', 'labels'].forEach(function (sec) {
    dims[sec] = Object.keys((d && d[sec]) || {});
  });
  const confidence = types.length && d && d.catMode ? 'high' : (types.length ? 'medium' : 'low');
  return {
    types: types,
    typeCount: types.reduce(function (n, k) { return n + ((d.cats[k] || []).length); }, 0),
    ambiguous: ambiguous,
    unmatched: Array.isArray(d && d.unmatched) ? d.unmatched : [],
    dims: dims,
    hasDims: Object.keys(dims.values).length > 0,
    confidence: confidence
  };
}

/* 默认只补缺失，不覆盖手工值；force 才替换分类和维度值。
   selected 永远保留，识别不替用户勾选。
   同一个站点 ID 被识别成多个大分类时跳过，避免把电影塞进有声书。 */
function mergeDetection(current, detected, opts) {
  const force = !!(opts && opts.force);
  const cur = current || {};
  const d = detected || {};
  const cats = (force && Object.keys(d.cats || {}).length) ? {} : clone(cur.cats || {});
  const idTypes = {};
  Object.keys(d.cats || {}).forEach(function (t) { (d.cats[t] || []).forEach(function (id) { const v = String(id); (idTypes[v] = idTypes[v] || []).push(t); }); });
  const existingTypes = {};
  Object.keys(cur.cats || {}).forEach(function (t) { (cur.cats[t] || []).forEach(function (id) { const v = String(id); (existingTypes[v] = existingTypes[v] || []).push(t); }); });
  Object.keys(d.cats || {}).forEach(function (k) {
    (d.cats[k] || []).forEach(function (id) {
      const v = String(id);
      if ((idTypes[v] || []).length > 1) return;
      if (existingTypes[v] && existingTypes[v].indexOf(k) < 0) return;
      const list = cats[k] || (cats[k] = []);
      if (list.indexOf(v) < 0) list.push(v);
    });
  });
  const filters = clone(cur.filters || {});
  ['values', 'params', 'labels'].forEach(function (sec) {
    filters[sec] = clone(filters[sec] || {});
    Object.keys(d[sec] || {}).forEach(function (dim) {
      filters[sec][dim] = force ? {} : (filters[sec][dim] || {});
      Object.keys(d[sec][dim] || {}).forEach(function (k) {
        filters[sec][dim][k] = String(d[sec][dim][k]);
      });
    });
  });
  filters.selected = clone((cur.filters && cur.filters.selected) || {});
  let catMode = cur.catMode || 'single';
  if (d.catMode && (force || !cur.catMode || cur.catMode === 'single')) catMode = d.catMode;
  /* 保存站点原文标签，界面上「401,404」才不会看起来像重复 ID。 */
  const labelMap = Object.assign({}, cur.catLabels || {}, d.catLabels || {});
  const idSet = {};
  Object.keys(cats).forEach(function (t) { (cats[t] || []).forEach(function (id) { idSet[String(id)] = true; }); });
  const catLabels = {};
  Object.keys(labelMap).forEach(function (id) { if (idSet[String(id)]) catLabels[String(id)] = String(labelMap[id] || ''); });
  const next = Object.assign({}, cur, { cats: cats, catLabels: catLabels, catMode: catMode, filters: filters });
  const changed = JSON.stringify({ cats: cur.cats || {}, catLabels: cur.catLabels || {}, catMode: cur.catMode || '', filters: cur.filters || {} })
    !== JSON.stringify({ cats: cats, catLabels: catLabels, catMode: catMode, filters: filters });
  return { search: next, changed: changed };
}

/* 站点级识别覆盖：skip 跳过分类 ID；map 把标签或 ID 固定到某个大分类；engine 强制架构。
   只改识别结果，不改站点里的其他配置。 */
function applyOverrides(detected, overrides, opts) {
  const d = clone(detected || {});
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  const keyOf = (opts && opts.keyOf) || function (x) { return String(x || ''); };
  const skip = (Array.isArray(o.skip) ? o.skip : []).map(String);
  const skipSet = {};
  skip.forEach(function (id) { skipSet[id] = true; });
  d.cats = d.cats || {};
  Object.keys(d.cats).forEach(function (t) {
    d.cats[t] = (d.cats[t] || []).filter(function (id) { return !skipSet[String(id)]; });
    if (!d.cats[t].length) delete d.cats[t];
  });
  const map = o.map && typeof o.map === 'object' && !Array.isArray(o.map) ? o.map : {};
  Object.keys(map).forEach(function (k) {
    const target = keyOf(map[k]);
    if (!target) return;
    const ids = [];
    if (/^\d+$/.test(String(k))) ids.push(String(k));
    else Object.keys(d.catLabels || {}).forEach(function (id) { if (String(d.catLabels[id]) === String(k)) ids.push(String(id)); });
    ids.forEach(function (id) {
      Object.keys(d.cats).forEach(function (t) {
        d.cats[t] = (d.cats[t] || []).filter(function (x) { return String(x) !== id; });
        if (!d.cats[t].length) delete d.cats[t];
      });
      d.cats[target] = d.cats[target] || [];
      if (d.cats[target].indexOf(id) < 0) d.cats[target].push(id);
    });
  });
  if (o.engine) { d.engine = String(o.engine); d.engineConfidence = 1; }
  /* 分类被 skip/map 后，对应原文标签也一起清掉，避免界面显示不存在的 ID。 */
  const keep = {};
  Object.keys(d.cats).forEach(function (t) { (d.cats[t] || []).forEach(function (id) { keep[String(id)] = true; }); });
  const labels = {};
  Object.keys(d.catLabels || {}).forEach(function (id) { if (keep[String(id)]) labels[String(id)] = String(d.catLabels[id] || ''); });
  d.catLabels = labels;
  return d;
}

/* 识别前后分类差异：写之前告诉用户会新增/移除哪些 type。 */
function diffCats(current, next) {
  const a = current || {};
  const b = next || {};
  const types = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
  const added = [];
  const removed = [];
  types.forEach(function (t) {
    const oldIds = (a[t] || []).map(String);
    const newIds = (b[t] || []).map(String);
    const add = newIds.filter(function (id) { return oldIds.indexOf(id) < 0; });
    const rem = oldIds.filter(function (id) { return newIds.indexOf(id) < 0; });
    if (add.length) added.push({ type: t, ids: add });
    if (rem.length) removed.push({ type: t, ids: rem });
  });
  return { added: added, removed: removed };
}

/* 合并后再应用一次覆盖：skip/map 也要能清掉已保存的旧分类，而不是只清检测结果。 */
function mergeWithOverrides(current, detected, overrides, opts) {
  const d = applyOverrides(detected, overrides, opts);
  const merged = mergeDetection(current, d, { force: !!(opts && opts.force) });
  const cleaned = applyOverrides({ cats: merged.search.cats || {}, catLabels: Object.assign({}, merged.search.catLabels || {}, d.catLabels || {}) }, overrides, opts);
  merged.search.cats = cleaned.cats || {};
  merged.search.catLabels = cleaned.catLabels || {};
  if (JSON.stringify((current && current.cats) || {}) !== JSON.stringify(merged.search.cats)) merged.changed = true;
  return { merged: merged, detected: d };
}

module.exports = { summarizeDetection, mergeDetection, applyOverrides, mergeWithOverrides, diffCats };
