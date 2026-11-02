// ==UserScript==
// @name         PT 原盘转载发布与智能查重助手
// @namespace    https://pterclub.net/
// @version      0.0.0.1
// @description  蓝光原盘筛选、查重词库（分片存储/30天有效/导出导入）、断点续查、BDInfo 排版与转种填单、截图直连转存图床（必要时走 PterClub 单点登录）、qB 推送自动补设分类、M-Team 网页适配
// @author       Kevin
// @match        *://*.pterclub.net/*
// @match        *://*.pterclub.club/*
// @match        *://*.passthepopcorn.me/*
// @match        *://*.beyond-hd.me/*
// @match        *://*.blutopia.cc/*
// @match        *://blutopia.cc/*
// @match        *://*.aither.cc/*
// @match        *://aither.cc/*
// @match        *://*.dreadvault.org/*
// @match        *://dreadvault.org/*
// @match        *://*.ptchdbits.co/*
// @match        *://*.chdbits.co/*
// @match        *://*.hdsky.me/*
// @match        *://*.m-team.cc/*
// @match        *://m-team.cc/*
// @match        *://*.m-team.io/*
// @match        *://*/*torrents.php*
// @match        *://*/*torrents*
// @match        *://*/*details.php*
// @match        *://*/*browse.php*
// @match        *://*/*upload.php*
// @match        *://*.doubaninfo.com/*
// @match        *://doubaninfo.com/*
// @match        https://s3.pterclub.net/*
// @connect      *
// @connect      doubaninfo.com
// @connect      s3.pterclub.net
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(() => {
  try {
    console.log("[PT助手] v0.0.0.1 已注入 @ " + location.host + location.pathname);
  } catch (e) {
  }
  // 图床代理页：只跑转存任务，不加载主面板
  if (/^s3\.pterclub\.net$/i.test(location.hostname)) {
    runImgBedWorker();
    return;
  }
  // src/lib/patterns.js
  var RE = {
    ENCODE: /\b(REMUX|x264|x265|H\.?264|H\.?265|720p|480p|480i|576p|576i|BDRip|BRRip|DVDRip|DVD5|DVD9|WEB-DL|WEBRip|HDTV|TVRip|VODRip|MiniBD|Re-encode)\b/i,
    DVD: /\b(DVD5|DVD9|NTSC|PAL|480i|480p|576i|576p)\b/i,
    DISC_MEDIA: /\b(BluRay|Blu-ray|UHD|BD25|BD50|BD66|BD100|COMPLETE)\b/i,
    DISC_CODEC: /\b(AVC|HEVC|VC-1|MPEG-2)\b/i,
    DISC_SHORT: /\b(BD50|BD66|BD100|BD25|COMPLETE BLURAY|COMPLETE UHD)\b/i,
    DISC_HINT: /\b(BD25|BD50|BD66|BD100|COMPLETE BLURAY|COMPLETE UHD|UHD\s*66|UHD\s*100)\b/i,
    GZ_DISC: /\b(m2ts|ISO|BD25|BD50|BD66|BD100|COMPLETE)\b/i,
    BHD_DISC: /\b(BD\s*50|BD\s*25|UHD\s*100|UHD\s*66|UHD\s*50)\b/i,
    U3D_DISC: /\b(Full Disc|BDMV|BD50|BD25|UHD)\b/i,
    UHD: /\b(4320p|8K|2160p|UHD|4K|BD66|BD100)\b/i,
    DIY: /\bDIY\b|特效字幕|新增.*音轨|重封/i,
    FORBIDDEN: /禁转|禁止转载|独占|Exclusive/i,
    LIMITED: /限转/,
    NON_MOVIE: /TV|Series|劇|剧|綜藝|综艺|動漫|动漫|Music|音乐|Audio|Sport|体育/i,
    EPISODE: /\bS\d{1,2}(E\d{1,2})?\b/i,
    SIZE: /([\d.]+)\s*([KMGTP]?i?B)/i,
    ROW_SIZE: /([\d.]+)\s*(GB|GiB|MB|MiB|TB|TiB)/i,
    YEAR: /\b(19\d\d|20\d\d)\b/,
    IMDB: /tt\d{7,9}/i,
    TAG_PREFIX: /^(?:\s*(?:\[[^\]]{1,12}\]|官方|原生原盘|原盘|禁转|限转|独占|DIY|国语|粤语|中字|英字|特效|热门|免费|2X|50%|30%|Dolby\s*Vision|DoVi\+HDR|DoVi|HDR10\+?|HDR\s*Vivid|菁彩HDR|HDR|Atmos|粤|国|中)\s*)+/gi,
    NP_UI_TAG: /^(官方|原生原盘|原盘|禁转|限转|独占|DIY|国语|粤语|中字|英字|特效|热门|免费|2X|50%|30%|2X免费|2X50%|已审|未审|置顶|推荐|首发|完结|Dolby\s*Vision|DoVi\+HDR|DoVi|HDR10\+?|HDR|Atmos|\d+\.\d+)$/i,
    US_EU: new RegExp("阿尔巴尼亚|安道尔|奥地利|俄罗斯|比利时|波黑|保加利亚|克罗地亚|塞浦路斯|捷克|丹麦|爱沙尼亚|冰岛|芬兰|法国|德国|希腊|匈牙利|爱尔兰|意大利|拉脱维亚|立陶宛|卢森堡|马其顿|马耳他|摩尔多瓦|摩纳哥|荷兰|挪威|波兰|葡萄牙|罗马尼亚|圣马力诺|塞尔维亚|斯洛伐克|斯洛文尼亚|西班牙|瑞典|瑞士|乌克兰|英国|梵蒂冈|美国|加拿大|澳大利亚|新西兰|西德|苏联|秘鲁|阿根廷|墨西哥|巴西|Albania|Andorra|Austria|Russia|Belgium|Bulgaria|Croatia|Cyprus|Czech|Denmark|Estonia|Iceland|Finland|France|Germany|Greece|Hungary|Ireland|Italy|Latvia|Lithuania|Luxembourg|Malta|Netherlands|Norway|Poland|Portugal|Romania|Serbia|Slovakia|Slovenia|Spain|Sweden|Switzerland|Ukraine|United Kingdom|UK|GBR|United States|USA|US|Canada|CAN|Australia|AUS|New Zealand|West Germany|Soviet Union|Argentina|Mexico|Brazil", "i")
  };

  // src/lib/text.js
  function normalizeImdbId(raw) {
    var s = String(raw || "").trim();
    if (!s || s === "0") return "";
    var m = s.match(/tt\d{7,9}/i);
    if (m) return m[0].toLowerCase();
    var digits = s.replace(/\D/g, "");
    return digits ? "tt" + digits.padStart(7, "0") : "";
  }
  function is4kText(text) {
    return RE.UHD.test(text || "");
  }
  function stripReleaseTags(str) {
    return (str || "").replace(/🌐网页原盘|⚡API原盘|Untouched 原盘|🔍查B站|🚀转种|📥推qB|已查|已推/g, "").replace(RE.TAG_PREFIX, "").replace(/(?:\s+\d+\.\d+)+\s*$/g, "").trim();
  }
  function parseSizeToGB(sizeStr) {
    if (typeof sizeStr === "number") return sizeStr / (1024 * 1024 * 1024);
    if (!sizeStr) return 0;
    var m = String(sizeStr).replace(/,/g, "").match(RE.SIZE);
    if (!m) return 0;
    var val = parseFloat(m[1]), unit = m[2].toUpperCase();
    return unit.indexOf("T") === 0 ? val * 1024 : unit.indexOf("M") === 0 ? val / 1024 : unit.indexOf("K") === 0 ? val / (1024 * 1024) : val;
  }
  function extractMovieYear(t) {
    var re = /(?:^|[\s.\[\]()\-_])((?:19|20)\d{2})(?=[\s.\[\]()\-_]|$)/g, found = [], m;
    while ((m = re.exec(t)) !== null) found.push({ year: m[1], idx: m.index, len: m[0].length });
    return found;
  }
  function parseTitleMeta(rawTitle, extraSpec) {
    var t = (rawTitle || "").trim();
    var found = extractMovieYear(t);
    var year = "", cleanTitle = "";
    for (var i = found.length - 1; i >= 0; i--) {
      var head = t.substring(0, found[i].idx).replace(/\s+AKA\s+.*/i, "").replace(/^[^\x00-\x7F]+/, "").replace(/[._]/g, " ").trim();
      if (head) {
        cleanTitle = head;
        year = found[i].year;
        break;
      }
    }
    if (!cleanTitle) cleanTitle = t.replace(/^[^\x00-\x7F]+/, "").replace(/[._]/g, " ").trim();
    var group = (t.replace(/@[A-Za-z0-9]+$/i, "").match(/-([A-Za-z0-9]+)$/) || ["", ""])[1];
    return { movieTitle: cleanTitle || t, movieYear: year, releaseGroup: group, is4K: is4kText(t + " " + (extraSpec || "")) };
  }
  function parseCleanSubtitleString(rawSubStr) {
    if (!rawSubStr) return { cnTitle: "", regionBracket: "" };
    var s = stripReleaseTags(rawSubStr);
    var regMatch = s.match(/【([^】]*原盘[^】]*)】/) || s.match(/\[([^\]]*原盘[^\]]*)\]/);
    var tailVerMatch = !regMatch && s.match(/(美版|英版|法版|德版|日版|韩版|港版|台版|欧版|澳版|加版|西班牙版|意大利版|澳大利亚)原盘/);
    var regionBracket = regMatch ? regMatch[1].trim() : tailVerMatch ? tailVerMatch[0].trim() : "";
    var firstSeg = stripReleaseTags(s.split(/\||\/|【|\[|类别:|類別:|导演:|主演:/)[0]);
    return { cnTitle: /[\u4e00-\u9fa5]/.test(firstSeg) ? firstSeg : "", regionBracket };
  }
  function parseRelativeAgeDays(txt) {
    var text = String(txt || "").trim();
    if (!text || text.length > 14) return null;
    if (!/^(\d+\s*(年|月|周|天|日|时|小时|分|分钟)\s*)+$/.test(text)) return null;
    var unitWeights = [["年", 365], ["月", 30], ["周", 7], ["[天日]", 1], ["(?:小时|时)", 1 / 24], ["(?:分钟|分)", 1 / 1440]];
    var totalDays = 0;
    unitWeights.forEach(function(uw) {
      var m = text.match(new RegExp("(\\d+)\\s*" + uw[0]));
      if (m) totalDays += parseInt(m[1], 10) * uw[1];
    });
    return { days: totalDays, text };
  }

  // src/lib/sites.js
  var DEFAULT_SITE_DATABASE = {
    "PTer": { name: "PTerClub (猫站)", url: "https://pterclub.net/", type: "np" },
    "Audiences": { name: "Audiences (观影)", url: "https://audiences.me/", type: "np" },
    "HDSky": { name: "HDSky (天空)", url: "https://hdsky.me/", type: "np" },
    "MTeam": { name: "M-Team (馒头)", url: "https://kp.m-team.cc/", type: "np", aliases: ["https://m-team.cc/", "https://kp.m-team.io/", "https://next.m-team.cc/"] },
    "OurBits": { name: "OurBits (我堡)", url: "https://ourbits.club/", type: "np" },
    "CHDBits": { name: "CHDBits (彩虹岛)", url: "https://ptchdbits.co/", type: "np" },
    "TTG": { name: "TTG (听歌)", url: "https://totheglory.im/", type: "np" },
    "FRDS": { name: "FRDS (朋友)", url: "https://pt.keepfrds.com/", type: "np" },
    "BLU": { name: "Blutopia", url: "https://blutopia.cc/", type: "unit3d" },
    "Aither": { name: "Aither", url: "https://aither.cc/", type: "unit3d" },
    "DreadVault": { name: "DreadVault", url: "https://dreadvault.org/", type: "unit3d" },
    "BHD": { name: "BeyondHD", url: "https://beyond-hd.me/", type: "f3nix" },
    "PTP": { name: "PTP", url: "https://passthepopcorn.me/", type: "gz" }
  };
  function u3dHeaders(apiKey) {
    return { "Authorization": "Bearer " + apiKey, "Accept": "application/json" };
  }
  function gzHeaders(apiKey) {
    if (apiKey.indexOf(":") !== -1) {
      var pts = apiKey.split(":");
      return { "ApiUser": pts[0].trim(), "ApiKey": pts.slice(1).join(":").trim(), "Accept": "application/json" };
    }
    return { "Authorization": apiKey, "Accept": "application/json" };
  }
  function qbHeaders(cleanUrl, isForm) {
    var h = { "Referer": cleanUrl, "Origin": cleanUrl.replace(/\/+$/, "") };
    if (isForm) h["Content-Type"] = "application/x-www-form-urlencoded";
    return h;
  }
  function siteBase(url) {
    return String(url || "").replace(/\/+$/, "") + "/";
  }
  function siteUrl(site, kind, opt) {
    opt = opt || {};
    var base = siteBase(site.url);
    if (/m-team\.(cc|io)/i.test(String(site.url || ""))) {
      if (kind === "details") return base + "detail/" + opt.id;
      if (kind === "download") return base + "download/" + opt.id;
      if (kind === "search") return base + "browse?keyword=" + encodeURIComponent(opt.imdbId || opt.kw || "") + "&tagsType=&tags=&visible=1";
    }
    if (site.type === "unit3d") {
      if (kind === "details") return base + "torrents/" + opt.id;
      if (kind === "download") return base + "torrents/download/" + opt.id;
      if (kind === "search") return base + "torrents?" + (opt.imdbId ? "imdbId=" + opt.imdbId.replace(/\D/g, "") : "name=" + encodeURIComponent(opt.kw || ""));
    }
    if (site.type === "gz") {
      if (kind === "details") return base + "torrents.php?id=" + opt.id;
      if (kind === "download") return base + "torrents.php?action=download&id=" + opt.id;
      if (kind === "search") return base + "torrents.php?searchstr=" + encodeURIComponent(opt.imdbId || opt.kw || "");
    }
    if (kind === "details") return base + "details.php?id=" + opt.id;
    if (kind === "download") return base + "download.php?id=" + opt.id;
    if (kind === "search") {
      var kw = opt.imdbId || opt.kw || "";
      return base + "torrents.php?incldead=0&spstate=0&inclbookmarked=0&search=" + encodeURIComponent(kw) + "&search_area=" + (opt.imdbId ? "4" : "0") + "&search_mode=0";
    }
    return base;
  }
  function siteMatchHost(site, hostOrUrl) {
    if (!site) return false;
    var host = extractHostKey(hostOrUrl);
    if (!host) return false;
    var cands = [site.url];
    if (site.aliases && site.aliases.length) cands = cands.concat(site.aliases);
    for (var i = 0; i < cands.length; i++) {
      var dbHost = extractHostKey(cands[i]);
      if (!dbHost) continue;
      if (dbHost === host) return true;
      if (host.length > dbHost.length && host.slice(-dbHost.length - 1) === "." + dbHost) return true;
      if (dbHost.length > host.length && dbHost.slice(-host.length - 1) === "." + host) return true;
    }
    return false;
  }
  function hostInSiteDatabase(urlOrHost, database) {
    var host = extractHostKey(urlOrHost);
    if (!host || !database) return false;
    var keys = Object.keys(database);
    for (var i = 0; i < keys.length; i++) {
      if (siteMatchHost(database[keys[i]], host)) return true;
    }
    return false;
  }
  function extractHostKey(urlOrHost) {
    if (!urlOrHost) return "";
    try {
      var h = urlOrHost.indexOf("http") === 0 ? new URL(urlOrHost).hostname : urlOrHost;
      return h.replace(/^www\./i, "").toLowerCase();
    } catch (e) {
      return String(urlOrHost).toLowerCase();
    }
  }
  function shouldSiteUseApi(siteObj) {
    if (!siteObj) return false;
    return (siteObj.type === "unit3d" || siteObj.type === "gz") && !!siteObj.apiKey;
  }

  // src/lib/bdinfo.js
  var normS = function(s) {
    return s.replace(/\s*\/\s*/g, " / ").replace(/\s+/g, " ").trim();
  };
  var noComma = function(s) {
    var p;
    do {
      p = s;
      s = s.replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
    } while (s !== p);
    return s;
  };
  var normBytes = function(v) {
    var m = (v || "").match(/[\d,]+/);
    return m ? Number(m[0].replace(/,/g, "")).toLocaleString("en-US") + " bytes" : v;
  };
  var normLen = function(v) {
    var m = (v || "").match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
    return m ? parseInt(m[1], 10) + ":" + m[2] + ":" + m[3] : v;
  };
  var normFps = function(l, roundFlag) {
    return roundFlag ? l.replace(/(\d+(?:\.\d+)?)\s*fps/i, function(_, n) {
      return Math.round(parseFloat(n)) + " fps";
    }) : l;
  };
  function parseBd(raw, roundFlag) {
    var useRound = roundFlag === true;
    var d = { title: "", label: "", discSize: "", protection: "", playlist: "", size: "", length: "", bitrate: "", videos: [], audios: [], subs: [] };
    String(raw || "").split(/\r?\n/).map(function(l) {
      return l.replace(/\u00a0/g, " ").trim();
    }).filter(Boolean).forEach(function(line) {
      var m;
      if (m = line.match(/^Disc Title:\s*(.+)$/i)) d.title = m[1].trim();
      else if (m = line.match(/^Disc Label:\s*(.+)$/i)) d.label = m[1].trim();
      else if (m = line.match(/^Disc Size:\s*(.+)$/i)) d.discSize = normBytes(m[1]);
      else if (m = line.match(/^Protection:\s*(.+)$/i)) d.protection = m[1].trim();
      else if (m = line.match(/^Playlist:\s*(.+)$/i)) d.playlist = m[1].trim();
      else if (m = line.match(/^Size:\s*(.+)$/i)) d.size = normBytes(m[1]);
      else if (m = line.match(/^Length:\s*(.+)$/i)) d.length = normLen(m[1].trim());
      else if (m = line.match(/^Total Bitrate:\s*(.+)$/i)) d.bitrate = m[1].trim().replace(/\s+/g, " ");
      else if (m = line.match(/^Video:\s*(.+)$/i)) d.videos.push(normFps(noComma(normS(m[1])), useRound));
      else if (m = line.match(/^Audio:\s*(.+)$/i)) d.audios.push(noComma(normS(m[1])));
      else if (m = line.match(/^Subtitles?:\s*(.+)$/i)) d.subs.push(noComma(normS(m[1])));
    });
    if (!d.label && d.title) d.label = d.title;
    return d;
  }
  function nameFromLabel(l) {
    if (!l) return "";
    var s = l.replace(/[._]/g, " ");
    var i = s.search(/\b(19|20)\d{2}\b/);
    return (i >= 0 ? s.slice(0, i) : s).replace(/\s+/g, " ").trim();
  }
  function isDisc4K(d) {
    return /4320p|8K|2160p|UHD|BD66|BD100/i.test((d.videos || []).join(" ")) || /UHD|4320|8K|2160|BD66|BD100/i.test((d.label || "") + " " + (d.title || ""));
  }
  function buildBd(d) {
    var o = [];
    if (d.title) o.push("Disc Title: " + d.title);
    if (d.label) o.push("Disc Label: " + d.label);
    if (d.discSize) o.push("Disc Size: " + d.discSize);
    if (d.protection) o.push("Protection: " + d.protection);
    if (d.playlist) o.push("Playlist: " + d.playlist);
    if (d.size) o.push("Size: " + d.size);
    if (d.length) o.push("Length: " + d.length);
    if (d.bitrate) o.push("Total Bitrate: " + d.bitrate);
    (d.videos || []).forEach(function(v) {
      o.push("Video: " + v);
    });
    (d.audios || []).forEach(function(v) {
      o.push("Audio: " + v);
    });
    (d.subs || []).forEach(function(v) {
      o.push("Subtitle: " + v);
    });
    return o.join("\n");
  }

  // src/lib/subtitle.js
  var LANG_MAP = [
    [/^(english|eng)$/i, "英"],
    [/^(chinese|chi|zho|mandarin|cantonese|yue|中文|汉语|粤语|国语)$/i, "中"],
    [/^(japanese|jpn|日本語|日语)$/i, "日"],
    [/^(korean|kor|한국어|韩语)$/i, "韩"],
    [/^(french|fre|fra|法语)$/i, "法"],
    [/^(german|ger|deu|德语)$/i, "德"],
    [/^(italian|ita|意大利语)$/i, "意"],
    [/^(spanish|spa|西班牙语)$/i, "西"],
    [/^(russian|rus|俄语)$/i, "俄"],
    [/^(portuguese|por|葡语)$/i, "葡"],
    [/^(dutch|dut|nld|荷兰语)$/i, "荷"],
    [/^(swedish|swe|瑞典语)$/i, "瑞"],
    [/^(danish|dan|丹麦语)$/i, "丹"],
    [/^(norwegian|nor|挪威语)$/i, "挪"],
    [/^(finnish|fin|芬兰语)$/i, "芬"],
    [/^(polish|pol|波兰语)$/i, "波"],
    [/^(czech|cze|ces|捷克语)$/i, "捷"],
    [/^(hungarian|hun|匈牙利语)$/i, "匈"],
    [/^(greek|gre|ell|希腊语)$/i, "希"],
    [/^(turkish|tur|土耳其语)$/i, "土"],
    [/^(arabic|ara|阿拉伯语)$/i, "阿"],
    [/^(thai|tha|泰语)$/i, "泰"],
    [/^(hindi|hin|印地语)$/i, "印"]
  ];
  var REGION_TAG_MAP = {
    "USA": "美",
    "US": "美",
    "GER": "德",
    "DEU": "德",
    "FRA": "法",
    "ITA": "意",
    "UK": "英",
    "GBR": "英",
    "JPN": "日",
    "KOR": "韩",
    "HKG": "港",
    "HK": "港",
    "TWN": "台",
    "TW": "台",
    "CHN": "国",
    "CN": "国",
    "AUS": "澳",
    "CAN": "加",
    "RUS": "俄",
    "ESP": "西",
    "NLD": "荷",
    "BEL": "比",
    "SWE": "瑞",
    "POL": "波",
    "AUT": "奥",
    "CHE": "瑞",
    "DNK": "丹",
    "FIN": "芬",
    "NOR": "挪",
    "NZL": "新",
    "IND": "印",
    "THA": "泰",
    "BRA": "巴",
    "MEX": "墨",
    "ARG": "阿",
    "EUR": "欧",
    "CEE": "欧"
  };
  var regionKeys = Object.keys(REGION_TAG_MAP).sort(function(a, b) {
    return b.length - a.length;
  });
  function langChar(name) {
    var s = String(name || "").trim().replace(/\((?:traditional|simplified)\)/i, "").replace(/[\s_-]+(?:traditional|simplified)$/i, "").trim();
    for (var i = 0; i < LANG_MAP.length; i++) {
      if (LANG_MAP[i][0].test(s)) return LANG_MAP[i][1];
    }
    return "";
  }
  function langOfLine(line) {
    var head = String(line || "").split("/")[0].trim();
    return langChar(head) || (head ? head.replace(/\s+/g, "") : "");
  }
  function langSet(lines) {
    var set = [];
    (lines || []).forEach(function(l) {
      var c = langOfLine(l);
      if (c && set.indexOf(c) < 0) set.push(c);
    });
    var cn = set.filter(function(c) {
      return c === "中";
    });
    var rest = set.filter(function(c) {
      return c !== "中";
    });
    return cn.concat(rest).join("");
  }
  function getRegionFromTitle(title) {
    if (!title) return "";
    var cnMatch = String(title).match(/(美|德|法|意|英|日|韩|港|台|国|澳|加|俄|西|荷|比|瑞|波|奥|丹|芬|挪|新|印|泰|巴|墨|阿|欧)版/);
    if (cnMatch) return cnMatch[1];
    for (var i = 0; i < regionKeys.length; i++) {
      var key = regionKeys[i];
      var regex = new RegExp("(?:^|[^A-Za-z])" + key + "(?:[^A-Za-z]|$)", "i");
      if (regex.test(title)) return REGION_TAG_MAP[key];
    }
    return "";
  }
  var cjk = function(s) {
    return /[\u4e00-\u9fa5]/.test(String(s || ""));
  };
  function parseBbLine(line) {
    var raw = String(line || "");
    var i = raw.indexOf("◎");
    if (i < 0) return null;
    var rest = raw.slice(i + 1);
    var c = rest.search(/[：:]/);
    if (c >= 0) {
      return { label: rest.slice(0, c).replace(/[\s\u3000]+/g, ""), value: rest.slice(c + 1).trim() };
    }
    var m = rest.match(/^(\S(?:.*?\S)?)[\s\u3000]{1,}(.+)$/);
    if (m) return { label: m[1].replace(/[\s\u3000]+/g, ""), value: m[2].trim() };
    return null;
  }
  function pickFromBb(bb, label) {
    var want = label.replace(/[\s\u3000]+/g, "");
    var lines = String(bb || "").split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var p = parseBbLine(lines[i]);
      if (p && p.label === want && p.value) return p.value;
    }
    return "";
  }
  function zhOnly(s) {
    var x = String(s || "").trim();
    if (!x) return "";
    x = x.replace(/\s*[（(][^（）()]*[A-Za-z][^（）()]*[）)]\s*$/, "").trim();
    if (!cjk(x)) return x;
    var parts = x.split(/\s+/).filter(Boolean);
    var keep = [];
    for (var i = 0; i < parts.length; i++) {
      if (/[A-Za-z]/.test(parts[i])) break;
      keep.push(parts[i]);
    }
    var cut = keep.join(" ").trim();
    if (cut) return cut;
    var m = x.match(/^([\u4e00-\u9fa5·•．.・][\u4e00-\u9fa5·•．.・\s]*)/);
    return m ? m[1].trim() : x;
  }
  function pickBbBlock(bb, label) {
    var lines = String(bb || "").split(/\r?\n/);
    var want = label.replace(/[\s\u3000]+/g, "");
    for (var i = 0; i < lines.length; i++) {
      var p = parseBbLine(lines[i]);
      if (!p || p.label !== want) continue;
      var out = [p.value];
      for (var j = i + 1; j < lines.length; j++) {
        var nx = String(lines[j] || "").replace(/\u00a0/g, " ");
        if (!nx.trim()) break;
        if (nx.indexOf("◎") >= 0) break;
        out.push(nx.trim());
      }
      return out.filter(Boolean).join("/");
    }
    return "";
  }
  function castList(raw, limit) {
    var out = [], seen = {};
    var arr = String(raw || "").split(/[\/、，,;；|\r\n]+/);
    for (var i = 0; i < arr.length; i++) {
      var seg = arr[i].replace(/[（(][^（）()]*[)）]/g, " ").trim();
      var s = zhOnly(seg);
      if (!s || seen[s]) continue;
      seen[s] = 1;
      out.push(s);
      if (limit && out.length >= limit) break;
    }
    return out;
  }
  function composeSubtitle(d, bb, cfg, gathered) {
    cfg = cfg || {};
    gathered = gathered || {};
    d = d || {};
    if (!cfg.withSubtitle) return "";
    var name = pickFromBb(bb, "片  名") || pickFromBb(bb, "片名");
    if (!name) name = pickFromBb(bb, "译  名") || pickFromBb(bb, "译名");
    if (!name) name = gathered.cnTitle || nameFromLabel(d.label) || gathered.movieTitle || "";
    name = String(name).split("/")[0].trim();
    var titleSources = gathered.titleSources || [];
    var regionShort = "";
    for (var i = 0; i < titleSources.length; i++) {
      regionShort = getRegionFromTitle(titleSources[i]);
      if (regionShort) break;
    }
    if (!regionShort && gathered.regionHint) regionShort = gathered.regionHint;
    var regionStr = "";
    if (regionShort) regionStr = regionShort + "版";
    if (regionStr || cfg.subDisc) regionStr = (regionStr || "") + (cfg.subDisc || "原盘");
    var director = pickBbBlock(bb, "导  演") || pickBbBlock(bb, "导演");
    director = zhOnly(String(director).split("/")[0].replace(/^演\s*/, "").trim());
    var castRaw = pickBbBlock(bb, "主  演") || pickBbBlock(bb, "主演") || pickFromBb(bb, "主  演") || pickFromBb(bb, "主演");
    var castArr = castList(castRaw, Math.max(1, cfg.subCast | 0));
    var audioLangRaw = langSet(d.audios);
    var audioStr = audioLangRaw ? audioLangRaw + "语" : "原声";
    var subLangRaw = langSet(d.subs);
    var subStr = subLangRaw ? subLangRaw + "字" : "无字";
    var seg = [];
    if (name) seg.push(name);
    if (regionStr) seg.push(regionStr);
    if (director) seg.push("导演:" + director);
    if (castArr.length) seg.push("主演:" + castArr.join(" / "));
    seg.push("[" + audioStr + "]");
    seg.push("[" + subStr + "]");
    return seg.filter(Boolean).join(" | ");
  }
  function buildAll(d, shots, intro, cfgObj) {
    cfgObj = cfgObj || {};
    var p = [];
    if (intro) p.push(String(intro).trim());
    p.push("[img]https://pterclub.net/pic/CS.png[/img]");
    p.push(cfgObj.useHide ? "[hide=bdinfo]\n" + buildBd(d) + "\n[/hide]" : buildBd(d));
    if (cfgObj.useTag) p.push("[img]https://pterclub.net/pic/GDJT.png[/img]");
    if (shots && shots.length) p.push(shots.map(function(u) {
      return "[img]" + u + "[/img]";
    }).join(" "));
    return p.join("\n");
  }

  // src/lib/library.js
  function buildImdbCacheKey(sourceItem) {
    sourceItem = sourceItem || {};
    return normalizeImdbId(sourceItem.imdbId) || stripReleaseTags(sourceItem.movieTitle || sourceItem.mainTitle || "") + "_" + (sourceItem.movieYear || "");
  }
  function buildTitleYearCacheKey(sourceItem) {
    sourceItem = sourceItem || {};
    return stripReleaseTags(sourceItem.movieTitle || sourceItem.mainTitle || "") + "_" + (sourceItem.movieYear || "");
  }
  function imdbDigits(raw) {
    return String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
  }
  function libraryStorageKey(bSiteHost, cacheKey) {
    return (bSiteHost || "") + "::" + cacheKey;
  }
  function isFreshLibraryHit(entry, now, freshMs) {
    if (!entry || !entry.lastResult || entry.lastResult.isError) return false;
    var age = now - (entry.lastCheck || 0);
    return age >= 0 && age < freshMs;
  }
  function trimLibrary(library, maxEntries, protectedKeys) {
    var max = Math.max(10, maxEntries || 500);
    var protect = protectedKeys || {};
    var keys = Object.keys(library);
    if (keys.length <= max) return library;
    var unprotected = [];
    for (var i = 0; i < keys.length; i++) {
      if (!protect[keys[i]]) unprotected.push(keys[i]);
    }
    unprotected.sort(function(a, b) {
      return (library[a].lastCheck || 0) - (library[b].lastCheck || 0);
    });
    var dropCount = Math.min(keys.length - max, unprotected.length);
    for (var j = 0; j < dropCount; j++) delete library[unprotected[j]];
    return library;
  }

  // src/lib/batch.js
  var CHECKPOINT_STORAGE_KEY = "pt_batch_checkpoint";
  var CHECKPOINT_MAX_AGE_MS = 12 * 60 * 60 * 1e3;
  var SERIAL_FIELDS = [
    "page",
    "customPassLabel",
    "torrentId",
    "mainTitle",
    "releaseName",
    "releaseGroup",
    "movieTitle",
    "cnTitle",
    "regionBracket",
    "movieYear",
    "imdbId",
    "downloadUrl"
  ];
  function listingKey(href) {
    var u;
    try {
      u = new URL(href);
    } catch (e) {
      return String(href || "");
    }
    u.hash = "";
    u.searchParams.delete("page");
    var keys = Array.from(u.searchParams.keys()).sort();
    var qs = keys.map(function(k) {
      return k + "=" + u.searchParams.getAll(k).join("\n");
    }).join("&");
    return u.origin + u.pathname + (qs ? "?" + qs : "");
  }
  function isCheckpointRecord(cp, now, maxAgeMs) {
    if (!cp || cp.v !== 1 || !Array.isArray(cp.items)) return false;
    if (!cp.savedAt || now - cp.savedAt > maxAgeMs) return false;
    if (cp.phase === "done") return false;
    return true;
  }
  function isCheckpointUsable(cp, ctx, now, maxAgeMs) {
    if (!isCheckpointRecord(cp, now, maxAgeMs) || !ctx) return false;
    if (cp.siteAHost !== ctx.siteAHost || cp.siteBHost !== ctx.siteBHost) return false;
    if (cp.listKey && ctx.listKey && cp.listKey !== ctx.listKey) {
      cp._listKeyDiff = true;
    }
    return true;
  }
  function serializeItem(item) {
    var out = {
      is4K: !!(item && item.is4K),
      sizeGB: item && item.sizeGB ? item.sizeGB : 0,
      fromApi: !!(item && item.fromApi)
    };
    if (!item) return out;
    SERIAL_FIELDS.forEach(function(key) {
      var val = item[key];
      if (val !== void 0 && val !== null && val !== "") out[key] = val;
    });
    return out;
  }
  function copyRestoredImdbId(live, merged) {
    if (live && merged && merged.imdbId && !normalizeImdbId(live.imdbId)) live.imdbId = merged.imdbId;
    return live;
  }
  function mergeBatchItem(prev, item) {
    if (!prev) return item;
    var merged = Object.assign({}, prev, item || {});
    if (item && !normalizeImdbId(item.imdbId) && prev.imdbId) merged.imdbId = prev.imdbId;
    merged.row = item && item.row || prev.row || null;
    merged.chkBox = item && item.chkBox || prev.chkBox || { checked: true };
    return merged;
  }
  function itemIdentity(item) {
    if (!item) return "";
    return String(item.torrentId || "") || buildImdbCacheKey(item) || item.mainTitle || "";
  }
  function splitBatchByLibrary(items, library, opts) {
    opts = opts || {};
    var skipped = [];
    var pending = [];
    var enabled = opts.enabled !== false;
    var now = opts.now;
    var freshMs = opts.freshMs;
    var host = opts.bSiteHost;
    var findEntry = typeof opts.findEntry === "function" ? opts.findEntry : null;
    for (var i = 0; i < (items || []).length; i++) {
      var item = items[i];
      var cacheKey = buildImdbCacheKey(item);
      var storageKey = libraryStorageKey(host, cacheKey);
      var entry = enabled ? (findEntry ? findEntry(item) : library ? library[storageKey] : null) : null;
      if (isFreshLibraryHit(entry, now, freshMs)) {
        skipped.push({
          item,
          entry,
          cacheKey,
          storageKey,
          age: now - (entry.lastCheck || 0)
        });
      } else {
        pending.push({ item, cacheKey, storageKey, entry: entry || null });
      }
    }
    return { skipped, pending };
  }
  function nextNetworkDelay(baseMs, completedCount, kind) {
    var base = Math.max(0, Number(baseMs) || 0);
    if (kind === "rateLimit") return Math.min(3e4, Math.max(12e3, base * 4));
    if (kind === "error") return Math.min(2e4, Math.max(4e3, base * 2));
    var breather = completedCount > 0 && completedCount % 15 === 0 ? 3e3 : 0;
    return base + breather;
  }

  // src/lib/dupe.js
  function npDiscMatches(source, other) {
    source = source || {};
    other = other || {};
    if (source.is4K === other.is4K) return true;
    var sizeKnown = source.sizeGB > 0 && other.sizeGB > 0;
    if (!sizeKnown) return true;
    var sizeDiff = Math.abs(source.sizeGB - other.sizeGB);
    return sizeDiff <= 2.5 || sizeDiff / source.sizeGB <= 0.05;
  }
  function looseDiscMatches(source, other, toleranceGB) {
    source = source || {};
    other = other || {};
    var tol = toleranceGB == null ? 2.5 : toleranceGB;
    if (other.is4K === source.is4K) return true;
    return source.sizeGB > 0 && other.sizeGB > 0 && Math.abs(source.sizeGB - other.sizeGB) <= tol;
  }

  // src/lib/publish.js
  function inferSourceRegion(synopsisBbcode, standardName, customSubTitle) {
    var textToSearch = synopsisBbcode + " " + standardName + " " + customSubTitle;
    if (/港版|香港/.test(textToSearch)) return "香港";
    if (/台版|台湾|臺灣/.test(textToSearch)) return "台湾";
    if (/国版|大陆|内地/.test(textToSearch)) return "大陆";
    if (/日版|日本/.test(textToSearch)) return "日本";
    if (/韩版|韩国/.test(textToSearch)) return "韩国";
    if (/印版|印度/.test(textToSearch)) return "印度";
    if (RE.US_EU.test(textToSearch)) return "欧美";
    return "欧美";
  }
  function bdinfoSubtitleFlags(bdinfoText) {
    var res = { found: false, en: false, zh: false, ja: false, ko: false };
    String(bdinfoText || "").split(/\r?\n/).forEach(function(line) {
      var m = line.match(/^\s*Subtitles?\s*:\s*(.+)$/i);
      if (!m) return;
      res.found = true;
      var v = m[1];
      if (/\bEnglish\b|\bENG\b/i.test(v)) res.en = true;
      if (/\bChinese\b|\bMandarin\b|\bCantonese\b|\bCHS\b|\bCHT\b|中文|中字/i.test(v)) res.zh = true;
      if (/\bJapanese\b|\bJPN\b|日语|日語/i.test(v)) res.ja = true;
      if (/\bKorean\b|\bKOR\b|韩语|韓語/i.test(v)) res.ko = true;
    });
    return res;
  }
  function inferTorrentLabels(standardName, customSubTitle, synopsisBbcode, bdinfoText) {
    var combined = (standardName + " " + customSubTitle + " " + synopsisBbcode + " " + bdinfoText).toUpperCase();
    var bdSub = bdinfoSubtitleFlags(bdinfoText);
    var yz = bdSub.found ? bdSub.en : /英字|中英字幕|中英双语|ENGLISH/i.test(combined);
    return {
      gy: /国语|国配|MANDARIN|CHINESE/i.test(combined),
      yy: /粤语|粤配|CANTONESE/i.test(combined),
      zz: bdSub.zh || /中字|中文|CHS|CHT/i.test(combined),
      yz: yz,
      diy: /DIY/i.test(combined),
      hdr10: /HDR10\b/i.test(combined),
      hdr10plus: /HDR10\+/i.test(combined),
      db: /杜比视界|DOLBY VISION|DOVI/i.test(combined)
    };
  }

  // src/main.js
  (function() {
    "use strict";
    var IS_DOUBAI = /(^|\.)doubaninfo\.com$/i.test(location.hostname);
    var HANDOFF = "dv_handoff_v9";
    if (IS_DOUBAI) {
      doubanInit();
      return;
    }
    var rootWin = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    var BADGE_DICT = {
      NON_MOVIE: { tag: "skip", cls: "pt-badge-fail", text: "跳过: 非电影" },
      DVD: { tag: "skip", cls: "pt-badge-fail", text: "跳过: DVD" },
      NON_DISC: { tag: "skip", cls: "pt-badge-fail", text: "跳过: 非原盘" },
      GZ_SKIP: { tag: "skip", cls: "pt-badge-fail", text: "跳过: 非电影原盘" },
      ENCODE: { tag: "skip", cls: "pt-badge-fail", text: "跳过: 非纯原盘" },
      DIY_SKIP: { tag: "skip", cls: "pt-badge-fail", text: "跳过: DIY修改版" },
      FORBIDDEN: { tag: "limit", cls: "pt-badge-warn-limit", text: "⛔ 跳过: 禁转/独占" },
      LIMIT7: { tag: "limit", cls: "pt-badge-warn-limit", text: "⏳ 跳过: 限转未满7天" },
      CLEAN: { tag: "clean", cls: "pt-badge-clean", text: "✅ B站暂无此原盘 (可发)" },
      DIY_PASS: { tag: "diy", cls: "pt-badge-dupe-diy", text: "💡 B站仅有DIY (可发纯原盘) [复核]" },
      DUPE: { tag: "dupe", cls: "pt-badge-dupe-untouched", text: "⚠️ B站已有原盘" },
      ERROR: { tag: "error", cls: "pt-badge-fail", text: "❌ 请求失败: " }
    };
    var TOOLBAR_BTN_DEFS = [
      { cls: "pt-single-check-btn", text: "🔍查B站", act: "row-check" },
      { cls: "pt-single-forward-btn", text: "🚀转种", act: "row-forward" },
      { cls: "pt-single-qb-btn", text: "📥推qB", act: "row-qb", needDl: true }
    ];
    var QUEUE_BTN_DEFS = [
      { cls: "pt-single-qb-btn", text: "📥qB", act: "row-qb", css: "" },
      { cls: "pt-single-forward-btn", text: "🚀转种", act: "row-forward", css: "" },
      { cls: "pt-single-forward-btn", text: "⚡全套", act: "row-combo", css: "background:#f0fdf4; border-color:#bbf7d0; color:#166534;" }
    ];
    var auditedList = [];
    var pendingQueue = GM_getValue("pt_pending_queue", []);
    var imdbResultCache = /* @__PURE__ */ new Map();
    var siteAApiMap = /* @__PURE__ */ new Map();
    var isCheckingCancelled = false;
    var batchProtectedKeys = null;
    var apiCrawlCursor = { nextPage: 1, done: false };
    var isHideMode = GM_getValue("pt_hide_mode", false);
    var imdbLibrary = {};
    var LIB_SHARD_COUNT = 32;
    var LIB_SHARD_PREFIX = "pt_imdb_library_";
    var libShardsLoaded = false;
    var libShardKeys = [];
    var libDirtyShards = [];
    var libFlushTimer = null;
    var libIndex = null;
    function libShardName(idx) {
      return LIB_SHARD_PREFIX + (idx < 10 ? "0" : "") + idx;
    }
    function libHashKey(key) {
      var h = 5381, s = String(key || "");
      for (var i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0;
      return h % LIB_SHARD_COUNT;
    }
    function markLibDirty(key) {
      libDirtyShards[libHashKey(key)] = true;
    }
    function markAllLibDirty() {
      for (var i = 0; i < LIB_SHARD_COUNT; i++) libDirtyShards[i] = true;
    }
    function rebuildLibShardKeys() {
      libShardKeys = [];
      for (var i = 0; i < LIB_SHARD_COUNT; i++) libShardKeys[i] = [];
      Object.keys(imdbLibrary).forEach(function(k) {
        libShardKeys[libHashKey(k)].push(k);
      });
    }
    function loadLibraryShards() {
      if (libShardsLoaded) return;
      libShardsLoaded = true;
      var merged = {};
      var hadShard = false;
      for (var i = 0; i < LIB_SHARD_COUNT; i++) {
        var part = null;
        try {
          part = GM_getValue(libShardName(i), null);
        } catch (e) {
          part = null;
        }
        if (part && typeof part === "object") {
          var pk = Object.keys(part);
          if (pk.length) hadShard = true;
          for (var j = 0; j < pk.length; j++) merged[pk[j]] = part[pk[j]];
        }
      }
      var legacy = null;
      try {
        legacy = GM_getValue("pt_imdb_library", null);
      } catch (e) {
        legacy = null;
      }
      var migrated = 0;
      if (legacy && typeof legacy === "object") {
        var lk = Object.keys(legacy);
        for (var m = 0; m < lk.length; m++) {
          if (!merged[lk[m]]) {
            merged[lk[m]] = legacy[lk[m]];
            migrated++;
          }
        }
      }
      imdbLibrary = merged;
      rebuildLibShardKeys();
      libIndex = null;
      if (migrated > 0 || (legacy && !hadShard && Object.keys(legacy || {}).length)) {
        try {
          GM_setValue("pt_imdb_library", {});
        } catch (e) {
        }
      }
      markAllLibDirty();
      if (migrated > 0 || !hadShard) flushLibShards(true);
      else {
        for (var z = 0; z < LIB_SHARD_COUNT; z++) libDirtyShards[z] = false;
      }
    }
    function ensureLibLoaded() {
      if (!libShardsLoaded) loadLibraryShards();
    }
    function flushLibShards(force) {
      if (!libShardsLoaded) return 0;
      var wrote = 0;
      for (var i = 0; i < LIB_SHARD_COUNT; i++) {
        if (!force && !libDirtyShards[i]) continue;
        var obj = {}, list = libShardKeys[i] || [];
        for (var j = 0; j < list.length; j++) {
          var k = list[j];
          if (imdbLibrary[k]) obj[k] = imdbLibrary[k];
        }
        try {
          GM_setValue(libShardName(i), obj);
        } catch (e) {
        }
        libDirtyShards[i] = false;
        wrote++;
      }
      return wrote;
    }
    function scheduleLibFlush(delayMs) {
      if (libFlushTimer) return;
      libFlushTimer = setTimeout(function() {
        libFlushTimer = null;
        flushLibShards(false);
      }, delayMs || 2e3);
    }
    function libAliasKey(host, alias) {
      return host + "|" + alias;
    }
    function ensureLibIndex() {
      ensureLibLoaded();
      if (libIndex) return;
      libIndex = /* @__PURE__ */ Object.create(null);
      Object.keys(imdbLibrary).forEach(function(storageKey) {
        var entry = imdbLibrary[storageKey];
        if (!entry) return;
        var cut = storageKey.indexOf("::");
        var host = cut >= 0 ? storageKey.substring(0, cut) : "";
        var cacheKey = entry.cacheKey || (cut >= 0 ? storageKey.substring(cut + 2) : storageKey);
        var digits = imdbDigits(entry.imdbId);
        if (digits) libIndex[libAliasKey(host, "#" + digits)] = cacheKey;
        if (Array.isArray(entry.torrentIds)) {
          entry.torrentIds.forEach(function(t) {
            if (t) libIndex[libAliasKey(host, "tid:" + t)] = cacheKey;
          });
        }
        var ty = entry.titleYearKey || buildTitleYearCacheKey(entry);
        if (ty && ty !== "_") libIndex[libAliasKey(host, "ty:" + ty)] = cacheKey;
      });
    }
    function lookupLibraryEntry(item) {
      if (!config.libraryEnabled || !item) return null;
      ensureLibLoaded();
      var host = getCurrentBSiteHost();
      var directKey = getLibraryKey(buildImdbCacheKey(item), host);
      if (imdbLibrary[directKey]) return imdbLibrary[directKey];
      ensureLibIndex();
      var aliases = [];
      var digits = imdbDigits(item.imdbId);
      if (digits) aliases.push("#" + digits);
      if (item.torrentId) aliases.push("tid:" + String(item.torrentId));
      var ty = buildTitleYearCacheKey(item);
      if (ty && ty !== "_") aliases.push("ty:" + ty);
      for (var i = 0; i < aliases.length; i++) {
        var ck = libIndex[libAliasKey(host, aliases[i])];
        if (!ck) continue;
        var entry = imdbLibrary[getLibraryKey(ck, host)];
        if (entry) return entry;
      }
      return null;
    }
    var lastPageHtmlHash = "";
    var restoreDebounceTimer = null;
    var doubanPollingTimer = null;
    var activeDoubanTt = "";
    var $ = function(sel, ctx) {
      return (ctx || document).querySelector(sel);
    };
    var $$ = function(sel, ctx) {
      return Array.from((ctx || document).querySelectorAll(sel));
    };
    var ACTION_BUS = /* @__PURE__ */ Object.create(null);
    function bindAction(actName, handler) {
      ACTION_BUS[actName] = handler;
    }
    document.addEventListener("click", function(e) {
      var triggerEl = e.target && e.target.closest ? e.target.closest("[data-pt-act]") : null;
      if (!triggerEl) return;
      var act = triggerEl.getAttribute("data-pt-act");
      if (act && typeof ACTION_BUS[act] === "function") {
        e.preventDefault();
        ACTION_BUS[act](triggerEl, e);
      }
    });
    function el(tag, cls, text, cssText, actName) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== void 0 && text !== null) node.innerText = text;
      if (cssText) node.style.cssText = cssText;
      if (actName) node.setAttribute("data-pt-act", actName);
      return node;
    }
    function dispatchEvt(node) {
      if (!node) return;
      ["input", "change"].forEach(function(t) {
        try {
          node.dispatchEvent(new Event(t, { bubbles: true }));
        } catch (e) {
        }
      });
    }
    function pushUnique(arr, val) {
      if (val && arr.indexOf(val) === -1) arr.push(val);
    }
    function readRowSize(row, sel) {
      var subNode = sel ? $(sel, row) : null;
      var txt = subNode && subNode.textContent || (row ? row.textContent : "") || "";
      var m = txt.match(RE.ROW_SIZE);
      return m ? parseSizeToGB(m[0]) : 0;
    }
    function http(url, opts) {
      opts = opts || {};
      return new Promise(function(resolve, reject) {
        GM_xmlhttpRequest({
          method: opts.method || "GET",
          url,
          headers: opts.headers || {},
          data: opts.data,
          responseType: opts.responseType,
          timeout: opts.timeout || 12e3,
          onload: function(res) {
            if (opts.rawResponse) return resolve(res);
            if (res.status === 429) return reject(new Error("HTTP 429"));
            if (res.status < 200 || res.status >= 300) return reject(new Error("HTTP " + res.status));
            if (opts.responseType === "json") {
              try {
                resolve(JSON.parse(res.responseText));
              } catch (e) {
                reject(new Error("JSON 解析失败"));
              }
            } else resolve(res.responseText);
          },
          onerror: function() {
            reject(new Error("网络请求异常"));
          },
          ontimeout: function() {
            reject(new Error("请求超时"));
          }
        });
      });
    }
    function isLoginDoc(doc) {
      try {
        if (!doc) return false;
        if (doc.querySelector('input[name="username"], input[name="password"], form[action*="login"], #login-form, .login-form')) return true;
        var t = (doc.body && doc.body.textContent || "").slice(0, 6000);
        return /请先登录|还未登录|登录后才能|需要登录|请登录后继续|账号或密码错误|Not logged in|You must be logged in/i.test(t);
      } catch (e) {
        return false;
      }
    }
    function authLostError() {
      var e = new Error("AUTH_LOST：目标站登录态已失效（很可能因请求过快被站点强制退出）");
      e.code = "AUTH_LOST";
      return e;
    }
    async function fetchDoc(url) {
      var res = await http(url, { rawResponse: true, timeout: 15e3 });
      if (res.status === 429) throw new Error("HTTP 429");
      if (res.status === 403) {
        var e403 = new Error("HTTP 403（站点拒绝访问，多为请求过快）");
        e403.code = "FLOOD";
        throw e403;
      }
      if (res.status !== 200) throw new Error("HTTP " + res.status);
      if (res.finalUrl && /login|signin/i.test(res.finalUrl)) throw authLostError();
      var safeHtml = (res.responseText || "").replace(/\s+src=/ig, " data-src=");
      var doc = new DOMParser().parseFromString(safeHtml, "text/html");
      if (isLoginDoc(doc)) throw authLostError();
      return doc;
    }
    function log(msg, type) {
      var logBox = $("#pt-log-box");
      if (!logBox) return;
      if (logBox.textContent.length > 2e4) {
        var lines = logBox.textContent.split("\n");
        logBox.textContent = lines.slice(-300).join("\n") + "\n";
      }
      logBox.innerText += "[" + (/* @__PURE__ */ new Date()).toLocaleTimeString() + "] [" + (type || "INFO") + "] " + msg + "\n";
      logBox.scrollTop = logBox.scrollHeight;
    }
    function cleanRowTags(container) {
      if (!container) return;
      $$(".pt-inline-toolbar, .pt-audit-badge, .pt-dupe-badge", container).forEach(function(n) {
        n.remove();
      });
    }
    function stampRowDataset(row, item) {
      if (!row || !row.dataset) return;
      row.dataset.ptRow = "auditable";
      row.dataset.ptTid = item.torrentId || "";
      row.dataset.ptImdb = item.imdbId || "";
      row.dataset.ptSize = String(item.sizeGB || 0);
      row.dataset.pt4k = item.is4K ? "1" : "0";
      row.dataset.ptTag = "pass";
    }
    function markSkip(anchor, row, code, extraText) {
      if (!anchor || !anchor.parentNode) return;
      var def = BADGE_DICT[code] || BADGE_DICT.NON_DISC;
      if (row) row.setAttribute("data-pt-tag", def.tag);
      var txt = def.text + (extraText ? " (" + extraText + ")" : "");
      anchor.parentNode.insertBefore(el("span", "pt-audit-badge " + def.cls, txt, "margin-right:6px;"), anchor);
    }
    function createInlineToolbar(itemData, targetRow, parentContainer, anchorElement) {
      stampRowDataset(targetRow, itemData);
      var toolbar = el("div", "pt-inline-toolbar");
      var bChk = el("input", "pt-custom-chk");
      bChk.type = "checkbox";
      bChk.checked = true;
      itemData.chkBox = bChk;
      var bBadge = el("span", "pt-audit-badge pt-badge-pass", itemData.customPassLabel || (itemData.fromApi ? "⚡API原盘" : "🌐网页原盘"));
      itemData.badge = bBadge;
      toolbar.append(bChk, bBadge);
      TOOLBAR_BTN_DEFS.forEach(function(def) {
        if (def.needDl && !itemData.downloadUrl) return;
        var btn = el("a", def.cls, def.text, "", def.act);
        btn._ptItem = itemData;
        btn._ptRow = targetRow;
        toolbar.appendChild(btn);
      });
      parentContainer.insertBefore(toolbar, anchorElement);
    }
    function renderDupeBadge(node, sourceItem, result, fromLibrary) {
      if (!node) return;
      var vKey = result.isError ? "ERROR" : result.hasUntouchedDupe ? "DUPE" : result.hasDiyOnly ? "DIY_PASS" : "CLEAN";
      var vDef = BADGE_DICT[vKey];
      var badgeTxt = (fromLibrary ? "📚 " : "") + vDef.text;
      if (vKey === "DUPE") badgeTxt += " (" + (result.matchedSizeGB ? result.matchedSizeGB.toFixed(1) + "G" : "已存") + ") [复核]";
      node.setAttribute("data-pt-tag", vDef.tag);
      var existBadge = $(".pt-dupe-badge", node);
      if (existBadge) existBadge.remove();
      var dupeBadge = el("a", "pt-dupe-badge " + vDef.cls, badgeTxt);
      dupeBadge.target = "_blank";
      dupeBadge.href = result.verifyUrl || "#";
      dupeBadge.title = fromLibrary ? "来自词库缓存（" + Math.floor((result._libraryAge || 0) / 36e5) + " 小时前查重）" : "本次实时查询";
      var toolbar = $(".pt-inline-toolbar", node), auditBadge = $(".pt-audit-badge", node);
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
        row,
        page: curPage,
        fromApi: !!verdict.fromApi,
        customPassLabel: verdict.customPassLabel || "",
        torrentId: verdict.torrentId || "",
        mainTitle: verdict.mainTitle || verdict.releaseName || "",
        releaseName: verdict.releaseName || verdict.mainTitle || "",
        releaseGroup: verdict.releaseGroup || parsed.releaseGroup,
        movieTitle: verdict.movieTitle || parsed.movieTitle,
        cnTitle: verdict.cnTitle || "",
        regionBracket: verdict.regionBracket || "",
        movieYear: verdict.movieYear || parsed.movieYear,
        imdbId: normalizeImdbId(verdict.imdbId),
        bdinfo: verdict.bdinfo || "",
        sizeGB: verdict.sizeGB || 0,
        is4K: verdict.is4K !== void 0 ? verdict.is4K : parsed.is4K,
        downloadUrl: verdict.downloadUrl || ""
      };
      if (anchor && anchor.parentElement) {
        createInlineToolbar(item, row, anchor.parentElement, anchor);
        if (config.libraryEnabled && row) {
          var libEntry = lookupLibraryEntry(item);
          if (isFreshLibraryHit(libEntry, Date.now(), getLibraryFreshMs())) {
            var cacheKey = libEntry.cacheKey || buildImdbCacheKey(item);
            var age = Date.now() - (libEntry.lastCheck || 0);
            var result = Object.assign({}, libEntry.lastResult, { _fromLibrary: true, _libraryAge: age });
            if (!result.verifyUrl) result.verifyUrl = siteUrl(getSiteBInfo(), "search", { imdbId: item.imdbId, kw: item.movieTitle });
            renderDupeBadge(row, item, result, true);
            var vKey = result.isError ? "ERROR" : result.hasUntouchedDupe ? "DUPE" : result.hasDiyOnly ? "DIY_PASS" : "CLEAN";
            if (vKey === "CLEAN" || vKey === "DIY_PASS") {
              if (!pendingQueue.some(function(x) {
                return buildImdbCacheKey(x) === cacheKey;
              })) {
                pendingQueue.push(item);
                GM_setValue("pt_pending_queue", pendingQueue);
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
      var mk = ["Disc Label:", "Disc Size:", "Playlist:", "Total Bitrate:"];
      var sc = function(t) {
        return mk.reduce(function(n, m2) {
          return n + (t.indexOf(m2) >= 0 ? 1 : 0);
        }, 0);
      };
      var best = "", bs = 0;
      $$("pre, code, textarea, blockquote, .mediainfo", ctx).forEach(function(node) {
        if (node.id === "pt-edit-desc" || node.id === "pt-edit-sub" || node.id === "pt-manual-bd") return;
        var t = node.value || node.innerText || node.textContent || "";
        if (t.length < 60 || t.length > 35e3) return;
        var s2 = sc(t);
        if (s2 >= 2 && s2 > bs) {
          best = t;
          bs = s2;
        }
      });
      if (best) return best;
      var bodyEl = ctx.body || ctx.documentElement;
      var full = bodyEl && (bodyEl.innerText || bodyEl.textContent) || "";
      var m = /Disc\s+(?:Title|Label):/i.exec(full);
      if (!m) return "";
      var keep = [];
      var lines = full.slice(m.index).split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        var s = lines[i].replace(/\u00a0/g, " ").trim();
        if (!s) {
          if (keep.length > 5) break;
          continue;
        }
        if (!/^(Disc Title:|Disc Label:|Disc Size:|Protection:|Playlist:|Size:|Length:|Total Bitrate:|Video:|Audio:|Subtitles?:|\*{3,}|QUICK SUMMARY)/i.test(s)) {
          if (keep.length > 5) break;
          continue;
        }
        keep.push(s);
      }
      return keep.length >= 4 ? keep.join("\n") : "";
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
      var h1 = $("h1", docCtx) || $("h1", document);
      if (h1) titleSources.push(h1.textContent);
      var regionHint = "";
      var movieEl = $$("div, span, a, td", docCtx).find(function(node) {
        return (node.textContent || "").trim() === "Movies";
      });
      if (movieEl && movieEl.parentElement) regionHint = getRegionFromTitle(movieEl.parentElement.textContent);
      return composeSubtitle(d, bb, cfgObj, {
        cnTitle: extraCtx.cnTitle || "",
        movieTitle: extraCtx.movieTitle || "",
        titleSources,
        regionHint
      });
    }
    var IMG_RE = /(pixhost\.to|ptscreens\.com|imgbox\.com|turboimagehost\.com|imagebam\.com|postimg\.cc|imgur\.com|ibb\.co|pixl\.is|imgs\.li|blutopia\.cc)/i;
    var IMG_EXT_RE = /\.(jpe?g|png|gif|webp|bmp)(?:[?#]|$)/i;
    var IMG_DENY_RE = /\/pic\/|logo|icon|avatar|smiley|emot|banner|sprite|favicon|cover|poster|gravatar|tmdb|doubanio|googleusercontent|gstatic|googleapis|discord|facebook|twitter|cloudflare|w3\.org/i;
    var SCREEN_MARK_RE = /(?:screens?(?:hots?)?\s*[:：]|截\s*图|screen\s*cap)/i;
    var IMG_VIEWER_RE = /\/(show|image|album|view|gallery|viewer|photo)\//i;
    var SHOT_ROOT_SELECTORS = [".bbcode-rendered", ".torrent-description", "#kdescr", ".torrent-description__body", "#description", "section.torrent-description"];
    function isShotCandidate(u, relaxed) {
      if (!u) return false;
      if (IMG_DENY_RE.test(u)) return false;
      if (IMG_RE.test(u)) return true;
      if (!relaxed) return false;
      if (IMG_EXT_RE.test(u)) return true;
      try {
        return /^(img|image|i|cdn|pic|pix|s3)\./i.test(new URL(u).hostname);
      } catch (e) {
        return false;
      }
    }
    var THUMB_SUFFIX_RE = /[._-](?:md|th|sm|thumb|thumbnail|small)(?=\.(?:png|jpe?g|gif|webp|bmp)$)/i;
    var SIZE_SUFFIX_RE = /[._-]\d{2,5}x\d{2,5}(?=\.(?:png|jpe?g|gif|webp|bmp)$)/i;
    var IMG_PROXY_HOST_RE = /(?:^|\.)(?:wsrv\.nl|weserv\.nl|imageproxy\.[a-z.]+|statically\.io|images\.wsrv\.nl)$/i;
    function unwrapImageProxy(s) {
      if (!s) return s;
      try {
        var u2 = new URL(s);
        var inner = u2.searchParams.get("url") || u2.searchParams.get("u") || u2.searchParams.get("src") || "";
        if (!inner) return s;
        if (!IMG_PROXY_HOST_RE.test(u2.hostname) && !/^(wsrv\.nl)$/i.test(u2.hostname)) return s;
        var dec = "";
        try {
          dec = decodeURIComponent(inner);
        } catch (e) {
          dec = inner;
        }
        if (/^https?:\/\//i.test(dec)) return dec;
      } catch (e) {
      }
      return s;
    }
    function fullSize(u) {
      var s = (u || "").trim();
      if (!s || /^data:/i.test(s)) return "";
      if (s.startsWith("//")) s = location.protocol + s;
      if (!/^https?:/i.test(s)) return "";
      s = unwrapImageProxy(s);
      s = s.replace(/([?&])(?:w|width|h|height|resize|size|maxwidth|mw|q|quality|fit)=\d+(?=&|$)/gi, "$1");
      s = s.replace(/([?&])&+/g, "$1").replace(/[?&]+$/, "");
      s = s.replace(/\/\/t(\d+)\.pixhost\.to\/thumbs\//i, "//img$1.pixhost.to/images/");
      s = s.replace(THUMB_SUFFIX_RE, "");
      s = s.replace(SIZE_SUFFIX_RE, "");
      return s;
    }
    function shotBaseKey(u) {
      return unwrapImageProxy(String(u || "")).replace(THUMB_SUFFIX_RE, "").replace(SIZE_SUFFIX_RE, "").replace(/[?#].*$/, "");
    }
    function pickShotRoot(ctx) {
      if (!ctx || !ctx.querySelectorAll) return null;
      var cands = [];
      SHOT_ROOT_SELECTORS.forEach(function(s) {
        try {
          Array.prototype.push.apply(cands, Array.from(ctx.querySelectorAll(s)));
        } catch (e) {
        }
      });
      var best = null, bestScore = -1;
      cands.forEach(function(n) {
        if (!n || !n.querySelectorAll) return;
        var txt = n.textContent || "";
        if (txt.length < 20) return;
        var score = n.querySelectorAll("img").length * 1e3 + Math.min(999, Math.floor(txt.length / 50));
        if (score > bestScore) {
          bestScore = score;
          best = n;
        }
      });
      return best;
    }
    function pickShotRoots(ctx) {
      if (!ctx || !ctx.querySelectorAll) return [];
      var cands = [];
      SHOT_ROOT_SELECTORS.forEach(function(s) {
        try {
          Array.prototype.push.apply(cands, Array.from(ctx.querySelectorAll(s)));
        } catch (e) {
        }
      });
      var uniq = [];
      cands.forEach(function(n) {
        if (!n || !n.querySelectorAll) return;
        if ((n.textContent || "").length < 20 && n.querySelectorAll("img").length === 0) return;
        if (uniq.indexOf(n) === -1) uniq.push(n);
      });
      uniq.sort(function(a, b) {
        return b.querySelectorAll("img").length - a.querySelectorAll("img").length;
      });
      return uniq;
    }
    function collectFromRoot(root, relaxed) {
      var before = [], after = [], seen = /* @__PURE__ */ new Set(), passed = false;
      (function walk(node) {
        for (var ch = node.firstChild; ch; ch = ch.nextSibling) {
          if (ch.nodeType === 3) {
            if (!passed && SCREEN_MARK_RE.test(ch.nodeValue || "")) passed = true;
            continue;
          }
          if (ch.nodeType !== 1) continue;
          if (ch.closest && ch.closest("#pt-checker-panel, #pt-cfg-modal, #pt-lib-modal, #pt-edit-preview")) continue;
          var tag = ch.tagName;
          if (tag === "IMG") {
            var w = ch.naturalWidth || ch.width || 0, h = ch.naturalHeight || ch.height || 0;
            if (w && h && w < 150 && h < 150) continue;
            var cs = [ch.getAttribute("src"), ch.getAttribute("data-src"), ch.getAttribute("data-original")];
            var ss = ch.getAttribute("srcset");
            if (ss) {
              var bestUrl = "", bestW = -1;
              ss.split(",").forEach(function(part) {
                var bits = String(part || "").trim().split(/\s+/);
                if (!bits[0]) return;
                var w = parseInt(bits[1], 10);
                if (!isFinite(w)) w = 0;
                if (bestW === -1 || w > bestW) {
                  bestW = w;
                  bestUrl = bits[0];
                }
              });
              if (bestUrl) cs.unshift(bestUrl);
            }
            for (var i = 0; i < cs.length; i++) {
              var u = fullSize(cs[i]);
              if (!isShotCandidate(u, relaxed) || seen.has(u)) continue;
              seen.add(u);
              (passed ? after : before).push(u);
            }
            continue;
          }
          if (tag === "A") {
            var href = fullSize(ch.getAttribute("href"));
            if (href && IMG_EXT_RE.test(href) && !IMG_VIEWER_RE.test(href) && isShotCandidate(href, relaxed) && !seen.has(href)) {
              seen.add(href);
              (passed ? after : before).push(href);
            }
          }
          walk(ch);
        }
      })(root);
      return after.length ? after : before;
    }
    function collectShots(maxShots, rootDoc, rawBbcodeText) {
      var ctx = rootDoc || document;
      var limit = maxShots !== void 0 && maxShots !== null ? maxShots : config.maxShots !== void 0 ? config.maxShots : 15;
      var list = [], seen = /* @__PURE__ */ new Set();
      function pushAll(arr) {
        (arr || []).forEach(function(u) {
          if (!u) return;
          var k = shotBaseKey(u);
          if (seen.has(k)) return;
          seen.add(k);
          list.push(u);
        });
      }
      var roots = pickShotRoots(ctx);
      roots.forEach(function(r) {
        pushAll(collectFromRoot(r, true));
      });
      var whole = ctx.body || ctx.documentElement;
      if (!list.length && whole) pushAll(collectFromRoot(whole, false));
      if (!list.length && whole) pushAll(collectFromRoot(whole, true));
      if (rawBbcodeText) {
        var bbImgRe = /\[img\](https?:\/\/[^\s\[\]]+)\[\/img\]/gi, m;
        while ((m = bbImgRe.exec(rawBbcodeText)) !== null) {
          var u2 = fullSize(m[1]);
          if (isShotCandidate(u2, true)) pushAll([u2]);
        }
      }
      return list.slice(0, Math.max(0, limit));
    }
  // src/lib/imgbed.js
  // 图床代理页（在 s3.pterclub.net 上运行）：PterClub 单点登录 + 逐张转存，结果写回 GM 存储
  function runImgBedWorker() {
    var jobMatch = /[?&]pt_imgbed_job=([\w\-]+)/.exec(location.search || "");
    if (!jobMatch) {
      // 单点登录跳回来时参数会丢，用 GM 里记录的 job 续上
      var pend = GM_getValue("pt_imgbed_job", null);
      if (pend && pend.id && !pend.done && pend.phase === "auth" && Date.now() - (pend.authAt || 0) < 6e5) {
        location.replace("/upload?pt_imgbed_job=" + encodeURIComponent(pend.id));
      }
      return;
    }
    var jobId = jobMatch[1];
    var W_EXT_RE = /\.(jpe?g|png|gif|webp|bmp)(?:[?#]|$)/i;
    var badgeEl = null;
    function badge(text) {
      if (!badgeEl) {
        badgeEl = document.createElement("div");
        badgeEl.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#111827;color:#f9fafb;font:12px/1.65 system-ui,-apple-system,'Segoe UI',sans-serif;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);max-width:340px;";
        (document.body || document.documentElement).appendChild(badgeEl);
      }
      badgeEl.textContent = text;
    }
    function jobRead() {
      var j = GM_getValue("pt_imgbed_job", null);
      return j && j.id === jobId ? j : null;
    }
    function jobPatch(patch) {
      var j = jobRead();
      if (!j) return null;
      Object.keys(patch).forEach(function(k) {
        j[k] = patch[k];
      });
      GM_setValue("pt_imgbed_job", j);
      return j;
    }
    function pickUrl(text) {
      var j = null;
      try {
        j = JSON.parse(text);
      } catch (e) {
        return "";
      }
      if (!j || typeof j !== "object") return "";
      var pools = [];
      if (j.image && typeof j.image === "object") pools.push(j.image);
      if (j.success && j.success.image && typeof j.success.image === "object") pools.push(j.success.image);
      for (var i = 0; i < pools.length; i++) {
        var p = pools[i] || {};
        var c = [p.url, p.image && p.image.url, p.display_url];
        for (var k = 0; k < c.length; k++) {
          if (c[k] && /^https?:\/\//i.test(c[k]) && W_EXT_RE.test(c[k])) return c[k];
        }
        c = [p.url, p.image && p.image.url];
        for (var k2 = 0; k2 < c.length; k2++) {
          if (c[k2] && /^https?:\/\//i.test(c[k2])) return c[k2];
        }
      }
      return "";
    }
    function errText(text) {
      try {
        var j = JSON.parse(text);
        if (j && j.error && j.error.message) {
          var msg = j.error.message;
          if (/auth_token/i.test(msg)) return "登录态失效";
          if (j.error.code === 401 || /请求被拒绝|denied/i.test(msg)) return "需要登录";
          if (/flood/i.test(msg)) return "上传过于频繁";
          return msg;
        }
        if (j && j.status_txt) return j.status_txt;
      } catch (e) {
      }
      return "";
    }
    function probe() {
      return fetch("/upload?pt_imgbed_job=" + encodeURIComponent(jobId), { credentials: "same-origin", cache: "no-store" }).then(function(r) {
        return r.text();
      }).then(function(html) {
        var m = /config\.auth_token\s*=\s*"([A-Za-z0-9]{10,})"/i.exec(html);
        return { token: m ? m[1] : "", logged: /CHV\.obj\.logged_user\s*=\s*\{/.test(html) };
      });
    }
    function uploadOne(src, token) {
      var fd = new FormData();
      fd.append("action", "upload");
      fd.append("type", "url");
      fd.append("nsfw", "0");
      fd.append("source", src);
      fd.append("timestamp", String(Date.now()));
      fd.append("auth_token", token);
      return fetch("/json", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        body: fd
      }).then(function(r) {
        return r.text().then(function(txt) {
          var dst = pickUrl(txt);
          if (dst) return { url: dst };
          return { error: errText(txt) || "HTTP " + r.status };
        });
      }).catch(function() {
        return { error: "请求失败" };
      });
    }
    function sleep(ms) {
      return new Promise(function(r) {
        setTimeout(r, ms);
      });
    }
    (async function() {
      var job = jobRead();
      if (!job || !job.urls || !job.urls.length) return;
      jobPatch({ beat: Date.now() });
      badge("图床准备中…");
      var st = await probe();
      if (!st.logged) {
        // 不存账号密码：直接走「用 PTerClub 账号登录」那条单点登录链
        var tries = (job.authTries || 0) + 1;
        if (tries > 2) {
          jobPatch({ phase: "error", error: "需要先在浏览器登录 PterClub 账号", done: true });
          badge("需要先在浏览器登录 PterClub 账号，再重新转种");
          return;
        }
        jobPatch({ phase: "auth", authTries: tries, authAt: Date.now() });
        badge("图床未登录，正在用 PterClub 账号自动登录…");
        location.replace("/connect/goauth");
        return;
      }
      if (!st.token) {
        jobPatch({ phase: "error", error: "未取得 auth_token", done: true });
        badge("未取得 auth_token，已停止");
        return;
      }
      jobPatch({ phase: "uploading" });
      var urls = (job.urls || []).slice();
      var ok = 0, fail = 0;
      for (var i = 0; i < urls.length; i++) {
        var cur = jobRead();
        if (!cur) {
          badge("任务已被取消");
          return;
        }
        if (cur.results && cur.results[urls[i]]) {
          ok++;
          continue;
        }
        badge("图床转存 " + (i + 1) + " / " + urls.length + " …");
        var out = await uploadOne(urls[i], st.token);
        var fresh = jobRead();
        if (!fresh) return;
        fresh.results = fresh.results || {};
        fresh.errors = fresh.errors || {};
        if (out.url) {
          fresh.results[urls[i]] = out.url;
          ok++;
        } else {
          fresh.errors[urls[i]] = out.error || "未知错误";
          fail++;
        }
        GM_setValue("pt_imgbed_job", fresh);
        if (i < urls.length - 1) await sleep(700);
      }
      jobPatch({ phase: "done", done: true });
      badge("图床转存完成：成功 " + ok + " 张" + (fail ? "，失败 " + fail + " 张" : "") + "（本页可关闭）");
      setTimeout(function() {
        try {
          window.close();
        } catch (e) {
        }
      }, 2500);
    })().catch(function() {
      jobPatch({ phase: "error", error: "转存脚本异常", done: true });
    });
  }
  var HOST_UPLOAD_DEFAULT_BASE = "https://s3.pterclub.net";
  var hostTokenState = { token: "", at: 0, base: "" };
  var hostMapState = null;
  var hostUploadRunning = false;
  function hostSleep(ms) {
    return new Promise(function(res) {
      setTimeout(res, ms);
    });
  }
  function hostBase() {
    var b = String(config && config.imgHostBase || "").trim() || HOST_UPLOAD_DEFAULT_BASE;
    if (!/^https?:\/\//i.test(b)) b = "https://" + b.replace(/^\/+/, "");
    return b.replace(/\/+$/, "");
  }
  function hostXhr(opts) {
    return new Promise(function(resolve, reject) {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("缺少 GM_xmlhttpRequest 权限"));
        return;
      }
      GM_xmlhttpRequest({
        method: opts.method || "GET",
        url: opts.url,
        headers: opts.headers || {},
        data: opts.data,
        responseType: opts.responseType,
        timeout: opts.timeout || 3e4,
        onload: resolve,
        onerror: function() {
          reject(new Error("网络请求失败"));
        },
        ontimeout: function() {
          reject(new Error("请求超时"));
        }
      });
    });
  }
  function hostMapLoad() {
    if (hostMapState) return hostMapState;
    hostMapState = GM_getValue("pt_img_host_map", {}) || {};
    return hostMapState;
  }
  function hostMapGet(u) {
    var m = hostMapLoad(), v = m[u];
    return v && v[0] || "";
  }
  function hostMapSet(u, v) {
    hostMapLoad()[u] = [v, Date.now()];
  }
  function hostMapFlush() {
    var m = hostMapLoad(), now = Date.now(), keys = Object.keys(m);
    var kept = [];
    keys.forEach(function(k) {
      var v = m[k];
      if (!v || !v[0] || now - (v[1] || 0) > 5184e6) {
        delete m[k];
        return;
      }
      kept.push([k, v[1] || 0]);
    });
    if (kept.length > 600) {
      kept.sort(function(a, b) {
        return b[1] - a[1];
      });
      kept.slice(600).forEach(function(p) {
        delete m[p[0]];
      });
    }
    GM_setValue("pt_img_host_map", m);
  }
  function hostMapShots(shots) {
    if (!shots || !shots.length) return shots || [];
    var m = hostMapLoad(), changed = false;
    var out = shots.map(function(u) {
      var v = m[u] && m[u][0];
      if (v) {
        changed = true;
        return v;
      }
      return u;
    });
    return changed ? out : shots;
  }
  function hostGetToken() {
    var base = hostBase();
    if (hostTokenState.token && hostTokenState.base === base && Date.now() - hostTokenState.at < 18e5) {
      return Promise.resolve(hostTokenState.token);
    }
    return hostXhr({ url: base + "/upload", timeout: 2e4 }).then(function(res) {
      if (res.status !== 200) throw new Error("图床页面访问失败 (HTTP " + res.status + ")");
      var html = res.responseText || "";
      var m = html.match(/config\.auth_token\s*=\s*"([A-Za-z0-9]{10,})"/i) || html.match(/auth_token\s*=\s*"([A-Za-z0-9]{10,})"/i);
      if (!m) throw new Error("未登录猫站图床，请先在浏览器登录 " + base);
      hostTokenState = { token: m[1], at: Date.now(), base };
      if (!/logged_user\s*=\s*\{/.test(html)) {
        log("⚠️ 图床未检测到登录态，将以游客身份上传（不进入你的相册）。建议先登录 " + base, "WARN");
      }
      return m[1];
    });
  }
  function hostFileName(u, mime) {
    var name = "";
    try {
      name = decodeURIComponent(new URL(u).pathname.split("/").pop() || "");
    } catch (e) {
    }
    name = (name || "").replace(/[^\w.\-]+/g, "_");
    if (!IMG_EXT_RE.test(name)) {
      var t = String(mime || "").toLowerCase();
      var ext = t.indexOf("png") >= 0 ? ".png" : t.indexOf("gif") >= 0 ? ".gif" : t.indexOf("webp") >= 0 ? ".webp" : ".jpg";
      name = (name || "shot") + ext;
    }
    return name;
  }
  function hostPickUrl(text) {
    var j = null;
    try {
      j = JSON.parse(text);
    } catch (e) {
      return "";
    }
    if (!j || typeof j !== "object") return "";
    var pools = [];
    if (j.image) pools.push(j.image);
    if (j.success && j.success.image) pools.push(j.success.image);
    if (j.success && typeof j.success === "object") {
      Object.keys(j.success).forEach(function(k) {
        var v = j.success[k];
        if (v && typeof v === "object") pools.push(v.image && typeof v.image === "object" ? v.image : v);
      });
    }
    for (var i = 0; i < pools.length; i++) {
      var p = pools[i];
      if (!p) continue;
      var cands = [p.url, p.image && p.image.url, p.display_url, p.url_viewer];
      for (var c = 0; c < cands.length; c++) {
        var s = cands[c];
        if (s && /^https?:\/\//i.test(s) && IMG_EXT_RE.test(s)) return s;
      }
    }
    for (var i2 = 0; i2 < pools.length; i2++) {
      var p2 = pools[i2];
      if (!p2) continue;
      var cands2 = [p2.url, p2.image && p2.image.url];
      for (var c2 = 0; c2 < cands2.length; c2++) {
        if (cands2[c2] && /^https?:\/\//i.test(cands2[c2])) return cands2[c2];
      }
    }
    return "";
  }
  function hostPostForm(body, timeout) {
    return hostXhr({
      method: "POST",
      url: hostBase() + "/json",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      data: body,
      timeout: timeout || 9e4
    });
  }
  function hostUploadByUrl(remoteUrl, token) {
    var body = "action=upload&type=url&nsfw=0&timestamp=" + Date.now() + "&auth_token=" + encodeURIComponent(token) + "&source=" + encodeURIComponent(remoteUrl);
    return hostPostForm(body).then(function(res) {
      var u = hostPickUrl(res.responseText);
      if (!u) throw new Error(hostErrorText(res.responseText) || "远程转存未返回链接");
      return u;
    });
  }
  function hostErrorText(text) {
    try {
      var j = JSON.parse(text);
      if (j && j.error && j.error.message) {
        var msg = j.error.message;
        if (/auth_token/i.test(msg)) return "图床登录态无效（请先在浏览器登录该图床后重试）";
        if (j.error.code === 401 || /请求被拒绝|denied/i.test(msg)) return "图床拒绝上传（未登录或被限制，请先登录该图床）";
        if (/flood/i.test(msg)) return "Flooding detected";
        return msg;
      }
      if (j && j.status_txt) return j.status_txt;
    } catch (e) {
    }
    return "";
  }
  function hostIsAuthError(msg) {
    return /登录态无效|图床拒绝上传|auth_token|未登录/i.test(String(msg || ""));
  }
  function hostUploadByBinary(remoteUrl, token) {
    return hostXhr({ url: remoteUrl, responseType: "blob", timeout: 6e4, headers: { Referer: location.origin + "/" } }).then(function(res) {
      var blob = res.response;
      if (!blob || !blob.size) throw new Error("原图下载失败");
      var name = hostFileName(remoteUrl, blob.type);
      var fd = new FormData();
      fd.append("action", "upload");
      fd.append("type", "file");
      fd.append("nsfw", "0");
      fd.append("timestamp", String(Date.now()));
      fd.append("auth_token", token);
      fd.append("source", blob, name);
      return hostXhr({
        method: "POST",
        url: hostBase() + "/json",
        headers: { Accept: "application/json" },
        data: fd,
        timeout: 12e4
      });
    }).then(function(res) {
      var u = hostPickUrl(res.responseText);
      if (!u) throw new Error(hostErrorText(res.responseText) || "上传未返回链接");
      return u;
    });
  }
  function hostUploadOne(remoteUrl, token) {
    return hostUploadByUrl(remoteUrl, token).catch(function(firstErr) {
      if (/flood|泛滥|洪水/i.test(firstErr.message || "")) throw firstErr;
      return hostUploadByBinary(remoteUrl, token);
    });
  }
  var SHOT_DIM_CACHE = {};
  function measureRemoteImage(url) {
    if (!url) return Promise.resolve(null);
    if (SHOT_DIM_CACHE[url]) return Promise.resolve(SHOT_DIM_CACHE[url]);
    return new Promise(function(resolve) {
      var img = new Image(), settled = false;
      var timer = setTimeout(function() {
        if (settled) return;
        settled = true;
        resolve(null);
      }, 9e3);
      img.onload = function() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        var d = { w: img.naturalWidth || 0, h: img.naturalHeight || 0 };
        if (d.w) SHOT_DIM_CACHE[url] = d;
        resolve(d);
      };
      img.onerror = function() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      };
      try {
        if (!img.referrerPolicy) img.referrerPolicy = "origin";
      } catch (e) {
      }
      img.src = url;
    });
  }
  function shotKeepOriginalSize(srcUrl, hostedUrl) {
    if (!hostedUrl) return Promise.resolve(srcUrl);
    if (hostedUrl === srcUrl) return Promise.resolve(srcUrl);
    return measureRemoteImage(srcUrl).then(function(a) {
      if (!a || !a.w) return hostedUrl;
      return measureRemoteImage(hostedUrl).then(function(b) {
        if (b && b.w && b.w < a.w) {
          log("  · 图床返图 " + b.w + "px，小于原图 " + a.w + "px，保留原图链接", "WARN");
          return srcUrl;
        }
        return hostedUrl;
      });
    });
  }  function hostDirectUploadShots(shots) {
    if (!config.imgHostEnabled) return Promise.resolve({ authFailed: false, ok: 0 });
    if (!shots || !shots.length) return Promise.resolve({ authFailed: false, ok: 0 });
    return hostGetToken().then(function(token) {
      log("🖼 开始转存截图到猫站图床，共 " + shots.length + " 张（后台进行，不阻塞操作）…", "INFO");
      var chain = Promise.resolve(), ok = 0, aborted = false;
      shots.forEach(function(u, idx) {
        chain = chain.then(function() {
          if (aborted) return null;
          if (hostMapGet(u)) {
            ok++;
            return null;
          }
          return hostUploadOne(u, token).then(function(newUrl) {
            return shotKeepOriginalSize(u, newUrl);
          }).then(function(finalUrl) {
            hostMapSet(u, finalUrl);
            ok++;
            log("  · 图床 " + (idx + 1) + "/" + shots.length + " 已转存" + (finalUrl === u ? "（图床压缩，改用原图链接）" : ""), "INFO");
          }).catch(function(e) {
            if (hostIsAuthError(e.message)) {
              aborted = true;
              log("  · 图床登录态无效，已停止后续转存（截图保留原图链接）", "WARN");
              return null;
            }
            if (/flood|泛滥|洪水/i.test(e.message || "")) {
              return hostSleep(12e3).then(function() {
                return hostUploadOne(u, token);
              }).then(function(newUrl) {
                hostMapSet(u, newUrl);
                ok++;
              }).catch(function(e2) {
                log("  · 图床 " + (idx + 1) + "/" + shots.length + " 失败：" + (e2.message || "未知错误"), "WARN");
              });
            }
            log("  · 图床 " + (idx + 1) + "/" + shots.length + " 失败：" + (e.message || "未知错误"), "WARN");
            return null;
          }).then(function() {
            return hostSleep(900);
          });
        });
      });
      return chain.then(function() {
        hostMapFlush();
        log("🖼 图床转存完成：" + ok + "/" + shots.length + " 张" + (aborted ? "（登录态无效，已中断）" : ok < shots.length ? "（失败项保留原图链接）" : ""), ok ? "SUCCESS" : "WARN");
        return { authFailed: aborted, ok };
      });
    }).catch(function(e) {
      log("⚠️ 图床未就绪：" + (e.message || "未知错误") + "（截图保留原图链接）", "WARN");
      return { authFailed: hostIsAuthError(e.message), ok: 0 };
    });
  }
  function hostJobSupported() {
    if (typeof GM_openInTab !== "function") return false;
    try {
      return new URL(hostBase()).hostname === "s3.pterclub.net";
    } catch (e) {
      return false;
    }
  }
  function hostUploadShots(shots) {
    if (!config.imgHostEnabled) return Promise.resolve(shots);
    if (!shots || !shots.length) return Promise.resolve(shots);
    if (hostUploadRunning) return Promise.resolve(shots);
    hostUploadRunning = true;
    return hostDirectUploadShots(shots).then(function(res) {
      if (res && res.authFailed && hostJobSupported()) {
        log("🔐 图床登录态无效，改用 PterClub 单点登录后转存…", "WARN");
        return hostTabUploadShots(shots);
      }
      hostUploadRunning = false;
      return shots;
    });
  }
  function hostTabUploadShots(shots) {
    var pending = shots.filter(function(u) {
      return !hostMapGet(u);
    });
    if (!pending.length) {
      hostUploadRunning = false;
      return Promise.resolve(shots);
    }
    var jobId = "j" + Date.now() + Math.floor(Math.random() * 1e4);
    GM_setValue("pt_imgbed_job", { id: jobId, urls: pending, results: {}, errors: {}, phase: "wait", done: false, at: Date.now() });
    log("🖼 正在后台打开猫站图床转存截图（" + pending.length + " 张），请稍候…", "INFO");
    var tab = null, tabErr = false;
    try {
      tab = GM_openInTab(hostBase() + "/upload?pt_imgbed_job=" + jobId, { active: false, insert: true, setParent: true });
    } catch (e0) {
      tabErr = true;
    }
    if (tabErr) {
      GM_setValue("pt_imgbed_job", {});
      hostUploadRunning = false;
      log("⚠️ 无法打开图床标签页（GM_openInTab 被拒绝），截图保留原图链接", "WARN");
      return Promise.resolve(shots);
    }
    return new Promise(function(resolve) {
      var deadline = Date.now() + 18e4, started = Date.now(), lastLogged = 0, lastPhase = "", beatSeen = false;
      function merge() {
        var job = GM_getValue("pt_imgbed_job", null);
        if (!job || job.id !== jobId) return null;
        var res = job.results || {};
        Object.keys(res).forEach(function(k) {
          if (res[k] && !hostMapGet(k)) hostMapSet(k, res[k]);
        });
        return job;
      }
      function finish(reason) {
        hostMapFlush();
        hostUploadRunning = false;
        var ok = 0;
        pending.forEach(function(u) {
          if (hostMapGet(u)) ok++;
        });
        if (ok) log("🖼 图床转存完成：" + ok + "/" + pending.length + " 张" + (ok < pending.length ? "（失败项保留原图链接）" : ""), "SUCCESS");
        else log("⚠️ 图床转存未完成：" + reason + "（截图保留原图链接）", "WARN");
        try {
          if (tab && tab.close) tab.close();
        } catch (e) {
        }
        resolve(shots);
      }
      function tick() {
        var job = merge();
        if (!job) return finish("任务已被清理");
        var n = Object.keys(job.results || {}).length;
        if (job.beat && !beatSeen) {
          beatSeen = true;
          log("  · 图床页面已连接，开始登录与转存", "INFO");
        }
        if (n > lastLogged) {
          lastLogged = n;
          log("  · 图床 " + n + "/" + pending.length + " 已转存", "INFO");
        }
        if (job.done) return finish(job.phase === "error" ? job.error || "图床异常" : "完成");
        if (job.phase !== lastPhase) {
          lastPhase = job.phase;
          if (job.phase === "auth") log("🔐 图床未登录，已自动发起 PterClub 单点登录（若那个标签页还要求登录 PterClub，登录一次即可继续）", "INFO");
        }
        if (job.phase === "auth") deadline = Math.max(deadline, Date.now() + 12e4);
        if (Date.now() - started > 9e5) return finish("等待登录超时");
        if (!beatSeen && Date.now() - started > 25e3) {
          return finish("图床标签页 25 秒没有响应，检查 Tampermonkey 是否允许脚本在 s3.pterclub.net 上运行（脚本管理面板里该脚本的「设置 → 用户匹配」/ 权限）");
        }
        if (Date.now() > deadline) return finish("等待图床页面超时");
        setTimeout(tick, 1e3);
      }
      setTimeout(tick, 1200);
    });
  }
  function verifyHostedShotSizes(shots) {
    var chain = Promise.resolve(), fixed = 0;
    (shots || []).forEach(function(u) {
      chain = chain.then(function() {
        var hosted = hostMapGet(u);
        if (!hosted || hosted === u) return null;
        return shotKeepOriginalSize(u, hosted).then(function(finalUrl) {
          if (finalUrl && finalUrl !== hosted) {
            hostMapSet(u, finalUrl);
            fixed++;
          }
        });
      });
    });
    return chain.then(function() {
      if (fixed) {
        hostMapFlush();
        log("🖼 复核：有 " + fixed + " 张图床返图被压缩，已改回原图链接", "WARN");
      }
    });
  }
  function hostAutoUploadShots(shots, rerender) {
    if (!config.imgHostEnabled || !shots || !shots.length) return;
    hostUploadShots(shots).then(function() {
      return verifyHostedShotSizes(shots);
    }).then(function() {
      if (typeof rerender !== "function") return;
      try {
        rerender();
      } catch (e) {
      }
    });
  }
  function findPageImdb(rootDoc) {
      var ctx = rootDoc || document;
      var manualVal = $("#pt-manual-imdb") && $("#pt-manual-imdb").value.trim() || config && config.manualImdb || "";
      if (/^tt\d{7,9}$/i.test(manualVal)) return manualVal.toLowerCase();
      var html = ctx.documentElement && ctx.documentElement.innerHTML || ctx.body && ctx.body.innerHTML || "";
      var m = html.match(/imdb\.com\/title\/(tt\d{7,9})/i) || html.match(/\b(tt\d{7,9})\b/);
      if (m) return m[1].toLowerCase();
      var a = $$("a[href]", ctx).find(function(x) {
        return /imdb\.com/i.test(x.href);
      });
      if (a) {
        m = a.href.match(/(tt\d{7,9})/i);
        if (m) return m[1].toLowerCase();
      }
      return "";
    }
    function copyTextToClipboard(text, silent) {
      if (!text) return false;
      try {
        GM_setClipboard(text, "text");
        if (!silent) log("📋 已复制到剪贴板（" + text.length + " 字符）", "SUCCESS");
        return true;
      } catch (e) {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px;";
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (e2) {
        }
        document.body.removeChild(ta);
        if (!silent) log(ok ? "📋 已复制到剪贴板" : "⚠️ 复制失败", ok ? "SUCCESS" : "WARN");
        return ok;
      }
    }
    function doubanInit() {
      var done = false;
      var m = location.hash.match(/url=(tt\d{7,9})/i) || location.href.match(/url=(tt\d{7,9})/i);
      var tt = m ? m[1].toLowerCase() : "";
      var tickCount = 0;
      function tip(msg, err) {
        var d = document.getElementById("dvb-tip");
        if (!d && document.body) {
          d = document.createElement("div");
          d.id = "dvb-tip";
          d.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:0;z-index:2147483647;font:12px/1.7 -apple-system,sans-serif;padding:6px 18px;border-radius:0 0 8px 8px;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);";
          document.body.appendChild(d);
        }
        if (d) {
          d.textContent = msg;
          d.style.background = err ? "#b91c1c" : "#166534";
        }
      }
      function handOff(text, ttVal) {
        if (done || !text || text.indexOf("◎") < 0) return;
        done = true;
        var clean = text.trim();
        try {
          GM_setValue(HANDOFF, JSON.stringify({ text: clean, tt: ttVal || "", t: Date.now() }));
        } catch (e) {
        }
        try {
          GM_setClipboard(clean, "text");
        } catch (e) {
        }
        tip("✅ 已回传，正在关闭…");
        setTimeout(function() {
          try {
            window.close();
          } catch (e) {
          }
        }, 400);
      }
      tip("📥 BDInfo 助手：正在自动获取 " + (tt || "") + "…");
      function tick() {
        if (done) return;
        tickCount++;
        var tas = document.querySelectorAll("textarea");
        var out = tas.length ? tas[tas.length - 1] : null;
        if (out && out.value && out.value.indexOf("◎") >= 0) {
          handOff(out.value, tt);
          return;
        }
        var input = document.querySelector('input[type="text"], input[type="search"], input');
        if (input && tt && input.value !== tt) {
          try {
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            setter.call(input, tt);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          } catch (e) {
            input.value = tt;
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        var btns = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
        var getBtn = btns.find(function(b) {
          return /获取豆瓣简介|豆瓣简介|获取简介|查询|解析/.test((b.textContent || "").trim()) && !b.dataset.clicked;
        });
        if (getBtn && input && input.value === tt) {
          getBtn.dataset.clicked = "1";
          getBtn.click();
        } else if (tt && (tickCount === 9 || tickCount === 20) && !done) {
          var retryBtn = btns.find(function(b) {
            return /获取豆瓣简介|豆瓣简介|获取简介|查询|解析/.test((b.textContent || "").trim());
          });
          if (retryBtn) retryBtn.click();
        }
        var listItems = Array.from(document.querySelectorAll("li, .list-item, .result-item, .item"));
        var targetItem = listItems.find(function(itemEl) {
          var txt = (itemEl.textContent || "").trim();
          return tt && txt.indexOf(tt) >= 0 && !/获取|复制|清空|API|说明/.test(txt) && !itemEl.dataset.clicked;
        });
        if (targetItem) {
          targetItem.dataset.clicked = "1";
          var a = targetItem.querySelector("a");
          if (a) a.click();
          else targetItem.click();
        }
        if (tickCount > 110) {
          tip("⚠️ 取词超时，请手动点「获取豆瓣简介」", true);
        }
      }
      function loop() {
        tick();
        if (!done && tickCount <= 120) setTimeout(loop, 500);
      }
      loop();
      if (document.body) {
        var observer = new MutationObserver(function() {
          tick();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
    function readHandoffData(maxAgeMs) {
      try {
        var j = JSON.parse(GM_getValue(HANDOFF, "") || "null");
        if (!j || !j.text || j.text.indexOf("◎") < 0) return null;
        if (maxAgeMs && Date.now() - (j.t || 0) > maxAgeMs) return null;
        return j;
      } catch (e) {
        return null;
      }
    }
    function clearHandoffData() {
      try {
        GM_setValue(HANDOFF, "");
      } catch (e) {
      }
    }
    function requestDoubanByTab(tt, onSuccess) {
      if (!tt) return;
      activeDoubanTt = tt.toLowerCase();
      if (doubanPollingTimer) clearInterval(doubanPollingTimer);
      clearHandoffData();
      var url = "https://doubaninfo.com/#ptgen?url=" + encodeURIComponent(activeDoubanTt);
      try {
        GM_openInTab(url, { active: false, insert: true, setParent: true });
      } catch (e) {
        window.open(url, "_blank");
      }
      var t0 = Date.now();
      doubanPollingTimer = setInterval(function() {
        if (Date.now() - t0 > 6e4) {
          clearInterval(doubanPollingTimer);
          doubanPollingTimer = null;
          log("⚠️ 豆瓣取词超时，可手动去取词页点按钮，结果会自动回传。", "WARN");
          return;
        }
        var ho = readHandoffData(6e5);
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
                .pt-btn-row { display: flex; flex-wrap: wrap; gap: 5px; user-select: none; }
                .pt-btn-row .pt-btn { flex: 0 1 auto; padding: 5px 7px; font-size: 11px; border-radius: 5px; white-space: nowrap; }
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
      if (!document.body || $("#pt-checker-panel")) return;
      var panelHtml = `
            <div id="pt-checker-panel">
                <div id="pt-panel-header">
                    <span>📀 转种与调度中枢 (v0.0.0.1)</span>
                    <div class="pt-header-tools">
                        <span data-pt-act="panel-collapse" class="pt-header-icon" title="收起为侧边胶囊">─</span>
                        <span data-pt-act="panel-collapse" class="pt-header-icon" title="隐藏面板">✖</span>
                    </div>
                </div>
                <div id="pt-panel-body">
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
                        <div class="pt-site-card-row" id="pt-run-progress-row" style="display:none;"><span>任务进度:</span><span id="pt-run-progress" style="font-weight:600; font-size:11px; color:#1d4ed8;"></span></div>
                        <div class="pt-site-card-row"><span>qBittorrent:</span><span id="pt-cur-qb-label" style="color:#059669; font-family:monospace; font-weight:500;"></span></div>
                    </div>
                    <div class="pt-btn-row">
                        <button type="button" id="pt-btn-open-cfg" data-pt-act="cfg-open" class="pt-btn pt-btn-primary">⚙️ 设置</button>
                        <button type="button" id="pt-btn-preset" data-pt-act="btn1-preset" class="pt-btn">📀 预设</button>
                        <button type="button" id="pt-btn-pull-dupe" data-pt-act="btn-pull-dupe" class="pt-btn pt-btn-fwd" style="font-weight:600;">🚀 拉取/查重</button>
                        <button type="button" id="pt-btn-reset-crawl" data-pt-act="btn-reset-crawl" class="pt-btn" title="丢掉上次的名单与翻页进度，从第 1 页重新抓">♻️ 清断点</button>
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
                            <span data-pt-act="lib-restore" style="cursor:pointer; color:#15803d; font-weight:600;" title="仅从本地词库恢复当前页徽标（零网络请求）">🔄恢复</span>
                            <span data-pt-act="lib-view" style="cursor:pointer; color:#2563eb;">查看</span>
                            <span data-pt-act="lib-export" style="cursor:pointer; color:#7c3aed;" title="把整份词库导出成 JSON 文件">导出</span>
                            <span data-pt-act="lib-import" style="cursor:pointer; color:#0891b2;" title="从 JSON 文件导入并合并词库">导入</span>
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
                    <div class="pt-field-row">
                        <button type="button" data-pt-act="cfg-qb-cats" class="pt-btn" style="background:#f8fafc; color:#334155; width:100%;">📂 读取 qB 现有分类（点一下自动填入）</button>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1.2fr; gap:6px;">
                        <div class="pt-field-row"><label>qB 分类（留空=未分类）:</label><input id="pt-cfg-qb-cat" class="pt-input" placeholder="原盘" list="pt-cfg-qb-cat-list" /><datalist id="pt-cfg-qb-cat-list"></datalist></div>
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

                    <div class="pt-cfg-section-title">查重词库（分片存储）</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                        <div class="pt-field-row"><label>词库有效期(小时):</label><input id="pt-cfg-lib-hours" class="pt-input" type="number" min="1" max="8760" value="720" /></div>
                        <div class="pt-field-row"><label>词库上限(条):</label><input id="pt-cfg-lib-max" class="pt-input" type="number" min="100" max="200000" value="20000" /></div>
                    </div>

                    <div class="pt-cfg-section-title">2. DreadVault 排版引擎参数配置</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px;">
                        <div class="pt-field-row"><label>副标题主演数:</label><input id="pt-cfg-sub-cast" class="pt-input" type="number" min="1" max="10" value="3" /></div>
                        <div class="pt-field-row"><label>原盘标识词:</label><input id="pt-cfg-sub-disc" class="pt-input" type="text" value="原盘" /></div>
                        <div class="pt-field-row"><label>截图数量上限:</label><input id="pt-cfg-max-shots" class="pt-input" type="number" min="0" max="60" value="15" /></div>
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

                    <div class="pt-cfg-section-title">5. 截图转存图床（转种时自动上传并替换链接）</div>
                    <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
                        <label style="font-size:11.5px; color:#475569; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="pt-cfg-img-host" checked> 自动转存到猫站图床</label>
                    </div>
                    <div class="pt-field-row">
                        <label><span>图床地址（默认猫站图床）:</span></label>
                        <input id="pt-cfg-img-host-base" type="text" class="pt-input" placeholder="https://s3.pterclub.net" autocomplete="off" data-lpignore="true" />
                    </div>
                    <div style="font-size:10.5px; color:#94a3b8; margin-top:2px;">不保存任何账号密码。转种时会后台开一个图床标签页，自动走「用 PTerClub 账号登录」单点登录；只要浏览器里 PterClub 是登录状态就会自动完成，否则会在那个标签页提示你先登录一次。</div>

                    <div class="pt-cfg-section-title">6. M-Team 自动化</div>
                    <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
                        <label style="font-size:11.5px; color:#475569; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="pt-cfg-mt-auto-pull" checked> 预设完成后自动开始「拉取全部页 + 查重」</label>
                    </div>
                    <div style="font-size:10.5px; color:#94a3b8; margin-top:2px;">翻页抓取按页限速（每页停 1～1.6 秒再翻），100 页约 3 分钟；面板「任务进度」会显示当前第几页、累计多少条。</div>

                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:6px;">
                        <button type="button" id="pt-cfg-save" data-pt-act="cfg-save" class="pt-btn" style="background:#f0fdf4; color:#166534;">保存全部配置</button>
                        <button type="button" id="pt-cfg-close" data-pt-act="cfg-close" class="pt-btn">取消</button>
                    </div>
                </div>
            </div>
        `;
      document.body.insertAdjacentHTML("beforeend", panelHtml);
      initPanelWindowBehavior();
      if (typeof ACTION_BUS["panel-ready"] === "function") ACTION_BUS["panel-ready"]();
    }
    function initPanelWindowBehavior() {
      var panelElement = $("#pt-checker-panel"), dockPill = $("#pt-dock-pill");
      if (!panelElement || !dockPill) return;
      var savedPos = GM_getValue("pt_panel_pos", { top: "70px", left: "" });
      if (savedPos && savedPos.left) {
        var leftVal = parseInt(savedPos.left, 10), topVal = parseInt(savedPos.top, 10);
        if (!isNaN(leftVal) && leftVal >= 0 && leftVal < window.innerWidth - 80 && !isNaN(topVal) && topVal >= 0 && topVal < window.innerHeight - 40) {
          panelElement.style.left = savedPos.left;
          panelElement.style.top = savedPos.top;
          panelElement.style.right = "auto";
        } else {
          panelElement.style.top = "70px";
          panelElement.style.right = "20px";
        }
      } else {
        panelElement.style.top = "70px";
        panelElement.style.right = "20px";
      }
      if (GM_getValue("pt_panel_collapsed", false)) {
        panelElement.style.display = "none";
        dockPill.style.display = "flex";
      }
      var header = $("#pt-panel-header");
      if (!header) return;
      var isDragging = false, startX, startY, initLeft, initTop;
      header.onmousedown = function(e) {
        if (e.target.closest(".pt-header-tools")) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        var rect = panelElement.getBoundingClientRect();
        initLeft = rect.left;
        initTop = rect.top;
        panelElement.style.right = "auto";
        panelElement.style.left = initLeft + "px";
        panelElement.style.top = initTop + "px";
        var onMove = function(ev) {
          if (!isDragging) return;
          panelElement.style.left = Math.max(5, Math.min(window.innerWidth - panelElement.offsetWidth - 5, initLeft + (ev.clientX - startX))) + "px";
          panelElement.style.top = Math.max(5, Math.min(window.innerHeight - 40, initTop + (ev.clientY - startY))) + "px";
        };
        var onUp = function() {
          isDragging = false;
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          GM_setValue("pt_panel_pos", { left: panelElement.style.left, top: panelElement.style.top });
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        e.preventDefault();
      };
    }
    bindAction("panel-collapse", function() {
      $("#pt-checker-panel").style.display = "none";
      $("#pt-dock-pill").style.display = "flex";
      GM_setValue("pt_panel_collapsed", true);
    });
    bindAction("panel-expand", function() {
      $("#pt-dock-pill").style.display = "none";
      $("#pt-checker-panel").style.display = "flex";
      GM_setValue("pt_panel_collapsed", false);
    });
    bindAction("log-clear", function() {
      $("#pt-log-box").innerText = "";
    });
    bindAction("log-copy", function(btn) {
      var logTxt = $("#pt-log-box").innerText || "";
      if (!logTxt) return;
      copyTextToClipboard(logTxt, true);
      btn.innerText = "✅已复制";
      setTimeout(function() {
        btn.innerText = "📋复制";
      }, 1500);
    });
    bindAction("lib-view", function() {
      var modal = $("#pt-lib-modal");
      if (!modal) return;
      var stats = getLibraryStats();
      var entries = listLibraryForCurrentBSite();
      $("#pt-lib-modal-count").innerText = entries.length;
      $("#pt-lib-modal-host").innerText = stats.bSiteHost;
      $("#pt-lib-modal-ttl").innerText = String(config.libraryFreshHours || 720);
      var listBox = $("#pt-lib-modal-list");
      listBox.innerHTML = "";
      if (entries.length === 0) {
        listBox.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:20px;">当前 B 站暂无查重记录</div>';
      } else {
        entries.forEach(function(e) {
          var row = el("div", "", "", "display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:#f8fafc; border-radius:4px; font-size:11px;");
          var leftSpan = el("span", "", (e.cnTitle || e.movieTitle || e.cacheKey) + " (" + (e.movieYear || "?") + ")", "flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px;");
          leftSpan.title = e.cacheKey;
          var badgeEmoji = BADGE_DICT[e.vKey].text.split(" ")[0];
          var rightTxt = badgeEmoji + " " + e.ageHours + "h前 ×" + e.checkCount;
          if (e.forwardedAt) rightTxt += " 🚀";
          var rightSpan = el("span", "", rightTxt, "color:#64748b; font-size:10.5px; white-space:nowrap;");
          if (e.forwardedAt) rightSpan.title = "已转种到 " + e.forwardedTo;
          row.appendChild(leftSpan);
          row.appendChild(rightSpan);
          listBox.appendChild(row);
        });
      }
      modal.style.display = "flex";
    });
    bindAction("lib-close", function() {
      var modal = $("#pt-lib-modal");
      if (modal) modal.style.display = "none";
    });
    bindAction("lib-restore", async function() {
      lastPageHtmlHash = "";
      await autoRestoreState(true);
    });
    bindAction("lib-export", function() {
      exportLibraryToFile();
    });
    bindAction("lib-import", function() {
      importLibraryFromFile();
    });
    bindAction("lib-clear", function() {
      var stats = getLibraryStats();
      if (!confirm("确定清空当前 B 站 [" + stats.bSiteHost + "] 的 " + stats.currentBSite + " 条查重记录吗？\n\n（其他 B 站的记录不受影响）")) return;
      clearLibraryForCurrentBSite();
      log("📚 已清空当前 B 站 [" + stats.bSiteHost + "] 的词库记录", "SUCCESS");
      updateLibraryBadge();
      var modal = $("#pt-lib-modal");
      if (modal) modal.style.display = "none";
    });
    window.addEventListener("keydown", function(e) {
      if (e.altKey && (e.key === "p" || e.key === "P")) {
        var panel = $("#pt-checker-panel"), pill = $("#pt-dock-pill");
        if (panel) {
          panel.style.display = "flex";
          panel.style.top = "70px";
          panel.style.left = "";
          panel.style.right = "20px";
          if (pill) pill.style.display = "none";
          GM_setValue("pt_panel_collapsed", false);
          GM_setValue("pt_panel_pos", { top: "70px", left: "" });
        }
      }
    });
    var isPTP = /passthepopcorn\.me/i.test(location.hostname);
    var isBHD = /beyond-hd\.me/i.test(location.hostname);
    var isBLU = /blutopia\.cc/i.test(location.hostname);
    var isDV = /dreadvault\.org/i.test(location.hostname);
    var isPterClub = /pterclub\.(net|club|com|org)/i.test(location.hostname);
    function detectCurrentSiteArch() {
      if (isPTP) return "gz";
      if (isBHD) return "f3nix";
      if (isBLU || isDV || /aither\.cc/i.test(location.hostname)) return "unit3d";
      if (isPterClub || /ptchdbits\.co|chdbits\.co|hdsky\.me/i.test(location.hostname)) return "np";
      if ($('div[wire\\:name="torrent-search"], tr.torrent-search--list__row, a[href*="HDInnovations/UNIT3D"]')) return "unit3d";
      if ($("#filter_torrents_form, a.torrent-info-link") || rootWin.PageData) return "gz";
      if ($('script[src*="f3nix"], tr[id^="torrentposter"]')) return "f3nix";
      return "np";
    }
    var currentSiteArch = detectCurrentSiteArch();
    var userCustomSites = GM_getValue("pt_user_custom_sites", {});
    var SITE_DATABASE = Object.assign({}, DEFAULT_SITE_DATABASE, userCustomSites);
    var apiKeysVault = GM_getValue("pt_api_keys_vault", {});
    (function migrateLibraryConfigV8() {
      try {
        if (GM_getValue("pt_lib_v8_migrated", false)) return;
        var hours = GM_getValue("pt_library_fresh_hours", null);
        if (hours === null || hours === void 0 || Number(hours) <= 24) GM_setValue("pt_library_fresh_hours", 720);
        var maxEntries = GM_getValue("pt_library_max_entries", null);
        if (maxEntries === null || maxEntries === void 0 || Number(maxEntries) <= 500) GM_setValue("pt_library_max_entries", 20000);
        GM_setValue("pt_lib_v8_migrated", true);
      } catch (e) {
      }
    })();
    var config = {
      workMode: "auto",
      apiPagesCount: GM_getValue("pt_api_pages_count", 1),
      siteAKey: GM_getValue("pt_site_a_key", "AUTO"),
      siteBKey: GM_getValue("pt_site_b_key", "PTer"),
      delayMs: GM_getValue("pt_delay_ms", 2500),
      qbUrl: GM_getValue("pt_qb_url", ""),
      qbUser: GM_getValue("pt_qb_user", ""),
      qbPass: GM_getValue("pt_qb_pass", ""),
      qbCategory: GM_getValue("pt_qb_category", ""),
      libraryEnabled: GM_getValue("pt_library_enabled", true),
      libraryFreshHours: GM_getValue("pt_library_fresh_hours", 720),
      libraryMaxEntries: GM_getValue("pt_library_max_entries", 20000),
      withSubtitle: GM_getValue("pt_sub_withSubtitle", true),
      subCast: GM_getValue("pt_sub_subCast", 3),
      mtAutoPull: GM_getValue("pt_cfg_mt_auto_pull", true),
      subDisc: GM_getValue("pt_sub_subDisc", "原盘"),
      useHide: GM_getValue("pt_sub_useHide", true),
      useTag: GM_getValue("pt_sub_useTag", true),
      roundFps: GM_getValue("pt_sub_roundFps", false),
      maxShots: GM_getValue("pt_sub_maxShots", 15),
      autoImdb: GM_getValue("pt_sub_autoImdb", true),
      autoCopy: GM_getValue("pt_sub_autoCopy", true),
      imgHostEnabled: GM_getValue("pt_img_host_enabled", true),
      imgHostBase: GM_getValue("pt_img_host_base", "https://s3.pterclub.net"),
      manualImdb: ""
    };
    (function() {
      if (GM_getValue("pt_sub_maxShots_v81", false)) return;
      if (Number(config.maxShots) === 12) config.maxShots = 15;
      GM_setValue("pt_sub_maxShots", config.maxShots);
      GM_setValue("pt_sub_maxShots_v81", true);
    })();
    (function() {
      if (GM_getValue("pt_imgbed_cred_purged", false)) return;
      GM_setValue("pt_imgbed_user", "");
      GM_setValue("pt_imgbed_pass", "");
      GM_setValue("pt_imgbed_cred_purged", true);
    })();
    function getApiKeyForUrl(urlOrHost) {
      var hk = extractHostKey(urlOrHost);
      return hk && apiKeysVault[hk] ? apiKeysVault[hk].trim() : "";
    }
    function setApiKeyForUrl(urlOrHost, apiKeyVal) {
      var hk = extractHostKey(urlOrHost);
      if (!hk) return;
      if (apiKeyVal && apiKeyVal.trim()) apiKeysVault[hk] = apiKeyVal.trim();
      else delete apiKeysVault[hk];
      GM_setValue("pt_api_keys_vault", apiKeysVault);
    }
    function getSiteAInfo() {
      var curHost = extractHostKey(location.hostname);
      var curOrigin = location.origin + "/";
      var matched = null;
      Object.keys(SITE_DATABASE).forEach(function(k) {
        if (siteMatchHost(SITE_DATABASE[k], curHost)) matched = SITE_DATABASE[k];
      });
      var sName = matched ? matched.name : isPTP ? "PTP" : isBHD ? "BeyondHD" : isBLU ? "Blutopia" : isDV ? "DreadVault" : isPterClub ? "PTerClub" : /ptchdbits|chdbits/i.test(location.hostname) ? "CHDBits (彩虹岛)" : /hdsky\.me/i.test(location.hostname) ? "HDSky (天空)" : location.hostname.split(".")[0].toUpperCase();
      return { name: sName, url: curOrigin, type: matched ? matched.type : currentSiteArch, apiKey: matched ? getApiKeyForUrl(location.hostname) : "" };
    }
    function getSiteBInfo() {
      var dbB = SITE_DATABASE[config.siteBKey] || SITE_DATABASE["PTer"];
      return { name: dbB.name, url: dbB.url, type: dbB.type, apiKey: getApiKeyForUrl(dbB.url) };
    }
    var ARCH_RATE_RULES = {
      "gz": { max: 4, windowMs: 1e4, label: "Gazelle (安全上限 4次/10秒)" },
      "unit3d": { max: 20, windowMs: 6e4, label: "UNIT3D (安全上限 20次/60秒)" }
    };
    var cooldownTimerId = null;
    var RateLimiter = {
      getRule: function(arch) {
        return ARCH_RATE_RULES[arch] || ARCH_RATE_RULES["unit3d"];
      },
      getHistory: function(hostKey, windowMs) {
        var allLogs = GM_getValue("pt_api_rate_logs", {});
        var now = Date.now();
        var valid = (allLogs[hostKey] || []).filter(function(ts) {
          return now - ts < windowMs;
        });
        allLogs[hostKey] = valid;
        GM_setValue("pt_api_rate_logs", allLogs);
        return valid;
      },
      checkStatus: function(urlOrHost, arch) {
        var hostKey = extractHostKey(urlOrHost);
        var rule = this.getRule(arch);
        var history = this.getHistory(hostKey, rule.windowMs);
        var lockUntil = GM_getValue("pt_api_lock_until", {})[hostKey] || 0;
        var now = Date.now();
        if (lockUntil > now || history.length >= rule.max) {
          var waitSec = lockUntil > now ? Math.ceil((lockUntil - now) / 1e3) : Math.max(1, Math.ceil((history[0] + rule.windowMs - now) / 1e3));
          return { allowed: false, used: history.length, max: rule.max, remaining: 0, waitSec, ruleLabel: rule.label, hostKey };
        }
        return { allowed: true, used: history.length, max: rule.max, remaining: rule.max - history.length, waitSec: 0, ruleLabel: rule.label, hostKey };
      },
      recordRequest: function(urlOrHost, arch) {
        var hostKey = extractHostKey(urlOrHost);
        var rule = this.getRule(arch);
        var allLogs = GM_getValue("pt_api_rate_logs", {});
        var now = Date.now();
        var list = (allLogs[hostKey] || []).filter(function(ts) {
          return now - ts < rule.windowMs;
        });
        list.push(now);
        allLogs[hostKey] = list;
        GM_setValue("pt_api_rate_logs", allLogs);
        updateQuotaUI();
      },
      forceCooldown: function(urlOrHost, waitSeconds) {
        var hostKey = extractHostKey(urlOrHost);
        var lockUntilMap = GM_getValue("pt_api_lock_until", {});
        lockUntilMap[hostKey] = Date.now() + waitSeconds * 1e3;
        GM_setValue("pt_api_lock_until", lockUntilMap);
        startCooldownTicker();
      }
    };
    function checkApiQuotaOrThrow(site, arch) {
      var st = RateLimiter.checkStatus(site.url, arch);
      if (!st.allowed) {
        log("⚠️ [API限流保护] " + site.name + " 冷却中，请等待 " + st.waitSec + " 秒或自动回退网页模式...", "WARN");
        startCooldownTicker();
        throw new Error("API 冷却中 (" + st.waitSec + "s)");
      }
      RateLimiter.recordRequest(site.url, arch);
    }
    function refreshSiteSelectDropdowns() {
      var selectA = $("#pt-cfg-select-a"), selectB = $("#pt-cfg-select-b");
      if (!selectA || !selectB) return;
      selectA.innerHTML = '<option value="AUTO">🌐 自动识别当前网页所在站点 (推荐，跨站自动切换)</option>';
      selectB.innerHTML = "";
      Object.keys(SITE_DATABASE).forEach(function(k) {
        var s = SITE_DATABASE[k];
        var hasKey = !!getApiKeyForUrl(s.url);
        var modeTag = s.type === "unit3d" || s.type === "gz" ? hasKey ? " [🚀已配API]" : " [可配API]" : " [🌐纯网页架构]";
        var txt = s.name + " (" + s.type.toUpperCase() + ")" + modeTag;
        var optA = el("option", "", txt);
        optA.value = k;
        selectA.appendChild(optA);
        var optB = el("option", "", txt);
        optB.value = k;
        selectB.appendChild(optB);
      });
    }
    function updateSiteIndicators() {
      var lblA = $("#pt-cur-a-label"), modeA = $("#pt-cur-a-mode"), lblB = $("#pt-cur-b-label"), modeB = $("#pt-cur-b-mode"), lblQB = $("#pt-cur-qb-label");
      if (!lblA || !lblB || !lblQB) return;
      var infoA = getSiteAInfo(), infoB = getSiteBInfo();
      lblA.innerText = infoA.name + " (" + infoA.type.toUpperCase() + ")";
      if (modeA) {
        modeA.className = shouldSiteUseApi(infoA) ? "pt-mode-pill-api" : "pt-mode-pill-web";
        modeA.innerText = shouldSiteUseApi(infoA) ? "🚀API模式" : infoA.type === "np" ? "🌐网页DOM(NP无API)" : "🌐网页DOM";
      }
      lblB.innerText = infoB.name + " (" + infoB.type.toUpperCase() + ")";
      if (modeB) {
        modeB.className = shouldSiteUseApi(infoB) ? "pt-mode-pill-api" : "pt-mode-pill-web";
        modeB.innerText = shouldSiteUseApi(infoB) ? "🚀API查重" : "🌐网页查重";
      }
      lblQB.innerText = config.qbUrl ? config.qbUrl.replace(/https?:\/\//, "").replace(/\/$/, "") : "未配置";
    }
    function setRunProgress(text) {
      var row = $("#pt-run-progress-row");
      var node = $("#pt-run-progress");
      if (!node) return;
      node.textContent = text || "";
      if (row) row.style.display = text ? "" : "none";
    }
    function updateQuotaUI() {
      var quotaEl = $("#pt-cur-quota-label");
      if (!quotaEl) return false;
      var siteA = getSiteAInfo(), siteB = getSiteBInfo();
      var aApi = shouldSiteUseApi(siteA), bApi = shouldSiteUseApi(siteB);
      if (!aApi && !bApi) {
        quotaEl.style.color = "#64748b";
        quotaEl.innerText = siteA.type === "np" && siteB.type === "np" ? "🌐 A/B站均为 NP 架构 (无API，自动走网页解析)" : "🌐 未配置 " + siteA.name + " API Key (当前走网页DOM)";
        return false;
      }
      var activeSite = aApi ? siteA : siteB;
      var st = RateLimiter.checkStatus(activeSite.url, activeSite.type);
      if (!st.allowed) {
        quotaEl.style.color = "#dc2626";
        quotaEl.innerText = "⏳ " + activeSite.name + " 冷却中: 请等 " + st.waitSec + " 秒";
        return true;
      }
      quotaEl.style.color = "#059669";
      quotaEl.innerText = activeSite.name + " 剩余 " + st.remaining + "/" + st.max + " 次 (" + st.ruleLabel + ")";
      return false;
    }
    function startCooldownTicker() {
      if (cooldownTimerId) clearInterval(cooldownTimerId);
      cooldownTimerId = setInterval(function() {
        if (!updateQuotaUI()) {
          clearInterval(cooldownTimerId);
          cooldownTimerId = null;
        }
      }, 1e3);
    }
    bindAction("panel-ready", function() {
      refreshSiteSelectDropdowns();
      updateSiteIndicators();
      if (updateQuotaUI()) startCooldownTicker();
      var selA = $("#pt-cfg-select-a"), selB = $("#pt-cfg-select-b");
      if (selA) selA.onchange = function() {
        var valA = this.value;
        var targetUrlA = valA === "AUTO" || !SITE_DATABASE[valA] ? location.hostname : SITE_DATABASE[valA].url;
        $("#pt-cfg-a-apikey").value = getApiKeyForUrl(targetUrlA);
        $("#pt-cfg-a-host-hint").innerText = "当前绑定域名: " + extractHostKey(targetUrlA);
      };
      if (selB) selB.onchange = function() {
        var valB = this.value;
        $("#pt-cfg-b-apikey").value = getApiKeyForUrl(SITE_DATABASE[valB] ? SITE_DATABASE[valB].url : "");
      };
      var sA = getSiteAInfo(), sB = getSiteBInfo();
      log("面板就绪 | 已识别源A站: " + sA.name + " [" + sA.type.toUpperCase() + " -> " + (shouldSiteUseApi(sA) ? "🚀API模式" : "🌐网页DOM模式") + "] | 目标B站: " + sB.name);
      updateLibraryBadge();
      var libStats = getLibraryStats();
      if (libStats.currentBSite > 0) {
        log("📚 词库已加载: 当前 B 站 [" + libStats.bSiteHost + "] 有 " + libStats.currentBSite + " 条已查重记录（" + (config.libraryFreshHours || 720) + "h 内有效）", "INFO");
      }
    });
    bindAction("cfg-open", function() {
      refreshSiteSelectDropdowns();
      var curHost = extractHostKey(location.hostname);
      if (config.siteAKey !== "AUTO" && SITE_DATABASE[config.siteAKey] && !siteMatchHost(SITE_DATABASE[config.siteAKey], curHost)) {
        config.siteAKey = "AUTO";
        GM_setValue("pt_site_a_key", "AUTO");
      }
      $("#pt-cfg-select-a").value = config.siteAKey;
      $("#pt-cfg-select-b").value = config.siteBKey;
      $("#pt-cfg-api-pages").value = String(config.apiPagesCount || 1);
      var curAUrl = config.siteAKey === "AUTO" || !SITE_DATABASE[config.siteAKey] ? location.hostname : SITE_DATABASE[config.siteAKey].url;
      var curBUrl = SITE_DATABASE[config.siteBKey] ? SITE_DATABASE[config.siteBKey].url : "";
      $("#pt-cfg-a-apikey").value = getApiKeyForUrl(curAUrl);
      $("#pt-cfg-b-apikey").value = getApiKeyForUrl(curBUrl);
      $("#pt-cfg-a-host-hint").innerText = "当前绑定域名: " + extractHostKey(curAUrl);
      $("#pt-cfg-qb-url").value = config.qbUrl;
      $("#pt-cfg-qb-user").value = config.qbUser;
      $("#pt-cfg-qb-pass").value = config.qbPass;
      $("#pt-cfg-qb-cat").value = config.qbCategory;
      $("#pt-cfg-delay").value = config.delayMs;
      if ($("#pt-cfg-lib-hours")) $("#pt-cfg-lib-hours").value = config.libraryFreshHours;
      if ($("#pt-cfg-lib-max")) $("#pt-cfg-lib-max").value = config.libraryMaxEntries;
      $("#pt-cfg-sub-cast").value = config.subCast;
      if ($("#pt-cfg-mt-auto-pull")) $("#pt-cfg-mt-auto-pull").checked = !!config.mtAutoPull;
      $("#pt-cfg-sub-disc").value = config.subDisc;
      $("#pt-cfg-max-shots").value = config.maxShots;
      $("#pt-cfg-with-sub").checked = config.withSubtitle;
      $("#pt-cfg-sub-hide").checked = config.useHide;
      $("#pt-cfg-sub-tag").checked = config.useTag;
      $("#pt-cfg-round-fps").checked = config.roundFps;
      $("#pt-cfg-auto-copy").checked = config.autoCopy;
      if ($("#pt-cfg-img-host")) $("#pt-cfg-img-host").checked = !!config.imgHostEnabled;
      if ($("#pt-cfg-img-host-base")) $("#pt-cfg-img-host-base").value = config.imgHostBase || "";
      $("#pt-cfg-qb-test-msg").style.display = "none";
      $("#pt-cfg-modal").style.display = "flex";
    });
    bindAction("cfg-close", function() {
      $("#pt-cfg-modal").style.display = "none";
    });
    bindAction("cfg-save", function() {
      config.siteAKey = $("#pt-cfg-select-a").value;
      config.siteBKey = $("#pt-cfg-select-b").value;
      config.apiPagesCount = parseInt($("#pt-cfg-api-pages").value, 10) || 1;
      var curAUrl = config.siteAKey === "AUTO" || !SITE_DATABASE[config.siteAKey] ? location.hostname : SITE_DATABASE[config.siteAKey].url;
      var curBUrl = SITE_DATABASE[config.siteBKey] ? SITE_DATABASE[config.siteBKey].url : "";
      if (hostInSiteDatabase(curAUrl, SITE_DATABASE)) setApiKeyForUrl(curAUrl, $("#pt-cfg-a-apikey").value);
      else if (($("#pt-cfg-a-apikey").value || "").trim()) log("API Key 只保存到已配置的站点。当前页不在站点列表里，未保存 A 站密钥。", "WARN");
      if (hostInSiteDatabase(curBUrl, SITE_DATABASE)) setApiKeyForUrl(curBUrl, $("#pt-cfg-b-apikey").value);
      var qbUrlInput = $("#pt-cfg-qb-url").value.trim();
      if (qbUrlInput && !qbUrlInput.endsWith("/")) qbUrlInput += "/";
      config.qbUrl = qbUrlInput;
      config.qbUser = $("#pt-cfg-qb-user").value.trim();
      config.qbPass = $("#pt-cfg-qb-pass").value.trim();
      config.qbCategory = $("#pt-cfg-qb-cat").value.trim();
      config.delayMs = Math.max(500, parseInt($("#pt-cfg-delay").value, 10) || 2500);
      if ($("#pt-cfg-lib-hours")) config.libraryFreshHours = Math.max(1, parseInt($("#pt-cfg-lib-hours").value, 10) || 720);
      if ($("#pt-cfg-lib-max")) config.libraryMaxEntries = Math.max(100, parseInt($("#pt-cfg-lib-max").value, 10) || 20000);
      config.subCast = Math.max(1, parseInt($("#pt-cfg-sub-cast").value, 10) || 3);
      config.mtAutoPull = $("#pt-cfg-mt-auto-pull") ? !!$("#pt-cfg-mt-auto-pull").checked : true;
      GM_setValue("pt_cfg_mt_auto_pull", config.mtAutoPull);
      config.subDisc = $("#pt-cfg-sub-disc").value.trim() || "原盘";
      config.maxShots = Math.max(0, parseInt($("#pt-cfg-max-shots").value, 10) || 12);
      config.withSubtitle = $("#pt-cfg-with-sub").checked;
      config.useHide = $("#pt-cfg-sub-hide").checked;
      config.useTag = $("#pt-cfg-sub-tag").checked;
      config.roundFps = $("#pt-cfg-round-fps").checked;
      config.autoCopy = $("#pt-cfg-auto-copy").checked;
      if ($("#pt-cfg-img-host")) config.imgHostEnabled = $("#pt-cfg-img-host").checked;
      if ($("#pt-cfg-img-host-base")) {
        var hostBaseVal = ($("#pt-cfg-img-host-base").value || "").trim().replace(/\/+$/, "");
        config.imgHostBase = hostBaseVal || "https://s3.pterclub.net";
      }
      GM_setValue("pt_img_host_enabled", config.imgHostEnabled);
      GM_setValue("pt_img_host_base", config.imgHostBase);
      GM_setValue("pt_sub_subCast", config.subCast);
      GM_setValue("pt_sub_subDisc", config.subDisc);
      GM_setValue("pt_sub_maxShots", config.maxShots);
      GM_setValue("pt_sub_withSubtitle", config.withSubtitle);
      GM_setValue("pt_sub_useHide", config.useHide);
      GM_setValue("pt_sub_useTag", config.useTag);
      GM_setValue("pt_sub_roundFps", config.roundFps);
      GM_setValue("pt_sub_autoCopy", config.autoCopy);
      GM_setValue("pt_site_a_key", config.siteAKey);
      GM_setValue("pt_site_b_key", config.siteBKey);
      GM_setValue("pt_api_pages_count", config.apiPagesCount);
      GM_setValue("pt_qb_url", config.qbUrl);
      GM_setValue("pt_qb_user", config.qbUser);
      GM_setValue("pt_qb_pass", config.qbPass);
      GM_setValue("pt_qb_category", config.qbCategory);
      GM_setValue("pt_delay_ms", config.delayMs);
      GM_setValue("pt_library_fresh_hours", config.libraryFreshHours);
      GM_setValue("pt_library_max_entries", config.libraryMaxEntries);
      GM_setValue("pt_lib_v8_migrated", true);
      updateLibraryBadge();
      updateSiteIndicators();
      updateQuotaUI();
      $("#pt-cfg-modal").style.display = "none";
      log("配置已保存！", "SUCCESS");
    });
    if (currentSiteArch === "unit3d") {
      var cleanU3d = function() {
        try {
          if (location.search.indexOf("name=") !== -1) {
            var u = new URL(location.href);
            if ((u.searchParams.get("name") || "").toLowerCase() === "?") {
              u.searchParams.delete("name");
              location.replace(u.toString());
              return;
            }
          }
          var inp = $('input#name, input[wire\\:model\\.live="name"]');
          if (inp) {
            inp.setAttribute("autocomplete", "off");
            inp.setAttribute("data-lpignore", "true");
            if (inp.value && inp.value.trim().toLowerCase() === "?") {
              inp.value = "";
              dispatchEvt(inp);
            }
          }
        } catch (e) {
        }
      };
      cleanU3d();
      setTimeout(cleanU3d, 500);
    }
    function getU3dCbLabel(cb) {
      if (!cb) return "";
      var lbl = cb.closest("label");
      if (lbl) return lbl.textContent.replace(/\s+/g, " ").trim();
      if (cb.id) {
        var forLbl = document.querySelector('label[for="' + cb.id.replace(/"/g, '\\"') + '"]');
        if (forLbl) return forLbl.textContent.replace(/\s+/g, " ").trim();
      }
      if (cb.nextElementSibling && /^(LABEL|SPAN)$/i.test(cb.nextElementSibling.tagName)) {
        return cb.nextElementSibling.textContent.replace(/\s+/g, " ").trim();
      }
      var p = cb.parentElement;
      if (p && p.querySelectorAll('input[type="checkbox"]').length === 1) {
        return p.textContent.replace(/\s+/g, " ").trim();
      }
      return (cb.nextSibling && cb.nextSibling.textContent ? cb.nextSibling.textContent : "").replace(/\s+/g, " ").trim();
    }
    function getU3dCbMeta(cb) {
      var fs = cb.closest("fieldset, .form__fieldset");
      var legEl = fs ? fs.querySelector("legend, .form__legend") : null;
      var legend = legEl ? legEl.textContent.replace(/\s+/g, " ").trim() : "";
      var model = "";
      if (cb.attributes) {
        for (var i = 0; i < cb.attributes.length; i++) {
          var an = cb.attributes[i].name;
          if (an.indexOf("wire:model") === 0 || an === "name") {
            model = (cb.attributes[i].value || "").trim();
            break;
          }
        }
      }
      return { legend, model };
    }
    function applyUnit3dDomPreset() {
      var allCbs = $$('input[type="checkbox"]').filter(function(cb) {
        return !cb.closest("#pt-checker-panel, #pt-cfg-modal, #pt-lib-modal, .pt-inline-toolbar") && !cb.classList.contains("pt-custom-chk");
      });
      var matchedCount = 0;
      var changedCount = 0;
      allCbs.forEach(function(cb) {
        var labelTxt = getU3dCbLabel(cb);
        var meta = getU3dCbMeta(cb);
        var isCat = /^(类别|類別|Category|Categories)$/i.test(meta.legend) || /^categor/i.test(meta.model);
        var isType = /^(规格|規格|Type|Types)$/i.test(meta.legend) || /^type/i.test(meta.model);
        var isRes = /^(分辨率|解析度|Resolution|Resolutions)$/i.test(meta.legend) || /^resolution/i.test(meta.model);
        var isBuff = /^(Buff|Buffs|Discount|Discounts|优惠|優惠|促销|促銷)$/i.test(meta.legend) || /^(free|doubleup|featured)/i.test(meta.model) || /Freeleech/i.test(labelTxt);
        if (!isCat && !isType && !isRes && !isBuff) return;
        matchedCount++;
        var shouldCheck = false;
        if (isCat) shouldCheck = /^(Movie|Movies|电影|電影)$/i.test(labelTxt);
        if (isType) shouldCheck = /^(Full\s*Disc|BDMV|原盘|原盤)$/i.test(labelTxt);
        if (isRes) shouldCheck = /^(4320p|2160p|1080p|1080i)$/i.test(labelTxt);
        if (isBuff) {
          shouldCheck = /Freeleech/i.test(labelTxt) && !/upload|double|featured|双倍|置顶|精选/i.test(labelTxt + " " + meta.model);
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
      $$("select").forEach(function(sel) {
        if (sel.closest("#pt-checker-panel, #pt-cfg-modal")) return;
        var meta = getU3dCbMeta(sel);
        var hasListOpt = Array.from(sel.options).some(function(o) {
          return o.value === "list";
        });
        var has100Opt = Array.from(sel.options).some(function(o) {
          return o.value === "100";
        });
        if ((/view/i.test(meta.model) || hasListOpt) && sel.value !== "list" && hasListOpt) {
          sel.value = "list";
          dispatchEvt(sel);
          changedCount++;
        } else if ((/perPage/i.test(meta.model) || has100Opt && !hasListOpt) && sel.value !== "100" && has100Opt) {
          sel.value = "100";
          dispatchEvt(sel);
          changedCount++;
        }
      });
      return { matchedCount, changedCount };
    }
    var PRESET_HANDLERS = {
      unit3d: async function(siteA) {
        var res = applyUnit3dDomPreset();
        if (res.matchedCount === 0) {
          GM_setValue("pt_u3d_pending_preset", Date.now());
          location.href = location.origin + "/torrents?categoryIds[0]=1&typeIds[0]=1&view=list&perPage=100";
          return;
        }
        setTimeout(function() {
          var retry = applyUnit3dDomPreset();
          if (retry.changedCount > 0) {
            setTimeout(applyUnit3dDomPreset, 700);
          }
          scheduleAutoRestore(1e3);
        }, 700);
        if (shouldSiteUseApi(siteA)) {
          try {
            await fetchSiteAUnit3dListByApi(siteA, getCurrentWebPageNumber(), 1);
          } catch (e) {
          }
        }
        log("✅ 预设已生效：Movie + Full Disc + 分辨率(含4320p) + Freeleech全选 + 100条/页！", "SUCCESS");
      },
      gz: function() {
        var form = $("#filter_torrents_form");
        if (!form) return;
        var sInput = $('input[name="searchstr"]', form);
        if (sInput) sInput.value = "";
        var mediaSel = $('select[name="media"]', form);
        if (mediaSel) mediaSel.value = "Blu-ray";
        var encSel = $('select[name="encoding"]', form);
        if (encSel) encSel.value = "m2ts";
        var freeChk = $('input[name="freetorrent"], #freetorrent', form);
        if (freeChk) freeChk.checked = true;
        var cat1 = $('#cat_1, input[name="filter_cat[1]"]', form);
        if (cat1) cat1.checked = true;
        for (var c = 2; c <= 6; c++) {
          var catOther = $("#cat_" + c + ', input[name="filter_cat[' + c + ']"]', form);
          if (catOther) catOther.checked = false;
        }
        form.submit();
      },
      f3nix: function() {
        location.href = location.origin + "/torrents?categories[]=1&types[]=UHD+100&types[]=UHD+66&types[]=UHD+50&types[]=BD+50&types[]=BD+25&resolutions[]=4320p&resolutions[]=2160p&resolutions[]=1080p&resolutions[]=1080i&sources[]=Blu-ray&freeleech=1&qty=100&doSearch=Search";
      },
      np: function() {
        if (isMTeamPage()) {
          applyMTeamPreset();
          return;
        }
        var sInput = $('input[name="search"], #searchinput');
        if (sInput) sInput.value = "";
        var setCb = function(id, val) {
          var node = document.getElementById(id) || $('input[name="' + id + '"]');
          if (node) node.checked = val;
        };
        ["source1", "source2", "cat401", "standard1", "standard2", "standard3", "standard5", "standard6"].forEach(function(k) {
          setCb(k, true);
        });
        ["source3", "source4", "source5", "source6", "cat402", "cat403", "cat404", "cat405"].forEach(function(k) {
          setCb(k, false);
        });
        $$("label, td").forEach(function(elNode) {
          if (/\b(4320p|8K)\b/i.test(elNode.textContent || "")) {
            var cb = $('input[type="checkbox"]', elNode) || (elNode.previousElementSibling && elNode.previousElementSibling.type === "checkbox" ? elNode.previousElementSibling : null);
            if (cb) cb.checked = true;
          }
        });
        var spSel = $('select[name="spstate"]');
        if (spSel) {
          var promoOpt = Array.from(spSel.options).find(function(o) {
            return /促销|優惠|Promotion/i.test(o.textContent);
          });
          spSel.value = promoOpt ? promoOpt.value : "2";
        }
        var form = $('form[name="searchbox"], form[action*="torrents.php"]');
        if (form) form.submit();
        else location.href = location.origin + "/torrents.php?cat401=1&medium1=1&medium2=1&spstate=2&incldead=1";
      }
    };
    bindAction("btn1-preset", async function() {
      var siteA = getSiteAInfo();
      log("正在执行预设：为 [" + siteA.name + "] 锁定电影蓝光原盘检索条件...");
      await (PRESET_HANDLERS[currentSiteArch] || PRESET_HANDLERS.np)(siteA);
    });
    function getCurrentWebPageNumber() {
      var urlPage = new URLSearchParams(location.search).get("page");
      if (urlPage && /^\d+$/.test(urlPage)) return parseInt(urlPage, 10);
      var activeEl = $(".pagination__current, .page-item.active .page-link, font.gray > b");
      return activeEl && /^\d+$/.test(activeEl.textContent.trim()) ? parseInt(activeEl.textContent.trim(), 10) : 1;
    }
    function parseNexusPhpRowAgeDays(row) {
      var timeSpan = $('td span[title^="202"], td span[title^="201"]', row);
      if (timeSpan) {
        var exactStr = timeSpan.getAttribute("title").trim();
        var ts = Date.parse(exactStr.replace(/-/g, "/"));
        if (!isNaN(ts)) return { days: (Date.now() - ts) / 864e5, text: timeSpan.textContent.trim() || exactStr };
      }
      var tds = $$("td", row);
      for (var i = 0; i < tds.length; i++) {
        var parsedAge = parseRelativeAgeDays((tds[i].textContent || "").trim());
        if (parsedAge) return parsedAge;
      }
      return { days: 999, text: "" };
    }
    function extractCleanNpSubtitleInfo(row) {
      if (!row) return { cnTitle: "", regionBracket: "" };
      var titleA = $('a[href*="details.php"], a[href*="/detail/"]', row);
      var cell = titleA && (titleA.closest("td.embedded") || titleA.closest("td")) || $("td.embedded, .torrentname", row);
      if (!cell) return { cnTitle: "", regionBracket: "" };
      var clone = cell.cloneNode(true);
      $$('.pt-inline-toolbar, .pt-audit-badge, .pt-dupe-badge, .pt-single-check-btn, .pt-single-forward-btn, .pt-single-qb-btn, a[href*="details.php"], a[href*="imdb.com"], a[href*="douban.com"], .optiontag, span[class*="tag"], b, img, script, style', clone).forEach(function(n) {
        n.remove();
      });
      $$("span, font, a", clone).forEach(function(n) {
        if (RE.NP_UI_TAG.test((n.textContent || "").trim())) n.remove();
      });
      return parseCleanSubtitleString(clone.textContent || "");
    }
    async function fetchSiteAUnit3dListByApi(siteA, startPage, pagesCount, opts) {
      opts = opts || {};
      if (!shouldSiteUseApi(siteA)) throw new Error("当前站点走网页模式");
      startPage = startPage || getCurrentWebPageNumber();
      var curPerPage = new URLSearchParams(location.search).get("perPage") || "100";
      if (!opts.append) siteAApiMap.clear();
      var nextPage = startPage;
      var aborted = false;
      for (var p = 0; p < pagesCount; p++) {
        if (isCheckingCancelled) {
          aborted = true;
          break;
        }
        checkApiQuotaOrThrow(siteA, "unit3d");
        var targetPage = startPage + p;
        var hasFreeFilter = location.search.indexOf("free[") !== -1;
        var freeApiParam = hasFreeFilter ? "&free[0]=0&free[1]=25&free[2]=50&free[3]=75&free[4]=100" : "";
        var apiUrl = siteBase(siteA.url) + "api/torrents/filter?categories[0]=1&types[0]=1&resolutions[0]=1&resolutions[1]=2&resolutions[2]=3&resolutions[3]=4" + freeApiParam + "&perPage=" + encodeURIComponent(curPerPage) + "&page=" + targetPage;
        log("⚡ [A站 API] 正在拉取第 " + targetPage + " 页数据...", "INFO");
        var json = null;
        try {
          json = await http(apiUrl, { responseType: "json", headers: u3dHeaders(siteA.apiKey) });
        } catch (err) {
          if (err.message === "HTTP 429") RateLimiter.forceCooldown(siteA.url, 30);
          throw err;
        }
        var list = json && Array.isArray(json.data) ? json.data : [];
        if (list.length === 0) {
          apiCrawlCursor = { nextPage: targetPage, done: true };
          log("✅ [A站 API] 共拉取到 " + siteAApiMap.size + " 条结构化电影原盘数据！", "SUCCESS");
          return siteAApiMap;
        }
        list.forEach(function(entry) {
          var tid = String(entry.id || entry.attributes && entry.attributes.id || "");
          var attr = entry.attributes || entry;
          if (tid && attr) {
            siteAApiMap.set(tid, {
              torrentId: tid,
              page: targetPage,
              name: attr.name || "",
              categoryId: String(attr.category_id || "1"),
              typeId: String(attr.type_id || "1"),
              typeName: attr.type || "Full Disc",
              resolution: attr.resolution || "",
              sizeGB: parseSizeToGB(attr.size || 0),
              imdbId: normalizeImdbId(attr.imdb_id),
              bdinfo: attr.bdinfo || attr.media_info || attr.mediainfo || "",
              description: attr.description || "",
              downloadUrl: attr.download_link || siteUrl(siteA, "download", { id: tid })
            });
          }
        });
        nextPage = targetPage + 1;
        apiCrawlCursor = { nextPage, done: false };
        if (p < pagesCount - 1) {
          if (isCheckingCancelled) {
            aborted = true;
            break;
          }
          await new Promise(function(r) {
            setTimeout(r, 1e3);
          });
        }
      }
      apiCrawlCursor = { nextPage, done: !aborted };
      log("✅ [A站 API] 共拉取到 " + siteAApiMap.size + " 条结构化电影原盘数据！", "SUCCESS");
      return siteAApiMap;
    }
    async function fetchSiteAGazelleListByApi(siteA, startPage, pagesCount) {
      if (!shouldSiteUseApi(siteA)) throw new Error("当前站点走网页模式");
      startPage = startPage || getCurrentWebPageNumber();
      siteAApiMap.clear();
      var headers = gzHeaders(siteA.apiKey);
      var curHost = extractHostKey(location.hostname);
      var aHost = extractHostKey(siteA.url);
      var sameSite = curHost === aHost;
      for (var p = 0; p < pagesCount; p++) {
        if (isCheckingCancelled) break;
        checkApiQuotaOrThrow(siteA, "gz");
        var targetPage = startPage + p;
        var apiUrlStr;
        if (sameSite) {
          var u = new URL(location.href);
          u.searchParams.set("json", "1");
          u.searchParams.set("page", String(targetPage));
          apiUrlStr = u.toString();
        } else {
          apiUrlStr = siteBase(siteA.url) + "torrents.php?json=1&page=" + targetPage;
        }
        var data = null;
        try {
          data = await http(apiUrlStr, { responseType: "json", headers });
        } catch (err) {
          if (err.message === "HTTP 429") RateLimiter.forceCooldown(siteA.url, 15);
          throw err;
        }
        var movies = data && data.Movies || [];
        if (movies.length === 0) break;
        movies.forEach(function(movie) {
          var imdb = normalizeImdbId(movie.ImdbId);
          (movie.GroupingQualities || []).forEach(function(gq) {
            (gq.Torrents || []).forEach(function(t) {
              var tid = String(t.TorrentId);
              siteAApiMap.set(tid, {
                torrentId: tid,
                page: targetPage,
                name: t.ReleaseName || t.Title || "",
                releaseGroup: t.ReleaseGroup || "",
                movieTitle: movie.Title || "",
                movieYear: String(movie.Year || ""),
                categoryName: gq.CategoryName || "Feature Film",
                specText: t.Title || "",
                sizeGB: parseSizeToGB(Number(t.Size || 0)),
                imdbId: imdb
              });
            });
          });
        });
        if (p < pagesCount - 1) await new Promise(function(r) {
          setTimeout(r, 2200);
        });
      }
      return siteAApiMap;
    }
    // ===== M-Team (React SPA, /browse/*) 适配 =====
    function isMTeamPage() {
      return /m-team\.(cc|io)/i.test(location.hostname);
    }
    function mteamRows() {
      return $$("table tbody tr").filter(function(tr) {
        return !!$('a[href*="/detail/"]', tr);
      });
    }
    function mteamRowData(row) {
      var anchor = $('a[href*="/detail/"]', row);
      if (!anchor) return null;
      var href = anchor.getAttribute("href") || "";
      var tid = (href.match(/\/detail\/(\d+)/i) || ["", ""])[1];
      var titleNode = $("strong", anchor);
      var mainTitle = String((titleNode ? titleNode.textContent : anchor.textContent) || "").replace(/\s+/g, " ").trim();
      var catNode = $('span[class*="cat-"]', row);
      var catText = catNode ? String(catNode.textContent || "").trim() : "";
      var tags = $$("span.ant-tag", row).map(function(t) {
        return String(t.textContent || "").trim();
      }).filter(Boolean);
      var cellText = String(row.textContent || "").replace(/\s+/g, " ");
      var sizeGB = 0;
      $$("td", row).forEach(function(td) {
        if (sizeGB) return;
        var t = String(td.textContent || "").replace(/\s+/g, " ").trim();
        var mm = t.match(/^([\d.,]+)\s*(TB|TiB|GB|GiB|MB|MiB)$/i);
        if (mm) sizeGB = parseSizeToGB(mm[1].replace(/,/g, "") + mm[2]) || 0;
      });
      var imdbId = (String(row.innerHTML || "").match(/tt\d{7,9}/i) || [""])[0].toLowerCase();
      return { row, anchor, tid, mainTitle, catText, tags, cellText, sizeGB, imdbId };
    }
    function auditMTeamRows(curWebPage) {
      var rows = mteamRows();
      var scanned = 0, pass = 0, review = 0, skipped = 0;
      rows.forEach(function(row) {
        var info = mteamRowData(row);
        if (!info || !info.tid) return;
        scanned++;
        var tagText = info.tags.join(" ");
        var ageInfo = parseNexusPhpRowAgeDays(row);
        var isForbidden = RE.FORBIDDEN.test(info.cellText) || !!$('img[alt*="禁转"], img[title*="禁转"]', row);
        var isLimited = RE.LIMITED.test(info.cellText) || /限转/.test(tagText);
        var isDiy = RE.DIY.test(info.cellText + " " + tagText);
        var isNotMovie = info.catText ? !/電影|电影/.test(info.catText) : RE.NON_MOVIE.test(info.mainTitle);
        var isRemux = /\bREMUX\b/i.test(info.mainTitle);
        var looksDisc = RE.DISC_MEDIA.test(info.mainTitle) && RE.DISC_CODEC.test(info.mainTitle) && !RE.ENCODE.test(info.mainTitle);
        var is4K = RE.UHD.test(info.mainTitle) || /(^|[\s,])4k([\s,]|$)/i.test(tagText);
        var skipCode = "", extraTxt = "", passLabel = "";
        if (isForbidden) skipCode = "FORBIDDEN";
        else if (isLimited && ageInfo.days < 7) {
          skipCode = "LIMIT7";
          extraTxt = "仅发 " + (ageInfo.text || Math.floor(ageInfo.days) + "天");
        } else if (isNotMovie) skipCode = "NON_MOVIE";
        else if (isDiy) skipCode = "DIY_SKIP";
        else if (isRemux || !looksDisc) skipCode = "ENCODE";
        if (skipCode) skipped++;
        else {
          if (!/BluRay|Blu-ray|原盘/i.test(info.catText)) {
            passLabel = "🌐原盘[复核]";
            review++;
          } else passLabel = is4K ? "🌐网页原盘 4K" : "🌐网页原盘";
        }
        var ok = commitAudit(row, info.anchor, {
          pass: !skipCode,
          code: skipCode,
          extra: extraTxt,
          mainTitle: info.mainTitle,
          releaseName: info.mainTitle,
          torrentId: info.tid,
          imdbId: info.imdbId,
          sizeGB: info.sizeGB,
          is4K: is4K,
          customPassLabel: passLabel,
          downloadUrl: siteUrl({ url: location.origin + "/", type: "np" }, "download", { id: info.tid })
        }, curWebPage);
        if (ok) pass++;
      });
      log("[M-TEAM] 审核完毕: 扫描 " + scanned + " 项，合格 " + pass + " 项（复核 " + review + "，跳过 " + skipped + "）。", "SUCCESS");
      return pass;
    }
    function mteamSleep(ms) {
      return new Promise(function(r) {
        setTimeout(r, ms);
      });
    }
    function mteamFormItem(labelRe) {
      var items = $$(".ant-form-item");
      for (var i = 0; i < items.length; i++) {
        var lab = $(".ant-form-item-label label", items[i]) || $("label", items[i]);
        if (lab && labelRe.test(String(lab.textContent || "").trim())) return items[i];
      }
      return null;
    }
    async function mteamSetSelect(labelRe, wants) {
      var item = mteamFormItem(labelRe);
      if (!item) return "未找到该项";
      var sel = $(".ant-select", item);
      if (!sel) return "无下拉";
      var cur = String(sel.textContent || "").replace(/\s+/g, "");
      for (var w = 0; w < wants.length; w++) {
        if (cur && cur.indexOf(String(wants[w]).replace(/\s+/g, "")) >= 0) return "已是 " + wants[w];
      }
      var trigger = $(".ant-select-content", sel) || $(".ant-select-selector", sel) || sel;
      for (var attempt = 0; attempt < 2; attempt++) {
        try {
          trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
          trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        } catch (e) {
        }
        trigger.click();
        for (var t = 0; t < 12; t++) {
          await mteamSleep(120);
          var opts = $$(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option, .ant-select-dropdown .ant-select-item-option");
          for (var j = 0; j < opts.length; j++) {
            var txt = String(opts[j].textContent || "").replace(/\s+/g, "");
            for (var k = 0; k < wants.length; k++) {
              var want = String(wants[k]).replace(/\s+/g, "");
              if (txt && want && txt.indexOf(want) >= 0) {
                opts[j].click();
                return "已设为 " + wants[k];
              }
            }
          }
        }
      }
      return "未找到选项";
    }
    function mteamWaitFor(getter, timeoutMs) {
      return new Promise(function(resolve) {
        var start = Date.now();
        (function tick() {
          var v = null;
          try {
            v = getter();
          } catch (e) {
            v = null;
          }
          if (v) return resolve(v);
          if (Date.now() - start >= timeoutMs) return resolve(null);
          setTimeout(tick, 250);
        })();
      });
    }
    function mteamCatTags() {
      return $$('span[class*="cat-"]').filter(function(s) {
        return /\bcat-\d+\b/.test(s.getAttribute("class") || "");
      });
    }
    function mteamCategoryChecked(tag) {
      var cls = tag.getAttribute("class") || "";
      return /ant-tag-checkable-checked/.test(cls);
    }
    async function applyMTeamPreset() {
      if (!/^\/browse(\/|$)/.test(location.pathname)) {
        try {
          GM_setValue("pt_mteam_pending_preset", Date.now());
        } catch (e) {
        }
        log("➡ M-Team 预设：先跳到電影列表页，加载后会自动套用筛选条件...", "INFO");
        location.href = location.origin + "/browse/movie";
        return;
      }
      var tags = mteamCatTags();
      if (!tags.length) {
        var toggles = $$("button, a, span");
        for (var i = 0; i < toggles.length; i++) {
          var t = String(toggles[i].textContent || "");
          if (t.length < 12 && /高級搜索|高级搜索/.test(t)) {
            try {
              toggles[i].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            } catch (e) {
            }
            toggles[i].click();
            break;
          }
        }
        await mteamWaitFor(function() {
          return mteamCatTags().length ? true : null;
        }, 8000);
        tags = mteamCatTags();
      }
      if (!tags.length) {
        log("⚠ M-Team 预设未执行：没找到筛选面板（可能页面尚未渲染完或界面改版）。请手动选 電影/BluRay + 免費。", "WARN");
        return;
      }
      var notes = [];
      var wantOn = ["421"];
      var wantOff = ["401", "419", "420", "439"];
      var changes = 0, seenTags = 0;
      for (var wi = 0; wi < wantOn.length; wi++) {
        var onTag = $(".cat-" + wantOn[wi]);
        if (!onTag) continue;
        seenTags++;
        if (!mteamCategoryChecked(onTag)) {
          onTag.click();
          changes++;
          await mteamSleep(250);
        }
      }
      for (var wj = 0; wj < wantOff.length; wj++) {
        var offTag = $(".cat-" + wantOff[wj]);
        if (!offTag) continue;
        seenTags++;
        if (mteamCategoryChecked(offTag)) {
          offTag.click();
          changes++;
          await mteamSleep(250);
        }
      }
      notes.push(!seenTags ? "未找到類別标签" : changes ? "類別已锁定 電影/BluRay（其余已取消）" : "類別已是 電影/BluRay");
      await mteamSleep(changes ? 700 : 200);
      log("✅ M-Team 预设已应用：" + notes.join("；") + "。解析度/製作組等其它条件请手动选择。", "SUCCESS");
      scheduleAutoRestore(1200);
      if (config.mtAutoPull) {
        setRunProgress("预设完成，2.5 秒后自动开始拉取全部页...");
        log("▶ 已开启「预设后自动拉取」：2.5 秒后自动执行拉取/查重（可在设置里关掉）。", "INFO");
        setTimeout(function() {
          try {
            var pull = ACTION_BUS["btn-pull-dupe"];
            if (pull) pull(null);
          } catch (e) {
          }
        }, 2500);
      }
    }
    function mteamFirstRowKey() {
      var rows = mteamRows();
      if (!rows.length) return "";
      return String(rows[0].textContent || "").replace(/\s+/g, " ").slice(0, 60);
    }
    function mteamPagerItem(num) {
      var links = $$(".ant-pagination a");
      for (var i = 0; i < links.length; i++) {
        if (String(links[i].textContent || "").trim() === String(num)) return links[i];
      }
      return null;
    }
    function mteamActivePage() {
      var a = $(".ant-pagination-item-active");
      var n = a ? parseInt(String(a.textContent || "").trim(), 10) : 0;
      return isFinite(n) && n > 0 ? n : 0;
    }
    function mteamIsLoading() {
      return !!$(".ant-spin-spinning, .ant-skeleton-active, .ant-spin-blur, .ant-spin-dot");
    }
    async function mteamWaitPageChange(trigger) {
      var before = mteamFirstRowKey();
      try {
        trigger();
      } catch (e) {
        return false;
      }
      for (var i = 0; i < 24; i++) {
        await mteamSleep(250);
        var now = mteamFirstRowKey();
        if (now && now !== before) return true;
      }
      return false;
    }
    function mteamTotalPages() {
      var max = 0;
      $$(".ant-pagination-item").forEach(function(li) {
        var n = parseInt(String(li.textContent || "").trim(), 10);
        if (isFinite(n) && n > max) max = n;
      });
      return max;
    }
    function mteamPageLink(num) {
      var lis = $$(".ant-pagination-item");
      for (var i = 0; i < lis.length; i++) {
        if (String(lis[i].textContent || "").trim() === String(num)) return $("a", lis[i]) || lis[i];
      }
      var byClass = $(".ant-pagination-item-" + num + " a");
      return byClass || null;
    }
    async function mteamNextPageConfirmed(useNumberLink) {
      var nextLi = $(".ant-pagination-next");
      if (!nextLi) return "stalled";
      if (/ant-pagination-disabled/.test(nextLi.getAttribute("class") || "")) return "end";
      var want = mteamActivePage() + 1;
      var beforeKey = mteamFirstRowKey();
      var btn = $("button", nextLi) || nextLi;
      var numLink = useNumberLink ? mteamPageLink(want) : null;
      try {
        (numLink || btn).click();
      } catch (e) {
        return "stalled";
      }
      var start = Date.now();
      while (Date.now() - start < 12e3) {
        await mteamSleep(250);
        if (isCheckingCancelled) return "cancel";
        var act = mteamActivePage();
        var key = mteamFirstRowKey();
        if (key && key !== beforeKey && !mteamIsLoading() && (act === want || act === 0)) return "ok";
      }
      return "stalled";
    }
    async function mteamGotoPageNumber(target) {
      var act = mteamActivePage();
      if (act === target) return true;
      var link = mteamPageLink(target);
      if (link) {
        var ok1 = await mteamWaitPageChange(function() {
          link.click();
        });
        if (ok1) return true;
      }
      var jumper = $(".ant-pagination-options-quick-jumper input");
      if (jumper) {
        try {
          jumper.value = String(target);
          jumper.dispatchEvent(new Event("input", { bubbles: true }));
          jumper.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
          jumper.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", keyCode: 13, bubbles: true }));
          jumper.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (e) {
        }
        for (var i = 0; i < 40; i++) {
          await mteamSleep(250);
          if (mteamActivePage() === target) return true;
        }
      }
      return false;
    }
    async function crawlMTeamPages(onRow, pageDelay, itemsMap, startPage) {
      var minDelay = typeof pageDelay === "number" ? pageDelay : 2000;
      var jitter = typeof pageDelay === "number" ? 0 : 1200;
      var total = mteamTotalPages();
      var startAt = Math.max(1, parseInt(startPage, 10) || 1);
      if (startAt > 1) {
        log("↩ 断点续传：直接跳到第 " + startAt + " 页继续（已抓过的靠名单去重，不重复计数）...", "INFO");
        var jumped = await mteamGotoPageNumber(startAt);
        if (!jumped) {
          log("⚠️ 未能跳到第 " + startAt + " 页，退回从第 1 页抓。", "WARN");
          startAt = 1;
          if (mteamActivePage() !== 1) await mteamGotoPageNumber(1);
        }
      } else if (mteamActivePage() !== 1) {
        await mteamGotoPageNumber(1);
      }
      var pageNo = startAt, added = 0, stallRetry = 0, reachedEnd = false, iterations = 0;
      while (!isCheckingCancelled && iterations < 400) {
        iterations++;
        var rows = mteamRows();
        if (!rows.length) {
          await mteamSleep(900);
          rows = mteamRows();
          if (!rows.length) {
            log("⏹️ 第 " + pageNo + " 页没有行数据，抓取结束。", "WARN");
            reachedEnd = true;
            break;
          }
        }
        var hit = 0;
        rows.forEach(function(row) {
          if (onRow(row)) hit++;
        });
        if (hit === 0) {
          await mteamSleep(1500);
          var retryRows = mteamRows();
          var hit2 = 0;
          retryRows.forEach(function(row) {
            if (onRow(row)) hit2++;
          });
          if (hit2 > 0) hit = hit2;
        }
        added += hit;
        total = mteamTotalPages() || total;
        var pageText = pageNo + (total ? "/" + total : "");
        log("📥 M-TEAM 第 " + pageText + " 页：本页命中 " + hit + "，累计 " + added + " 条原盘", "INFO");
        setRunProgress("抓取 " + pageText + " 页 · 累计 " + added + " 条原盘");
        await mteamSleep(minDelay + Math.floor(Math.random() * jitter));
        if (iterations % 20 === 0) {
          log("☕ 翻页批次保护：已翻 " + iterations + " 页，微歇 12 秒（避免触发站点限流）...", "INFO");
          await mteamSleep(12000);
        }
        if (isCheckingCancelled) break;
        var step = await mteamNextPageConfirmed(false);
        if (step === "end") {
          log("⏹️ 已到分页最后一页（第 " + pageNo + " 页），抓取结束。", "INFO");
          reachedEnd = true;
          break;
        }
        if (step === "cancel") break;
        if (step !== "ok") {
          await mteamSleep(20000);
          log("⚠️ 第 " + (pageNo + 1) + " 页翻页未确认，歇 20 秒后改用页码重试...", "WARN");
          step = await mteamNextPageConfirmed(true);
          if (step === "end") {
            log("⏹️ 已到分页最后一页（第 " + pageNo + " 页）。", "INFO");
            reachedEnd = true;
            break;
          }
          if (step !== "ok") {
            log("⚠️ 仍翻不过去（可能被限流）：停在 " + pageNo + " 页，断点已保留，歇一会儿再点「拉取/查重」可从这里继续。", "WARN");
            break;
          }
        }
        pageNo++;
        stallRetry = 0;
      }
      if (pageNo > 1) {
        var back = mteamPagerItem(1);
        if (back) {
          await mteamWaitPageChange(function() {
            back.click();
          });
        }
      }
      log("✅ M-TEAM 翻页抓取完成：抓到第 " + pageNo + " 页，累计 " + added + " 条原盘。", "SUCCESS");
      setRunProgress("抓取完成：第 " + pageNo + " 页，累计 " + added + " 条原盘");
      mteamRemountToolbars(itemsMap);
      return { pages: pageNo, added: added, reachedEnd: reachedEnd };
    }    function mteamRemountToolbars(itemsMap) {
      if (!itemsMap) return 0;
      var rows = mteamRows();
      var n = 0;
      rows.forEach(function(row) {
        var mi = mteamRowData(row);
        if (!mi || !mi.tid) return;
        var item = itemsMap.get(mi.tid);
        if (!item) return;
        if ($(".pt-inline-toolbar, .pt-single-check-btn", row)) return;
        item.row = row;
        if (!item.chkBox) item.chkBox = { checked: true };
        try {
          createInlineToolbar(item, row, mi.anchor.parentNode || mi.anchor.parentElement, mi.anchor);
          n++;
        } catch (e) {
        }
      });
      if (n) log("🛠 已为当前页重新挂载工具条 " + n + " 条（翻页后 DOM 重建导致丢失）。", "SUCCESS");
      return n;
    }
    var AUDIT_HANDLERS = {
      unit3d: async function(siteA, curWebPage, useApiOnA, pagesCount) {
        $$('[data-pt-row="auditable"]').forEach(function(row2) {
          cleanRowTags(row2);
        });
        if (useApiOnA) {
          try {
            await fetchSiteAUnit3dListByApi(siteA, curWebPage, pagesCount);
          } catch (e) {
            siteAApiMap.clear();
          }
        } else siteAApiMap.clear();
        var bluRows = $$("tr.torrent-search--list__row, table.data-table tbody tr");
        var passBLU = 0, matchedRowIds = /* @__PURE__ */ new Set();
        for (var i = 0; i < bluRows.length; i++) {
          if (i > 0 && i % 40 === 0) await new Promise(function(r) {
            setTimeout(r, 0);
          });
          var row = bluRows[i];
          var anchor = $("a.torrent-search--list__name", row) || $('td.torrent-search--list__overview a[href*="/torrents/"]', row) || $('a[href*="/torrents/"]', row);
          if (!anchor || /\/download\//i.test(anchor.href)) continue;
          var tid = row.getAttribute("data-torrent-id") || (anchor.href.match(/\/torrents\/(\d+)/) ? anchor.href.match(/\/torrents\/(\d+)/)[1] : "");
          if (tid) matchedRowIds.add(String(tid));
          var apiItem = useApiOnA && tid ? siteAApiMap.get(String(tid)) : null;
          var bluName = apiItem && apiItem.name ? apiItem.name : anchor.textContent.trim();
          var typeBadge = apiItem && apiItem.typeName ? apiItem.typeName : ($(".torrent-search--list__type", row) ? $(".torrent-search--list__type", row).textContent : "").trim();
          var resBadge = apiItem && apiItem.resolution ? apiItem.resolution : ($(".torrent-search--list__resolution", row) ? $(".torrent-search--list__resolution", row).textContent : "").trim();
          var catImgNode = $(".torrent-search--list__category img", row);
          var catTitle = catImgNode ? catImgNode.getAttribute("title") || "" : "";
          var isMovie = apiItem ? apiItem.categoryId === "1" : row.getAttribute("data-category-id") === "1" || /Movie/i.test(catTitle) || row.innerHTML.indexOf("category-images/1") !== -1 || !RE.NON_MOVIE.test(catTitle);
          var isFullDisc = apiItem ? apiItem.typeId === "1" || /Full Disc/i.test(apiItem.typeName) : row.getAttribute("data-type-id") === "1" || /Full Disc/i.test(typeBadge) || RE.DISC_MEDIA.test(bluName);
          var isDvd = RE.DVD.test(bluName + " " + resBadge);
          var isRemux = RE.ENCODE.test(bluName + " " + typeBadge);
          var dlAnchor = $('a[href*="/download/"]', row);
          var rowImdbNode = $('a[href*="imdb.com/title/tt"]', row);
          var rowImdb = normalizeImdbId(apiItem && apiItem.imdbId || row.getAttribute("data-imdb-id") || (rowImdbNode ? rowImdbNode.href : "") || "");
          var verdict;
          if (isMovie && isFullDisc && !isDvd && !isRemux) {
            verdict = {
              pass: true,
              fromApi: !!apiItem,
              torrentId: tid,
              releaseName: bluName,
              extraSpec: resBadge,
              imdbId: rowImdb,
              bdinfo: apiItem ? apiItem.bdinfo : "",
              sizeGB: apiItem && apiItem.sizeGB || readRowSize(row, ".torrent-search--list__size"),
              is4K: is4kText(bluName + " " + resBadge) || row.getAttribute("data-resolution-id") === "1",
              downloadUrl: apiItem && apiItem.downloadUrl || (dlAnchor ? dlAnchor.href : tid ? siteUrl(siteA, "download", { id: tid }) : "")
            };
          } else if (!isMovie) verdict = { pass: false, code: "NON_MOVIE" };
          else if (isDvd) verdict = { pass: false, code: "DVD" };
          else if (isRemux) verdict = { pass: false, code: "ENCODE" };
          else verdict = { pass: false, code: "NON_DISC" };
          if (commitAudit(row, anchor, verdict, curWebPage)) passBLU++;
        }
        var extraApiCount = 0;
        if (useApiOnA) {
          siteAApiMap.forEach(function(apiItem2, tid2) {
            if (!matchedRowIds.has(tid2) && apiItem2.categoryId === "1" && (apiItem2.typeId === "1" || /Full Disc/i.test(apiItem2.typeName)) && !RE.DVD.test(apiItem2.name + " " + apiItem2.resolution) && !RE.ENCODE.test(apiItem2.name + " " + apiItem2.resolution)) {
              if (commitAudit(null, null, {
                pass: true,
                fromApi: true,
                torrentId: tid2,
                releaseName: apiItem2.name,
                extraSpec: apiItem2.resolution,
                imdbId: apiItem2.imdbId,
                bdinfo: apiItem2.bdinfo,
                sizeGB: apiItem2.sizeGB,
                downloadUrl: apiItem2.downloadUrl
              }, apiItem2.page)) {
                extraApiCount++;
                passBLU++;
              }
            }
          });
        }
        log("[UNIT3D] 审核完毕: 检出合格蓝光电影原盘 " + passBLU + " 项" + (extraApiCount > 0 ? " (含跨页API连拉 " + extraApiCount + " 项)" : "") + "。", "SUCCESS");
      },
      gz: async function(siteA, curWebPage, useApiOnA, pagesCount) {
        if (useApiOnA) {
          try {
            await fetchSiteAGazelleListByApi(siteA, curWebPage, pagesCount);
          } catch (e) {
            siteAApiMap.clear();
          }
        } else siteAApiMap.clear();
        var pageTitleM = document.title.match(/^(.+?)\s*[\[(](\d{4})[\])]/i);
        var globalMovieTitle = pageTitleM ? pageTitleM[1].trim() : "", globalMovieYear = pageTitleM ? pageTitleM[2] : "";
        var imdbA = $("#imdb-title-link");
        if (!imdbA) {
          var _imdbLinks = $$('a[href*="imdb.com/title/tt"]');
          if (_imdbLinks.length === 1) imdbA = _imdbLinks[0];
        }
        var globalImdbId = imdbA ? normalizeImdbId(imdbA.href) : "";
        var ptpPageData = rootWin.PageData || window.PageData;
        var torrentMetaMap = /* @__PURE__ */ new Map();
        if (ptpPageData && ptpPageData.Movies) {
          ptpPageData.Movies.forEach(function(movie) {
            var imdb = normalizeImdbId(movie.ImdbId);
            (movie.GroupingQualities || []).forEach(function(gq) {
              (gq.Torrents || []).forEach(function(t) {
                torrentMetaMap.set(String(t.TorrentId), {
                  imdbId: imdb,
                  releaseName: t.ReleaseName || "",
                  releaseGroup: t.ReleaseGroup || "",
                  titleDesc: t.Title || "",
                  size: t.Size || "",
                  movieTitle: movie.Title || "",
                  movieYear: movie.Year || ""
                });
              });
            });
          });
        }
        var links = $$("a.torrent-info-link"), passCount = 0;
        links.forEach(function(link) {
          var tidM = link.href.match(/torrentid=(\d+)/i) || (link.getAttribute("onclick") || "").match(/(\d{4,8})/);
          var trRow = link.closest("tr") || link.parentNode;
          var tid = tidM ? tidM[1] : trRow && trRow.id && trRow.id.match(/\d+/) ? trRow.id.match(/\d+/)[0] : "";
          var apiMeta = useApiOnA ? siteAApiMap.get(String(tid)) : null;
          var meta = apiMeta || torrentMetaMap.get(String(tid));
          var releaseName = meta && (meta.name || meta.releaseName) || (trRow && trRow.getAttribute ? trRow.getAttribute("data-releasename") : "") || link.getAttribute("title") || "";
          var specText = (meta && (meta.specText || meta.titleDesc) || link.innerText || "").replace(/<[^>]+>/g, "");
          var isDisc = RE.GZ_DISC.test(specText + " " + releaseName);
          var isRemux = RE.ENCODE.test(specText + " " + releaseName);
          var sizeCell = $("td.nobr, td:nth-child(2)", trRow);
          var dlLink = $('a[href*="action=download"]', trRow);
          var verdict = isDisc && !isRemux ? {
            pass: true,
            fromApi: !!apiMeta,
            torrentId: tid,
            mainTitle: releaseName || specText,
            releaseName,
            extraSpec: specText,
            releaseGroup: meta && meta.releaseGroup || (trRow && trRow.getAttribute ? trRow.getAttribute("data-releasegroup") : "") || "",
            movieTitle: meta && meta.movieTitle || globalMovieTitle,
            movieYear: meta && meta.movieYear || globalMovieYear,
            imdbId: meta && meta.imdbId || globalImdbId,
            sizeGB: apiMeta && apiMeta.sizeGB || parseSizeToGB(meta && meta.size || (sizeCell ? sizeCell.innerText : "")),
            downloadUrl: dlLink ? dlLink.href : ""
          } : { pass: false, code: "GZ_SKIP" };
          if (commitAudit(trRow, link, verdict, curWebPage)) passCount++;
        });
        log("[Gazelle] 审核完毕: 合格电影原盘 " + passCount + " 项。", "SUCCESS");
      },
      f3nix: function(siteA, curWebPage) {
        var rows = $$('tr[id^="torrentposter"]'), passBHD = 0;
        rows.forEach(function(row) {
          var anchor = $("a.torrent-name", row);
          if (!anchor) return;
          var rName = anchor.textContent.trim();
          var isMovie = !!$('i[title="Movie Torrent"]', row) || !$('i[title="TV Torrent"]', row);
          var badgeTexts = $$(".badge-tip", row).map(function(n) {
            return n.textContent.trim();
          }).join(" ");
          var isDisc = RE.BHD_DISC.test(badgeTexts) || RE.BHD_DISC.test(rName);
          var isRemux = RE.ENCODE.test(badgeTexts + " " + rName);
          var libId = row.getAttribute("library") || "";
          var imdbNode = libId ? $("#librarydiv" + libId + ' a[href*="imdb.com/title/tt"]') : null;
          var dlNode = $('a[href*="/download/"]', row);
          var verdict = isMovie && isDisc && !isRemux ? {
            pass: true,
            releaseName: rName,
            extraSpec: badgeTexts,
            imdbId: imdbNode ? imdbNode.href : "",
            sizeGB: readRowSize(row, ".text-size"),
            downloadUrl: dlNode ? dlNode.href : ""
          } : { pass: false, code: isMovie ? "NON_DISC" : "NON_MOVIE" };
          if (commitAudit(row, anchor, verdict, curWebPage)) passBHD++;
        });
        log("[F3NIX] 审核完毕: 合格电影原盘 " + passBHD + " 项。", "SUCCESS");
      },
      np: function(siteA, curWebPage) {
        if (isMTeamPage()) return auditMTeamRows(curWebPage);
        var rows = $$("#torrenttable > tbody > tr, table.torrents > tbody > tr");
        var totalScanned = 0, passNP = 0, skipLimitCount = 0, reviewCount = 0;
        rows.forEach(function(row) {
          if ($("td.colhead, th", row)) return;
          var anchor = $('.torrentname a[href*="details.php"], a[href*="details.php"][title]', row);
          if (!anchor) return;
          totalScanned++;
          var mainTitle = (anchor.getAttribute("title") || anchor.textContent || "").trim();
          var tid = (anchor.href.match(/id=(\d+)/i) || ["", ""])[1];
          var nameCell = $("td.torrentname, table.torrentname", row) || anchor.closest("td");
          var cellText = (nameCell ? nameCell.textContent : row.textContent) || "";
          var subInfo = extractCleanNpSubtitleInfo(row);
          var catImg = $('a[href*="cat="] img, td:first-child img', row);
          var catAlt = catImg ? (catImg.getAttribute("alt") || "") + " " + (catImg.getAttribute("title") || "") : "";
          var isNotMovie = RE.NON_MOVIE.test(catAlt) || RE.EPISODE.test(mainTitle);
          var isForbidden = RE.FORBIDDEN.test(cellText) || !!$('img[alt*="禁转"], img[title*="禁转"], .chs_tag-excl', row);
          var isLimited = RE.LIMITED.test(cellText) || !!$('img[alt*="限转"], img[title*="限转"]', row);
          var isDiy = RE.DIY.test(cellText) || !!$(".chs_tag-diy", row);
          var ageInfo = parseNexusPhpRowAgeDays(row);
          var isLimitUnder7 = isLimited && ageInfo.days < 7;
          var isRemux = RE.ENCODE.test(mainTitle);
          var isBluRayDisc = RE.DISC_MEDIA.test(mainTitle) && RE.DISC_CODEC.test(mainTitle);
          var hasBdIcon = !!$('img.c_bd, img[title*="BD Discs"], img[alt*="BD Discs"], img[src*="additional/bd.png"]', row);
          var hasDiscHint = RE.DISC_HINT.test(mainTitle);
          var skipCode = "", extraTxt = "";
          if (isForbidden) skipCode = "FORBIDDEN";
          else if (isLimitUnder7) {
            skipCode = "LIMIT7";
            extraTxt = "仅发 " + (ageInfo.text || Math.floor(ageInfo.days) + "天");
            skipLimitCount++;
          } else if (isNotMovie) skipCode = "NON_MOVIE";
          else if (isDiy) skipCode = "DIY_SKIP";
          else if (isRemux || !isBluRayDisc) skipCode = "ENCODE";
          var passLabel;
          if (isLimited) passLabel = "🌐原盘(限转已满7天)";
          else if (!hasBdIcon && !hasDiscHint) {
            passLabel = "🌐原盘[复核]";
            if (!skipCode) reviewCount++;
          } else passLabel = "🌐网页原盘";
          var imdbNode = $('a[href*="imdb.com/title/tt"]', row);
          var dlNode = $('a[href*="download.php"]', row);
          var verdict = !skipCode ? {
            pass: true,
            torrentId: tid,
            releaseName: mainTitle,
            customPassLabel: passLabel,
            cnTitle: subInfo.cnTitle,
            regionBracket: subInfo.regionBracket,
            imdbId: imdbNode ? imdbNode.href : "",
            sizeGB: readRowSize(row),
            downloadUrl: dlNode ? dlNode.href : tid ? siteUrl(siteA, "download", { id: tid }) : ""
          } : { pass: false, code: skipCode, extra: extraTxt };
          if (commitAudit(row, anchor, verdict, curWebPage)) passNP++;
        });
        log("[NexusPHP] 扫描 " + totalScanned + " 项：可安全转发原盘 " + passNP + " 项" + (reviewCount > 0 ? "（其中 " + reviewCount + " 项标 [复核]）" : "") + (skipLimitCount > 0 ? "，已拦截限转未满7天 " + skipLimitCount + " 项！" : "。"), "SUCCESS");
      }
    };
    var skipPullConfirm = false;
    bindAction("btn-pull-dupe", async function(btn) {
      var pullBtn = btn || $("#pt-btn-pull-dupe");
      if (pullBtn && pullBtn.classList.contains("pt-btn-stop")) {
        isCheckingCancelled = true;
        log("已请求暂停。当前这一步结束后会停住，词库和待发队列都会留下。", "WARN");
        return;
      }
      var ctx = batchContext();
      var checkpoint = loadBatchCheckpoint();
      if (!checkpoint) {
        if (skipPullConfirm) skipPullConfirm = false;
        else if (!confirm("【拉取/查重】\n\n1. 先审核当前页面，在电影词条下挂载工具条\n2. 跨页拉取名单。点「暂停」或刷新后，下次从停下的那一页继续\n3. 已经查过且未过期的电影直接用词库，不再向 B 站重复请求\n\n失败的条目不会被当成已查。确定开始吗？")) return;
      } else {
        log("继续上次未完成的拉取/查重：已保存 " + checkpoint.items.length + " 条" + (checkpoint.crawlDone ? "，名单已齐，从上次查到的位置接着查。" : "，从第 " + checkpoint.nextPage + " 页继续翻页。") + (checkpoint._listKeyDiff ? "（当前页面地址/筛选与上次不同，名单沿用上次保存的）" : ""), "INFO");
      }
      isCheckingCancelled = false;
      if (pullBtn) {
        pullBtn.innerText = "⏸ 暂停";
        pullBtn.classList.add("pt-btn-stop");
      }
      seedBatchProtection(checkpoint ? checkpoint.items : []);
      try {
        auditedList = [];
        var siteA = getSiteAInfo();
        var curWebPage = getCurrentWebPageNumber();
        var useApiOnA = shouldSiteUseApi(siteA);
        log("📄 [1/3] 审核当前页，挂载工具条...", "INFO");
        try {
          await (AUDIT_HANDLERS[currentSiteArch] || AUDIT_HANDLERS.np)(siteA, curWebPage, false, 1);
        } catch (e) {
          log("⚠️ 当前页审核异常: " + e.message, "WARN");
        }
        log("✅ 当前页审核完成，共 " + auditedList.length + " 项", "SUCCESS");
        var liveItems = auditedList.slice();
        var allItemsMap = /* @__PURE__ */ new Map();
        if (checkpoint) {
          checkpoint.items.forEach(function(item2) {
            rememberBatchItem(allItemsMap, Object.assign({ row: null, chkBox: { checked: true } }, item2));
          });
        }
        liveItems.forEach(function(item2) {
          rememberBatchItem(allItemsMap, item2);
        });
        var multiPage = currentSiteArch === "unit3d" || currentSiteArch === "np" || currentSiteArch === "gz";
        var crawlDone = !!(checkpoint && checkpoint.crawlDone) || !multiPage;
        var nextPage = checkpoint && checkpoint.nextPage || 1;
        if (!crawlDone && currentSiteArch === "unit3d" && useApiOnA) {
          log("🌐 [2/3] 全站拉取（API，从第 " + nextPage + " 页）...", "INFO");
          try {
            await fetchSiteAUnit3dListByApi(siteA, nextPage, 999, { append: true });
          } catch (apiErr) {
            log("⚠️ API 拉取中断: " + apiErr.message + "。已拿到的名单会保留。", "WARN");
          }
          siteAApiMap.forEach(function(apiItem, tid) {
            if (allItemsMap.has(tid)) return;
            var parsed = parseTitleMeta(apiItem.name);
            allItemsMap.set(tid, {
              row: null,
              page: apiItem.page,
              fromApi: true,
              torrentId: tid,
              mainTitle: apiItem.name,
              releaseName: apiItem.name,
              movieTitle: parsed.movieTitle,
              movieYear: parsed.movieYear,
              imdbId: apiItem.imdbId,
              sizeGB: apiItem.sizeGB,
              is4K: is4kText(apiItem.name),
              downloadUrl: apiItem.downloadUrl,
              chkBox: { checked: true }
            });
          });
          nextPage = apiCrawlCursor.nextPage;
          crawlDone = !!(apiCrawlCursor.done && !isCheckingCancelled);
        } else if (!crawlDone) {
          log("🌐 [2/3] 全站拉取（从第 " + nextPage + " 页）...", "INFO");
          var isMTList = isMTeamPage();
          var pageParam = isMTList ? "pageNumber" : "page";
          var baseUrl = location.href.replace(/([?&])pageNumber=\d+/, "$1").replace(/([?&])page=\d+/, "$1").replace(/[?&]$/, "");
          if (baseUrl.indexOf("?") === -1) baseUrl += "?";
          var p = nextPage;
          var finishedNaturally = false;
          if (isMTList) {
            log("🌐 [M-TEAM] 列表页是前端渲染，改为在页面内自动翻页抓取...", "INFO");
            var lastMTeamCrawlEnd = false;
            var mtCrawlRes = await crawlMTeamPages(function(row) {
              var mi = mteamRowData(row);
              if (!mi || !mi.tid || allItemsMap.has(mi.tid)) return false;
              var mtDisc = RE.DISC_MEDIA.test(mi.mainTitle) && RE.DISC_CODEC.test(mi.mainTitle) && !RE.ENCODE.test(mi.mainTitle) || RE.DISC_HINT.test(mi.mainTitle);
              if (!mtDisc) return false;
              var mtMeta = parseTitleMeta(mi.mainTitle);
              allItemsMap.set(mi.tid, {
                row: null,
                page: 0,
                fromApi: false,
                torrentId: mi.tid,
                mainTitle: mi.mainTitle,
                releaseName: mi.mainTitle,
                cnTitle: "",
                regionBracket: "",
                movieTitle: mtMeta.movieTitle,
                movieYear: mtMeta.movieYear,
                imdbId: normalizeImdbId(mi.imdbId),
                sizeGB: mi.sizeGB,
                is4K: is4kText(mi.mainTitle) || /(^|[\s,])4k([\s,]|$)/i.test(mi.tags.join(" ")),
                downloadUrl: siteUrl(siteA, "download", { id: mi.tid }),
                chkBox: { checked: true }
              });
              return true;
            }, undefined, allItemsMap, nextPage);
            lastMTeamCrawlEnd = !!mtCrawlRes.reachedEnd;
            finishedNaturally = !!lastMTeamCrawlEnd;
            p = mtCrawlRes.pages + 1;
            if (!finishedNaturally) log("⚠️ 本次停在 " + mtCrawlRes.pages + " 页（未到最后一页），断点已记到第 " + p + " 页；下次点「拉取/查重」将从第 " + p + " 页继续。", "WARN");
          }
          while (!isCheckingCancelled && !finishedNaturally) {
            log("🌐 [网页] 正在获取第 " + p + " 页...", "INFO");
            var beforeSize = allItemsMap.size;
            try {
              var doc = await fetchDoc(baseUrl + (baseUrl.endsWith("?") ? "" : "&") + pageParam + "=" + p);
              var rows = isMTList ? $$("table tbody tr", doc).filter(function(tr) {
                return !!$('a[href*="/detail/"]', tr);
              }) : $$("#torrenttable > tbody > tr, table.torrents > tbody > tr, tr.torrent-search--list__row", doc);
              if (rows.length === 0) {
                log("⏹️ 当前页无行数据，停止翻页。", "INFO");
                finishedNaturally = true;
                break;
              }
              rows.forEach(function(row) {
                if (isMTList) {
                  var mtRow = mteamRowData(row);
                  if (!mtRow || !mtRow.tid || allItemsMap.has(mtRow.tid)) return;
                  var mtDisc = RE.DISC_MEDIA.test(mtRow.mainTitle) && RE.DISC_CODEC.test(mtRow.mainTitle) && !RE.ENCODE.test(mtRow.mainTitle) || RE.DISC_HINT.test(mtRow.mainTitle);
                  if (!mtDisc) return;
                  var mtMeta = parseTitleMeta(mtRow.mainTitle);
                  allItemsMap.set(mtRow.tid, {
                    row: null,
                    page: p,
                    fromApi: false,
                    torrentId: mtRow.tid,
                    mainTitle: mtRow.mainTitle,
                    releaseName: mtRow.mainTitle,
                    cnTitle: "",
                    regionBracket: "",
                    movieTitle: mtMeta.movieTitle,
                    movieYear: mtMeta.movieYear,
                    imdbId: normalizeImdbId(mtRow.imdbId),
                    sizeGB: mtRow.sizeGB,
                    is4K: is4kText(mtRow.mainTitle) || /(^|[\s,])4k([\s,]|$)/i.test(mtRow.tags.join(" ")),
                    downloadUrl: siteUrl(siteA, "download", { id: mtRow.tid }),
                    chkBox: { checked: true }
                  });
                  return;
                }
                var anchor = $('.torrentname a[href*="details.php"], a.torrent-search--list__name', row);
                if (!anchor) return;
                var mainTitle = (anchor.getAttribute("title") || anchor.textContent || "").trim();
                var tid = (anchor.href.match(/id=(\d+)/) || anchor.href.match(/\/torrents\/(\d+)/) || ["", ""])[1];
                if (!tid || allItemsMap.has(tid)) return;
                var isRemux = RE.ENCODE.test(mainTitle);
                var isDisc = RE.U3D_DISC.test(mainTitle) || RE.DISC_MEDIA.test(mainTitle) && RE.DISC_CODEC.test(mainTitle);
                if (isRemux || !isDisc) return;
                var subInfo = extractCleanNpSubtitleInfo(row);
                var sizeM = (row.textContent || "").match(/([\d.]+)\s*(GB|GiB|TB|TiB)/i);
                var ptMeta = parseTitleMeta(mainTitle);
                var imdbNode = $('a[href*="imdb.com/title/tt"]', row);
                var dlNode = $('a[href*="download.php"], a[href*="/download/"]', row);
                allItemsMap.set(tid, {
                  row: null,
                  page: p,
                  fromApi: false,
                  torrentId: tid,
                  mainTitle,
                  releaseName: mainTitle,
                  cnTitle: subInfo.cnTitle,
                  regionBracket: subInfo.regionBracket,
                  movieTitle: ptMeta.movieTitle,
                  movieYear: ptMeta.movieYear,
                  imdbId: normalizeImdbId(imdbNode ? imdbNode.href : ""),
                  sizeGB: sizeM ? parseSizeToGB(sizeM[0]) : 0,
                  is4K: is4kText(mainTitle),
                  downloadUrl: dlNode ? dlNode.href : siteUrl(siteA, "download", { id: tid }),
                  chkBox: { checked: true }
                });
              });
              var afterSize = allItemsMap.size;
              if (afterSize === beforeSize && p > 1) {
                log("⏹️ 第 " + p + " 页没有发现新种子，判定已到底，停止翻页。", "INFO");
                finishedNaturally = true;
                break;
              }
              if (p % 10 === 0) log("⏳ 已拉取 " + p + " 页，累计 " + allItemsMap.size + " 条有效原盘...", "INFO");
              p++;
              saveBatchCheckpoint({ ctx, phase: "crawl", nextPage: p, crawlDone: false, items: Array.from(allItemsMap.values()) });
              if (isCheckingCancelled) break;
              await new Promise(function(r) {
                setTimeout(r, 2e3);
              });
            } catch (e) {
              log("⚠️ 拉取第 " + p + " 页失败: " + e.message, "WARN");
              break;
            }
          }
          nextPage = p;
          crawlDone = finishedNaturally && !isCheckingCancelled;
        }
        saveBatchCheckpoint({ ctx, phase: crawlDone ? "check" : "crawl", nextPage, crawlDone, items: Array.from(allItemsMap.values()) });
        if (isCheckingCancelled && !crawlDone) {
          log("已暂停翻页。已保存 " + allItemsMap.size + " 条，下次从第 " + nextPage + " 页继续。词库和待发队列没有清空。", "WARN");
          return;
        }
        auditedList = Array.from(allItemsMap.values());
        seedBatchProtection(auditedList);
        if (crawlDone) log("✅ 全站拉取完成，共 " + auditedList.length + " 条。开始批量查重...", "SUCCESS");
        else log("名单在第 " + nextPage + " 页中断，先查已拿到的 " + auditedList.length + " 条。下次点击会接着翻页。", "WARN");
        var bInfo = getSiteBInfo();
        var isApiFastMode = shouldSiteUseApi(bInfo);
        var stepDelay = isApiFastMode ? Math.min(config.delayMs, 1200) : Math.max(config.delayMs, 4000);
        var plan = splitBatchByLibrary(auditedList, imdbLibrary, {
          bSiteHost: getCurrentBSiteHost(),
          now: Date.now(),
          freshMs: getLibraryFreshMs(),
          enabled: config.libraryEnabled !== false,
          findEntry: function(item) {
            return lookupLibraryEntry(item);
          }
        });
        var cleanCount = 0, dupeCount = 0;
        if (plan.skipped.length) {
          log("📚 词库秒过 " + plan.skipped.length + " 部，待查 " + plan.pending.length + " 部。失败过的条目会重试，不会按已查跳过。", "INFO");
          for (var s = 0; s < plan.skipped.length; s++) {
            var hit = plan.skipped[s];
            var skippedDupe = await checkSingleImdb(hit.item, hit.item.row ? [hit.item.row] : [], { quiet: true, deferRender: true });
            if (skippedDupe) dupeCount++;
            else cleanCount++;
          }
          renderQueueUI();
          updateLibraryBadge();
        }
        var alreadyChecked = /* @__PURE__ */ new Set();
        if (checkpoint && checkpoint.checkedIds && checkpoint.checkedIds.length) {
          checkpoint.checkedIds.forEach(function(id) {
            if (id) alreadyChecked.add(String(id));
          });
          log("↩ 断点续查：已查过 " + alreadyChecked.size + " 条，本次从第 " + (alreadyChecked.size + 1) + " 条接着查。", "INFO");
        }
        var checkedIds = Array.from(alreadyChecked);
        var authAborted = false;
        for (var m = 0; m < plan.pending.length; m++) {
          if (isCheckingCancelled) break;
          var pending = plan.pending[m];
          var item = pending.item;
          if (item.torrentId && alreadyChecked.has(String(item.torrentId))) {
            continue;
          }
          var cursor = plan.skipped.length + m + 1;
          log("[" + cursor + "/" + auditedList.length + "] 检索: " + (item.cnTitle || item.movieTitle));
          setRunProgress("查重 " + cursor + "/" + auditedList.length + "（" + Math.round(cursor / Math.max(1, auditedList.length) * 100) + "%）· 可发 " + cleanCount + " / 冲突 " + dupeCount);
          var kind = "ok";
          try {
            var isDupe = await checkSingleImdb(item, item.row ? [item.row] : []);
            var cached = imdbResultCache.get(pending.cacheKey);
            if (cached && cached.isError) kind = String(cached.errorMsg || "").indexOf("429") !== -1 ? "rateLimit" : "error";
            if (kind === "ok") {
              if (isDupe) dupeCount++;
              else cleanCount++;
            }
          } catch (err) {
            var authLost = err && (err.code === "AUTH_LOST" || /AUTH_LOST|登录态已失效/.test(String(err.message || "")));
            if (authLost) {
              authAborted = true;
              log("🚨 检测到目标站登录态失效（多半是被站点踢下线）：立即停止查重，避免继续空转或加重封禁。", "ERROR");
              log("   断点已保存，重新登录后回到列表页再点「拉取/查重」会从这里接着查。", "WARN");
              alert("目标站把你踢下线了（请求过快或会话超时）。\n\n已立即停止，断点已保存。\n请重新登录，然后回到列表页再点「拉取/查重」继续。");
              break;
            }
            kind = String(err && err.message || "").indexOf("429") !== -1 ? "rateLimit" : "error";
            log("检索异常: " + err.message, "ERROR");
          }
          if (item.torrentId) {
            checkedIds.push(String(item.torrentId));
            alreadyChecked.add(String(item.torrentId));
          }
          if ((alreadyChecked.size % 5) === 0) {
            saveBatchCheckpoint({ ctx, phase: "check", nextPage, crawlDone: true, checkedIds, items: auditedList });
          }
          if (m < plan.pending.length - 1 && !isCheckingCancelled && !authAborted) {
            var delay = nextNetworkDelay(stepDelay, m + 1, kind);
            if (kind !== "ok") log("阶梯降速：下一条等待 " + Math.round(delay / 1e3) + " 秒", "WARN");
            else if ((m + 1) % 10 === 0) {
              log("☕ 批次保护：已查 10 条，微歇 30 秒（防止被站点踢下线）...", "INFO");
              delay = Math.max(delay, 30000);
            }
            await new Promise(function(r) {
              setTimeout(r, delay);
            });
          }
        }
        if (checkedIds.length) {
          saveBatchCheckpoint({ ctx, phase: "check", nextPage, crawlDone: true, checkedIds, items: auditedList });
        }
        if (authAborted) {
          log("已停止。已完成 " + cleanCount + " 可发 / " + dupeCount + " 冲突，剩下的没查，断点保留。", "WARN");
          return;
        }
        if (isCheckingCancelled) {
          log("已暂停查重。词库和待发队列已保留，下次会词库秒过已成功的条目，并从还没查完的部分继续。", "WARN");
          return;
        }
        if (crawlDone) {
          clearBatchCheckpoint();
          log("🎉 全部完成！可发 " + cleanCount + " 部，冲突 " + dupeCount + " 部。", "SUCCESS");
          setRunProgress("完成：可发 " + cleanCount + " 部 / 冲突 " + dupeCount + " 部");
        alert("拉取/查重完成！\n\n可发新片: " + cleanCount + " 部\n已存在冲突: " + dupeCount + " 部\n\n结果已存入词库，当前页已挂载工具条。");
        } else {
          log("已查完当前拿到的名单。翻页进度还在，再次点击会从第 " + nextPage + " 页继续，并跳过词库里已成功的条目。", "WARN");
        }
      } catch (err) {
        log("拉取/查重中断: " + (err && err.message ? err.message : err), "ERROR");
      } finally {
        if (pullBtn) {
          pullBtn.innerText = "🚀 拉取/查重";
          pullBtn.classList.remove("pt-btn-stop");
        }
        batchProtectedKeys = null;
      }
    });
    bindAction("btn-reset-crawl", function() {
      var pullEl = $("#pt-btn-pull-dupe");
      if (pullEl && pullEl.classList.contains("pt-btn-stop")) {
        log("当前任务正在运行：先点「暂停」，等它停下再清断点。", "WARN");
        return;
      }
      if (!confirm("清断点重抓？\n\n会丢掉上次保存的名单和翻页进度，从当前筛选条件的第 1 页重新抓取并重新查重；词库里已查过的记录不受影响。")) return;
      clearBatchCheckpoint();
      skipPullConfirm = true;
      setRunProgress("已清除批次断点，准备从第 1 页重新抓取...");
      log("♻️ 已清除批次断点（旧名单/翻页进度作废），准备从第 1 页重新抓取。", "SUCCESS");
      setTimeout(function() {
        var pull = ACTION_BUS["btn-pull-dupe"];
        if (pull) pull($("#pt-btn-pull-dupe"));
      }, 500);
    });
    function applyHideMode(hide) {
      isHideMode = hide;
      GM_setValue("pt_hide_mode", hide);
      var tags = ["skip", "limit", "dupe", "error"];
      var selector = tags.map(function(t) {
        return '[data-pt-tag="' + t + '"]';
      }).join(", ");
      var rows = $$(selector);
      var btn = $("#pt-btn-hide");
      if (hide) {
        rows.forEach(function(row) {
          row.style.display = "none";
        });
        if (btn) {
          btn.innerText = "👁️ 显示全部";
          btn.style.background = "#fef3c7";
          btn.style.borderColor = "#fde68a";
          btn.style.color = "#92400e";
        }
      } else {
        rows.forEach(function(row) {
          row.style.display = "";
        });
        if (btn) {
          btn.innerText = "👁️ 隐藏";
          btn.style.background = "";
          btn.style.borderColor = "";
          btn.style.color = "";
        }
      }
    }
    bindAction("btn-hide", function() {
      applyHideMode(!isHideMode);
      log(isHideMode ? "已隐藏不可发布词条" : "已恢复显示全部", "INFO");
    });
    function scheduleAutoRestore(delay) {
      if (restoreDebounceTimer) clearTimeout(restoreDebounceTimer);
      restoreDebounceTimer = setTimeout(autoRestoreState, delay || 800);
    }
    var AUDIT_ROW_SELECTOR = "#torrenttable > tbody > tr, table.torrents > tbody > tr, tr.torrent-search--list__row, table.data-table tbody tr, tr[id^=\"torrentposter\"]";
    function auditRowAnchor(row) {
      if (!row) return null;
      return $('a.torrent-search--list__name', row) || $('.torrentname a[href*="details.php"]', row) || $('a[href*="details.php"][title]', row) || $('td.torrent-search--list__overview a[href*="/torrents/"]', row) || $('a[href*="/torrents/"]', row);
    }
    function countRowsMissingBadges(rows) {
      var missing = 0;
      (rows || []).forEach(function(r) {
        var anchor = auditRowAnchor(r);
        if (!anchor || /\/download\//i.test(anchor.href || "")) return;
        if (!r.querySelector(".pt-inline-toolbar, .pt-audit-badge, .pt-dupe-badge")) missing++;
      });
      return missing;
    }
    async function autoRestoreState(forceManual) {
      if (!config.libraryEnabled) return;
      var btn = $("#pt-btn-pull-dupe");
      if (btn && btn.classList.contains("pt-btn-stop")) return;
      var rows = $$(AUDIT_ROW_SELECTOR);
      if (rows.length === 0) return;
      var missingBadges = countRowsMissingBadges(rows);
      var htmlHash = rows.map(function(r) {
        return (r.id || r.getAttribute("data-torrent-id") || "") + r.textContent.length;
      }).join(",");
      if (!forceManual && missingBadges === 0 && htmlHash === lastPageHtmlHash) return;
      lastPageHtmlHash = htmlHash;
      ensureLibLoaded();
      libIndex = null;
      log(forceManual ? "📚 正在仅从本地词库恢复显示（零网络请求）..." : "🔄 检测到列表页变化，正在静默恢复查重状态...", "INFO");
      try {
        rows.forEach(function(r) {
          cleanRowTags(r);
        });
        auditedList = [];
        var siteA = getSiteAInfo();
        var curWebPage = getCurrentWebPageNumber();
        await (AUDIT_HANDLERS[currentSiteArch] || AUDIT_HANDLERS.np)(siteA, curWebPage, false, 1);
        var hitCount = $$(".pt-dupe-badge").length;
        if (auditedList.length > 0) log("✅ 恢复完成！检出原盘 " + auditedList.length + " 项，徽标 " + hitCount + " 个。", "SUCCESS");
        else log("✅ 恢复完成！当前页无合格原盘。", "SUCCESS");
        if (isHideMode) applyHideMode(true);
      } catch (e) {
        log("⚠️ 自动恢复异常: " + e.message, "WARN");
      }
    }
    (function(history) {
      var pushState = history.pushState;
      history.pushState = function() {
        var ret = pushState.apply(history, arguments);
        window.dispatchEvent(new Event("pt-locationchange"));
        return ret;
      };
    })(window.history);
    window.addEventListener("popstate", function() {
      window.dispatchEvent(new Event("pt-locationchange"));
    });
    window.addEventListener("pt-locationchange", function() {
      scheduleAutoRestore(1e3);
    });
    var rowObserver = new MutationObserver(function(mutations) {
      var hasNewRows = mutations.some(function(m) {
        return m.addedNodes.length > 0 && Array.from(m.addedNodes).some(function(n) {
          return n.nodeName === "TR" || n.querySelector && n.querySelector("tr");
        });
      });
      if (hasNewRows) scheduleAutoRestore(800);
    });
    function inspectBStationWebResults(doc, sourceItem, siteBType) {
      var matchResult = { hasUntouchedDupe: false, hasDiyOnly: false, hasEncodeOnly: false, matchedTitle: "", matchedSizeGB: 0, torrentCount: 0 };
      if (siteBType === "np") {
        var trs = $$("#torrenttable tr, table.torrents tr", doc);
        for (var i = 0; i < trs.length; i++) {
          var tr = trs[i];
          if ($("td.colhead, th", tr)) continue;
          var fullText = (tr.textContent || "").trim();
          if (!fullText || fullText.indexOf("没有种子") !== -1 || fullText.indexOf("Nothing found") !== -1) continue;
          var titleA = $('.torrentname a[href*="details.php"], a[href*="details.php"]', tr);
          if (!titleA) continue;
          var titleText = (titleA.textContent || "").trim();
          matchResult.torrentCount++;
          var hasBd = !!$('img.c_bd, img[title*="BD Discs"], img[alt*="BD Discs"], img[src*="additional/bd.png"], a[href*="source2=1"]', tr);
          var hasUhd = !!$('img.c_4k, img[title*="UHD Discs"], img[alt*="UHD Discs"], img[src*="additional/4k.png"], a[href*="source1=1"]', tr);
          var hasEnc = !!$('img.c_enc, img[title*="Encode"], img[alt*="Encode"], img.c_remux, img[alt*="Remux"], img.c_webdl, img.c_hdtv', tr);
          var isEncText = RE.ENCODE.test(titleText);
          var isDiy = !!$('.chs_tag-diy, a[href*="tag_doityourself=yes"]', tr) || /\bDIY\b/i.test(fullText) || fullText.indexOf("新增按钮") !== -1;
          var isDiscByText = RE.DISC_SHORT.test(titleText) || /\b(Blu-ray|BluRay)\b/i.test(titleText) && RE.DISC_CODEC.test(titleText);
          if ((hasBd || hasUhd || isDiscByText) && !hasEnc && !isEncText) {
            var sizeGB = readRowSize(tr);
            var isB4K = hasUhd || is4kText(titleText);
            if (npDiscMatches(sourceItem, { is4K: isB4K, sizeGB })) {
              if (isDiy) matchResult.hasDiyOnly = true;
              else {
                matchResult.hasUntouchedDupe = true;
                matchResult.matchedTitle = titleText || "原盘";
                matchResult.matchedSizeGB = sizeGB;
                return matchResult;
              }
            }
          } else matchResult.hasEncodeOnly = true;
        }
      } else if (siteBType === "unit3d") {
        var uRows = $$("tr.torrent-search--list__row, table.data-table tbody tr", doc);
        for (var k = 0; k < uRows.length; k++) {
          var uText = uRows[k].textContent || "";
          if (RE.U3D_DISC.test(uText) && !RE.ENCODE.test(uText)) {
            var uSizeGB = readRowSize(uRows[k]);
            if (looseDiscMatches(sourceItem, { is4K: is4kText(uText), sizeGB: uSizeGB }, 3)) {
              matchResult.hasUntouchedDupe = true;
              var nameA = $("a.torrent-search--list__name", uRows[k]);
              matchResult.matchedTitle = (nameA ? nameA.textContent : "Full Disc").trim();
              matchResult.matchedSizeGB = uSizeGB;
              return matchResult;
            }
          }
        }
      } else if (siteBType === "gz" && RE.GZ_DISC.test((doc.body ? doc.body.textContent : "") || "")) {
        matchResult.hasUntouchedDupe = true;
        matchResult.matchedTitle = "Gazelle 原盘";
      }
      return matchResult;
    }
    async function queryUnit3dApiDupe(siteB, sourceItem) {
      checkApiQuotaOrThrow(siteB, "unit3d");
      var imdbDigits = (sourceItem.imdbId || "").replace(/\D/g, "");
      var paramStr = imdbDigits ? "imdbId=" + encodeURIComponent(imdbDigits) : "name=" + encodeURIComponent(sourceItem.movieTitle);
      var apiUrl = siteBase(siteB.url) + "api/torrents/filter?" + paramStr;
      var json = null;
      try {
        json = await http(apiUrl, { responseType: "json", headers: u3dHeaders(siteB.apiKey) });
      } catch (err) {
        if (err.message === "HTTP 429") RateLimiter.forceCooldown(siteB.url, 30);
        throw err;
      }
      var list = json && Array.isArray(json.data) ? json.data : [];
      var matchResult = { hasUntouchedDupe: false, hasDiyOnly: false, matchedTitle: "", matchedSizeGB: 0, torrentCount: list.length, verifyUrl: siteUrl(siteB, "search", { imdbId: sourceItem.imdbId, kw: sourceItem.movieTitle }) };
      for (var i = 0; i < list.length; i++) {
        var attr = list[i].attributes || list[i];
        var tName = attr.name || "", tType = attr.type || "", tTypeId = String(attr.type_id || ""), tRes = attr.resolution || "", tSizeGB = parseSizeToGB(attr.size || 0);
        if ((tType === "Full Disc" || tTypeId === "1") && !RE.ENCODE.test(tName + " " + tType)) {
          if (looseDiscMatches(sourceItem, { is4K: is4kText(tRes + " " + tName), sizeGB: tSizeGB }, 2.5)) {
            if (/\b(DIY|Custom)\b/i.test(tName)) matchResult.hasDiyOnly = true;
            else {
              matchResult.hasUntouchedDupe = true;
              matchResult.matchedTitle = tName;
              matchResult.matchedSizeGB = tSizeGB;
              return matchResult;
            }
          }
        }
      }
      return matchResult;
    }
    function releaseAkaKeyword(raw) {
      var s = String(raw || "");
      var m = /(?:^|[\s._-])AKA[\s.:]+([^\[\]()]{2,90}?)(?=[\s._]+(?:19|20)\d{2}\b|[\s._]+(?:1080|2160|720|576)[pi]\b|[\s._]+(?:UHD|Blu-?Ra?y|WEB-?DL|HDTV|DVD)\b|$)/i.exec(s);
      return m ? m[1].replace(/[._]+/g, " ").replace(/\s+/g, " ").trim() : "";
    }
    function releaseSearchKeyword(raw) {
      var s = String(raw || "").replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
      if (!s) return "";
      var cut = s.search(/\b(?:1080[pi]|2160p|720p|576[pi]|480p|UHD|Blu-?Ray|BluRay|WEB-?DL|HDTV|REMUX|AVC|HEVC|x264|x265|DTS|TrueHD|LPCM|Atmos|GER|USA|JPN|EUR|GBR|HKG|CEE|CHN|FRA|ITA|ESP|KOR)\b/i);
      if (cut > 0) s = s.slice(0, cut).trim();
      var parts = s.split(" ");
      if (parts.length > 8) s = parts.slice(0, 8).join(" ");
      return s;
    }    async function querySiteBDupeHybridWithBackoff(siteB, sourceItem) {
      if (shouldSiteUseApi(siteB) && siteB.type === "unit3d") {
        try {
          return await queryUnit3dApiDupe(siteB, sourceItem);
        } catch (apiErr) {
          log("⚠️ [" + siteB.name + "] " + apiErr.message + "，已自动转入【网页模式】...", "WARN");
        }
      }
      async function fetchOne(url) {
        try {
          return await fetchDoc(url);
        } catch (err) {
          if (String(err && err.message || "").indexOf("429") !== -1) {
            log("⚠️ 遇到网页 429，自愈退避 60 秒...", "WARN");
            await new Promise(function(r) {
              setTimeout(r, 60e3);
            });
            return await fetchDoc(url);
          }
          throw err;
        }
      }
      var rawName = sourceItem.mainTitle || sourceItem.releaseName || "";
      var akaKw = releaseAkaKeyword(rawName);
      var refKw = releaseSearchKeyword(rawName);
      var movieTitle = String(sourceItem.movieTitle || "").trim();
      var tries = [{ url: siteUrl(siteB, "search", { imdbId: sourceItem.imdbId, kw: movieTitle }), label: sourceItem.imdbId || movieTitle }];
      if (akaKw && akaKw.toLowerCase() !== movieTitle.toLowerCase()) {
        tries.push({ url: siteUrl(siteB, "search", { kw: akaKw }), label: "原名 " + akaKw });
      }
      if (refKw && refKw.toLowerCase() !== movieTitle.toLowerCase()) {
        tries.push({ url: siteUrl(siteB, "search", { kw: refKw }), label: "完整片名 " + refKw });
      }
      log("🌐 [B站 网页查重] " + tries[0].label + " -> " + siteB.name);
      var last = null;
      for (var t = 0; t < tries.length; t++) {
        var doc = await fetchOne(tries[t].url);
        var analysis = inspectBStationWebResults(doc, sourceItem, siteB.type);
        analysis.verifyUrl = tries[t].url;
        last = analysis;
        if (analysis.hasUntouchedDupe) {
          if (t > 0) log("🔁 换了关键词才查到原盘：" + tries[t].label, "WARN");
          return analysis;
        }
        if (t === 0 && analysis.torrentCount === 0 && tries.length > 1) {
          log("🔁 按片名没搜到任何条目，改用 " + tries[1].label + " 再查一次…", "INFO");
        }
      }
      return last;
    }
    function renderQueueUI() {
      var queueBox = $("#pt-queue-box"), countEl = $("#pt-queue-count");
      if (!queueBox || !countEl) return;
      countEl.innerText = pendingQueue.length;
      if (pendingQueue.length === 0) {
        queueBox.innerHTML = '<div style="color:#94a3b8; text-align:center; padding:8px;">暂无待发项，请先执行查重</div>';
        return;
      }
      queueBox.innerHTML = "";
      pendingQueue.forEach(function(item, index) {
        var itemDiv = el("div", "pt-queue-item");
        var titleSpan = el("span", "", index + 1 + ". " + (item.cnTitle || item.movieTitle) + " (" + item.movieYear + ")", "max-width:175px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;");
        titleSpan.title = item.mainTitle;
        var btnWrap = el("div", "", "", "display:flex; gap:4px;");
        QUEUE_BTN_DEFS.forEach(function(def) {
          var btn = el("button", def.cls, def.text, def.css, def.act);
          btn._ptItem = item;
          btn._ptQueueRow = itemDiv;
          btnWrap.appendChild(btn);
        });
        itemDiv.append(titleSpan, btnWrap);
        queueBox.appendChild(itemDiv);
      });
    }
    function getCurrentBSiteHost() {
      return extractHostKey(getSiteBInfo().url);
    }
    function getLibraryKey(cacheKey, bSiteHost) {
      return libraryStorageKey(bSiteHost || getCurrentBSiteHost(), cacheKey);
    }
    function getLibraryFreshMs() {
      return Math.max(1, config.libraryFreshHours || 720) * 60 * 60 * 1e3;
    }
    function readLibraryEntry(cacheKey) {
      if (!config.libraryEnabled) return null;
      ensureLibLoaded();
      return imdbLibrary[getLibraryKey(cacheKey)] || null;
    }
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
        phase: state.phase || "crawl",
        nextPage: state.nextPage || 1,
        crawlDone: !!state.crawlDone,
        checkedIds: state.checkedIds || [],
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
      batchProtectedKeys = /* @__PURE__ */ Object.create(null);
      var host = getCurrentBSiteHost();
      (items || []).forEach(function(item) {
        batchProtectedKeys[libraryStorageKey(host, buildImdbCacheKey(item))] = true;
      });
    }
    function libraryProtectSet() {
      var protect = /* @__PURE__ */ Object.create(null);
      if (batchProtectedKeys) {
        Object.keys(batchProtectedKeys).forEach(function(key) {
          protect[key] = true;
        });
      }
      var cp = GM_getValue(CHECKPOINT_STORAGE_KEY, null);
      if (isCheckpointRecord(cp, Date.now(), CHECKPOINT_MAX_AGE_MS)) {
        (cp.items || []).forEach(function(item) {
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
      ensureLibLoaded();
      var bHost = getCurrentBSiteHost();
      var k = getLibraryKey(cacheKey, bHost);
      var existing = imdbLibrary[k] || {};
      var tids = Array.isArray(existing.torrentIds) ? existing.torrentIds.slice() : [];
      var patchTid = patch && patch.torrentId ? String(patch.torrentId) : "";
      if (patchTid && tids.indexOf(patchTid) === -1) tids.push(patchTid);
      imdbLibrary[k] = Object.assign({}, existing, patch, {
        cacheKey,
        bSiteHost: bHost,
        lastCheck: Date.now(),
        torrentIds: tids.slice(-20),
        imdbDigits: imdbDigits((patch && patch.imdbId) || existing.imdbId || ""),
        titleYearKey: (patch && patch.titleYearKey) || existing.titleYearKey || ""
      });
      if (!existing.cacheKey) libShardKeys[libHashKey(k)].push(k);
      markLibDirty(k);
      libIndex = null;
      var protect = libraryProtectSet();
      protect[k] = true;
      if (batchProtectedKeys) batchProtectedKeys[k] = true;
      var maxEntries = Math.max(10, config.libraryMaxEntries || 20000);
      if (Object.keys(imdbLibrary).length > maxEntries * 1.05) {
        trimLibrary(imdbLibrary, maxEntries, protect);
        rebuildLibShardKeys();
        markAllLibDirty();
        libIndex = null;
      }
      scheduleLibFlush(2e3);
    }
    function getLibraryStats() {
      ensureLibLoaded();
      var bHost = getCurrentBSiteHost();
      var prefix = bHost + "::";
      var cnt = 0;
      Object.keys(imdbLibrary).forEach(function(k) {
        if (k.indexOf(prefix) === 0) cnt++;
      });
      return { total: Object.keys(imdbLibrary).length, currentBSite: cnt, bSiteHost: bHost };
    }
    function clearLibraryForCurrentBSite() {
      ensureLibLoaded();
      var bHost = getCurrentBSiteHost();
      var prefix = bHost + "::";
      Object.keys(imdbLibrary).forEach(function(k) {
        if (k.indexOf(prefix) === 0) delete imdbLibrary[k];
      });
      rebuildLibShardKeys();
      markAllLibDirty();
      libIndex = null;
      flushLibShards(true);
      imdbResultCache.clear();
    }
    function listLibraryForCurrentBSite() {
      ensureLibLoaded();
      var bHost = getCurrentBSiteHost();
      var prefix = bHost + "::";
      var arr = [];
      Object.keys(imdbLibrary).forEach(function(k) {
        if (k.indexOf(prefix) !== 0) return;
        var e = imdbLibrary[k];
        var result = e.lastResult || {};
        var vKey = result.isError ? "ERROR" : result.hasUntouchedDupe ? "DUPE" : result.hasDiyOnly ? "DIY_PASS" : "CLEAN";
        arr.push({
          cacheKey: e.cacheKey || k.substring(prefix.length),
          movieTitle: e.movieTitle || "",
          movieYear: e.movieYear || "",
          cnTitle: e.cnTitle || "",
          checkCount: e.checkCount || 0,
          ageHours: Math.floor((Date.now() - (e.lastCheck || 0)) / 36e5),
          vKey,
          matchedSizeGB: result.matchedSizeGB || 0,
          forwardedAt: e.forwardedAt || 0,
          forwardedTo: e.forwardedTo || ""
        });
      });
      arr.sort(function(a, b) {
        return a.ageHours - b.ageHours;
      });
      return arr;
    }
    function updateLibraryBadge() {
      var el2 = $("#pt-lib-badge");
      if (!el2) return;
      var stats = getLibraryStats();
      el2.innerText = "📚 词库: " + stats.currentBSite + " 部 (" + stats.bSiteHost + ")";
      el2.title = "当前 B 站 [" + stats.bSiteHost + "] 有 " + stats.currentBSite + " 条；全局 " + stats.total + " 条";
    }
    function libExportPayload() {
      ensureLibLoaded();
      flushLibShards(true);
      return {
        kind: "pt-imdb-library",
        v: 1,
        script: "PT 原盘转载发布与智能查重助手",
        version: "8.0.0",
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        bSiteHost: getCurrentBSiteHost(),
        ttlHours: config.libraryFreshHours || 720,
        entries: imdbLibrary
      };
    }
    function exportLibraryToFile() {
      var payload = libExportPayload();
      var count = Object.keys(payload.entries || {}).length;
      var blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:T]/g, "").slice(0, 14);
      a.href = url;
      a.download = "pt_imdb_library_" + ts + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        URL.revokeObjectURL(url);
        if (a.parentNode) a.remove();
      }, 1500);
      log("📚 已导出词库 " + count + " 条到 JSON 文件", "SUCCESS");
      return count;
    }
    function mergeLibraryEntries(entries) {
      ensureLibLoaded();
      var added = 0, updated = 0, skipped = 0;
      Object.keys(entries || {}).forEach(function(k) {
        var incoming = entries[k];
        if (!incoming || typeof incoming !== "object") {
          skipped++;
          return;
        }
        var existing = imdbLibrary[k];
        if (existing) {
          if ((existing.lastCheck || 0) >= (incoming.lastCheck || 0)) {
            skipped++;
            return;
          }
          updated++;
        } else added++;
        imdbLibrary[k] = incoming;
        markLibDirty(k);
      });
      rebuildLibShardKeys();
      markAllLibDirty();
      libIndex = null;
      flushLibShards(true);
      return { added, updated, skipped };
    }
    function importLibraryFromFile() {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", function() {
        var file = input.files && input.files[0];
        if (!file) {
          input.remove();
          return;
        }
        var reader = new FileReader();
        reader.onload = function() {
          try {
            var data = JSON.parse(String(reader.result || "{}"));
            var entries = data && data.entries && typeof data.entries === "object" ? data.entries : data && typeof data === "object" && !data.entries ? data : null;
            if (!entries) throw new Error("文件里没有 entries 字段");
            var res = mergeLibraryEntries(entries);
            updateLibraryBadge();
            log("📚 导入完成：新增 " + res.added + "，更新 " + res.updated + "，跳过 " + res.skipped, "SUCCESS");
            autoRestoreState(true);
          } catch (e) {
            log("📚 导入失败: " + (e && e.message ? e.message : e), "ERROR");
            alert("导入失败：" + (e && e.message ? e.message : e));
          } finally {
            input.remove();
          }
        };
        reader.onerror = function() {
          log("📚 导入失败: 读取文件出错", "ERROR");
          input.remove();
        };
        reader.readAsText(file);
      });
      input.click();
    }
    async function checkSingleImdb(sourceItem, relatedNodes, options) {
      options = options || {};
      var forceRefresh = !!options.forceRefresh;
      var cacheKey = buildImdbCacheKey(sourceItem);
      var libEntry = lookupLibraryEntry(sourceItem) || readLibraryEntry(cacheKey);
      var fromLibrary = false, result = null;
      if (!forceRefresh && imdbResultCache.has(cacheKey)) {
        result = imdbResultCache.get(cacheKey);
        fromLibrary = !!result._fromLibrary;
      } else if (!forceRefresh && libEntry && libEntry.lastResult && !libEntry.lastResult.isError) {
        var age = Date.now() - (libEntry.lastCheck || 0);
        if (isFreshLibraryHit(libEntry, Date.now(), getLibraryFreshMs())) {
          result = Object.assign({}, libEntry.lastResult, { _fromLibrary: true, _libraryAge: age });
          if (!result.verifyUrl) result.verifyUrl = siteUrl(getSiteBInfo(), "search", { imdbId: sourceItem.imdbId, kw: sourceItem.movieTitle });
          fromLibrary = true;
          if (!options.quiet) log("📚 [词库命中] " + (sourceItem.cnTitle || sourceItem.movieTitle) + " (" + Math.floor(age / 36e5) + "h 前查重)", "INFO");
        } else if (!options.quiet) {
          log("📚 [词库过期] " + (sourceItem.cnTitle || sourceItem.movieTitle) + "，重新查询...", "INFO");
        }
      }
      if (!result) {
        try {
          result = await querySiteBDupeHybridWithBackoff(getSiteBInfo(), sourceItem);
          writeLibraryEntry(cacheKey, {
            torrentId: String(sourceItem.torrentId || ""),
            titleYearKey: buildTitleYearCacheKey(sourceItem),
            imdbId: normalizeImdbId(sourceItem.imdbId) || "",
            movieTitle: sourceItem.movieTitle || "",
            movieYear: sourceItem.movieYear || "",
            cnTitle: sourceItem.cnTitle || "",
            lastResult: {
              hasUntouchedDupe: !!result.hasUntouchedDupe,
              hasDiyOnly: !!result.hasDiyOnly,
              hasEncodeOnly: !!result.hasEncodeOnly,
              matchedTitle: result.matchedTitle || "",
              matchedSizeGB: result.matchedSizeGB || 0,
              torrentCount: result.torrentCount || 0,
              verifyUrl: result.verifyUrl || "",
              isError: false,
              errorMsg: ""
            },
            checkCount: (libEntry && libEntry.checkCount || 0) + 1
          });
        } catch (err) {
          result = { isError: true, errorMsg: err.message, verifyUrl: "#" };
          writeLibraryEntry(cacheKey, {
            torrentId: String(sourceItem.torrentId || ""),
            titleYearKey: buildTitleYearCacheKey(sourceItem),
            imdbId: normalizeImdbId(sourceItem.imdbId) || "",
            movieTitle: sourceItem.movieTitle || "",
            movieYear: sourceItem.movieYear || "",
            cnTitle: sourceItem.cnTitle || "",
            lastResult: { isError: true, errorMsg: err.message, verifyUrl: "#" },
            checkCount: (libEntry && libEntry.checkCount || 0) + 1
          });
        }
      }
      imdbResultCache.set(cacheKey, result);
      var vKey = result.isError ? "ERROR" : result.hasUntouchedDupe ? "DUPE" : result.hasDiyOnly ? "DIY_PASS" : "CLEAN";
      var vDef = BADGE_DICT[vKey];
      var badgeTxt = (fromLibrary ? "📚 " : "") + vDef.text;
      if (vKey === "ERROR") {
        badgeTxt += result.errorMsg;
        if (!options.quiet) log(badgeTxt, "ERROR");
      } else if (vKey === "DUPE") {
        badgeTxt += " (" + (result.matchedSizeGB ? result.matchedSizeGB.toFixed(1) + "G" : "已存") + ") [复核]";
        if (!options.quiet) log("[冲突] B站已有原盘: " + result.matchedTitle + (fromLibrary ? " [词库]" : ""), "WARN");
      } else {
        if (!options.quiet) {
          if (vKey === "DIY_PASS") log("[可发] B站仅DIY: " + sourceItem.movieTitle + (fromLibrary ? " [词库]" : ""), "INFO");
          else log("[可发] B站未收录: " + (sourceItem.cnTitle || sourceItem.movieTitle) + (fromLibrary ? " [词库]" : ""), "SUCCESS");
        }
        if (!pendingQueue.some(function(x) {
          return buildImdbCacheKey(x) === cacheKey;
        })) {
          pendingQueue.push(sourceItem);
          GM_setValue("pt_pending_queue", pendingQueue);
        }
      }
      (relatedNodes || []).forEach(function(node) {
        renderDupeBadge(node, sourceItem, result, fromLibrary);
      });
      if (!options.deferRender) {
        renderQueueUI();
        updateLibraryBadge();
      }
      return result.hasUntouchedDupe;
    }
    bindAction("row-check", async function(btn, ev) {
      if (!btn._ptItem) return;
      var forceRefresh = !!(ev && ev.shiftKey);
      btn.innerText = forceRefresh ? "强制查中..." : "查询中...";
      try {
        await checkSingleImdb(btn._ptItem, [btn._ptRow], { forceRefresh });
        btn.innerText = forceRefresh ? "已强查" : "已查";
      } catch (err) {
        log("❌ 查重失败: " + (err && err.message ? err.message : err), "ERROR");
        btn.innerText = "重试";
      }
    });
    bindAction("queue-clear", function() {
      pendingQueue = [];
      GM_setValue("pt_pending_queue", pendingQueue);
      renderQueueUI();
      log("待发清单已清空。", "INFO");
    });
    function uint8ArrayToBinaryString(u8Arr) {
      var chunks = [];
      for (var i = 0; i < u8Arr.length; i += 8192) {
        chunks.push(String.fromCharCode.apply(null, u8Arr.subarray(i, i + 8192)));
      }
      return chunks.join("");
    }
    function isValidTorrentBytes(u8Arr) {
      if (!u8Arr || u8Arr.length < 20 || u8Arr[0] !== 100) return false;
      var headStr = String.fromCharCode.apply(null, u8Arr.subarray(0, Math.min(250, u8Arr.length)));
      return headStr.indexOf("announce") !== -1 || headStr.indexOf("4:info") !== -1 || headStr.indexOf("nodes") !== -1;
    }
    async function requestTorrentBufferOnce(url, method, refererUrl) {
      var originUrl = "";
      try {
        originUrl = new URL(url).origin;
      } catch (e) {
        originUrl = location.origin;
      }
      var headers = { "Referer": refererUrl || originUrl + "/", "Origin": originUrl };
      if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
      var res = await http(url, { method: method || "GET", responseType: "arraybuffer", headers, timeout: 15e3, rawResponse: true });
      if (res.status !== 200 || !res.response) throw new Error(method + " HTTP " + res.status);
      var u8 = new Uint8Array(res.response);
      if (!isValidTorrentBytes(u8)) throw new Error(method + " 返回非种子流");
      return u8;
    }
    async function fetchTorrentRawBase64(downloadUrl, refererUrl) {
      if (!downloadUrl) throw new Error("无下载链接");
      var methodsOrder = /hdsky\.me/i.test(downloadUrl) && downloadUrl.indexOf("passkey=") === -1 ? ["POST", "GET"] : ["GET", "POST"];
      var lastErr = null;
      for (var i = 0; i < methodsOrder.length; i++) {
        try {
          var u8 = await requestTorrentBufferOnce(downloadUrl, methodsOrder[i], refererUrl);
          return btoa(uint8ArrayToBinaryString(u8));
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error("拉取种子失败");
    }
    function buildCleanedTorrentFile(base64Raw, fallbackFileName, targetAnnounceUrl, targetSiteCode) {
      var r = atob(base64Raw), extractedInternalName = "";
      var infoIdx = r.indexOf("4:info");
      if (infoIdx !== -1) {
        var scope = r.substring(infoIdx);
        var re = /4:name(\d+):/g, lastMatch = null, m;
        while ((m = re.exec(scope)) !== null) lastMatch = m;
        if (lastMatch) {
          try {
            var len = parseInt(lastMatch[1], 10);
            var startByte = infoIdx + lastMatch.index + ("4:name" + lastMatch[1] + ":").length;
            extractedInternalName = decodeURIComponent(escape(r.substring(startByte, startByte + len)));
          } catch (e) {
          }
        }
      }
      if (targetAnnounceUrl) {
        var infoStart = r.indexOf("4:info"), privIdx = r.lastIndexOf("7:privatei");
        if (infoStart !== -1 && privIdx > infoStart) {
          try {
            var newTorrent = "d8:announce" + targetAnnounceUrl.length + ":" + targetAnnounceUrl;
            var dateMatch = r.substring(0, infoStart).match(/13:creation datei(\d+)e/);
            if (dateMatch) newTorrent += "13:creation datei" + (parseInt(dateMatch[1], 10) + 600 + Math.floor(Math.random() * 600)) + "e";
            newTorrent += "8:encoding5:UTF-8" + r.substring(infoStart, privIdx) + "7:privatei1e";
            var srcCode = (targetSiteCode || "PTER").toUpperCase();
            r = newTorrent + "6:source" + srcCode.length + ":" + srcCode + "ee";
          } catch (washErr) {
          }
        }
      }
      var bytes = new Uint8Array(r.length);
      for (var i = 0; i < r.length; i++) bytes[i] = r.charCodeAt(i) & 255;
      var WinBlob = rootWin.Blob || window.Blob, WinFile = rootWin.File || window.File;
      var blob = new WinBlob([bytes], { type: "application/x-bittorrent" });
      var finalFileName = (fallbackFileName || extractedInternalName || "movie").replace(/\.torrent$/i, "").replace(/[\/\\:*?"<>|]/g, ".").replace(/\s+/g, ".").replace(/\.+/g, ".").trim() + ".torrent";
      return { file: new WinFile([blob], finalFileName, { type: "application/x-bittorrent" }), blob, filename: finalFileName, sizeKB: (bytes.length / 1024).toFixed(1) };
    }
    async function fetchUnit3dTorrentDetailByApi(siteA, torrentId) {
      if (!shouldSiteUseApi(siteA) || !siteA.apiKey || !torrentId) throw new Error("无 API Key 或种子ID");
      checkApiQuotaOrThrow(siteA, "unit3d");
      var url = siteBase(siteA.url) + "api/torrents/" + encodeURIComponent(torrentId);
      try {
        var data = await http(url, { responseType: "json", timeout: 1e4, headers: u3dHeaders(siteA.apiKey) });
        return data && data.data && data.data.attributes ? data.data.attributes : data ? data.attributes || data : null;
      } catch (err) {
        if (err.message === "HTTP 429") RateLimiter.forceCooldown(siteA.url, 30);
        throw err;
      }
    }
    function extractRealDownloadUrlFromDetailDoc(detailDoc, baseUrl, fallbackTid) {
      var passkeyInputs = $$('input[value*="download.php"], input[value*="passkey="]', detailDoc);
      for (var i = 0; i < passkeyInputs.length; i++) {
        var v = (passkeyInputs[i].value || passkeyInputs[i].getAttribute("value") || "").trim();
        if (/download\.php\?/i.test(v)) {
          try {
            return new URL(v, baseUrl).href.replace(/&https=1\b/i, "");
          } catch (e) {
            return v;
          }
        }
      }
      var dlLinks = $$('a[href*="download.php"], a[href*="/torrents/download/"], a[href*="download/torrent"], a[href*="/download/"], button[data-download-url]', detailDoc);
      for (var j = 0; j < dlLinks.length; j++) {
        var href = dlLinks[j].getAttribute("href") || "";
        if (href && !/downhash/i.test(href)) {
          try {
            return new URL(href, baseUrl).href.replace(/&https=1\b/i, "");
          } catch (e) {
            return href;
          }
        }
      }
      var dlForm = $('form[action*="download.php"]', detailDoc);
      if (dlForm && dlForm.getAttribute("action")) {
        try {
          return new URL(dlForm.getAttribute("action"), baseUrl).href;
        } catch (e) {
          return dlForm.getAttribute("action");
        }
      }
      return fallbackTid ? siteUrl({ url: baseUrl, type: "np" }, "download", { id: fallbackTid }) : "";
    }
    async function fetchFullSourceDetails(itemData) {
      var result = {
        realDownloadUrl: itemData.downloadUrl || "",
        sourceDetailUrl: "",
        detailSubTitle: "",
        bdinfo: itemData.bdinfo || "",
        imdbId: itemData.imdbId || "",
        doubanUrl: itemData.doubanUrl || "",
        synopsisBbcode: "",
        rawDescription: "",
        detailDoc: null
      };
      var targetRow = itemData.row;
      var tid = itemData.torrentId || targetRow && targetRow.dataset && targetRow.dataset.ptTid || (targetRow && targetRow.id && targetRow.id.match(/\d+/) ? targetRow.id.match(/\d+/)[0] : "");
      var siteA = getSiteAInfo();
      if (shouldSiteUseApi(siteA) && tid && siteA.type === "unit3d") {
        log("⚡ [A站 U3D API] 正在后台拉取种子 #" + tid + " 的完整详情...", "INFO");
        try {
          var attr = await fetchUnit3dTorrentDetailByApi(siteA, tid);
          if (attr) {
            var rawMi = attr.bdinfo || attr.media_info || attr.mediainfo || "";
            if (rawMi) result.bdinfo = rawMi.trim();
            if (!result.imdbId && attr.imdb_id) result.imdbId = normalizeImdbId(attr.imdb_id);
            if (attr.download_link) result.realDownloadUrl = attr.download_link;
            if (attr.description) {
              result.rawDescription = String(attr.description);
              if (result.rawDescription.indexOf("◎") !== -1) {
                result.synopsisBbcode = result.rawDescription;
              }
            }
          }
        } catch (e) {
        }
      }
      if (tid && (siteA.type === "np" || siteA.type === "unit3d" && (!result.bdinfo || !result.detailDoc) || siteA.type === "gz")) {
        try {
          var detailWebUrl = siteUrl(siteA, "details", { id: tid });
          result.sourceDetailUrl = detailWebUrl;
          log("🌐 [网页穿透] 后台读取详情页 (" + detailWebUrl + ")...", "INFO");
          var detailDoc = await fetchDoc(detailWebUrl);
          result.detailDoc = detailDoc;
          var fullHtml = detailDoc.body ? detailDoc.body.innerHTML : "";
          var extractedDl = extractRealDownloadUrlFromDetailDoc(detailDoc, siteA.url, tid);
          if (extractedDl) {
            result.realDownloadUrl = extractedDl;
            itemData.downloadUrl = extractedDl;
          }
          if (siteA.type === "np") {
            var subTr = $$("tr", detailDoc).find(function(tr) {
              var h = $("td.rowhead, td:first-child", tr);
              return h && /^(副标题|副標題|Subtitle|SubTitle)$/i.test((h.textContent || "").trim());
            });
            if (subTr) {
              var subTd = $("td.rowfollow, td:nth-child(2)", subTr);
              result.detailSubTitle = (subTd ? subTd.textContent : "").trim();
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
          var kdescr = $("#kdescr, .bbcode-rendered, .torrent-description, .panel__body", detailDoc);
          if (kdescr) {
            var kClone = kdescr.cloneNode(true);
            $$("br", kClone).forEach(function(br) {
              br.replaceWith("\n");
            });
            $$("p, div, tr", kClone).forEach(function(blk) {
              blk.append("\n");
            });
            var kText = kClone.textContent || "";
            var synStart = kText.search(/◎\s*译\s*名|◎\s*片\s*名/);
            if (synStart !== -1) {
              var synPart = kText.substring(synStart);
              var synEnd = synPart.search(/DISC INFO:|Disc Title:|Disc Label:|PLAYLIST REPORT:|\[quote\]|◎\s*截\s*图|Screenshots|引用/i);
              if (synEnd !== -1) synPart = synPart.substring(0, synEnd);
              result.synopsisBbcode = synPart.replace(/\n{3,}/g, "\n\n").trim();
            }
          }
        } catch (webErr) {
          log("⚠️ [网页穿透] 详情页读取异常: " + webErr.message, "WARN");
        }
      }
      return result;
    }
    async function ensureItemTorrentBase64(itemData) {
      if (itemData.torrentBase64) return itemData.torrentBase64;
      var siteA = getSiteAInfo(), tid = itemData.torrentId || "";
      var detailRefUrl = tid ? siteUrl(siteA, "details", { id: tid }) : location.href;
      if (itemData.downloadUrl) {
        try {
          var b64 = await fetchTorrentRawBase64(itemData.downloadUrl, detailRefUrl);
          itemData.torrentBase64 = b64;
          return b64;
        } catch (firstErr) {
          if (siteA.type === "np" && tid) {
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
      throw new Error("未能获取到有效的种子下载链接");
    }
    function renderToPreviewBoxes(bdObj, shots, synopsisText, extraCtx) {
      var pubShots = hostMapShots(shots);
      var subTitleText = buildSubtitle(bdObj, synopsisText || "", config, extraCtx);
      var descText = buildAll(bdObj, pubShots, synopsisText || "", config);
      var subEl = $("#pt-edit-sub"), descEl = $("#pt-edit-desc");
      if (subEl) subEl.value = subTitleText;
      if (descEl) descEl.value = descText;
      if (config.autoCopy && descText) {
        copyTextToClipboard(descText, true);
      }
    }
    async function preparePreview(itemData) {
      log("🔍 正在获取详情并提取 BDInfo / 截图 / 豆瓣简介...", "INFO");
      if ($("#pt-edit-sub")) $("#pt-edit-sub").value = "加载中...";
      if ($("#pt-edit-desc")) $("#pt-edit-desc").value = "加载中...";
      var body = $("#pt-panel-body");
      if (body) body.scrollTop = 0;
      try {
        var fullDetails = await fetchFullSourceDetails(itemData);
        var movieName = itemData.movieTitle;
        if (!movieName) {
          var pageTitleMatch = document.title.match(/^(.+?)\s*[\[(](\d{4})[\])]/i);
          movieName = pageTitleMatch ? pageTitleMatch[1].trim() : document.title.split("::")[0].split("-")[0].trim();
        }
        var bdObj = parseBd(fullDetails.bdinfo || "", config.roundFps);
        if (!bdObj.label && !bdObj.title) {
          bdObj.label = itemData.releaseName || movieName;
        }
        if (!bdObj.length) {
          bdObj.length = "0:00:00";
        }
        var shots = collectShots(config.maxShots, fullDetails.detailDoc || document, fullDetails.rawDescription);
        var extraCtx = {
          cnTitle: itemData.cnTitle || "",
          movieTitle: movieName,
          releaseName: itemData.releaseName || itemData.mainTitle || "",
          mainTitle: itemData.mainTitle || "",
          regionBracket: itemData.regionBracket || "",
          detailSubTitle: fullDetails.detailSubTitle || "",
          detailDoc: fullDetails.detailDoc || document
        };
        window._ptCurrentPendingItem = {
          item: itemData,
          fullDetails,
          rawBdinfo: fullDetails.bdinfo || "",
          bdObj,
          shots,
          extraCtx
        };
        renderToPreviewBoxes(bdObj, shots, fullDetails.synopsisBbcode || "", extraCtx);
        log("✅ 基础数据提取成功（截图 " + shots.length + " 张）" + (config.autoCopy ? "｜已自动复制简介" : ""), "SUCCESS");
        hostAutoUploadShots(shots, function() {
          var p = window._ptCurrentPendingItem;
          var introNow = p && p.fullDetails ? p.fullDetails.synopsisBbcode || "" : fullDetails.synopsisBbcode || "";
          renderToPreviewBoxes(bdObj, shots, introNow, extraCtx);
          log("🖼 已用图床链接刷新简介" + (config.autoCopy ? "｜已复制" : ""), "SUCCESS");
        });
        var manualImdbVal = $("#pt-manual-imdb") && $("#pt-manual-imdb").value.trim() || "";
        var tt = normalizeImdbId(manualImdbVal || itemData.imdbId || fullDetails.imdbId);
        if (config.autoImdb && tt) {
          log("🌐 已在后台打开豆瓣取词页 (" + tt + ")，等待回传...", "INFO");
          requestDoubanByTab(tt, function(doubanText) {
            if (window._ptCurrentPendingItem) {
              window._ptCurrentPendingItem.fullDetails.synopsisBbcode = doubanText;
            }
            renderToPreviewBoxes(bdObj, shots, doubanText, extraCtx);
            log("✅ 豆瓣简介已回传并置顶更新" + (config.autoCopy ? "｜已自动复制" : ""), "SUCCESS");
          });
        } else if (!tt) {
          log("⚠️ 未找到 IMDb ID，可在上方「🛠️ 手动 IMDb」中填入后点重新生成。", "WARN");
        }
      } catch (err) {
        log("❌ 提取数据失败: " + err.message, "ERROR");
        if ($("#pt-edit-sub")) $("#pt-edit-sub").value = "";
        if ($("#pt-edit-desc")) $("#pt-edit-desc").value = "";
      }
    }
    function extractCurrentDetailPageDirect() {
      var rawBd = $("#pt-manual-bd") && $("#pt-manual-bd").value.trim() || findBdinfo(document);
      if (!rawBd) {
        log("⚠️ 当前页未找到 BDInfo，请展开折叠区或在「🛠️ 手动粘贴 BDInfo」中粘贴", "WARN");
        return false;
      }
      var bdObj = parseBd(rawBd, config.roundFps);
      if (!bdObj.label && !bdObj.title || !bdObj.length) {
        log("⚠️ BDInfo 不完整（缺少 Disc Title/Label 或 Length）", "WARN");
        return false;
      }
      var shots = collectShots(config.maxShots, document, "");
      var h1Node = $("h1");
      var rawRelease = (h1Node ? h1Node.textContent.trim() : "") || bdObj.label || bdObj.title || document.title;
      var tidMatch = location.href.match(/(?:id=|\/torrents\/)(\d+)/i);
      var tid = tidMatch ? tidMatch[1] : "";
      var siteA = getSiteAInfo();
      var dlUrl = extractRealDownloadUrlFromDetailDoc(document, siteA.url, tid);
      var tt = findPageImdb(document);
      var sizeM = (document.body ? document.body.innerText : "").match(/([\d.]+)\s*(GB|GiB|TB|TiB)/i);
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
      var existingDesc = $("#pt-edit-desc") && $("#pt-edit-desc").value || "";
      var existingIntro = existingDesc.indexOf("◎") === 0 && existingDesc.indexOf("[img]") > 0 ? existingDesc.slice(0, existingDesc.indexOf("[img]")).trim() : "";
      window._ptCurrentPendingItem = {
        item: itemData,
        fullDetails: {
          realDownloadUrl: dlUrl,
          sourceDetailUrl: location.href,
          detailSubTitle: "",
          bdinfo: rawBd,
          imdbId: tt,
          doubanUrl: "",
          synopsisBbcode: existingIntro,
          detailDoc: document
        },
        rawBdinfo: rawBd,
        bdObj,
        shots,
        extraCtx
      };
      renderToPreviewBoxes(bdObj, shots, existingIntro, extraCtx);
      log("✅ 已提取当前页 BDInfo 与截图 (" + shots.length + " 张)" + (config.autoCopy ? "｜已复制" : ""), "SUCCESS");
      hostAutoUploadShots(shots, function() {
        var p = window._ptCurrentPendingItem;
        var introNow = p && p.fullDetails ? p.fullDetails.synopsisBbcode || "" : existingIntro;
        renderToPreviewBoxes(bdObj, shots, introNow, extraCtx);
        log("🖼 已用图床链接刷新简介" + (config.autoCopy ? "｜已复制" : ""), "SUCCESS");
      });
      if (config.autoImdb && tt) {
        log("🌐 已打开豆瓣取词页（后台），正在获取 " + tt + " 中…", "INFO");
        requestDoubanByTab(tt, function(doubanText) {
          var latestBd = parseBd($("#pt-manual-bd") && $("#pt-manual-bd").value.trim() || findBdinfo(document) || rawBd, config.roundFps);
          var useBd = latestBd.label || latestBd.title ? latestBd : bdObj;
          if (window._ptCurrentPendingItem) {
            window._ptCurrentPendingItem.fullDetails.synopsisBbcode = doubanText;
          }
          renderToPreviewBoxes(useBd, shots, doubanText, extraCtx);
          log("✅ 取词页取回并置顶" + (config.autoCopy ? "｜已自动复制" : ""), "SUCCESS");
        });
      }
      return true;
    }
    window.addEventListener("focus", function() {
      var ho = readHandoffData(6e5);
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
        log("✅ 窗口唤醒：已接收取词页结果" + (config.autoCopy ? "｜已复制" : ""), "SUCCESS");
      }
    });
    bindAction("page-extract", function() {
      extractCurrentDetailPageDirect();
    });
    bindAction("manual-gen", function() {
      var m = $("#pt-manual-bd") && $("#pt-manual-bd").value.trim() || "";
      if (!m) {
        log("⚠️ 请先在手动框中粘贴 BDInfo", "WARN");
        return;
      }
      var d = parseBd(m, config.roundFps);
      if (!d.label && !d.title) {
        log("⚠️ 未识别到 Disc Title 或 Disc Label", "WARN");
        return;
      }
      extractCurrentDetailPageDirect();
    });
    bindAction("copy-sub", function() {
      var val = $("#pt-edit-sub") && $("#pt-edit-sub").value.trim() || "";
      if (!val) {
        log("⚠️ 副标题为空", "WARN");
        return;
      }
      copyTextToClipboard(val, false);
    });
    bindAction("copy-desc", function() {
      var val = $("#pt-edit-desc") && $("#pt-edit-desc").value.trim() || "";
      if (!val) {
        log("⚠️ 简介为空", "WARN");
        return;
      }
      copyTextToClipboard(val, false);
    });
    bindAction("regen-preview", function() {
      if (window._ptCurrentPendingItem && window._ptCurrentPendingItem.item && window._ptCurrentPendingItem.item.row) {
        preparePreview(window._ptCurrentPendingItem.item);
      } else if (!extractCurrentDetailPageDirect() && window._ptCurrentPendingItem) {
        preparePreview(window._ptCurrentPendingItem.item);
      }
    });
    bindAction("confirm-publish", async function() {
      if (!window._ptCurrentPendingItem) {
        if (!extractCurrentDetailPageDirect()) {
          alert("请先点击队列/列表中的「🚀转种」或在详情页提取数据");
          return;
        }
      }
      var pending = window._ptCurrentPendingItem;
      try {
        log("🔎 发布前复核：按 IMDb / 西部片名 / AKA 原名再确认一次 B 站是否已有原盘…", "INFO");
        var recheckDupe = await checkSingleImdb(pending.item, pending.item.row ? [pending.item.row] : [], { forceRefresh: true });
        if (recheckDupe) {
          log("⛔ 复核发现 B 站已有原盘，已拦下本次转种（词库里的旧结论作废）。", "ERROR");
          alert("发布前复核发现猫站已有这颗原盘，已拦下。\n\n请到 B 站搜索确认，避免重复发布。");
          return;
        }
        log("✅ 发布前复核通过：B 站确实还没有这颗原盘。", "SUCCESS");
      } catch (recheckErr) {
        log("⚠️ 发布前复核没跑完（" + (recheckErr && recheckErr.message ? recheckErr.message : recheckErr) + "），继续按原流程转种。", "WARN");
      }
      var finalSub = $("#pt-edit-sub").value;
      var finalDesc = $("#pt-edit-desc").value;
      var uploadWin = window.open("about:blank", "_blank");
      if (uploadWin) {
        try {
          uploadWin.document.title = "PT 转种准备中...";
          uploadWin.document.body.innerHTML = '<div style="font-family:-apple-system,sans-serif;padding:40px;color:#475569;font-size:14px;line-height:1.8;">⏳ <b>正在拉取种子、洗种、并应用修改...</b><br><br>完成后会自动跳转到上传页，请勿关闭此标签页。</div>';
        } catch (e) {
        }
      }
      try {
        var itemData = pending.item;
        var fullDetails = pending.fullDetails;
        log("📥 正在拉取源站 .torrent 种子文件二进制流...", "INFO");
        var torrentBase64 = "";
        try {
          torrentBase64 = await ensureItemTorrentBase64(itemData);
          log("✅ 种子文件已拉取进内存！", "SUCCESS");
        } catch (dlErr) {
          log("⚠️ 种子二进制拉取失败 (" + dlErr.message + ")，将在发布页尝试备用拉取或手动选种", "WARN");
        }
        var finalImdbId = normalizeImdbId($("#pt-manual-imdb") && $("#pt-manual-imdb").value.trim() || fullDetails.imdbId || itemData.imdbId || "");
        var finalDoubanUrl = fullDetails.doubanUrl || "";
        var rawRelease = itemData.releaseName || itemData.mainTitle;
        var combinedTech = rawRelease + " " + pending.rawBdinfo;
        var videoCodec = /VC-1/i.test(combinedTech) ? "VC-1" : /MPEG-2/i.test(combinedTech) ? "MPEG-2" : /HEVC|x265/i.test(combinedTech) ? "HEVC" : /AVC|x264|MPEG-4/i.test(combinedTech) ? "AVC" : itemData.is4K ? "HEVC" : "AVC";
        var audioCodec = "";
        if (/DTS-HD\s*Master\s*Audio|DTS-HD\s*MA/i.test(combinedTech)) {
          var chDts = combinedTech.match(/DTS-HD(?:\s*Master\s*Audio|\s*MA)?\s*(\d+\.\d+)/i);
          audioCodec = "DTS-HD MA" + (chDts ? " " + chDts[1] : " 5.1");
        } else if (/TrueHD/i.test(combinedTech)) {
          var chThd = combinedTech.match(/TrueHD\s*(?:Atmos\s*)?(\d+\.\d+)/i);
          audioCodec = "TrueHD" + (chThd ? " " + chThd[1] : " 7.1") + (/Atmos/i.test(combinedTech) ? " Atmos" : "");
        } else if (/LPCM/i.test(combinedTech)) {
          var chLpcm = combinedTech.match(/LPCM\s*(\d+\.\d+)/i);
          audioCodec = "LPCM" + (chLpcm ? " " + chLpcm[1] : " 2.0");
        } else if (/DTS/i.test(combinedTech)) audioCodec = "DTS 5.1";
        else if (/\bDD\s*\d\.\d|Dolby\s*Digital/i.test(combinedTech)) audioCodec = "AC3";
        var standardName = rawRelease.replace(/@[A-Za-z0-9]+$/i, "").trim();
        var sourceTitle = String(rawRelease || "").trim();
        if (!sourceTitle) sourceTitle = String(itemData.mainTitle || "").trim();
        var isDocuGenre = /纪录|紀錄|Documentary/i.test(fullDetails.synopsisBbcode || "");
        var mediaType = isDocuGenre ? "纪录" : "电影";
        var sourceRegion = inferSourceRegion(fullDetails.synopsisBbcode || "", standardName, finalSub);
        var detectedLabels = inferTorrentLabels(standardName, finalSub, fullDetails.synopsisBbcode || "", pending.rawBdinfo);
        var bInfo = getSiteBInfo();
        GM_setValue("pt_transfer_payload", {
          targetBHost: extractHostKey(bInfo.url),
          name: sourceTitle,
          fileName: sourceTitle,
          small_descr: finalSub,
          imdbUrl: finalImdbId ? "https://www.imdb.com/title/" + finalImdbId + "/" : "",
          doubanUrl: finalDoubanUrl,
          descr: finalDesc,
          mediaType,
          is4K: itemData.is4K,
          sizeGB: itemData.sizeGB,
          videoCodec,
          audioCodec,
          sourceRegion,
          labels: detectedLabels,
          downloadUrl: fullDetails.realDownloadUrl || itemData.downloadUrl || "",
          sourceDetailUrl: fullDetails.sourceDetailUrl || location.href,
          torrentBase64,
          timestamp: (/* @__PURE__ */ new Date()).getTime()
        });
        var uploadUrl = siteBase(bInfo.url) + "upload.php";
        log("🚀 正在跳转目标站 [" + bInfo.name + "] 发布页全自动塞种填单...", "INFO");
        if (uploadWin && !uploadWin.closed) {
          try {
            uploadWin.location.href = uploadUrl;
          } catch (e) {
            window.open(uploadUrl, "_blank");
          }
        } else {
          var retryWin = window.open(uploadUrl, "_blank");
          if (!retryWin) {
            log("⚠️ 浏览器拦截了新窗口，请手动打开: " + uploadUrl, "WARN");
            alert("转种数据已全部准备好！\n\n浏览器拦截了自动打开新窗口，请手动打开以下地址：\n\n" + uploadUrl);
          }
        }
        log("✅ 已跳转发布页", "SUCCESS");
      } catch (err) {
        log("❌ 转种执行失败: " + (err && err.message ? err.message : err), "ERROR");
        if (uploadWin && !uploadWin.closed) {
          try {
            uploadWin.document.body.innerHTML = '<div style="font-family:-apple-system,sans-serif;padding:40px;color:#b91c1c;font-size:14px;line-height:1.8;">❌ <b>转种失败</b><br><br>' + String(err && err.message ? err.message : err).replace(/</g, "&lt;") + "<br><br>请关闭此标签页，回到 PT 面板查看日志。</div>";
          } catch (e) {
          }
        }
      }
    });
    function autoFillUploadPageIfActive() {
      if (location.pathname.indexOf("upload.php") === -1 && !/\/upload|\/torrents\/create/i.test(location.pathname)) return false;
      var transferData = GM_getValue("pt_transfer_payload", null);
      if (!transferData || (/* @__PURE__ */ new Date()).getTime() - transferData.timestamp >= 18e4) return false;
      if (!transferData.targetBHost || extractHostKey(location.hostname) !== transferData.targetBHost) return false;
      GM_setValue("pt_transfer_payload", null);
      setTimeout(function() {
        try {
          var bodyTxt = document.body ? document.body.textContent : "";
          var annMatch = bodyTxt.match(/https?:\/\/[^\s"'<>]+\/announce(?:\.php)?(?:\?passkey=[^\s"'<>]+)?/i);
          var pageAnnounce = annMatch ? annMatch[0].trim() : "";
          var fileInput = $('input[type="file"][name="file"], input[type="file"]#torrent, input[type="file"]#file, input[type="file"][name="torrent"], input[type="file"][name="torrentfile"], input[type="file"]');
          var showFileInjectBadge = function(text, isSuccess) {
            if (!fileInput || !fileInput.parentElement) return;
            var oldTip = $(".pt-file-inject-tip", fileInput.parentElement);
            if (oldTip) oldTip.remove();
            var tip = el("span", "pt-file-inject-tip", text, "margin-left:8px; padding:2px 7px; border-radius:4px; font-size:11.5px; font-weight:600; display:inline-block; " + (isSuccess ? "background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;" : "background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;"));
            fileInput.after(tip);
          };
          var injectFileToInput = function(b64Str) {
            if (!fileInput || !b64Str) return false;
            try {
              var siteCode = location.hostname.split(".")[0].toUpperCase();
              var built = buildCleanedTorrentFile(b64Str, transferData.fileName || transferData.name, pageAnnounce || "https://tracker.pterclub.net/announce", siteCode);
              var WinDT = rootWin.DataTransfer || window.DataTransfer;
              var dt = new WinDT();
              dt.items.add(built.file);
              fileInput.files = dt.files;
              dispatchEvt(fileInput);
              showFileInjectBadge("✅ 已自动挂载洗种文件: " + built.filename + " (" + built.sizeKB + " KB)", true);
              setTimeout(function() {
                try {
                  if (typeof armTitleGuard === "function") armTitleGuard();
                } catch (e) {
                }
              }, 0);
              return true;
            } catch (fErr) {
              showFileInjectBadge("❌ 种子文件挂载异常: " + fErr.message, false);
              return false;
            }
          };
          if (transferData.torrentBase64) injectFileToInput(transferData.torrentBase64);
          else if (transferData.downloadUrl) {
            showFileInjectBadge("⏳ 正在从源站后台拉取 .torrent 文件...", true);
            fetchTorrentRawBase64(transferData.downloadUrl, transferData.sourceDetailUrl).then(injectFileToInput).catch(function(err) {
              showFileInjectBadge("⚠️ 自动拉取种子失败 (" + err.message + ")，请手动选择文件", false);
            });
          }
          var lockField = function(sel, val, delays) {
            if (!val) return;
            var apply = function() {
              var node = $(sel);
              if (node) {
                node.value = val;
                dispatchEvt(node);
              }
            };
            apply();
            (delays || []).forEach(function(ms) {
              setTimeout(apply, ms);
            });
          };
          var userTypedTitle = false;
          var applyTitle = function() {
            var node = $('input[name="name"], input#name');
            if (!node || !transferData.name) return;
            if (userTypedTitle) return;
            if (String(node.value || "") === transferData.name) return;
            node.value = transferData.name;
            dispatchEvt(node);
          };
          var armTitleGuard = function() {
            var node = $('input[name="name"], input#name');
            if (node && !node._ptTitleHooked) {
              node._ptTitleHooked = true;
              ["keydown", "paste", "compositionstart"].forEach(function(evt) {
                node.addEventListener(evt, function(ev) {
                  if (ev && ev.isTrusted) userTypedTitle = true;
                }, true);
              });
            }
            [0, 600, 1500, 3000, 5000, 8000].forEach(function(ms) {
              setTimeout(applyTitle, ms);
            });
          };
          armTitleGuard();
          lockField('input[name="small_descr"], input[name="subtitle"]', transferData.small_descr, [200, 800, 1800]);
          lockField('input[name="url"][type="text"], input[name="url"], input[name="imdb_id"]', transferData.imdbUrl);
          lockField('textarea[name="descr"], textarea#descr', transferData.descr);
          var doubanInput = $('input[name="douban"], input[name="douban_url"], input[name="durl"], input[name="ptgen_url"], input[name="external_url"]');
          if (!doubanInput) {
            var dbTr = $$("tr").find(function(tr) {
              var h = $("td.rowhead, td:first-child", tr);
              return h && /豆瓣/.test(h.textContent);
            });
            if (dbTr) doubanInput = $('input[type="text"]', dbTr);
          }
          if (doubanInput && transferData.doubanUrl) {
            doubanInput.value = transferData.doubanUrl;
            dispatchEvt(doubanInput);
          }
          var findSelects = function(names, labelRegex) {
            var res = [];
            (names || []).forEach(function(n) {
              $$('select[name="' + n + '"], select[name^="' + n + '["], select#' + n).forEach(function(s) {
                pushUnique(res, s);
              });
            });
            if (labelRegex) {
              $$("tr").forEach(function(tr) {
                var head = $("td.rowhead, td:first-child", tr);
                if (head && labelRegex.test((head.textContent || "").trim())) {
                  $$("select", tr).forEach(function(s) {
                    pushUnique(res, s);
                  });
                }
              });
            }
            return res;
          };
          var pickSelectOptionByKeywords = function(selectEls, keywords) {
            if (!selectEls || !selectEls.length || !keywords || !keywords.length) return;
            selectEls.forEach(function(select) {
              var bestOpt = null, bestScore = -1;
              Array.from(select.options).forEach(function(opt) {
                var text = (opt.textContent || "").trim();
                if (!text || /请选择|choose|select/i.test(text)) return;
                var score = -1;
                keywords.forEach(function(kw) {
                  if (typeof kw === "string") {
                    var kLower = kw.toLowerCase(), tLower = text.toLowerCase();
                    if (tLower === kLower) score = Math.max(score, 120);
                    else if (tLower.indexOf(kLower) !== -1) score = Math.max(score, 85);
                  } else if (kw instanceof RegExp) {
                    var m = text.match(kw);
                    if (m) score = Math.max(score, m[0].length === text.length ? 110 : 75);
                  }
                });
                if (score > bestScore) {
                  bestScore = score;
                  bestOpt = opt;
                }
              });
              if (bestOpt && bestScore >= 0) {
                bestOpt.selected = true;
                select.value = bestOpt.value;
                dispatchEvt(select);
              }
            });
          };
          var selectHasText = function(s, reg) {
            return reg.test(Array.from(s.options).map(function(o) {
              return (o.textContent || "").trim();
            }).join(" | "));
          };
          var fillAllBottomDropdowns = function() {
            pickSelectOptionByKeywords(findSelects(["type", "category", "cat"], /^(类型|類別|Category|Type)\*?$/i), transferData.mediaType === "纪录" ? [/Docu/i, /纪录|紀錄/] : [/Movie/i, /电影|電影/]);
            var mediumSels = findSelects(["medium_sel", "medium"], /^(质量|質量|媒介|介质|Medium|Format)\*?$/i);
            findSelects(["source_sel", "source"]).forEach(function(s) {
              if (selectHasText(s, /Blu-?ray|UHD|Remux|Encode|WEB-?DL|HDTV|DVD|原盘/i)) pushUnique(mediumSels, s);
            });
            pickSelectOptionByKeywords(mediumSels, transferData.is4K ? ["UHD", /UHD|4K\s*UHD|Ultra\s*HD/i, /Blu-?ray/i, /原盘|蓝光/] : ["Blu-ray", "BluRay", /Blu-?ray/i, /\bBD\b/i, /原盘|蓝光/]);
            pickSelectOptionByKeywords(findSelects(["standard_sel", "standard"], /^(分辨率|解析度|Standard|Resolution)\*?$/i), transferData.is4K ? /4320p|8K/i.test(transferData.name) ? [/4320p|8K/i, /2160p|4K|UHD/i] : [/2160p|4K|UHD/i] : /1080i/i.test(transferData.name) ? [/1080i/i, /1080p/i] : [/1080p/i, /1080i/i]);
            var vCodec = transferData.videoCodec || (transferData.is4K ? "HEVC" : "AVC");
            var codecKw = /HEVC|265/i.test(vCodec) ? [/HEVC|H\.?265/i] : /VC-?1/i.test(vCodec) ? [/VC-?1/i] : /MPEG-?2/i.test(vCodec) ? [/MPEG-?2/i] : [/AVC|H\.?264/i];
            pickSelectOptionByKeywords(findSelects(["codec_sel", "codec"], /^(编码|編碼|视频编码|Codec)\*?$/i), codecKw);
            var aCodec = transferData.audioCodec || "";
            var audioKw = /Atmos/i.test(aCodec) ? [/Atmos/i, /TrueHD/i] : /TrueHD/i.test(aCodec) ? [/TrueHD/i] : /DTS-HD/i.test(aCodec) ? [/DTS[- .]?HD[\s\S]{0,10}(MA|Master)/i, /DTS[- .]?HD/i, /DTS/i] : /LPCM|PCM/i.test(aCodec) ? [/LPCM|PCM/i] : /DTS/i.test(aCodec) ? [/\bDTS\b/i] : /DD|AC-?3|Dolby/i.test(aCodec) ? [/AC-?3|Dolby|\bDD/i] : [];
            if (audioKw.length) pickSelectOptionByKeywords(findSelects(["audiocodec_sel", "audio"], /^(音频|音頻|音频编码|Audio)\*?$/i), audioKw);
            var REGION_KW_MAP = { "香港": ["香港", "港台", /香港|港台|港澳|HK/i], "台湾": ["台湾", "臺灣", "港台", /台湾|臺灣|港台|TW/i], "大陆": ["大陆", "内地", "中国", /大陆|内地|中国|华语|CN/i], "日本": ["日本", "日韩", /日本|日韩|JP|Japan/i], "韩国": ["韩国", "韩國", "日韩", /韩国|韓國|日韩|KR|Korea/i], "印度": ["印度", "其他", /印度|India|Other/i] };
            var regionSels = findSelects([], /^(地区|地區|来源|來源|国家|國家|Region|Source|Area)\*?$/i);
            findSelects(["source_sel", "team_sel", "region", "area"]).forEach(function(s) {
              if (selectHasText(s, /欧美|大陆|香港|台湾|港台|日本|韩国|日韩|印度/)) pushUnique(regionSels, s);
            });
            pickSelectOptionByKeywords(regionSels, REGION_KW_MAP[transferData.sourceRegion] || [/欧美|歐美|美国|欧洲|US|EU/i]);
          };
          fillAllBottomDropdowns();
          [500, 1200].forEach(function(ms) {
            setTimeout(fillAllBottomDropdowns, ms);
          });
          var TAG_CHECK_RULES = [["gy", "gy", /^(国语|國語|国配)$/i], ["yy", "yy", /^(粤语|粵語|粤配)$/i], ["zz", "zz", /^(中字|中文字幕)$/i], ["yz", "yz", /^(英字|英文字幕)$/i], ["diy", "diy", /^(DIY|DIY原盘)$/i], ["hdr10", "hdr10", /^HDR10$/i], ["hdr10plus", "hdrm", /^HDR10\+$/i], ["db", "db|dovi", /^(杜比视界|Dolby\s*Vision|DoVi)$/i]];
          var checkTagsAndAnonymous = function() {
            var lbs = transferData.labels || {};
            $$('input[type="checkbox"]').forEach(function(cb) {
              var nameAttr = (cb.getAttribute("name") || "").toLowerCase(), valAttr = (cb.value || "").toLowerCase();
              var labelFor = cb.id ? $('label[for="' + cb.id + '"]') : null;
              var labelText = labelFor && labelFor.textContent || (cb.nextSibling ? (cb.nextSibling.textContent || "") + (cb.nextElementSibling ? cb.nextElementSibling.textContent : "") : "") || (cb.parentElement ? cb.parentElement.textContent : "");
              labelText = labelText.trim();
              if (labelText.indexOf("副标题") !== -1 && nameAttr.indexOf("tag") === -1) {
                cb.checked = false;
                return;
              }
              if (nameAttr === "uplver" || nameAttr === "anonymous" || /不要在发布者项目中显示|匿名发布|匿名上傳/i.test(labelText)) {
                cb.checked = true;
                dispatchEvt(cb);
                return;
              }
              var hit = TAG_CHECK_RULES.some(function(rule) {
                return lbs[rule[0]] && (new RegExp("^(" + rule[1] + ")$").test(valAttr) || rule[2].test(labelText));
              });
              if (hit && !cb.checked) {
                cb.checked = true;
                dispatchEvt(cb);
              }
            });
          };
          checkTagsAndAnonymous();
          [600, 1500].forEach(function(ms) {
            setTimeout(checkTagsAndAnonymous, ms);
          });
        } catch (err) {
          console.error("[PT助手] 自动填单异常:", err);
        }
      }, 500);
      return true;
    }
    bindAction("row-forward", async function(btn) {
      if (!btn._ptItem) return;
      var origTxt = btn.innerText;
      btn.innerText = "⏳拉取中...";
      try {
        await preparePreview(btn._ptItem);
      } catch (err) {
        log("❌ 提取预览失败: " + (err && err.message ? err.message : err), "ERROR");
      } finally {
        btn.innerText = origTxt;
      }
    });
    async function qbLogin(customParams) {
      var targetConfig = customParams || config;
      if (!targetConfig.qbUrl) throw new Error("未填写 qB 地址");
      var cleanUrl = targetConfig.qbUrl.trim().replace(/\/?$/, "/");
      var res = await http(cleanUrl + "api/v2/auth/login", {
        method: "POST",
        rawResponse: true,
        timeout: 8e3,
        headers: qbHeaders(cleanUrl, true),
        data: "username=" + encodeURIComponent(targetConfig.qbUser) + "&password=" + encodeURIComponent(targetConfig.qbPass)
      });
      if (res.responseText === "Fails.") throw new Error("用户名或密码错误");
      if (res.status >= 200 && res.status < 300 || res.responseText === "Ok.") return cleanUrl;
      throw new Error("HTTP " + res.status);
    }
    async function qbGetVersion(cleanUrl) {
      try {
        var txt = await http(cleanUrl + "api/v2/app/version", { headers: qbHeaders(cleanUrl), timeout: 5e3 });
        return (txt || "").trim();
      } catch (e) {
        return "";
      }
    }
    function qbForm(fields) {
      return Object.keys(fields).map(function(k) {
        return encodeURIComponent(k) + "=" + encodeURIComponent(fields[k]);
      }).join("&");
    }
    async function qbEnsureCategory(cleanUrl, name) {
      if (!name) return;
      try {
        var res = await http(cleanUrl + "api/v2/torrents/createCategory", {
          method: "POST",
          rawResponse: true,
          timeout: 8e3,
          headers: qbHeaders(cleanUrl, true),
          data: qbForm({ category: name, savePath: "" })
        });
        if (res.status === 409) return;
        if (!(res.status >= 200 && res.status < 300)) {
          log("  · qB 分类「" + name + "」创建返回 HTTP " + res.status + "（继续添加）", "WARN");
        }
      } catch (e) {
      }
    }
    async function qbRecentTorrent(cleanUrl, sinceMs) {
      try {
        var txt = await http(cleanUrl + "api/v2/torrents/info?sort=added_on&reverse=true&limit=30", { headers: qbHeaders(cleanUrl), timeout: 8e3 });
        var list = JSON.parse(txt);
        if (!Array.isArray(list)) return null;
        var hits = list.filter(function(t) {
          return t && typeof t.added_on === "number" && t.added_on * 1e3 >= sinceMs;
        });
        return hits.length === 1 ? hits[0] : null;
      } catch (e) {
        return null;
      }
    }
    async function qbSetCategory(cleanUrl, hash, name) {
      try {
        var res = await http(cleanUrl + "api/v2/torrents/setCategory", {
          method: "POST",
          rawResponse: true,
          timeout: 8e3,
          headers: qbHeaders(cleanUrl, true),
          data: qbForm({ hashes: hash, category: name })
        });
        return res.status >= 200 && res.status < 300;
      } catch (e) {
        return false;
      }
    }
    async function qbPushTorrent(itemOrUrl) {
      var cleanUrl = await qbLogin();
      var itemObj = typeof itemOrUrl === "object" && itemOrUrl !== null ? itemOrUrl : { downloadUrl: String(itemOrUrl || ""), mainTitle: "torrent" };
      var b64 = await ensureItemTorrentBase64(itemObj);
      var built = buildCleanedTorrentFile(b64, itemObj.mainTitle || "movie", null, null);
      var cat = String(config.qbCategory || "").trim();
      if (cat) await qbEnsureCategory(cleanUrl, cat);
      var fd = new FormData();
      if (cat) fd.append("category", cat);
      fd.append("torrents", built.blob, built.filename);
      var addedSince = Date.now() - 1e4;
      var res = await http(cleanUrl + "api/v2/torrents/add", { method: "POST", rawResponse: true, timeout: 15e3, headers: qbHeaders(cleanUrl), data: fd });
      if (!(res.status >= 200 && res.status < 300) || res.responseText === "Fails.") {
        throw new Error("qB 拒绝添加种子 (" + (res.responseText || "HTTP " + res.status) + ")");
      }
      if (!cat) {
        log("⚠️ 未填 qB 分类，种子按未分类添加（面板「qB 分类」填好后重推即可）", "WARN");
        return true;
      }
      await new Promise(function(r) {
        setTimeout(r, 900);
      });
      var t = await qbRecentTorrent(cleanUrl, addedSince);
      if (!t) {
        log("  · 已按分类「" + cat + "」提交（未取到新种子信息，未能复核）", "INFO");
        return true;
      }
      if (String(t.category || "") === cat) {
        log("  · qB 分类已确认：「" + cat + "」", "INFO");
        return true;
      }
      var patched = await qbSetCategory(cleanUrl, t.hash, cat);
      if (patched) log("  · qB 分类已补设为「" + cat + "」（原先为「" + (t.category || "未分类") + "」）", "SUCCESS");
      else log("  · qB 分类补设失败，请在 qB 里手动选一次分类", "WARN");
      return true;
    }
    bindAction("cfg-qb-test", async function(testBtn) {
      var msgBox = $("#pt-cfg-qb-test-msg");
      var tempUrl = $("#pt-cfg-qb-url").value.trim(), tempUser = $("#pt-cfg-qb-user").value.trim(), tempPass = $("#pt-cfg-qb-pass").value.trim();
      if (!tempUrl) {
        msgBox.style.display = "block";
        msgBox.style.color = "#dc2626";
        msgBox.innerText = "请先输入 qBittorrent WebUI 地址！";
        return;
      }
      testBtn.innerText = "⏳ 测试中...";
      msgBox.style.display = "block";
      msgBox.style.color = "#2563eb";
      msgBox.innerText = "正在握手...";
      try {
        var cleanUrl = await qbLogin({ qbUrl: tempUrl, qbUser: tempUser, qbPass: tempPass });
        var ver = await qbGetVersion(cleanUrl);
        testBtn.innerText = "🔌 测试 qBittorrent 连接";
        msgBox.style.color = "#15803d";
        msgBox.innerText = "🎉 连通成功！服务正常" + (ver ? " (版本: " + ver + ")" : "");
      } catch (err) {
        testBtn.innerText = "🔌 测试 qBittorrent 连接";
        msgBox.style.color = "#dc2626";
        msgBox.innerText = "❌ 连接失败: " + err.message;
      }
    });
    bindAction("cfg-qb-cats", async function(btn) {
      var orig = btn.innerText;
      btn.innerText = "⏳ 读取中...";
      try {
        var cleanUrl = await qbLogin({ qbUrl: $("#pt-cfg-qb-url").value.trim(), qbUser: $("#pt-cfg-qb-user").value.trim(), qbPass: $("#pt-cfg-qb-pass").value.trim() });
        var txt = await http(cleanUrl + "api/v2/torrents/categories", { headers: qbHeaders(cleanUrl), timeout: 8e3 });
        var obj = JSON.parse(txt) || {};
        var names = Object.keys(obj);
        var dl = $("#pt-cfg-qb-cat-list");
        if (dl) {
          dl.innerHTML = names.map(function(n) {
            return '<option value="' + String(n).replace(/"/g, "&quot;") + '"></option>';
          }).join("");
        }
        if (names.length === 1) {
          $("#pt-cfg-qb-cat").value = names[0];
          config.qbCategory = names[0];
          GM_setValue("pt_qb_category", names[0]);
          log("📂 已自动填入并保存 qB 分类: " + names[0], "SUCCESS");
        }
        log("📂 qB 现有分类: " + (names.length ? names.join(" / ") : "（还没有分类）"), "INFO");
        btn.innerText = names.length ? "✅ 读到 " + names.length + " 个分类" : "qB 里还没有分类";
      } catch (e) {
        btn.innerText = "读取失败: " + e.message;
      }
      setTimeout(function() {
        btn.innerText = orig;
      }, 2500);
    });
    bindAction("row-qb", async function(btn) {
      if (!btn._ptItem) return;
      btn.innerText = "...";
      try {
        await qbPushTorrent(btn._ptItem);
        btn.innerText = "已推";
        log("✅ 成功将 .torrent 文件上传至 qB: " + (btn._ptItem.cnTitle || btn._ptItem.movieTitle), "SUCCESS");
      } catch (err) {
        alert("推送 qB 失败: " + err.message);
        btn.innerText = "重试";
      }
    });
    bindAction("row-combo", async function(btn) {
      if (!btn._ptItem) return;
      btn.innerText = "...";
      try {
        await qbPushTorrent(btn._ptItem);
        log("✅ 种子文件已上传至远程 qB", "SUCCESS");
      } catch (err) {
        log("⚠️ qB 投递异常: " + err.message, "WARN");
      }
      try {
        await preparePreview(btn._ptItem);
      } catch (err) {
        log("❌ 提取预览失败: " + (err && err.message ? err.message : err), "ERROR");
      } finally {
        btn.innerText = "⚡全套";
        if (btn._ptQueueRow) btn._ptQueueRow.style.opacity = "0.5";
      }
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
      ensureLibLoaded();
      window.addEventListener("pagehide", function() {
        try {
          flushLibShards(false);
        } catch (e) {
        }
      });
      document.addEventListener("visibilitychange", function() {
        if (document.visibilityState === "hidden") {
          try {
            flushLibShards(false);
          } catch (e) {
          }
        }
      });
      renderPanelView();
      var observer = new MutationObserver(function() {
        if (document.body && !$("#pt-checker-panel")) renderPanelView();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setInterval(function() {
        if (document.body && !$("#pt-checker-panel")) renderPanelView();
      }, 2e3);
      setTimeout(function() {
        renderQueueUI();
        if (isHideMode) applyHideMode(true);
      }, 800);
      if (currentSiteArch === "unit3d") {
        var pendingTs = GM_getValue("pt_u3d_pending_preset", 0);
        if (pendingTs && Date.now() - pendingTs < 2e4) {
          GM_setValue("pt_u3d_pending_preset", 0);
          setTimeout(function() {
            PRESET_HANDLERS.unit3d(getSiteAInfo());
          }, 900);
        }
      }
      if (isMTeamPage()) {
        var mtPendingTs = GM_getValue("pt_mteam_pending_preset", 0);
        if (mtPendingTs && Date.now() - mtPendingTs < 3e5) {
          GM_setValue("pt_mteam_pending_preset", 0);
          setTimeout(function() {
            applyMTeamPreset();
          }, 1500);
        }
      }
      if (isLikelyDetailPage()) {
        setTimeout(function() {
          if (findBdinfo(document)) {
            extractCurrentDetailPageDirect();
          }
        }, 600);
        setTimeout(function() {
          var descVal = $("#pt-edit-desc") && $("#pt-edit-desc").value.trim() || "";
          if (!descVal && findBdinfo(document)) {
            extractCurrentDetailPageDirect();
          }
        }, 2500);
      } else {
        setTimeout(autoRestoreState, 1200);
      }
      var tableContainer = document.querySelector(".data-table, #torrenttable, table.torrents") || document.body;
      if (tableContainer) {
        rowObserver.observe(tableContainer, { childList: true, subtree: true });
      }
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPanel);
    else bootPanel();
  })();
})();
