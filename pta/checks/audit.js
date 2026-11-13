/* SEEDPOD 交互审计：不预设哪些按钮有用，逐个点，看页面有没有反应。
   点完没反应的列为 DEAD，交给人或自动循环判断是缺功能还是缺绑定。
   用法：node pta/checks/audit.js（PTA_PW 指向 playwright-core）
   退出码 0 = 没有死按钮，1 = 有死按钮或脚本报错，2 = 缺依赖。 */
const path = require('path');
const { loadPlaywright, launchChromium } = require('./browser');

const { chromium } = loadPlaywright();

const WEB = path.resolve(__dirname, '..', 'web');
const BASE = 'file:///' + WEB.replace(/\\/g, '/') + '/index.html';
const STUB = 'window.SITE_URLS=["https://demo-a.example/index.php","https://demo-b.example/index.php","https://demo-c.example/index.php"];' +
  'window.PT_ARCH={"demo-a.example":"NP","demo-b.example":"UNIT3D","demo-c.example":"NP"};';
const ROUTES = ['#dashboard', '#sites', '#crawl', '#queue', '#sources', '#logs', '#settings'];
const SEL = 'button, a[href^="#"], .cat-chip, .link-btn';

/* 页面签名：整页 HTML 的短哈希，任何 class/文本变化都会变 */
const SIG = `(() => {
  const html = document.body.outerHTML;
  let h = 0;
  for (let i = 0; i < html.length; i++) h = (h * 33 + html.charCodeAt(i)) | 0;
  const t = document.querySelector('.toast.show');
  const m = document.querySelector('.modal-mask:not([hidden])');
  return html.length + '.' + h + '|' + (t ? t.textContent : '') + '|' + (m ? m.id : '') + '|' + location.hash;
})()`;

async function mark(page) {
  return page.evaluate(sel => {
    const list = [...document.querySelectorAll(sel)].filter(el => {
      if (el.closest('.modal-mask')) return false;
      if (el.tagName === 'INPUT') return false;
      if (el.disabled) return false;
      if (el.closest('[hidden]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    list.forEach((el, i) => el.setAttribute('data-audit', String(i)));
    return list.map(el => (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 22));
  }, SEL);
}

async function main() {
  const browser = await launchChromium(chromium);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/sites-data.local.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
  await page.route('**/api/health', r => r.abort());

  const problems = [];
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));

  async function open(hash) {
    await page.goto(BASE + hash, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      document.querySelectorAll('.modal-mask:not([hidden])').forEach(m => { m.hidden = true; });
    });
    await page.waitForTimeout(60);
  }

  await open('#dashboard');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await open('#dashboard');
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', 'demo-pass');
  await page.click('#login-submit');
  await page.waitForTimeout(500);

  for (const route of ROUTES) {
    await open(route);

    const struct = await page.evaluate(() => {
      const ids = {};
      document.querySelectorAll('[id]').forEach(el => { ids[el.id] = (ids[el.id] || 0) + 1; });
      const dupIds = Object.keys(ids).filter(k => ids[k] > 1);
      const views = new Set([...document.querySelectorAll('.view')].map(v => v.getAttribute('data-view')));
      const badLinks = [...document.querySelectorAll('a[href^="#"]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h.length > 1 && !views.has(h.slice(1)));
      return { dupIds, badLinks: [...new Set(badLinks)] };
    });
    if (struct.dupIds.length) problems.push('DUPID ' + route + ' ' + struct.dupIds.join(','));
    if (struct.badLinks.length) problems.push('BADLINK ' + route + ' ' + struct.badLinks.join(','));

    const labels = await mark(page);
    let skipped = 0;

    for (let i = 0; i < labels.length; i++) {
      const el = await page.$('[data-audit="' + i + '"]');
      if (!el) { skipped++; continue; }
      const label = labels[i] || ('#' + i);
      const href = await el.evaluate(n => (n.getAttribute('href') || ''));
      if (href === route) { skipped++; continue; }  /* 指向当前页的链接，点了本来就不变 */
      const id = await el.evaluate(n => n.id || '');
      if (id === 'qd-addshot') { skipped++; continue; }  /* 会弹系统文件框 */

      const before = await page.evaluate(SIG);
      let downloaded = false;
      const onDl = () => { downloaded = true; };
      page.once('download', onDl);
      await el.evaluate(n => n.click()).catch(() => {});
      await page.waitForTimeout(340);
      if (!downloaded) await page.waitForTimeout(80);
      page.removeListener('download', onDl);
      const after = await page.evaluate(SIG);

      if (!downloaded && before === after) problems.push('DEAD ' + route + ' ' + label);

      if (after.split('|')[2]) {
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
          document.querySelectorAll('.modal-mask:not([hidden])').forEach(m => { m.hidden = true; });
        });
        await page.waitForTimeout(60);
      }
      if (after.split('|')[3] !== route) {
        await open(route);
        await mark(page);
      }
    }
    console.log(route + ' 交互点 ' + labels.length + ' 个，跳过 ' + skipped + '，累计问题 ' + problems.length);
  }

  await browser.close();
  if (jsErrors.length) problems.push('JSERR ' + jsErrors.slice(0, 3).join(' | '));
  problems.forEach(p => console.log('  ' + p));
  console.log('\n' + (problems.length ? problems.length + ' 个问题' : '没有发现问题'));
  process.exit(problems.length ? 1 : 0);
}

main().catch(e => { console.error('审计脚本自身出错：' + e.message); process.exit(1); });
