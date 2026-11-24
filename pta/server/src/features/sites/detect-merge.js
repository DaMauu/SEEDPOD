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
  const next = Object.assign({}, cur, { cats: cats, catMode: catMode, filters: filters });
  const changed = JSON.stringify({ cats: cur.cats || {}, catMode: cur.catMode || '', filters: cur.filters || {} })
    !== JSON.stringify({ cats: cats, catMode: catMode, filters: filters });
  return { search: next, changed: changed };
}

module.exports = { summarizeDetection, mergeDetection };
