/* 种子清洗夹具：替换 announce/announce-list，info 字节和 infohash 必须不变。 */
const crypto = require('crypto');
const clean = require('../server/torrent-clean');
const { makeQb } = require('../server/qb');
const qb = makeQb(require('os').tmpdir());
const results = [];
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(function () { results.push([true, name, '']); })
    .catch(function (e) { results.push([false, name, e && e.message ? e.message.split('\n')[0] : String(e)]); });
}
function need(cond, msg) { if (!cond) throw new Error(msg); }
function str(s) { const b = Buffer.from(String(s)); return Buffer.concat([Buffer.from(b.length + ':'), b]); }
function int(n) { return Buffer.from('i' + n + 'e'); }
function makeTorrent() {
  const name = 'clean-test';
  const piece = Buffer.alloc(20, 0x61);
  const info = Buffer.concat([Buffer.from('d'), str('length'), int(262144), str('name'), str(name), str('piece length'), int(262144), str('pieces'), Buffer.concat([Buffer.from('20:'), piece]), Buffer.from('e')]);
  return Buffer.concat([
    Buffer.from('d'),
    str('announce'), str('https://source.example/announce.php?passkey=old'),
    str('announce-list'), Buffer.from('ll'), str('https://source.example/announce.php?passkey=old'), Buffer.from('ee'),
    str('comment'), str('keep-me'),
    str('info'), info,
    Buffer.from('e')
  ]);
}
async function main() {
  const src = makeTorrent();
  const srcHash = clean.infoHashOf(src);
  await check('读取源 announce', function () {
    need(clean.announceOf(src).indexOf('source.example') >= 0, '源 announce 不对');
  });
  await check('替换 announce 且 infohash 不变', function () {
    const out = clean.replaceAnnounce(src, 'https://target.example/announce.php?passkey=new');
    need(clean.announceOf(out).indexOf('target.example') >= 0, '新 announce 没写进去');
    need(clean.infoHashOf(out) === srcHash, 'infohash 变了');
    need(srcHash === crypto.createHash('sha1').update(src.slice(src.indexOf(Buffer.from('4:info')) + 6, src.length - 1)).digest('hex'), '源 infohash 计算不对');
    const meta = qb.parseTorrent(out);
    need(meta && meta.hash === srcHash, '清洗后解析不出原 hash');
    need(out.toString('utf8').indexOf('keep-me') >= 0, '其他字段丢了');
  });
  await check('清理 announce-list', function () {
    const out = clean.replaceAnnounce(src, 'https://target.example/announce.php?passkey=new');
    const text = out.toString('utf8');
    need(text.indexOf('source.example') < 0, '旧 announce-list 还在');
    need(text.indexOf('target.example') >= 0, '新 announce-list 不在');
  });
  await check('改 info.source/private 会改 hash 但不改文件名', function () {
    const srcHash = clean.infoHashOf(src);
    const out = clean.setInfoField(src, 'source', '[target] Example');
    need(clean.infoHashOf(out.buf) !== srcHash, '改 source 后 hash 没变');
    need(out.beforeInfohash === srcHash, 'before hash 不对');
    need(qb.parseTorrent(out.buf).name === 'clean-test', '改 source 后 info.name 变了');
    need(out.buf.toString('utf8').indexOf('[target] Example') >= 0, 'source 没写进去');
    need(clean.announceOf(out.buf).indexOf('source.example') >= 0, '改 source 不该动 announce');
    const p = clean.setInfoField(src, 'private', 1);
    need(clean.infoHashOf(p.buf) !== srcHash, '改 private 后 hash 没变');
    need(p.buf.toString('utf8').indexOf('7:privatei1e') >= 0, 'private 没写进去');
  });

  await check('拒绝改文件布局字段', function () {
    let ok = false;
    try { clean.setInfoField(src, 'name', 'x'); } catch (e) { ok = true; }
    need(ok, '改 info.name 没被拒绝');
  });

  await check('拒绝空/非 http announce', function () {
    let ok = false;
    try { clean.replaceAnnounce(src, 'not-a-url'); } catch (e) { ok = true; }
    need(ok, '非 http announce 没被拒绝');
    let ok2 = false;
    try { clean.replaceAnnounce(src, ''); } catch (e) { ok2 = true; }
    need(ok2, '空 announce 没被拒绝');
  });
  for (const r of results) console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : ''));
  const failed = results.filter(function (r) { return !r[0]; }).length;
  console.log(results.length - failed + '/' + results.length + ' 通过');
  process.exit(failed ? 1 : 0);
}
main().catch(function (e) { console.error(e); process.exit(1); });
