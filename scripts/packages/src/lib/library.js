import { normalizeImdbId, stripReleaseTags } from './text.js';

export function buildImdbCacheKey(sourceItem) {
    sourceItem = sourceItem || {};
    return normalizeImdbId(sourceItem.imdbId) || (stripReleaseTags(sourceItem.movieTitle || sourceItem.mainTitle || '') + '_' + (sourceItem.movieYear || ''));
}

export function libraryStorageKey(bSiteHost, cacheKey) {
    return (bSiteHost || '') + '::' + cacheKey;
}

export function isFreshLibraryHit(entry, now, freshMs) {
    if (!entry || !entry.lastResult || entry.lastResult.isError) return false;
    var age = now - (entry.lastCheck || 0);
    return age >= 0 && age < freshMs;
}

export function trimLibrary(library, maxEntries, protectedKeys) {
    var max = Math.max(10, maxEntries || 500);
    var protect = protectedKeys || {};
    var keys = Object.keys(library);
    if (keys.length <= max) return library;
    var unprotected = [];
    for (var i = 0; i < keys.length; i++) {
        if (!protect[keys[i]]) unprotected.push(keys[i]);
    }
    unprotected.sort(function (a, b) {
        return (library[a].lastCheck || 0) - (library[b].lastCheck || 0);
    });
    var dropCount = Math.min(keys.length - max, unprotected.length);
    for (var j = 0; j < dropCount; j++) delete library[unprotected[j]];
    return library;
}
