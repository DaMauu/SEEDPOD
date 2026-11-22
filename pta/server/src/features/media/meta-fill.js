/* 豆影补齐：副标题拼贴 + 简介覆盖。
   只改传入的 item 对象，落库由调用方负责。
   简介覆盖只替换“电影简介”那一段：源简介里的 hide/quote/code 技术块和截图原样保留。 */
const metaExt = require('./meta-ext');
const flowConfig = require('../settings/flow-config');
const collage = require('./collage');

/* 源简介里要保留的技术块和截图：先摘 block，再从剩余文本里取图，避免技术块里的图被重复追加 */
function preservedOf(src) {
  let rest = String(src || '');
  const blocks = [];
  const take = function (re) {
    rest = rest.replace(re, function (m) { blocks.push(m); return '\n'; });
  };
  take(/\[hide=[^\]]*\][\s\S]*?\[\/hide\]/gi);
  take(/\[code[^\]]*\][\s\S]*?\[\/code\]/gi);
  rest = rest.replace(/\[quote(?:=[^\]]*)?\]([\s\S]*?)\[\/quote\]/gi, function (m, inner) {
    if (/Disc Title|Complete name|BDInfo|MediaInfo|General\s+Information|Video\s*:|Audio\s*:/i.test(inner)) blocks.push(m);
    return '\n';
  });
  const imgs = [];
  rest.replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, function (m) {
    if (imgs.indexOf(m) < 0) imgs.push(m);
    return m;
  });
  return { blocks: blocks, images: imgs };
}
function imageUrls(html) {
  const out = [];
  String(html || '').replace(/\[img[^\]]*\](https?:\/\/[^\s\[\]]+)\[\/img\]/gi, function (_, u) {
    if (out.indexOf(u) < 0) out.push(u);
    return '';
  });
  return out;
}

function makeMetaFill(ctx) {
  const { one } = ctx;

  function keyOf(item) {
    const text = [item.title, item.subtitle, item.cn, item.intro, item.descrBb, item.detailsUrl].filter(Boolean).join(' ');
    const imdb = /\b(tt\d{5,})\b/i.exec(text);
    if (imdb) return imdb[1];
    const db = /douban\.com\/subject\/(\d+)/i.exec(text);
    if (db) return db[1];
    return String(item.title || '').trim();
  }

  async function fillMeta(item) {
    const flow = flowConfig.read(ctx);
    const subOn = flowConfig.on(flow, '副标题拼贴', true);
    const introOn = flowConfig.on(flow, '简介回填', true);
    if (!subOn && !introOn) return { ok: false, code: 'RULE_OFF' };

    const key = keyOf(item);
    const isId = /^(tt\d+|\d{5,})$/i.test(key);
    let r;
    try {
      r = await metaExt.fetchMeta({
        title: key, year: isId ? null : item.year, type: item.category || 'movie', provider: 'douying'
      });
    } catch (e) {
      item.metaNote = '豆影请求失败';
      return { ok: false, code: 'META_FAILED' };
    }
    if (!r.ok || !r.data) {
      item.metaNote = r.code || 'NOT_FOUND';
      return { ok: false, code: r.code || 'NOT_FOUND' };
    }
    const d = r.data;
    if (subOn) {
      const sub = collage.composeSubtitle(item, d);
      if (sub) { item.cn = sub; item.subtitle = sub; }
    }
    const srcIntro = String(item.descrBb || item.intro || '');
    if (!Array.isArray(item.sourceImages) || !item.sourceImages.length) item.sourceImages = imageUrls(srcIntro);
    if (introOn) {
      const bb = String(d.bbcode || '').trim();
      if (bb) {
        const src = srcIntro;
        const keep = preservedOf(src);
        const bbUrls = imageUrls(bb);
        const extra = keep.blocks.slice();
        keep.images.forEach(function (tag) {
          const urls = imageUrls(tag);
          if (!urls.length || urls.some(function (u) { return bbUrls.indexOf(u) >= 0; })) return;
          extra.push(tag);
        });
        item.descrBb = [bb].concat(extra).filter(Boolean).join('\n\n').slice(0, 60000);
        item.intro = item.descrBb;
      }
    }
    item.meta = {
      provider: 'douying', title: d.title || '', year: d.year || null, url: d.url || '',
      imdbId: d.imdbId || '', directors: d.directors || [], cast: d.cast || []
    };
    item.metaAt = new Date().toISOString();
    delete item.metaNote;
    return { ok: true, provider: 'douying', title: d.title || '' };
  }

  async function fillIntro(item) { return fillMeta(item); }
  return { fillIntro: fillIntro, fillMeta: fillMeta };
}

module.exports = { makeMetaFill, _preservedOf: preservedOf, _imageUrls: imageUrls };
