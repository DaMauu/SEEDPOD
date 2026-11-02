import { buildBd, nameFromLabel } from './bdinfo.js';

var LANG_MAP = [
    [/^(english|eng)$/i, '英'],
    [/^(chinese|chi|zho|mandarin|cantonese|yue|中文|汉语|粤语|国语)$/i, '中'],
    [/^(japanese|jpn|日本語|日语)$/i, '日'],
    [/^(korean|kor|한국어|韩语)$/i, '韩'],
    [/^(french|fre|fra|法语)$/i, '法'],
    [/^(german|ger|deu|德语)$/i, '德'],
    [/^(italian|ita|意大利语)$/i, '意'],
    [/^(spanish|spa|西班牙语)$/i, '西'],
    [/^(russian|rus|俄语)$/i, '俄'],
    [/^(portuguese|por|葡语)$/i, '葡'],
    [/^(dutch|dut|nld|荷兰语)$/i, '荷'],
    [/^(swedish|swe|瑞典语)$/i, '瑞'],
    [/^(danish|dan|丹麦语)$/i, '丹'],
    [/^(norwegian|nor|挪威语)$/i, '挪'],
    [/^(finnish|fin|芬兰语)$/i, '芬'],
    [/^(polish|pol|波兰语)$/i, '波'],
    [/^(czech|cze|ces|捷克语)$/i, '捷'],
    [/^(hungarian|hun|匈牙利语)$/i, '匈'],
    [/^(greek|gre|ell|希腊语)$/i, '希'],
    [/^(turkish|tur|土耳其语)$/i, '土'],
    [/^(arabic|ara|阿拉伯语)$/i, '阿'],
    [/^(thai|tha|泰语)$/i, '泰'],
    [/^(hindi|hin|印地语)$/i, '印']
];

var REGION_TAG_MAP = {
    'USA': '美', 'US': '美', 'GER': '德', 'DEU': '德', 'FRA': '法', 'ITA': '意', 'UK': '英', 'GBR': '英', 'JPN': '日', 'KOR': '韩',
    'HKG': '港', 'HK': '港', 'TWN': '台', 'TW': '台', 'CHN': '国', 'CN': '国', 'AUS': '澳', 'CAN': '加', 'RUS': '俄', 'ESP': '西',
    'NLD': '荷', 'BEL': '比', 'SWE': '瑞', 'POL': '波', 'AUT': '奥', 'CHE': '瑞', 'DNK': '丹', 'FIN': '芬', 'NOR': '挪', 'NZL': '新',
    'IND': '印', 'THA': '泰', 'BRA': '巴', 'MEX': '墨', 'ARG': '阿', 'EUR': '欧', 'CEE': '欧'
};
var regionKeys = Object.keys(REGION_TAG_MAP).sort(function (a, b) { return b.length - a.length; });

export function langChar(name) {
    var s = String(name || '').trim()
        .replace(/\((?:traditional|simplified)\)/i, '')
        .replace(/[\s_-]+(?:traditional|simplified)$/i, '')
        .trim();
    for (var i = 0; i < LANG_MAP.length; i++) {
        if (LANG_MAP[i][0].test(s)) return LANG_MAP[i][1];
    }
    return '';
}

export function langOfLine(line) {
    var head = String(line || '').split('/')[0].trim();
    return langChar(head) || (head ? head.replace(/\s+/g, '') : '');
}

export function langSet(lines) {
    var set = [];
    (lines || []).forEach(function (l) {
        var c = langOfLine(l);
        if (c && set.indexOf(c) < 0) set.push(c);
    });
    var cn = set.filter(function (c) { return c === '中'; });
    var rest = set.filter(function (c) { return c !== '中'; });
    return cn.concat(rest).join('');
}

export function getRegionFromTitle(title) {
    if (!title) return '';
    var cnMatch = String(title).match(/(美|德|法|意|英|日|韩|港|台|国|澳|加|俄|西|荷|比|瑞|波|奥|丹|芬|挪|新|印|泰|巴|墨|阿|欧)版/);
    if (cnMatch) return cnMatch[1];
    for (var i = 0; i < regionKeys.length; i++) {
        var key = regionKeys[i];
        var regex = new RegExp('(?:^|[^A-Za-z])' + key + '(?:[^A-Za-z]|$)', 'i');
        if (regex.test(title)) return REGION_TAG_MAP[key];
    }
    return '';
}

var cjk = function (s) { return /[\u4e00-\u9fa5]/.test(String(s || '')); };

