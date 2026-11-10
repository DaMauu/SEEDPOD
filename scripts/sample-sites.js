/* 批量采样：用本机 Chrome（--remote-debugging-port=9222）的登录态，把每站种子页存一份到本地样本目录。
   - 每站只发一次 GET，读完即关标签；站与站之间随机 4–6 秒
   - 已经采过的站自动跳过（可续跑）
   - 样本与状态都写 pta/data/samples/，不入库
   用法：node scripts/sample-sites.js [数量] [起始偏移] */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'pta', 'data');
const OUT = path.join(DATA, 'samples');
const STATE = path.join(OUT, '_state.json');
const PORT = Number(process.env.PTA_CDP_PORT || 9222);
const LIMIT = Number(process.argv[2] || 20);
const OFFSET = Number(process.argv[3] || 0);

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
    if (!/内站|外站/.test(it.path)) continue;
    const host = String(it.url || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
    if (!host || seen[host]) continue;
    seen[host] = 1;
    out.push({ host: host, arch: arch[host] || '?', url: it.url });
  }
  return out;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const { chromium } = require(path.join(process.env.TEMP || '', 'pta-shot', 'node_modules', 'playwright-core'));
  fs.mkdirSync(OUT, { recursive: true });
  const state = readJson(STATE, {});
  const targets = loadTargets().slice(OFFSET, OFFSET + LIMIT);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const ctx = browser.contexts()[0];
  let ok = 0, skip = 0, fail = 0;

  for (const t of targets) {
    const file = path.join(OUT, t.host.replace(/[^a-z0-9.-]/gi, '_') + '.html.gz');
    if (fs.existsSync(file)) { skip++; continue; }
    const pathGuess = t.arch === 'UNIT3D' ? '/torrents' : '/torrents.php';
    const url = 'https://' + t.host + pathGuess;
    const page = await ctx.newPage();
    let rec = { host: t.host, arch: t.arch, url: url, at: new Date().toISOString(), status: 0, bytes: 0, note: '' };
    try {
      const res = await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
      rec.status = res ? res.status() : 0;
      await sleep(2600);
      const html = await page.content();
      rec.bytes = html.length;
      if (!html || html.length < 2000) rec.note = 'too-small';
      else {
        fs.writeFileSync(file, zlib.gzipSync(Buffer.from(html, 'utf8')));
        ok++;
      }
      if (/takelogin\.php/i.test(html) && !/cat=|categories\[\]|filter_cat/i.test(html)) rec.note = 'login-wall';
    } catch (e) {
      rec.note = 'error:' + String(e.message).split('\n')[0].slice(0, 80);
      fail++;
    }
    await page.close().catch(function () {});
    state[t.host] = rec;
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
    process.stdout.write((ok + skip + fail) + '/' + targets.length + ' ' + t.host.slice(0, 2) + '*** ' + rec.status + ' ' + (rec.note || 'ok') + '\n');
    await sleep(4000 + Math.floor(Math.random() * 2000));
  }
  await browser.close();
  console.log('DONE ok=' + ok + ' skip=' + skip + ' fail=' + fail + ' total_state=' + Object.keys(state).length);
})().catch(e => { console.log('FATAL', e.message.split('\n')[0]); process.exit(1); });
