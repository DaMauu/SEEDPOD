/* 引擎默认路径夹具：单站配置优先，Unit3D 搜索/上传页走新版路由。不联网。 */
const path = require('path');
const { searchPath, uploadFormPaths } = require(path.join(__dirname, '..', 'src', 'features', 'sites', 'defaults.js'));

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name, '']); }
  catch (e) { results.push([false, name, e && e.message ? e.message : String(e)]); }
}
function need(cond, msg) { if (!cond) throw new Error(msg); }

check('搜索页默认路径按引擎区分', function () {
  need(searchPath('unit3d', '') === '/torrents', 'Unit3D 搜索默认不是 /torrents：' + searchPath('unit3d', ''));
  need(searchPath('gazelle', '') === '/torrents.php', 'Gazelle 搜索默认不对');
  need(searchPath('nexusphp', '') === '/torrents.php', 'NexusPHP 搜索默认不对');
  need(searchPath('', '') === '/torrents.php', '未知引擎搜索默认不对');
});

check('站点自己写的搜索路径优先', function () {
  need(searchPath('unit3d', '/browse') === '/browse', '单站路径被默认值覆盖');
  need(searchPath('nexusphp', ' /torrents.php ') === '/torrents.php', '路径没去空格');
});

check('Unit3D 上传页先旧后新，且不重复', function () {
  const paths = uploadFormPaths('unit3d', '/torrents/create');
  need(paths[0] === '/torrents/create', '当前路径没排第一：' + JSON.stringify(paths));
  need(paths.indexOf('/upload/1') > 0, '缺新版 /upload/1：' + JSON.stringify(paths));
  need(paths.indexOf('/torrents/upload') > 0, '缺旧备用 /torrents/upload：' + JSON.stringify(paths));
  need(new Set(paths).size === paths.length, '备用路径有重复：' + JSON.stringify(paths));
});

check('Gazelle / NexusPHP 上传备用路径', function () {
  need(uploadFormPaths('gazelle', '').indexOf('/upload.php') >= 0, 'Gazelle 缺 /upload.php');
  need(uploadFormPaths('nexusphp', '').indexOf('/takeupload.php') >= 0, 'NexusPHP 缺 /takeupload.php');
  need(JSON.stringify(uploadFormPaths('custom', '/up')) === JSON.stringify(['/up']), '未知引擎不该猜备用路径');
});

for (const [ok, name, why] of results) console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '  → ' + why));
const failed = results.filter(function (r) { return !r[0]; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' 通过');
process.exit(failed ? 1 : 0);
