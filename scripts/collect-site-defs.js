/* 把离线分析结果整理成「站点定义」（pta/data/site-defs/<host>.json）与「搜索预设」（pta/data/site-search.local.json）。
   输入只有 pta/data/analysis.json（由 scripts/analyze-samples.js 生成），不联网。
   已有人工确认的搜索预设不会被覆盖：只有 source 是 auto 的条目才会重写。
   用法：node scripts/collect-site-defs.js [--dry] */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'pta', 'data');
const OUT = path.join(DATA, 'site-defs');
const PRESETS = path.join(DATA, 'site-search.local.json');
const dry = process.argv.indexOf('--dry') > 0;

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

/* 分类标签 → 用途。中英文都认，顺序有意义：先匹配具体的，再落到 other */
const RULES = [
  ['anime', /(动漫|动画|番剧|剧场版|anime|animation)/i],
  ['doc', /(纪录|记录片|纪录片|documentar|docu\b)/i],
  ['music', /(音乐|无损|演唱会|mv\b|music|concert|audio|flac)/i],
  ['book', /(电子书|书籍|图书|杂志|资料|学习|book|ebook|comic|漫画)/i],
  ['game', /(游戏|game)/i],
  ['tv', /(剧集|电视剧|连续剧|美剧|英剧|日剧|韩剧|国产剧|综艺|tv|series|show)/i],
  ['movie', /(电影|影片|movie|film|blu-?ray|uhd|4k|remux)/i]
];
function purposeOf(label) {
  const s = String(label || '');
  for (const r of RULES) if (r[1].test(s)) return r[0];
  return 'other';
}

const DEFAULTS = {
  nexusphp: { searchPath: '/torrents.php', params: { search: '{q}', cat: '{cats}' }, catMode: 'single' },
  unit3d: { searchPath: '/torrents', params: { name: '{q}', 'categories[0]': '{cats}' }, catMode: 'multi' },
  gazelle: { searchPath: '/torrents.php', params: { searchstr: '{q}', 'filter_cat[1]': '{cats}' }, catMode: 'multi' }
};

const analysis = readJson(path.join(DATA, 'analysis.json'), null);
if (!analysis) { console.log('缺少 pta/data/analysis.json，先跑 node scripts/analyze-samples.js'); process.exit(1); }

const presets = readJson(PRESETS, { sites: {} });
presets.sites = presets.sites || {};

let defs = 0, presetsAdded = 0, noCats = 0, unknown = 0;
const now = new Date().toISOString();

fs.mkdirSync(OUT, { recursive: true });

Object.keys(analysis).sort().forEach(function (host) {
  const a = analysis[host];
  if (!a.engine) { unknown++; return; }
  const dflt = DEFAULTS[a.engine] || DEFAULTS.nexusphp;

  /* 分类：id → 用途 */
  const cats = {};
  const catMap = [];
  const ids = {};
  (a.catList || []).forEach(function (c) {
    if (ids[c.id]) return;
    ids[c.id] = 1;
    const p = purposeOf(c.label);
    (cats[p] = cats[p] || []).push(String(c.id));
    catMap.push({ id: String(c.id), label: c.label, purpose: p });
  });
  if (!catMap.length) noCats++;

  const params = a.params || dflt.params;
  const def = {
    host: host,
    base: 'https://' + host,
    engine: a.engine,
    login: a.engine === 'unit3d'
      ? { method: 'POST', path: '/login', fields: { username: 'username', password: 'password' } }
      : a.engine === 'gazelle'
        ? { method: 'POST', path: '/login.php', fields: { username: 'username', password: 'password' } }
        : { method: 'POST', path: '/takelogin.php', fields: { username: 'username', password: 'password' } },
    searchPath: (a.searchPath || dflt.searchPath),
    params: params,
    catMode: a.catMode || dflt.catMode,
    catSlot: a.catParam && /\[(\d+)\]/.test(a.catParam) ? Number(/\[(\d+)\]/.exec(a.catParam)[1]) : 1,
    cats: cats,
    catMap: catMap,
    rate: { minGapMs: 1200, jitterMs: 900, maxPerRun: 20 },
    source: { kind: 'sample', analyzedAt: a.analyzedAt || now, rows: a.rows, sizeRows: a.rowsWithSize, cats: catMap.length },
    note: a.rows ? ('采样解析：' + a.rows + ' 行，' + catMap.length + ' 个分类') : '采样页没有解析出列表，只有分类'
  };
  if (!dry) fs.writeFileSync(path.join(OUT, host + '.json'), JSON.stringify(def, null, 1), 'utf8');
  defs++;

  /* 搜索预设：只补自动生成的，人工确认过的（source 不是 auto）保持不动 */
  const cur = presets.sites[host];
  if (cur && cur.source && cur.source !== 'auto') return;
  if (!catMap.length && !a.params) return;                 /* 没分类也没参数，补了也没用 */
  presets.sites[host] = {
    engine: a.engine,
    searchPath: def.searchPath,
    browsePath: def.searchPath,
    params: params,
    catMode: def.catMode,
    cats: cats,
    source: 'auto',
    confirmed: false,
    updatedAt: now,
    note: '自动生成：' + (a.rows || 0) + ' 行样本，' + catMap.length + ' 个分类'
  };
  presetsAdded++;
});

if (!dry) {
  fs.writeFileSync(PRESETS, JSON.stringify(presets, null, 1), 'utf8');
}

console.log('站定义 ' + defs + ' 份（无分类 ' + noCats + '，引擎未识别 ' + unknown + '），' +
  '自动搜索预设 ' + presetsAdded + ' 条，预设文件共 ' + Object.keys(presets.sites).length + ' 条' + (dry ? '（dry run，未写盘）' : ''));
