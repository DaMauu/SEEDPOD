/* 目标站页面外联的 DNS 重绑定防护夹具：本地 mock，不碰真实站点。
   覆盖：详情/种子/删除/删除回查/上传页探测在解析到内网时全部拦下且不发请求；
   字面回环地址仍按显式配置放行。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const dns = require('dns');
const { makeTargetPages } = require('../src/features/publish/target-pages');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const detailHtml = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'nexusphp-details.html'), 'utf8');
const uploadHtml = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'upload-form.html'), 'utf8');

const defs = {
  'rebind.example': { base: 'https://rebind.example', upload: { formPath: '/upload.php' } },
  'target.example': { base: 'https://target.example', upload: { formPath: '/upload.php' } },
  'fallback.example': { engine: 'unit3d', base: 'https://fallback.example', upload: { path: '/torrents/create', formPath: '/torrents/create' } },
  'local.example': { base: 'http://127.0.0.1:9999', upload: { formPath: '/upload.php' } }
};
const pages = makeTargetPages({
  resolve: function (h) { return defs[h] || null; },
  cookieOf: function () { return { cookie: 'session=fixture' }; },
  throttle: async function () { return { ok: true }; },
  ctx: { allowReal: function () { return true; } },
  qb: { parseTorrent: function () { return { hash: 'abc' }; } }
});

const realLookup = dns.promises.lookup;
const realFetch = global.fetch;
let calls = [];
dns.promises.lookup = async function (h) {
  const host = String(h || '').toLowerCase();
  if (host === 'rebind.example') return [{ address: '10.0.0.7', family: 4 }];
  if (host === 'target.example') return [{ address: '203.0.113.10', family: 4 }];
  if (host === 'fallback.example') return [{ address: '203.0.113.11', family: 4 }];
  const e = new Error('mock ENOTFOUND'); e.code = 'ENOTFOUND'; throw e;
};
global.fetch = async function (url) {
  calls.push(String(url));
  const u = String(url);
  if (/fallback\.example/.test(u) && /\/torrents\/create/.test(u)) return new Response('not found', { status: 404 });
  const html = /upload\.php/i.test(u) || (/fallback\.example/.test(u) && /\/torrents\/upload/.test(u)) ? uploadHtml : detailHtml;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
};

(async function () {
  try {
    await check('详情页解析到内网时拒绝且不发请求', async function () {
      calls = [];
      const r = await pages.fetchDetailsInfo('rebind.example', '/details.php?id=1');
      need(r && r.ok === false && r.code === 'DNS_BLOCKED', '没拦住：' + JSON.stringify(r));
      need(calls.length === 0, '拦住后仍发了请求：' + calls.join(' , '));
    });

    await check('下载种子页解析到内网时拒绝且不发请求', async function () {
      calls = [];
      const r = await pages.fetchDetailsTorrent('rebind.example', '/details.php?id=1');
      need(r && r.ok === false && r.code === 'DNS_BLOCKED', '没拦住：' + JSON.stringify(r));
      need(calls.length === 0, '拦住后仍发了请求：' + calls.join(' , '));
    });

    await check('上传页探测解析到内网时拒绝且不发请求', async function () {
      calls = [];
      const r = await pages.detectUploadForm('rebind.example');
      need(r && r.ok === false && r.code === 'DNS_BLOCKED', '没拦住：' + JSON.stringify(r));
      need(calls.length === 0, '拦住后仍发了请求：' + calls.join(' , '));
    });

    await check('删除编辑页解析到内网时拒绝且不发请求', async function () {
      calls = [];
      const r = await pages.deleteTorrent('rebind.example', '1', { dryRun: false });
      need(r && r.ok === false && r.code === 'DNS_BLOCKED', '没拦住：' + JSON.stringify(r));
      need(calls.length === 0, '拦住后仍发了请求：' + calls.join(' , '));
    });

    await check('删除回查解析到内网时不当作已删除', async function () {
      calls = [];
      const r = await pages.deleteTorrent('rebind.example', '1', { check: true });
      need(r && r.ok === true && r.data && r.data.deleted === false, '回查结果不对：' + JSON.stringify(r));
      need(/内网/.test(String(r.data.hint || '')), '回查没给原因：' + JSON.stringify(r.data));
      need(calls.length === 0, '拦住后仍发了请求：' + calls.join(' , '));
    });

    await check('公网目标站详情与上传页仍可用', async function () {
      calls = [];
      const d = await pages.fetchDetailsInfo('target.example', '/details.php?id=2');
      need(d && d.ok === true, '公网详情被误拦：' + JSON.stringify(d));
      const u = await pages.detectUploadForm('target.example');
      need(u && u.ok === true, '公网上传页被误拦：' + JSON.stringify(u));
      need(calls.length === 2, '公网请求次数不对：' + calls.join(' , '));
    });

    await check('上传页默认路径 404 时按引擎候选路径匹配', async function () {
      calls = [];
      const r = await pages.detectUploadForm('fallback.example');
      need(r && r.ok === true, '候选路径没识别到：' + JSON.stringify(r));
      need(r.data && r.data.formPath === '/torrents/upload', '候选路径没保存：' + JSON.stringify(r.data));
      need(calls.length === 2, '候选路径请求次数不对：' + calls.length);
    });

    await check('字面回环地址按显式配置放行', async function () {
      calls = [];
      const d = await pages.fetchDetailsInfo('local.example', '/details.php?id=3');
      need(d && d.ok === true, '本地地址被误拦：' + JSON.stringify(d));
      need(calls.length === 1, '本地请求没发出：' + calls.length);
    });
  } finally {
    dns.promises.lookup = realLookup;
    global.fetch = realFetch;
  }

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
