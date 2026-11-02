export var DEFAULT_SITE_DATABASE = {
    'PTer':       { name: 'PTerClub (猫站)',  url: 'https://pterclub.net/',       type: 'np' },
    'Audiences':  { name: 'Audiences (观影)', url: 'https://audiences.me/',       type: 'np' },
    'HDSky':      { name: 'HDSky (天空)',     url: 'https://hdsky.me/',           type: 'np' },
    'MTeam':      { name: 'M-Team (馒头)',    url: 'https://kp.m-team.cc/',       type: 'np' },
    'OurBits':    { name: 'OurBits (我堡)',   url: 'https://ourbits.club/',       type: 'np' },
    'CHDBits':    { name: 'CHDBits (彩虹岛)', url: 'https://ptchdbits.co/',       type: 'np' },
    'TTG':        { name: 'TTG (听歌)',       url: 'https://totheglory.im/',      type: 'np' },
    'FRDS':       { name: 'FRDS (朋友)',      url: 'https://pt.keepfrds.com/',    type: 'np' },
    'BLU':        { name: 'Blutopia',         url: 'https://blutopia.cc/',        type: 'unit3d' },
    'Aither':     { name: 'Aither',           url: 'https://aither.cc/',          type: 'unit3d' },
    'DreadVault': { name: 'DreadVault',       url: 'https://dreadvault.org/',     type: 'unit3d' },
    'BHD':        { name: 'BeyondHD',         url: 'https://beyond-hd.me/',       type: 'f3nix' },
    'PTP':        { name: 'PTP',              url: 'https://passthepopcorn.me/',  type: 'gz' }
};

export function u3dHeaders(apiKey) { return { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' }; }

export function gzHeaders(apiKey) {
    if (apiKey.indexOf(':') !== -1) {
        var pts = apiKey.split(':');
        return { 'ApiUser': pts[0].trim(), 'ApiKey': pts.slice(1).join(':').trim(), 'Accept': 'application/json' };
    }
    return { 'Authorization': apiKey, 'Accept': 'application/json' };
}

export function qbHeaders(cleanUrl, isForm) {
    var h = { 'Referer': cleanUrl, 'Origin': cleanUrl.replace(/\/+$/, '') };
    if (isForm) h['Content-Type'] = 'application/x-www-form-urlencoded';
    return h;
}

export function siteBase(url) { return String(url || '').replace(/\/+$/, '') + '/'; }

export function siteUrl(site, kind, opt) {
    opt = opt || {};
    var base = siteBase(site.url);
    if (site.type === 'unit3d') {
        if (kind === 'details')  return base + 'torrents/' + opt.id;
        if (kind === 'download') return base + 'torrents/download/' + opt.id;
        if (kind === 'search')   return base + 'torrents?' + (opt.imdbId ? ('imdbId=' + opt.imdbId.replace(/\D/g, '')) : ('name=' + encodeURIComponent(opt.kw || '')));
    }
    if (site.type === 'gz') {
        if (kind === 'details')  return base + 'torrents.php?id=' + opt.id;
        if (kind === 'download') return base + 'torrents.php?action=download&id=' + opt.id;
        if (kind === 'search')   return base + 'torrents.php?searchstr=' + encodeURIComponent(opt.imdbId || opt.kw || '');
    }
    if (kind === 'details')  return base + 'details.php?id=' + opt.id;
    if (kind === 'download') return base + 'download.php?id=' + opt.id;
    if (kind === 'search') {
        var kw = opt.imdbId || opt.kw || '';
        return base + 'torrents.php?incldead=0&spstate=0&inclbookmarked=0&search=' + encodeURIComponent(kw) + '&search_area=' + (opt.imdbId ? '4' : '0') + '&search_mode=0';
    }
    return base;
}

export function hostInSiteDatabase(urlOrHost, database) {
    var host = extractHostKey(urlOrHost);
    if (!host || !database) return false;
    var keys = Object.keys(database);
    for (var i = 0; i < keys.length; i++) {
        var site = database[keys[i]];
        if (site && extractHostKey(site.url) === host) return true;
    }
    return false;
}

export function extractHostKey(urlOrHost) {
    if (!urlOrHost) return '';
    try {
        var h = urlOrHost.indexOf('http') === 0 ? new URL(urlOrHost).hostname : urlOrHost;
        return h.replace(/^www\./i, '').toLowerCase();
    } catch (e) { return String(urlOrHost).toLowerCase(); }
}

export function shouldSiteUseApi(siteObj) {
    if (!siteObj) return false;
    return (siteObj.type === 'unit3d' || siteObj.type === 'gz') && !!siteObj.apiKey;
}
