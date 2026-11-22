/* Python sidecar：MediaInfo 解析、未知任务/空输入/CLI JSON。本地夹具，不联网。 */
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../sidecar');

const ROOT = path.resolve(__dirname, '..', '..');
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const SAMPLE = `General
Complete name : test.mkv
Duration : 1 h 59 min
File size : 20.0 GiB

Video
Format : HEVC
Width : 1920 pixels
Height : 1080 pixels
Duration : 1 h 59 min

Audio #1
Format : AC-3
Language : Chinese

Audio #2
Format : DTS
Language : English

Text #1
Format : PGS
Language : Chinese
`;

(async function main() {
  await check('MediaInfo 文本解析', async () => {
    const r = await run('mediainfo', { text: SAMPLE });
    need(r && r.ok === true, '解析失败：' + JSON.stringify(r).slice(0, 200));
    need(r.summary.video === 1 && r.summary.audio === 2 && r.summary.text === 1, '轨道数不对：' + JSON.stringify(r.summary));
    need(r.summary.width === '1920 pixels' && r.summary.height === '1080 pixels', '分辨率没解析：' + JSON.stringify(r.summary));
    need(r.summary.audio_formats.join(',') === 'AC-3,DTS', '音频格式不对：' + JSON.stringify(r.summary.audio_formats));
  });

  await check('未知任务被拒绝', async () => {
    const r = await run('rm-rf', { text: 'x' });
    need(r && r.ok === false && r.code === 'SIDECAR_UNKNOWN_TASK', '未知任务没拦住：' + JSON.stringify(r));
  });

  await check('空输入返回错误', async () => {
    const r = await run('mediainfo', { text: '' });
    need(r && r.ok === false && /no mediainfo sections/.test(r.error || ''), '空输入没报错：' + JSON.stringify(r));
  });

  await check('CLI 输出 JSON', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pta-sidecar-')), 'mi.txt');
    fs.writeFileSync(file, SAMPLE);
    const out = await new Promise(function (resolve) {
      execFile(process.execPath, [path.join(ROOT, 'server', 'scripts', 'sidecar.js'), 'mediainfo', '--file', file, '--json'], { timeout: 15000 }, function (err, stdout, stderr) {
        resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || '') });
      });
    });
    need(out.code === 0, 'CLI 退出码不对：' + out.code + ' ' + out.stderr.slice(0, 100));
    let j = null;
    try { j = JSON.parse(out.stdout); } catch (e) { j = null; }
    need(j && j.ok === true && j.summary.audio === 2, 'CLI JSON 不对：' + out.stdout.slice(0, 200));
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });

  const pass = results.filter(function (r) { return r[0]; }).length;
  results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
  console.log('\n' + pass + '/' + results.length + ' 通过');
  process.exit(pass === results.length ? 0 : 1);
})();
