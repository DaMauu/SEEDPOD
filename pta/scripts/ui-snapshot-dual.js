/* 同进程双构建 UI 快照：两个后端 + 两个 dist + 同一个 Chromium，消除跨进程字体噪声。
   用法：
     node pta/scripts/ui-snapshot-dual.js --before /tmp/dist-before --after pta/web/dist --out /tmp/ui-dual
   通过标准：原始 compare -metric AE = 0，且 DOM 文本/按钮/输入/开关/尺寸一致。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const { loadPlaywright } = require('../checks/browser');

const ROOT = path.resolve(__dirname, '..');
const USER = 'snapshot';
const PASS = 'snapshot-pass';
const PORTS = { before: 8101, after: 8102 };
const SHOTS = [
  ['crawl-card', '.crawl-card'],
  ['screen-card', '.screen-card'],
  ['pub-card', '.pub-card'],
  ['nodes-card', 'section[data-name="下载器"]']
];
const INJECT = '.dock{display:none!important}.dev-foot{visibility:hidden!important}*{animation:none!important;transition:none!important;text-rendering:geometricPrecision!important;-webkit-font-smoothing:antialiased!important}body{overflow:visible!important}.view[data-view="crawl"],#crawl-panel,.drawers{height:auto!important;min-height:0!important;overflow:visible!important}html,body{scrollbar-width:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function seedData(dir) {
  const db = new DatabaseSync(path.join(dir, 'seedpod.db'));
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
function startServer(side, webRoot) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-dual-' + side + '-'));
  seedData(data);
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORTS[side]), PTA_DATA: data, PTA_WEB: webRoot,
      PTA_USER: USER, PTA_PASS: PASS
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', function () {});
  child.stderr.on('data', function () {});
  return { child: child, data: data, base: 'http://127.0.0.1:' + PORTS[side] };
}
async function waitUp(base) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try { const r = await fetch(base + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(function (r) { setTimeout(r, 120); });
  }
  throw new Error('临时后端没起来：' + base);
}
async function login(page, base) {
  await page.goto(base + '/#crawl', { waitUntil: 'load' });
  await page.waitForTimeout(400);
  if (await page.locator('#login-mask').isVisible().catch(function () { return false; })) {
    await page.fill('#login-user', USER);
    await page.fill('#login-pass', PASS);
    await page.click('#login-submit');
    await page.waitForTimeout(900);
  }
}
async function captureSide(page, base, out, label) {
  await login(page, base);
  await page.waitForSelector('.pub-card .flow-group', { timeout: 8000 });
  await page.waitForSelector('section[data-name="下载器"] .node-row', { timeout: 8000 });
  await page.waitForFunction(function () {
    const e = document.querySelector('#tp-name');
    return e && e.textContent.trim() && e.textContent.trim() !== '未选择站点';
  }, null, { timeout: 8000 }).catch(function () {});
  await page.evaluate(function () { return document.fonts && document.fonts.ready; });
  await page.addStyleTag({ content: INJECT });
  await page.waitForTimeout(800);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width: width, height: width === 1280 ? 900 : 844 });
    await page.evaluate(function () { window.scrollTo(0, 0); });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    const dir = path.join(out, label, String(width));
    mkdir(dir);
    await page.screenshot({ path: path.join(dir, 'full.png'), fullPage: true });
    for (const s of SHOTS) {
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
      if (!root) return null;
      const arr = function (sel, fn) { return Array.from(root.querySelectorAll(sel)).map(fn); };
      return {
        text: root.innerText,
        cards: ['.crawl-card', '.screen-card', '.pub-card', 'section[data-name="下载器"]'].map(function (s) {
          const el = document.querySelector(s); return el ? el.innerText : '';
        }),
        buttons: arr('button', function (b) { return { text: b.innerText.trim(), disabled: !!b.disabled, cls: b.className }; }),
        inputs: arr('input', function (i) { return { value: i.value, placeholder: i.placeholder || '', type: i.type || '' }; }),
        switches: arr('.switch', function (s) { return { on: s.classList.contains('on'), disabled: !!s.disabled }; }),
        boxes: Array.from(root.querySelectorAll('.drawer, .flow-group, .set-field, .switch, .node-row, .btn')).map(function (e) {
          const r = e.getBoundingClientRect();
          return { cls: String(e.className || '').slice(0, 60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })
      };
    });
    fs.writeFileSync(path.join(dir, 'dom.json'), JSON.stringify(dom, null, 2));
  }
}
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out); else if (/\.png$/i.test(f)) out.push(p);
  }
  return out;
}
function compareDirs(a, b) {
  const files = walk(a, []);
  let bad = 0, total = 0;
  files.forEach(function (p) {
    const rel = path.relative(a, p);
    const bp = path.join(b, rel);
    total++;
    if (!fs.existsSync(bp)) { console.log('MISSING ' + rel); bad++; return; }
    const r = spawnSync('compare', ['-metric', 'AE', p, bp, 'null:'], { encoding: 'utf8' });
    const raw = String(r.stderr || r.stdout || '').trim();
    const nums = raw.match(/\d+/g) || [];
    const ae = Number(nums[nums.length - 1]) || 0;
    if (ae !== 0) { console.log('DIFF ' + rel + ' AE=' + ae); bad++; }
  });
  ['1280', '390'].forEach(function (w) {
    const da = path.join(a, w, 'dom.json');
    const db = path.join(b, w, 'dom.json');
    if (!fs.existsSync(da) || !fs.existsSync(db)) { console.log('MISSING DOM ' + w); bad++; return; }
    if (fs.readFileSync(da, 'utf8') !== fs.readFileSync(db, 'utf8')) { console.log('DOM DIFF ' + w); bad++; }
  });
  console.log(bad ? '对比失败：' + bad + ' 项 / ' + total + ' 图' : '对比通过：原始 AE=0，DOM 完全一致（' + total + ' 图）');
  return bad === 0;
}

(async function main() {
  const before = path.resolve(arg('--before', ''));
  const after = path.resolve(arg('--after', ''));
  const out = path.resolve(arg('--out', path.join(os.tmpdir(), 'pta-ui-dual-' + Date.now())));
  if (!fs.existsSync(path.join(before, 'index.html')) || !fs.existsSync(path.join(after, 'index.html'))) {
    console.error('用法：node pta/scripts/ui-snapshot-dual.js --before <dist> --after <dist> --out <dir>');
    process.exit(2);
  }
  mkdir(out);
  const b = startServer('before', before);
  const a = startServer('after', after);
  let browser = null;
  try {
    await Promise.all([waitUp(b.base), waitUp(a.base)]);
    const { chromium } = loadPlaywright();
    const args = ['--no-sandbox', '--force-color-profile=srgb', '--disable-gpu', '--hide-scrollbars'];
    try { browser = await chromium.launch({ headless: true, channel: 'chromium', args: args }); }
    catch (e) { browser = await chromium.launch({ headless: true, args: args }); }
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await captureSide(page, b.base, out, 'before');
    await captureSide(page, a.base, out, 'after');
    const ok = compareDirs(path.join(out, 'before'), path.join(out, 'after'));
    console.log('输出目录：' + out);
    process.exitCode = ok ? 0 : 1;
  } finally {
    if (browser) await browser.close().catch(function () {});
    b.child.kill('SIGKILL'); a.child.kill('SIGKILL');
    try { fs.rmSync(b.data, { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(a.data, { recursive: true, force: true }); } catch (e) {}
  }
})();
