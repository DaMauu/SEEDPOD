/* SEEDPOD 面板回归检查：不需要后端，全部走 file:// + 假站点数据。
   用法：node pta/checks/smoke.js（可用 PTA_NODE / PTA_PW 指定 node 与 playwright-core）
   退出码 0 = 全绿，1 = 有失败，2 = 环境缺依赖。 */
const path = require('path');
const fs = require('fs');

function loadPlaywright() {
  const tries = [
    process.env.PTA_PW,
    path.join(__dirname, 'node_modules', 'playwright-core'),
    path.join(process.env.TEMP || '', 'pta-shot', 'node_modules', 'playwright-core'),
    'playwright-core'
  ].filter(Boolean);
  for (const t of tries) {
    try { return require(t); } catch (e) {}
  }
  console.error('找不到 playwright-core：设置 PTA_PW 指向该模块目录');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const ROOT = path.resolve(__dirname, '..', '..');
const WEB = path.join(ROOT, 'pta', 'web');
const BASE = 'file:///' + WEB.replace(/\\/g, '/') + '/index.html';
const STUB = 'window.SITE_URLS=["https://demo-a.example/index.php","https://demo-b.example/index.php","https://demo-c.example/index.php"];' +
  'window.PT_ARCH={"demo-a.example":"NP","demo-b.example":"UNIT3D","demo-c.example":"NP"};';

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push([true, name, '']);
  } catch (e) {
    results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]);
  }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

