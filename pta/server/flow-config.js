/* 流程规则读取：把 meta.flow 里的 sets 摊平成 name -> row，供服务端判断。 */
function fromSets(sets) {
  const out = {};
  ['fetch', 'dedupe', 'pub'].forEach(function (k) {
    const groups = sets && Array.isArray(sets[k]) ? sets[k] : [];
    groups.forEach(function (g) {
      (Array.isArray(g) ? g : []).forEach(function (r) {
        if (r && r.t && out[r.t] === undefined) out[r.t] = r;
      });
    });
  });
  return out;
}
function read(ctx) {
  let flow = {};
  try {
    const row = ctx.one("SELECT v FROM meta WHERE k = 'flow'");
    flow = JSON.parse(row ? row.v : 'null') || {};
  } catch (e) { flow = {}; }
  return fromSets(flow.sets || {});
}
function on(map, name, def) {
  const r = map && map[name];
  if (!r) return !!def;
  return r.on !== false;
}
function value(map, name, def) {
  const r = map && map[name];
  return r && r.v !== undefined && r.v !== null ? r.v : def;
}
function number(map, name, def) {
  const raw = String(value(map, name, def));
  const n = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : Number(def) || 0;
}

module.exports = { read: read, fromSets: fromSets, on: on, value: value, number: number };
