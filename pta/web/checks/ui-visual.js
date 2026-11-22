/* 7 个页面 × 360/390/768/1280 的 computed-style 基线。
   默认对比 pta/fixtures/ui-computed-baseline.json；布局/断点改动必须 --update 并说明原因。 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDB } = require('../../server/src/infra/db');
const { loadPlaywright, launchChromium } = require('./browser');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'baselines', 'ui-computed-baseline.json');
const SHOTS = path.join(__dirname, 'shots');
const UPDATE = process.argv.indexOf('--update') >= 0;
const CHECK_SHOTS = process.argv.indexOf('--shots') >= 0;
const PORT = Number(process.env.PTA_CHECK_PORT || 8105);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-uiv-'));
const DATA = path.join(TMP, 'data');
fs.mkdirSync(DATA);
const VIEWS = ['dashboard', 'sites', 'crawl', 'queue', 'sources', 'logs', 'settings'];
const WIDTHS = [360, 390, 768, 1280];
const SELECTORS = {
  dashboard: ['.bento-top', '.stat-card', '.stat-hero', '.stat-list', '.card', '.live'],
  sites: ['.sites-wrap', '.sites-bar', '.sites-list', '.site-item', '.sites-detail-pane'],
  crawl: ['.drawers', '.crawl-card', '.screen-card', '.drawer-head', '.preset-row', '.crawl-foot'],
  queue: ['.queue-bar', '.queue-split', '.queue-list', '.q-item', '.queue-detail', '.qd-body', '.qd-actions'],
  sources: ['.dl-wrap', '.dl-bar', '.dl-panel', '.dl-head'],
  logs: ['.log-wrap', '.log-bar', '.log-panel', '.log-rows', '.log-row'],
  settings: ['.set-panel', '.set-card', '.set-fields', '.set-field']
};
const PROPS = ['display', 'position', 'width', 'height', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom', 'fontSize', 'lineHeight', 'borderRadius', 'gridTemplateColumns', 'flexDirection', 'gap', 'overflowY', 'color', 'backgroundColor'];
function need(cond, msg) { if (!cond) throw new Error(msg); }
function seed() {
  const db = openDB(path.join(DATA, 'seedpod.db'));
  const now = new Date().toISOString();
  const ins = db.prepare('INSERT OR REPLACE INTO sites(host, data, updated_at) VALUES(?, ?, ?)');
  for (let i = 1; i <= 20; i++) {
    const host = 'test-' + String(i).padStart(2, '0') + '.example';
    ins.run(host, JSON.stringify({ url: 'https://' + host + '/index.php', arch: i % 2 ? 'NP' : 'UNIT3D', title: '测试站点 ' + i, enabled: true }), now);
  }
  const q = db.prepare('INSERT OR REPLACE INTO queue(id, status, title, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?)');
  for (let i = 1; i <= 3; i++) {
    const id = 'q_' + String(i).padStart(4, '0');
    q.run(id, 'pending', 'Fixture Queue ' + i, JSON.stringify({ id: id, title: 'Fixture Queue ' + i, status: 'pending', stage: 'draft', targetSite: 'test-01.example' }), now, now);
  }
  const c = db.prepare('INSERT OR REPLACE INTO catalog(id, site, site_id, infohash, title, status, data, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (let i = 1; i <= 5; i++) {
    const id = 'cat_' + String(i).padStart(6, '0');
    c.run(id, 'test-01.example', String(i), '', 'Fixture Catalog ' + i, 'new', JSON.stringify({ id: id, site: 'test-01.example', siteId: String(i), title: 'Fixture Catalog ' + i, status: 'new' }), now, now);
  }
  const l = db.prepare('INSERT INTO logs(ts, level, src, msg) VALUES(?, ?, ?, ?)');
  l.run(now, 'info', '调度', 'fixture info');
  l.run(now, 'warn', '发布', 'fixture warn');
  l.run(now, 'error', '下载器', 'fixture error');
  db.close();
}
function collectScript(args) {
  return function (a) {
    const out = {};
    const props = a.props;
    const one = function (sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const o = {};
      props.forEach(function (p) { o[p] = String(cs[p] || ''); });
      const r = el.getBoundingClientRect();
      o.rect = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
      return o;
    };
    a.selectors.forEach(function (sel) { out[sel] = one('[data-view="' + a.view + '"] ' + sel); });
    ['.main', '.dock', '.topbar'].forEach(function (sel) { out[sel] = one(sel); });
    return out;
  };
}

(async function () {
  seed();
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'src', 'main.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, { PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: path.join(ROOT, 'web', 'dist'), PTA_USER: 'admin', PTA_PASS: 'demo-pass' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  let browser = null;
  const current = {};
  try {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) { /* 等启动 */ }
      await new Promise(r => setTimeout(r, 120));
    }
    const { chromium } = loadPlaywright();
    browser = await launchChromium(chromium);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async function () {
      await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin', pass: 'demo-pass' }) });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async function () { if (document.fonts) { try { await document.fonts.load('12px Inter'); } catch (e) {} await document.fonts.ready; } });
    await page.waitForTimeout(500);
    await page.addStyleTag({ content: '#dev-foot{display:none!important}.log-ts,.time{visibility:hidden!important}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width: width, height: 900 });
      for (const view of VIEWS) {
        await page.evaluate(function (v) { location.hash = '#' + v; }, view);
        await page.waitForTimeout(450);
        current[width + '|' + view] = await page.evaluate(collectScript(), { view: view, selectors: SELECTORS[view], props: PROPS });
        const shot = path.join(SHOTS, view + '-' + width + '.png');
        await page.screenshot({ path: UPDATE ? shot : path.join(TMP, view + '-' + width + '.png'), fullPage: true });
      }
    }
  } finally {
    if (browser) await browser.close().catch(function () {});
    child.kill('SIGTERM');
  }
  if (UPDATE || !fs.existsSync(OUT)) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.mkdirSync(SHOTS, { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(current, null, 2) + '\n');
    console.log('已写入 UI computed/截图基线：' + OUT);
    console.log(JSON.stringify({ snapshots: Object.keys(current).length }));
    fs.rmSync(TMP, { recursive: true, force: true });
    return;
  }
  const base = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  /* 字体加载/滚动条会让尺寸在 1-3px 内浮动；精确比对会把正常渲染当回归 */
  const near = function (a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 3;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (x, i) { return near(x, b[i]); });
    if (typeof a === 'string' && typeof b === 'string') {
      const na = (a.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const nb = (b.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const sa = a.replace(/-?\d+(?:\.\d+)?/g, '#');
      const sb = b.replace(/-?\d+(?:\.\d+)?/g, '#');
      return sa === sb && na.length === nb.length && na.every(function (x, i) { return Math.abs(x - nb[i]) <= 3; });
    }
    return false;
  };
  const same = function (a, b) {
    if (!a || !b) return a === b;
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(function (k) { return near(a[k], b[k]); });
  };
  const diffs = [];
  Object.keys(current).forEach(function (k) {
    const a = base[k];
    const b = current[k];
    if (!a) { diffs.push(k + ': 新增快照'); return; }
    Object.keys(b).forEach(function (sel) {
      if (!same(a[sel], b[sel])) diffs.push(k + ' ' + sel + ': ' + JSON.stringify(a[sel]) + ' -> ' + JSON.stringify(b[sel]));
    });
  });
  if (diffs.length) {
    console.log('UI computed 基线不一致 ' + diffs.length + ' 项：');
    diffs.slice(0, 20).forEach(function (d) { console.log('  ' + d); });
    process.exit(1);
  }
  const shotDiffs = [];
  if (CHECK_SHOTS) for (const view of VIEWS) {
    for (const width of WIDTHS) {
      const base = path.join(SHOTS, view + '-' + width + '.png');
      const now = path.join(TMP, view + '-' + width + '.png');
      if (!fs.existsSync(base)) { shotDiffs.push(view + '@' + width + ': 缺基线截图'); continue; }
      const r = spawnSync('compare', ['-metric', 'AE', '-fuzz', '2%', base, now, 'null:'], { encoding: 'utf8' });
      const raw = String(r.stderr || r.stdout || '').trim().split(/\s+/)[0];
      const n = Number(raw);
      if (!Number.isFinite(n)) { shotDiffs.push(view + '@' + width + ': compare 不可用 ' + raw); continue; }
      if (n > 800) shotDiffs.push(view + '@' + width + ': 截图差异 ' + n + ' 像素');
    }
  }
  if (shotDiffs.length) {
    console.log('UI 截图基线不一致 ' + shotDiffs.length + ' 项：');
    shotDiffs.slice(0, 20).forEach(function (d) { console.log('  ' + d); });
    fs.rmSync(TMP, { recursive: true, force: true });
    process.exit(1);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('UI computed/截图基线一致：' + Object.keys(current).length + ' 个页面/宽度快照');
})();
