/* 引擎识别：按页面特征和 URL 判断 NexusPHP / UNIT3D / Gazelle / Generic。
   不依赖站名，不发请求；纯函数，便于夹具断言。 */
const PATTERNS = {
  nexusphp: [
    /takelogin\.php/i,
    /torrents\.php/i,
    /details\.php\?id=/i,
    /download\.php\?id=/i,
    /name=["']cat\[\]/i,
    /nexusphp/i
  ],
  unit3d: [
    /\/api\/v1\//i,
    /livewire/i,
    /\/torrents\/\d+/i,
    /unit3d/i,
    /\/download\//i,
    /wire:snapshot/i
  ],
  gazelle: [
    /ajax\.php\?action=/i,
    /torrents\.php\?id=/i,
    /torrents\.php\?torrentid=/i,
    /gazelle/i,
    /class=["']torrent_table/i
  ]
};

function urlHits(engine, url) {
  const u = String(url || '');
  if (engine === 'nexusphp') return /torrents\.php|details\.php|download\.php|takelogin/i.test(u);
  if (engine === 'unit3d') return /\/torrents(\/|$)/i.test(u) && !/\.php/i.test(u);
  if (engine === 'gazelle') return /torrents\.php\?id=|ajax\.php\?action=|torrents\.php\?torrentid=/i.test(u);
  return false;
}

function detectEngine(html, url) {
  const s = String(html || '');
  const scores = {};
  Object.keys(PATTERNS).forEach(function (engine) {
    const hits = [];
    PATTERNS[engine].forEach(function (p) { if (p.test(s)) hits.push(p.source); });
    if (urlHits(engine, url)) hits.push('url');
    scores[engine] = { hits: hits, score: hits.length };
  });
  const ranked = Object.keys(scores).sort(function (a, b) { return scores[b].score - scores[a].score; });
  const best = ranked[0];
  const score = scores[best].score;
  const engine = score >= 2 ? best : 'generic';
  const confidence = Math.min(1, score / 3);
  return { engine: engine, confidence: confidence, hits: scores[best].hits, scores: scores };
}

module.exports = { detectEngine, PATTERNS };
