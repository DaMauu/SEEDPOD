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
  const file = path.join(WEB_DIR, 'assets', 'sites-data.local.js');
  const sandbox = { window: {} };
  try {
    const code = fs.readFileSync(file, 'utf8');
    vm.runInNewContext(code, sandbox, { timeout: 1000 });
    const urls = (sandbox.window.SITE_URLS || []).slice();
    const arch = sandbox.window.PT_ARCH || {};
    const seen = {};
    return urls.map(function (u) {
      const host = String(u).replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
      return { host, url: u, arch: arch[host] || '?' };
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
    if (['manual', 'probe'].indexOf(String(body.source)) < 0) return { err: { code: 'BAD_REQUEST', message: 'source 只能是 manual 或 probe' } };
    preset.source = String(body.source);
  }
  return { preset };
}

/* ---------- 待审核台：服务端状态机（pending -> approved/rejected -> published） ---------- */
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');
const QUEUE_ACTIONS = { approve: 'approved', reject: 'rejected', publish: 'published' };
const QUEUE_FLOW = {
  pending: ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  rejected: [],
  published: []
};
const QUEUE_FIELDS = ['title', 'cn', 'year', 'res', 'size', 'imdb', 'site', 'check', 'checkCls', 'note'];

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
    item.shots = body.shots.slice(0, 12).map(function (s) { return String(s).slice(0, 500); });
  }
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
  if (action === 'reject' && !reason.trim()) return { err: { code: 'BAD_REQUEST', message: '驳回必须写理由' } };
  if (action === 'publish') {
    const blockers = [];
    const site = String(item.site || '').trim();
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
  return { id: d.id, name: d.name || '', url: d.url, user: d.user || '', hasPass: !!d.pass, disableAuth: !!d.disableAuth };
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
    return { pass: pass, version: pass ? version : '', steps: steps };
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

  return {
    siteHost: host,
    runMode: cfg.runMode,
    interval: interval,
    pages: pages,
    concurrency: concurrency,
    engine: preset && preset.engine ? preset.engine : '',
    catGroups: groups.length,
    catIds: ids,
    estimatedQueries: groups.length * pages,
    knownCats: groups,
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
          groups: Object.keys(cats).length, ids: ids
        };
      });
      return send(res, 200, { ok: true, data: out });
    }
    if (p.startsWith('/api/sites/') && /\/search\/?$/.test(p)) {
      const host = decodeURIComponent(p.slice('/api/sites/'.length).replace(/\/search\/?$/, '').replace(/\/+$/, ''));
      if (!host || host.length > 200 || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) {
        return fail(res, 400, 'BAD_HOST', '站点域名不合法');
      }
      const sites = readSearchPresets();
      if (req.method === 'GET') {
        return send(res, 200, { ok: true, data: { host: host, preset: sites[host] || null, engines: SEARCH_ENGINES } });
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
    if (p.startsWith('/api/queue/')) {
      const rest = p.slice('/api/queue/'.length).replace(/\/+$/, '');
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
