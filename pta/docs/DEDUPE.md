# 跨站同片策略

## 规则

- 队列和已发布里，按 **infohash** 和 **规范化标题** 各建一张索引。
- 初筛命中同片或同 infohash 时，先到先得：只保留最早的一条，后来者标记 `status=skipped`。
- 跳过的词条写入 `skipReason`、`skippedAt`，同片冲突再写 `dupeOf`（指向保留的 queue/published id），方便追溯，不删数据。
- 同一来源站重复抓取仍按 `site + site_id` 更新原词条，不产生第二条。

## 为什么不做“每站一条”

目标是交叉做种：同一资源只发布一次，多站只作为来源。保留每站一条会让队列重复、重复上传目标站。确实需要多站各发一次时，应先人工拆分标题或 infohash，不靠初筛自动放行。

## 检查

- `pta/checks/screen-type.js`：同 infohash 跨站第二条被跳过，`dupeOf` 指向第一条。