async function main() {
  need(fs.existsSync(path.join(WEB, 'index.html')), '页面不存在：' + WEB);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.addInitScript(() => { window.__PTA_TEST_HOOKS__ = true; });
  const FIX_QUEUE = [
    { id: '101', title: 'Fixture Alpha 2020 1080p Blu-ray AVC TrueHD 7.1', cn: '夹具甲', year: 2020, res: '1080p', size: '22.10 GB', imdb: '5.4', site: 'demo-a.example', status: 'pending', check: '未查', checkCls: 'gray' },
    { id: '102', title: 'Fixture Beta 1997 1080p Blu-ray AVC DTS-HD MA 5.1', cn: '夹具乙', year: 1997, res: '1080p', size: '44.14 GB', imdb: '8.0', site: 'demo-a.example', status: 'pending', check: '未查', checkCls: 'gray' }
  ];
  const FIX_SOURCES = [
    { title: 'Fixture Alpha 2020 1080p Blu-ray AVC TrueHD 7.1', type: '原盘', res: '1080p', size: '22.10 GB', time: '刚刚', check: '无重复', checkCls: 'green' },
    { title: 'Fixture Beta 1997 1080p Blu-ray AVC DTS-HD MA 5.1', type: '原盘', res: '1080p', size: '44.14 GB', time: '刚刚', check: '无重复', checkCls: 'green' }
  ];
  async function seed(kind) {
    await page.evaluate(([k, q, s2]) => {
      if (!window.__PTA_TEST__) return;
      if (k === 'queue') window.__PTA_TEST__.queue(q);
      if (k === 'sources') window.__PTA_TEST__.sources(s2);
    }, [kind, FIX_QUEUE, FIX_SOURCES]);
    await page.waitForTimeout(150);
  }
  async function open(hash) {
    await page.route('**/sites-data.local.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
    await page.route('**/api/health', r => r.abort());
    await page.goto(BASE + (hash || ''));
    await page.waitForTimeout(650);
  }

  await open('');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await open('');

  /* 0. 登录页 */
  await check('未登录显示登录页', async () => {
    need(await page.locator('#login-mask').isVisible(), '没有出现登录页');
    need(!(await page.locator('.dock').count()) || !(await page.locator('.dock').isVisible()), '未登录就露出了面板');
  });

  await check('错误密码有提示', async () => {
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'wrong');
    await page.click('#login-submit');
    await page.waitForTimeout(300);
    const err = await page.textContent('#login-err');
    need(/不对/.test(err), '没有报错：' + err);
    need(await page.locator('#login-mask').isVisible(), '错误密码也进去了');
  });

  await check('登录后进入面板', async () => {
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'seedpod-6x2f');
    await page.click('#login-submit');
    await page.waitForTimeout(500);
    need((await page.locator('#login-mask').count()) === 0, '登录页没有消失');
    need(await page.locator('.dock').isVisible(), '面板没有出现');
  });

  /* 1. 七个页面都能打开，且只显示一个视图 */
  for (const h of ['#dashboard', '#sites', '#crawl', '#queue', '#sources', '#logs', '#settings']) {
    await check('路由 ' + h, async () => {
      await open(h);
      const n = await page.evaluate(() => document.querySelectorAll('.view:not([hidden])').length);
      need(n === 1, '可见视图数量为 ' + n);
      const txt = await page.evaluate(() => (document.querySelector('.view:not([hidden])') || {}).innerText || '');
      need(txt.trim().length > 20, '页面内容为空');
    });
  }

  /* 2. 站点：展开、页面切换、分类映射 */
  await check('站点展开与分类映射', async () => {
    await open('#sites');
    await page.locator('.site-item').first().click();
    await page.waitForTimeout(250);
    need(await page.locator('.site-expand').isVisible(), '详情没展开');
    await page.click('.site-expand button[data-settab="override"]');
    await page.waitForTimeout(200);
    const btn = page.locator('.site-expand button[data-btn]').first();
    await btn.click();
    await page.waitForTimeout(250);
    need(await page.locator('#catmap-modal').isVisible(), '分类映射弹窗没打开');
    const rows = await page.locator('#cm-list .cm-row').count();
    need(rows > 0, '映射列表为空');
    await page.click('#cm-guess');
    const picked = await page.evaluate(() => [...document.querySelectorAll('#cm-list select')].filter(s => s.value).length);
    need(picked > 0, '自动猜没有填任何值');
    await page.click('#cm-ok');
    await page.waitForTimeout(300);
    const label = await page.locator('.site-expand button[data-btn]').first().textContent();
    need(/已配/.test(label), '保存后按钮没显示已配：' + label);
  });

  /* 3. 流程页：抓取节奏越界必须被拦下 */
  await check('请求间隔越界被拦截', async () => {
    await open('#settings');
    const card = page.locator('.set-card').first();
    await card.locator('input.num').first().fill('20');
    await card.locator('.set-save').click();
    await page.waitForTimeout(300);
    const warn = await card.locator('.num-warn').first().textContent();
    need(/不允许保存/.test(warn), '没有出现区间提示：' + warn);
    need(/30/.test(warn), '测试模式下限应是 30 秒：' + warn);
    await card.locator('select[data-k="runMode"]').selectOption('prod');
    await page.waitForTimeout(200);
    await card.locator('input.num').first().fill('4');
    await card.locator('.set-save').click();
    await page.waitForTimeout(250);
    const warn2 = await card.locator('.num-warn').first().textContent();
    need(/8/.test(warn2), '正式模式下限应是 8 秒：' + warn2);
    const toast = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
    need(/超出安全范围|拦下/.test(toast), '没有拦截提示：' + toast);
  });

  /* 4. 流程页：规则卡可展开，配置映射能开 */
  await check('流程页规则卡与目标站映射', async () => {
    await open('#crawl');
    await page.evaluate(() => {
      const r = [...document.querySelectorAll('.rule-item[data-set="fetch"] .rule-row')].find(x => x.textContent.includes('拉取'));
      if (r) r.click();
    });
    await page.waitForTimeout(250);
    need(await page.locator('.rule-item[data-set="fetch"].open').isVisible(), '拉取卡没展开');
    await page.evaluate(() => {
      const r = [...document.querySelectorAll('.rule-item[data-set="pub"] .rule-row')].find(x => (x.textContent.includes('标题与副标题')));
      if (r) r.click();
    });
    await page.waitForTimeout(200);
    await page.fill('#rx-deny', 'DVDRip|枪版');
    await page.fill('#rx-sample', '某片 2024 1080p DVDRip x264');
    await page.click('#rx-run');
    const out = await page.textContent('#rx-out');
    need(/不转载/.test(out), '正则测试没命中：' + out);
  });

  /* 5. 待审核：上传截图 + 批量查重 */
  await check('待审核上传与批量查重', async () => {
    await open('#queue');
    await seed('queue');
    await page.locator('.q-item').first().click();
    await page.waitForTimeout(200);
    const files = ['whale.png', 'icon.png', 'favicon-32.png'].map(f => path.join(WEB, 'assets', f));
    await page.setInputFiles('input[type=file]', files);
    await page.waitForTimeout(600);
    const thumbs = await page.locator('.qd-shots .shot.has').count();
    need(thumbs === 3, '缩略图数量为 ' + thumbs);
    await page.click('#q-bulkcheck');
    await page.waitForTimeout(2200);
    const label = await page.textContent('#q-bulkcheck');
    need(label.trim() === '批量查重', '查重没跑完：' + label);
  });

  /* 6. 数据清单：归档与导出 */
  await check('数据清单归档与导出', async () => {
    await open('#sources');
    await seed('sources');
    await page.click('button[data-archive]');
    await page.waitForTimeout(250);
    need(await page.locator('.dl-row.is-archived').count() === 1, '归档没有标记行');
    const dl = page.waitForEvent('download');
    await page.click('#dl-export');
    const d = await dl;
    need(/\.json$/.test(d.suggestedFilename()), '导出文件名不对：' + d.suggestedFilename());
  });

  /* 5.5 下载器连接测试：没有后端时必须给提示 */
  await check('下载器连接测试在没有后端时给出提示', async () => {
    await open('#crawl');
    await page.click('#node-add');
    await page.waitForTimeout(250);
    need(await page.locator('#node-modal').isVisible(), '下载器弹窗没有打开');
    await page.fill('#nd-name', '检查用');
    await page.fill('#nd-qb', 'http://127.0.0.1:8080');
    await page.click('#nd-test');
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
    need(/不可用|没有后端/.test(t), '没有给出不可用提示：' + t);
    await page.click('#node-cancel');
    await page.waitForTimeout(150);
  });

  /* 6.3 站点详情连接自检：没有后端时给提示，按钮文案标明干跑 */
  await check('站点连接自检在没有后端时给出提示', async () => {
    await open('#sites');
    await page.locator('.site-item').nth(1).click();
    await page.waitForTimeout(700);
    const label = await page.evaluate(() => {
      const b = document.querySelector('#site-detail button[data-act="selfcheck"]');
      return b ? b.textContent : 'missing';
    });
    need(/干跑/.test(label), '按钮没标明干跑：' + label);
    await page.evaluate(() => {
      const b = document.querySelector('#site-detail button[data-act="selfcheck"]');
      if (b) b.click();
    });
    await page.waitForTimeout(320);
    const t = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
    need(/干跑|不可用/.test(t), '没有不可用提示：' + t);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  });

  /* 6.4 流程页干跑自检：没有后端时给提示 */
  await check('流程页干跑自检在没有后端时给出提示', async () => {
    await open('#crawl');
    await page.click('#crawl-dry-run');
    await page.waitForTimeout(320);
    const t = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
    need(/干跑|不可用/.test(t), '没有干跑提示：' + t);
    need((await page.locator('#crawl-dry-box').isVisible()) === false, '没有后端却画出了步骤面板');
  });

  /* 6.5 干跑按钮：没有后端时必须给提示，不许静默或发真实请求 */
  await check('干跑按钮在没有后端时给出提示', async () => {
    await open('#sources');
    await page.click('#dl-crawl');
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
    need(/干跑/.test(t), '没有干跑提示：' + t);
    need((await page.locator('.dl-dry:visible').count()) === 0, '没有后端却画出了任务面板');
  });

  /* 7. 日志下载 */
  await check('日志下载', async () => {
    await open('#logs');
    const dl = page.waitForEvent('download');
    await page.click('#log-dl');
    const d = await dl;
    need(/\.log$/.test(d.suggestedFilename()), '日志文件名不对：' + d.suggestedFilename());
  });

  /* 8. 确认弹窗（ptaConfirm）真的能开能关 */
  await check('确认弹窗可用', async () => {
    await open('#settings');
    await page.click('button[data-btn="清空本地缓存"]');
    await page.waitForTimeout(250);
    need(await page.locator('#confirm-modal').isVisible(), '确认弹窗没出现');
    const title = await page.textContent('#confirm-title');
    need(/清空本地缓存/.test(title), '标题不对：' + title);
    await page.click('#confirm-no');
    await page.waitForTimeout(200);
    need(!(await page.locator('#confirm-modal').isVisible()), '点取消没关掉');
  });

  /* 9. 全站无脚本错误 */
  await check('无 JavaScript 报错', async () => {
    need(errors.length === 0, errors.slice(0, 3).join(' | '));
  });

  await browser.close();

  const failed = results.filter(r => !r[0]);
  for (const [ok, name, why] of results) {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
  }
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' 通过');
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });
