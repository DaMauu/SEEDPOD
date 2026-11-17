---
name: UI Guard
description: 改 UI 或拆页面组件：先线框、再快照 1280/390，AE 闸门和 DOM 一致后才更新基线；不改冻结布局。
---

## 何时用
用户明确要求改界面、拆页面组件、调整响应式；或改动涉及 `pta/web-src`。

## 步骤
1. 读 `pta/docs/DESIGN.md`、`RESPONSIVE.md`、`UI-SNAPSHOT.md`；确认是否在 UI 冻结范围。
2. 先线框/截图确认，再改 SFC；只动被要求的区域。
3. 改前拍快照：`node pta/scripts/ui-snapshot.js --out /tmp/ui-before`；改后对比。
4. 通过标准：RMSE ≤0.002 + AE 闸门 + DOM 文本/按钮/输入/开关/尺寸一致。
5. 通过后才 `node pta/scripts/ui-freeze.js --update`；不通过先修，不更新基线。
6. 桌面/手机共用一套代码；验收 360/390/768/1280。

## 禁止
- 不为“顺手好看”改冻结布局或文案。
- 不引入第二套移动端前端。
