/* 基础站点软删除：site-config-meta.hidden 存已从面板移除的 host。
   只隐藏、不删 sites 行；恢复时清掉标记，cookie 需重新导入。 */
const KEY = 'site-config-meta';

function norm(host) { return String(host || '').trim().toLowerCase(); }
function readMeta(db) {
  const row = db.prepare('SELECT v FROM meta WHERE k = ?').get(KEY);
  if (!row || !row.v) return {};
  try { const o = JSON.parse(row.v); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}
function writeMeta(db, meta) {
  db.prepare('INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    .run(KEY, JSON.stringify(meta || {}));
}
function list(db) {
  const meta = readMeta(db);
  const arr = Array.isArray(meta.hidden) ? meta.hidden : [];
  const seen = {};
  const out = [];
  arr.forEach(function (h) {
    const x = norm(h);
    if (!x || seen[x]) return;
    seen[x] = 1;
    out.push(x);
  });
  return out;
}
function has(db, host) {
  return list(db).indexOf(norm(host)) >= 0;
}
function add(db, host) {
  const x = norm(host);
  if (!x) return false;
  const meta = readMeta(db);
  const cur = list(db);
  if (cur.indexOf(x) >= 0) return false;
  meta.hidden = cur.concat([x]);
  writeMeta(db, meta);
  return true;
}
function remove(db, host) {
  const x = norm(host);
  const meta = readMeta(db);
  const cur = list(db);
  const next = cur.filter(function (h) { return h !== x; });
  if (next.length === cur.length) return false;
  meta.hidden = next;
  writeMeta(db, meta);
  return true;
}

module.exports = { list, has, add, remove, KEY };
