/* target 检查夹具：种子构造器与本地 mock 目标站。 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

function makeTorrent() {
  const announce = 'http://127.0.0.1:1/announce';
  const name = 'target-test';
  const info = Buffer.concat([
    Buffer.from('d6:lengthi1048576e4:name' + Buffer.byteLength(name) + ':'),
    Buffer.from(name),
    Buffer.from('6:pieces20:'),
    Buffer.from('a'.repeat(20)),
    Buffer.from('e')
  ]);
  return Buffer.concat([
    Buffer.from('d8:announce' + Buffer.byteLength(announce) + ':'),
    Buffer.from(announce),
    Buffer.from('4:info'),
    info,
    Buffer.from('e')
  ]);
}

function makeTorrent2() {
  const announce = 'http://127.0.0.1:1/announce';
  const name = 'target-test-2';
  const info = Buffer.concat([
    Buffer.from('d6:lengthi1048576e4:name' + Buffer.byteLength(name) + ':'),
    Buffer.from(name),
    Buffer.from('6:pieces20:'),
    Buffer.from('b'.repeat(20)),
    Buffer.from('e')
  ]);
  return Buffer.concat([
    Buffer.from('d8:announce' + Buffer.byteLength(announce) + ':'),
    Buffer.from(announce),
    Buffer.from('4:info'),
    info,
    Buffer.from('e')
  ]);
}

function infoHash(buf) {
  const i = buf.indexOf(Buffer.from('4:info'));
  return crypto.createHash('sha1').update(buf.slice(i + 6, buf.length - 1)).digest('hex');
}

function startMock(hash, torrentBuf, state, hits, root) {
  const server = http.createServer(function (req, res) {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && u.pathname === '/takeupload.php') {
      const chunks = [];
      req.on('data', function (c) { chunks.push(c); });
      req.on('end', function () {
        const body = Buffer.concat(chunks);
        const ct = String(req.headers['content-type'] || '');
        const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
        const boundary = '--' + (bm ? (bm[1] || bm[2]) : '');
        const parts = body.toString('binary').split(boundary);
        const fields = {};
        let file = null;
        parts.forEach(function (part) {
          const nm = /name="([^"]+)"/.exec(part);
          if (!nm) return;
          const fn = /filename="([^"]*)"/.exec(part);
          const k = part.indexOf('\r\n\r\n');
          if (k < 0) return;
          let val = part.slice(k + 4);
          const e = val.lastIndexOf('\r\n');
          if (e >= 0) val = val.slice(0, e);
          const valBuf = Buffer.from(val, 'binary');
          if (fn) file = { field: nm[1], filename: fn[1], bytes: valBuf.length };
          else fields[nm[1]] = valBuf.toString('utf8');
        });
        hits.push({ fields: fields, file: file, cookie: req.headers.cookie || '' });
        state.published = true;
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<html><body><a href="details.php?id=999">推荐</a> 上传成功 <a href="details.php?id=42&uploaded=1">详情</a></body></html>');
      });
      return;
    }
    if (req.method === 'GET' && u.pathname === '/edit.php') {
      const id = u.searchParams.get('id') || '42';
      res.writeHead(200, { 'content-type': 'text/html' });
      if (id === '43') {
        res.end('<html><body><form action="delete.php" method="post">'
          + '<input type="hidden" name="id" value="43">'
          + '<input type="radio" name="reasontype" value="1">断种 '
          + '<input type="radio" name="reasontype" value="2">重复 <input type="text" name="reason[]">'
          + '<input type="radio" name="reasontype" value="3">劣质 <input type="text" name="reason[]">'
          + '<input type="radio" name="reasontype" value="4">违规 <input type="text" name="reason[]">'
          + '<input type="radio" name="reasontype" value="5" checked>其他 <input type="text" name="reason[]">'
          + '<input type="submit" value="删除"></form></body></html>');
      } else {
        res.end('<html><body><form action="delete.php" method="post">'
          + '<input type="hidden" name="id" value="42"><input type="hidden" name="force" value="0"><input type="hidden" name="type" value="torrent">'
          + '<input type="radio" name="reason_type" value="1">断种 '
          + '<input type="radio" name="reason_type" value="0">其他 具体原因 '
          + '<textarea name="reason_input"></textarea>'
          + '<input type="submit" id="delete-torrent" value="删除"></form></body></html>');
      }
      return;
    }
    if (req.method === 'POST' && u.pathname === '/delete.php') {
      const chunks = [];
      req.on('data', function (c) { chunks.push(c); });
      req.on('end', function () {
        const p = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
        state.deleteBody = Object.fromEntries(p);
        state.deleteBodyReasons = p.getAll('reason[]');
        state.deleteHits++;
        state.deletedId = String(state.deleteBody.id || '42');
        state.mockDeleted = true;
        res.writeHead(302, { location: '/details.php?id=' + state.deletedId });
        res.end();
      });
      return;
    }
    if (req.method === 'GET' && u.pathname === '/usercp.php') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><a href="announce.php?passkey=testpass123">announce</a></body></html>');
      return;
    }
    if (req.method === 'GET' && u.pathname === '/upload-form') {
      const html = fs.readFileSync(path.join(root, 'fixtures', 'upload-form.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
      return;
    }
    if (req.method === 'GET' && u.pathname === '/download.php') {
      state.downloadHits++;
      res.writeHead(200, { 'content-type': 'application/x-bittorrent' });
      res.end(torrentBuf);
      return;
    }
    if (req.method === 'GET' && (u.pathname === '/torrents.php' || u.pathname === '/details.php')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      if (u.pathname === '/torrents.php' && !state.published) {
        res.end('<html><body><div>没有找到结果</div></body></html>');
        return;
      }
      if (state.mockDeleted && state.deletedId === '43') {
        res.end('<html><body>错误 没有该ID的种子</body></html>');
        return;
      }
      if (state.mockDeleted) {
        res.end('<html><body>该种子曾被 MOCK 删除 原因：Other: 测试 [回收站]</body></html>');
        return;
      }
      if (/echo[ +]only/i.test(decodeURIComponent(u.search || ''))) {
        res.end('<html><body><input name="search" value="Echo Only 2024 1080p"><div>没有找到结果</div></body></html>');
        return;
      }
      res.end('<html><body><a href="details.php?id=42">Target Upload Test 2024 1080p Blu-ray</a><div>' + hash + '</div><a href="download.php?id=42">下载</a></body></html>');
      return;
    }
    res.writeHead(404); res.end('no');
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve(server); });
  });
}

module.exports = { makeTorrent, makeTorrent2, infoHash, startMock };
