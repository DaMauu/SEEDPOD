/* Telegram 通知夹具：本地 mock Bot API，验证发送、跳过、未配置。不连真实 Telegram。 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { makeNotify } = require(path.join(ROOT, 'server', 'notify.js'));
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-notify-'));
const secretbox = require(path.join(ROOT, 'server', 'secretbox.js'));
const results = [];
const hits = [];
let events = 'error';
let server = null;
let port = 0;

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function listen() {
  return new Promise(function (resolve) {
    server = http.createServer(function (req, res) {
      let body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', function () {
        hits.push({ url: req.url, body: body ? JSON.parse(body) : null });
        if (req.url === '/webhook-always-fail') {
          res.writeHead(500); res.end('fail'); return;
        }
        if (req.url === '/webhook-flaky') {
          const n = hits.filter(function (x) { return x.url === '/webhook-flaky'; }).length;
          if (n === 1) { res.writeHead(500); res.end('fail'); return; }
          res.writeHead(200); res.end('ok'); return;
        }
        if (/^\/bad\//.test(req.url)) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, description: 'fixture telegram down' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result: { message_id: hits.length } }));
      });
    });
    server.listen(0, '127.0.0.1', function () { port = server.address().port; resolve(); });
  });
}
function ctx(cfg) {
  return { DATA_DIR: DATA, one: function () { return { v: JSON.stringify(cfg || { notifyEvents: events }) }; } };
}

async function main() {
  await listen();
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_ALLOWED_USER_ID = '12345';
  process.env.PTA_TELEGRAM_API = 'http://127.0.0.1:' + port;
  delete process.env.PTA_NOTIFY_WEBHOOK;
  const notify = makeNotify(ctx());

  await check('status 只回是否配置，不回 token', async function () {
    const st = notify.status();
    need(st.telegram === true, 'telegram 未识别为已配置');
    need(st.channel === 'telegram', 'channel 不对：' + st.channel);
    need(st.events === 'error', 'events 不对：' + st.events);
    need(!('token' in st), 'status 泄露了 token');
    need(st.chat === '12345', 'chat 没回给面板：' + st.chat);
  });

  await check('失败事件发到 Telegram', async function () {
    const r = await notify.send('publish.failed', 'SEEDPOD 发布失败 · q_0001');
    need(r.ok === true && r.channel === 'telegram', '发送结果不对：' + JSON.stringify(r));
    need(hits.length === 1, '请求次数不对：' + hits.length);
    need(hits[0].url === '/bottest-token/sendMessage', 'Bot API 路径不对：' + hits[0].url);
    need(hits[0].body.chat_id === '12345', 'chat_id 不对：' + hits[0].body.chat_id);
    need(hits[0].body.text.indexOf('发布失败') >= 0, '消息内容不对：' + hits[0].body.text);
  });

  await check('非失败事件默认跳过', async function () {
    const r = await notify.send('scheduler.run', '调度完成');
    need(r.skipped === true && r.reason === 'not_error', '非失败事件没跳过：' + JSON.stringify(r));
    need(hits.length === 1, '跳过时不该发请求');
  });

  await check('测试通知强制发送', async function () {
    const r = await notify.send('test', 'SEEDPOD 通知测试', {}, { force: true });
    need(r.ok === true, '测试发送失败：' + JSON.stringify(r));
    need(hits.length === 2, '测试请求次数不对：' + hits.length);
    need(hits[1].body.text.indexOf('通知测试') >= 0, '测试内容不对');
  });

  await check('Telegram 失败时 webhook 兜底', async function () {
    const prev = process.env.PTA_TELEGRAM_API;
    process.env.PTA_TELEGRAM_API = 'http://127.0.0.1:' + port + '/bad';
    const n2 = makeNotify(ctx({ notifyEvents: 'error', notifyWebhook: 'http://127.0.0.1:' + port + '/webhook' }));
    const r = await n2.send('publish.failed', 'fallback test');
    if (prev === undefined) delete process.env.PTA_TELEGRAM_API; else process.env.PTA_TELEGRAM_API = prev;
    need(r.ok === true && r.channel === 'webhook', '没走 webhook：' + JSON.stringify(r));
    need(hits[hits.length - 1].body.event === 'publish.failed', 'webhook 事件不对：' + JSON.stringify(hits[hits.length - 1].body));
  });

  await check('webhook 失败按次数重试', async function () {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chat = process.env.TELEGRAM_ALLOWED_USER_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ALLOWED_USER_ID;
    const n2 = makeNotify(ctx({ notifyEvents: 'error', notifyWebhook: 'http://127.0.0.1:' + port + '/webhook-flaky' }));
    const r = await n2.send('publish.failed', 'retry webhook', {}, { force: true, webhookRetries: 1, webhookDelayMs: 0 });
    if (token === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = token;
    if (chat === undefined) delete process.env.TELEGRAM_ALLOWED_USER_ID; else process.env.TELEGRAM_ALLOWED_USER_ID = chat;
    need(r.ok === true && r.channel === 'webhook' && r.attempts === 2, 'webhook 重试不对：' + JSON.stringify(r));
    const got = hits.filter(function (x) { return x.url === '/webhook-flaky'; });
    need(got.length === 2, 'webhook 请求次数不对：' + got.length);
  });

  await check('webhook 重试有上限', async function () {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chat = process.env.TELEGRAM_ALLOWED_USER_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ALLOWED_USER_ID;
    const n2 = makeNotify(ctx({ notifyEvents: 'error', notifyWebhook: 'http://127.0.0.1:' + port + '/webhook-always-fail' }));
    const before = hits.filter(function (x) { return x.url === '/webhook-always-fail'; }).length;
    const r = await n2.send('publish.failed', 'always fail', {}, { force: true, webhookRetries: 99, webhookDelayMs: 0 });
    if (token === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = token;
    if (chat === undefined) delete process.env.TELEGRAM_ALLOWED_USER_ID; else process.env.TELEGRAM_ALLOWED_USER_ID = chat;
    const after = hits.filter(function (x) { return x.url === '/webhook-always-fail'; }).length;
    need(r.ok === false && r.attempts === 4, '重试上限不对：' + JSON.stringify(r));
    need(after - before === 4, '实际请求次数不对：' + (after - before));
  });

  await check('Telegram 和 webhook 同时失败返回错误', async function () {
    const api = process.env.PTA_TELEGRAM_API;
    process.env.PTA_TELEGRAM_API = 'http://127.0.0.1:' + port + '/bad';
    const n2 = makeNotify(ctx({ notifyEvents: 'error', notifyWebhook: 'http://127.0.0.1:' + port + '/webhook-always-fail' }));
    const r = await n2.send('publish.failed', 'both fail', {}, { force: true, webhookRetries: 0 });
    if (api === undefined) delete process.env.PTA_TELEGRAM_API; else process.env.PTA_TELEGRAM_API = api;
    need(r.ok === false && r.channel === 'webhook', '双通道失败结果不对：' + JSON.stringify(r));
  });

  await check('Telegram 关闭后自动切到 webhook', async function () {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chat = process.env.TELEGRAM_ALLOWED_USER_ID;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ALLOWED_USER_ID;
    const n2 = makeNotify(ctx({ notifyEvents: 'error', notifyWebhook: 'http://127.0.0.1:' + port + '/webhook' }));
    const st = n2.status();
    need(st.channel === 'webhook' && st.telegram === false && st.webhook === true, '渠道切换状态不对：' + JSON.stringify(st));
    const before = hits.length;
    const r = await n2.send('publish.failed', 'webhook switch', {}, { force: true });
    if (token === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = token;
    if (chat === undefined) delete process.env.TELEGRAM_ALLOWED_USER_ID; else process.env.TELEGRAM_ALLOWED_USER_ID = chat;
    need(r.ok === true && r.channel === 'webhook', '没切到 webhook：' + JSON.stringify(r));
    need(hits.length === before + 1 && hits[hits.length - 1].url === '/webhook', 'webhook 请求不对');
  });

  await check('events=off 全部跳过', async function () {
    events = 'off';
    const before = hits.length;
    const r = await notify.send('publish.failed', '不会发');
    need(r.skipped === true && r.reason === 'off', 'off 没跳过：' + JSON.stringify(r));
    need(hits.length === before, 'off 时不该发请求');
  });

  await check('面板加密配置兜底', async function () {
    events = 'error';
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ALLOWED_USER_ID;
    const key = secretbox.loadKey(DATA);
    const enc = secretbox.encrypt('cfg-token', key.key);
    const n2 = makeNotify(ctx({ notifyEvents: 'error', notifyTgToken: enc, notifyTgChat: '777' }));
    const st = n2.status();
    need(st.telegram === true && st.source === 'config' && st.chat === '777', '面板配置没生效：' + JSON.stringify(st));
    const r = await n2.send('test', 'config test', {}, { force: true });
    need(r.ok === true, '面板配置发送失败：' + JSON.stringify(r));
    need(hits[hits.length - 1].body.chat_id === '777', 'chat_id 不对：' + hits[hits.length - 1].body.chat_id);
  });

  await check('没有 token 时返回 no_channel', async function () {
    events = 'error';
    delete process.env.TELEGRAM_BOT_TOKEN;
    const n2 = makeNotify(ctx());
    need(n2.status().telegram === false, '没 token 仍显示已配置');
    const r = await n2.send('test', 'x', {}, { force: true });
    need(r.skipped === true && r.reason === 'no_channel', '没 token 没跳过：' + JSON.stringify(r));
  });

  if (server) server.close();
  results.forEach(function (r) {
    console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  });
  const failed = results.filter(function (r) { return !r[0]; }).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : String(e)));
  if (server) server.close();
  process.exit(1);
});
