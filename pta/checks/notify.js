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

  await check('events=off 全部跳过', async function () {
    events = 'off';
    const r = await notify.send('publish.failed', '不会发');
    need(r.skipped === true && r.reason === 'off', 'off 没跳过：' + JSON.stringify(r));
    need(hits.length === 2, 'off 时不该发请求');
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
