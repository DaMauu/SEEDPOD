/* 面板的规则表数据：纯数据、无逻辑。改这里不影响渲染代码。 */
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
            "其他"
          ],
          "sel": [],
          "hint": "对应站点搜索的类别，决定列表里会出现什么"
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
          "hint": "锁到站点的 medium / type 字段"
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
          "sel": []
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
        }
      ]
    },
    {
      "name": "抓取标记",
      "sum": "抓回来先打标记，不在这里过滤",
      "rows": [
        {
          "t": "非电影跳过",
          "type": "switch",
          "on": true,
          "hint": "剧集、综艺、动漫、音乐都算非电影"
        },
        {
          "t": "非纯原盘跳过",
          "type": "switch",
          "on": true,
          "hint": "标题里没有原盘特征、或者带 Remux/编码的，一律跳"
        },
        {
          "t": "DIY 跳过",
          "type": "switch",
          "on": true,
          "hint": "只打标记，是否跳过交给第二步筛选"
        },
        {
          "t": "禁转跳过",
          "type": "switch",
          "on": true,
          "hint": "只打标记，是否跳过交给第二步筛选"
        },
        {
          "t": "独占跳过",
          "type": "switch",
          "on": true,
          "hint": "只打标记，是否跳过交给第二步筛选"
        },
        {
          "t": "限转未满 7 天跳过",
          "type": "switch",
          "on": true,
          "hint": "满 7 天的限转放行，并在行上标出来"
        },
        {
          "t": "仅 DIY 时标可发",
          "type": "switch",
          "on": true,
          "hint": "B 站只有 DIY 版时，可以发纯原盘，标「复核」"
        },
        {
          "t": "排除关键词",
          "type": "text",
          "v": "DVDRip, 枪版, TS",
          "hint": "标题命中直接跳"
        },
        {
          "t": "白名单关键词",
          "type": "text",
          "v": "",
          "ph": "只收含这些词的（留空不限）",
          "hint": "只打标记，是否跳过交给第二步筛选"
        }
      ]
    },
    {
      "name": "拉取",
      "sum": "逐页翻 · 断点续抓",
      "rows": [
        {
          "t": "请求间隔",
          "type": "fixed",
          "v": "跟随设置",
          "noTag": true,
          "hint": "只可在「设置 › 抓取节奏」里调，区间 8–120 秒"
        },
        {
          "t": "并发",
          "type": "fixed",
          "v": "1",
          "hint": "固定单线程，程序写死"
        },
        {
          "t": "每轮最多翻页",
          "type": "num",
          "k": "maxPage",
          "range": [
            1,
            20
          ],
          "ph": "1–20"
        },
        {
          "t": "抓取方式",
          "type": "select",
          "v": "增量（只抓新页）",
          "opts": [
            "增量（只抓新页）",
            "全量（扫全部页）",
            "增量 + 定期全量"
          ]
        },
        {
          "t": "断点续抓",
          "type": "switch",
          "on": true,
          "hint": "记到第几页、哪些种子已处理，停了下轮接着来"
        },
        {
          "t": "抓详情页",
          "type": "switch",
          "on": true,
          "hint": "BDInfo、截图、简介都要进详情页"
        },
        {
          "t": "失败重试",
          "type": "fixed",
          "v": "3 次 · 退避 30 秒起"
        },
        {
          "t": "连续失败自动停",
          "type": "fixed",
          "v": "5 次"
        },
        {
          "t": "单站每日最多抓",
          "type": "fixed",
          "v": "跟随设置",
          "noTag": true,
          "hint": "程序按站规再压一次，最多到站规的 1/3"
        },
        {
          "t": "全站每日最多抓",
          "type": "fixed",
          "v": "跟随设置",
          "noTag": true
        }
      ]
    },
    {
      "name": "站点分类映射",
      "sum": "各站分类 → 库内分类",
      "rows": [
        {
          "t": "站点分类",
          "type": "button",
          "v": "配置映射",
          "hint": "把每个站自己的分类（如 Movies/Blu-ray）对到库内类型"
        },
        {
          "t": "映射不到时",
          "type": "select",
          "v": "按标题猜",
          "opts": [
            "按标题猜",
            "跳过不抓",
            "落到其他"
          ]
        }
      ]
    }
  ],
  "dedupe": [
    {
      "name": "筛选条件",
      "sum": "按条件挑出可发的词条",
      "rows": [
        {
          "t": "分辨率要求",
          "type": "select",
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
          "type": "select",
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
          "type": "select",
          "v": "不限",
          "opts": [
            "不限",
            "50 GB",
            "80 GB",
            "120 GB"
          ]
        },
        {
          "t": "地区版本",
          "type": "switch",
          "on": true,
          "hint": "识别出 US/HKG/TWN 这类版本，写进副标题的地区段"
        },
        {
          "t": "必须有简介",
          "type": "switch",
          "on": true,
          "hint": "抓不到中文简介就不自动发"
        },
        {
          "t": "必须带中字",
          "type": "switch",
          "on": true,
          "hint": "成品没有中文字幕就不发"
        },
        {
          "t": "BDInfo",
          "type": "select",
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
          "v": "3",
          "hint": "不够就不自动发"
        },
        {
          "t": "下载完成再发布",
          "type": "switch",
          "on": true,
          "hint": "种子还没下完就发，容易被删"
        },
        {
          "t": "种子完整性校验",
          "type": "switch",
          "on": true,
          "hint": "qB 校验通过才算完成"
        },
        {
          "t": "不满足时",
          "type": "select",
          "v": "转待确认",
          "opts": [
            "转待确认",
            "直接跳过"
          ]
        }
      ]
    },
    {
      "name": "已有与归档",
      "sum": "已有 / 已发 / 跳过 的标记方式",
      "rows": [
        {
          "t": "查本地词库",
          "type": "switch",
          "on": true,
          "hint": "以前查过的结果缓存起来，避免重复请求"
        },
        {
          "t": "词库有效期",
          "type": "select",
          "v": "7 天",
          "opts": [
            "1 天",
            "7 天",
            "30 天",
            "永久"
          ]
        },
        {
          "t": "目标站已有原盘",
          "type": "select",
          "v": "跳过不收",
          "opts": [
            "跳过不收",
            "标重复后仍收"
          ]
        },
        {
          "t": "目标站只有 DIY",
          "type": "select",
          "v": "可发（标复核）",
          "opts": [
            "可发（标复核）",
            "跳过"
          ]
        },
        {
          "t": "请求失败",
          "type": "select",
          "v": "重试 2 次后标失败",
          "opts": [
            "重试 2 次后标失败",
            "直接跳过"
          ]
        }
      ]
    }
  ],
  "pub": [
    {
      "name": "目标站",
      "sum": "发到 目标站 A · 站内图床",
      "rows": [
        {
          "t": "发布到",
          "type": "custom",
          "html": "<div class=\"target-pick\"><em class=\"tp-ava\" id=\"tp-ava\"></em><div class=\"tp-info\"><b id=\"tp-name\">—</b><span id=\"tp-host\"></span></div><button class=\"btn ghost slim\" id=\"tp-change\">更换</button></div>",
          "hint": "所有库内资源都归到这个站"
        },
        {
          "t": "多目标站",
          "type": "switch",
          "on": false,
          "hint": "同一部片同时发到 2–3 个站，需要各站分类都映射好"
        },
        {
          "t": "图床",
          "type": "select",
          "v": "站内图床（浏览器上传）",
          "opts": [
            "站内图床（浏览器上传）",
            "外链图床 API"
          ]
        },
        {
          "t": "截图来源",
          "type": "select",
          "v": "从 BDInfo 自动截取",
          "opts": [
            "从 BDInfo 自动截取",
            "抓目标站官方截图",
            "手动上传"
          ]
        },
        {
          "t": "目标站分类映射",
          "type": "button",
          "v": "配置映射",
          "hint": "把目标站分类对到库内分类，发种时据此选分类"
        },
        {
          "t": "发布后校验",
          "type": "switch",
          "on": true,
          "hint": "发完回站里查一遍，确认真的出现并记下种子 ID"
        }
      ]
    },
    {
      "name": "标题与副标题",
      "sum": "标题在前、副标题在后",
      "rows": [
        {
          "t": "匹配范围",
          "type": "select",
          "v": "",
          "opts": [
            "标题",
            "标题 + 副标题",
            "标题 + 简介首段"
          ],
          "hint": "只读这段文本，不改任何字段"
        },
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
          "t": "写错时",
          "type": "select",
          "v": "",
          "opts": [
            "回退成纯文本匹配",
            "整条跳过等人工"
          ],
          "hint": "语法错、超时、超长都走这条"
        },
        {
          "t": "测试匹配",
          "type": "custom",
          "html": "<div class=\"rx-test\"><input class=\"input\" id=\"rx-sample\" placeholder=\"粘贴一条标题试一下\"><button class=\"btn ghost slim\" id=\"rx-run\" type=\"button\">测试</button><em id=\"rx-out\">未测试</em></div>"
        },
        {
          "t": "发布标题",
          "type": "custom",
          "html": "<span class=\"tpl-fixed\">直接用站点标题，原样发布，不改字</span>",
          "hint": "标题不做模板，源站怎么写就怎么发"
        },
        {
          "t": "中文副标题模板",
          "type": "custom",
          "hint": "用 {电影名} {地区} {导演} {主演1..3} {音轨} {字幕} 这些占位符",
          "html": "<div class=\"tpl-wrap\"><input class=\"input\" id=\"sub-tpl\" placeholder=\"例：{电影名} | {地区}原盘 | 导演:{导演}\"><div class=\"tpl-eg\" id=\"sub-eg\"></div></div>"
        },
        {
          "t": "副标题语言",
          "type": "select",
          "v": "中文",
          "opts": [
            "中文",
            "中英双语",
            "只用英文"
          ]
        }
      ]
    },
    {
      "name": "简介",
      "sum": "简介来源与图片",
      "rows": [
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
          "t": "片名相似度阈值",
          "type": "text",
          "v": "0.85",
          "hint": "低于这个值不猜，直接转人工"
        },
        {
          "t": "年份必须一致",
          "type": "switch",
          "on": true
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
          "t": "简介来源顺序",
          "type": "select",
          "v": "豆影网页 → 豆瓣 → TMDB",
          "opts": [
            "豆影网页 → 豆瓣 → TMDB",
            "豆瓣 → 豆影网页 → TMDB",
            "只用 TMDB（zh-CN）"
          ]
        },
        {
          "t": "TMDB 接口",
          "type": "text",
          "v": "",
          "ph": "填 API Key 才能自动查导演和主演"
        },
        {
          "t": "豆影 API Key",
          "type": "text",
          "v": "",
          "ph": "免费每天 10 次，用完走网页版"
        },
        {
          "t": "豆瓣抓取间隔（秒）",
          "type": "text",
          "v": "3",
          "hint": "太快会出验证码"
        },
        {
          "t": "主演最多几个",
          "type": "text",
          "v": "3"
        },
        {
          "t": "缺字段时",
          "type": "select",
          "v": "省略该段",
          "opts": [
            "省略该段",
            "写「未知」",
            "转待确认"
          ]
        }
      ]
    },
    {
      "name": "发布字段",
      "sum": "发种表单里要填的标签",
      "rows": [
        {
          "t": "制作组",
          "type": "text",
          "v": "",
          "ph": "留空按目标站默认"
        },
        {
          "t": "来源",
          "type": "select",
          "v": "Blu-ray",
          "opts": [
            "Blu-ray",
            "HDTV",
            "WEB-DL",
            "DVD",
            "其他"
          ]
        },
        {
          "t": "媒介",
          "type": "select",
          "v": "Blu-ray",
          "opts": [
            "Blu-ray",
            "Encode",
            "Remux",
            "UHD Blu-ray",
            "DVD",
            "其他"
          ]
        },
        {
          "t": "编码",
          "type": "select",
          "v": "AVC",
          "opts": [
            "AVC",
            "HEVC",
            "VC-1",
            "MPEG-2",
            "其他"
          ]
        },
        {
          "t": "音轨",
          "type": "text",
          "v": "",
          "ph": "留空按源种自动填"
        },
        {
          "t": "字幕类型",
          "type": "select",
          "v": "中文字幕",
          "opts": [
            "中文字幕",
            "中英字幕",
            "英文字幕",
            "无字幕"
          ]
        }
      ]
    },
    {
      "name": "自动发布",
      "sum": "半自动 · 间隔 60 秒 · 每天 20 条",
      "rows": [
        {
          "t": "自动发布总开关",
          "type": "switch",
          "on": true,
          "hint": "关掉只抓不发，全部留给人"
        },
        {
          "t": "发布模式",
          "type": "select",
          "v": "半自动（先转待审核）",
          "opts": [
            "全自动（过了就直接发）",
            "半自动（先转待审核）",
            "仅准备（不碰目标站）"
          ]
        },
        {
          "t": "发布前必须人工点通过",
          "type": "custom",
          "chips": [
            "必须人工点通过",
            "不拦，直接发"
          ],
          "sel": [],
          "single": true,
          "hint": "点一下选中，和搜索预设里的类型按钮一样"
        },
        {
          "t": "两条之间间隔（秒）",
          "type": "text",
          "v": "60",
          "hint": "别把目标站刷爆"
        },
        {
          "t": "每天最多自动发几条",
          "type": "text",
          "v": "20"
        },
        {
          "t": "单站每天最多发几条",
          "type": "text",
          "v": "10"
        }
      ]
    },
    {
      "name": "失败与兜底",
      "sum": "重复转审核 · 限制分发丢弃",
      "rows": [
        {
          "t": "主站已有同片",
          "type": "select",
          "v": "转待审核（标重复）",
          "opts": [
            "转待审核（标重复）",
            "直接丢弃"
          ]
        },
        {
          "t": "站点标限制分发",
          "type": "select",
          "v": "直接丢弃",
          "opts": [
            "直接丢弃",
            "只收录不发布"
          ]
        },
        {
          "t": "图片上传重试",
          "type": "text",
          "v": "2 次"
        },
        {
          "t": "发布失败重试",
          "type": "text",
          "v": "2 次，间隔 5 分钟"
        },
        {
          "t": "连续失败几次暂停该站",
          "type": "text",
          "v": "5"
        },
        {
          "t": "失败时推送通知",
          "type": "switch",
          "on": true
        }
      ]
    },
    {
      "name": "下载条件",
      "sum": "做种 5 起 · 免费优先",
      "rows": [
        {
          "t": "做种数至少",
          "type": "select",
          "v": "5",
          "opts": [
            "不限",
            "1",
            "3",
            "5",
            "10",
            "20"
          ],
          "hint": "做种太少的下到一半就断"
        },
        {
          "t": "免费/优惠",
          "type": "select",
          "v": "免费优先",
          "opts": [
            "不限制",
            "免费优先",
            "只要 FREE",
            "FREE 或 2x"
          ],
          "hint": "免费期再下，省下载量"
        },
        {
          "t": "单站同时下载",
          "type": "text",
          "v": "2",
          "hint": "同一个站并行任务数，别把站刷爆"
        },
        {
          "t": "只在此机器下载",
          "type": "select",
          "v": "自动挑磁盘最多的",
          "opts": [
            "自动挑磁盘最多的",
            "固定 B",
            "固定 C",
            "固定 D",
            "固定 E"
          ]
        }
      ]
    }
  ]
};
})();
