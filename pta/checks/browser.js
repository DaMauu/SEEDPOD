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

module.exports = { loadPlaywright, launchChromium };
