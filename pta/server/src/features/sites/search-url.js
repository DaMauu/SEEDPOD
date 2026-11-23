/* 拼站点搜索 URL：分类参数 + 已选筛选参数。抓取和站点页预览共用。 */
const adapters = require('../../infra/adapters');

function buildSiteSearchUrl(site, ids, q, presets) {
  const s = site || {};
  const search = s.search || { path: s.searchPath, params: s.params, catMode: s.catMode, filters: s.filters };
  const url0 = adapters.buildSearchUrl({
    base: (s.url && s.url.base) || s.base || '',
    searchPath: search.path,
    params: search.params,
    catMode: search.catMode
  }, q == null ? '' : q, ids || []);
  const flt = search.filters || {};
  const vals = flt.values || {};
  const sel = flt.selected || {};
  const names = flt.params || {};
  const PARAM = { medium: 'medium', resolution: 'standard', discount: 'spstate' };
  try {
    const u = new URL(url0);
    Object.keys(PARAM).forEach(function (dim) {
      presets.expandDims(dim, sel[dim]).forEach(function (key) {
        const v = (vals[dim] || {})[key];
        if (v == null || v === '') return;
        const pv = names[dim];
        const pname = pv && typeof pv === 'object' && !Array.isArray(pv) ? (pv[key] || pv['*']) : pv;
        u.searchParams.append(pname || PARAM[dim], String(v));
      });
    });
    return u.toString();
  } catch (e) { return url0; }
}

module.exports = { buildSiteSearchUrl };
