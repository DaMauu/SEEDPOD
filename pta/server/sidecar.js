/* Python sidecar 桥：只跑离线任务，JSON in/out，不监听端口、不共享数据库。
   任务白名单固定，避免把任意命令暴露给调用方。 */
const { spawn } = require('child_process');
const path = require('path');

const TASKS = {
  mediainfo: path.join(__dirname, 'sidecar', 'mediainfo.py')
};
const MAX_INPUT = 512 * 1024;
const MAX_OUTPUT = 2 * 1024 * 1024;

function run(task, input, opts) {
  const name = String(task || '').trim();
  const script = TASKS[name];
  if (!script) return Promise.resolve({ ok: false, code: 'SIDECAR_UNKNOWN_TASK', error: '未知 sidecar 任务：' + name });
  const o = opts || {};
  const timeoutMs = Math.max(1000, Math.min(30000, Number(o.timeoutMs) || 10000));
  let payload;
  try {
    payload = JSON.stringify(input && typeof input === 'object' ? input : {});
  } catch (e) {
    return Promise.resolve({ ok: false, code: 'SIDECAR_BAD_INPUT', error: '输入无法序列化' });
  }
  if (Buffer.byteLength(payload) > MAX_INPUT) {
    return Promise.resolve({ ok: false, code: 'SIDECAR_INPUT_TOO_LARGE', error: '输入超过 512KB' });
  }
  return new Promise(function (resolve) {
    let child;
    try {
      child = spawn(process.env.PTA_PYTHON || 'python3', [script], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH || '', PYTHONIOENCODING: 'utf-8', LANG: 'C.UTF-8' }
      });
    } catch (e) {
      resolve({ ok: false, code: 'SIDECAR_SPAWN_FAILED', error: String(e && e.message || e).slice(0, 200) });
      return;
    }
    let out = '', err = '', done = false;
    const timer = setTimeout(function () {
      if (done) return;
      done = true;
      try { child.kill('SIGKILL'); } catch (e) { /* 忽略：进程可能已退出 */ }
      resolve({ ok: false, code: 'SIDECAR_TIMEOUT', error: 'sidecar 超过 ' + timeoutMs + 'ms' });
    }, timeoutMs);
    child.stdout.on('data', function (d) {
      out += d;
      if (out.length > MAX_OUTPUT) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { child.kill('SIGKILL'); } catch (e) { /* 忽略：进程可能已退出 */ }
        resolve({ ok: false, code: 'SIDECAR_OUTPUT_TOO_LARGE', error: 'sidecar 输出超过 2MB' });
      }
    });
    child.stderr.on('data', function (d) { err += d; });
    child.on('error', function (e) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok: false, code: 'SIDECAR_SPAWN_FAILED', error: String(e && e.message || e).slice(0, 200) });
    });
    child.on('close', function (code) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      let parsed = null;
      try { parsed = JSON.parse(out || 'null'); } catch (e) { parsed = null; }
      if (!parsed || typeof parsed !== 'object') {
        resolve({ ok: false, code: 'SIDECAR_BAD_OUTPUT', error: String(err || out || 'sidecar 没有返回 JSON').slice(0, 200), exitCode: code });
        return;
      }
      resolve(parsed);
    });
    child.stdin.on('error', function () { /* 忽略：子进程可能提前退出 */ });
    child.stdin.end(payload);
  });
}

module.exports = { run, TASKS };
