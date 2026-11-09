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
    queue: [
      { id: 101, title: "Follow Me 2020 1080p HKG Blu-ray AVC TrueHD 7.1", cn: "极限网红", year: 2020, res: "1080p", size: "22.10 GB", imdb: "5.4", site: "站点 A", status: "pending", check: "无重复", checkCls: "green" },
      { id: 102, title: "Perfect Blue 1997 1080p HKG Blu-ray AVC DTS-HD MA 5.1", cn: "未麻的部屋", year: 1997, res: "1080p", size: "44.14 GB", imdb: "8.0", site: "站点 A", status: "pending", check: "无重复", checkCls: "green" },
      { id: 103, title: "Ran 1985 2160p UHD Blu-ray DoVi HDR10 HEVC DTS-HD MA 5.1", cn: "乱", year: 1985, res: "2160p", size: "87.77 GB", imdb: "8.2", site: "站点 A", status: "pending", check: "无重复", checkCls: "green" },
      { id: 104, title: "The Golden Lotus 1974 1080p AUS Blu-ray AVC LPCM 2.0", cn: "金瓶双艳", year: 1974, res: "1080p", size: "30.67 GB", imdb: "5.7", site: "站点 A", status: "approved", check: "无重复", checkCls: "green" },
      { id: 105, title: "Crouching Tiger Hidden Dragon 2000 2160p USA UHD Blu-ray HEVC TrueHD 7.1", cn: "卧虎藏龙", year: 2000, res: "2160p", size: "89.12 GB", imdb: "7.9", site: "站点 B", status: "dupe", check: "已有 89.1G", checkCls: "amber" },
      { id: 106, title: "Ida 2013 1080p AUS BluRay AVC DTS-HD MA 5.1", cn: "修女艾达", year: 2013, res: "1080p", size: "27.86 GB", imdb: "7.4", site: "站点 B", status: "failed", check: "详情页 403", checkCls: "red" },
      { id: 107, title: "Green Snake 2021 CHN Blu-ray 1080p AVC Atmos TrueHD 7.1", cn: "青蛇劫起", year: 2021, res: "1080p", size: "43.67 GB", imdb: "6.8", site: "站点 A", status: "pending", check: "无重复", checkCls: "green" },
      { id: 108, title: "Blades of the Guardians 2026 1080p HKG Blu-ray AVC TrueHD 7.1 Atmos", cn: "镖人：风起大漠", year: 2026, res: "1080p", size: "39.45 GB", imdb: "—", site: "站点 A", status: "pending", check: "未查", checkCls: "gray" }
    ],
    sources: [
      { title: "Follow Me 2020 1080p HKG Blu-ray AVC TrueHD 7.1", type: "原盘", res: "1080p", size: "22.10 GB", time: "8 分钟前", check: "无重复", checkCls: "green" },
      { title: "Feng hua xue yue 1977 1080p AUS Blu-ray AVC LPCM 2.0", type: "原盘", res: "1080p", size: "37.19 GB", time: "8 分钟前", check: "无重复", checkCls: "green" },
      { title: "Ichijo Sayuri: Nureta yokujo 1972 1080p AUS Blu-ray AVC LPCM 2.0", type: "原盘", res: "1080p", size: "23.93 GB", time: "9 分钟前", check: "无重复", checkCls: "green" },
      { title: "Koibito-tachi wa nureta 1973 1080p AUS Blu-ray AVC LPCM 2.0", type: "原盘", res: "1080p", size: "23.94 GB", time: "9 分钟前", check: "无重复", checkCls: "green" },
      { title: "The Golden Lotus 1974 1080p AUS Blu-ray AVC LPCM 2.0", type: "原盘", res: "1080p", size: "30.67 GB", time: "9 分钟前", check: "无重复", checkCls: "green" },
      { title: "Illicit Desire 1973 1080p AUS Blu-ray AVC LPCM 2.0", type: "原盘", res: "1080p", size: "36.48 GB", time: "9 分钟前", check: "已收录", checkCls: "amber" },
      { title: "Tai Chi Zero 2012 1080p AUS Blu-ray AVC DTS-HD MA 5.1", type: "原盘", res: "1080p", size: "28.79 GB", time: "9 分钟前", check: "无重复", checkCls: "green" },
      { title: "Perfect Blue 1997 1080p HKG Blu-ray AVC DTS-HD MA 5.1", type: "原盘", res: "1080p", size: "44.14 GB", time: "23 小时前", check: "无重复", checkCls: "green" },
      { title: "Kite 2014 1080p HKG Blu-ray AVC TrueHD 5.1", type: "原盘", res: "1080p", size: "21.88 GB", time: "1 天前", check: "限制分发", checkCls: "red" },
      { title: "Interview with the Vampire 1994 2160p UHD Blu-ray DV HEVC TrueHD 7.1", type: "原盘", res: "2160p", size: "22.12 GB", time: "4 小时前", check: "无重复", checkCls: "green" }
    ],
    nodes: [
      { name: "A · 控制节点", role: "编排 / 数据库 / 发布", host: "192.0.2.10", online: true, disk: "系统盘 64 / 128 GB", used: 0, total: 0, qb: "—", seeding: "—", path: "/srv/pta" },
      { name: "B · 下载节点", role: "下载 / 做种", host: "192.0.2.11", online: true, disk: "12.3 / 16 TB", used: 12.3, total: 16, qb: "5.0.3", seeding: "1,240", path: "/data/pt" },
      { name: "C · 下载节点", role: "下载 / 做种", host: "192.0.2.12", online: true, disk: "8.7 / 12 TB", used: 8.7, total: 12, qb: "5.0.3", seeding: "862", path: "/data/pt" },
      { name: "D · 下载节点", role: "下载 / 做种", host: "192.0.2.13", online: true, disk: "14.1 / 18 TB", used: 14.1, total: 18, qb: "4.6.7", seeding: "1,905", path: "/data/pt" },
      { name: "E · 下载节点", role: "下载 / 做种", host: "192.0.2.14", online: false, disk: "3.2 / 8 TB", used: 3.2, total: 8, qb: "离线", seeding: "—", path: "/data/pt" }
    ],
    sitesList: [],    logs: [
      { t: "12:40:02", lvl: "ok", tag: "抓取", msg: "站点 A 第 231 页完成，累计 23,186 条，新增 87 条。" },
      { t: "12:39:58", lvl: "", tag: "查重", msg: "主站索引命中 214 条，跳过 127 条重复。" },
      { t: "12:39:40", lvl: "", tag: "发布", msg: "《金瓶双艳》发布成功，种子 #8842103。" },
      { t: "12:38:12", lvl: "warn", tag: "图床", msg: "站内图床上传较慢（8.4s），已重试一次成功。" },
      { t: "12:36:55", lvl: "error", tag: "详情", msg: "《修女艾达》详情页 403，任务转入失败队列。" },
      { t: "12:35:10", lvl: "", tag: "节点", msg: "节点 E 心跳超时，已暂停下发。" },
      { t: "12:30:00", lvl: "ok", tag: "调度", msg: "增量抓取任务开始：只抓第 1~2 页。" }
    ]
  };


  /* ---------- 站点清单：URL -> 站点对象（假数据由 host 哈希决定，稳定可复现） ---------- */
  var GAZELLE_HOSTS = ["redacted.sh", "orpheus.network", "gazellegames.net", "animebytes.tv", "passthepopcorn.me", "jpopsuki.eu", "dicmusic.com"];
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function buildSites(urls) {
    var LAST = ["今天 12:40", "今天 11:58", "今天 09:12", "昨天 23:10", "昨天 18:44", "2 天前"];
    var seen = {}, out = [];
    (urls || []).forEach(function (url) {
      var host = url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
      if (!host || seen[host]) return;
      seen[host] = 1;
      var r = hashStr(host);
      var enabled = r % 100 < 62;
      var login = !enabled ? "none" : ((r >>> 7) % 100 < 92 ? "ok" : "fail");
      var ratioNum = 0.55 + ((r >>> 11) % 430) / 100;
      var measured = (window.PT_ARCH || {})[host];
      var arch = measured || "?";
      out.push({
        name: host,
        title: (window.PT_NAMES || {})[host] || host,
        brand: host.replace(/^www\./, "").replace(/^pt\./, "").replace(/[^a-z0-9]/gi, "").slice(0, 2),
        path: (function () {
          var t = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/$/, "");
          return /^\/index\.php\/?$/.test(t) ? "" : t;
        })(),
        url: url,
        arch: arch,
        enabled: enabled,
        login: login,
        ratio: enabled ? ratioNum.toFixed(2) : "—",
        canDl: enabled && ratioNum >= 1,
        tfa: ((r >>> 3) % 100) < 34,
        last: enabled ? (login === "fail" ? LAST[5] : LAST[(r >>> 5) % 5]) : "未抓取",
        items: enabled ? 40 + ((r >>> 2) % 3200) : 0,
        cookieDays: 2 + ((r >>> 13) % 28),
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
          loginMethod: s.loginMethod, username: s.username, password: s.password,
          cookie: s.cookie
        };
        save();
      },
      reset: function (host) { delete data.overrides[host]; save(); },
      remove: function (host) {
        data.added = data.added.filter(function (a) { return a.host !== host; });
        delete data.overrides[host];
        if (data.hidden.indexOf(host) < 0) data.hidden.push(host);
        save();
      }
    };
  }
  window.PTA_SITES = buildSites(window.SITE_URLS || []);
  MOCK.sitesList = window.PTA_SITES;
  window.__ptaStore = createStore();
  window.__ptaDefaults = {};
  window.__ptaStore.data.added.forEach(function (a) { MOCK.sitesList.push(makeSite(a)); });
  Object.keys(window.__ptaStore.data.overrides).forEach(function (h) {
    var site = MOCK.sitesList.filter(function (x) { return x.name === h; })[0];
    if (!site) return;
    var o = window.__ptaStore.data.overrides[h];
    for (var k in o) site[k] = o[k];
  });
  MOCK.sitesList = MOCK.sitesList.filter(function (x) { return window.__ptaStore.data.hidden.indexOf(x.name) < 0; });
  MOCK.sitesList.forEach(function (x) {
    window.__ptaDefaults[x.name] = JSON.parse(JSON.stringify(x));
  });
  MOCK.sites = siteStats(MOCK.sitesList);

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
  window.PTA = { toast: toast, MOCK: MOCK };

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
    { key: "queue", label: "待审核", href: "#queue", count: 12, icon: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3v12\"/><path d=\"M8 11l4 4 4-4\"/><path d=\"M4 21h16\"/></svg>" },
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
    document.addEventListener("click", function () { menu.classList.remove("open"); });
  }

  function initChrome() {
    var root = $("#dock-root");
    if (root) {
      root.innerHTML = '<nav class="dock">' + NAV_ITEMS.map(function (it) {
        var active = it.key === PAGE ? " active" : "";
        var count = it.count ? '<span class="dock-count">' + it.count + "</span>" : "";
        return '<a class="dock-item' + active + '" href="' + it.href + '" data-view="' + it.key + '" title="' + it.label + '">' + (it.icon || "") + '<span class="dock-label">' + it.label + '</span>' + count + "</a>";
      }).join("") + "</nav>";
    }
    var right = $(".topbar-right");
    if (right && !$("#menu-btn")) {
      var navLinks = NAV_ITEMS.map(function (it) {
        var active = it.key === PAGE ? " active" : "";
        var count = it.count ? '<span class="dock-count">' + it.count + "</span>" : "";
        return '<a class="menu-link' + active + '" href="' + it.href + '" data-view="' + it.key + '">' + it.label + count + "</a>";
      }).join("");
      right.insertAdjacentHTML("beforeend",
        '<div class="menu-wrap">' +
          '<button class="btn menu-btn" id="menu-btn" aria-label="菜单">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
          "</button>" +
          '<div class="menu" id="menu">' + navLinks +
          "</div>" +
        "</div>");
    }
  }

  function initNav() {
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
    var pub = MOCK.queue.filter(function (x) { return x.status === "published"; }).length;
    var fail = MOCK.queue.filter(function (x) { return x.status === "failed"; }).length;
    var pending = MOCK.queue.filter(function (x) { return x.status === "pending"; }).length;
    var todayPosted = 2 + pub;
    var monthPosted = 81 + todayPosted;
    var totalPosted = 1240 + pub;
    var dbTotal = 23186;
    var fresh = 87;

    function set(id, v) { var el = $(id); if (el) el.textContent = v; }
    set("#hero-num", String(todayPosted));
    set("#hero-delta", "较昨日 +1");
    set("#stat-month", String(monthPosted));
    set("#stat-total", totalPosted.toLocaleString());
    set("#stat-db", dbTotal.toLocaleString());

    var t = $("#today-stats");
    if (t) {
      t.innerHTML = [
        "抓取 <b>" + dbTotal.toLocaleString() + "</b>",
        "判重 <b>214</b>",
        "新收录 <b>" + fresh + "</b>",
        "已发布 <b>" + todayPosted + "</b>",
        "失败 <b>" + fail + "</b>"
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
    return { pending: pending, pub: pub, fail: fail };
  }

  function kpi(label, value, delta, cls) {
    return '<div class="kpi"><div class="label">' + label + '</div><div class="value">' + value +
      '</div><div class="delta ' + (cls || "") + '">' + delta + "</div></div>";
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

  function renderHealth() {
    var host = $("#health-strip");
    if (!host) return;
    var s = MOCK.sites;
    var nodes = MOCK.nodes.slice(1);
    var online = nodes.filter(function (n) { return n.online; }).length;
    var used = nodes.reduce(function (a, n) { return a + n.used; }, 0);
    var total = nodes.reduce(function (a, n) { return a + n.total; }, 0);
    var free = (total - used).toFixed(1);
    var loginWarn = s.loginOk < s.enabled;
    var list = [
      { label: "分享率不足", value: String(s.lowRatio), warn: s.lowRatio > 0 },
      { label: "节点在线", value: online + " / " + nodes.length, warn: online < nodes.length },
      { label: "磁盘余量", value: free + " / " + total + " TB", warn: false }
    ];
    host.innerHTML =
      '<div class="status-hero"><span>登录正常</span><b class="' + (loginWarn ? "warn" : "") + '">' +
      s.loginOk + "</b><i>共启用 " + s.enabled + " 个</i></div>" +
      '<div class="status-list">' + list.map(function (it) {
        return '<div class="hstat' + (it.warn ? " warn" : "") + '"><span>' + it.label + "</span><b>" + it.value + "</b></div>";
      }).join("") + "</div>";
  }

  function renderSiteHealth() {
    var host = $("#site-health");
    var bars = $("#site-bars");
    if (!host) return;
    var s = MOCK.sites;
    host.innerHTML =
      '<div class="mini"><span>已启用</span><b>' + s.enabled + " / " + s.total + "</b></div>" +
      '<div class="mini"><span>登录正常</span><b>' + s.loginOk + "</b></div>" +
      '<div class="mini warn"><span>分享率不足</span><b>' + s.lowRatio + "</b></div>" +
      '<div class="mini"><span>需要 2FA</span><b>' + s.tfa + "</b></div>";
    if (bars) {
      bars.innerHTML =
        '<div class="arch-bar"><i style="width:' + Math.round(s.np / (s.np + s.unit3d) * 100) + '%"></i>' +
        '<i class="u3d" style="width:' + Math.round(s.unit3d / (s.np + s.unit3d) * 100) + '%"></i></div>' +
        '<div class="arch-legend">NexusPHP ' + s.np + " · UNIT3D " + s.unit3d + "</div>";
    }
  }

  function renderNodeCapacity() {
    var host = $("#dash-nodes");
    if (!host) return;
    var nodes = MOCK.nodes.slice(1);
    var online = nodes.filter(function (n) { return n.online; }).length;
    var used = nodes.reduce(function (a, n) { return a + n.used; }, 0);
    var total = nodes.reduce(function (a, n) { return a + n.total; }, 0);
    var pct = total ? Math.round(used / total * 100) : 0;
    host.innerHTML =
      '<div class="node-sum-line"><span>' + online + " / " + nodes.length + " 在线</span>" +
      '<span class="mono">' + used.toFixed(1) + " / " + total + " TB</span></div>" +
      '<div class="progress" style="margin-top:8px"><i style="width:' + pct + '%"></i></div>';
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

    function shotHtml(n) {
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
          '<div class="qd-main">' +
            '<section class="sd-card"><h3>发布信息</h3>' +
              '<div class="qd-field"><span>标题</span><input class="input" id="qd-title" value="' + escapeHtml(titleTpl) + '"></div>' +
              '<div class="qd-field"><span>副标题</span><input class="input" id="qd-sub" value="' + escapeHtml(subTitle(it)) + '"></div>' +
              '<div class="qd-field"><span>查重</span><b class="' + (it.checkCls || "") + '-t">' + escapeHtml(it.check) + "</b></div>" +
            "</section>" +
            '<section class="sd-card qd-shots"><h3>截图</h3>' +
              '<div class="shots">' + shotHtml(1) + shotHtml(2) + shotHtml(3) +
                '<button class="shot add" id="qd-addshot">上传</button></div>' +
            "</section>" +
          "</div>" +
          '<div class="qd-side">' +
            '<section class="sd-card"><h3>简介</h3>' +
              '<textarea class="input sd-note" id="qd-desc" rows="3">' +
                escapeHtml(introText(it)) + "</textarea>" +
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
      state.sel = Number(b.getAttribute("data-id"));
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

    var bulk = $("#q-bulkcheck");
    if (bulk) bulk.addEventListener("click", function () { toast("批量查重：" + rows().length + " 条（假数据）"); });

    if (detail) detail.addEventListener("click", function (e) {
      if (e.target.closest("#qd-addshot")) { toast("上传截图（假数据）"); return; }
      var b = e.target.closest("button[data-qact]");
      if (!b) return;
      var it = MOCK.queue.filter(function (x) { return x.id === state.sel; })[0];
      if (!it) return;
      var act = b.getAttribute("data-qact");
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

    paint();
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
      }).join("") || '<div class="sites-empty">没有匹配的条目</div>';
      var c = $("#dl-count");
      if (c) c.textContent = rows.length;
    }

    var q = $("#dl-q");
    if (q) q.addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); paint(); });
    body.addEventListener("click", function (e) {
      if (e.target.closest("button[data-archive]")) toast("已加入归档队列（假数据）");
    });
    var crawl = $("#dl-crawl");
    if (crawl) crawl.addEventListener("click", function () { toast("开始增量抓取（假数据）"); });
    var ex = $("#dl-export");
    if (ex) ex.addEventListener("click", function () { toast("已导出 JSON（假数据）"); });
    paint();
  }

  function initNodes() {
    var host = $("#nodes-grid");
    if (!host) return;

    function storage() {
      try {
        var raw = localStorage.getItem("pta.nodes");
        if (raw) MOCK.nodes = JSON.parse(raw);
      } catch (e) {}
    }
    function save() {
      try { localStorage.setItem("pta.nodes", JSON.stringify(MOCK.nodes)); } catch (e) {}
    }
    storage();

    function paint() {
      var nodes = MOCK.nodes;
      var workers = nodes.slice(1);
      var onlineAll = nodes.filter(function (n) { return n.online; }).length;
      var totalSeed = workers.reduce(function (a, n) { return a + (parseInt(String(n.seeding).replace(/,/g, ""), 10) || 0); }, 0);
      var used = workers.reduce(function (a, n) { return a + n.used; }, 0);
      var total = workers.reduce(function (a, n) { return a + n.total; }, 0);

      var sub = $("#nodes-bar-sub");
      if (sub) sub.textContent = "共 " + nodes.length + " 台";
      var meta = $("#nodes-drawer-meta");
      if (meta) meta.textContent = onlineAll + " / " + nodes.length + " 在线 · 做种 " +
        totalSeed.toLocaleString() + " · 余量 " + (total - used).toFixed(1) + " TB";

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
      $("#nd-qb").value = nd ? ("http://" + nd.host + ":8080") : "";
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
        if (editing >= 0) {
          var nd = MOCK.nodes[editing];
          nd.name = data.name; nd.role = data.role; nd.host = data.host;
          nd.maxDown = data.maxDown; nd.seedLimit = data.seedLimit;
          nd.qbUser = data.qbUser; nd.qbPass = data.qbPass;
          nd.dlLimit = data.dlLimit; nd.ulLimit = data.ulLimit; nd.ratioDel = data.ratioDel;
          nd.seedDays = data.seedDays; nd.dlPath = data.dlPath; nd.lowDisk = data.lowDisk;
          nd.cats = curCats; nd.cat = curCat;
        } else {
          MOCK.nodes.push({
            name: data.name, role: data.role, host: data.host, online: true,
            disk: "0 / 16 TB", used: 0, total: 16, qb: data.qb,
            seeding: "0", path: data.path, maxDown: data.maxDown, seedLimit: data.seedLimit,
            cats: curCats, cat: curCat, qbUser: data.qbUser, qbPass: data.qbPass
          });
        }
        save(); paint(); closeModal();
        toast(editing >= 0 ? "已保存：" + data.name : "已新增：" + data.name);
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
        ptaConfirm("删除下载器", "确定删除「" + nm + "」吗？这台机器上的做种记录会从列表里移除。", function () {
          MOCK.nodes.splice(idx, 1);
          save(); paint(); closeModal();
          toast("已删除：" + nm);
        });
      });
    }

    host.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-nset]");
      if (!b) return;
      openModal(Number(b.getAttribute("data-nset")));
    });

    paint();
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
      }).join("") || '<div class="sites-empty">没有匹配的日志</div>';
      host.scrollTop = host.scrollHeight;
    }

    var tabs = $("#log-tabs");
    if (tabs) tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-lvl]");
      if (!b) return;
      state.lvl = b.getAttribute("data-lvl");
      $$("button", tabs).forEach(function (x) { x.classList.toggle("active", x === b); });
      paint();
    });
    var dl = $("#log-dl");
    if (dl) dl.addEventListener("click", function () { toast("下载 log（假数据）"); });
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
    if (r.type === "custom") return r.html || "";
    if (r.type === "button") {
      return '<button class="btn ghost slim" data-btn="' + escapeHtml(r.t) + '">' + escapeHtml(r.v) + "</button>";
    }
    return '<input class="input"' + k + ' value="' + escapeHtml(r.v === undefined ? "" : r.v) + '"' + (r.disabled ? " disabled" : "") + ' placeholder="' + escapeHtml(r.ph || "") + '">';
  }

  function setRowsHtml(rows) {
    return rows.map(function (r) {
      return '<div class="set-field' + (r.cls ? " " + r.cls : "") + '">' +
        '<div class="lbl"><span>' + r.t + "</span>" + (r.hint ? "<i>" + r.hint + "</i>" : "") + "</div>" +
        '<div class="ctl">' + (r.chips ? chipRow(r.chips, r.sel) : setControl(r)) + "</div>" +
      "</div>";
    }).join("");
  }

  var FETCH_RULES = [
    { name: "搜索预设", sum: "未设置", rows: [
      { t: "类型", type: "custom", chips: ["电影", "剧集", "综艺", "动漫", "纪录片", "音乐", "体育", "演唱会", "MV", "有声书", "电子书", "软件", "游戏", "其他"], sel: [], hint: "对应站点搜索的类别，决定列表里会出现什么" },
      { t: "媒介", type: "custom", chips: ["原盘(Full Disc)", "UHD 原盘", "3D 原盘", "Remux", "Encode", "Blu-ray", "HDDVD", "DVD", "HDTV", "WEB-DL", "WEBRip", "TVRip", "VHS", "其他"], sel: [], hint: "锁到站点的 medium / type 字段" },
      { t: "分辨率", type: "custom", chips: ["480p", "576p", "720p", "1080i", "1080p", "2160p", "4320p/8K"], sel: [] },
      { t: "优惠", type: "custom", chips: ["免费", "2x", "2x 免费", "50%", "2x 50%", "30%", "普通", "置顶精选"], sel: [], hint: "按站点优惠状态筛，BHD 这类站点没有免费选项时会自动跳过" }
    ] },
    { name: "拉取", sum: "逐页翻 · 断点续抓", rows: [
      { t: "每页间隔", type: "text", v: "3.0 秒" },
      { t: "并发", type: "select", v: "1", opts: ["1", "2", "3"] },
      { t: "每轮最多翻页", type: "text", v: "2" },
      { t: "抓取方式", type: "select", v: "增量（只抓新页）", opts: ["增量（只抓新页）", "全量（扫全部页）", "增量 + 定期全量"] },
      { t: "断点续抓", type: "switch", on: true, hint: "记到第几页、哪些种子已处理，停了下轮接着来" },
      { t: "抓详情页", type: "switch", on: true, hint: "BDInfo、截图、简介都要进详情页" },
      { t: "失败重试", type: "text", v: "3 次，退避 30 秒" },
      { t: "连续失败自动停", type: "text", v: "5" },
      { t: "单站每日最多抓", type: "text", v: "100" },
      { t: "全站每日最多抓", type: "text", v: "800" }
    ] },
    { name: "判定", sum: "非电影/非原盘/DIY/禁转 全跳过", rows: [
      { t: "非电影跳过", type: "switch", on: true, hint: "剧集、综艺、动漫、音乐都算非电影" },
      { t: "非纯原盘跳过", type: "switch", on: true, hint: "标题里没有原盘特征、或者带 Remux/编码的，一律跳" },
      { t: "DIY 跳过", type: "switch", on: true },
      { t: "禁转跳过", type: "switch", on: true },
      { t: "独占跳过", type: "switch", on: true },
      { t: "限转未满 7 天跳过", type: "switch", on: true, hint: "满 7 天的限转放行，并在行上标出来" },
      { t: "仅 DIY 时标可发", type: "switch", on: true, hint: "B 站只有 DIY 版时，可以发纯原盘，标「复核」" },
      { t: "排除关键词", type: "text", v: "DVDRip, 枪版, TS", hint: "标题命中直接跳" },
      { t: "白名单关键词", type: "text", v: "", ph: "只收含这些词的（留空不限）" }
    ] },
    { name: "站点分类映射", sum: "各站分类 → 库内分类", rows: [
      { t: "站点分类", type: "button", v: "配置映射", hint: "把每个站自己的分类（如 Movies/Blu-ray）对到库内类型" },
      { t: "映射不到时", type: "select", v: "按标题猜", opts: ["按标题猜", "跳过不抓", "落到其他"] }
    ] }
  ];

  var PUB_RULES = [
    { name: "目标站", sum: "发到 目标站 A · 站内图床", rows: [
      { t: "发布到", type: "custom", html: '<div class="target-pick"><em class="tp-ava" id="tp-ava"></em><div class="tp-info"><b id="tp-name">—</b><span id="tp-host"></span></div><button class="btn ghost slim" id="tp-change">更换</button></div>', hint: "所有库内资源都归到这个站" },
      { t: "多目标站", type: "switch", on: false, hint: "同一部片同时发到 2–3 个站，需要各站分类都映射好" },
      { t: "图床", type: "select", v: "站内图床（浏览器上传）", opts: ["站内图床（浏览器上传）", "外链图床 API"] },
      { t: "截图来源", type: "select", v: "从 BDInfo 自动截取", opts: ["从 BDInfo 自动截取", "抓目标站官方截图", "手动上传"] },
      { t: "目标站分类映射", type: "button", v: "配置映射", hint: "把库内分类对到目标站的真实分类 ID" },
      { t: "发布后校验", type: "switch", on: true, hint: "发完回站里查一遍，确认真的出现并记下种子 ID" }
    ] },
    { name: "副标题与简介", sum: "按模板自动生成", rows: [
      { t: "发布标题", type: "custom", html: '<span class="tpl-fixed">直接用站点标题，原样发布，不改字</span>', hint: "标题不做模板，源站怎么写就怎么发" },
      { t: "中文副标题模板", type: "custom", hint: "用 {电影名} {地区} {导演} {主演1..3} {音轨} {字幕} 这些占位符", html: '<div class="tpl-wrap"><input class="input" id="sub-tpl" placeholder="例：{电影名} | {地区}原盘 | 导演:{导演}"><div class="tpl-eg" id="sub-eg"></div></div>' },
      { t: "副标题语言", type: "select", v: "中文", opts: ["中文", "中英双语", "只用英文"] },
      { t: "简介图片", type: "select", v: "转存到图床", opts: ["转存到图床", "保留外链", "不保留图片"], hint: "外链会失效，转存最稳" }
    ] },
    { name: "简介", sum: "豆影网页 → 豆瓣 → TMDB", rows: [
      { t: "片名相似度阈值", type: "text", v: "0.85", hint: "低于这个值不猜，直接转人工" },
      { t: "年份必须一致", type: "switch", on: true },
      { t: "匹配来源顺序", type: "select", v: "TMDB → 豆瓣 → 站点标题", opts: ["TMDB → 豆瓣 → 站点标题", "豆瓣 → TMDB → 站点标题", "只用站点标题"] },
      { t: "中文副标题来源", type: "select", v: "种子自带 → 豆影网页 → TMDB", opts: ["种子自带 → 豆影网页 → TMDB", "豆影网页 → 豆瓣 → TMDB", "只用种子自带，没有就用英文"] },
      { t: "简介来源顺序", type: "select", v: "豆影网页 → 豆瓣 → TMDB", opts: ["豆影网页 → 豆瓣 → TMDB", "豆瓣 → 豆影网页 → TMDB", "只用 TMDB（zh-CN）"] },
      { t: "TMDB 接口", type: "text", v: "", ph: "填 API Key 才能自动查导演和主演" },
      { t: "豆影 API Key", type: "text", v: "", ph: "免费每天 10 次，用完走网页版" },
      { t: "豆瓣抓取间隔（秒）", type: "text", v: "3", hint: "太快会出验证码" },
      { t: "主演最多几个", type: "text", v: "3" },
      { t: "缺字段时", type: "select", v: "省略该段", opts: ["省略该段", "写「未知」", "转待确认"] }
    ] },
    { name: "发布前检查", sum: "分辨率 · 体积 · 简介 · BDInfo · 截图 3 张", rows: [
      { t: "分辨率要求", type: "select", v: "1080p 及以上", opts: ["不限", "1080p 及以上", "2160p 及以上"], hint: "抓的时候全抓，发之前按这个卡" },
      { t: "体积范围", type: "select", v: "5 GB 起", opts: ["不限", "5 GB 起", "10 GB 起", "20 GB 起"] },
      { t: "最大体积", type: "select", v: "不限", opts: ["不限", "50 GB", "80 GB", "120 GB"] },
      { t: "地区版本", type: "switch", on: true, hint: "识别出 US/HKG/TWN 这类版本，写进副标题的地区段" },
      { t: "必须有简介", type: "switch", on: true, hint: "抓不到中文简介就不自动发" },
        { t: "必须带中字", type: "switch", on: true, hint: "成品没有中文字幕就不发" },
      { t: "BDInfo", type: "select", v: "必须存在且校验通过", opts: ["必须存在且校验通过", "有就行，不校验", "不要求"] },
      { t: "截图至少几张", type: "text", v: "3", hint: "不够就不自动发" },
      { t: "下载完成再发布", type: "switch", on: true, hint: "种子还没下完就发，容易被删" },
      { t: "种子完整性校验", type: "switch", on: true, hint: "qB 校验通过才算完成" },
      { t: "不满足时", type: "select", v: "转待确认", opts: ["转待确认", "直接跳过"] }
    ] },
    { name: "发种字段", sum: "制作组 / 来源 / 编码 / 音轨 / 字幕", rows: [
      { t: "制作组", type: "text", v: "", ph: "留空按目标站默认" },
      { t: "来源", type: "select", v: "Blu-ray", opts: ["Blu-ray", "HDTV", "WEB-DL", "DVD", "其他"] },
      { t: "媒介", type: "select", v: "Blu-ray", opts: ["Blu-ray", "Encode", "Remux", "UHD Blu-ray", "DVD", "其他"] },
      { t: "编码", type: "select", v: "AVC", opts: ["AVC", "HEVC", "VC-1", "MPEG-2", "其他"] },
      { t: "音轨", type: "text", v: "", ph: "留空按源种自动填" },
      { t: "字幕类型", type: "select", v: "中文字幕", opts: ["中文字幕", "中英字幕", "英文字幕", "无字幕"] }
    ] },
    { name: "自动发布", sum: "半自动 · 间隔 60 秒 · 每天 20 条", rows: [
      { t: "发布模式", type: "select", v: "半自动（先转待审核）", opts: ["全自动（过了就直接发）", "半自动（先转待审核）", "仅准备（不碰目标站）"] },
      { t: "发布前必须人工点通过", type: "switch", on: true },
      { t: "自动发布总开关", type: "switch", on: true, hint: "关掉只抓不发，全部留给人" },
      { t: "两条之间间隔（秒）", type: "text", v: "60", hint: "别把目标站刷爆" },
      { t: "每天最多自动发几条", type: "text", v: "20" },
      { t: "单站每天最多发几条", type: "text", v: "10" },
      { t: "发布顺序", type: "select", v: "先小后大", opts: ["先小后大", "先新后旧", "按类型分组"] },
      { t: "只在时段内发布", type: "select", v: "全天", opts: ["全天", "00:00–08:00", "08:00–24:00"] },
      { t: "免审直接发的分类", type: "text", v: "", ph: "留空＝都要审，例：原盘, Remux" }
    ] },
    { name: "失败与兜底", sum: "重复转审核 · 限制分发丢弃", rows: [
      { t: "主站已有同片", type: "select", v: "转待审核（标重复）", opts: ["转待审核（标重复）", "直接丢弃"] },
      { t: "站点标限制分发", type: "select", v: "直接丢弃", opts: ["直接丢弃", "只收录不发布"] },
      { t: "图片上传重试", type: "text", v: "2 次" },
      { t: "发布失败重试", type: "text", v: "2 次，间隔 5 分钟" },
      { t: "连续失败几次暂停该站", type: "text", v: "5" },
      { t: "失败时推送通知", type: "switch", on: true }
    ] }
,
{ name: "下载条件", sum: "做种 5 起 · 免费优先", rows: [
      { t: "做种数至少", type: "select", v: "5", opts: ["不限", "1", "3", "5", "10", "20"], hint: "做种太少的下到一半就断" },
      { t: "免费/优惠", type: "select", v: "免费优先", opts: ["不限制", "免费优先", "只要 FREE", "FREE 或 2x"], hint: "免费期再下，省下载量" },
      { t: "单站同时下载", type: "text", v: "2", hint: "同一个站并行任务数，别把站刷爆" },
      { t: "只在此机器下载", type: "select", v: "自动挑磁盘最多的", opts: ["自动挑磁盘最多的", "固定 B", "固定 C", "固定 D", "固定 E"] }
    ] }
  ];

  var DEDUPE_RULES = [
    { name: "查重规则", sum: "本地词库 7 天 · 目标站已有原盘跳过", rows: [
      { t: "查本地词库", type: "switch", on: true, hint: "以前查过的结果缓存起来，避免重复请求" },
      { t: "词库有效期", type: "select", v: "7 天", opts: ["1 天", "7 天", "30 天", "永久"] },
      { t: "目标站已有原盘", type: "select", v: "跳过不收", opts: ["跳过不收", "标重复后仍收"] },
      { t: "目标站只有 DIY", type: "select", v: "可发（标复核）", opts: ["可发（标复核）", "跳过"] },
      { t: "请求失败", type: "select", v: "重试 2 次后标失败", opts: ["重试 2 次后标失败", "直接跳过"] }
    ] },
  ];



  var RULE_SETS = { fetch: FETCH_RULES, dedupe: DEDUPE_RULES, pub: PUB_RULES };

  /* 默认全部留空：不预选、不开启，避免看起来像已经配好了 */
  Object.keys(RULE_SETS).forEach(function (k) {
    RULE_SETS[k].forEach(function (g) {
      g.sum = "未设置";
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
  }
  function loadFlowState() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(FLOW_KEY) || "null"); } catch (e) {}
    if (!data) return;
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
      sectionHtml({ name: "抓取", desc: "按预设去源站拉数据，逐行判定，然后交给查重。", sum: "未设置", rules: FETCH_RULES }, 0, "fetch") +
      sectionHtml({ name: "查重", desc: "这条在目标站和本地库里是不是已经有了。", sum: "未设置", rules: DEDUPE_RULES }, 1, "dedupe") +
      sectionHtml({ name: "发布", desc: "自动补全材料、质检，然后发到目标站。", sum: "未设置", rules: PUB_RULES }, 2, "pub");

    renderTpl();

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
      return parts.length ? parts.slice(0, 3).join(" · ") + (parts.length > 3 ? " 等" : "") : "未设置";
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
          if (!first && s.textContent && s.textContent !== "未设置") first = s.textContent;
        });
        meta.textContent = first || "未设置";
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
      var pick = e.target.closest(".pick-row .cat-chip");
      if (pick) { pick.classList.toggle("on"); refreshSums(); return; }
      var sw = e.target.closest("button[data-switch]");
      if (sw) { sw.classList.toggle("on"); refreshSums(); return; }
      var btn = e.target.closest("button[data-btn]");
      if (btn) { toast(btn.getAttribute("data-btn") + "（假数据）"); return; }
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
        saveFlowState();
        var label = { fetch: "抓取", dedupe: "查重", pub: "发布" }[sKey] || sKey;
        toast(label + "设置已保存");
      }
    });

    host.addEventListener("input", function (e) {
      if (e.target && e.target.id === "sub-tpl") renderTpl();
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
      saveFlowState();
      toast("流程设置已保存");
    });
  }

  function initSettings() {
    var panel = $("#set-panel");
    if (!panel) return;
    var GROUPS = [
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
      if (btn) toast(btn.getAttribute("data-btn") + "（假数据）");
    });
    (function restoreSettings() {
      var data = null;
      try { data = JSON.parse(localStorage.getItem("pta.settings") || "null"); } catch (e) {}
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

    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest(".set-save")) return;
      var vals = [];
      panel.querySelectorAll(".set-field").forEach(function (f) {
        var sw = f.querySelector("[data-switch]");
        if (sw) { vals.push(sw.classList.contains("on")); return; }
        var ctl = f.querySelector(".input, .select");
        vals.push(ctl ? ctl.value : "");
      });
      try { localStorage.setItem("pta.settings", JSON.stringify(vals)); } catch (err) {}
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
    var state = { q: "", status: "all", arch: "all", login: "all", sel: null, tab: "overview", picks: [], page: 1, setTab: "basic" };
    var PER_PAGE = 11;
    var ACH = {
      NP: ["np", "NexusPHP"], UNIT3D: ["u3d", "UNIT3D"], GZ: ["gz", "Gazelle"],
      OTHER: ["oth", "其它"], "?": ["unk", "未确认"]
    };

    function archOf(s) { return ACH[s.arch] || ACH["?"]; }

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
      return '<div class="site-item' + (state.sel === s.name ? " on" : "") + '" data-host="' + escapeHtml(s.name) + '">' +
        '<input type="checkbox" class="site-pick" data-host="' + escapeHtml(s.name) + '"' + (picked ? " checked" : "") + ">" +
        '<em class="ava ' + a[0] + '">' + escapeHtml(initials(s)) + "</em>" +
        '<span class="si-txt"><b>' + escapeHtml(s.title || s.name) + "</b><span>" + escapeHtml(s.name) + "</span></span>" +
        '<span class="st ' + dotCls(s) + '"><i></i></span>' +
      "</div>";
    }

    function headHtml(s) {
      var a = archOf(s);
      return '<div class="sd-top">' +
          '<em class="ava lg ' + a[0] + '">' + escapeHtml(initials(s)) + "</em>" +
          '<div class="sd-id"><h2>' + escapeHtml(s.title || s.name) + "</h2>" +
            '<span class="sd-url">' + escapeHtml(s.url) + "</span></div>" +
          '<div class="sd-chips"><em class="chip ' + a[0] + '">' + a[1] + "</em>" +
            '<span class="pill2 ' + (s.enabled ? "on" : "off") + '">' + (s.enabled ? "启用中" : "已停用") + "</span></div>" +
          '<div class="sd-actions">' +
            '<button class="btn slim tabbtn' + (state.tab === "overview" ? " active" : "") + '" data-tab="overview">概览</button>' +
            '<button class="btn slim" data-act="crawl">抓取测试</button>' +
            '<button class="btn ghost slim tabbtn' + (state.tab === "settings" ? " active" : "") + '" data-tab="settings">设置</button>' +
          "</div>" +
        "</div>";
    }

    function overviewHtml(s) {
      var k = hashStr(s.name);
      var todayNew = s.enabled ? (k % 26) + (s.login === "fail" ? 0 : 3) : 0;
      var runsToday = s.enabled ? 1 + (k >>> 9) % 4 : 0;
      var next = !s.enabled ? "—"
        : s.trigger === "manual" ? "手动触发"
        : s.trigger === "daily" ? "明天 " + (s.dailyAt || "18:00")
        : "约 " + ((k >>> 14) % 50 + 10) + " 分钟后";
      var lastRes = !s.enabled ? ["已停用", "idle"]
        : s.login === "fail" ? ["登录失效", "bad"]
        : (k >>> 20) % 10 === 0 ? ["部分失败", "warn"] : ["成功", "ok"];
      var modeTxt = s.mode === "full" ? "全量" : s.mode === "mixed" ? "增量 + 定期全量" : "增量";
      var recs = [0, 1, 2].map(function (i) { return MOCK.sources[(k + i * 3) % MOCK.sources.length]; });
      var acts = [0, 1, 2].map(function (i) { return MOCK.logs[(k + i) % MOCK.logs.length]; });
      var loginTxt = s.login === "ok" ? "登录正常" : s.login === "fail" ? "登录失效" : "未登录";
      var methodTxt = s.loginMethod === "cookie" ? "Cookie" : "账号密码" + (s.tfa ? " + 2FA" : "");
      var catTxt = (s.cats || []).length + " 个分类" + (s.fullDiscOnly ? " · 只收原盘" : "");
      return '<div class="sd-metrics">' +
          "<div><span>已收录</span><b>" + (s.items ? s.items.toLocaleString() : "—") + "</b></div>" +
          "<div><span>今日新增</span><b>" + todayNew + "</b></div>" +
          "<div><span>上次抓取</span><b class=\"sm\">" + escapeHtml(s.last) + "</b></div>" +
          "<div><span>下次抓取</span><b class=\"sm\">" + escapeHtml(next) + "</b></div>" +
        "</div>" +
        '<div class="sd-cols">' +
          '<section class="sd-card"><h3>抓取</h3>' +
            '<div class="sd-row"><span>上次结果</span><b class="' + lastRes[1] + '-t">' + lastRes[0] + "</b></div>" +
            '<div class="sd-row"><span>今日已跑</span><b>' + runsToday + " 轮</b></div>" +
            '<div class="sd-row"><span>抓取方式</span><b>' + modeTxt + "</b></div>" +
            '<div class="sd-row"><span>范围</span><b>' + catTxt + "</b></div>" +
          "</section>" +
          '<section class="sd-card"><h3>登录</h3>' +
            '<div class="sd-row"><span>状态</span><b class="' + dotCls(s) + '-t">' + loginTxt + "</b></div>" +
            '<div class="sd-row"><span>方式</span><b>' + methodTxt + "</b></div>" +
            '<div class="sd-row"><span>cookie 剩余</span><b>' + (s.loginMethod === "cookie" ? "—" : s.cookieDays + " 天") + "</b></div>" +
            '<div class="sd-row"><span>分享率</span><b>' + escapeHtml(s.ratio) + "</b></div>" +
          "</section>" +
          '<section class="sd-card wide"><h3>最近收录</h3>' +
            recs.map(function (r) {
              return '<div class="sd-recent"><span class="t-main">' + escapeHtml(r.title) + "</span>" +
                '<span class="soft">' + escapeHtml(r.size) + "</span>" +
                '<span class="soft">' + escapeHtml(r.time) + "</span></div>";
            }).join("") +
          "</section>" +
        "</div>";
    }

    var CATS = [["movie", "电影"], ["tv", "剧集"], ["show", "综艺"], ["anime", "动漫"],
      ["doc", "纪录"], ["music", "音乐"], ["sport", "体育"], ["other", "其他"]];
    var RES = [["any", "不限"], ["720p", "720p 及以上"], ["1080p", "1080p 及以上"], ["2160p", "2160p 及以上"]];

    var SET_TABS = [["basic", "基本信息"], ["login", "登录"], ["override", "站点覆盖"]];

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
          { t: "覆盖全局抓取设置", type: "switch", k: "override", on: s.override, hint: "关掉时这个站完全跟随流程页里的抓取设置" }
        ]) + "</div>" +
        (s.override ? '<div class="set-fields">' + setRowsHtml([
          { t: "抓取间隔", type: "select", k: "ovInterval", v: s.ovInterval || "跟随全局", opts: ["跟随全局", "1 分钟", "5 分钟", "15 分钟", "1 小时"] },
          { t: "单站每日上限", type: "text", k: "ovDaily", v: s.ovDaily || "", ph: "留空＝用全局值" },
          { t: "抓详情页", type: "switch", k: "ovDetail", on: s.ovDetail },
          { t: "站点优先级", type: "select", k: "priority", v: s.priority || "normal", opts: ["high", "normal", "low"], labels: { high: "高（先抓）", normal: "普通", low: "低（最后抓）" } },
          { t: "本站分类映射", type: "button", v: "配置映射" }
        ]) + "</div>" : "");
      } else {
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "登录方式", type: "select", k: "loginMethod", v: method, opts: ["password", "cookie"], labels: { password: "账号密码（含 2FA）", cookie: "Cookie" } }
        ]) + "</div>" + (method === "cookie"
          ? '<div class="set-fields">' + setRowsHtml([
              { t: "Cookie", type: "textarea", k: "cookie", v: s.cookie || "" }
            ]) + "</div>"
          : '<div class="set-fields">' + setRowsHtml([
              { t: "用户名", type: "text", k: "username", v: s.username || "" },
              { t: "密码", type: "password", k: "password", v: s.password || "", ph: "留空表示不修改" },
              { t: "两步验证", type: "switch", k: "tfa", on: s.tfa },
              { t: "TOTP 密钥", type: "text", k: "totp", v: s.totp || "", ph: "绑定 2FA 时填，登录自动算码" }
            ]) + "</div>");
      }

      return '<div class="sd-subnav">' + SET_TABS.map(function (t) {
        return '<button type="button" class="subnav-btn' + (tab === t[0] ? " active" : "") + '" data-settab="' + t[0] + '">' + t[1] + "</button>";
      }).join("") + "</div>" + '<div class="sd-form">' + body + "</div>";
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
      if (!detail) return;
      if (!s) { detail.innerHTML = '<div class="sites-empty">选一个站点看详情</div>'; return; }
      detail.innerHTML = headHtml(s) +
        (state.tab === "settings"
          ? '<div class="sd-scroll">' + settingsHtml(s) + "</div>" + actionsHtml()
          : '<div class="sd-scroll">' + overviewHtml(s) + "</div>");
    }

    function paint() {
      var rows = filtered();
      var pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
      if (state.page > pages) state.page = pages;
      var pageRows = rows.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
      if (!pageRows.some(function (s) { return s.name === state.sel; })) {
        state.sel = pageRows.length ? pageRows[0].name : null;
      }
      list.innerHTML = pageRows.map(itemHtml).join("") || '<div class="sites-empty">没有匹配的站点</div>';
      var pager = $("#sites-pager");
      if (pager) {
        pager.innerHTML = '<button class="pg-btn" data-pg="-1"' + (state.page <= 1 ? " disabled" : "") + '>‹</button>' +
          "<span>" + state.page + " / " + pages + "</span>" +
          '<button class="pg-btn" data-pg="1"' + (state.page >= pages ? " disabled" : "") + ">›</button>";
      }
      var cnt = $("#sites-count");
      if (cnt) cnt.textContent = MOCK.sitesList.length;
      var hint = $("#sites-hint");
      if (hint) hint.textContent = rows.length === MOCK.sitesList.length ? "全部" : "匹配 " + rows.length + " 个";
      paintDetail();
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

    /* ---- 列表交互 ---- */
    list.addEventListener("click", function (e) {
      if (e.target.classList && e.target.classList.contains("site-pick")) return;
      var it = e.target.closest(".site-item");
      if (!it) return;
      state.sel = it.getAttribute("data-host");
      $$(".site-item", list).forEach(function (x) { x.classList.toggle("on", x === it); });
      paintDetail();
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

    /* ---- 详情交互 ---- */
    if (detail) detail.addEventListener("change", function (e) {
      var dk = e.target.getAttribute && e.target.getAttribute("data-k");
      if (dk === "loginMethod" || dk === "mode" || dk === "trigger") {
        var cur = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
        if (cur) { collect(cur); paintDetail(); }
      }
    });
    if (detail) detail.addEventListener("click", function (e) {
      var stab = e.target.closest("button[data-settab]");
      if (stab) {
        var cur0 = MOCK.sitesList.filter(function (x) { return x.name === state.sel; })[0];
        if (cur0) collect(cur0);
        state.setTab = stab.getAttribute("data-settab");
        paintDetail();
        return;
      }
      var tab = e.target.closest("button[data-tab]");
      if (tab) { state.tab = tab.getAttribute("data-tab"); paintDetail(); return; }

      var cat = e.target.closest(".cat-chip");
      if (cat) { cat.classList.toggle("on"); return; }

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

      if (act === "crawl") { toast("抓取测试：" + (s.title || s.name) + "（假数据）"); return; }
      if (act === "login") { toast("重新登录：" + (s.title || s.name) + "（假数据）"); return; }

      if (act === "save") {
        collect(s);
        window.__ptaStore.set(s.name, s);
        persist(); refreshStats(); paint(); toast("设置已保存（本地）");
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
      var bar = $("#sites-bulk"), n = $("#bulk-n");
      if (n) n.textContent = state.picks.length;
      if (bar) bar.hidden = state.picks.length === 0;
    }

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

    var bAll = $("#bulk-all"), bNone = $("#bulk-none"), bOpen = $("#bulk-open");
    if (bAll) bAll.addEventListener("click", function () {
      filtered().forEach(function (x) { if (state.picks.indexOf(x.name) < 0) state.picks.push(x.name); });
      refreshBulk(); paint();
    });
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

    initBulkModal();
    refreshBulk();
    refreshStats();
    paint();
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
      pills: function () {
        var st = MOCK.sites;
        return '<span class="pill"><span class="dot ok"></span>启用 ' + st.enabled + "</span>" +
               '<span class="pill"><span class="dot warn"></span>登录失效 ' + st.loginFail + "</span>" +
               '<span class="pill"><span class="dot bad"></span>分享率不足 ' + st.lowRatio + "</span>";
      }
    },
    crawl: {
      title: "流程", sub: "抓取、查重、发布与下载器",
      pills: ""
    },
    queue: {
      title: "待审核", sub: "确认后才会发到主站",
      pills: '<span class="pill"><span class="dot ok"></span>主站登录正常</span>'
    },
    sources: {
      title: "数据清单", sub: "站点抓到的原盘都在这",
      pills: '<span class="pill"><span class="dot ok"></span>上次抓取 12:40</span>' +
             '<span class="pill">共 23,186 条</span>'
    },
    logs: {
      title: "日志", sub: "最近 200 行",
      pills: '<span class="pill"><span class="dot ok"></span>心跳正常</span>'
    },
    settings: {
      title: "设置", sub: "面板账号、通知与系统",
      pills: ""
    }
  };
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
    if (!opts.pop) history.pushState({ view: key }, "", "#" + key);
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

  document.addEventListener("DOMContentLoaded", function () {
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
  });
})();
