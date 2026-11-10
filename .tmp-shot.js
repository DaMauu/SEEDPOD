/* 临时：线上面板某路由截图（凭据只从环境变量读） */
const path = require('path');
const PW = process.env.PTA_PW || path.join(process.env.TEMP || '', 'pta-shot', 'node_modules', 'playwright-core');
const { chromium } = require(PW);
const OUT = path.join(process.env.TEMP || '.', 'pta-visual');
require('fs').mkdirSync(OUT, { recursive: true });
const route = process.env.PTA_ROUTE || 'sites';
const name = process.env.PTA_NAME || 'shot';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    httpCredentials: { username: process.env.PTA_U, password: process.env.PTA_P }
  });
  const page = await ctx.newPage();
  await page.goto(process.env.PTA_URL + '/?v=20261116f#' + route, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (await page.locator('#login-form').count()) {
    await page.fill('#login-user', process.env.PTA_U);
    await page.fill('#login-pass', process.env.PTA_P);
    await page.click('#login-form button[type="submit"]');
    await page.waitForTimeout(1800);
  }
  await page.evaluate((r) => { location.hash = '#' + r; }, route);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('SHOT=' + path.join(OUT, name + '.png'));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
