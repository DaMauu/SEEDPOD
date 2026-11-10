/* SEEDPOD 最小后端：静态面板 + 健康检查 + 配置读写 + 日志流。
   不引第三方依赖，Node 20+ 直接跑：node server/app.js
   环境变量：PTA_PORT(8080) PTA_DATA(./data) PTA_TOKEN(可选) PTA_WEB(./pta/web) */
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const path = require('path');

const PORT = Number(process.env.PTA_PORT || 8080);
const DATA_DIR = path.resolve(process.env.PTA_DATA || './data');
const WEB_DIR = path.resolve(process.env.PTA_WEB || './pta/web');
const TOKEN = process.env.PTA_TOKEN || '';
const PTA_USER = process.env.PTA_USER || '';
const PTA_PASS = process.env.PTA_PASS || '';
const VERSION = require('../package.json').version;
const adapters = require('./adapters');
const nexusphp = adapters.nexusphp;
const secretbox = require('./secretbox');
const match = require('./match');
const catalog = require('./catalog');
const KEYRING = secretbox.loadKey(DATA_DIR);
const STARTED = Date.now();

const LIMITS = {
  test: { interval: [30, 120], dailySite: [1, 300], dailyAll: [50, 2000] },
  prod: { interval: [8, 120], dailySite: [1, 300], dailyAll: [50, 2000] }
};
const DEFAULTS = { runMode: 'test', interval: 60, dailySite: 20, dailyAll: 100 };

fs.mkdirSync(DATA_DIR, { recursive: true });
const CFG_FILE = path.join(DATA_DIR, 'config.json');
const LOG_FILE = path.join(DATA_DIR, 'events.log');
const LOG_MAX = Math.max(1024, Number(process.env.PTA_LOG_MAX || 2 * 1024 * 1024) || 2 * 1024 * 1024);
let logBytes = 0;
try { logBytes = fs.statSync(LOG_FILE).size; } catch (e) { logBytes = 0; }

/* 日志超过上限就轮转一次，只保留上一份，避免无限增长 */
function rotateLogIfNeeded(nextLineBytes) {
  logBytes += nextLineBytes;
  if (logBytes <= LOG_MAX) return false;
  try {
    fs.renameSync(LOG_FILE, LOG_FILE + '.1');
  } catch (e) {
    try { fs.unlinkSync(LOG_FILE); } catch (e2) {}
  }
  logBytes = 0;
  return true;
}

/* ---------- 事件日志：写文件 + 内存环 + SSE 广播 ---------- */
let logSeq = 0;
const LOG_RING = [];
const SSE_CLIENTS = new Set();

function logEvent(level, src, msg) {
  const entry = { id: ++logSeq, ts: new Date().toISOString(), level, src, msg };
  LOG_RING.push(entry);
  if (LOG_RING.length > 500) LOG_RING.shift();
  const line = JSON.stringify(entry) + '\n';
  try { fs.appendFileSync(LOG_FILE, line); } catch (e) {}
  if (rotateLogIfNeeded(Buffer.byteLength(line))) {
    LOG_RING.push({ id: ++logSeq, ts: new Date().toISOString(), level: 'info', src: '日志', msg: '日志文件超过 ' + Math.round(LOG_MAX / 1024) + ' KB，已轮转为 events.log.1' });
  }
  const payload = 'id: ' + entry.id + '\ndata: ' + JSON.stringify(entry) + '\n\n';
  SSE_CLIENTS.forEach(function (res) {
    try { res.write(payload); } catch (e) { SSE_CLIENTS.delete(res); }
  });
  console.log('[' + level + '] ' + src + ' ' + msg);
  return entry;
}

function loadRecentLogs(limit) {
  try {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    const out = [];
    for (let i = Math.max(0, lines.length - limit); i < lines.length; i++) {
      try { out.push(JSON.parse(lines[i])); } catch (e) {}
    }
    if (out.length) logSeq = Math.max(logSeq, out[out.length - 1].id || 0);
    return out;
  } catch (e) { return []; }
}

/* ---------- 站点清单：从 assets/sites-data.local.js 读取，缺失则回退示例清单 ---------- */
function loadSiteList() {
  /* 真实站点清单只放在数据目录，绝不放进 web 根；老部署的 assets 位置只在本地开发兜底 */
  const files = [path.join(DATA_DIR, 'sites-data.local.js'), path.join(WEB_DIR, 'assets', 'sites-data.local.js')];
  const sandbox = { window: {} };
  try {
    let code = null;
    for (let i = 0; i < files.length && code === null; i++) {
      try { code = fs.readFileSync(files[i], 'utf8'); } catch (e) {}
    }
    if (code === null) return [];
    vm.runInNewContext(code, sandbox, { timeout: 1000 });
    const urls = (sandbox.window.SITE_URLS || []).slice();
    const arch = sandbox.window.PT_ARCH || {};
    const names = sandbox.window.PT_NAMES || {};
    const seen = {};
    return urls.map(function (u) {
      const host = String(u).replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
      return { host, url: u, arch: arch[host] || '?', title: names[host] || '' };
    }).filter(function (x) { return x.host && !seen[x.host] && (seen[x.host] = 1); });
  } catch (e) {
    return [];
  }
}

/* ---------- 站点配置：服务端持久化（密码 / cookie / totp 一律不落盘） ---------- */
const SITE_CFG_FILE = path.join(DATA_DIR, 'site-config.json');
const SITE_FIELDS = [
  'enabled', 'url', 'arch', 'tfa', 'interval', 'pages', 'concurrency', 'dupeCheck', 'note',
  'cats', 'fullDiscOnly', 'minRes', 'minSize', 'exclude', 'queueMode', 'window',
  'mode', 'stopAtKnown', 'fullCycle', 'trigger', 'dailyAt', 'everyMin',
  'timeWindow', 'winStart', 'winEnd', 'jitter', 'loginMethod', 'username'
];
const SITE_RANGES = { interval: [1, 1440], pages: [1, 20], concurrency: [1, 8], everyMin: [5, 1440], jitter: [0, 120] };
const SITE_SECRETS = ['password', 'cookie', 'totp'];

function readSiteCfg() {
  try {
    const raw = JSON.parse(fs.readFileSync(SITE_CFG_FILE, 'utf8'));
    return {
      sites: raw && raw.sites && typeof raw.sites === 'object' ? raw.sites : {},
      hidden: raw && Array.isArray(raw.hidden) ? raw.hidden : []
    };
  } catch (e) {
    return { sites: {}, hidden: [] };
  }
}
function writeSiteCfg(cfg) {
  try {
    fs.writeFileSync(SITE_CFG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入站点配置失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}
/* 只收白名单字段；秘密字段记录为 dropped，不返回内容也不写盘 */
function sanitizeSitePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { err: { code: 'BAD_REQUEST', message: '请求体不是合法 JSON 对象' } };
  }
  const patch = {}, dropped = [];
  SITE_SECRETS.forEach(function (k) {
    if (body[k] !== undefined && body[k] !== '' && body[k] !== null) dropped.push(k);
  });
  for (const k of SITE_FIELDS) {
    if (body[k] === undefined) continue;
    const v = body[k];
    if (SITE_RANGES[k]) {
      const n = Number(v);
      if (!Number.isInteger(n)) return { err: { code: 'BAD_REQUEST', message: k + ' 必须是整数' } };
      const lo = SITE_RANGES[k][0], hi = SITE_RANGES[k][1];
      if (n < lo || n > hi) return { err: { code: 'OUT_OF_RANGE', message: k + ' 必须在 ' + lo + '–' + hi + ' 之间' } };
      patch[k] = n;
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      patch[k] = v;
    } else if (Array.isArray(v)) {
      patch[k] = v.slice(0, 32).map(function (x) { return String(x).slice(0, 32); });
    } else if (typeof v === 'string') {
      if (v.length > 500) return { err: { code: 'BAD_REQUEST', message: k + ' 太长' } };
      patch[k] = v;
    } else {
      return { err: { code: 'BAD_REQUEST', message: k + ' 类型不对' } };
    }
  }
  return { patch: patch, dropped: dropped };
}

/* ---------- 站点搜索预设：每站的搜索参数名与分类 id 都不一样，落在本地文件里 ---------- */
const SITE_SEARCH_FILE = path.join(DATA_DIR, 'site-search.local.json');
const SEARCH_ENGINES = ['nexusphp', 'unit3d', 'gazelle', 'custom'];

function readSearchPresets() {
  try {
    const raw = JSON.parse(fs.readFileSync(SITE_SEARCH_FILE, 'utf8'));
    const sites = raw && raw.sites && typeof raw.sites === 'object' ? raw.sites : (raw && typeof raw === 'object' ? raw : {});
    return sites && typeof sites === 'object' ? sites : {};
  } catch (e) {
    return {};
  }
}
function writeSearchPresets(sites) {
  try {
    fs.writeFileSync(SITE_SEARCH_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), sites }, null, 1), { mode: 0o600 });
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入搜索预设失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}
function strMap(v, maxKeys, maxLen) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { err: '必须是对象' };
  const keys = Object.keys(v);
  if (keys.length > maxKeys) return { err: '字段太多（上限 ' + maxKeys + '）' };
  for (const k of keys) {
    if (!/^[a-zA-Z0-9_.\[\]-]{1,40}$/.test(k)) return { err: '参数名不合法：' + k };
    const val = v[k];
    if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean') return { err: '参数 ' + k + ' 类型不对' };
    out[k] = String(val).slice(0, maxLen);
  }
  return { out };
}
function sanitizePreset(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { err: { code: 'BAD_REQUEST', message: '请求体不是合法 JSON 对象' } };
  const preset = {};
  if (body.engine !== undefined) {
    if (SEARCH_ENGINES.indexOf(String(body.engine)) < 0) {
      return { err: { code: 'BAD_REQUEST', message: 'engine 只能是 ' + SEARCH_ENGINES.join(' / ') } };
    }
    preset.engine = String(body.engine);
  }
  for (const k of ['searchPath', 'browsePath', 'note']) {
    if (body[k] === undefined) continue;
    if (typeof body[k] !== 'string' || body[k].length > 300) return { err: { code: 'BAD_REQUEST', message: k + ' 必须是字符串且不超过 300 字' } };
    preset[k] = body[k];
  }
  if (body.params !== undefined) {
    const m = strMap(body.params, 30, 200);
    if (m.err) return { err: { code: 'BAD_REQUEST', message: 'params ' + m.err } };
    preset.params = m.out;
  }
  if (body.cats !== undefined) {
    if (!body.cats || typeof body.cats !== 'object' || Array.isArray(body.cats)) {
      return { err: { code: 'BAD_REQUEST', message: 'cats 必须是 分类名 -> id 数组 的对象' } };
    }
    const cats = {};
    const keys = Object.keys(body.cats);
    if (keys.length > 20) return { err: { code: 'BAD_REQUEST', message: 'cats 分类太多（上限 20）' } };
    for (const key of keys) {
      const arr = body.cats[key];
      if (!Array.isArray(arr)) return { err: { code: 'BAD_REQUEST', message: 'cats.' + key + ' 必须是数组' } };
      if (arr.length > 50) return { err: { code: 'BAD_REQUEST', message: 'cats.' + key + ' 最多 50 个' } };
      cats[key] = arr.map(function (x) { return String(x).slice(0, 20); });
    }
    preset.cats = cats;
  }
  if (body.source !== undefined) {
    if (['manual', 'probe', 'auto', 'arch'].indexOf(String(body.source)) < 0) return { err: { code: 'BAD_REQUEST', message: 'source 只能是 manual / probe / auto / arch' } };
    preset.source = String(body.source);
  }
  if (body.catMode !== undefined) {
    if (['single', 'multi', 'bracket'].indexOf(String(body.catMode)) < 0) return { err: { code: 'BAD_REQUEST', message: 'catMode 只能是 single / multi / bracket' } };
    preset.catMode = String(body.catMode);
  }
  if (body.catSlot !== undefined) {
    const slot = Number(body.catSlot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 20) return { err: { code: 'BAD_REQUEST', message: 'catSlot 必须是 1–20 的整数' } };
    preset.catSlot = slot;
  }
  if (body.confirmed !== undefined) preset.confirmed = !!body.confirmed;
  return { preset };
}

/* ---------- 流程规则：抓取/查重/发布三套规则的服务端持久化 ---------- */
const FLOW_FILE = path.join(DATA_DIR, 'flow.json');
const FLOW_SETS = ['fetch', 'dedupe', 'pub'];

function readFlow() {
  try {
    const raw = JSON.parse(fs.readFileSync(FLOW_FILE, 'utf8'));
    return raw && raw.sets ? raw : null;
  } catch (e) {
    return null;
  }
}
function writeFlow(sets) {
  try {
    fs.writeFileSync(FLOW_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), sets }, null, 1), { mode: 0o600 });
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入流程规则失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}
function sanitizeFlow(body) {
  const src = body && body.sets !== undefined ? body.sets : body;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return { err: { code: 'BAD_REQUEST', message: '请求体要是 { fetch, dedupe, pub }' } };
  const out = {};
  for (const key of FLOW_SETS) {
    if (src[key] === undefined) continue;
    const groups = src[key];
    if (!Array.isArray(groups) || groups.length > 30) return { err: { code: 'BAD_REQUEST', message: key + ' 必须是数组且最多 30 组' } };
    out[key] = groups.map(function (grp) {
      if (!Array.isArray(grp) || grp.length > 40) throw Object.assign(new Error(key + ' 每组必须是数组且最多 40 行'), { bad: true });
      return grp.map(function (row) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw Object.assign(new Error(key + ' 的行必须是对象'), { bad: true });
        const o = {};
        if (row.v !== undefined && row.v !== null) {
          if (typeof row.v === 'object') throw Object.assign(new Error(key + ' 的 v 只能是字符串/数字/布尔'), { bad: true });
          o.v = typeof row.v === 'string' ? row.v.slice(0, 300) : row.v;
        }
        if (row.on !== undefined) o.on = !!row.on;
        if (row.sel !== undefined) {
          if (!Array.isArray(row.sel) || row.sel.length > 40) throw Object.assign(new Error(key + ' 的 sel 必须是数组且最多 40 项'), { bad: true });
          o.sel = row.sel.map(function (x) { return String(x).slice(0, 60); });
        }
        return o;
      });
    });
  }
  return { sets: out };
}

/* ---------- 本地查重：只查本地库和队列里已有条目，不联网 ---------- */
const LIB_FILE = path.join(DATA_DIR, 'library.json');
const catalogStore = catalog.createStore(path.join(DATA_DIR, 'catalog.json'));

function readLibrary() {
  try {
    const raw = JSON.parse(fs.readFileSync(LIB_FILE, 'utf8'));
    return Array.isArray(raw && raw.items) ? raw.items : [];
  } catch (e) {
    return [];
  }
}
function writeLibrary(items) {
  try {
    fs.writeFileSync(LIB_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 1), { mode: 0o600 });
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入本地库失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}
function findDuplicates(item, pool) {
  const out = [];
  (pool || []).forEach(function (x) {
    if (!x || String(x.id) === String(item.id)) return;
    const r = match.compare(item, x);
    if (!r.same) return;
    out.push({
      id: x.id || null, source: x.source || 'queue', title: x.title, site: x.site || '',
      size: x.size || '', reason: r.reasons.join(' · '), score: r.score
    });
  });
  return out.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
}

/* ---------- 抓取：一次 GET 取一页，解析后进词条库（不做并发、不重试轰炸） ---------- */
const CRAWL_STATE_FILE = path.join(DATA_DIR, 'crawl-state.json');
const CRAWL_MIN_GAP_MS = 30000;     /* 同一站两次抓取至少隔 30 秒 */
const CRAWL_DAILY_MAX = 20;         /* 单站每天最多这么多次 */
const CRAWL_ROWS_DEFAULT = 100;     /* 正常一轮抓多少条词条，先用小数量试 */

function readCrawlState() {
  try { return JSON.parse(fs.readFileSync(CRAWL_STATE_FILE, 'utf8')) || {}; } catch (e) { return {}; }
}
function writeCrawlState(s) {
  try { fs.writeFileSync(CRAWL_STATE_FILE, JSON.stringify(s, null, 1), { mode: 0o600 }); } catch (e) {}
}

/* 标题/属性里带这些词的，只打标记，不过滤 */
function marksOf(title) {
  const t = String(title || '');
  const m = {};
  if (/禁转|禁止转载|no\s*-?re-?distribut/i.test(t)) m.noRedistribute = true;
  if (/独占|exclusive/i.test(t)) m.exclusive = true;
  if (/diy/i.test(t)) m.diy = true;
  if (/限转|limited/i.test(t)) m.limited = true;
  return m;
}

function crawlPlan(host, opts) {
  const def = readSiteDef(host);
  if (!def) return { err: { code: 'NO_DEF', message: '这个站还没有站点定义' } };
  if (!def.engine) return { err: { code: 'NO_ENGINE', message: '这个站还没识别出引擎' } };
  const all = readCreds();
  if (!all[host] || !all[host].cookie) return { err: { code: 'NO_COOKIE', message: '这个站还没导入 cookie' } };
  const cats = (def.catMap || []).map(function (x) { return x.id; });
  const idx = Math.max(0, Math.min(Math.max(0, cats.length - 1), Number((opts && opts.catIdx) || 0)));
  const first = cats.length ? [cats[idx]] : [];
  const url = adapters.buildSearchUrl(def, '', first);
  return { host: host, engine: def.engine, url: url, categories: cats.length, categoryId: first[0] || '',
    catIdx: idx,
    requestDelay: (def.limits && def.limits.requestDelay) || 3, minGapMs: CRAWL_MIN_GAP_MS, dailyMax: CRAWL_DAILY_MAX };
}

const CRAWL_BUSY = new Set();          /* 同一个站同一时间只允许一次抓取 */

async function crawlOnce(host, opts) {
  if (CRAWL_BUSY.has(host)) return { err: { code: 'BUSY', message: '这个站正在抓，等这次结束' } };
  CRAWL_BUSY.add(host);
  try {
    return await crawlOnceInner(host, opts);
  } finally {
    CRAWL_BUSY.delete(host);
  }
}

async function crawlOnceInner(host, opts) {
  const state0 = readCrawlState();
  const rec0 = state0[host] || {};
  /* 类目轮转：每抓一次换下一个分类，一轮下来把预设里的类目都覆盖到 */
  const catIdx = Number((opts && opts.catIdx) >= 0 ? opts.catIdx : ((rec0.catIdx || 0) + 1));
  const plan = crawlPlan(host, { catIdx: catIdx });
  if (plan.err) return { err: plan.err };
  const state = readCrawlState();
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const rec = state[host] || { lastAt: 0, day: today, count: 0, page: 0 };
  if (rec.day !== today) { rec.day = today; rec.count = 0; rec.page = 0; }
  if (now - (rec.lastAt || 0) < CRAWL_MIN_GAP_MS) {
    return { err: { code: 'TOO_SOON', message: '距上次抓取不到 30 秒，等一下再抓',
      extra: { waitMs: CRAWL_MIN_GAP_MS - (now - (rec.lastAt || 0)) } } };
  }
  if (rec.count >= CRAWL_DAILY_MAX) {
    return { err: { code: 'DAILY_LIMIT', message: '这个站今天已经抓够 ' + CRAWL_DAILY_MAX + ' 次了', extra: { count: rec.count } } };
  }
  /* 翻页续抓：默认接着上次的下一页；到底了（上次 0 行）就从头来 */
  const page = Math.max(1, Math.min(50, Number((opts && opts.page) || 0) || ((rec.page || 0) + 1)));
  const url = adapters.withPage(plan.url, page);
  const def = readSiteDef(host);
  const cookie = decryptField(readCreds()[host].cookie);
  const t0 = Date.now();
  let rows = [], status = 0, html = [];
  try {
    const res = await fetch(url, {
      headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'manual', signal: AbortSignal.timeout(20000)
    });
    status = res.status;
    html = await res.text().catch(function () { return ''; });
  } catch (e) {
    logEvent('warn', '抓取', host + ' 抓取失败：' + String(e && e.message || e).slice(0, 80));
    return { err: { code: 'CRAWL_FAILED', message: e && e.name === 'TimeoutError' ? '请求超时' : String(e && e.message || e).slice(0, 160) } };
  }
  const loggedOut = status === 302 || /takelogin\.php|请先登录/i.test(html);
  /* 失败也要记一次时间戳：否则 cookie 失效时用户能连续点，等于对站点反复请求 */
  function markAttempt(errCode) {
    rec.lastAt = now;
    rec.lastError = errCode;
    state[host] = rec;
    writeCrawlState(state);
  }
  if (loggedOut) {
    logEvent('warn', '抓取', host + ' cookie 已失效，抓取中止');
    markAttempt('LOGIN_REQUIRED');
    return { err: { code: 'LOGIN_REQUIRED', message: 'cookie 已失效，先做一次会话自检' } };
  }
  if (status !== 200) {
    markAttempt('CRAWL_HTTP_' + status);
    return { err: { code: 'CRAWL_HTTP_' + status, message: '站点返回 ' + status } };
  }
  try { rows = adapters.parseList(html, def.engine) || []; } catch (e) { rows = []; }
  const limit = Math.max(1, Math.min(200, Number((opts && opts.limit) || 0) || CRAWL_ROWS_DEFAULT));
  const items = rows.slice(0, limit).map(function (r) {
    return {
      site: host, siteId: String(r.id || ''), title: r.title || '', size: r.size || '',
      sizeBytes: Number(r.sizeBytes) || 0, cat: String(r.catId || ''), catName: r.catName || '',
      detailsUrl: r.detailsUrl || '', downloadUrl: r.downloadUrl || '', infohash: r.infohash || '',
      seeders: Number(r.seeders) || 0, marks: marksOf(r.title)
    };
  }).filter(function (x) { return x.title && x.siteId; });
  let out = { added: 0, updated: 0, skipped: 0, total: 0 };
  if (items.length) out = catalogStore.add(items);
  rec.lastAt = now;
  rec.count = (rec.count || 0) + 1;
  rec.page = rows.length ? page : 0;      /* 这一页有东西就记住页码，到底了就归零 */
  rec.lastRows = rows.length;
  rec.catIdx = plan.catIdx;
  rec.catId = plan.categoryId;
  state[host] = rec;
  writeCrawlState(state);
  logEvent('info', '抓取', host + ' 分类 ' + (plan.categoryId || '全部') + ' 第 ' + page + ' 页 · 抓回 ' + rows.length + ' 行 · 入库 ' + out.added + ' 新增 / ' + out.updated + ' 更新');
  return {
    host: host, url: url, page: page, status: status, ms: Date.now() - t0, rows: rows.length, limit: limit,
    categoryId: plan.categoryId, categories: plan.categories,
    added: out.added, updated: out.updated, skipped: out.skipped, nextPage: rows.length ? page + 1 : 1,
    daily: { day: rec.day, count: rec.count, max: CRAWL_DAILY_MAX }, nextAllowedMs: CRAWL_MIN_GAP_MS
  };
}

/* ---------- 第二步筛选：从词条库挑出可发的，送进待审核 ---------- */
/* 筛选参数优先用请求里的，其次用面板「筛选条件」那一组配置。
   flow 里只存了每行的 {v,on,sel}，没有标题，所以按 data.js 里的行顺序取：
   0 分辨率要求 / 1 体积范围 / 2 最大体积 / 3 地区版本 / 4 必须有简介 / 5 必须带中字 */
function flowScreenRules() {
  const flow = readFlow();
  const rows = (flow && flow.sets && Array.isArray(flow.sets.dedupe) && Array.isArray(flow.sets.dedupe[0]))
    ? flow.sets.dedupe[0] : [];
  const val = function (i) { return rows[i] ? String(rows[i].v || '') : ''; };
  const on = function (i) { return !!(rows[i] && rows[i].on); };
  const out = { res: [], minSizeGB: 0, maxSizeGB: 0, requireChinese: false };
  const rv = val(0);
  if (/2160|4k/i.test(rv)) out.res = ['2160p'];
  else if (/1080/.test(rv)) out.res = ['1080p', '2160p'];
  const lo = /([\d.]+)\s*GB/.exec(val(1));
  if (lo) out.minSizeGB = Number(lo[1]) || 0;
  const hi = /([\d.]+)\s*GB/.exec(val(2));
  if (hi) out.maxSizeGB = Number(hi[1]) || 0;
  if (on(5)) out.requireChinese = true;
  return out;
}

