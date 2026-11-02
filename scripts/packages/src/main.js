import { RE } from './lib/patterns.js';
import {
    normalizeImdbId,
    is4kText,
    parseSizeToGB,
    parseTitleMeta,
    parseCleanSubtitleString,
    parseRelativeAgeDays
} from './lib/text.js';
import {
    DEFAULT_SITE_DATABASE,
    siteBase,
    siteUrl,
    u3dHeaders,
    gzHeaders,
    qbHeaders,
    extractHostKey,
    hostInSiteDatabase,
    shouldSiteUseApi
} from './lib/sites.js';
import { parseBd, nameFromLabel, isDisc4K } from './lib/bdinfo.js';
import { composeSubtitle, buildAll, getRegionFromTitle } from './lib/subtitle.js';
import {
    buildImdbCacheKey,
    libraryStorageKey,
    isFreshLibraryHit,
    trimLibrary
} from './lib/library.js';
import {
    CHECKPOINT_STORAGE_KEY,
    CHECKPOINT_MAX_AGE_MS,
    listingKey,
    isCheckpointRecord,
    isCheckpointUsable,
    serializeItem,
    itemIdentity,
    mergeBatchItem,
    copyRestoredImdbId,
    splitBatchByLibrary,
    nextNetworkDelay
} from './lib/batch.js';
import { npDiscMatches, looseDiscMatches } from './lib/dupe.js';
import { fullSizeShot, isShotUrl, isDirectImageUrl, bbcodeShotUrls, unit3dDescriptionFromHtml } from './lib/shots.js';
import { inferSourceRegion, inferTorrentLabels } from './lib/publish.js';

/* global GM_xmlhttpRequest, GM_setValue, GM_getValue, GM_addStyle, GM_setClipboard, GM_openInTab, unsafeWindow */

