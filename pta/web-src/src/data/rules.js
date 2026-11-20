import registry from '../../shared/rule-registry.json'

/* 面板的规则表数据：纯数据、无逻辑。改这里不影响渲染代码。
   todo:true 表示服务端未接，界面禁用并标「未接」。 */
(function () {
  window.PTA_RULES = {
  "fetch": [
  {
    "name": "搜索预设",
    "sum": "未设置",
    "rows": [
      {
        "t": "类型",
        "type": "custom",
        "label": "类型",
        "chips": [
          "电影",
          "剧集",
          "综艺",
          "动漫",
          "纪录片",
          "音乐",
          "体育",
          "演唱会",
          "MV",
          "有声书",
          "电子书",
          "软件",
          "游戏",
          "短剧",
          "舞台演出",
          "成人",
          "原盘",
          "Remux",
          "压制",
          "图片",
          "样品",
          "预告",
          "其他"
        ],
        "sel": [],
        "hint": "先选来源站：类型按站映射到分类 id，只对当前站生效"
      },
      {
        "t": "媒介",
        "type": "custom",
        "chips": [
          "原盘(Full Disc)",
          "UHD 原盘",
          "3D 原盘",
          "Remux",
          "Encode",
          "Blu-ray",
          "HDDVD",
          "DVD",
          "HDTV",
          "WEB-DL",
          "WEBRip",
          "TVRip",
          "VHS",
          "其他"
        ],
        "sel": [],
        "hint": "锁到站点的 medium / type 字段",
        "label": "媒介"
      },
      {
        "t": "分辨率",
        "type": "custom",
        "chips": [
          "480p",
          "576p",
          "720p",
          "1080i",
          "1080p",
          "2160p",
          "4320p/8K"
        ],
        "sel": [],
        "hint": "按分辨率筛搜索结果",
        "label": "分辨率"
      },
      {
        "t": "优惠",
        "type": "custom",
        "chips": [
          "免费",
          "2x",
          "2x 免费",
          "50%",
          "2x 50%",
          "30%",
          "普通",
          "置顶精选"
        ],
        "sel": [],
        "hint": "按站点优惠状态筛，BHD 这类站点没有免费选项时会自动跳过"
      },
      {
        "t": "限制",
        "type": "custom",
        "chips": ["禁转", "限转", "HR", "独占", "DIY"],
        "sel": [],
        "hint": "选中即排除；认标题、列表徽章和已抓详情标签"
      }
    ]
  },
  {
    "name": "③ 初筛",
    "sum": "标题级条件 + 正则",
    "rows": [
      {
        "t": "分辨率要求",
        "type": "pick",
        "v": "1080p 及以上",
        "opts": [
          "不限",
          "1080p 及以上",
          "2160p 及以上"
        ],
        "hint": "抓的时候全抓，发之前按这个卡",
        "label": "最低分辨率"
      },
      {
        "t": "体积范围",
        "type": "pick",
        "v": "5 GB 起",
        "opts": [
          "不限",
          "5 GB 起",
          "10 GB 起",
          "20 GB 起"
        ],
        "label": "最小体积"
      },
      {
        "t": "最大体积",
        "type": "pick",
        "v": "不限",
        "opts": [
          "不限",
          "50 GB",
          "80 GB",
          "120 GB"
        ],
        "label": "最大体积"
      },
      {
        "t": "必须带中字",
        "type": "switch",
        "on": true,
        "hint": "成品没有中文字幕就不发",
        "label": "没中字就不收"
      },
      {
        "t": "排除匹配",
        "type": "custom",
        "html": "<input class=\"input\" id=\"rx-deny\" placeholder=\"命中就不转载，例：DVDRip|枪版|CAM\">",
        "hint": "支持正则，限 200 字；命中就拒绝，不进待审",
        "label": "命中这些词就不转"
      },
      {
        "t": "测试匹配",
        "type": "custom",
        "html": "<div class=\"rx-test\"><input class=\"input\" id=\"rx-sample\" placeholder=\"粘贴一条标题试一下\"><button class=\"btn ghost slim\" id=\"rx-run\" type=\"button\">测试</button><em id=\"rx-out\">未测试</em></div>",
        "wide": true,
        "label": "试一下上面的规则"
      }
    ]
  }
],
  "dedupe": [
  {
    "name": "查重处理",
    "sum": "命中重复直接跳过",
    "rows": [
      {
        "t": "目标站已有原盘",
        "type": "switch",
        "on": true,
        "hint": "开启后目标站已有原盘直接跳过；关闭则不按原盘判重",
        "label": "跳过已有原盘"
      },
      {
        "t": "目标站只有 DIY",
        "type": "switch",
        "on": true,
        "hint": "开启后目标站只有 DIY 仍可发布；关闭则跳过",
        "label": "检测有DIY原盘仍可发"
      },
      {
        "t": "禁转/限转处理",
        "type": "switch",
        "on": true,
        "hint": "开启后源种带禁转/限转直接跳过；关闭则不检查",
        "label": "跳过禁转/限转处理"
      },
      {
        "t": "原盘判定关键词",
        "type": "text",
        "v": "原盘|Full Disc|BDMV|ISO",
        "label": "原盘判定关键词",
        "hint": "标题/副标题/简介/标签都看；Remux/DIY 不算"
      }
    ]
  }
],
  "pub": [
  {
    "name": "④ 补齐与准备",
    "sum": "源站缺什么就从这补",
    "rows": [
      {
        "t": "标题原样回填",
        "same": "pub-main",
        "type": "switch",
        "on": true,
        "hint": "开：种子词条标题原样回填；关：标题不齐转待审",
        "label": "标题"
      },
      {
        "t": "副标题拼贴",
        "same": "pub-main",
        "type": "switch",
        "on": true,
        "hint": "开：豆影数据拼贴；关：副标题不齐转待审",
        "label": "副标题"
      },
      {
        "t": "简介回填",
        "same": "pub-main",
        "type": "switch",
        "on": true,
        "hint": "开：豆影简介覆盖电影简介段；关：不联网",
        "label": "简介"
      },
      {
        "t": "简介图片",
        "same": "pub-main",
        "type": "switch",
        "on": true,
        "hint": "开：全部转存图床；关：保留源图不转存",
        "label": "简介图片存图床"
      },
      {
        "t": "自动附加 MediaInfo",
        "same": "pub-main",
        "type": "switch",
        "on": true,
        "hint": "开：自动追加；关：不追加",
        "label": "简介末尾附加 MediaInfo"
      },
    ]
  },
  {
    "name": "⑤ 终审与决策",
    "sum": "不齐转待审 · 不跳过",
    "rows": [
      {
        "t": "必须有简介",
        "same": "review",
        "type": "switch",
        "on": true,
        "hint": "简介不齐转待审",
        "label": "简介不齐转待审"
      },
      {
        "t": "必须有副标题",
        "same": "review",
        "type": "switch",
        "on": true,
        "hint": "副标题不齐转待审",
        "label": "副标题不齐转待审"
      },
      {
        "t": "BDInfo",
        "same": "review",
        "type": "switch",
        "on": true,
        "hint": "没有 BDInfo/MediaInfo 就转待审",
        "label": "BDInfo不齐转待审"
      },
      {
        "t": "截图至少几张",
        "same": "review",
        "type": "switch",
        "on": true,
        "hint": "源简介里的截图必须全部保留",
        "label": "截图保留"
      },
      {
        "t": "年份必须一致",
        "same": "review",
        "type": "switch",
        "on": true,
        "hint": "豆影年份最多比种子年份晚 2 年，超过转待审",
        "label": "年份不一致转待审"
      }
    ]
  },
  {
    "name": "⑥ 发布（站点要求）",
    "sum": "每个站怎么填",
    "rows": [
      {
        "t": "发布到",
        "same": "publish-all",
        "type": "custom",
        "html": "<div class=\"target-pick\"><em class=\"tp-ava\" id=\"tp-ava\"></em><div class=\"tp-info\"><b id=\"tp-name\">—</b><span id=\"tp-host\"></span></div><button class=\"btn ghost slim\" id=\"tp-change\">更换</button></div>",
        "hint": "所有库内资源都归到这个站",
        "label": "发布到哪个站"
      },
      {
        "t": "自动勾选标签",
        "same": "publish-all",
        "type": "switch",
        "on": true,
        "hint": "按来源标签勾国语/中字等；禁转/官方不勾",
        "label": "自动勾选标签"
      },
      {
        "t": "默认匿名",
        "same": "publish-all",
        "type": "switch",
        "on": false,
        "hint": "新条目没单独设置时按这个发",
        "label": "默认匿名发布"
      }
    ]
  },
  {
    "name": "⑦ 发完",
    "sum": "校验 · 抓种 · 辅种",
    "rows": [
      {
        "t": "发布后校验",
        "same": "after",
        "type": "switch",
        "on": true,
        "hint": "发布后自动去目标站核对；关掉就只提交不回查",
        "label": "发布后回查"
      },
      {
        "t": "发布后抓权威种子",
        "same": "after",
        "type": "switch",
        "on": true,
        "hint": "发布成功抓目标站种子存 data/torrents",
        "label": "发布后抓目标站种子"
      },
      {
        "t": "上传前清洗 tracker",
        "same": "after",
        "type": "switch",
        "on": true,
        "hint": "关掉会按源种直传，源站 tracker 会带到目标站",
        "label": "上传前换掉源站 tracker"
      },
      {
        "t": "辅种跳过校验",
        "same": "after",
        "type": "switch",
        "on": true,
        "hint": "qB skip_checking 复用源种保存路径",
        "label": "辅种不重新校验"
      },
      {
        "t": "qB 自动种子管理",
        "same": "after",
        "type": "switch",
        "on": false,
        "hint": "关掉=autoTMM false，不自动移动文件",
        "label": "qB 自动移动文件"
      }
    ]
  },
  {
    "name": "⑧ 失败与通知",
    "sum": "重试与停手",
    "rows": [
      {
        "t": "图片上传重试",
        "same": "fail-notify",
        "type": "text",
        "v": "2 次",
        "inline": true,
        "label": "图片上传重试"
      },
      {
        "t": "连续失败几次暂停该站",
        "same": "fail-notify",
        "type": "text",
        "v": "5",
        "inline": true,
        "label": "连续失败几次暂停该站"
      }
    ]
  }
]
};
})();

/* 规则 key/类型/默认值以共享 JSON 为准；UI 只保留标签、选项和渲染类型。 */
;(function applyRuleRegistry() {
  const byKey = {}
  ;(registry.rules || []).forEach(function (r) { if (r && r.key) byKey[r.key] = r })
  Object.keys(window.PTA_RULES || {}).forEach(function (k) {
    (window.PTA_RULES[k] || []).forEach(function (g) {
      (g.rows || []).forEach(function (r) {
        const meta = byKey[r.t]
        if (!meta) return
        if (meta.type === 'switch' && r.type === 'switch') r.on = meta.default !== false
        if (meta.type !== 'switch' && r.v === undefined) r.v = meta.default
      })
    })
  })
  window.PTA_RULE_REGISTRY = registry
})()
