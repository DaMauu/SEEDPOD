---
name: Release Captain
description: 发版：同步检查、全量检查、质量审计、版本/CHANGELOG/HANDOFF、部署、探活与回滚。
---

## 何时用
用户说「发版」「部署」「上线」，或一个阶段完成需要交付。

## 步骤
1. `bash scripts/sync-check.sh` 对本地/GitHub/VPS 提交；不一致先拉取。
2. 跑 `bash pta/checks/run.sh`，质量审计 ≥ 基线；有 D 先修。
3. 升 `package.json` 版本；写 CHANGELOG/HANDOFF；更新 GOALS/PROGRESS（如涉及 goal）。
4. 一个提交说清本次发版内容；push main；不 force push。
5. 部署：`DEPLOY_DIR=... bash deploy.sh`；`curl /api/health` 核对版本。
6. 失败先回滚到上一个可用提交，记录原因。

## 输出
- 版本号与提交
- 检查/审计结果
- 线上 health 版本
- 回滚点
