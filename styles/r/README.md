<div align="center">

# Broomhilda Red

**浅色米棕主题 · 单文件 CSS · 无构建无依赖**

<img src="https://img.shields.io/badge/version-1.0.1-8c796a?style=flat-square" />
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
https://cdn.jsdelivr.net/gh/DaMauu/SEEDPOD@v1.0.1/styles/r/broomhilda-red.css
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

## 版本

- 文件头注释带版本号，每次改动递增
- 提交后打 tag（`git tag -a vX.Y.Z -m "..."`）并推送，正式挂载地址随之更新
- 旧 tag 与提交历史永久保留，可随时回退

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0.1 | 2026-11-03 | 头部说明整理，README 排版 |
| v1.0.0 | 2026-11-03 | 初版 |
