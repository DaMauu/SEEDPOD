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
    "name": "转不转",
    "sum": "标题正则决定收不收",
    "rows": [
      {
        "t": "排除匹配",
        "type": "custom",
        "html": "<input class=\"input\" id=\"rx-deny\" placeholder=\"命中就不转载，例：DVDRip|枪版|CAM\">",
        "hint": "支持正则，限 200 字；只决定转不转，不影响请求"
      },
      {
        "t": "白名单匹配",
        "type": "custom",
        "html": "<input class=\"input\" id=\"rx-allow\" placeholder=\"留空不限，命中才转载\">",
        "hint": "和排除同时命中时，排除优先"
      },
      {
        "t": "测试匹配",
        "type": "custom",
        "html": "<div class=\"rx-test\"><input class=\"input\" id=\"rx-sample\" placeholder=\"粘贴一条标题试一下\"><button class=\"btn ghost slim\" id=\"rx-run\" type=\"button\">测试</button><em id=\"rx-out\">未测试</em></div>",
        "wide": true
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
        "hint": "关闭后手动查重不请求目标站"
      },
      {
        "t": "体积容差",
        "type": "text",
        "v": "2",
        "hint": "体积差在这个百分比内算同一条"
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
        "todo": true
      },
      {
        "t": "目标站只有 DIY",
        "type": "select",
        "v": "可发（标复核）",
        "opts": [
          "可发（标复核）",
          "跳过"
        ],
        "todo": true
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
        "type": "select",
        "v": "转存到图床",
        "opts": [
          "转存到图床",
          "保留外链",
          "不保留图片"
        ],
        "hint": "外链会失效，转存最稳"
      },
      {
        "t": "自动附加 MediaInfo",
        "type": "switch",
        "on": true,
        "hint": "简介末尾自动追加 MediaInfo/BDInfo"
      },
      {
        "t": "允许联网补简介",
        "type": "switch",
        "on": true,
        "hint": "详情页没简介时查豆影/豆瓣/维基"
      },
      {
        "t": "主演最多几个",
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
        "t": "分辨率要求",
        "type": "pick",
        "v": "1080p 及以上",
        "opts": [
          "不限",
          "1080p 及以上",
          "2160p 及以上"
        ],
        "hint": "抓的时候全抓，发之前按这个卡"
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
        ]
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
        ]
      },
      {
        "t": "必须带中字",
        "type": "switch",
        "on": true,
        "hint": "成品没有中文字幕就不发"
      },
      {
        "t": "必须有简介",
        "type": "switch",
        "on": true,
        "hint": "抓不到中文简介就不自动发"
      },
      {
        "t": "BDInfo",
        "type": "pick",
        "v": "必须存在且校验通过",
        "opts": [
          "必须存在且校验通过",
          "有就行，不校验",
          "不要求"
        ]
      },
      {
        "t": "截图至少几张",
        "type": "text",
        "v": "0",
        "hint": "0 = 不检查；简介里的截图全部转载",
        "inline": true
      },
      {
        "t": "年份必须一致",
        "type": "switch",
        "on": true
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
        "hint": "所有库内资源都归到这个站"
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
        "todo": true
      },
      {
        "t": "自动勾选标签",
        "type": "switch",
        "on": true,
        "hint": "按来源标签勾国语/中字等；禁转/官方不勾"
      },
      {
        "t": "默认匿名",
        "type": "switch",
        "on": false,
        "hint": "新条目没单独设置时按这个发"
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
        "hint": "发布后自动去目标站核对；关掉就只提交不回查"
      },
      {
        "t": "发布后抓权威种子",
        "type": "switch",
        "on": true,
        "hint": "发布成功抓目标站种子存 data/torrents"
      },
      {
        "t": "上传前清洗 tracker",
        "type": "switch",
        "on": true,
        "hint": "关掉会按源种直传，源站 tracker 会带到目标站"
      },
      {
        "t": "辅种跳过校验",
        "type": "switch",
        "on": true,
        "hint": "qB skip_checking 复用源种保存路径"
      },
      {
        "t": "qB 自动种子管理",
        "type": "switch",
        "on": false,
        "hint": "关掉=autoTMM false，不自动移动文件"
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
        "inline": true
      },
      {
        "t": "连续失败几次暂停该站",
        "type": "text",
        "v": "5",
        "inline": true,
        "todo": true
      }
    ]
  }
]
};
})();
