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
const DATA = path.join(ROOT, 'pta', 'data');
const OUT = path.join(DATA, 'samples');
const STATE = path.join(OUT, '_state.json');
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
  const targets = (LIMIT > 0 ? all.slice(OFFSET, OFFSET + LIMIT) : all.slice(OFFSET));
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error('no browser context on ' + PORT);
  let ok = 0, skip = 0, fail = 0;

  for (const t of targets) {
    if (fs.existsSync(fileFor(t.host))) { skip++; continue; }
    let rec = { host: t.host, arch: t.arch, url: '', at: new Date().toISOString(), status: 0, bytes: 0, note: '', tries: 0 };
    const cands = pathsFor(t.arch);
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
        await sleep(2600);
        const html = await page.content().catch(function () { return ''; });
        rec.bytes = html.length;
        if (html && html.length >= 2000) {
          fs.writeFileSync(fileFor(t.host), zlib.gzipSync(Buffer.from(html, 'utf8')));
          saved = true; ok++;
          rec.note = '';
          if (/takelogin\.php/i.test(html) && !/cat=|categories\[|filter_cat/i.test(html)) rec.note = 'login-wall';
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
