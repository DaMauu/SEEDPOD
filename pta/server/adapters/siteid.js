/* 从「浏览器另存的网页」里认出它属于哪个站点。纯解析，不发请求。
   浏览器存的文件名是页面标题，不是域名，所以按三个信号打分：
     1) 页面里自带的绝对链接（同一个域名或它的子域名）—— 最可靠
     2) 书签清单里的站点标题（去掉末尾 [数字-数字-版本] 之后再比）
     3) 域名首段（如 52pt）出现在文件名/页标题里
   返回 { host, score, why } 或 null。 */

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')                       /* 书签标题里的 [01-24-1.1] 这种后缀 */
    .replace(/[\s_\-–—:：·|｜()（）\[\]【】,，。.、\/\\+~“”"';?!！？<>]/g, '');
}

function hostOf(url) {
  return String(url || '').replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase();
}

/* 页面里出现过的域名 → 次数 */
function hostsIn(html) {
  const out = {};
  const re = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const h = m[1].toLowerCase().replace(/^www\./, '');
    if (!h || /(googleapis|gstatic|google-analytics|googletagmanager|w3\.org|cloudflare|jsdelivr|fontawesome|bootstrapcdn|imgur|postimg|jquery)/.test(h)) continue;
    out[h] = (out[h] || 0) + 1;
  }
  return out;
}

/* sites: [{host, title}]；fileName 传原始文件名（可含扩展名） */
function identify(html, fileName, sites) {
  const hosts = hostsIn(html);
  const fname = norm(String(fileName || '').replace(/\.html?$/i, ''));
  const ptitle = norm((String(html || '').match(/<title[^>]*>([\s\S]{0,160}?)<\/title>/i) || ['', ''])[1]);
  let best = null;

  for (const s of (sites || [])) {
    const host = hostOf(s.host);
    if (!host) continue;
    let score = 0;
    let why = '';

    Object.keys(hosts).forEach(function (h) {
      if (h === host || h.endsWith('.' + host)) {
        const sub = 100 + Math.min(hosts[h], 50);
        if (sub > score) { score = sub; why = 'self-link:' + h; }
      }
    });

    const title = norm(s.title);
    if (title.length >= 3 && (fname.indexOf(title) >= 0 || ptitle.indexOf(title) >= 0)) {
      const sub = 60 + Math.min(title.length, 20);
      if (sub > score) { score = sub; why = 'title:' + s.title; }
    }

    const label = host.split('.')[0];
    if (label.length >= 4 && (fname.indexOf(label) >= 0 || ptitle.indexOf(label) >= 0)) {
      const sub = 40 + Math.min(label.length, 10);
      if (sub > score) { score = sub; why = 'label:' + label; }
    }

    if (score && (!best || score > best.score)) best = { host: host, score: score, why: why };
  }

  return best && best.score >= 40 ? best : null;
}

module.exports = { identify: identify, normalize: norm, hostsIn: hostsIn };
