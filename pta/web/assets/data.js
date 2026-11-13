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
    }
  ],
  "dedupe": [
    {
      "name": "查重范围",
      "sum": "比什么、比到哪一层",
      "rows": [
        {
          "t": "本地词条",
          "type": "switch",
          "on": true,
          "hint": "已有、已跳过、已发布的词条都算重复"
        },
        {
          "t": "待审核队列",
          "type": "switch",
          "on": true,
          "hint": "队列里还没发的也算，避免同时发两条"
        },
        {
          "t": "目标站搜索",
          "type": "switch",
          "on": false,
          "hint": "开启后手动查重会请求一次目标站，受窗口额度限制"
        },
        {
          "t": "判定强度",
          "type": "select",
          "v": "infohash 优先，其次标题+年份+体积",
          "opts": [
            "infohash 优先，其次标题+年份+体积",
            "只比 infohash",
            "标题相似也提示"
          ]
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
      "name": "有效期与失败",
      "sum": "查过多久算过期",
      "rows": [
        {
          "t": "查重有效期",
          "type": "select",
          "v": "30 天",
          "opts": [
            "7 天",
            "15 天",
            "30 天",
            "90 天"
          ],
          "hint": "超过这个天数就当作没查过，需要重查"
        },
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
      "name": "发布条件",
      "sum": "发到哪 · 满足条件才发",
      "rows": [
        {
          "t": "发到哪",
          "type": "section"
        },
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
          "hint": "还没接：先只支持一个目标站，这个开关先存配置"
        },
        {
          "t": "门槛",
          "type": "section"
        },
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
          "t": "内容要求",
          "type": "section"
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
          "t": "重复与失败",
          "type": "section"
        },
        {
          "t": "主站已有同片",
          "type": "select",
          "v": "直接跳过（标记目标站已有）",
          "opts": [
            "直接跳过（标记目标站已有）",
            "转待审核（标重复）"
          ],
          "hint": "转载时检测到站点有同片，直接跳过，并在库里标记目标站已有"
        },
        {
          "t": "站点标限制分发",
          "type": "select",
          "v": "标记禁转/限转，不发布",
          "opts": [
            "标记禁转/限转，不发布",
            "只收录不发布",
            "直接丢弃"
          ],
          "hint": "站点标了限制分发就记成禁转/限转，不再发"
        },
        {
          "t": "不满足时",
          "type": "select",
          "v": "转待确认",
          "opts": [
            "转待确认",
            "直接跳过"
          ],
          "hint": "上面的条件没达标时怎么处理"
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
        },
      ]
    },
    {
      "name": "目标站",
      "sum": "图床与截图来源",
      "rows": [
        {
          "t": "图床",
          "type": "select",
          "v": "站内图床（浏览器上传）",
          "opts": [
            "站内图床（浏览器上传）",
            "外链图床 API"
          ],
          "hint": "先记录选择，上传到图床还没接"
        },
        {
          "t": "截图来源",
          "type": "select",
          "v": "从 BDInfo 自动截取",
          "opts": [
            "从 BDInfo 自动截取",
            "抓目标站官方截图",
            "手动上传"
          ],
          "hint": "先记录选择，自动截取还没接"
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
          "hint": "还没接：发布后不会自动去目标站核对"
        }
      ]
    },
    {
      "name": "标题与副标题",
      "sum": "正标题照搬 · 副标题按模板 · 正则决定转不转",
      "rows": [
        {
          "t": "种子标题",
          "type": "fixed",
          "v": "原样照搬，不修改"
        },
        {
          "t": "中文副标题模板",
          "type": "custom",
          "hint": "用 {电影名} {地区} {导演} {主演1..3} {音轨} {字幕} 这些占位符",
          "html": "<div class=\"tpl-wrap\"><input class=\"input\" id=\"sub-tpl\" placeholder=\"例：{电影名} | {地区}原盘 | 导演:{导演}\"><div class=\"tpl-eg\" id=\"sub-eg\"></div></div>"
        },
        {
          "t": "副标题语言",
          "type": "fixed",
          "v": "中文"
        },
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
          "html": "<div class=\"rx-test\"><input class=\"input\" id=\"rx-sample\" placeholder=\"粘贴一条标题试一下\"><button class=\"btn ghost slim\" id=\"rx-run\" type=\"button\">测试</button><em id=\"rx-out\">未测试</em></div>"
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
        }
      ]
    }
  ]
};
})();