function screenCatalog(opts) {
  const o = opts || {};
  const limit = Math.max(1, Math.min(200, Number(o.limit) || 50));
  const host = String(o.host || '').trim().toLowerCase();
  const rules = (o.rules && Object.keys(o.rules).length) ? o.rules : flowScreenRules();
  const resAllow = Array.isArray(rules.res) ? rules.res.map(function (x) { return String(x).toLowerCase(); }) : [];
  const minBytes = Number(rules.minSizeGB) > 0 ? Number(rules.minSizeGB) * 1073741824 : 0;
  const maxBytes = Number(rules.maxSizeGB) > 0 ? Number(rules.maxSizeGB) * 1073741824 : 0;
  const needChinese = !!rules.requireChinese;
  const pool = readQueue().items.concat(readLibrary().map(function (x) { return Object.assign({ source: 'library' }, x); }));
  /* 已经送审或发过的词条也算「已有」，避免同一条从别的站又挑一遍 */
  const doneCat = catalogStore.list({ limit: 5000 }).items.filter(function (x) {
    return x.status === 'selected' || x.status === 'published';
  }).map(function (x) { return Object.assign({ source: 'catalog', site: x.site }, x); });
  const poolAll = pool.concat(doneCat);

  const all = catalogStore.list({ status: 'new', limit: 5000 }).items;
  const onlyIds = Array.isArray(o.ids) ? o.ids.map(String) : null;
  const queue = readQueue();
  const byReason = {};
  let checked = 0, selected = 0, skipped = 0;
  const picked = [];

  all.filter(function (x) { return !host || x.site === host; })
    .filter(function (x) { return !onlyIds || onlyIds.indexOf(String(x.id)) >= 0; })
    .slice(0, limit).forEach(function (it) {
    checked++;
    const title = String(it.title || '');
    const res = String(it.res || '').toLowerCase() || (match.resOf(title) || '');
    const bytes = Number(it.sizeBytes) || match.sizeBytesOf({ size: it.size }) || 0;
    let reason = '';
    if (resAllow.length && res && resAllow.indexOf(res) < 0) reason = '分辨率不符 ' + res;
    else if (minBytes && bytes && bytes < minBytes) reason = '体积偏小';
    else if (maxBytes && bytes && bytes > maxBytes) reason = '体积偏大';
    else if (needChinese && !/中字|简繁|双语|国语|chs|cht|chinese/i.test(title)) reason = '没有中字';
    else {
      const hit = findDuplicates(Object.assign({}, it, { sizeBytes: bytes }), poolAll)[0];
      if (hit) reason = '已有' + (hit.site ? '（' + hit.site + '）' : '');
    }
    if (reason) {
      catalogStore.setStatus(it.id, 'skipped');
      byReason[reason] = (byReason[reason] || 0) + 1;
      skipped++;
      return;
    }
    const item = {
      id: 'q_' + String(++queue.seq).padStart(4, '0'), status: 'pending', createdAt: new Date().toISOString(),
      title: title, res: res, size: it.size || (bytes ? match.sizeBytesOf({ sizeBytes: bytes }) : ''),
      sizeBytes: bytes, site: it.site || '', infohash: it.infohash || '',
      catalogId: it.id, note: '来自词条库 ' + (it.siteId ? '#' + it.siteId : '')
    };
    queue.items.unshift(item);
    catalogStore.setStatus(it.id, 'selected');
    picked.push(item.id);
    selected++;
  });
  if (queue.items.length > 500) queue.items.length = 500;
  if (picked.length) { try { writeQueue(queue); } catch (e) {} }
  if (checked) logEvent('info', '筛选', '检查 ' + checked + ' 条 · 入选 ' + selected + ' 条 · 跳过 ' + skipped + ' 条');
  return { checked: checked, selected: selected, skipped: skipped, byReason: byReason, queued: picked.length,
    rules: { res: resAllow, minSizeGB: rules.minSizeGB || 0, maxSizeGB: rules.maxSizeGB || 0, requireChinese: needChinese } };
}

/* ---------- 第三步发布：把待审核条目组装成发种草稿（不联网，只拼字段） ---------- */
function composePublish(item) {
  if (!item) return { err: { code: 'NOT_FOUND', message: '条目不存在' } };
  const title = String(item.title || '').trim();
  if (!title) return { err: { code: 'BAD_REQUEST', message: '条目缺标题' } };
  const year = Number(item.year) || match.yearOf(title) || 0;
  const res = String(item.res || match.resOf(title) || '');
  const subtitle = String(item.cn || '').trim();
  const tags = {
    source: /blu-?ray|原盘|bdrip/i.test(title) ? 'Blu-ray' : (/web-?dl/i.test(title) ? 'WEB-DL' : ''),
    medium: /remux/i.test(title) ? 'Remux' : (/blu-?ray|原盘/i.test(title) ? 'Blu-ray' : ''),
    codec: /x265|h\.?265|hevc/i.test(title) ? 'H.265' : (/x264|h\.?264|avc/i.test(title) ? 'H.264' : ''),
    audio: (/atmos/i.test(title) ? 'Atmos ' : '') + (/truehd/i.test(title) ? 'TrueHD' : (/dts/i.test(title) ? 'DTS' : (/ddp|ac3|aac/i.test(title) ? 'AC3/AAC' : ''))).trim(),
    subs: /中字|chs|cht|简繁|双语/i.test(title) ? '中字' : ''
  };
  /* 按标题猜内容类型，再从目标站定义的分类里挑对应的 id，发布时直接带过去 */
  function purposeOfTitle(t) {
    const s = String(t || '');
    if (/动漫|动画|anime|番剧/i.test(s)) return 'anime';
    if (/纪录|documentar/i.test(s)) return 'doc';
    if (/音乐|演唱|音乐会|mv\b|ost\b|flac|concert/i.test(s)) return 'music';
    if (/电子书|有声书|book|ebook|audiobook/i.test(s)) return 'book';
    if (/游戏|\bgame\b|jocuri/i.test(s)) return 'game';
    if (/软件|apps?\b|software/i.test(s)) return 'software';
    if (/体育|sport/i.test(s)) return 'sport';
    if (/\bs\d{1,2}e\d{1,3}\b|剧集|电视剧|综艺|series|episode/i.test(s)) return 'tv';
    if (/电影|movie|film|blu-?ray|remux|web-?dl|原盘/i.test(s)) return 'movie';
    return 'other';
  }
  const purpose = purposeOfTitle(title);
  const targetSite = String(item.targetSite || item.site || '').trim();
  const def = targetSite ? readSiteDef(targetSite) : null;
  const catIds = (def && def.cats && def.cats[purpose]) ? def.cats[purpose].slice(0, 8) : [];
  const categoryHint = { purpose: purpose, ids: catIds, mapped: !!catIds.length };

  const warnings = [];
  if (!subtitle) warnings.push('没有中文副标题，发布前要补');
  if (!res) warnings.push('识别不出分辨率');
  if (!targetSite) warnings.push('没选目标站');
  if ((item.shots || []).length < 3) warnings.push('截图不足 3 张');
  if (!item.intro) warnings.push('简介还是空的（会先用模板占位）');
  if (def && !catIds.length && def.catMap && def.catMap.length) warnings.push('目标站没有对应的「' + purpose + '」分类，发布时要手动选一个');
  return {
    title: title, subtitle: subtitle, year: year, res: res,
    intro: item.intro || ('【片名】' + title + '\n【年份】' + (year || '—') + '\n【分辨率】' + (res || '—') +
      '\n【简介】（待补）\n【截图】' + ((item.shots || []).length ? '见下' : '（待补）')),
    tags: tags, anonymous: !!item.anonymous, imageHost: item.imageHost || '站内',
    category: item.category || '', categoryHint: categoryHint, targetSite: targetSite,
    screenshots: (item.shots || []).slice(0, 12),
    warnings: warnings, ready: warnings.length === 0
  };
}

/* ---------- 发布记录：只记账，不发外部站点 ---------- */
const PUBLISHED_FILE = path.join(DATA_DIR, 'published.json');
function readPublished() {
  try {
    const raw = JSON.parse(fs.readFileSync(PUBLISHED_FILE, 'utf8'));
    return Array.isArray(raw && raw.items) ? raw.items : [];
  } catch (e) {
    return [];
  }
}
function appendPublished(rec) {
  try {
    const items = readPublished();
    items.unshift(rec);
    if (items.length > 5000) items.length = 5000;
    fs.writeFileSync(PUBLISHED_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 0), { mode: 0o600 });
  } catch (e) {}
}

/* ---------- 待审核台：服务端状态机（pending -> approved/rejected -> published） ---------- */
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');
const QUEUE_ACTIONS = { approve: 'approved', reject: 'rejected', publish: 'published', skip: 'skipped' };
const QUEUE_FLOW = {
  pending: ['approved', 'rejected', 'skipped'],
  approved: ['published', 'rejected', 'skipped'],
  rejected: [],
  published: [],
  skipped: []
};
const QUEUE_FIELDS = ['title', 'cn', 'year', 'res', 'size', 'sizeBytes', 'infohash', 'imdb', 'site', 'check', 'checkCls', 'note', 'category', 'imageHost', 'catalogId', 'targetSite'];

function readQueue() {
  try {
    const raw = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const items = Array.isArray(raw && raw.items) ? raw.items : [];
    return { seq: Number(raw && raw.seq) || items.length, items: items.filter(function (x) { return x && x.id; }) };
  } catch (e) {
    return { seq: 0, items: [] };
  }
}
function writeQueue(q) {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({ seq: q.seq, items: q.items }, null, 1), { mode: 0o600 });
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入待审核队列失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}
function queueCounts(items) {
  const c = { total: items.length, pending: 0, approved: 0, rejected: 0, published: 0 };
  items.forEach(function (x) { if (c[x.status] !== undefined) c[x.status]++; });
  return c;
}
function cleanShots(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  let bytes = 0;
  arr.slice(0, 12).forEach(function (s) {
    const one = typeof s === 'string' ? { name: '', url: s } : { name: String((s && s.name) || '').slice(0, 120), url: String((s && s.url) || '') };
    if (!one.url) return;
    /* 单条最多 400KB 字符，整组不超过 2.5MB，别把队列文件撑爆 */
    one.url = one.url.slice(0, 400000);
    if (bytes + one.url.length > 2500000) return;
    bytes += one.url.length;
    out.push(one);
  });
  return out;
}

function createQueueItem(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { err: { code: 'BAD_REQUEST', message: '请求体不是合法 JSON 对象' } };
  const title = String(body.title || '').trim();
  if (!title || title.length > 300) return { err: { code: 'BAD_REQUEST', message: 'title 必填且不超过 300 字' } };
  const q = readQueue();
  const item = { id: 'q_' + String(++q.seq).padStart(4, '0'), status: 'pending', createdAt: new Date().toISOString() };
  QUEUE_FIELDS.forEach(function (k) {
    if (body[k] === undefined || body[k] === null) return;
    item[k] = typeof body[k] === 'number' ? body[k] : String(body[k]).slice(0, 300);
  });
  if (body.shots !== undefined) {
    if (!Array.isArray(body.shots)) return { err: { code: 'BAD_REQUEST', message: 'shots 必须是数组' } };
    item.shots = cleanShots(body.shots);
  }
  if (body.anonymous !== undefined) item.anonymous = body.anonymous === true || body.anonymous === 'true';
  if (body.intro !== undefined) item.intro = String(body.intro).slice(0, 4000);
  if (body.targetSite !== undefined) item.targetSite = String(body.targetSite).slice(0, 120);
  if (body.shots !== undefined) item.shots = cleanShots(body.shots);
  /* 标题里能读出来的年份/分辨率/体积先补上，待审核页就不用显示空的年份 */
  if (!item.year) { const y = match.yearOf(title); if (y) item.year = y; }
  if (!item.res) { const r = match.resOf(title); if (r) item.res = r; }
  if (!item.sizeBytes) { const b = match.sizeBytesOf({ size: item.size }); if (b) item.sizeBytes = b; }
  q.items.unshift(item);
  if (q.items.length > 500) q.items.length = 500;
  try { writeQueue(q); } catch (e) { return { err: { code: e.code || 'INTERNAL', message: e.message } }; }
  logEvent('info', '待审核', '新增条目 · ' + title.slice(0, 60) + ' · ' + item.id);
  return { item: item };
}
function queueAction(id, body) {
  if (!body || typeof body !== 'object') return { err: { code: 'BAD_REQUEST', message: '请求体不是合法 JSON' } };
  const action = String(body.action || '');
  if (!QUEUE_ACTIONS[action]) return { err: { code: 'BAD_REQUEST', message: 'action 只能是 approve / reject / publish' } };
  const q = readQueue();
  const item = q.items.filter(function (x) { return x.id === id; })[0];
  if (!item) return { err: { code: 'NOT_FOUND', message: '条目不存在' } };
  const target = QUEUE_ACTIONS[action];
  const allowed = QUEUE_FLOW[item.status] || [];
  if (allowed.indexOf(target) < 0) {
    return { err: { code: 'BAD_STATE', message: '当前状态 ' + item.status + ' 不能变成 ' + target, extra: { status: item.status, allowed: allowed } } };
  }
  const reason = body.reason == null ? '' : String(body.reason).slice(0, 500);
  /* 发布前允许把表单里改过的字段一起带上来（匿名、图床、副标题、简介） */
  if (body.anonymous !== undefined) item.anonymous = body.anonymous === true || body.anonymous === 'true';
  if (body.imageHost !== undefined) item.imageHost = String(body.imageHost).slice(0, 40);
  if (body.cn !== undefined) item.cn = String(body.cn).slice(0, 120);
  if (body.intro !== undefined) item.intro = String(body.intro).slice(0, 4000);
  if (action === 'reject' && !reason.trim()) return { err: { code: 'BAD_REQUEST', message: '驳回必须写理由' } };
  if (action === 'publish') {
    const blockers = [];
    const site = String(item.targetSite || item.site || '').trim();
    if (!item.title || !String(item.title).trim()) blockers.push('条目缺标题');
    if (/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(site)) {
      const preset = (readSearchPresets() || {})[site];
      if (!preset || !preset.engine) blockers.push('目标站 ' + site + ' 还没有搜索预设');
    }
    if (!readDl().items.length) blockers.push('还没有配置任何下载器');
    if (blockers.length) {
      return { err: { code: 'PUBLISH_BLOCKED', message: '还不能发布：' + blockers.join('；'), extra: { blockers: blockers } } };
    }
  }
  item.status = target;
  item.updatedAt = new Date().toISOString();
  if (reason) item.reason = reason;
  if (action === 'publish') {
    /* 发布成功：词条库里对应词条标为已发布，并留一条发布记录（不调外部站点，只记账） */
    item.publishedAt = item.updatedAt;
    if (item.catalogId) catalogStore.setStatus(item.catalogId, 'published');
    appendPublished({
      id: 'pub_' + String(Date.now()),
      site: String(item.targetSite || item.site || ''), sourceSite: item.site || '', title: item.title || '', res: item.res || '', size: item.size || '',
      infohash: item.infohash || '', catalogId: item.catalogId || '', queueId: item.id,
      anonymous: item.anonymous === true, imageHost: item.imageHost || '站内',
      cn: item.cn || '', at: item.updatedAt
    });
  }
  try { writeQueue(q); } catch (e) { return { err: { code: e.code || 'INTERNAL', message: e.message } }; }
  logEvent(action === 'reject' ? 'warn' : 'info', '待审核', action + ' · ' + (item.title || item.id).slice(0, 60) + (reason ? ' · ' + reason.slice(0, 80) : ''));
  return { item: item };
}

