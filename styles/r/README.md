<div align="center">

# Broomhilda Red

**浅色米棕主题 · 单文件 CSS · 无构建无依赖**

<img src="https://img.shields.io/badge/version-1.2.2-8c796a?style=flat-square" />
<img src="https://img.shields.io/badge/format-CSS-2965f1?style=flat-square" />
<img src="https://img.shields.io/badge/dependencies-none-2ea44f?style=flat-square" />

</div>

---

## 文件

| 文件 | 说明 |
| --- | --- |
| `broomhilda-red.css` | 主题本体，直接挂载 |
| `README.md` | 本说明 |

## 挂载

### 正式挂载（版本固定）

```
https://cdn.jsdelivr.net/gh/DaMauu/SEEDPOD@v1.2.2/styles/r/broomhilda-red.css
```

站点设置里的外部样式表字段填这个地址即可全局生效。版本 tag 固定，内容不会变。

### 测试挂载（实时生效，跳过缓存）

```
https://cdn.jsdelivr.net/gh/DaMauu/SEEDPOD@<commit>/styles/r/broomhilda-red.css
```

`<commit>` 换成最新提交短哈希（`git rev-parse --short HEAD`），每次推送后换成新哈希就是全新内容，不受 CDN / 浏览器缓存影响。

### 本地页面测试（免安装扩展）

1. 登录站点任意页面
2. `F12` → Console 执行：

```js
document.head.insertAdjacentHTML('beforeend',
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/DaMauu/SEEDPOD@<commit>/styles/r/broomhilda-red.css">');
```

3. 临时生效，刷新消失，确认无误后再写入站点设置

## 缓存说明

- `raw.githubusercontent.com` 有约 5 分钟 CDN 缓存，浏览器也会缓存
- jsDelivr 的 `@main` 分支快照缓存较久，不要用于测试
- 测试请用 `@<commit>`，正式用 `@vX.Y.Z` tag

## 视图切换（可选）

浏览页的齿轮视图切换需要配合用户脚本 scripts/r/browse-view.user.js（Tampermonkey 新建脚本粘贴安装）。
安装后浏览页 SEARCH 行右侧出现齿轮，可选 Cover / Huge / List / Compact list 四种视图，脚本通过 html[data-rview] 驱动主题样式，选择会记忆在本地。

## 版本

- 文件头注释带版本号，每次改动递增
- 提交后打 tag（`git tag -a vX.Y.Z -m "..."`）并推送，正式挂载地址随之更新
- 旧 tag 与提交历史永久保留，可随时回退

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.2.2 | 2026-11-03 | 封面高度降到 80px；统计区图标与数值垂直对齐 |
| v1.2.1 | 2026-11-03 | 封面置顶，标题/标签/Bookmark 移到封面下方；版本条恢复灰色底块识别 |
| v1.2.0 | 2026-11-03 | 分组改为「文字在上、封面通栏在下」，版本条与版本行不再缩进 |
| v1.1.6 | 2026-11-03 | 封面回到文档流（不再重叠）、版本条恢复底色、标签恢复正常字重、主标题放大、表头图标统一 14px |
| v1.1.5 | 2026-11-03 | 按 PTP 源码数值重做种子列表：封面 160x230、版本条加粗大写、面板底色、标题/版本条/版本行同一左边界 |
| v1.1.3 | 2026-11-03 | 封面绝对定位（等效 rowspan），版本条紧贴标题下方，消除大片空白 |
| v1.1.2 | 2026-11-03 | 删除 FILES 列；去掉版本行左侧底色块；表头 Name 与标题对齐；搜索标签与面板间距加大 |
| v1.1.1 | 2026-11-03 | 搜索行与分页留白；封面左移；版本条/版本行与标题对齐；版本条去底边；齿轮居中 |
| v1.1.0 | 2026-11-03 | 封面去掉白边直接填满；分组左侧栏连成一块，版本条与版本行和标题左对齐 |
| v1.0.9 | 2026-11-03 | 搜索只有标签可点；齿轮改由脚本注入（去掉装饰齿轮） |
| v1.0.8 | 2026-11-03 | 版本条与版本行右移到封面右侧；新增视图切换样式（配合 userscript） |
| v1.0.7 | 2026-11-03 | SEARCH 标签绝对定位到面板外（上方面板底色），收起时面板真正消失 |
| v1.0.6 | 2026-11-03 | 种子行距收紧，DL 组靠近名称，更接近 PTP 行节奏 |
| v1.0.5 | 2026-11-03 | 分组封面 150px 且去掉折叠符号，版本行与封面左对齐、按钮紧跟名称 |
| v1.0.4 | 2026-11-03 | 种子行 [DL | FL | RP] 纯文字、搜索标签移到面板上方、详情文字块去引号 |
| v1.0.3 | 2026-11-03 | 搜索面板改为 PTP 风格 [+] / [-] SEARCH 折叠开关 |
| v1.0.2 | 2026-11-03 | 分页条紧凑化，DL/FL/RP 移到名称右侧 |
| v1.0.1 | 2026-11-03 | 头部说明整理，README 排版 |
| v1.0.0 | 2026-11-03 | 初版 |

















