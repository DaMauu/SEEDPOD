/* PT 转载台 · 静态原型假数据与渲染逻辑 */
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
      { level: "bad", title: "2 个站登录失效", desc: "源站 A、源站 C 需要重新登录", action: "去登录", href: "#settings" },
      { level: "warn", title: "节点 E 离线 37 分钟", desc: "还有 214 个种子未同步", action: "查看", href: "#nodes" },
      { level: "", title: "抓取任务运行正常", desc: "下一轮 18:00 自动增量", action: "看日志", href: "#logs" }
    ],
    published: [
      { title: "The Golden Lotus", cn: "金瓶双艳", site: "目标站 B", time: "12:39", size: "30.67 GB" },
      { title: "Perfect Blue", cn: "未麻的部屋", site: "目标站 B", time: "11:52", size: "44.14 GB" },
      { title: "Ran", cn: "乱", site: "目标站 B", time: "10:18", size: "87.77 GB" },
      { title: "Green Snake", cn: "青蛇劫起", site: "目标站 B", time: "昨天 22:41", size: "43.67 GB" }
    ],
    queue: [
      { id: 101, title: "Follow Me 2020 1080p HKG Blu-ray AVC TrueHD 7.1", cn: "极限网红", year: 2020, res: "1080p", size: "22.10 GB", imdb: "5.4", site: "源站 A", status: "pending", check: "无重复", checkCls: "green" },
      { id: 102, title: "Perfect Blue 1997 1080p HKG Blu-ray AVC DTS-HD MA 5.1", cn: "未麻的部屋", year: 1997, res: "1080p", size: "44.14 GB", imdb: "8.0", site: "源站 A", status: "pending", check: "无重复", checkCls: "green" },
      { id: 103, title: "Ran 1985 2160p UHD Blu-ray DoVi HDR10 HEVC DTS-HD MA 5.1", cn: "乱", year: 1985, res: "2160p", size: "87.77 GB", imdb: "8.2", site: "源站 A", status: "pending", check: "无重复", checkCls: "green" },
      { id: 104, title: "The Golden Lotus 1974 1080p AUS Blu-ray AVC LPCM 2.0", cn: "金瓶双艳", year: 1974, res: "1080p", size: "30.67 GB", imdb: "5.7", site: "源站 A", status: "approved", check: "无重复", checkCls: "green" },
      { id: 105, title: "Crouching Tiger Hidden Dragon 2000 2160p USA UHD Blu-ray HEVC TrueHD 7.1", cn: "卧虎藏龙", year: 2000, res: "2160p", size: "89.12 GB", imdb: "7.9", site: "源站 B", status: "dupe", check: "已有 89.1G", checkCls: "amber" },
      { id: 106, title: "Ida 2013 1080p AUS BluRay AVC DTS-HD MA 5.1", cn: "修女艾达", year: 2013, res: "1080p", size: "27.86 GB", imdb: "7.4", site: "源站 B", status: "failed", check: "详情页 403", checkCls: "red" },
      { id: 107, title: "Green Snake 2021 CHN Blu-ray 1080p AVC Atmos TrueHD 7.1", cn: "青蛇劫起", year: 2021, res: "1080p", size: "43.67 GB", imdb: "6.8", site: "源站 A", status: "pending", check: "无重复", checkCls: "green" },
      { id: 108, title: "Blades of the Guardians 2026 1080p HKG Blu-ray AVC TrueHD 7.1 Atmos", cn: "镖人：风起大漠", year: 2026, res: "1080p", size: "39.45 GB", imdb: "—", site: "源站 A", status: "pending", check: "未查", checkCls: "gray" }
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
      { title: "Kite 2014 1080p HKG Blu-ray AVC TrueHD 5.1", type: "原盘", res: "1080p", size: "21.88 GB", time: "1 天前", check: "禁转", checkCls: "red" },
      { title: "Interview with the Vampire 1994 2160p UHD Blu-ray DV HEVC TrueHD 7.1", type: "原盘", res: "2160p", size: "22.12 GB", time: "4 小时前", check: "无重复", checkCls: "green" }
    ],
    nodes: [
      { name: "A · 控制节点", role: "编排 / 数据库 / 发布", host: "10.0.0.10", online: true, disk: "系统盘 64 / 128 GB", used: 0, total: 0, qb: "—", seeding: "—", path: "/srv/pta" },
      { name: "B · 下载节点", role: "下载 / 做种", host: "10.0.0.11", online: true, disk: "12.3 / 16 TB", used: 12.3, total: 16, qb: "5.0.3", seeding: "1,240", path: "/data/pt" },
      { name: "C · 下载节点", role: "下载 / 做种", host: "10.0.0.12", online: true, disk: "8.7 / 12 TB", used: 8.7, total: 12, qb: "5.0.3", seeding: "862", path: "/data/pt" },
      { name: "D · 下载节点", role: "下载 / 做种", host: "10.0.0.13", online: true, disk: "14.1 / 18 TB", used: 14.1, total: 18, qb: "4.6.7", seeding: "1,905", path: "/data/pt" },
      { name: "E · 下载节点", role: "下载 / 做种", host: "10.0.0.14", online: false, disk: "3.2 / 8 TB", used: 3.2, total: 8, qb: "离线", seeding: "—", path: "/data/pt" }
    ],
    sitesList: [],    logs: [
      { t: "12:40:02", lvl: "ok", tag: "抓取", msg: "源站 A 第 231 页完成，累计 23,186 条，新增 87 条。" },
      { t: "12:39:58", lvl: "", tag: "查重", msg: "目标站索引命中 214 条，跳过 127 条重复。" },
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
    var h = $(".topbar h1");
    if (h && !$(".top-logo")) {
      h.insertAdjacentHTML("beforebegin", '<img class="top-logo" src="assets/whale.png" alt="">');
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
    var s = MOCK.stats;
    var host = $("#dash-stats");
    if (host) {
      host.innerHTML = [
        kpi("今日已发", String(s.today.posted), "较昨日 +1", "up"),
        kpi("本月已发", String(s.today.monthPosted), "月度目标 120", "up"),
        kpi("总发布数", s.today.totalPosted.toLocaleString(), "历史累计", ""),
        kpi("抓取总数", s.today.dbTotal.toLocaleString(), "今日 +" + s.today.fresh, "")
      ].join("");
    }
    renderHero();
    renderPending();
    renderPublished();
    renderHealth();
    var t = $("#today-stats");
    if (t) {
      t.innerHTML = [
        "抓取 <b>" + s.today.scanned.toLocaleString() + "</b>",
        "判重 <b>" + s.today.checked + "</b>",
        "新收录 <b>" + s.today.fresh + "</b>",
        "已发布 <b>" + s.today.posted + "</b>",
        "失败 <b>" + s.today.failed + "</b>"
      ].join("　·　");
    }
    var lg = $("#dash-logs");
    if (lg) {
      lg.innerHTML = MOCK.logs.slice(0, 4).map(function (l) {
        return '<div class="list-item"><span class="time">' + l.t + '</span><span class="msg">' + escapeHtml(l.msg) + "</span></div>";
      }).join("");
    }
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

  function renderHero() {
    var s = MOCK.stats;
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set("hero-num", String(s.today.posted));
    set("hero-delta", "较昨日 +1");
    set("stat-month", String(s.today.monthPosted));
    set("stat-total", s.today.totalPosted.toLocaleString());
    set("stat-db", s.today.dbTotal.toLocaleString());
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

    function detailHtml(it) {
      if (!it) return '<div class="sites-empty">选一条看发布预览</div>';
      var st = STATUS[it.status] || ["未知", "gray"];
      var titleTpl = (it.cn ? it.cn + " " : "") + it.title.replace(/\s+/g, " ").trim();
      return '<div class="qd-head">' +
          '<div class="qd-id"><h2>' + escapeHtml(it.cn || it.title) + "</h2>" +
            '<span class="sd-url">' + escapeHtml(it.title) + "</span></div>" +
          '<span class="badge ' + st[1] + '">' + st[0] + "</span>" +
        "</div>" +
        '<div class="qd-cols">' +
          '<section class="sd-card"><h3>发布信息</h3>' +
            '<div class="qd-field"><span>标题</span><input class="input" id="qd-title" value="' + escapeHtml(titleTpl) + '"></div>' +
            '<div class="qd-field"><span>副标题</span><input class="input" id="qd-sub" value="' + escapeHtml(it.res + " · " + it.size + " · " + it.site) + '"></div>' +
            '<div class="qd-field"><span>目标站分类</span><select class="select" id="qd-cat">' +
              ["原盘", "Remux", "1080p", "2160p", "剧集"].map(function (c) {
                return "<option>" + c + "</option>";
              }).join("") + "</select></div>" +
            '<div class="qd-field"><span>查重</span><b class="' + (it.checkCls || "") + '-t">' + escapeHtml(it.check) + "</b></div>" +
          "</section>" +
          '<section class="sd-card"><h3>来源</h3>' +
            '<div class="sd-row"><span>源站</span><b>' + escapeHtml(it.site) + "</b></div>" +
            '<div class="sd-row"><span>年份 / IMDb</span><b>' + it.year + " · " + escapeHtml(it.imdb) + "</b></div>" +
            '<div class="sd-row"><span>分辨率</span><b>' + escapeHtml(it.res) + "</b></div>" +
            '<div class="sd-row"><span>大小</span><b>' + escapeHtml(it.size) + "</b></div>" +
          "</section>" +
          '<section class="sd-card wide"><h3>简介</h3>' +
            '<textarea class="input sd-note" id="qd-desc" rows="4">' +
              escapeHtml((it.cn || it.title) + "（" + it.year + "）" + it.res + " 原盘转载，来源 " + it.site + "。" +
                "规格：" + it.title.replace(/^.*?\\d{4}\\s*/, "") + "。") + "</textarea>" +
          "</section>" +
          '<section class="sd-card wide"><h3>截图</h3>' +
            '<div class="shots">' + shotHtml(1) + shotHtml(2) + shotHtml(3) +
              '<button class="shot add" id="qd-addshot">上传</button></div>' +
          "</section>" +
        "</div>" +
        '<div class="qd-actions">' +
          '<button class="btn primary slim" data-qact="publish">通过并发布</button>' +
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
      if (act === "publish") {
        it.status = "published";
        toast("已发布到目标站：" + (it.cn || it.title));
        var next = rows().filter(function (x) { return x.status === "pending"; })[0];
        state.sel = next ? next.id : it.id;
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
    var tbody = $("#sources-body");
    if (!tbody) return;
    tbody.innerHTML = MOCK.sources.map(function (it) {
      return "<tr>" +
        '<td><div class="t-main">' + escapeHtml(it.title) + "</div></td>" +
        '<td><span class="badge blue">' + escapeHtml(it.type) + "</span></td>" +
        '<td>' + escapeHtml(it.res) + "</td>" +
        '<td class="mono">' + escapeHtml(it.size) + "</td>" +
        '<td class="mono">' + escapeHtml(it.time) + "</td>" +
        '<td><span class="badge ' + it.checkCls + '">' + escapeHtml(it.check) + "</span></td>" +
        '<td><div class="row-actions"><button class="btn sm" data-act="transfer">转种</button></div></td>' +
        "</tr>";
    }).join("");
    tbody.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-act]");
      if (btn) toast("转种（假数据）：" + btn.closest("tr").querySelector(".t-main").textContent);
    });
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
      if (sub) sub.textContent = "共 " + nodes.length + " 台 · " + onlineAll + " 在线 · 做种 " +
        totalSeed.toLocaleString() + " · 磁盘余量 " + (total - used).toFixed(1) + " TB";
      var meta = $("#nodes-drawer-meta");
      if (meta) meta.textContent = onlineAll + " / " + nodes.length + " 在线";

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
          host: $("#nd-host").value.trim() || "10.0.0.0",
          path: editing >= 0 ? MOCK.nodes[editing].path : "/data/pt",
          qb: "5.0.3",
          qbUser: $("#nd-user").value.trim(),
          qbPass: $("#nd-pass").value,
          maxDown: $("#nd-down").value.trim(),
          seedLimit: $("#nd-seed").value.trim()
        };
        if (editing >= 0) {
          var nd = MOCK.nodes[editing];
          nd.name = data.name; nd.role = data.role; nd.host = data.host;
          nd.maxDown = data.maxDown; nd.seedLimit = data.seedLimit;
          nd.qbUser = data.qbUser; nd.qbPass = data.qbPass;
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
    host.innerHTML = MOCK.logs.concat(MOCK.logs).map(function (l) {
      return '<div class="log-line ' + l.lvl + '">' +
        '<span class="ts">' + l.t + '</span>' +
        '<span class="tag">[' + (l.lvl === "error" ? "ERROR" : l.lvl === "warn" ? "WARN" : "INFO") + "]</span>" +
        '<span class="txt">[' + escapeHtml(l.tag) + "] " + escapeHtml(l.msg) + "</span></div>";
    }).join("");
  }

  function setControl(r) {
    var k = r.k ? ' data-k="' + r.k + '"' : "";
    if (r.type === "switch") {
      return '<button class="switch' + ((r.on || r.v) ? " on" : "") + '" data-switch="' + (r.k || "") + '"><i></i></button>';
    }
    if (r.type === "select") {
      var opts = (r.opts || []).map(function (o) {
        var label = r.labels && r.labels[o] !== undefined ? r.labels[o] : o;
        return '<option value="' + o + '"' + (o === r.v ? " selected" : "") + ">" + label + "</option>";
      }).join("");
      return '<select class="select"' + k + ">" + opts + "</select>";
    }
    if (r.type === "textarea") {
      return '<textarea class="input sd-note"' + k + ' rows="3" placeholder="' + escapeHtml(r.ph || "") + '">' + escapeHtml(r.v || "") + "</textarea>";
    }
    if (r.type === "time") {
      return '<input class="input" type="time"' + k + ' value="' + escapeHtml(r.v || "") + '">';
    }
    if (r.type === "password") {
      return '<input class="input" type="password"' + k + ' value="' + escapeHtml(r.v || "") + '" placeholder="' + escapeHtml(r.ph || "") + '" autocomplete="new-password">';
    }
    if (r.type === "button") {
      return '<button class="btn ghost slim" data-btn="' + escapeHtml(r.t) + '">' + escapeHtml(r.v) + "</button>";
    }
    if (r.type === "custom") {
      return r.html || "";
    }
    return '<input class="input"' + k + ' value="' + escapeHtml(r.v === undefined ? "" : r.v) + '"' + (r.disabled ? " disabled" : "") + ' placeholder="' + escapeHtml(r.ph || "") + '">';
  }

  function setRowsHtml(rows) {
    return rows.map(function (r) {
      var head = r.g
        ? '<div class="set-group">' + r.g + "</div>" + (r.gd ? '<p class="set-group-desc">' + r.gd + "</p>" : "")
        : "";
      return head + '<div class="set-field' + (r.cls ? " " + r.cls : "") + '">' +
        '<div class="lbl"><span>' + r.t + "</span>" + (r.hint ? "<i>" + r.hint + "</i>" : "") + "</div>" +
        '<div class="ctl">' + setControl(r) + "</div>" +
      "</div>";
    }).join("");
  }

  function chipRow(items, active) {
    return '<div class="cat-row pick-row">' + items.map(function (c) {
      var on = active.indexOf(c) >= 0;
      return '<button type="button" class="cat-chip' + (on ? " on" : "") + '" data-pick="' + c + '">' + c + "</button>";
    }).join("") + "</div>";
  }

  function initCrawlSettings() {
    var host = $("#crawl-panel");
    if (!host) return;
    var RULES = [
      { name: "发布模式", sum: "半自动 · 需人工点通过", rows: [
        { t: "自动发布模式", type: "select", v: "半自动（补齐后转待审核）", opts: ["全自动（质检全过直接发）", "半自动（补齐后转待审核）", "仅准备（不碰目标站）"] },
        { t: "发布前必须人工点通过", type: "switch", on: true, hint: "半自动模式下固定开启" }
      ] },
      { name: "匹配", sum: "相似度 0.85 · 年份必须一致", rows: [
        { t: "片名相似度阈值", type: "text", v: "0.85", hint: "低于这个值不猜，直接转人工" },
        { t: "年份必须一致", type: "switch", on: true },
        { t: "匹配来源顺序", type: "select", v: "TMDB → 豆瓣 → 源站标题", opts: ["TMDB → 豆瓣 → 源站标题", "豆瓣 → TMDB → 源站标题", "只用源站标题"] },
        { t: "分类映射不到时", type: "select", v: "转人工处理", opts: ["转人工处理", "落到该站默认分类"] }
      ] },
      { name: "识别与质检", sum: "电影 · 蓝光原盘 · 排除 DIY/禁转/独占", rows: [
        { t: "类型", type: "custom", html: chipRow(["电影", "剧集", "综艺", "动漫", "纪录", "音乐", "体育", "其他"], ["电影"]), hint: "只收勾选的类型，其它直接跳过" },
        { t: "媒介", type: "custom", html: chipRow(["蓝光原盘", "Remux", "Blu-ray 压制", "UHD", "DVD", "WEB-DL", "HDTV"], ["蓝光原盘"]) },
        { t: "排除 DIY 原盘", type: "switch", on: true, hint: "标题或说明带 DIY / 修改 / 加长 标记的直接跳过" },
        { t: "排除禁转", type: "switch", on: true, hint: "源站标了禁转的一律不要" },
        { t: "排除独占", type: "switch", on: true, hint: "独占资源不能转，直接跳过" },
        { t: "地区版本", type: "switch", on: true, hint: "识别出 US/HKG/TWN 这类版本，写进中文副标题" },
        { t: "电影简介", type: "switch", on: true },
        { t: "BDInfo", type: "select", v: "必须存在且校验通过", opts: ["必须存在且校验通过", "有就行，不校验", "不要求"] },
        { t: "截图至少几张", type: "text", v: "3", hint: "不够就不自动发" },
        { t: "不满足时", type: "select", v: "转待审核", opts: ["转待审核", "直接跳过"] }
      ] },
      { name: "副标题生成", sum: "种子自带 → 豆影网页 → TMDB", rows: [
        { t: "中文副标题模板", type: "custom", hint: "用 {电影名} {地区} {导演} {主演1..3} {音轨} {字幕} 这些占位符", html: '<div class="tpl-wrap"><input class="input" id="sub-tpl" value="{电影名} | {地区}原盘 | 导演:{导演} | 主演:{主演1}/{主演2}/{主演3} | [{音轨}] [{字幕}]"><div class="tpl-eg" id="sub-eg"></div></div>' },
        { t: "中文副标题来源", type: "select", v: "种子自带 → 豆影网页 → TMDB", opts: ["种子自带 → 豆影网页 → TMDB", "豆影网页 → 豆瓣 → TMDB", "只用种子自带，没有就用英文"] },
        { t: "TMDB 接口", type: "text", v: "", ph: "填 API Key 才能自动查导演和主演" },
        { t: "简介来源顺序", type: "select", v: "豆影网页 → 豆瓣 → TMDB", opts: ["豆影网页 → 豆瓣 → TMDB", "豆瓣 → 豆影网页 → TMDB", "只用 TMDB（zh-CN）"] },
        { t: "豆影 API Key", type: "text", v: "", ph: "免费每天 10 次，用完走网页版" },
        { t: "豆瓣抓取间隔（秒）", type: "text", v: "3", hint: "太快会出验证码" },
        { t: "主演最多几个", type: "text", v: "3" },
        { t: "缺字段时", type: "select", v: "省略该段", opts: ["省略该段", "写「未知」", "转待审核"] }
      ] },
      { name: "发布节流", sum: "间隔 60 秒 · 每天 20 条", rows: [
        { t: "自动转种总开关", type: "switch", on: true, hint: "关掉只抓不发，全部留给人" },
        { t: "两条之间间隔（秒）", type: "text", v: "60", hint: "别把目标站刷爆" },
        { t: "每天最多自动发几条", type: "text", v: "20" },
        { t: "只在时段内发布", type: "select", v: "全天", opts: ["全天", "00:00–08:00", "08:00–24:00"] },
        { t: "免审直接发的分类", type: "text", v: "", ph: "留空＝都要审，例：原盘, Remux" }
      ] },
      { name: "失败与兜底", sum: "重复转审核 · 禁转丢弃", rows: [
        { t: "目标站已有同片", type: "select", v: "转待审核（标重复）", opts: ["转待审核（标重复）", "直接丢弃"] },
        { t: "源站标禁转", type: "select", v: "直接丢弃", opts: ["直接丢弃", "只收录不发布"] },
        { t: "连续失败几次暂停该站", type: "text", v: "5" },
        { t: "失败时推送通知", type: "switch", on: true }
      ] }
    ];
    var GROUPS = [
      { name: "抓取与发布", cols: true, desc: "新站点默认怎么抓、抓到以后发到哪。", sum: '<span id="drawer-pub-sum">增量 · 发到 —</span>', rows: [
        { g: "抓取", t: "每页间隔", type: "text", v: "3.0 秒" },
        { t: "并发", type: "select", v: "1", opts: ["1", "2", "3"] },
        { t: "每轮最多翻页", type: "text", v: "2" },
        { t: "抓取方式", type: "select", v: "增量（只抓新页）", opts: ["增量（只抓新页）", "全量", "增量 + 定期全量"] },
        { t: "全局排除关键词", type: "text", v: "DVDRip, 枪版, TS", hint: "逗号分隔，标题命中就不抓" },
        { t: "抓取字段", cls: "stack", type: "custom", html: chipRow(["标题", "中文副标题", "简介", "地区版本", "音轨", "字幕", "截图", "BDInfo", "禁转标记", "独占标记"], ["标题", "中文副标题", "简介", "地区版本", "音轨", "字幕", "截图", "BDInfo", "禁转标记", "独占标记"]), hint: "NP 站多数带中文副标题；UNIT3D 多为英文，只能靠外部查询补" },
        { g: "发布", t: "发布到", type: "custom", html: '<div class="target-pick"><em class="tp-ava" id="tp-ava"></em><div class="tp-info"><b id="tp-name">—</b><span id="tp-host"></span></div><button class="btn ghost slim" id="tp-change">更换</button></div>', hint: "所有源站抓到的资源都发到这个站" },
        { t: "图床", type: "select", v: "站内图床（浏览器上传）", opts: ["站内图床（浏览器上传）", "外链图床 API"] },
        { t: "自动提交", type: "switch", v: false, hint: "默认关闭，最后一步永远留给人确认" },
        { t: "发布标题模板", type: "text", v: "{中文名} {英文名} {年份} {规格}" },
        { t: "发布后自动做种", type: "switch", v: true }
      ] },
      { name: "自动转种", rules: RULES, desc: "匹配、补齐、质检都过了才自动发，不然转待审核。", sum: "半自动 · 相似度 0.85 · 截图 3 张" }
    ];
    var OPEN = {};
    function splitCols(rows) {
      var idx = 0;
      rows.forEach(function (r, i) { if (r.g === "发布") idx = i; });
      if (!idx) return '<div class="set-fields">' + setRowsHtml(rows) + "</div>";
      return '<div class="drawer-cols"><div class="set-fields">' + setRowsHtml(rows.slice(0, idx)) +
        '</div><div class="set-fields">' + setRowsHtml(rows.slice(idx)) + "</div></div>";
    }
    function ruleListHtml(rules) {
      return '<div class="rule-list">' + rules.map(function (r, i) {
        return '<div class="rule-row"><span class="rule-name">' + r.name + "</span>" +
          '<span class="rule-sum">' + r.sum + "</span>" +
          '<button class="link-btn rule-set" data-rule="' + i + '">设置</button></div>';
      }).join("") + "</div>";
    }
    function drawerHtml(g, i) {
      return '<section class="drawer' + (OPEN[i] ? " open" : "") + '" data-i="' + i + '">' +
        '<button class="drawer-head" data-drawer="' + i + '">' +
          '<div class="drawer-t">' +
            '<div class="drawer-title">' + g.name + "</div>" +
            '<div class="drawer-desc">' + g.desc + "</div>" +
          "</div>" +
          '<span class="drawer-meta">' + g.sum + "</span>" +
          '<svg class="drawer-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
        "</button>" +
        '<div class="drawer-body">' + (g.rules ? ruleListHtml(g.rules) : g.cols ? splitCols(g.rows) : '<div class="set-fields">' + setRowsHtml(g.rows) + "</div>") + "</div>" +
      "</section>";
    }
    host.innerHTML = GROUPS.map(drawerHtml).join("");

    var DEMO_DB = {
      "golden lotus": { cn: "金瓶双艳", region: "澳版", director: "李翰祥", cast: ["胡锦", "恬妮", "陈萍"], audio: "国语 2.0", subs: "中文字幕" },
      "perfect blue": { cn: "未麻的部屋", region: "港版", director: "今敏", cast: ["岩男润子", "松本梨香", "辻亲八"], audio: "日语 5.1", subs: "中文字幕" },
      "ran": { cn: "乱", region: "日版", director: "黑泽明", cast: ["仲代达矢", "寺尾聪", "根津甚八"], audio: "日语 5.1", subs: "中文字幕" }
    };
    var TPL_DEMO = {
      电影名: "金瓶双艳", 地区: "港版", 导演: "李翰祥",
      主演1: "胡锦", 主演2: "恬妮", 主演3: "陈萍",
      音轨: "国语 2.0", 字幕: "中文字幕"
    };
    function renderTpl() {
      var inp = $("#sub-tpl"), eg = $("#sub-eg");
      if (!inp || !eg) return;
      var t = inp.value || "";
      Object.keys(TPL_DEMO).forEach(function (k) {
        t = t.split("{" + k + "}").join(TPL_DEMO[k]);
      });
      eg.textContent = t;
    }
    if (host.addEventListener) {
      host.addEventListener("input", function (e) {
        if (e.target && e.target.id === "sub-tpl") renderTpl();
      });
    }

    var rmask = $("#rule-modal");
    var curRule = -1;
    function openRule(i) {
      curRule = i;
      var r = RULES[i];
      $("#rule-title").textContent = r.name;
      $("#rule-body").innerHTML = '<div class="set-fields">' + setRowsHtml(r.rows) + "</div>";
      rmask.hidden = false;
      renderTpl();
    }
    if (rmask) {
      $("#rule-close").addEventListener("click", function () { rmask.hidden = true; });
      $("#rule-ok").addEventListener("click", function () { rmask.hidden = true; toast("已保存：" + RULES[curRule].name); });
      rmask.addEventListener("click", function (e) { if (e.target === rmask) rmask.hidden = true; });
      rmask.addEventListener("click", function (e) {
        var sw = e.target.closest("button[data-switch]");
        if (sw) { sw.classList.toggle("on"); return; }
        var pick = e.target.closest(".pick-row .cat-chip");
        if (pick) pick.classList.toggle("on");
      });
      host.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-rule]");
        if (b) openRule(Number(b.getAttribute("data-rule")));
      });
    }

    var TKEY = "pta.target";
    var target = null;
    try { target = localStorage.getItem(TKEY); } catch (e) {}
    if (!target || !MOCK.sitesList.some(function (x) { return x.name === target; })) {
      target = (MOCK.sitesList.filter(function (x) { return x.login === "ok" && x.enabled; })[0] || MOCK.sitesList[0]).name;
    }
    function siteOf(h) { return MOCK.sitesList.filter(function (x) { return x.name === h; })[0]; }
    function paintTarget() {
      var t = siteOf(target);
      var n = $("#tp-name"), h = $("#tp-host");
      if (n) n.textContent = t ? (t.title || t.name) : "未选择";
      if (h) h.textContent = t ? t.name : "";
      var ps = $("#drawer-pub-sum");
      if (ps) ps.textContent = "增量 · 发到 " + (t ? (t.title || t.name) : "—");
      var av = $("#tp-ava");
      if (av) {
        var label = t ? (t.title || t.name) : "?";
        var m = label.match(/^[A-Za-z0-9]+/);
        av.textContent = m ? m[0].slice(0, 2).toUpperCase() : label.slice(0, 1);
        av.className = "tp-ava " + (t && t.arch === "NP" ? "np" : t && t.arch === "GZ" ? "gz" : t && t.arch === "UNIT3D" ? "u3d" : "oth");
      }
    }
    paintTarget();

    var mask = $("#target-modal");
    function renderTargetList(q) {
      var box = $("#target-list");
      var rows = MOCK.sitesList.filter(function (x) {
        if (!x.enabled || x.login !== "ok") return false;
        if (q && ((x.title || "") + " " + x.name).toLowerCase().indexOf(q) === -1) return false;
        return true;
      }).slice(0, 60);
      box.innerHTML = rows.map(function (x) {
        return '<button class="target-item' + (x.name === target ? " on" : "") + '" data-host="' + escapeHtml(x.name) + '">' +
          '<span class="ti-name">' + escapeHtml(x.title || x.name) + "</span>" +
          '<span class="ti-host">' + escapeHtml(x.name) + "</span>" +
          '<span class="chip ' + (x.arch === "NP" ? "np" : x.arch === "GZ" ? "gz" : x.arch === "UNIT3D" ? "u3d" : "oth") + '">' + escapeHtml(x.arch === "GZ" ? "Gazelle" : x.arch === "OTHER" ? "其它" : x.arch === "?" ? "未确认" : x.arch) + "</span>" +
        "</button>";
      }).join("") || '<div class="sites-empty">没有匹配的站点</div>';
    }
    if (mask) {
      var q = $("#target-q");
      $("#tp-change") && host.addEventListener("click", function (e) {
        if (e.target.closest("#tp-change")) {
          q.value = "";
          renderTargetList("");
          mask.hidden = false;
          setTimeout(function () { q.focus(); }, 30);
        }
      });
      q.addEventListener("input", function () { renderTargetList(q.value.trim().toLowerCase()); });
      $("#target-x").addEventListener("click", function () { mask.hidden = true; });
      mask.addEventListener("click", function (e) { if (e.target === mask) mask.hidden = true; });
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

    renderTpl();

    function tryGenerate() {
      var t = $("#try-title"), out = $("#try-out");
      if (!t || !out) return;
      var title = t.value;
      var key = Object.keys(DEMO_DB).filter(function (k) { return title.toLowerCase().indexOf(k) >= 0; })[0];
      if (!key) {
        out.textContent = "没匹配到这部片（示例数据只有金瓶双艳 / 未麻的部屋 / 乱）";
        return;
      }
      var d = DEMO_DB[key];
      var tpl = ($("#sub-tpl") && $("#sub-tpl").value) || "";
      var map = {
        电影名: d.cn, 地区: d.region, 导演: d.director,
        主演1: d.cast[0], 主演2: d.cast[1], 主演3: d.cast[2],
        音轨: d.audio, 字幕: d.subs
      };
      Object.keys(map).forEach(function (k) { tpl = tpl.split("{" + k + "}").join(map[k]); });
      out.textContent = tpl;
    }
    if (host.addEventListener) {
      host.addEventListener("click", function (e) {
        if (e.target && e.target.id === "try-btn") tryGenerate();
      });
    }

    document.addEventListener("click", function (e) {
      var pick = e.target.closest(".pick-row .cat-chip");
      if (pick) { pick.classList.toggle("on"); return; }
      var dh = e.target.closest(".drawer-head");
      if (!dh) return;
      var d = dh.closest(".drawer");
      var wasOpen = d.classList.contains("open");
      $$(".drawer.open").forEach(function (x) { x.classList.remove("open"); });
      if (!wasOpen) d.classList.add("open");
    });

    host.addEventListener("click", function (e) {
      var sw = e.target.closest("button[data-switch]");
      if (sw) sw.classList.toggle("on");
      var btn = e.target.closest("button[data-btn]");
      if (btn) toast(btn.getAttribute("data-btn") + "（假数据）");
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("#save-crawl")) toast("抓取设置已保存（假数据）");
    });
  }

  function ptaConfirm(title, text, ok) {
    var mask = $("#confirm-modal");
    if (!mask) { if (window.confirm(title + "\n\n" + text)) ok(); return; }
    $("#confirm-title").textContent = title;
    $("#confirm-text").textContent = text;
    mask.hidden = false;
    function cleanup() {
      mask.hidden = true;
      $("#confirm-yes").removeEventListener("click", yes);
      $("#confirm-no").removeEventListener("click", no);
    }
    function yes() { cleanup(); ok(); }
    function no() { cleanup(); }
    $("#confirm-yes").addEventListener("click", yes);
    $("#confirm-no").addEventListener("click", no);
  }

  function initSettings() {
    var panel = $("#set-panel");
    if (!panel) return;
    var GROUPS = [
      { name: "面板账号", desc: "登录这个面板用的账号，和源站账号无关。", rows: [
        { t: "面板用户名", type: "text", v: "admin" },
        { t: "面板密码", type: "password", k: "panelPass", ph: "留空表示不修改", hint: "保存时会再确认一次，避免误改" },
        { t: "两步验证", type: "switch", v: true, hint: "登录面板时需要输入一次 TOTP" },
        { t: "登录保持", type: "select", v: "7 天", opts: ["7 天", "30 天", "关闭浏览器失效"] },
        { t: "面板地址", type: "text", v: "https://pta.example/", hint: "在 DNS 那边解析到 A 机" },
        { t: "只允许局域网访问", type: "switch", v: true, hint: "关掉后外网也能打开，需要配合防火墙" },
        { t: "已登录设备", type: "text", v: "Windows · 192.168.1.23", disabled: true },
        { t: "退出所有设备", type: "button", v: "全部退出" }
      ] },
      { name: "通知", desc: "哪些事需要主动推送给你。", rows: [
        { t: "Telegram bot", type: "text", v: "@pta_bot", disabled: true },
        { t: "每日汇总", type: "switch", v: true, hint: "每天 22:00 发一条" },
        { t: "失败立即推送", type: "switch", v: true },
        { t: "登录失效提醒", type: "switch", v: true }
      ] },
      { name: "系统", desc: "版本、备份和这台浏览器里的数据。", rows: [
        { t: "当前版本", type: "text", v: "0.3.2 原型", disabled: true },
        { t: "立即备份", type: "button", v: "开始备份" },
        { t: "清空本地缓存", type: "button", v: "清空", hint: "只会清掉浏览器里的设置，不动服务器数据" }
      ] }
    ];
    panel.innerHTML = '<div class="set-stack">' + GROUPS.map(function (g, i) {
      return '<section class="set-card' + (i === 0 ? " first" : "") + '">' +
        '<h2 class="set-h2">' + g.name + "</h2>" +
        '<p class="set-desc">' + g.desc + "</p>" +
        '<div class="set-fields">' + setRowsHtml(g.rows) + "</div></section>";
    }).join("") + "</div>";
    panel.addEventListener("click", function (e) {
      var sw = e.target.closest("button[data-switch]");
      if (sw) { sw.classList.toggle("on"); return; }
      var btn = e.target.closest("button[data-btn]");
      if (btn) toast(btn.getAttribute("data-btn") + "（假数据）");
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest("#save-settings")) return;
      var pw = panel.querySelector('[data-k="panelPass"]');
      var val = pw ? pw.value : "";
      if (val) {
        ptaConfirm("您正在修改面板密码", "保存后旧密码立即失效，所有已登录设备都要重新登录。确定继续？", function () {
          if (pw) pw.value = "";
          toast("面板密码已修改（假数据）");
        });
        return;
      }
      toast("设置已保存（假数据）");
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

    var SET_TABS = [
      ["basic", "基本信息"], ["login", "登录"], ["scope", "抓取范围"],
      ["mode", "抓取方式"], ["time", "抓取时间"], ["freq", "抓取频率"]
    ];

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
          { t: "启用抓取", type: "switch", on: s.enabled, k: "enabled" },
          { t: "站点地址", type: "text", k: "url", v: s.url },
          { t: "架构", type: "select", k: "arch", v: s.arch || "?", opts: ["NP", "UNIT3D", "GZ", "OTHER", "?"], labels: { NP: "NexusPHP", UNIT3D: "UNIT3D", GZ: "Gazelle", OTHER: "其它", "?": "未确认" } },
          { t: "备注", type: "textarea", k: "note", v: s.note || "", ph: "比如：只在周末抓、只收原盘" }
        ]) + "</div>";
      } else if (tab === "login") {
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "登录方式", type: "select", k: "loginMethod", v: method, opts: ["password", "cookie"], labels: { password: "账号密码（含 2FA）", cookie: "Cookie" } }
        ]) + (method === "cookie"
          ? '<div class="set-fields">' + setRowsHtml([
              { t: "Cookie", type: "textarea", k: "cookie", v: s.cookie || "", ph: "从浏览器复制整段 cookie 粘进来" }
            ]) + "</div>"
          : '<div class="set-fields">' + setRowsHtml([
              { t: "用户名", type: "text", k: "username", v: s.username || "" },
              { t: "密码", type: "password", k: "password", v: s.password || "", ph: "留空表示不修改" },
              { t: "两步验证", type: "switch", k: "tfa", on: s.tfa },
              { t: "TOTP 密钥", type: "text", k: "totp", v: s.totp || "", ph: "绑定 2FA 时填，登录自动算码" }
            ]) + "</div>") + "</div>";
      } else if (tab === "scope") {
        body = '<div class="cat-label">抓取分类</div><div class="cat-row">' + CATS.map(function (c) {
          var on = (s.cats || []).indexOf(c[0]) >= 0;
          return '<button type="button" class="cat-chip' + (on ? " on" : "") + '" data-cat="' + c[0] + '">' + c[1] + "</button>";
        }).join("") + "</div>" +
        '<div class="set-fields">' + setRowsHtml([
          { t: "只收原盘（整盘 ISO/BDMV）", type: "switch", k: "fullDiscOnly", on: s.fullDiscOnly },
          { t: "分辨率下限", type: "select", k: "minRes", v: s.minRes, opts: ["any", "720p", "1080p", "2160p"], labels: { any: "不限", "720p": "720p 及以上", "1080p": "1080p 及以上", "2160p": "2160p 及以上" } },
          { t: "最小体积（GB）", type: "text", k: "minSize", v: s.minSize || "" },
          { t: "排除关键词", type: "text", k: "exclude", v: s.exclude || "", ph: "逗号分隔，标题命中就不抓" },
          { t: "抓到的资源", type: "select", k: "queueMode", v: s.queueMode, opts: ["queue", "collect"], labels: { queue: "自动进待发队列", collect: "只收录，不发布" } }
        ]) + "</div>";
      } else if (tab === "mode") {
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "模式", type: "select", k: "mode", v: mode, opts: ["incr", "full", "mixed"], labels: { incr: "增量（只抓新页）", full: "全量（扫全部页）", mixed: "增量 + 定期全量" } }
        ]) + "</div>" + (mode === "full" ? "" : '<div class="set-fields">' + setRowsHtml([
          { t: "遇到已收录的种子就停", type: "switch", k: "stopAtKnown", on: s.stopAtKnown }
        ]) + "</div>") + (mode === "incr" ? "" : '<div class="set-fields">' + setRowsHtml([
          { t: "全量周期", type: "select", k: "fullCycle", v: s.fullCycle, opts: ["weekly", "monthly", "manual"], labels: { weekly: "每周一次", monthly: "每月一次", manual: "手动" } }
        ]) + "</div>") + '<div class="set-fields">' + setRowsHtml([
          { t: "每轮最多翻几页", type: "text", k: "pages", v: s.pages }
        ]) + "</div>";
      } else if (tab === "time") {
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "触发方式", type: "select", k: "trigger", v: s.trigger, opts: ["interval", "daily", "manual"], labels: { interval: "按间隔自动跑", daily: "每天定点跑", manual: "手动" } }
        ]) + "</div>" + (s.trigger === "daily"
          ? '<div class="set-fields">' + setRowsHtml([{ t: "每天几点", type: "time", k: "dailyAt", v: s.dailyAt || "18:00" }]) + "</div>"
          : s.trigger === "manual" ? ""
          : '<div class="set-fields">' + setRowsHtml([{ t: "每隔多少分钟", type: "text", k: "everyMin", v: s.everyMin || "60" }]) + "</div>") +
        '<div class="set-fields">' + setRowsHtml([
          { t: "只在特定时段抓", type: "switch", k: "timeWindow", on: s.timeWindow }
        ]) + "</div>" + (s.timeWindow
          ? '<div class="set-fields">' + setRowsHtml([
              { t: "开始时间", type: "time", k: "winStart", v: s.winStart || "00:00" },
              { t: "结束时间", type: "time", k: "winEnd", v: s.winEnd || "08:00" }
            ]) + "</div>"
          : "") + '<div class="set-fields">' + setRowsHtml([
          { t: "站点之间随机错开（± 分钟）", type: "text", k: "jitter", v: s.jitter || "5" }
        ]) + "</div>";
      } else {
        body = '<div class="set-fields">' + setRowsHtml([
          { t: "每页间隔（秒）", type: "text", k: "interval", v: s.interval },
          { t: "并发", type: "text", k: "concurrency", v: s.concurrency },
          { t: "发布前查重", type: "switch", k: "dupeCheck", on: s.dupeCheck }
        ]) + "</div>";
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
        if (sw.getAttribute("data-switch") === "timeWindow") {
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
      var cats = $("#bm-cats");
      if (cats && !cats.children.length) {
        cats.innerHTML = CATS.map(function (c) {
          var on = ["movie", "tv", "doc", "music"].indexOf(c[0]) >= 0;
          return '<button type="button" class="cat-chip' + (on ? " on" : "") + '" data-cat="' + c[0] + '">' + c[1] + "</button>";
        }).join("");
      }
      if (bOpen) bOpen.addEventListener("click", function () {
        $("#bulk-count").textContent = state.picks.length;
        mask.hidden = false;
      });
      $("#bulk-x").addEventListener("click", function () { mask.hidden = true; });
      $("#bulk-cancel").addEventListener("click", function () { mask.hidden = true; });
      mask.addEventListener("click", function (e) { if (e.target === mask) mask.hidden = true; });
      $("#bm-full").addEventListener("click", function (e) { e.currentTarget.classList.toggle("on"); });
      cats.addEventListener("click", function (e) {
        var ch = e.target.closest(".cat-chip");
        if (ch) ch.classList.toggle("on");
      });
      $("#bulk-ok").addEventListener("click", function () {
        var gScope = $("#bg-scope").checked, gMode = $("#bg-mode").checked;
        var gTime = $("#bg-time").checked, gFreq = $("#bg-freq").checked;
        var catList = [].map.call(cats.querySelectorAll(".cat-chip.on"), function (c) { return c.getAttribute("data-cat"); });
        var res = $("#bm-res").value, size = $("#bm-size").value.trim();
        var full = $("#bm-full").classList.contains("on");
        var mode = $("#bm-mode").value, trig = $("#bm-trigger").value, every = $("#bm-every").value.trim();
        var iv = $("#bm-interval").value.trim(), pg = $("#bm-pages").value.trim(), cc = $("#bm-concurrency").value.trim();
        var list2 = pickedSites();
        list2.forEach(function (x) {
          if (gScope) { x.cats = catList.slice(); x.minRes = res; x.minSize = size; x.fullDiscOnly = full; }
          if (gMode) { x.mode = mode; }
          if (gTime) { x.trigger = trig; x.everyMin = every; }
          if (gFreq) { x.interval = iv; x.pages = pg; x.concurrency = cc; }
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
      pills: '<span class="pill"><span class="dot ok"></span>服务运行中</span>' +
             '<span class="pill"><span class="dot warn"></span>2 个站登录失效</span>' +
             '<span class="pill"><span class="dot ok"></span>节点 4 / 5</span>'
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
      title: "流程", sub: "抓取、发布与下载器",
      pills: '<button class="btn primary slim" id="save-crawl">保存</button>'
    },
    queue: {
      title: "待审核", sub: "确认后才会发到目标站",
      pills: '<span class="pill"><span class="dot ok"></span>目标站登录正常</span>'
    },
    sources: {
      title: "数据清单", sub: "源站抓到的原盘都在这",
      pills: '<span class="pill"><span class="dot ok"></span>上次抓取 12:40</span>' +
             '<span class="pill">共 23,186 条</span>'
    },
    logs: {
      title: "日志", sub: "最近 200 行",
      pills: '<span class="pill"><span class="dot ok"></span>心跳正常</span>'
    },
    settings: {
      title: "设置", sub: "面板账号、通知与系统",
      pills: '<button class="btn primary" id="save-settings">保存</button>'
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
    document.title = title + " · PT 转载台";
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
    renderDashboard();
    initQueue();
    initSources();
    initNodes();
    initLogs();
    initSettings();
    initCrawlSettings();
    initSites();
    initSiteModal();
    initRouter();
  });
})();