/* ---------- 下载器：只连用户自己填的地址，做一次连通性探测 ---------- */
const DL_FILE = path.join(DATA_DIR, 'downloaders.json');
const DL_TIMEOUT = 8000;

function readDl() {
  try {
    const raw = JSON.parse(fs.readFileSync(DL_FILE, 'utf8'));
    return { seq: Number(raw && raw.seq) || 0, items: Array.isArray(raw && raw.items) ? raw.items : [] };
  } catch (e) {
    return { seq: 0, items: [] };
  }
}
function writeDl(d) {
  try {
    fs.writeFileSync(DL_FILE, JSON.stringify({ seq: d.seq, items: d.items }, null, 1), { mode: 0o600 });
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入下载器失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}
function publicDl(d) {
  return { id: d.id, name: d.name || '', url: d.url, user: d.user || '', hasPass: !!d.pass, disableAuth: !!d.disableAuth,
    lastProbe: d.lastProbe || null };
}
function normDlUrl(raw) {
  const s = String(raw || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s]+$/i.test(s)) return null;
  return s;
}
function sanitizeDl(body, prev) {
  const out = Object.assign({}, prev || {});
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (n.length > 60) return { err: { code: 'BAD_REQUEST', message: 'name 最多 60 字' } };
    out.name = n;
  }
  if (body.url !== undefined) {
    const u = normDlUrl(body.url);
    if (!u) return { err: { code: 'BAD_URL', message: '地址必须是 http/https 开头' } };
    out.url = u;
  }
  if (body.user !== undefined) out.user = String(body.user).slice(0, 100);
  if (body.pass !== undefined) out.pass = body.pass ? String(body.pass).slice(0, 200) : '';
  if (body.disableAuth !== undefined) out.disableAuth = !!body.disableAuth;
  return { dl: out };
}

async function probeDownloader(d) {
  const steps = [];
  const base = d.url;
  const cookie = { value: '' };
  function ms(t0) { return Date.now() - t0; }
  async function hit(path, opts) {
    const t0 = Date.now();
    const h = Object.assign({}, (opts && opts.headers) || {});
    if (cookie.value) h.cookie = cookie.value;
    const res = await fetch(base + path, Object.assign({}, opts || {}, {
      headers: h, redirect: 'manual', signal: AbortSignal.timeout(DL_TIMEOUT)
    }));
    return { res: res, ms: ms(t0) };
  }
  try {
    let r = await hit('/api/v2/app/version');
    steps.push({ step: 'version', status: r.res.status, ms: r.ms });
    if ((r.res.status === 401 || r.res.status === 403) && (d.user || d.pass)) {
      const t0 = Date.now();
      const login = await fetch(base + '/api/v2/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', referer: base },
        body: 'username=' + encodeURIComponent(d.user || '') + '&password=' + encodeURIComponent(d.pass || ''),
        redirect: 'manual', signal: AbortSignal.timeout(DL_TIMEOUT)
      });
      const setCookie = login.headers.get('set-cookie') || '';
      const m = /SID=([^;]+)/.exec(setCookie);
      if (m) cookie.value = 'SID=' + m[1];
      const text = await login.text().catch(function () { return ''; });
      steps.push({ step: 'login', status: login.status, ms: ms(t0), ok: /ok/i.test(text) });
      r = await hit('/api/v2/app/version');
      steps.push({ step: 'version', status: r.res.status, ms: r.ms });
    }
    const version = (await r.res.text().catch(function () { return ''; })).trim().slice(0, 40);
    const pass = r.res.status === 200 && !!version;
    /* 顺手问一下磁盘余量：qBittorrent 在 sync/maindata 的 server_state 里给 */
    let freeSpace = 0, savePath = '';
    if (pass) {
      try {
        const t1 = Date.now();
        const main = await hit('/api/v2/sync/maindata');
        const data = await main.res.json().catch(function () { return null; });
        const st = (data && data.server_state) || {};
        freeSpace = Number(st.free_space_on_disk) || 0;
        savePath = String(st.save_path || '');
        steps.push({ step: 'space', status: main.res.status, ms: ms(t1), ok: freeSpace > 0 });
      } catch (e) {
        steps.push({ step: 'space', status: 0, ms: 0, error: '拿不到磁盘余量：' + String(e && e.message || e).slice(0, 80) });
      }
    }
    return { pass: pass, version: pass ? version : '', freeSpace: freeSpace, savePath: savePath, steps: steps };
  } catch (e) {
    steps.push({ step: 'connect', status: 0, ms: 0, error: e && e.name === 'TimeoutError' ? '连接超时' : String(e && e.message || e).slice(0, 160) });
    return { pass: false, version: '', steps: steps };
  }
}

/* ---------- 任务：干跑队列（只走本地步骤，不访问任何外部站点） ---------- */
const TASKS = new Map();
const TASK_TYPES = ['crawl', 'check', 'publish'];
const TASK_STEPS = ['准备', '读取面板配置', '读取站点配置与搜索预设', '生成待抓取清单', '汇总'];
const TASK_KEEP = 50;
let taskSeq = 0;

function taskPublic(t) {
  return {
    id: t.id, type: t.type, siteHost: t.siteHost, dryRun: t.dryRun, state: t.state,
    progress: t.progress, steps: t.steps, createdAt: t.createdAt,
    startedAt: t.startedAt, finishedAt: t.finishedAt, error: t.error, result: t.result,
    plan: t.plan || null
  };
}
function activeTaskFor(host) {
  let found = null;
  TASKS.forEach(function (t) {
    if (t.siteHost === host && (t.state === 'queued' || t.state === 'running')) found = t;
  });
  return found;
}
function trimTasks() {
  if (TASKS.size <= TASK_KEEP) return;
  const done = Array.from(TASKS.values())
    .filter(function (t) { return t.state !== 'queued' && t.state !== 'running'; })
    .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
  while (TASKS.size > TASK_KEEP && done.length) TASKS.delete(done.shift().id);
}
function runDryTask(t) {
  t.state = 'running';
  t.startedAt = new Date().toISOString();
  let i = 0;
  const tick = setInterval(function () {
    if (t.state === 'canceled' || t.state === 'failed') { clearInterval(tick); return; }
    t.steps[i].state = 'done';
    i++;
    t.progress = Math.round(i / t.steps.length * 100);
    if (i >= t.steps.length) {
      clearInterval(tick);
      t.state = 'done';
      t.progress = 100;
      t.finishedAt = new Date().toISOString();
      t.result = {
        dryRun: true, steps: t.steps.length, note: '干跑：没有访问任何站点',
        plan: t.plan, warnings: (t.plan && t.plan.warnings) || []
      };
      logEvent('info', '任务', '干跑完成 · ' + t.siteHost + ' · ' + t.steps.length + ' 步');
    }
  }, 260);
  if (tick.unref) tick.unref();
  t.timer = tick;
}
/* ---------- 站点凭据：只存密文，接口永不回显明文 ---------- */
const CRED_FILE = path.join(DATA_DIR, 'credentials.json');

/* 站点自检结果落盘：面板的「系统状态」要用真实的登录正常/失效数，不猜 */
const SITE_STATUS_FILE = path.join(DATA_DIR, 'site-status.json');
function readSiteStatus() {
  try { return JSON.parse(fs.readFileSync(SITE_STATUS_FILE, 'utf8')) || {}; } catch (e) { return {}; }
}
function writeSiteStatus(host, rec) {
  try {
    const all = readSiteStatus();
    all[host] = rec;
    fs.writeFileSync(SITE_STATUS_FILE, JSON.stringify(all, null, 1), { mode: 0o600 });
  } catch (e) {}
}

function readCreds() {
  try {
    const raw = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) {
    return {};
  }
}
function writeCreds(all) {
  try {
    fs.writeFileSync(CRED_FILE, JSON.stringify(all, null, 1), { mode: 0o600 });
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入凭据失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}
function publicCred(c) {
  return {
    host: c.host, user: c.user ? '已保存' : '', hasUser: !!c.user,
    hasCookie: !!c.cookie, updatedAt: c.updatedAt || null
  };
}
function decryptField(v) {
  if (!v) return '';
  try { return secretbox.decrypt(v, KEYRING.key); } catch (e) { return ''; }
}
/* 会话自检：只用已保存的 cookie 访问一次首页，判断还能不能用 */
async function sessionCheckOnce(host) {
  const all = readCreds();
  const c = all[host];
  if (!c || !c.cookie) return { err: { code: 'NO_COOKIE', message: '这个站还没导入 cookie' } };
  const cookie = decryptField(c.cookie);
  if (!cookie) return { err: { code: 'NO_COOKIE', message: 'cookie 解不开，请重新导入' } };
  const def = readSiteDef(host);
  const base = (def && def.base ? String(def.base) : 'https://' + host).replace(/\/+$/, '');
  const engine = (def && def.engine) || '';
  const probePath = engine === 'nexusphp' || engine === '' ? '/index.php' : '/';
  /* 第二探：首页没有登录特征时，再试一次列表页（有下载链接/用户菜单就算登录成功） */
  const browsePath = engine === 'unit3d' ? '/torrents' : '/torrents.php';
  const t0 = Date.now();
  function judge(res, html) {
    const verdict = adapters.isLoggedIn(html);
    const testSelector = def && def.login && def.login.test && def.login.test.selector;
    const selRe = testSelector ? selectorToRegex(testSelector) : null;
    const selHit = !!(selRe && selRe.test(html));
    const loggedOut = res.status === 302 || (verdict === false && !selHit) || /takelogin\.php|请先登录|请登录/i.test(html);
    const ok = res.status === 200 && !loggedOut && (verdict === true || selHit);
    return { ok: ok, verdict: verdict, selHit: selHit };
  }
  try {
    const res = await fetch(base + probePath, {
      headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'manual', signal: AbortSignal.timeout(15000)
    });
    let html = await res.text().catch(function () { return ''; });
    let v = judge(res, html);
    const steps = [{ step: 'session', path: probePath, status: res.status, ms: Date.now() - t0, ok: v.ok }];
    if (!v.ok) {
      try {
        const t1 = Date.now();
        const res2 = await fetch(base + browsePath, {
          headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          redirect: 'manual', signal: AbortSignal.timeout(15000)
        });
        const html2 = await res2.text().catch(function () { return ''; });
        const v2 = judge(res2, html2);
        steps.push({ step: 'browse', path: browsePath, status: res2.status, ms: Date.now() - t1, ok: v2.ok });
        if (v2.ok) { v = v2; html = html2; }
      } catch (e2) {
        steps.push({ step: 'browse', path: browsePath, status: 0, ms: 0, error: '第二探失败' });
      }
    }
    const ok = v.ok;
    logEvent(ok ? 'info' : 'warn', '站点', '会话自检 · ' + host + ' · ' + (ok ? '可用' : '已失效'));
    return {
      pass: ok, engine: engine || 'unknown', probe: probePath, login: v.verdict,
      hint: ok ? '' : 'cookie 可能不完整（浏览器里 HttpOnly 的会话字段没复制到）或已过期；从开发者工具 Application → Cookies，或网络请求的 Cookie 头整段复制',
      steps: steps,
      cookieNames: cookie.split(';').map(function (x) { return x.split('=')[0].trim(); }).filter(Boolean)
    };
  } catch (e) {
    logEvent('warn', '站点', '会话自检 · ' + host + ' · 失败：' + String(e.message).slice(0, 80));
    return { pass: false, engine: engine || 'unknown',
      hint: '连不上这个站点（超时或网络不通），先确认浏览器里能打开它，再重新自检；cookie 很长时确认没有截断',
      steps: [{ step: 'connect', status: 0, ms: Date.now() - t0, error: e && e.name === 'TimeoutError' ? '连接超时' : String(e.message).slice(0, 160) }], cookieNames: [] };
  }
}

/* 站点定义：pta/data/site-defs/<host>.json，由 scripts/collect-site-defs.js 生成 */
const DEF_DIR = path.join(DATA_DIR, 'site-defs');
function readSiteDef(host) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DEF_DIR, host + '.json'), 'utf8'));
  } catch (e) {
    return null;
  }
}