export function parseBbLine(line) {
    var raw = String(line || '');
    var i = raw.indexOf('◎');
    if (i < 0) return null;
    var rest = raw.slice(i + 1);
    var c = rest.search(/[：:]/);
    if (c >= 0) {
        return { label: rest.slice(0, c).replace(/[\s\u3000]+/g, ''), value: rest.slice(c + 1).trim() };
    }
    var m = rest.match(/^(\S(?:.*?\S)?)[\s\u3000]{1,}(.+)$/);
    if (m) return { label: m[1].replace(/[\s\u3000]+/g, ''), value: m[2].trim() };
    return null;
}

export function pickFromBb(bb, label) {
    var want = label.replace(/[\s\u3000]+/g, '');
    var lines = String(bb || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var p = parseBbLine(lines[i]);
        if (p && p.label === want && p.value) return p.value;
    }
    return '';
}

export function zhOnly(s) {
    var x = String(s || '').trim();
    if (!x) return '';
    x = x.replace(/\s*[（(][^（）()]*[A-Za-z][^（）()]*[）)]\s*$/, '').trim();
    if (!cjk(x)) return x;
    var parts = x.split(/\s+/).filter(Boolean);
    var keep = [];
    for (var i = 0; i < parts.length; i++) {
        if (/[A-Za-z]/.test(parts[i])) break;
        keep.push(parts[i]);
    }
    var cut = keep.join(' ').trim();
    if (cut) return cut;
    var m = x.match(/^([\u4e00-\u9fa5·•．.・][\u4e00-\u9fa5·•．.・\s]*)/);
    return m ? m[1].trim() : x;
}

export function castList(raw, limit) {
    var out = [], seen = {};
    var arr = String(raw || '').split('/');
    for (var i = 0; i < arr.length; i++) {
        var s = zhOnly(arr[i]);
        if (!s || seen[s]) continue;
        seen[s] = 1;
        out.push(s);
        if (limit && out.length >= limit) break;
    }
    return out;
}

export function composeSubtitle(d, bb, cfg, gathered) {
    cfg = cfg || {};
    gathered = gathered || {};
    d = d || {};
    if (!cfg.withSubtitle) return '';

    var name = pickFromBb(bb, '片  名') || pickFromBb(bb, '片名');
    if (!name) name = pickFromBb(bb, '译  名') || pickFromBb(bb, '译名');
    if (!name) name = gathered.cnTitle || nameFromLabel(d.label) || gathered.movieTitle || '';
    name = String(name).split('/')[0].trim();

    var titleSources = gathered.titleSources || [];
    var regionShort = '';
    for (var i = 0; i < titleSources.length; i++) {
        regionShort = getRegionFromTitle(titleSources[i]);
        if (regionShort) break;
    }
    if (!regionShort && gathered.regionHint) regionShort = gathered.regionHint;

    var regionStr = '';
    if (regionShort) regionStr = regionShort + '版';
    if (regionStr || cfg.subDisc) regionStr = (regionStr || '') + (cfg.subDisc || '原盘');

    var director = pickFromBb(bb, '导  演') || pickFromBb(bb, '导演');
    director = zhOnly(String(director).split('/')[0].replace(/^演\s*/, '').trim());

    var castRaw = pickFromBb(bb, '主  演') || pickFromBb(bb, '主演');
    var castArr = castList(castRaw, Math.max(1, cfg.subCast | 0));

    var audioLangRaw = langSet(d.audios);
    var audioStr = audioLangRaw ? audioLangRaw + '语' : '原声';
    var subLangRaw = langSet(d.subs);
    var subStr = subLangRaw ? subLangRaw + '字' : '无字';

    var seg = [];
    if (name) seg.push(name);
    if (regionStr) seg.push(regionStr);
    if (director) seg.push('导演:' + director);
    if (castArr.length) seg.push('主演:' + castArr.join(' / '));
    seg.push('[' + audioStr + ']');
    seg.push('[' + subStr + ']');
    return seg.filter(Boolean).join(' | ');
}

export function buildAll(d, shots, intro, cfgObj) {
    cfgObj = cfgObj || {};
    var p = [];
    if (intro) p.push(String(intro).trim());
    p.push('[img]https://pterclub.net/pic/CS.png[/img]');
    p.push(cfgObj.useHide ? '[hide=bdinfo]\n' + buildBd(d) + '\n[/hide]' : buildBd(d));
    if (cfgObj.useTag) p.push('[img]https://pterclub.net/pic/GDJT.png[/img]');
    if (shots && shots.length) p.push(shots.map(function (u) { return '[img]' + u + '[/img]'; }).join(' '));
    return p.join('\n');
}
