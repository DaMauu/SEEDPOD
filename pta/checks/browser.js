/* 跨平台浏览器启动：Linux 用自带 Chromium（新 headless，支持下载），
   Windows 可设 PTA_CHANNEL=msedge。找不到依赖时退出码 2。 */
const path = require('path');

function loadPlaywright() {
  const tries = [
    process.env.PTA_PW,
    path.join(__dirname, '..', '..', 'node_modules', 'playwright-core'),
    path.join(__dirname, 'node_modules', 'playwright-core'),
    path.join(process.env.TMPDIR || '/tmp', 'pta-shot', 'node_modules', 'playwright-core'),
    'playwright-core'
  ].filter(Boolean);
  for (const t of tries) {
    try { return require(t); } catch (e) {}
  }
  console.error('找不到 playwright-core：在仓库根跑 npm ci，或设置 PTA_PW 指向模块目录');
  process.exit(2);
}

async function launchChromium(chromium) {
  const channel = process.env.PTA_CHANNEL ||
    (process.platform === 'win32' ? 'msedge' : 'chromium');
  const base = { headless: true };
  if (process.getuid && process.getuid() === 0) base.args = ['--no-sandbox'];
  try {
    return await chromium.launch(Object.assign({ channel: channel }, base));
  } catch (e) {
    console.error('浏览器 ' + channel + ' 起不来，回退默认 Chromium：' +
      String(e && e.message ? e.message : e).split('\n')[0]);
    return chromium.launch(base);
  }
}

function serveWeb(root) {
  const http = require('http');
  const fs = require('fs');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2', '.woff': 'font/woff' };
  const server = http.createServer(function (req, res) {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    let f = path.join(root, p);
    if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
    try {
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(root, 'index.html');
      const buf = fs.readFileSync(f);
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      res.end(buf);
    } catch (e) { res.writeHead(404); res.end(); }
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () {
      resolve({ base: 'http://127.0.0.1:' + server.address().port, close: function () { server.close(); } });
    });
  });
}

module.exports = { loadPlaywright, launchChromium, serveWeb };
