/* 送审：流程规则 + 禁转/限转 + 查重，路由与调度器共用。 */
const match = require('./match');
const marksMod = require('./marks');
const flowConfig = require('./flow-config');

function flowRules(sets, rx) {
  const allRows = [];
  ['fetch', 'dedupe', 'pub'].forEach(function (k) {
    const arr = Array.isArray(sets[k]) ? sets[k] : [];
    arr.forEach(function (g) { if (Array.isArray(g)) g.forEach(function (r) { if (r) allRows.push(r); }); });
  });
  const byTitle = {};
  allRows.forEach(function (r) { if (r && r.t && byTitle[r.t] === undefined) byTitle[r.t] = r; });
  const pick = function (t) {
    return byTitle[t] || {};
  };
  const out = { res: [], minSizeGB: 0, maxSizeGB: 0, requireChinese: false };
  const rv = String(pick('分辨率要求').v || '');
  if (/2160|4k/i.test(rv)) out.res = ['2160p'];
  else if (/1080/.test(rv)) out.res = ['1080p', '2160p'];
  const lo = /([\d.]+)\s*GB/.exec(String(pick('体积范围').v || ''));
  if (lo) out.minSizeGB = Number(lo[1]) || 0;
  const hi = /([\d.]+)\s*GB/.exec(String(pick('最大体积').v || ''));
  if (hi) out.maxSizeGB = Number(hi[1]) || 0;
  out.requireChinese = !!pick('必须带中字').on;
  return out;
}

function hit(src, text) {
  if (!src) return false;
  try { return new RegExp(src, 'i').test(text); } catch (e) { return text.toLowerCase().indexOf(String(src).toLowerCase()) >= 0; }
}

/* 来源标签 "国语 粤语 中字" → 数组；副标题首段当中文名 */
function tagListOf(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,，、\/|]+|\s{2,}/);
  return list.map(function (x) { return String(x || '').trim(); })
    .filter(function (x) { return x && x.length <= 20; })
    .filter(function (x, i, a) { return a.indexOf(x) === i; })
    .slice(0, 20);
}
function cnOf(subtitle) {
  const s = String(subtitle || '').trim();
  if (!s) return '';
  const first = s.split(/[\/|｜【\[]/)[0].replace(/^[\s:：-]+|[\s:：-]+$/g, '').trim();
  return (first || s).slice(0, 60);
}

function screenCatalog(ctx, opts) {
  const { db, one, all, jparse } = ctx;
  const now = () => new Date().toISOString();
  const b = opts || {};
  const limit = Math.min(Number(b.limit) || 50, 200);
  const host = String(b.host || '').toLowerCase();
  const flowRow = one("SELECT v FROM meta WHERE k = 'flow'");
  const flow = JSON.parse(flowRow ? flowRow.v : 'null') || {};
  const rx = flow.rx || {};
  const rules = flowRules(flow.sets || {}, rx);
  rules.requireIntro = flowConfig.on(flowConfig.read(ctx), '必须有简介', false);

  const norm = (s2) => String(s2 || '').toLowerCase().replace(/[\s\-_.]+/g, '');
  const seenTitles = new Set();
  const seenHashes = new Set();
  all('SELECT title, data FROM queue').forEach(function (r) {
    seenTitles.add(norm(r.title));
    const it = jparse(r.data) || {};
    if (it.infohash) seenHashes.add(String(it.infohash).toLowerCase());
  });
  all('SELECT data FROM published').forEach(function (r) {
    const it = jparse(r.data) || {};
    seenTitles.add(norm(it.title));
    if (it.infohash) seenHashes.add(String(it.infohash).toLowerCase());
  });

  const rows = all("SELECT id, site, data FROM catalog WHERE status = 'new' LIMIT 500");
  let checked = 0, selected = 0, skipped = 0;
  const byReason = {};
  const n = (one('SELECT COUNT(*) AS n FROM queue') || { n: 0 }).n;
  let seq = n;

  for (const r of rows) {
    if (selected >= limit) break;
    if (host && String(r.site || '').toLowerCase() !== host) continue;
    const it = jparse(r.data) || {};
    checked++;
    const title = String(it.title || '');
    const detailText = [title, it.tags, it.subtitle, it.descr, it.intro].filter(Boolean).join(' ');
    const hasDetail = !!(it.tags || it.subtitle || it.descr || it.intro);
    const res = String(it.res || '').toLowerCase() || match.resOf(title);
    const bytes = Number(it.sizeBytes) || match.sizeBytesOf(it) || 0;
    let reason = marksMod.complianceReason(it, Date.now());
    if (!reason && hit(rx.deny, title)) reason = '命中排除规则';
    else if (rx.allow && !hit(rx.allow, title)) reason = '白名单未命中';
    else if (rules.res.length && res && rules.res.indexOf(res) < 0) reason = '分辨率不符 ' + res;
    else if (rules.minSizeGB && bytes && bytes < rules.minSizeGB * 1073741824) reason = '体积偏小';
    else if (rules.maxSizeGB && bytes && bytes > rules.maxSizeGB * 1073741824) reason = '体积偏大';
    else if (rules.requireChinese && hasDetail && !/中字|简繁|双语|国语|chs|cht|chinese/i.test(detailText)) reason = '没有中字';
    else if (rules.requireIntro && !String(it.intro || it.descr || '').trim()) reason = '缺简介';
    else if (seenTitles.has(norm(title))) reason = '已有同片';
    else if (it.infohash && seenHashes.has(String(it.infohash).toLowerCase())) reason = '已有同片';

    if (reason) {
      const next = Object.assign({}, it, { status: 'skipped' });
      db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), 'skipped', now(), r.id);
      byReason[reason] = (byReason[reason] || 0) + 1;
      skipped++;
      continue;
    }
    let defaultTarget = '';
    try {
      const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
      const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
      defaultTarget = String(cfg.targetHost || '').toLowerCase();
    } catch (e) { defaultTarget = ''; }
    const item = { id: 'q_' + String(++seq).padStart(4, '0'), status: 'pending', createdAt: now(), title: title,
      targetSite: defaultTarget,
      res: it.res || '', size: it.size || '', site: it.site || '', infohash: it.infohash || '', catalogId: r.id,
      downloadUrl: it.downloadUrl || '', siteId: it.siteId || '',
      subtitle: String(it.subtitle || '').slice(0, 300), cn: cnOf(it.subtitle),
      year: it.year || '', category: it.category || '',
      intro: String(it.intro || it.descrBb || it.descr || '').slice(0, 20000),
      tags: tagListOf(it.tags) };
    db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
      .run(item.id, 'pending', title, JSON.stringify(item), item.createdAt, now());
    seenTitles.add(norm(title));
    if (it.infohash) seenHashes.add(String(it.infohash).toLowerCase());
    const next = Object.assign({}, it, { status: 'selected' });
    db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), 'selected', now(), r.id);
    selected++;
  }
  return { checked: checked, selected: selected, skipped: skipped, byReason: byReason, rules: rules };
}

module.exports = { flowRules, hit, screenCatalog };
