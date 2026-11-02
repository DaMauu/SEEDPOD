<div align="center">

# styles

**外挂 CSS 样式集合 · 单文件 · 无构建 · 无依赖**

<img src="https://img.shields.io/badge/styles-1-8c796a?style=flat-square" />
<img src="https://img.shields.io/badge/format-CSS-2965f1?style=flat-square" />

</div>

---

## 目录

| 样式 | 版本 | 文件 | 直链 |
| --- | --- | --- | --- |
| Broomhilda Red | v1.0.1 | [broomhilda-red.css](https://github.com/DaMauu/SEEDPOD/blob/main/styles/r/broomhilda-red.css) | [raw](https://raw.githubusercontent.com/DaMauu/SEEDPOD/main/styles/r/broomhilda-red.css) |

> 「直链」是原始文件地址，用于外挂引用；「文件」是 GitHub 上的可读版本。

## 使用

### 站点外挂挂载

站点设置里的「外部样式表」字段支持填写 CSS 链接，填入对应样式的直链即可全局生效：

1. 复制上表的直链
2. 打开站点设置，找到外部样式表 / 自定义 CSS 地址字段
3. 粘贴直链并保存，刷新页面生效

直链文件名固定不变，样式更新后无需重新配置。

### 本地测试（免安装任何扩展）

1. 登录站点并打开任意页面
2. `F12` → Console，执行：

```js
document.head.insertAdjacentHTML('beforeend',
  '<link rel="stylesheet" href="https://raw.githubusercontent.com/DaMauu/SEEDPOD/main/styles/r/broomhilda-red.css">');
```

3. 样式只在当前页面临时生效，刷新后消失。满意后再写入站点设置。

也可以在 `F12` → Elements 中手动在 `<head>` 末尾插入 `<link>` 标签，效果相同。

## 目录结构

```
styles/
└── r/
    ├── broomhilda-red.css   # 主题本体
    └── README.md            # 该样式的单独说明
```

## 版本规则

- 每份样式一个文件，直链地址固定，版本号写在文件头注释与提交信息里
- 改动递增版本号，已挂载的直链不会失效
- 需要找回旧版时从提交历史取

## 更新记录

| 样式 | 版本 | 日期 | 说明 |
| --- | --- | --- | --- |
| Broomhilda Red | v1.0.1 | 2026-11-03 | 头部说明整理 |
| Broomhilda Red | v1.0.0 | 2026-11-03 | 初版 |
