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

  function initQueue() {
    var listBox = $("#queue-items");
    var detail = $("#queue-detail");
    if (!listBox) return;
    /* 左列交给 Vue 渲染；右列内容仍由原函数生成，事件委托不变 */
    var qState = (window.Vue ? window.Vue.reactive({ rows: [], sel: null }) : null);
    function paintQueueList(list) {
      if (!qState) return;
      qState.sel = state.sel;
      qState.rows = (list || []).map(function (it) {
        var st = STATUS[it.status] || ["未知", "gray"];
        return { id: String(it.id), title: it.title, cn: it.cn || "", res: it.res || "", size: it.size || "",
          targetSite: it.targetSite || "", status: st[0], tone: st[1], on: String(it.id) === String(state.sel) };
      });
    }
    if (qState && window.Vue) {
      var QVue = window.Vue, qh = QVue.h;
      QVue.createApp({
        render: function () {
          if (!qState.rows.length) return qh("div", { class: "sites-empty" }, "没有匹配的条目");
          return qState.rows.map(function (r) {
            return qh("button", { class: "q-item" + (r.on ? " on" : ""), "data-id": r.id, key: r.id }, [
              qh("span", { class: "q-title" }, [
                qh("b", null, r.title),
                qh("i", null, (r.cn ? r.cn + " · " : "") + r.res + " · " + r.size + (r.targetSite ? " · 目标 " + r.targetSite : ""))
              ]),
              qh("span", { class: "badge " + r.tone }, r.status)
            ]);
          });
        }
      }).mount(listBox);
    }

    var state = { tab: "all", q: "", sel: null, page: 1, pages: 1, matched: 0 };
    var PAGE_SIZE = 100;
    var QSTATUS = { all: "", pending: "pending", approved: "approved,published", failed: "failed" };
    var serverMode = !!(window.fetch && /^https?:$/.test(location.protocol));
    MOCK.queue.forEach(function (x) { x.id = String(x.id); });
    var STATUS = {
      pending: ["待确认", "amber"],
      approved: ["已通过", "green"],
      dupe: ["重复", "amber"],
      failed: ["失败", "red"],
      publishing: ["发布中", "blue"],
      published: ["已发布", "green"],
      skipped: ["已跳过", "gray"]
    };

    function rows() {
      return MOCK.queue.filter(function (it) {
        if (serverMode) return true;      /* 服务端已按 tab / 搜索词过滤，这里只分页 */
        if (state.tab === "pending" && it.status !== "pending") return false;
        if (state.tab === "approved" && it.status !== "approved" && it.status !== "published") return false;
        if (state.tab === "failed" && it.status !== "failed") return false;
        if (state.q && ((it.cn || "") + " " + it.title).toLowerCase().indexOf(state.q) === -1) return false;
        return true;
      });
    }

    function shotHtml(it, n) {
      var shot = it && it.shots ? it.shots[n - 1] : null;
      if (shot) return '<div class="shot has"><img src="' + shot.url + '" alt=""><span>' + n + "</span></div>";
      return '<div class="shot"><span>' + n + "</span></div>";
    }

    /* 目标站：默认用流程页选的那个，也可以在条目里单独改；转载就是把别的站的东西发到这个站 */
    function targetOptions(it) {
      var cur = String(it.targetSite || "");
      try { if (!cur) cur = localStorage.getItem("pta.target") || ""; } catch (e) {}
      var list = (MOCK.sitesList || []).slice().sort(function (a, b) {
        return String(a.title || a.name).localeCompare(String(b.title || b.name));
      });
      var extra = (cur && !list.some(function (x) { return x.name === cur; }))
        ? '<option value="' + escapeHtml(cur) + '" selected>' + escapeHtml(cur) + "</option>"
        : "";
      return '<option value="">未选择</option>' + extra + list.map(function (x) {
        return '<option value="' + escapeHtml(x.name) + '"' + (x.name === cur ? " selected" : "") + ">" +
          escapeHtml(x.title || x.name) + "</option>";
      }).join("");
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
      if (it.intro) return it.intro;
      var p2 = subParts(it);
      var tail = [p2.audio, "中文字幕"].filter(Boolean).join("，");
      var year = it.year ? "（" + it.year + "）" : "";
      return (it.title || it.cn) + year + (it.res || "") + " 原盘" + (tail ? "，" + tail : "") + "。";
    }

    /* 右侧详情交给 Vue，事件仍由 detail 上的委托处理 */
    var qdState = window.Vue ? window.Vue.reactive({ item: null, tags: null, lastId: null }) : null;
    window.__ptaQdTags = function (t) { if (qdState) qdState.tags = t; };
    function qdVNode(it) {
      var h = window.Vue.h;
      if (!qdState) return null;
      if (!it) return h("div", { class: "sites-empty" }, "选一条看发布预览");
      var st = STATUS[it.status] || ["未知", "gray"];
      var cur = String(it.targetSite || "");
      if (!cur) { try { cur = localStorage.getItem("pta.target") || ""; } catch (e) {} }
      var hostList = (MOCK.sitesList || []).slice().sort(function (a, b) {
        return String(a.title || a.name).localeCompare(String(b.title || b.name));
      });
      var opts = [h("option", { value: "" }, "未选择")];
      if (cur && !hostList.some(function (x) { return x.name === cur; })) opts.push(h("option", { value: cur }, cur));
      hostList.forEach(function (x) {
        opts.push(h("option", { value: x.name, selected: x.name === cur }, x.title || x.name));
      });
      var hosts = ["站内", "Pixhost", "Imgbox", "本地图床"];
      var imgs = [1, 2, 3].map(function (n) {
        var shot = it.shots ? it.shots[n - 1] : null;
        return shot
          ? h("div", { class: "shot has" }, [h("img", { src: shot.url, alt: "" }), h("span", null, String(n))])
          : h("div", { class: "shot" }, [h("span", null, String(n))]);
      });
      function field(label, ctrl) { return h("div", { class: "qd-field" }, [h("span", null, label), ctrl]); }
      var statusLine = it.status === "publishing"
        ? h("div", { class: "qd-status warn" }, "正在发布到主站…")
        : it.pubMsg ? h("div", { class: "qd-status " + (it.status === "failed" ? "bad" : "ok") }, it.pubMsg) : null;
      return h("div", null, [
        h("div", { class: "qd-head" }, [
          h("div", { class: "qd-id" }, [
            h("div", { class: "qd-title-row" }, [h("h2", null, it.cn || it.title), h("span", { class: "badge " + st[1] }, st[0])]),
            h("span", { class: "sd-url" }, it.title || "")
          ]),
          h("div", { class: "qd-meta" }, [
            h("span", null, ["来源站", h("b", null, it.site || "—")]),
            h("span", null, ["分辨率", h("b", null, it.res || "")]),
            h("span", null, ["大小", h("b", null, it.size || "")]),
            h("span", null, ["年份", h("b", null, (it.year || "—") + " · " + (it.imdb || ""))])
          ])
        ]),
        h("div", { class: "qd-grid" }, [
          h("section", { class: "sd-card qd-pubinfo" }, [
            h("h3", null, "发布信息"),
            field("目标站", h("select", { class: "input", id: "qd-target" }, opts)),
            field("标题", h("input", { class: "input", id: "qd-title", value: String(it.title || "").replace(/\s+/g, " ").trim() })),
            field("副标题", h("input", { class: "input", id: "qd-sub", value: subTitle(it) })),
            field("图床", h("select", { class: "input", id: "qd-host" }, hosts.map(function (x) {
              return h("option", { selected: (it.imageHost || "站内") === x }, x);
            }))),
            field("匿名发布", h("input", { type: "checkbox", id: "qd-anon", checked: !!it.anonymous })),
            field("查重", h("b", { class: (it.checkCls || "") + "-t" }, it.check || ""))
          ]),
          h("section", { class: "sd-card qd-desc-card" }, [
            h("h3", null, "简介"),
            h("textarea", { class: "input sd-note", id: "qd-desc", rows: 3 }, introText(it)),
            h("div", { class: "qd-tags", id: "qd-tags" }, (function () {
              var t = qdState.tags;
              if (!t) return [h("span", { class: "soft" }, "点「生成草稿」后显示发布标签")];
              var out = t.chips && t.chips.length
                ? t.chips.map(function (c) { return h("em", { class: "chip np" }, c); })
                : [h("span", { class: "soft" }, "没有识别出可用标签")];
              if (t.warnings && t.warnings.length) out.push(h("div", { class: "qd-warn" }, "缺项：" + t.warnings.join("；")));
              return out;
            })())
          ]),
          h("section", { class: "sd-card qd-shots" }, [
            h("h3", null, "截图"),
            h("div", { class: "shots" }, imgs.concat([h("button", { class: "shot add", id: "qd-addshot" }, "上传")]))
          ])
        ]),
        statusLine,
        h("div", { class: "qd-actions" }, [
          h("button", { class: "btn primary slim", "data-qact": it.status === "failed" ? "retry" : "publish" }, it.status === "failed" ? "重试发布" : "通过并发布"),
          h("button", { class: "btn ghost slim", "data-qact": "reject" }, "驳回"),
          h("button", { class: "btn ghost slim", "data-qact": "draft" }, "草稿预览"),
          h("div", { class: "spacer" }),
          h("input", { class: "input slim", id: "qd-reason", placeholder: "驳回理由（可留空）", style: "width:200px" }),
          h("button", { class: "btn ghost slim", "data-qact": "skip" }, "跳过")
        ])
      ]);
    }

    if (qdState) {
      window.Vue.createApp({
        render: function () { return qdVNode(qdState.item); }
      }).mount(detail);
    }

    function paint() {
      var filtered = rows();
      var total = serverMode ? state.matched : filtered.length;
      var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      state.pages = pages;
      if (state.page > pages) state.page = pages;
      if (state.page < 1) state.page = 1;
      var list = serverMode ? filtered : filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
      if (!list.some(function (x) { return x.id === state.sel; })) {
        state.sel = list.length ? list[0].id : null;
      }
      paintQueueList(list);
      var cnt = $("#queue-count");
      if (cnt) cnt.textContent = "共 " + total + " 条";
      var info = $("#queue-page-info");
      if (info) info.textContent = "第 " + state.page + " / " + pages + " 页";
      var prevBtn = $("#queue-prev"), nextBtn = $("#queue-next");
      if (prevBtn) prevBtn.disabled = state.page <= 1;
      if (nextBtn) nextBtn.disabled = state.page >= pages;
      var it = MOCK.queue.filter(function (x) { return x.id === state.sel; })[0];
      if (qdState) {
        var nid = it ? String(it.id) : null;
        if (nid !== qdState.lastId) { qdState.lastId = nid; qdState.tags = null; }
        qdState.item = it || null;
      }
      if (it && it.server && !it.shotsLoaded && it.shotsCount > 0) {
        it.shotsLoaded = true;
        window.__ptaQueue.req("/" + encodeURIComponent(it.id)).then(function (res) {
          if (!res || !res.j || !res.j.ok || !res.j.data) return;
          it.shots = (res.j.data.shots || []).map(function (s, i) {
            return s && typeof s === "object" ? { name: s.name || ("shot" + (i + 1)), url: s.url || "" } : { name: "shot" + (i + 1), url: s };
          }).filter(function (x) { return x.url; });
          paint();
        });
      }
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
      state.page = 1;
      $$("button", tabs).forEach(function (x) { x.classList.toggle("active", x === b); });
      if (serverMode) loadServer(1); else paint();
    });

    var qTimer = null;
    var q = $("#queue-q");
    if (q) q.addEventListener("input", function (e) {
      state.q = e.target.value.trim().toLowerCase();
      state.page = 1;
      if (!serverMode) { paint(); return; }
      clearTimeout(qTimer);
      qTimer = setTimeout(function () { loadServer(1); }, 250);
    });

    var prevBtn = $("#queue-prev"), nextBtn = $("#queue-next");
    if (prevBtn) prevBtn.addEventListener("click", function () {
      if (state.page <= 1) return;
      state.page--;
      if (serverMode) loadServer(state.page); else paint();
    });
    if (nextBtn) nextBtn.addEventListener("click", function () {
      if (state.page >= state.pages) return;
      state.page++;
      if (serverMode) loadServer(state.page); else paint();
    });

    var filePick = el("input");
    filePick.type = "file"; filePick.accept = "image/*"; filePick.multiple = true; filePick.style.display = "none";
    document.body.appendChild(filePick);
    /* 截图上传：先按最长边 1600px 压成 jpeg，避免把几 MB 的 base64 塞进服务端队列文件 */
    function shrinkImage(file, done) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var max = 1600;
            var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
            var scale = Math.min(1, max / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
            var cv = document.createElement("canvas");
            cv.width = cw; cv.height = ch;
            cv.getContext("2d").drawImage(img, 0, 0, cw, ch);
            done(cv.toDataURL("image/jpeg", 0.82));
          } catch (e) { done(String(fr.result)); }
        };
        img.onerror = function () { done(String(fr.result)); };
        img.src = String(fr.result);
      };
      fr.readAsDataURL(file);
    }

    filePick.addEventListener("change", function () {
      var it = MOCK.queue.filter(function (x) { return x.id === state.sel; })[0];
      var files = [].slice.call(filePick.files || []);
      if (!it || !files.length) return;
      it.shots = it.shots || [];
      var left = files.length;
      files.slice(0, 3).forEach(function (f) {
        shrinkImage(f, function (url) {
          it.shots.push({ name: f.name, url: url });
          if (--left <= 0) { paint(); toast("已加入 " + it.shots.length + " 张截图"); }
        });
      });
      filePick.value = "";
    });

    var bulkApprove = $("#q-bulkapprove");
    if (bulkApprove) bulkApprove.addEventListener("click", function () {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端，批量批准不可用"); return; }
      bulkApprove.disabled = true;
      fetch("/api/queue/bulk", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", fromStatus: "pending" })
      }).then(function (r) { return r.json(); }).then(function (j) {
        bulkApprove.disabled = false;
        if (!j || !j.ok) { toast((j && j.error && j.error.message) || "批量批准失败"); return; }
        toast("已批准 " + j.data.changed + " 条" + (j.data.skipped ? "，跳过 " + j.data.skipped + " 条" : ""));
        if (loadServer) loadServer();
      }).catch(function () { bulkApprove.disabled = false; toast("批量批准请求发不出去"); });
    });

    var bulkPublish = $("#q-bulkpublish");
    if (bulkPublish) bulkPublish.addEventListener("click", function () {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端，批量发布不可用"); return; }
      ptaConfirm("批量发布", "会把「已通过」的条目全部记成已发布（只记账，不往真实站点发）。继续？", function () {
        bulkPublish.disabled = true;
        fetch("/api/queue/bulk", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish", fromStatus: "approved", targetSite: (function () { try { return localStorage.getItem("pta.target") || ""; } catch (e) { return ""; } })() })
        }).then(function (r) { return r.json(); }).then(function (j) {
          bulkPublish.disabled = false;
          if (!j || !j.ok) { toast((j && j.error && j.error.message) || "批量发布失败"); return; }
          toast("已发布 " + j.data.changed + " 条" + (j.data.skipped ? "，跳过 " + j.data.skipped + " 条（没选目标站或缺下载器）" : ""));
          if (loadServer) loadServer();
          if (window.__ptaLoadOverview) window.__ptaLoadOverview();
        }).catch(function () { bulkPublish.disabled = false; toast("批量发布请求发不出去"); });
      });
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
            if (window.__ptaQdTags) {
              var tgs = d.tags || {};
              var seenTag = {};
              var chips = Object.keys(tgs).filter(function (k) { return tgs[k] && !seenTag[tgs[k]] && (seenTag[tgs[k]] = 1); })
                .map(function (k) { return tgs[k]; });
              window.__ptaQdTags({ chips: chips, warnings: (d.warnings || []).slice() });
            }
            var hint = d.categoryHint && d.categoryHint.mapped ? "，分类建议 " + d.categoryHint.purpose + "（" + d.categoryHint.ids.join(",") + "）" : "";
            toast((d.ready ? "草稿齐了" : "草稿有缺项：" + d.warnings.join(" · ")) + hint);
          })
          .catch(function () { toast("草稿请求发不出去"); });
        return;
      }
      if (it.server) {
        if (act === "skip") {
          window.__ptaQueue.req("/" + encodeURIComponent(it.id) + "/action", "POST", { action: "skip" })
            .then(function (res) {
              toast(res && res.j && res.j.ok ? "已跳过：" + (it.cn || it.title)
                : (res && res.j && res.j.error && res.j.error.message) || "跳过失败");
              return loadServer();
            });
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
        var form = {
          anonymous: !!($("#qd-anon") && $("#qd-anon").checked),
          imageHost: ($("#qd-host") && $("#qd-host").value) || "站内",
          cn: ($("#qd-sub") && $("#qd-sub").value) || "",
          intro: ($("#qd-desc") && $("#qd-desc").value) || "",
          targetSite: ($("#qd-target") && $("#qd-target").value) || "",
          shots: (it.shots || []).filter(function (x) { return x && x.url; }).slice(0, 12)
        };
        it.status = "publishing";
        paint();
        var chain = Promise.resolve(null);
        seq.forEach(function (a) {
          chain = chain.then(function () {
            return window.__ptaQueue.req("/" + encodeURIComponent(it.id) + "/action", "POST",
              Object.assign({ action: a }, a === "publish" ? form : {}));
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
    });


    function loadServer(page) {
      var p = Math.max(1, Number(page) || state.page || 1);
      state.page = p;
      var qs = "?limit=" + PAGE_SIZE + "&offset=" + ((p - 1) * PAGE_SIZE);
      var st = QSTATUS[state.tab] != null ? QSTATUS[state.tab] : "";
      if (st) qs += "&status=" + encodeURIComponent(st);
      if (state.q) qs += "&q=" + encodeURIComponent(state.q);
      return window.__ptaQueue.req(qs).then(function (res) {
        if (!res || !res.j || !res.j.ok || !res.j.data || !Array.isArray(res.j.data.items)) return false;
        var d = res.j.data;
        var matched = Number(d.matched);
        if (!isFinite(matched) || matched < 0) matched = d.items.length;
        state.matched = matched;
        state.pages = Math.max(1, Math.ceil(matched / PAGE_SIZE));
        if (p > state.pages) { state.page = state.pages; return loadServer(state.pages); }
        MOCK.queue = d.items.map(window.__ptaQueue.map);
        var pendingN = (d.counts && d.counts.pending) || 0;
        window.__ptaQueueCounts = d.counts || null;
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
    var state = { q: "", site: "", type: "", status: "", mark: "", page: 0 };
    var PAGE = 100, LOAD_MAX = 2000;
    var MK = { noRedistribute: "禁转", exclusive: "独占", diy: "DIY", limited: "限转", limitedDays: "未满 7 天" };

    /* 这一页就是数据清单：抓回来的词条都从 /api/catalog 读，筛选、标记、归档都在这里做 */
    function loadCatalog() {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { paint(); return; }
      fetch("/api/catalog?limit=" + LOAD_MAX + (state.status ? "&status=" + encodeURIComponent(state.status) : ""), { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.ok) return paint();
          window.__ptaSources = (j.data.items || []).map(function (it) {
            return {
              id: it.id, title: it.title, site: it.site || "", res: it.res || matchResOf(it.title),
              size: it.size || "", time: it.createdAt ? String(it.createdAt).slice(5, 16).replace("T", " ") : "",
              status: it.status, marks: it.marks || {}, type: it.catName || "", cat: it.cat || "",
              detailsUrl: it.detailsUrl || "", seeders: Number(it.seeders) || 0,
              dupe: it.dupe || "", dupeUrl: it.dupeUrl || "", dupeTitle: it.dupeTitle || "",
              dupeTarget: it.dupeTarget || "", dupeAt: it.dupeAt || "", dupeSizeGB: it.dupeSizeGB || 0
            };
          });
          window.__ptaSourcesTotal = j.data.total;
          fillOptions();
          paint();
        })
        .catch(function () { paint(); });
    }
    function matchResOf(t) {
      var m = /\b(2160p|1080p|1080i|720p|576p|480p)\b/i.exec(String(t || ""));
      return m ? m[1] : "";
    }
    var ST_TXT = { new: "待筛选", selected: "已送审", published: "已发布", skipped: "跳过", archived: "归档" };
    /* 老词条里只有分类 id：用站点定义的分类映射反查出中文名，别显示裸 401 */
    var CAT_CN = { movie: "电影", tv: "剧集", show: "综艺", anime: "动漫", doc: "纪录", music: "音乐", sport: "体育", other: "其他" };
    function catNameFromDef(site, catId) {
      var d = (window.__ptaDefs || {})[site];
      if (!d || !d.cats || !catId) return "";
      var hit = "";
      Object.keys(d.cats).forEach(function (g) {
        if (hit) return;
        if ((d.cats[g] || []).map(String).indexOf(String(catId)) >= 0) hit = CAT_CN[g] || g;
      });
      return hit;
    }

    /* 站点 / 类型两个下拉都用真实数据填，没数据的选项不编造 */
    function fillOptions() {
      var all = window.__ptaSources || [];
      [["dl-site", "site", "全部站点"], ["dl-type", "type", "全部类型"]].forEach(function (pair) {
        var sel = $("#" + pair[0]);
        if (!sel) return;
        var seen = {}, list = [];
        all.forEach(function (it) {
          var v = it[pair[1]];
          if (v && !seen[v]) { seen[v] = 1; list.push(v); }
        });
        list.sort();
        vueOptions(sel, [{ value: "", label: pair[2] }].concat(list.map(function (v) { return { value: v, label: v }; })));
        if (state[pair[1]] && !seen[state[pair[1]]]) state[pair[1]] = "";
        sel.value = state[pair[1]] || "";
      });
    }

    /* 详情页地址：服务端存的是相对路径，用站点定义里的 base（或站点域名）补成完整 URL */
    function absUrl(site, p) {
      var raw = String(p || "").trim();
      if (!raw) return "";
      if (/^https?:\/\//i.test(raw)) return raw;
      if (!site) return "";
      var d = (window.__ptaDefs || {})[site];
      var base = (d && d.base) || ("https://" + site);
      var origin = base;
      try { origin = new URL(base).origin; } catch (e) { origin = base.replace(/\/+$/, ""); }
      return origin.replace(/\/+$/, "") + "/" + raw.replace(/^\/+/, "");
    }

    function paint() {
      var all = window.__ptaSources || [];
      var rows = all.filter(function (it) {
        if (state.q && (it.title + " " + it.res + " " + it.site).toLowerCase().indexOf(state.q) === -1) return false;
        if (state.site && it.site !== state.site) return false;
        if (state.type && it.type !== state.type) return false;
        if (state.mark) {
          var mk = it.marks || {};
          if (state.mark === "any") { if (!Object.keys(mk).some(function (k) { return mk[k]; })) return false; }
          else if (!mk[state.mark]) return false;
        }
        return true;
      });
      var pages0 = Math.max(1, Math.ceil(rows.length / PAGE));
      if (state.page > pages0 - 1) state.page = pages0 - 1;
      var pageRows = rows.slice(state.page * PAGE, state.page * PAGE + PAGE);
      paintSourcesList(pageRows, all);

      var c = $("#dl-count");
      if (c) c.textContent = rows.length + (window.__ptaSourcesTotal && rows.length !== window.__ptaSourcesTotal ? " / " + window.__ptaSourcesTotal : "");
      var pages = Math.max(1, Math.ceil(rows.length / PAGE));
      if (state.page > pages - 1) { state.page = pages - 1; }
      var pg = $("#dl-page");
      if (pg) pg.textContent = "第 " + (state.page + 1) + " / " + pages + " 页";
      var prev = $("#dl-prev"), next = $("#dl-next");
      if (prev) prev.disabled = state.page <= 0;
      if (next) next.disabled = state.page >= pages - 1;
      if (window.__ptaSourcesTotal > LOAD_MAX) {
        if (c) c.textContent += "（只读了前 " + LOAD_MAX + " 条）";
      }
    }

    /* 数据清单的行交给 Vue：字段与标记按状态渲染，操作按钮仍走 data-* 委托 */
    var srcState = window.Vue ? window.Vue.reactive({ rows: [], empty: "数据清单还是空的，去流程页点「抓一页」" }) : null;
    function paintSourcesList(pageRows, all) {
      if (!srcState) return;
      srcState.empty = (all && all.length) ? "没有匹配的条目" : "数据清单还是空的，去流程页点「抓一页」";
      srcState.rows = (pageRows || []).map(function (it) {
        var marks = it.marks || {};
        return {
          id: it.id, title: it.title, href: absUrl(it.site, it.detailsUrl),
          site: it.site || "", seeders: Number(it.seeders) || 0,
          existing: !!marks.existing, dupNote: it.dupNote || "", marks: marks,
          marksJson: JSON.stringify(marks),
          dupe: it.dupe || "", dupeUrl: it.dupeUrl || "", dupeTarget: it.dupeTarget || "",
          dupeAt: String(it.dupeAt || "").slice(0, 16).replace("T", " "), dupeTitle: it.dupeTitle || "",
          dupeSizeGB: it.dupeSizeGB || 0,
          type: it.type || catNameFromDef(it.site, it.cat) || it.catName || "",
          res: it.res || "", size: it.size || "", time: it.time || "",
          status: it.status || "", statusTxt: ST_TXT[it.status] || it.status || ""
        };
      });
    }
    if (srcState) {
      var SVue = window.Vue, sh = SVue.h;
      var MKL = { noRedistribute: "禁转", exclusive: "独占", diy: "DIY", limited: "限转", limitedDays: "未满 7 天" };
      function markCell(r) {
        return Object.keys(MKL).map(function (k) {
          var v = r.marks[k];
          var label = MKL[k];
          if (k === "limitedDays" && typeof v === "number" && v > 0) label = "未满7天·剩" + v + "天";
          return sh("button", { class: "mark-btn" + (v ? " on" : ""), "data-mark": k, "data-cid": r.id, "data-marks": r.marksJson, key: k }, label);
        });
      }
      function dupeChip(r) {
        if (!r.dupe) return null;
        var map = { clean: ["np", "可发"], diy: ["warn", "仅DIY可发"], dupe: ["warn", "已有原盘"], error: ["warn", "没查成"] };
        var m = map[r.dupe] || ["np", r.dupe];
        var tip = "向 " + (r.dupeTarget || "目标站") + " 查过 · " + (r.dupeAt || "") + (r.dupeTitle ? " · 命中：" + r.dupeTitle : "");
        var text = m[1] + (r.dupeSizeGB ? " " + r.dupeSizeGB + "GB" : "");
        return r.dupeUrl
          ? sh("a", { class: "chip " + m[0], href: r.dupeUrl, target: "_blank", rel: "noopener noreferrer", title: tip }, text)
          : sh("em", { class: "chip " + m[0], title: tip }, text);
      }
      function opsCell(r) {
        if (r.status === "archived") return [sh("span", { class: "soft" }, "已归档"), sh("button", { class: "link-btn", "data-restore": "1", "data-cid": r.id }, "恢复")];
        if (r.status === "published" || r.status === "selected") return [sh("span", { class: "soft" }, r.status === "published" ? "已发布" : "已送审")];
        return [sh("button", { class: "link-btn", "data-send": "1", "data-cid": r.id }, "送审"),
          sh("button", { class: "link-btn", "data-archive": "1", "data-cid": r.id }, "归档")];
      }
      function rowDom(r) {
        return sh("div", { class: "dl-row" + (r.status === "archived" ? " is-archived" : ""), key: r.id }, [
          sh("span", { class: "dl-title" }, [
            sh("b", null, r.href
              ? sh("a", { class: "t-link", href: r.href, target: "_blank", rel: "noopener noreferrer" }, r.title)
              : r.title),
            sh("span", { class: "mark-row" }, [
              r.site ? sh("i", { class: "cat-site" }, r.site) : null,
              r.seeders ? sh("i", { class: "cat-site" }, "做种 " + r.seeders) : null,
              r.existing ? sh("em", { class: "chip warn", title: r.dupNote || "跟队列/本地库/已发布里的某条重复" }, "已有") : null,
              dupeChip(r)
            ].concat(markCell(r)))
          ]),
          sh("span", null, r.type ? sh("em", { class: "chip np" }, r.type) : sh("span", { class: "soft" }, "—")),
          sh("span", { class: "soft" }, r.res),
          sh("span", { class: "soft" }, r.size),
          sh("span", { class: "soft" }, r.time),
          sh("span", null, sh("span", { class: "badge " + (r.status === "published" ? "green" : r.status === "selected" ? "amber" : "") }, r.statusTxt)),
          sh("span", { class: "dl-ops" }, opsCell(r))
        ]);
      }
      SVue.createApp({
        render: function () {
          if (!srcState.rows.length) return sh("div", { class: "sites-empty" }, srcState.empty);
          return srcState.rows.map(rowDom);
        }
      }).mount(body);
    }

    window.__ptaRepaintSources = paint;
    window.__ptaLoadSources = loadCatalog;
    var q = $("#dl-q");
    if (q) q.addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); state.page = 0; paint(); });
    var siteSel = $("#dl-site");
    if (siteSel) siteSel.addEventListener("change", function (e) { state.site = e.target.value; state.page = 0; paint(); });
    var typeSel = $("#dl-type");
    if (typeSel) typeSel.addEventListener("change", function (e) { state.type = e.target.value; state.page = 0; paint(); });
    /* 目标站查重：下拉只列存过 cookie 的站，没 cookie 查不了 */
    (function initDupeTarget() {
      var sel = $("#dl-target");
      if (!sel) return;
      fetch("/api/credentials", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.ok || !Array.isArray(j.data)) return;
          var hosts = j.data.filter(function (c) { return c.hasCookie; }).map(function (c) { return c.host; }).sort();
          vueOptions(sel, [{ value: "", label: "选目标站" }].concat(hosts.map(function (h) { return { value: h, label: h }; })));
        }).catch(function () {});
      var btn = $("#dl-dupe");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var host = sel.value;
        if (!host) { toast("先在左边选一个目标站（要有 cookie）"); return; }
        if (btn.disabled) return;
        btn.disabled = true;
        btn.textContent = "查重中…";
        fetch("/api/dupe/check", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ host: host, limit: 3 })
        }).then(function (r) { return r.json(); }).then(function (j) {
          btn.disabled = false;
          btn.textContent = "向目标站查重";
          if (!j || !j.ok) { toast((j && j.error && j.error.message) || "查重失败"); return; }
          var d = j.data;
          var s = Object.keys(d.byStatus || {}).map(function (k) { return k + " " + d.byStatus[k]; }).join(" · ");
          toast("查了 " + d.checked + " 条 · " + (s || "无结果"));
          loadCatalog();
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = "向目标站查重";
          toast("查重请求发不出去");
        });
      });
    })();
    var markSel = $("#dl-mark");
    if (markSel) markSel.addEventListener("change", function (e) { state.mark = e.target.value; state.page = 0; paint(); });
    var statusSel = $("#dl-status");
    if (statusSel) statusSel.addEventListener("change", function (e) { state.status = e.target.value; state.page = 0; loadCatalog(); });
    var prevBtn = $("#dl-prev");
    if (prevBtn) prevBtn.addEventListener("click", function () { if (state.page > 0) { state.page--; paint(); } });
    var nextBtn = $("#dl-next");
    if (nextBtn) nextBtn.addEventListener("click", function () { state.page++; paint(); });
    body.addEventListener("click", function (e) {
      var mb = e.target.closest("button[data-mark]");
      if (mb) {
        var cur = {};
        try { cur = JSON.parse(mb.getAttribute("data-marks") || "{}"); } catch (err) {}
        var key = mb.getAttribute("data-mark");
        if (cur[key]) delete cur[key]; else cur[key] = true;
        fetch("/api/catalog/" + encodeURIComponent(mb.getAttribute("data-cid")) + "/marks", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ marks: cur })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) { toast("已改标记"); loadCatalog(); return; }
          toast((j && j.error && j.error.message) || "改标记失败");
        }).catch(function () { toast("改标记请求发不出去"); });
        return;
      }
      var send = e.target.closest("button[data-send]");
      if (send) {
        var sid = send.getAttribute("data-cid");
        send.disabled = true;
        fetch("/api/catalog/screen", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [sid], limit: 1 })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) {
            var d = j.data || {};
            var why = Object.keys(d.byReason || {})[0];
            toast(d.selected ? "已送进待审核" : ("没送审：" + (why || "条件不符")));
            loadCatalog();
            if (window.__ptaLoadQueue) window.__ptaLoadQueue();
            return;
          }
          send.disabled = false;
          toast((j && j.error && j.error.message) || "送审失败");
        }).catch(function () { send.disabled = false; toast("送审请求发不出去"); });
        return;
      }
      var back = e.target.closest("button[data-restore]");
      if (back) {
        var bid = back.getAttribute("data-cid");
        back.disabled = true;
        fetch("/api/catalog/" + encodeURIComponent(bid) + "/status", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "new" })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) { toast("已恢复为待筛选"); loadCatalog(); }
          else { back.disabled = false; toast((j && j.error && j.error.message) || "恢复失败"); }
        }).catch(function () { back.disabled = false; toast("恢复请求发不出去"); });
        return;
      }
      var arc = e.target.closest("button[data-archive]");
      if (!arc) return;
      var cid = arc.getAttribute("data-cid");
      arc.disabled = true;
      fetch("/api/catalog/" + encodeURIComponent(cid) + "/status", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "archived" })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { toast("已归档"); loadCatalog(); }
        else { arc.disabled = false; toast((j && j.error && j.error.message) || "归档失败"); }
      }).catch(function () { arc.disabled = false; toast("归档请求发不出去"); });
    });
    loadCatalog();
    var checkBtn = $("#dl-check");
    if (checkBtn) checkBtn.addEventListener("click", function () {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端"); return; }
      checkBtn.disabled = true;
      fetch("/api/catalog/check", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 500, host: state.site || "" })
      }).then(function (r) { return r.json(); }).then(function (j) {
        checkBtn.disabled = false;
        if (!j || !j.ok) { toast((j && j.error && j.error.message) || "查重失败"); return; }
        var d = j.data || {};
        var sample = (d.items || [])[0];
        toast("查重 " + d.checked + " 条 · 已有 " + d.dup + " 条" + (sample && sample.hit ? "（例：" + sample.hit.title.slice(0, 30) + "）" : ""));
        loadCatalog();
      }).catch(function () { checkBtn.disabled = false; toast("查重请求发不出去"); });
    });
    var screenBtn = $("#dl-screen");
    if (screenBtn) screenBtn.addEventListener("click", function () {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端"); return; }
      ptaConfirm("按条件送审", (state.site ? "只处理「" + state.site + "」的待筛选词条，" : "") + "会先查重，再按流程页「查重」里的条件送去待审核，不符合的标成跳过。继续？", function () {
        screenBtn.disabled = true;
        fetch("/api/catalog/screen", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 200, host: state.site || "" })
        }).then(function (r) { return r.json(); }).then(function (j) {
          screenBtn.disabled = false;
          if (!j || !j.ok) { toast((j && j.error && j.error.message) || "送审失败"); return; }
          var d = j.data || {};
          var rs = Object.keys(d.byReason || {}).map(function (k) { return k + " " + d.byReason[k]; }).join(" · ");
          var rl = d.rules || {};
          var noRule = !(rl.res && rl.res.length) && !rl.minSizeGB && !rl.maxSizeGB && !rl.requireChinese;
          toast((noRule ? "还没设筛选条件，按全部通过 · " : "") + "检查 " + d.checked + " 条 · 送审 " + d.selected + " · 跳过 " + d.skipped + (rs ? "（" + rs + "）" : ""));
          loadCatalog();
          if (window.__ptaLoadQueue) window.__ptaLoadQueue();
          if (window.__ptaLoadOverview) window.__ptaLoadOverview();
        }).catch(function () { screenBtn.disabled = false; toast("筛选请求发不出去"); });
      });
    });
    var bulk = $("#dl-archive");
    if (bulk) bulk.addEventListener("click", function () {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端"); return; }
      ptaConfirm("归档跳过/已有", (state.site ? "只处理「" + state.site + "」的" : "") + "跳过项和查重标了「已有」的新词条会一起归档，之后可在行内点「恢复」退回待筛选。继续？", function () {
      bulk.disabled = true;
      fetch("/api/catalog/bulk", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ fromStatus: "skipped", status: "archived", includeDup: true, host: state.site || "" })
      }).then(function (r) { return r.json(); }).then(function (j) {
        toast(j && j.ok ? ("已归档 " + j.data.changed + " 条（跳过 + 标已有的）") : ((j && j.error && j.error.message) || "批量归档失败"));
        bulk.disabled = false;
        loadCatalog();
      }).catch(function () { bulk.disabled = false; toast("批量归档请求发不出去"); });
      });
    });
    var ex = $("#dl-export");
    if (ex) ex.addEventListener("click", function () {
      var rows = window.__ptaSources || [];
      var data = JSON.stringify(rows, null, 2);
      var url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      var a = document.createElement("a");
      a.href = url;
      a.download = "pta-catalog.json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast(rows.length ? ("已导出 " + rows.length + " 条词条") : "数据清单还是空的，没有可导出的");
    });
    paint();
  }

  function initNodes() {
    var host = $("#nodes-grid");
    /* 下载器卡片与分类条交给 Vue：模型在 paint / renderCats 里更新 */
    var nodesState = window.Vue ? window.Vue.reactive({ rows: [], empty: false, mounted: false }) : null;
    var catsState = window.Vue ? window.Vue.reactive({ rows: [], mounted: false }) : null;
    function mountNodes() {
      if (!nodesState || nodesState.mounted) return;
      nodesState.mounted = true;
      var h = window.Vue.h;
      window.Vue.createApp({
        render: function () {
          if (nodesState.empty) return h("div", { class: "empty" }, "还没有下载器，点右上角「添加下载器」，填 qBittorrent 的地址和账号密码。");
          return nodesState.rows.map(function (nd) {
            return h("div", { class: "node-row " + nd.tone, key: nd.i }, [
              h("div", { class: "nr-name" }, [h("b", null, nd.name), nd.ctrl ? h("span", { class: "nr-tag" }, "控制机") : null]),
              h("div", { class: "nr-host mono" }, nd.hostline),
              h("div", { class: "nr-disk" }, [h("span", { class: "nr-cap" }, nd.disk)].concat(nd.total ? [
                h("div", { class: "nr-bar" }, [h("i", { style: "width:" + nd.pct.toFixed(0) + "%" })]),
                h("span", { class: "nr-pct" }, "已用 " + nd.pctText)
              ] : [])),
              nd.online ? h("span", { class: "badge green" }, "在线") : h("span", { class: "badge red" }, "离线"),
              h("button", { class: "link-btn nr-set", "data-nset": String(nd.i), type: "button" }, "设置")
            ]);
          });
        }
      }).mount(host);
    }
    function mountCats() {
      if (!catsState || catsState.mounted) return;
      var list = $("#nd-cat-list");
      if (!list) return;
      catsState.mounted = true;
      var h = window.Vue.h;
      window.Vue.createApp({
        render: function () {
          return catsState.rows.map(function (c) {
            return h("button", { class: "cat-chip" + (c.on ? " on" : ""), type: "button", "data-ndcat": c.name, key: c.name },
              [c.name, h("i", null, String(c.count))]);
          });
        }
      }).mount(list);
    }

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
          var h = String(d.url || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
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
          var tot = Number(lp && lp.totalSpace) || 0;
          nd.total = tot;
          nd.used = tot && free ? Math.max(0, tot - free) : 0;
          nd.disk = free ? fmtBytes(free) + " 剩余" + (tot ? " / 共 " + fmtBytes(tot) : "") : "—";
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

    function pushNode(nd, afterProbe) {
      if (!nd || !window.__ptaDl || !/^https?:$/.test(location.protocol)) {
        if (afterProbe) toast("本地预览没有后端，下载器只存在这一页");
        return;
      }
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
          if (afterProbe) probeAfterSave(nd);
        } else {
          toast((res && res.j && res.j.error && res.j.error.message) || "服务端没写进去，已存在本地");
        }
      });
    }

    /* 存完马上探一次：容量、版本、分类都要真实值，不能拿占位数字顶上 */
    function probeAfterSave(nd) {
      if (!nd.serverId || !window.fetch) return;
      fetch("/api/downloaders/" + encodeURIComponent(nd.serverId) + "/test", { method: "POST", credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok) return;
          var d = j.data || {};
          nd.online = !!d.pass;
          nd.freeSpace = Number(d.freeSpace) || 0;
          nd.total = Number(d.totalSpace) || 0;
          nd.used = nd.total && nd.freeSpace ? Math.max(0, nd.total - nd.freeSpace) : 0;
          nd.disk = nd.freeSpace ? fmtBytes(nd.freeSpace) + " 剩余" + (nd.total ? " / 共 " + fmtBytes(nd.total) : "") : "—";
          nd.qb = d.version || "—";
          if (d.savePath) nd.path = d.savePath;
          save(); paint();
          if (window.__ptaLoadOverview) window.__ptaLoadOverview();
          if (nd.online) loadCats(nd);
        })
        .catch(function () {});
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

      if (!nodesState) return;
      mountNodes();
      if (!nodes.length) {
        nodesState.rows = [];
        nodesState.empty = true;
        return;
      }
      nodesState.empty = false;
      nodesState.rows = nodes.map(function (nd, i) {
        var isCtrl = nd.role && nd.role.indexOf("编排") === 0;
        var pct = 0;
        if (isCtrl) {
          var m = String(nd.disk).match(/([\d.]+)\s*\/\s*([\d.]+)/);
          if (m) pct = parseFloat(m[1]) / parseFloat(m[2]) * 100;
        } else if (nd.total) {
          pct = nd.used / nd.total * 100;
        }
        var tone = !nd.online ? "off" : pct > 85 ? "warn" : "ok";
        return { i: i, name: nd.name, hostline: nd.host, ctrl: !!isCtrl, disk: nd.disk, total: !!nd.total,
          pct: Math.max(0, Math.min(100, pct)), pctText: pct ? pct.toFixed(0) + "%" : "—",
          tone: tone, online: !!nd.online };
      });
    }

    /* ---- 设置弹窗 ---- */
    var mask = $("#node-modal");
    var editing = -1;
    var curCats = [];
    var curCat = "";

    /* 分类只认下载器里真实存在的那些，面板不自己编 */
    function normUrl(raw) {
      var s = String(raw || "").trim();
      if (!s) return "";
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "http://" + s;
      return s.replace(/\/+$/, "");
    }
    function hostOf(url) {
      return String(url || "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    }
    function renderCats() {
      var list = $("#nd-cat-list");
      var st = $("#nd-cat-status");
      if (!list) return;
      if (!catsState) return;
      mountCats();
      if (!curCats.length) {
        catsState.rows = [];
        if (st) st.textContent = "未拉取";
        return;
      }
      if (st) st.textContent = "已拉取 " + curCats.length + " 个";
      catsState.rows = curCats.map(function (c) {
        return { name: c.name, count: c.count || 0, on: c.name === curCat };
      });
    }
    function loadCats(node, btn) {
      if (!node || !node.serverId) { toast("先保存下载器，再读它的分类"); return; }
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端，读不了分类"); return; }
      if (btn) { btn.disabled = true; btn.textContent = "读取中…"; }
      var done = function (t) { if (btn) { btn.disabled = false; btn.textContent = t; } };
      fetch("/api/downloaders/" + encodeURIComponent(node.serverId) + "/cats", { credentials: "same-origin" })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }, function () { return { status: r.status, j: null }; }); })
        .then(function (out) {
          done("重新拉取");
          if (!out.j || !out.j.ok) {
            var msg = (out.j && out.j.error && out.j.error.message) || ("读取失败 " + out.status);
            var st = $("#nd-cat-status");
            if (st) st.textContent = msg;
            toast(msg);
            return;
          }
          curCats = (out.j.data.cats || []).map(function (c) { return { name: c.name, count: c.count || 0 }; });
          if (!curCat || !curCats.some(function (c) { return c.name === curCat; })) curCat = curCats.length ? curCats[0].name : "";
          node.cats = curCats;
          node.cat = curCat;
          renderCats();
          toast(curCats.length ? ("这台下载器有 " + curCats.length + " 个分类") : "下载器里还没有分类");
        })
        .catch(function () { done("重新拉取"); toast("分类请求发不出去"); });
    }
    function openModal(i) {
      editing = i;
      var nd = i >= 0 ? MOCK.nodes[i] : null;
      $("#node-modal-title").textContent = nd ? "下载器设置" : "新增下载器";
      $("#nd-name").value = nd ? (nd.name || "") : "";
      $("#nd-host").value = nd ? (nd.qbUrl || nd.host || "") : "";
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
      setTimeout(function () { $("#nd-host").focus(); }, 30);
      /* 已存的下载器，打开就把它自己的分类读出来 */
      if (nd && nd.serverId) loadCats(nd);
    }
    function closeModal() { mask.hidden = true; }

    if (mask) {
      $("#node-add") && $("#node-add").addEventListener("click", function () { openModal(-1); });
      $("#node-cancel").addEventListener("click", closeModal);
      mask.addEventListener("click", function (e) { if (e.target === mask) closeModal(); });

      $("#node-ok").addEventListener("click", function () {
        var raw = $("#nd-host").value.trim();
        if (!raw) { toast("先填地址（下载器 Web 地址）"); return; }
        var url = normUrl(raw);
        if (!/^https?:\/\/[^\s/]+/i.test(url)) { toast("地址要像 http://主机:端口"); return; }
        var name = $("#nd-name").value.trim() || hostOf(url);
        var data = {
          name: name,
          role: editing >= 0 ? (MOCK.nodes[editing].role || "下载 / 做种") : "下载 / 做种",
          host: hostOf(url),
          path: editing >= 0 ? MOCK.nodes[editing].path : "/data/pt",
          qb: editing >= 0 ? (MOCK.nodes[editing].qb || "") : "",
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
          nd.qbUrl = url;
          nd.dlLimit = data.dlLimit; nd.ulLimit = data.ulLimit; nd.ratioDel = data.ratioDel;
          nd.seedDays = data.seedDays; nd.dlPath = data.dlPath; nd.lowDisk = data.lowDisk;
          nd.cats = curCats; nd.cat = curCat;
          target = nd;
        } else {
          target = {
            name: data.name, role: data.role, host: data.host, online: false,
            disk: "—", used: 0, total: 0, qb: data.qb,
            seeding: "0", path: data.path, maxDown: data.maxDown, seedLimit: data.seedLimit,
            cats: curCats, cat: curCat, qbUser: data.qbUser, qbPass: data.qbPass,
            qbUrl: url, freeSpace: 0
          };
          MOCK.nodes.push(target);
        }
        save(); paint(); closeModal();
        toast(editing >= 0 ? "已保存：" + data.name : "已新增：" + data.name);
        pushNode(target, true);
      });

      var testBtn = $("#nd-test");
      if (testBtn) testBtn.addEventListener("click", function () {
        var res = $("#nd-test-res");
        var url = normUrl($("#nd-host").value);
        var user = ($("#nd-user").value || "").trim();
        var pass = $("#nd-pass").value || "";
        if (!url) { toast("先填地址"); return; }
        if (!/^https?:\/\/[^\s/]+/i.test(url)) { toast("地址要像 http://主机:端口"); return; }
        if (!window.fetch || !/^https?:$/.test(location.protocol)) {
          toast("本地预览没有后端，连接测试不可用");
          if (res) res.textContent = "本地预览没有后端，连接测试不可用";
          return;
        }
        /* 密码不回显：没重新填就说明用服务端存的那份，走 id 探测，不再拿空密码去撞 401 */
        var saved = editing >= 0 ? MOCK.nodes[editing] : null;
        var useStored = !pass && saved && saved.serverId;
        testBtn.disabled = true;
        if (res) res.textContent = "正在连接…";
        var req = useStored
          ? fetch("/api/downloaders/" + encodeURIComponent(saved.serverId) + "/test", { method: "POST", credentials: "same-origin" })
          : fetch("/api/downloaders/probe", {
              method: "POST", credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ url: url, user: user, pass: pass })
            });
        req.then(function (r) {
          return r.json().then(function (j) { return { status: r.status, j: j }; },
            function () { return { status: r.status, j: null }; });
        }).then(function (out) {
          if (!out.j || !out.j.ok) {
            var msg = (out.j && out.j.error && out.j.error.message) || ("探测失败 " + out.status);
            if (res) res.textContent = msg;
            toast(msg);
            return;
          }
          var d = out.j.data || {};
          var lines = (d.steps || []).map(function (s) {
            return s.step + ":" + (s.status || "—") + (s.error ? "(" + s.error + ")" : "") + " " + (s.ms || 0) + "ms";
          }).join(" · ");
          var space = d.freeSpace ? " · 剩余 " + fmtBytes(d.freeSpace) : "";
          if (res) res.textContent = (d.pass ? "通过 · " + d.version + space : "不通" + space) + (lines ? " · " + lines : "");
          toast(d.pass ? ("连接通过 · " + d.version) : "连接失败");
          /* 探测结果直接回写到这张卡片，列表上的在线状态、余量跟着变，不用再手动刷新 */
          if (saved) {
            saved.online = !!d.pass;
            saved.freeSpace = Number(d.freeSpace) || 0;
            saved.total = Number(d.totalSpace) || 0;
            saved.used = saved.total && saved.freeSpace ? Math.max(0, saved.total - saved.freeSpace) : 0;
            saved.disk = saved.freeSpace ? fmtBytes(saved.freeSpace) + " 剩余" + (saved.total ? " / 共 " + fmtBytes(saved.total) : "") : "—";
            if (d.version) saved.qb = d.version;
            if (d.savePath) saved.path = d.savePath;
            save(); paint();
            if (window.__ptaLoadOverview) window.__ptaLoadOverview();
          }
        }).catch(function () {
          if (res) res.textContent = "请求发不出去";
          toast("连接测试不可用");
        }).then(function () {
          testBtn.disabled = false;
        });
      });

      $("#nd-fetch").addEventListener("click", function () {
        var node = editing >= 0 ? MOCK.nodes[editing] : null;
        if (!node || !node.serverId) { toast("先保存下载器，再读它的分类"); return; }
        loadCats(node, this);
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
    if (!window.Vue) { host.textContent = "Vue 运行时没加载"; return; }
    var Vue = window.Vue, h = Vue.h;
    var state = Vue.reactive({ lvl: "all", rows: [] });

    function sync() {
      var list = (MOCK.logs || []).filter(function (l) { return state.lvl === "all" || l.lvl === state.lvl; });
      state.rows = list.map(function (l, i) {
        return { k: i, t: l.t, lvl: l.lvl, tag: l.tag, msg: l.msg };
      });
      host.scrollTop = host.scrollHeight;
    }
    window.__ptaRepaintLogs = sync;

    Vue.createApp({
      render: function () {
        if (!state.rows.length) return h("div", { class: "sites-empty" }, "还没有日志，连上后端后这里会实时刷新");
        return h("div", { class: "log-rows" }, state.rows.map(function (r) {
          return h("div", { class: "log-row " + r.lvl, key: r.k }, [
            h("span", { class: "log-ts" }, r.t),
            h("span", { class: "log-tag" }, r.lvl === "error" ? "ERROR" : r.lvl === "warn" ? "WARN" : "INFO"),
            h("span", { class: "log-src" }, r.tag),
            h("span", { class: "log-msg" }, r.msg)
          ]);
        }));
      }
    }).mount(host);

    var tabs = $("#log-tabs");
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-lvl]");
      if (!b) return;
      state.lvl = b.getAttribute("data-lvl");
      $$("button", tabs).forEach(function (x) { x.classList.toggle("active", x === b); });
      sync();
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
    if (clr) clr.addEventListener("click", function () {
      state.rows = [];
      toast("已清屏：只清这一页，服务端日志还在");
    });
    sync();
  }

  /* ---------- 流程页：抓取 / 发布 ---------- */
  function swChip(on, key) {
    return '<button type="button" class="cat-chip sw-chip' + (on ? " on" : "") + '" data-switch="' +
      escapeHtml(key || "1") + '">' + (on ? "开" : "关") + "</button>";
  }

  function chipRow(items, active, single, tips) {
    return '<div class="cat-row pick-row"' + (single ? ' data-single="1"' : "") + ">" + items.map(function (c, i) {
      var on = (active || []).indexOf(c) >= 0;
      var tip = tips && tips[i] ? ' title="' + escapeHtml(tips[i]) + '"' : "";
      return '<button type="button" class="cat-chip' + (on ? " on" : "") + '" data-pick="' + c + '"' + tip + ">" + c + "</button>";
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
      return '<textarea class="input sd-note"' + k + (r.ph ? ' placeholder="' + escapeHtml(r.ph) + '"' : "") + ">" + escapeHtml(r.v || "") + "</textarea>";
    }
    if (r.type === "num") {
      return '<input class="input num"' + k + ' value="' + escapeHtml(r.v === undefined ? "" : r.v) + '"' +
        (r.range ? ' data-min="' + r.range[0] + '" data-max="' + r.range[1] + '"' : "") +
        ' inputmode="numeric" placeholder="' + escapeHtml(r.ph || "") + '"><em class="num-warn"></em>';
    }
    if (r.type === "fixed") {
      return '<span class="fixed-val' + (r.noTag ? " ref" : "") + '"' + k + ">" + escapeHtml(r.v || "系统锁定") + (r.noTag ? "" : "<i>系统固定</i>") + "</span>";
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
        '<div class="lbl"><span>' + r.t + "</span>" +  + "</div>" +
        '<div class="ctl">' + (r.chips ? chipRow(r.chips, r.sel, r.single, r.tips) : setControl(r)) + "</div>" +
      "</div>";
    }).join("");
  }

  var PUB_RULES = window.PTA_RULES.pub;
  var DEDUPE_RULES = window.PTA_RULES.dedupe;

  /* fetch 组由 Vue 的搜索预设卡独占，这里不再持有，免得保存查重/发布时把预设冲回默认 */
  var RULE_SETS = {};

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
      if (!RULE_SETS[k] || !RULE_SETS[k].length) return;   /* 搜索预设已由 Vue 卡片单独保存，这里不覆盖 */
      data[k] = RULE_SETS[k].map(function (g) {
        return g.rows.map(function (r) { return { t: r.t, v: r.v, on: r.on, sel: r.sel }; });
      });
    });
    try { localStorage.setItem(FLOW_KEY, JSON.stringify(data)); } catch (e) {}
    var rxBody = {};
    var dEn = $("#rx-deny"), aEn = $("#rx-allow"), scEn = $("#rx-scope");
    if (dEn) rxBody.deny = String(dEn.value || "").slice(0, 200);
    if (aEn) rxBody.allow = String(aEn.value || "").slice(0, 200);
    if (scEn) rxBody.scope = String(scEn.value || "").slice(0, 40);
    try { localStorage.setItem("pta.rx", JSON.stringify(rxBody)); } catch (e) {}
    flowRequest("PUT", { sets: data, rx: rxBody }).then(function (res) {
      if (res && res.j && res.j.ok) window.__ptaFlowSynced = true;
    });
  }
  function applyFlowData(data) {
    if (!data) return false;
    Object.keys(RULE_SETS).forEach(function (k) {
      (data[k] || []).forEach(function (grp, gi) {
        var g = RULE_SETS[k][gi];
        if (!g) return;
        /* 行数对不上说明规则表改过了，这份存档按行号套会串位，整组丢掉 */
        if (!Array.isArray(grp) || grp.length !== g.rows.length) return;
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

  function applyRx(rx) {
    if (!rx) return;
    var d = $("#rx-deny"), a = $("#rx-allow");
    if (d && rx.deny !== undefined) d.value = rx.deny || "";
    if (a && rx.allow !== undefined) a.value = rx.allow || "";
  }
  function loadFlowState() {
    var data = null, rx = null;
    try { data = JSON.parse(localStorage.getItem(FLOW_KEY) || "null"); } catch (e) {}
    try { rx = JSON.parse(localStorage.getItem("pta.rx") || "null"); } catch (e) {}
    applyFlowData(data);
    applyRx(rx);
  }

  /* 请求限制卡片：Vue 组件。间隔、每日上限、熔断次数都写到服务端 /api/config，前端不各存一份 */
  /* 流程页三张卡：抓取（请求限制 + 搜索预设）、查重、发布。都用 Vue 渲染，保持原来一张卡一组的结构 */
  function mountCrawlCard(host) {
    if (!window.Vue) return;
    var Vue = window.Vue, h = Vue.h;
    var box = document.createElement("div");
    var anchor = host.querySelector('.drawer[data-name="发布"]');
    (anchor && anchor.parentNode ? anchor.parentNode : host).insertBefore(box, anchor || null);

    var preset = JSON.parse(JSON.stringify((window.PTA_RULES && window.PTA_RULES.fetch || [])[0] || { name: "搜索预设", rows: [] }));
    var st = Vue.reactive({
      interval: 60, windowMinutes: 60, maxPerWindow: 20, breaker: 3,
      detail: (function () { try { return localStorage.getItem("pta.detail") === "1"; } catch (e) { return false; } })(),
      limits: { interval: [8, 600], windowMinutes: [1, 1440], maxPerWindow: [1, 1000], breaker: [1, 10] },
      groups: [preset], saving: false, sum: "", note: "读取服务端配置…"
    });

    function syncNote() {
      st.note = "每 " + st.interval + " 秒最多一次 · " + st.windowMinutes + " 分钟内最多 " + st.maxPerWindow + " 次请求";
    }
    function syncSum() {
      var on = 0;
      st.groups.forEach(function (g) { (g.rows || []).forEach(function (r) { on += (r.sel || []).length; }); });
      st.sum = on ? on + " 项条件" : "跟随默认";
    }
    function load() {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { syncNote(); syncSum(); return; }
      fetch("api/config", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !j.ok || !j.data || !j.data.user) return;
        var u = j.data.user;
        ["interval", "windowMinutes", "maxPerWindow", "breaker"].forEach(function (k) { if (u[k] != null) st[k] = u[k]; });
        if (j.data.limits) ["interval", "windowMinutes", "maxPerWindow", "breaker"].forEach(function (k) {
          var L = j.data.limits[k];
          if (Array.isArray(L) && L.length === 2) st.limits[k] = [Number(L[0]), Number(L[1])];
        });
        if (u.detail != null) st.detail = !!u.detail;
        syncNote();
      }).catch(function () {});
      fetch("api/flow", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var d = j && j.ok && j.data;
        var saved = d && d.sets && Array.isArray(d.sets.fetch) ? d.sets.fetch : null;
        if (!saved) { syncSum(); return; }
        st.groups.forEach(function (g, gi) {
          var rows = saved[gi];
          if (!Array.isArray(rows) || rows.length !== (g.rows || []).length) return;
          g.rows.forEach(function (r, ri) { var v = rows[ri] || {}; if (v.sel) r.sel = v.sel; if (v.v !== undefined) r.v = v.v; });
        });
        syncSum();
      }).catch(function () {});
    }
    function save() {
      if (st.saving) return;
      st.saving = true;
      Promise.all([
        fetch("api/config/user", {
          method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({ interval: st.interval, windowMinutes: st.windowMinutes, maxPerWindow: st.maxPerWindow, breaker: st.breaker, detail: !!st.detail })
        }).then(function (r) { return r.json(); }),
        fetch("api/flow", {
          method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({ sets: { fetch: st.groups.map(function (g) { return (g.rows || []).map(function (r) { return { t: r.t, v: r.v, on: r.on, sel: r.sel }; }); }) } })
        }).then(function (r) { return r.json(); })
      ]).then(function (a) {
        st.saving = false;
        var bad = a.filter(function (j) { return !j || !j.ok; })[0];
        toast(bad ? ((bad && bad.error && bad.error.message) || "服务端拒绝了这次保存") : "抓取设置已保存");
      }).catch(function () { st.saving = false; toast("保存请求没发出去"); });
    }

    function limitItem(key, label) {
      var L = st.limits[key] || [0, 999999];
      return h("div", { class: "limit-item" }, [
        h("div", { class: "lbl" }, label),
        h("input", {
          class: "input num", type: "number", value: String(st[key]), min: String(L[0]), max: String(L[1]),
          onInput: function (e) { st[key] = Number(e.target.value) || 0; syncNote(); },
          onChange: function (e) {
            var v = Number(e.target.value) || L[0];
            st[key] = Math.min(L[1], Math.max(L[0], v));
            e.target.value = String(st[key]);
            syncNote();
          }
        })
      ]);
    }
    function presetRow(r) {
      return h("div", { class: "preset-row", key: r.t }, [
        h("div", { class: "lbl" }, r.t),
        h("div", { class: "cat-row pick-row" }, (r.chips || []).map(function (c) {
          var on = (r.sel || []).indexOf(c) >= 0;
          return h("button", {
            class: "cat-chip" + (on ? " on" : ""), type: "button",
            onClick: function () {
              var i = (r.sel || []).indexOf(c);
              r.sel = (r.sel || []).slice();
              if (i >= 0) r.sel.splice(i, 1); else r.sel.push(c);
              syncSum();
            }
          }, c);
        }))
      ]);
    }

    Vue.createApp({
      render: function () {
        var g = st.groups[0] || { rows: [] };
        return h("section", { class: "drawer open vue-card crawl-card" }, [
          h("div", { class: "drawer-head" }, [
            h("div", { class: "drawer-t" }, [
              h("div", { class: "drawer-title" }, "抓取")
            ]),
            h("div", { class: "drawer-head-right" }, [
              h("span", { class: "drawer-meta" }, st.sum),
              h("button", { class: "btn primary slim", type: "button", disabled: st.saving, onClick: save }, st.saving ? "保存中…" : "保存")
            ])
          ]),
          h("div", { class: "drawer-body" }, [
            h("div", { class: "preset-block" }, (g.rows || []).map(presetRow)),
            h("div", { class: "limits-panel" }, [
              limitItem("interval", "请求间隔（秒）"),
              limitItem("windowMinutes", "窗口（分钟）"),
              limitItem("maxPerWindow", "窗口内最多"),
              limitItem("breaker", "连续失败暂停")
            ]),
            h("div", { class: "crawl-foot" }, [
              h("div", { class: "crawl-note" }, st.note),
              h("label", { class: "detail-sw" }, [
                h("span", null, "抓详情页"),
                h("button", {
                  class: "switch" + (st.detail ? " on" : ""), type: "button", role: "switch", "aria-checked": String(!!st.detail),
                  onClick: function () {
                    st.detail = !st.detail;
                    try { localStorage.setItem("pta.detail", st.detail ? "1" : "0"); } catch (e) {}
                    fetch("api/config/user", {
                      method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
                      body: JSON.stringify({ detail: !!st.detail })
                    }).then(function (r) { return r.json(); }).then(function (j) {
                      toast(j && j.ok ? (st.detail ? "已开启抓详情页：每条多一次请求" : "已关闭抓详情页") : "开关没存上");
                    }).catch(function () { toast("开关没存上"); });
                  }
                }, [h("i")])
              ])
            ])
          ])
        ]);
      }
    }).mount(box);
    load();
    syncSum();
    syncNote();
  }

  /* 查重卡：自动查重开关 + 筛选条件 + 词条数据，一张卡里 */
  function mountDedupeCard(host) {
    if (!window.Vue) return;
    var Vue = window.Vue, h = Vue.h;
    var box = document.createElement("div");
    var anchor = host.querySelector('.drawer[data-name="发布"]');
    (anchor && anchor.parentNode ? anchor.parentNode : host).insertBefore(box, anchor || null);

    var src = JSON.parse(JSON.stringify(window.PTA_RULES.dedupe || []));
    var st = Vue.reactive({ groups: src, autoDupe: false, saving: false });

    function load() {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) return;
      fetch("api/flow", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var d = j && j.ok && j.data; if (!d) return;
        var saved = d.sets && Array.isArray(d.sets.dedupe) ? d.sets.dedupe : null;
        if (saved) st.groups.forEach(function (g, gi) {
          var rows = saved[gi];
          if (!Array.isArray(rows) || rows.length !== g.rows.length) return;
          g.rows.forEach(function (r, ri) { var v = rows[ri] || {}; if (v.v !== undefined) r.v = v.v; if (v.on !== undefined) r.on = v.on; if (v.sel) r.sel = v.sel; });
        });
      }).catch(function () {});
      fetch("api/config", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.ok && j.data && j.data.user) st.autoDupe = !!j.data.user.autoDupe;
      }).catch(function () {});
    }
    function save() {
      if (st.saving) return;
      st.saving = true;
      Promise.all([
        fetch("api/flow", {
          method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sets: { dedupe: st.groups.map(function (g) { return g.rows.map(function (r) { return { t: r.t, v: r.v, on: r.on, sel: r.sel }; }); }) }
          })
        }).then(function (r) { return r.json(); }),
        fetch("api/config/user", {
          method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({ autoDupe: st.autoDupe })
        }).then(function (r) { return r.json(); })
      ]).then(function (a) {
        st.saving = false;
        var bad = a.filter(function (j) { return !j || !j.ok; })[0];
        toast(bad ? ((bad && bad.error && bad.error.message) || "服务端拒绝了这次保存") : "查重设置已保存");
      }).catch(function () { st.saving = false; toast("保存请求没发出去"); });
    }
    function ctl(r) {
      if (r.type === "switch") return h("button", { class: "switch" + (r.on ? " on" : ""), type: "button", onClick: function () { r.on = !r.on; } }, [h("i")]);
      if (r.type === "select") {
        var nodes = curNodes(r);
        return h("select", { class: "select", value: r.v || "", onChange: function (e) { r.v = e.target.value; } }, nodes);
      }
      if (r.type === "num") return h("input", { class: "input num", type: "number", value: String(r.v || ""), onInput: function (e) { r.v = e.target.value; } });
      if (r.type === "custom") return h("div", { innerHTML: r.html || "" });
      return h("input", { class: "input", value: r.v || "", placeholder: r.ph || "", onInput: function (e) { r.v = e.target.value; } });
    }
    function curNodes(r) {
      var nodes = [];
      if (!r.v) nodes.push(h("option", { value: "" }, "未选择"));
      (r.opts || []).forEach(function (o) {
        var label = r.labels && r.labels[o] !== undefined ? r.labels[o] : o;
        nodes.push(h("option", { value: o }, label));
      });
      return nodes;
    }

    function field(r, key) {
      return h("div", { class: "set-field", key: key }, [
        h("div", { class: "lbl" }, [h("span", null, r.t)]),
        h("div", { class: "ctl" }, [ctl(r)])
      ]);
    }

    Vue.createApp({
      render: function () {
        return h("section", { class: "drawer open vue-card dedupe-card" }, [
          h("div", { class: "drawer-head" }, [
            h("div", { class: "drawer-t" }, [h("div", { class: "drawer-title" }, "查重")]),
            h("div", { class: "drawer-head-right" }, [
              h("span", { class: "drawer-meta" }, st.autoDupe ? "自动查重已开" : "自动查重已关"),
              h("button", { class: "btn primary slim", type: "button", disabled: st.saving, onClick: save }, st.saving ? "保存中…" : "保存")
            ])
          ]),
          h("div", { class: "drawer-body" }, st.groups.map(function (g, gi) {
            var rows = (g.rows || []).map(function (r) { return field(r, g.name + r.t); });
            if (gi === 0) rows.unshift(h("div", { class: "set-field", key: "auto" }, [
              h("div", { class: "lbl" }, [h("span", null, "自动查重")]),
              h("div", { class: "ctl" }, [h("button", { class: "switch" + (st.autoDupe ? " on" : ""), type: "button", onClick: function () { st.autoDupe = !st.autoDupe; } }, [h("i")])])
            ]));
            return h("div", { class: "flow-group", key: g.name }, [
              h("div", { class: "flow-ttl" }, g.name),
              h("div", { class: "set-fields" }, rows)
            ]);
          }))
        ]);
      }
    }).mount(box);
    load();
  }

  /* 发布卡：Vue 渲染。自定义 html 行原样注入，按钮仍靠 host 上的事件委托处理 */
  function mountPubCard(host) {
    if (!window.Vue) return;
    var Vue = window.Vue, h = Vue.h;
    var box = document.createElement("div");
    var anchor = host.querySelector('.drawer[data-name="发布"]');
    (anchor && anchor.parentNode ? anchor.parentNode : host).insertBefore(box, anchor || null);
    var st = Vue.reactive({ groups: JSON.parse(JSON.stringify(window.PTA_RULES.pub || [])), rx: { deny: "", allow: "" }, sample: "", out: "未测试", saving: false, target: "" });

    function load() {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) return;
      fetch("api/flow", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var d = j && j.ok && j.data; if (!d) return;
        var saved = d.sets && Array.isArray(d.sets.pub) ? d.sets.pub : null;
        if (!saved) return;
        st.groups.forEach(function (g, gi) {
          var rows = saved[gi];
          if (!Array.isArray(rows) || rows.length !== g.rows.length) return;
          g.rows.forEach(function (r, ri) {
            var v = rows[ri] || {};
            if (v.v !== undefined) r.v = v.v;
            if (v.on !== undefined) r.on = v.on;
            if (v.sel) r.sel = v.sel;
          });
        });
        if (d.rx) { st.rx.deny = d.rx.deny || ""; st.rx.allow = d.rx.allow || ""; }
      }).catch(function () {});
    }
    function testRx() {
      function hit(src, text) {
        if (!src) return false;
        try { return new RegExp(src, "i").test(text); } catch (e) { return text.toLowerCase().indexOf(String(src).toLowerCase()) >= 0; }
      }
      var t = String(st.sample || "");
      if (!t) { st.out = "先粘一条标题"; return; }
      st.out = hit(st.rx.deny, t) ? "排除命中，不转载" : (String(st.rx.allow || "").trim() && !hit(st.rx.allow, t) ? "白名单未命中，不转载" : "通过，可以转载");
    }
    function save() {
      if (st.saving) return;
      st.saving = true;
      fetch("api/flow", {
        method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sets: { pub: st.groups.map(function (g) { return g.rows.map(function (r) { return { t: r.t, v: r.v, on: r.on, sel: r.sel }; }); }) }, rx: { deny: st.rx.deny, allow: st.rx.allow } })
      }).then(function (r) { return r.json(); }).then(function (j) {
        st.saving = false;
        toast(j && j.ok ? "发布设置已保存" : ((j && j.error && j.error.message) || "服务端拒绝了这次保存"));
      }).catch(function () { st.saving = false; toast("保存请求没发出去"); });
    }
    function ctl(r) {
      if (r.chips) return h("div", { class: "cat-row pick-row" }, r.chips.map(function (c) {
        var on = (r.sel || []).indexOf(c) >= 0;
        return h("button", {
          class: "cat-chip" + (on ? " on" : ""), type: "button",
          onClick: function () {
            var i = (r.sel || []).indexOf(c);
            r.sel = (r.sel || []).slice();
            if (i >= 0) r.sel.splice(i, 1); else r.sel.push(c);
          }
        }, c);
      }));
      if (r.type === "switch") return h("button", { class: "switch" + (r.on ? " on" : ""), type: "button", onClick: function () { r.on = !r.on; } }, [h("i")]);
      if (r.type === "select") {
        var nodes = [];
        if (!r.v) nodes.push(h("option", { value: "" }, "未选择"));
        (r.opts || []).forEach(function (o) {
          nodes.push(h("option", { value: o }, r.labels && r.labels[o] !== undefined ? r.labels[o] : o));
        });
        return h("select", { class: "select", value: r.v || "", onChange: function (e) { r.v = e.target.value; } }, nodes);
      }
      if (r.type === "custom") return h("div", { innerHTML: r.html || "" });
      if (r.type === "fixed-btn") return h("div", { class: "fixed-row" }, [
        h("span", { class: "tpl-fixed" }, r.v || "原生转载不修改"),
        h("button", {
          class: "btn ghost slim", type: "button", disabled: !!r.on,
          onClick: function () { r.on = true; toast("已设为原生转载，标题按源站原样发布"); }
        }, r.on ? "已应用" : "应用")
      ]);
      if (r.type === "button") return h("button", {
        class: "btn ghost slim", type: "button", "data-btn": r.t,
        onClick: function () { if (r.t === "发布标题") toast("标题按源站原样发布，不改字"); }
      }, r.v || r.t);
      var isNum = r.type === "num";
      return h("input", { class: "input" + (isNum ? " num" : ""), type: isNum ? "number" : "text", value: r.v || "", placeholder: r.ph || "", onInput: function (e) { r.v = e.target.value; } });
    }

    Vue.createApp({
      render: function () {
        return h("section", { class: "drawer open vue-card" }, [
          h("div", { class: "drawer-head" }, [
            h("div", { class: "drawer-t" }, [h("div", { class: "drawer-title" }, "发布")]),
            h("div", { class: "drawer-head-right" }, [
              h("button", { class: "btn primary slim", type: "button", disabled: st.saving, onClick: save }, st.saving ? "保存中…" : "保存")
            ])
          ]),
          h("div", { class: "drawer-body" }, st.groups.map(function (g, gi) {
            return h("div", { class: "flow-group", key: g.name }, [
              h("div", { class: "flow-ttl" }, g.name),
              h("div", { class: "set-fields" }, g.rows.map(function (r) {
                return h("div", { class: "set-field", key: r.t }, [
                  h("div", { class: "lbl" }, [h("span", null, r.t)]),
                  h("div", { class: "ctl" }, [ctl(r)])
                ]);
              }))
            ]);
          }))
        ]);
      }
    }).mount(box);
    load();
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
    /* 「本地演练」外壳已经在 index.html 里，动态部分由下方的 Vue 组件与下拉选项接管 */

    /* 请求限制用 Vue 卡片单独渲染，放在抓取卡前面 */
    mountCrawlCard(host);
    mountDedupeCard(host);
    mountPubCard(host);

    function paintCrawlDry(t) {
      var box = $("#crawl-dry-box");
      var meta = $("#crawl-dry-meta");
      if (!planState) return;
      mountPlan();
      if (box) box.hidden = false;
      if (meta) meta.textContent = t.state === "done" ? "已完成" : (t.progress || 0) + "%";
      planState.dryOn = true;
      planState.dryHost = t.siteHost || "";
      planState.dryProgress = t.progress || 0;
      planState.dryDone = t.state === "done";
      planState.drySteps = (t.steps || []).map(function (s2) { return { name: s2.name, state: s2.state }; });
      planState.dryPlan = "";
      planState.dryWarns = [];
      if (t.state === "done" && t.result) {
        var p = t.result.plan || {};
        planState.dryPlan = "计划：" + (p.pages || "-") + " 页 · 并发 " + (p.concurrency || "-") +
          " · 分类 " + (p.catGroups || 0) + " 组 / " + (p.catIds || 0) + " 个 id · 预估 " + (p.estimatedQueries || 0) + " 次查询" +
          ((p.searchUrls && p.searchUrls.length) ? " · 会请求 " + p.searchUrls.length + " 个地址" : "");
        planState.dryWarns = (t.result.warnings || []).slice();
      }
    }

    var dryRunBtn = $("#crawl-dry-run");
    if (dryRunBtn) dryRunBtn.addEventListener("click", function () {
      var host0 = (crawlSiteSel && crawlSiteSel.value) || target || "";
      if (!host0) { toast("先在右上角「选来源站」里挑一个站，再开始演练"); return; }
      var seen = false;
      window.__ptaDryRun(host0, function (t) {
        paintCrawlDry(t);
        if (!seen) { seen = true; toast("已提交演练"); }
      }, function (t) {
        if (t.state === "done") toast("演练完成 · " + (t.steps || []).length + " 步");
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
      b.textContent = "按条件筛选";
      sec.insertBefore(b, sec.firstChild);
      b.addEventListener("click", function () {
        if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端，筛选不可用"); return; }
        b.disabled = true;
        fetch("/api/catalog/screen", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 50, rules: {} })
        }).then(function (r) { return r.json(); }).then(function (j) {
          b.disabled = false;
          if (!j || !j.ok) { toast((j && j.error && j.error.message) || "送审失败"); return; }
          var d = j.data;
          var rs = Object.keys(d.byReason || {}).map(function (k) { return k + " " + d.byReason[k]; }).join(" · ");
          toast("检查 " + d.checked + " 条 · 入选 " + d.selected + " · 跳过 " + d.skipped + (rs ? "（" + rs + "）" : ""));
          if (window.__ptaLoadOverview) window.__ptaLoadOverview();
        }).catch(function () { b.disabled = false; toast("筛选请求发不出去"); });
      });
    })();

    /* 演练区不是空的：进来就显示上一次演练的结果，没跑过才显示「还没跑过」 */
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

    /* 来源站：抓哪个站由这里选，和「发布 → 目标站」分开，不默认抓清单第一个 */
    var crawlSiteSel = $("#crawl-site");
    var CKEY = "pta.crawlSite";
    function fillCrawlSites() {
      if (!crawlSiteSel) return;
      var list = (MOCK.sitesList || []).slice().sort(function (a, b) {
        return String(a.title || a.name).localeCompare(String(b.title || b.name));
      });
      var cur = "";
      try { cur = localStorage.getItem(CKEY) || ""; } catch (e) {}
      if (!cur || !list.some(function (x) { return x.name === cur; })) cur = "";
      vueOptions(crawlSiteSel, [{ value: "", label: "选来源站" }].concat(list.map(function (x) { return { value: x.name, label: x.title || x.name }; })));
      crawlSiteSel.value = cur;
    }
    window.__ptaFillCrawlSites = fillCrawlSites;
    fillCrawlSites();
    if (crawlSiteSel) crawlSiteSel.addEventListener("change", function () {
      try { localStorage.setItem(CKEY, crawlSiteSel.value); } catch (e) {}
    });
    var limitSel = $("#crawl-limit");
    var LKEY = "pta.crawlLimit";
    if (limitSel) {
      try { if (localStorage.getItem(LKEY)) limitSel.value = localStorage.getItem(LKEY); } catch (e) {}
      limitSel.addEventListener("change", function () {
        try { localStorage.setItem(LKEY, limitSel.value); } catch (e) {}
      });
    }

    /* 看地址：只调 /api/crawl/plan 读本地配置拼 URL，不发任何请求 */
    var planBtn = $("#crawl-plan-btn");
    var planNav = { host: "", idx: 0, total: 0 };
    /* 看地址的结果框由 Vue 渲染，翻类/抓这一类仍走 document 上的委托 */
    var planState = window.Vue ? window.Vue.reactive({ on: false, host: "", label: "", url: "", gap: 0, dailyMax: 0, delay: 0, idx: 0, total: 0, today: "今日情况读取中…",
      dryOn: false, dryHost: "", dryProgress: 0, dryDone: false, drySteps: [], dryPlan: "", dryWarns: [] }) : null;
    var planMounted = false;
    function mountPlan() {
      if (!planState || planMounted) return;
      var box = $("#crawl-dry-box");
      if (!box) return;
      planMounted = true;
      var h = window.Vue.h;
      window.Vue.createApp({
        render: function () {
          var st = planState;
          if (st.dryOn) {
            return h("div", { class: "dl-dry" }, [
              h("div", { class: "dl-dry-head" }, [h("b", null, "演练 · " + st.dryHost), h("span", { class: "dl-dry-p" }, st.dryProgress + "%")]),
              h("ul", null, st.drySteps.map(function (s2, i) {
                return h("li", { class: s2.state === "done" ? "done" : "wait", key: i }, [h("i"), s2.name]);
              })),
              h("em", null, "只跑本地步骤，不访问任何真实站点"),
              st.dryDone && st.dryPlan ? h("div", { class: "dl-dry-note" }, st.dryPlan) : null,
              st.dryWarns.length ? h("ul", { class: "dl-dry-warn" }, st.dryWarns.map(function (w, i) { return h("li", { key: i }, w); })) : null
            ]);
          }
          return h("div", { class: "dl-dry" }, [
            h("div", { class: "dl-dry-head" }, [h("b", null, "下一抓 · " + st.host), h("span", { class: "dl-dry-p" }, "分类 " + st.label)]),
            h("div", { class: "dl-dry-note", style: "word-break:break-all" }, "GET " + st.url),
            h("div", { class: "dl-dry-note" }, "间隔至少 " + st.gap + " 秒 · 单站每天最多 " + st.dailyMax + " 次 · 请求里带的等待 " + st.delay + " 秒"),
            h("div", { class: "dl-dry-note dl-plan-nav" }, [
              h("button", { class: "btn ghost slim", type: "button", "data-planstep": "-1" }, "上一类"),
              h("span", null, "第 " + (st.idx + 1) + " / " + (st.total || 1) + " 类"),
              h("button", { class: "btn ghost slim", type: "button", "data-planstep": "1" }, "下一类"),
              h("button", { class: "btn slim", type: "button", "data-plancrawl": "1" }, "抓这一类")
            ]),
            h("div", { class: "dl-dry-note", id: "crawl-plan-today" }, st.today),
            h("em", null, "只是读出本地配置拼的地址，没有发请求；抓一页会按类目轮转，不是这里预览的这一类")
          ]);
        }
      }).mount(box);
    }
    function renderPlan(p) {
      planNav.host = p.host || "";
      planNav.idx = Number(p.catIdx) || 0;
      planNav.total = Number(p.categories) || 0;
      var label = p.categoryLabel ? p.categoryLabel + "（" + p.categoryId + "）" : (p.categoryId || "全部");
      var box = $("#crawl-dry-box");
      var meta = $("#crawl-dry-meta");
      if (meta) meta.textContent = "下一抓 · 分类 " + label;
      if (!planState) return;
      mountPlan();
      planState.host = p.host || "";
      planState.label = label;
      planState.url = p.url || "";
      planState.gap = Math.round((p.minGapMs || 0) / 1000);
      planState.dailyMax = p.dailyMax || 0;
      planState.delay = p.requestDelay || 0;
      planState.idx = planNav.idx;
      planState.total = planNav.total;
      planState.today = "今日情况读取中…";
      planState.on = true;
      planState.dryOn = false;
      if (box) box.hidden = false;
      fetch("/api/crawl/status?host=" + encodeURIComponent(p.host || ""), { credentials: "same-origin" })
        .then(function (r) { return r.json(); }).then(function (k) {
          if (!k || !k.ok) return;
          var d = k.data || {};
          var wait = Math.max(0, Math.round((d.waitMs || 0) / 1000));
          planState.today = "今天已抓 " + (d.count || 0) + "/" + (d.dailyMax || 0) + " 次" +
            (wait ? " · 还要等 " + wait + " 秒" : " · 现在可以抓") +
            " · 上次 " + (d.lastAt ? new Date(d.lastAt).toLocaleString("zh-CN", { hour12: false }).slice(5, 16) : "还没抓过");
        }).catch(function () {});
    }
    function fetchPlan(host, idx) {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端"); return; }
      if (planBtn) planBtn.disabled = true;
      fetch("/api/crawl/plan", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ host: host, catIdx: idx })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (planBtn) planBtn.disabled = false;
        if (!j || !j.ok) { toast((j && j.error && j.error.message) || "拿不到抓取计划"); return; }
        renderPlan(j.data || {});
      }).catch(function () { if (planBtn) planBtn.disabled = false; toast("计划请求发不出去"); });
    }
    if (planBtn) planBtn.addEventListener("click", function () {
      var h0 = (crawlSiteSel && crawlSiteSel.value) || "";
      if (!h0) { toast("先在右上角「选来源站」里挑一个站"); return; }
      fetchPlan(h0, 0);
    });
    /* 计划框会被重绘，用事件委托，别把监听挂在会被换掉的节点上 */
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-planstep]");
      if (b && planNav.host) {
        var total = planNav.total || 1;
        var next = planNav.idx + Number(b.getAttribute("data-planstep"));
        if (next < 0) next = total - 1;
        if (next >= total) next = 0;
        fetchPlan(planNav.host, next);
        return;
      }
      var c = e.target.closest("[data-plancrawl]");
      if (!c || !planNav.host) return;
      var lim = 100;
      try { lim = Number(localStorage.getItem("pta.crawlLimit") || 100) || 100; } catch (err) {}
      ptaConfirm("抓这一类", "会对 " + planNav.host + " 发一次 GET，抓第 " + (planNav.idx + 1) + " 类，最多 " + lim + " 条入库。确认？", function () {
        c.disabled = true;
        fetch("/api/crawl/run", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ host: planNav.host, catIdx: planNav.idx, limit: lim, dryRun: false })
        }).then(function (r) { return r.json(); }).then(function (j) {
          c.disabled = false;
          if (!j || !j.ok) { toast((j && j.error && j.error.message) || "抓取失败"); return; }
          var d = j.data || {};
          toast("第 " + d.page + " 页 · " + (d.categoryId || "") + " · 抓回 " + d.rows + " 行 · 新增 " + d.added);
          if (window.__ptaLoadSources) window.__ptaLoadSources();
          if (window.__ptaLoadOverview) window.__ptaLoadOverview();
          fetchPlan(planNav.host, planNav.idx);
        }).catch(function () { c.disabled = false; toast("抓取请求发不出去"); });
      });
    });

    /* 真抓一页：只发一次 GET，服务端守住 30 秒间隔与每日上限；失败按错误码说人话 */
    var liveBtn = $("#crawl-live-run");
    if (liveBtn) liveBtn.addEventListener("click", function () {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端，抓取不可用"); return; }
      var h = (crawlSiteSel && crawlSiteSel.value) || "";
      if (!h) { toast("先在右上角「选来源站」里挑一个站"); return; }
      liveBtn.disabled = true;
      var meta = $("#crawl-dry-meta");
      if (meta) meta.textContent = "正在抓 " + h + " …";
      fetch("/api/crawl/run", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ host: h, limit: Number(($("#crawl-limit") && $("#crawl-limit").value) || 100), dryRun: false })
      }).then(function (r) {
        return r.json().then(function (j) { return { status: r.status, j: j }; }, function () { return { status: r.status, j: null }; });
      }).then(function (out) {
        liveBtn.disabled = false;
        if (!out.j || !out.j.ok) {
          var code = out.j && out.j.error && out.j.error.code;
          var msg = (out.j && out.j.error && out.j.error.message) || ("抓取失败 " + out.status);
          if (code === "NO_COOKIE" || code === "LOGIN_REQUIRED") msg += "：去站点页的「登录」页签把这个站的 cookie 存进来";
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
        if (window.__ptaLoadSources) window.__ptaLoadSources();
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
        if (res.j.data.rx) {
          applyRx(res.j.data.rx);
          try { localStorage.setItem("pta.rx", JSON.stringify(res.j.data.rx)); } catch (e) {}
        }
        syncFlowDom();
        renderTpl();
        return true;
      });
    }
    window.__ptaLoadFlow = syncFlowFromServer;
    syncFlowFromServer();

    var mask = $("#target-modal");
    var targetState = window.Vue ? window.Vue.reactive({ rows: [], empty: false, mounted: false }) : null;
    function mountTargetList() {
      if (!targetState || targetState.mounted) return;
      var box = $("#target-list");
      if (!box) return;
      targetState.mounted = true;
      var h = window.Vue.h;
      window.Vue.createApp({
        render: function () {
          if (targetState.empty) return h("div", { class: "sites-empty" }, "没有匹配的站点");
          return targetState.rows.map(function (x) {
            return h("button", { class: "target-item" + (x.on ? " on" : ""), "data-host": x.host, type: "button", key: x.host }, [
              h("span", { class: "ti-name" }, x.title),
              h("span", { class: "ti-host" }, x.host)
            ]);
          });
        }
      }).mount(box);
    }
    function renderTargetList(qv) {
      if (!targetState) return;
      mountTargetList();
      var rows = MOCK.sitesList.filter(function (x) {
        if (!x.enabled || x.login !== "ok") return false;
        if (qv && ((x.title || "") + " " + x.name).toLowerCase().indexOf(qv) === -1) return false;
        return true;
      }).slice(0, 60);
      targetState.empty = !rows.length;
      targetState.rows = rows.map(function (x) {
        return { host: x.name, title: x.title || x.name, on: x.name === target };
      });
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
          if (f.querySelector("[data-switch].on")) parts.push(r.t);
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
        if (sec.classList.contains("vue-card")) return;   /* Vue 卡片自己管 meta */
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
      if (pick) {
        var prow = pick.closest(".pick-row");
        if (prow && prow.getAttribute("data-single")) {
          [].forEach.call(prow.querySelectorAll(".cat-chip"), function (c) { if (c !== pick) c.classList.remove("on"); });
        }
        pick.classList.toggle("on");
        refreshSums();
        return;
      }
      var sw = e.target.closest("button[data-switch]");
      if (sw) {
        sw.classList.toggle("on");
        if (sw.classList.contains("sw-chip")) sw.textContent = sw.classList.contains("on") ? "开" : "关";
        refreshSums();
        return;
      }
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
      if (save && save.closest(".vue-card")) return;
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
        var label = { fetch: "抓取", dedupe: "查重", pub: "发布" }[sKey] || sKey;
        toast(label + "设置已保存");
      }
    });

    host.addEventListener("input", function (e) {
      if (e.target && e.target.id === "sub-tpl") renderTpl();
      var scope = e.target.closest && e.target.closest(".rule-item");
      if (scope) checkNums(scope);
      refreshSums();
    });
    host.addEventListener("change", function (e) {
      refreshSums();
    });

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

  /* 设置页：Vue 3 组件渲染。用 render 函数（不跑模板编译）以符合 CSP。 */
  function initSettings() {
    var panel = $("#set-panel");
    if (!panel) return;
    if (!window.Vue) { panel.textContent = "Vue 运行时没加载"; return; }
    var h = window.Vue.h;

    function fixedRow(t, v, hint, ref) {
      return h("div", { class: "set-field" }, [
        h("div", { class: "lbl" }, [h("span", null, t), hint ? h("i", null, hint) : null]),
        h("div", { class: "ctl" }, [h("span", { class: "fixed-val" + (ref ? " ref" : "") }, v)])
      ]);
    }
    function btnRow(t, label, hint, onClick) {
      return h("div", { class: "set-field" }, [
        h("div", { class: "lbl" }, [h("span", null, t), hint ? h("i", null, hint) : null]),
        h("div", { class: "ctl" }, [h("button", { class: "btn ghost slim", type: "button", "data-btn": t, onClick: onClick }, label)])
      ]);
    }
    function card(title, desc, headExtra, rows) {
      return h("section", { class: "set-card" }, [
        h("div", { class: "set-card-head" }, [
          h("div", { class: "set-card-t" }, [h("h2", { class: "set-h2" }, title), h("p", { class: "set-desc" }, desc)]),
          headExtra || null
        ]),
        h("div", { class: "set-fields" }, rows)
      ]);
    }

    function loadMeta() {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) return Promise.resolve({});
      return Promise.all([
        fetch("api/health", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
        fetch("api/session", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      ]).then(function (a) {
        var health = a[0], sess = a[1];
        return {
          version: health && health.ok && health.data && health.data.version ? "v" + health.data.version : "—",
          user: sess && sess.ok && sess.data && sess.data.user ? sess.data.user : "—"
        };
      });
    }

    function mount() {
      var Vue = window.Vue;
      var state = Vue.reactive({
        mode: (typeof uiMode === "function" ? uiMode() : "basic"),
        version: "读取中…",
        user: "读取中…"
      });
      Vue.createApp({
        methods: {
          saveMode: function () {
            try { localStorage.setItem("pta.mode", state.mode === "dev" ? "dev" : "basic"); } catch (e) {}
            toast("已切到" + (state.mode === "dev" ? "开发版" : "基础版") + "，正在刷新");
            setTimeout(function () { location.reload(); }, 500);
          },
          logout: function () {
            ptaConfirm("退出登录", "会清掉当前浏览器的会话 cookie，下次要重新登录。退出？", function () {
              fetch("api/logout", { method: "POST", credentials: "same-origin" })
                .then(function () { toast("已退出，正在刷新"); setTimeout(function () { location.reload(); }, 500); })
                .catch(function () { toast("退出请求发不出去"); });
            });
          },
          clearCache: function () {
            ptaConfirm("清空本地缓存", "会清掉浏览器里存的站点设置、流程设置和分类映射，服务器数据不动。确定？", function () {
              try { localStorage.clear(); } catch (e) {}
              toast("本地缓存已清空，正在刷新");
              setTimeout(function () { location.reload(); }, 700);
            });
          }
        },
        render: function () {
          var self = this;
          var modeSelect = h("select", {
            class: "select", value: state.mode,
            onChange: function (e) { state.mode = e.target.value; }
          }, [h("option", { value: "basic" }, "基础版"), h("option", { value: "dev" }, "开发版")]);
          var modeRow = h("div", { class: "set-field" }, [
            h("div", { class: "lbl" }, [h("span", null, "界面模式"), h("i", null, "开发版才显示更新日志")]),
            h("div", { class: "ctl" }, [modeSelect])
          ]);
          return h("div", { class: "set-stack" }, [
            card("版本模式", "基础版只留日常要用的；开发版多出更新日志页。切换后自动刷新。",
              h("button", { class: "btn primary slim set-save", type: "button", onClick: self.saveMode }, "保存"),
              [modeRow]),
            card("面板账号", "面板账号由服务器环境变量决定，面板里不改密码，也不存明文。", null, [
              fixedRow("面板用户名", state.user, null, true),
              fixedRow("面板密码", "只放在测试机的 systemd 环境变量 PTA_PASS，面板读不到也不回显；要改就去测试机改环境变量后重启服务", null, true),
              fixedRow("会话", "HttpOnly cookie，服务进程内存里保存，重启服务需要重新登录", null, true),
              btnRow("退出登录", "退出", "清掉当前浏览器的会话 cookie", self.logout)
            ]),
            card("系统", "版本、存储和这台浏览器里的数据。", null, [
              fixedRow("当前版本", state.version, null, true),
              fixedRow("数据目录", "由服务端 PTA_DATA 指定，站点定义、词条库、队列、日志都在里面", null, true),
              fixedRow("日志上限", "2 MB，超过自动轮转一份旧日志", null, true),
              btnRow("清空本地缓存", "清空", "只会清掉浏览器里的设置，不动服务器数据", self.clearCache)
            ])
          ]);
        }
      }).mount(panel);
      loadMeta().then(function (meta) {
        state.version = meta.version || "—";
        state.user = meta.user || "—";
      });
    }

    mount();
  }

  function initSites() {
    var list = $("#sites-list");
    if (!list) return;
    var detail = $("#site-detail");
    var state = { q: "", status: "all", arch: "all", login: "all", preset: "all", sel: null, tab: "overview", picks: [], page: 1, setTab: "login", open: false, closed: {} };
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
        if (state.crawl && state.crawl !== "all") {
          var df = (window.__ptaDefs || {})[s.name] || null;
          var crawled = !!(df && df.crawled);
          if (state.crawl === "crawled" && !crawled) return false;
          if (state.crawl === "never" && crawled) return false;
          if (state.crawl === "today" && !(df && df.crawlCount > 0)) return false;
        }
        if (state.q && ((s.title || "") + " " + s.name + " " + s.url).toLowerCase().indexOf(state.q) === -1) return false;
        return true;
      });
    }

    function dotCls(s) {
      return s.login === "ok" ? "ok" : s.login === "fail" ? "bad" : "idle";
    }

    /* 上次抓取：优先用服务端抓取状态（crawl-state → /api/site-defs），没有才退回本地值 */
    function lastCrawlTxt(s) {
      var d = defOf(s.name);
      if (!d) return s.last || "—";
      if (!d.crawled) return "未抓取";
      var t = d.crawlAt ? new Date(d.crawlAt) : null;
      function p2(n) { return String(n).padStart(2, "0"); }
      if (!t || isNaN(t.getTime())) return "抓过";
      var now = new Date();
      var sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
      return (sameDay ? "今日 " : p2(t.getMonth() + 1) + "-" + p2(t.getDate()) + " ") + p2(t.getHours()) + ":" + p2(t.getMinutes());
    }

    function setCtlVNode(r) {
      var h = window.Vue.h;
      if (r.type === "switch") {
        return h("button", { class: "switch" + ((r.on || r.v) ? " on" : ""), "data-switch": r.k || "", type: "button" }, [h("i")]);
      }
      if (r.type === "select") {
        var cur = r.v || "";
        var opts = [];
        if (cur === "") opts.push(h("option", { value: "", selected: true }, "未选择"));
        (r.opts || []).forEach(function (o) {
          var label = r.labels && r.labels[o] !== undefined ? r.labels[o] : o;
          opts.push(h("option", { value: o, selected: String(o) === String(cur) }, label));
        });
        return h("select", { class: "select", "data-k": r.k || undefined }, opts);
      }
      if (r.type === "textarea") {
        return h("textarea", { class: "input sd-note", "data-k": r.k, placeholder: r.ph || undefined, value: r.v || "" });
      }
      if (r.type === "num") {
        return h("span", null, [
          h("input", { class: "input num", "data-k": r.k, value: r.v === undefined ? "" : String(r.v),
            "data-min": r.range ? String(r.range[0]) : undefined, "data-max": r.range ? String(r.range[1]) : undefined,
            inputmode: "numeric", placeholder: r.ph || "" }),
          h("em", { class: "num-warn" })
        ]);
      }
      if (r.type === "fixed") {
        return h("span", { class: "fixed-val" + (r.noTag ? " ref" : ""), "data-k": r.k || undefined },
          r.noTag ? (r.v || "系统锁定") : [r.v || "系统锁定", h("i", null, "系统固定")]);
      }
      if (r.type === "button") {
        return h("button", { class: "btn ghost slim", "data-btn": r.t, type: "button" }, r.v);
      }
      return h("input", { class: "input", "data-k": r.k, value: r.v === undefined ? "" : String(r.v),
        disabled: !!r.disabled, placeholder: r.ph || "" });
    }
    function setRowsVNode(rows) {
      var h = window.Vue.h;
      return rows.map(function (r) {
        return h("div", { class: "set-field" + (r.cls ? " " + r.cls : "") }, [
          h("div", { class: "lbl" }, [h("span", null, r.t)]),
          h("div", { class: "ctl" }, [setCtlVNode(r)])
        ]);
      });
    }
    function settingsVNode(s) {
      var h = window.Vue.h;
      var tab = state.setTab || "login";
      if (tab === "override") {
        return h("div", { class: "sd-form" }, [
          h("div", { class: "set-fields" }, setRowsVNode([
            { t: "单独设置本站", type: "switch", k: "override", on: !!s.override,
              hint: s.override ? "已开启：下面几项只对这个站生效" : "已关闭：这个站跟随流程页「请求限制」" }
          ])),
          h("div", { class: "set-fields" + (s.override ? "" : " is-off") }, setRowsVNode([
            { t: "抓取间隔", type: "select", k: "ovInterval", v: s.ovInterval == null ? "" : String(s.ovInterval),
              opts: ["", "1", "5", "15", "60", "180"],
              labels: { "": "跟随全局", "1": "1 分钟", "5": "5 分钟", "15": "15 分钟", "60": "1 小时", "180": "3 小时" },
              hint: "这个站两次抓取之间隔多少分钟；服务端仍会按下限压一次" },
            { t: "每天抓几次", type: "num", k: "ovDaily", v: s.ovDaily == null ? "" : String(s.ovDaily), range: [1, 20],
              ph: "留空＝跟随全局", hint: "次数上限，不是条数；一轮多少条在流程页「抓多少条」里选" },
            { t: "抓详情页", type: "switch", k: "ovDetail", on: !!s.ovDetail, hint: "这个站要不要每条再进一次详情页" },
            { t: "优先级", type: "select", k: "priority", v: s.priority || "normal", opts: ["high", "normal", "low"],
              labels: { high: "高（先抓）", normal: "普通", low: "低（最后抓）" }, hint: "先存配置，抓取暂不按优先级排序" }
          ])),
          h("div", { class: "set-fields" }, setRowsVNode([
            { t: "分类映射", type: "button", cls: "map-row",
              v: (catMapCount(s.name) ? "已配 " + catMapCount(s.name) + " 条" : "配置映射"),
              hint: "站点自己的分类对到库内分类，不受上面的开关影响" }
          ]))
        ]);
      }
      if (tab === "search") {
        var pdetail = s.presetDetail;
        var psum = presetOf(s.name) || {};
        var dfn = defOf(s.name);
        var sEng = (pdetail && pdetail.engine) || psum.engine || "";
        var catGroups = (pdetail && pdetail.cats) || (psum && psum.cats) || (dfn && dfn.cats) || null;
        function firstCatId(v) {
          var a = Array.isArray(v) ? v : String(v || "").split(",");
          return a.filter(function (x) { return x !== "" && x !== null && x !== undefined; })[0] || "";
        }
        function cleanUrl(u) { return String(u || "").split("%7Bq%7D").join("").split("%7bq%7d").join("").split("{q}").join(""); }
        function previewUrls() {
          if (s.presetUrls && s.presetUrls.length) {
            return s.presetUrls.map(function (u) { return { group: u.group, catId: u.catId, url: cleanUrl(u.url) }; });
          }
          var d = dfn || {};
          var base = String(d.base || s.url || "").replace(/\/+$/, "");
          var sp = (d.search && d.search.searchPath) || "";
          var params = d.search && d.search.params;
          if (!base || !sp || !params) return [];
          var out = [];
          Object.keys(catGroups || {}).forEach(function (g) {
            var cid = firstCatId((catGroups || {})[g]);
            if (!cid) return;
            var qs = Object.keys(params).map(function (k) {
              var v = String(params[k]).split("{cats}").join(cid).split("{q}").join("");
              return encodeURIComponent(k) + "=" + encodeURIComponent(v);
            }).join("&");
            out.push({ group: g, catId: cid, url: base + sp + "?" + qs });
          });
          return out;
        }
        var srcTxt = (function () {
          var src = (pdetail && pdetail.source) || (psum && psum.source) || "";
          if (!src) return "还没有预设";
          if (src === "auto") return "采样自动生成，还没人工确认";
          if (src === "arch") return "按清单架构推断，还没采样";
          if (src === "manual") return "人工确认过的";
          return src;
        })();
        var paramTxt = (function () {
          var mode = (pdetail && pdetail.catMode) || (dfn && dfn.search && dfn.search.catMode) || "";
          var param = (pdetail && pdetail.catParam) || (dfn && dfn.search && dfn.search.params
            ? Object.keys(dfn.search.params).filter(function (k) { return String(dfn.search.params[k]).indexOf("{cats}") >= 0; })[0] : "");
          if (!mode && !param) return (catGroups && Object.keys(catGroups).length) ? "cat（按分类 id 筛）" : "—";
          return (mode || "—") + (param ? " · " + param : "");
        })();
        var crawlTxt = (function () {
          var c = s.defCrawl;
          if (!c || !c.at) return "还没抓过";
          var when = new Date(c.at).toLocaleString("zh-CN", { hour12: false }).slice(5, 16);
          return "上次 " + when + " · 今日 " + (c.count || 0) + " 次 · 分类 " + ((c.catIdx || 0) + 1) + " · 下一页 " + ((c.page || 0) + 1);
        })();
        var catTxt2 = (function () {
          var c = s.defCatalog;
          if (!c || !c.total) return "这个站还没有词条";
          var b = c.byStatus || {};
          return "共 " + c.total + " 条 · 待筛选 " + (b.new || 0) + " · 已送审 " + (b.selected || 0) + " · 已发 " + (b.published || 0);
        })();
        var catRows = catGroups && Object.keys(catGroups).length
          ? Object.keys(catGroups).map(function (g) {
            return h("div", { class: "sd-row" }, [h("span", null, g), h("b", null, (catGroups[g] || []).join(", ") || "—")]);
          })
          : [h("div", { class: "sd-row" }, [h("span", null, "状态"), h("b", null, "还没有分类映射")])];
        var urls = previewUrls();
        var out = [
          h("div", { class: "set-fields" }, setRowsVNode([
            { t: "引擎", type: "fixed", v: sEng ? (engCode(sEng) + " · " + sEng) : "未识别", noTag: true },
            { t: "预设来源", type: "fixed", v: srcTxt, noTag: true },
            { t: "分类参数", type: "fixed", v: paramTxt, noTag: true },
            { t: "抓取状态", type: "fixed", v: crawlTxt, noTag: true },
            { t: "词条", type: "fixed", v: catTxt2, noTag: true }
          ])),
          h("div", { class: "set-fields" }, [h("div", { class: "sd-block" }, [h("h4", null, "分类 id")].concat(catRows))])
        ];
        if (urls.length) {
          out.push(h("div", { class: "set-fields" }, [h("div", { class: "sd-block" }, [h("h4", null, "搜索链接预览")].concat(
            urls.slice(0, 6).map(function (u) {
              var tag = (u.group || "全部") + (u.catId ? " · " + u.catId : "");
              return h("a", { class: "sd-preset-url", href: u.url, target: "_blank", rel: "noopener noreferrer" },
                tag + " → " + String(u.url).replace(/^https?:\/\//, ""));
            }),
            [h("div", { class: "sd-row" }, [h("span", null, "说明"), h("b", null, "点开就是该站真实搜索页，确认分类对不对")])]
          ))]));
        }
        out.push(h("div", { class: "sd-cookie-bar" }, [
          (pdetail && pdetail.confirmed) ? null : h("button", { class: "btn ghost slim", id: "sd-preset-confirm", "data-act": "preset-confirm", type: "button" }, "确认这个预设"),
          h("span", { class: "sd-cookie-res", id: "sd-preset-res" },
            pdetail ? ((pdetail.confirmed ? "已人工确认 · " : "更新于 ") + (pdetail.updatedAt || "—")) : "打开这个页签时读一次服务端预设")
        ]));
        out.push(h("div", { class: "sd-cookie-bar" }, [h("span", { class: "sd-cookie-res" },
          (!catGroups || !Object.keys(catGroups).length)
            ? (dfn && dfn.kind === "shell"
              ? "这个站的列表由脚本渲染，源码里没有分类：在浏览器登录后把种子页存到 pta/data/manual 再跑 ingest-manual"
              : "还没采到分类 id：登录后存种子页到 pta/data/manual，或等下次补采")
            : "分类来自采样，对照站点没问题就点确认，来源会改成手动")]));
        return h("div", { class: "sd-form" }, out);
      }
      var savedWhen = "";
      if (s.cookieSaved && s.cookieUpdatedAt) {
        var ct = new Date(s.cookieUpdatedAt);
        if (!isNaN(ct.getTime())) savedWhen = " · " + ct.toLocaleString("zh-CN", { hour12: false }).slice(5, 16);
      }
      var savedTxt = s.cookieSaved ? ("已保存" + savedWhen) : "未保存";
      var checkTxt = s.cookieCheckMsg || "还没自检";
      return h("div", { class: "sd-form" }, [
        h("div", { class: "set-fields" }, setRowsVNode([
          { t: "站点地址", type: "text", k: "url", v: s.url || "", ph: "https://站点域名/index.php" }
        ])),
        h("div", { class: "set-fields" }, setRowsVNode([
          { t: "Cookie（" + savedTxt + "）", type: "textarea", k: "cookie", v: s.cookie || "",
            ph: s.cookieSaved ? "已保存的 cookie 不回显；要换就整段粘贴覆盖再保存" : "粘贴 name1=value1; name2=value2" }
        ])),
        h("div", { class: "sd-cookie-bar" }, [
          h("button", { class: "btn ghost slim", id: "sd-cookie-test", "data-act": "cookie-test", type: "button" }, "自检"),
          h("span", { class: "sd-cookie-res", id: "sd-cookie-res" }, checkTxt)
        ])
      ]);
    }

    /* 概览页签用 vnode 渲染，结构照旧；设置页签仍暂用原字符串 */
    function ovVNode(s) {
      var h = window.Vue.h;
      var cr = s.defCrawl || null;
      var cat = s.defCatalog || null;
      var next = s.enabled ? "手动触发（点「抓一页」）" : "已停用";
      var lastRes = cr && cr.at ? ["已抓取", "ok"] : ["未抓取", "idle"];
      var modeTxt = s.mode === "full" ? "全量" : s.mode === "mixed" ? "增量 + 定期全量" : "增量";
      var recs = s.recentItems || [];
      var loginTxt = s.login === "ok" ? "cookie 可用" : s.login === "fail" ? "cookie 失效" : "还没自检";
      var dres = defOf(s.name);
      var pres = presetOf(s.name);
      var engRaw = (pres && pres.engine) || (dres && dres.engine) || "";
      var engTxt = engRaw ? engCode(engRaw) + " · " + engRaw : "未识别";
      var sampleTxt = dres ? (dres.rows || 0) + " 行 · " + (dres.groups || 0) + " 组分类" : "还没采样";
      var KIND_TXT = { sample: "采样确认", shell: "引擎按页面特征确认，分类待补", arch: "按清单架构推断，还没采样" };
      var kindTxt = !dres ? "没有定义" : (KIND_TXT[dres.kind] || (dres.engine ? "引擎已确认，分类待补" : "按清单架构推断，还没采样"));
      function row(label, value, cls) {
        return h("div", { class: "sd-row" }, [h("span", null, label), cls ? h("b", { class: cls }, value) : h("b", null, value)]);
      }
      return h("div", { class: "sd-ov" }, [
        h("div", { class: "sd-strip" }, [
          h("span", null, ["已收录", h("b", null, cat && cat.total ? String(cat.total) : "—")]),
          h("span", null, ["今日", h("b", null, cr ? "+" + (cr.count || 0) : "—")]),
          h("span", null, ["上次", h("b", null, cr && cr.at ? lastCrawlTxt(s) : "未抓取")]),
          h("span", null, ["下次", h("b", null, next)])
        ]),
        h("div", { class: "sd-compact" }, [
          h("div", { class: "sd-col" }, [
            h("div", { class: "sd-block" }, [
              h("h4", null, "登录"),
              row("状态", loginTxt, dotCls(s) + "-t"),
              row("方式", "Cookie"),
              row("登录凭据", s.cookieSaved ? "已保存" : "未保存"),
              row("引擎", engTxt),
              row("采样", sampleTxt),
              row("来源", kindTxt)
            ]),
            h("div", { class: "sd-block" }, [
              h("h4", null, "抓取"),
              row("上次结果", lastRes[0], lastRes[1] + "-t"),
              row("今日已跑", (cr ? (cr.count || 0) : 0) + " 次"),
              row("方式", modeTxt),
              row("范围", dresCatTxt(s))
            ])
          ]),
          h("div", { class: "sd-recent-wrap" }, [
            h("h4", null, "最近收录")
          ].concat(recs.length ? recs.map(function (r) {
            return h("div", { class: "sd-recent" }, [
              h("span", { class: "t-main" }, r.title || ""),
              h("span", { class: "soft" }, r.size || ""),
              h("span", { class: "soft" }, String(r.createdAt || "").slice(5, 16).replace("T", " "))
            ]);
          }) : [row("状态", "这个站还没有词条")]))
        ])
      ]);
    }

    /* 分类范围文案：优先用预设里的分类组，没有就说没采到 */
    function dresCatTxt(s) {
      var pres = presetOf(s.name);
      var d = defOf(s.name);
      var groups = (pres && pres.groups) || (d && d.groups) || 0;
      var txt = groups ? groups + " 组分类" : "还没有分类";
      if (s.fullDiscOnly) txt += " · 只收原盘";
      return txt;
    }

    var CATS = [["movie", "电影"], ["tv", "剧集"], ["show", "综艺"], ["anime", "动漫"],
      ["doc", "纪录"], ["music", "音乐"], ["sport", "体育"], ["other", "其他"]];
    var RES = [["any", "不限"], ["720p", "720p 及以上"], ["1080p", "1080p 及以上"], ["2160p", "2160p 及以上"]];

    var SET_TABS = [["login", "登录"], ["search", "搜索预设"], ["override", "站点覆盖"]];

    function collect(s) {
      var dv = document.getElementById("site-detail") || detail;
      dv.querySelectorAll("[data-k]").forEach(function (el) {
        var k = el.getAttribute("data-k");
        if (!k || k === "undefined") return;
        s[k] = (el.value !== undefined ? el.value : el.textContent).trim();
      });
      dv.querySelectorAll("[data-switch]").forEach(function (el) {
        var k = el.getAttribute("data-switch");
        if (k) s[k] = el.classList.contains("on");
      });
      var chips = dv.querySelectorAll(".cat-chip.on:not(.sw-chip)");
      if (chips.length) s.cats = [].map.call(chips, function (c) { return c.getAttribute("data-cat"); });
      return s;
    }

    function paintDetail() {
      var s = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
      /* 抽屉一打开就把站点定义、搜索预设、最近词条都取一次：概览和搜索页签都用得上 */
      if (s && window.fetch && /^https?:$/.test(location.protocol) && !s.drawerLoaded) {
        s.drawerLoaded = true;
        fetch("/api/site-def/" + encodeURIComponent(s.name), { credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            if (!j || !j.ok || !j.data) return;
            s.defCrawl = j.data.crawl || null;
            s.defCatalog = j.data.catalog || null;
            if (state.sel === s.name) paint();
          })
          .catch(function () {});
        fetch("/api/sites/" + encodeURIComponent(s.name) + "/search", { credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            if (!j || !j.ok) return;
            s.presetDetail = (j.data && j.data.preset) || null;
            s.presetUrls = (j.data && Array.isArray(j.data.urls)) ? j.data.urls : [];
            if (state.sel === s.name) paint();
          })
          .catch(function () {});
        fetch("/api/catalog?site=" + encodeURIComponent(s.name) + "&limit=6", { credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            if (!j || !j.ok) return;
            s.recentItems = (j.data && j.data.items) || [];
            if (state.sel === s.name) paint();
          })
          .catch(function () {});
      }
      if (s && state.setTab === "login" && window.__ptaCred && !s.cookieChecked) {
        s.cookieChecked = true;
        window.__ptaCred.req("").then(function (res) {
          if (!res || !res.j || !res.j.ok || !Array.isArray(res.j.data)) return;
          var hit = res.j.data.filter(function (c) { return c.host === s.name; })[0];
          s.cookieSaved = !!(hit && hit.hasCookie);
          s.cookieUpdatedAt = (hit && hit.updatedAt) || "";
          if (state.sel === s.name) paint();
        });
      }
      var drawerSt = window.__ptaDrawerState;
      if (!drawerSt) return;
      if (!s || !state.open) { drawerSt.on = false; drawerSt.site = null; drawerSt.body = ""; siteState.tick++; return; }
      drawerSt.on = true;
      drawerSt.site = s;
      drawerSt.isSettings = state.tab === "settings";
      detail = document.getElementById("site-detail") || detail;
      siteState.tick++;
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

    /* 站点统计条交给 Vue：数字、架构分段、图例、覆盖说明都由状态驱动 */
    var statsState = window.Vue ? window.Vue.reactive({ nums: { total: 0, enabled: 0, loginFail: 0, unknown: 0 }, segs: [], legend: [], cov: "" }) : null;
    var statsMounted = false;
    function mountStats() {
      if (!statsState || statsMounted) return;
      var host = $("#sites-stats");
      if (!host) return;
      statsMounted = true;
      var h = window.Vue.h;
      window.Vue.createApp({
        render: function () {
          var st = statsState;
          return [
            h("div", { class: "ss-nums" }, [
              h("div", null, [h("span", null, "总站点"), h("b", null, String(st.nums.total))]),
              h("div", null, [h("span", null, "启用"), h("b", null, String(st.nums.enabled))]),
              h("div", null, [h("span", null, "登录失效"), h("b", { class: "warn" }, String(st.nums.loginFail))]),
              h("div", null, [h("span", null, "还没自检"), h("b", null, String(st.nums.unknown))])
            ]),
            h("div", { class: "ss-arch" }, [
              h("div", { class: "ss-bar" }, st.segs.map(function (x, i) {
                return h("i", { class: "seg", key: i, style: "width:" + x.w + "%;background:" + x.color });
              })),
              h("div", { class: "ss-legend" }, st.legend.map(function (x, i) {
                return h("span", { key: i }, [h("i", { class: "dot", style: "background:" + x.color }), x.name + " " + x.count]);
              }))
            ]),
            st.cov ? h("div", { class: "ss-cov" }, st.cov) : null
          ];
        }
      }).mount(host);
    }
    function renderStats() {
      if (!statsState) return;
      mountStats();
      var st = siteStats(MOCK.sitesList);
      var order = ["NP", "UNIT3D", "GZ", "OTHER", "?"];
      var names = { NP: "NexusPHP", UNIT3D: "UNIT3D", GZ: "Gazelle", OTHER: "其它", "?": "未确认" };
      var count = { NP: st.np, UNIT3D: st.unit3d, GZ: st.gz, OTHER: st.oth, "?": st.unk };
      var total = st.total || 1;
      var colors = { NP: "#4f46e5", UNIT3D: "#6b62e8", GZ: "#8b84ee", OTHER: "#b3adf3", "?": "#c9cedb" };
      statsState.nums = { total: st.total, enabled: st.enabled, loginFail: st.loginFail, unknown: st.unknown };
      statsState.segs = order.filter(function (k) { return count[k]; }).map(function (k) {
        return { w: (count[k] / total * 100).toFixed(2), color: colors[k] };
      });
      statsState.legend = order.filter(function (k) { return count[k]; }).map(function (k) {
        return { color: colors[k], name: names[k], count: count[k] };
      });
      var cov = coverageStats();
      if (!cov.total) { statsState.cov = ""; return; }
      var covText = "已适配 " + cov.total + " 站 · 采样成功 " + cov.verified +
        " 站（NP " + (cov.eng.nexusphp || 0) + " · U3D " + (cov.eng.unit3d || 0) +
        " · GZ " + (cov.eng.gazelle || 0) + " · 兜底 " + (cov.eng.custom || 0) + "）";
      var ps = presetStats();
      if (ps.total) covText += " · 预设：已确认 " + ps.confirmed + " · 有分类 " + ps.withCats + " · 待补 " + (ps.total - ps.withCats);
      var defs = window.__ptaDefs || {};
      var crawled = 0, today = 0;
      Object.keys(defs).forEach(function (h2) {
        if (defs[h2] && defs[h2].crawled) crawled++;
        if (defs[h2] && defs[h2].crawlCount) today += defs[h2].crawlCount;
      });
      covText += crawled ? " · 已抓过 " + crawled + " 站（今日 " + today + " 次）" : " · 还没抓过";
      statsState.cov = covText;
    }

    /* 站点行交给 Vue；抽屉作为行间元素由 Vue 放在选中行后面 */
    var siteState = window.Vue ? window.Vue.reactive({ rows: [], open: false, sel: null, empty: "没有匹配的站点", tick: 0 }) : null;
    /* 翻页器交给 Vue，按钮仍用 data-pg 让 pager 上的委托读到 */
    var pagerState = window.Vue ? window.Vue.reactive({ show: false, page: 1, pages: 1, total: 0 }) : null;
    var pagerMounted = false;
    function mountPager() {
      if (!pagerState || pagerMounted) return;
      var pager = $("#sites-pager");
      if (!pager) return;
      pagerMounted = true;
      var h = window.Vue.h;
      window.Vue.createApp({
        render: function () {
          if (!pagerState.show) return null;
          return [
            h("button", { class: "btn ghost slim", "data-pg": "-1", disabled: pagerState.page <= 1 }, "上一页"),
            h("span", null, "第 " + pagerState.page + " / " + pagerState.pages + " 页 · 共 " + pagerState.total + " 个"),
            h("button", { class: "btn ghost slim", "data-pg": "1", disabled: pagerState.page >= pagerState.pages }, "下一页")
          ];
        }
      }).mount(pager);
    }

    function paintSiteRows(pageRows, rowsAll) {
      if (!siteState) return;
      siteState.open = !!state.open;
      siteState.sel = state.sel;
      siteState.empty = rowsAll.length ? "没有匹配的站点" : "清单里还没有站点";
      siteState.rows = (pageRows || []).map(function (s) {
        var a = archOf(s);
        return {
          host: s.name, title: s.title || s.name, archCls: a[0], archTxt: a[1],
          dot: dotCls(s), loginTxt: s.login === "ok" ? "可用" : s.login === "fail" ? "失效" : "未自检",
          presetOn: !!presetOf(s.name), presetTxt: presetTxt(s.name),
          mode: s.mode === "full" ? "全量" : s.mode === "mixed" ? "增量+定期" : "增量",
          last: lastCrawlTxt(s), picked: state.picks.indexOf(s.name) >= 0,
          on: state.sel === s.name
        };
      });
    }
    if (siteState) {
      var StVue = window.Vue, sth = StVue.h;
      function siteRow(r) {
        return sth("div", { class: "site-item" + (r.on ? " on" : ""), "data-host": r.host, key: r.host }, [
          sth("input", { type: "checkbox", class: "site-pick", "data-host": r.host, checked: r.picked }),
          sth("span", { class: "st " + r.dot }, [sth("i")]),
          sth("span", { class: "si-txt" }, [sth("b", null, r.title)]),
          sth("span", { class: "si-arch" }, [sth("em", { class: "chip " + r.archCls }, r.archTxt)]),
          sth("span", { class: "si-login " + r.dot }, r.loginTxt),
          sth("span", { class: "si-preset" + (r.presetOn ? " on" : "") }, r.presetTxt),
          sth("span", { class: "si-mode" }, r.mode),
          sth("span", { class: "si-last" }, r.last)
        ]);
      }
      /* 抽屉也由同一个 Vue app 渲染：头部与操作栏用 vnode，页签正文暂复用原字符串注入 */
      var drawerState = { on: false, site: null, body: "", isSettings: false };
      window.__ptaDrawerState = drawerState;
      function drawerVNode() {
        var s2 = drawerState.site;
        var st = siteState;
        if (!st.open || !s2) return null;
        var a = archOf(s2);
        var archOpts = ["NP", "UNIT3D", "GZ", "OTHER", "?"].map(function (k) {
          return sth("option", { value: k, selected: (s2.arch || "?") === k }, ACH[k][1]);
        });
        var tabBtns = SET_TABS.map(function (t) {
          var on = state.tab === "settings" && state.setTab === t[0];
          return sth("button", { class: "btn slim tabbtn" + (on ? " active" : ""), "data-settab": t[0], type: "button" }, t[1]);
        });
        return sth("div", { class: "site-expand", id: "site-detail", key: "detail" }, [
          sth("div", { class: "sd-top" }, [
            sth("em", { class: "ava lg " + a[0] }, initials(s2)),
            sth("div", { class: "sd-id" }, [
              sth("div", { class: "sd-title-row" }, [
                sth("h2", null, s2.title || s2.name),
                sth("span", { class: "pill2 " + (s2.enabled ? "on" : "off") }, s2.enabled ? "启用中" : "已停用"),
                sth("span", { class: "chip " + (presetOf(s2.name) ? "np" : "unk") }, "搜索预设 " + (presetOf(s2.name) ? "已确认" : "未确认"))
              ]),
              sth("span", { class: "sd-selfcheck", id: "sd-selfcheck" }, s2.checkAt ? ("上次自检 " + s2.checkAt + " · " + (s2.checkMsg || "")) : "还没做过连接自检")
            ]),
            sth("div", { class: "sd-actions" }, [
              sth("button", { class: "switch sm" + (s2.enabled ? " on" : ""), "data-switch": "enabled", type: "button", title: "启用或停用这个站的抓取" }, [sth("i")]),
              sth("button", { class: "btn slim", "data-act": "crawl-one", type: "button", title: "按搜索预设抓这个站一页，只发一次 GET" }, "抓一页"),
              sth("select", { class: "select slim sd-arch-sel", id: "sd-arch", title: "站点架构" }, archOpts),
              sth("button", { class: "btn slim", "data-act": "selfcheck", type: "button", title: "演练：只读本地配置，不访问真实站点" }, "连接自检"),
              sth("button", { class: "btn slim tabbtn" + (state.tab === "overview" ? " active" : ""), "data-tab": "overview", type: "button" }, "概览"),
              tabBtns
            ]),
            sth("button", { class: "sheet-x", "data-act": "close-sheet", "aria-label": "关闭", type: "button" }, "✕")
          ]),
          drawerState.isSettings
            ? sth("div", { class: "sd-scroll" }, [settingsVNode(s2)])
            : sth("div", { class: "sd-scroll" }, [ovVNode(s2)]),
          drawerState.isSettings ? sth("div", { class: "sd-form-actions" }, [
            sth("button", { class: "btn primary slim", "data-act": "save", type: "button" }, "保存设置"),
            sth("button", { class: "btn ghost slim", "data-act": "reset", type: "button" }, "恢复默认"),
            sth("div", { class: "spacer" }),
            sth("button", { class: "btn ghost slim danger", "data-act": "remove", type: "button" }, "移除站点")
          ]) : null
        ]);
      }
      StVue.createApp({
        render: function () {
          siteState.tick;
          if (!siteState.rows.length) return sth("div", { class: "sites-empty" }, siteState.empty);
          var out = [];
          siteState.rows.forEach(function (r) {
            out.push(siteRow(r));
            if (siteState.open && r.host === siteState.sel) out.push(drawerVNode());
          });
          return out;
        }
      }).mount(list);
    }

    function paint() {
      var rows = filtered();
      var order = ["NP", "UNIT3D", "GZ", "OTHER", "?"];
      var names = { NP: "NexusPHP", UNIT3D: "UNIT3D", GZ: "Gazelle", OTHER: "其它", "?": "未确认" };
      var groups = {};
      rows.forEach(function (s) { groups[s.name] = s; });
      var SITE_PAGE = 60;
      var pages = Math.max(1, Math.ceil(rows.length / SITE_PAGE));
      if (state.page > pages) state.page = pages;
      if (state.page < 1) state.page = 1;
      var pageRows = rows.slice((state.page - 1) * SITE_PAGE, state.page * SITE_PAGE);
      paintSiteRows(pageRows, rows);
      if (pagerState) {
        mountPager();
        pagerState.show = rows.length > SITE_PAGE;
        pagerState.page = state.page;
        pagerState.pages = pages;
        pagerState.total = rows.length;
      }
      var cnt = $("#sites-count");
      if (cnt) cnt.textContent = MOCK.sitesList.length;
      var hint = $("#sites-hint");
      if (hint) hint.textContent = rows.length === MOCK.sitesList.length ? "全部" : "匹配 " + rows.length + " 个";
      renderStats();
      detail = document.getElementById("site-detail") || detail;
      if (detail) detail.hidden = !(state.open && state.sel);
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
    var crawlSel = $("#site-crawl");
    if (crawlSel) crawlSel.addEventListener("change", function (e) { state.crawl = e.target.value; state.page = 1; paint(); });

    /* ---- 详情交互 ---- */
    list.addEventListener("change", function (e) {
      var dk = e.target.getAttribute && e.target.getAttribute("data-k");
      if (dk === "loginMethod" || dk === "mode" || dk === "trigger") {
        var cur = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
        if (cur) { collect(cur); paintDetail(); }
      }
      if (e.target.id === "sd-arch") {
        var ca = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
        if (ca) {
          ca.arch = e.target.value;
          window.__ptaStore.set(ca.name, ca);
          window.__ptaStore.save();
          refreshStats(); paint();
          toast("架构改成 " + (ACH[ca.arch] || ACH["?"])[1]);
        }
      }
    });
    list.addEventListener("click", function (e) {
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
        if (sw.classList.contains("sw-chip")) sw.textContent = sw.classList.contains("on") ? "开" : "关";
        var sk = sw.getAttribute("data-switch");
        if (sk === "override" || sk === "timeWindow") {
          var cs = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
          if (cs) { collect(cs); paintDetail(); }
        }
        if (sk === "enabled") {
          var es = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
          if (es) {
            es.enabled = sw.classList.contains("on");
            window.__ptaStore.set(es.name, es);
            window.__ptaStore.save();
            refreshStats(); paint();
            toast(es.enabled ? "已启用抓取" : "已停用抓取");
          }
        }
        return;
      }

      var btn = e.target.closest("button[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      var s = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
      if (!s) return;

      if (act === "preset-confirm") {
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
      if (act === "cookie-test") {
        var resBox = $("#sd-cookie-res");
        if (resBox) resBox.textContent = "正在用已保存的 cookie 访问首页…";
        fetch("/api/sites/" + encodeURIComponent(s.name) + "/session-test", { method: "POST", credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j || !j.ok) {
              var msg = (j && j.error && j.error.message) || "自检失败";
              s.cookieCheckMsg = msg;
              if (resBox) resBox.textContent = msg;
              toast(msg);
              return;
            }
            var d = j.data, st = (d.steps || [])[0] || {};
            var txt = (d.pass ? "cookie 可用" : "cookie 用不了") + " · HTTP " + (st.status || "—") +
              (st.ms !== undefined ? " · " + st.ms + "ms" : "") + (st.error ? " · " + st.error : "");
            if (!d.pass && d.hint) txt += " · " + d.hint;
            s.cookieCheckMsg = txt;
            if (resBox) resBox.textContent = txt;
            toast(d.pass ? "cookie 可用" : (d.hint || "cookie 用不了"));
          })
          .catch(function () {
            s.cookieCheckMsg = "本地预览没有后端，自检不可用";
            if (resBox) resBox.textContent = "本地预览没有后端，自检不可用";
            toast("本地预览没有后端，自检不可用");
          });
        return;
      }
      if (act === "crawl-one") {
        if (btn.disabled) return;
        if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端，抓取不可用"); return; }
        var cLim = 100;
        try { cLim = Number(localStorage.getItem("pta.crawlLimit") || 100) || 100; } catch (e) {}
        ptaConfirm("抓一页", "会对 " + s.name + " 发一次 GET（带已存的 cookie），抓第一页最多 " + cLim + " 条入库。确认？", function () {
        var oldT = btn.textContent;
        btn.disabled = true;
        btn.textContent = "抓取中…";
        fetch("/api/crawl/run", {
          method: "POST", credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ host: s.name, limit: cLim, dryRun: false })
        }).then(function (r) { return r.json(); }).then(function (j) {
          btn.disabled = false;
          btn.textContent = oldT;
          if (!j || !j.ok) {
            var code = j && j.error && j.error.code;
            var msg = (j && j.error && j.error.message) || "抓取失败";
            if (code === "NO_COOKIE" || code === "LOGIN_REQUIRED") msg += "：先在「登录」页签存 cookie";
            toast(msg);
            return;
          }
          var d = j.data || {};
          toast("第 " + d.page + " 页 · 抓回 " + d.rows + " 行 · 新增 " + d.added + " · 今日第 " + (d.daily && d.daily.count) + " 次");
          s.drawerLoaded = false;
          if (window.__ptaLoadSources) window.__ptaLoadSources();
          if (window.__ptaLoadOverview) window.__ptaLoadOverview();
          if (state.sel === s.name) paint();
        }).catch(function () { btn.disabled = false; btn.textContent = oldT; toast("抓取请求发不出去"); });
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
      /* 登录页签只走 cookie 保存 + 自检，没有单独的重登录动作 */

      if (act === "save") {
        collect(s);
        var pendingCookie = String(s.cookie || "").trim();
        delete s.cookie;                    /* cookie 不进 localStorage，只走服务端密文 */
        window.__ptaStore.set(s.name, s);
        persist(); refreshStats(); paint();
        if (!pendingCookie) { toast("设置已保存"); return; }
        window.__ptaCred.req(s.name, "PUT", { cookie: pendingCookie }).then(function (res) {
          if (res && res.j && res.j.ok) {
            s.cookieSaved = true;
            s.cookieUpdatedAt = (res.j.data && res.j.data.updatedAt) || new Date().toISOString();
            s.cookieCheckMsg = "正在用保存的 cookie 自检…（站点慢时最多约半分钟）";
            toast("设置与 cookie 都已保存，正在自检…");
          } else toast((res && res.j && res.j.error && res.j.error.message) || "cookie 没存进服务端");
          paint();
          /* 存完立刻自检一次，省得用户再点还以为是「需要登录」 */
          if (res && res.j && res.j.ok) setTimeout(function () {
            var b = $("#sd-cookie-test");
            if (b) b.click();
          }, 80);
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
      /* 复选框由 Vue 渲染，勾选后按 state.picks 重绘一次，保证显示与状态一致 */
      paint();
    });

    var pager = $("#sites-pager");
    if (pager) pager.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-pg]");
      if (!b) return;
      state.page += Number(b.getAttribute("data-pg"));
      paint();
      /* 翻页后回到列表顶部，别停在上一页的底部 */
      var lb = $("#sites-list");
      if (lb && lb.scrollIntoView) lb.scrollIntoView({ block: "start", behavior: "smooth" });
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

    /* 有 cookie 的站逐个跑一次自检：只发一次 GET，直接决定「可用/失效」，不猜 */
    var selfCheck = $("#site-selfcheck");
    if (selfCheck) selfCheck.addEventListener("click", function () {
      if (!window.fetch || !/^https?:$/.test(location.protocol)) { toast("本地预览没有后端"); return; }
      var hosts = (MOCK.sitesList || []).filter(function (s) { return s.cookieSaved; }).map(function (s) { return s.name; });
      if (!hosts.length) { toast("还没有站点存过 cookie"); return; }
      if (selfCheck.disabled) return;
      selfCheck.disabled = true;
      var i = 0, ok = 0, bad = 0;
      function step() {
        if (i >= hosts.length) {
          selfCheck.disabled = false;
          toast("自检完成：可用 " + ok + " · 失效 " + bad);
          if (window.__ptaLoadSites) window.__ptaLoadSites();
          return;
        }
        var h = hosts[i++];
        selfCheck.textContent = "自检中 " + i + "/" + hosts.length;
        fetch("/api/sites/" + encodeURIComponent(h) + "/session-test", { method: "POST", credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var s = (MOCK.sitesList || []).filter(function (x) { return x.name === h; })[0];
            var pass = !!(j && j.ok && j.data && j.data.pass);
            if (s) { s.login = pass ? "ok" : "fail"; }
            if (pass) ok++; else bad++;
          })
          .catch(function () { bad++; })
          .then(function () { setTimeout(step, 400); });
      }
      step();
    });

    /* 批量设置弹窗同样交给 Vue，字段值与打开时的选中数都在组件状态里 */
    function initBulkModal() {
      var mask = $("#bulk-modal");
      if (!mask) return;
      var Vue = window.Vue, h = Vue.h;
      var st = Vue.reactive({ count: 0, ovr: "keep", iv: "keep", daily: "", det: "keep", prio: "keep" });
      function close() { mask.hidden = true; }
      if (bOpen) bOpen.addEventListener("click", function () {
        st.count = state.picks.length;
        st.ovr = "keep"; st.iv = "keep"; st.daily = ""; st.det = "keep"; st.prio = "keep";
        mask.hidden = false;
      });
      mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !mask.hidden) close(); });

      function apply() {
        var list2 = pickedSites();
        list2.forEach(function (x) {
          if (st.ovr !== "keep") x.override = st.ovr === "on";
          if (st.iv !== "keep") x.ovInterval = st.iv;
          if (String(st.daily || "").trim()) x.ovDaily = String(st.daily).trim();
          if (st.det !== "keep") x.ovDetail = st.det === "on";
          if (st.prio !== "keep") x.priority = st.prio;
          window.__ptaStore.set(x.name, x);
        });
        window.__ptaStore.save();
        close();
        state.picks = [];
        refreshBulk();
        paint();
        toast("已应用到 " + list2.length + " 个站点");
      }

      function sel(id, model, opts) {
        return h("select", { class: "select", id: id, value: st[model], onChange: function (e) { st[model] = e.target.value; } },
          opts.map(function (o) { return h("option", { value: o[0] }, o[1]); }));
      }
      window.__ptaBulkModalApp = Vue.createApp({
        render: function () {
          return h("div", { class: "modal wide" }, [
            h("div", { class: "modal-head" }, [h("h2", null, "批量设置"),
              h("button", { class: "btn ghost slim", id: "bulk-x", type: "button", onClick: close }, "关闭")]),
            h("p", { class: "modal-sub" }, ["只改已选中的项，其余保持原样。应用到已选中的 ", h("b", { id: "bulk-count" }, String(st.count)), " 个站点。"]),
            h("div", { class: "modal-scroll" }, [
              h("div", { class: "sd-field" }, [h("span", null, "覆盖全量抓取"), sel("bm-ovr", "ovr", [["keep", "保持"], ["on", "开启"], ["off", "关闭"]])]),
              h("div", { class: "sd-field" }, [h("span", null, "抓取间隔"), sel("bm-iv", "iv", [["keep", "保持"], ["抓完全部"], ["1 分钟"], ["5 分钟"], ["15 分钟"], ["1 小时"]])]),
              h("div", { class: "sd-field" }, [h("span", null, "每站每日上限"),
                h("input", { class: "input", id: "bm-daily", placeholder: "留空则不改", value: st.daily, onInput: function (e) { st.daily = e.target.value; } })]),
              h("div", { class: "sd-field" }, [h("span", null, "抓取详情页"), sel("bm-det", "det", [["keep", "保持"], ["on", "开启"], ["off", "关闭"]])]),
              h("div", { class: "sd-field" }, [h("span", null, "站点优先级"), sel("bm-prio", "prio", [["keep", "保持"], ["high", "高（先抓）"], ["normal", "普通"], ["low", "低（最后抓）"]])])
            ]),
            h("div", { class: "modal-foot" }, [
              h("button", { class: "btn ghost slim", id: "bulk-cancel", type: "button", onClick: close }, "取消"),
              h("button", { class: "btn primary slim", id: "bulk-ok", type: "button", onClick: apply }, "应用到已选")
            ])
          ]);
        }
      }).mount(mask);
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
  /* 新增站点弹窗用 Vue：卡片由组件渲染，显隐仍由外层 mask 控制 */
  function initSiteModal() {
    var mask = $("#site-modal");
    if (!mask) return;
    var Vue = window.Vue, h = Vue.h;
    var st = Vue.reactive({ url: "", arch: "auto", note: "" });
    window.__ptaOpenSiteModal = function () {
      st.url = ""; st.note = ""; st.arch = "auto";
      mask.hidden = false;
      setTimeout(function () { var i = document.getElementById("ns-url"); if (i) i.focus(); }, 30);
    };
    function close() { mask.hidden = true; }
    window.__ptaCloseSiteModal = close;
    document.querySelectorAll("[data-act='new-site']").forEach(function (b) {
      b.addEventListener("click", function () { window.__ptaOpenSiteModal(); });
    });
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !mask.hidden) close(); });

    function submit() {
      var raw = String(st.url || "").trim();
      if (!raw) { toast("先填站点地址"); return; }
      if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
      var host;
      try { host = new URL(raw).hostname.replace(/^www\./, ""); } catch (e) { toast("地址格式不对"); return; }
      if (MOCK.sitesList.some(function (x) { return x.name === host; })) { toast("这个站点已经在列表里了"); return; }
      var a = st.arch === "auto" ? (/index\.php/.test(raw) ? "NP" : "?") : st.arch;
      var site = window.__ptaStore.add({
        url: raw, host: host, brand: host.replace(/^pt\./, "").replace(/[^a-z0-9]/gi, "").slice(0, 2),
        name: host, arch: a, note: String(st.note || "").trim()
      });
      MOCK.sitesList.push(site);
      window.__ptaStore.set(site.name, site);
      if (window.__ptaRefresh) window.__ptaRefresh(site.name);
      close();
      toast("已添加：" + host);
    }

    var app = Vue.createApp({
      render: function () {
        return h("div", { class: "modal" }, [
          h("div", { class: "modal-head" }, [
            h("h2", null, "添加站点"),
            h("button", { class: "btn ghost slim", id: "site-modal-x", type: "button", onClick: close }, "关闭")
          ]),
          h("label", { class: "field" }, [h("span", null, "站点地址"),
            h("input", { class: "input", id: "ns-url", placeholder: "https://example.com/index.php", autocomplete: "off",
              value: st.url, onInput: function (e) { st.url = e.target.value; } })]),
          h("label", { class: "field" }, [h("span", null, "架构"),
            h("select", { class: "select", id: "ns-arch", value: st.arch, onChange: function (e) { st.arch = e.target.value; } }, [
              h("option", { value: "auto" }, "自动判断"),
              h("option", { value: "NP" }, "NexusPHP"),
              h("option", { value: "UNIT3D" }, "UNIT3D"),
              h("option", { value: "GZ" }, "Gazelle"),
              h("option", { value: "OTHER" }, "其它"),
              h("option", { value: "?" }, "未确认")
            ])]),
          h("label", { class: "field" }, [h("span", null, "备注（可选）"),
            h("input", { class: "input", id: "ns-note", placeholder: "例如：需要邀请、只收原盘", value: st.note,
              onInput: function (e) { st.note = e.target.value; } })]),
          h("div", { class: "modal-foot" }, [
            h("button", { class: "btn ghost slim", id: "site-modal-cancel", type: "button", onClick: close }, "取消"),
            h("button", { class: "btn primary slim", id: "site-modal-ok", type: "button", onClick: submit }, "添加")
          ])
        ]);
      }
    });
    app.mount(mask);
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
          h("div", { class: "login-brand" }, [h("img", { src: "assets/whale.png", alt: "" }), h("b", null, "SEEDPOD"), h("span", null, "原盘转载面板")]),
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
  function initDashboardVue() {
    if (!window.Vue) return;
    var Vue = window.Vue, h = Vue.h;
    var st = Vue.reactive({ ov: null, logs: [], pend: [], pub: [], tick: 0 });

    function statApp() {
      var ov = st.ov;
      var qc = (ov && ov.queue && ov.queue.counts) || {};
      var pub = qc.published || 0;
      var cat = (ov && ov.catalog) || { total: 0, byStatus: {} };
      return [
        h("div", { class: "stat-hero" }, [
          h("span", null, "今日已发"),
          h("b", null, String(pub)),
          h("i", null, "累计已发布")
        ]),
        h("div", { class: "stat-list" }, [
          h("div", { class: "hstat" }, [h("span", null, "本月已发"), h("b", null, String(pub)), h("i", null, "目标 120")]),
          h("div", { class: "hstat" }, [h("span", null, "总发布数"), h("b", null, pub.toLocaleString()), h("i", null, "历史累计")]),
          h("div", { class: "hstat" }, [h("span", null, "抓取总数"), h("b", null, (cat.total || 0).toLocaleString()), h("i", null, "词条库累计")])
        ])
      ];
    }
    function healthApp() {
      var o = st.ov;
      var loginOk = o ? o.sites.loginOk : 0;
      var enabled = o ? o.sites.enabled : 0;
      var loginFail = o ? o.sites.loginFail : 0;
      var unchecked = o ? o.sites.loginUnknown : 0;
      var dls = o ? o.downloaders : null;
      var free = dls ? fmtBytes(dls.freeSpace) : "";
      var crawlTxt = o && o.crawl ? (o.crawl.runsToday + " 次 / " + (o.crawl.hostsToday || 0) + " 站") : "—";
      var list = [
        { label: "登录失效", value: String(loginFail), warn: loginFail > 0 },
        { label: "还没自检", value: String(unchecked), warn: false },
        { label: "下载器在线", value: dls ? (dls.online + " / " + dls.total) : "—", warn: !!(dls && dls.total && dls.online < dls.total) },
        { label: "磁盘余量", value: free || (dls && dls.total ? "未知" : "未接"), warn: !!(dls && dls.total && !free) }
      ];
      return [
        h("div", { class: "status-hero" }, [
          h("span", null, "cookie 可用"),
          h("b", { class: loginFail ? "warn" : "" }, String(loginOk)),
          h("i", null, "共启用 " + enabled + " 个" + (o ? "" : "（未连接后端）")),
          h("div", { class: "hero-sub" }, [h("span", null, "今日抓取"), h("b", null, crawlTxt)])
        ]),
        h("div", { class: "status-list" }, list.map(function (it, i) {
          return h("div", { class: "hstat" + (it.warn ? " warn" : ""), key: i }, [h("span", null, it.label), h("b", null, it.value)]);
        }))
      ];
    }
    function logsApp() {
      if (!st.logs.length) return h("div", { class: "empty" }, "还没有日志，连上后端后这里会实时刷新");
      return st.logs.slice(0, 4).map(function (l, i) {
        return h("div", { class: "list-item " + l.lvl, key: i }, [
          h("span", { class: "time" }, l.t), h("span", { class: "msg" }, l.msg)
        ]);
      });
    }
    function pubApp() {
      if (!st.pub.length) return h("div", { class: "empty" }, "还没有发布记录");
      return st.pub.slice(0, 3).map(function (p, i) {
        var t = p.at ? String(p.at).slice(5, 16).replace("T", " ") : "";
        return h("div", { class: "list-item", key: i }, [
          h("div", { style: "flex:1;min-width:0" }, [
            h("div", { class: "t-main" }, p.cn || p.title || ""),
            h("div", { class: "t-sub" }, (p.site || "未选站点") + " · " + (p.size || ""))
          ]),
          h("span", { class: "t-sub" }, t),
          h("span", { class: "badge green" }, "已发布")
        ]);
      });
    }
    function pendApp() {
      if (!st.pend.length) return h("div", { class: "empty" }, "没有待审核的条目");
      return st.pend.slice(0, 3).map(function (it, i) {
        return h("div", { class: "list-item", key: i }, [
          h("div", { style: "flex:1;min-width:0" }, [
            h("div", { class: "t-main" }, it.cn || it.title || ""),
            h("div", { class: "t-sub" }, (it.res || "") + " · " + (it.size || "") + " · " + (it.site || ""))
          ]),
          h("a", { class: "btn ghost sm", href: "#queue" }, "审核")
        ]);
      });
    }

    function mount(sel, render) {
      var el = document.querySelector(sel);
      if (!el) return;
      Vue.createApp({ render: function () { return render(); } }).mount(el);
    }
    mount("#dash-logs", logsApp);
    mount("#health-strip", healthApp);
    mount("#dash-published", pubApp);
    mount("#dash-pending", pendApp);
    mount(".stat-grid", statApp);

    window.__ptaDashSync = function () {
      st.ov = window.__ptaOverview || null;
      st.logs = (MOCK.logs || []).slice(0, 4);
      st.pub = window.__ptaPublished || [];
      st.pend = window.__ptaQueuePending || [];
      st.tick++;
    };
    window.__ptaDashSync();
    if (window.__ptaLoadDashLists) window.__ptaLoadDashLists();
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
    initDevFoot();
    initDashboardVue();
    if (typeof loadSitesFromApi === "function") loadSitesFromApi();
    /* 停在总览页时每 30 秒刷一次真实状态，别让数字一直停在进页面那一刻 */
    setInterval(function () {
      if (window.__ptaCurrent !== "dashboard") return;
      if (window.__ptaLoadOverview) window.__ptaLoadOverview();
    }, 30000);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAuth(boot);
  });
})();