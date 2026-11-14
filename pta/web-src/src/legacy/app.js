/* SEEDPOD 面板：前端逻辑（无构建，直接跑在浏览器里） */
(function () {
  var PAGE = document.body.getAttribute("data-page") || "dashboard";

  var MOCK = {
    sites: null, /* 由站点清单实时算出 */
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
        enabled: true,
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
      unknown: on.filter(function (x) { return x.login === "none"; }).length,
      lowRatio: on.filter(function (x) { return x.lowRatio; }).length,
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
          override: s.override, ovInterval: s.ovInterval, ovDaily: s.ovDaily, ovDetail: s.ovDetail, priority: s.priority,
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
    /* 登录列始终以最近一次 cookie 自检为准，配置二次加载也不会被冲回「未自检」 */
    var stMap = window.__ptaSiteStatus || {};
    list.forEach(function (s) {
      var rec = stMap[s.name];
      s.login = rec ? (rec.pass ? "ok" : "fail") : "none";
      s.loginAt = rec ? rec.at : null;
    });
    var defs = {};
    list.forEach(function (x) { defs[x.name] = JSON.parse(JSON.stringify(x)); });
    window.__ptaDefaults = defs;
    window.PTA_SITES = list;
    MOCK.sitesList = list;
    MOCK.sites = siteStats(list);
    if (source) window.__ptaSiteSource = source;
    if (typeof window.__ptaRepaintSites === "function") window.__ptaRepaintSites();
    if (typeof window.__ptaFillCrawlSites === "function") window.__ptaFillCrawlSites();
    if (current === "dashboard" && typeof renderDashboard === "function") renderDashboard();
    return list.length;
  }
  window.__ptaApplySites = applySites;

  /* 演练任务：提交 -> 轮询进度。没有后端时立刻回错误，绝不发真实站点请求 */
  function submitDryRun(host, onStep, onDone, onErr) {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) {
      onErr("本地预览没有后端，演练不可用");
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
    }).catch(function () { onErr("本地预览没有后端，演练不可用"); });
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
      size: it.size || "", imdb: it.imdb || "—", site: it.site || "", targetSite: it.targetSite || "", status: it.status || "pending",
      intro: it.intro || "", anonymous: !!it.anonymous, imageHost: it.imageHost || "站内",
      check: it.check || "未查", checkCls: it.checkCls || "gray", reason: it.reason || "",
      shotsCount: Number(it.shotsCount) || (it.shots || []).length,
      shots: (it.shots || []).map(function (s, i) {
        /* 服务端现在存 {name,url}；老数据可能是字符串 */
        if (s && typeof s === "object") return { name: s.name || ("shot" + (i + 1)), url: s.url || "" };
        return { name: "shot" + (i + 1), url: s };
      }).filter(function (s) { return s.url; }),
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
        if (typeof window.__ptaRepaintSources === "function") window.__ptaRepaintSources();
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

  /* 顶栏三个状态：内容交给 Vue，显隐仍用 hidden 属性控制 */
  var pillState = window.Vue ? window.Vue.reactive({ online: false, pending: 0, downloaders: undefined }) : null;
  function mountPills() {
    if (!pillState || !window.Vue) return;
    var h = window.Vue.h;
    function mountOne(id, renderFn) {
      var el = $("#" + id);
      if (!el || el.getAttribute("data-vue") === "1") return;
      el.setAttribute("data-vue", "1");
      window.Vue.createApp({ render: function () { return renderFn(h); } }).mount(el);
    }
    mountOne("pill-service", function (h2) {
      return [h2("span", { class: "dot " + (pillState.online ? "ok" : "") }), pillState.online ? "后端已连接" : "未连接后端"];
    });
    mountOne("pill-pending", function (h2) {
      return [h2("span", { class: "dot warn" }), pillState.pending + " 条待审核"];
    });
    mountOne("pill-nodes", function (h2) {
      return [h2("span", { class: "dot ok" }), "下载器 " + (pillState.downloaders || 0)];
    });
  }
  function paintTopbar() {
    var svc = $("#pill-service");
    if (!svc) return;
    if (pillState) {
      pillState.online = window.__ptaSiteSource === "api";
      pillState.pending = (window.__ptaQueueCounts && window.__ptaQueueCounts.pending) || 0;
      pillState.downloaders = window.__ptaDownloaderCount;
    }
    var pend = $("#pill-pending"), nodes = $("#pill-nodes");
    if (pend) pend.hidden = !pillState.pending;
    if (nodes) nodes.hidden = pillState.downloaders === undefined;
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
        /* 登录列只反映最近一次 cookie 自检：通过=可用，失败=失效，没探过=未自检 */
        window.__ptaSiteStatus = j.data.status || {};
        if (typeof window.__ptaRepaintSites === "function") window.__ptaRepaintSites();
        if (window.__ptaPaintTopbar) window.__ptaPaintTopbar();
        if (typeof loadSiteCfgFromApi === "function") loadSiteCfgFromApi();
        loadCredsOnce();
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
    "timeWindow", "winStart", "winEnd", "jitter", "loginMethod", "username",
    "override", "ovInterval", "ovDaily", "ovDetail", "priority"
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

  /* 哪些站已经有 cookie：读一次 /api/credentials，只拿 hasCookie，标到站点上供抽屉显示 */
  function loadCredsOnce() {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    return fetch("/api/credentials", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.data)) return false;
        var have = {};
        j.data.forEach(function (c) { if (c && c.hasCookie) have[c.host] = true; });
        (window.PTA_SITES || []).forEach(function (s) { s.cookieSaved = !!have[s.name]; });
        if (typeof window.__ptaRepaintSites === "function") window.__ptaRepaintSites();
        return true;
      })
      .catch(function () { return false; });
  }
  window.__ptaLoadCreds = loadCredsOnce;

  applySites(siteRecordsFromLocal());

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  /* 下拉选项交给 Vue：同一个 select 只挂一次，之后换数据即可 */
  function vueOptions(sel, items) {
    if (!sel || !window.Vue) return;
    if (sel.__vueOpts) { sel.__vueOpts.items = items; return; }
    var st = window.Vue.reactive({ items: items });
    sel.__vueOpts = st;
    window.Vue.createApp({
      render: function () {
        var h = window.Vue.h;
        return st.items.map(function (o, i) { return h("option", { value: o.value, key: i }, o.label); });
      }
    }).mount(sel);
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

  /* 分类映射弹窗：由 Vue 渲染，状态在 catMapState 里 */
  var catMapState = window.Vue ? window.Vue.reactive({ title: "分类映射", sub: "", rows: [], host: "", after: null }) : null;
  var catMapMask = null;
  function ensureCatMap() {
    if (catMapMask || !catMapState) return;
    catMapMask = el("div", "modal-mask");
    catMapMask.id = "catmap-modal";
    catMapMask.hidden = true;
    document.body.appendChild(catMapMask);
    catMapMask.addEventListener("click", function (e) { if (e.target === catMapMask) catMapMask.hidden = true; });
    var h = window.Vue.h;
    window.Vue.createApp({
      render: function () {
        var self = catMapState;
        function close() { catMapMask.hidden = true; }
        function guess() {
          catMapState.rows = catMapState.rows.map(function (r) { return { src: r.src, pick: guessLibCat(r.src) }; });
        }
        function save() {
          var m = loadCatMap();
          var map = {};
          catMapState.rows.forEach(function (r) { if (r.pick) map[r.src] = r.pick; });
          m[catMapState.host] = map;
          saveCatMap(m);
          catMapMask.hidden = true;
          toast("已保存 " + Object.keys(map).length + " 条映射");
          if (catMapState.after) catMapState.after(map);
        }
        return h("div", { class: "modal wide" }, [
          h("div", { class: "modal-head" }, [h("h2", { id: "cm-title" }, self.title),
            h("button", { class: "btn ghost slim", id: "cm-x", type: "button", onClick: close }, "关闭")]),
          h("p", { class: "modal-sub", id: "cm-sub" }, self.sub),
          h("div", { class: "cm-list", id: "cm-list" }, self.rows.map(function (r) {
            return h("div", { class: "cm-row" }, [
              h("span", { class: "cm-src" }, r.src),
              h("select", { class: "select", "data-src": r.src, value: r.pick, onChange: function (e) { r.pick = e.target.value; } },
                [h("option", { value: "" }, "忽略")].concat(LIB_CATS.map(function (c) {
                  return h("option", { value: c }, c);
                })))
            ]);
          })),
          h("div", { class: "modal-foot" }, [
            h("button", { class: "btn ghost slim", id: "cm-guess", type: "button", onClick: guess }, "按名字自动猜"),
            h("div", { class: "spacer" }),
            h("button", { class: "btn ghost slim", id: "cm-cancel", type: "button", onClick: close }, "取消"),
            h("button", { class: "btn primary slim", id: "cm-ok", type: "button", onClick: save }, "保存映射")
          ])
        ]);
      }
    }).mount(catMapMask);
  }

  function openCatMap(opts) {
    if (!catMapState) return;
    ensureCatMap();
    var host = opts.host || "__target__";
    var saved = loadCatMap()[host] || {};
    var names = opts.cats && opts.cats.length ? opts.cats : siteCatNames(null);
    catMapState.host = host;
    catMapState.after = opts.after || null;
    catMapState.title = "分类映射 · " + (opts.label || host);
    catMapState.sub = opts.sub || "站点自己的分类对到库里的分类，没对上的会跳过；只影响收录和发布，不影响请求。";
    catMapState.rows = names.map(function (n) { return { src: n, pick: saved[n] || "" }; });
    catMapMask.hidden = false;
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
    { key: "changelog", label: "更新日志", href: "#changelog", icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 4h11l3 3v13H5z\"/><path d=\"M8 9h7M8 13h7M8 17h4\"/></svg>" },
  ];
  /* 基础版 / 开发版：开发版多出「更新日志」和调试信息，选择存在这台浏览器里 */
  function uiMode() {
    try { return localStorage.getItem("pta.mode") === "dev" ? "dev" : "basic"; } catch (e) { return "basic"; }
  }
  function navItems() {
    return uiMode() === "dev" ? NAV_ITEMS : NAV_ITEMS.filter(function (it) { return it.key !== "changelog"; });
  }

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

  /* 导航交给 Vue：图标是内联 SVG，用 innerHTML 注入，CSP 允许 */
  function initChrome() {
    var root = $("#dock-root");
    var items = navItems();
    var st = window.Vue ? window.Vue.reactive({ active: PAGE, items: items }) : null;
    window.__ptaNavState = st;
    if (root && st) {
      var h = window.Vue.h;
      window.Vue.createApp({
        render: function () {
          return h("nav", { class: "dock" }, st.items.map(function (it) {
            return h("a", { class: "dock-item" + (it.key === st.active ? " active" : ""), href: it.href, "data-view": it.key, title: it.label }, [
              it.icon ? h("span", { innerHTML: it.icon }) : null,
              h("span", { class: "dock-label" }, it.label)
            ]);
          }));
        }
      }).mount(root);
    }
    var right = $(".topbar-right");
    if (right && !$("#menu-btn") && st) {
      var h2 = window.Vue.h;
      var host = document.createElement("div");
      right.appendChild(host);
      window.Vue.createApp({
        render: function () {
          return h2("div", { class: "menu-wrap" }, [
            h2("button", { class: "btn menu-btn", id: "menu-btn", "aria-label": "菜单" }, [
              h2("span", { innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' })
            ]),
            h2("div", { class: "menu", id: "menu" }, st.items.map(function (it) {
              return h2("a", { class: "menu-link" + (it.key === st.active ? " active" : ""), href: it.href, "data-view": it.key }, it.label);
            }).concat([
              h2("button", { type: "button", class: "menu-link menu-logout", id: "menu-logout" }, "退出登录")
            ]))
          ]);
        }
      }).mount(host);
    }
    mountPills();
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
    if (window.__ptaDashSync) window.__ptaDashSync();
    return { pending: 0, pub: 0, fail: 0 };
  }

  function kpi(label, value, delta, cls) {
    return '<div class="kpi"><div class="label">' + label + '</div><div class="value">' + value +
      '</div><div class="delta ' + (cls || "") + '">' + delta + "</div></div>";
  }

  function paintDashLogs() {
    if (window.__ptaDashSync) window.__ptaDashSync();
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
    if (window.__ptaDashSync) window.__ptaDashSync();
  }

  /* 总览这些块由 initDashboardVue 直接渲染，旧的字符串版本已经没人调用了 */
  function renderSiteHealth() {}
  function renderNodeCapacity() {}
  function renderRecentSources() {}

  function renderPending() {
    if (window.__ptaDashSync) window.__ptaDashSync();
  }

  function renderPublished() {
    if (window.__ptaDashSync) window.__ptaDashSync();
  }

  /* 首页列表用真实数据：待审核读 /api/queue，已发布读 /api/published */
  function loadDashLists() {
    if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    return Promise.all([
      fetch("/api/queue?status=pending", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch("/api/published", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      var q = res[0], p = res[1];
      if (q && q.ok && q.data) window.__ptaQueuePending = q.data.items || [];
      if (p && p.ok && p.data) window.__ptaPublished = p.data.items || [];
      renderPending();
      renderPublished();
      return true;
    });
  }
  window.__ptaLoadDashLists = loadDashLists;





  /* ---------- 流程页：抓取 / 发布 ---------- */

  /* 设置页：Vue 3 组件渲染。用 render 函数（不跑模板编译）以符合 CSP。 */


  /* ---------- 站点：新增弹窗 + 本地保存 ---------- */
  /* 新增站点弹窗用 Vue：卡片由组件渲染，显隐仍由外层 mask 控制 */

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
    },
    changelog: {
      title: "更新日志", sub: "删除 / 新增 / 优化 / 调整 / 重排",
      pills: ""
    }
  };
  /* 顶栏状态条：只产出数据，渲染交给 Vue */
  function statusPills() {
    var h = (typeof API !== "undefined" && API && API.mode === "live" && API.health) || null;
    var on = h && h.nodesOnline != null ? h.nodesOnline : MOCK.nodes.filter(function (n) { return n.online; }).length;
    var totalNodes = h && h.nodesTotal != null ? h.nodesTotal : MOCK.nodes.length;
    var fail = h && h.loginFail != null ? h.loginFail : (MOCK.sites.loginFail || 0);
    var live = !!h;
    return [
      { dot: live ? "ok" : "idle", text: live ? "服务运行中" : "本地演示" },
      { dot: "warn", text: fail + " 个站登录失效" },
      { dot: "ok", text: "节点 " + on + " / " + totalNodes }
    ];
  }
  Object.keys(VIEW_META).forEach(function (k) { VIEW_META[k].pills = statusPills; });

  var current = VIEW_META[PAGE] ? PAGE : "dashboard";
  window.__ptaSetActive = function (k) { setActive(k); };

  function setActive(key) {
    if (window.__ptaNavState) window.__ptaNavState.active = key;
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
    var p = $("#page-pills");
    if (p) {
      var model = Array.isArray(pills) ? pills : [];
      if (window.Vue) {
        if (!window.__ptaPillState) window.__ptaPillState = window.Vue.reactive({ pills: [] });
        window.__ptaPillState.pills = model;
        if (!p.getAttribute("data-vue")) {
          p.setAttribute("data-vue", "1");
          window.Vue.createApp({
            render: function () {
              var hh = window.Vue.h;
              return window.__ptaPillState.pills.map(function (x, i) {
                return hh("span", { class: "pill", key: i }, [hh("span", { class: "dot " + x.dot }), x.text]);
              });
            }
          }).mount(p);
        }
      }
    }
    document.title = title + " · 媒体资料库";
  }

  function go(key, opts) {
    opts = opts || {};
    if (key === "changelog" && uiMode() !== "dev") key = "dashboard";
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
    window.__ptaCurrent = key;
    setActive(key);
    if (key === "dashboard" && typeof renderDashboard === "function") renderDashboard();
    /* 进列表页时重新拉一次，别拿上次打开时的旧数据 */
    if (key === "sources" && typeof window.__ptaLoadSources === "function") window.__ptaLoadSources();
    if (key === "queue" && typeof window.__ptaLoadQueue === "function") window.__ptaLoadQueue();
    if (key === "changelog" && typeof renderChangelog === "function") renderChangelog();
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
    window.addEventListener("hashchange", function () {
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
    if (window.__ptaPillState) {
      var model = statusPills();
      model[0] = { dot: live ? "ok" : "idle", text: live ? "服务运行中" : "本地演示" };
      window.__ptaPillState.pills = model;
      return;
    }
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
      /* 总览那四条由 initDashboardVue 渲染，这里只通知它同步 */
      if (typeof window.__ptaDashSync === "function") window.__ptaDashSync();
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
  var AUTH_DEMO = { user: "admin", pass: "demo-pass" }; /* 仅 file:// 演示模式使用，不是线上密码 */

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
        if (res.status === 429) return { ok: false, msg: (res.body && res.body.error && res.body.error.message) || "尝试太多，稍后再试" };
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

  /* 登录浮层用 Vue：状态在组件里，成功后卸载再继续 boot */
  function showLogin(next) {
    var mask = el("div", "login-mask");
    mask.id = "login-mask";
    document.body.appendChild(mask);
    var Vue = window.Vue, h = Vue.h;
    var app = Vue.createApp({
      data: function () { return { user: "", pass: "", remember: true, err: "", busy: false, shake: false }; },
      mounted: function () { var self = this; setTimeout(function () { if (self.$refs.u) self.$refs.u.focus(); }, 60); },
      methods: {
        submit: function () {
          var self = this;
          var u = String(this.user || "").trim(), p = String(this.pass || "");
          if (!u || !p) { this.err = "用户名和密码都要填"; return; }
          if (this.busy) return;
          this.busy = true; this.err = "登录中…";
          AUTH.login(u, p, this.remember).then(function (res) {
            self.busy = false;
            if (res.ok) { app.unmount(); mask.remove(); next(); return; }
            self.err = res.msg || "用户名或密码不对";
            self.shake = false; void mask.offsetWidth; self.shake = true;
          }).catch(function () { self.busy = false; self.err = "网络不通，稍后再试"; });
        }
      },
      render: function () {
        var self = this;
        return h("form", {
          class: "login-card", id: "login-form", autocomplete: "on",
          onSubmit: function (e) { e.preventDefault(); self.shake = false; self.submit(); }
        }, [
          h("div", { class: "login-brand" }, [h("img", { src: "/assets/whale.png", alt: "" }), h("b", null, "SEEDPOD"), h("span", null, "原盘转载面板")]),
          h("h2", null, "登录"),
          h("label", { class: "login-field" }, [h("span", null, "用户名"),
            h("input", { class: "input", id: "login-user", ref: "u", autocomplete: "username", placeholder: "admin",
              value: this.user, onInput: function (e) { self.user = e.target.value; } })]),
          h("label", { class: "login-field" }, [h("span", null, "密码"),
            h("input", { class: "input", id: "login-pass", type: "password", autocomplete: "current-password",
              value: this.pass, onInput: function (e) { self.pass = e.target.value; } })]),
          h("div", { class: "login-row" }, [
            h("button", { type: "button", class: "switch" + (this.remember ? " on" : ""), id: "login-remember",
              onClick: function () { self.remember = !self.remember; } }, [h("i")]),
            h("span", null, "记住登录状态"),
            h("em", { class: "login-err", id: "login-err" }, this.err)
          ]),
          h("button", { class: "btn primary login-btn", type: "submit", id: "login-submit", disabled: this.busy }, this.busy ? "登录中…" : "登录")
        ]);
      }
    });
    app.mount(mask);
    var watchShake = setInterval(function () {
      if (!document.body.contains(mask)) { clearInterval(watchShake); return; }
    }, 1000);
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

  /* 更新日志：Vue 3 渲染。用 render 函数而不是模板字符串，避免运行时编译被 CSP 拦掉 */
  function parseChangelog(text) {
    var blocks = [], cur = null;
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t) { cur = null; return; }
      if (/^###\s+/.test(t)) blocks.push({ type: "h3", text: t.replace(/^###\s+/, "") });
      else if (/^##\s+/.test(t)) blocks.push({ type: "h2", text: t.replace(/^##\s+/, "") });
      else if (/^#\s+/.test(t)) blocks.push({ type: "h2", text: t.replace(/^#\s+/, "") });
      else if (/^[-*]\s+/.test(t)) {
        var item = t.replace(/^[-*]\s+/, "");
        if (!cur || cur.type !== "ul") { cur = { type: "ul", items: [] }; blocks.push(cur); }
        cur.items.push(item);
      } else { blocks.push({ type: "p", text: t }); cur = null; }
    });
    return blocks;
  }
  function renderChangelog() {
    var box = document.getElementById("changelog-body");
    if (!box || box.getAttribute("data-vue") === "1") return;
    if (!window.Vue) { box.textContent = "Vue 运行时没加载"; return; }
    fetch("api/changelog", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok) { box.textContent = "读不到更新日志"; return; }
        var blocks = parseChangelog(j.data.text);
        var Vue = window.Vue, h = Vue.h;
        Vue.createApp({
          data: function () { return { blocks: blocks, version: j.data.version || "" }; },
          render: function () {
            var self = this;
            return h("div", { class: "cl-list" }, self.blocks.map(function (b) {
              if (b.type === "h2") return h("h3", null, b.text);
              if (b.type === "h3") return h("h4", null, b.text);
              if (b.type === "ul") return h("ul", null, b.items.map(function (li) { return h("li", null, li); }));
              return h("p", null, b.text);
            }));
          }
        }).mount(box);
        box.setAttribute("data-vue", "1");
      })
      .catch(function () { box.textContent = "读不到更新日志"; });
  }

  /* 页脚：版本 / 技术栈 / 开发日期 / 实时统计。数字全来自 /api/dev，不写死 */
  function initDevFoot() {
    var el = document.getElementById("dev-foot");
    if (!el) return;
    function upTxt(sec) {
      sec = Number(sec) || 0;
      if (sec < 60) return sec + " 秒";
      if (sec < 3600) return Math.floor(sec / 60) + " 分钟";
      if (sec < 86400) return Math.floor(sec / 3600) + " 小时";
      return Math.floor(sec / 86400) + " 天";
    }
    /* 页脚同样交给 Vue：只做数据到文案的映射 */
    var footState = window.Vue ? window.Vue.reactive({ lines: ["加载中…"] }) : null;
    if (footState) {
      window.Vue.createApp({
        render: function () {
          return footState.lines.map(function (t, i) { return window.Vue.h("span", { key: i }, t); });
        }
      }).mount(el);
    }
    function paint(j) {
      var d = j && j.data;
      if (!d) return;
      var c = d.counts || {};
      var lines = [
        "SEEDPOD v" + escapeHtml(d.version || "—"),
        "开发 " + escapeHtml(d.devDate || "—"),
        "前端 " + escapeHtml((d.stack && d.stack.front) || "—"),
        "后端 " + escapeHtml((d.stack && d.stack.back) || "—"),
        "页面 " + (c.pages || 0) + " · 接口 " + (c.endpoints || 0),
        "站点 " + (c.sites || 0) + " · 预设 " + (c.presets || 0) + " · 词条 " + (c.catalog || 0) +
          " · 待审 " + (c.queue || 0) + " · 下载器 " + (c.downloaders || 0),
        "已运行 " + upTxt(d.uptime)
      ];
      footState.lines = lines;
    }
    function load() {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) {
        footState.lines = ["本地预览 · 没有后端，统计不可用"];
        return;
      }
      fetch("api/dev", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.ok) paint(j); }).catch(function () {});
    }
    load();
    setInterval(load, 60000);
  }

  /* 总览：五块内容都用 Vue 渲染，布局照旧（统计/实时日志/系统状态/最近发布/待审核） */
  /* 总览：五块内容都用 Vue 渲染，卡片外壳与标题保持原样，只替换内容区 */

  function boot() {
    var __steps = [['chrome', initChrome], ['nav', initNav], ['menu', initMenu], ['router', initRouter]];
    __steps.forEach(function (x) {
      try { x[1](); } catch (e) { console.error('BOOT_FAIL ' + x[0], e && e.stack ? e.stack : e); throw e; }
    });
    renderDashboard();
    initRuntime();
    initDevFoot();
    if (typeof loadSitesFromApi === "function") loadSitesFromApi();
    /* 停在总览页时每 30 秒刷一次真实状态，别让数字一直停在进页面那一刻 */
    setInterval(function () {
      if (window.__ptaCurrent !== "dashboard") return;
      if (window.__ptaLoadOverview) window.__ptaLoadOverview();
    }, 30000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { initAuth(boot); });
  } else {
    initAuth(boot);
  }
})();