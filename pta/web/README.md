# PT 转载台 · 静态原型

先看界面，不接后端。全部是假数据，双击 `index.html` 即可。

## 页面

- `index.html` 总览：数据 / 站点 / 发布三块，加日志
- `sites.html` 站点：300 个站，搜索/按架构与登录筛、批量启停、分享率与 2FA 状态
- `queue.html` 待发队列：筛选、勾选、预览/通过/驳回
- `sources.html` 收录：源站抓到的条目、查重结果、转种入口
- `nodes.html` 节点：A 控制 + B~F 下载/做种，磁盘与 qB 状态
- `logs.html` 日志：按级别过滤
- `settings.html` 设置：站点账号、限速、图床与发布、通知

## 图标

- `assets/whale.png`：侧栏 logo，60 帧 APNG（50ms/帧），蓝色重上色版，取自本机 DSH 客户端的动态鲸鱼素材，仅自用。
- `assets/icon.png` / `favicon.ico` / `favicon-32.png` / `favicon-16.png`：静态第一帧生成的标签页图标（浏览器不播放 favicon 动画）。
- 对外发布前应替换成自制图标。

## 约定

- 无构建、无依赖、无网络请求，纯 HTML/CSS/JS。
- 数据集中在 `assets/app.js` 顶部的 `MOCK`，改数据不用动页面。
- 交互只弹提示，不落库；下一阶段换成 FastAPI + Jinja2，页面结构可以直接搬。
- 站点名用「源站 A / 目标站 B」，避免在仓库里写真实站名。

## 下一步

1. 确认布局和信息密度。
2. 抽成 Jinja2 模板（sidebar 用 include）。
3. 接 SQLite，先把队列和收录两页换成真数据。
