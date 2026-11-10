/* 媒体资料库 · 静态原型假数据与渲染逻辑 */
(function () {
  var PAGE = document.body.getAttribute("data-page") || "dashboard";

  var MOCK = {
    stats: {
      crawlAt: "今天 12:40",
      crawlPages: 231,
      targetLogin: "剩余 6 天",
      pending: 12,
      nodes: "4 / 5 在线",
      today: { scanned: 23186, checked: 214, fresh: 87, posted: 3, failed: 1, dbTotal: 128406, monthPosted: 84, totalPosted: 1240 }
    },
    sites: null, /* 由站点清单实时算出 */
    trend: {
      week: { values: [3, 4, 5, 4, 5, 3, 3], labels: ["一", "二", "三", "四", "五", "六", "日"] },
      month: {
        values: [1, 2, 0, 3, 2, 4, 3, 5, 2, 1, 4, 3, 2, 5, 4, 3, 6, 4, 2, 3, 5, 4, 6, 3, 2, 5, 4, 3, 6, 4],
        labels: []
      }
    },
    todos: [
      { level: "warn", title: "12 部待发等你确认", desc: "最早一条已等 2 小时", action: "去确认", href: "#queue" },
      { level: "bad", title: "2 个站登录失效", desc: "站点 A、站点 C 需要重新登录", action: "去登录", href: "#settings" },
      { level: "warn", title: "节点 E 离线 37 分钟", desc: "还有 214 个种子未同步", action: "查看", href: "#nodes" },
      { level: "", title: "抓取任务运行正常", desc: "下一轮 18:00 自动增量", action: "看日志", href: "#logs" }
    ],
    published: [
      { title: "The Golden Lotus", cn: "金瓶双艳", site: "主站 B", time: "12:39", size: "30.67 GB" },
      { title: "Perfect Blue", cn: "未麻的部屋", site: "主站 B", time: "11:52", size: "44.14 GB" },
      { title: "Ran", cn: "乱", site: "主站 B", time: "10:18", size: "87.77 GB" },
      { title: "Green Snake", cn: "青蛇劫起", site: "主站 B", time: "昨天 22:41", size: "43.67 GB" }
    ],
    queue: [],
    sources: [],
    nodes: [],
    sitesList: [],    logs: []
  };


  /* 测试夹具入口：只在 file:// 且测试脚本显式开启时存在，正常使用不会注册任何假数据 */
  if (location.protocol === "file:" && window.__PTA_TEST_HOOKS__) {
    window.__PTA_TEST__ = {
      queue: function (items) { MOCK.queue = items || []; if (window.__ptaRepaintQueue) window.__ptaRepaintQueue(); },
      sources: function (items) { MOCK.sources = items || []; if (window.__ptaRepaintSources) window.__ptaRepaintSources(); }
    };
  }

  /* ---------- 站点清单：URL -> 站点对象（字段全部来自清单本身，不再按域名编造状态） ---------- */
  var GAZELLE_HOSTS = ["redacted.sh", "orpheus.network", "gazellegames.net", "animebytes.tv", "passthepopcorn.me", "jpopsuki.eu", "dicmusic.com"];
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  /* 记录可以是字符串（旧格式）或 {url, host, arch, title}（/api/sites 返回的格式） */
  function buildSites(records) {
    var seen = {}, out = [];
    (records || []).forEach(function (rec) {
      var url = typeof rec === "string" ? rec : (rec && (rec.url || rec.host)) || "";
      if (url && !/^https?:\/\//.test(url)) url = "https://" + url;
      var host = (typeof rec === "object" && rec && rec.host) ||
        url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
      if (!host || seen[host]) return;
      seen[host] = 1;
      var measured = (typeof rec === "object" && rec && rec.arch) || (window.PT_ARCH || {})[host];
      var arch = measured || "?";
      out.push({
        name: host,
        title: (typeof rec === "object" && rec && rec.title) || (window.PT_NAMES || {})[host] || host,
        brand: host.replace(/^www\./, "").replace(/^pt\./, "").replace(/[^a-z0-9]/gi, "").slice(0, 2),
        path: (function () {
          var t = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/$/, "");
          return /^\/index\.php\/?$/.test(t) ? "" : t;
        })(),
        url: url,
        arch: arch,
        enabled: false,
        login: "none",
        ratio: "—",
        canDl: false,
        tfa: false,
        last: "未抓取",
        items: 0,
        cookieDays: 0,
        interval: "3.0", pages: "2", concurrency: "1", dupeCheck: true, totp: "", note: "",
        loginMethod: "password", username: "", password: "", cookie: "",
        cats: ["movie", "tv", "doc", "music"], fullDiscOnly: true, minRes: "1080p", minSize: "5",
        exclude: "", queueMode: "queue", window: "all",
        mode: "incr", stopAtKnown: true, fullCycle: "weekly",
        trigger: "interval", everyMin: "60", dailyAt: "18:00", jitter: "5",
        timeWindow: false, winStart: "00:00", winEnd: "08:00"
      });
    });
    return out;
  }
  function siteStats(list) {
    var on = list.filter(function (x) { return x.enabled; });
    return {
      total: list.length,
      enabled: on.length,
      loginOk: on.filter(function (x) { return x.login === "ok"; }).length,
      loginFail: on.filter(function (x) { return x.login === "fail"; }).length,
      lowRatio: on.filter(function (x) { return !x.canDl; }).length,
      tfa: list.filter(function (x) { return x.tfa; }).length,
      np: list.filter(function (x) { return x.arch === "NP"; }).length,
      unit3d: list.filter(function (x) { return x.arch === "UNIT3D"; }).length,
      gz: list.filter(function (x) { return x.arch === "GZ"; }).length,
      oth: list.filter(function (x) { return x.arch === "OTHER"; }).length,
      unk: list.filter(function (x) { return !x.arch || x.arch === "?"; }).length
    };
  }
  function makeSite(o) {
    return {
      name: o.host, title: o.title || o.host, brand: o.brand, url: o.url, arch: o.arch || "?",
      enabled: true, login: "none", ratio: "—", canDl: false, tfa: false,
      last: "未抓取", items: 0, cookieDays: 0,
      interval: "3.0", pages: "2", concurrency: "1", dupeCheck: true, totp: "", note: o.note || "",
      added: true
    };
  }
  function createStore() {
    var KEY = "pta.sites.v1";
    var data = { added: [], overrides: {}, hidden: [] };
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw) || data;
    } catch (e) {}
    if (!data.added) data.added = [];
    if (!data.overrides) data.overrides = {};
    if (!data.hidden) data.hidden = [];
    function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
    return {
      data: data, save: save,
      add: function (o) { data.added.push(o); save(); return makeSite(o); },
      set: function (host, s) {
        data.overrides[host] = {
          enabled: s.enabled, url: s.url, arch: s.arch, tfa: s.tfa, totp: s.totp,
          interval: s.interval, pages: s.pages, concurrency: s.concurrency,
          dupeCheck: s.dupeCheck, note: s.note,
          cats: s.cats, fullDiscOnly: s.fullDiscOnly, minRes: s.minRes, minSize: s.minSize,
          exclude: s.exclude, queueMode: s.queueMode, window: s.window,
          mode: s.mode, stopAtKnown: s.stopAtKnown, fullCycle: s.fullCycle,
          trigger: s.trigger, dailyAt: s.dailyAt, everyMin: s.everyMin,
          timeWindow: s.timeWindow, winStart: s.winStart, winEnd: s.winEnd, jitter: s.jitter,
          loginMethod: "cookie"
        };
        save();
        if (window.__ptaSyncSite) window.__ptaSyncSite(host, s);
      },
      reset: function (host) {
        delete data.overrides[host]; save();
        if (window.__ptaSyncDrop) window.__ptaSyncDrop(host);
      },
      remove: function (host) {
        data.added = data.added.filter(function (a) { return a.host !== host; });
        delete data.overrides[host];
        if (data.hidden.indexOf(host) < 0) data.hidden.push(host);
        save();
        if (window.__ptaSyncDrop) window.__ptaSyncDrop(host);
      }
    };
  }
  /* 站点清单来源：优先 /api/sites（服务端真实清单），file:// 或无后端时回退本地 assets 里的清单 */
  window.__ptaStore = createStore();
  window.__ptaDefaults = {};
  window.__ptaSiteSource = "local";

  function siteRecordsFromLocal() {
    var arch = window.PT_ARCH || {}, names = window.PT_NAMES || {};
    return (window.SITE_URLS || []).map(function (u) {
      var host = String(u).replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
      return { url: u, host: host, arch: arch[host] || "?", title: names[host] };
    });
  }

  var lastSiteRecords = null;
  function applySites(records, source) {
    if (records) lastSiteRecords = records.slice();
    var list = buildSites(records);
    var store = window.__ptaStore;
    store.data.added.forEach(function (a) { list.push(makeSite(a)); });
    Object.keys(store.data.overrides).forEach(function (h) {
      var site = list.filter(function (x) { return x.name === h; })[0];
      if (!site) return;
      var o = store.data.overrides[h];
      for (var k in o) site[k] = o[k];
    });
    list = list.filter(function (x) { return store.data.hidden.indexOf(x.name) < 0; });
    var defs = {};
    list.forEach(function (x) { defs[x.name] = JSON.parse(JSON.stringify(x)); });
    window.__ptaDefaults = defs;
    window.PTA_SITES = list;
    MOCK.sitesList = list;
    MOCK.sites = siteStats(list);
    if (source) window.__ptaSiteSource = source;
    if (typeof window.__ptaRepaintSites === "function") window.__ptaRepaintSites();
    if (current === "dashboard" && typeof renderDashboard === "function") renderDashboard();
    return list.length;
  }
  window.__ptaApplySites = applySites;

  /* 干跑任务：提交 -> 轮询进度。没有后端时立刻回错误，绝不发真实站点请求 */
  function submitDryRun(host, onStep, onDone, onErr) {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) {
      onErr("本地预览没有后端，干跑不可用");
      return null;
    }
    var timer = null;
    fetch("/api/tasks", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "crawl", siteHost: host, dryRun: true })
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, j: j }; },
        function () { return { status: r.status, j: null }; });
    }).then(function (res) {
      if (!res.j || !res.j.ok || !res.j.data) {
        onErr((res.j && res.j.error && res.j.error.message) || ("提交失败 " + res.status));
        return;
      }
      onStep(res.j.data);
      timer = setInterval(function () {
        fetch("/api/tasks/" + encodeURIComponent(res.j.data.id), { credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (jj) {
            if (!jj || !jj.ok || !jj.data) { clearInterval(timer); onErr("任务查询失败"); return; }
            onStep(jj.data);
            if (["done", "failed", "canceled"].indexOf(jj.data.state) >= 0) {
              clearInterval(timer);
              onDone(jj.data);
            }
          })
          .catch(function () { clearInterval(timer); onErr("任务查询中断"); });
      }, 400);
    }).catch(function () { onErr("本地预览没有后端，干跑不可用"); });
    return { stop: function () { if (timer) clearInterval(timer); } };
  }
  window.__ptaDryRun = submitDryRun;

  /* 待审核台：读服务端队列（没有后端就走前端假数据） */
  function queueRequest(path, method, body) {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(null);
    return fetch("/api/queue" + path, {
      method: method || "GET", credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, j: j }; },
        function () { return { status: r.status, j: null }; });
    }).catch(function () { return null; });
  }
  function mapServerQueue(it) {
    return {
      id: String(it.id), title: it.title || "", cn: it.cn || "", year: it.year || "", res: it.res || "",
      size: it.size || "", imdb: it.imdb || "—", site: it.site || "", status: it.status || "pending",
      check: it.check || "未查", checkCls: it.checkCls || "gray", reason: it.reason || "",
      shots: (it.shots || []).map(function (s, i) { return { name: "shot" + (i + 1), url: s }; }),
      server: true
    };
  }
  window.__ptaQueue = { req: queueRequest, map: mapServerQueue };

  /* 下载器：配置存服务端，密码只写不读 */
  function dlRequest(path, method, body) {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(null);
    return fetch("/api/downloaders" + path, {
      method: method || "GET", credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, j: j }; },
        function () { return { status: r.status, j: null }; });
    }).catch(function () { return null; });
  }
  window.__ptaDl = { req: dlRequest };

  /* 站点凭据（cookie）：只发密文方向的请求，回包只有 hasCookie */
  function credRequest(host, method, body) {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(null);
    const url = host ? "/api/credentials/" + encodeURIComponent(host) : "/api/credentials";
    return fetch(url, {
      method: method || "GET", credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, j: j }; },
        function () { return { status: r.status, j: null }; });
    }).catch(function () { return null; });
  }
  window.__ptaCred = { req: credRequest };

  /* 站点搜索预设状态：只读汇总，用于列表上标「已确认/未确认」 */
  window.__ptaPresets = {};
  function loadPresets() {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    return fetch("/api/site-search", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !j.data || typeof j.data !== "object") return false;
        window.__ptaPresets = j.data;
        if (typeof window.__ptaRepaintSites === "function") window.__ptaRepaintSites();
        return true;
      })
      .catch(function () { return false; });
  }
  window.__ptaLoadPresets = loadPresets;

  /* 站点定义摘要（引擎、采样行数、分类数），来自 /api/site-defs；只用于展示，不参与判定 */
  window.__ptaDefs = {};
  function loadDefs() {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    return fetch("/api/site-defs", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.data)) return false;
        var map = {};
        j.data.forEach(function (d) { if (d && d.host) map[d.host] = d; });
        window.__ptaDefs = map;
        if (typeof window.__ptaRepaintSites === "function") window.__ptaRepaintSites();
        return true;
      })
      .catch(function () { return false; });
  }
  window.__ptaLoadDefs = loadDefs;

  /* 系统状态：站点自检结果、下载器在线与磁盘余量，都来自后端真实数据 */
  window.__ptaOverview = null;
  function loadOverview() {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    return fetch("/api/stats/overview", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !j.data) return false;
        window.__ptaOverview = j.data;
        if (typeof window.__ptaPaintHealth === "function") window.__ptaPaintHealth();
        return true;
      })
      .catch(function () { return false; });
  }
  window.__ptaLoadOverview = loadOverview;

  /* 顶栏三个状态：后端连通、待审核条数、下载器数量；没有数据就不显示次数 */
  function paintTopbar() {
    var svc = $("#pill-service"), pend = $("#pill-pending"), nodes = $("#pill-nodes");
    if (!svc) return;
    var online = window.__ptaSiteSource === "api";
    svc.innerHTML = '<span class="dot ' + (online ? "ok" : "") + '"></span>' + (online ? "后端已连接" : "未连接后端");
    var pn = (window.__ptaQueueCounts && window.__ptaQueueCounts.pending) || 0;
    if (pend) {
      pend.hidden = !pn;
      pend.innerHTML = '<span class="dot warn"></span>' + pn + " 条待审核";
    }
    var dn = window.__ptaDownloaderCount;
    if (nodes) {
      nodes.hidden = dn === undefined;
      nodes.innerHTML = '<span class="dot ok"></span>下载器 ' + (dn || 0);
    }
  }
  window.__ptaPaintTopbar = paintTopbar;

  /* 拉服务端清单；失败（file://、未登录、离线）就保持本地数据，不打断页面 */
  function loadSitesFromApi() {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    return fetch("/api/sites", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !j.data || !Array.isArray(j.data.sites) || !j.data.sites.length) return false;
        window.__ptaSiteCounts = j.data.counts || null;
        applySites(j.data.sites, "api");
        if (window.__ptaPaintTopbar) window.__ptaPaintTopbar();
        if (typeof loadSiteCfgFromApi === "function") loadSiteCfgFromApi();
        return true;
      })
      .catch(function () { return false; });
  }
  window.__ptaLoadSites = loadSitesFromApi;

  /* 站点配置：写回服务端（密码 / cookie / totp 永不发送），并在启动时用服务端值覆盖本地 */
  var SITE_SYNC_FIELDS = [
    "enabled", "url", "arch", "tfa", "interval", "pages", "concurrency", "dupeCheck", "note",
    "cats", "fullDiscOnly", "minRes", "minSize", "exclude", "queueMode", "window",
    "mode", "stopAtKnown", "fullCycle", "trigger", "dailyAt", "everyMin",
    "timeWindow", "winStart", "winEnd", "jitter", "loginMethod", "username"
  ];
  function serverMode() {
    return !!window.fetch && /^https?:$/.test(location.protocol);
  }
  function siteSyncBody(s) {
    var out = {};
    SITE_SYNC_FIELDS.forEach(function (k) { if (s[k] !== undefined) out[k] = s[k]; });
    return out;
  }
  window.__ptaSyncSite = function (host, s) {
    if (!serverMode() || !window.__ptaSiteSource || window.__ptaSiteSource !== "api") return;
    fetch("/api/site-config/" + encodeURIComponent(host), {
      method: "PUT", credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(siteSyncBody(s))
    }).catch(function () {});
  };
  window.__ptaSyncDrop = function (host) {
    if (!serverMode() || window.__ptaSiteSource !== "api") return;
    fetch("/api/site-config/" + encodeURIComponent(host), {
      method: "DELETE", credentials: "same-origin"
    }).catch(function () {});
  };

  function loadSiteCfgFromApi() {
    if (!serverMode()) return Promise.resolve(false);
    return fetch("/api/site-config", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !j.data) return false;
        var store = window.__ptaStore;
        var sites = j.data.sites || {};
        Object.keys(sites).forEach(function (h) {
          store.data.overrides[h] = Object.assign({}, store.data.overrides[h] || {}, sites[h]);
        });
        if (Array.isArray(j.data.hidden)) store.data.hidden = j.data.hidden.slice();
        store.save();
        applySites(lastSiteRecords || siteRecordsFromLocal());
        return true;
      })
      .catch(function () { return false; });
  }
  window.__ptaLoadSiteCfg = loadSiteCfgFromApi;

  applySites(siteRecordsFromLocal());

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg) {
    var t = $("#toast");
    if (!t) { t = el("div", "toast"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }
  /* 通用确认弹窗：模块内任何地方都能用 */
  function ptaConfirm(title, text, onOk) {
    var mask = $("#confirm-modal");
    if (!mask) { if (onOk) onOk(); return; }
    $("#confirm-title").textContent = title || "确认操作";
    $("#confirm-text").textContent = text || "";
    var yes = $("#confirm-yes"), no = $("#confirm-no");
    function close() {
      mask.hidden = true;
      yes.removeEventListener("click", ok);
      no.removeEventListener("click", close);
      mask.removeEventListener("click", backdrop);
    }
    function ok() { close(); if (onOk) onOk(); }
    function backdrop(e) { if (e.target === mask) close(); }
    yes.addEventListener("click", ok);
    no.addEventListener("click", close);
    mask.addEventListener("click", backdrop);
    mask.hidden = false;
  }
  window.PTA = { toast: toast, confirm: ptaConfirm, MOCK: MOCK };

  /* ---------- 站点/目标站 分类映射 ---------- */
  var CATMAP_KEY = "pta.catmap";
  var LIB_CATS = ["电影", "剧集", "综艺", "动漫", "纪录片", "音乐", "体育", "其他"];
  function loadCatMap() {
    try { return JSON.parse(localStorage.getItem(CATMAP_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveCatMap(m) {
    try { localStorage.setItem(CATMAP_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function guessLibCat(name) {
    var n = String(name).toLowerCase();
    if (/tv|series|剧|show|episode/.test(n)) return "剧集";
    if (/综艺|variety/.test(n)) return "综艺";
    if (/anime|动漫/.test(n)) return "动漫";
    if (/doc|纪录/.test(n)) return "纪录片";
    if (/music|音乐|audio|concert|mv|演唱/.test(n)) return "音乐";
    if (/sport|体育/.test(n)) return "体育";
    if (/movie|film|电影|blu|uhd|remux|原盘|disc/.test(n)) return "电影";
    return "其他";
  }
  var ARCH_CATS = {
    NP: ["电影", "剧集", "综艺", "动漫", "纪录片", "音乐", "体育", "MV / 演唱会"],
    UNIT3D: ["Movies", "TV Shows", "Documentaries", "Music", "Sports", "Other"],
    GZ: ["Movies", "Concerts", "Music Videos"],
    OTHER: ["Movies", "TV", "Other"],
    "?": ["Movies", "TV", "Other"]
  };
  function siteCatNames(s) {
    var arch = (s && s.arch) || "?";
    return ARCH_CATS[arch] || ARCH_CATS["?"];
  }
  function catMapCount(host) { return Object.keys(loadCatMap()[host] || {}).length; }

  function openCatMap(opts) {
    var mask = $("#catmap-modal");
    if (!mask) {
      mask = el("div", "modal-mask");
      mask.id = "catmap-modal";
      mask.hidden = true;
      mask.innerHTML = '<div class="modal wide">' +
        '<div class="modal-head"><h2 id="cm-title">分类映射</h2><button class="btn ghost slim" id="cm-x">关闭</button></div>' +
        '<p class="modal-sub" id="cm-sub"></p>' +
        '<div class="cm-list" id="cm-list"></div>' +
        '<div class="modal-foot"><button class="btn ghost slim" id="cm-guess">按名字自动猜</button>' +
          '<div class="spacer"></div>' +
          '<button class="btn ghost slim" id="cm-cancel">取消</button>' +
          '<button class="btn primary slim" id="cm-ok">保存映射</button></div></div>';
      document.body.appendChild(mask);
      mask.addEventListener("click", function (e) { if (e.target === mask) mask.hidden = true; });
      $("#cm-x", mask).addEventListener("click", function () { mask.hidden = true; });
      $("#cm-cancel", mask).addEventListener("click", function () { mask.hidden = true; });
      $("#cm-guess", mask).addEventListener("click", function () {
        $$("#cm-list select", mask).forEach(function (sel) { sel.value = guessLibCat(sel.getAttribute("data-src")); });
      });
      $("#cm-ok", mask).addEventListener("click", function () {
        var m = loadCatMap();
        var map = {};
        $$("#cm-list select", mask).forEach(function (sel) {
          var src = sel.getAttribute("data-src");
          if (sel.value) map[src] = sel.value;
        });
        m[mask._host] = map;
        saveCatMap(m);
        mask.hidden = true;
        toast("已保存 " + Object.keys(map).length + " 条映射");
        if (mask._after) mask._after(map);
      });
    }
    var host = opts.host || "__target__";
    var saved = loadCatMap()[host] || {};
    var names = opts.cats && opts.cats.length ? opts.cats : siteCatNames(null);
    mask._host = host;
    mask._after = opts.after || null;
    $("#cm-title", mask).textContent = "分类映射 · " + (opts.label || host);
    $("#cm-sub", mask).textContent = opts.sub || "站点自己的分类对到库里的分类，没对上的会跳过；只影响收录和发布，不影响请求。";
    $("#cm-list", mask).innerHTML = names.map(function (n) {
      var pick = saved[n] || "";
      var inner = ['<option value="">忽略</option>'].concat(LIB_CATS.map(function (c) {
        return '<option value="' + c + '"' + (c === pick ? " selected" : "") + ">" + c + "</option>";
      })).join("");
      return '<div class="cm-row"><span class="cm-src">' + escapeHtml(n) + "</span>" +
        '<select class="select" data-src="' + escapeHtml(n) + '">' + inner + "</select></div>";
    }).join("");
    mask.hidden = false;
  }
  window.PTA.openCatMap = openCatMap;

  function statusBadge(status) {
    var map = {
      pending: ["待确认", "amber"],
      approved: ["已通过", "green"],
      dupe: ["重复", "gray"],
      failed: ["失败", "red"],
      posted: ["已发布", "blue"]
    };
    var m = map[status] || ["未知", "gray"];
    return '<span class="badge ' + m[1] + '">' + m[0] + "</span>";
  }

  var NAV_ITEMS = [
    { key: "dashboard", label: "总览", href: "#dashboard", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/></svg>" },
    { key: "sites", label: "站点", href: "#sites", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18\"/><path d=\"M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18\"/></svg>" },
    { key: "crawl", label: "流程", href: "#crawl", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 7h16\"/><path d=\"M4 12h10\"/><path d=\"M4 17h6\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/></svg>" },
    { key: "queue", label: "待审核", href: "#queue", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v12\"/><path d=\"M8 11l4 4 4-4\"/><path d=\"M4 21h16\"/></svg>" },
    { key: "sources", label: "数据清单", href: "#sources", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 12h5l2 3h2l2-3h5\"/><path d=\"M5 5h14l2 7v7H3v-7l2-7z\"/></svg>" },
    { key: "logs", label: "日志", href: "#logs", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6h12M9 12h12M9 18h12\"/><path d=\"M4 6h.01M4 12h.01M4 18h.01\"/></svg>" },
    { key: "settings", label: "设置", href: "#settings", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 7h16M4 12h16M4 17h16\"/><circle cx=\"9\" cy=\"7\" r=\"2\"/><circle cx=\"15\" cy=\"12\" r=\"2\"/><circle cx=\"8\" cy=\"17\" r=\"2\"/></svg>" },
  ];

  function initMenu() {
    var btn = $("#menu-btn");
    var menu = $("#menu");
    if (!btn || !menu) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      menu.classList.remove("open");
      if (e.target && e.target.closest && e.target.closest("#menu-logout")) logout();
    });
  }

  /* 导航角标：只有真的有数据才显示 */
  function setNavCount(key, n) {
    var item = document.querySelector('.dock-item[data-view="' + key + '"]');
    if (!item) return;
    var badge = item.querySelector(".dock-count");
    if (!n) { if (badge) badge.remove(); return; }
    if (!badge) { badge = document.createElement("span"); badge.className = "dock-count"; item.appendChild(badge); }
    badge.textContent = n > 99 ? "99+" : String(n);
  }
  window.__ptaSetNavCount = setNavCount;

  function initChrome() {
    var root = $("#dock-root");
    if (root) {
      root.innerHTML = '<nav class="dock">' + NAV_ITEMS.map(function (it) {
        var active = it.key === PAGE ? " active" : "";
        var count = "";
        return '<a class="dock-item' + active + '" href="' + it.href + '" data-view="' + it.key + '" title="' + it.label + '">' + (it.icon || "") + '<span class="dock-label">' + it.label + '</span>' + count + "</a>";
      }).join("") + "</nav>";
    }
    var right = $(".topbar-right");
    if (right && !$("#menu-btn")) {
      var navLinks = NAV_ITEMS.map(function (it) {
        var active = it.key === PAGE ? " active" : "";
        var count = "";
        return '<a class="menu-link' + active + '" href="' + it.href + '" data-view="' + it.key + '">' + it.label + count + "</a>";
      }).join("");
      right.insertAdjacentHTML("beforeend",
        '<div class="menu-wrap">' +
          '<button class="btn menu-btn" id="menu-btn" aria-label="菜单">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
          "</button>" +
          '<div class="menu" id="menu">' + navLinks +
            '<button type="button" class="menu-link menu-logout" id="menu-logout">退出登录</button>' +
          "</div>" +
        "</div>");
    }
  }

  function initNav() {
    var hoverTimer = null;
    document.addEventListener("mouseover", function (e) {
      var a = e.target.closest ? e.target.closest(".dock-item") : null;
      if (!a || a.classList.contains("active")) return;
      var key = a.getAttribute("data-view");
      if (!key || !VIEW_META[key]) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { go(key, { replace: true }); }, 160);
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(".dock-item")) clearTimeout(hoverTimer);
    });
    $$(".nav-item").forEach(function (a) {
      var key = a.getAttribute("data-nav");
      if (key === PAGE) a.classList.add("active");
    });
    var toggle = $("#nav-toggle");
    var sidebar = $(".sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", function () { sidebar.classList.toggle("open"); });
    }
  }

  function renderDashboard() {
    /* 首页数字只用后端真实数据：队列、词条库、本地去重库；没有后端时显示 0，不编造 */
    var ov = window.__ptaOverview;
    var qc = (ov && ov.queue && ov.queue.counts) || {};
    var pending = qc.pending || 0;
    var published = qc.published || 0;
    var fail = qc.rejected || 0;
    var cat = (ov && ov.catalog) || { total: 0, byStatus: {} };
    var lib = (ov && ov.library && ov.library.total) || 0;

    function set(id, v) { var el = $(id); if (el) el.textContent = v; }
    set("#hero-num", String(published));
    set("#hero-delta", "累计已发布");
    set("#stat-month", String(published));
    set("#stat-total", published.toLocaleString());
    set("#stat-db", cat.total.toLocaleString());

    var t = $("#today-stats");
    if (t) {
      t.innerHTML = [
        "词条库 <b>" + cat.total.toLocaleString() + "</b>",
        "待发 <b>" + ((cat.byStatus && cat.byStatus.selected) || 0) + "</b>",
        "已发布 <b>" + published + "</b>",
        "跳过 <b>" + ((cat.byStatus && cat.byStatus.skipped) || 0) + "</b>",
        "本地库 <b>" + lib.toLocaleString() + "</b>",
        "待审核 <b>" + pending + "</b>"
      ].join("　·　");
    }

    renderPending();
    renderPublished();
    renderHealth();

    var lg = $("#dash-logs");
    if (lg) {
      lg.innerHTML = MOCK.logs.slice(0, 4).map(function (l) {
        return '<div class="list-item ' + l.lvl + '"><span class="time">' + l.t + '</span><span class="msg">' + escapeHtml(l.msg) + "</span></div>";
      }).join("");
    }
    return { pending: pending, pub: published, fail: fail };
  }

  function kpi(label, value, delta, cls) {
    return '<div class="kpi"><div class="label">' + label + '</div><div class="value">' + value +
      '</div><div class="delta ' + (cls || "") + '">' + delta + "</div></div>";
  }

  function paintDashLogs() {
    var lg = $("#dash-logs");
    if (!lg) return;
    if (!MOCK.logs.length) {
      lg.innerHTML = '<div class="dash-log-empty">还没有日志，连上后端后这里会实时刷新</div>';
      return;
    }
    lg.innerHTML = MOCK.logs.slice(0, 4).map(function (l) {
      return '<div class="list-item ' + l.lvl + '"><span class="time">' + l.t + '</span><span class="msg">' + escapeHtml(l.msg) + "</span></div>";
    }).join("");
  }

  function renderTodos() {
    var host = $("#dash-todos");
    if (!host) return;
    host.innerHTML = MOCK.todos.map(function (t) {
      return '<a class="list-item todo-item" href="' + t.href + '">' +
        '<span class="dot ' + (t.level || "") + '" style="align-self:center"></span>' +
        '<div style="flex:1;min-width:0"><div class="t-main">' + escapeHtml(t.title) + "</div>" +
        '<div class="t-sub">' + escapeHtml(t.desc) + "</div></div>" +
        '<span class="btn sm ghost">' + escapeHtml(t.action) + "</span></a>";
    }).join("");
  }

  function renderTrend(range) {
    var host = $("#trend-chart");
    if (!host) return;
    var d = MOCK.trend[range] || MOCK.trend.week;
    var max = Math.max.apply(null, d.values) || 1;
    host.innerHTML = d.values.map(function (v, i) {
      var label = d.labels && d.labels[i] ? "周" + d.labels[i] : "第 " + (i + 1) + " 天";
      return '<div class="chart-col" title="' + label + "：" + v + ' 部"><i style="height:' +
        Math.max(4, Math.round(v / max * 100)) + '%"></i></div>';
    }).join("");
    var lab = $("#trend-labels");
    if (lab) {
      lab.innerHTML = d.labels && d.labels.length ? d.labels.map(function (x) {
        return "<span>" + escapeHtml(x) + "</span>";
      }).join("") : "";
      lab.style.display = d.labels && d.labels.length ? "flex" : "none";
    }
    var total = d.values.reduce(function (a, b) { return a + b; }, 0);
    var tot = $("#trend-total");
    if (tot) tot.textContent = "共 " + total + " 部";
    var seg = $("#trend-range");
    if (seg && !seg._bound) {
      seg._bound = true;
      $$("a", seg).forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          $$("a", seg).forEach(function (x) { x.classList.remove("active"); });
          a.classList.add("active");
          renderTrend(a.getAttribute("data-range"));
        });
      });
    }
  }

  window.__ptaPaintHealth = function () { renderDashboard(); renderSiteHealth(); renderNodeCapacity(); };

  function fmtBytes(n) {
    var v = Number(n) || 0;
    if (!v) return "";
    var u = ["B", "KB", "MB", "GB", "TB", "PB"], i = 0;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + " " + u[i];
  }

  /* 系统状态用的都是后端真实数据：站点数来自清单，登录结果来自自检记录，磁盘余量来自下载器探测 */
  function renderHealth() {
    var host = $("#health-strip");
    if (!host) return;
    var o = window.__ptaOverview;
    var loginOk = o ? o.sites.loginOk : 0;
    var enabled = o ? o.sites.enabled : 0;
    var loginFail = o ? o.sites.loginFail : 0;
    var unchecked = o ? o.sites.loginUnknown : 0;
    var dls = o ? o.downloaders : null;
    var free = dls ? fmtBytes(dls.freeSpace) : "";
    var list = [
      { label: "登录失效", value: String(loginFail), warn: loginFail > 0 },
      { label: "还没自检", value: String(unchecked), warn: false },
      { label: "下载器在线", value: dls ? (dls.online + " / " + dls.total) : "—", warn: !!(dls && dls.total && dls.online < dls.total) },
      { label: "磁盘余量", value: free || (dls && dls.total ? "未知" : "未接下载器"), warn: !!(dls && dls.total && !free) }
    ];
    host.innerHTML =
      '<div class="status-hero"><span>登录正常</span><b class="' + (loginFail ? "warn" : "") + '">' +
      loginOk + "</b><i>共启用 " + enabled + " 个" + (o ? "" : "（未连接后端）") + "</i></div>" +
      '<div class="status-list">' + list.map(function (it) {
        return '<div class="hstat' + (it.warn ? " warn" : "") + '"><span>' + it.label + "</span><b>" + it.value + "</b></div>";
      }).join("") + "</div>";
  }

  function renderSiteHealth() {
    var host = $("#site-health");
    var bars = $("#site-bars");
    if (!host) return;
    var o = window.__ptaOverview;
    var s = o ? o.sites : { total: 0, enabled: 0, loginOk: 0, loginFail: 0, loginUnknown: 0 };
    host.innerHTML =
      '<div class="mini"><span>已启用</span><b>' + s.enabled + " / " + s.total + "</b></div>" +
      '<div class="mini"><span>登录正常</span><b>' + s.loginOk + "</b></div>" +
      '<div class="mini' + (s.loginFail ? " warn" : "") + '"><span>登录失效</span><b>' + s.loginFail + "</b></div>" +
      '<div class="mini"><span>还没自检</span><b>' + s.loginUnknown + "</b></div>";
    if (bars) {
      var counts = window.__ptaSiteCounts || null;
      var np = counts && counts.NP ? counts.NP : 0;
      var u3d = counts && counts.UNIT3D ? counts.UNIT3D : 0;
      var sum = np + u3d;
      bars.innerHTML =
        '<div class="arch-bar"><i style="width:' + (sum ? Math.round(np / sum * 100) : 0) + '%"></i>' +
        '<i class="u3d" style="width:' + (sum ? Math.round(u3d / sum * 100) : 0) + '%"></i></div>' +
        '<div class="arch-legend">NexusPHP ' + np + " · UNIT3D " + u3d + "</div>";
    }
  }

  function renderNodeCapacity() {
    var host = $("#dash-nodes");
    if (!host) return;
    var o = window.__ptaOverview;
    var d = o ? o.downloaders : null;
    if (!d || !d.total) {
      host.innerHTML = '<div class="node-sum-line"><span>未接下载器</span><span class="mono">—</span></div>' +
        '<div class="progress" style="margin-top:8px"><i style="width:0%"></i></div>';
      return;
    }
    var free = fmtBytes(d.freeSpace) || "未知";
    host.innerHTML =
      '<div class="node-sum-line"><span>' + d.online + " / " + d.total + " 在线" + (d.version ? " · " + escapeHtml(d.version) : "") + "</span>" +
      '<span class="mono">剩余 ' + free + "</span></div>" +
      '<div class="progress" style="margin-top:8px"><i style="width:' + (d.total ? Math.round(d.online / d.total * 100) : 0) + '%"></i></div>';
  }

  function renderRecentSources() {
    var host = $("#dash-recent");
    if (!host) return;
    host.innerHTML = MOCK.sources.slice(0, 3).map(function (it) {
      return '<div class="list-item"><div style="flex:1;min-width:0">' +
        '<div class="t-main">' + escapeHtml(it.title) + '</div>' +
        '<div class="t-sub">' + escapeHtml(it.res) + " · " + escapeHtml(it.size) + " · " + escapeHtml(it.time) + "</div></div></div>";
    }).join("");
  }

  function renderPending() {
    var host = $("#dash-pending");
    if (!host) return;
    var rows = MOCK.queue.filter(function (it) { return it.status === "pending"; }).slice(0, 3);
    host.innerHTML = rows.map(function (it) {
      return '<div class="list-item"><div style="flex:1;min-width:0">' +
        '<div class="t-main">' + escapeHtml(it.cn || it.title) + '</div>' +
        '<div class="t-sub">' + escapeHtml(it.res) + " · " + escapeHtml(it.size) + " · " + escapeHtml(it.site) + "</div></div>" +
        '<a class="btn ghost sm" href="queue.html">审核</a></div>';
    }).join("") || '<div class="empty">没有待审核的条目</div>';
  }

  function renderPublished() {
    var host = $("#dash-published");
    if (!host) return;
    host.innerHTML = MOCK.published.slice(0, 3).map(function (p) {
      return '<div class="list-item">' +
        '<div style="flex:1;min-width:0"><div class="t-main">' + escapeHtml(p.cn || p.title) + "（" + escapeHtml(p.title) + "）</div>" +
        '<div class="t-sub">' + escapeHtml(p.site) + " · " + escapeHtml(p.size) + "</div></div>" +
        '<span class="t-sub">' + escapeHtml(p.time) + '</span><span class="badge green">成功</span></div>';
    }).join("");
  }

  function initQueue() {
    var listBox = $("#queue-items");
    var detail = $("#queue-detail");
    if (!listBox) return;

    var state = { tab: "all", q: "", sel: null };
    MOCK.queue.forEach(function (x) { x.id = String(x.id); });
    var STATUS = {
      pending: ["待确认", "amber"],
      approved: ["已通过", "green"],
      dupe: ["重复", "amber"],
      failed: ["失败", "red"],
      publishing: ["发布中", "blue"],
      published: ["已发布", "green"]
    };

    function rows() {
      return MOCK.queue.filter(function (it) {
        if (state.tab === "pending" && it.status !== "pending") return false;
        if (state.tab === "approved" && it.status !== "approved" && it.status !== "published") return false;
        if (state.tab === "failed" && it.status !== "failed") return false;
        if (state.q && ((it.cn || "") + " " + it.title).toLowerCase().indexOf(state.q) === -1) return false;
        return true;
      });
    }

    function itemHtml(it) {
      var st = STATUS[it.status] || ["未知", "gray"];
      return '<button class="q-item' + (state.sel === it.id ? " on" : "") + '" data-id="' + it.id + '">' +
        '<span class="q-title"><b>' + escapeHtml(it.cn || it.title) + "</b>" +
          "<i>" + escapeHtml(it.res) + " · " + escapeHtml(it.size) + "</i></span>" +
        '<span class="badge ' + st[1] + '">' + st[0] + "</span>" +
      "</button>";
    }

    function shotHtml(it, n) {
      var shot = it && it.shots ? it.shots[n - 1] : null;
      if (shot) return '<div class="shot has"><img src="' + shot.url + '" alt=""><span>' + n + "</span></div>";
      return '<div class="shot"><span>' + n + "</span></div>";
    }

    function subParts(it) {
      var t = it.title || "";
      var regions = { HKG: "港版", AUS: "澳版", USA: "美版", JPN: "日版", KOR: "韩版",
        FRA: "法版", GER: "德版", ITA: "意版", ESP: "西版", TWN: "台版", CHN: "国版", UK: "英版" };
      var mR = t.match(/\b(HKG|AUS|USA|JPN|KOR|FRA|GER|ITA|ESP|TWN|CHN|UK)\b/);
      var mA = t.match(/(TrueHD|DTS-HD MA|DTS|LPCM|AC3|FLAC|EAC3)\s*([\d.]+)?/);
      return { region: mR ? regions[mR[1]] : "", audio: mA ? (mA[1] + (mA[2] ? " " + mA[2] : "")) : "" };
    }

    function subTitle(it) {
      var p2 = subParts(it);
      return [p2.region ? p2.region + "原盘" : "原盘", p2.audio, "中文字幕"].filter(Boolean).join(" | ");
    }

    function introText(it) {
      var p2 = subParts(it);
      var tail = [p2.audio, "中文字幕"].filter(Boolean).join("，");
      return (it.cn || it.title) + "（" + it.year + "）" + it.res + " 原盘，" + tail + "。";
    }

    function detailHtml(it) {
      if (!it) return '<div class="sites-empty">选一条看发布预览</div>';
      var st = STATUS[it.status] || ["未知", "gray"];
      var titleTpl = (it.cn ? it.cn + " " : "") + it.title.replace(/\s+/g, " ").trim();
      return '<div class="qd-head">' +
          '<div class="qd-id"><div class="qd-title-row"><h2>' + escapeHtml(it.cn || it.title) + "</h2>" +
            '<span class="badge ' + st[1] + '">' + st[0] + "</span></div>" +
            '<span class="sd-url">' + escapeHtml(it.title) + "</span></div>" +
          '<div class="qd-meta">' +
            "<span>站点<b>" + escapeHtml(it.site) + "</b></span>" +
            "<span>分辨率<b>" + escapeHtml(it.res) + "</b></span>" +
            "<span>大小<b>" + escapeHtml(it.size) + "</b></span>" +
            "<span>年份<b>" + it.year + " · " + escapeHtml(it.imdb) + "</b></span>" +
          "</div>" +
        "</div>" +
        '<div class="qd-grid">' +
          '<section class="sd-card qd-pubinfo"><h3>发布信息</h3>' +
            '<div class="qd-field"><span>标题</span><input class="input" id="qd-title" value="' + escapeHtml(titleTpl) + '"></div>' +
            '<div class="qd-field"><span>副标题</span><input class="input" id="qd-sub" value="' + escapeHtml(subTitle(it)) + '"></div>' +
            '<div class="qd-field"><span>查重</span><b class="' + (it.checkCls || "") + '-t">' + escapeHtml(it.check) + "</b></div>" +
          "</section>" +
          '<section class="sd-card qd-desc-card"><h3>简介</h3>' +
            '<textarea class="input sd-note" id="qd-desc" rows="3">' +
              escapeHtml(introText(it)) + "</textarea>" +
          "</section>" +
          '<section class="sd-card qd-shots"><h3>截图</h3>' +
            '<div class="shots">' + shotHtml(it, 1) + shotHtml(it, 2) + shotHtml(it, 3) +
              '<button class="shot add" id="qd-addshot">上传</button></div>' +
          "</section>" +
        "</div>" +
        "</div>" +
        (it.status === "publishing"
          ? '<div class="qd-status warn">正在发布到主站…</div>'
          : it.pubMsg
            ? '<div class="qd-status ' + (it.status === "failed" ? "bad" : "ok") + '">' + escapeHtml(it.pubMsg) + "</div>"
            : "") +
        '<div class="qd-actions">' +
          (it.status === "failed"
            ? '<button class="btn primary slim" data-qact="retry">重试发布</button>'
            : '<button class="btn primary slim" data-qact="publish">通过并发布</button>') +
          '<button class="btn ghost slim" data-qact="reject">驳回</button>' +
          '<button class="btn ghost slim" data-qact="draft">草稿预览</button>' +
          '<div class="spacer"></div>' +
          '<input class="input slim" id="qd-reason" placeholder="驳回理由（可留空）" style="width:200px">' +
          '<button class="btn ghost slim" data-qact="skip">跳过</button>' +
        "</div>";
    }

    function paint() {
      var list = rows();
      if (!list.some(function (x) { return x.id === state.sel; })) {
        state.sel = list.length ? list[0].id : null;
      }
      listBox.innerHTML = list.map(itemHtml).join("") || '<div class="sites-empty">没有匹配的条目</div>';
      var cnt = $("#queue-count");
      if (cnt) cnt.textContent = "共 " + list.length + " 条";
      var it = MOCK.queue.filter(function (x) { return x.id === state.sel; })[0];
      if (detail) detail.innerHTML = detailHtml(it);
    }

    listBox.addEventListener("click", function (e) {
      var b = e.target.closest(".q-item");
      if (!b) return;
      state.sel = b.getAttribute("data-id");
      paint();
    });

    var tabs = $("#queue-tabs");
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-qtab]");
      if (!b) return;
      state.tab = b.getAttribute("data-qtab");
      $$("button", tabs).forEach(function (x) { x.classList.toggle("active", x === b); });
      paint();
    });

    var q = $("#queue-q");
    if (q) q.addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); paint(); });

    var filePick = el("input");
    filePick.type = "file"; filePick.accept = "image/*"; filePick.multiple = true; filePick.style.display = "none";
    document.body.appendChild(filePick);
    filePick.addEventListener("change", function () {
      var it = MOCK.queue.filter(function (x) { return x.id === state.sel; })[0];
      var files = [].slice.call(filePick.files || []);
      if (!it || !files.length) return;
      it.shots = it.shots || [];
      var left = files.length;
      files.slice(0, 3).forEach(function (f) {
        var rd = new FileReader();
        rd.onload = function () {
          it.shots.push({ name: f.name, url: String(rd.result) });
          if (--left <= 0) { paint(); toast("已加入 " + it.shots.length + " 张截图"); }
        };
        rd.readAsDataURL(f);
      });
      filePick.value = "";
    });

    var bulk = $("#q-bulkcheck");
    if (bulk) bulk.addEventListener("click", function () {
      var list = rows().filter(function (x) { return x.status === "pending" || x.status === "approved"; });
      if (!list.length) { toast("当前列表没有可查重的条目"); return; }
      /* 有后端就走服务端查重（只比本地库和队列里的条目，不联网） */
      if (window.__ptaQueue && list[0].server && /^https?:$/.test(location.protocol)) {
        bulk.disabled = true;
        bulk.textContent = "查重中 0/" + list.length;
        var done = 0, dup = 0;
        var step = function () {
          var it = list[done];
          if (!it) {
            bulk.disabled = false;
            bulk.textContent = "批量查重";
            toast("查重完成：" + list.length + " 条，重复 " + dup + " 条");
            if (loadServer) loadServer();
            return;
          }
          window.__ptaQueue.req("/" + encodeURIComponent(it.id) + "/check", "POST").then(function (res) {
            if (res && res.j && res.j.ok && res.j.data && res.j.data.duplicate) dup++;
            done++;
            bulk.textContent = "查重中 " + done + "/" + list.length;
            step();
          });
        };
        step();
        return;
      }
      bulk.disabled = true;
      bulk.textContent = "查重中 0/" + list.length;
      var i = 0, dup = 0;
      var timer = setInterval(function () {
        var it = list[i++];
        if (it) {
          var hit = (it.id + i) % 3 === 0;
          it.check = hit ? "已有同片 · 目标站" : "无重复";
          it.checkCls = hit ? "amber" : "green";
          if (hit) dup++;
          bulk.textContent = "查重中 " + i + "/" + list.length;
          paint();
        }
        if (i >= list.length) {
          clearInterval(timer);
          bulk.disabled = false;
          bulk.textContent = "批量查重";
          toast("查重完成：" + list.length + " 条，重复 " + dup + " 条");
        }
      }, 240);
    });

    if (detail) detail.addEventListener("click", function (e) {
      if (e.target.closest("#qd-addshot")) { filePick.click(); return; }
      var b = e.target.closest("button[data-qact]");
      if (!b) return;
      var it = MOCK.queue.filter(function (x) { return x.id === state.sel; })[0];
      if (!it) return;
      var act = b.getAttribute("data-qact");
      if (act === "draft" && it.server) {
        /* 用后端组装草稿：标题/副标题/简介/标签/缺项提醒 */
        fetch("/api/publish/preview?id=" + encodeURIComponent(it.id), { credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j || !j.ok) { toast((j && j.error && j.error.message) || "草稿生成失败"); return; }
            var d = j.data;
            if ($("#qd-title")) $("#qd-title").value = d.title;
            if ($("#qd-sub")) $("#qd-sub").value = d.subtitle;
            if ($("#qd-desc")) $("#qd-desc").value = d.intro;
            toast(d.ready ? "草稿齐了，可以直接发" : "草稿有缺项：" + d.warnings.join(" · "));
          })
          .catch(function () { toast("草稿请求发不出去"); });
        return;
      }
      if (it.server) {
        if (act === "skip") {
          toast("已跳过：" + (it.cn || it.title));
          var ns = rows().filter(function (x) { return x.status === "pending" && x.id !== it.id; })[0];
          state.sel = ns ? ns.id : it.id;
          paint();
          return;
        }
        if (act === "reject") {
          var rs = $("#qd-reason") ? $("#qd-reason").value.trim() : "";
          if (!rs) { toast("驳回要写理由"); return; }
          window.__ptaQueue.req("/" + encodeURIComponent(it.id) + "/action", "POST", { action: "reject", reason: rs })
            .then(function (res) {
              toast(res && res.j && res.j.ok ? "已驳回：" + (it.cn || it.title)
                : (res && res.j && res.j.error && res.j.error.message) || "驳回失败");
              return loadServer();
            });
          return;
        }
        var seq = it.status === "pending" ? ["approve", "publish"] : ["publish"];
        it.status = "publishing";
        paint();
        var chain = Promise.resolve(null);
        seq.forEach(function (a) {
          chain = chain.then(function () {
            return window.__ptaQueue.req("/" + encodeURIComponent(it.id) + "/action", "POST", { action: a });
          });
        });
        chain.then(function (res) {
          var ok = res && res.j && res.j.ok;
          toast(ok ? "已发布：" + (it.cn || it.title)
            : (res && res.j && res.j.error && res.j.error.message) || "发布失败");
          return loadServer();
        });
        return;
      }
      if (act === "publish" || act === "retry") {
        it.status = "publishing";
        it.pubMsg = "";
        paint();
        setTimeout(function () {
          var fail = it.id === 106 || it.id === 103;
          it.status = fail ? "failed" : "published";
          it.pubMsg = fail ? "主站返回 502，自动重试 2 次仍失败" : "已发布 · 种子 #8842" + (it.id % 100);
          toast(fail ? "发布失败：" + (it.cn || it.title) : "已发布：" + (it.cn || it.title));
          if (!fail) {
            var next = MOCK.queue.filter(function (x) { return x.status === "pending"; })[0];
            if (next) state.sel = next.id;
          }
          paint();
        }, 1100);
      } else if (act === "reject") {
        var r = $("#qd-reason") ? $("#qd-reason").value.trim() : "";
        it.status = "failed";
        it.rejectReason = r;
        it.pubMsg = "已驳回" + (r ? "：" + r : "（未填理由）");
        toast("已驳回" + (r ? "：" + r : ""));
        var n2 = rows().filter(function (x) { return x.status === "pending"; })[0];
        state.sel = n2 ? n2.id : it.id;
      } else if (act === "skip") {
        toast("已跳过：" + (it.cn || it.title));
        var n3 = rows().filter(function (x) { return x.status === "pending" && x.id !== it.id; })[0];
        state.sel = n3 ? n3.id : it.id;
      }
      paint();
    });

    function loadServer() {
      return window.__ptaQueue.req("?limit=200").then(function (res) {
        if (!res || !res.j || !res.j.ok || !res.j.data || !Array.isArray(res.j.data.items)) return false;
        MOCK.queue = res.j.data.items.map(window.__ptaQueue.map);
        var pendingN = (res.j.data.counts && res.j.data.counts.pending) || 0;
        window.__ptaQueueCounts = res.j.data.counts || null;
        if (window.__ptaPaintTopbar) window.__ptaPaintTopbar();
        if (window.__ptaSetNavCount) window.__ptaSetNavCount("queue", pendingN);
        var allLink = $("#dash-pending-all");
        if (allLink) allLink.textContent = pendingN ? "全部 " + pendingN : "全部";
        if (state.sel && !MOCK.queue.some(function (x) { return x.id === state.sel; })) state.sel = null;
        paint();
        return true;
      });
    }
    window.__ptaLoadQueue = loadServer;
    window.__ptaRepaintQueue = paint;

    paint();
    window.__ptaRepaintQueue = paint;
    loadServer();
  }

  function initSources() {
    var body = $("#dl-body");
    if (!body) return;
    var state = { q: "" };

    function paint() {
      var rows = MOCK.sources.filter(function (it) {
        if (state.q && (it.title + " " + it.res).toLowerCase().indexOf(state.q) === -1) return false;
        return true;
      });
      body.innerHTML = rows.map(function (it) {
        return '<div class="dl-row">' +
          '<span class="dl-title"><b>' + escapeHtml(it.title) + "</b></span>" +
          '<span><em class="chip np">' + escapeHtml(it.type) + "</em></span>" +
          '<span class="soft">' + escapeHtml(it.res) + "</span>" +
          '<span class="soft">' + escapeHtml(it.size) + "</span>" +
          '<span class="soft">' + escapeHtml(it.time) + "</span>" +
          '<span><span class="badge ' + (it.checkCls === "green" ? "green" : it.checkCls === "red" ? "red" : "amber") + '">' + escapeHtml(it.check) + "</span></span>" +
          '<span class="ta-r"><button class="link-btn" data-archive="1">归档</button></span>' +
        "</div>";
      }).join("") || '<div class="sites-empty">' +
        (MOCK.sources.length ? "没有匹配的条目" : "还没有拉取到数据，抓取执行器接上真实站点后这里才会有内容") + "</div>";
      var c = $("#dl-count");
      if (c) c.textContent = rows.length;
    }

    window.__ptaRepaintSources = paint;
    var q = $("#dl-q");
    if (q) q.addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); paint(); });
    body.addEventListener("click", function (e) {
      var arc = e.target.closest("button[data-archive]");
      if (!arc) return;
      var row = arc.closest(".dl-row");
      var title = row ? row.querySelector(".dl-title b").textContent : "";
      var it = MOCK.sources.filter(function (x) { return x.title === title; })[0];
      if (it) it.archived = true;
      if (row) {
        row.classList.add("is-archived");
        arc.textContent = "已归档";
        arc.disabled = true;
      }
      toast("已归档：" + title);
    });
    var crawl = $("#dl-crawl");
    if (crawl) {
      var selSite = $("#dl-site");
      if (selSite && MOCK.sitesList.length) {
        var onSites = MOCK.sitesList.filter(function (x) { return x.enabled; }).slice(0, 30);
        if (onSites.length) {
          selSite.innerHTML = '<option value="">全部站点</option>' + onSites.map(function (s) {
            return '<option value="' + escapeHtml(s.name) + '">' + escapeHtml(s.title || s.name) + "</option>";
          }).join("");
        }
      }
      var dryBox = null;
      function paintDry(t) {
        var bar = $(".dl-bar");
        if (!dryBox) {
          dryBox = el("div", "dl-dry");
          if (bar && bar.parentNode) bar.parentNode.insertBefore(dryBox, bar.nextSibling);
          else if (body && body.parentNode) body.parentNode.insertBefore(dryBox, body);
        }
        dryBox.hidden = false;
        dryBox.innerHTML = '<div class="dl-dry-head"><b>干跑 · ' + escapeHtml(t.siteHost) + "</b>" +
            '<span class="dl-dry-p">' + (t.progress || 0) + "%</span></div>" +
          "<ul>" + (t.steps || []).map(function (s) {
            return '<li class="' + (s.state === "done" ? "done" : "wait") + '"><i></i>' + escapeHtml(s.name) + "</li>";
          }).join("") + "</ul>" +
          '<em>只跑本地步骤，不访问任何真实站点</em>' +
          (t.state === "done" && t.result ? (function () {
            var p = t.result.plan || {};
            var warns = (t.result.warnings || []).map(function (w) { return "<li>" + escapeHtml(w) + "</li>"; }).join("");
            return '<div class="dl-dry-note">计划：' + (p.pages || "-") + " 页 · 分类 " + (p.catGroups || 0) + " 组 · 预估 " +
              (p.estimatedQueries || 0) + " 次查询</div>" + (warns ? '<ul class="dl-dry-warn">' + warns + "</ul>" : "");
          })() : "");
      }
      function pickDryHost() {
        var want = selSite && selSite.value;
        if (want && MOCK.sitesList.some(function (x) { return x.name === want; })) return want;
        var t0 = null;
        try { t0 = localStorage.getItem("pta.target"); } catch (e) {}
        if (t0 && MOCK.sitesList.some(function (x) { return x.name === t0; })) return t0;
        var first = MOCK.sitesList[0];
        return first ? first.name : "";
      }
      crawl.addEventListener("click", function () {
        var siteHost = pickDryHost();
        if (!siteHost) { toast("没有可用站点，先去站点页添加"); return; }
        var submitted = false;
        window.__ptaDryRun(siteHost, function (t) {
          paintDry(t);
          if (!submitted) { submitted = true; toast("已提交干跑任务"); }
        }, function (t) {
          toast("干跑完成 · " + (t.steps || []).length + " 步");
        }, function (msg) {
          toast(msg);
        });
      });
    }
    var ex = $("#dl-export");
    if (ex) ex.addEventListener("click", function () {
      var data = JSON.stringify(MOCK.sources, null, 2);
      var url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      var a = document.createElement("a");
      a.href = url;
      a.download = "pta-sources.json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast("已导出 " + MOCK.sources.length + " 条");
    });
    paint();
  }

  function initNodes() {
    var host = $("#nodes-grid");
    if (!host) return;

    function storage() {
      /* 本地假节点已经废弃：下载器一律以服务端为准，旧的 localStorage 直接清掉 */
      try { localStorage.removeItem("pta.nodes"); } catch (e) {}
      MOCK.nodes = [];
    }
    function save() {
      try { localStorage.setItem("pta.nodes", JSON.stringify(MOCK.nodes)); } catch (e) {}
    }
    storage();

    /* 服务端已有的下载器合并进列表（密码只回 hasPass） */
    function loadServer() {
      return window.__ptaDl.req("").then(function (res) {
        if (!res || !res.j || !res.j.ok || !Array.isArray(res.j.data)) return false;
        var ids = {};
        res.j.data.forEach(function (d) { ids[d.id] = 1; });
        /* 服务端删掉的下载器，本地列表也要清掉，不留假节点 */
        MOCK.nodes = MOCK.nodes.filter(function (x) { return x.serverId && ids[x.serverId]; });
        res.j.data.forEach(function (d) {
          var h = String(d.url || "").replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
          var lp = d.lastProbe || null;
          var free = lp && lp.freeSpace ? lp.freeSpace : 0;
          var nd = MOCK.nodes.filter(function (x) { return x.serverId === d.id || x.name === d.name; })[0];
          if (!nd) {
            nd = { name: d.name || h, role: "下载 / 做种", host: h, online: false,
              disk: "—", used: 0, total: 0, qb: "—", seeding: "—", path: lp && lp.savePath ? lp.savePath : "/data/pt" };
            MOCK.nodes.push(nd);
          }
          nd.serverId = d.id;
          nd.qbUrl = d.url;
          nd.host = h;
          nd.qbUser = d.user || "";
          nd.hasPass = !!d.hasPass;
          nd.disableAuth = !!d.disableAuth;
          nd.online = !!(lp && lp.pass);
          nd.qb = (lp && lp.version) || "—";
          nd.freeSpace = free;
          nd.disk = free ? fmtBytes(free) + " 剩余" : "—";
          nd.probedAt = lp && lp.at ? lp.at : "";
          if (lp && lp.savePath) nd.path = lp.savePath;
        });
        save();
        paint();
        window.__ptaDownloaderCount = res.j.data.length;
        if (window.__ptaPaintTopbar) window.__ptaPaintTopbar();
        return true;
      });
    }
    window.__ptaLoadDownloaders = loadServer;

    function pushNode(nd) {
      if (!nd || !window.__ptaDl || !/^https?:$/.test(location.protocol)) return;
      var body = {
        name: nd.name,
        url: nd.qbUrl || ("http://" + nd.host + ":8080"),
        user: nd.qbUser || "",
        disableAuth: !!nd.disableAuth
      };
      if (nd.qbPass) body.pass = nd.qbPass;
      var p = nd.serverId
        ? window.__ptaDl.req("/" + encodeURIComponent(nd.serverId), "PUT", body)
        : window.__ptaDl.req("", "POST", body);
      p.then(function (res) {
        if (res && res.j && res.j.ok) {
          nd.serverId = res.j.data.id;
          nd.qbUrl = res.j.data.url;
          nd.hasPass = !!res.j.data.hasPass;
          save();
          toast("已保存到服务端：" + nd.name);
        } else {
          toast((res && res.j && res.j.error && res.j.error.message) || "服务端没写进去，已存在本地");
        }
      });
    }

    function paint() {
      var nodes = MOCK.nodes;
      var workers = nodes.slice(0);
      var onlineAll = nodes.filter(function (n) { return n.online; }).length;
      var freeAll = workers.reduce(function (a, n) { return a + (Number(n.freeSpace) || 0); }, 0);

      var sub = $("#nodes-bar-sub");
      if (sub) sub.textContent = nodes.length ? "共 " + nodes.length + " 台" : "还没接下载器";
      var meta = $("#nodes-drawer-meta");
      if (meta) meta.textContent = nodes.length
        ? (onlineAll + " / " + nodes.length + " 在线" + (freeAll ? " · 余量 " + fmtBytes(freeAll) : ""))
        : "还没有下载器";

      if (!nodes.length) {
        host.innerHTML = '<div class="empty">还没有下载器，点右上角「添加下载器」，填 qBittorrent 的地址和账号密码。</div>';
        return;
      }
      host.innerHTML = nodes.map(function (nd, i) {
        var isCtrl = nd.role && nd.role.indexOf("编排") === 0;
        var pct = 0;
        if (isCtrl) {
          var m = String(nd.disk).match(/([\d.]+)\s*\/\s*([\d.]+)/);
          if (m) pct = parseFloat(m[1]) / parseFloat(m[2]) * 100;
        } else if (nd.total) {
          pct = nd.used / nd.total * 100;
        }
        var tone = !nd.online ? "off" : pct > 85 ? "warn" : "ok";
        return '<div class="node-row ' + tone + '">' +
          '<div class="nr-name"><b>' + escapeHtml(nd.name) + "</b>" +
            (isCtrl ? '<span class="nr-tag">控制机</span>' : "") + "</div>" +
          '<div class="nr-host mono">' + escapeHtml(nd.host) + "</div>" +
          '<div class="nr-disk"><span class="nr-cap">' + escapeHtml(nd.disk) + "</span>" +
            '<div class="nr-bar"><i style="width:' + Math.max(3, Math.min(100, pct)).toFixed(0) + '%"></i></div>' +
            '<span class="nr-pct">' + (pct ? pct.toFixed(0) + "%" : "—") + "</span></div>" +
          (nd.online ? '<span class="badge green">在线</span>' : '<span class="badge red">离线</span>') +
          '<button class="link-btn nr-set" data-nset="' + i + '">设置</button>' +
        "</div>";
      }).join("");
    }

    /* ---- 设置弹窗 ---- */
    var mask = $("#node-modal");
    var editing = -1;
    var CAT_POOL = ["原盘", "Remux", "1080p", "2160p", "剧集", "动漫", "音乐", "综艺", "纪录", "体育"];
    function catsFromNode(nd) {
      var seed = hashStr((nd && (nd.host || nd.name)) || "qb");
      var n = 3 + (seed % 4);
      var off = seed % CAT_POOL.length;
      var out = [];
      for (var i = 0; i < CAT_POOL.length && out.length < n; i++) {
        var name = CAT_POOL[(off + i * 3) % CAT_POOL.length];
        out.push([name, 12 + ((seed >>> (i * 5 + 1)) % 400)]);
      }
      out.sort(function (a, b) { return b[1] - a[1]; });
      return out;
    }
    var curCats = [];
    var curCat = "";

    function renderCats() {
      var list = $("#nd-cat-list");
      var st = $("#nd-cat-status");
      if (!list) return;
      if (!curCats.length) {
        list.innerHTML = "";
        if (st) st.textContent = "未拉取";
        return;
      }
      if (st) st.textContent = "已拉取 " + curCats.length + " 个";
      list.innerHTML = curCats.map(function (c) {
        return '<button type="button" class="cat-chip' + (c[0] === curCat ? " on" : "") + '" data-ndcat="' + escapeHtml(c[0]) + '">' +
          escapeHtml(c[0]) + '<i>' + c[1] + "</i></button>";
      }).join("");
    }
    function openModal(i) {
      editing = i;
      var nd = i >= 0 ? MOCK.nodes[i] : null;
      $("#node-modal-title").textContent = nd ? "下载器设置" : "新增下载器";
      $("#nd-name").value = nd ? nd.name : "";
      $("#nd-host").value = nd ? nd.host : "";
      $("#nd-qb").value = nd ? (nd.qbUrl || ("http://" + nd.host + ":8080")) : "";
      $("#nd-user").value = nd && nd.qbUser ? nd.qbUser : "";
      $("#nd-pass").value = nd && nd.qbPass ? nd.qbPass : "";
      $("#nd-down").value = nd && nd.maxDown ? nd.maxDown : "3";
      $("#nd-seed").value = nd && nd.seedLimit ? nd.seedLimit : "500";
      $("#nd-dllimit").value = nd && nd.dlLimit ? nd.dlLimit : "不限";
      $("#nd-ullimit").value = nd && nd.ulLimit ? nd.ulLimit : "不限";
      $("#nd-ratio").value = nd && nd.ratioDel ? nd.ratioDel : "2.0";
      $("#nd-days").value = nd && nd.seedDays ? nd.seedDays : "30";
      $("#nd-path").value = nd && nd.dlPath ? nd.dlPath : "/data/pt";
      $("#nd-lowdisk").value = nd && nd.lowDisk ? nd.lowDisk : "50 GB";
      curCats = nd && nd.cats ? nd.cats : [];
      curCat = nd && nd.cat ? nd.cat : "";
      renderCats();
      $("#node-del").style.display = nd ? "" : "none";
      mask.hidden = false;
      setTimeout(function () { $("#nd-name").focus(); }, 30);
    }
    function closeModal() { mask.hidden = true; }

    if (mask) {
      $("#node-add") && $("#node-add").addEventListener("click", function () { openModal(-1); });
      $("#node-cancel").addEventListener("click", closeModal);
      mask.addEventListener("click", function (e) { if (e.target === mask) closeModal(); });

      $("#node-ok").addEventListener("click", function () {
        var name = $("#nd-name").value.trim();
        if (!name) { toast("先填名称"); return; }
        var data = {
          name: name,
          role: editing >= 0 ? (MOCK.nodes[editing].role || "下载 / 做种") : "下载 / 做种",
          host: $("#nd-host").value.trim() || "192.0.2.0",
          path: editing >= 0 ? MOCK.nodes[editing].path : "/data/pt",
          qb: "5.0.3",
          qbUser: $("#nd-user").value.trim(),
          qbPass: $("#nd-pass").value,
          maxDown: $("#nd-down").value.trim(),
          seedLimit: $("#nd-seed").value.trim(),
          dlLimit: $("#nd-dllimit").value.trim(),
          ulLimit: $("#nd-ullimit").value.trim(),
          ratioDel: $("#nd-ratio").value.trim(),
          seedDays: $("#nd-days").value.trim(),
          dlPath: $("#nd-path").value.trim(),
          lowDisk: $("#nd-lowdisk").value.trim()
        };
        var target = null;
        if (editing >= 0) {
          var nd = MOCK.nodes[editing];
          nd.name = data.name; nd.role = data.role; nd.host = data.host;
          nd.maxDown = data.maxDown; nd.seedLimit = data.seedLimit;
          nd.qbUser = data.qbUser; nd.qbPass = data.qbPass;
          nd.qbUrl = ($("#nd-qb").value || "").trim() || nd.qbUrl || ("http://" + data.host + ":8080");
          nd.dlLimit = data.dlLimit; nd.ulLimit = data.ulLimit; nd.ratioDel = data.ratioDel;
          nd.seedDays = data.seedDays; nd.dlPath = data.dlPath; nd.lowDisk = data.lowDisk;
          nd.cats = curCats; nd.cat = curCat;
          target = nd;
        } else {
          target = {
            name: data.name, role: data.role, host: data.host, online: true,
            disk: "0 / 16 TB", used: 0, total: 16, qb: data.qb,
            seeding: "0", path: data.path, maxDown: data.maxDown, seedLimit: data.seedLimit,
            cats: curCats, cat: curCat, qbUser: data.qbUser, qbPass: data.qbPass,
            qbUrl: ($("#nd-qb").value || "").trim() || ("http://" + data.host + ":8080")
          };
          MOCK.nodes.push(target);
        }
        save(); paint(); closeModal();
        toast(editing >= 0 ? "已保存：" + data.name : "已新增：" + data.name);
        pushNode(target);
      });

      var testBtn = $("#nd-test");
      if (testBtn) testBtn.addEventListener("click", function () {
        var res = $("#nd-test-res");
        var url = ($("#nd-qb").value || "").trim();
        var user = ($("#nd-user").value || "").trim();
        var pass = $("#nd-pass").value || "";
        if (!url) { toast("先填 qB 地址"); return; }
        if (!/^https?:\/\//i.test(url)) { toast("地址要以 http:// 或 https:// 开头"); return; }
        if (!window.fetch || !/^https?:$/.test(location.protocol)) {
          toast("本地预览没有后端，连接测试不可用");
          if (res) res.textContent = "本地预览没有后端，连接测试不可用";
          return;
        }
        testBtn.disabled = true;
        if (res) res.textContent = "正在连接…";
        fetch("/api/downloaders", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: ($("#nd-name").value || "").trim() || "下载器", url: url, user: user, pass: pass })
        }).then(function (r) {
          return r.json().then(function (j) { return { status: r.status, j: j }; },
            function () { return { status: r.status, j: null }; });
        }).then(function (out) {
          if (!out.j || !out.j.ok) {
            var msg = (out.j && out.j.error && out.j.error.message) || ("保存失败 " + out.status);
            if (res) res.textContent = msg;
            toast(msg);
            return null;
          }
          var id = out.j.data.id;
          return fetch("/api/downloaders/" + encodeURIComponent(id) + "/test", { method: "POST", credentials: "same-origin" })
            .then(function (r) { return r.json(); })
            .then(function (tj) {
              if (!tj || !tj.ok) { if (res) res.textContent = "探测失败"; toast("探测失败"); return; }
              var d = tj.data;
              var pass2 = d.pass === true;
              var lines = (d.steps || []).map(function (s) {
                return s.step + ":" + (s.status || "—") + (s.error ? "(" + s.error + ")" : "") + " " + (s.ms || 0) + "ms";
              }).join(" · ");
              if (res) res.textContent = (pass2 ? "通过 · " + d.version : "不通") + (lines ? " · " + lines : "");
              toast(pass2 ? "连接通过 · " + d.version : "连接失败");
              return fetch("/api/downloaders/" + encodeURIComponent(id), { method: "DELETE", credentials: "same-origin" }).catch(function () {});
            });
        }).catch(function () {
          if (res) res.textContent = "本地预览没有后端，连接测试不可用";
          toast("连接测试不可用");
        }).then(function () {
          testBtn.disabled = false;
        });
      });

      $("#nd-fetch").addEventListener("click", function () {
        var b = this;
        b.disabled = true;
        b.textContent = "拉取中…";
        var node = editing >= 0 ? MOCK.nodes[editing] : { host: $("#nd-host").value.trim(), name: $("#nd-name").value.trim() };
        setTimeout(function () {
          curCats = catsFromNode(node);
          if (!curCat || !curCats.some(function (c) { return c[0] === curCat; })) curCat = curCats.length ? curCats[0][0] : "";
          renderCats();
          b.disabled = false;
          b.textContent = "重新拉取";
          toast("已拉取 " + curCats.length + " 个分类");
        }, 700);
      });

      $("#nd-cat-list").addEventListener("click", function (e) {
        var chip = e.target.closest("[data-ndcat]");
        if (!chip) return;
        curCat = chip.getAttribute("data-ndcat");
        renderCats();
      });

      $("#node-del").addEventListener("click", function () {
        if (editing < 0) return;
        var idx = editing;
        var nm = MOCK.nodes[idx].name;
        var sid = MOCK.nodes[idx].serverId;
        ptaConfirm("删除下载器", "确定删除「" + nm + "」吗？这台机器上的做种记录会从列表里移除。", function () {
          MOCK.nodes.splice(idx, 1);
          save(); paint(); closeModal();
          toast("已删除：" + nm);
          if (sid) window.__ptaDl.req("/" + encodeURIComponent(sid), "DELETE");
        });
      });
    }

    host.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-nset]");
      if (!b) return;
      openModal(Number(b.getAttribute("data-nset")));
    });

    paint();
    loadServer();
  }

  function initLogs() {
    var host = $("#log-lines");
    if (!host) return;
    var state = { lvl: "all" };

    function paint() {
      var rows = MOCK.logs.filter(function (l) {
        return state.lvl === "all" || l.lvl === state.lvl;
      });
      host.innerHTML = rows.map(function (l) {
        var tag = l.lvl === "error" ? "ERROR" : l.lvl === "warn" ? "WARN" : "INFO";
        return '<div class="log-row ' + l.lvl + '">' +
          '<span class="log-ts">' + escapeHtml(l.t) + "</span>" +
          '<span class="log-tag">' + tag + "</span>" +
          '<span class="log-src">' + escapeHtml(l.tag) + "</span>" +
          '<span class="log-msg">' + escapeHtml(l.msg) + "</span>" +
        "</div>";
      }).join("") || '<div class="sites-empty">还没有日志，连上后端后这里会实时刷新</div>';
      host.scrollTop = host.scrollHeight;
    }

    window.__ptaRepaintLogs = paint;
    var tabs = $("#log-tabs");
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-lvl]");
      if (!b) return;
      state.lvl = b.getAttribute("data-lvl");
      $$("button", tabs).forEach(function (x) { x.classList.toggle("active", x === b); });
      paint();
    });
    var dl = $("#log-dl");
    if (dl) dl.addEventListener("click", function () {
      var txt = MOCK.logs.map(function (l) { return l.t + " [" + l.lvl + "] " + l.tag + " " + l.msg; }).join("\n");
      var url = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
      var a = document.createElement("a");
      a.href = url;
      a.download = "pta.log";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast("已下载 " + MOCK.logs.length + " 行");
    });
    var clr = $("#log-clear");
    if (clr) clr.addEventListener("click", function () { host.innerHTML = ""; toast("已清屏（假数据）"); });
    paint();
  }

  /* ---------- 流程页：抓取 / 发布 ---------- */
  function chipRow(items, active) {
    return '<div class="cat-row pick-row">' + items.map(function (c) {
      var on = (active || []).indexOf(c) >= 0;
      return '<button type="button" class="cat-chip' + (on ? " on" : "") + '" data-pick="' + c + '">' + c + "</button>";
    }).join("") + "</div>";
  }

  function setControl(r) {
    var k = r.k ? ' data-k="' + r.k + '"' : "";
    if (r.type === "switch") {
      return '<button class="switch' + ((r.on || r.v) ? " on" : "") + '" data-switch="' + (r.k || "") + '"><i></i></button>';
    }
    if (r.type === "select") {
      var cur = r.v || "";
      var opts = (cur === "" ? '<option value="" selected>未选择</option>' : "") + (r.opts || []).map(function (o) {
        var label = r.labels && r.labels[o] !== undefined ? r.labels[o] : o;
        return '<option value="' + o + '"' + (o === cur ? " selected" : "") + ">" + label + "</option>";
      }).join("");
      return '<select class="select"' + k + ">" + opts + "</select>";
    }
    if (r.type === "textarea") {
      return '<textarea class="input sd-note"' + k + ">" + escapeHtml(r.v || "") + "</textarea>";
    }
    if (r.type === "num") {
      return '<input class="input num"' + k + ' value="' + escapeHtml(r.v === undefined ? "" : r.v) + '"' +
        (r.range ? ' data-min="' + r.range[0] + '" data-max="' + r.range[1] + '"' : "") +
        ' inputmode="numeric" placeholder="' + escapeHtml(r.ph || "") + '"><em class="num-warn"></em>';
    }
    if (r.type === "fixed") {
      return '<span class="fixed-val' + (r.noTag ? " ref" : "") + '">' + escapeHtml(r.v || "系统锁定") + (r.noTag ? "" : "<i>系统固定</i>") + "</span>";
    }
    if (r.type === "custom") return r.html || "";
    if (r.type === "button") {
      return '<button class="btn ghost slim" data-btn="' + escapeHtml(r.t) + '">' + escapeHtml(r.v) + "</button>";
    }
    return '<input class="input"' + k + ' value="' + escapeHtml(r.v === undefined ? "" : r.v) + '"' + (r.disabled ? " disabled" : "") + ' placeholder="' + escapeHtml(r.ph || "") + '">';
  }

  /* 请求层参数只在安全区间内允许，越界直接拦下，不做静默钳制 */
  function checkNums(scope) {
    var bad = null;
    [].forEach.call(scope.querySelectorAll("input.num"), function (el) {
      var w = el.parentNode.querySelector(".num-warn");
      var lo = el.getAttribute("data-min"), hi = el.getAttribute("data-max");
      var v = (el.value || "").trim();
      var n = Number(v);
      var msg = "";
      if (v !== "" && !/^\d+$/.test(v)) msg = "只能填整数";
      else if (v !== "" && lo && n < Number(lo)) msg = "低于下限 " + lo + "，不允许保存，也不会执行";
      else if (v !== "" && hi && n > Number(hi)) msg = "超过上限 " + hi + "，不允许保存";
      if (w) w.textContent = msg;
      el.classList.toggle("is-bad", !!msg);
      if (msg && !bad) bad = el;
    });
    return bad;
  }

  function setRowsHtml(rows) {
    return rows.map(function (r) {
      return '<div class="set-field' + (r.cls ? " " + r.cls : "") + '">' +
        '<div class="lbl"><span>' + r.t + "</span>" + (r.hint ? "<i>" + r.hint + "</i>" : "") + "</div>" +
        '<div class="ctl">' + (r.chips ? chipRow(r.chips, r.sel) : setControl(r)) + "</div>" +
      "</div>";
    }).join("");
  }

  var FETCH_RULES = window.PTA_RULES.fetch;
  var PUB_RULES = window.PTA_RULES.pub;
  var DEDUPE_RULES = window.PTA_RULES.dedupe;

  var RULE_SETS = { fetch: FETCH_RULES, dedupe: DEDUPE_RULES, pub: PUB_RULES };

  /* 默认全部留空：不预选、不开启，避免看起来像已经配好了 */
  Object.keys(RULE_SETS).forEach(function (k) {
    RULE_SETS[k].forEach(function (g) {
      g.sum = "跟随默认";
      (g.rows || []).forEach(function (r) {
        if (r.chips) r.sel = [];
        if (r.type === "switch") r.on = false;
        if (r.type === "select" || r.type === "text" || r.type === "textarea" || r.type === "password") r.v = "";
      });
    });
  });

  var FLOW_KEY = "pta.flow6";
  function saveFlowState() {
    var data = {};
    Object.keys(RULE_SETS).forEach(function (k) {
      data[k] = RULE_SETS[k].map(function (g) {
        return g.rows.map(function (r) { return { v: r.v, on: r.on, sel: r.sel }; });
      });
    });
    try { localStorage.setItem(FLOW_KEY, JSON.stringify(data)); } catch (e) {}
    flowRequest("PUT", { sets: data }).then(function (res) {
      if (res && res.j && res.j.ok) window.__ptaFlowSynced = true;
    });
  }
  function applyFlowData(data) {
    if (!data) return false;
    Object.keys(RULE_SETS).forEach(function (k) {
      (data[k] || []).forEach(function (grp, gi) {
        var g = RULE_SETS[k][gi];
        if (!g) return;
        (grp || []).forEach(function (vals, ri) {
          var r = g.rows[ri];
          if (!r || !vals) return;
          if (vals.v !== undefined && vals.v !== null) r.v = vals.v;
          if (vals.on !== undefined) r.on = vals.on;
          if (vals.sel) r.sel = vals.sel;
        });
      });
    });
    return true;
  }

  function flowRequest(method, body) {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(null);
    return fetch("/api/flow", {
      method: method || "GET", credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, j: j }; },
        function () { return { status: r.status, j: null }; });
    }).catch(function () { return null; });
  }

  function loadFlowState() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(FLOW_KEY) || "null"); } catch (e) {}
    applyFlowData(data);
  }

  function initCrawlSettings() {
    var host = $("#crawl-panel");
    if (!host) return;

    var TPL_DEMO = { 电影名: "金瓶双艳", 地区: "港版", 导演: "李翰祥", 主演1: "胡锦", 主演2: "恬妮", 主演3: "陈萍", 音轨: "国语 2.0", 字幕: "中文字幕" };
    function renderTpl() {
      var inp = $("#sub-tpl"), eg = $("#sub-eg");
      if (!inp || !eg) return;
      var t = inp.value || "";
      Object.keys(TPL_DEMO).forEach(function (k) { t = t.split("{" + k + "}").join(TPL_DEMO[k]); });
      eg.textContent = t;
    }

    function ruleListHtml(rules, setKey) {
      return '<div class="rule-list">' + rules.map(function (r, i) {
        return '<div class="rule-item" data-set="' + setKey + '" data-idx="' + i + '">' +
          '<button class="rule-row" data-rule="' + i + '" data-ruleset="' + setKey + '">' +
            '<span class="rule-name">' + r.name + "</span>" +
            '<span class="rule-sum">' + r.sum + "</span>" +
            '<svg class="rule-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
          "</button>" +
          '<div class="rule-body"><div class="set-fields">' + setRowsHtml(r.rows) + "</div></div>" +
        "</div>";
      }).join("") + "</div>";
    }

    function sectionHtml(g, i, setKey) {
      return '<section class="drawer open" data-i="' + i + '" data-name="' + g.name + '">' +
        '<div class="drawer-head">' +
          '<div class="drawer-t"><div class="drawer-title">' + g.name + "</div>" +
          '<div class="drawer-desc">' + g.desc + "</div></div>" +
          '<div class="drawer-head-right">' +
            '<span class="drawer-meta">' + g.sum + "</span>" +
            '<button class="btn primary slim sec-save" data-set="' + setKey + '">保存</button>' +
          "</div>" +
        "</div>" +
        '<div class="drawer-body">' + ruleListHtml(g.rules, setKey) + "</div>" +
      "</section>";
    }

    loadFlowState();
    host.innerHTML =
      '<section class="drawer open crawl-dry">' +
        '<div class="drawer-head">' +
          '<div class="drawer-t"><div class="drawer-title">流程自检（干跑）</div>' +
            '<div class="drawer-desc">按设置跑一遍抓取 → 查重 → 发布的步骤，只走本地步骤，不发真实请求。</div></div>' +
          '<div class="drawer-head-right">' +
            '<span class="drawer-meta" id="crawl-dry-meta">未运行</span>' +
            '<button class="btn slim" id="crawl-live-run">抓一页</button>' +
            '<button class="btn primary slim" id="crawl-dry-run">干跑自检</button>' +
          "</div>" +
        "</div>" +
        '<div class="drawer-body" id="crawl-dry-body" hidden><div class="dl-dry" id="crawl-dry-box"></div></div>' +
      "</section>" +
      sectionHtml({ name: "抓取", desc: "按搜索预设的类目直接把词条抓进本地库，命中禁转/独占/DIY/限转的只打标记不过滤。", sum: "跟随默认", rules: FETCH_RULES }, 0, "fetch") +
      sectionHtml({ name: "筛选", desc: "从本地词条里挑出符合条件的，标出已有/已发布/跳过，归档不需要的。", sum: "跟随默认", rules: DEDUPE_RULES }, 1, "dedupe") +
      sectionHtml({ name: "发布", desc: "处理标题、副标题、简介、图片与图床、发布标签，然后发到目标站。", sum: "跟随默认", rules: PUB_RULES }, 2, "pub") +
      '<section class="drawer open catalog-panel">' +
        '<div class="drawer-head"><div class="drawer-t">' +
          '<div class="drawer-title">词条库</div>' +
          '<div class="drawer-desc">第一步抓回来的词条都在这里，按状态分：new 待筛选 / selected 已送审 / published 已发 / skipped 跳过 / archived 归档。</div>' +
        '</div><div class="drawer-head-right"><span class="drawer-meta" id="catalog-meta">—</span>' +
        '<button class="btn slim" id="catalog-refresh">刷新</button></div></div>' +
        '<div class="drawer-body" id="catalog-body"><div class="empty">正在读词条库…</div></div>' +
      '</section>';

    function paintCrawlDry(t) {
      var box = $("#crawl-dry-box");
      var meta = $("#crawl-dry-meta");
      if (!box) return;
      box.hidden = false;
      if (meta) meta.textContent = t.state === "done" ? "已完成" : (t.progress || 0) + "%";
      box.innerHTML = '<div class="dl-dry-head"><b>干跑 · ' + escapeHtml(t.siteHost) + "</b>" +
          '<span class="dl-dry-p">' + (t.progress || 0) + "%</span></div>" +
        "<ul>" + (t.steps || []).map(function (s) {
          return '<li class="' + (s.state === "done" ? "done" : "wait") + '"><i></i>' + escapeHtml(s.name) + "</li>";
        }).join("") + "</ul>" +
        '<em>只跑本地步骤，不访问任何真实站点</em>' + dryNotes(t);
    }

    function dryNotes(t) {
      if (t.state !== "done" || !t.result) return "";
      var p = t.result.plan || {};
      var head = '<div class="dl-dry-note">计划：' + (p.pages || "-") + " 页 · 并发 " + (p.concurrency || "-") +
        " · 分类 " + (p.catGroups || 0) + " 组 / " + (p.catIds || 0) + " 个 id · 预估 " + (p.estimatedQueries || 0) + " 次查询" +
        ((p.searchUrls && p.searchUrls.length) ? " · 会请求 " + p.searchUrls.length + " 个地址" : "") + "</div>";
      var warns = (t.result.warnings || []).map(function (w) {
        return "<li>" + escapeHtml(w) + "</li>";
      }).join("");
      return head + (warns ? '<ul class="dl-dry-warn">' + warns + "</ul>" : "");
    }
    var dryRunBtn = $("#crawl-dry-run");
    if (dryRunBtn) dryRunBtn.addEventListener("click", function () {
      var host0 = target;
      if (!host0) {
        var first = MOCK.sitesList[0];
        host0 = first ? first.name : "";
      }
      if (!host0) { toast("先去站点页加一个站点"); return; }
      var seen = false;
      window.__ptaDryRun(host0, function (t) {
        paintCrawlDry(t);
        if (!seen) { seen = true; toast("已提交干跑任务"); }
      }, function (t) {
        if (t.state === "done") toast("干跑完成 · " + (t.steps || []).length + " 步");
      }, function (msg) { toast(msg); });
    });

    renderTpl();

    /* 第二步筛选：把词条库里还没处理的挑出来，已有的跳过，能发的送进待审核 */
    (function screenBtn() {
      var sec = document.querySelector('.rule-item[data-set="dedupe"] .drawer-head-right');
      if (!sec || $("#crawl-screen-run")) return;
      var b = document.createElement("button");
      b.className = "btn primary slim";
      b.id = "crawl-screen-run";
      b.textContent = "筛选送审";
      sec.insertBefore(b, sec.firstChild);
      b.addEventListener("click", function () {
        if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端，筛选不可用"); return; }
        b.disabled = true;
        fetch("/api/catalog/screen", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 50, rules: {} })
        }).then(function (r) { return r.json(); }).then(function (j) {
          b.disabled = false;
          if (!j || !j.ok) { toast((j && j.error && j.error.message) || "筛选失败"); return; }
          var d = j.data;
          toast("检查 " + d.checked + " 条 · 入选 " + d.selected + " · 跳过 " + d.skipped);
          if (window.__ptaLoadOverview) window.__ptaLoadOverview();
        }).catch(function () { b.disabled = false; toast("筛选请求发不出去"); });
      });
    })();

    /* 词条库面板：最新 30 条，按状态看；能直接归档/跳过 */
    var CAT_STATUS = { new: "待筛选", selected: "已送审", published: "已发布", skipped: "跳过", archived: "归档" };
    function loadCatalog() {
      var body = $("#catalog-body"), meta = $("#catalog-meta");
      if (!body) return;
      if (!window.fetch || !/^https?:$/.test(location.protocol)) {
        body.innerHTML = '<div class="empty">本地预览没有后端，读不到词条库</div>';
        return;
      }
      fetch("/api/catalog?limit=30", { credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok) { body.innerHTML = '<div class="empty">词条库读取失败</div>'; return; }
          var d = j.data;
          var c = d.byStatus || {};
          if (meta) meta.textContent = "共 " + d.total + " 条 · 待筛选 " + (c.new || 0) + " · 已送审 " + (c.selected || 0) + " · 已发 " + (c.published || 0);
          if (!d.items.length) { body.innerHTML = '<div class="empty">词条库还是空的，先点上面「抓一页」</div>'; return; }
          body.innerHTML = d.items.map(function (it) {
            var marks = Object.keys(it.marks || {}).filter(function (k) { return it.marks[k]; }).map(function (k) {
              return { noRedistribute: "禁转", exclusive: "独占", diy: "DIY", limited: "限转" }[k] || k;
            }).join(" · ");
            return '<div class="list-item cat-row" data-cid="' + it.id + '">' +
              '<div style="flex:1;min-width:0"><div class="t-main">' + escapeHtml(it.title) + "</div>" +
              '<div class="t-sub">' + escapeHtml(it.site || "") + " · " + escapeHtml(it.size || "") +
              (marks ? " · " + escapeHtml(marks) : "") + "</div></div>" +
              '<span class="badge ' + (it.status === "new" ? "gray" : it.status === "selected" ? "amber" : it.status === "published" ? "green" : "") + '">' +
              (CAT_STATUS[it.status] || it.status) + "</span>" +
              (it.status === "new" ? '<button class="link-btn" data-catact="archived" data-cid="' + it.id + '">归档</button>' : "") +
            "</div>";
          }).join("");
        })
        .catch(function () { body.innerHTML = '<div class="empty">词条库读取失败</div>'; });
    }
    window.__ptaLoadCatalog = loadCatalog;

    var catBody = $("#catalog-body");
    if (catBody) {
      catBody.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-catact]");
        if (!b) return;
        fetch("/api/catalog/" + encodeURIComponent(b.getAttribute("data-cid")) + "/status", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ status: b.getAttribute("data-catact") })
        }).then(function (r) { return r.json(); }).then(function (j) {
          toast(j && j.ok ? "已归档" : ((j && j.error && j.error.message) || "归档失败"));
          loadCatalog();
        }).catch(function () { toast("归档请求发不出去"); });
      });
    }
    var catRefresh = $("#catalog-refresh");
    if (catRefresh) catRefresh.addEventListener("click", function () { toast("已刷新词条库"); loadCatalog(); });
    loadCatalog();

    /* 干跑区不是空的：进来就显示上一次干跑的结果，没跑过才显示「还没跑过」 */
    (function showLastDry() {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) return;
      fetch('/api/tasks', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.ok || !Array.isArray(j.data)) return;
          var dry = j.data.filter(function (t) { return t && t.result && t.result.dryRun; })
            .sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); })[0];
          var meta = $("#crawl-dry-meta");
          if (!dry) { if (meta) meta.textContent = '还没跑过'; return; }
          if (meta) {
            var when = String(dry.createdAt || '').slice(5, 16).replace('T', ' ');
            meta.textContent = '上次 ' + when + ' · ' + (dry.state === 'done' ? '完成' : dry.state);
          }
          var box = $("#crawl-dry-box");
          if (box && !box.innerHTML) { box.hidden = false; paintCrawlDry(dry); }
        })
        .catch(function () {});
    })();

    /* 目标站 */
    var TKEY = "pta.target";
    var target = null;
    try { target = localStorage.getItem(TKEY); } catch (e) {}
    if (!target || !MOCK.sitesList.some(function (x) { return x.name === target; })) target = "";
    function siteOf(h) { return MOCK.sitesList.filter(function (x) { return x.name === h; })[0]; }
    function paintTarget() {
      var t = siteOf(target);
      var n = $("#tp-name"), h2 = $("#tp-host"), av = $("#tp-ava");
      if (n) n.textContent = t ? (t.title || t.name) : "未选择";
      if (h2) h2.textContent = t ? t.name : "";
      if (av) {
        var label = t ? (t.title || t.name) : "?";
        var m = label.match(/^[A-Za-z0-9]+/);
        av.textContent = m ? m[0].slice(0, 2).toUpperCase() : label.slice(0, 1);
      }
      var pr = document.querySelector('.rule-item[data-set="pub"][data-idx="0"] .rule-sum');
      if (pr) pr.textContent = t ? "发到 " + (t.title || t.name) + " · 站内图床" : "未设置";
      refreshSums();
    }
    paintTarget();

    /* 真抓一页：只发一次 GET，服务端守住 6 秒间隔与每日上限；失败按错误码说人话 */
    var liveBtn = $("#crawl-live-run");
    if (liveBtn) liveBtn.addEventListener("click", function () {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端，抓取不可用"); return; }
      var h = target || (MOCK.sitesList[0] && MOCK.sitesList[0].name) || "";
      if (!h) { toast("先去站点页选一个站点"); return; }
      liveBtn.disabled = true;
      var meta = $("#crawl-dry-meta");
      if (meta) meta.textContent = "正在抓 " + h + " …";
      fetch("/api/crawl/run", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ host: h })
      }).then(function (r) {
        return r.json().then(function (j) { return { status: r.status, j: j }; }, function () { return { status: r.status, j: null }; });
      }).then(function (out) {
        liveBtn.disabled = false;
        if (!out.j || !out.j.ok) {
          var msg = (out.j && out.j.error && out.j.error.message) || ("抓取失败 " + out.status);
          if (meta) meta.textContent = msg;
          toast(msg);
          return;
        }
        var d = out.j.data;
        var line = "第 " + d.page + " 页 · 抓回 " + d.rows + " 行 · 新增 " + d.added + " · 更新 " + d.updated +
          " · 今日第 " + d.daily.count + " 次 · 下次第 " + d.nextPage + " 页";
        if (meta) meta.textContent = line;
        toast(line);
        if (window.__ptaLoadOverview) window.__ptaLoadOverview();
      }).catch(function () {
        liveBtn.disabled = false;
        toast("抓取请求发不出去");
      });
    });

    /* 规则正文与 RULE_SETS 对齐（服务端数据套回界面） */
    function syncFlowDom() {
      host.querySelectorAll(".rule-item").forEach(function (item) {
        var k = item.getAttribute("data-set"), idx = Number(item.getAttribute("data-idx"));
        var set = RULE_SETS[k];
        if (!set || !set[idx]) return;
        [].forEach.call(item.querySelectorAll(".set-field"), function (f, m) {
          var r = set[idx].rows[m];
          if (!r) return;
          var sw = f.querySelector("[data-switch]");
          if (sw) { sw.classList.toggle("on", !!r.on); return; }
          var pk = f.querySelector(".pick-row");
          if (pk) {
            [].forEach.call(pk.querySelectorAll(".cat-chip"), function (c) {
              c.classList.toggle("on", (r.sel || []).indexOf(c.textContent) >= 0);
            });
            return;
          }
          var ctl = f.querySelector(".input, .select");
          if (ctl && r.v !== undefined && r.v !== null) ctl.value = r.v;
        });
      });
      refreshSums();
    }

    function syncFlowFromServer() {
      return flowRequest("GET").then(function (res) {
        if (!res || !res.j || !res.j.ok || !res.j.data || !res.j.data.sets) return false;
        var data = res.j.data.sets;
        try { localStorage.setItem(FLOW_KEY, JSON.stringify(data)); } catch (e) {}
        applyFlowData(data);
        syncFlowDom();
        renderTpl();
        return true;
      });
    }
    window.__ptaLoadFlow = syncFlowFromServer;
    syncFlowFromServer();

    var mask = $("#target-modal");
    function renderTargetList(qv) {
      var box = $("#target-list");
      if (!box) return;
      var rows = MOCK.sitesList.filter(function (x) {
        if (!x.enabled || x.login !== "ok") return false;
        if (qv && ((x.title || "") + " " + x.name).toLowerCase().indexOf(qv) === -1) return false;
        return true;
      }).slice(0, 60);
      box.innerHTML = rows.map(function (x) {
        return '<button class="target-item' + (x.name === target ? " on" : "") + '" data-host="' + escapeHtml(x.name) + '">' +
          '<span class="ti-name">' + escapeHtml(x.title || x.name) + "</span>" +
          '<span class="ti-host">' + escapeHtml(x.name) + "</span>" +
        "</button>";
      }).join("") || '<div class="sites-empty">没有匹配的站点</div>';
    }

    if (mask) {
      var tq = $("#target-q");
      $("#target-x").addEventListener("click", function () { mask.hidden = true; });
      mask.addEventListener("click", function (e) { if (e.target === mask) mask.hidden = true; });
      tq.addEventListener("input", function () { renderTargetList(tq.value.trim().toLowerCase()); });
      $("#target-list").addEventListener("click", function (e) {
        var b = e.target.closest(".target-item");
        if (!b) return;
        target = b.getAttribute("data-host");
        try { localStorage.setItem(TKEY, target); } catch (err) {}
        mask.hidden = true;
        paintTarget();
        toast("发布目标改为：" + (siteOf(target).title || target));
      });
    }

    /* clicks */
    function domSum(item) {
      var setKey = item.getAttribute("data-set"), idx = Number(item.getAttribute("data-idx"));
      var rows = ((RULE_SETS[setKey] || [])[idx] || {}).rows || [];
      var parts = [];
      [].forEach.call(item.querySelectorAll(".set-field"), function (f, m) {
        var r = rows[m];
        if (!r) return;
        if (r.chips) {
          var on = [].map.call(f.querySelectorAll(".cat-chip.on"), function (c) { return c.textContent; });
          if (on.length) parts.push(on.join("/"));
          return;
        }
        if (r.type === "switch") {
          if (f.querySelector(".switch.on")) parts.push(r.t);
          return;
        }
        if (r.type === "custom" || r.type === "button") return;
        var ctl = f.querySelector(".input, .select");
        if (ctl && ctl.value) parts.push(ctl.value);
      });
      return parts.length ? parts.slice(0, 3).join(" · ") + (parts.length > 3 ? " 等" : "") : "跟随默认";
    }

    /* 标题正则只在发布侧生效：限 200 字，语法错就退成纯文本 */
    function rxCompile(src, label) {
      src = (src || "").trim();
      if (!src) return { re: null };
      if (src.length > 200) return { re: null, err: label + "超过 200 字，按纯文本处理" };
      try { return { re: new RegExp(src, "i") }; } catch (err) { return { re: null, err: label + "正则写错，按纯文本处理" }; }
    }
    function rxHit(src, text) {
      var c = rxCompile(src, "");
      if (c.re) return c.re.test(text);
      var pat = (src || "").trim();
      return pat ? text.toLowerCase().indexOf(pat.toLowerCase()) >= 0 : false;
    }
    function runRx() {
      var out = $("#rx-out");
      if (!out) return;
      var sample = (($("#rx-sample") || {}).value || "").trim();
      if (!sample) { out.textContent = "先填一条标题"; out.className = "rx-warn"; return; }
      var denySrc = (($("#rx-deny") || {}).value || "");
      var allowSrc = (($("#rx-allow") || {}).value || "");
      var d = rxCompile(denySrc, "排除"), al = rxCompile(allowSrc, "白名单");
      var deny = rxHit(denySrc, sample), allow = rxHit(allowSrc, sample);
      var msg = deny ? "排除命中，不转载" : (allowSrc.trim() && !allow ? "白名单未命中，不转载" : "通过，可以转载");
      var warn = d.err || al.err;
      out.textContent = msg + (warn ? "（" + warn + "）" : "");
      out.className = deny || (allowSrc.trim() && !allow) ? "rx-warn" : "rx-ok";
    }

    function refreshSums() {
      host.querySelectorAll(".rule-item").forEach(function (item) {
        if (item.getAttribute("data-set") === "pub" && item.getAttribute("data-idx") === "0") return;
        var el = item.querySelector(".rule-sum");
        if (el) el.textContent = domSum(item);
      });
      host.querySelectorAll(".drawer").forEach(function (sec) {
        var meta = sec.querySelector(".drawer-meta");
        if (!meta) return;
        var first = "";
        [].forEach.call(sec.querySelectorAll(".rule-item .rule-sum"), function (s) {
          if (!first && s.textContent && s.textContent !== "跟随默认") first = s.textContent;
        });
        meta.textContent = first || "跟随默认";
      });
    }
    refreshSums();

    host.addEventListener("click", function (e) {
      var change = e.target.closest("#tp-change");
      if (change) {
        var tq2 = $("#target-q");
        tq2.value = "";
        renderTargetList("");
        mask.hidden = false;
        setTimeout(function () { tq2.focus(); }, 30);
        return;
      }
      var rxBtn = e.target.closest("#rx-run");
      if (rxBtn) { runRx(); return; }
      var pick = e.target.closest(".pick-row .cat-chip");
      if (pick) { pick.classList.toggle("on"); refreshSums(); return; }
      var sw = e.target.closest("button[data-switch]");
      if (sw) { sw.classList.toggle("on"); refreshSums(); return; }
      var btn = e.target.closest("button[data-btn]");
      if (btn) {
        var bname = btn.getAttribute("data-btn") || "";
        if (bname.indexOf("目标站") >= 0) {
          var tgt = target ? siteOf(target) : null;
          openCatMap({
            host: target || "__target__",
            label: tgt ? (tgt.title || tgt.name) : "还没选目标站",
            cats: tgt ? siteCatNames(tgt) : null,
            sub: "目标站自己的分类对到库内分类，发种时按这张表选分类。"
          });
          return;
        }
        if (bname.indexOf("站点分类") >= 0) {
          toast("分类映射是逐站配的，去站点页点开某一站配置");
          location.hash = "#sites";
          return;
        }
        toast(bname + "（假数据）");
        return;
      }
      var row = e.target.closest(".rule-row");
      if (row) {
        var item = row.closest(".rule-item");
        var wasOpen = item.classList.contains("open");
        host.querySelectorAll(".rule-item.open").forEach(function (x) { x.classList.remove("open"); });
        if (!wasOpen) { item.classList.add("open"); renderTpl(); }
        return;
      }
      var save = e.target.closest(".sec-save");
      if (save) {
        var sKey = save.getAttribute("data-set");
        host.querySelectorAll('.rule-item[data-set="' + sKey + '"]').forEach(function (item) {
          var setKey = item.getAttribute("data-set");
          var idx = Number(item.getAttribute("data-idx"));
          var set = RULE_SETS[setKey];
          var body = item.querySelector(".rule-body");
          [].forEach.call(body.querySelectorAll(".set-field"), function (f, m) {
            var r = set[idx].rows[m];
            if (!r) return;
            var s2 = f.querySelector("[data-switch]");
            if (s2) { r.on = s2.classList.contains("on"); return; }
            var pk = f.querySelector(".pick-row");
            if (pk) { r.sel = [].map.call(pk.querySelectorAll(".cat-chip.on"), function (c) { return c.textContent; }); return; }
            var ctl = f.querySelector(".input, .select");
            if (ctl) r.v = ctl.value;
          });
        });
        var bad = checkNums(save.closest(".drawer") || host);
        if (bad) { toast("超出安全范围，已拦下不保存"); bad.focus(); return; }
        saveFlowState();
        var label = { fetch: "抓取", dedupe: "筛选", pub: "发布" }[sKey] || sKey;
        toast(label + "设置已保存");
      }
    });

    host.addEventListener("input", function (e) {
      if (e.target && e.target.id === "sub-tpl") renderTpl();
      var scope = e.target.closest && e.target.closest(".rule-item");
      if (scope) checkNums(scope);
      refreshSums();
    });
    host.addEventListener("change", refreshSums);

    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest("#save-crawl")) return;
      host.querySelectorAll(".rule-item").forEach(function (item) {
        var setKey = item.getAttribute("data-set");
        var idx = Number(item.getAttribute("data-idx"));
        var set = RULE_SETS[setKey];
        var body = item.querySelector(".rule-body");
        [].forEach.call(body.querySelectorAll(".set-field"), function (f, m) {
          var r = set[idx].rows[m];
          if (!r) return;
          var s2 = f.querySelector("[data-switch]");
          if (s2) { r.on = s2.classList.contains("on"); return; }
          var pk = f.querySelector(".pick-row");
          if (pk) { r.sel = [].map.call(pk.querySelectorAll(".cat-chip.on"), function (c) { return c.textContent; }); return; }
          var ctl = f.querySelector(".input, .select");
          if (ctl) r.v = ctl.value;
        });
      });
      var bad2 = checkNums(host);
      if (bad2) { toast("超出安全范围，已拦下不保存"); bad2.focus(); return; }
      saveFlowState();
      toast("流程设置已保存");
    });
  }

  function initSettings() {
    var panel = $("#set-panel");
    if (!panel) return;
    var GROUPS = [
      { name: "抓取节奏", desc: "请求层由程序固定，只有速度在安全区间里可调；越界只提醒，不会保存也不会执行。", rows: [
        { t: "运行模式", type: "select", k: "runMode", v: "test", opts: ["test", "prod"], labels: { test: "测试（按人手速度）", prod: "正式" }, hint: "测试模式一分钟一次，用来验证流程" },
        { t: "请求间隔", type: "num", k: "paceSec", v: "60", range: [30, 120], ph: "30–120", hint: "测试模式最低 30 秒，按人手速度跑" },
        { t: "并发", type: "fixed", v: "1", hint: "固定单线程，不开放调整" },
        { t: "单站每日上限", type: "num", k: "dailySite", v: "20", range: [1, 300], hint: "程序按站规再压一次，最多到站规的 1/3" },
        { t: "全站每日上限", type: "num", k: "dailyAll", v: "100", range: [50, 2000] },
        { t: "最小间隔", type: "fixed", v: "测试 30 秒 / 正式 8 秒", hint: "低于这个值一律不执行" },
        { t: "失败重试", type: "fixed", v: "3 次 · 退避 30 秒起" },
        { t: "连续失败熔断", type: "fixed", v: "3 次 4xx 暂停 15 分钟", hint: "429/403 直接停，遵守 Retry-After" },
        { t: "请求审计", type: "fixed", v: "全量记日志", hint: "每次请求可追溯到时间、站点、路径" }
      ] },
      { name: "面板账号", desc: "登录这个面板用的账号，和站点账号无关。", rows: [
        { t: "面板用户名", type: "text", v: "admin" },
        { t: "面板密码", type: "password", k: "panelPass", ph: "留空表示不修改", hint: "保存时会再确认一次，避免误改" },
        { t: "两步验证", type: "switch", v: true, hint: "登录面板时需要输入一次 TOTP" },
        { t: "登录保持", type: "select", v: "7 天", opts: ["7 天", "30 天", "关闭浏览器失效"] },
        { t: "面板地址", type: "text", v: "https://pta.example/", hint: "在 DNS 那边解析到 A 机" },
        { t: "只允许局域网访问", type: "switch", v: true, hint: "关掉后外网也能打开，需要配合防火墙" },
        { t: "已登录设备", type: "text", v: "Windows · 192.0.2.23", disabled: true },
        { t: "退出所有设备", type: "button", v: "全部退出" }
      ] },
      { name: "通知", desc: "哪些事需要主动推送给你。", rows: [
        { t: "Telegram bot", type: "text", v: "@pta_bot", disabled: true },
        { t: "每日汇总", type: "switch", v: true, hint: "每天 22:00 发一条" },
        { t: "失败立即推送", type: "switch", v: true },
        { t: "登录失效提醒", type: "switch", v: true },
        { t: "Webhook 地址", type: "text", v: "", ph: "POST JSON 到自己的服务" },
        { t: "邮件通知", type: "text", v: "", ph: "收件邮箱（SMTP 在配置里）" },
        { t: "静默时段", type: "select", v: "不静默", opts: ["不静默", "22:00–08:00", "00:00–08:00"], hint: "这段时间只记录不推送" }
      ] },
      { name: "系统", desc: "版本、备份和这台浏览器里的数据。", rows: [
        { t: "当前版本", type: "text", v: "0.3.2 原型", disabled: true },
        { t: "立即备份", type: "button", v: "开始备份" },
        { t: "清空本地缓存", type: "button", v: "清空", hint: "只会清掉浏览器里的设置，不动服务器数据" },
        { t: "数据保留", type: "select", v: "90 天", opts: ["30 天", "90 天", "180 天", "永久"], hint: "数据清单里过期的记录自动清" },
        { t: "日志保留", type: "select", v: "30 天", opts: ["7 天", "30 天", "90 天"] },
        { t: "自动备份", type: "select", v: "每天 03:00", opts: ["每天 03:00", "每周一次", "关闭"], hint: "备份站点、流程、通知这几组设置" },
        { t: "磁盘低水位", type: "select", v: "50 GB", opts: ["20 GB", "50 GB", "100 GB"], hint: "低于这个值停止新下载" },
        { t: "时区", type: "select", v: "Asia/Shanghai", opts: ["Asia/Shanghai", "UTC"], hint: "抓取时段和汇总都按这个时区" },
        { t: "API 令牌", type: "button", v: "重新生成" }
      ] }
    ];
    panel.innerHTML = '<div class="set-stack">' + GROUPS.map(function (g, i) {
      return '<section class="set-card' + (i === 0 ? " first" : "") + '">' +
        '<div class="set-card-head">' +
          '<div class="set-card-t"><h2 class="set-h2">' + g.name + "</h2>" +
          '<p class="set-desc">' + g.desc + "</p></div>" +
          '<button type="button" class="btn primary slim set-save">保存</button>' +
        "</div>" +
        '<div class="set-fields">' + setRowsHtml(g.rows) + "</div></section>";
    }).join("") + "</div>";
    panel.addEventListener("click", function (e) {
      var sw = e.target.closest("button[data-switch]");
      if (sw) { sw.classList.toggle("on"); return; }
      var btn = e.target.closest("button[data-btn]");
      if (btn) {
        var lbl = btn.getAttribute("data-btn");
        if (lbl === "清空本地缓存") {
          ptaConfirm("清空本地缓存", "会清掉浏览器里存的站点设置、流程设置和分类映射，服务器数据不动。确定？", function () {
            try { localStorage.clear(); } catch (err) {}
            toast("本地缓存已清空，正在刷新");
            setTimeout(function () { location.reload(); }, 700);
          });
          return;
        }
        if (lbl === "API 令牌") {
          var buf = new Uint8Array(16);
          (window.crypto || window.msCrypto).getRandomValues(buf);
          var tk = [].map.call(buf, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
          toast("新令牌：" + tk.slice(0, 8) + "…（只显示一次）");
          console.log("[PTA] api token", tk);
          return;
        }
        toast(lbl + "（假数据）");
      }
    });
    /* 已连后端时，抓取节奏以服务端为准 */
    function loadServerPace() {
      if (typeof API === "undefined" || API.mode !== "live" || !API.getConfig) return;
      API.getConfig().then(function (j) {
        if (!j || !j.ok) return;
        var u = (j.data && j.data.user) || {};
        var card = panel.querySelector(".set-card");
        var sel = card.querySelector('select[data-k="runMode"]');
        var pace = card.querySelector('input[data-k="paceSec"]');
        var ds = card.querySelector('input[data-k="dailySite"]');
        var da = card.querySelector('input[data-k="dailyAll"]');
        if (sel && u.runMode) sel.value = u.runMode;
        var test = !sel || sel.value !== "prod";
        if (pace) {
          pace.setAttribute("data-min", test ? "30" : "8");
          pace.setAttribute("placeholder", test ? "30–120" : "8–120");
          if (u.interval != null) pace.value = u.interval;
        }
        if (ds && u.dailySite != null) ds.value = u.dailySite;
        if (da && u.dailyAll != null) da.value = u.dailyAll;
        checkNums(card);
      }).catch(function () {});
    }
    window.__ptaAfterProbe = loadServerPace;
    setTimeout(loadServerPace, 300);
    setTimeout(loadServerPace, 1600);
    setTimeout(loadServerPace, 3600);

    (function restoreSettings() {
      var data = null;
      try { data = JSON.parse(localStorage.getItem("pta.settings2") || "null"); } catch (e) {}
      if (!data) return;
      var fields = panel.querySelectorAll(".set-field");
      [].forEach.call(fields, function (f, i) {
        if (data[i] === undefined) return;
        var sw = f.querySelector("[data-switch]");
        if (sw) { if (data[i]) sw.classList.add("on"); else sw.classList.remove("on"); return; }
        var ctl = f.querySelector(".input, .select");
        if (ctl && typeof data[i] === "string") ctl.value = data[i];
      });
    })();

    panel.addEventListener("input", function (e) {
      if (e.target && e.target.classList.contains("num")) checkNums(e.target.closest(".set-card"));
    });
    panel.addEventListener("change", function (e) {
      var sel = e.target.closest && e.target.closest('select[data-k="runMode"]');
      if (!sel) return;
      var test = sel.value !== "prod";
      var pace = panel.querySelector('input[data-k="paceSec"]');
      if (pace) {
        pace.setAttribute("data-min", test ? "30" : "8");
        pace.setAttribute("placeholder", test ? "30–120" : "8–120");
        if (Number(pace.value || 0) < Number(pace.getAttribute("data-min"))) pace.value = test ? "60" : "30";
        var hintEl = pace.closest(".set-field").querySelector(".lbl i");
        if (hintEl) hintEl.textContent = test ? "测试模式最低 30 秒，按人手速度跑" : "正式模式最低 8 秒，最高 120 秒";
      }
      checkNums(sel.closest(".set-card"));
      toast(test ? "已切到测试模式：一分钟一次" : "已切到正式模式");
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest(".set-save")) return;
      var bad = checkNums(e.target.closest(".set-card") || panel);
      if (bad) { toast("超出安全范围，已拦下不保存"); bad.focus(); return; }
      var vals = [];
      panel.querySelectorAll(".set-field").forEach(function (f) {
        var sw = f.querySelector("[data-switch]");
        if (sw) { vals.push(sw.classList.contains("on")); return; }
        var ctl = f.querySelector(".input, .select");
        vals.push(ctl ? ctl.value : "");
      });
      try { localStorage.setItem("pta.settings2", JSON.stringify(vals)); } catch (err) {}

      var card = e.target.closest(".set-card");
      var rmSel = card && card.querySelector('select[data-k="runMode"]');
      if (rmSel && typeof API !== "undefined" && API.mode === "live" && API.patchConfig) {
        var pack = {
          runMode: rmSel.value,
          interval: Number(card.querySelector('input[data-k="paceSec"]').value),
          dailySite: Number(card.querySelector('input[data-k="dailySite"]').value),
          dailyAll: Number(card.querySelector('input[data-k="dailyAll"]').value)
        };
        API.patchConfig(pack).then(function (j) {
          if (!j || !j.ok) { toast((j && j.error && j.error.message) || "服务端拒绝保存"); return; }
          toast("已保存到服务端");
        }).catch(function () { toast("服务端没有响应，已存本地"); });
        return;
      }
      var pw = panel.querySelector('[data-k="panelPass"]');
      var val = pw ? pw.value : "";
      if (val) {
        ptaConfirm("您正在修改面板密码", "保存后旧密码立即失效，所有已登录设备都要重新登录。确定继续？", function () {
          if (pw) pw.value = "";
          toast("面板密码已修改（假数据）");
        });
        return;
      }
      toast("设置已保存");
    });
  }

  function initSites() {
    var list = $("#sites-list");
    if (!list) return;
    var detail = $("#site-detail");
    var state = { q: "", status: "all", arch: "all", login: "all", preset: "all", sel: null, tab: "overview", picks: [], page: 1, setTab: "basic", open: false, closed: {} };
    var PER_PAGE = 11;
    var ACH = {
      NP: ["np", "NexusPHP"], UNIT3D: ["u3d", "UNIT3D"], GZ: ["gz", "Gazelle"],
      OTHER: ["oth", "其它"], "?": ["unk", "未确认"]
    };

    function archOf(s) { return ACH[s.arch] || ACH["?"]; }

    function presetOf(host) {
      var p = (window.__ptaPresets || {})[host];
      return p && p.engine ? p : null;
    }

    var ENG = { nexusphp: "NP", unit3d: "U3D", gazelle: "GZ" };
    function engCode(name) { return ENG[name] || (name || "").toUpperCase() || "?"; }
    function defOf(host) { return (window.__ptaDefs || {})[host] || null; }

    function presetTxt(host) {
      var p = presetOf(host);
      if (!p) return "—";
      return engCode(p.engine) + (p.groups ? " " + p.groups + "组" : "");
    }

    function initials(s) {
      var t = s.title || s.name;
      var m = t.match(/^[A-Za-z0-9]+/);
      if (m) return m[0].slice(0, 2).toUpperCase();
      return t.slice(0, 1);
    }

    function filtered() {
      return MOCK.sitesList.filter(function (s) {
        if (state.status === "on" && !s.enabled) return false;
        if (state.status === "off" && s.enabled) return false;
        if (state.arch !== "all" && (s.arch || "?") !== state.arch) return false;
        if (state.login !== "all" && s.login !== state.login) return false;
        if (state.preset && state.preset !== "all") {
          var pr = (window.__ptaPresets || {})[s.name] || null;
          if (state.preset === "confirmed" && !(pr && pr.confirmed)) return false;
          if (state.preset === "pending" && !(pr && !pr.confirmed)) return false;
          if (state.preset === "nocats" && !(pr && !pr.ids)) return false;
        }
        if (state.q && ((s.title || "") + " " + s.name + " " + s.url).toLowerCase().indexOf(state.q) === -1) return false;
        return true;
      });
    }

    function dotCls(s) {
      return s.login === "ok" ? "ok" : s.login === "fail" ? "bad" : "idle";
    }

    function itemHtml(s) {
      var a = archOf(s);
      var picked = state.picks.indexOf(s.name) >= 0;
      var loginTxt = s.login === "ok" ? "正常" : s.login === "fail" ? "失效" : "未登录";
      var modeTxt = s.mode === "full" ? "全量" : s.mode === "mixed" ? "增量+定期" : "增量";
      return '<div class="site-item' + (state.sel === s.name ? " on" : "") + '" data-host="' + escapeHtml(s.name) + '">' +
        '<input type="checkbox" class="site-pick" data-host="' + escapeHtml(s.name) + '"' + (picked ? " checked" : "") + ">" +
        '<span class="st ' + dotCls(s) + '"><i></i></span>' +
        '<span class="si-txt"><b>' + escapeHtml(s.title || s.name) + "</b></span>" +
        '<span class="si-arch"><em class="chip ' + a[0] + '">' + a[1] + "</em></span>" +
        '<span class="si-login ' + dotCls(s) + '">' + loginTxt + "</span>" +
        '<span class="si-preset ' + (presetOf(s.name) ? "on" : "") + '">' + escapeHtml(presetTxt(s.name)) + "</span>" +
        '<span class="si-mode">' + modeTxt + "</span>" +
        '<span class="si-last">' + escapeHtml(s.last || "—") + "</span>" +
      "</div>";
    }

    function headHtml(s) {
      var a = archOf(s);
      return '<div class="sd-top">' +
          '<em class="ava lg ' + a[0] + '">' + escapeHtml(initials(s)) + "</em>" +
          '<div class="sd-id"><div class="sd-title-row"><h2>' + escapeHtml(s.title || s.name) + "</h2>" +
            '<em class="chip ' + a[0] + '">' + a[1] + "</em>" +
            '<span class="pill2 ' + (s.enabled ? "on" : "off") + '">' + (s.enabled ? "启用中" : "已停用") + "</span>" +
            '<span class="chip ' + (presetOf(s.name) ? "np" : "unk") + '">搜索预设 ' + (presetOf(s.name) ? "已确认" : "未确认") + "</span></div>" +
            '<span class="sd-url">' + escapeHtml(s.url) + "</span>" +
            '<span class="sd-selfcheck" id="sd-selfcheck">' + (s.checkAt ? "上次自检 " + escapeHtml(s.checkAt) + " · " + escapeHtml(s.checkMsg || "") : "还没做过连接自检") + "</span></div>" +
          '<div class="sd-actions">' +
            '<button class="btn slim" data-act="selfcheck" title="干跑自检：只读本地配置，不访问真实站点">连接自检（干跑）</button>' +
            '<button class="btn slim tabbtn' + (state.tab === "overview" ? " active" : "") + '" data-tab="overview">概览</button>' +
            SET_TABS.map(function (t) {
              var on = state.tab === "settings" && state.setTab === t[0];
              return '<button class="btn slim tabbtn' + (on ? " active" : "") + '" data-settab="' + t[0] + '">' + t[1] + "</button>";
            }).join("") +
          "</div>" +
          '<button class="sheet-x" data-act="close-sheet" aria-label="关闭">✕</button>' +
        "</div>";
    }

    function overviewHtml(s) {
      var k = hashStr(s.name);
      var todayNew = "—";
      var runsToday = "0";
      var next = !s.enabled ? "—"
        : s.trigger === "manual" ? "手动触发"
        : s.trigger === "daily" ? "次日 " + (s.dailyAt || "18:00")
        : "未开始";
      var lastRes = ["未抓取", "idle"];
      var modeTxt = s.mode === "full" ? "全量" : s.mode === "mixed" ? "增量 + 定期全量" : "增量";
      var recs = MOCK.sources.slice(0, 6);
      var acts = MOCK.logs.slice(0, 3);
      var loginTxt = s.login === "ok" ? "登录正常" : s.login === "fail" ? "登录失效" : "未登录";
      var methodTxt = "Cookie";
      var catTxt = (s.cats || []).length + " 个分类" + (s.fullDiscOnly ? " · 只收原盘" : "");
      var dres = defOf(s.name);
      var pres = presetOf(s.name);
      var engRaw = (pres && pres.engine) || (dres && dres.engine) || "";
      var engTxt = engRaw ? engCode(engRaw) + " · " + engRaw : "未识别";
      var sampleTxt = dres ? (dres.rows || 0) + " 行 · " + (dres.groups || 0) + " 组分类" : "还没采样";
      var KIND_TXT = { sample: "采样确认", shell: "引擎按页面特征确认，分类待补", arch: "按清单架构推断，还没采样" };
      var kindTxt = !dres ? "没有定义" : (KIND_TXT[dres.kind] || (dres.engine ? "引擎已确认，分类待补" : "按清单架构推断，还没采样"));
      return '<div class="sd-strip">' +
          "<span>已收录<b>" + (s.items ? s.items.toLocaleString() : "—") + "</b></span>" +
          "<span>今日<b>+" + todayNew + "</b></span>" +
          "<span>上次<b>" + escapeHtml(s.last) + "</b></span>" +
          "<span>下次<b>" + escapeHtml(next) + "</b></span>" +
        "</div>" +
        '<div class="sd-compact">' +
          '<div class="sd-col">' +
          '<div class="sd-block"><h4>登录</h4>' +
            '<div class="sd-row"><span>状态</span><b class="' + dotCls(s) + '-t">' + loginTxt + "</b></div>" +
            '<div class="sd-row"><span>方式</span><b>' + methodTxt + "</b></div>" +
            '<div class="sd-row"><span>登录凭据</span><b>' + (s.cookieSaved ? "已保存" : "未保存") + "</b></div>" +
            '<div class="sd-row"><span>引擎</span><b>' + escapeHtml(engTxt) + "</b></div>" +
            '<div class="sd-row"><span>采样</span><b>' + escapeHtml(sampleTxt) + "</b></div>" +
            '<div class="sd-row"><span>来源</span><b>' + escapeHtml(kindTxt) + "</b></div>" +
            '<div class="sd-row"><span>分享率</span><b>' + escapeHtml(s.ratio) + "</b></div>" +
          "</div>" +
          '<div class="sd-block"><h4>抓取</h4>' +
            '<div class="sd-row"><span>上次结果</span><b class="' + lastRes[1] + '-t">' + lastRes[0] + "</b></div>" +
            '<div class="sd-row"><span>今日已跑</span><b>' + runsToday + " 轮</b></div>" +
            '<div class="sd-row"><span>方式</span><b>' + modeTxt + "</b></div>" +
            '<div class="sd-row"><span>范围</span><b>' + catTxt + "</b></div>" +
          "</div>" +
          "</div>" +
          '<div class="sd-recent-wrap"><h4>最近收录</h4>' +
            recs.map(function (r) {
              return '<div class="sd-recent"><span class="t-main">' + escapeHtml(r.title) + "</span>" +
                '<span class="soft">' + escapeHtml(r.size) + "</span>" +
                '<span class="soft">' + escapeHtml(r.time) + "</span></div>";
            }).join("") +
          "</div>" +
        "</div>";
    }

    var CATS = [["movie", "电影"], ["tv", "剧集"], ["show", "综艺"], ["anime", "动漫"],
      ["doc", "纪录"], ["music", "音乐"], ["sport", "体育"], ["other", "其他"]];
    var RES = [["any", "不限"], ["720p", "720p 及以上"], ["1080p", "1080p 及以上"], ["2160p", "2160p 及以上"]];

    var SET_TABS = [["basic", "基本信息"], ["login", "登录"], ["search", "搜索预设"], ["override", "站点覆盖"]];

    function settingsHtml(s) {
      var opts = ["NP", "UNIT3D", "GZ", "OTHER", "?"].map(function (k) {
        return '<option value="' + k + '"' + ((s.arch || "?") === k ? " selected" : "") + ">" + ACH[k][1] + "</option>";
      }).join("");
      var method = s.loginMethod || "password";
      var mode = s.mode || "incr";
      var tab = state.setTab || "basic";
      var body = "";

      if (tab === "basic") {
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "启用抓取", type: "switch", k: "enabled", on: s.enabled },
          { t: "站点地址", type: "text", k: "url", v: s.url },
          { t: "架构", type: "select", k: "arch", v: s.arch || "?", opts: ["NP", "UNIT3D", "GZ", "OTHER", "?"], labels: { NP: "NexusPHP", UNIT3D: "UNIT3D", GZ: "Gazelle", OTHER: "其它", "?": "未确认" } },
          { t: "备注", type: "textarea", k: "note", v: s.note || "" }
        ]) + "</div>";
      } else if (tab === "override") {
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "单独设置本站", type: "switch", k: "override", on: s.override, hint: s.override ? "只影响这个站" : "关闭即跟随流程页" }
        ]) + "</div>" +
        '<div class="set-fields' + (s.override ? "" : " is-off") + '">' + setRowsHtml([
          { t: "抓取间隔", type: "select", k: "ovInterval", v: s.ovInterval || "跟随全局", opts: ["跟随全局", "1 分钟", "5 分钟", "15 分钟", "1 小时"] },
          { t: "每日上限", type: "text", k: "ovDaily", v: s.ovDaily || "", ph: "留空＝用全局值" },
          { t: "抓详情页", type: "switch", k: "ovDetail", on: s.ovDetail },
          { t: "优先级", type: "select", k: "priority", v: s.priority || "normal", opts: ["high", "normal", "low"], labels: { high: "高（先抓）", normal: "普通", low: "低（最后抓）" } }
        ]) + "</div>" +
        '<div class="set-fields">' + setRowsHtml([
          { t: "分类映射", type: "button", cls: "map-row", v: (catMapCount(s.name) ? "已配 " + catMapCount(s.name) + " 条" : "配置映射"), hint: "站点自己的分类对到库内分类，不受上面的开关影响" }
        ]) + "</div>";
      } else if (tab === "search") {
        var pdetail = s.presetDetail;
        var psum = presetOf(s.name) || {};
        var dfn = defOf(s.name);
        var sEng = (pdetail && pdetail.engine) || psum.engine || "";
        var catGroups = pdetail && pdetail.cats ? pdetail.cats : null;
        var catLines = catGroups ? Object.keys(catGroups).map(function (g) {
          return '<div class="sd-row"><span>' + escapeHtml(g) + "</span><b>" + escapeHtml((catGroups[g] || []).join(", ") || "—") + "</b></div>";
        }).join("") : "";
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "引擎", type: "fixed", v: sEng ? (engCode(sEng) + " · " + sEng) : "未识别", noTag: true },
          { t: "预设来源", type: "fixed", v: pdetail ? (pdetail.source === "auto" ? "采样自动生成，还没人工确认" : pdetail.source === "arch" ? "按清单架构推断，还没采样" : (pdetail.source || "手填")) : "还没有预设", noTag: true },
          { t: "分类参数", type: "fixed", v: (pdetail && pdetail.catMode ? pdetail.catMode : "—") + (pdetail && pdetail.catParam ? " · " + pdetail.catParam : ""), noTag: true }
        ]) + "</div>" +
        '<div class="set-fields"><div class="sd-block"><h4>分类 id</h4>' +
          (catLines || '<div class="sd-row"><span>状态</span><b>还没有分类映射</b></div>') +
        "</div></div>" +
        (function () {
          var urls = s.presetUrls || [];
          if (!urls.length) return "";
          return '<div class="set-fields"><div class="sd-block"><h4>搜索链接预览</h4>' +
            urls.slice(0, 6).map(function (u) {
              var tag = (u.group || "全部") + (u.catId ? " · " + u.catId : "");
              return '<a class="sd-preset-url" href="' + escapeHtml(u.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(tag) + " → " + escapeHtml(u.url.replace(/^https?:\/\//, "")) + "</a>";
            }).join("") +
            '<div class="sd-row"><span>说明</span><b>点开就是该站真实搜索页，确认分类对不对</b></div>' +
          "</div></div>";
        })() +
        '<div class="sd-cookie-bar">' +
          (pdetail && pdetail.confirmed ? "" : '<button class="btn ghost slim" id="sd-preset-confirm">确认这个预设</button>') +
          '<span class="sd-cookie-res" id="sd-preset-res">' +
          (pdetail ? (pdetail.confirmed ? "已人工确认 · " : "更新于 ") + escapeHtml(pdetail.updatedAt || "—") : "打开这个页签时读一次服务端预设") +
        "</span></div>" +
        '<div class="sd-cookie-bar"><span class="sd-cookie-res">' +
          (!pdetail || !pdetail.cats || !Object.keys(pdetail.cats).length
            ? (dfn && dfn.kind === "shell"
              ? "这个站的列表由脚本渲染，源码里没有分类：在浏览器登录后把种子页存到 pta/data/manual 再跑 ingest-manual"
              : "还没采到分类 id：登录后存种子页到 pta/data/manual，或等下次补采")
            : "分类来自采样，对照站点没问题就点确认，来源会改成手动") +
        "</span></div>";
      } else {
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "登录方式", type: "fixed", v: "Cookie（从浏览器导入或用下面的输入框粘贴）", noTag: true, hint: "账号密码与 2FA 已不再使用" }
        ]) + "</div>" +
        '<div class="set-fields">' + setRowsHtml([
          { t: "Cookie", type: "textarea", k: "cookie", v: s.cookie || "", ph: "c_secure_uid=...; c_secure_pass=..." }
        ]) + "</div>" +
        '<div class="sd-cookie-bar"><button class="btn ghost slim" id="sd-cookie-test">用已保存的 cookie 自检</button>' +
        '<span class="sd-cookie-res" id="sd-cookie-res">还没自检</span></div>';
      }

      return '<div class="sd-form">' + body + "</div>";
    }

    function collect(s) {
      detail.querySelectorAll("[data-k]").forEach(function (el) {
        var k = el.getAttribute("data-k");
        if (!k || k === "undefined") return;
        s[k] = (el.value !== undefined ? el.value : el.textContent).trim();
      });
      detail.querySelectorAll("[data-switch]").forEach(function (el) {
        var k = el.getAttribute("data-switch");
        if (k) s[k] = el.classList.contains("on");
      });
      var chips = detail.querySelectorAll(".cat-chip.on");
      if (chips.length) s.cats = [].map.call(chips, function (c) { return c.getAttribute("data-cat"); });
      return s;
    }

    function actionsHtml() {
      return '<div class="sd-form-actions">' +
        '<button class="btn primary slim" data-act="save">保存设置</button>' +
        '<button class="btn ghost slim" data-act="reset">恢复默认</button>' +
        '<div class="spacer"></div>' +
        '<button class="btn ghost slim danger" data-act="remove">移除站点</button>' +
      "</div>";
    }

    function paintDetail() {
      var s = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
      if (s && state.setTab === "search" && window.fetch && /^https?:$/.test(location.protocol) && !s.presetLoaded) {
        s.presetLoaded = true;
        fetch("/api/sites/" + encodeURIComponent(s.name) + "/search", { credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            if (!j || !j.ok) return;
            s.presetDetail = (j.data && j.data.preset) || null;
            s.presetUrls = (j.data && Array.isArray(j.data.urls)) ? j.data.urls : [];
            if (state.sel === s.name) paint();
          })
          .catch(function () { s.presetLoaded = false; });
      }
      if (s && state.setTab === "login" && window.__ptaCred && !s.cookieChecked) {
        s.cookieChecked = true;
        window.__ptaCred.req("").then(function (res) {
          if (!res || !res.j || !res.j.ok || !Array.isArray(res.j.data)) return;
          var hit = res.j.data.filter(function (c) { return c.host === s.name; })[0];
          s.cookieSaved = !!(hit && hit.hasCookie);
          if (state.sel === s.name) paint();
        });
      }
      if (!detail) return;
      if (!s || !state.open) { detail.hidden = true; detail.innerHTML = ""; return; }
      detail.hidden = false;
      detail.innerHTML = headHtml(s) +
        (state.tab === "settings"
          ? '<div class="sd-scroll">' + settingsHtml(s) + "</div>" + actionsHtml()
          : '<div class="sd-scroll">' + overviewHtml(s) + "</div>");
    }

    function presetStats() {
      var p = window.__ptaPresets || {};
      var hosts = Object.keys(p), confirmed = 0, withCats = 0;
      hosts.forEach(function (h) {
        var x = p[h] || {};
        if (x.confirmed) confirmed++;
        if (x.ids) withCats++;
      });
      return { total: hosts.length, confirmed: confirmed, withCats: withCats };
    }

    function coverageStats() {
      var defs = window.__ptaDefs || {};
      var hosts = Object.keys(defs);
      var verified = 0, eng = {};
      hosts.forEach(function (h) {
        var d = defs[h] || {};
        if ((d.rows || 0) > 0) verified++;
        eng[d.engine || "?"] = (eng[d.engine || "?"] || 0) + 1;
      });
      return { total: hosts.length, verified: verified, eng: eng };
    }

    function renderStats() {
      var host = $("#sites-stats");
      if (!host) return;
      var st = siteStats(MOCK.sitesList);
      var order = ["NP", "UNIT3D", "GZ", "OTHER", "?"];
      var names = { NP: "NexusPHP", UNIT3D: "UNIT3D", GZ: "Gazelle", OTHER: "其它", "?": "未确认" };
      var count = { NP: st.np, UNIT3D: st.unit3d, GZ: st.gz, OTHER: st.oth, "?": st.unk };
      var total = st.total || 1;
      var colors = { NP: "#4f46e5", UNIT3D: "#6b62e8", GZ: "#8b84ee", OTHER: "#b3adf3", "?": "#c9cedb" };
      var segs = order.filter(function (k) { return count[k]; }).map(function (k) {
        return '<i class="seg" style="width:' + (count[k] / total * 100).toFixed(2) + '%;background:' + colors[k] + '"></i>';
      }).join("");
      var legend = order.filter(function (k) { return count[k]; }).map(function (k) {
        return '<span><i class="dot" style="background:' + colors[k] + '"></i>' + names[k] + " " + count[k] + "</span>";
      }).join("");
      host.innerHTML =
        '<div class="ss-nums">' +
          '<div><span>总站点</span><b>' + st.total + "</b></div>" +
          '<div><span>启用</span><b>' + st.enabled + "</b></div>" +
          '<div><span>登录失效</span><b class="warn">' + st.loginFail + "</b></div>" +
          '<div><span>分享率不足</span><b class="bad">' + st.lowRatio + "</b></div>" +
        "</div>" +
        '<div class="ss-arch"><div class="ss-bar">' + segs + "</div>" +
          '<div class="ss-legend">' + legend + "</div></div>" +
        (function () {
          var cov = coverageStats();
          if (!cov.total) return "";
          return '<div class="ss-cov">已适配 ' + cov.total + ' 站 · 采样成功 ' + cov.verified +
            ' 站（NP ' + (cov.eng.nexusphp || 0) + ' · U3D ' + (cov.eng.unit3d || 0) +
            ' · GZ ' + (cov.eng.gazelle || 0) + ' · 兜底 ' + (cov.eng.custom || 0) + '）' +
            (function () {
              var ps = presetStats();
              if (!ps.total) return "";
              return ' · 预设：已确认 ' + ps.confirmed + ' · 有分类 ' + ps.withCats + ' · 待补 ' + (ps.total - ps.withCats);
            })() + "</div>";
        })();
    }

    function paint() {
      var rows = filtered();
      var order = ["NP", "UNIT3D", "GZ", "OTHER", "?"];
      var names = { NP: "NexusPHP", UNIT3D: "UNIT3D", GZ: "Gazelle", OTHER: "其它", "?": "未确认" };
      var groups = {};
      rows.forEach(function (s) { groups[s.name] = s; });
      list.innerHTML = rows.map(itemHtml).join("") || '<div class="sites-empty">没有匹配的站点</div>';
      var pager = $("#sites-pager");
      if (pager) pager.innerHTML = "";
      var cnt = $("#sites-count");
      if (cnt) cnt.textContent = MOCK.sitesList.length;
      var hint = $("#sites-hint");
      if (hint) hint.textContent = rows.length === MOCK.sitesList.length ? "全部" : "匹配 " + rows.length + " 个";
      renderStats();
      if (state.open && state.sel) {
        var row = list.querySelector('.site-item[data-host="' + String(state.sel).replace(/"/g, '\\"') + '"]');
        if (row) { row.insertAdjacentElement("afterend", detail); detail.hidden = false; }
        else { state.open = false; list.appendChild(detail); detail.hidden = true; }
      } else {
        list.appendChild(detail);
        detail.hidden = true;
      }
      paintDetail();
      refreshBulk();
    }

    function refreshStats() {
      MOCK.sites = siteStats(MOCK.sitesList);
      var st = MOCK.sites;
      var tabs = $("#site-status");
      if (tabs) {
        var nums = { all: st.total, on: st.enabled, off: st.total - st.enabled };
        $$("button[data-status]", tabs).forEach(function (b) {
          var i = b.querySelector("i");
          if (i) i.textContent = nums[b.getAttribute("data-status")];
        });
      }
      if (window.__ptaSetActive) window.__ptaSetActive(current);
    }

    function persist() {
      if (!window.__ptaStore) return;
      window.__ptaStore.save();
    }

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !state.open) return;
      state.open = false;
      paint();
    });

    /* ---- 列表交互 ---- */
    list.addEventListener("click", function (e) {
      if (e.target.classList && e.target.classList.contains("site-pick")) return;
      var it = e.target.closest(".site-item");
      if (!it) return;
      var host = it.getAttribute("data-host");
      if (state.open && state.sel === host) {
        state.open = false;
        paint();
        return;
      }
      state.sel = host;
      state.open = true;
      paint();
    });

    var q = $("#site-q");
    if (q) q.addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); state.page = 1; paint(); });

    var tabs = $("#site-status");
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-status]");
      if (!b) return;
      state.status = b.getAttribute("data-status");
      state.page = 1;
      $$("button", tabs).forEach(function (x) { x.classList.toggle("active", x === b); });
      paint();
    });

    var archSel = $("#site-arch");
    if (archSel) archSel.addEventListener("change", function (e) { state.arch = e.target.value; state.page = 1; paint(); });
    var loginSel = $("#site-login");
    if (loginSel) loginSel.addEventListener("change", function (e) { state.login = e.target.value; state.page = 1; paint(); });
    var presetSel = $("#site-preset");
    if (presetSel) presetSel.addEventListener("change", function (e) { state.preset = e.target.value; state.page = 1; paint(); });

    /* ---- 详情交互 ---- */
    if (detail) detail.addEventListener("change", function (e) {
      var dk = e.target.getAttribute && e.target.getAttribute("data-k");
      if (dk === "loginMethod" || dk === "mode" || dk === "trigger") {
        var cur = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
        if (cur) { collect(cur); paintDetail(); }
      }
    });
    if (detail) detail.addEventListener("click", function (e) {
      if (e.target.closest('[data-act="close-sheet"]')) {
        state.open = false;
        paint();
        return;
      }
      var stab = e.target.closest("button[data-settab]");
      if (stab) {
        var cur0 = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
        if (cur0) collect(cur0);
        state.tab = "settings";
        state.setTab = stab.getAttribute("data-settab");
        paintDetail();
        return;
      }
      var tab = e.target.closest("button[data-tab]");
      if (tab) { state.tab = tab.getAttribute("data-tab"); paintDetail(); return; }

      var cat = e.target.closest(".cat-chip");
      if (cat) { cat.classList.toggle("on"); return; }

      var mapBtn = e.target.closest("button[data-btn]");
      if (mapBtn) {
        var cs2 = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
        openCatMap({
          host: state.sel,
          label: (cs2 && (cs2.title || cs2.name)) || state.sel,
          cats: siteCatNames(cs2),
          after: function () { paintDetail(); }
        });
        return;
      }

      var sw = e.target.closest("button[data-switch]");
      if (sw) {
        sw.classList.toggle("on");
        var sk = sw.getAttribute("data-switch");
        if (sk === "override" || sk === "timeWindow") {
          var cs = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
          if (cs) { collect(cs); paintDetail(); }
        }
        return;
      }

      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var s = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
      if (!s) return;

      if (e.target.closest && e.target.closest("#sd-preset-confirm")) {
        var prBox = $("#sd-preset-res");
        var sNow = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
        if (!sNow) return;
        if (!window.fetch || !/^https?:$/.test(location.protocol)) {
          if (prBox) prBox.textContent = "本地预览没有后端，确认不可用";
          toast("本地预览没有后端，确认不可用");
          return;
        }
        if (prBox) prBox.textContent = "正在确认…";
        fetch("/api/sites/" + encodeURIComponent(sNow.name) + "/search", {
          method: "PUT", credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmed: true, source: "manual" })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (!j || !j.ok) {
            var m = (j && j.error && j.error.message) || "确认失败";
            if (prBox) prBox.textContent = m;
            toast(m);
            return;
          }
          sNow.presetDetail = j.data.preset;
          sNow.presetLoaded = true;
          if (prBox) prBox.textContent = "已确认，来源改为手动";
          toast("预设已确认");
          if (window.__ptaLoadPresets) window.__ptaLoadPresets();
          paintDetail();
        }).catch(function () {
          if (prBox) prBox.textContent = "确认失败：连不上后端";
        });
        return;
      }
      if (e.target.closest && e.target.closest("#sd-cookie-test")) {
        var resBox = $("#sd-cookie-res");
        if (resBox) resBox.textContent = "正在用已保存的 cookie 访问首页…";
        fetch("/api/sites/" + encodeURIComponent(s.name) + "/session-test", { method: "POST", credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j || !j.ok) {
              var msg = (j && j.error && j.error.message) || "自检失败";
              if (resBox) resBox.textContent = msg;
              toast(msg);
              return;
            }
            var d = j.data, st = (d.steps || [])[0] || {};
            var txt = (d.pass ? "cookie 可用" : "cookie 已失效") + " · HTTP " + (st.status || "—") +
              (st.ms !== undefined ? " · " + st.ms + "ms" : "") + (st.error ? " · " + st.error : "");
            if (resBox) resBox.textContent = txt;
            toast(txt);
          })
          .catch(function () {
            if (resBox) resBox.textContent = "本地预览没有后端，自检不可用";
            toast("本地预览没有后端，自检不可用");
          });
        return;
      }
      if (act === "selfcheck") {
        if (btn.disabled) return;
        var oldTxt = btn.textContent;
        btn.disabled = true;
        btn.textContent = "自检中…";
        var setLine = function (msg) {
          s.checkAt = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
          s.checkMsg = msg;
          var line = $("#sd-selfcheck");
          if (line) line.textContent = "上次自检 " + s.checkAt + " · " + msg;
        };
        window.__ptaDryRun(s.name, function (t) {
          if (t.state === "running" || t.state === "queued") {
            setLine("跑第 " + (t.progress || 0) + "%");
          }
        }, function (t) {
          btn.disabled = false;
          btn.textContent = oldTxt;
          var plan = (t.result && t.result.plan) || {};
          var warns = (t.result && t.result.warnings) || [];
          var msg = "预估 " + (plan.estimatedQueries || 0) + " 次查询" +
            (plan.catGroups ? " · 分类 " + plan.catGroups + " 组" : "") +
            (warns.length ? " · " + warns.length + " 条提示" : " · 没有发现问题");
          setLine(msg);
          toast("自检完成：" + msg);
        }, function (err) {
          btn.disabled = false;
          btn.textContent = oldTxt;
          setLine(err);
          toast(err);
        });
        return;
      }
      if (act === "login") { toast("重新登录：" + (s.title || s.name) + "（假数据）"); return; }

      if (act === "save") {
        collect(s);
        var pendingCookie = String(s.cookie || "").trim();
        delete s.cookie;                    /* cookie 不进 localStorage，只走服务端密文 */
        window.__ptaStore.set(s.name, s);
        persist(); refreshStats(); paint();
        if (!pendingCookie) { toast("设置已保存"); return; }
        window.__ptaCred.req(s.name, "PUT", { cookie: pendingCookie }).then(function (res) {
          if (res && res.j && res.j.ok) { s.cookieSaved = true; toast("设置与 cookie 都已保存"); }
          else toast((res && res.j && res.j.error && res.j.error.message) || "cookie 没存进服务端");
          paint();
        });
        return;
      }
      if (act === "reset") {
        var d = window.__ptaDefaults[s.name];
        if (d) for (var k in d) s[k] = d[k];
        window.__ptaStore.reset(s.name);
        persist(); refreshStats(); paint(); toast("已恢复默认");
        return;
      }
      if (act === "remove") {
        MOCK.sitesList = MOCK.sitesList.filter(function (x) { return x.name !== s.name; });
        window.__ptaStore.remove(s.name);
        persist(); refreshStats();
        state.sel = null; paint(); toast("已移除：" + s.name);
      }
    });

    function pickedSites() {
      return MOCK.sitesList.filter(function (s) { return state.picks.indexOf(s.name) >= 0; });
    }
    function refreshBulk() {
      var rows = filtered();
      var picked = rows.filter(function (x) { return state.picks.indexOf(x.name) >= 0; }).length;
      var head = $("#site-all");
      if (head) {
        head.checked = rows.length > 0 && picked === rows.length;
        head.indeterminate = picked > 0 && picked < rows.length;
      }
      var openBtn = $("#bulk-open");
      if (openBtn) {
        openBtn.disabled = state.picks.length === 0;
        openBtn.textContent = state.picks.length ? "批量设置（" + state.picks.length + "）" : "批量设置";
      }
    }

    var headAll = $("#site-all");
    if (headAll) headAll.addEventListener("change", function () {
      var rows = filtered();
      if (headAll.checked) rows.forEach(function (x) { if (state.picks.indexOf(x.name) < 0) state.picks.push(x.name); });
      else state.picks = state.picks.filter(function (n) { return !rows.some(function (x) { return x.name === n; }); });
      paint();
    });

    list.addEventListener("change", function (e) {
      if (!e.target.classList || !e.target.classList.contains("site-pick")) return;
      var h = e.target.getAttribute("data-host");
      if (e.target.checked) { if (state.picks.indexOf(h) < 0) state.picks.push(h); }
      else state.picks = state.picks.filter(function (x) { return x !== h; });
      refreshBulk();
    });

    var pager = $("#sites-pager");
    if (pager) pager.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-pg]");
      if (!b) return;
      state.page += Number(b.getAttribute("data-pg"));
      paint();
    });

    var bToggle = $("#bulk-toggle"), bOpen = $("#bulk-open"), bAll = null, bNone = null;
    if (bToggle) bToggle.addEventListener("click", function () {
      var rows = filtered();
      var allPicked = rows.length > 0 && rows.every(function (x) { return state.picks.indexOf(x.name) >= 0; });
      if (allPicked) state.picks = state.picks.filter(function (n) { return !rows.some(function (x) { return x.name === n; }); });
      else rows.forEach(function (x) { if (state.picks.indexOf(x.name) < 0) state.picks.push(x.name); });
      refreshBulk(); paint();
    });
    if (bAll) bAll.addEventListener("click", function () {});
    if (bNone) bNone.addEventListener("click", function () { state.picks = []; refreshBulk(); paint(); });

    function initBulkModal() {
      var mask = $("#bulk-modal");
      if (!mask) return;
      if (bOpen) bOpen.addEventListener("click", function () {
        $("#bulk-count").textContent = state.picks.length;
        mask.hidden = false;
      });
      $("#bulk-x").addEventListener("click", function () { mask.hidden = true; });
      $("#bulk-cancel").addEventListener("click", function () { mask.hidden = true; });
      mask.addEventListener("click", function (e) { if (e.target === mask) mask.hidden = true; });
      $("#bulk-ok").addEventListener("click", function () {
        var ovr = $("#bm-ovr").value, iv = $("#bm-iv").value;
        var daily = $("#bm-daily").value.trim(), det = $("#bm-det").value, prio = $("#bm-prio").value;
        var list2 = pickedSites();
        list2.forEach(function (x) {
          if (ovr !== "keep") x.override = ovr === "on";
          if (iv !== "keep") x.ovInterval = iv;
          if (daily) x.ovDaily = daily;
          if (det !== "keep") x.ovDetail = det === "on";
          if (prio !== "keep") x.priority = prio;
          window.__ptaStore.set(x.name, x);
        });
        window.__ptaStore.save();
        mask.hidden = true;
        state.picks = [];
        refreshBulk();
        paint();
        toast("已应用到 " + list2.length + " 个站点");
      });
    }

    window.__ptaRefresh = function (host) {
      if (host) state.sel = host;
      refreshStats();
      paint();
    };
    /* 站点清单被替换（服务端拉取/新增/移除）后外部重绘入口 */
    window.__ptaRepaintSites = function () {
      if (!MOCK.sitesList.some(function (x) { return x.name === state.sel; })) { state.sel = null; state.open = false; }
      state.picks = state.picks.filter(function (h) {
        return MOCK.sitesList.some(function (x) { return x.name === h; });
      });
      refreshStats();
      paint();
    };

    initBulkModal();
    refreshBulk();
    refreshStats();
    paint();
    if (window.__ptaLoadPresets) window.__ptaLoadPresets();
    if (window.__ptaLoadDefs) window.__ptaLoadDefs();
    if (window.__ptaLoadOverview) window.__ptaLoadOverview();
  }

  /* ---------- 站点：新增弹窗 + 本地保存 ---------- */
  function initSiteModal() {
    var mask = $("#site-modal");
    if (!mask) return;
    var url = $("#ns-url"), arch = $("#ns-arch"), note = $("#ns-note");

    function open() {
      url.value = ""; note.value = ""; arch.value = "auto";
      mask.hidden = false;
      setTimeout(function () { url.focus(); }, 30);
    }
    function close() { mask.hidden = true; }

    $$("[data-act='new-site']").forEach(function (b) { b.addEventListener("click", open); });
    $("#site-modal-x").addEventListener("click", close);
    $("#site-modal-cancel").addEventListener("click", close);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !mask.hidden) close(); });

    $("#site-modal-ok").addEventListener("click", function () {
      var raw = url.value.trim();
      if (!raw) { toast("先填站点地址"); return; }
      if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
      var host;
      try { host = new URL(raw).hostname.replace(/^www\./, ""); } catch (e) { toast("地址格式不对"); return; }
      if (MOCK.sitesList.some(function (s) { return s.name === host; })) { toast("这个站点已经在列表里了"); return; }
      var a = arch.value === "auto" ? (/index\.php/.test(raw) ? "NP" : "?") : arch.value;
      var site = window.__ptaStore.add({
        url: raw, host: host, brand: host.replace(/^pt\./, "").replace(/[^a-z0-9]/gi, "").slice(0, 2),
        name: host, arch: a, note: note.value.trim()
      });
      MOCK.sitesList.push(site);
      window.__ptaStore.set(site.name, site);
      if (window.__ptaRefresh) window.__ptaRefresh(site.name);
      close();
      toast("已添加：" + host);
    });
  }

  /* ---------- 无刷新路由：同一文档内切换视图 ---------- */
  var VIEW_META = {
    dashboard: {
      title: "总览", sub: "A 机控制面",
      pills: function () {
        var on = MOCK.nodes.filter(function (n) { return n.online; }).length;
        var fail = MOCK.sites.loginFail || 0;
        return '<span class="pill"><span class="dot ok"></span>服务运行中</span>' +
          '<span class="pill"><span class="dot warn"></span>' + fail + " 个站登录失效</span>" +
          '<span class="pill"><span class="dot ok"></span>节点 ' + on + " / " + MOCK.nodes.length + "</span>";
      }
    },
    sites: {
      title: "站点",
      sub: function () { return MOCK.sites.total + " 个站点 · 抓取和登录都在这配"; },
      pills: ""
    },
    crawl: {
      title: "流程", sub: "抓取、查重、发布与下载器",
      pills: ""
    },
    queue: {
      title: "待审核", sub: "确认后才会发到主站",
      pills: ""
    },
    sources: {
      title: "数据清单", sub: "站点抓到的原盘都在这",
      pills: ""
    },
    logs: {
      title: "日志", sub: "最近 200 行",
      pills: ""
    },
    settings: {
      title: "设置", sub: "面板账号、通知与系统",
      pills: ""
    }
  };
  function statusPills() {
    var h = (typeof API !== "undefined" && API && API.mode === "live" && API.health) || null;
    var on = h && h.nodesOnline != null ? h.nodesOnline : MOCK.nodes.filter(function (n) { return n.online; }).length;
    var totalNodes = h && h.nodesTotal != null ? h.nodesTotal : MOCK.nodes.length;
    var fail = h && h.loginFail != null ? h.loginFail : (MOCK.sites.loginFail || 0);
    var live = !!h;
    return '<span class="pill"><span class="dot ' + (live ? "ok" : "idle") + '"></span>' + (live ? "服务运行中" : "本地演示") + '</span>' +
      '<span class="pill"><span class="dot warn"></span>' + fail + ' 个站登录失效</span>' +
      '<span class="pill"><span class="dot ok"></span>节点 ' + on + " / " + totalNodes + "</span>";
  }
  Object.keys(VIEW_META).forEach(function (k) { VIEW_META[k].pills = statusPills; });

  var current = VIEW_META[PAGE] ? PAGE : "dashboard";
  window.__ptaSetActive = function (k) { setActive(k); };

  function setActive(key) {
    $$(".dock-item, .menu-link").forEach(function (a) {
      if (a.getAttribute("data-view") === key) a.classList.add("active");
      else a.classList.remove("active");
    });
    var meta = VIEW_META[key];
    var title = typeof meta.title === "function" ? meta.title() : meta.title;
    var sub = typeof meta.sub === "function" ? meta.sub() : meta.sub;
    var pills = typeof meta.pills === "function" ? meta.pills() : meta.pills;
    var t = $("#page-title"); if (t) t.textContent = title;
    var sb = $("#page-sub"); if (sb) sb.textContent = sub || "";
    var p = $("#page-pills"); if (p) p.innerHTML = pills || "";
    document.title = title + " · 媒体资料库";
  }

  function go(key, opts) {
    opts = opts || {};
    if (!VIEW_META[key]) key = "dashboard";
    if (key === current && !opts.force) {
      if (location.hash !== "#" + key) history.pushState({ view: key }, "", "#" + key);
      return;
    }
    $$(".view").forEach(function (v) {
      var on = v.getAttribute("data-view") === key;
      v.hidden = !on;
      v.classList.toggle("active", on);
    });
    current = key;
    setActive(key);
    if (key === "dashboard" && typeof renderDashboard === "function") renderDashboard();
    if (!opts.pop) {
      if (opts.replace) history.replaceState({ view: key }, "", "#" + key);
      else history.pushState({ view: key }, "", "#" + key);
    }
    window.scrollTo(0, 0);
    var m = $("#menu"); if (m) m.classList.remove("open");
  }

  function initRouter() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var key = a.getAttribute("href").slice(1).split("?")[0];
      if (!VIEW_META[key]) return;
      e.preventDefault();
      go(key);
    });
    window.addEventListener("popstate", function () {
      var key = (location.hash || "#dashboard").slice(1);
      go(VIEW_META[key] ? key : "dashboard", { pop: true, force: true });
    });
    var start = (location.hash || "").slice(1);
    go(VIEW_META[start] ? start : current, { force: true, pop: true });
  }

