/* 送审：流程规则 + 禁转/限转 + 查重，路由与调度器共用。 */
const match = require('./match');
const marksMod = require('./marks');
const meta = require('../../../meta');
const { tx } = require('../../infra/db');
const { typeOf, selectedTypesOf } = require('../crawl/category');
const makePresets = require('../presets/store');
const log = require('../../infra/log');

function flowRules(sets, rx) {
  /* 只读 ② 初筛卡（fetch[1]），不跨区域借发布/查重卡的规则 */
  const groups = sets && Array.isArray(sets.fetch) ? sets.fetch : [];
  const group = Array.isArray(groups[1]) ? groups[1] : [];
  const byTitle = {};
  group.forEach(function (r) { if (r && r.t && byTitle[r.t] === undefined) byTitle[r.t] = r; });
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
  const { db, one, all, jparse, DATA_DIR } = ctx;
  const siteStore = require('../sites/store')(ctx.DATA_DIR);
  const presets = makePresets(ctx.DATA_DIR);
  const now = () => new Date().toISOString();
  const b = opts || {};
  const limit = Math.max(1, Math.min(Number(b.limit) || 50, 200));
  const host = String(b.host || '').toLowerCase();
  const flowRow = one("SELECT v FROM meta WHERE k = 'flow'");
  const flow = JSON.parse(flowRow ? flowRow.v : 'null') || {};
  const rx = flow.rx || {};
  const rules = flowRules(flow.sets || {}, rx);

  const norm = (s2) => String(s2 || '').toLowerCase().replace(/[\s\-_.]+/g, '');
  /* 来源站已停用的词条不再送审，避免发布时去抓停用站的种子 */
  const siteOn = {};
  siteStore.list().forEach(function (s) {
    siteOn[String(s.host).toLowerCase()] = s.settings.enabled !== false && s.settings.hidden !== true;
  });
  /* 跨站同片策略：同 infohash / 规范化标题只保留最早一条，后来者记 dupeOf 方便追溯 */
  const seenTitles = new Map();
  const seenHashes = new Map();
  all('SELECT id, title, data FROM queue').forEach(function (r) {
    seenTitles.set(norm(r.title), r.id);
    const it = jparse(r.data) || {};
    if (it.infohash) seenHashes.set(String(it.infohash).toLowerCase(), r.id);
  });
  all('SELECT id, data FROM published').forEach(function (r) {
    const it = jparse(r.data) || {};
    seenTitles.set(norm(it.title), r.id);
    if (it.infohash) seenHashes.set(String(it.infohash).toLowerCase(), r.id);
  });

  const wantTypes = selectedTypesOf(flow);
  function catInfo(it) {
    const raw = String(it.catName || it.category || it.cat || '').trim();
    let label = raw;
    let type = typeOf(raw);
    if ((!type || /^\d+$/.test(raw)) && it.site) {
      try {
        const rec = siteStore.get(it.site);
        if (rec) {
          const cats = rec.search.cats || {};
          const hit = Object.keys(cats).filter(function (k) { return (cats[k] || []).map(String).indexOf(raw) >= 0; })[0];
          if (hit) { label = presets.labelOf(hit) || hit; type = typeOf(hit); }
        }
      } catch (e) { log.warn('screen.site-store', e); }
    }
    return { label: label && !/^\d+$/.test(label) ? label : '', type: type || '' };
  }

  /* 新入库优先，避免前 500 条老数据全是跳过项时，新条目永远轮不到 */
  const rows = host
    ? all("SELECT id, site, data FROM catalog WHERE status = 'new' AND site = ? ORDER BY created_at DESC, rowid DESC LIMIT 500", host)
    : all("SELECT id, site, data FROM catalog WHERE status = 'new' ORDER BY created_at DESC, rowid DESC LIMIT 500");
  let checked = 0, selected = 0, skipped = 0;
  const byReason = {};
  const selectedIds = [];
  const maxRow = one("SELECT MAX(CAST(SUBSTR(id, 3) AS INTEGER)) AS m FROM queue WHERE id LIKE 'q_%'");
  let seq = Number(maxRow && maxRow.m) || 0;

  for (const r of rows) {
    if (selected >= limit) break;
    if (host && String(r.site || '').toLowerCase() !== host) continue;
    const it = jparse(r.data) || {};
    checked++;
    const title = String(it.title || '');
    const parsed = meta.parseRelease(title);
    const ci = catInfo(it);
    const detailText = [title, it.tags, it.subtitle, it.descr, it.intro].filter(Boolean).join(' ');
    const res = String(it.res || '').toLowerCase() || match.resOf(title);
    const bytes = Number(it.sizeBytes) || match.sizeBytesOf(it) || 0;
    let reason = marksMod.complianceReason(it, Date.now());
    if (!reason && wantTypes.length && ci.type && wantTypes.indexOf(ci.type) < 0) reason = '类型不符 ' + ci.type;
    /* 数字分类又没映射：不能当成未知类型放行，否则 413 之类会绕过闸门 */
    if (!reason && wantTypes.length && !ci.type && /^\d+$/.test(String(it.catName || it.cat || '').trim())) {
      reason = '类型未知 ' + String(it.catName || it.cat).trim();
    }
    if (!reason && it.site && siteOn[String(it.site).toLowerCase()] === false) reason = '来源站已停用';
    else if (!reason && hit(rx.deny, title)) reason = '命中排除规则';
    else if (rules.res.length && res && rules.res.indexOf(res) < 0) reason = '分辨率不符 ' + res;
    else if (rules.minSizeGB && bytes && bytes < rules.minSizeGB * 1073741824) reason = '体积偏小';
    else if (rules.maxSizeGB && bytes && bytes > rules.maxSizeGB * 1073741824) reason = '体积偏大';
    else if (rules.requireChinese && !/中字|简繁|双语|国语|chs|cht|chinese/i.test(detailText)) reason = '没有中字';
    else if (seenTitles.has(norm(title))) reason = '已有同片';
    else if (it.infohash && seenHashes.has(String(it.infohash).toLowerCase())) reason = '已有同片';

    if (reason) {
      const next = Object.assign({}, it, { status: 'skipped', skippedAt: now(), skipReason: reason });
      if (reason === '已有同片') {
        next.dupeOf = (it.infohash && seenHashes.get(String(it.infohash).toLowerCase())) || seenTitles.get(norm(title)) || '';
      }
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
      cat: String(ci.label || it.catName || parsed.catName || it.category || parsed.category || '').slice(0, 60),
      catName: String(ci.label || it.catName || parsed.catName || '').slice(0, 60),
      catId: String(it.cat || '').slice(0, 20),
      category: String(it.category || parsed.category || '').slice(0, 40),
      res: it.res || '', size: it.size || '', site: it.site || '', infohash: it.infohash || '', catalogId: r.id,
      downloadUrl: it.downloadUrl || '', detailsUrl: String(it.detailsUrl || '').slice(0, 300), siteId: it.siteId || '',
      subtitle: String(it.subtitle || '').slice(0, 300), cn: cnOf(it.subtitle),
      year: it.year || match.yearOf(title) || '', category: it.category || '',
      region: String(it.region || '').slice(0, 60), language: String(it.language || '').slice(0, 60),
      bdinfo: String(it.bdinfo || '').slice(0, 60000), mediainfo: String(it.mediainfo || '').slice(0, 60000),
      medium: String(it.medium || '').slice(0, 60), fullDisc: it.fullDisc === true,
      intro: String(it.descrBb || it.intro || it.descr || '').slice(0, 60000),
      descrBb: String(it.descrBb || '').slice(0, 60000),
      descr: String(it.descr || '').slice(0, 4000),
      tags: tagListOf(it.tags) };
    tx(db, function () {
      db.prepare('INSERT INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)')
        .run(item.id, 'pending', title, JSON.stringify(item), item.createdAt, now());
      const next = Object.assign({}, it, { status: 'selected' });
      db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), 'selected', now(), r.id);
    });
    seenTitles.set(norm(title), item.id);
    if (it.infohash) seenHashes.set(String(it.infohash).toLowerCase(), item.id);
    selectedIds.push(item.id);
    selected++;
  }
  return { checked: checked, selected: selected, skipped: skipped, byReason: byReason, rules: rules, selectedIds: selectedIds };
}

module.exports = { flowRules, hit, screenCatalog };
