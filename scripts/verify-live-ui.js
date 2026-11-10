/* 线上面板真机验证：用本机 Chrome（调试端口 9222）打开面板，登录后看站点页新元素是否真的渲染出来。
   只访问面板自己的地址，不碰任何 PT 站点；用完关掉自己开的标签。
   用法：PTA_UI_URL=https://面板域名 PTA_UI_USER=xxx PTA_UI_PASS=xxx node scripts/verify-live-ui.js */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const URL = process.env.PTA_UI_URL || '';
const USER = process.env.PTA_UI_USER || '';
const PASS = process.env.PTA_UI_PASS || '';
const PORT = Number(process.env.PTA_CDP_PORT || 9222);

if (!URL || !USER || !PASS) {
  console.log('需要 PTA_UI_URL / PTA_UI_USER / PTA_UI_PASS 三个环境变量');
  process.exit(2);
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async () => {
  const { chromium } = require(path.join(process.env.TEMP || '', 'pta-shot', 'node_modules', 'playwright-core'));
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error('浏览器没有可用上下文');
  const page = await ctx.newPage();
  const results = [];
  const check = function (name, ok, detail) {
    results.push([!!ok, name, detail || '']);
  };

  try {
    await page.goto(URL, { waitUntil: 'commit', timeout: 30000 });
    await sleep(1500);

    /* 没登录就先登录：等登录浮层出来（可能比首屏晚一点），用面板自己的输入框 id */
    let hasLogin = false;
    for (let i = 0; i < 20; i++) {
      hasLogin = await page.evaluate(function () { return !!document.querySelector('#login-pass'); }).catch(function () { return false; });
      if (hasLogin) break;
      await sleep(500);
    }
    if (hasLogin) {
      await page.fill('#login-user', USER).catch(function () {});
      await page.fill('#login-pass', PASS).catch(function () {});
      await page.click('#login-submit').catch(function () {});
      for (let i = 0; i < 16; i++) {
        const gone = await page.evaluate(function () { return !document.querySelector('#login-mask'); }).catch(function () { return false; });
        if (gone) break;
        await sleep(500);
      }
    }
    const bodyText = async function () {
      return page.evaluate(function () { return document.body ? document.body.innerText : ''; }).catch(function () { return ''; });
    };
    let txt = await bodyText();
    check('登录后进入面板', /待审核|站点|仪表盘|仪表/.test(txt), txt.slice(0, 60).replace(/\s+/g, ' '));

    /* 站点页：等清单渲染，看覆盖统计与预设列 */
    await page.evaluate(function () { location.hash = '#sites'; }).catch(function () {});
    /* 等清单渲染：轮询最多 10 秒 */
    let rows = 0;
    for (let i = 0; i < 20; i++) {
      rows = await page.evaluate(function () { return document.querySelectorAll('.site-item').length; }).catch(function () { return 0; });
      if (rows > 5) break;
      await sleep(500);
    }
    const rowsDbg = rows;
    rows = await page.evaluate(function () { return document.querySelectorAll('.site-item').length; }).catch(function () { return 0; });
    check('站点清单渲染出条目', rows > 5, '条目 ' + rows + ' 页面文字：' + (await bodyText()).slice(0, 70).replace(/\s+/g, ' '));

    txt = await bodyText();
    const covDbg = await page.evaluate(function () { var e = document.querySelector('.ss-cov'); return e ? e.innerText : '(没有 .ss-cov 元素)'; }).catch(function () { return '(取不到)'; });
    check('统计条显示适配覆盖', /已适配/.test(covDbg), 'ss-cov=' + String(covDbg).slice(0, 80) + ' | __ptaDefs=' + await page.evaluate(function () { return Object.keys(window.__ptaDefs || {}).length; }).catch(function () { return -1; }));
    check('预设列显示引擎与组数', /(NP|U3D|GZ)\s*\d*组?/.test(txt), '');

    /* 打开第一个站点的详情，切到「搜索预设」页签 */
    const opened = await page.evaluate(function () {
      const el = document.querySelector('.site-item');
      if (!el) return false;
      el.click();
      return true;
    }).catch(function () { return false; });
    await sleep(1500);
    check('站点详情能打开', opened, '');
    const tab = await page.evaluate(function () {
      const b = document.querySelector('button[data-settab="search"]');
      if (!b) return false;
      b.click();
      return true;
    }).catch(function () { return false; });
    await sleep(1800);
    txt = await bodyText();
    check('设置里能切到搜索预设页签', tab, '');
    check('预设页显示引擎与来源', /引擎/.test(txt) && /预设来源/.test(txt), '');
    check('预设页显示分类 id 区块', /分类 id/.test(txt), '');

    /* 登录页签的 cookie 自检按钮也在 */
    const cookieBtn = await page.evaluate(function () {
      const b = document.querySelector('button[data-settab="login"]');
      if (b) b.click();
      return !!b;
    }).catch(function () { return false; });
    await sleep(1200);
    txt = await bodyText();
    check('登录页签有 cookie 自检按钮', cookieBtn && /自检/.test(txt), '');
  } catch (e) {
    check('验证过程没有抛错', false, String(e.message).split('\n')[0].slice(0, 120));
  } finally {
    await page.close().catch(function () {});
  }

  const failed = results.filter(function (r) { return !r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[0] || !r[2] ? '' : '  → ' + r[2])); });
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.log('FATAL ' + String(e.message).split('\n')[0]);
  process.exit(1);
});
