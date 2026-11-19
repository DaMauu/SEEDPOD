/* 在线冒烟：临时 v2 后端 + dist，真实登录与主要页面交互。 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPlaywright, launchChromium } = require('./browser');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PTA_CHECK_PORT || 8091);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-live-'));
const BASE = 'http://127.0.0.1:' + PORT;
const USER = 'admin';
const PASS = 'demo-pass';
const results = [];
const { chromium } = loadPlaywright();

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => results.push([true, name, '']))
    .catch(e => results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]));
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
async function waitUp() {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) { /* 忽略：失败不影响主流程 */ }
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('临时后端没起来');
}

async function main() {
  const dist = path.join(ROOT, 'web', 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('没有 dist，先 npm run build'); process.exit(2); }
  const { DatabaseSync } = require('node:sqlite');
  const seedDb = new DatabaseSync(path.join(DATA, 'seedpod.db'));
  seedDb.exec('CREATE TABLE IF NOT EXISTS sites (host TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT)');
  const seedSite = seedDb.prepare('INSERT OR REPLACE INTO sites(host, data, updated_at) VALUES(?, ?, ?)');
  [
    ['demo-a.example', 'https://demo-a.example/index.php', 'NP', 'Demo A'],
    ['demo-b.example', 'https://demo-b.example/', 'UNIT3D', 'Demo B'],
    ['demo-c.example', 'https://demo-c.example/', 'GZ', 'Demo C']
  ].forEach(function (x) {
    seedSite.run(x[0], JSON.stringify({ url: x[1], arch: x[2], title: x[3], base: true }), new Date().toISOString());
  });
  seedDb.close();
  fs.writeFileSync(path.join(DATA, 'site-pack.json'), JSON.stringify({
    version: 1,
    sites: {
      'target.example': {
        engine: 'nexusphp', base: 'http://127.0.0.1:1',
        upload: { path: '/takeupload.php', formPath: '/upload.php', fileField: 'file', fields: { name: '{title}' } },
        verify: { path: '/torrents.php?search={title}' },
        catMap: { '电影': '401' },
        valueMaps: { team: { 'CMCT': '8' } }
      }
    }
  }, null, 2), { mode: 0o600 });

  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'app-fastify.js')], {
    cwd: path.join(ROOT, '..'),
    env: Object.assign({}, process.env, {
      PTA_PORT: String(PORT), PTA_DATA: DATA, PTA_WEB: dist,
      PTA_USER: USER, PTA_PASS: PASS
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  try { await waitUp(); } catch (e) {
    console.error(e.message + '\n' + out);
    child.kill(); process.exit(2);
  }

  const browser = await launchChromium(chromium);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + '/#dashboard', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  await check('登录页出现，错误密码有提示', async () => {
    need(await page.locator('#login-mask').isVisible(), '没有登录页');
    await page.fill('#login-user', USER);
    await page.fill('#login-pass', 'wrong');
    await page.click('#login-submit');
    await page.waitForTimeout(350);
    const err = await page.textContent('#login-err');
    need(/不对/.test(err), '没有报错：' + err);
  });

  await check('正确密码进入面板', async () => {
    await page.fill('#login-user', USER);
    await page.fill('#login-pass', PASS);
    await page.click('#login-submit');
    await page.waitForTimeout(800);
    need(!(await page.locator('#login-mask').isVisible().catch(() => false)), '登录页没消失');
    need(await page.locator('.dock').isVisible(), '面板没出现');
  });

  for (const r of ['dashboard', 'sites', 'crawl', 'queue', 'sources', 'logs', 'settings']) {
    await check('路由 ' + r, async () => {
      await page.evaluate(x => { location.hash = '#' + x; }, r);
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => {
        const v = [...document.querySelectorAll('.view:not([hidden])')];
        return { n: v.length, view: v[0] ? v[0].getAttribute('data-view') : '', len: v[0] ? v[0].innerText.trim().length : 0 };
      });
      need(info.n === 1 && info.view === r && info.len > 20, JSON.stringify(info));
    });
  }

  await check('更新日志常驻导航', async () => {
    need(await page.locator('.dock-item[data-view="changelog"]').count() === 1, '底部导航没有更新日志');
    await page.evaluate(() => { location.hash = '#changelog'; });
    await page.waitForTimeout(500);
    need(await page.locator('.view[data-view="changelog"]:not([hidden])').count() === 1, '更新日志路由被重定向');
  });

  await check('桌面导航纯图标、不压卡片、悬停切页', async () => {
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(500);
    const geo = await page.evaluate(() => {
      const d = document.querySelector('.dock').getBoundingClientRect();
      const m = document.querySelector('.main').getBoundingClientRect();
      return { dock: [d.x, d.y, d.width, d.height], mainRight: m.x + m.width, label: getComputedStyle(document.querySelector('.dock-label')).display };
    });
    need(geo.label === 'none', '桌面导航还显示文字：' + JSON.stringify(geo));
    need(geo.dock[0] >= geo.mainRight + 8, '桌面导航压到卡片：' + JSON.stringify(geo));
    await page.evaluate(() => { window.__noReload = 1; });
    await page.locator('.dock-item[data-view="sites"]').hover();
    await page.waitForTimeout(500);
    const hov = await page.evaluate(() => ({
      marker: window.__noReload,
      view: [...document.querySelectorAll('.view:not([hidden])')].map(v => v.getAttribute('data-view')),
      hash: location.hash
    }));
    need(hov.marker === 1, '悬停切页刷新了页面');
    need(hov.view.length === 1 && hov.view[0] === 'sites' && hov.hash === '#sites', '悬停没切到站点：' + JSON.stringify(hov));
  });

  await check('总览数据块渲染', async () => {
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(700);
    const stats = await page.locator('.stat-card').innerText();
    need(/统计/.test(stats) && /抓取总数/.test(stats), '统计卡没渲染：' + stats.slice(0, 60));
    need(await page.locator('#dash-logs').count() === 1, '实时日志块缺失');
    need(await page.locator('#health-strip .status-hero').count() === 1, '系统状态没渲染');
    need(await page.locator('#dash-pending').count() === 1, '待审核块缺失');
  });

  await check('站点列表、筛选与抽屉', async () => {
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(200);
    await page.evaluate(() => { location.hash = '#sites'; });
    await page.waitForTimeout(800);
    const items = page.locator('.site-item');
    need(await items.count() === 3, '站点列表数量不对：' + await items.count());
    need(/Demo A/.test(await page.locator('#sites-list').innerText()), '站点标题没渲染');

    const del = await page.evaluate(async () => {
      const r = await fetch('/api/sites/demo-a.example', { method: 'DELETE' });
      return { status: r.status, body: await r.json() };
    });
    need(del.status === 400 && del.body.error && del.body.error.code === 'BASE_SITE', '基础站点应该禁止删除：' + del.status);
    await page.selectOption('#site-arch', 'UNIT3D');
    await page.waitForTimeout(250);
    need(await items.count() === 1, '架构筛选不对：' + await items.count());
    await page.selectOption('#site-arch', 'all');
    await page.waitForTimeout(250);
    await items.first().click();
    await page.waitForTimeout(500);
    need(await page.locator('#site-detail').count() === 1, '详情 id 重复或缺失');
    need(await page.locator('#site-detail').isVisible(), '详情没打开');
    const dtxt = await page.locator('#site-detail').innerText();
    need(/登录/.test(dtxt) && /抓取/.test(dtxt), '抽屉概览没渲染：' + dtxt.slice(0, 80));
    need(await page.locator('#site-detail textarea').count() >= 1, '设置区 cookie 输入框缺失');
    await items.first().click();
    await page.waitForTimeout(300);
    need(await page.locator('#site-detail').count() === 0, '再次点击站点标题没收回');
    await items.first().click();
    await page.waitForTimeout(300);
    need(await page.locator('#site-detail').count() === 1, '重新打开站点详情失败');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    need(await page.locator('#site-detail').count() === 0, 'Escape 没关闭抽屉');
  });

  await check('站点页两栏、统计卡与分页', async () => {
    await page.evaluate(() => { location.hash = '#sites'; });
    await page.waitForTimeout(700);
    const ui = await page.evaluate(() => {
      const stats = document.querySelector('#sites-stats');
      const prog = document.querySelector('#sites-stats .ss-progress').getBoundingClientRect();
      const nums = document.querySelector('#sites-stats .ss-nums').getBoundingClientRect();
      const work = document.querySelector('.sites-work').getBoundingClientRect();
      const list = document.querySelector('.sites-work .sites-list').getBoundingClientRect();
      const pane = document.querySelector('.sites-detail-pane').getBoundingClientRect();
      const pager = document.querySelector('#sites-pager').getBoundingClientRect();
      return {
        hasCov: /已适配/.test(stats.innerText), progX: prog.x, numsX: nums.x,
        workH: work.height, listH: list.height, paneH: pane.height,
        listRight: list.right, paneLeft: pane.left, pagerBottom: pager.bottom, listBottom: list.bottom,
        buttons: document.querySelectorAll('#sites-pager button').length,
        links: document.querySelectorAll('#sites-pager .pager-link').length
      };
    });
    need(!ui.hasCov, '统计卡还留着“已适配”文案');
    need(ui.progX < ui.numsX, '进度条应该在总站点文字左边：' + JSON.stringify(ui));
    need(ui.buttons === 0 && ui.links === 2, '分页不该再用按钮：' + JSON.stringify(ui));
    need(ui.listRight <= ui.paneLeft + 1, '列表和详情没有左右分栏：' + JSON.stringify(ui));
    need(ui.listH > 200 && ui.paneH > 200 && Math.abs(ui.listH - ui.workH) < 2, '两栏没有布满卡片：' + JSON.stringify(ui));
    need(ui.listBottom - ui.pagerBottom < 24, '分页没贴在列表底部：' + JSON.stringify(ui));
  });

  await check('面板添加站点与上传配置', async () => {
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(200);
    await page.evaluate(() => { location.hash = '#sites'; });
    await page.waitForTimeout(700);
    await page.locator('#site-add').click();
    await page.waitForTimeout(300);
    need(await page.locator('#site-add-modal').isVisible(), '添加站点弹窗没打开');
    const inputs = page.locator('#site-add-modal input');
    await inputs.nth(0).fill('https://added.example/index.php');
    await inputs.nth(1).fill('Added Site');
    await page.locator('#site-add-modal select').selectOption('NP');
    await page.locator('#site-add-modal .modal-foot button').filter({ hasText: '添加' }).click();
    await page.waitForTimeout(800);
    need(await page.locator('.site-item').count() === 4, '添加后站点数量不对：' + await page.locator('.site-item').count());
    need(/Added Site/.test(await page.locator('#sites-list').innerText()), '添加的站点没出现');
    need(await page.locator('#site-detail').count() === 1, '添加后没打开抽屉');
    need(await page.locator('#site-detail textarea').count() >= 1, '上传配置文本域缺失');
    await page.locator('#site-detail .cm-actions button').filter({ hasText: '加一条' }).click();
    await page.waitForTimeout(200);
    const cm = page.locator('#site-detail .cm-row').last();
    await cm.locator('input').nth(0).fill('movie');
    await cm.locator('input').nth(1).fill('401');
    await page.locator('#site-detail .cm-actions button').filter({ hasText: '保存映射' }).click();
    await page.waitForTimeout(600);
    const mj = await page.evaluate(async () => (await fetch('/api/site-def/added.example')).json());
    need(mj.ok && mj.data.catMap && mj.data.catMap.movie === '401', '分类映射没保存');
    await page.locator('#site-detail .sd-cookie-bar button').filter({ hasText: '保存定义' }).click();
    await page.waitForTimeout(500);
    const j = await page.evaluate(async () => (await fetch('/api/site-def/added.example')).json());
    need(j.ok && /added\.example/.test(j.data.base || ''), '站点定义没保存');

    await page.evaluate(async () => {
      const def = { engine: 'nexusphp', base: 'https://added.example', cats: { movie: ['401'], tv: ['402'] },
        catMap: [{ id: '401', label: 'Movies', purpose: 'movie' }, { id: '402', label: 'TV', purpose: 'tv' }] };
      await fetch('/api/site-def/added.example', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(def) });
    });
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#sites'; });
    await page.waitForTimeout(700);
    await page.locator('.sites-bar input').first().fill('added.example');
    await page.waitForTimeout(500);
    await page.locator('.site-item').first().click();
    await page.waitForTimeout(600);
    const rows = page.locator('#site-detail .cm-row:not(.cm-head)');
    need(await rows.count() === 2, '数组映射行数不对：' + await rows.count());
    await rows.first().locator('select').selectOption('tv');
    await page.locator('#site-detail .cm-actions button').filter({ hasText: '保存映射' }).click();
    await page.waitForTimeout(600);
    const aj = await page.evaluate(async () => (await fetch('/api/site-def/added.example')).json());
    need(aj.ok && Array.isArray(aj.data.catMap) && aj.data.catMap[0].purpose === 'tv', '数组映射没保存');
    need(aj.data.cats && Array.isArray(aj.data.cats.tv) && aj.data.cats.tv.includes('401'), 'cats 没按用途重建');
    await rows.nth(1).locator('.cm-del').click();
    await page.locator('#site-detail .cm-actions button').filter({ hasText: '保存映射' }).click();
    await page.waitForTimeout(600);
    const dj = await page.evaluate(async () => (await fetch('/api/site-def/added.example')).json());
    need(dj.ok && dj.data.catMap.length === 1, '数组映射删除没生效');

    const upBlock = page.locator('#site-detail .cm-block').filter({ hasText: '上传表单' });
    await upBlock.locator('.cm-actions button').filter({ hasText: '加字段' }).click();
    await page.waitForTimeout(200);
    const uf = upBlock.locator('.cm-row:not(.cm-head)').last();
    await uf.locator('input').nth(0).fill('name');
    await uf.locator('input').nth(1).fill('{title}');
    await page.locator('#site-detail .up-pair input').nth(0).fill('/takeupload.php');
    await page.locator('#site-detail .up-pair input').nth(1).fill('/upload.php');
    await page.locator('#site-detail .up-pair input').nth(2).fill('torrent');
    await upBlock.locator('.cm-actions button').filter({ hasText: '保存上传映射' }).click();
    await page.waitForTimeout(600);
    const uj = await page.evaluate(async () => (await fetch('/api/site-def/added.example')).json());
    need(uj.ok && uj.data.uploadMap && uj.data.uploadMap.fields && uj.data.uploadMap.fields.name === '{title}', '上传映射没保存');
    need(uj.data.uploadMap.path === '/takeupload.php' && uj.data.uploadMap.formPath === '/upload.php' && uj.data.uploadMap.fileField === 'torrent', '上传路径/识别页/文件字段没保存');
  });

  await check('流程卡与未接规则', async () => {
    await page.evaluate(() => { location.hash = '#crawl'; });
    await page.waitForTimeout(700);
    const groupCount = await page.locator('.flow-group').count();
    const expectedGroups = await page.evaluate(() => {
      const R = window.PTA_RULES || {};
      return 2 + (R.pub || []).length;
    });
    need(groupCount === expectedGroups, '规则组数量不对：' + groupCount + '/' + expectedGroups);
    need(await page.locator('#sched-bar .sb-num').count() === 6, '调度条请求限制输入数量不对');
    need(await page.locator('#flow-gates').count() === 1, '没有发布闸门');
    need(!/\bon\b/.test(await page.locator('#gate-publish').getAttribute('class') || ''), '自动发布默认应为关');
    need(await page.locator('#flow-run').count() === 1, '没有跑一轮按钮');
    need(await page.locator('#gate-auto').count() === 1, '没有自动抓取总开关');
    need(await page.locator('#flow-prepare').count() === 0, '准备下一批应该移除');
    need(await page.locator('#crawl-dry-run').count() === 0, '本地演练按钮还在');
    need(await page.locator('#crawl-live-run').count() === 0, '全局抓一页应该移除');
    need(await page.locator('#crawl-plan-btn').count() === 1, '抓取计划按钮缺失');
    const crawlSel = page.locator('#crawl-site');
    if (await crawlSel.locator('option').count() > 1) {
      await crawlSel.selectOption({ index: 1 });
      await page.locator('#crawl-plan-btn').click();
      await page.waitForTimeout(500);
      need(await page.locator('#crawl-plan-box').isVisible(), '抓取计划没展开');
    }
    const todoCount = await page.evaluate(() => {
      const R = window.PTA_RULES || {};
      let n = 0;
      ['fetch', 'dedupe', 'pub'].forEach(k => (R[k] || []).forEach(g => (g.rows || []).forEach(r => { if (r.todo) n++; })));
      return n;
    });
    need(await page.locator('.todo-badge').count() === todoCount, '未接标记数量不对');
    need(!(await page.locator('#rx-deny').isDisabled()), '排除正则被误禁用');
    const pubUi = await page.evaluate(() => {
      const card = document.querySelector('.pub-card');
      const group = card && card.querySelector('.flow-group');
      const field = card && card.querySelector('.flow-group .set-field.pair');
      if (!card || !group || !field) return null;
      const gs = getComputedStyle(group);
      const fs = getComputedStyle(field);
      const body = card && card.querySelector('.drawer-body');
      const bs = body ? getComputedStyle(body) : null;
      const target = card && card.querySelector('.target-pick');
      return {
        groups: card.querySelectorAll('.flow-group').length,
        bg: gs.backgroundColor,
        border: gs.borderTopWidth,
        borderBottom: fs.borderBottomWidth,
        display: fs.display,
        items: field.children.length,
        cols: bs ? bs.gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        targetBorder: target ? getComputedStyle(target).borderTopWidth : '',
        target: (card.querySelector('#tp-name') || {}).textContent || ''
      };
    });
    need(pubUi && pubUi.groups === 5, '发布分组数量应为 5：' + JSON.stringify(pubUi));
    need(pubUi.cols === 5, '发布卡应为 5 列：' + JSON.stringify(pubUi));
    need(pubUi.bg === 'rgba(0, 0, 0, 0)' && pubUi.border === '0px', '发布分组不该有卡片：' + JSON.stringify(pubUi));
    need(pubUi.borderBottom === '0px', '发布字段底下不该有横线：' + JSON.stringify(pubUi));
    need(pubUi.display === 'flex' && pubUi.items >= 5, '发布字段没有做成一行：' + JSON.stringify(pubUi));
    need(pubUi.targetBorder === '0px', '目标站控件不该有外框：' + JSON.stringify(pubUi));
    need(/未选择站点/.test(pubUi.target), '发布目标站占位不清楚：' + pubUi.target);
    const screenUi = await page.evaluate(() => {
      const card = document.querySelector('.screen-card');
      if (!card) return null;
      const body = card.querySelector('.drawer-body');
      const bs = body ? getComputedStyle(body) : null;
      return {
        cols: bs ? bs.gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        groups: card.querySelectorAll('.screen-col').length,
        fields: card.querySelectorAll('.screen-field').length,
        switches: card.querySelectorAll('.dedupe-body .switch').length,
        fieldH: (() => { const f = card.querySelector('.screen-field'); return f ? Math.round(f.getBoundingClientRect().height) : 0; })(),
        oldCards: document.querySelectorAll('.filter-card, .dedupe-card').length
      };
    });
    need(screenUi && screenUi.cols === 2, '初筛与查重不是两列：' + JSON.stringify(screenUi));
    need(screenUi.groups === 2 && screenUi.fields >= 10, '初筛与查重字段不对：' + JSON.stringify(screenUi));
    need(screenUi.switches === 4, '查重开关数量不对：' + JSON.stringify(screenUi));
    need(screenUi.fieldH > 0 && screenUi.fieldH <= 40, '初筛行高不紧凑：' + JSON.stringify(screenUi));
    need(screenUi.oldCards === 0, '旧的初筛/查重独立卡还在：' + JSON.stringify(screenUi));
    const nodesUi = await page.evaluate(() => {
      const card = document.querySelector('section[data-name="下载器"]');
      if (!card) return null;
      const inner = card.querySelector('.nodes-inner');
      const row = card.querySelector('.node-row');
      return {
        innerBorder: inner ? getComputedStyle(inner).borderTopWidth : '',
        rows: card.querySelectorAll('.node-row').length,
        rowH: row ? Math.round(row.getBoundingClientRect().height) : 0,
        targetText: (document.querySelector('.pub-card .target-pick .tp-link') || {}).textContent || '',
        changeText: (document.querySelector('.pub-card .target-pick #tp-change') || {}).textContent || ''
      };
    });
    need(nodesUi && nodesUi.innerBorder === '0px', '下载器卡标题下多余横线回来了：' + JSON.stringify(nodesUi));
    need(nodesUi.rows === 0 || nodesUi.rowH <= 42, '下载器行不紧凑：' + JSON.stringify(nodesUi));
    need(nodesUi.changeText === '更改' || nodesUi.changeText === '选择', '发布站控件不再是文字链接：' + JSON.stringify(nodesUi));
  });

  await check('调度在流程页，不在设置页', async () => {
    await page.evaluate(() => { location.hash = '#settings'; });
    await page.waitForTimeout(500);
    const txt = await page.locator('#set-panel').innerText();
    need(!/调度/.test(txt), '设置页不该有调度卡');
    need(/当前版本/.test(txt), '没有版本信息');
    need(/凭据密钥/.test(txt), '没有凭据密钥状态');
    need(!/站点包|站点覆盖/.test(txt), '设置页不该出现站点包/覆盖卡');
    await page.evaluate(() => { location.hash = '#crawl'; });
    await page.waitForTimeout(500);
    need(await page.locator('#sched-bar').isVisible(), '流程页没有调度条');
  });

  await check('流程页自动抓取开关', async () => {
    need(await page.locator('#gate-auto').count() === 1, '没有自动抓取开关');
    await page.locator('#gate-auto').click();
    await page.waitForTimeout(300);
    let j = await page.evaluate(async () => (await fetch('/api/scheduler')).json());
    need(j.ok && j.data.on === false, '真抓取关着也能开自动抓取');
    await page.locator('#gate-crawl').click();
    await page.waitForTimeout(200);
    await page.locator('#confirm-yes').click();
    await page.waitForTimeout(500);
    await page.locator('#gate-auto').click();
    await page.waitForTimeout(200);
    await page.locator('#confirm-yes').click();
    await page.waitForTimeout(500);
    j = await page.evaluate(async () => (await fetch('/api/scheduler')).json());
    need(j.ok && j.data.on === true, 'UI 没打开自动抓取');
    await page.locator('#gate-auto').click();
    await page.waitForTimeout(500);
    j = await page.evaluate(async () => (await fetch('/api/scheduler')).json());
    need(j.ok && j.data.on === false, 'UI 没关闭自动抓取');
    await page.locator('#gate-crawl').click();
    await page.waitForTimeout(400);
  });

  await check('站点页站点包入口', async () => {
    await page.evaluate(() => { location.hash = '#sites'; });
    await page.waitForTimeout(800);
    await page.locator('#sites-pack-open').click();
    await page.waitForTimeout(600);
    need(await page.locator('#site-pack-modal').isVisible(), '站点包弹窗没打开');
    const txt = await page.locator('#site-pack-modal').innerText();
    need(/站点包/.test(txt) && /未解密/.test(txt), '站点包弹窗内容不对：' + txt.slice(0, 200));
    need(/站点覆盖/.test(txt), '站点覆盖卡不在弹窗里');
    await page.locator('#site-pack-modal .modal-head button').filter({ hasText: '关闭' }).click();
  });

  await check('调度 API 默认关闭、可开关', async () => {
    const j = await page.evaluate(async () => (await fetch('/api/scheduler')).json());
    need(j.ok && j.data.on === false && j.data.everyMinutes === 60, JSON.stringify(j.data));
    const on = await page.evaluate(async () => (await fetch('/api/scheduler', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: true, everyMinutes: 30 }) })).json());
    need(on.ok && on.data.on === true, '打开失败');
    const off = await page.evaluate(async () => (await fetch('/api/scheduler', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: false }) })).json());
    need(off.ok && off.data.on === false, '关闭失败');
  });

  await check('日志与队列空状态', async () => {
    await page.evaluate(() => { location.hash = '#logs'; });
    await page.waitForTimeout(500);
    need(await page.locator('.log-wrap').isVisible(), '日志页没渲染');
    await page.evaluate(() => { location.hash = '#queue'; });
    await page.waitForTimeout(500);
    const txt = await page.locator('.queue-items').innerText();
    need(/没有|空/.test(txt), '队列没有空状态：' + txt.slice(0, 60));
  });

  await check('待审核列表与详情', async () => {
    const qid = await page.evaluate(async () => {
      const r = await fetch('/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Smoke Queue 2020 2160p', status: 'pending', site: 'demo-a.example', targetSite: 'target.example',
          downloadUrl: 'http://127.0.0.1:1/t.torrent', res: '2160p', size: '20 GB', imageHost: '本地图床',
          descrBb: '[quote]\nGeneral\nComplete name : Smoke.Media.2024.mkv\nFormat : Matroska\nFile size : 1.0 GiB\n\nVideo\nFormat : HEVC\nWidth : 3840 pixels\nHeight : 2160 pixels\nBit depth : 10 bits\n\nAudio #1\nFormat : DTS XLL\nCommercial name : DTS-HD Master Audio\nChannel(s) : 6 channels\nLanguage : Chinese\n[/quote]\n[img]https://example.invalid/shot.jpg[/img]',
          sourceImages: ['https://example.invalid/shot.jpg']
        })
      });
      const j = await r.json();
      return j.data && j.data.id;
    });
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#queue'; });
    await page.waitForTimeout(800);
    need(await page.locator('.q-item').count() === 1, '队列条目数量不对');
    await page.locator('.q-item').first().click();
    await page.waitForTimeout(400);
    await page.route('**/api/meta/fetch', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { ok: true, provider: 'smoke', cnSubtitle: '冒烟中文名 | 导演:测试', data: { title: '冒烟中文名', overview: '冒烟简介' } } })
    }));
    await page.getByRole('button', { name: '查资料' }).click();
    await page.waitForTimeout(350);
    need((await page.locator('.qd-pubinfo input.input').nth(1).inputValue()) === '冒烟中文名 | 导演:测试', '查资料没拼副标题');
    need((await page.locator('.qd-pubinfo textarea').inputValue()) === '冒烟简介', '查资料没填简介');
    need(/已更新 副标题 \/ 简介/.test(await page.locator('.qd-meta-msg').innerText()), '查资料没显示结果');
    const metaSaved = await page.evaluate(async (id) => (await fetch('/api/queue/' + id)).json(), qid);
    need(metaSaved.ok && metaSaved.data.cn === '冒烟中文名 | 导演:测试' && metaSaved.data.intro === '冒烟简介', '查资料结果没保存：' + JSON.stringify({ cn: metaSaved.data && metaSaved.data.cn, intro: metaSaved.data && metaSaved.data.intro }));
    await page.unroute('**/api/meta/fetch');
    await page.waitForSelector('.qd-preflight', { timeout: 3000 });
    const pf = await page.locator('.qd-preflight').innerText();
    need(/发布前检查/.test(pf) && /电影/.test(pf) && /只换目标站通用 announce/.test(pf), '发布前检查缺失：' + pf.slice(0, 160));
    need(/目标站查重/.test(pf) && /发布时自动查/.test(pf), '目标站查重状态缺失：' + pf.slice(0, 200));
    const txt = await page.locator('#queue-detail').innerText();
    need(/发布信息/.test(txt) && /简介/.test(txt), '详情没渲染：' + txt.slice(0, 80));
    need(await page.locator('.qd-shots').count() === 0, '截图卡还在');
    const autoMedia = await page.locator('.qd-pubinfo').innerText();
    need(/已从源站简介识别 MediaInfo/.test(autoMedia) && /2160p/.test(autoMedia), '源站媒体信息没自动识别：' + autoMedia.slice(0, 200));
    await page.locator('.qd-pubinfo input.input').first().fill('Smoke Queue Edited 2020 2160p');
    await page.getByRole('button', { name: '整理发布资料' }).click();
    await page.waitForTimeout(900);
    const saved = await page.evaluate(async (id) => (await fetch('/api/queue/' + id)).json(), qid);
    need(saved.ok && saved.data.title === 'Smoke Queue Edited 2020 2160p', '整理资料没保存标题：' + (saved.data && saved.data.title));
    need(saved.data.prepared && /Smoke Queue Edited/.test(saved.data.prepared.title || ''), '整理资料没用到新标题：' + JSON.stringify(saved.data.prepared && saved.data.prepared.title));
    const descCard = await page.locator('.qd-pubinfo').innerText();
    need(/已整理/.test(descCard) && /2160p/.test(descCard), '整理后媒体提示缺失：' + descCard.slice(0, 180));
    await page.locator('.qd-pubinfo details.qd-final-desc').evaluate((el) => { el.open = true });
    const finalDesc = await page.locator('.qd-pubinfo details.qd-final-desc').innerText();
    need(/General|2160p|DTS-HD MA/.test(finalDesc), '最终简介预览没生成：' + finalDesc.slice(0, 160));
  });

  await check('查资料切条目不会串到当前条目', async () => {
    const ids = await page.evaluate(async () => {
      const mk = async (title) => {
        const r = await fetch('/api/queue', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, status: 'pending', site: 'demo-a.example', targetSite: 'target.example' })
        });
        return (await r.json()).data.id;
      };
      return [await mk('Race A 2024 1080p'), await mk('Race B 2024 1080p')];
    });
    await page.evaluate(() => { location.hash = '#dashboard' });
    await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#queue' });
    await page.waitForTimeout(800);
    await page.route('**/api/meta/fetch', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const t = String(body.title || '');
      const isA = t.indexOf('Race A') >= 0;
      await new Promise((r) => setTimeout(r, isA ? 700 : 50));
      const title = isA ? 'A 中文名' : 'B 中文名';
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { ok: true, provider: 'race', data: { title, overview: title + ' 简介' } } })
      });
    });
    await page.locator('.q-item').filter({ hasText: 'Race A' }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '查资料' }).click();
    await page.waitForTimeout(100);
    await page.locator('.q-item').filter({ hasText: 'Race B' }).first().click();
    await page.waitForTimeout(1200);
    const cn = await page.locator('.qd-pubinfo input.input').nth(1).inputValue();
    need(cn !== 'A 中文名', '切条目后查资料结果串到了当前条目：' + cn);
    await page.unroute('**/api/meta/fetch');
    await page.evaluate(async (list) => { for (const id of list) await fetch('/api/queue/' + id, { method: 'DELETE' }); }, ids);
    await page.evaluate(() => { location.hash = '#dashboard' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { location.hash = '#queue' });
    await page.waitForTimeout(500);
  });

  await check('待审「失败」标签显示失败与重试并可重新排队', async () => {
    const id = await page.evaluate(async () => {
      const r = await fetch('/api/queue', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Smoke Failed 2024', status: 'failed', stage: 'failed', stageFailedFrom: 'target',
          stageLastError: 'TARGET_UNREACHABLE 测试失败', stageLastErrorCode: 'TARGET_UNREACHABLE', stageAttempts: 3,
          site: 'demo-a.example', targetSite: 'target.example'
        })
      });
      return (await r.json()).data.id;
    });
    await page.evaluate(() => { location.hash = '#dashboard' });
    await page.waitForTimeout(200);
    await page.evaluate(() => { location.hash = '#queue' });
    await page.waitForTimeout(700);
    await page.locator('#queue-tabs button').filter({ hasText: '失败' }).click();
    await page.waitForSelector('.qf-row', { timeout: 3000 });
    const rowTxt = await page.locator('.qf-row').first().innerText();
    need(/Smoke Failed/.test(rowTxt), '失败条目没显示：' + rowTxt.replace(/\n/g, ' / ').slice(0, 160));
    need(/重新排队/.test(rowTxt) && /试了 3 次/.test(rowTxt), '失败状态/重排按钮缺失：' + rowTxt.replace(/\n/g, ' / ').slice(0, 160));
    await page.locator('.qf-row').first().click();
    await page.waitForTimeout(500);
    const pfRetry = await page.locator('.qd-preflight').innerText();
    need(/失败与重试/.test(pfRetry) && /自动重试用完/.test(pfRetry), '发布前检查没显示自动重试用完：' + pfRetry.replace(/\n/g, ' / ').slice(0, 200));
    need(await page.locator('.queue-page').count() === 0, '失败页出现了两个分页');
    const pagerTxt = await page.locator('.qf-pager').innerText();
    need(/上一页/.test(pagerTxt) && /下一页/.test(pagerTxt), '失败分页按钮缺失：' + pagerTxt.replace(/\n/g, ' / '));
    await page.locator('.qf-row').first().getByRole('button', { name: '重新排队' }).click();
    await page.waitForTimeout(700);
    const q = await page.evaluate(async (qid) => (await (await fetch('/api/queue/' + qid)).json()), id);
    need(q.ok && q.data.status === 'pending', '重新排队没把状态改回 pending：' + JSON.stringify(q.data && q.data.status));
    await page.evaluate(async (qid) => { await fetch('/api/queue/' + qid, { method: 'DELETE' }); }, id);
    await page.locator('#queue-tabs button').filter({ hasText: '全部' }).click();
    await page.waitForTimeout(500);
  });

  await check('数据清单渲染、筛选与标记', async () => {
    await page.evaluate(async () => {
      await fetch('/api/catalog', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [{ title: 'Smoke Catalog 2024 2160p UHD Blu-ray', site: 'demo-a.example', res: '2160p', size: '60 GB', cat: '401', detailsUrl: 'details.php?id=1' }] })
      });
    });
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#sources'; });
    await page.waitForTimeout(800);
    const rows = page.locator('.dl-row');
    need(await rows.count() === 1, '数据清单行数不对：' + await rows.count());
    const txt = await rows.first().innerText();
    need(/Smoke Catalog/.test(txt) && /2160p/.test(txt) && /待筛选/.test(txt), '清单字段不对：' + txt.slice(0, 80));
    await page.fill('#dl-q', '不存在的片名');
    await page.waitForTimeout(200);
    need(/没有匹配/.test(await page.locator('#dl-body').innerText()), '搜索没过滤');
    await page.fill('#dl-q', 'Smoke');
    await page.waitForTimeout(200);
    const mb = page.locator('.dl-row .mark-btn').first();
    const before = await mb.getAttribute('class');
    await mb.click();
    await page.waitForTimeout(500);
    const j = await page.evaluate(async () => (await fetch('/api/catalog?q=Smoke')).json());
    need(j.ok && j.data.items[0].marks && j.data.items[0].marks.noRedistribute, '标记没写进后端：' + JSON.stringify(j.data.items[0].marks || {}));
    need((await page.locator('.dl-row .mark-btn').first().getAttribute('class')).indexOf('on') >= 0, '标记按钮没变亮（之前 ' + before + '）');
  });

  await check('下载器抽屉', async () => {
    await page.evaluate(async () => {
      await fetch('/api/downloaders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Smoke qB', url: 'http://127.0.0.1:1', user: 'demo', pass: 'demo' })
      });
    });
    await page.evaluate(() => { location.hash = '#dashboard'; });
    await page.waitForTimeout(250);
    await page.evaluate(() => { location.hash = '#crawl'; });
    await page.waitForTimeout(800);
    const card = page.locator('#nodes-grid .node-row');
    need(await card.count() === 1, '下载器卡片数量不对：' + await card.count());
    need(/Smoke qB/.test(await card.first().innerText()), '下载器名称没渲染');
    await card.first().locator('.nr-set').click();
    await page.waitForTimeout(350);
    need(await page.locator('#node-modal-vue').isVisible(), '下载器设置弹窗没打开');
    need(await page.locator('#node-modal-vue input[type=password]').count() === 1, '密码输入框缺失');
    const kindOpts = await page.locator('#node-modal-vue select').first().locator('option').allTextContents();
    need(!kindOpts.some(function (x) { return /rTorrent|Deluge/i.test(x); }), '下载器类型还含 r/d：' + kindOpts.join(','));

    await page.locator('#node-modal-vue .modal-foot button').filter({ hasText: '取消' }).click();
    await page.waitForTimeout(200);
    need(await page.locator('#node-modal-vue').count() === 0, '取消没关闭弹窗');
  });

  await check('高级媒体/临时种子入口已移除', async () => {
    await page.evaluate(() => { location.hash = '#queue' });
    await page.waitForTimeout(700);
    need(await page.locator('details.qd-advanced').count() === 0, '高级折叠区还在');
    need(await page.locator('button').filter({ hasText: '预检下载器' }).count() === 0, '下载器预检按钮还在');
    need(await page.locator('button').filter({ hasText: '生成临时种子' }).count() === 0, '临时种子按钮还在');
  });

  await check('无 JS 报错', async () => {
    need(errors.length === 0, errors.slice(0, 3).join(' | '));
  });

  await browser.close();
  child.kill();
  fs.rmSync(DATA, { recursive: true, force: true });
  const pass = results.filter(r => r[0]).length;
  results.forEach(r => console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')));
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('检查脚本自身出错：' + e.message); process.exit(1); });
