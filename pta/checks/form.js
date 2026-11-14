/* 上传表单解析夹具：只读本地 HTML，不联网。 */
const fs = require('fs');
const path = require('path');
const form = require('../server/form');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'fixtures', 'upload-form.html'), 'utf8');
const results = [];

function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('识别上传表单基本信息', function () {
  const forms = form.parse(HTML);
  need(forms.length === 1, '表单数量不对：' + forms.length);
  need(forms[0].action === '/takeupload.php', 'action 不对：' + forms[0].action);
  need(forms[0].method === 'post', 'method 不对');
  need(/multipart/.test(forms[0].enctype), 'enctype 不对');
  need(forms[0].fileField === 'torrent', '文件字段不对：' + forms[0].fileField);
});

check('字段集合与提交流略正确', function () {
  const fields = form.parse(HTML)[0].fields;
  need(fields.length === 6, '字段数量不对：' + fields.length);
  const names = fields.map(function (f) { return f.name }).sort().join(',');
  need(names === 'anon,descr,name,small_desc,torrent,type', '字段集合不对：' + names);
  need(!fields.some(function (f) { return f.type === 'submit' }), 'submit 不该进映射');
});

check('默认值模板猜对', function () {
  const by = {};
  form.parse(HTML)[0].fields.forEach(function (f) { by[f.name] = f.template });
  need(by.name === '{title}', '标题模板不对：' + by.name);
  need(by.small_desc === '{subtitle}', '副标题模板不对：' + by.small_desc);
  need(by.descr === '{description}', '简介模板不对：' + by.descr);
  need(by.type === '{catId}', '分类模板不对：' + by.type);
  need(by.anon === '{anonymous}', '匿名模板不对：' + by.anon);
  need(by.torrent === '', '文件字段不该有值模板：' + by.torrent);
});

check('select 选项保留', function () {
  const f = form.parse(HTML)[0].fields.filter(function (x) { return x.name === 'type' })[0];
  need(f && f.type === 'select', '分类不是 select');
  need(f.options.length === 2 && f.options[0].value === '401', 'select 选项不对');
});

check('没有 form 时按片段解析，空 HTML 返回空', function () {
  const frag = form.parse('<div><input name="title" type="text"></div>');
  need(frag.length === 1 && frag[0].action === '' && frag[0].fields.length === 1, '片段解析不对');
  need(form.parse('').length === 0, '空 HTML 不该有表单');
});

const pass = results.filter(function (r) { return r[0] }).length;
results.forEach(function (r) { console.log((r[0] ? 'PASS  ' : 'FAIL  ') + r[1] + (r[2] ? '  → ' + r[2] : '')); });
console.log('\n' + pass + '/' + results.length + ' 通过');
process.exit(pass === results.length ? 0 : 1);
