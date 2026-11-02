export function npDiscMatches(source, other) {
    source = source || {};
    other = other || {};
    if (source.is4K === other.is4K) return true;
    var sizeKnown = source.sizeGB > 0 && other.sizeGB > 0;
    if (!sizeKnown) return true;
    var sizeDiff = Math.abs(source.sizeGB - other.sizeGB);
    return sizeDiff <= 2.5 || (sizeDiff / source.sizeGB) <= 0.05;
}

export function looseDiscMatches(source, other, toleranceGB) {
    source = source || {};
    other = other || {};
    var tol = toleranceGB == null ? 2.5 : toleranceGB;
    if (other.is4K === source.is4K) return true;
    return source.sizeGB > 0 && other.sizeGB > 0 && Math.abs(source.sizeGB - other.sizeGB) <= tol;
}
