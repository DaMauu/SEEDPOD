# 流程页 UI 快照

开发验收工具，不碰真实站、不碰生产数据。

## 用法

```bash
node pta/scripts/ui-snapshot.js --out /tmp/ui-before
node pta/scripts/ui-snapshot.js --out /tmp/ui-after
node pta/scripts/ui-snapshot.js --compare /tmp/ui-before /tmp/ui-after
```

## 固定条件

- 临时 SQLite + 固定演示站点/下载器/配置，不读生产库
- 1280x900、390x844
- 截整页 `#crawl`、`.crawl-card`、`.screen-card`、`.pub-card`、下载器卡、目标站弹窗
- 隐藏 `.dock`、`.dev-foot`，禁用动画/过渡
- 截图和 diff 只写 `/tmp`，不入库

## 通过标准

1. 所有截图 RMSE ≤ 0.002，且过 AE 闸门：组件截图先去掉 4px 边框（圆角/阴影），`compare -metric AE -fuzz 2%` 必须为 0；整页 AE ≤100。
2. DOM 文本、按钮文字、输入值、开关状态完全一致。
3. 元素布局尺寸（元素 x/y/w/h）完全一致。
4. 390 宽度下 `#crawl-panel` 内不能有元素超出视口；有溢出直接失败。

改完确认通过后才允许 `node pta/scripts/ui-freeze.js --update`。

## 同进程双构建实验（2026-11-19）

新增 `ui-snapshot-dual.js`：两个后端 + 两个 dist + 同一个 Chromium，排除跨进程字体缓存差异。

相同 dist 实测（两套后端数据完全一致）：

- 1280/full AE=34979、1280/pub-card AE=403、1280/screen-card AE=138
- 390/full AE=5459、390/pub-card AE=41、390/screen-card AE=51
- 2% 阈值下大部分区域为空，差异是亚像素抗锯齿噪声

结论：即使同一浏览器进程、相同构建，原始 `compare -metric AE` 仍不为 0，属于 Chromium 字体/合成噪声，不是布局或颜色变化。当前闸门保留 2% fuzz（组件 0、整页 ≤100）；如需原始 AE=0，需要用户明确接受更宽的容差或改用忽略区域/SSIM。

**用户确认（2026-11-19）**：接受 2% fuzz 闸门（组件 AE=0、整页 AE≤100，附 RMSE 与 DOM 检查）；原始 AE=0 不作为验收条件。
