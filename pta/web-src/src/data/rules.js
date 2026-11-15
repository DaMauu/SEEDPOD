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
        "hint": "按站映射到分类 id；选中的类型决定抓哪些分类"
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
        "todo": true,
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
        "todo": true,
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
        "hint": "按站点优惠状态筛，BHD 这类站点没有免费选项时会自动跳过",
        "todo": true
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
        "hint": "支持正则，限 200 字；只决定转不转，不影响请求",
        "label": "命中这些词就不转"
      },
      {
        "t": "白名单匹配",
        "type": "custom",
        "html": "<input class=\"input\" id=\"rx-allow\" placeholder=\"留空不限，命中才转载\">",
        "hint": "和排除同时命中时，排除优先",
        "label": "只转命中这些词的"
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
    "name": "查重范围",
    "sum": "比什么、比到哪一层",
    "rows": [
      {
        "t": "目标站搜索",
        "type": "switch",
        "on": true,
        "hint": "关闭后手动查重不请求目标站",
        "label": "发布前先搜目标站有没有"
      },
      {
        "t": "体积容差",
        "type": "text",
        "v": "2",
        "hint": "体积差在这个百分比内算同一条",
        "label": "大小差多少算同一部（%）"
      }
    ]
  },
  {
    "name": "目标站状态",
    "sum": "目标站已有什么",
    "rows": [
      {
        "t": "目标站已有原盘",
        "type": "select",
        "v": "跳过不收",
        "opts": [
          "跳过不收",
          "标重复后仍收"
        ],
        "todo": true,
        "label": "目标站已有完整蓝光镜像"
      },
      {
        "t": "目标站只有 DIY",
        "type": "select",
        "v": "可发（标复核）",
        "opts": [
          "可发（标复核）",
          "跳过"
        ],
        "todo": true,
        "label": "目标站只有 DIY 原盘"
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
        "t": "中文副标题来源",
        "label": "副标题从哪来",
        "type": "select",
        "v": "种子自带 → 豆影网页 → TMDB",
        "opts": [
          "种子自带 → 豆影网页 → TMDB",
          "豆影网页 → 豆瓣 → TMDB",
          "只用种子自带，没有就用英文"
        ]
      },
      {
        "t": "匹配来源顺序",
        "label": "简介从哪补",
        "type": "select",
        "v": "TMDB → 豆瓣 → 站点标题",
        "opts": [
          "TMDB → 豆瓣 → 站点标题",
          "豆瓣 → TMDB → 站点标题",
          "只用站点标题"
        ]
      },
      {
        "t": "简介图片",
        "label": "简介图片怎么处理",
        "type": "select",
        "v": "转存到图床",
        "opts": [
          "转存到图床",
          "保留外链",
          "不保留图片"
        ],
        "hint": "转存图床最稳；外链会失效"
      },
      {
        "t": "自动附加 MediaInfo",
        "type": "switch",
        "on": true,
        "hint": "开：自动追加；关：不追加",
        "label": "简介末尾附加 MediaInfo"
      },
      {
        "t": "允许联网补简介",
        "type": "switch",
        "on": true,
        "hint": "源站没简介时查豆影/豆瓣/维基",
        "label": "缺简介时联网补"
      },
      {
        "t": "主演最多几个",
        "label": "简介主演数量",
        "type": "text",
        "v": "3"
      }
    ]
  },
  {
    "name": "⑤ 终审与决策",
    "sum": "齐了才发 · 缺了转人工",
    "rows": [
      {
        "t": "必须有简介",
        "type": "switch",
        "on": true,
        "hint": "抓不到中文简介就不自动发",
        "label": "没简介就不发"
      },
      {
        "t": "必须有副标题",
        "type": "switch",
        "on": false,
        "hint": "没副标题就转人工",
        "label": "没副标题就转人工"
      },
      {
        "t": "BDInfo",
        "type": "pick",
        "v": "必须存在且校验通过",
        "opts": [
          "必须存在且校验通过",
          "有就行，不校验",
          "不要求"
        ],
        "label": "BDInfo 校验"
      },
      {
        "t": "截图至少几张",
        "type": "text",
        "v": "0",
        "hint": "0 = 不检查；简介里的截图全部转载",
        "inline": true,
        "label": "截图至少几张"
      },
      {
        "t": "年份必须一致",
        "type": "switch",
        "on": true,
        "label": "年份必须一致"
      }
    ]
  },
  {
    "name": "⑥ 发布（站点要求）",
    "sum": "每个站怎么填",
    "rows": [
      {
        "t": "发布到",
        "type": "custom",
        "same": "tgt",
        "html": "<div class=\"target-pick\"><em class=\"tp-ava\" id=\"tp-ava\"></em><div class=\"tp-info\"><b id=\"tp-name\">—</b><span id=\"tp-host\"></span></div><button class=\"btn ghost slim\" id=\"tp-change\">更换</button></div>",
        "hint": "所有库内资源都归到这个站",
        "label": "发布到哪个站"
      },
      {
        "t": "不满足时",
        "type": "pick",
        "v": "转待确认",
        "opts": [
          "转待确认",
          "直接跳过"
        ],
        "hint": "上面的条件没达标时怎么处理",
        "label": "条件不满足时"
      },
      {
        "t": "自动勾选标签",
        "type": "switch",
        "on": true,
        "hint": "按来源标签勾国语/中字等；禁转/官方不勾",
        "label": "自动勾选标签"
      },
      {
        "t": "默认匿名",
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
        "type": "switch",
        "on": true,
        "hint": "发布后自动去目标站核对；关掉就只提交不回查",
        "label": "发布后回查"
      },
      {
        "t": "发布后抓权威种子",
        "type": "switch",
        "on": true,
        "hint": "发布成功抓目标站种子存 data/torrents",
        "label": "发布后抓目标站种子"
      },
      {
        "t": "上传前清洗 tracker",
        "type": "switch",
        "on": true,
        "hint": "关掉会按源种直传，源站 tracker 会带到目标站",
        "label": "上传前换掉源站 tracker"
      },
      {
        "t": "辅种跳过校验",
        "type": "switch",
        "on": true,
        "hint": "qB skip_checking 复用源种保存路径",
        "label": "辅种不重新校验"
      },
      {
        "t": "qB 自动种子管理",
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
        "type": "text",
        "v": "2 次",
        "inline": true,
        "label": "图片上传重试"
      },
      {
        "t": "连续失败几次暂停该站",
        "type": "text",
        "v": "5",
        "inline": true,
        "todo": true,
        "label": "连续失败几次暂停该站"
      }
    ]
  }
]
};
})();
