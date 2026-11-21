/* watch 目录客户端：把 .torrent 写进目录，由外部客户端监视。
   不联网；只做本地文件写入与可写性探测。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../env');

/* watch 只能写进明确允许的根：WATCH_ROOT、MEDIA_ROOT、DATA_DIR/watch 或 DATA_DIR 本身 */
function allowedRoots() {
  const data = path.resolve(env.read('DATA_DIR','PTA_DATA') || path.join(__dirname, '..', '..', '..', 'data'));
  const list = [];
  const extra = String(env.read('WATCH_ROOT','PTA_WATCH_ROOT') || '').trim();
  if (extra) list.push(path.resolve(extra));
  const media = String(env.read('MEDIA_ROOT','PTA_MEDIA_ROOT') || '').trim();
  if (media) list.push(path.resolve(media));
  list.push(path.join(data, 'watch'), data);
  return list;
}
function normDir(raw, roots) {
  const s = String(raw || '').trim();
  if (!s) return { err: 'watch 目录不能为空' };
  if (!path.isAbsolute(s)) return { err: 'watch 目录必须是绝对路径' };
  if (s.length > 300) return { err: 'watch 目录太长' };
  const abs = path.resolve(s);
  if (abs === '/' || abs === '/proc' || abs === '/sys' || abs === '/dev') return { err: '不能使用系统目录' };
  const allow = Array.isArray(roots) && roots.length ? roots : allowedRoots();
  const ok = allow.some(function (r) { const x = path.resolve(r); return abs === x || abs.indexOf(x + path.sep) === 0; });
  if (!ok) return { err: 'watch 目录不在允许范围；用 PTA_WATCH_ROOT 指定根目录' };
  return { dir: abs };
}
function safeName(raw) {
  const n = String(raw || 'upload.torrent').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').slice(0, 120);
  return n || 'upload.torrent';
}

function test(opts) {
  const d = normDir(opts && opts.dir);
  if (d.err) return { pass: false, error: d.err, steps: [{ step: 'path', ok: false, error: d.err }] };
  const t0 = Date.now();
  try {
    fs.mkdirSync(d.dir, { recursive: true, mode: 0o700 });
    const probe = path.join(d.dir, '.seedpod-write-test-' + process.pid + '-' + Date.now());
    fs.writeFileSync(probe, 'ok', { mode: 0o600 });
    fs.unlinkSync(probe);
    let free = 0, total = 0;
    try {
      const st = fs.statfsSync(d.dir);
      free = Number(st.bavail) * Number(st.bsize);
      total = Number(st.blocks) * Number(st.bsize);
    } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
    return { pass: true, version: 'watch', savePath: d.dir, freeSpace: free, totalSpace: total,
      steps: [{ step: 'write', path: d.dir, ok: true, ms: Date.now() - t0 }] };
  } catch (e) {
    return { pass: false, error: String(e && e.message || e).slice(0, 160),
      steps: [{ step: 'write', path: d.dir, ok: false, error: String(e && e.message || e).slice(0, 160), ms: Date.now() - t0 }] };
  }
}

function addTorrent(opts) {
  const d = normDir(opts && opts.dir);
  if (d.err) return { ok: false, error: 'BAD_WATCH_PATH', message: d.err };
  const buf = opts && opts.buf;
  if (!Buffer.isBuffer(buf) || !buf.length) return { ok: false, error: 'BAD_TORRENT', message: '种子内容为空' };
  const name = safeName(opts.filename || 'upload.torrent');
  let tmp = '';
  try {
    fs.mkdirSync(d.dir, { recursive: true, mode: 0o700 });
    const out = path.join(d.dir, name);
    tmp = path.join(d.dir, '.seedpod-' + process.pid + '-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.tmp');
    fs.writeFileSync(tmp, buf, { mode: 0o600 });
    fs.renameSync(tmp, out);
    tmp = '';
    return { ok: true, path: out, name: name, message: '已写入 ' + d.dir };
  } catch (e) {
    /* 失败不能把临时文件留在 watch 目录 */
    if (tmp) { try { fs.unlinkSync(tmp); } catch (e2) { /* 已不存在 */ } }
    return { ok: false, error: 'WATCH_WRITE_FAILED', message: String(e && e.message || e).slice(0, 160) };
  }
}

module.exports = { normDir, test, addTorrent, safeName };
