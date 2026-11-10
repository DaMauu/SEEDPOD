/* 临时：用 Basic 凭据看线上面板「搜索预设」页签渲染（凭据只从环境变量读，不落盘） */
const path = require('path');
const PW = process.env.PTA_PW || path.join(process.env.TEMP || '', 'pta-shot', 'node_modules', 'playwright-core');
const { chromium } = require(PW);
const OUT = path.join(process.env.TEMP || '.', 'pta-visual');
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    httpCredentials: { username: process.env.PTA_U, password: process.env.PTA_P }
  });
  const page = await ctx.newPage();
  await page.goto(process.env.PTA_URL + '/?v=20261116d#sites', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const gate = await page.evaluate(() => !!document.querySelector('#login-form'));
  console.log('LOGIN_GATE=' + gate);
  if (gate) {
    await page.fill('#login-user', process.env.PTA_U);
    await page.fill('#login-pass', process.env.PTA_P);
    await page.click('#login-form button[type="submit"]');
    await page.waitForTimeout(1800);
  }
  await page.evaluate(() => { location.hash = '#sites'; });
  await page.waitForTimeout(1200);
  const rows = await page.locator('.st-row, .site-row, .sites-rows [data-host]').count();
  console.log('ROWS=' + rows);
  const first = page.locator('.sites-rows > *').first();
  await first.click();
  await page.waitForTimeout(1200);
  const tabs = await page.locator('.sd-tab, .drawer-tab, [data-set-tab]').count();
  console.log('TABS=' + tabs);
  await page.getByText('搜索预设', { exact: true }).first().click().catch(async () => {
    await page.locator('#site-detail').getByText('搜索预设').first().click();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'search-tab.png') });
  const txt = await page.evaluate(() => {
    const d = document.querySelector('#site-detail') || document.querySelector('.site-sheet') || document.body;
    return (d.innerText || '').slice(0, 900);
  });
  console.log('TEXT=' + txt.replace(/\n/g, ' | '));
  await browser.close();
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