/* 干跑计划：只读本地配置和清单，不访问任何站点 */
function buildDryPlan(host) {
  const cfg = readConfig();
  const site = (readSiteCfg().sites || {})[host] || {};
  const preset = (readSearchPresets() || {})[host] || null;
  const inList = loadSiteList().some(function (x) { return x.host === host; });
  const warnings = [];
  const cats = preset && preset.cats ? preset.cats : {};
  const groups = Object.keys(cats);
  let ids = 0;
  groups.forEach(function (k) { ids += (cats[k] || []).length; });
  const pages = Math.max(1, Number(site.pages) || 2);
  const concurrency = Math.max(1, Number(site.concurrency) || 1);
  const interval = Number(site.interval) || cfg.interval;

  if (!inList) warnings.push('站点不在清单里（可能是手填的域名）');
  if (site.enabled === false) warnings.push('这个站点在配置里是停用状态');
  if (!preset) warnings.push('还没有搜索预设，分类 id 未知');
  else if (!preset.engine) warnings.push('搜索预设缺 engine');
  else if (!groups.length) warnings.push('搜索预设里没有配置任何分类');
  if (interval < LIMITS[cfg.runMode === 'prod' ? 'prod' : 'test'].interval[0]) warnings.push('请求间隔低于当前模式下限，会被压到下限');

  /* 用站点定义拼出真实会请求的搜索 URL（只拼字符串，不发请求） */
  const def = readSiteDef(host);
  let searchUrls = [];
  if (!def) {
    warnings.push('没有站点定义，拼不出搜索 URL');
  } else {
    if (def.engine && !adapters.byName(def.engine)) warnings.push('该站引擎是 ' + def.engine + '，还没有对应的解析适配器');
    if (def.engine && def.engine !== 'nexusphp') warnings.push('该站引擎是 ' + def.engine + '，解析走适配器 ' + def.engine + '（列表与分类字段可能有差异）');
    if (def.base) {
      /* 一个分类 id 一条搜索 URL：各引擎的多分类写法不一样，按单个 id 拼最稳 */
      groups.forEach(function (k) {
        const ids = cats[k] || [];
        (ids.length ? ids : [null]).forEach(function (id) {
          if (searchUrls.length >= 10) return;
          searchUrls.push({ cat: k, catId: id, url: adapters.buildSearchUrl(def, '{q}', id ? [id] : []) });
        });
      });
    }
  }

  /* 上次抓到哪了：给干跑计划显示「下一次会抓哪个分类的第几页」 */
  const cr = readCrawlState()[host] || null;
  const catList = Object.keys(cats).reduce(function (a, k) { return a.concat(cats[k] || []); }, []);
  const nextCatIdx = Math.min(Math.max(0, (cr && cr.catIdx != null ? cr.catIdx + 1 : 0)), Math.max(0, catList.length - 1));
  const nextCrawl = {
    at: cr ? (cr.lastAt || 0) : 0,
    page: Math.max(1, (cr && cr.page ? cr.page : 0) + 1),
    categoryId: catList.length ? catList[nextCatIdx] : '',
    catIdx: nextCatIdx,
    runsToday: cr && cr.day === new Date().toISOString().slice(0, 10) ? (cr.count || 0) : 0
  };

  return {
    siteHost: host,
    runMode: cfg.runMode,
    interval: interval,
    pages: pages,
    concurrency: concurrency,
    engine: preset && preset.engine ? preset.engine : '',
    catGroups: groups.length,
    catIds: ids,
    estimatedQueries: (ids || groups.length) * pages,
    knownCats: groups,
    searchUrls: searchUrls,
    nextCrawl: nextCrawl,
    inList: inList,
    enabled: site.enabled !== false,
    warnings: warnings
  };
}

function createTask(body) {
  const type = String(body.type || 'crawl');
  if (TASK_TYPES.indexOf(type) < 0) return { err: { code: 'BAD_REQUEST', message: 'type 只能是 ' + TASK_TYPES.join(' / ') } };
  const host = body.siteHost == null ? '' : String(body.siteHost).trim();
  if (!host || host.length > 200 || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) {
    return { err: { code: 'BAD_HOST', message: 'siteHost 不合法' } };
  }
  if (body.dryRun === false) {
    return { err: { code: 'DRY_RUN_ONLY', message: '真抓取还没接入，目前只支持干跑（dryRun: true）' } };
  }
  const busy = activeTaskFor(host);
  if (busy) return { err: { code: 'BUSY', message: '这个站点已经有任务在跑', extra: { id: busy.id, state: busy.state } } };
  const t = {
    id: 't_' + String(++taskSeq).padStart(4, '0'),
    type: type, siteHost: host, dryRun: true, state: 'queued', progress: 0,
    steps: TASK_STEPS.map(function (n) { return { name: n, state: 'wait' }; }),
    createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, error: null, result: null,
    plan: buildDryPlan(host)
  };
  TASKS.set(t.id, t);
  trimTasks();
  logEvent('info', '任务', '新建干跑任务 · ' + type + ' · ' + host + ' · ' + t.id);
  runDryTask(t);
  return { task: t };
}

function clientIp(req) {
  return (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
}

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
    return Object.assign({}, DEFAULTS, raw);
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function writeConfig(cfg) {
  try {
    fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {
    const err = new Error(e.code === "EACCES" ? "数据目录不可写，检查挂载权限" : "写入配置失败：" + e.message);
    err.code = "STORAGE_FAILED";
    throw err;
  }
}

function send(res, code, payload, headers) {
  const body = JSON.stringify(payload);
  res.writeHead(code, Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers || {}));
  res.end(body);
}
function fail(res, code, errCode, message, extra) {
  send(res, code, { ok: false, error: Object.assign({ code: errCode, message: message }, extra || {}) });
}

function readBody(req) {
  return new Promise(resolve => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(buf || '{}')); } catch (e) { resolve(null); }
    });
  });
}

function validate(cfg, patch) {
  const mode = patch.runMode || cfg.runMode;
  if (!LIMITS[mode]) return { code: 'BAD_REQUEST', message: 'runMode 只能是 test 或 prod' };
  const lim = LIMITS[mode];
  for (const key of ['interval', 'dailySite', 'dailyAll']) {
    if (patch[key] === undefined) continue;
    const n = Number(patch[key]);
    if (!Number.isInteger(n)) return { code: 'BAD_REQUEST', message: key + ' 必须是整数' };
    const [lo, hi] = lim[key];
    if (n < lo || n > hi) return { code: 'OUT_OF_RANGE', message: key + ' 必须在 ' + lo + '–' + hi + ' 之间' };
  }
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8'
};

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  /* *.local.* 是本机数据（真实站点清单等），一律不通过 HTTP 发出去 */
  if (/\.local\.[a-z0-9]+$/i.test(rel) || /(^|\/)\./.test(rel)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('not found');
  }
  const file = path.join(WEB_DIR, rel);
  if (!file.startsWith(WEB_DIR)) return fail(res, 403, 'FORBIDDEN', '越界路径');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      /* 带扩展名的请求按 404 处理，别把 index.html 当 js/css 返回 */
      if (path.extname(rel)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('not found');
      }
      /* 单页应用：未知路径回退到 index.html，由前端 hash 路由接管 */
      const fallback = path.join(WEB_DIR, 'index.html');
      return fs.readFile(fallback, (e2, buf) => {
        if (e2) return fail(res, 404, 'NOT_FOUND', '页面不存在');
        res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache, must-revalidate' });
        res.end(buf);
      });
    }
    const ext = path.extname(file);
    const noCache = ['.html', '.js', '.css'].indexOf(ext) >= 0;
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': noCache ? 'no-cache, must-revalidate' : 'public, max-age=86400'
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- 会话 ---------- */
const SESSIONS = new Map();          // token -> expiresAt
const SESSION_TTL = 12 * 3600 * 1000;

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function sessionUser(req) {
  const tok = parseCookies(req).pta_sid || (req.headers['x-session'] || '');
  if (!tok) return null;
  const exp = SESSIONS.get(tok);
  if (!exp) return null;
  if (exp < Date.now()) { SESSIONS.delete(tok); return null; }
  return { token: tok };
}
function newSession() {
  const tok = crypto.randomBytes(24).toString('hex');
  SESSIONS.set(tok, Date.now() + SESSION_TTL);
  return tok;
}

/* 站点定义里的 login.test.selector 借的是 Cardigann 的写法（如 a[href*="logout.php"]）。
   这里只翻成「页面里有没有这个链接」的正则，够用且不需要 DOM。 */
function selectorToRegex(selector) {
  const s = String(selector || '');
  const m = /\[\s*href\s*([*^$]?)=\s*["']([^"']+)["']\s*\]/i.exec(s);
  if (!m) return null;
  const op = m[1];
  const val = m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (op === '^=') return new RegExp('href=["\'][^"\']*' + val, 'i');
  if (op === '$=') return new RegExp(val + '["\']', 'i');
  if (op === '=') return new RegExp('href=["\']' + val + '["\']', 'i');
  return new RegExp('href=["\'][^"\']*' + val, 'i');
}

