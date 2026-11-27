/* 各引擎的默认页面路径：只在站点没写 path 时使用，单站配置永远优先。 */
const SEARCH_PATH = {
  nexusphp: '/torrents.php',
  unit3d: '/torrents',
  gazelle: '/torrents.php',
  custom: '/torrents.php'
};

/* 上传页 GET 地址的备用顺序；Unit3D 新版是 /upload/<分类 ID>，旧版是 /torrents/create。 */
const UPLOAD_FORM_FALLBACK = {
  nexusphp: ['/upload.php', '/takeupload.php'],
  unit3d: ['/torrents/create', '/upload/1', '/torrents/upload', '/upload'],
  gazelle: ['/upload.php', '/torrents/upload.php']
};

function engineOf(engine) {
  return String(engine || '').toLowerCase();
}

function searchPath(engine, current) {
  const p = String(current || '').trim();
  if (p) return p;
  return SEARCH_PATH[engineOf(engine)] || '/torrents.php';
}

function uploadFormPaths(engine, current) {
  const first = String(current || '').trim();
  const list = [first].concat(UPLOAD_FORM_FALLBACK[engineOf(engine)] || []);
  const seen = {};
  return list.filter(function (p) {
    if (!p || seen[p]) return false;
    seen[p] = true;
    return true;
  });
}

module.exports = { SEARCH_PATH, UPLOAD_FORM_FALLBACK, searchPath, uploadFormPaths };
