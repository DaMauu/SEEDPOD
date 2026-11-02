export var SHOT_HOST_RE = /(pixhost\.to|ptscreens\.com|imgbox\.com|turboimagehost\.com|imagebam\.com|postimg\.cc|imgur\.com|ibb\.co|imgbb\.com|pixl\.is|imgs\.li|ptpimg\.me|onlyimage\.org|lensdump\.com|passtheima\.ge|dalexni\.com|utp\.pm|seedpool\.org)/i;

var SKIP_RE = /\/pic\/|logo|icon|avatar|smiley|emot|cover|poster/i;
// Upload-Assistant / uploadrr signature images that sit next to the screenshots.
var BOT_IMAGES = ['ptpimg.me/606tk4.png', 'i.ibb.co/2NVWb0c/uploadrr.webp'];

// UNIT3D (Blutopia, Aither...) renders every non-whitelisted [img] as
// https://wsrv.nl/?n=-1&ll&url=<encoded original>, so unwrap it first.
function unwrapImageProxy(s) {
    if (!/^https?:\/\/(?:wsrv\.nl|images\.weserv\.nl)\//i.test(s)) return s;
    var inner = '';
    try { inner = new URL(s).searchParams.get('url') || ''; } catch (e) { return s; }
    // Old weserv links spell the original as url=ssl:host/path.
    inner = inner.replace(/^ssl:/i, '');
    if (!inner) return s;
    if (inner.startsWith('//')) inner = 'https:' + inner;
    else if (!/^https?:/i.test(inner)) inner = 'https://' + inner;
    try { new URL(inner); } catch (e) { return s; }
    return inner;
}

export function fullSizeShot(u, protocol) {
    var s = String(u || '').trim();
    if (!s || /^data:/i.test(s)) return '';
    if (s.startsWith('//')) s = (protocol || 'https:') + s;
    if (!/^https?:/i.test(s)) return '';
    // UNIT3D escapes the URL before it urlencodes it into the proxy link.
    s = unwrapImageProxy(s).replace(/&amp;/g, '&');
    return s.replace(/\.(md|th|sm)\.(png|jpe?g|webp|gif)$/i, '.$2')
            .replace(/\/\/t(\d+)\.pixhost\.to\/thumbs\//i, '//img$1.pixhost.to/images/');
}

export function isShotUrl(u) {
    if (!u || !SHOT_HOST_RE.test(u) || SKIP_RE.test(u)) return false;
    return !BOT_IMAGES.some(function (b) { return u.indexOf(b) !== -1; });
}

// A link only counts when it points at the picture itself; viewer pages such as
// imgbox.com/AbCd, ibb.co/AbCd or pixhost.to/show/... do not render inside [img].
export function isDirectImageUrl(u) {
    return /\.(png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(u || '') && !/pixhost\.to\/show\//i.test(u);
}

// Accepts [img]x[/img], [img=350]x[/img], [img=350x200]x[/img] and [img width=350]x[/img].
export function bbcodeShotUrls(text) {
    var out = [];
    var re = /\[img(?:[=\s][^\]]*)?\]\s*((?:https?:)?\/\/[^\s\[\]]+)\s*\[\/img\]/gi, m;
    while ((m = re.exec(String(text || ''))) !== null) {
        var u = fullSizeShot(m[1]);
        if (isShotUrl(u) && out.indexOf(u) === -1) out.push(u);
    }
    return out;
}

// UNIT3D's description panel ships the raw BBCode for its "Copy" button as
// atob('<base64>') inside an inline script; this works without an API key.
export function unit3dDescriptionFromHtml(html) {
    var scripts = String(html || '').match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (var i = 0; i < scripts.length; i++) {
        if (!/Alpine\.data\(\s*['"]description['"]/.test(scripts[i])) continue;
        var m = scripts[i].match(/atob\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/);
        if (!m) continue;
        try {
            var bin = atob(m[1]);
            var bytes = new Uint8Array(bin.length);
            for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) { return ''; }
    }
    return '';
}
