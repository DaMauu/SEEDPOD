#!/usr/bin/env node
/* SEEDPOD CLI：走 v2 HTTP API，不直接碰数据库。
   默认干跑；--real 才真抓/真发。凭据只从环境读，不打印。 */
const RAW_BASE = String(require('./server/env').read('PANEL_URL','PTA_BASE') || '').replace(/\/+$/, '');
const USE_HTTP = !!RAW_BASE || process.argv.includes('--http');
const BASE = RAW_BASE || 'http://127.0.0.1:8080';
const ENV = process.env;
let CORE = null;
function core() {
  if (!CORE) CORE = require('./core').createCore();
  return CORE;
}
let cookie = require('./server/env').read('PANEL_COOKIE','PTA_COOKIE') || '';
let logged = false;

function usage() {
  console.log(`SEEDPOD CLI

用法：
  pta status [--json]
  pta queue [--status pending] [--limit 50] [--json]
  pta crawl --site <host> [--limit 100] [--real] [--json]
  pta screen [--limit 50] [--host <host>] [--json]
  pta prepare <queueId> [--host <target>] [--targets h1,h2] [--torrent file] [--mediainfo file] [--bdinfo file] [--json]
  pta images <queueId> [--host 站内|Pixhost|Imgbox|本地图床] [--real] [--retries 2] [--json]
  pta clients [--test] [--json]
  pta coverage [--json] [--list] [--plan]
  pta probe [--all] [--limit 20] [--delay 1200] [--hosts h1,h2] [--write] [--json]
  pta preview <queueId> [--json]
  pta advance <queueId> [--json]
  pta run --stage prepared|previewed [--limit 20] [--json]
  pta run --all [--limit 20] [--real] [--json]
  pta publish <queueId> [--real] [--json]
  pta inject <queueId> [--downloader id] [--savepath path] [--category cat] [--real] [--json]
  pta targets [--json]
  pta target-upload <queueId> [--host <target>] [--targets h1,h2] [--torrent file] [--torrents h1=file,h2=file] [--announce url|h1=url,h2=url] [--real] [--json]
  pta target-delete <id|detailsUrl> --host <target> [--reason 测试] [--reason-type 其他] [--check] [--real] [--json]
  pta crossseed <queueId> --host <target> [--downloader id] [--real] [--json]
  pta target-announce --host <target> [--json]
  pta verify <queueId> --host <target> [--url url] [--torrent file] [--json]

环境：
  默认直接读本地 SQLite（不启后端）；设置 PANEL_URL 或加 --http 才走 HTTP。
  PANEL_URL  HTTP 模式地址，默认 http://127.0.0.1:8080
  PANEL_USER / PANEL_PASS   面板账号（或 PANEL_COOKIE 直接给会话）
  --real 才真抓/真发；默认干跑。
  --env-file <file>  读取部署环境（如 /etc/seedpod.env），不覆盖已设置变量。`);
}
function die(msg, code) {
  console.error(msg);
  process.exit(code || 1);
}
async function login() {
  if (!USE_HTTP) return;
  if (cookie || logged) return;
  const u = require('./server/env').read('PANEL_USER', 'PTA_USER');
  const p = require('./server/env').read('PANEL_PASS', 'PTA_PASS');
  if (!u || !p) die('需要 PANEL_USER / PANEL_PASS（或 PANEL_COOKIE）', 2);
  const r = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: u, pass: p })
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
function readTorrentMap(spec) {
  const out = {};
  String(spec || '').split(',').forEach(function (pair) {
    const i = pair.indexOf('=');
    if (i <= 0) return;
    const host = pair.slice(0, i).trim().toLowerCase();
    const file = pair.slice(i + 1).trim();
    if (!host || !file) die('--torrents 格式应为 host=文件,host2=文件2', 2);
    out[host] = readTorrent(file);
  });
  return out;
}
function readAnnounceMap(spec) {
  const raw = String(spec || '').trim();
  if (!raw) return { single: '', map: null };
  if (/^https?:\/\//i.test(raw)) return { single: raw, map: null };
  const map = {};
  raw.split(',').forEach(function (pair) {
    const i = pair.indexOf('=');
    if (i <= 0) return;
    const host = pair.slice(0, i).trim().toLowerCase();
    const url = pair.slice(i + 1).trim();
    if (host && /^https?:\/\//i.test(url)) map[host] = url;
  });
  return { single: '', map: map };
}
function readTextFile(p, label) {
  const fs = require('fs');
  if (!p) return '';
  let st;
  try { st = fs.statSync(p); } catch (e) { die((label || '文本') + '文件不存在：' + p, 2); }
  if (!st.isFile()) die('不是文件：' + p, 2);
  if (st.size > 200000) die((label || '文本') + '超过 200KB', 2);
  return fs.readFileSync(p, 'utf8');
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
function loadEnvFile(file) {
  const fs = require('fs');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { die('读不到 env 文件：' + file, 2); }
  text.split(/\r?\n/).forEach(function (line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const i = line.indexOf('=');
    if (i < 0) return;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && process.env[k] === undefined) process.env[k] = v;
  });
}
const ENV_FILE = opts['env-file'] || require('./server/env').read('ENV_FILE','PTA_ENV_FILE');
if (ENV_FILE) loadEnvFile(String(ENV_FILE));

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
      body.mediaInfo = readTextFile(opts.mediainfo, 'MediaInfo');
      body.bdinfo = readTextFile(opts.bdinfo, 'BDInfo');
      const targets = opts.targets ? String(opts.targets).split(',').map(x => x.trim()).filter(Boolean) : [];
      const d = core().prepare(id, { host: opts.host ? String(opts.host) : '', targets: targets, torrentBase64: body.torrentBase64, mediaInfo: body.mediaInfo, bdinfo: body.bdinfo });
      print(d, opts, function (x) {
        const p = x.prepared || {};
        return '已准备 ' + x.id + ' · ' + (p.title || '无标题') + ' · 目标 ' + (p.targetHost || '未选') + ' · 字段 ' + Object.keys((p.target && p.target.fields) || {}).length + ' · 图 ' + (p.shots || 0) + (p.media && p.media.summary ? ' · ' + p.media.summary : '');
      });
      return;
    }
    if (opts.host) body.host = String(opts.host);
    if (opts.targets) body.targets = String(opts.targets).split(',').map(x => x.trim()).filter(Boolean);
    const b64 = readTorrent(opts.torrent);
    if (b64) body.torrentBase64 = b64;
    body.mediaInfo = readTextFile(opts.mediainfo, 'MediaInfo');
    body.bdinfo = readTextFile(opts.bdinfo, 'BDInfo');
    const d = await api('/api/queue/' + encodeURIComponent(id) + '/prepare', { method: 'POST', body: body });
    print(d, opts, function (x) {
      const p = x.prepared || {};
      return '已准备 ' + x.id + ' · ' + (p.title || '无标题') + ' · 目标 ' + (p.targetHost || '未选') +
        ' · 字段 ' + Object.keys((p.target && p.target.fields) || {}).length + ' · 图 ' + (p.shots || 0) + (p.media && p.media.summary ? ' · ' + p.media.summary : '');
    });
    return;
  }
  if (cmd === 'coverage') {
    const summarize = function (list) {
      const out = { total: list.length, withCookie: 0, ready: 0, upload: 0, verify: 0, engines: {}, sites: list };
      list.forEach(function (t) {
        if (t.hasCookie) out.withCookie++;
        if (t.ready) out.ready++;
        if (t.uploadPath) out.upload++;
        if (t.verifyPath) out.verify++;
        const e = t.engine || '?';
        out.engines[e] = (out.engines[e] || 0) + 1;
      });
      return out;
    };
    const human = function (x) {
      const eng = Object.keys(x.engines || {}).map(function (k) { return k + ' ' + x.engines[k]; }).join(' / ');
      let s = '目标站 ' + x.total + ' · 有 cookie ' + x.withCookie + ' · 可发布 ' + x.ready + ' · 上传定义 ' + x.upload + ' · 回查 ' + x.verify + (eng ? ' · ' + eng : '');
      if (x.plan) s += ' · 上传计划 ' + x.plan.ok + '/' + x.total + (x.plan.failed ? '（失败 ' + x.plan.failed + '）' : '');
      if (opts.list) s += '\n' + (x.sites || []).map(function (t) { return t.host + '  ' + (t.engine || '?') + '  ' + (t.ready ? '就绪' : (t.hasCookie ? '缺上传/字段' : '缺 cookie')); }).join('\n');
      return s;
    };
    if (!USE_HTTP) {
      print(core().coverage({ plan: !!opts.plan }), opts, human);
      return;
    }
    if (opts.plan) die('coverage --plan 只在本地模式可用（不启 HTTP）', 2);
    print(summarize(await api('/api/targets')), opts, human);
    return;
  }
  if (cmd === 'clients') {
    const human = function (list) {
      const x = list || [];
      return '下载器 ' + x.length + ' 台 · ' + x.map(function (d) { return d.id + ' ' + d.kind + (opts.test ? (d.ok ? ' 在线' : ' 离线') : ''); }).join(' · ');
    };
    if (!USE_HTTP) {
      const x = await core().clients({ test: !!opts.test });
      print(x, opts, human);
      return;
    }
    const list = await api('/api/downloaders');
    if (!opts.test) { print(list, opts, human); return; }
    const out = [];
    for (const d of list) {
      const r = await api('/api/downloaders/' + encodeURIComponent(d.id) + '/test', { method: 'POST' });
      out.push({ id: d.id, kind: d.kind, ok: !!r.pass, version: r.version || '', message: r.pass ? '连接通过' : (r.error || '连接失败') });
    }
    print(out, opts, human);
    return;
  }
  if (cmd === 'images') {
    const id = args[0];
    if (!id) die('images 需要 queueId', 2);
    const body = { imageHost: opts.host ? String(opts.host) : '', dryRun: !opts.real };
    if (opts.retries !== undefined) body.retries = Math.max(0, Math.min(4, Number(opts.retries) || 0));
    const human = function (x) {
      return '图床 ' + (x.provider || '—') + ' · ' + (x.dryRun ? '演练' : (x.uploaded + ' 成功 / ' + x.failed + ' 失败')) + ' · 共 ' + (x.total || 0) + ' 张' + (x.message ? ' · ' + x.message : '');
    };
    if (!USE_HTTP) {
      const r = await core().images(Object.assign({ queueId: id }, body));
      print(r, opts, human);
      if (!r.ok && !r.uploaded) process.exitCode = 1;
      return;
    }
    const d = await api('/api/queue/' + encodeURIComponent(id) + '/images', { method: 'POST', body: body });
    print(d, opts, human);
    return;
  }
  if (cmd === 'preview') {
    const id = args[0];
    if (!id) die('preview 需要 queueId', 2);
    if (!USE_HTTP) {
      const x = core().preview(id);
      const p = x.prepared || {};
      print(x, opts, function () {
        return '阶段 ' + x.stage + '\n标题: ' + (p.title || '') + '\n副标题: ' + (p.subtitle || '') + '\n简介: ' + (p.description || '') + '\n目标: ' + (p.targetHost || '未选') + (p.target ? '\nURL: ' + p.target.url + '\n字段: ' + Object.keys(p.target.fields || {}).join(', ') : '') + (p.targetError ? '\n目标站未就绪: ' + p.targetError : '') + '\n截图: ' + (p.shots || 0) + (p.media ? '\n媒体: ' + p.media.summary : '');
      });
      return;
    }
    const d = await api('/api/queue/' + encodeURIComponent(id) + '/preview');
    print(d, opts, function (x) {
      const p = x.prepared || {};
      return '阶段 ' + x.stage + '\n标题: ' + (p.title || '') + '\n副标题: ' + (p.subtitle || '') + '\n目标: ' + (p.targetHost || '未选') +
        (p.target ? '\nURL: ' + p.target.url + '\n字段: ' + Object.keys(p.target.fields || {}).join(', ') : '') +
        (p.targetError ? '\n目标站未就绪: ' + p.targetError : '') +
        '\n截图: ' + (p.shots || 0) + (p.media ? '\n媒体: ' + p.media.summary : '');
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
    if (opts.all) {
      const limit = Math.max(1, Math.min(20, Number(opts.limit) || 20));
      const screenLimit = Math.max(1, Math.min(200, Number(opts.screenLimit) || 200));
      const publishLimit = Math.max(1, Math.min(5, Number(opts.publishLimit) || 5));
      function summary(x) {
        const st = (x && x.steps) || {};
        const c = st.crawl || {}, s = st.screen || {}, p = st.publish || {}, r = st.retry || {};
        const errs = (st.errors || []).length;
        return '全链路' + (x && x.partial ? '（部分失败）' : '') + ' · 抓取 ' + (c.ok || 0) + '/' + (c.sites || 0) +
          ' · 送审 ' + (s.selected || 0) + ' · 发布 ' + (p.ok || 0) + '/' + (p.checked || 0) +
          ' · 重试 ' + (r.ok || 0) + '/' + (r.checked || 0) + (errs ? ' · 阶段失败 ' + errs : '');
      }
      if (!USE_HTTP) {
        if (opts.real) process.env.ALLOW_REAL = '1';
        const x = await core().schedulerRun({ batchLimit: limit, screenLimit: screenLimit, publishLimit: publishLimit });
        print(x, opts, summary);
        if (!x || x.ok === false || x.partial) process.exitCode = 1;
        return;
      }
      const d = await api('/api/scheduler/run', { method: 'POST', body: { batchLimit: limit, screenLimit: screenLimit, publishLimit: publishLimit } });
      const wrapped = { partial: !!(d && d.partial), steps: d || {} };
      print(wrapped, opts, summary);
      if (wrapped.partial) process.exitCode = 1;
      return;
    }
    if (!opts.stage) die('run 需要 --stage prepared|previewed 或 --all', 2);
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
  if (cmd === 'inject') {
    const id = args[0];
    if (!id) die('inject 需要 queueId', 2);
    const body = { dryRun: !opts.real };
    if (opts.downloader) body.downloaderId = String(opts.downloader);
    if (opts.savepath) body.savePath = String(opts.savepath);
    if (opts.category) body.category = String(opts.category);
    const human = function (x) {
      const client = x.client || (x.inject && x.inject.client) || (x.qb && x.qb.client) || 'qb';
      const message = x.message || (x.inject && x.inject.message) || x.msg || '';
      const hash = x.hash || (x.qb && x.qb.hash) || '';
      return (x.dryRun === false ? '已注入' : '注入演练') + ' · ' + client + ' · ' + message + (hash ? ' · ' + String(hash).slice(0, 12) : '');
    };
    if (!USE_HTTP) {
      const x = await core().inject(Object.assign({ queueId: id }, body));
      print(x, opts, human);
      return;
    }
    const d = await api('/api/queue/' + encodeURIComponent(id) + '/inject', { method: 'POST', body: body });
    print(d, opts, human);
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
    const targets = opts.targets ? String(opts.targets).split(',').map(x => x.trim()).filter(Boolean) : [];
    if (!targets.length && !opts.host) die('target-upload 需要 --host <target> 或 --targets h1,h2', 2);
    const b64 = readTorrent(opts.torrent);
    const torrentMap = opts.torrents ? readTorrentMap(String(opts.torrents)) : null;
    const hostKey = opts.host ? String(opts.host).toLowerCase() : '';
    const hostTorrent = hostKey && torrentMap ? torrentMap[hostKey] : '';
    const ann = opts.announce ? readAnnounceMap(String(opts.announce)) : { single: '', map: null };
    if (ann.single && targets.length > 1) die('多目标清洗请用 --announce h1=url,h2=url，避免把同一个 passkey 发给所有站', 2);
    if (ann.map && !targets.length) die('--announce host=url 需要配合 --targets 使用', 2);
    const body = { queueId: id, dryRun: !opts.real, torrentBase64: hostTorrent || b64 || undefined, targetTorrents: torrentMap || undefined, cleanAnnounce: ann.single || undefined, targetAnnounces: ann.map || undefined, verify: opts.verify };
    if (!USE_HTTP) {
      if (targets.length) {
        const x = await core().targetUploadMany(Object.assign({}, body, { targets: targets }));
        print(x, opts, function (v) {
          return '多目标' + (v.dryRun ? '干跑' : '提交') + ' · ' + v.targets.map(function (t) { return t.host + ' ' + (t.ok ? 'OK' : (t.code || 'FAILED')); }).join(' · ');
        });
        return;
      }
      const x = await core().targetUpload(Object.assign({}, body, { host: String(opts.host) }));
      print(x, opts, function (v) {
        if (v.dryRun) return '干跑' + (v.cleaned ? '（已清洗）' : '') + ' · ' + v.url + ' · 字段 ' + Object.keys(v.fields || {}).join(',');
        return '已提交 ' + (v.status || '') + (v.detailsUrl ? ' · ' + v.detailsUrl : '') + (v.verify ? ' · 回查 ' + (v.verify.found ? '已找到' : '未找到') : '');
      });
      return;
    }
    if (targets.length) {
      const d = await api('/api/queue/' + encodeURIComponent(id) + '/targets/upload', { method: 'POST', body: Object.assign({}, body, { targets: targets }) });
      print(d, opts, function (v) {
        return '多目标' + (v.dryRun ? '干跑' : '提交') + ' · ' + v.targets.map(function (t) { return t.host + ' ' + (t.ok ? 'OK' : (t.code || 'FAILED')); }).join(' · ');
      });
      return;
    }
    const d = await api('/api/targets/' + encodeURIComponent(String(opts.host)) + '/upload', { method: 'POST', body: body });
    print(d, opts, function (x) {
      if (x.dryRun) return '干跑 · ' + x.url + ' · 字段 ' + Object.keys(x.fields || {}).join(',');
      return '已提交 ' + (x.status || '') + (x.detailsUrl ? ' · ' + x.detailsUrl : '') + (x.verify ? ' · 回查 ' + (x.verify.found ? '已找到' : '未找到') : '');
    });
    return;
  }
  if (cmd === 'probe') {
    const body = {
      all: !!opts.all,
      limit: Math.max(1, Math.min(50, Number(opts.limit) || 20)),
      delay: opts.delay === undefined ? 1200 : Math.max(0, Math.min(10000, Number(opts.delay) || 0)),
      hosts: opts.hosts ? String(opts.hosts).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [],
      write: !!opts.write
    };
    if (!USE_HTTP) {
      const x = await core().probe(body);
      print(x, opts, function (v) {
        return '探测 ' + v.total + ' 站 · 检查 ' + v.checked + ' · OK ' + v.ok + ' · 缺字段 ' + v.missing + ' · 失败 ' + v.failed + ' · 无 cookie ' + v.noCookie + (v.reportFile ? ' · 报告 ' + v.reportFile : '');
      });
      return;
    }
    delete body.write;
    const d = await api('/api/probe', { method: 'POST', body: body });
    print(d, opts, function (v) {
      return '探测 ' + v.total + ' 站 · 检查 ' + v.checked + ' · OK ' + v.ok + ' · 缺字段 ' + v.missing + ' · 失败 ' + v.failed + ' · 无 cookie ' + v.noCookie;
    });
    return;
  }
  if (cmd === 'crossseed') {
    const id = args[0];
    if (!id) die('crossseed 需要 queueId', 2);
    if (!opts.host) die('crossseed 需要 --host <target>', 2);
    const body = { queueId: id, host: String(opts.host), downloader: opts.downloader ? String(opts.downloader) : '', dryRun: !opts.real };
    if (!USE_HTTP) {
      const x = await core().crossseed(body);
      print(x, opts, function (v) {
        if (v.dryRun) return '辅种计划 · 源种 ' + v.sourceHash + ' → 目标 ' + v.targetHash + ' · 保存路径 ' + (v.savePath || '—') + ' · 跳过校验';
        return '已加目标种子 · ' + v.targetHash + ' · 跳过校验';
      });
      return;
    }
    die('crossseed 目前只支持本地模式（去掉 PANEL_URL/--http）', 2);
  }
  if (cmd === 'target-announce') {
    if (!opts.host) die('target-announce 需要 --host <target>', 2);
    const body = {};
    if (!USE_HTTP) {
      const x = await core().targetAnnounce({ host: String(opts.host) });
      print(x, opts, function (v) {
        return '候选 ' + v.candidates.length + ' · ' + v.candidates.map(function (c) { return c.source + '/' + c.kind; }).join(' · ');
      });
      return;
    }
    const d = await api('/api/targets/' + encodeURIComponent(String(opts.host)) + '/announce', { method: 'POST', body: body });
    print(d, opts, function (v) {
      return '候选 ' + v.candidates.length + ' · ' + v.candidates.map(function (c) { return c.source + '/' + c.kind; }).join(' · ');
    });
    return;
  }
  if (cmd === 'target-delete') {
    const spec = args[0];
    if (!spec) die('target-delete 需要种子 id 或 details.php?id=... 链接', 2);
    if (!opts.host) die('target-delete 需要 --host <target>', 2);
    const body = {
      id: spec, url: spec,
      reason: opts.reason ? String(opts.reason) : '测试',
      reasonType: opts['reason-type'] ? String(opts['reason-type']) : '其他',
      check: !!opts.check,
      dryRun: !opts.real
    };
    if (!USE_HTTP) {
      const x = await core().targetDelete(Object.assign({ host: String(opts.host) }, body));
      print(x, opts, function (v) {
        if (v.check) return (v.deleted ? '已删除' : '未删除') + ' · id ' + v.id + ' · details ' + v.checkStatus;
        if (v.dryRun) return '删除计划 · id ' + v.id + ' · 原因 ' + (v.reasonTypeLabel || v.reasonType || '—') + ' / ' + v.reason;
        return (v.deleted ? '已删除' : '删除未确认') + ' · id ' + v.id + ' · details ' + v.checkStatus;
      });
      return;
    }
    const d = await api('/api/targets/' + encodeURIComponent(String(opts.host)) + '/delete', { method: 'POST', body: body });
    print(d, opts, function (v) {
      if (v.check) return (v.deleted ? '已删除' : '未删除') + ' · id ' + v.id + ' · details ' + v.checkStatus;
      if (v.dryRun) return '删除计划 · id ' + v.id + ' · 原因 ' + (v.reasonTypeLabel || v.reasonType || '—') + ' / ' + v.reason;
      return (v.deleted ? '已删除' : '删除未确认') + ' · id ' + v.id + ' · details ' + v.checkStatus;
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
