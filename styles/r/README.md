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
|---|---|
| roomhilda-red.css | 主题本体，直接挂载 |
| README.md | 本说明 |

## 使用

### Stylus

1. 浏览器安装 Stylus
2. 新建样式，为对应站点添加 URL 匹配规则
3. 粘贴 roomhilda-red.css 全文并保存

### 站点自定义 CSS

`css
@import url("https://raw.githubusercontent.com/DaMauu/SEEDPOD/main/styles/r/broomhilda-red.css");
`

## 设计说明

- 浅色米棕配色，扁平圆角面板，无图片依赖（图标为内嵌 SVG 与字体字形）
- 已处理与站点自带浅色主题的样式冲突：重置选择器优先级、去除重复背景图标
- 字体需联网加载，断网时自动回退系统字体

## 版本

- 直链文件名固定不变，更新只递增版本号，已挂载的引用不会失效
- 版本号见文件头注释与提交记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0.1 | 2026-11-03 | 头部说明整理，README 排版 |
| v1.0.0 | 2026-11-03 | 初版 |