function basicAuthOk(req) {
  if (!PTA_USER) return true;
  const h = req.headers.authorization || '';
  if (h.slice(0, 6).toLowerCase() !== 'basic ') return false;
  let raw = '';
  try { raw = Buffer.from(h.slice(6), 'base64').toString('utf8'); } catch (e) { return false; }
  const i = raw.indexOf(':');
  if (i < 0) return false;
  return raw.slice(0, i) === PTA_USER && raw.slice(i + 1) === PTA_PASS;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://local');
  const p = u.pathname;

  if (p === '/api/health') {
    return send(res, 200, { ok: true, data: {
      version: VERSION, uptime: Math.round((Date.now() - STARTED) / 1000),
      db: 'file', loginFail: 0, nodesOnline: 0, nodesTotal: 0
    } });
  }

  const authConfigured = !!(PTA_USER || TOKEN);
  if (authConfigured && p.startsWith('/api/') && p !== '/api/health' && p !== '/api/login') {
    const authed = !!sessionUser(req) || basicAuthOk(req);
    if (!authed) return fail(res, 401, 'UNAUTHORIZED', '需要登录');
  }

  if (p.startsWith('/api/')) {
    if (TOKEN) {
      const auth = req.headers.authorization || '';
      if (auth !== 'Bearer ' + TOKEN) return fail(res, 401, 'UNAUTHORIZED', '令牌缺失或过期');
    }
    if (p === '/api/login' && req.method === 'POST') {
      if (!PTA_USER || !PTA_PASS) return fail(res, 503, 'NO_ACCOUNT', '服务端还没有设置面板账号');
      const body = await readBody(req);
      if (!body || body.user !== PTA_USER || body.pass !== PTA_PASS) {
        logEvent('warn', '登录', '密码错误 · 用户 ' + ((body && body.user) || '(空)') + ' · 来自 ' + clientIp(req));
        return fail(res, 401, 'BAD_CREDENTIALS', '用户名或密码不对');
      }
      logEvent('info', '登录', '登录成功 · 用户 ' + body.user + ' · 来自 ' + clientIp(req));
      const tok = newSession();
      res.setHeader('set-cookie', 'pta_sid=' + tok + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (SESSION_TTL / 1000));
      return send(res, 200, { ok: true, data: { user: PTA_USER, token: tok } });
    }
    if (p === '/api/session' && req.method === 'GET') {
      return send(res, 200, { ok: true, data: { user: PTA_USER } });
    }
    if (p === '/api/logout' && req.method === 'POST') {
      const tok = parseCookies(req).pta_sid;
      if (tok) SESSIONS.delete(tok);
      logEvent('info', '登录', '退出登录 · ' + clientIp(req));
      res.setHeader('set-cookie', 'pta_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
      return send(res, 200, { ok: true, data: {} });
    }
    if (p === '/api/sites' && req.method === 'GET') {
      const list = loadSiteList();
      const counts = { total: list.length, np: 0, unit3d: 0, gz: 0, other: 0, unknown: 0 };
      list.forEach(function (x) {
        if (x.arch === 'NP') counts.np++;
        else if (x.arch === 'UNIT3D') counts.unit3d++;
        else if (x.arch === 'GZ') counts.gz++;
        else if (x.arch === 'OTHER') counts.other++;
        else counts.unknown++;
      });
      return send(res, 200, { ok: true, data: { counts: counts, sites: list } });
    }
    if (p === '/api/credentials' && req.method === 'GET') {
      const all = readCreds();
      const list = Object.keys(all).map(function (h) { return publicCred(Object.assign({ host: h }, all[h])); });
      return send(res, 200, { ok: true, data: list });
    }
    if (p === '/api/credentials/import' && req.method === 'POST') {
      /* 批量导入 cookie：{ cookies: { host: "a=1; b=2" } }，逐条校验，只存合法的 */
      const body = await readBody(req);
      const map = body && body.cookies && typeof body.cookies === 'object' ? body.cookies : null;
      if (!map || Array.isArray(map)) return fail(res, 400, 'BAD_REQUEST', '需要 { cookies: { host: "cookie 字符串" } }');
      const hosts = Object.keys(map);
      if (!hosts.length) return fail(res, 400, 'BAD_REQUEST', 'cookies 是空的');
      if (hosts.length > 500) return fail(res, 400, 'BAD_REQUEST', '一次最多导入 500 个站点');
      const all = readCreds();
      const saved = [], skipped = [];
      for (const host of hosts) {
        const cookie = typeof map[host] === 'string' ? map[host].trim() : '';
        if (!host || host.length > 200 || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) { skipped.push(host + ':域名不合法'); continue; }
        if (!cookie) { skipped.push(host + ':cookie 为空'); continue; }
        if (cookie.length > 4096) { skipped.push(host + ':cookie 太长'); continue; }
        if (!/=/.test(cookie)) { skipped.push(host + ':cookie 里没有等号'); continue; }
        const cur = all[host] || { host: host };
        cur.cookie = secretbox.encrypt(cookie, KEYRING.key);
        cur.updatedAt = new Date().toISOString();
        all[host] = cur;
        saved.push(host);
      }
      if (!saved.length) return fail(res, 400, 'BAD_REQUEST', '没有可保存的 cookie：' + skipped.slice(0, 3).join('；'));
      try { writeCreds(all); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
      logEvent('info', '站点', '批量导入 cookie · 成功 ' + saved.length + ' 站 · 跳过 ' + skipped.length);
      return send(res, 200, { ok: true, data: { saved: saved.length, skipped: skipped.length, hosts: saved.slice(0, 50), reasons: skipped.slice(0, 20) } });
    }
    if (p.startsWith('/api/credentials/')) {
      const host = decodeURIComponent(p.slice('/api/credentials/'.length).replace(/\/+$/, ''));
      if (!host || host.length > 200 || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return fail(res, 400, 'BAD_HOST', '站点域名不合法');
      const all = readCreds();
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readBody(req);
        if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
        const cur = Object.assign({}, all[host] || {});
        let changed = [];
        for (const k of ['cookie']) {
          if (body[k] === undefined) continue;
          const v = String(body[k] || '');
          if (!v) { delete cur[k]; changed.push(k); continue; }
          cur[k] = secretbox.encrypt(v, KEYRING.key);
          changed.push(k);
        }
        cur.updatedAt = new Date().toISOString();
        all[host] = cur;
        try { writeCreds(all); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        if (changed.length) logEvent('info', '站点', '保存凭据 · ' + host + ' · ' + changed.join('/'));
        return send(res, 200, { ok: true, data: publicCred(Object.assign({ host: host }, cur)) });
      }
      if (req.method === 'DELETE') {
        delete all[host];
        try { writeCreds(all); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        logEvent('info', '站点', '删除凭据 · ' + host);
        return send(res, 200, { ok: true, data: { host: host } });
      }
      return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 PUT / DELETE');
    }
    if (p.startsWith('/api/sites/') && /\/session-test\/?$/.test(p)) {
      if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 POST');
      const h2 = decodeURIComponent(p.slice('/api/sites/'.length).replace(/\/session-test\/?$/, ''));
      if (!h2 || !/^[a-z0-9][a-z0-9.-]*$/i.test(h2)) return fail(res, 400, 'BAD_HOST', '站点域名不合法');
      const r2 = await sessionCheckOnce(h2);
      if (r2.err) return fail(res, 400, r2.err.code, r2.err.message);
      writeSiteStatus(h2, { at: new Date().toISOString(), pass: !!r2.pass, engine: r2.engine || '' });
      return send(res, 200, { ok: true, data: r2 });
    }
    if (p === '/api/flow' && req.method === 'GET') {
      const flow = readFlow();
      return send(res, 200, { ok: true, data: flow || { sets: null, updatedAt: null } });
    }
    if (p === '/api/flow' && (req.method === 'PUT' || req.method === 'POST')) {
      const body = await readBody(req);
      if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
      let r;
      try { r = sanitizeFlow(body); } catch (e) { return fail(res, 400, 'BAD_REQUEST', e.message); }
      if (r.err) return fail(res, 400, r.err.code, r.err.message);
      const prev = readFlow();
      const merged = Object.assign({}, (prev && prev.sets) || {}, r.sets);
      try { writeFlow(merged); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
      const keys = Object.keys(r.sets || {});
      logEvent('info', '流程', '保存流程规则 · ' + (keys.join('/') || '空'));
      return send(res, 200, { ok: true, data: { sets: merged, updatedAt: new Date().toISOString() } });
    }
    if (p === '/api/site-search' && req.method === 'GET') {
      const sites = readSearchPresets();
      const out = {};
      Object.keys(sites).forEach(function (h) {
        const s = sites[h] || {};
        const cats = s.cats && typeof s.cats === 'object' ? s.cats : {};
        let ids = 0;
        Object.keys(cats).forEach(function (k) { ids += (cats[k] || []).length; });
        out[h] = {
          engine: s.engine || "", source: s.source || "", updatedAt: s.updatedAt || "",
          groups: Object.keys(cats).length, ids: ids,
          confirmed: s.confirmed === true || s.source === 'manual' || s.source === 'probe'
        };
      });
      return send(res, 200, { ok: true, data: out });
    }
    if (p === '/api/stats/overview' && req.method === 'GET') {
      /* 面板「系统状态」用的真实数字：站点来自清单与自检记录，下载器来自上次探测 */
      const sites = loadSiteList();
      const siteCfg = (readSiteCfg().sites || {});
      const status = readSiteStatus();
      let enabled = 0, loginOk = 0, loginFail = 0, loginUnknown = 0, checked = 0;
      sites.forEach(function (x) {
        const h = x.host;
        if (siteCfg[h] && siteCfg[h].enabled === false) return;
        enabled++;
        const st = status[h];
        if (!st) { loginUnknown++; return; }
        checked++;
        if (st.pass) loginOk++; else loginFail++;
      });
      const dls = readDl().items;
      let online = 0, freeSpace = 0, lastAt = '', version = '';
      dls.forEach(function (d) {
        const lp = d.lastProbe || null;
        if (lp && lp.pass) { online++; freeSpace += Number(lp.freeSpace) || 0; }
        if (lp && lp.at && lp.at > lastAt) { lastAt = lp.at; version = lp.version || ''; }
      });
      const q = readQueue();
      const counts = {};
      (q.items || []).forEach(function (x) { counts[x.status] = (counts[x.status] || 0) + 1; });
      let active = 0;
      TASKS.forEach(function (t) { if (t && (t.state === 'queued' || t.state === 'running')) active++; });
      /* 今日抓取次数：从 crawl-state 汇总，面板上直接看配额用了多少 */
      const cs = readCrawlState();
      const today = new Date().toISOString().slice(0, 10);
      let runsToday = 0, hostsToday = 0, lastCrawlAt = 0;
      Object.keys(cs).forEach(function (h) {
        const r = cs[h] || {};
        if (r.day === today) { runsToday += Number(r.count) || 0; hostsToday++; }
        if ((r.lastAt || 0) > lastCrawlAt) lastCrawlAt = r.lastAt || 0;
      });
      return send(res, 200, {
        ok: true,
        data: {
          sites: { total: sites.length, enabled: enabled, loginOk: loginOk, loginFail: loginFail, loginUnknown: loginUnknown, checked: checked },
          downloaders: { total: dls.length, online: online, offline: dls.length - online, freeSpace: freeSpace, version: version, lastAt: lastAt || null },
          crawl: { runsToday: runsToday, hostsToday: hostsToday, lastAt: lastCrawlAt || null, dailyMax: CRAWL_DAILY_MAX },
          queue: { total: (q.items || []).length, counts: counts },
          library: { total: readLibrary().length },
          catalog: catalogStore.summary(),
          tasks: { active: active },
          updatedAt: new Date().toISOString()
        }
      });
    }
    if (p === '/api/site-defs' && req.method === 'GET') {
      const list = [];
      const crawlState = readCrawlState();
      const today0 = new Date().toISOString().slice(0, 10);
      let files = [];
      try { files = fs.readdirSync(DEF_DIR); } catch (e) { files = []; }
      files.filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(DEF_DIR, f), 'utf8'));
          const cats = d.cats || {};
          const host = d.host || f.replace(/\.json$/, '');
          let ids = 0;
          Object.keys(cats).forEach(function (k) { ids += (cats[k] || []).length; });
          const cr = crawlState[host] || null;
          list.push({
            host: host, engine: d.engine || '',
            groups: Object.keys(cats).length, ids: ids,
            rows: (d.source && d.source.rows) || 0, sizeRows: (d.source && d.source.sizeRows) || 0,
            kind: (d.source && d.source.kind) || '',
            cats: cats,
            updatedAt: (d.source && d.source.analyzedAt) || null,
            crawlAt: cr ? (cr.lastAt || 0) : 0,
            crawlCount: cr && cr.day === today0 ? (cr.count || 0) : 0,
            crawled: !!(cr && cr.lastAt)
          });
        } catch (e) {}
      });
      list.sort(function (a, b) { return String(a.host).localeCompare(String(b.host)); });
      return send(res, 200, { ok: true, data: list, total: list.length, engines: adapters.names() });
    }
    if (p.startsWith('/api/site-def/') && req.method === 'GET') {
      const host = decodeURIComponent(p.slice('/api/site-def/'.length)).replace(/\/+$/, '');
      if (!host || host.length > 200 || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return fail(res, 400, 'BAD_HOST', '站点域名不合法');
      const def = readSiteDef(host);
      if (!def) return fail(res, 404, 'NO_DEF', '这个站还没有站点定义');
      const rec = readCrawlState()[host] || null;
      const cat = catalogStore.list({ site: host, limit: 1 });
      return send(res, 200, { ok: true, data: Object.assign({}, def, {
        crawl: rec ? { at: rec.lastAt || 0, count: rec.count || 0, page: rec.page || 0,
          catIdx: rec.catIdx || 0, catId: rec.catId || '', day: rec.day || '' } : null,
        catalog: { total: cat.total, byStatus: cat.byStatus }
      }) });
    }
    if (p.startsWith('/api/sites/') && /\/search\/?$/.test(p)) {
      const host = decodeURIComponent(p.slice('/api/sites/'.length).replace(/\/search\/?$/, '').replace(/\/+$/, ''));
      if (!host || host.length > 200 || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) {
        return fail(res, 400, 'BAD_HOST', '站点域名不合法');
      }
      const sites = readSearchPresets();
      if (req.method === 'GET') {
        /* 顺手拼几条真实搜索链接，方便在浏览器里点开核对预设；不在这里发任何请求 */
        const preset = sites[host] || null;
        const def = readSiteDef(host);
        const qs = String((new URL(req.url, 'http://local')).searchParams.get('q') || '{q}').slice(0, 120);
        const urls = [];
        if (def && def.base && preset) {
          const cats = (preset.cats && typeof preset.cats === 'object') ? preset.cats : {};
          const merged = Object.assign({}, def, {
            params: preset.params || def.params,
            catMode: preset.catMode || def.catMode,
            catSlot: preset.catSlot || def.catSlot
          });
          Object.keys(cats).forEach(function (g) {
            const ids = Array.isArray(cats[g]) ? cats[g] : [];
            (ids.length ? ids.slice(0, 3) : [null]).forEach(function (id) {
              if (urls.length >= 8) return;
              urls.push({ group: g, catId: id, url: adapters.buildSearchUrl(merged, qs, id ? [id] : []) });
            });
          });
          if (!urls.length) urls.push({ group: '', catId: null, url: adapters.buildSearchUrl(merged, qs, []) });
        }
        return send(res, 200, { ok: true, data: { host: host, preset: preset, engines: SEARCH_ENGINES, urls: urls } });
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readBody(req);
        const s = sanitizePreset(body);
        if (s.err) return fail(res, 400, s.err.code, s.err.message);
        const next = Object.assign({}, sites[host] || {}, s.preset, { updatedAt: new Date().toISOString() });
        sites[host] = next;
        try { writeSearchPresets(sites); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        logEvent('info', '站点', '更新搜索预设 · ' + host + ' · ' + (next.engine || '未填引擎'));
        return send(res, 200, { ok: true, data: { host: host, preset: next } });
      }
      if (req.method === 'DELETE') {
        delete sites[host];
        try { writeSearchPresets(sites); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        logEvent('info', '站点', '删除搜索预设 · ' + host);
        return send(res, 200, { ok: true, data: { host: host } });
      }
      return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 GET / PUT / DELETE');
    }
    if (p === '/api/site-config' && req.method === 'GET') {
      const cfg = readSiteCfg();
      return send(res, 200, { ok: true, data: { sites: cfg.sites, hidden: cfg.hidden, fields: SITE_FIELDS } });
    }
    if (p.startsWith('/api/site-config/')) {
      const host = decodeURIComponent(p.slice('/api/site-config/'.length)).replace(/^\/+|\/+$/g, '');
      if (!host || host.length > 200 || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) {
        return fail(res, 400, 'BAD_HOST', '站点域名不合法');
      }
      const cfg = readSiteCfg();
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readBody(req);
        const s = sanitizeSitePatch(body);
        if (s.err) return fail(res, 400, s.err.code, s.err.message);
        const prev = cfg.sites[host] || {};
        const next = Object.assign({}, prev, s.patch);
        const changed = Object.keys(s.patch).filter(function (k) {
          return JSON.stringify(prev[k]) !== JSON.stringify(next[k]);
        });
        cfg.sites[host] = next;
        cfg.hidden = cfg.hidden.filter(function (h) { return h !== host; });
        try { writeSiteCfg(cfg); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        if (changed.length) {
          logEvent('info', '站点', '更新站点配置 · ' + host + ' · ' + changed.slice(0, 6).join('/') +
            (changed.length > 6 ? ' 等 ' + changed.length + ' 项' : ''));
        }
        return send(res, 200, { ok: true, data: { host: host, config: next, changed: changed, dropped: s.dropped } });
      }
      if (req.method === 'DELETE') {
        delete cfg.sites[host];
        cfg.hidden = cfg.hidden.filter(function (h) { return h !== host; });
        try { writeSiteCfg(cfg); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        logEvent('info', '站点', '恢复默认站点配置 · ' + host);
        return send(res, 200, { ok: true, data: { host: host } });
      }
      return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 PUT 与 DELETE');
    }
    if (p === '/api/config' && req.method === 'GET') {
      return send(res, 200, { ok: true, data: { sys: {
        concurrency: 1, minInterval: 8, retry: 3, backoff: 30, breaker: 15, audit: true
      }, user: readConfig(), limits: LIMITS } });
    }
    if (p === '/api/config/user' && (req.method === 'PATCH' || req.method === 'POST')) {
      const body = await readBody(req);
      if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
      const cfg = readConfig();
      const err = validate(cfg, body);
      if (err) return fail(res, 400, err.code, err.message);
      const next = Object.assign({}, cfg);
      if (body.runMode) next.runMode = body.runMode;
      ["interval", "dailySite", "dailyAll"].forEach(function (k) {
        if (body[k] !== undefined) next[k] = Number(body[k]);
      });
      const changes = Object.keys(next).filter(function (k) { return cfg[k] !== next[k]; })
        .map(function (k) { return k + ' ' + cfg[k] + '→' + next[k]; });
      try {
        writeConfig(next);
      } catch (e) {
        return fail(res, 500, e.code || "INTERNAL", e.message);
      }
      if (changes.length) logEvent('info', '设置', '修改配置 · ' + changes.join(' · '));
      return send(res, 200, { ok: true, data: next });
    }
    if (p === '/api/downloaders' && req.method === 'GET') {
      const d = readDl();
      return send(res, 200, { ok: true, data: d.items.map(publicDl) });
    }
    if (p === '/api/downloaders' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
      const s = sanitizeDl(body, {});
      if (s.err) return fail(res, 400, s.err.code, s.err.message);
      if (!s.dl.url) return fail(res, 400, 'BAD_REQUEST', 'url 必填');
      const store = readDl();
      const item = Object.assign(s.dl, { id: 'dl_' + String(++store.seq).padStart(3, '0') });
      store.items.push(item);
      try { writeDl(store); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
      logEvent('info', '下载器', '新增下载器 · ' + (item.name || item.url));
      return send(res, 200, { ok: true, data: publicDl(item) });
    }
    if (p.startsWith('/api/downloaders/')) {
      const rest = p.slice('/api/downloaders/'.length).replace(/\/+$/, '');
      const test = /\/test$/.test(rest);
      const id = decodeURIComponent(test ? rest.replace(/\/test$/, '') : rest);
      const store = readDl();
      const idx = store.items.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return fail(res, 404, 'NOT_FOUND', '下载器不存在');
      if (test) {
        if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 POST');
        const r = await probeDownloader(store.items[idx]);
        /* 探测结果落盘：磁盘余量这类实时数据下次打开面板就能显示，不用再探一次 */
        store.items[idx].lastProbe = {
          at: new Date().toISOString(), pass: !!r.pass, version: r.version || '',
          freeSpace: Number(r.freeSpace) || 0, savePath: r.savePath || ''
        };
        try { writeDl(store); } catch (e) {}
        logEvent(r.pass ? 'info' : 'warn', '下载器', '连通性探测 · ' + (store.items[idx].name || store.items[idx].url) + ' · ' + (r.pass ? '通过 ' + r.version : '失败'));
        return send(res, 200, { ok: true, data: r });
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readBody(req);
        if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
        const s = sanitizeDl(body, store.items[idx]);
        if (s.err) return fail(res, 400, s.err.code, s.err.message);
        store.items[idx] = s.dl;
        try { writeDl(store); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        logEvent('info', '下载器', '修改下载器 · ' + (s.dl.name || s.dl.url));
        return send(res, 200, { ok: true, data: publicDl(s.dl) });
      }
      if (req.method === 'DELETE') {
        const gone = store.items.splice(idx, 1)[0];
        try { writeDl(store); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        logEvent('info', '下载器', '删除下载器 · ' + (gone.name || gone.url));
        return send(res, 200, { ok: true, data: { id: id } });
      }
      if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 GET / PUT / DELETE');
      return send(res, 200, { ok: true, data: publicDl(store.items[idx]) });
    }
    if (p === '/api/library' && req.method === 'GET') {
      return send(res, 200, { ok: true, data: readLibrary() });
    }
    if (p === '/api/library' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
      const title = String(body.title || '').trim();
      if (!title || title.length > 300) return fail(res, 400, 'BAD_REQUEST', 'title 必填且不超过 300 字');
      const items = readLibrary();
      const entry = {
        id: 'lib_' + String(items.length + 1).padStart(4, '0'),
        title: title, cn: body.cn ? String(body.cn).slice(0, 120) : '',
        year: body.year ? Number(body.year) || 0 : 0, res: body.res ? String(body.res).slice(0, 20) : '',
        size: body.size ? String(body.size).slice(0, 40) : '', site: body.site ? String(body.site).slice(0, 120) : '',
        sizeBytes: body.sizeBytes ? Number(body.sizeBytes) || 0 : 0,
        infohash: body.infohash ? String(body.infohash).toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 40) : '',
        addedAt: new Date().toISOString()
      };
      items.push(entry);
      if (items.length > 2000) items.splice(0, items.length - 2000);
      try { writeLibrary(items); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
      logEvent('info', '查重', '本地库新增 · ' + title.slice(0, 60));
      return send(res, 200, { ok: true, data: entry });
    }
    if (p.startsWith('/api/library/') && req.method === 'DELETE') {
      const id = decodeURIComponent(p.slice('/api/library/'.length).replace(/\/+$/, ''));
      const items = readLibrary();
      const i = items.findIndex(function (x) { return x.id === id; });
      if (i < 0) return fail(res, 404, 'NOT_FOUND', '条目不存在');
      const gone = items.splice(i, 1)[0];
      try { writeLibrary(items); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
      logEvent('info', '查重', '本地库删除 · ' + String(gone.title).slice(0, 60));
      return send(res, 200, { ok: true, data: { id: id } });
    }
    /* ---------- 抓取：计划与执行 ---------- */
    if (p === '/api/crawl/plan' && req.method === 'POST') {
      const body = await readBody(req);
      const host = String((body && body.host) || '').trim().toLowerCase();
      if (!host) return fail(res, 400, 'BAD_REQUEST', '缺少 host');
      const plan = crawlPlan(host);
      if (plan.err) return fail(res, plan.err.code === 'NO_COOKIE' ? 409 : 400, plan.err.code, plan.err.message);
      return send(res, 200, { ok: true, data: plan });
    }
    if (p === '/api/crawl/status' && req.method === 'GET') {
      const host = String(u.searchParams.get('host') || '').trim().toLowerCase();
      if (!host) return fail(res, 400, 'BAD_REQUEST', '缺少 host');
      const rec = readCrawlState()[host] || { lastAt: 0, day: '', count: 0, page: 0 };
      const now = Date.now();
      return send(res, 200, { ok: true, data: {
        host: host, lastAt: rec.lastAt || 0, day: rec.day || '', count: rec.count || 0,
        page: rec.page || 0, lastRows: rec.lastRows || 0, catIdx: rec.catIdx || 0, catId: rec.catId || '',
        dailyMax: CRAWL_DAILY_MAX, minGapMs: CRAWL_MIN_GAP_MS,
        waitMs: Math.max(0, CRAWL_MIN_GAP_MS - (now - (rec.lastAt || 0))),
        leftToday: Math.max(0, CRAWL_DAILY_MAX - (rec.day === new Date().toISOString().slice(0, 10) ? (rec.count || 0) : 0))
      } });
    }
    if (p === '/api/crawl/run' && req.method === 'POST') {
      const body = await readBody(req);
      const host = String((body && body.host) || '').trim().toLowerCase();
      if (!host) return fail(res, 400, 'BAD_REQUEST', '缺少 host');
      const out = await crawlOnce(host, { page: body && body.page, limit: body && body.limit });
      if (out.err) {
        const code = out.err.code;
        const status = code === 'TOO_SOON' || code === 'DAILY_LIMIT' ? 429 : (code === 'NO_COOKIE' || code === 'LOGIN_REQUIRED' || code === 'BUSY') ? 409 : 400;
        return fail(res, status, code, out.err.message, out.err.extra);
      }
      return send(res, 200, { ok: true, data: out });
    }
    /* ---------- 词条库：第一步抓取的结果 ---------- */
    if (p === '/api/published' && req.method === 'GET') {
      const items = readPublished();
      return send(res, 200, { ok: true, data: { total: items.length, items: items.slice(0, 100) } });
    }
    if (p === '/api/publish/preview' && req.method === 'GET') {
      const id = u.searchParams.get('id') || '';
      const item = readQueue().items.filter(function (x) { return x.id === id; })[0];
      const draft = composePublish(item);
      if (draft.err) return fail(res, draft.err.code === 'NOT_FOUND' ? 404 : 400, draft.err.code, draft.err.message);
      return send(res, 200, { ok: true, data: draft });
    }
    if (p === '/api/catalog/bulk' && req.method === 'POST') {
      const body = await readBody(req);
      const status = String((body && body.status) || '');
      if (catalog.STATUSES.indexOf(status) < 0) return fail(res, 400, 'BAD_REQUEST', 'status 只能是 ' + catalog.STATUSES.join(' / '));
      const ids = Array.isArray(body && body.ids) ? body.ids.map(String) : [];
      const from = String((body && body.fromStatus) || '');
      const host = String((body && body.host) || '').trim().toLowerCase();
      if (!ids.length && !from) return fail(res, 400, 'BAD_REQUEST', '要么给 ids，要么给 fromStatus');
      const all = catalogStore.list({ status: from || '', limit: 5000 }).items;
      const want = ids.length ? ids : all.filter(function (x) { return !host || x.site === host; }).map(function (x) { return x.id; });
      let changed = 0;
      want.slice(0, 1000).forEach(function (id) {
        const r = catalogStore.setStatus(id, status);
        if (!r.err) changed++;
      });
      logEvent('info', '词条库', '批量改为 ' + status + ' · ' + changed + ' 条');
      return send(res, 200, { ok: true, data: { changed: changed, status: status } });
    }
    if (p === '/api/catalog/screen' && req.method === 'POST') {
      const body = await readBody(req);
      const out = screenCatalog(body || {});
      return send(res, 200, { ok: true, data: out });
    }
    if (p === '/api/catalog' && req.method === 'GET') {
      const data = catalogStore.list({
        q: u.searchParams.get('q') || '',
        status: u.searchParams.get('status') || '',
        site: u.searchParams.get('site') || '',
        limit: u.searchParams.get('limit') || 50,
        offset: u.searchParams.get('offset') || 0
      });
      return send(res, 200, { ok: true, data: data });
    }
    if (p === '/api/catalog' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
      const items = Array.isArray(body) ? body : body.items;
      if (!Array.isArray(items)) return fail(res, 400, 'BAD_REQUEST', 'items 必须是数组');
      let out;
      try { out = catalogStore.add(items); } catch (e) { return fail(res, 500, 'INTERNAL', '写入词条库失败：' + e.message); }
      logEvent('info', '词条库', '导入 ' + out.added + ' 条 · 更新 ' + out.updated + ' 条 · 跳过 ' + out.skipped + ' 条');
      return send(res, 200, { ok: true, data: out });
    }
    if (p.startsWith('/api/catalog/')) {
      const rest = decodeURIComponent(p.slice('/api/catalog/'.length).replace(/\/+$/, ''));
      const isStatus = /\/status$/.test(rest);
      const isMarks = /\/marks$/.test(rest);
      const id = isStatus ? rest.replace(/\/status$/, '') : isMarks ? rest.replace(/\/marks$/, '') : rest;
      if (!id) return fail(res, 400, 'BAD_REQUEST', '缺少词条 id');
      if (isMarks) {
        if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 POST');
        const body = await readBody(req);
        const r = catalogStore.setMarks(id, (body && body.marks) || {});
        if (r.err) return fail(res, /不存在/.test(r.err) ? 404 : 400, /不存在/.test(r.err) ? 'NOT_FOUND' : 'BAD_REQUEST', r.err);
        logEvent('info', '词条库', '改标记 · ' + String(r.item.title).slice(0, 60) + ' · ' + Object.keys(r.item.marks || {}).join(','));
        return send(res, 200, { ok: true, data: r.item });
      }
      if (isStatus) {
        if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 POST');
        const body = await readBody(req);
        const r = catalogStore.setStatus(id, String((body && body.status) || ''));
        if (r.err) return fail(res, /不存在/.test(r.err) ? 404 : 400, /不存在/.test(r.err) ? 'NOT_FOUND' : 'BAD_REQUEST', r.err);
        logEvent('info', '词条库', '状态改为 ' + r.item.status + ' · ' + String(r.item.title).slice(0, 60));
        return send(res, 200, { ok: true, data: r.item });
      }
      if (req.method === 'DELETE') {
        const r = catalogStore.remove(id);
        if (r.err) return fail(res, 404, 'NOT_FOUND', r.err);
        return send(res, 200, { ok: true, data: { id: id } });
      }
      return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 POST /status 或 DELETE');
    }
    if (p === '/api/queue' && req.method === 'GET') {
      const status = u.searchParams.get('status') || '';
      const limit = Math.min(Number(u.searchParams.get('limit') || 100) || 100, 500);
      const q = readQueue();
      const items = q.items.filter(function (x) { return !status || x.status === status; }).slice(0, limit);
      return send(res, 200, { ok: true, data: { items: items, counts: queueCounts(q.items) } });
    }
    if (p === '/api/queue' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
      const r = createQueueItem(body);
      if (r.err) return fail(res, r.err.code === 'BAD_REQUEST' ? 400 : 500, r.err.code, r.err.message);
      return send(res, 200, { ok: true, data: r.item });
    }
    if (p === '/api/queue/bulk' && req.method === 'POST') {
      const body = await readBody(req);
      const action = String((body && body.action) || '');
      if (action !== 'approve' && action !== 'reject' && action !== 'publish') return fail(res, 400, 'BAD_REQUEST', 'action 只能是 approve / reject / publish');
      const reason = String((body && body.reason) || '').slice(0, 500);
      if (action === 'reject' && !reason.trim()) return fail(res, 400, 'BAD_REQUEST', '批量驳回要写理由');
      const ids = Array.isArray(body && body.ids) ? body.ids.map(String) : [];
      const fromStatus = String((body && body.fromStatus) || 'pending');
      const q = readQueue();
      const want = ids.length ? ids : q.items.filter(function (x) { return x.status === fromStatus; }).map(function (x) { return x.id; });
      let changed = 0, skipped = 0;
      want.slice(0, 200).forEach(function (id) {
        const r = queueAction(id, { action: action, reason: reason });
        if (r.err) { skipped++; return; }
        changed++;
      });
      return send(res, 200, { ok: true, data: { changed: changed, skipped: skipped, action: action } });
    }
    if (p.startsWith('/api/queue/')) {
      const rest = p.slice('/api/queue/'.length).replace(/\/+$/, '');
      if (/\/check$/.test(rest)) {
        if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 POST');
        const cid = decodeURIComponent(rest.replace(/\/check$/, ''));
        const q = readQueue();
        const item = q.items.filter(function (x) { return x.id === cid; })[0];
        if (!item) return fail(res, 404, 'NOT_FOUND', '条目不存在');
        const pool = q.items.concat(readLibrary().map(function (x) { return Object.assign({ source: 'library' }, x); }));
        const matches = findDuplicates(item, pool);
        item.check = matches.length ? '已有同片 · ' + (matches[0].site || matches[0].source || '本地') : '无重复';
        item.checkCls = matches.length ? 'amber' : 'green';
        item.checkedAt = new Date().toISOString();
        try { writeQueue(q); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        logEvent(matches.length ? 'warn' : 'info', '查重', (item.title || item.id).slice(0, 60) + ' · ' + (matches.length ? '发现 ' + matches.length + ' 条重复' : '无重复'));
        return send(res, 200, { ok: true, data: { item: item, duplicate: matches.length > 0, matches: matches } });
      }
      const act = /\/action$/.test(rest);
      const id = decodeURIComponent(act ? rest.replace(/\/action$/, '') : rest);
      if (!id) return fail(res, 400, 'BAD_REQUEST', '缺少条目 id');
      if (act) {
        if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 POST');
        const body = await readBody(req);
        const r = queueAction(id, body);
        if (r.err) return fail(res, r.err.code === 'NOT_FOUND' ? 404 : (r.err.code === 'BAD_STATE' || r.err.code === 'PUBLISH_BLOCKED') ? 409 : 400, r.err.code, r.err.message, r.err.extra);
        return send(res, 200, { ok: true, data: r.item });
      }
      if (req.method === 'DELETE') {
        const q = readQueue();
        const i = q.items.findIndex(function (x) { return x.id === id; });
        if (i < 0) return fail(res, 404, 'NOT_FOUND', '条目不存在');
        const gone = q.items.splice(i, 1)[0];
        try { writeQueue(q); } catch (e) { return fail(res, 500, e.code || 'INTERNAL', e.message); }
        logEvent('info', '待审核', '删除条目 · ' + (gone.title || id).slice(0, 60));
        return send(res, 200, { ok: true, data: { id: id } });
      }
      if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 GET / DELETE');
      const q = readQueue();
      const one = q.items.filter(function (x) { return x.id === id; })[0];
      if (!one) return fail(res, 404, 'NOT_FOUND', '条目不存在');
      return send(res, 200, { ok: true, data: one });
    }
    if (p === '/api/tasks' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body) return fail(res, 400, 'BAD_REQUEST', '请求体不是合法 JSON');
      const r = createTask(body);
      if (r.err) return fail(res, r.err.code === 'BUSY' ? 409 : r.err.code === 'DRY_RUN_ONLY' ? 501 : 400, r.err.code, r.err.message, r.err.extra);
      return send(res, 200, { ok: true, data: taskPublic(r.task) });
    }
    if (p === '/api/tasks' && req.method === 'GET') {
      const active = u.searchParams.get('state') === 'active';
      const list = Array.from(TASKS.values())
        .filter(function (t) { return !active || t.state === 'queued' || t.state === 'running'; })
        .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })
        .slice(0, 50)
        .map(taskPublic);
      return send(res, 200, { ok: true, data: list });
    }
    if (p.startsWith('/api/tasks/')) {
      const rest = p.slice('/api/tasks/'.length).replace(/\/+$/, '');
      const cancel = /\/cancel$/.test(rest);
      const id = decodeURIComponent(cancel ? rest.replace(/\/cancel$/, '') : rest);
      const t = TASKS.get(id);
      if (!t) return fail(res, 404, 'NOT_FOUND', '任务不存在');
      if (cancel) {
        if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 POST');
        if (t.state === 'queued' || t.state === 'running') {
          if (t.timer) clearInterval(t.timer);
          t.state = 'canceled';
          t.finishedAt = new Date().toISOString();
          logEvent('warn', '任务', '手动取消 · ' + t.siteHost + ' · ' + t.id);
        }
        return send(res, 200, { ok: true, data: taskPublic(t) });
      }
      if (req.method !== 'GET') return fail(res, 405, 'METHOD_NOT_ALLOWED', '只支持 GET');
      return send(res, 200, { ok: true, data: taskPublic(t) });
    }
    if (p === '/api/logs' && req.method === 'GET') {
      const limit = Math.min(Number(u.searchParams.get('limit') || 100) || 100, 500);
      const level = (u.searchParams.get('level') || '').trim();
      const src = (u.searchParams.get('src') || '').trim();
      const since = Number(u.searchParams.get('since') || 0) || 0;
      let rows = LOG_RING.filter(function (e) {
        if (level && e.level !== level) return false;
        if (src && String(e.src || '').indexOf(src) < 0) return false;
        if (since && e.id <= since) return false;
        return true;
      });
      rows = rows.slice(-limit);
      return send(res, 200, { ok: true, data: rows, meta: { total: LOG_RING.length, filtered: rows.length, level: level, src: src, logMax: LOG_MAX } });
    }
    if (p === '/api/logs/stream' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write('retry: 3000\n\n');
      const last = Number(u.searchParams.get('last') || req.headers['last-event-id'] || 0) || 0;
      LOG_RING.filter(function (e) { return e.id > last; }).forEach(function (e) {
        res.write('id: ' + e.id + '\ndata: ' + JSON.stringify(e) + '\n\n');
      });
      SSE_CLIENTS.add(res);
      const ping = setInterval(function () { try { res.write(': ping\n\n'); } catch (e) {} }, 15000);
      req.on('close', function () { clearInterval(ping); SSE_CLIENTS.delete(res); });
      return;
    }
    return fail(res, 404, 'NOT_FOUND', '接口不存在：' + p);
  }

  return serveStatic(req, res, p);
});

LOG_RING.push.apply(LOG_RING, loadRecentLogs(200));
logEvent('info', '服务', '服务启动 v' + VERSION + ' · 端口 ' + PORT + ' · 数据目录 ' + DATA_DIR);
try {
  const q = readQueue();
  const d = readDl();
  const sites = loadSiteList();
  const presets = Object.keys(readSearchPresets()).length;
  logEvent('info', '服务', '数据概览 · 站点 ' + sites.length + ' · 待审核 ' + q.items.length +
    ' · 下载器 ' + d.items.length + ' · 搜索预设 ' + presets);
} catch (e) {
  logEvent('warn', '服务', '数据概览读取失败：' + e.message);
}

server.listen(PORT, () => {
  console.log('SEEDPOD 服务已启动 http://0.0.0.0:' + PORT + '  数据目录 ' + DATA_DIR +
    (PTA_USER ? '  已开启面板密码' : '  未设面板密码') + (TOKEN ? ' · API 令牌已开' : ''));
});
