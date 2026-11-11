/* 自动找种子页：拿不到列表的站，先读首页导航（1 次 GET），再从导航里挑最像「种子列表」的路径（第 2 次 GET）。
   找对了就把页面存成样本、记住路径；找不对记 no-nav，下次不再重复这些尝试。
   用法：
     node scripts/discover-paths.js --dry              只列会打哪些站
     node scripts/discover-paths.js                    跑 blocked-http-404 等清单
     node scripts/discover-paths.js --from pta/data/blocked-thin.txt
   约束：每站最多 2 次 GET，站间 4-6 秒，失败记原因；需要本机 Chrome 开 9222 调试端口。 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'pta', 'data');
const OUT = path.join(DATA, 'samples');
const STATE = path.join(OUT, '_state.json');
const nav = require(path.join(ROOT, 'server', 'adapters', 'nav.js'));
const adapters = require(path.join(ROOT, 'server', 'adapters', 'index.js'));

const argv = process.argv.slice(2);
const dry = argv.indexOf('--dry') >= 0;
const fromIdx = argv.indexOf('--from');
const PORT = Number(process.env.PTA_CDP_PORT || 9222);
const BASE_DELAY = Number(process.env.PTA_SAMPLE_DELAY || 4000);

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function fileFor(host) { return path.join(OUT, host.replace(/[^a-z0-9.-]/gi, '_') + '.html.gz'); }

/* 默认挑「拿不到列表」的那几类清单 */
function defaultTargets() {
  const files = ['blocked-http-404.txt', 'blocked-error-panel.txt', 'blocked-thin.txt', 'blocked-no-sample.txt', 'blocked-unknown.txt'];
  const hosts = [];
  files.forEach(function (f) {
    const p = path.join(DATA, f);
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach(function (l) {
      const h = l.split('\t')[0].trim();
      if (h && h.charAt(0) !== '#' && hosts.indexOf(h) < 0) hosts.push(h);
    });
  });
  return hosts;
}

const state = readJson(STATE, {});
const analysis = readJson(path.join(DATA, 'analysis.json'), {});
let targets = defaultTargets();
if (fromIdx >= 0 && argv[fromIdx + 1]) {
  const p = path.resolve(ROOT, argv[fromIdx + 1]);
  targets = fs.readFileSync(p, 'utf8').split(/\r?\n/).map(function (l) { return l.split('\t')[0].trim(); })
    .filter(function (h) { return h && h.charAt(0) !== '#'; });
}
targets = targets.filter(function (h) {
  if (fs.existsSync(fileFor(h))) return false;                 /* 已有样本 */
  const a = analysis[h] || {};
  if (a.engine) return false;                                  /* 引擎已确认 */
  if (state[h] && /^(login-wall|cloudflare|net-error)$/.test(state[h].note || '')) return false;  /* 不是路径问题 */
  return true;
});

if (!targets.length) { console.log('没有需要找路径的站'); process.exit(0); }
console.log('待找种子页路径 ' + targets.length + ' 站' + (dry ? '（dry run，不发请求）' : ''));
if (dry) { targets.slice(0, 15).forEach(function (h) { console.log('  ' + h); }); process.exit(0); }

(async () => {
  const { chromium } = require(path.join(process.env.TEMP || '', 'pta-shot', 'node_modules', 'playwright-core'));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const ctx = browser.contexts()[0];
  let ok = 0, noNav = 0, fail = 0;

  for (const host of targets) {
    const rec = state[host] || { host: host, arch: '?', url: '', at: '', status: 0, bytes: 0, note: '', tries: 0 };
    let home = '';
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page).catch(function () { return null; });
    if (cdp) await cdp.send('Security.setIgnoreCertificateErrors', { ignore: true }).catch(function () {});
    try {
      await page.goto('https://' + host + '/', { waitUntil: 'commit', timeout: 25000 }).catch(function () {});
      await page.waitForFunction(function () {
        return document.body && document.body.innerText && document.body.innerText.trim().length > 80;
      }, null, { timeout: 9000 }).catch(function () {});
      home = await page.content().catch(function () { return ''; });
    } catch (e) {}

    if (!home || home.length < 1000 || /ERR_[A-Z_]{4,}|Just a moment/i.test(home)) {
      rec.note = /Just a moment/i.test(home) ? 'cloudflare' : 'net-error';
      rec.at = new Date().toISOString();
      state[host] = rec; fail++;
      await page.close().catch(function () {});
      fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
      console.log('[fail] ' + host.slice(0, 3) + '*** ' + rec.note);
      await sleep(BASE_DELAY + Math.floor(Math.random() * 2000));
      continue;
    }

    const tried = ['/torrents.php', '/torrents', '/browse', '/browse.php', '/'];
    const cand = nav.pickBrowsePath(home, tried);
    if (!cand) {
      rec.note = 'no-nav'; rec.at = new Date().toISOString();
      rec.candidates = nav.findTorrentLinks(home, 5).map(function (c) { return c.path; });
      state[host] = rec; noNav++;
      await page.close().catch(function () {});
      fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
      console.log('[no-nav] ' + host.slice(0, 3) + '*** 候选：' + (rec.candidates.join(' ') || '无'));
      await sleep(BASE_DELAY + Math.floor(Math.random() * 2000));
      continue;
    }

    /* 第二条请求：按导航找到的路径取列表页 */
    let html = '';
    try {
      await page.goto('https://' + host + cand.path, { waitUntil: 'commit', timeout: 25000 }).catch(function () {});
      await page.waitForFunction(function () {
        return document.body && document.body.innerText && document.body.innerText.trim().length > 120;
      }, null, { timeout: 9000 }).catch(function () {});
      html = await page.content().catch(function () { return ''; });
    } catch (e) {}

    rec.tries = 2;
    rec.browsePath = cand.path;
    rec.url = 'https://' + host + cand.path;
    rec.at = new Date().toISOString();
    rec.bytes = html.length;
    if (html && html.length >= 2000 && !/ERR_[A-Z_]{4,}|Just a moment|diagnoseErrors/i.test(html)) {
      fs.writeFileSync(fileFor(host), zlib.gzipSync(Buffer.from(html, 'utf8')));
      rec.note = adapters.detectEngine(html) ? 'discovered' : 'discovered-no-engine';
      ok++;
      console.log('[ok] ' + host.slice(0, 3) + '*** ' + cand.path + ' ' + (adapters.detectEngine(html) || '引擎未知') + ' ' + html.length + 'B');
    } else {
      rec.note = 'discovered-empty';
      fail++;
      console.log('[empty] ' + host.slice(0, 3) + '*** ' + cand.path + ' ' + (html || '').length + 'B');
    }
    state[host] = rec;
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
    await page.close().catch(function () {});
    await sleep(BASE_DELAY + Math.floor(Math.random() * 2000));
  }

  await browser.close().catch(function () {});
  console.log('DONE 成功 ' + ok + ' · 没导航线索 ' + noNav + ' · 失败 ' + fail);
  if (ok) console.log('接着跑：node scripts/analyze-samples.js && node scripts/collect-site-defs.js');
})().catch(function (e) { console.log('FATAL ' + String(e.message).split('\n')[0]); process.exit(1); });