/* ---------- 运行时：后端连接 / 实时日志 ---------- */


  /* 后端连接：有 /api/health 就切到实时，没有就留在本地演示 */
  var API = {
    mode: "mock",
    health: null,
    connectedAt: 0,
    probe: function () {
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 1500) : null;
      var opts = { cache: "no-store" };
      if (ctrl) opts.signal = ctrl.signal;
      return fetch("api/health", opts).then(function (r) {
        if (!r.ok) throw new Error("bad status " + r.status);
        return r.json();
      }).then(function (j) {
        if (j && j.ok === false) throw new Error("health reported failure");
        API.mode = "live";
        API.health = j && j.data ? j.data : (j || {});
        API.connectedAt = Date.now();
      }).catch(function () {
        API.mode = "mock";
        API.health = null;
      }).then(function () {
        if (timer) clearTimeout(timer);
        refreshPills();
        if (typeof LOG_STREAM !== "undefined" && LOG_STREAM.startLive) LOG_STREAM.startLive();
        if (typeof window.__ptaAfterProbe === "function") window.__ptaAfterProbe();
      });
    },
    getConfig: function () {
      return fetch("api/config", { cache: "no-store" })
        .then(function (r) { return r.json(); });
    },
    patchConfig: function (body) {
      return fetch("api/config/user", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json(); });
    }
  };

  function refreshPills() {
    if (window.__ptaSetActive) window.__ptaSetActive(current);
    var pills = document.querySelector("#page-pills");
    if (!pills) return;
    var live = API.mode === "live";
    pills.title = live ? "已连接后端，数据实时" : "未检测到后端，当前为本地演示数据";
    var first = pills.querySelector(".pill");
    if (first) {
      var dot = first.querySelector(".dot");
      if (dot) { dot.className = "dot " + (live ? "ok" : "idle"); }
      first.lastChild.nodeValue = live ? "服务运行中" : "本地演示";
    }
  }

  /* 实时日志：本地演示按节奏追加，接后端后可换成 SSE/轮询 */
  var LOG_STREAM = {
    timer: null,
    templates: [],
    now: function () {
      var d = new Date();
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    },
    push: function (item) {
      if (!item) return;            /* 只显示服务端推来的日志 */
      var t = item;
      var line = { t: t.t || this.now(), lvl: t.lvl, tag: t.tag, msg: t.msg };
      MOCK.logs.unshift(line);
      if (MOCK.logs.length > 80) MOCK.logs.length = 80;
      if (window.__ptaRepaintLogs) window.__ptaRepaintLogs();
      var dash = document.querySelector("#dash-logs");
      if (dash && typeof renderDashboard === "function" && !document.querySelector('.view[data-view="logs"].active')) {
        var lg = document.querySelector("#dash-logs");
        if (lg) {
          lg.innerHTML = MOCK.logs.slice(0, 4).map(function (l) {
            return '<div class="list-item ' + l.lvl + '"><span class="time">' + l.t + '</span><span class="msg">' + escapeHtml(l.msg) + "</span></div>";
          }).join("");
        }
      }
    },
    start: function () {
      var self = this;
      if (this.timer) return;
      this.timer = setInterval(function () { self.push(); }, 6500);
    },
    lastId: 0,
    startLive: function () {
      var self = this;
      if (this.es || !window.EventSource) return false;
      this.stop();
      this.es = new EventSource("api/logs/stream?last=" + (this.lastId || 0));
      this.es.onmessage = function (ev) {
        var d = null;
        try { d = JSON.parse(ev.data); } catch (e) { return; }
        if (d.id) {
          if (d.id <= self.lastId) return;
          self.lastId = d.id;
        }
        var hhmmss = "";
        if (d.ts) {
          var dt = new Date(d.ts);
          var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
          hhmmss = p2(dt.getHours()) + ":" + p2(dt.getMinutes()) + ":" + p2(dt.getSeconds());
        }
        self.push({
          t: hhmmss || self.now(),
          lvl: d.level === "warn" ? "warn" : d.level === "error" ? "error" : "info",
          tag: d.src || "服务",
          msg: d.msg || ""
        });
      };
      return true;
    },
    stopLive: function () {
      if (this.es) { this.es.close(); this.es = null; }
    },
    stop: function () { clearInterval(this.timer); this.timer = null; }
  };

  function initRuntime() {
    API.probe();
    setTimeout(function () { if (API.mode === "live") LOG_STREAM.startLive(); }, 900);
    setInterval(function () { API.probe(); }, 30000);
    refreshPills();
  }
  /* ---------- 登录 ---------- */
  var AUTH_KEY = "pta.session";
  /* 演示用的本地账号；正式版改成 POST /api/login，由服务端校验 */
  var AUTH_DEMO = { user: "admin", pass: "seedpod-6x2f" };

  var AUTH = {
    key: AUTH_KEY,
    login: function (u, p, remember) {
      return fetch("api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: u, pass: p })
      }).then(function (r) {
        return r.json().then(function (j) { return { status: r.status, body: j }; });
      }).then(function (res) {
        if (res.status === 200 && res.body && res.body.ok) { AUTH.save(u, remember); return { ok: true }; }
        if (res.status === 503) return { ok: false, msg: "服务端还没有设置面板账号" };
        if (res.status === 401) return { ok: false, msg: "用户名或密码不对" };
        return { ok: false, msg: "登录失败，稍后再试" };
      }).catch(function () {
        if (u === AUTH_DEMO.user && p === AUTH_DEMO.pass) { AUTH.save(u, remember); return { ok: true }; }
        return { ok: false, msg: "用户名或密码不对" };
      });
    },
    probe: function () {
      return fetch("api/session", { cache: "no-store" }).then(function (r) {
        return r.status === 200;
      }).catch(function () { return null; });
    },
    logout: function () {
      fetch("api/logout", { method: "POST" }).catch(function () {});
    },
    read: function () {
      try {
        return JSON.parse(sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY) || "null");
      } catch (e) { return null; }
    },
    save: function (user, remember) {
      var payload = JSON.stringify({ user: user, at: Date.now() });
      try {
        if (remember) { localStorage.setItem(AUTH_KEY, payload); sessionStorage.removeItem(AUTH_KEY); }
        else { sessionStorage.setItem(AUTH_KEY, payload); localStorage.removeItem(AUTH_KEY); }
      } catch (e) {}
    },
    clear: function () {
      try { localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
    },
    ok: function () { return !!AUTH.read(); }
  };

  function showLogin(next) {
    var mask = el("div", "login-mask");
    mask.id = "login-mask";
    mask.innerHTML =
      '<form class="login-card" id="login-form" autocomplete="on">' +
        '<div class="login-brand"><img src="assets/whale.png" alt=""><b>SEEDPOD</b><span>原盘转载面板</span></div>' +
        '<h2>登录</h2>' +
        '<label class="login-field"><span>用户名</span>' +
          '<input class="input" id="login-user" autocomplete="username" placeholder="admin"></label>' +
        '<label class="login-field"><span>密码</span>' +
          '<input class="input" id="login-pass" type="password" autocomplete="current-password" placeholder="">' +
        '</label>' +
        '<div class="login-row">' +
          '<button type="button" class="switch on" id="login-remember"><i></i></button>' +
          '<span>记住登录状态</span><em class="login-err" id="login-err"></em>' +
        '</div>' +
        '<button class="btn primary login-btn" type="submit" id="login-submit">登录</button>' +
      '</form>';
    document.body.appendChild(mask);
    var userEl = $("#login-user"), passEl = $("#login-pass"), errEl = $("#login-err");
    var remember = $("#login-remember");
    remember.addEventListener("click", function () { remember.classList.toggle("on"); });

    $("#login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var u = (userEl.value || "").trim();
      var p = passEl.value || "";
      if (!u || !p) { errEl.textContent = "用户名和密码都要填"; return; }
      errEl.textContent = "登录中…";
      var btn = $("#login-submit");
      btn.disabled = true;
      AUTH.login(u, p, remember.classList.contains("on")).then(function (res) {
        btn.disabled = false;
        if (res.ok) { mask.remove(); next(); return; }
        errEl.textContent = res.msg || "用户名或密码不对";
        mask.classList.remove("shake");
        void mask.offsetWidth;
        mask.classList.add("shake");
      });
    });
    setTimeout(function () { userEl.focus(); }, 60);
  }

  function initAuth(next) {
    AUTH.probe().then(function (serverAuthed) {
      if (serverAuthed === true) { next(); return; }
      if (serverAuthed === null && AUTH.ok()) { next(); return; }
      showLogin(next);
    });
  }

  function logout() {
    AUTH.logout();
    AUTH.clear();
    location.reload();
  }

  function boot() {
    initChrome();
    initNav();
    initMenu();
    initQueue();
    initSources();
    initNodes();
    initLogs();
    initSettings();
    initCrawlSettings();
    initSites();
    initSiteModal();
    initRouter();
    renderDashboard();
    initRuntime();
    if (typeof loadSitesFromApi === "function") loadSitesFromApi();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAuth(boot);
  });
})();