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
      "name": "发布条件",
      "sum": "发到哪 · 满足条件才发",
      "rows": [
        {
          "t": "发布到",
          "type": "custom",
          "same": "tgt",
          "html": "<div class=\"target-pick\"><em class=\"tp-ava\" id=\"tp-ava\"></em><div class=\"tp-info\"><b id=\"tp-name\">—</b><span id=\"tp-host\"></span></div><button class=\"btn ghost slim\" id=\"tp-change\">更换</button></div>",
          "hint": "所有库内资源都归到这个站"
        },
        {
          "t": "门槛",
          "type": "section"
        },
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
          "t": "下载完成再发布",
          "type": "switch",
          "on": true,
          "hint": "种子还没下完就发，容易被删",
          "todo": true
        },
        {
          "t": "内容要求",
          "type": "section"
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
          "t": "地区版本",
          "type": "switch",
          "on": true,
          "hint": "识别出 US/HKG/TWN 这类版本，写进副标题的地区段",
          "todo": true
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
          "t": "重复与失败",
          "type": "section"
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
      ],
      "cls": "cond"
    },
    {
      "name": "标题与副标题",
      "sum": "正标题照搬 · 副标题按模板 · 正则决定转不转",
      "rows": [
        {
          "t": "中文副标题来源",
          "type": "select",
          "v": "种子自带 → 豆影网页 → TMDB",
          "opts": [
            "种子自带 → 豆影网页 → TMDB",
            "豆影网页 → 豆瓣 → TMDB",
            "只用种子自带，没有就用英文"
          ],
          "todo": true
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
          "html": "<div class=\"rx-test\"><input class=\"input\" id=\"rx-sample\" placeholder=\"粘贴一条标题试一下\"><button class=\"btn ghost slim\" id=\"rx-run\" type=\"button\">测试</button><em id=\"rx-out\">未测试</em></div>",
          "wide": true
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
          "t": "截图来源",
          "type": "select",
          "v": "从 BDInfo 自动截取",
          "opts": [
            "从 BDInfo 自动截取",
            "抓目标站官方截图",
            "手动上传"
          ],
          "hint": "先记录选择，自动截取还没接",
          "todo": true
        },
        {
          "t": "片名相似度阈值",
          "type": "text",
          "v": "0.85",
          "hint": "低于这个值不猜，直接转人工",
          "todo": true
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
          ],
          "todo": true
        },
        {
          "t": "主演最多几个",
          "type": "text",
          "v": "3"
        },
        {
          "t": "发布后校验",
          "type": "switch",
          "on": true,
          "hint": "发布后自动去目标站核对；关掉就只提交不回查"
        }
      ]
    },
    {
      "name": "发布字段",
      "sum": "发种表单里要填的标签",
      "rows": [
        {
          "t": "字幕类型",
          "type": "pick",
          "v": "中文字幕",
          "opts": [
            "中文字幕",
            "中英字幕",
            "英文字幕",
            "无字幕"
          ],
          "todo": true
        }
      ]
    },
    {
      "name": "下载条件",
      "sum": "做种 5 起 · 免费优先",
      "rows": [
        {
          "t": "做种数至少",
          "type": "pick",
          "v": "5",
          "opts": [
            "不限",
            "1",
            "3",
            "5",
            "10",
            "20"
          ],
          "hint": "做种太少的下到一半就断",
          "todo": true
        },
        {
          "t": "免费/优惠",
          "type": "pick",
          "v": "免费优先",
          "opts": [
            "不限制",
            "免费优先",
            "只要 FREE",
            "FREE 或 2x"
          ],
          "hint": "免费期再下，省下载量",
          "todo": true
        },
        {
          "t": "单站同时下载",
          "type": "text",
          "v": "2",
          "hint": "同一个站并行任务数，别把站刷爆",
          "inline": true,
          "todo": true
        }
      ]
    }
  ]
};
})();
