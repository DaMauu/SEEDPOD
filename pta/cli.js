#!/usr/bin/env node
/* SEEDPOD CLI：走 v2 HTTP API，不直接碰数据库。
   默认干跑；--real 才真抓/真发。凭据只从环境读，不打印。 */
const RAW_BASE = String(process.env.PTA_BASE || '').replace(/\/+$/, '');
const USE_HTTP = !!RAW_BASE || process.argv.includes('--http');
const BASE = RAW_BASE || 'http://127.0.0.1:8080';
const ENV = process.env;
let CORE = null;
function core() {
  if (!CORE) CORE = require('./core').createCore();
  return CORE;
}
let cookie = ENV.PTA_COOKIE || '';
let logged = false;

function usage() {
  console.log(`SEEDPOD CLI

用法：
  pta status [--json]
  pta queue [--status pending] [--limit 50] [--json]
  pta crawl --site <host> [--limit 100] [--real] [--json]
  pta screen [--limit 50] [--host <host>] [--json]
  pta prepare <queueId> [--host <target>] [--torrent file] [--json]
  pta preview <queueId> [--json]
  pta advance <queueId> [--json]
  pta run --stage prepared|previewed [--limit 20] [--json]
  pta publish <queueId> [--real] [--json]
  pta targets [--json]
  pta target-upload <queueId> --host <target> [--real] [--torrent file] [--json]
  pta verify <queueId> --host <target> [--url url] [--torrent file] [--json]

环境：
  默认直接读本地 SQLite（不启后端）；设置 PTA_BASE 或加 --http 才走 HTTP。
  PTA_BASE   HTTP 模式地址，默认 http://127.0.0.1:8080
  PTA_USER / PTA_PASS   面板账号（或 PTA_COOKIE 直接给会话）
  --real 才真抓/真发；默认干跑。`);
}
function die(msg, code) {
  console.error(msg);
  process.exit(code || 1);
}
async function login() {
  if (!USE_HTTP) return;
  if (cookie || logged) return;
  if (!ENV.PTA_USER || !ENV.PTA_PASS) die('需要 PTA_USER / PTA_PASS（或 PTA_COOKIE）', 2);
  const r = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: ENV.PTA_USER, pass: ENV.PTA_PASS })
  });
  const sc = r.headers.get('set-cookie') || '';
  cookie = sc.split(';')[0];
  if (!r.ok || !cookie) die('登录失败：' + r.status, 2);
  logged = true;
}
async function api(path, opts) {
  if (path !== '/api/health') await login();
  const o = Object.assign({}, opts || {});
  o.headers = Object.assign({}, o.headers || {});
  if (cookie) o.headers.cookie = cookie;
  if (o.body && typeof o.body !== 'string') o.body = JSON.stringify(o.body);
  if (o.body) o.headers['content-type'] = o.headers['content-type'] || 'application/json';
  let r;
  try { r = await fetch(BASE + path, o); }
  catch (e) { die('请求发不出去：' + String(e && e.message || e).slice(0, 160), 1); }
  const j = await r.json().catch(function () { return null; });
  if (!r.ok || !j || !j.ok) {
    const er = j && j.error;
    die((er && er.code ? er.code + '：' : '') + ((er && er.message) || ('HTTP ' + r.status)), 1);
  }
  return j.data;
}
function readTorrent(p) {
  const fs = require('fs');
  if (!p) return null;
  let st;
  try { st = fs.statSync(p); } catch (e) { die('种子文件不存在：' + p, 2); }
  if (!st.isFile()) die('不是文件：' + p, 2);
  if (st.size > 10 * 1024 * 1024) die('种子超过 10MB', 2);
  return fs.readFileSync(p).toString('base64');
}
function print(data, opts, human) {
  if (opts.json) { console.log(JSON.stringify(data, null, 2)); return; }
  console.log(human(data));
}

const argv = process.argv.slice(2);
if (!argv.length || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') { usage(); process.exit(0); }
const cmd = argv.shift();
const args = [];
const opts = { json: false, real: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') opts.json = true;
  else if (a === '--real') opts.real = true;
  else if (a === '--dry-run') opts.real = false;
  else if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) { opts[k] = true; }
    else { opts[k] = v; i++; }
  } else args.push(a);
}

