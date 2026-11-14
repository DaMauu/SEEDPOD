/* 图床管道夹具：本地 mock HTTP，不碰真实图床。覆盖演练、真上传、重试、失败和链接替换。 */
const http = require('http');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const imagehost = require(path.join(ROOT, 'server', 'imagehost.js'));

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

let hits = 0;
let retryHits = 0;
const bodies = [];
const server = http.createServer(function (req, res) {
  const chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    hits++;
    const body = Buffer.concat(chunks).toString('latin1');
    bodies.push({ url: req.url, body: body, type: req.headers['content-type'] || '' });
    if (req.url === '/retry' && retryHits++ === 0) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('first fail');
      return;
    }
    if (req.url === '/fail') {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('always fail');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: { url: 'http://127.0.0.1:' + server.address().port + '/img/' + hits + '.jpg' } }));
  });
});

async function main() {
  await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  process.env.PTA_IMAGE_HOST_URL = 'http://127.0.0.1:' + port + '/upload';
  process.env.PTA_IMAGE_HOST_FIELD = 'file';
  delete process.env.PTA_IMAGE_HOST_TOKEN;

  await check('演练不上传，只返回计划', async function () {
    const before = hits;
    const r = await imagehost.process('本地图床', [{ name: 'shot1.jpg', url: PNG }], { dryRun: true });
    need(r.ok && r.dryRun && r.code === 'IMAGE_DRY_RUN', '演练结果不对：' + JSON.stringify(r));
    need(r.total === 1 && r.items[0].status === 'planned', '演练计划不对');
    need(hits === before, '演练发了请求：' + (hits - before));
  });

  await check('关闭真上传时拒绝', async function () {
    const before = hits;
    const r = await imagehost.process('本地图床', [{ name: 'shot1.jpg', url: PNG }], { dryRun: false, allowReal: false });
    need(!r.ok && r.code === 'REAL_IMAGES_DISABLED', '错误码不对：' + JSON.stringify(r));
    need(hits === before, '拒绝时仍发了请求');
  });

  await check('本地图床真上传并返回链接', async function () {
    const before = hits;
    const r = await imagehost.process('本地图床', [{ name: 'shot1.jpg', url: PNG }], { dryRun: false, allowReal: true, retries: 0 });
    need(r.ok && r.code === 'IMAGE_UPLOADED' && r.uploaded === 1, '上传结果不对：' + JSON.stringify(r));
    need(/\/img\/\d+\.jpg$/.test(r.items[0].url), '返回链接不对：' + r.items[0].url);
    need(hits === before + 1, '请求数不对：' + (hits - before));
    const sent = bodies[bodies.length - 1];
    need(/name="file"/.test(sent.body), '没有发 file 字段');
    need(/image\/jpeg|image\/png/.test(sent.body), '没有发图片类型');
    need(/multipart\/form-data/.test(sent.type), '不是 multipart：' + sent.type);
  });

  await check('失败后按 retries 重试', async function () {
    process.env.PTA_IMAGE_HOST_URL = 'http://127.0.0.1:' + port + '/retry';
    retryHits = 0;
    const r = await imagehost.process('本地图床', [{ name: 'shot1.jpg', url: PNG }], { dryRun: false, allowReal: true, retries: 1, delayMs: 0 });
    need(r.ok && r.uploaded === 1, '重试后仍失败：' + JSON.stringify(r));
    need(r.items[0].attempts === 2 && retryHits === 2, '重试次数不对：' + r.items[0].attempts + '/' + retryHits);
  });

  await check('重试耗尽时逐张报错', async function () {
    process.env.PTA_IMAGE_HOST_URL = 'http://127.0.0.1:' + port + '/fail';
    const r = await imagehost.process('本地图床', [{ name: 'shot1.jpg', url: PNG }], { dryRun: false, allowReal: true, retries: 0, delayMs: 0 });
    need(!r.ok && r.code === 'IMAGE_UPLOAD_FAILED' && r.failed === 1, '失败结果不对：' + JSON.stringify(r));
    need(/HTTP 500/.test(r.items[0].error || ''), '错误信息不对：' + r.items[0].error);
  });

  await check('Pixhost / 站内不冒充已上传', async function () {
    const p = await imagehost.process('Pixhost', [{ name: 'shot1.jpg', url: PNG }], { dryRun: false, allowReal: true });
    need(!p.ok && p.code === 'IMAGE_HOST_UNVERIFIED', 'Pixhost 应拒绝：' + JSON.stringify(p));
    const s = await imagehost.process('站内', [{ name: 'shot1.jpg', url: PNG }], { dryRun: false, allowReal: true });
    need(s.ok && s.code === 'IMAGE_HOST_MANUAL' && s.uploaded === 0, '站内结果不对：' + JSON.stringify(s));
  });

  await check('replaceDescription 去掉 data URL 并只保留新链接', function () {
    const desc = '简介\n[img]' + PNG + '[/img]';
    const links = [{ name: 'shot1.jpg', url: 'https://img.example/1.jpg' }];
    const a = imagehost.replaceDescription(desc, links);
    need(a.indexOf('data:image') < 0, '还留着 data URL：' + a.slice(0, 120));
    need(a.indexOf('[img]https://img.example/1.jpg[/img]') >= 0, '没有新链接：' + a);
    const b = imagehost.replaceDescription(a, links);
    need(b === a, '重复替换不应再变：' + b);
  });

  server.close(function () {
    const failed = results.filter(function (r) { return !r[0]; }).length;
    results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
    console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
    process.exit(failed ? 1 : 0);
  });
}

main().catch(function (e) {
  console.error('检查脚本自身出错：' + (e && e.message ? e.message : e));
  try { server.close(); } catch (err) {}
  process.exit(1);
});
