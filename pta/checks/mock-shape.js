/* mock 契约：本地上传表单夹具必须和适配器/提交代码认的字段一致，避免 mock 自己编一套。 */
const fs = require('fs');
const path = require('path');
const form = require('../server/form');

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

const html = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'upload-form.html'), 'utf8');
const forms = form.parse(html);

check('上传表单夹具字段与提交代码一致', function () {
  const f = forms.filter(function (x) { return /takeupload\.php/.test(x.action); })[0];
  need(f, '没有 takeupload 表单');
  need(f.method === 'post', '表单不是 POST');
  need(f.fileField === 'torrent', '文件字段不是 torrent：' + f.fileField);
  const names = f.fields.map(function (x) { return x.name; });
  ['name', 'small_desc', 'type', 'descr', 'anon', 'torrent'].forEach(function (k) {
    need(names.indexOf(k) >= 0, '缺少字段 ' + k + '：' + names.join(','));
  });
});

check('target mock 用同一份表单夹具，不另写字段', function () {
  const src = fs.readFileSync(path.join(__dirname, 'target-mock.js'), 'utf8');
  need(/upload-form\.html/.test(src), 'mock 没读上传表单夹具');
  need(/takeupload\.php/.test(src), 'mock 没有 takeupload 响应');
  need(!/name="(file|file_input)"/.test(src), 'mock 自己硬编码了文件字段');
});

const pass = results.filter(function (r) { return r[0]; }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
