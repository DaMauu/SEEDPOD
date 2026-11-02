<div align="center">

# styles

**外挂 CSS 样式集合 · 单文件 · 无构建 · 无依赖**

<img src="https://img.shields.io/badge/styles-1-8c796a?style=flat-square" />
<img src="https://img.shields.io/badge/format-CSS-2965f1?style=flat-square" />

</div>

---

## 目录

| 样式 | 版本 | 文件 | 挂载直链 |
| --- | --- | --- | --- |
| Broomhilda Red | v1.2.9 | [broomhilda-red.css](https://github.com/DaMauu/SEEDPOD/blob/main/styles/r/broomhilda-red.css) | [jsDelivr @v1.2.9](https://cdn.jsdelivr.net/gh/DaMauu/SEEDPOD@v1.2.9/styles/r/broomhilda-red.css) |

## 使用

### 站点外挂挂载

站点设置里的「外部样式表」字段支持填写 CSS 链接，填入上面表格里的挂载直链即可全局生效：

1. 复制「挂载直链」列的地址
2. 打开站点设置，找到外部样式表 / 自定义 CSS 地址字段
3. 粘贴并保存，刷新页面生效

版本 tag 固定，内容不会漂移，更新样式后只需换成新版本 tag 的链接。

### 测试挂载（实时生效）

```
https://cdn.jsdelivr.net/gh/DaMauu/SEEDPOD@<commit>/styles/r/broomhilda-red.css
```

`<commit>` 填最新提交短哈希（`git rev-parse --short HEAD`）。每次推送后换新哈希即可拿到最新内容，不受 CDN 与浏览器缓存影响。

### 本地页面测试（免安装扩展）

1. 登录站点任意页面
2. `F12` → Console 执行：

```js
document.head.insertAdjacentHTML('beforeend',
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/DaMauu/SEEDPOD@<commit>/styles/r/broomhilda-red.css">');
```

3. 临时生效，刷新消失，满意后再写入站点设置

## 缓存说明

| 来源 | 缓存 | 结论 |
| --- | --- | --- |
| jsDelivr `@vX.Y.Z` | 永久（内容不可变） | 正式挂载用 |
| jsDelivr `@<commit>` | 永久（按提交缓存） | 测试用，换哈希即刷新 |
| jsDelivr `@main` | 较久 | 不要用于测试 |
| raw.githubusercontent | 约 5 分钟 | 临时用，注意延迟 |

## 版本规则

- 每份样式一个文件，直链地址固定，版本号写在文件头注释与提交信息里
- 每次改动：递增版本号 → 提交 → 打 tag 并推送
- 旧 tag 与提交永久保留，可随时回退

## 更新记录

| 样式 | 版本 | 日期 | 说明 |
| --- | --- | --- | --- |
| Broomhilda Red | v1.2.9 | 2026-11-03 | 头部说明整理 |
| Broomhilda Red | v1.0.0 | 2026-11-03 | 初版 |
























