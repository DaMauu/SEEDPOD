import { buildImdbCacheKey, isFreshLibraryHit, libraryStorageKey } from './library.js';
import { normalizeImdbId } from './text.js';

export var CHECKPOINT_STORAGE_KEY = 'pt_batch_checkpoint';
export var CHECKPOINT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

var SERIAL_FIELDS = [
    'page', 'customPassLabel', 'torrentId', 'mainTitle', 'releaseName', 'releaseGroup',
    'movieTitle', 'cnTitle', 'regionBracket', 'movieYear', 'imdbId', 'downloadUrl'
];

export function listingKey(href) {
    var u;
    try { u = new URL(href); }
    catch (e) { return String(href || ''); }
    u.hash = '';
    u.searchParams.delete('page');
    var keys = Array.from(u.searchParams.keys()).sort();
    var qs = keys.map(function (k) { return k + '=' + u.searchParams.getAll(k).join('\n'); }).join('&');
    return u.origin + u.pathname + (qs ? '?' + qs : '');
}

export function isCheckpointRecord(cp, now, maxAgeMs) {
    if (!cp || cp.v !== 1 || !Array.isArray(cp.items)) return false;
    if (!cp.savedAt || (now - cp.savedAt) > maxAgeMs) return false;
    if (cp.phase === 'done') return false;
    return true;
}

export function isCheckpointUsable(cp, ctx, now, maxAgeMs) {
    if (!isCheckpointRecord(cp, now, maxAgeMs) || !ctx) return false;
    return cp.siteAHost === ctx.siteAHost && cp.siteBHost === ctx.siteBHost && cp.listKey === ctx.listKey;
}

export function serializeItem(item) {
    var out = {
        is4K: !!(item && item.is4K),
        sizeGB: item && item.sizeGB ? item.sizeGB : 0,
        fromApi: !!(item && item.fromApi)
    };
    if (!item) return out;
    SERIAL_FIELDS.forEach(function (key) {
        var val = item[key];
        if (val !== undefined && val !== null && val !== '') out[key] = val;
    });
    return out;
}

export function copyRestoredImdbId(live, merged) {
    if (live && merged && merged.imdbId && !normalizeImdbId(live.imdbId)) live.imdbId = merged.imdbId;
    return live;
}

export function mergeBatchItem(prev, item) {
    if (!prev) return item;
    var merged = Object.assign({}, prev, item || {});
    if (item && !normalizeImdbId(item.imdbId) && prev.imdbId) merged.imdbId = prev.imdbId;
    merged.row = (item && item.row) || prev.row || null;
    merged.chkBox = (item && item.chkBox) || prev.chkBox || { checked: true };
    return merged;
}

export function itemIdentity(item) {
    if (!item) return '';
    return String(item.torrentId || '') || buildImdbCacheKey(item) || item.mainTitle || '';
}

export function splitBatchByLibrary(items, library, opts) {
    opts = opts || {};
    var skipped = [];
    var pending = [];
    var enabled = opts.enabled !== false;
    var now = opts.now;
    var freshMs = opts.freshMs;
    var host = opts.bSiteHost;
    for (var i = 0; i < (items || []).length; i++) {
        var item = items[i];
        var cacheKey = buildImdbCacheKey(item);
        var storageKey = libraryStorageKey(host, cacheKey);
        var entry = (enabled && library) ? library[storageKey] : null;
        if (isFreshLibraryHit(entry, now, freshMs)) {
            skipped.push({
                item: item,
                entry: entry,
                cacheKey: cacheKey,
                storageKey: storageKey,
                age: now - (entry.lastCheck || 0)
            });
        } else {
            pending.push({ item: item, cacheKey: cacheKey, storageKey: storageKey, entry: entry || null });
        }
    }
    return { skipped: skipped, pending: pending };
}

export function nextNetworkDelay(baseMs, completedCount, kind) {
    var base = Math.max(0, Number(baseMs) || 0);
    if (kind === 'rateLimit') return Math.min(30000, Math.max(12000, base * 4));
    if (kind === 'error') return Math.min(20000, Math.max(4000, base * 2));
    var breather = completedCount > 0 && completedCount % 15 === 0 ? 3000 : 0;
    return base + breather;
}
