/* 构建产物检查：起临时 v2 后端，用 dist 跑七个路由与登录。
   用法：node pta/checks/build.js（先 npm run build）退出码 0/1/2 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPlaywright, launchChromium } = require('./browser');

const ROOT = path.resolve(__dirname, '..');
const DIST = process.env.PTA_WEB || path.join(ROOT, 'web', 'dist');
const PORT = Number(process.env.PTA_CHECK_PORT || 8096);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-build-'));
const BASE = 'http://127.0.0.1:' + PORT;
const ROUTES = ['dashboard', 'sites', 'crawl', 'queue', 'sources', 'logs', 'settings'];
const { chromium } = loadPlaywright();

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('没有构建产物：先 npm run build');
  process.exit(2);
}

async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('临时后端没起来');
}

async function main() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: DIST,
      PTA_USER: 'admin', PTA_PASS: 'demo-pass'
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  try { await waitUp(); } catch (e) { console.error(e.message + '\n' + out); child.kill(); process.exit(2); }

  const browser = await launchChromium(chromium);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let fail = 0;

  await page.goto(BASE + '/#dashboard', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  if (await page.locator('#login-mask').isVisible().catch(() => false)) {
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'demo-pass');
    await page.click('#login-submit');
    await page.waitForTimeout(700);
  }
  if (await page.locator('#login-mask').isVisible().catch(() => false)) {
    console.log('FAIL  登录没通过'); fail++;
  } else {
    console.log('PASS  登录');
  }

  for (const r of ROUTES) {
    await page.evaluate(x => { location.hash = '#' + x; }, r);
    await page.waitForTimeout(450);
    const info = await page.evaluate(() => {
      const vis = [...document.querySelectorAll('.view:not([hidden])')];
      return { n: vis.length, view: vis[0] ? vis[0].getAttribute('data-view') : '', len: vis[0] ? vis[0].innerText.trim().length : 0 };
    });
    const ok = info.n === 1 && info.view === r && info.len > 20;
    console.log((ok ? 'PASS  ' : 'FAIL  ') + r + (ok ? '' : '  → ' + JSON.stringify(info)));
    if (!ok) fail++;
  }

  if (errors.length) { console.log('FAIL  JS 报错 ' + errors.slice(0, 3).join(' | ')); fail++; }
  else console.log('PASS  无 JS 报错');

  await browser.close();
  child.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
  console.log(fail ? '\n' + fail + ' 项失败' : '\n构建产物检查通过');
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });
