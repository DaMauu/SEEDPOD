/* 批量采样：用本机 Chrome（--remote-debugging-port=9222）的登录态，把每站种子页存一份到本地样本目录。
   - 每站默认只发一次 GET；只有主路径失败（非 200 或页面过小）才试一次备用路径
   - 读完即关标签；站与站之间随机 4–6 秒
   - 已经采到样本的站自动跳过（可续跑、可分批）
   - 证书链有问题的站用 CDP 单独放行（只对该标签生效）
   - 样本与状态都写 pta/data/samples/，不入库
   用法：node scripts/sample-sites.js [数量] [起始偏移]      数量 0 或缺省 = 跑完剩余全部
        PTA_CDP_PORT 可改调试端口，PTA_SAMPLE_DELAY 可调站间基础毫秒数 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(DATA, 'samples');
const STATE = process.env.PTA_SAMPLE_STATE ? path.resolve(process.env.PTA_SAMPLE_STATE) : path.join(OUT, '_state.json');
const PORT = Number(process.env.PTA_CDP_PORT || 9222);
const LIMIT = Number(process.argv[2] || 0);
const OFFSET = Number(process.argv[3] || 0);
const BASE_DELAY = Number(process.env.PTA_SAMPLE_DELAY || 4000);

function readJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

function loadTargets() {
  const list = readJson(path.join(DATA, 'sites-bookmark.local.json'), []);
  const arch = {};
  try {
    fs.readFileSync(path.join(DATA, 'site-arch.local.csv'), 'utf8').split(/\r?\n/).slice(1).forEach(function (l) {
      const c = l.split(',');
      if (c[0]) arch[c[0].trim()] = (c[2] || '').trim();
    });
  } catch (e) {}
  const seen = {};
  const out = [];
  for (const it of list) {
    if (!/内站|外站/.test(it.path || '')) continue;
    const host = String(it.url || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
    if (!host || seen[host]) continue;
    seen[host] = 1;
    out.push({ host: host, arch: arch[host] || '?', url: it.url });
  }
  return out;
}

// 首页候选路径：按架构给主路径 + 一个备用路径，最多两次请求
function pathsFor(arch) {
  if (arch === 'UNIT3D') return ['/torrents', '/torrents.php'];
  if (arch === 'GZ') return ['/torrents.php', '/torrents'];
  return ['/torrents.php', '/torrents'];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fileFor(host) { return path.join(OUT, host.replace(/[^a-z0-9.-]/gi, '_') + '.html.gz'); }

(async () => {
  const { chromium } = require(path.join(process.env.TEMP || '', 'pta-shot', 'node_modules', 'playwright-core'));
  fs.mkdirSync(OUT, { recursive: true });
  const state = readJson(STATE, {});
  const all = loadTargets();
  let only = null;
  /* PTA_SAMPLE_ONLY 指向一个每行一个域名（或 JSON 数组）的文件：只补这些站 */
  if (process.env.PTA_SAMPLE_ONLY) {
    try {
      const raw = fs.readFileSync(path.resolve(process.env.PTA_SAMPLE_ONLY), 'utf8').trim();
      const list = raw.charAt(0) === '[' ? JSON.parse(raw) : raw.split(/\r?\n/);
      only = {};
      list.forEach(function (h) { const k = String(h || '').trim().toLowerCase(); if (k) only[k] = 1; });
    } catch (e) { console.log('PTA_SAMPLE_ONLY 读不了：' + e.message); }
  }
  const targets = (LIMIT > 0 ? all.slice(OFFSET, OFFSET + LIMIT) : all.slice(OFFSET))
    .filter(function (t) { return !only || only[t.host.toLowerCase()]; });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error('no browser context on ' + PORT);
  let ok = 0, skip = 0, fail = 0;

  for (const t of targets) {
    if (fs.existsSync(fileFor(t.host))) { skip++; continue; }
    /* 明确失败过的（连不上、Cloudflare、页面被脚本顶掉）12 小时内不重复打 */
    const prev = state[t.host];
    if (prev && /^(net-error|cloudflare|error-panel|http-404|no-nav|discovered-empty)$/.test(prev.note || '')) {
      const age = Date.now() - Date.parse(prev.at || 0);
      if (!(age > 12 * 3600 * 1000)) { skip++; continue; }
    }
    let rec = { host: t.host, arch: t.arch, url: '', at: new Date().toISOString(), status: 0, bytes: 0, note: '', tries: 0 };
    /* 上次用首页导航找到的路径优先，没有就走架构默认的两条 */
    const hinted = (prev && prev.browsePath) ? [prev.browsePath] : [];
    const cands = hinted.concat(pathsFor(t.arch).filter(function (p) { return hinted.indexOf(p) < 0; })).slice(0, 2);
    let saved = false;
    for (let i = 0; i < cands.length && !saved; i++) {
      if (i > 0) await sleep(2500);
      const url = 'https://' + t.host + cands[i];
      const page = await ctx.newPage();
      try {
        const cdp = await ctx.newCDPSession(page).catch(function () { return null; });
        if (cdp) await cdp.send('Security.setIgnoreCertificateErrors', { ignore: true }).catch(function () {});
        const res = await page.goto(url, { waitUntil: 'commit', timeout: 30000 }).catch(function (e) { rec.note = 'goto:' + String(e.message).split('\n')[0].slice(0, 70); return null; });
        rec.tries = i + 1;
        rec.status = res ? res.status() : 0;
        rec.url = url;
        if (!res && /ERR_CERT/.test(rec.note)) {
          // 证书问题在 commit 阶段就断了，放行后重试同一地址
          await cdp.send('Security.setIgnoreCertificateErrors', { ignore: true }).catch(function () {});
          const res2 = await page.goto(url, { waitUntil: 'commit', timeout: 30000 }).catch(function (e) { rec.note = 'goto:' + String(e.message).split('\n')[0].slice(0, 70); return null; });
          rec.status = res2 ? res2.status() : 0;
        }
        await sleep(1200);
        /* 等渲染完成：正文有内容就继续，最多等 9 秒（SPA 与 Cloudflare 挑战都要时间） */
        await page.waitForFunction(function () {
          var t = document.body && document.body.innerText ? document.body.innerText.trim() : '';
          return t.length > 200;
        }, null, { timeout: 9000 }).catch(function () {});
        let html = await page.content().catch(function () { return ''; });
        /* 还是 Cloudflare 挑战页就再等一轮（真正的人也是等几秒） */
        if (/Just a moment|cf-browser-verification|challenge-platform|Checking your browser/i.test(html) && html.length < 60000) {
          await sleep(6000);
          html = await page.content().catch(function () { return ''; });
          if (/Just a moment|cf-browser-verification|challenge-platform/i.test(html) && html.length < 60000) rec.note = 'cloudflare';
        }
        if (/pt-checker-panel/.test(html) && html.length < 80000) rec.note = rec.note || 'error-panel';
        const ttl = (/<title[^>]*>([\s\S]{0,40}?)<\/title>/i.exec(html) || [])[1] || '';
        if (/Just a moment|Attention Required|Access denied/i.test(ttl)) rec.note = rec.note || 'cloudflare';
        rec.bytes = html.length;
        /* Chrome 的网络错误页与站点 404 页都不是内容，单独记原因，别当样本存 */
        if (/ERR_[A-Z_]{4,}|diagnoseErrors|This site can.t be reached/i.test(html)) rec.note = 'net-error';
        else if (/<title>\s*404 Not Found\s*<\/title>/i.test(html)) rec.note = 'http-404';
        const badPage = /^(cloudflare|error-panel|net-error|http-404)$/.test(rec.note || '');
        if (html && html.length >= 2000 && !badPage) {
          fs.writeFileSync(fileFor(t.host), zlib.gzipSync(Buffer.from(html, 'utf8')));
          saved = true; ok++;
          rec.note = /takelogin\.php/i.test(html) && !/cat=|categories\[|filter_cat/i.test(html) ? 'login-wall' : '';
        } else if (!rec.note) rec.note = 'too-small';
      } catch (e) {
        rec.note = 'error:' + String(e.message).split('\n')[0].slice(0, 70);
      }
      await page.close().catch(function () {});
    }
    if (!saved) fail++;
    state[t.host] = rec;
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
    process.stdout.write('[' + (ok + skip + fail) + '/' + targets.length + '] ' + String(t.host).slice(0, 3) + '*** ' + rec.status + ' ' + (rec.note || 'ok') + ' ' + rec.bytes + 'B ' + rec.url.replace(/^https:\/\//, '') + '\n');
    await sleep(BASE_DELAY + Math.floor(Math.random() * 2000));
  }
  await browser.close().catch(function () {});
  console.log('DONE ok=' + ok + ' skip=' + skip + ' fail=' + fail + ' total_state=' + Object.keys(state).length);
})().catch(e => { console.log('FATAL ' + String(e.message).split('\n')[0]); process.exit(1); });