(function () {
    'use strict';

    var IS_DOUBAI = /(^|\.)doubaninfo\.com$/i.test(location.hostname);
    var HANDOFF = 'dv_handoff_v9';

    if (IS_DOUBAI) {
        doubanInit();
        return;
    }

    var rootWin = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    var BADGE_DICT = {
        NON_MOVIE: { tag: 'skip',  cls: 'pt-badge-fail',           text: '跳过: 非电影' },
        DVD:       { tag: 'skip',  cls: 'pt-badge-fail',           text: '跳过: DVD' },
        NON_DISC:  { tag: 'skip',  cls: 'pt-badge-fail',           text: '跳过: 非原盘' },
        GZ_SKIP:   { tag: 'skip',  cls: 'pt-badge-fail',           text: '跳过: 非电影原盘' },
        ENCODE:    { tag: 'skip',  cls: 'pt-badge-fail',           text: '跳过: 非纯原盘' },
        DIY_SKIP:  { tag: 'skip',  cls: 'pt-badge-fail',           text: '跳过: DIY修改版' },
        FORBIDDEN: { tag: 'limit', cls: 'pt-badge-warn-limit',     text: '⛔ 跳过: 禁转/独占' },
        LIMIT7:    { tag: 'limit', cls: 'pt-badge-warn-limit',     text: '⏳ 跳过: 限转未满7天' },
        CLEAN:     { tag: 'clean', cls: 'pt-badge-clean',          text: '✅ B站暂无此原盘 (可发)' },
        DIY_PASS:  { tag: 'diy',   cls: 'pt-badge-dupe-diy',       text: '💡 B站仅有DIY (可发纯原盘) [复核]' },
        DUPE:      { tag: 'dupe',  cls: 'pt-badge-dupe-untouched', text: '⚠️ B站已有原盘' },
        ERROR:     { tag: 'error', cls: 'pt-badge-fail',           text: '❌ 请求失败: ' }
    };

    var TOOLBAR_BTN_DEFS = [
        { cls: 'pt-single-check-btn',   text: '🔍查B站', act: 'row-check' },
        { cls: 'pt-single-forward-btn', text: '🚀转种',  act: 'row-forward' },
        { cls: 'pt-single-qb-btn',      text: '📥推qB',  act: 'row-qb', needDl: true }
    ];

    var QUEUE_BTN_DEFS = [
        { cls: 'pt-single-qb-btn',      text: '📥qB',   act: 'row-qb',      css: '' },
        { cls: 'pt-single-forward-btn', text: '🚀转种', act: 'row-forward', css: '' },
        { cls: 'pt-single-forward-btn', text: '⚡全套', act: 'row-combo',   css: 'background:#f0fdf4; border-color:#bbf7d0; color:#166534;' }
    ];

    var auditedList = [];
    var pendingQueue = GM_getValue('pt_pending_queue', []);
    var imdbResultCache = new Map();
    var siteAApiMap = new Map();
    var isCheckingCancelled = false;
    var batchProtectedKeys = null;
    var apiCrawlCursor = { nextPage: 1, done: false };
    var isHideMode = GM_getValue('pt_hide_mode', false);
    var imdbLibrary = GM_getValue('pt_imdb_library', {});

    var lastPageHtmlHash = '';
    var restoreDebounceTimer = null;
    var doubanPollingTimer = null;
    var activeDoubanTt = '';

    var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var $$ = function (sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); };

    var ACTION_BUS = Object.create(null);
    function bindAction(actName, handler) { ACTION_BUS[actName] = handler; }
    document.addEventListener('click', function (e) {
        var triggerEl = e.target && e.target.closest ? e.target.closest('[data-pt-act]') : null;
        if (!triggerEl) return;
        var act = triggerEl.getAttribute('data-pt-act');
        if (act && typeof ACTION_BUS[act] === 'function') {
            e.preventDefault();
            ACTION_BUS[act](triggerEl, e);
        }
    });

    function el(tag, cls, text, cssText, actName) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined && text !== null) node.innerText = text;
        if (cssText) node.style.cssText = cssText;
        if (actName) node.setAttribute('data-pt-act', actName);
        return node;
    }

    function dispatchEvt(node) {
        if (!node) return;
        ['input', 'change'].forEach(function (t) {
            try { node.dispatchEvent(new Event(t, { bubbles: true })); } catch (e) {}
        });
    }

    function pushUnique(arr, val) {
        if (val && arr.indexOf(val) === -1) arr.push(val);
    }

    function readRowSize(row, sel) {
        var subNode = sel ? $(sel, row) : null;
        var txt = (subNode && subNode.textContent) || (row ? row.textContent : '') || '';
        var m = txt.match(RE.ROW_SIZE);
        return m ? parseSizeToGB(m[0]) : 0;
    }

    function http(url, opts) {
        opts = opts || {};
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: opts.method || 'GET', url: url, headers: opts.headers || {}, data: opts.data,
                responseType: opts.responseType, timeout: opts.timeout || 12000,
                onload: function (res) {
                    if (opts.rawResponse) return resolve(res);
                    if (res.status === 429) return reject(new Error('HTTP 429'));
                    if (res.status < 200 || res.status >= 300) return reject(new Error('HTTP ' + res.status));
                    if (opts.responseType === 'json') {
                        try { resolve(JSON.parse(res.responseText)); } catch (e) { reject(new Error('JSON 解析失败')); }
                    } else resolve(res.responseText);
                },
                onerror: function () { reject(new Error('网络请求异常')); },
                ontimeout: function () { reject(new Error('请求超时')); }
            });
        });
    }

    async function fetchDoc(url) {
        var res = await http(url, { rawResponse: true, timeout: 15000 });
        if (res.status === 429) throw new Error('HTTP 429');
        if (res.status !== 200) throw new Error('HTTP ' + res.status);
        if (res.finalUrl && res.finalUrl.indexOf('login') !== -1) throw new Error('未在目标站点登录');
        var safeHtml = (res.responseText || '').replace(/\s+src=/ig, ' data-src=');
        return (new DOMParser()).parseFromString(safeHtml, 'text/html');
    }

    function log(msg, type) {
        var logBox = $('#pt-log-box');
        if (!logBox) return;
        if (logBox.textContent.length > 20000) {
            var lines = logBox.textContent.split('\n');
            logBox.textContent = lines.slice(-300).join('\n') + '\n';
        }
        logBox.innerText += '[' + (new Date().toLocaleTimeString()) + '] [' + (type || 'INFO') + '] ' + msg + '\n';
        logBox.scrollTop = logBox.scrollHeight;
    }

    function cleanRowTags(container) {
        if (!container) return;
        $$('.pt-inline-toolbar, .pt-audit-badge, .pt-dupe-badge', container).forEach(function (n) { n.remove(); });
    }

    function stampRowDataset(row, item) {
        if (!row || !row.dataset) return;
        row.dataset.ptRow  = 'auditable';
        row.dataset.ptTid  = item.torrentId || '';
        row.dataset.ptImdb = item.imdbId || '';
        row.dataset.ptSize = String(item.sizeGB || 0);
        row.dataset.pt4k   = item.is4K ? '1' : '0';
        row.dataset.ptTag  = 'pass';
    }

    function markSkip(anchor, row, code, extraText) {
        if (!anchor || !anchor.parentNode) return;
        var def = BADGE_DICT[code] || BADGE_DICT.NON_DISC;
        if (row) row.setAttribute('data-pt-tag', def.tag);
        var txt = def.text + (extraText ? ' (' + extraText + ')' : '');
        anchor.parentNode.insertBefore(el('span', 'pt-audit-badge ' + def.cls, txt, 'margin-right:6px;'), anchor);
    }

    function createInlineToolbar(itemData, targetRow, parentContainer, anchorElement) {
        stampRowDataset(targetRow, itemData);
        var toolbar = el('div', 'pt-inline-toolbar');
        var bChk = el('input', 'pt-custom-chk');
        bChk.type = 'checkbox'; bChk.checked = true;
        itemData.chkBox = bChk;
        var bBadge = el('span', 'pt-audit-badge pt-badge-pass', itemData.customPassLabel || (itemData.fromApi ? '⚡API原盘' : '🌐网页原盘'));
        itemData.badge = bBadge;
        toolbar.append(bChk, bBadge);
        TOOLBAR_BTN_DEFS.forEach(function (def) {
            if (def.needDl && !itemData.downloadUrl) return;
            var btn = el('a', def.cls, def.text, '', def.act);
            btn._ptItem = itemData;
            btn._ptRow = targetRow;
            toolbar.appendChild(btn);
        });
        parentContainer.insertBefore(toolbar, anchorElement);
    }

    function renderDupeBadge(node, sourceItem, result, fromLibrary) {
        if (!node) return;
        var vKey = result.isError ? 'ERROR' : (result.hasUntouchedDupe ? 'DUPE' : (result.hasDiyOnly ? 'DIY_PASS' : 'CLEAN'));
        var vDef = BADGE_DICT[vKey];
        var badgeTxt = (fromLibrary ? '📚 ' : '') + vDef.text;
        if (vKey === 'DUPE') badgeTxt += ' (' + (result.matchedSizeGB ? result.matchedSizeGB.toFixed(1) + 'G' : '已存') + ') [复核]';
        node.setAttribute('data-pt-tag', vDef.tag);
        var existBadge = $('.pt-dupe-badge', node);
        if (existBadge) existBadge.remove();
        var dupeBadge = el('a', 'pt-dupe-badge ' + vDef.cls, badgeTxt);
        dupeBadge.target = '_blank';
        dupeBadge.href = result.verifyUrl || '#';
        dupeBadge.title = fromLibrary ? ('来自词库缓存（' + Math.floor((result._libraryAge || 0) / 3600000) + ' 小时前查重）') : '本次实时查询';
        var toolbar = $('.pt-inline-toolbar', node), auditBadge = $('.pt-audit-badge', node);
        if (toolbar) toolbar.appendChild(dupeBadge);
        else if (auditBadge) auditBadge.after(dupeBadge);
        else node.prepend(dupeBadge);
    }

    function commitAudit(row, anchor, verdict, curPage) {
        cleanRowTags(anchor ? anchor.parentNode : row);
        if (row && anchor && anchor.parentNode !== row) cleanRowTags(row);
        if (!verdict.pass) {
            markSkip(anchor, row, verdict.code, verdict.extra);
            return false;
        }
        var parsed = parseTitleMeta(verdict.releaseName || verdict.mainTitle, verdict.extraSpec);
        var item = {
            row: row, page: curPage, fromApi: !!verdict.fromApi,
            customPassLabel: verdict.customPassLabel || '',
            torrentId: verdict.torrentId || '',
            mainTitle: verdict.mainTitle || verdict.releaseName || '',
            releaseName: verdict.releaseName || verdict.mainTitle || '',
            releaseGroup: verdict.releaseGroup || parsed.releaseGroup,
            movieTitle: verdict.movieTitle || parsed.movieTitle,
            cnTitle: verdict.cnTitle || '',
            regionBracket: verdict.regionBracket || '',
            movieYear: verdict.movieYear || parsed.movieYear,
            imdbId: normalizeImdbId(verdict.imdbId),
            bdinfo: verdict.bdinfo || '',
            sizeGB: verdict.sizeGB || 0,
            is4K: verdict.is4K !== undefined ? verdict.is4K : parsed.is4K,
            downloadUrl: verdict.downloadUrl || ''
        };
        if (anchor && anchor.parentElement) {
            createInlineToolbar(item, row, anchor.parentElement, anchor);
            if (config.libraryEnabled && row) {
                var cacheKey = buildImdbCacheKey(item);
                var libEntry = readLibraryEntry(cacheKey);
                if (isFreshLibraryHit(libEntry, Date.now(), getLibraryFreshMs())) {
                    var age = Date.now() - (libEntry.lastCheck || 0);
                    var result = Object.assign({}, libEntry.lastResult, { _fromLibrary: true, _libraryAge: age });
                    if (!result.verifyUrl) result.verifyUrl = siteUrl(getSiteBInfo(), 'search', { imdbId: item.imdbId, kw: item.movieTitle });
                    renderDupeBadge(row, item, result, true);
                    var vKey = result.isError ? 'ERROR' : (result.hasUntouchedDupe ? 'DUPE' : (result.hasDiyOnly ? 'DIY_PASS' : 'CLEAN'));
                    if (vKey === 'CLEAN' || vKey === 'DIY_PASS') {
                        if (!pendingQueue.some(function (x) { return buildImdbCacheKey(x) === cacheKey; })) {
                            pendingQueue.push(item);
                            GM_setValue('pt_pending_queue', pendingQueue);
                        }
                    }
                }
            }
        } else {
            item.chkBox = { checked: true };
        }
        auditedList.push(item);
        renderQueueUI();
        return true;
    }

    function findBdinfo(rootDoc) {
        var ctx = rootDoc || document;
        var mk = ['Disc Label:', 'Disc Size:', 'Playlist:', 'Total Bitrate:'];
        var sc = function (t) { return mk.reduce(function (n, m) { return n + (t.indexOf(m) >= 0 ? 1 : 0); }, 0); };

        var best = '', bs = 0;
        $$('pre, code, textarea, blockquote, .mediainfo', ctx).forEach(function (node) {
            if (node.id === 'pt-edit-desc' || node.id === 'pt-edit-sub' || node.id === 'pt-manual-bd') return;
            var t = node.value || node.innerText || node.textContent || '';
            if (t.length < 60 || t.length > 35000) return;
            var s = sc(t);
            if (s >= 2 && s > bs) { best = t; bs = s; }
        });
        if (best) return best;

        var bodyEl = ctx.body || ctx.documentElement;
        var full = (bodyEl && (bodyEl.innerText || bodyEl.textContent)) || '';
        var m = /Disc\s+(?:Title|Label):/i.exec(full);
        if (!m) return '';
        var keep = [];
        var lines = full.slice(m.index).split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var s = lines[i].replace(/\u00a0/g, ' ').trim();
            if (!s) { if (keep.length > 5) break; continue; }
            if (!/^(Disc Title:|Disc Label:|Disc Size:|Protection:|Playlist:|Size:|Length:|Total Bitrate:|Video:|Audio:|Subtitles?:|\*{3,}|QUICK SUMMARY)/i.test(s)) {
                if (keep.length > 5) break; continue;
            }
            keep.push(s);
        }
        return keep.length >= 4 ? keep.join('\n') : '';
    }

    function buildSubtitle(d, bb, cfgObj, extraCtx) {
        cfgObj = cfgObj || config;
        extraCtx = extraCtx || {};
        var docCtx = extraCtx.detailDoc || document;
        var titleSources = [
            d && d.label,
            d && d.title,
            extraCtx.releaseName,
            extraCtx.mainTitle,
            extraCtx.regionBracket,
            extraCtx.detailSubTitle,
            docCtx && docCtx.title,
            document.title
        ];
        var h1 = $('h1', docCtx) || $('h1', document);
        if (h1) titleSources.push(h1.textContent);
        var regionHint = '';
        var movieEl = $$('div, span, a, td', docCtx).find(function (node) {
            return (node.textContent || '').trim() === 'Movies';
        });
        if (movieEl && movieEl.parentElement) regionHint = getRegionFromTitle(movieEl.parentElement.textContent);
        return composeSubtitle(d, bb, cfgObj, {
            cnTitle: extraCtx.cnTitle || '',
            movieTitle: extraCtx.movieTitle || '',
            titleSources: titleSources,
            regionHint: regionHint
        });
    }

    // Non-UNIT3D sources keep the pre-refactor collector unchanged.
    var IMG_RE = /(pixhost\.to|ptscreens\.com|imgbox\.com|turboimagehost\.com|imagebam\.com|postimg\.cc|imgur\.com|ibb\.co|pixl\.is|imgs\.li)/i;

    function fullSize(u) {
        var s = (u || '').trim();
        if (!s || /^data:/i.test(s)) return '';
        if (s.startsWith('//')) s = location.protocol + s;
        if (!/^https?:/i.test(s)) return '';
        return s.replace(/\.(md|th|sm)\.(png|jpe?g)$/i, '.$2')
                .replace(/\/\/t(\d+)\.pixhost\.to\/thumbs\//i, '//img$1.pixhost.to/images/');
    }

    function collectShotsLegacy(maxShots, rootDoc, rawBbcodeText) {
        var ctx = rootDoc || document;
        var limit = (maxShots !== undefined && maxShots !== null) ? maxShots : (config.maxShots !== undefined ? config.maxShots : 12);
        var set = new Set();

        $$('img', ctx).forEach(function (img) {
            var w = img.naturalWidth || img.width || 0;
            var h = img.naturalHeight || img.height || 0;
            if (w && h && w < 150 && h < 150) return;
            var cs = [img.getAttribute('src'), img.getAttribute('data-src'), img.getAttribute('data-original')];
            var ss = img.getAttribute('srcset');
            if (ss) cs.push(ss.split(',')[0].trim().split(/\s+/)[0]);
            cs.forEach(function (c) {
                var u = fullSize(c);
                if (!u || !IMG_RE.test(u)) return;
                if (/\/pic\//i.test(u) || /logo|icon|avatar|smiley|emot|cover|poster/i.test(u)) return;
                set.add(u);
            });
        });

        $$('a[href]', ctx).forEach(function (a) {
            var u = fullSize(a.getAttribute('href'));
            if (u && IMG_RE.test(u) && !/\/pic\//i.test(u) && !/logo|icon|avatar|smiley|emot|cover|poster/i.test(u)) {
                set.add(u);
            }
        });

        if (rawBbcodeText) {
            var bbImgRe = /\[img\](https?:\/\/[^\s\[\]]+)\[\/img\]/gi, m;
            while ((m = bbImgRe.exec(rawBbcodeText)) !== null) {
                var u2 = fullSize(m[1]);
                if (u2 && IMG_RE.test(u2) && !/\/pic\//i.test(u2) && !/logo|icon|avatar|smiley|emot|cover|poster/i.test(u2)) {
                    set.add(u2);
                }
            }
        }

        return Array.from(set).slice(0, Math.max(0, limit));
    }

    function collectShots(maxShots, rootDoc, rawBbcodeText) {
        if (getSiteAInfo().type !== 'unit3d') return collectShotsLegacy(maxShots, rootDoc, rawBbcodeText);
        var ctx = rootDoc || document;
        var limit = (maxShots !== undefined && maxShots !== null) ? maxShots : (config.maxShots !== undefined ? config.maxShots : 12);
        var set = new Set();

        // The raw BBCode is the uploader's own list. When it has shots, scanning the
        // whole page would only add images from comments and signatures.
        var bbShots = rawBbcodeText ? bbcodeShotUrls(rawBbcodeText) : [];
        if (bbShots.length) return bbShots.slice(0, Math.max(0, limit));

        $$('img', ctx).forEach(function (img) {
            var w = img.naturalWidth || img.width || 0;
            var h = img.naturalHeight || img.height || 0;
            if (w && h && w < 150 && h < 150) return;
            var cs = [img.getAttribute('src'), img.getAttribute('data-src'), img.getAttribute('data-original')];
            var ss = img.getAttribute('srcset');
            if (ss) cs.push(ss.split(',')[0].trim().split(/\s+/)[0]);
            cs.forEach(function (c) {
                var u = fullSizeShot(c, location.protocol);
                if (isShotUrl(u)) set.add(u);
            });
        });

        $$('a[href]', ctx).forEach(function (a) {
            var u = fullSizeShot(a.getAttribute('href'), location.protocol);
            if (isShotUrl(u) && isDirectImageUrl(u)) set.add(u);
        });

        return Array.from(set).slice(0, Math.max(0, limit));
    }

    function findPageImdb(rootDoc) {
        var ctx = rootDoc || document;
        var manualVal = ($('#pt-manual-imdb') && $('#pt-manual-imdb').value.trim()) || (config && config.manualImdb) || '';
        if (/^tt\d{7,9}$/i.test(manualVal)) return manualVal.toLowerCase();
        var html = (ctx.documentElement && ctx.documentElement.innerHTML) || (ctx.body && ctx.body.innerHTML) || '';
        var m = html.match(/imdb\.com\/title\/(tt\d{7,9})/i) || html.match(/\b(tt\d{7,9})\b/);
        if (m) return m[1].toLowerCase();
        var a = $$('a[href]', ctx).find(function (x) { return /imdb\.com/i.test(x.href); });
        if (a) {
            m = a.href.match(/(tt\d{7,9})/i);
            if (m) return m[1].toLowerCase();
        }
        return '';
    }

    function copyTextToClipboard(text, silent) {
        if (!text) return false;
        try {
            GM_setClipboard(text, 'text');
            if (!silent) log('📋 已复制到剪贴板（' + text.length + ' 字符）', 'SUCCESS');
            return true;
        } catch (e) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e2) {}
            document.body.removeChild(ta);
            if (!silent) log(ok ? '📋 已复制到剪贴板' : '⚠️ 复制失败', ok ? 'SUCCESS' : 'WARN');
            return ok;
        }
    }

    function doubanInit() {
        var done = false;
        var m = location.hash.match(/url=(tt\d{7,9})/i) || location.href.match(/url=(tt\d{7,9})/i);
        var tt = m ? m[1].toLowerCase() : '';
        var tickCount = 0;

        function tip(msg, err) {
            var d = document.getElementById('dvb-tip');
            if (!d && document.body) {
                d = document.createElement('div');
                d.id = 'dvb-tip';
                d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:0;z-index:2147483647;' +
                    'font:12px/1.7 -apple-system,sans-serif;padding:6px 18px;border-radius:0 0 8px 8px;color:#fff;' +
                    'box-shadow:0 2px 8px rgba(0,0,0,.2);';
                document.body.appendChild(d);
            }
            if (d) {
                d.textContent = msg;
                d.style.background = err ? '#b91c1c' : '#166534';
            }
        }

        function handOff(text, ttVal) {
            if (done || !text || text.indexOf('◎') < 0) return;
            done = true;
            var clean = text.trim();
            try { GM_setValue(HANDOFF, JSON.stringify({ text: clean, tt: ttVal || '', t: Date.now() })); } catch (e) {}
            try { GM_setClipboard(clean, 'text'); } catch (e) {}
            tip('✅ 已回传，正在关闭…');
            setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
        }

        tip('📥 BDInfo 助手：正在自动获取 ' + (tt || '') + '…');

        function tick() {
            if (done) return;
            tickCount++;

            var tas = document.querySelectorAll('textarea');
            var out = tas.length ? tas[tas.length - 1] : null;
            if (out && out.value && out.value.indexOf('◎') >= 0) {
                handOff(out.value, tt);
                return;
            }

            var input = document.querySelector('input[type="text"], input[type="search"], input');
            if (input && tt && input.value !== tt) {
                try {
                    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    setter.call(input, tt);
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } catch (e) {
                    input.value = tt;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            var btns = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
            var getBtn = btns.find(function (b) {
                return /获取豆瓣简介|豆瓣简介|获取简介|查询|解析/.test((b.textContent || '').trim()) && !b.dataset.clicked;
            });
            if (getBtn && input && input.value === tt) {
                getBtn.dataset.clicked = '1';
                getBtn.click();
            } else if (tt && (tickCount === 9 || tickCount === 20) && !done) {
                var retryBtn = btns.find(function (b) { return /获取豆瓣简介|豆瓣简介|获取简介|查询|解析/.test((b.textContent || '').trim()); });
                if (retryBtn) retryBtn.click();
            }

            var listItems = Array.from(document.querySelectorAll('li, .list-item, .result-item, .item'));
            var targetItem = listItems.find(function (itemEl) {
                var txt = (itemEl.textContent || '').trim();
                return tt && txt.indexOf(tt) >= 0 && !/获取|复制|清空|API|说明/.test(txt) && !itemEl.dataset.clicked;
            });
            if (targetItem) {
                targetItem.dataset.clicked = '1';
                var a = targetItem.querySelector('a');
                if (a) a.click(); else targetItem.click();
            }

            if (tickCount > 110) {
                tip('⚠️ 取词超时，请手动点「获取豆瓣简介」', true);
            }
        }

        function loop() {
            tick();
            if (!done && tickCount <= 120) setTimeout(loop, 500);
        }
        loop();

        if (document.body) {
            var observer = new MutationObserver(function () { tick(); });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    function readHandoffData(maxAgeMs) {
        try {
            var j = JSON.parse(GM_getValue(HANDOFF, '') || 'null');
            if (!j || !j.text || j.text.indexOf('◎') < 0) return null;
            if (maxAgeMs && (Date.now() - (j.t || 0) > maxAgeMs)) return null;
            return j;
        } catch (e) { return null; }
    }

    function clearHandoffData() {
        try { GM_setValue(HANDOFF, ''); } catch (e) {}
    }

    function requestDoubanByTab(tt, onSuccess) {
        if (!tt) return;
        activeDoubanTt = tt.toLowerCase();
        if (doubanPollingTimer) clearInterval(doubanPollingTimer);
        clearHandoffData();

        var url = 'https://doubaninfo.com/#ptgen?url=' + encodeURIComponent(activeDoubanTt);
        try { GM_openInTab(url, { active: false, insert: true, setParent: true }); }
        catch (e) { window.open(url, '_blank'); }

        var t0 = Date.now();
        doubanPollingTimer = setInterval(function () {
            if (Date.now() - t0 > 60000) {
                clearInterval(doubanPollingTimer);
                doubanPollingTimer = null;
                log('⚠️ 豆瓣取词超时，可手动去取词页点按钮，结果会自动回传。', 'WARN');
                return;
            }
            var ho = readHandoffData(600000);
            if (!ho) return;
            if (ho.tt && activeDoubanTt && ho.tt.toLowerCase() !== activeDoubanTt) return;
            clearInterval(doubanPollingTimer);
            doubanPollingTimer = null;
            clearHandoffData();
            onSuccess(ho.text);
        }, 500);
    }

    GM_addStyle(`
        #pt-checker-panel { position: fixed; width: 420px; background: #fafafb; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.12); z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; display: flex; flex-direction: column; }
        #pt-panel-header { padding: 9px 13px; background: #f1f2f5; border-bottom: 1px solid #e2e8f0; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 12.5px; color: #334155; cursor: move; user-select: none; }
        .pt-header-tools { display: flex; align-items: center; gap: 9px; }
        .pt-header-icon { cursor: pointer; color: #64748b; font-size: 13px; font-weight: bold; }
        .pt-header-icon:hover { color: #0f172a; }
        #pt-panel-body { padding: 10px 13px; display: flex; flex-direction: column; gap: 7px; max-height: 90vh; overflow-y: auto; }
        .pt-mode-switcher-bar { display: grid; grid-template-columns: 1fr; background: #eef0f4; padding: 3.5px; border-radius: 6px; border: 1px solid #e2e8f0; user-select: none; }
        .pt-mode-switch-btn { padding: 4.5px 4px; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center; cursor: default; background: #fff; color: #4f46e5; border: 1px solid #c7d2fe; }
        #pt-log-box { width: 100%; height: 95px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; color: #334155; font-family: Consolas, monospace; font-size: 11px; line-height: 1.5; padding: 6px 9px; box-sizing: border-box; overflow-y: auto; white-space: pre-wrap; word-break: break-all; user-select: text !important; cursor: text !important; }
        .pt-site-card { background: #fff; border: 1px solid #e2e8f0; padding: 7px 11px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; user-select: none; }
        .pt-site-card-row { display: flex; justify-content: space-between; align-items: center; color: #64748b; }
        .pt-site-tag-val { color: #1e293b; font-weight: 500; }
        .pt-mode-pill-api { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 0.5px 5px; border-radius: 3px; font-size: 10px; margin-left: 4px; font-weight: 600; }
        .pt-mode-pill-web { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 0.5px 5px; border-radius: 3px; font-size: 10px; margin-left: 4px; }
        .pt-site-switch-link { color: #2563eb; font-size: 11px; cursor: pointer; margin-left: 5px; text-decoration: underline; }
        .pt-btn-group { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; user-select: none; }
        .pt-btn { background: #fff; color: #334155; border: 1px solid #d1d5db; padding: 6.5px 8px; border-radius: 6px; cursor: pointer; font-size: 11.5px; font-weight: 500; text-align: center; user-select: none; }
        .pt-btn:hover { background: #f8fafc; border-color: #94a3b8; color: #0f172a; }
        .pt-btn-primary { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .pt-btn-action { background: #fffbeb; border-color: #fde68a; color: #92400e; }
        .pt-btn-fwd { background: #f5f3ff; border-color: #ddd6fe; color: #5b21b6; }
        .pt-btn-qb-all { background: #f0f9ff; border-color: #bae6fd; color: #0369a1; }
        .pt-btn-stop { background: #fef2f2 !important; border-color: #fecaca !important; color: #991b1b !important; }
        .pt-btn-cfg-full { background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11.5px; font-weight: 500; width: 100%; text-align: center; user-select: none; }
        .pt-queue-container { border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; padding: 5px; display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; }
        .pt-queue-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 4px; font-size: 11px; color: #1e293b; }
        .pt-inline-toolbar { display: inline-flex !important; align-items: center !important; flex-wrap: nowrap !important; gap: 4px !important; margin-right: 6px !important; margin-bottom: 3px !important; vertical-align: middle !important; white-space: nowrap !important; }
        .pt-badge-pass { background: #e0f2fe !important; color: #0369a1 !important; border: 1px solid #bae6fd !important; padding: 1.5px 6px !important; border-radius: 4px !important; font-weight: 600 !important; font-size: 11px !important; white-space: nowrap !important; display: inline-block !important; }
        .pt-badge-fail { background: #f1f5f9 !important; color: #94a3b8 !important; border: 1px solid #e2e8f0 !important; padding: 1px 5px !important; border-radius: 4px !important; text-decoration: line-through !important; font-size: 10.5px !important; white-space: nowrap !important; display: inline-block !important; }
        .pt-badge-warn-limit { background: #fef2f2 !important; color: #dc2626 !important; border: 1px solid #fecaca !important; padding: 1px 5px !important; border-radius: 4px !important; font-weight: 600 !important; font-size: 10.5px !important; white-space: nowrap !important; display: inline-block !important; }
        .pt-badge-dupe-untouched { background: #fee2e2 !important; color: #b91c1c !important; border: 1px solid #fecaca !important; padding: 1.5px 6px !important; border-radius: 4px !important; text-decoration: none !important; font-size: 11px !important; white-space: nowrap !important; display: inline-block !important; cursor: pointer !important; }
        .pt-badge-dupe-diy { background: #fef3c7 !important; color: #92400e !important; border: 1px solid #fde68a !important; padding: 1.5px 6px !important; border-radius: 4px !important; text-decoration: none !important; font-size: 11px !important; white-space: nowrap !important; display: inline-block !important; cursor: pointer !important; }
        .pt-badge-clean { background: #dcfce7 !important; color: #15803d !important; border: 1px solid #bbf7d0 !important; padding: 1.5px 6px !important; border-radius: 4px !important; text-decoration: none !important; font-size: 11px !important; white-space: nowrap !important; display: inline-block !important; }
        .pt-custom-chk { margin: 0 2px 0 0 !important; cursor: pointer !important; width: 14px !important; height: 14px !important; vertical-align: middle !important; }
        .pt-single-check-btn, .pt-single-forward-btn, .pt-single-qb-btn { background: #fff !important; color: #334155 !important; border: 1px solid #cbd5e1 !important; padding: 1.5px 6px !important; border-radius: 4px !important; font-size: 11px !important; text-decoration: none !important; cursor: pointer !important; display: inline-block !important; white-space: nowrap !important; line-height: 1.3 !important; }
        .pt-single-check-btn:hover, .pt-single-forward-btn:hover, .pt-single-qb-btn:hover { background: #f1f5f9 !important; color: #0f172a !important; border-color: #94a3b8 !important; }
        #pt-dock-pill { position: fixed; top: 130px; right: 0; background: #fff; color: #334155; border: 1px solid #cbd5e1; border-right: none; border-radius: 6px 0 0 6px; padding: 6px 9px; font-size: 11.5px; font-weight: 500; cursor: pointer; z-index: 2147483647; display: flex; align-items: center; gap: 5px; user-select: none; }
        #pt-cfg-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.35); z-index: 2147483647; justify-content: center; align-items: center; }
        #pt-cfg-content { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; width: 455px; padding: 15px; color: #1e293b; display: flex; flex-direction: column; gap: 7px; font-size: 12px; max-height: 88vh; overflow-y: auto; }
        .pt-cfg-section-title { font-size: 11.5px; font-weight: 600; color: #0369a1; background: #f0f9ff; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #0284c7; margin-top: 2px; }
        .pt-field-row { display: flex; flex-direction: column; gap: 2.5px; }
        .pt-field-row label { font-weight: 500; color: #475569; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; }
        .pt-input, .pt-select { background: #fff; border: 1px solid #cbd5e1; color: #0f172a; padding: 4.5px 8px; border-radius: 5px; font-size: 12px; }
        .pt-password-masked { -webkit-text-security: disc !important; text-security: disc !important; }
        body.pt-only-clean [data-pt-tag="skip"], body.pt-only-clean [data-pt-tag="limit"], body.pt-only-clean [data-pt-tag="dupe"] { display: none !important; }

        #pt-top-preview-area { display: flex; flex-direction: column; gap: 6px; padding-bottom: 9px; margin-bottom: 4px; border-bottom: 1px dashed #cbd5e1; }
        .pt-edit-label { font-size: 11px; font-weight: 600; color: #475569; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1px; }
        .pt-edit-label span.op { cursor: pointer; color: #2563eb; font-weight: normal; margin-left: 8px; }
        .pt-edit-label span.op:hover { text-decoration: underline; }
        .pt-edit-input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 5px; padding: 5px 7px; font-family: -apple-system, sans-serif; font-size: 12px; background: #fff; color: #1e293b; resize: vertical; }
        .pt-edit-textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 5px; padding: 6px 7px; font-family: Consolas, monospace; font-size: 11px; resize: vertical; background: #fff; color: #334155; line-height: 1.45; }
        .pt-edit-btn-row { display: flex; gap: 6px; margin-top: 2px; }
        .pt-edit-btn-row button { flex: 1; padding: 6px; border-radius: 5px; font-size: 11.5px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; color: #334155; font-weight: 500; }
        .pt-edit-btn-row button:hover { background: #f1f5f9; }
        .pt-edit-btn-row button.publish { background: #f0fdf4; border-color: #bbf7d0; color: #166534; font-weight: bold; }
        #pt-manual-details summary { cursor: pointer; font-size: 11px; color: #64748b; user-select: none; padding: 2px 0; }
        #pt-manual-details summary:hover { color: #0f172a; }
    `);

    function renderPanelView() {
        if (!document.body || $('#pt-checker-panel')) return;
        var panelHtml = `
            <div id="pt-checker-panel">
                <div id="pt-panel-header">
                    <span>📀 转种与调度中枢 (v7.9.0)</span>
                    <div class="pt-header-tools">
                        <span data-pt-act="panel-collapse" class="pt-header-icon" title="收起为侧边胶囊">─</span>
                        <span data-pt-act="panel-collapse" class="pt-header-icon" title="隐藏面板">✖</span>
                    </div>
                </div>
                <div id="pt-panel-body">
                    <div class="pt-mode-switcher-bar">
                        <div id="pt-mode-btn-auto" class="pt-mode-switch-btn">🤖 自动识别 (推荐)</div>
                    </div>

                    <div id="pt-top-preview-area">
                        <div class="pt-edit-label">
                            <span>副标题（可编辑）</span>
                            <div>
                                <span class="op" data-pt-act="page-extract" title="直接提取当前详情页 BDInfo/IMDb/截图">⚡抓当前页</span>
                                <span class="op" data-pt-act="copy-sub">📋 复制副标题</span>
                            </div>
                        </div>
                        <textarea id="pt-edit-sub" class="pt-edit-input" style="height:38px;" spellcheck="false" placeholder="点击转种或详情页自动生成..."></textarea>

                        <div class="pt-edit-label">
                            <span>简介 (含豆瓣/BDInfo/截图)</span>
                            <span class="op" data-pt-act="copy-desc">📋 复制全部</span>
                        </div>
                        <textarea id="pt-edit-desc" class="pt-edit-textarea" style="height:88px;" spellcheck="false" placeholder="等待获取数据..."></textarea>

                        <div class="pt-edit-btn-row">
                            <button type="button" id="pt-edit-regen" data-pt-act="regen-preview" style="background:#f5f3ff; border-color:#ddd6fe; color:#5b21b6; font-weight:bold;">🔄 重新生成</button>
                            <button type="button" id="pt-edit-publish" class="publish" data-pt-act="confirm-publish">✅ 确认并发布</button>
                        </div>

                        <details id="pt-manual-details">
                            <summary>🛠️ 手动 IMDb / 粘贴 BDInfo 生成</summary>
                            <div style="display:flex; flex-direction:column; gap:5px; margin-top:4px; background:#f8fafc; padding:6px; border:1px solid #e2e8f0; border-radius:5px;">
                                <div style="display:flex; gap:6px; align-items:center;">
                                    <span style="font-size:11px; color:#475569; white-space:nowrap;">手动 IMDb:</span>
                                    <input id="pt-manual-imdb" type="text" class="pt-input" style="flex:1; padding:3px 6px; font-size:11px;" placeholder="tt1234567 (留空则自动识别)" />
                                </div>
                                <textarea id="pt-manual-bd" class="pt-edit-textarea" style="height:54px;" spellcheck="false" placeholder="在此手动粘贴 BDInfo 原文..."></textarea>
                                <button type="button" data-pt-act="manual-gen" class="pt-btn pt-btn-primary" style="padding:4px 8px; font-size:11px;">用粘贴内容生成</button>
                            </div>
                        </details>
                    </div>

                    <div style="font-weight: 500; color: #64748b; display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                        <span>实时运行日志 (支持鼠标划选复制)</span>
                        <div style="display:flex; gap:8px;">
                            <span id="pt-log-copy" data-pt-act="log-copy" style="cursor:pointer; color:#2563eb;">📋复制</span>
                            <span id="pt-log-clear" data-pt-act="log-clear" style="cursor:pointer; color:#94a3b8;">清空</span>
                        </div>
                    </div>
                    <div id="pt-log-box"></div>
                    <div class="pt-site-card">
                        <div class="pt-site-card-row"><span>源 A 站点:</span><div><span id="pt-cur-a-label" class="pt-site-tag-val"></span><span id="pt-cur-a-mode"></span></div></div>
                        <div class="pt-site-card-row"><span>目标 B 站:</span><div><span id="pt-cur-b-label" class="pt-site-tag-val"></span><span id="pt-cur-b-mode"></span><span id="pt-link-switch-b" data-pt-act="cfg-open" class="pt-site-switch-link">[配置]</span></div></div>
                        <div class="pt-site-card-row" id="pt-quota-row"><span>运行通道状态:</span><span id="pt-cur-quota-label" style="font-weight:600; font-size:11px;"></span></div>
                        <div class="pt-site-card-row"><span>qBittorrent:</span><span id="pt-cur-qb-label" style="color:#059669; font-family:monospace; font-weight:500;"></span></div>
                    </div>
                    <div class="pt-btn-group">
                        <button type="button" id="pt-btn-open-cfg" data-pt-act="cfg-open" class="pt-btn pt-btn-primary">⚙️ 设置</button>
                        <button type="button" id="pt-btn-preset" data-pt-act="btn1-preset" class="pt-btn">📀 预设</button>
                    </div>
                    <div class="pt-btn-group">
                        <button type="button" id="pt-btn-pull-dupe" data-pt-act="btn-pull-dupe" class="pt-btn pt-btn-fwd" style="font-weight:600;">🚀 拉取/查重</button>
                        <button type="button" id="pt-btn-hide" data-pt-act="btn-hide" class="pt-btn pt-btn-action">👁️ 隐藏</button>
                    </div>
                    <div style="font-weight: 500; color: #475569; display:flex; justify-content:space-between; align-items:center;">
                        <span>📋 待发独家原盘 (<span id="pt-queue-count">0</span> 部):</span>
                        <span id="pt-queue-clear" data-pt-act="queue-clear" style="color:#94a3b8; cursor:pointer; font-size:10px;">清空</span>
                    </div>
                    <div id="pt-queue-box" class="pt-queue-container">
                        <div style="color:#94a3b8; text-align:center; padding:8px;">暂无待发项，请先执行查重</div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:#64748b; padding:2px 2px 0 2px; user-select:none;">
                        <span id="pt-lib-badge" style="cursor:default;">📚 词库: 0 部</span>
                        <div style="display:flex; gap:8px;">
                            <span data-pt-act="lib-view" style="cursor:pointer; color:#2563eb;">查看</span>
                            <span data-pt-act="lib-clear" style="cursor:pointer; color:#94a3b8;">清空</span>
                        </div>
                    </div>
                </div>
            </div>

            <div id="pt-dock-pill" data-pt-act="panel-expand" style="display:none;" title="点击恢复展开原盘面板"><span>📀</span><span>原盘调度</span></div>
            <div id="pt-lib-modal" style="display:none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.35); z-index: 2147483647; justify-content: center; align-items: center;">
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; width: 520px; max-height: 80vh; display: flex; flex-direction: column; padding: 15px; gap: 8px; font-size: 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:600; color:#0f172a; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
                        <span>📚 查重词库 (<span id="pt-lib-modal-count">0</span> 部)</span>
                        <span data-pt-act="lib-close" style="cursor:pointer; color:#94a3b8;">✖</span>
                    </div>
                    <div style="font-size:11px; color:#64748b;">当前 B 站: <b id="pt-lib-modal-host">-</b>；有效期: <b id="pt-lib-modal-ttl">-</b> 小时</div>
                    <div id="pt-lib-modal-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:4px; max-height:60vh;"></div>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button type="button" data-pt-act="lib-clear" class="pt-btn" style="background:#fef2f2; color:#991b1b;">清空当前 B 站词库</button>
                        <button type="button" data-pt-act="lib-close" class="pt-btn">关闭</button>
                    </div>
                </div>
            </div>
            <div id="pt-cfg-modal">
                <div id="pt-cfg-content">
                    <div style="font-size:13px; font-weight:600; color:#0f172a; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">⚙️ 配置与跨站设置</div>
                    <div class="pt-cfg-section-title">1. qBittorrent 下载器与调度参数</div>
                    <div class="pt-field-row"><label>qBittorrent WebUI 地址:</label><input id="pt-cfg-qb-url" class="pt-input" placeholder="例如: http://192.168.1.100:8080/" autocomplete="off" /></div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <div class="pt-field-row"><label>qB 用户名:</label><input id="pt-cfg-qb-user" class="pt-input" autocomplete="off" /></div>
                        <div class="pt-field-row"><label>qB 密码:</label><input id="pt-cfg-qb-pass" type="text" class="pt-input pt-password-masked" autocomplete="off" /></div>
                    </div>
                    <div class="pt-field-row">
                        <button type="button" id="pt-cfg-qb-test-btn" data-pt-act="cfg-qb-test" class="pt-btn" style="background:#f0f9ff; color:#0369a1; width:100%;">🔌 测试 qBittorrent 连接</button>
                        <div id="pt-cfg-qb-test-msg" style="font-size:11px; margin-top:2px; display:none;"></div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1.2fr; gap:6px;">
                        <div class="pt-field-row"><label>qB 分类标签:</label><input id="pt-cfg-qb-cat" class="pt-input" placeholder="原盘" /></div>
                        <div class="pt-field-row"><label>查重延时(ms):</label><input id="pt-cfg-delay" class="pt-input" type="number" value="2500" /></div>
                        <div class="pt-field-row">
                            <label>API 连拉页数:</label>
                            <select id="pt-cfg-api-pages" class="pt-select">
                                <option value="1">仅当前页 (推荐)</option>
                                <option value="2">连拉 2 页</option>
                                <option value="3">连拉 3 页</option>
                            </select>
                        </div>
                    </div>

                    <div class="pt-cfg-section-title">2. DreadVault 排版引擎参数配置</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px;">
                        <div class="pt-field-row"><label>副标题主演数:</label><input id="pt-cfg-sub-cast" class="pt-input" type="number" min="1" max="10" value="3" /></div>
                        <div class="pt-field-row"><label>原盘标识词:</label><input id="pt-cfg-sub-disc" class="pt-input" type="text" value="原盘" /></div>
                        <div class="pt-field-row"><label>截图数量上限:</label><input id="pt-cfg-max-shots" class="pt-input" type="number" min="0" max="60" value="12" /></div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-top:3px;">
                        <label style="font-size:11.5px; color:#475569; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="pt-cfg-with-sub" checked> 生成副标题</label>
                        <label style="font-size:11.5px; color:#475569; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="pt-cfg-sub-hide" checked> 使用[hide=bdinfo]</label>
                        <label style="font-size:11.5px; color:#475569; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="pt-cfg-sub-tag" checked> 加标签图</label>
                        <label style="font-size:11.5px; color:#475569; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="pt-cfg-round-fps"> 帧率取整</label>
                        <label style="font-size:11.5px; color:#475569; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="pt-cfg-auto-copy" checked> 生成后自动复制</label>
                    </div>

                    <div class="pt-cfg-section-title">3. 源 A 站 (主抓取源) 与 API Key</div>
                    <div class="pt-field-row">
                        <label><span>源 A 站点 (主抓取源):</span><span id="pt-cfg-a-host-hint" style="font-size:10.5px; color:#64748b;"></span></label>
                        <select id="pt-cfg-select-a" class="pt-select"><option value="AUTO">🌐 自动识别当前网页所在站点 (推荐，跨站自动切换)</option></select>
                    </div>
                    <div class="pt-field-row">
                        <label><span>源 A 站 API Key (仅 U3D/GZ 源站可填，NP 站无需填):</span></label>
                        <input id="pt-cfg-a-apikey" type="text" class="pt-input" placeholder="U3D填 API Token；PTP填 ApiUser:ApiKey；NP站留空自动走网页" autocomplete="off" data-lpignore="true" />
                    </div>
                    <div class="pt-cfg-section-title">4. 目标 B 站 (查重与发布目标) 与 API Key</div>
                    <div class="pt-field-row"><label>选择预设目标 B 站 (查重与发布目标):</label><select id="pt-cfg-select-b" class="pt-select"></select></div>
                    <div class="pt-field-row">
                        <label><span>目标 B 站 API Key (仅 B 站为 U3D/GZ 时可填，NP 站留空):</span></label>
                        <input id="pt-cfg-b-apikey" type="text" class="pt-input" placeholder="NP 架构目标站 (如猫站) 无 API，保持留空即可" autocomplete="off" data-lpignore="true" />
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:6px;">
                        <button type="button" id="pt-cfg-save" data-pt-act="cfg-save" class="pt-btn" style="background:#f0fdf4; color:#166534;">保存全部配置</button>
                        <button type="button" id="pt-cfg-close" data-pt-act="cfg-close" class="pt-btn">取消</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', panelHtml);
        initPanelWindowBehavior();
        if (typeof ACTION_BUS['panel-ready'] === 'function') ACTION_BUS['panel-ready']();
    }

    function initPanelWindowBehavior() {
        var panelElement = $('#pt-checker-panel'), dockPill = $('#pt-dock-pill');
        if (!panelElement || !dockPill) return;
        var savedPos = GM_getValue('pt_panel_pos', { top: '70px', left: '' });
        if (savedPos && savedPos.left) {
            var leftVal = parseInt(savedPos.left, 10), topVal = parseInt(savedPos.top, 10);
            if (!isNaN(leftVal) && leftVal >= 0 && leftVal < window.innerWidth - 80 && !isNaN(topVal) && topVal >= 0 && topVal < window.innerHeight - 40) {
                panelElement.style.left = savedPos.left; panelElement.style.top = savedPos.top; panelElement.style.right = 'auto';
            } else { panelElement.style.top = '70px'; panelElement.style.right = '20px'; }
        } else { panelElement.style.top = '70px'; panelElement.style.right = '20px'; }
        if (GM_getValue('pt_panel_collapsed', false)) {
            panelElement.style.display = 'none'; dockPill.style.display = 'flex';
        }
        var header = $('#pt-panel-header');
        if (!header) return;
        var isDragging = false, startX, startY, initLeft, initTop;
        header.onmousedown = function (e) {
            if (e.target.closest('.pt-header-tools')) return;
            isDragging = true; startX = e.clientX; startY = e.clientY;
            var rect = panelElement.getBoundingClientRect();
            initLeft = rect.left; initTop = rect.top;
            panelElement.style.right = 'auto'; panelElement.style.left = initLeft + 'px'; panelElement.style.top = initTop + 'px';
            var onMove = function (ev) {
                if (!isDragging) return;
                panelElement.style.left = Math.max(5, Math.min(window.innerWidth - panelElement.offsetWidth - 5, initLeft + (ev.clientX - startX))) + 'px';
                panelElement.style.top = Math.max(5, Math.min(window.innerHeight - 40, initTop + (ev.clientY - startY))) + 'px';
            };
            var onUp = function () {
                isDragging = false;
                document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
                GM_setValue('pt_panel_pos', { left: panelElement.style.left, top: panelElement.style.top });
            };
            document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
            e.preventDefault();
        };
    }

    bindAction('panel-collapse', function () {
        $('#pt-checker-panel').style.display = 'none';
        $('#pt-dock-pill').style.display = 'flex';
        GM_setValue('pt_panel_collapsed', true);
    });
    bindAction('panel-expand', function () {
        $('#pt-dock-pill').style.display = 'none';
        $('#pt-checker-panel').style.display = 'flex';
        GM_setValue('pt_panel_collapsed', false);
    });
    bindAction('log-clear', function () { $('#pt-log-box').innerText = ''; });
    bindAction('log-copy', function (btn) {
        var logTxt = $('#pt-log-box').innerText || '';
        if (!logTxt) return;
        copyTextToClipboard(logTxt, true);
        btn.innerText = '✅已复制';
        setTimeout(function () { btn.innerText = '📋复制'; }, 1500);
    });

    bindAction('lib-view', function () {
        var modal = $('#pt-lib-modal');
        if (!modal) return;
        var stats = getLibraryStats();
        var entries = listLibraryForCurrentBSite();
        $('#pt-lib-modal-count').innerText = entries.length;
        $('#pt-lib-modal-host').innerText = stats.bSiteHost;
        $('#pt-lib-modal-ttl').innerText = String(config.libraryFreshHours || 24);
        var listBox = $('#pt-lib-modal-list');
        listBox.innerHTML = '';
        if (entries.length === 0) {
            listBox.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px;">当前 B 站暂无查重记录</div>';
        } else {
            entries.forEach(function (e) {
                var row = el('div', '', '', 'display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:#f8fafc; border-radius:4px; font-size:11px;');
                var leftSpan = el('span', '', (e.cnTitle || e.movieTitle || e.cacheKey) + ' (' + (e.movieYear || '?') + ')', 'flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px;');
                leftSpan.title = e.cacheKey;
                var badgeEmoji = BADGE_DICT[e.vKey].text.split(' ')[0];
                var rightTxt = badgeEmoji + ' ' + e.ageHours + 'h前 ×' + e.checkCount;
                if (e.forwardedAt) rightTxt += ' 🚀';
                var rightSpan = el('span', '', rightTxt, 'color:#64748b; font-size:10.5px; white-space:nowrap;');
                if (e.forwardedAt) rightSpan.title = '已转种到 ' + e.forwardedTo;
                row.appendChild(leftSpan); row.appendChild(rightSpan); listBox.appendChild(row);
            });
        }
        modal.style.display = 'flex';
    });

    bindAction('lib-close', function () {
        var modal = $('#pt-lib-modal');
        if (modal) modal.style.display = 'none';
    });

    bindAction('lib-clear', function () {
        var stats = getLibraryStats();
        if (!confirm('确定清空当前 B 站 [' + stats.bSiteHost + '] 的 ' + stats.currentBSite + ' 条查重记录吗？\n\n（其他 B 站的记录不受影响）')) return;
        clearLibraryForCurrentBSite();
        log('📚 已清空当前 B 站 [' + stats.bSiteHost + '] 的词库记录', 'SUCCESS');
        updateLibraryBadge();
        var modal = $('#pt-lib-modal');
        if (modal) modal.style.display = 'none';
    });

    window.addEventListener('keydown', function (e) {
        if (e.altKey && (e.key === 'p' || e.key === 'P')) {
            var panel = $('#pt-checker-panel'), pill = $('#pt-dock-pill');
            if (panel) {
                panel.style.display = 'flex'; panel.style.top = '70px'; panel.style.left = ''; panel.style.right = '20px';
                if (pill) pill.style.display = 'none';
                GM_setValue('pt_panel_collapsed', false);
                GM_setValue('pt_panel_pos', { top: '70px', left: '' });
            }
        }
    });

    var isPTP = /passthepopcorn\.me/i.test(location.hostname);
    var isBHD = /beyond-hd\.me/i.test(location.hostname);
    var isBLU = /blutopia\.cc/i.test(location.hostname);
    var isDV  = /dreadvault\.org/i.test(location.hostname);
    var isPterClub = /pterclub\.(net|club|com|org)/i.test(location.hostname);

    function detectCurrentSiteArch() {
        if (isPTP) return 'gz';
        if (isBHD) return 'f3nix';
        if (isBLU || isDV || /aither\.cc/i.test(location.hostname)) return 'unit3d';
        if (isPterClub || /ptchdbits\.co|chdbits\.co|hdsky\.me/i.test(location.hostname)) return 'np';
        if ($('div[wire\\:name="torrent-search"], tr.torrent-search--list__row, a[href*="HDInnovations/UNIT3D"]')) return 'unit3d';
        if ($('#filter_torrents_form, a.torrent-info-link') || rootWin.PageData) return 'gz';
        if ($('script[src*="f3nix"], tr[id^="torrentposter"]')) return 'f3nix';
        return 'np';
    }

    var currentSiteArch = detectCurrentSiteArch();

    var userCustomSites = GM_getValue('pt_user_custom_sites', {});
    var SITE_DATABASE = Object.assign({}, DEFAULT_SITE_DATABASE, userCustomSites);
    var apiKeysVault = GM_getValue('pt_api_keys_vault', {});

    var config = {
        workMode: 'auto',
        apiPagesCount: GM_getValue('pt_api_pages_count', 1),
        siteAKey: GM_getValue('pt_site_a_key', 'AUTO'),
        siteBKey: GM_getValue('pt_site_b_key', 'PTer'),
        delayMs: GM_getValue('pt_delay_ms', 2500),
        qbUrl: GM_getValue('pt_qb_url', ''),
        qbUser: GM_getValue('pt_qb_user', ''),
        qbPass: GM_getValue('pt_qb_pass', ''),
        qbCategory: GM_getValue('pt_qb_category', ''),
        libraryEnabled: GM_getValue('pt_library_enabled', true),
        libraryFreshHours: GM_getValue('pt_library_fresh_hours', 24),
        libraryMaxEntries: GM_getValue('pt_library_max_entries', 500),
        withSubtitle: GM_getValue('pt_sub_withSubtitle', true),
        subCast: GM_getValue('pt_sub_subCast', 3),
        subDisc: GM_getValue('pt_sub_subDisc', '原盘'),
        useHide: GM_getValue('pt_sub_useHide', true),
        useTag: GM_getValue('pt_sub_useTag', true),
        roundFps: GM_getValue('pt_sub_roundFps', false),
        maxShots: GM_getValue('pt_sub_maxShots', 12),
        autoImdb: GM_getValue('pt_sub_autoImdb', true),
        autoCopy: GM_getValue('pt_sub_autoCopy', true),
        manualImdb: ''
    };

    function getApiKeyForUrl(urlOrHost) {
        var hk = extractHostKey(urlOrHost);
        return (hk && apiKeysVault[hk]) ? apiKeysVault[hk].trim() : '';
    }

    function setApiKeyForUrl(urlOrHost, apiKeyVal) {
        var hk = extractHostKey(urlOrHost);
        if (!hk) return;
        if (apiKeyVal && apiKeyVal.trim()) apiKeysVault[hk] = apiKeyVal.trim();
        else delete apiKeysVault[hk];
        GM_setValue('pt_api_keys_vault', apiKeysVault);
    }

    function getSiteAInfo() {
        var curHost = extractHostKey(location.hostname);
        var curOrigin = location.origin + '/';
        var matched = null;
        Object.keys(SITE_DATABASE).forEach(function (k) {
            if (extractHostKey(SITE_DATABASE[k].url) === curHost) matched = SITE_DATABASE[k];
        });
        var sName = matched ? matched.name : (isPTP ? 'PTP' : (isBHD ? 'BeyondHD' : (isBLU ? 'Blutopia' : (isDV ? 'DreadVault' : (isPterClub ? 'PTerClub' : (/ptchdbits|chdbits/i.test(location.hostname) ? 'CHDBits (彩虹岛)' : (/hdsky\.me/i.test(location.hostname) ? 'HDSky (天空)' : location.hostname.split('.')[0].toUpperCase())))))));
        return { name: sName, url: curOrigin, type: matched ? matched.type : currentSiteArch, apiKey: matched ? getApiKeyForUrl(location.hostname) : '' };
    }

    function getSiteBInfo() {
        var dbB = SITE_DATABASE[config.siteBKey] || SITE_DATABASE['PTer'];
        return { name: dbB.name, url: dbB.url, type: dbB.type, apiKey: getApiKeyForUrl(dbB.url) };
    }

    var ARCH_RATE_RULES = {
        'gz':     { max: 4,  windowMs: 10000, label: 'Gazelle (安全上限 4次/10秒)' },
        'unit3d': { max: 20, windowMs: 60000, label: 'UNIT3D (安全上限 20次/60秒)' }
    };
    var cooldownTimerId = null;

    var RateLimiter = {
        getRule: function (arch) { return ARCH_RATE_RULES[arch] || ARCH_RATE_RULES['unit3d']; },
        getHistory: function (hostKey, windowMs) {
            var allLogs = GM_getValue('pt_api_rate_logs', {});
            var now = Date.now();
            var valid = (allLogs[hostKey] || []).filter(function (ts) { return (now - ts) < windowMs; });
            allLogs[hostKey] = valid;
            GM_setValue('pt_api_rate_logs', allLogs);
            return valid;
        },
        checkStatus: function (urlOrHost, arch) {
            var hostKey = extractHostKey(urlOrHost);
            var rule = this.getRule(arch);
            var history = this.getHistory(hostKey, rule.windowMs);
            var lockUntil = (GM_getValue('pt_api_lock_until', {})[hostKey]) || 0;
            var now = Date.now();
            if (lockUntil > now || history.length >= rule.max) {
                var waitSec = lockUntil > now ? Math.ceil((lockUntil - now) / 1000) : Math.max(1, Math.ceil((history[0] + rule.windowMs - now) / 1000));
                return { allowed: false, used: history.length, max: rule.max, remaining: 0, waitSec: waitSec, ruleLabel: rule.label, hostKey: hostKey };
            }
            return { allowed: true, used: history.length, max: rule.max, remaining: rule.max - history.length, waitSec: 0, ruleLabel: rule.label, hostKey: hostKey };
        },
        recordRequest: function (urlOrHost, arch) {
            var hostKey = extractHostKey(urlOrHost);
            var rule = this.getRule(arch);
            var allLogs = GM_getValue('pt_api_rate_logs', {});
            var now = Date.now();
            var list = (allLogs[hostKey] || []).filter(function (ts) { return (now - ts) < rule.windowMs; });
            list.push(now);
            allLogs[hostKey] = list;
            GM_setValue('pt_api_rate_logs', allLogs);
            updateQuotaUI();
        },
        forceCooldown: function (urlOrHost, waitSeconds) {
            var hostKey = extractHostKey(urlOrHost);
            var lockUntilMap = GM_getValue('pt_api_lock_until', {});
            lockUntilMap[hostKey] = Date.now() + (waitSeconds * 1000);
            GM_setValue('pt_api_lock_until', lockUntilMap);
            startCooldownTicker();
        }
    };

    function checkApiQuotaOrThrow(site, arch) {
        var st = RateLimiter.checkStatus(site.url, arch);
        if (!st.allowed) {
            log('⚠️ [API限流保护] ' + site.name + ' 冷却中，请等待 ' + st.waitSec + ' 秒或自动回退网页模式...', 'WARN');
            startCooldownTicker();
            throw new Error('API 冷却中 (' + st.waitSec + 's)');
        }
        RateLimiter.recordRequest(site.url, arch);
    }

    function refreshSiteSelectDropdowns() {
        var selectA = $('#pt-cfg-select-a'), selectB = $('#pt-cfg-select-b');
        if (!selectA || !selectB) return;
        selectA.innerHTML = '<option value="AUTO">🌐 自动识别当前网页所在站点 (推荐，跨站自动切换)</option>';
        selectB.innerHTML = '';
        Object.keys(SITE_DATABASE).forEach(function (k) {
            var s = SITE_DATABASE[k];
            var hasKey = !!getApiKeyForUrl(s.url);
            var modeTag = (s.type === 'unit3d' || s.type === 'gz') ? (hasKey ? ' [🚀已配API]' : ' [可配API]') : ' [🌐纯网页架构]';
            var txt = s.name + ' (' + s.type.toUpperCase() + ')' + modeTag;
            var optA = el('option', '', txt); optA.value = k; selectA.appendChild(optA);
            var optB = el('option', '', txt); optB.value = k; selectB.appendChild(optB);
        });
    }

    function updateSiteIndicators() {
        var lblA = $('#pt-cur-a-label'), modeA = $('#pt-cur-a-mode'), lblB = $('#pt-cur-b-label'), modeB = $('#pt-cur-b-mode'), lblQB = $('#pt-cur-qb-label');
        if (!lblA || !lblB || !lblQB) return;
        var infoA = getSiteAInfo(), infoB = getSiteBInfo();
        lblA.innerText = infoA.name + ' (' + infoA.type.toUpperCase() + ')';
        if (modeA) {
            modeA.className = shouldSiteUseApi(infoA) ? 'pt-mode-pill-api' : 'pt-mode-pill-web';
            modeA.innerText = shouldSiteUseApi(infoA) ? '🚀API模式' : (infoA.type === 'np' ? '🌐网页DOM(NP无API)' : '🌐网页DOM');
        }
        lblB.innerText = infoB.name + ' (' + infoB.type.toUpperCase() + ')';
        if (modeB) {
            modeB.className = shouldSiteUseApi(infoB) ? 'pt-mode-pill-api' : 'pt-mode-pill-web';
            modeB.innerText = shouldSiteUseApi(infoB) ? '🚀API查重' : '🌐网页查重';
        }
        lblQB.innerText = config.qbUrl ? config.qbUrl.replace(/https?:\/\//, '').replace(/\/$/, '') : '未配置';
    }

    function updateQuotaUI() {
        var quotaEl = $('#pt-cur-quota-label');
        if (!quotaEl) return false;
        var siteA = getSiteAInfo(), siteB = getSiteBInfo();
        var aApi = shouldSiteUseApi(siteA), bApi = shouldSiteUseApi(siteB);
        if (!aApi && !bApi) {
            quotaEl.style.color = '#64748b';
            quotaEl.innerText = (siteA.type === 'np' && siteB.type === 'np') ? '🌐 A/B站均为 NP 架构 (无API，自动走网页解析)' : ('🌐 未配置 ' + siteA.name + ' API Key (当前走网页DOM)');
            return false;
        }
        var activeSite = aApi ? siteA : siteB;
        var st = RateLimiter.checkStatus(activeSite.url, activeSite.type);
        if (!st.allowed) {
            quotaEl.style.color = '#dc2626';
            quotaEl.innerText = '⏳ ' + activeSite.name + ' 冷却中: 请等 ' + st.waitSec + ' 秒';
            return true;
        }
        quotaEl.style.color = '#059669';
        quotaEl.innerText = activeSite.name + ' 剩余 ' + st.remaining + '/' + st.max + ' 次 (' + st.ruleLabel + ')';
        return false;
    }

    function startCooldownTicker() {
        if (cooldownTimerId) clearInterval(cooldownTimerId);
        cooldownTimerId = setInterval(function () {
            if (!updateQuotaUI()) { clearInterval(cooldownTimerId); cooldownTimerId = null; }
        }, 1000);
    }

    bindAction('panel-ready', function () {
        refreshSiteSelectDropdowns();
        updateSiteIndicators();
        if (updateQuotaUI()) startCooldownTicker();
        var selA = $('#pt-cfg-select-a'), selB = $('#pt-cfg-select-b');
        if (selA) selA.onchange = function () {
            var valA = this.value;
            var targetUrlA = (valA === 'AUTO' || !SITE_DATABASE[valA]) ? location.hostname : SITE_DATABASE[valA].url;
            $('#pt-cfg-a-apikey').value = getApiKeyForUrl(targetUrlA);
            $('#pt-cfg-a-host-hint').innerText = '当前绑定域名: ' + extractHostKey(targetUrlA);
        };
        if (selB) selB.onchange = function () {
            var valB = this.value;
            $('#pt-cfg-b-apikey').value = getApiKeyForUrl(SITE_DATABASE[valB] ? SITE_DATABASE[valB].url : '');
        };
        var sA = getSiteAInfo(), sB = getSiteBInfo();
        log('面板就绪 | 已识别源A站: ' + sA.name + ' [' + sA.type.toUpperCase() + ' -> ' + (shouldSiteUseApi(sA) ? '🚀API模式' : '🌐网页DOM模式') + '] | 目标B站: ' + sB.name);
        updateLibraryBadge();
        var libStats = getLibraryStats();
        if (libStats.currentBSite > 0) {
            log('📚 词库已加载: 当前 B 站 [' + libStats.bSiteHost + '] 有 ' + libStats.currentBSite + ' 条已查重记录（' + (config.libraryFreshHours || 24) + 'h 内有效）', 'INFO');
        }
    });

    bindAction('cfg-open', function () {
        refreshSiteSelectDropdowns();
        var curHost = extractHostKey(location.hostname);
        if (config.siteAKey !== 'AUTO' && SITE_DATABASE[config.siteAKey] && extractHostKey(SITE_DATABASE[config.siteAKey].url) !== curHost) {
            config.siteAKey = 'AUTO'; GM_setValue('pt_site_a_key', 'AUTO');
        }
        $('#pt-cfg-select-a').value = config.siteAKey;
        $('#pt-cfg-select-b').value = config.siteBKey;
        $('#pt-cfg-api-pages').value = String(config.apiPagesCount || 1);
        var curAUrl = (config.siteAKey === 'AUTO' || !SITE_DATABASE[config.siteAKey]) ? location.hostname : SITE_DATABASE[config.siteAKey].url;
        var curBUrl = SITE_DATABASE[config.siteBKey] ? SITE_DATABASE[config.siteBKey].url : '';
        $('#pt-cfg-a-apikey').value = getApiKeyForUrl(curAUrl);
        $('#pt-cfg-b-apikey').value = getApiKeyForUrl(curBUrl);
        $('#pt-cfg-a-host-hint').innerText = '当前绑定域名: ' + extractHostKey(curAUrl);
        $('#pt-cfg-qb-url').value = config.qbUrl;
        $('#pt-cfg-qb-user').value = config.qbUser;
        $('#pt-cfg-qb-pass').value = config.qbPass;
        $('#pt-cfg-qb-cat').value = config.qbCategory;
        $('#pt-cfg-delay').value = config.delayMs;

        $('#pt-cfg-sub-cast').value = config.subCast;
        $('#pt-cfg-sub-disc').value = config.subDisc;
        $('#pt-cfg-max-shots').value = config.maxShots;
        $('#pt-cfg-with-sub').checked = config.withSubtitle;
        $('#pt-cfg-sub-hide').checked = config.useHide;
        $('#pt-cfg-sub-tag').checked = config.useTag;
        $('#pt-cfg-round-fps').checked = config.roundFps;
        $('#pt-cfg-auto-copy').checked = config.autoCopy;

        $('#pt-cfg-qb-test-msg').style.display = 'none';
        $('#pt-cfg-modal').style.display = 'flex';
    });

    bindAction('cfg-close', function () { $('#pt-cfg-modal').style.display = 'none'; });

    bindAction('cfg-save', function () {
        config.siteAKey = $('#pt-cfg-select-a').value;
        config.siteBKey = $('#pt-cfg-select-b').value;
        config.apiPagesCount = parseInt($('#pt-cfg-api-pages').value, 10) || 1;
        var curAUrl = (config.siteAKey === 'AUTO' || !SITE_DATABASE[config.siteAKey]) ? location.hostname : SITE_DATABASE[config.siteAKey].url;
        var curBUrl = SITE_DATABASE[config.siteBKey] ? SITE_DATABASE[config.siteBKey].url : '';
        if (hostInSiteDatabase(curAUrl, SITE_DATABASE)) setApiKeyForUrl(curAUrl, $('#pt-cfg-a-apikey').value);
        else if (($('#pt-cfg-a-apikey').value || '').trim()) log('API Key 只保存到已配置的站点。当前页不在站点列表里，未保存 A 站密钥。', 'WARN');
        if (hostInSiteDatabase(curBUrl, SITE_DATABASE)) setApiKeyForUrl(curBUrl, $('#pt-cfg-b-apikey').value);
        var qbUrlInput = $('#pt-cfg-qb-url').value.trim();
        if (qbUrlInput && !qbUrlInput.endsWith('/')) qbUrlInput += '/';
        config.qbUrl = qbUrlInput;
        config.qbUser = $('#pt-cfg-qb-user').value.trim();
        config.qbPass = $('#pt-cfg-qb-pass').value.trim();
        config.qbCategory = $('#pt-cfg-qb-cat').value.trim();
        config.delayMs = Math.max(500, parseInt($('#pt-cfg-delay').value, 10) || 2500);

        config.subCast = Math.max(1, parseInt($('#pt-cfg-sub-cast').value, 10) || 3);
        config.subDisc = $('#pt-cfg-sub-disc').value.trim() || '原盘';
        config.maxShots = Math.max(0, parseInt($('#pt-cfg-max-shots').value, 10) || 12);
        config.withSubtitle = $('#pt-cfg-with-sub').checked;
        config.useHide = $('#pt-cfg-sub-hide').checked;
        config.useTag = $('#pt-cfg-sub-tag').checked;
        config.roundFps = $('#pt-cfg-round-fps').checked;
        config.autoCopy = $('#pt-cfg-auto-copy').checked;

        GM_setValue('pt_sub_subCast', config.subCast);
        GM_setValue('pt_sub_subDisc', config.subDisc);
        GM_setValue('pt_sub_maxShots', config.maxShots);
        GM_setValue('pt_sub_withSubtitle', config.withSubtitle);
        GM_setValue('pt_sub_useHide', config.useHide);
        GM_setValue('pt_sub_useTag', config.useTag);
        GM_setValue('pt_sub_roundFps', config.roundFps);
        GM_setValue('pt_sub_autoCopy', config.autoCopy);

        GM_setValue('pt_site_a_key', config.siteAKey);
        GM_setValue('pt_site_b_key', config.siteBKey);
        GM_setValue('pt_api_pages_count', config.apiPagesCount);
        GM_setValue('pt_qb_url', config.qbUrl);
        GM_setValue('pt_qb_user', config.qbUser);
        GM_setValue('pt_qb_pass', config.qbPass);
        GM_setValue('pt_qb_category', config.qbCategory);
        GM_setValue('pt_delay_ms', config.delayMs);
        updateSiteIndicators(); updateQuotaUI();
        $('#pt-cfg-modal').style.display = 'none';
        log('配置已保存！', 'SUCCESS');
    });

// === [PART 1 END - 请回复“继续 /c”获取下半部分，直接粘贴在此行下方即可闭合脚本] ===
if (currentSiteArch === 'unit3d') {
        var cleanU3d = function () {
            try {
                if (location.search.indexOf('name=') !== -1) {
                    var u = new URL(location.href);
                    if ((u.searchParams.get('name') || '').toLowerCase() === '?') {
                        u.searchParams.delete('name'); location.replace(u.toString()); return;
                    }
                }
                var inp = $('input#name, input[wire\\:model\\.live="name"]');
                if (inp) {
                    inp.setAttribute('autocomplete', 'off'); inp.setAttribute('data-lpignore', 'true');
                    if (inp.value && inp.value.trim().toLowerCase() === '?') { inp.value = ''; dispatchEvt(inp); }
                }
            } catch (e) {}
        };
        cleanU3d(); setTimeout(cleanU3d, 500);
    }

    function getU3dCbLabel(cb) {
        if (!cb) return '';
        var lbl = cb.closest('label');
        if (lbl) return lbl.textContent.replace(/\s+/g, ' ').trim();
        if (cb.id) {
            var forLbl = document.querySelector('label[for="' + cb.id.replace(/"/g, '\\"') + '"]');
            if (forLbl) return forLbl.textContent.replace(/\s+/g, ' ').trim();
        }
        if (cb.nextElementSibling && /^(LABEL|SPAN)$/i.test(cb.nextElementSibling.tagName)) {
            return cb.nextElementSibling.textContent.replace(/\s+/g, ' ').trim();
        }
        var p = cb.parentElement;
        if (p && p.querySelectorAll('input[type="checkbox"]').length === 1) {
            return p.textContent.replace(/\s+/g, ' ').trim();
        }
        return (cb.nextSibling && cb.nextSibling.textContent ? cb.nextSibling.textContent : '').replace(/\s+/g, ' ').trim();
    }

    function getU3dCbMeta(cb) {
        var fs = cb.closest('fieldset, .form__fieldset');
        var legEl = fs ? fs.querySelector('legend, .form__legend') : null;
        var legend = legEl ? legEl.textContent.replace(/\s+/g, ' ').trim() : '';
        var model = '';
        if (cb.attributes) {
            for (var i = 0; i < cb.attributes.length; i++) {
                var an = cb.attributes[i].name;
                if (an.indexOf('wire:model') === 0 || an === 'name') {
                    model = (cb.attributes[i].value || '').trim();
                    break;
                }
            }
        }
        return { legend: legend, model: model };
    }

    function applyUnit3dDomPreset() {
        var allCbs = $$('input[type="checkbox"]').filter(function (cb) {
            return !cb.closest('#pt-checker-panel, #pt-cfg-modal, #pt-lib-modal, .pt-inline-toolbar') && !cb.classList.contains('pt-custom-chk');
        });

        var matchedCount = 0;
        var changedCount = 0;

        allCbs.forEach(function (cb) {
            var labelTxt = getU3dCbLabel(cb);
            var meta = getU3dCbMeta(cb);
            var isCat  = /^(类别|類別|Category|Categories)$/i.test(meta.legend) || /^categor/i.test(meta.model);
            var isType = /^(规格|規格|Type|Types)$/i.test(meta.legend) || /^type/i.test(meta.model);
            var isRes  = /^(分辨率|解析度|Resolution|Resolutions)$/i.test(meta.legend) || /^resolution/i.test(meta.model);
            var isBuff = /^(Buff|Buffs|Discount|Discounts|优惠|優惠|促销|促銷)$/i.test(meta.legend) || /^(free|doubleup|featured)/i.test(meta.model) || /Freeleech/i.test(labelTxt);

            if (!isCat && !isType && !isRes && !isBuff) return;
            matchedCount++;

            var shouldCheck = false;
            if (isCat)  shouldCheck = /^(Movie|Movies|电影|電影)$/i.test(labelTxt);
            if (isType) shouldCheck = /^(Full\s*Disc|BDMV|原盘|原盤)$/i.test(labelTxt);
            if (isRes)  shouldCheck = /^(4320p|2160p|1080p|1080i)$/i.test(labelTxt);
            if (isBuff) {
                shouldCheck = /Freeleech/i.test(labelTxt) && !/upload|double|featured|双倍|置顶|精选/i.test(labelTxt + ' ' + meta.model);
            }

            if (cb.checked !== shouldCheck) {
                cb.click();
                if (cb.checked !== shouldCheck) {
                    cb.checked = shouldCheck;
                    dispatchEvt(cb);
                }
                changedCount++;
            }
        });

        $$('select').forEach(function (sel) {
            if (sel.closest('#pt-checker-panel, #pt-cfg-modal')) return;
            var meta = getU3dCbMeta(sel);
            var hasListOpt = Array.from(sel.options).some(function (o) { return o.value === 'list'; });
            var has100Opt  = Array.from(sel.options).some(function (o) { return o.value === '100'; });
            if ((/view/i.test(meta.model) || hasListOpt) && sel.value !== 'list' && hasListOpt) {
                sel.value = 'list';
                dispatchEvt(sel);
                changedCount++;
            } else if ((/perPage/i.test(meta.model) || (has100Opt && !hasListOpt)) && sel.value !== '100' && has100Opt) {
                sel.value = '100';
                dispatchEvt(sel);
                changedCount++;
            }
        });

        return { matchedCount: matchedCount, changedCount: changedCount };
    }

    var PRESET_HANDLERS = {
        unit3d: async function (siteA) {
            var res = applyUnit3dDomPreset();
            if (res.matchedCount === 0) {
                GM_setValue('pt_u3d_pending_preset', Date.now());
                location.href = location.origin + '/torrents?categoryIds[0]=1&typeIds[0]=1&view=list&perPage=100';
                return;
            }
            setTimeout(function () {
                var retry = applyUnit3dDomPreset();
                if (retry.changedCount > 0) {
                    setTimeout(applyUnit3dDomPreset, 700);
                }
                scheduleAutoRestore(1000);
            }, 700);

            if (shouldSiteUseApi(siteA)) {
                try { await fetchSiteAUnit3dListByApi(siteA, getCurrentWebPageNumber(), 1); } catch (e) {}
            }
            log('✅ 预设已生效：Movie + Full Disc + 分辨率(含4320p) + Freeleech全选 + 100条/页！', 'SUCCESS');
        },
        gz: function () {
            var form = $('#filter_torrents_form');
            if (!form) return;
            var sInput = $('input[name="searchstr"]', form); if (sInput) sInput.value = '';
            var mediaSel = $('select[name="media"]', form); if (mediaSel) mediaSel.value = 'Blu-ray';
            var encSel = $('select[name="encoding"]', form); if (encSel) encSel.value = 'm2ts';
            var freeChk = $('input[name="freetorrent"], #freetorrent', form); if (freeChk) freeChk.checked = true;
            var cat1 = $('#cat_1, input[name="filter_cat[1]"]', form); if (cat1) cat1.checked = true;
            for (var c = 2; c <= 6; c++) {
                var catOther = $('#cat_' + c + ', input[name="filter_cat[' + c + ']"]', form);
                if (catOther) catOther.checked = false;
            }
            form.submit();
        },
        f3nix: function () {
            location.href = location.origin + '/torrents?categories[]=1&types[]=UHD+100&types[]=UHD+66&types[]=UHD+50&types[]=BD+50&types[]=BD+25&resolutions[]=4320p&resolutions[]=2160p&resolutions[]=1080p&resolutions[]=1080i&sources[]=Blu-ray&freeleech=1&qty=100&doSearch=Search';
        },
        np: function () {
            var sInput = $('input[name="search"], #searchinput'); if (sInput) sInput.value = '';
            var setCb = function (id, val) { var node = document.getElementById(id) || $('input[name="' + id + '"]'); if (node) node.checked = val; };
            ['source1', 'source2', 'cat401', 'standard1', 'standard2', 'standard3', 'standard5', 'standard6'].forEach(function (k) { setCb(k, true); });
            ['source3', 'source4', 'source5', 'source6', 'cat402', 'cat403', 'cat404', 'cat405'].forEach(function (k) { setCb(k, false); });
            $$('label, td').forEach(function (elNode) {
                if (/\b(4320p|8K)\b/i.test(elNode.textContent || '')) {
                    var cb = $('input[type="checkbox"]', elNode) || (elNode.previousElementSibling && elNode.previousElementSibling.type === 'checkbox' ? elNode.previousElementSibling : null);
                    if (cb) cb.checked = true;
                }
            });
            var spSel = $('select[name="spstate"]');
            if (spSel) {
                var promoOpt = Array.from(spSel.options).find(function (o) { return /促销|優惠|Promotion/i.test(o.textContent); });
                spSel.value = promoOpt ? promoOpt.value : '2';
            }
            var form = $('form[name="searchbox"], form[action*="torrents.php"]');
            if (form) form.submit();
            else location.href = location.origin + '/torrents.php?cat401=1&medium1=1&medium2=1&spstate=2&incldead=1';
        }
    };

    bindAction('btn1-preset', async function () {
        var siteA = getSiteAInfo();
        log('正在执行预设：为 [' + siteA.name + '] 锁定电影蓝光原盘检索条件...');
        await (PRESET_HANDLERS[currentSiteArch] || PRESET_HANDLERS.np)(siteA);
    });

    function getCurrentWebPageNumber() {
        var urlPage = (new URLSearchParams(location.search)).get('page');
        if (urlPage && /^\d+$/.test(urlPage)) return parseInt(urlPage, 10);
        var activeEl = $('.pagination__current, .page-item.active .page-link, font.gray > b');
        return (activeEl && /^\d+$/.test(activeEl.textContent.trim())) ? parseInt(activeEl.textContent.trim(), 10) : 1;
    }

    function parseNexusPhpRowAgeDays(row) {
        var timeSpan = $('td span[title^="202"], td span[title^="201"]', row);
        if (timeSpan) {
            var exactStr = timeSpan.getAttribute('title').trim();
            var ts = Date.parse(exactStr.replace(/-/g, '/'));
            if (!isNaN(ts)) return { days: (Date.now() - ts) / 86400000, text: timeSpan.textContent.trim() || exactStr };
        }
        var tds = $$('td', row);
        for (var i = 0; i < tds.length; i++) {
            var parsedAge = parseRelativeAgeDays((tds[i].textContent || '').trim());
            if (parsedAge) return parsedAge;
        }
        return { days: 999, text: '' };
    }

    function extractCleanNpSubtitleInfo(row) {
        if (!row) return { cnTitle: '', regionBracket: '' };
        var titleA = $('a[href*="details.php"]', row);
        var cell = (titleA && titleA.closest('td.embedded')) || $('td.embedded, .torrentname', row);
        if (!cell) return { cnTitle: '', regionBracket: '' };
        var clone = cell.cloneNode(true);
        $$('.pt-inline-toolbar, .pt-audit-badge, .pt-dupe-badge, .pt-single-check-btn, .pt-single-forward-btn, .pt-single-qb-btn, a[href*="details.php"], a[href*="imdb.com"], a[href*="douban.com"], .optiontag, span[class*="tag"], b, img, script, style', clone).forEach(function (n) { n.remove(); });
        $$('span, font, a', clone).forEach(function (n) {
            if (RE.NP_UI_TAG.test((n.textContent || '').trim())) n.remove();
        });
        return parseCleanSubtitleString(clone.textContent || '');
    }

    async function fetchSiteAUnit3dListByApi(siteA, startPage, pagesCount, opts) {
        opts = opts || {};
        if (!shouldSiteUseApi(siteA)) throw new Error('当前站点走网页模式');
        startPage = startPage || getCurrentWebPageNumber();
        var curPerPage = (new URLSearchParams(location.search)).get('perPage') || '100';
        if (!opts.append) siteAApiMap.clear();
        var nextPage = startPage;
        var aborted = false;
        for (var p = 0; p < pagesCount; p++) {
            if (isCheckingCancelled) { aborted = true; break; }
            checkApiQuotaOrThrow(siteA, 'unit3d');
            var targetPage = startPage + p;
            var hasFreeFilter = location.search.indexOf('free[') !== -1;
            var freeApiParam = hasFreeFilter ? '&free[0]=0&free[1]=25&free[2]=50&free[3]=75&free[4]=100' : '';
            var apiUrl = siteBase(siteA.url) + 'api/torrents/filter?categories[0]=1&types[0]=1&resolutions[0]=1&resolutions[1]=2&resolutions[2]=3&resolutions[3]=4' + freeApiParam + '&perPage=' + encodeURIComponent(curPerPage) + '&page=' + targetPage;
            log('⚡ [A站 API] 正在拉取第 ' + targetPage + ' 页数据...', 'INFO');
            var json = null;
            try { json = await http(apiUrl, { responseType: 'json', headers: u3dHeaders(siteA.apiKey) }); }
            catch (err) { if (err.message === 'HTTP 429') RateLimiter.forceCooldown(siteA.url, 30); throw err; }
            var list = (json && Array.isArray(json.data)) ? json.data : [];
            if (list.length === 0) {
                apiCrawlCursor = { nextPage: targetPage, done: true };
                log('✅ [A站 API] 共拉取到 ' + siteAApiMap.size + ' 条结构化电影原盘数据！', 'SUCCESS');
                return siteAApiMap;
            }
            list.forEach(function (entry) {
                var tid = String(entry.id || (entry.attributes && entry.attributes.id) || '');
                var attr = entry.attributes || entry;
                if (tid && attr) {
                    siteAApiMap.set(tid, {
                        torrentId: tid, page: targetPage, name: attr.name || '',
                        categoryId: String(attr.category_id || '1'), typeId: String(attr.type_id || '1'),
                        typeName: attr.type || 'Full Disc', resolution: attr.resolution || '',
                        sizeGB: parseSizeToGB(attr.size || 0),
                        imdbId: normalizeImdbId(attr.imdb_id),
                        bdinfo: attr.bd_info || attr.bdinfo || attr.media_info || attr.mediainfo || '',
                        description: attr.description || '',
                        downloadUrl: attr.download_link || siteUrl(siteA, 'download', { id: tid })
                    });
                }
            });
            nextPage = targetPage + 1;
            apiCrawlCursor = { nextPage: nextPage, done: false };
            if (p < pagesCount - 1) {
                if (isCheckingCancelled) { aborted = true; break; }
                await new Promise(function (r) { setTimeout(r, 1000); });
            }
        }
        apiCrawlCursor = { nextPage: nextPage, done: !aborted };
        log('✅ [A站 API] 共拉取到 ' + siteAApiMap.size + ' 条结构化电影原盘数据！', 'SUCCESS');
        return siteAApiMap;
    }

    async function fetchSiteAGazelleListByApi(siteA, startPage, pagesCount) {
        if (!shouldSiteUseApi(siteA)) throw new Error('当前站点走网页模式');
        startPage = startPage || getCurrentWebPageNumber();
        siteAApiMap.clear();
        var headers = gzHeaders(siteA.apiKey);
        var curHost = extractHostKey(location.hostname);
        var aHost = extractHostKey(siteA.url);
        var sameSite = (curHost === aHost);
        for (var p = 0; p < pagesCount; p++) {
            if (isCheckingCancelled) break;
            checkApiQuotaOrThrow(siteA, 'gz');
            var targetPage = startPage + p;
            var apiUrlStr;
            if (sameSite) {
                var u = new URL(location.href);
                u.searchParams.set('json', '1'); u.searchParams.set('page', String(targetPage));
                apiUrlStr = u.toString();
            } else {
                apiUrlStr = siteBase(siteA.url) + 'torrents.php?json=1&page=' + targetPage;
            }
            var data = null;
            try { data = await http(apiUrlStr, { responseType: 'json', headers: headers }); }
            catch (err) { if (err.message === 'HTTP 429') RateLimiter.forceCooldown(siteA.url, 15); throw err; }
            var movies = (data && data.Movies) || [];
            if (movies.length === 0) break;
            movies.forEach(function (movie) {
                var imdb = normalizeImdbId(movie.ImdbId);
                (movie.GroupingQualities || []).forEach(function (gq) {
                    (gq.Torrents || []).forEach(function (t) {
                        var tid = String(t.TorrentId);
                        siteAApiMap.set(tid, {
                            torrentId: tid, page: targetPage, name: t.ReleaseName || t.Title || '',
                            releaseGroup: t.ReleaseGroup || '', movieTitle: movie.Title || '',
                            movieYear: String(movie.Year || ''), categoryName: gq.CategoryName || 'Feature Film',
                            specText: t.Title || '', sizeGB: parseSizeToGB(Number(t.Size || 0)), imdbId: imdb
                        });
                    });
                });
            });
            if (p < pagesCount - 1) await new Promise(function (r) { setTimeout(r, 2200); });
        }
        return siteAApiMap;
    }

    var AUDIT_HANDLERS = {
        unit3d: async function (siteA, curWebPage, useApiOnA, pagesCount) {
            $$('[data-pt-row="auditable"]').forEach(function (row) { cleanRowTags(row); });
            if (useApiOnA) { try { await fetchSiteAUnit3dListByApi(siteA, curWebPage, pagesCount); } catch (e) { siteAApiMap.clear(); } }
            else siteAApiMap.clear();
            var bluRows = $$('tr.torrent-search--list__row, table.data-table tbody tr');
            var passBLU = 0, matchedRowIds = new Set();
            for (var i = 0; i < bluRows.length; i++) {
                if (i > 0 && i % 40 === 0) await new Promise(function (r) { setTimeout(r, 0); });
                var row = bluRows[i];
                var anchor = $('a.torrent-search--list__name', row) || $('td.torrent-search--list__overview a[href*="/torrents/"]', row) || $('a[href*="/torrents/"]', row);
                if (!anchor || /\/download\//i.test(anchor.href)) continue;
                var tid = row.getAttribute('data-torrent-id') || (anchor.href.match(/\/torrents\/(\d+)/) ? anchor.href.match(/\/torrents\/(\d+)/)[1] : '');
                if (tid) matchedRowIds.add(String(tid));
                var apiItem = (useApiOnA && tid) ? siteAApiMap.get(String(tid)) : null;
                var bluName = (apiItem && apiItem.name) ? apiItem.name : anchor.textContent.trim();
                var typeBadge = (apiItem && apiItem.typeName) ? apiItem.typeName : ($('.torrent-search--list__type', row) ? $('.torrent-search--list__type', row).textContent : '').trim();
                var resBadge = (apiItem && apiItem.resolution) ? apiItem.resolution : ($('.torrent-search--list__resolution', row) ? $('.torrent-search--list__resolution', row).textContent : '').trim();
                var catImgNode = $('.torrent-search--list__category img', row);
                var catTitle = catImgNode ? (catImgNode.getAttribute('title') || '') : '';
                var isMovie = apiItem ? (apiItem.categoryId === '1') : ((row.getAttribute('data-category-id') === '1') || /Movie/i.test(catTitle) || row.innerHTML.indexOf('category-images/1') !== -1 || !RE.NON_MOVIE.test(catTitle));
                var isFullDisc = apiItem ? (apiItem.typeId === '1' || /Full Disc/i.test(apiItem.typeName)) : ((row.getAttribute('data-type-id') === '1') || /Full Disc/i.test(typeBadge) || RE.DISC_MEDIA.test(bluName));
                var isDvd = RE.DVD.test(bluName + ' ' + resBadge);
                var isRemux = RE.ENCODE.test(bluName + ' ' + typeBadge);
                var dlAnchor = $('a[href*="/download/"]', row);
                var verdict;
                if (isMovie && isFullDisc && !isDvd && !isRemux) {
                    verdict = {
                        pass: true, fromApi: !!apiItem, torrentId: tid, releaseName: bluName, extraSpec: resBadge,
                        imdbId: (apiItem && apiItem.imdbId) || row.getAttribute('data-imdb-id') || '',
                        bdinfo: apiItem ? apiItem.bdinfo : '',
                        sizeGB: (apiItem && apiItem.sizeGB) || readRowSize(row, '.torrent-search--list__size'),
                        is4K: is4kText(bluName + ' ' + resBadge) || (row.getAttribute('data-resolution-id') === '1'),
                        downloadUrl: (apiItem && apiItem.downloadUrl) || (dlAnchor ? dlAnchor.href : (tid ? siteUrl(siteA, 'download', { id: tid }) : ''))
                    };
                } else if (!isMovie) verdict = { pass: false, code: 'NON_MOVIE' };
                else if (isDvd) verdict = { pass: false, code: 'DVD' };
                else if (isRemux) verdict = { pass: false, code: 'ENCODE' };
                else verdict = { pass: false, code: 'NON_DISC' };
                if (commitAudit(row, anchor, verdict, curWebPage)) passBLU++;
            }
            var extraApiCount = 0;
            if (useApiOnA) {
                siteAApiMap.forEach(function (apiItem, tid) {
                    if (!matchedRowIds.has(tid) && apiItem.categoryId === '1' && (apiItem.typeId === '1' || /Full Disc/i.test(apiItem.typeName)) && !RE.DVD.test(apiItem.name + ' ' + apiItem.resolution) && !RE.ENCODE.test(apiItem.name + ' ' + apiItem.resolution)) {
                        if (commitAudit(null, null, {
                            pass: true, fromApi: true, torrentId: tid, releaseName: apiItem.name, extraSpec: apiItem.resolution,
                            imdbId: apiItem.imdbId, bdinfo: apiItem.bdinfo, sizeGB: apiItem.sizeGB, downloadUrl: apiItem.downloadUrl
                        }, apiItem.page)) {
                            extraApiCount++; passBLU++;
                        }
                    }
                });
            }
            log('[UNIT3D] 审核完毕: 检出合格蓝光电影原盘 ' + passBLU + ' 项' + (extraApiCount > 0 ? ' (含跨页API连拉 ' + extraApiCount + ' 项)' : '') + '。', 'SUCCESS');
        },

        gz: async function (siteA, curWebPage, useApiOnA, pagesCount) {
            if (useApiOnA) { try { await fetchSiteAGazelleListByApi(siteA, curWebPage, pagesCount); } catch (e) { siteAApiMap.clear(); } }
            else siteAApiMap.clear();
            var pageTitleM = document.title.match(/^(.+?)\s*[\[(](\d{4})[\])]/i);
            var globalMovieTitle = pageTitleM ? pageTitleM[1].trim() : '', globalMovieYear = pageTitleM ? pageTitleM[2] : '';
            var imdbA = $('#imdb-title-link');
            if (!imdbA) { var _imdbLinks = $$('a[href*="imdb.com/title/tt"]'); if (_imdbLinks.length === 1) imdbA = _imdbLinks[0]; }
            var globalImdbId = imdbA ? normalizeImdbId(imdbA.href) : '';
            var ptpPageData = rootWin.PageData || window.PageData;
            var torrentMetaMap = new Map();
            if (ptpPageData && ptpPageData.Movies) {
                ptpPageData.Movies.forEach(function (movie) {
                    var imdb = normalizeImdbId(movie.ImdbId);
                    (movie.GroupingQualities || []).forEach(function (gq) {
                        (gq.Torrents || []).forEach(function (t) {
                            torrentMetaMap.set(String(t.TorrentId), {
                                imdbId: imdb, releaseName: t.ReleaseName || '', releaseGroup: t.ReleaseGroup || '',
                                titleDesc: t.Title || '', size: t.Size || '', movieTitle: movie.Title || '', movieYear: movie.Year || ''
                            });
                        });
                    });
                });
            }
            var links = $$('a.torrent-info-link'), passCount = 0;
            links.forEach(function (link) {
                var tidM = link.href.match(/torrentid=(\d+)/i) || (link.getAttribute('onclick') || '').match(/(\d{4,8})/);
                var trRow = link.closest('tr') || link.parentNode;
                var tid = tidM ? tidM[1] : (trRow && trRow.id && trRow.id.match(/\d+/) ? trRow.id.match(/\d+/)[0] : '');
                var apiMeta = useApiOnA ? siteAApiMap.get(String(tid)) : null;
                var meta = apiMeta || torrentMetaMap.get(String(tid));
                var releaseName = (meta && (meta.name || meta.releaseName)) || (trRow && trRow.getAttribute ? trRow.getAttribute('data-releasename') : '') || link.getAttribute('title') || '';
                var specText = ((meta && (meta.specText || meta.titleDesc)) || link.innerText || '').replace(/<[^>]+>/g, '');
                var isDisc = RE.GZ_DISC.test(specText + ' ' + releaseName);
                var isRemux = RE.ENCODE.test(specText + ' ' + releaseName);
                var sizeCell = $('td.nobr, td:nth-child(2)', trRow);
                var dlLink = $('a[href*="action=download"]', trRow);
                var verdict = (isDisc && !isRemux) ? {
                    pass: true, fromApi: !!apiMeta, torrentId: tid,
                    mainTitle: releaseName || specText, releaseName: releaseName, extraSpec: specText,
                    releaseGroup: (meta && meta.releaseGroup) || (trRow && trRow.getAttribute ? trRow.getAttribute('data-releasegroup') : '') || '',
                    movieTitle: (meta && meta.movieTitle) || globalMovieTitle,
                    movieYear: (meta && meta.movieYear) || globalMovieYear,
                    imdbId: (meta && meta.imdbId) || globalImdbId,
                    sizeGB: (apiMeta && apiMeta.sizeGB) || parseSizeToGB((meta && meta.size) || (sizeCell ? sizeCell.innerText : '')),
                    downloadUrl: dlLink ? dlLink.href : ''
                } : { pass: false, code: 'GZ_SKIP' };
                if (commitAudit(trRow, link, verdict, curWebPage)) passCount++;
            });
            log('[Gazelle] 审核完毕: 合格电影原盘 ' + passCount + ' 项。', 'SUCCESS');
        },

        f3nix: function (siteA, curWebPage) {
            var rows = $$('tr[id^="torrentposter"]'), passBHD = 0;
            rows.forEach(function (row) {
                var anchor = $('a.torrent-name', row);
                if (!anchor) return;
                var rName = anchor.textContent.trim();
                var isMovie = !!$('i[title="Movie Torrent"]', row) || !$('i[title="TV Torrent"]', row);
                var badgeTexts = $$('.badge-tip', row).map(function (n) { return n.textContent.trim(); }).join(' ');
                var isDisc = RE.BHD_DISC.test(badgeTexts) || RE.BHD_DISC.test(rName);
                var isRemux = RE.ENCODE.test(badgeTexts + ' ' + rName);
                var libId = row.getAttribute('library') || '';
                var imdbNode = libId ? $('#librarydiv' + libId + ' a[href*="imdb.com/title/tt"]') : null;
                var dlNode = $('a[href*="/download/"]', row);
                var verdict = (isMovie && isDisc && !isRemux) ? {
                    pass: true, releaseName: rName, extraSpec: badgeTexts, imdbId: imdbNode ? imdbNode.href : '',
                    sizeGB: readRowSize(row, '.text-size'),
                    downloadUrl: dlNode ? dlNode.href : ''
                } : { pass: false, code: isMovie ? 'NON_DISC' : 'NON_MOVIE' };
                if (commitAudit(row, anchor, verdict, curWebPage)) passBHD++;
            });
            log('[F3NIX] 审核完毕: 合格电影原盘 ' + passBHD + ' 项。', 'SUCCESS');
        },

        np: function (siteA, curWebPage) {
            var rows = $$('#torrenttable > tbody > tr, table.torrents > tbody > tr');
            var totalScanned = 0, passNP = 0, skipLimitCount = 0, reviewCount = 0;
            rows.forEach(function (row) {
                if ($('td.colhead, th', row)) return;
                var anchor = $('.torrentname a[href*="details.php"], a[href*="details.php"][title]', row);
                if (!anchor) return;
                totalScanned++;
                var mainTitle = (anchor.getAttribute('title') || anchor.textContent || '').trim();
                var tid = (anchor.href.match(/id=(\d+)/i) || ['', ''])[1];
                var nameCell = $('td.torrentname, table.torrentname', row) || anchor.closest('td');
                var cellText = (nameCell ? nameCell.textContent : row.textContent) || '';
                var subInfo = extractCleanNpSubtitleInfo(row);
                var catImg = $('a[href*="cat="] img, td:first-child img', row);
                var catAlt = catImg ? ((catImg.getAttribute('alt') || '') + ' ' + (catImg.getAttribute('title') || '')) : '';
                var isNotMovie = RE.NON_MOVIE.test(catAlt) || RE.EPISODE.test(mainTitle);
                var isForbidden = RE.FORBIDDEN.test(cellText) || !!$('img[alt*="禁转"], img[title*="禁转"], .chs_tag-excl', row);
                var isLimited = RE.LIMITED.test(cellText) || !!$('img[alt*="限转"], img[title*="限转"]', row);
                var isDiy = RE.DIY.test(cellText) || !!$('.chs_tag-diy', row);
                var ageInfo = parseNexusPhpRowAgeDays(row);
                var isLimitUnder7 = isLimited && (ageInfo.days < 7);
                var isRemux = RE.ENCODE.test(mainTitle);
                var isBluRayDisc = RE.DISC_MEDIA.test(mainTitle) && RE.DISC_CODEC.test(mainTitle);
                var hasBdIcon = !!$('img.c_bd, img[title*="BD Discs"], img[alt*="BD Discs"], img[src*="additional/bd.png"]', row);
                var hasDiscHint = RE.DISC_HINT.test(mainTitle);
                var skipCode = '', extraTxt = '';
                if (isForbidden) skipCode = 'FORBIDDEN';
                else if (isLimitUnder7) { skipCode = 'LIMIT7'; extraTxt = '仅发 ' + (ageInfo.text || Math.floor(ageInfo.days) + '天'); skipLimitCount++; }
                else if (isNotMovie) skipCode = 'NON_MOVIE';
                else if (isDiy) skipCode = 'DIY_SKIP';
                else if (isRemux || !isBluRayDisc) skipCode = 'ENCODE';
                var passLabel;
                if (isLimited) passLabel = '🌐原盘(限转已满7天)';
                else if (!hasBdIcon && !hasDiscHint) { passLabel = '🌐原盘[复核]'; if (!skipCode) reviewCount++; }
                else passLabel = '🌐网页原盘';
                var imdbNode = $('a[href*="imdb.com/title/tt"]', row);
                var dlNode = $('a[href*="download.php"]', row);
                var verdict = !skipCode ? {
                    pass: true, torrentId: tid, releaseName: mainTitle,
                    customPassLabel: passLabel,
                    cnTitle: subInfo.cnTitle, regionBracket: subInfo.regionBracket,
                    imdbId: imdbNode ? imdbNode.href : '',
                    sizeGB: readRowSize(row),
                    downloadUrl: dlNode ? dlNode.href : (tid ? siteUrl(siteA, 'download', { id: tid }) : '')
                } : { pass: false, code: skipCode, extra: extraTxt };
                if (commitAudit(row, anchor, verdict, curWebPage)) passNP++;
            });
            log('[NexusPHP] 扫描 ' + totalScanned + ' 项：可安全转发原盘 ' + passNP + ' 项' + (reviewCount > 0 ? '（其中 ' + reviewCount + ' 项标 [复核]）' : '') + (skipLimitCount > 0 ? '，已拦截限转未满7天 ' + skipLimitCount + ' 项！' : '。'), 'SUCCESS');
        }
    };

    bindAction('btn-pull-dupe', async function (btn) {
        if (btn.classList.contains('pt-btn-stop')) {
            isCheckingCancelled = true;
            log('已请求暂停。当前这一步结束后会停住，词库和待发队列都会留下。', 'WARN');
            return;
        }
        var ctx = batchContext();
        var checkpoint = loadBatchCheckpoint();
        if (!checkpoint) {
            if (!confirm('【拉取/查重】\n\n1. 先审核当前页面，在电影词条下挂载工具条\n2. 跨页拉取名单。点「暂停」或刷新后，下次从停下的那一页继续\n3. 已经查过且未过期的电影直接用词库，不再向 B 站重复请求\n\n失败的条目不会被当成已查。确定开始吗？')) return;
        } else {
            log('继续上次未完成的拉取/查重：已保存 ' + checkpoint.items.length + ' 条' + (checkpoint.crawlDone ? '，名单已齐，只查还没查过的。' : '，从第 ' + checkpoint.nextPage + ' 页继续翻页。'), 'INFO');
        }

        isCheckingCancelled = false;
        btn.innerText = '⏸ 暂停';
        btn.classList.add('pt-btn-stop');
        seedBatchProtection(checkpoint ? checkpoint.items : []);

        try {
            auditedList = [];
            var siteA = getSiteAInfo();
            var curWebPage = getCurrentWebPageNumber();
            var useApiOnA = shouldSiteUseApi(siteA);

            log('📄 [1/3] 审核当前页，挂载工具条...', 'INFO');
            try {
                await (AUDIT_HANDLERS[currentSiteArch] || AUDIT_HANDLERS.np)(siteA, curWebPage, false, 1);
            } catch (e) {
                log('⚠️ 当前页审核异常: ' + e.message, 'WARN');
            }
            log('✅ 当前页审核完成，共 ' + auditedList.length + ' 项', 'SUCCESS');

            var liveItems = auditedList.slice();
            var allItemsMap = new Map();
            if (checkpoint) {
                checkpoint.items.forEach(function (item) {
                    rememberBatchItem(allItemsMap, Object.assign({ row: null, chkBox: { checked: true } }, item));
                });
            }
            liveItems.forEach(function (item) { rememberBatchItem(allItemsMap, item); });

            var multiPage = (currentSiteArch === 'unit3d') || currentSiteArch === 'np' || currentSiteArch === 'gz';
            var crawlDone = !!(checkpoint && checkpoint.crawlDone) || !multiPage;
            var nextPage = (checkpoint && checkpoint.nextPage) || 1;

            if (!crawlDone && currentSiteArch === 'unit3d' && useApiOnA) {
                log('🌐 [2/3] 全站拉取（API，从第 ' + nextPage + ' 页）...', 'INFO');
                try {
                    await fetchSiteAUnit3dListByApi(siteA, nextPage, 999, { append: true });
                } catch (apiErr) {
                    log('⚠️ API 拉取中断: ' + apiErr.message + '。已拿到的名单会保留。', 'WARN');
                }
                siteAApiMap.forEach(function (apiItem, tid) {
                    if (allItemsMap.has(tid)) return;
                    var parsed = parseTitleMeta(apiItem.name);
                    allItemsMap.set(tid, {
                        row: null, page: apiItem.page, fromApi: true, torrentId: tid,
                        mainTitle: apiItem.name, releaseName: apiItem.name,
                        movieTitle: parsed.movieTitle, movieYear: parsed.movieYear,
                        imdbId: apiItem.imdbId,
                        sizeGB: apiItem.sizeGB, is4K: is4kText(apiItem.name),
                        downloadUrl: apiItem.downloadUrl, chkBox: { checked: true }
                    });
                });
                nextPage = apiCrawlCursor.nextPage;
                crawlDone = !!(apiCrawlCursor.done && !isCheckingCancelled);
            } else if (!crawlDone) {
                log('🌐 [2/3] 全站拉取（从第 ' + nextPage + ' 页）...', 'INFO');
                var baseUrl = location.href.replace(/([?&])page=\d+/, '$1').replace(/[?&]$/, '');
                if (baseUrl.indexOf('?') === -1) baseUrl += '?';
                var p = nextPage;
                var finishedNaturally = false;
                while (!isCheckingCancelled) {
                    log('🌐 [网页] 正在获取第 ' + p + ' 页...', 'INFO');
                    var beforeSize = allItemsMap.size;
                    try {
                        var doc = await fetchDoc(baseUrl + (baseUrl.endsWith('?') ? '' : '&') + 'page=' + p);
                        var rows = $$('#torrenttable > tbody > tr, table.torrents > tbody > tr, tr.torrent-search--list__row', doc);
                        if (rows.length === 0) {
                            log('⏹️ 当前页无行数据，停止翻页。', 'INFO');
                            finishedNaturally = true;
                            break;
                        }
                        rows.forEach(function (row) {
                            var anchor = $('.torrentname a[href*="details.php"], a.torrent-search--list__name', row);
                            if (!anchor) return;
                            var mainTitle = (anchor.getAttribute('title') || anchor.textContent || '').trim();
                            var tid = (anchor.href.match(/id=(\d+)/) || anchor.href.match(/\/torrents\/(\d+)/) || ['', ''])[1];
                            if (!tid || allItemsMap.has(tid)) return;
                            var isRemux = RE.ENCODE.test(mainTitle);
                            var isDisc = RE.U3D_DISC.test(mainTitle) || (RE.DISC_MEDIA.test(mainTitle) && RE.DISC_CODEC.test(mainTitle));
                            if (isRemux || !isDisc) return;
                            var subInfo = extractCleanNpSubtitleInfo(row);
                            var sizeM = (row.textContent || '').match(/([\d.]+)\s*(GB|GiB|TB|TiB)/i);
                            var ptMeta = parseTitleMeta(mainTitle);
                            var imdbNode = $('a[href*="imdb.com/title/tt"]', row);
                            var dlNode = $('a[href*="download.php"], a[href*="/download/"]', row);
                            allItemsMap.set(tid, {
                                row: null, page: p, fromApi: false, torrentId: tid,
                                mainTitle: mainTitle, releaseName: mainTitle,
                                cnTitle: subInfo.cnTitle, regionBracket: subInfo.regionBracket,
                                movieTitle: ptMeta.movieTitle, movieYear: ptMeta.movieYear,
                                imdbId: normalizeImdbId(imdbNode ? imdbNode.href : ''),
                                sizeGB: sizeM ? parseSizeToGB(sizeM[0]) : 0, is4K: is4kText(mainTitle),
                                downloadUrl: dlNode ? dlNode.href : siteUrl(siteA, 'download', { id: tid }),
                                chkBox: { checked: true }
                            });
                        });
                        var afterSize = allItemsMap.size;
                        if (afterSize === beforeSize && p > 1) {
                            log('⏹️ 第 ' + p + ' 页没有发现新种子，判定已到底，停止翻页。', 'INFO');
                            finishedNaturally = true;
                            break;
                        }
                        if (p % 10 === 0) log('⏳ 已拉取 ' + p + ' 页，累计 ' + allItemsMap.size + ' 条有效原盘...', 'INFO');
                        p++;
                        saveBatchCheckpoint({ ctx: ctx, phase: 'crawl', nextPage: p, crawlDone: false, items: Array.from(allItemsMap.values()) });
                        if (isCheckingCancelled) break;
                        await new Promise(function (r) { setTimeout(r, 2000); });
                    } catch (e) {
                        log('⚠️ 拉取第 ' + p + ' 页失败: ' + e.message, 'WARN');
                        break;
                    }
                }
                nextPage = p;
                crawlDone = finishedNaturally && !isCheckingCancelled;
            }

            saveBatchCheckpoint({ ctx: ctx, phase: crawlDone ? 'check' : 'crawl', nextPage: nextPage, crawlDone: crawlDone, items: Array.from(allItemsMap.values()) });
            if (isCheckingCancelled && !crawlDone) {
                log('已暂停翻页。已保存 ' + allItemsMap.size + ' 条，下次从第 ' + nextPage + ' 页继续。词库和待发队列没有清空。', 'WARN');
                return;
            }

            auditedList = Array.from(allItemsMap.values());
            seedBatchProtection(auditedList);
            if (crawlDone) log('✅ 全站拉取完成，共 ' + auditedList.length + ' 条。开始批量查重...', 'SUCCESS');
            else log('名单在第 ' + nextPage + ' 页中断，先查已拿到的 ' + auditedList.length + ' 条。下次点击会接着翻页。', 'WARN');

            var bInfo = getSiteBInfo();
            var isApiFastMode = shouldSiteUseApi(bInfo);
            var stepDelay = isApiFastMode ? Math.min(config.delayMs, 1200) : config.delayMs;
            var plan = splitBatchByLibrary(auditedList, imdbLibrary, {
                bSiteHost: getCurrentBSiteHost(),
                now: Date.now(),
                freshMs: getLibraryFreshMs(),
                enabled: config.libraryEnabled !== false
            });
            var cleanCount = 0, dupeCount = 0;
            if (plan.skipped.length) {
                log('📚 词库秒过 ' + plan.skipped.length + ' 部，待查 ' + plan.pending.length + ' 部。失败过的条目会重试，不会按已查跳过。', 'INFO');
                for (var s = 0; s < plan.skipped.length; s++) {
                    var hit = plan.skipped[s];
                    var skippedDupe = await checkSingleImdb(hit.item, hit.item.row ? [hit.item.row] : [], { quiet: true, deferRender: true });
                    if (skippedDupe) dupeCount++; else cleanCount++;
                }
                renderQueueUI();
                updateLibraryBadge();
            }

            for (var m = 0; m < plan.pending.length; m++) {
                if (isCheckingCancelled) break;
                var pending = plan.pending[m];
                var item = pending.item;
                var cursor = plan.skipped.length + m + 1;
                log('[' + cursor + '/' + auditedList.length + '] 检索: ' + (item.cnTitle || item.movieTitle));
                var kind = 'ok';
                try {
                    var isDupe = await checkSingleImdb(item, item.row ? [item.row] : []);
                    var cached = imdbResultCache.get(pending.cacheKey);
                    if (cached && cached.isError) kind = String(cached.errorMsg || '').indexOf('429') !== -1 ? 'rateLimit' : 'error';
                    if (kind === 'ok') {
                        if (isDupe) dupeCount++; else cleanCount++;
                    }
                } catch (err) {
                    kind = String(err && err.message || '').indexOf('429') !== -1 ? 'rateLimit' : 'error';
                    log('检索异常: ' + err.message, 'ERROR');
                }
                if (m < plan.pending.length - 1 && !isCheckingCancelled) {
                    var delay = nextNetworkDelay(stepDelay, m + 1, kind);
                    if (kind !== 'ok') log('阶梯降速：下一条等待 ' + Math.round(delay / 1000) + ' 秒', 'WARN');
                    else if ((m + 1) % 15 === 0) log('☕ 批次保护：微歇 3 秒...', 'INFO');
                    await new Promise(function (r) { setTimeout(r, delay); });
                }
            }

            if (isCheckingCancelled) {
                log('已暂停查重。词库和待发队列已保留，下次会词库秒过已成功的条目，并从还没查完的部分继续。', 'WARN');
                return;
            }

            if (crawlDone) {
                clearBatchCheckpoint();
                log('🎉 全部完成！可发 ' + cleanCount + ' 部，冲突 ' + dupeCount + ' 部。', 'SUCCESS');
                alert('拉取/查重完成！\n\n可发新片: ' + cleanCount + ' 部\n已存在冲突: ' + dupeCount + ' 部\n\n结果已存入词库，当前页已挂载工具条。');
            } else {
                log('已查完当前拿到的名单。翻页进度还在，再次点击会从第 ' + nextPage + ' 页继续，并跳过词库里已成功的条目。', 'WARN');
            }
        } catch (err) {
            log('拉取/查重中断: ' + (err && err.message ? err.message : err), 'ERROR');
        } finally {
            btn.innerText = '🚀 拉取/查重';
            btn.classList.remove('pt-btn-stop');
            batchProtectedKeys = null;
        }
    });

    function applyHideMode(hide) {
        isHideMode = hide;
        GM_setValue('pt_hide_mode', hide);
        var tags = ['skip', 'limit', 'dupe', 'error'];
        var selector = tags.map(function (t) { return '[data-pt-tag="' + t + '"]'; }).join(', ');
        var rows = $$(selector);
        var btn = $('#pt-btn-hide');
        if (hide) {
            rows.forEach(function (row) { row.style.display = 'none'; });
            if (btn) {
                btn.innerText = '👁️ 显示全部';
                btn.style.background = '#fef3c7';
                btn.style.borderColor = '#fde68a';
                btn.style.color = '#92400e';
            }
        } else {
            rows.forEach(function (row) { row.style.display = ''; });
            if (btn) {
                btn.innerText = '👁️ 隐藏';
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.style.color = '';
            }
        }
    }

    bindAction('btn-hide', function () {
        applyHideMode(!isHideMode);
        log(isHideMode ? '已隐藏不可发布词条' : '已恢复显示全部', 'INFO');
    });

    function scheduleAutoRestore(delay) {
        if (restoreDebounceTimer) clearTimeout(restoreDebounceTimer);
        restoreDebounceTimer = setTimeout(autoRestoreState, delay || 800);
    }

    async function autoRestoreState() {
        if (!config.libraryEnabled) return;
        var btn = $('#pt-btn-pull-dupe');
        if (btn && btn.classList.contains('pt-btn-stop')) return;

        var rows = $$('#torrenttable > tbody > tr, table.torrents > tbody > tr, tr.torrent-search--list__row');
        if (rows.length === 0) return;

        var htmlHash = rows.map(function (r) { return (r.id || r.getAttribute('data-torrent-id') || '') + r.textContent.length; }).join(',');
        if (htmlHash === lastPageHtmlHash) return;
        lastPageHtmlHash = htmlHash;

        log('🔄 检测到列表页加载/翻页，正在静默恢复查重状态...', 'INFO');

        try {
            rows.forEach(function (r) { cleanRowTags(r); });

            auditedList = [];
            var siteA = getSiteAInfo();
            var curWebPage = getCurrentWebPageNumber();

            await (AUDIT_HANDLERS[currentSiteArch] || AUDIT_HANDLERS.np)(siteA, curWebPage, false, 1);

            if (auditedList.length > 0) log('✅ 页面恢复完成！检出 ' + auditedList.length + ' 项。', 'SUCCESS');
            else log('✅ 页面恢复完成！当前页无合格原盘。', 'SUCCESS');

            if (isHideMode) applyHideMode(true);
        } catch (e) {
            log('⚠️ 自动恢复异常: ' + e.message, 'WARN');
        }
    }

    (function (history) {
        var pushState = history.pushState;
        history.pushState = function () {
            var ret = pushState.apply(history, arguments);
            window.dispatchEvent(new Event('pt-locationchange'));
            return ret;
        };
    })(window.history);
    window.addEventListener('popstate', function () { window.dispatchEvent(new Event('pt-locationchange')); });
    window.addEventListener('pt-locationchange', function () { scheduleAutoRestore(1000); });

    var rowObserver = new MutationObserver(function (mutations) {
        var hasNewRows = mutations.some(function (m) {
            return m.addedNodes.length > 0 && Array.from(m.addedNodes).some(function (n) {
                return n.nodeName === 'TR' || (n.querySelector && n.querySelector('tr'));
            });
        });
        if (hasNewRows) scheduleAutoRestore(800);
    });

    function inspectBStationWebResults(doc, sourceItem, siteBType) {
        var matchResult = { hasUntouchedDupe: false, hasDiyOnly: false, hasEncodeOnly: false, matchedTitle: '', matchedSizeGB: 0, torrentCount: 0 };
        if (siteBType === 'np') {
            var trs = $$('#torrenttable tr, table.torrents tr', doc);
            for (var i = 0; i < trs.length; i++) {
                var tr = trs[i];
                if ($('td.colhead, th', tr)) continue;
                var fullText = (tr.textContent || '').trim();
                if (!fullText || fullText.indexOf('没有种子') !== -1 || fullText.indexOf('Nothing found') !== -1) continue;
                var titleA = $('.torrentname a[href*="details.php"], a[href*="details.php"]', tr);
                if (!titleA) continue;
                var titleText = (titleA.textContent || '').trim();
                matchResult.torrentCount++;
                var hasBd = !!$('img.c_bd, img[title*="BD Discs"], img[alt*="BD Discs"], img[src*="additional/bd.png"], a[href*="source2=1"]', tr);
                var hasUhd = !!$('img.c_4k, img[title*="UHD Discs"], img[alt*="UHD Discs"], img[src*="additional/4k.png"], a[href*="source1=1"]', tr);
                var hasEnc = !!$('img.c_enc, img[title*="Encode"], img[alt*="Encode"], img.c_remux, img[alt*="Remux"], img.c_webdl, img.c_hdtv', tr);
                var isEncText = RE.ENCODE.test(titleText);
                var isDiy = !!$('.chs_tag-diy, a[href*="tag_doityourself=yes"]', tr) || /\bDIY\b/i.test(fullText) || fullText.indexOf('新增按钮') !== -1;
                var isDiscByText = RE.DISC_SHORT.test(titleText) || (/\b(Blu-ray|BluRay)\b/i.test(titleText) && RE.DISC_CODEC.test(titleText));
                if ((hasBd || hasUhd || isDiscByText) && !hasEnc && !isEncText) {
                    var sizeGB = readRowSize(tr);
                    var isB4K = hasUhd || is4kText(titleText);
                    if (npDiscMatches(sourceItem, { is4K: isB4K, sizeGB: sizeGB })) {
                        if (isDiy) matchResult.hasDiyOnly = true;
                        else { matchResult.hasUntouchedDupe = true; matchResult.matchedTitle = titleText || '原盘'; matchResult.matchedSizeGB = sizeGB; return matchResult; }
                    }
                } else matchResult.hasEncodeOnly = true;
            }
        } else if (siteBType === 'unit3d') {
            var uRows = $$('tr.torrent-search--list__row, table.data-table tbody tr', doc);
            for (var k = 0; k < uRows.length; k++) {
                var uText = uRows[k].textContent || '';
                if (RE.U3D_DISC.test(uText) && !RE.ENCODE.test(uText)) {
                    var uSizeGB = readRowSize(uRows[k]);
                    if (looseDiscMatches(sourceItem, { is4K: is4kText(uText), sizeGB: uSizeGB }, 3)) {
                        matchResult.hasUntouchedDupe = true;
                        var nameA = $('a.torrent-search--list__name', uRows[k]);
                        matchResult.matchedTitle = (nameA ? nameA.textContent : 'Full Disc').trim();
                        matchResult.matchedSizeGB = uSizeGB;
                        return matchResult;
                    }
                }
            }
        } else if (siteBType === 'gz' && RE.GZ_DISC.test((doc.body ? doc.body.textContent : '') || '')) {
            matchResult.hasUntouchedDupe = true;
            matchResult.matchedTitle = 'Gazelle 原盘';
        }
        return matchResult;
    }

    async function queryUnit3dApiDupe(siteB, sourceItem) {
        checkApiQuotaOrThrow(siteB, 'unit3d');
        var imdbDigits = (sourceItem.imdbId || '').replace(/\D/g, '');
        var paramStr = imdbDigits ? ('imdbId=' + encodeURIComponent(imdbDigits)) : ('name=' + encodeURIComponent(sourceItem.movieTitle));
        var apiUrl = siteBase(siteB.url) + 'api/torrents/filter?' + paramStr;
        var json = null;
        try { json = await http(apiUrl, { responseType: 'json', headers: u3dHeaders(siteB.apiKey) }); }
        catch (err) { if (err.message === 'HTTP 429') RateLimiter.forceCooldown(siteB.url, 30); throw err; }
        var list = (json && Array.isArray(json.data)) ? json.data : [];
        var matchResult = { hasUntouchedDupe: false, hasDiyOnly: false, matchedTitle: '', matchedSizeGB: 0, torrentCount: list.length, verifyUrl: siteUrl(siteB, 'search', { imdbId: sourceItem.imdbId, kw: sourceItem.movieTitle }) };
        for (var i = 0; i < list.length; i++) {
            var attr = list[i].attributes || list[i];
            var tName = attr.name || '', tType = attr.type || '', tTypeId = String(attr.type_id || ''), tRes = attr.resolution || '', tSizeGB = parseSizeToGB(attr.size || 0);
            if ((tType === 'Full Disc' || tTypeId === '1') && !RE.ENCODE.test(tName + ' ' + tType)) {
                if (looseDiscMatches(sourceItem, { is4K: is4kText(tRes + ' ' + tName), sizeGB: tSizeGB }, 2.5)) {
                    if (/\b(DIY|Custom)\b/i.test(tName)) matchResult.hasDiyOnly = true;
                    else { matchResult.hasUntouchedDupe = true; matchResult.matchedTitle = tName; matchResult.matchedSizeGB = tSizeGB; return matchResult; }
                }
            }
        }
        return matchResult;
    }

    async function querySiteBDupeHybridWithBackoff(siteB, sourceItem) {
        if (shouldSiteUseApi(siteB) && siteB.type === 'unit3d') {
            try { return await queryUnit3dApiDupe(siteB, sourceItem); }
            catch (apiErr) { log('⚠️ [' + siteB.name + '] ' + apiErr.message + '，已自动转入【网页模式】...', 'WARN'); }
        }
        var targetUrl = siteUrl(siteB, 'search', { imdbId: sourceItem.imdbId, kw: sourceItem.movieTitle });
        log('🌐 [B站 网页查重] ' + (sourceItem.imdbId || sourceItem.movieTitle) + ' -> ' + siteB.name);
        var doc = null;
        try { doc = await fetchDoc(targetUrl); }
        catch (err) {
            if (err.message && err.message.indexOf('429') !== -1) {
                log('⚠️ 遇到网页 429，自愈退避 12 秒...', 'WARN');
                await new Promise(function (r) { setTimeout(r, 12000); });
                doc = await fetchDoc(targetUrl);
            } else throw err;
        }
        var analysis = inspectBStationWebResults(doc, sourceItem, siteB.type);
        analysis.verifyUrl = targetUrl;
        return analysis;
    }

    function renderQueueUI() {
        var queueBox = $('#pt-queue-box'), countEl = $('#pt-queue-count');
        if (!queueBox || !countEl) return;
        countEl.innerText = pendingQueue.length;
        if (pendingQueue.length === 0) {
            queueBox.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:8px;">暂无待发项，请先执行查重</div>';
            return;
        }
        queueBox.innerHTML = '';
        pendingQueue.forEach(function (item, index) {
            var itemDiv = el('div', 'pt-queue-item');
            var titleSpan = el('span', '', (index + 1) + '. ' + (item.cnTitle || item.movieTitle) + ' (' + item.movieYear + ')', 'max-width:175px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;');
            titleSpan.title = item.mainTitle;
            var btnWrap = el('div', '', '', 'display:flex; gap:4px;');
            QUEUE_BTN_DEFS.forEach(function (def) {
                var btn = el('button', def.cls, def.text, def.css, def.act);
                btn._ptItem = item;
                btn._ptQueueRow = itemDiv;
                btnWrap.appendChild(btn);
            });
            itemDiv.append(titleSpan, btnWrap);
            queueBox.appendChild(itemDiv);
        });
    }

    function getCurrentBSiteHost() { return extractHostKey(getSiteBInfo().url); }
    function getLibraryKey(cacheKey, bSiteHost) { return libraryStorageKey(bSiteHost || getCurrentBSiteHost(), cacheKey); }
    function getLibraryFreshMs() { return Math.max(1, config.libraryFreshHours || 24) * 60 * 60 * 1000; }
    function readLibraryEntry(cacheKey) { if (!config.libraryEnabled) return null; return imdbLibrary[getLibraryKey(cacheKey)] || null; }

    function batchContext() {
        return {
            siteAHost: extractHostKey(location.hostname),
            siteBHost: getCurrentBSiteHost(),
            listKey: listingKey(location.href)
        };
    }

    function saveBatchCheckpoint(state) {
        var ctx = state.ctx || batchContext();
        GM_setValue(CHECKPOINT_STORAGE_KEY, {
            v: 1,
            siteAHost: ctx.siteAHost,
            siteBHost: ctx.siteBHost,
            listKey: ctx.listKey,
            savedAt: Date.now(),
            phase: state.phase || 'crawl',
            nextPage: state.nextPage || 1,
            crawlDone: !!state.crawlDone,
            items: (state.items || []).map(serializeItem)
        });
    }

    function loadBatchCheckpoint() {
        var cp = GM_getValue(CHECKPOINT_STORAGE_KEY, null);
        if (!isCheckpointUsable(cp, batchContext(), Date.now(), CHECKPOINT_MAX_AGE_MS)) return null;
        return cp;
    }

    function clearBatchCheckpoint() {
        GM_setValue(CHECKPOINT_STORAGE_KEY, null);
    }

    function seedBatchProtection(items) {
        batchProtectedKeys = Object.create(null);
        var host = getCurrentBSiteHost();
        (items || []).forEach(function (item) {
            batchProtectedKeys[libraryStorageKey(host, buildImdbCacheKey(item))] = true;
        });
    }

    function libraryProtectSet() {
        var protect = Object.create(null);
        if (batchProtectedKeys) {
            Object.keys(batchProtectedKeys).forEach(function (key) { protect[key] = true; });
        }
        var cp = GM_getValue(CHECKPOINT_STORAGE_KEY, null);
        if (isCheckpointRecord(cp, Date.now(), CHECKPOINT_MAX_AGE_MS)) {
            (cp.items || []).forEach(function (item) {
                protect[libraryStorageKey(cp.siteBHost, buildImdbCacheKey(item))] = true;
            });
        }
        return protect;
    }

    function rememberBatchItem(map, item) {
        var id = itemIdentity(item);
        if (!id) return;
        var prev = map.get(id);
        if (!prev) map.set(id, item);
        else {
            var merged = mergeBatchItem(prev, item);
            copyRestoredImdbId(item, merged);
            map.set(id, merged);
        }
    }

    function writeLibraryEntry(cacheKey, patch) {
        if (!config.libraryEnabled) return;
        var bHost = getCurrentBSiteHost();
        var k = getLibraryKey(cacheKey, bHost);
        var existing = imdbLibrary[k] || {};
        imdbLibrary[k] = Object.assign({}, existing, patch, { cacheKey: cacheKey, bSiteHost: bHost, lastCheck: Date.now() });
        var protect = libraryProtectSet();
        protect[k] = true;
        if (batchProtectedKeys) batchProtectedKeys[k] = true;
        trimLibrary(imdbLibrary, Math.max(10, config.libraryMaxEntries || 500), protect);
        GM_setValue('pt_imdb_library', imdbLibrary);
    }

    function getLibraryStats() {
        var bHost = getCurrentBSiteHost();
        var prefix = bHost + '::';
        var cnt = 0;
        Object.keys(imdbLibrary).forEach(function (k) { if (k.indexOf(prefix) === 0) cnt++; });
        return { total: Object.keys(imdbLibrary).length, currentBSite: cnt, bSiteHost: bHost };
    }

    function clearLibraryForCurrentBSite() {
        var bHost = getCurrentBSiteHost();
        var prefix = bHost + '::';
        Object.keys(imdbLibrary).forEach(function (k) { if (k.indexOf(prefix) === 0) delete imdbLibrary[k]; });
        GM_setValue('pt_imdb_library', imdbLibrary);
        imdbResultCache.clear();
    }

    function listLibraryForCurrentBSite() {
        var bHost = getCurrentBSiteHost();
        var prefix = bHost + '::';
        var arr = [];
        Object.keys(imdbLibrary).forEach(function (k) {
            if (k.indexOf(prefix) !== 0) return;
            var e = imdbLibrary[k];
            var result = e.lastResult || {};
            var vKey = result.isError ? 'ERROR' : (result.hasUntouchedDupe ? 'DUPE' : (result.hasDiyOnly ? 'DIY_PASS' : 'CLEAN'));
            arr.push({
                cacheKey: e.cacheKey || k.substring(prefix.length),
                movieTitle: e.movieTitle || '', movieYear: e.movieYear || '', cnTitle: e.cnTitle || '',
                checkCount: e.checkCount || 0, ageHours: Math.floor((Date.now() - (e.lastCheck || 0)) / 3600000),
                vKey: vKey, matchedSizeGB: result.matchedSizeGB || 0,
                forwardedAt: e.forwardedAt || 0, forwardedTo: e.forwardedTo || ''
            });
        });
        arr.sort(function (a, b) { return a.ageHours - b.ageHours; });
        return arr;
    }

    function updateLibraryBadge() {
        var el2 = $('#pt-lib-badge');
        if (!el2) return;
        var stats = getLibraryStats();
        el2.innerText = '📚 词库: ' + stats.currentBSite + ' 部 (' + stats.bSiteHost + ')';
        el2.title = '当前 B 站 [' + stats.bSiteHost + '] 有 ' + stats.currentBSite + ' 条；全局 ' + stats.total + ' 条';
    }

    async function checkSingleImdb(sourceItem, relatedNodes, options) {
        options = options || {};
        var forceRefresh = !!options.forceRefresh;
        var cacheKey = buildImdbCacheKey(sourceItem);
        var libEntry = readLibraryEntry(cacheKey);
        var fromLibrary = false, result = null;

        if (!forceRefresh && imdbResultCache.has(cacheKey)) {
            result = imdbResultCache.get(cacheKey);
            fromLibrary = !!result._fromLibrary;
        } else if (!forceRefresh && libEntry && libEntry.lastResult && !libEntry.lastResult.isError) {
            var age = Date.now() - (libEntry.lastCheck || 0);
            if (isFreshLibraryHit(libEntry, Date.now(), getLibraryFreshMs())) {
                result = Object.assign({}, libEntry.lastResult, { _fromLibrary: true, _libraryAge: age });
                if (!result.verifyUrl) result.verifyUrl = siteUrl(getSiteBInfo(), 'search', { imdbId: sourceItem.imdbId, kw: sourceItem.movieTitle });
                fromLibrary = true;
                if (!options.quiet) log('📚 [词库命中] ' + (sourceItem.cnTitle || sourceItem.movieTitle) + ' (' + Math.floor(age / 3600000) + 'h 前查重)', 'INFO');
            } else if (!options.quiet) {
                log('📚 [词库过期] ' + (sourceItem.cnTitle || sourceItem.movieTitle) + '，重新查询...', 'INFO');
            }
        }

        if (!result) {
            try {
                result = await querySiteBDupeHybridWithBackoff(getSiteBInfo(), sourceItem);
                writeLibraryEntry(cacheKey, {
                    imdbId: normalizeImdbId(sourceItem.imdbId) || '',
                    movieTitle: sourceItem.movieTitle || '', movieYear: sourceItem.movieYear || '',
                    cnTitle: sourceItem.cnTitle || '',
                    lastResult: {
                        hasUntouchedDupe: !!result.hasUntouchedDupe, hasDiyOnly: !!result.hasDiyOnly,
                        hasEncodeOnly: !!result.hasEncodeOnly, matchedTitle: result.matchedTitle || '',
                        matchedSizeGB: result.matchedSizeGB || 0, torrentCount: result.torrentCount || 0,
                        verifyUrl: result.verifyUrl || '', isError: false, errorMsg: ''
                    },
                    checkCount: (libEntry && libEntry.checkCount || 0) + 1
                });
            } catch (err) {
                result = { isError: true, errorMsg: err.message, verifyUrl: '#' };
                writeLibraryEntry(cacheKey, {
                    imdbId: normalizeImdbId(sourceItem.imdbId) || '',
                    movieTitle: sourceItem.movieTitle || '', movieYear: sourceItem.movieYear || '',
                    cnTitle: sourceItem.cnTitle || '',
                    lastResult: { isError: true, errorMsg: err.message, verifyUrl: '#' },
                    checkCount: (libEntry && libEntry.checkCount || 0) + 1
                });
            }
        }

        imdbResultCache.set(cacheKey, result);
        var vKey = result.isError ? 'ERROR' : (result.hasUntouchedDupe ? 'DUPE' : (result.hasDiyOnly ? 'DIY_PASS' : 'CLEAN'));
        var vDef = BADGE_DICT[vKey];
        var badgeTxt = (fromLibrary ? '📚 ' : '') + vDef.text;

        if (vKey === 'ERROR') { badgeTxt += result.errorMsg; if (!options.quiet) log(badgeTxt, 'ERROR'); }
        else if (vKey === 'DUPE') {
            badgeTxt += ' (' + (result.matchedSizeGB ? result.matchedSizeGB.toFixed(1) + 'G' : '已存') + ') [复核]';
            if (!options.quiet) log('[冲突] B站已有原盘: ' + result.matchedTitle + (fromLibrary ? ' [词库]' : ''), 'WARN');
        } else {
            if (!options.quiet) {
                if (vKey === 'DIY_PASS') log('[可发] B站仅DIY: ' + sourceItem.movieTitle + (fromLibrary ? ' [词库]' : ''), 'INFO');
                else log('[可发] B站未收录: ' + (sourceItem.cnTitle || sourceItem.movieTitle) + (fromLibrary ? ' [词库]' : ''), 'SUCCESS');
            }
            if (!pendingQueue.some(function (x) { return buildImdbCacheKey(x) === cacheKey; })) {
                pendingQueue.push(sourceItem);
                GM_setValue('pt_pending_queue', pendingQueue);
            }
        }

        (relatedNodes || []).forEach(function (node) { renderDupeBadge(node, sourceItem, result, fromLibrary); });
        if (!options.deferRender) {
            renderQueueUI();
            updateLibraryBadge();
        }
        return result.hasUntouchedDupe;
    }

    bindAction('row-check', async function (btn, ev) {
        if (!btn._ptItem) return;
        var forceRefresh = !!(ev && ev.shiftKey);
        btn.innerText = forceRefresh ? '强制查中...' : '查询中...';
        try {
            await checkSingleImdb(btn._ptItem, [btn._ptRow], { forceRefresh: forceRefresh });
            btn.innerText = forceRefresh ? '已强查' : '已查';
        } catch (err) {
            log('❌ 查重失败: ' + (err && err.message ? err.message : err), 'ERROR');
            btn.innerText = '重试';
        }
    });

    bindAction('queue-clear', function () {
        pendingQueue = [];
        GM_setValue('pt_pending_queue', pendingQueue);
        renderQueueUI();
        log('待发清单已清空。', 'INFO');
    });

    function uint8ArrayToBinaryString(u8Arr) {
        var chunks = [];
        for (var i = 0; i < u8Arr.length; i += 8192) {
            chunks.push(String.fromCharCode.apply(null, u8Arr.subarray(i, i + 8192)));
        }
        return chunks.join('');
    }
    function isValidTorrentBytes(u8Arr) {
        if (!u8Arr || u8Arr.length < 20 || u8Arr[0] !== 0x64) return false;
        var headStr = String.fromCharCode.apply(null, u8Arr.subarray(0, Math.min(250, u8Arr.length)));
        return (headStr.indexOf('announce') !== -1 || headStr.indexOf('4:info') !== -1 || headStr.indexOf('nodes') !== -1);
    }

    async function requestTorrentBufferOnce(url, method, refererUrl) {
        var originUrl = '';
        try { originUrl = new URL(url).origin; } catch (e) { originUrl = location.origin; }
        var headers = { 'Referer': refererUrl || (originUrl + '/'), 'Origin': originUrl };
        if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded';
        var res = await http(url, { method: method || 'GET', responseType: 'arraybuffer', headers: headers, timeout: 15000, rawResponse: true });
        if (res.status !== 200 || !res.response) throw new Error(method + ' HTTP ' + res.status);
        var u8 = new Uint8Array(res.response);
        if (!isValidTorrentBytes(u8)) throw new Error(method + ' 返回非种子流');
        return u8;
    }

    async function fetchTorrentRawBase64(downloadUrl, refererUrl) {
        if (!downloadUrl) throw new Error('无下载链接');
        var methodsOrder = (/hdsky\.me/i.test(downloadUrl) && downloadUrl.indexOf('passkey=') === -1) ? ['POST', 'GET'] : ['GET', 'POST'];
        var lastErr = null;
        for (var i = 0; i < methodsOrder.length; i++) {
            try {
                var u8 = await requestTorrentBufferOnce(downloadUrl, methodsOrder[i], refererUrl);
                return btoa(uint8ArrayToBinaryString(u8));
            } catch (err) { lastErr = err; }
        }
        throw lastErr || new Error('拉取种子失败');
    }

    function buildCleanedTorrentFile(base64Raw, fallbackFileName, targetAnnounceUrl, targetSiteCode) {
        var r = atob(base64Raw), extractedInternalName = '';
        var infoIdx = r.indexOf('4:info');
        if (infoIdx !== -1) {
            var scope = r.substring(infoIdx);
            var re = /4:name(\d+):/g, lastMatch = null, m;
            while ((m = re.exec(scope)) !== null) lastMatch = m;
            if (lastMatch) {
                try {
                    var len = parseInt(lastMatch[1], 10);
                    var startByte = infoIdx + lastMatch.index + ('4:name' + lastMatch[1] + ':').length;
                    extractedInternalName = decodeURIComponent(escape(r.substring(startByte, startByte + len)));
                } catch (e) {}
            }
        }
        if (targetAnnounceUrl) {
            var infoStart = r.indexOf('4:info'), privIdx = r.lastIndexOf('7:privatei');
            if (infoStart !== -1 && privIdx > infoStart) {
                try {
                    var newTorrent = 'd8:announce' + targetAnnounceUrl.length + ':' + targetAnnounceUrl;
                    var dateMatch = r.substring(0, infoStart).match(/13:creation datei(\d+)e/);
                    if (dateMatch) newTorrent += '13:creation datei' + (parseInt(dateMatch[1], 10) + 600 + Math.floor(Math.random() * 600)) + 'e';
                    newTorrent += '8:encoding5:UTF-8' + r.substring(infoStart, privIdx) + '7:privatei1e';
                    var srcCode = (targetSiteCode || 'PTER').toUpperCase();
                    r = newTorrent + '6:source' + srcCode.length + ':' + srcCode + 'ee';
                } catch (washErr) {}
            }
        }
        var bytes = new Uint8Array(r.length);
        for (var i = 0; i < r.length; i++) bytes[i] = r.charCodeAt(i) & 0xff;
        var WinBlob = rootWin.Blob || window.Blob, WinFile = rootWin.File || window.File;
        var blob = new WinBlob([bytes], { type: 'application/x-bittorrent' });
        var finalFileName = (extractedInternalName || fallbackFileName || 'movie').replace(/\.torrent$/i, '').replace(/[\/\\:*?"<>|]/g, '.').replace(/\s+/g, '.').replace(/\.+/g, '.').trim() + '.torrent';
        return { file: new WinFile([blob], finalFileName, { type: 'application/x-bittorrent' }), blob: blob, filename: finalFileName, sizeKB: (bytes.length / 1024).toFixed(1) };
    }

    async function fetchUnit3dTorrentDetailByApi(siteA, torrentId) {
        if (!shouldSiteUseApi(siteA) || !siteA.apiKey || !torrentId) throw new Error('无 API Key 或种子ID');
        checkApiQuotaOrThrow(siteA, 'unit3d');
        var url = siteBase(siteA.url) + 'api/torrents/' + encodeURIComponent(torrentId);
        try {
            var data = await http(url, { responseType: 'json', timeout: 10000, headers: u3dHeaders(siteA.apiKey) });
            return (data && data.data && data.data.attributes) ? data.data.attributes : (data ? data.attributes || data : null);
        } catch (err) {
            if (err.message === 'HTTP 429') RateLimiter.forceCooldown(siteA.url, 30);
            throw err;
        }
    }

    function extractRealDownloadUrlFromDetailDoc(detailDoc, baseUrl, fallbackTid) {
        var passkeyInputs = $$('input[value*="download.php"], input[value*="passkey="]', detailDoc);
        for (var i = 0; i < passkeyInputs.length; i++) {
            var v = (passkeyInputs[i].value || passkeyInputs[i].getAttribute('value') || '').trim();
            if (/download\.php\?/i.test(v)) {
                try { return new URL(v, baseUrl).href.replace(/&https=1\b/i, ''); } catch (e) { return v; }
            }
        }
        var dlLinks = $$('a[href*="download.php"], a[href*="/torrents/download/"], a[href*="download/torrent"]', detailDoc);
        for (var j = 0; j < dlLinks.length; j++) {
            var href = dlLinks[j].getAttribute('href') || '';
            if (href && !/downhash/i.test(href)) {
                try { return new URL(href, baseUrl).href.replace(/&https=1\b/i, ''); } catch (e) { return href; }
            }
        }
        var dlForm = $('form[action*="download.php"]', detailDoc);
        if (dlForm && dlForm.getAttribute('action')) {
            try { return new URL(dlForm.getAttribute('action'), baseUrl).href; } catch (e) { return dlForm.getAttribute('action'); }
        }
        return fallbackTid ? siteUrl({ url: baseUrl, type: 'np' }, 'download', { id: fallbackTid }) : '';
    }

    async function fetchFullSourceDetails(itemData) {
        var result = {
            realDownloadUrl: itemData.downloadUrl || '',
            sourceDetailUrl: '',
            detailSubTitle: '',
            bdinfo: itemData.bdinfo || '',
            imdbId: itemData.imdbId || '',
            doubanUrl: itemData.doubanUrl || '',
            synopsisBbcode: '',
            rawDescription: '',
            detailDoc: null
        };
        var targetRow = itemData.row;
        var tid = itemData.torrentId || (targetRow && targetRow.dataset && targetRow.dataset.ptTid) || ((targetRow && targetRow.id && targetRow.id.match(/\d+/)) ? targetRow.id.match(/\d+/)[0] : '');
        var siteA = getSiteAInfo();

        if (shouldSiteUseApi(siteA) && tid && siteA.type === 'unit3d') {
            log('⚡ [A站 U3D API] 正在后台拉取种子 #' + tid + ' 的完整详情...', 'INFO');
            try {
                var attr = await fetchUnit3dTorrentDetailByApi(siteA, tid);
                if (attr) {
                    var rawMi = attr.bd_info || attr.bdinfo || attr.media_info || attr.mediainfo || '';
                    if (rawMi) result.bdinfo = rawMi.trim();
                    if (!result.imdbId && attr.imdb_id) result.imdbId = normalizeImdbId(attr.imdb_id);
                    if (attr.download_link) result.realDownloadUrl = attr.download_link;
                    if (attr.description) {
                        result.rawDescription = String(attr.description);
                        if (result.rawDescription.indexOf('◎') !== -1) {
                            result.synopsisBbcode = result.rawDescription;
                        }
                    }
                }
            } catch (e) {}
        }

        if (tid && (siteA.type === 'np' || (siteA.type === 'unit3d' && (!result.bdinfo || !result.detailDoc)) || siteA.type === 'gz')) {
            try {
                var detailWebUrl = siteUrl(siteA, 'details', { id: tid });
                result.sourceDetailUrl = detailWebUrl;
                log('🌐 [网页穿透] 后台读取详情页 (' + detailWebUrl + ')...', 'INFO');
                var detailDoc = await fetchDoc(detailWebUrl);
                result.detailDoc = detailDoc;
                var fullHtml = detailDoc.body ? detailDoc.body.innerHTML : '';
                if (siteA.type === 'unit3d' && !result.rawDescription) {
                    result.rawDescription = unit3dDescriptionFromHtml(detailDoc.documentElement ? detailDoc.documentElement.innerHTML : fullHtml);
                }
                var extractedDl = extractRealDownloadUrlFromDetailDoc(detailDoc, siteA.url, tid);
                if (extractedDl) { result.realDownloadUrl = extractedDl; itemData.downloadUrl = extractedDl; }
                if (siteA.type === 'np') {
                    var subTr = $$('tr', detailDoc).find(function (tr) {
                        var h = $('td.rowhead, td:first-child', tr);
                        return h && /^(副标题|副標題|Subtitle|SubTitle)$/i.test((h.textContent || '').trim());
                    });
                    if (subTr) {
                        var subTd = $('td.rowfollow, td:nth-child(2)', subTr);
                        result.detailSubTitle = (subTd ? subTd.textContent : '').trim();
                    }
                }
                if (!result.imdbId) {
                    var mImdb = fullHtml.match(/imdb\.com\/title\/(tt\d{7,9})/i);
                    if (mImdb) result.imdbId = normalizeImdbId(mImdb[1]);
                }
                if (!result.doubanUrl) {
                    var mDouban = fullHtml.match(/https?:\/\/movie\.douban\.com\/subject\/\d+\/?/i);
                    if (mDouban) result.doubanUrl = mDouban[0];
                }
                if (!result.bdinfo) {
                    var foundBd = findBdinfo(detailDoc);
                    if (foundBd) result.bdinfo = foundBd;
                }
                var kdescr = $('#kdescr, .bbcode-rendered, .torrent-description, .panel__body', detailDoc);
                if (kdescr) {
                    var kClone = kdescr.cloneNode(true);
                    $$('br', kClone).forEach(function (br) { br.replaceWith('\n'); });
                    $$('p, div, tr', kClone).forEach(function (blk) { blk.append('\n'); });
                    var kText = kClone.textContent || '';
                    var synStart = kText.search(/◎\s*译\s*名|◎\s*片\s*名/);
                    if (synStart !== -1) {
                        var synPart = kText.substring(synStart);
                        var synEnd = synPart.search(/DISC INFO:|Disc Title:|Disc Label:|PLAYLIST REPORT:|\[quote\]|◎\s*截\s*图|Screenshots|引用/i);
                        if (synEnd !== -1) synPart = synPart.substring(0, synEnd);
                        result.synopsisBbcode = synPart.replace(/\n{3,}/g, '\n\n').trim();
                    }
                }
            } catch (webErr) { log('⚠️ [网页穿透] 详情页读取异常: ' + webErr.message, 'WARN'); }
        }
        return result;
    }

    async function ensureItemTorrentBase64(itemData) {
        if (itemData.torrentBase64) return itemData.torrentBase64;
        var siteA = getSiteAInfo(), tid = itemData.torrentId || '';
        var detailRefUrl = tid ? siteUrl(siteA, 'details', { id: tid }) : location.href;
        if (itemData.downloadUrl) {
            try {
                var b64 = await fetchTorrentRawBase64(itemData.downloadUrl, detailRefUrl);
                itemData.torrentBase64 = b64;
                return b64;
            } catch (firstErr) {
                if (siteA.type === 'np' && tid) {
                    var detailDoc = await fetchDoc(detailRefUrl);
                    var realUrl = extractRealDownloadUrlFromDetailDoc(detailDoc, siteA.url, tid);
                    if (realUrl) {
                        itemData.downloadUrl = realUrl;
                        var b64Retry = await fetchTorrentRawBase64(realUrl, detailRefUrl);
                        itemData.torrentBase64 = b64Retry;
                        return b64Retry;
                    }
                }
                throw firstErr;
            }
        }
        throw new Error('未能获取到有效的种子下载链接');
    }

    function renderToPreviewBoxes(bdObj, shots, synopsisText, extraCtx) {
        var subTitleText = buildSubtitle(bdObj, synopsisText || '', config, extraCtx);
        var descText = buildAll(bdObj, shots, synopsisText || '', config);
        var subEl = $('#pt-edit-sub'), descEl = $('#pt-edit-desc');
        if (subEl) subEl.value = subTitleText;
        if (descEl) descEl.value = descText;
        if (config.autoCopy && descText) {
            copyTextToClipboard(descText, true);
        }
    }

    async function preparePreview(itemData) {
        log('🔍 正在获取详情并提取 BDInfo / 截图 / 豆瓣简介...', 'INFO');
        if ($('#pt-edit-sub')) $('#pt-edit-sub').value = '加载中...';
        if ($('#pt-edit-desc')) $('#pt-edit-desc').value = '加载中...';

        var body = $('#pt-panel-body');
        if (body) body.scrollTop = 0;

        try {
            var fullDetails = await fetchFullSourceDetails(itemData);
            var movieName = itemData.movieTitle;
            if (!movieName) {
                var pageTitleMatch = document.title.match(/^(.+?)\s*[\[(](\d{4})[\])]/i);
                movieName = pageTitleMatch ? pageTitleMatch[1].trim() : document.title.split('::')[0].split('-')[0].trim();
            }

            var bdObj = parseBd(fullDetails.bdinfo || '', config.roundFps);
            if (!bdObj.label && !bdObj.title) {
                bdObj.label = itemData.releaseName || movieName;
            }
            if (!bdObj.length) {
                bdObj.length = '0:00:00';
            }

            var shots = collectShots(config.maxShots, fullDetails.detailDoc || document, fullDetails.rawDescription);

            var extraCtx = {
                cnTitle: itemData.cnTitle || '',
                movieTitle: movieName,
                releaseName: itemData.releaseName || itemData.mainTitle || '',
                mainTitle: itemData.mainTitle || '',
                regionBracket: itemData.regionBracket || '',
                detailSubTitle: fullDetails.detailSubTitle || '',
                detailDoc: fullDetails.detailDoc || document
            };

            window._ptCurrentPendingItem = {
                item: itemData,
                fullDetails: fullDetails,
                rawBdinfo: fullDetails.bdinfo || '',
                bdObj: bdObj,
                shots: shots,
                extraCtx: extraCtx
            };

            renderToPreviewBoxes(bdObj, shots, fullDetails.synopsisBbcode || '', extraCtx);
            log('✅ 基础数据提取成功（截图 ' + shots.length + ' 张）' + (config.autoCopy ? '｜已自动复制简介' : ''), 'SUCCESS');

            var manualImdbVal = ($('#pt-manual-imdb') && $('#pt-manual-imdb').value.trim()) || '';
            var tt = normalizeImdbId(manualImdbVal || itemData.imdbId || fullDetails.imdbId);
            if (config.autoImdb && tt) {
                log('🌐 已在后台打开豆瓣取词页 (' + tt + ')，等待回传...', 'INFO');
                requestDoubanByTab(tt, function (doubanText) {
                    if (window._ptCurrentPendingItem) {
                        window._ptCurrentPendingItem.fullDetails.synopsisBbcode = doubanText;
                    }
                    renderToPreviewBoxes(bdObj, shots, doubanText, extraCtx);
                    log('✅ 豆瓣简介已回传并置顶更新' + (config.autoCopy ? '｜已自动复制' : ''), 'SUCCESS');
                });
            } else if (!tt) {
                log('⚠️ 未找到 IMDb ID，可在上方「🛠️ 手动 IMDb」中填入后点重新生成。', 'WARN');
            }
        } catch (err) {
            log('❌ 提取数据失败: ' + err.message, 'ERROR');
            if ($('#pt-edit-sub')) $('#pt-edit-sub').value = '';
            if ($('#pt-edit-desc')) $('#pt-edit-desc').value = '';
        }
    }

    function extractCurrentDetailPageDirect() {
        var rawBd = ($('#pt-manual-bd') && $('#pt-manual-bd').value.trim()) || findBdinfo(document);
        if (!rawBd) {
            log('⚠️ 当前页未找到 BDInfo，请展开折叠区或在「🛠️ 手动粘贴 BDInfo」中粘贴', 'WARN');
            return false;
        }
        var bdObj = parseBd(rawBd, config.roundFps);
        if ((!bdObj.label && !bdObj.title) || !bdObj.length) {
            log('⚠️ BDInfo 不完整（缺少 Disc Title/Label 或 Length）', 'WARN');
            return false;
        }

        var pageBbcode = (currentSiteArch === 'unit3d' && document.documentElement) ? unit3dDescriptionFromHtml(document.documentElement.innerHTML) : '';
        var shots = collectShots(config.maxShots, document, pageBbcode);
        var h1Node = $('h1');
        var rawRelease = (h1Node ? h1Node.textContent.trim() : '') || bdObj.label || bdObj.title || document.title;
        var tidMatch = location.href.match(/(?:id=|\/torrents\/)(\d+)/i);
        var tid = tidMatch ? tidMatch[1] : '';
        var siteA = getSiteAInfo();
        var dlUrl = extractRealDownloadUrlFromDetailDoc(document, siteA.url, tid);
        var tt = findPageImdb(document);
        var sizeM = (document.body ? document.body.innerText : '').match(/([\d.]+)\s*(GB|GiB|TB|TiB)/i);

        var itemData = {
            row: null,
            page: 1,
            fromApi: false,
            torrentId: tid,
            mainTitle: rawRelease,
            releaseName: rawRelease,
            movieTitle: nameFromLabel(bdObj.label || rawRelease),
            imdbId: tt,
            bdinfo: rawBd,
            sizeGB: sizeM ? parseSizeToGB(sizeM[0]) : 0,
            is4K: isDisc4K(bdObj) || is4kText(rawRelease),
            downloadUrl: dlUrl
        };

        var extraCtx = {
            movieTitle: itemData.movieTitle,
            releaseName: rawRelease,
            mainTitle: rawRelease,
            detailDoc: document
        };

        var existingDesc = ($('#pt-edit-desc') && $('#pt-edit-desc').value) || '';
        var existingIntro = (existingDesc.indexOf('◎') === 0 && existingDesc.indexOf('[img]') > 0) ? existingDesc.slice(0, existingDesc.indexOf('[img]')).trim() : '';

        window._ptCurrentPendingItem = {
            item: itemData,
            fullDetails: {
                realDownloadUrl: dlUrl,
                sourceDetailUrl: location.href,
                detailSubTitle: '',
                bdinfo: rawBd,
                imdbId: tt,
                doubanUrl: '',
                synopsisBbcode: existingIntro,
                detailDoc: document
            },
            rawBdinfo: rawBd,
            bdObj: bdObj,
            shots: shots,
            extraCtx: extraCtx
        };

        renderToPreviewBoxes(bdObj, shots, existingIntro, extraCtx);
        log('✅ 已提取当前页 BDInfo 与截图 (' + shots.length + ' 张)' + (config.autoCopy ? '｜已复制' : ''), 'SUCCESS');

        if (config.autoImdb && tt) {
            log('🌐 已打开豆瓣取词页（后台），正在获取 ' + tt + ' 中…', 'INFO');
            requestDoubanByTab(tt, function (doubanText) {
                var latestBd = parseBd(($('#pt-manual-bd') && $('#pt-manual-bd').value.trim()) || findBdinfo(document) || rawBd, config.roundFps);
                var useBd = (latestBd.label || latestBd.title) ? latestBd : bdObj;
                if (window._ptCurrentPendingItem) {
                    window._ptCurrentPendingItem.fullDetails.synopsisBbcode = doubanText;
                }
                renderToPreviewBoxes(useBd, shots, doubanText, extraCtx);
                log('✅ 取词页取回并置顶' + (config.autoCopy ? '｜已自动复制' : ''), 'SUCCESS');
            });
        }
        return true;
    }

    window.addEventListener('focus', function () {
        var ho = readHandoffData(600000);
        if (!ho) return;
        var pageTt = findPageImdb(document) || activeDoubanTt;
        if (pageTt && ho.tt && ho.tt.toLowerCase() !== pageTt.toLowerCase()) return;
        if (doubanPollingTimer) {
            clearInterval(doubanPollingTimer);
            doubanPollingTimer = null;
        }
        clearHandoffData();
        if (window._ptCurrentPendingItem) {
            var p = window._ptCurrentPendingItem;
            p.fullDetails.synopsisBbcode = ho.text;
            renderToPreviewBoxes(p.bdObj, p.shots, ho.text, p.extraCtx);
            log('✅ 窗口唤醒：已接收取词页结果' + (config.autoCopy ? '｜已复制' : ''), 'SUCCESS');
        }
    });

    bindAction('page-extract', function () {
        extractCurrentDetailPageDirect();
    });

    bindAction('manual-gen', function () {
        var m = ($('#pt-manual-bd') && $('#pt-manual-bd').value.trim()) || '';
        if (!m) {
            log('⚠️ 请先在手动框中粘贴 BDInfo', 'WARN');
            return;
        }
        var d = parseBd(m, config.roundFps);
        if (!d.label && !d.title) {
            log('⚠️ 未识别到 Disc Title 或 Disc Label', 'WARN');
            return;
        }
        extractCurrentDetailPageDirect();
    });

    bindAction('copy-sub', function () {
        var val = ($('#pt-edit-sub') && $('#pt-edit-sub').value.trim()) || '';
        if (!val) { log('⚠️ 副标题为空', 'WARN'); return; }
        copyTextToClipboard(val, false);
    });

    bindAction('copy-desc', function () {
        var val = ($('#pt-edit-desc') && $('#pt-edit-desc').value.trim()) || '';
        if (!val) { log('⚠️ 简介为空', 'WARN'); return; }
        copyTextToClipboard(val, false);
    });

    bindAction('regen-preview', function () {
        if (window._ptCurrentPendingItem && window._ptCurrentPendingItem.item && window._ptCurrentPendingItem.item.row) {
            preparePreview(window._ptCurrentPendingItem.item);
        } else if (!extractCurrentDetailPageDirect() && window._ptCurrentPendingItem) {
            preparePreview(window._ptCurrentPendingItem.item);
        }
    });

    bindAction('confirm-publish', async function () {
        if (!window._ptCurrentPendingItem) {
            if (!extractCurrentDetailPageDirect()) {
                alert('请先点击队列/列表中的「🚀转种」或在详情页提取数据');
                return;
            }
        }
        var pending = window._ptCurrentPendingItem;
        var finalSub = $('#pt-edit-sub').value;
        var finalDesc = $('#pt-edit-desc').value;

        var uploadWin = window.open('about:blank', '_blank');
        if (uploadWin) {
            try {
                uploadWin.document.title = 'PT 转种准备中...';
                uploadWin.document.body.innerHTML = '<div style="font-family:-apple-system,sans-serif;padding:40px;color:#475569;font-size:14px;line-height:1.8;">⏳ <b>正在拉取种子、洗种、并应用修改...</b><br><br>完成后会自动跳转到上传页，请勿关闭此标签页。</div>';
            } catch (e) {}
        }

        try {
            var itemData = pending.item;
            var fullDetails = pending.fullDetails;

            log('📥 正在拉取源站 .torrent 种子文件二进制流...', 'INFO');
            var torrentBase64 = '';
            try {
                torrentBase64 = await ensureItemTorrentBase64(itemData);
                log('✅ 种子文件已拉取进内存！', 'SUCCESS');
            } catch (dlErr) {
                log('⚠️ 种子二进制拉取失败 (' + dlErr.message + ')，将在发布页尝试备用拉取或手动选种', 'WARN');
            }

            var finalImdbId = normalizeImdbId(($('#pt-manual-imdb') && $('#pt-manual-imdb').value.trim()) || fullDetails.imdbId || itemData.imdbId || '');
            var finalDoubanUrl = fullDetails.doubanUrl || '';

            var rawRelease = itemData.releaseName || itemData.mainTitle;
            var combinedTech = rawRelease + ' ' + pending.rawBdinfo;
            var videoCodec = /VC-1/i.test(combinedTech) ? 'VC-1' : (/MPEG-2/i.test(combinedTech) ? 'MPEG-2' : (/HEVC|x265/i.test(combinedTech) ? 'HEVC' : (/AVC|x264|MPEG-4/i.test(combinedTech) ? 'AVC' : (itemData.is4K ? 'HEVC' : 'AVC'))));
            var audioCodec = '';
            if (/DTS-HD\s*Master\s*Audio|DTS-HD\s*MA/i.test(combinedTech)) {
                var chDts = combinedTech.match(/DTS-HD(?:\s*Master\s*Audio|\s*MA)?\s*(\d+\.\d+)/i);
                audioCodec = 'DTS-HD MA' + (chDts ? ' ' + chDts[1] : ' 5.1');
            } else if (/TrueHD/i.test(combinedTech)) {
                var chThd = combinedTech.match(/TrueHD\s*(?:Atmos\s*)?(\d+\.\d+)/i);
                audioCodec = 'TrueHD' + (chThd ? ' ' + chThd[1] : ' 7.1') + (/Atmos/i.test(combinedTech) ? ' Atmos' : '');
            } else if (/LPCM/i.test(combinedTech)) {
                var chLpcm = combinedTech.match(/LPCM\s*(\d+\.\d+)/i);
                audioCodec = 'LPCM' + (chLpcm ? ' ' + chLpcm[1] : ' 2.0');
            } else if (/DTS/i.test(combinedTech)) audioCodec = 'DTS 5.1';
            else if (/\bDD\s*\d\.\d|Dolby\s*Digital/i.test(combinedTech)) audioCodec = 'AC3';

            var standardName = rawRelease.replace(/@[A-Za-z0-9]+$/i, '').trim();
            var isDocuGenre = /纪录|紀錄|Documentary/i.test(fullDetails.synopsisBbcode || '');
            var mediaType = isDocuGenre ? '纪录' : '电影';
            var sourceRegion = inferSourceRegion(fullDetails.synopsisBbcode || '', standardName, finalSub);
            var detectedLabels = inferTorrentLabels(standardName, finalSub, fullDetails.synopsisBbcode || '', pending.rawBdinfo);

            var bInfo = getSiteBInfo();
            GM_setValue('pt_transfer_payload', {
                targetBHost: extractHostKey(bInfo.url),
                name: standardName,
                small_descr: finalSub,
                imdbUrl: finalImdbId ? ('https://www.imdb.com/title/' + finalImdbId + '/') : '',
                doubanUrl: finalDoubanUrl,
                descr: finalDesc,
                mediaType: mediaType,
                is4K: itemData.is4K,
                sizeGB: itemData.sizeGB,
                videoCodec: videoCodec,
                audioCodec: audioCodec,
                sourceRegion: sourceRegion,
                labels: detectedLabels,
                downloadUrl: fullDetails.realDownloadUrl || itemData.downloadUrl || '',
                sourceDetailUrl: fullDetails.sourceDetailUrl || location.href,
                torrentBase64: torrentBase64,
                timestamp: new Date().getTime()
            });

            var uploadUrl = siteBase(bInfo.url) + 'upload.php';
            log('🚀 正在跳转目标站 [' + bInfo.name + '] 发布页全自动塞种填单...', 'INFO');
            if (uploadWin && !uploadWin.closed) {
                try { uploadWin.location.href = uploadUrl; } catch (e) { window.open(uploadUrl, '_blank'); }
            } else {
                var retryWin = window.open(uploadUrl, '_blank');
                if (!retryWin) {
                    log('⚠️ 浏览器拦截了新窗口，请手动打开: ' + uploadUrl, 'WARN');
                    alert('转种数据已全部准备好！\n\n浏览器拦截了自动打开新窗口，请手动打开以下地址：\n\n' + uploadUrl);
                }
            }
            log('✅ 已跳转发布页', 'SUCCESS');
        } catch (err) {
            log('❌ 转种执行失败: ' + (err && err.message ? err.message : err), 'ERROR');
            if (uploadWin && !uploadWin.closed) {
                try {
                    uploadWin.document.body.innerHTML = '<div style="font-family:-apple-system,sans-serif;padding:40px;color:#b91c1c;font-size:14px;line-height:1.8;">❌ <b>转种失败</b><br><br>' + String(err && err.message ? err.message : err).replace(/</g, '&lt;') + '<br><br>请关闭此标签页，回到 PT 面板查看日志。</div>';
                } catch (e) {}
            }
        }
    });

    function autoFillUploadPageIfActive() {
        if (location.pathname.indexOf('upload.php') === -1 && !/\/upload|\/torrents\/create/i.test(location.pathname)) return false;
        var transferData = GM_getValue('pt_transfer_payload', null);
        if (!transferData || (new Date().getTime() - transferData.timestamp >= 180000)) return false;
        if (!transferData.targetBHost || extractHostKey(location.hostname) !== transferData.targetBHost) return false;
        GM_setValue('pt_transfer_payload', null);
        setTimeout(function () {
            try {
                var bodyTxt = document.body ? document.body.textContent : '';
                var annMatch = bodyTxt.match(/https?:\/\/[^\s"'<>]+\/announce(?:\.php)?(?:\?passkey=[^\s"'<>]+)?/i);
                var pageAnnounce = annMatch ? annMatch[0].trim() : '';
                var fileInput = $('input[type="file"][name="file"], input[type="file"]#torrent, input[type="file"]#file, input[type="file"][name="torrent"], input[type="file"][name="torrentfile"], input[type="file"]');
                var showFileInjectBadge = function (text, isSuccess) {
                    if (!fileInput || !fileInput.parentElement) return;
                    var oldTip = $('.pt-file-inject-tip', fileInput.parentElement);
                    if (oldTip) oldTip.remove();
                    var tip = el('span', 'pt-file-inject-tip', text, 'margin-left:8px; padding:2px 7px; border-radius:4px; font-size:11.5px; font-weight:600; display:inline-block; ' + (isSuccess ? 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;'));
                    fileInput.after(tip);
                };
                var injectFileToInput = function (b64Str) {
                    if (!fileInput || !b64Str) return false;
                    try {
                        var siteCode = location.hostname.split('.')[0].toUpperCase();
                        var built = buildCleanedTorrentFile(b64Str, transferData.name, pageAnnounce || 'https://tracker.pterclub.net/announce', siteCode);
                        var WinDT = rootWin.DataTransfer || window.DataTransfer;
                        var dt = new WinDT();
                        dt.items.add(built.file);
                        fileInput.files = dt.files;
                        dispatchEvt(fileInput);
                        showFileInjectBadge('✅ 已自动挂载洗种文件: ' + built.filename + ' (' + built.sizeKB + ' KB)', true);
                        return true;
                    } catch (fErr) {
                        showFileInjectBadge('❌ 种子文件挂载异常: ' + fErr.message, false);
                        return false;
                    }
                };
                if (transferData.torrentBase64) injectFileToInput(transferData.torrentBase64);
                else if (transferData.downloadUrl) {
                    showFileInjectBadge('⏳ 正在从源站后台拉取 .torrent 文件...', true);
                    fetchTorrentRawBase64(transferData.downloadUrl, transferData.sourceDetailUrl).then(injectFileToInput).catch(function (err) {
                        showFileInjectBadge('⚠️ 自动拉取种子失败 (' + err.message + ')，请手动选择文件', false);
                    });
                }
                var lockField = function (sel, val, delays) {
                    if (!val) return;
                    var apply = function () { var node = $(sel); if (node) { node.value = val; dispatchEvt(node); } };
                    apply();
                    (delays || []).forEach(function (ms) { setTimeout(apply, ms); });
                };
                lockField('input[name="name"], input#name', transferData.name, [150, 450, 1000, 2000]);
                lockField('input[name="small_descr"], input[name="subtitle"]', transferData.small_descr, [200, 800, 1800]);
                lockField('input[name="url"][type="text"], input[name="url"], input[name="imdb_id"]', transferData.imdbUrl);
                lockField('textarea[name="descr"], textarea#descr', transferData.descr);
                var doubanInput = $('input[name="douban"], input[name="douban_url"], input[name="durl"], input[name="ptgen_url"], input[name="external_url"]');
                if (!doubanInput) {
                    var dbTr = $$('tr').find(function (tr) { var h = $('td.rowhead, td:first-child', tr); return h && /豆瓣/.test(h.textContent); });
                    if (dbTr) doubanInput = $('input[type="text"]', dbTr);
                }
                if (doubanInput && transferData.doubanUrl) { doubanInput.value = transferData.doubanUrl; dispatchEvt(doubanInput); }
                var findSelects = function (names, labelRegex) {
                    var res = [];
                    (names || []).forEach(function (n) {
                        $$('select[name="' + n + '"], select[name^="' + n + '["], select#' + n).forEach(function (s) { pushUnique(res, s); });
                    });
                    if (labelRegex) {
                        $$('tr').forEach(function (tr) {
                            var head = $('td.rowhead, td:first-child', tr);
                            if (head && labelRegex.test((head.textContent || '').trim())) {
                                $$('select', tr).forEach(function (s) { pushUnique(res, s); });
                            }
                        });
                    }
                    return res;
                };
                var pickSelectOptionByKeywords = function (selectEls, keywords) {
                    if (!selectEls || !selectEls.length || !keywords || !keywords.length) return;
                    selectEls.forEach(function (select) {
                        var bestOpt = null, bestScore = -1;
                        Array.from(select.options).forEach(function (opt) {
                            var text = (opt.textContent || '').trim();
                            if (!text || /请选择|choose|select/i.test(text)) return;
                            var score = -1;
                            keywords.forEach(function (kw) {
                                if (typeof kw === 'string') {
                                    var kLower = kw.toLowerCase(), tLower = text.toLowerCase();
                                    if (tLower === kLower) score = Math.max(score, 120);
                                    else if (tLower.indexOf(kLower) !== -1) score = Math.max(score, 85);
                                } else if (kw instanceof RegExp) {
                                    var m = text.match(kw);
                                    if (m) score = Math.max(score, m[0].length === text.length ? 110 : 75);
                                }
                            });
                            if (score > bestScore) { bestScore = score; bestOpt = opt; }
                        });
                        if (bestOpt && bestScore >= 0) { bestOpt.selected = true; select.value = bestOpt.value; dispatchEvt(select); }
                    });
                };
                var selectHasText = function (s, reg) {
                    return reg.test(Array.from(s.options).map(function (o) { return (o.textContent || '').trim(); }).join(' | '));
                };
                var fillAllBottomDropdowns = function () {
                    pickSelectOptionByKeywords(findSelects(['type', 'category', 'cat'], /^(类型|類別|Category|Type)\*?$/i), transferData.mediaType === '纪录' ? [/Docu/i, /纪录|紀錄/] : [/Movie/i, /电影|電影/]);
                    var mediumSels = findSelects(['medium_sel', 'medium'], /^(质量|質量|媒介|介质|Medium|Format)\*?$/i);
                    findSelects(['source_sel', 'source']).forEach(function (s) {
                        if (selectHasText(s, /Blu-?ray|UHD|Remux|Encode|WEB-?DL|HDTV|DVD|原盘/i)) pushUnique(mediumSels, s);
                    });
                    pickSelectOptionByKeywords(mediumSels, transferData.is4K ? ['UHD', /UHD|4K\s*UHD|Ultra\s*HD/i, /Blu-?ray/i, /原盘|蓝光/] : ['Blu-ray', 'BluRay', /Blu-?ray/i, /\bBD\b/i, /原盘|蓝光/]);
                    pickSelectOptionByKeywords(findSelects(['standard_sel', 'standard'], /^(分辨率|解析度|Standard|Resolution)\*?$/i), transferData.is4K ? (/4320p|8K/i.test(transferData.name) ? [/4320p|8K/i, /2160p|4K|UHD/i] : [/2160p|4K|UHD/i]) : (/1080i/i.test(transferData.name) ? [/1080i/i, /1080p/i] : [/1080p/i, /1080i/i]));
                    var vCodec = transferData.videoCodec || (transferData.is4K ? 'HEVC' : 'AVC');
                    var codecKw = /HEVC|265/i.test(vCodec) ? [/HEVC|H\.?265/i] : (/VC-?1/i.test(vCodec) ? [/VC-?1/i] : (/MPEG-?2/i.test(vCodec) ? [/MPEG-?2/i] : [/AVC|H\.?264/i]));
                    pickSelectOptionByKeywords(findSelects(['codec_sel', 'codec'], /^(编码|編碼|视频编码|Codec)\*?$/i), codecKw);
                    var aCodec = transferData.audioCodec || '';
                    var audioKw = /Atmos/i.test(aCodec) ? [/Atmos/i, /TrueHD/i] : (/TrueHD/i.test(aCodec) ? [/TrueHD/i] : (/DTS-HD/i.test(aCodec) ? [/DTS[- .]?HD[\s\S]{0,10}(MA|Master)/i, /DTS[- .]?HD/i, /DTS/i] : (/LPCM|PCM/i.test(aCodec) ? [/LPCM|PCM/i] : (/DTS/i.test(aCodec) ? [/\bDTS\b/i] : (/DD|AC-?3|Dolby/i.test(aCodec) ? [/AC-?3|Dolby|\bDD/i] : [])))));
                    if (audioKw.length) pickSelectOptionByKeywords(findSelects(['audiocodec_sel', 'audio'], /^(音频|音頻|音频编码|Audio)\*?$/i), audioKw);
                    var REGION_KW_MAP = { '香港': ['香港', '港台', /香港|港台|港澳|HK/i], '台湾': ['台湾', '臺灣', '港台', /台湾|臺灣|港台|TW/i], '大陆': ['大陆', '内地', '中国', /大陆|内地|中国|华语|CN/i], '日本': ['日本', '日韩', /日本|日韩|JP|Japan/i], '韩国': ['韩国', '韩國', '日韩', /韩国|韓國|日韩|KR|Korea/i], '印度': ['印度', '其他', /印度|India|Other/i] };
                    var regionSels = findSelects([], /^(地区|地區|来源|來源|国家|國家|Region|Source|Area)\*?$/i);
                    findSelects(['source_sel', 'team_sel', 'region', 'area']).forEach(function (s) {
                        if (selectHasText(s, /欧美|大陆|香港|台湾|港台|日本|韩国|日韩|印度/)) pushUnique(regionSels, s);
                    });
                    pickSelectOptionByKeywords(regionSels, REGION_KW_MAP[transferData.sourceRegion] || [/欧美|歐美|美国|欧洲|US|EU/i]);
                };
                fillAllBottomDropdowns();
                [500, 1200].forEach(function (ms) { setTimeout(fillAllBottomDropdowns, ms); });
                var TAG_CHECK_RULES = [['gy', 'gy', /^(国语|國語|国配)$/i], ['yy', 'yy', /^(粤语|粵語|粤配)$/i], ['zz', 'zz', /^(中字|中文字幕)$/i], ['yz', 'yz', /^(英字|英文字幕)$/i], ['diy', 'diy', /^(DIY|DIY原盘)$/i], ['hdr10', 'hdr10', /^HDR10$/i], ['hdr10plus', 'hdrm', /^HDR10\+$/i], ['db', 'db|dovi', /^(杜比视界|Dolby\s*Vision|DoVi)$/i]];
                var checkTagsAndAnonymous = function () {
                    var lbs = transferData.labels || {};
                    $$('input[type="checkbox"]').forEach(function (cb) {
                        var nameAttr = (cb.getAttribute('name') || '').toLowerCase(), valAttr = (cb.value || '').toLowerCase();
                        var labelFor = cb.id ? $('label[for="' + cb.id + '"]') : null;
                        var labelText = (labelFor && labelFor.textContent) || (cb.nextSibling ? ((cb.nextSibling.textContent || '') + (cb.nextElementSibling ? cb.nextElementSibling.textContent : '')) : '') || (cb.parentElement ? cb.parentElement.textContent : '');
                        labelText = labelText.trim();
                        if (labelText.indexOf('副标题') !== -1 && nameAttr.indexOf('tag') === -1) { cb.checked = false; return; }
                        if (nameAttr === 'uplver' || nameAttr === 'anonymous' || /不要在发布者项目中显示|匿名发布|匿名上傳/i.test(labelText)) { cb.checked = true; dispatchEvt(cb); return; }
                        var hit = TAG_CHECK_RULES.some(function (rule) { return lbs[rule[0]] && (new RegExp('^(' + rule[1] + ')$').test(valAttr) || rule[2].test(labelText)); });
                        if (hit && !cb.checked) { cb.checked = true; dispatchEvt(cb); }
                    });
                };
                checkTagsAndAnonymous();
                [600, 1500].forEach(function (ms) { setTimeout(checkTagsAndAnonymous, ms); });
            } catch (err) { console.error('[PT助手] 自动填单异常:', err); }
        }, 500);
        return true;
    }

    bindAction('row-forward', async function (btn) {
        if (!btn._ptItem) return;
        var origTxt = btn.innerText;
        btn.innerText = '⏳拉取中...';
        try { await preparePreview(btn._ptItem); }
        catch (err) { log('❌ 提取预览失败: ' + (err && err.message ? err.message : err), 'ERROR'); }
        finally { btn.innerText = origTxt; }
    });

    async function qbLogin(customParams) {
        var targetConfig = customParams || config;
        if (!targetConfig.qbUrl) throw new Error('未填写 qB 地址');
        var cleanUrl = targetConfig.qbUrl.trim().replace(/\/?$/, '/');
        var res = await http(cleanUrl + 'api/v2/auth/login', {
            method: 'POST', rawResponse: true, timeout: 8000, headers: qbHeaders(cleanUrl, true),
            data: 'username=' + encodeURIComponent(targetConfig.qbUser) + '&password=' + encodeURIComponent(targetConfig.qbPass)
        });
        if (res.responseText === 'Fails.') throw new Error('用户名或密码错误');
        if ((res.status >= 200 && res.status < 300) || res.responseText === 'Ok.') return cleanUrl;
        throw new Error('HTTP ' + res.status);
    }

    async function qbGetVersion(cleanUrl) {
        try {
            var txt = await http(cleanUrl + 'api/v2/app/version', { headers: qbHeaders(cleanUrl), timeout: 5000 });
            return (txt || '').trim();
        } catch (e) { return ''; }
    }

    async function qbPushTorrent(itemOrUrl) {
        var cleanUrl = await qbLogin();
        var fd = new FormData();
        var itemObj = (typeof itemOrUrl === 'object' && itemOrUrl !== null) ? itemOrUrl : { downloadUrl: String(itemOrUrl || ''), mainTitle: 'torrent' };
        var b64 = await ensureItemTorrentBase64(itemObj);
        var built = buildCleanedTorrentFile(b64, itemObj.mainTitle || 'movie', null, null);
        fd.append('torrents', built.blob, built.filename);
        if (config.qbCategory) fd.append('category', config.qbCategory);
        var res = await http(cleanUrl + 'api/v2/torrents/add', { method: 'POST', rawResponse: true, timeout: 15000, headers: qbHeaders(cleanUrl), data: fd });
        if ((res.status >= 200 && res.status < 300) && res.responseText !== 'Fails.') return true;
        throw new Error('qB 拒绝添加种子 (' + (res.responseText || 'HTTP ' + res.status) + ')');
    }

    bindAction('cfg-qb-test', async function (testBtn) {
        var msgBox = $('#pt-cfg-qb-test-msg');
        var tempUrl = $('#pt-cfg-qb-url').value.trim(), tempUser = $('#pt-cfg-qb-user').value.trim(), tempPass = $('#pt-cfg-qb-pass').value.trim();
        if (!tempUrl) { msgBox.style.display = 'block'; msgBox.style.color = '#dc2626'; msgBox.innerText = '请先输入 qBittorrent WebUI 地址！'; return; }
        testBtn.innerText = '⏳ 测试中...'; msgBox.style.display = 'block'; msgBox.style.color = '#2563eb'; msgBox.innerText = '正在握手...';
        try {
            var cleanUrl = await qbLogin({ qbUrl: tempUrl, qbUser: tempUser, qbPass: tempPass });
            var ver = await qbGetVersion(cleanUrl);
            testBtn.innerText = '🔌 测试 qBittorrent 连接'; msgBox.style.color = '#15803d';
            msgBox.innerText = '🎉 连通成功！服务正常' + (ver ? ' (版本: ' + ver + ')' : '');
        } catch (err) {
            testBtn.innerText = '🔌 测试 qBittorrent 连接'; msgBox.style.color = '#dc2626';
            msgBox.innerText = '❌ 连接失败: ' + err.message;
        }
    });

    bindAction('row-qb', async function (btn) {
        if (!btn._ptItem) return;
        btn.innerText = '...';
        try {
            await qbPushTorrent(btn._ptItem);
            btn.innerText = '已推';
            log('✅ 成功将 .torrent 文件上传至 qB: ' + (btn._ptItem.cnTitle || btn._ptItem.movieTitle), 'SUCCESS');
        } catch (err) { alert('推送 qB 失败: ' + err.message); btn.innerText = '重试'; }
    });

    bindAction('row-combo', async function (btn) {
        if (!btn._ptItem) return;
        btn.innerText = '...';
        try { await qbPushTorrent(btn._ptItem); log('✅ 种子文件已上传至远程 qB', 'SUCCESS'); } catch (err) { log('⚠️ qB 投递异常: ' + err.message, 'WARN'); }
        try { await preparePreview(btn._ptItem); }
        catch (err) { log('❌ 提取预览失败: ' + (err && err.message ? err.message : err), 'ERROR'); }
        finally { btn.innerText = '⚡全套'; if (btn._ptQueueRow) btn._ptQueueRow.style.opacity = '0.5'; }
    });

    if (autoFillUploadPageIfActive()) return;

    function isLikelyDetailPage() {
        if (/details\.php/i.test(location.pathname)) return true;
        if (/\/torrents\/\d+/i.test(location.pathname)) return true;
        if (/torrents\.php/i.test(location.pathname) && /[?&]id=\d+/i.test(location.search)) return true;
        return false;
    }

    function bootPanel() {
        if (!document.body) {
            setTimeout(bootPanel, 150);
            return;
        }
        renderPanelView();

        var observer = new MutationObserver(function () {
            if (document.body && !$('#pt-checker-panel')) renderPanelView();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(function () {
            if (document.body && !$('#pt-checker-panel')) renderPanelView();
        }, 2000);

        setTimeout(function () {
            renderQueueUI();
            if (isHideMode) applyHideMode(true);
        }, 800);

        if (currentSiteArch === 'unit3d') {
            var pendingTs = GM_getValue('pt_u3d_pending_preset', 0);
            if (pendingTs && (Date.now() - pendingTs < 20000)) {
                GM_setValue('pt_u3d_pending_preset', 0);
                setTimeout(function () { PRESET_HANDLERS.unit3d(getSiteAInfo()); }, 900);
            }
        }

        if (isLikelyDetailPage()) {
            setTimeout(function () {
                if (findBdinfo(document)) {
                    extractCurrentDetailPageDirect();
                }
            }, 600);
            setTimeout(function () {
                var descVal = ($('#pt-edit-desc') && $('#pt-edit-desc').value.trim()) || '';
                if (!descVal && findBdinfo(document)) {
                    extractCurrentDetailPageDirect();
                }
            }, 2500);
        } else {
            setTimeout(autoRestoreState, 1200);
        }

        var tableContainer = document.querySelector('.data-table, #torrenttable, table.torrents') || document.body;
        if (tableContainer) {
            rowObserver.observe(tableContainer, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootPanel);
    else bootPanel();
})();