async function main() {
  if (cmd === 'status') {
    if (!USE_HTTP) {
      const d = core().status();
      print(d, opts, function (x) {
        return 'v' + x.version + ' · ' + x.db + ' · 队列 ' + JSON.stringify(x.counts) + ' · 调度 ' + (x.scheduler.on ? '开' : '关') + '/' + x.scheduler.everyMinutes + ' 分钟';
      });
      return;
    }
    const h = await api('/api/health');
    const s = await api('/api/scheduler');
    const q = await api('/api/queue?limit=1');
    const d = { version: h.version, db: h.db, queue: q.counts || {}, scheduler: { on: !!s.on, everyMinutes: s.everyMinutes } };
    print(d, opts, function (x) {
      return 'v' + x.version + ' · ' + x.db + ' · 队列 ' + JSON.stringify(x.queue) + ' · 调度 ' + (x.scheduler.on ? '开' : '关') + '/' + x.scheduler.everyMinutes + ' 分钟';
    });
    return;
  }
  if (cmd === 'queue') {
    if (!USE_HTTP) {
      const d = core().queue({ status: opts.status, limit: opts.limit });
      print(d, opts, function (x) {
        if (!x.items.length) return '没有匹配的条目';
        return x.items.map(function (it) { return it.id + '  ' + it.status + '  ' + (it.stage || 'draft') + '  ' + (it.cn || it.title); }).join('\n');
      });
      return;
    }
    const qs = new URLSearchParams();
    if (opts.status) qs.set('status', String(opts.status));
    qs.set('limit', String(Math.max(1, Math.min(500, Number(opts.limit) || 50))));
    const d = await api('/api/queue?' + qs.toString());
    print(d, opts, function (x) {
      if (!x.items.length) return '没有匹配的条目';
      return x.items.map(function (it) { return it.id + '  ' + it.status + '  ' + (it.cn || it.title); }).join('\n');
    });
    return;
  }
  if (cmd === 'crawl') {
    if (!opts.site) die('crawl 需要 --site <host>', 2);
    if (!USE_HTTP) {
      const d = await core().crawl({ host: String(opts.site), limit: Math.max(1, Math.min(1000, Number(opts.limit) || 100)), dryRun: !opts.real });
      print(d, opts, function (x) {
        if (x.dryRun) return '干跑 · 站点 ' + (x.siteHost || opts.site) + ' · ' + ((x.steps || []).length) + ' 步 · 没有发请求';
        return '抓取完成 · 第 ' + (x.page || 0) + ' 页 · 抓回 ' + (x.rows || 0) + ' · 新增 ' + (x.added || 0) + ' · 更新 ' + (x.updated || 0);
      });
      return;
    }
    const d = await api('/api/crawl/run', { method: 'POST', body: {
      host: String(opts.site), limit: Math.max(1, Math.min(1000, Number(opts.limit) || 100)), dryRun: !opts.real
    } });
    print(d, opts, function (x) {
      if (x.dryRun) return '干跑 · 站点 ' + (x.siteHost || opts.site) + ' · ' + ((x.steps || []).length) + ' 步 · 没有发请求';
      return '抓取完成 · 第 ' + (x.page || 0) + ' 页 · 抓回 ' + (x.rows || 0) + ' · 新增 ' + (x.added || 0) + ' · 更新 ' + (x.updated || 0);
    });
    return;
  }
  if (cmd === 'screen') {
    if (!USE_HTTP) {
      const d = core().screen({ limit: Math.max(1, Math.min(500, Number(opts.limit) || 50)), host: opts.host ? String(opts.host) : '' });
      print(d, opts, function (x) {
        const rs = Object.keys(x.byReason || {}).map(function (k) { return k + ' ' + x.byReason[k]; }).join(' · ');
        return '检查 ' + (x.checked || 0) + ' · 入选 ' + (x.selected || 0) + ' · 跳过 ' + (x.skipped || 0) + (rs ? '（' + rs + '）' : '');
      });
      return;
    }
    const d = await api('/api/catalog/screen', { method: 'POST', body: {
      limit: Math.max(1, Math.min(500, Number(opts.limit) || 50)), host: opts.host ? String(opts.host) : ''
    } });
    print(d, opts, function (x) {
      const rs = Object.keys(x.byReason || {}).map(function (k) { return k + ' ' + x.byReason[k]; }).join(' · ');
      return '检查 ' + (x.checked || 0) + ' · 入选 ' + (x.selected || 0) + ' · 跳过 ' + (x.skipped || 0) + (rs ? '（' + rs + '）' : '');
    });
    return;
  }
  if (cmd === 'prepare') {
    const id = args[0];
    if (!id) die('prepare 需要 queueId', 2);
    const body = {};
    if (!USE_HTTP) {
      const b64 = readTorrent(opts.torrent);
      if (b64) body.torrentBase64 = b64;
      const d = core().prepare(id, { host: opts.host ? String(opts.host) : '', torrentBase64: body.torrentBase64 });
      print(d, opts, function (x) {
        const p = x.prepared || {};
        return '已准备 ' + x.id + ' · ' + (p.title || '无标题') + ' · 目标 ' + (p.targetHost || '未选') + ' · 字段 ' + Object.keys((p.target && p.target.fields) || {}).length + ' · 图 ' + (p.shots || 0);
      });
      return;
    }
    if (opts.host) body.host = String(opts.host);
    const b64 = readTorrent(opts.torrent);
    if (b64) body.torrentBase64 = b64;
    const d = await api('/api/queue/' + encodeURIComponent(id) + '/prepare', { method: 'POST', body: body });
    print(d, opts, function (x) {
      const p = x.prepared || {};
      return '已准备 ' + x.id + ' · ' + (p.title || '无标题') + ' · 目标 ' + (p.targetHost || '未选') +
        ' · 字段 ' + Object.keys((p.target && p.target.fields) || {}).length + ' · 图 ' + (p.shots || 0);
    });
    return;
  }
  if (cmd === 'preview') {
    const id = args[0];
    if (!id) die('preview 需要 queueId', 2);
    if (!USE_HTTP) {
      const x = core().preview(id);
      const p = x.prepared || {};
      print(x, opts, function () {
        return '阶段 ' + x.stage + '\n标题: ' + (p.title || '') + '\n副标题: ' + (p.subtitle || '') + '\n简介: ' + (p.description || '') + '\n目标: ' + (p.targetHost || '未选') + (p.target ? '\nURL: ' + p.target.url + '\n字段: ' + Object.keys(p.target.fields || {}).join(', ') : '') + (p.targetError ? '\n目标站未就绪: ' + p.targetError : '') + '\n截图: ' + (p.shots || 0);
      });
      return;
    }
    const d = await api('/api/queue/' + encodeURIComponent(id) + '/preview');
    print(d, opts, function (x) {
      const p = x.prepared || {};
      return '阶段 ' + x.stage + '\n标题: ' + (p.title || '') + '\n副标题: ' + (p.subtitle || '') + '\n目标: ' + (p.targetHost || '未选') +
        (p.target ? '\nURL: ' + p.target.url + '\n字段: ' + Object.keys(p.target.fields || {}).join(', ') : '') +
        (p.targetError ? '\n目标站未就绪: ' + p.targetError : '') +
        '\n截图: ' + (p.shots || 0);
    });
    return;
  }
  if (cmd === 'advance') {
    const id = args[0];
    if (!id) die('advance 需要 queueId', 2);
    const body = {};
    if (!USE_HTTP) {
      const b64 = readTorrent(opts.torrent);
      if (b64) body.torrentBase64 = b64;
      const x = core().advance(id, { host: opts.host ? String(opts.host) : '', torrentBase64: body.torrentBase64 });
      print(x, opts, function () { return (x.stage || '') + (x.next ? ' · 下一步 ' + x.next : '') + (x.note ? ' · ' + x.note : ''); });
      return;
    }
    if (opts.host) body.host = String(opts.host);
    const b64 = readTorrent(opts.torrent);
    if (b64) body.torrentBase64 = b64;
    const d = await api('/api/queue/' + encodeURIComponent(id) + '/advance', { method: 'POST', body: body });
    print(d, opts, function (x) {
      return (x.stage || '') + (x.next ? ' · 下一步 ' + x.next : '') + (x.note ? ' · ' + x.note : '');
    });
    return;
  }
  if (cmd === 'run') {
    if (!opts.stage) die('run 需要 --stage prepared|previewed', 2);
    if (!USE_HTTP) {
      const x = core().run({ stage: String(opts.stage), limit: Math.max(1, Math.min(100, Number(opts.limit) || 20)) });
      print(x, opts, function () { return '阶段 ' + x.stage + ' · 检查 ' + x.checked + ' · 准备 ' + x.prepared + ' · 预览 ' + x.previewed + ' · 跳过 ' + x.skipped + ' · 失败 ' + x.failed; });
      return;
    }
    const d = await api('/api/release/run', { method: 'POST', body: {
      stage: String(opts.stage), limit: Math.max(1, Math.min(100, Number(opts.limit) || 20))
    } });
    print(d, opts, function (x) {
      return '阶段 ' + x.stage + ' · 检查 ' + x.checked + ' · 准备 ' + x.prepared + ' · 预览 ' + x.previewed + ' · 跳过 ' + x.skipped + ' · 失败 ' + x.failed;
    });
    return;
  }
  if (cmd === 'publish') {
    const id = args[0];
    if (!id) die('publish 需要 queueId', 2);
    if (!USE_HTTP) {
      const x = await core().publish(id, { dryRun: !opts.real });
      print(x, opts, function (v) {
        if (v.dryRun) return '干跑 · 会加入 ' + (v.qb && v.qb.downloader ? (v.qb.downloader.name || v.qb.downloader.id) : '下载器');
        return '已发布 · qB ' + (v.qb && v.qb.verified ? '已校验' : '未校验') + ' · ' + (v.msg || '');
      });
      return;
    }
    const body = { dryRun: !opts.real };
    const d = await api('/api/publish/' + encodeURIComponent(id), { method: 'POST', body: body });
    print(d, opts, function (x) {
      if (x.dryRun) return '干跑 · 会加入 ' + (x.qb && x.qb.downloader ? (x.qb.downloader.name || x.qb.downloader.id) : '下载器');
      return '已发布 · qB ' + (x.qb && x.qb.verified ? '已校验' : '未校验') + ' · ' + (x.msg || '');
    });
    return;
  }
  if (cmd === 'targets') {
    if (!USE_HTTP) {
      const x = core().targets();
      print(x, opts, function (list) {
        if (!list.length) return '没有目标站定义（data/site-pack.json 或 site-defs 为空）';
        return list.map(function (t) { return t.host + '  ' + t.engine + '  ' + (t.ready ? '就绪' : (t.hasCookie ? '缺配置' : '缺 cookie')); }).join('\n');
      });
      return;
    }
    const d = await api('/api/targets');
    print(d, opts, function (x) {
      if (!x.length) return '没有目标站定义（data/site-pack.json 或 site-defs 为空）';
      return x.map(function (t) { return t.host + '  ' + t.engine + '  ' + (t.ready ? '就绪' : (t.hasCookie ? '缺配置' : '缺 cookie')); }).join('\n');
    });
    return;
  }
  if (cmd === 'target-upload') {
    const id = args[0];
    if (!id) die('target-upload 需要 queueId', 2);
    if (!opts.host) die('target-upload 需要 --host <target>', 2);
    const body = { queueId: id, dryRun: !opts.real };
    if (!USE_HTTP) {
      const b64 = readTorrent(opts.torrent);
      const x = await core().targetUpload({ queueId: id, host: String(opts.host), torrentBase64: b64, dryRun: !opts.real, verify: opts.verify });
      print(x, opts, function (v) {
        if (v.dryRun) return '干跑 · ' + v.url + ' · 字段 ' + Object.keys(v.fields || {}).join(',');
        return '已提交 ' + (v.status || '') + (v.detailsUrl ? ' · ' + v.detailsUrl : '') + (v.verify ? ' · 回查 ' + (v.verify.found ? '已找到' : '未找到') : '');
      });
      return;
    }
    const b64 = readTorrent(opts.torrent);
    if (b64) body.torrentBase64 = b64;
    const d = await api('/api/targets/' + encodeURIComponent(String(opts.host)) + '/upload', { method: 'POST', body: body });
    print(d, opts, function (x) {
      if (x.dryRun) return '干跑 · ' + x.url + ' · 字段 ' + Object.keys(x.fields || {}).join(',');
      return '已提交 ' + (x.status || '') + (x.detailsUrl ? ' · ' + x.detailsUrl : '') + (x.verify ? ' · 回查 ' + (x.verify.found ? '已找到' : '未找到') : '');
    });
    return;
  }
  if (cmd === 'verify') {
    const id = args[0];
    if (!id) die('verify 需要 queueId', 2);
    if (!opts.host) die('verify 需要 --host <target>', 2);
    const body = { queueId: id };
    if (!USE_HTTP) {
      const b64 = readTorrent(opts.torrent);
      const x = await core().verify({ queueId: id, host: String(opts.host), torrentBase64: b64, url: opts.url ? String(opts.url) : '' });
      print(x, opts, function (v) { return (v.found ? '已找到' : '未找到') + ' · ' + (v.url || '') + (v.message ? ' · ' + v.message : ''); });
      return;
    }
    if (opts.url) body.url = String(opts.url);
    const b64 = readTorrent(opts.torrent);
    if (b64) body.torrentBase64 = b64;
    const d = await api('/api/targets/' + encodeURIComponent(String(opts.host)) + '/verify', { method: 'POST', body: body });
    print(d, opts, function (x) {
      return (x.found ? '已找到' : '未找到') + ' · ' + (x.url || '') + (x.message ? ' · ' + x.message : '');
    });
    return;
  }
  die('未知命令：' + cmd + '\n' + '跑 pta --help 看用法', 2);
}

main().catch(function (e) { die(String(e && e.message || e), 1); });
