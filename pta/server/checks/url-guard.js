/* URL / DNS 重绑定防护夹具：全部本地，不访问真实站点。
   覆盖：字面内网放行、公网解析放行、公网域名解析到内网拒绝、解析失败放行、
   发布取种重定向逐跳复检、来源种下载解析到内网拒绝、来源种跳转不带走 cookie。 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const dns = require('dns');
const { openDB } = require('../src/infra/db');
const { makePublisher } = require('../src/features/publish/service');
const { makeSubmit } = require('../src/features/publish/target-submit');
const guard = require('../src/infra/url-guard');

const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

/* 只在本进程替换 DNS 与 fetch；结束后恢复。 */
const realLookup = dns.promises.lookup;
const realFetch = global.fetch;
let table = {};
let calls = [];
function installFakes() {
  dns.promises.lookup = async function (host) {
    const v = table[String(host || '').toLowerCase()];
    if (!v) { const e = new Error('mock ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; }
    return v;
  };
  global.fetch = async function (url) {
    calls.push(String(url));
    const hit = table.__fetch ? table.__fetch(String(url)) : null;
    if (hit) return hit;
    throw new Error('mock fetch 没有配置：' + url);
  };
}
function restoreFakes() {
  dns.promises.lookup = realLookup;
  global.fetch = realFetch;
}

(async function () {
  const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-urlguard-'));
  let db = null;
  try {
    await check('字面回环/内网地址视为显式配置放行', async function () {
      const list = ['http://127.0.0.1:8080/x', 'http://localhost:9000/', 'http://10.1.2.3/', 'http://192.168.1.5:51413/'];
      for (const u of list) {
        const r = await guard.assertNoRebind(u, { lookup: async function () { throw new Error('不该查 DNS'); } });
        need(r.ok === true && r.explicit === true, '没放行：' + u + ' → ' + JSON.stringify(r));
      }
    });

    await check('公网域名解析到公网地址放行', async function () {
      const r = await guard.assertNoRebind('https://src.example/a', {
        lookup: async function () { return [{ address: '203.0.113.10', family: 4 }]; }
      });
      need(r.ok === true && !r.explicit && !r.unresolved, '误拦公网：' + JSON.stringify(r));
    });

    await check('公网域名解析到内网地址拒绝（DNS 重绑定）', async function () {
      const r = await guard.assertNoRebind('https://src.example/a', {
        lookup: async function () { return [{ address: '203.0.113.10', family: 4 }, { address: '10.0.0.7', family: 4 }]; }
      });
      need(r.ok === false && /内网/.test(r.err || ''), '没拦住：' + JSON.stringify(r));
    });

    await check('解析失败按不可判定放行', async function () {
      const r = await guard.assertNoRebind('https://offline.example/a', {
        lookup: async function () { throw new Error('ENOTFOUND'); }
      });
      need(r.ok === true && r.unresolved === true, '解析失败处理不对：' + JSON.stringify(r));
    });

    await check('非 http/https 与坏 URL 拒绝', async function () {
      const a = await guard.assertNoRebind('ftp://src.example/a', { lookup: async function () { return []; } });
      const b = await guard.assertNoRebind('not a url', { lookup: async function () { return []; } });
      need(a.ok === false && b.ok === false, '协议/坏 URL 没拒绝：' + JSON.stringify([a, b]));
    });

    /* 以下三项走真实调用链，DNS 与 fetch 都被本地假实现替换。 */
    table = {
      'src.example': [{ address: '203.0.113.10', family: 4 }],
      'cdn.src.example': [{ address: '203.0.113.11', family: 4 }],
      'rebind.src.example': [{ address: '10.0.0.8', family: 4 }],
      'internal.example': [{ address: '10.0.0.9', family: 4 }]
    };
    calls = [];
    installFakes();

    await check('发布取种重定向逐跳复检，第二跳解析到内网被拒', async function () {
      table.__fetch = function (url) {
        if (url.indexOf('https://src.example/get') === 0) {
          return new Response(null, { status: 302, headers: { location: 'https://rebind.src.example/t.torrent' } });
        }
        return new Response(Buffer.from([0x64, 1, 2, 3]), { status: 200, headers: { 'content-length': '4' } });
      };
      db = openDB(path.join(DATA, 'seedpod.db'));
      const ctx = {
        db: db,
        one: function (s, ...a) { return db.prepare(s).get(...a); },
        all: function (s, ...a) { return db.prepare(s).all(...a); },
        jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
        DATA_DIR: DATA,
        allowReal: function () { return true; }
      };
      const publisher = makePublisher(ctx);
      const r = await publisher.fetchTorrent('https://src.example/get?id=1', 'cid=secret', 'src.example');
      need(r.err && /内网/.test(r.err), '重定向没复检：' + JSON.stringify(r));
      need(calls.length === 1, '复检失败后还发了请求：' + calls.length + ' → ' + calls.join(' , '));
    });

    await check('发布取种正常同站重定向仍可取到种子', async function () {
      calls = [];
      table.__fetch = function (url) {
        if (url.indexOf('https://src.example/get') === 0) {
          return new Response(null, { status: 302, headers: { location: 'https://cdn.src.example/t.torrent' } });
        }
        return new Response(Buffer.from([0x64, 9, 9]), { status: 200, headers: { 'content-length': '3' } });
      };
      const r = await makePublisher({
        db: db,
        one: function (s, ...a) { return db.prepare(s).get(...a); },
        all: function (s, ...a) { return db.prepare(s).all(...a); },
        jparse: function (s) { try { return JSON.parse(s); } catch (e) { return null; } },
        DATA_DIR: DATA,
        allowReal: function () { return true; }
      }).fetchTorrent('https://src.example/get?id=2', 'cid=secret', 'src.example');
      need(r.buf && r.buf.length === 3, '正常重定向被误拦：' + JSON.stringify(r));
      need(calls.length === 2, '跳转次数不对：' + calls.join(' , '));
    });

    const submit = makeSubmit({
      throttle: async function () { return { ok: true }; },
      resolve: function () { return { base: 'https://src.example' }; },
      plan: function () { return { ok: true, data: {} }; },
      cookieOf: function () { return { cookie: 'cid=secret' }; },
      one: function () { return { data: '{}' }; },
      ctx: { allowReal: function () { return true; } },
      torrentMeta: function () { return { hash: 'x' }; },
      textOf: function () { return ''; },
      downloadLinksFromDetails: function () { return []; },
      isDeletedPageText: function () { return false; }
    });

    await check('来源种下载域名解析到内网时拒绝且不发 cookie', async function () {
      table.__fetch = function () { return new Response(Buffer.from([0x64]), { status: 200 }); };
      calls = [];
      const r = await submit.fetchSourceTorrent({ site: 'internal.example', downloadUrl: 'https://internal.example/d.php?id=1' });
      need(r.err && /内网/.test(r.err), '没拦住内网来源：' + JSON.stringify(r));
      need(calls.length === 0, '拦截后还发了请求：' + calls.join(' , '));
    });

    await check('来源种返回 302 时明确报错', async function () {
      table.__fetch = function () { return new Response(null, { status: 302, headers: { location: 'https://cdn.src.example/x' } }); };
      calls = [];
      const r = await submit.fetchSourceTorrent({ site: 'src.example', downloadUrl: 'https://src.example/d.php?id=2' });
      need(r.err && /跳转/.test(r.err), '302 没明确报错：' + JSON.stringify(r));
      need(calls.length === 1, '302 后还继续请求：' + calls.length);
    });
  } finally {
    restoreFakes();
    if (db) { try { db.close(); } catch (e) { /* 已关 */ } }
    fs.rmSync(DATA, { recursive: true, force: true });
  }

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
