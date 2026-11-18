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

## Vue 3 规则
- 只用 Composition API + `<script setup>`；不回到 Options API。
- 派生状态用 `computed`，不要用 `watch` 模拟；watcher/事件/定时器在 `onUnmounted` 清理。
- 不直接改 props；要改就 emit 或由父级传新值。
- 复用逻辑放 `composables/`，页面只装配；组件 props/emits 保持稳定。
- 本项目是 JS + Vite，不要求 TypeScript、Nuxt、Pinia、Vitest；不要按那套栈改。

## 禁止
- 不为“顺手好看”改冻结布局或文案。
- 不引入第二套移动端前端。
- 不引入新的 UI 框架或构建工具。
