/* 词条库：第一步抓取的结果落在这里。
   一条词条 = 某站某条种子在「还没筛选/发布」时的快照，只存文本字段，不存种子文件。
   抓取标记（禁转/独占/DIY/限转/未满 7 天）只做标记，不影响入库——是否跳过交给第二步筛选。 */
const fs = require('fs');
const path = require('path');

const STATUSES = ['new', 'selected', 'archived', 'published', 'skipped'];
const MARKS = ['noRedistribute', 'exclusive', 'diy', 'limited', 'limitedDays'];
const FIELDS = ['site', 'siteId', 'title', 'subtitle', 'size', 'res', 'cat', 'catName', 'infohash', 'detailsUrl', 'downloadUrl', 'seeders', 'leechers'];

function createStore(file) {
  function read() {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { seq: Number(raw && raw.seq) || 0, items: Array.isArray(raw && raw.items) ? raw.items : [] };
    } catch (e) {
      return { seq: 0, items: [] };
    }
  }
  function write(store) {
    fs.writeFileSync(file, JSON.stringify({ updatedAt: new Date().toISOString(), seq: store.seq, items: store.items }, null, 0), { mode: 0o600 });
  }
  function clean(x) {
    const out = {};
    FIELDS.forEach(function (k) {
      if (x[k] === undefined || x[k] === null) return;
      out[k] = typeof x[k] === 'number' ? x[k] : String(x[k]).slice(0, 300);
    });
    if (x.sizeBytes) out.sizeBytes = Math.max(0, Math.round(Number(x.sizeBytes) || 0));
    if (x.marks && typeof x.marks === 'object') {
      out.marks = {};
      MARKS.forEach(function (k) { if (x.marks[k]) out.marks[k] = x.marks[k] === true ? true : Number(x.marks[k]) || 0; });
    }
    return out;
  }
  /* 同一个站同一条种子（site+siteId 或 infohash）只留一条，重复导入就是更新 */
  function add(items) {
    const store = read();
    let added = 0, updated = 0, skipped = 0;
    (items || []).slice(0, 500).forEach(function (raw) {
      const it = clean(raw || {});
      if (!it.title || !String(it.title).trim()) { skipped++; return; }
      const key = it.infohash ? 'h:' + it.infohash : (it.site && it.siteId ? 's:' + it.site + ':' + it.siteId : '');
      const found = key ? store.items.filter(function (x) { return x._key === key; })[0] : null;
      if (found) {
        Object.keys(it).forEach(function (k) { found[k] = it[k]; });
        found.updatedAt = new Date().toISOString();
        updated++;
        return;
      }
      const item = Object.assign({ id: 'cat_' + String(++store.seq).padStart(6, '0'), _key: key, status: 'new',
        marks: it.marks || {}, createdAt: new Date().toISOString() }, it);
      store.items.push(item);
      added++;
    });
    if (store.items.length > 20000) store.items.splice(0, store.items.length - 20000);
    write(store);
    return { added: added, updated: updated, skipped: skipped, total: store.items.length };
  }
  function list(opts) {
    const store = read();
    const q = String((opts && opts.q) || '').toLowerCase();
    const status = String((opts && opts.status) || '');
    const site = String((opts && opts.site) || '').trim().toLowerCase();
    let items = store.items.filter(function (x) {
      if (status && x.status !== status) return false;
      if (site && String(x.site || '').toLowerCase() !== site) return false;
      if (q && String(x.title || '').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    const byStatus = {};
    STATUSES.forEach(function (s) { byStatus[s] = 0; });
    store.items.forEach(function (x) { if (!site || String(x.site || '').toLowerCase() === site) byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
    const limit = Math.max(1, Math.min(500, Number((opts && opts.limit) || 50)));
    const offset = Math.max(0, Number((opts && opts.offset) || 0));
    /* 新抓的排前面：列表按入库时间倒序 */
    items = items.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
    return { total: store.items.length, matched: items.length, byStatus: byStatus,
      items: items.slice(offset, offset + limit).map(function (x) { const c = Object.assign({}, x); delete c._key; return c; }) };
  }
  function setStatus(id, status) {
    if (STATUSES.indexOf(status) < 0) return { err: 'status 只能是 ' + STATUSES.join(' / ') };
    const store = read();
    const it = store.items.filter(function (x) { return x.id === id; })[0];
    if (!it) return { err: '词条不存在' };
    it.status = status;
    it.updatedAt = new Date().toISOString();
    write(store);
    const c = Object.assign({}, it); delete c._key;
    return { item: c };
  }
  function setMarks(id, marks) {
    const store = read();
    const it = store.items.filter(function (x) { return x.id === id; })[0];
    if (!it) return { err: '词条不存在' };
    const next = {};
    MARKS.forEach(function (k) {
      const v = marks && marks[k];
      if (v === true || v === 1) next[k] = true;
      else if (typeof v === 'number' && v > 0) next[k] = v;
    });
    it.marks = next;
    it.updatedAt = new Date().toISOString();
    write(store);
    const c = Object.assign({}, it); delete c._key;
    return { item: c };
  }
  function remove(id) {
    const store = read();
    const i = store.items.findIndex(function (x) { return x.id === id; });
    if (i < 0) return { err: '词条不存在' };
    store.items.splice(i, 1);
    write(store);
    return { ok: true };
  }
  function summary() {
    const store = read();
    const byStatus = {};
    STATUSES.forEach(function (s) { byStatus[s] = 0; });
    store.items.forEach(function (x) { byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
    return { total: store.items.length, byStatus: byStatus };
  }
  return { add: add, list: list, setStatus: setStatus, setMarks: setMarks, remove: remove, summary: summary, STATUSES: STATUSES, MARKS: MARKS };
}

module.exports = { createStore: createStore, STATUSES: STATUSES, MARKS: MARKS };
