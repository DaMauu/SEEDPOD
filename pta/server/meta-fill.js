/* 简介补齐：源站详情没有简介，或终审前仍缺简介时，用公开影片库补一条。
   规则与抓取阶段一致：realCrawl 打开、允许联网补简介、匹配来源顺序。
   只改传入的 item 对象，落库由调用方负责。 */
const metaExt = require('./meta-ext');
const flowConfig = require('./flow-config');

function makeMetaFill(ctx) {
  const { one } = ctx;
  function cfg() {
    const r = one("SELECT v FROM meta WHERE k = 'config'");
    return JSON.parse(r ? r.v : 'null') || {};
  }
  async function fillIntro(item) {
    if (!cfg().realCrawl) return { ok: false, code: 'REAL_CRAWL_OFF' };
    /* 源站详情页已经有 BBCode 简介的，不要用电影站简介覆盖 */
    if (String(item.descrBb || '').trim()) return { ok: true, cached: true, source: 'source_detail' };
    const flow = flowConfig.read(ctx);
    if (!flowConfig.on(flow, '允许联网补简介', true)) return { ok: false, code: 'RULE_OFF' };
    const order = String(flowConfig.value(flow, '匹配来源顺序', 'TMDB → 豆瓣 → 站点标题'));
    if (order === '只用站点标题') return { ok: false, code: 'SOURCE_TITLE_ONLY' };
    try {
      const r = await metaExt.fetchMeta({ title: item.title, year: item.year, type: item.category || 'movie' });
      if (!r.ok || !r.data) {
        item.metaNote = r.code || 'NOT_FOUND';
        return { ok: false, code: r.code || 'NOT_FOUND' };
      }
      const d = r.data;
      const ov = String(d.overview || '').trim();
      const head = [d.title + (d.year ? '（' + d.year + '）' : ''), ov].filter(Boolean).join('\n\n');
      const block = String(d.bbcode || '').trim() || [head ? '[quote]' + head + '[/quote]' : '', d.poster ? '[img]' + d.poster + '[/img]' : ''].filter(Boolean).join('\n\n');
      if (!block) return { ok: false, code: 'EMPTY' };
      item.descrBb = block.slice(0, 60000);
      if (ov) item.descr = ov.slice(0, 1000);
      if (!item.intro) item.intro = block.slice(0, 60000);
      const subMode = String(flowConfig.value(flow, '中文副标题来源', '种子自带 → 豆影网页 → TMDB'));
      if (d.subtitle && /^豆影网页/.test(subMode)) item.subtitle = String(d.subtitle).slice(0, 300);
      else if (!item.subtitle && !/^只用种子自带/.test(subMode)) item.subtitle = String(d.subtitle).slice(0, 300);
      item.meta = { provider: r.provider, via: d.via || '', title: d.title || '', year: d.year || null, url: d.url || '' };
      item.metaAt = new Date().toISOString();
      delete item.metaNote;
      return { ok: true, provider: r.provider, title: d.title || '' };
    } catch (e) {
      item.metaNote = '外部元数据失败';
      return { ok: false, code: 'META_FAILED' };
    }
  }
  return { fillIntro: fillIntro };
}

module.exports = { makeMetaFill };
