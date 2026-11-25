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
  const PARAM = { medium: 'medium', codec: 'codec', audio: 'audiocodec', resolution: 'standard', discount: 'spstate', team: 'team' };
  try {
    const u = new URL(url0);
    /* 同一参数只保留一个值；多选落到单选参数时（如 spstate）不拼，
       避免后一个值覆盖前一个，把“全选”变成只筛最后一项。 */
    const added = {};
    Object.keys(PARAM).forEach(function (dim) {
      presets.expandDims(dim, sel[dim]).forEach(function (key) {
        const v = (vals[dim] || {})[key];
        if (v == null || v === '') return;
        const pv = names[dim];
        const pname = pv && typeof pv === 'object' && !Array.isArray(pv) ? (pv[key] || pv['*']) : pv;
        const param = String(pname || PARAM[dim]);
        if (added[param] === '__skip__') return;
        if (added[param] != null) {
          if (added[param] !== String(v)) {
            u.searchParams.delete(param);
            added[param] = '__skip__';
          }
          return;
        }
        u.searchParams.append(param, String(v));
        added[param] = String(v);
      });
    });
    return u.toString();
  } catch (e) { return url0; }
}

module.exports = { buildSiteSearchUrl };
