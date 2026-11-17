/* 流程页 UI 快照：固定临时 DB/固定数据，截 1280/390 并做像素 + DOM 对比。
   用法：
     node pta/scripts/ui-snapshot.js --out /tmp/seedpod-ui-before
     node pta/scripts/ui-snapshot.js --out /tmp/seedpod-ui-after
     node pta/scripts/ui-snapshot.js --compare /tmp/seedpod-ui-before /tmp/seedpod-ui-after
   只用于开发验收，不碰真实站/真实数据。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const { loadPlaywright } = require('../checks/browser');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_SNAPSHOT_PORT || 8096);
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'snapshot';
const PASS = 'snapshot-pass';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.png$/i.test(f)) out.push(p);
  }
  return out;
}
function compareImages(a, b, diff) {
  const r = spawnSync('compare', ['-metric', 'RMSE', a, b, diff], { encoding: 'utf8' });
  const raw = String(r.stderr || '').trim().split('\n')[0];
  const nums = raw.match(/[\d.eE+-]+/g) || [];
  const norm = Number(nums[nums.length - 1]) || 0;
  /* 独立 Chromium 进程无法做到裸 AE=0（字体抗锯齿/滚动条）；用 2% fuzz 的 AE 计数：
     组件截图要求 0，整页允许 ≤100 个噪声像素；布局变化远超这个量级。 */
  const aeRun = spawnSync('compare', ['-metric', 'AE', '-fuzz', '2%', a, b, 'null:'], { encoding: 'utf8' });
  const aeRaw = String(aeRun.stderr || aeRun.stdout || '').trim();
  const aeNums = aeRaw.match(/\d+/g) || [];
  const ae = Number(aeNums[aeNums.length - 1]) || 0;
  const isFull = /full\.png$/i.test(String(a));
  const aeLimit = isFull ? 100 : 0;
  return { same: norm <= 0.002 && ae <= aeLimit, metric: raw || String(r.status || ''), rmse: norm, ae: ae, aeLimit: aeLimit };
}
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function seedData(dir) {
  const db = new DatabaseSync(path.join(dir, 'seedpod.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('CREATE TABLE sites (host TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT)');
  db.exec('CREATE TABLE downloaders (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT)');
  db.exec('CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT)');
  const site = db.prepare('INSERT INTO sites(host,data,updated_at) VALUES(?,?,?)');
  [
    ['demo-a.example', { title: '演示站 A', arch: 'NP', base: true, enabled: true, url: 'https://demo-a.example/' }],
    ['demo-b.example', { title: '演示站 B', arch: 'UNIT3D', base: true, enabled: true, url: 'https://demo-b.example/' }],
    ['demo-c.example', { title: '演示站 C', arch: 'GZ', base: true, enabled: true, url: 'https://demo-c.example/' }]
  ].forEach(function (x) { site.run(x[0], JSON.stringify(x[1]), '2026-01-01T00:00:00.000Z'); });
  const dl = db.prepare('INSERT INTO downloaders(id,data,created_at) VALUES(?,?,?)');
  [
    ['dl_snap_a', { name: '快照 qB A', kind: 'qb', url: 'http://127.0.0.1:9999', lastProbe: { pass: true, freeSpace: 500 * 1024 ** 3, totalSpace: 1000 * 1024 ** 3 } }],
    ['dl_snap_b', { name: '快照 qB B', kind: 'qb', url: 'http://127.0.0.1:9998', lastProbe: { pass: false } }]
  ].forEach(function (x) { dl.run(x[0], JSON.stringify(x[1]), '2026-01-01T00:00:00.000Z'); });
  db.prepare('INSERT INTO meta(k,v) VALUES(?,?)').run('config', JSON.stringify({
    targetHost: 'demo-a.example', realCrawl: false, realPublish: false, realImages: false,
    autoDupe: false, detail: true, interval: 60, windowMinutes: 60, maxPerWindow: 20, breaker: 3
  }));
  db.close();
}
async function waitUp() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 120); });
  }
  throw new Error('临时后端没起来');
}
async function login(page) {
  await page.goto(BASE + '/#crawl', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.fill('#login-user', USER);
  await page.fill('#login-pass', PASS);
  await page.click('#login-submit');
  await page.waitForTimeout(900);
  if (await page.locator('#login-mask').isVisible().catch(function () { return false; })) throw new Error('登录失败');
}
async function capture(out) {
  const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-ui-snap-'));
  seedData(DATA);
  mkdir(out);
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'),
      PTA_USER: USER, PTA_PASS: PASS
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', function (d) { log += d; });
  child.stderr.on('data', function (d) { log += d; });
  let browser = null;
  try {
    await waitUp();
    const { chromium } = loadPlaywright();
    const args = ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu'];
    try { browser = await chromium.launch({ headless: true, channel: 'chromium', args: args }); }
    catch (e) { browser = await chromium.launch({ headless: true, args: args }); }
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await login(page);
    await page.waitForSelector('.pub-card .flow-group', { timeout: 8000 });
    await page.waitForSelector('section[data-name="下载器"] .node-row', { timeout: 8000 });
    await page.waitForFunction(function () {
      var e = document.querySelector('#tp-name');
      return e && e.textContent.trim() && e.textContent.trim() !== '未选择站点';
    }, null, { timeout: 8000 }).catch(function () {});
    await page.evaluate(function () { return document.fonts && document.fonts.ready; });
    await page.addStyleTag({ content: '.dock{display:none!important}.dev-foot{visibility:hidden!important}*{animation:none!important;transition:none!important}*::before,*::after{animation:none!important;transition:none!important}body:after{animation:none!important;display:none!important}body{overflow:visible!important}.view[data-view="crawl"],#crawl-panel,.drawers{height:auto!important;min-height:0!important;overflow:visible!important}*{text-rendering:geometricPrecision!important;-webkit-font-smoothing:antialiased!important}html,body{scrollbar-width:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}' });
    await page.waitForTimeout(800);
    const shots = [
      ['crawl-card', '.crawl-card'],
      ['screen-card', '.screen-card'],
      ['pub-card', '.pub-card'],
      ['nodes-card', 'section[data-name="下载器"]']
    ];
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width: width, height: width === 1280 ? 900 : 844 });
      await page.evaluate(function () { window.scrollTo(0, 0); });
      await page.mouse.move(0, 0);
      await page.waitForTimeout(500);
      const dir = path.join(out, String(width));
      mkdir(dir);
      const over = await page.evaluate(function () {
        var iw = window.innerWidth;
        return Array.from(document.querySelectorAll('#crawl-panel *')).filter(function (e) {
          var r = e.getBoundingClientRect();
          return r.right > iw + 1 || r.width > iw + 1;
        }).slice(0, 8).map(function (e) {
          var r = e.getBoundingClientRect();
          return { cls: (e.className || e.tagName || '').toString().slice(0, 50), w: Math.round(r.width), right: Math.round(r.right) };
        });
      });
      if (over.length) throw new Error('overflow@' + width + ' ' + JSON.stringify(over));
      await page.screenshot({ path: path.join(dir, 'full.png'), fullPage: true });
      for (const s of shots) {
        const el = page.locator(s[1]);
        if (await el.count()) { await el.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0); await el.screenshot({ path: path.join(dir, s[0] + '.png') }); }
      }
      await page.evaluate(function () { window.scrollTo(0, 0); });
      await page.locator('#tp-change').click();
      await page.waitForTimeout(400);
      const modal = page.locator('#crawl-target-modal .modal');
      if (await modal.count()) await modal.screenshot({ path: path.join(dir, 'target-modal.png') });
      await page.evaluate(function () { const b = document.querySelector('#crawl-target-modal .modal-head button'); if (b) b.click(); });
      await page.evaluate(function () { window.scrollTo(0, 0); });
      await page.waitForTimeout(300);
      const dom = await page.evaluate(function () {
        const root = document.querySelector('#crawl-panel');
        const arr = function (sel, fn) { return Array.from(root.querySelectorAll(sel)).map(fn); };
        return {
          text: root.innerText,
          cards: ['.crawl-card', '.screen-card', '.pub-card', 'section[data-name="下载器"]'].map(function (s) {
            const el = document.querySelector(s); return el ? el.innerText : '';
          }),
          buttons: arr('button', function (b) { return { text: b.innerText.trim(), disabled: !!b.disabled, cls: b.className }; }),
          inputs: arr('input', function (i) { return { value: i.value, placeholder: i.placeholder || '', type: i.type || '' }; }),
          switches: arr('.switch', function (s) { return { on: s.classList.contains('on'), disabled: !!s.disabled, text: s.innerText.trim() }; }),
          boxes: Array.from(root.querySelectorAll('.drawer, .flow-group, .set-field, .switch, .node-row, .btn')).map(function (e) {
            var r = e.getBoundingClientRect();
            return { cls: String(e.className || '').slice(0, 60), text: String(e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30),
              x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          })
        };
      });
      fs.writeFileSync(path.join(dir, 'dom.json'), JSON.stringify(dom, null, 2));
    }
    console.log('snapshot written: ' + out);
  } finally {
    if (browser) await browser.close().catch(function () {});
    child.kill();
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
  }
}
function compare(a, b) {
  const out = path.join(os.tmpdir(), 'pta-ui-diff-' + Date.now());
  mkdir(out);
  const files = walk(a, []);
  const rel = files.map(function (p) { return path.relative(a, p); });
  let bad = 0;
  rel.forEach(function (r) {
    const bp = path.join(b, r);
    if (!fs.existsSync(bp)) { console.log('MISSING ' + r); bad++; return; }
    const d = compareImages(path.join(a, r), bp, path.join(out, r.replace(/[\\/]/g, '_')));
    if (!d.same) { console.log('DIFF ' + r + ' rmse=' + d.rmse + ' ae=' + d.ae + ' (limit ' + d.aeLimit + ')'); bad++; }
  });
  const da = readJson(path.join(a, '1280', 'dom.json'));
  const db = readJson(path.join(b, '1280', 'dom.json'));
  if (da && db) {
    const sa = JSON.stringify(da), sb = JSON.stringify(db);
    if (sa !== sb) { console.log('DOM 差异（1280）'); bad++; fs.writeFileSync(path.join(out, 'dom-1280.diff'), sa + '\n---\n' + sb); }
  }
  const ma = readJson(path.join(a, '390', 'dom.json'));
  const mb = readJson(path.join(b, '390', 'dom.json'));
  if (ma && mb && JSON.stringify(ma) !== JSON.stringify(mb)) { console.log('DOM 差异（390）'); bad++; fs.writeFileSync(path.join(out, 'dom-390.diff'), JSON.stringify(ma) + '\n---\n' + JSON.stringify(mb)); }
  console.log(bad ? ('对比失败：' + bad + ' 项，diff 在 ' + out) : '对比通过：RMSE ≤0.002 + AE 闸门，DOM 文本/布局尺寸一致');
  process.exit(bad ? 1 : 0);
}
(async function () {
  const cmp = process.argv.indexOf('--compare') >= 0;
  if (cmp) {
    const a = arg('--compare', ''), b = process.argv[process.argv.indexOf('--compare') + 2] || '';
    if (!a || !b) { console.error('用法：--compare before after'); process.exit(2); }
    compare(a, b); return;
  }
  const out = arg('--out', '/tmp/seedpod-ui-snapshot');
  await capture(path.resolve(out));
})().catch(function (e) { console.error('ERR ' + (e && e.message ? e.message : e)); process.exit(1); });
