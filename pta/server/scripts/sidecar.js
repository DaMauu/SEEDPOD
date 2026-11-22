#!/usr/bin/env node
/* 离线 sidecar CLI：stdin 或 --file 读文本，跑 Python 任务，输出 JSON。
   用法：node pta/scripts/sidecar.js mediainfo --file <txt> [--json]
        cat mediainfo.txt | node pta/scripts/sidecar.js mediainfo --json */
const fs = require('fs');
const { run } = require('../sidecar');

const argv = process.argv.slice(2);
const task = argv[0];
if (!task) {
  console.error('用法：node pta/scripts/sidecar.js <mediainfo> [--file <txt>] [--json]');
  process.exit(2);
}
const fileIdx = argv.indexOf('--file');
const asJson = argv.includes('--json');
function readStdin() {
  return new Promise(function (resolve) {
    let s = '';
    process.stdin.on('data', function (d) { s += d; });
    process.stdin.on('end', function () { resolve(s); });
  });
}
(async function () {
  const text = fileIdx >= 0 ? fs.readFileSync(argv[fileIdx + 1], 'utf8') : await readStdin();
  const r = await run(task, { text: text }, { timeoutMs: 10000 });
  if (asJson || !r.ok) {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }
  const s = r.summary || {};
  console.log('视频 ' + (s.video || 0) + ' · 音频 ' + (s.audio || 0) + ' · 字幕 ' + (s.text || 0) +
    (s.width ? ' · ' + s.width + 'x' + (s.height || '?') : '') + (s.format ? ' · ' + s.format : ''));
})();
