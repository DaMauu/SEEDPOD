# 审计回归样例落点

来源：`/tmp/pta-code-audit/regression-samples.json`（50 轮审计）。12 个样例都已落到 `pta/checks`，不需要再手工复现。

| 样例 id | 检查文件 | 断言 |
| --- | --- | --- |
| prepare-stage-guard | `prepare-guard.js` | submitted 不能 prepare；failed 保留错误/attempts |
| publish-captured-id | `publish-id-capture.js` | 发布/整理/操作在 await 前捕获 id |
| types-migration | `crawl-detail.js` | 没有 types 返回 `NO_CATEGORY_TYPES`，不发抓取请求 |
| numeric-source-cat | `target.js` | 数字源分类不直通目标站 catId |
| announce-passkey | `target.js` | passkey 候选优先于 generic |
| screen-type-gate | `screen-type.js` | 413 在电影类型下被跳过 |
| source-url-same-host | `target.js` | 来源种子只允许同站/子域 |
| manual-scheduler-lock | `target.js` | 同 queue+host 并发只放行一个 |
| clean-disabled-reject | `target.js` | 关清洗时源种 passkey 直接拒绝 |
| retry-count-pure | `prepare-guard.js` | prepare 不增加 stageAttempts |
| api-response-shape | `api-v2.js` | 队列/词条/下载器/错误结构断言 |
| 发布切条目 | `publish-id-capture.js` | 切条目后请求仍用旧 id |

运行：

```bash
bash pta/checks/run.sh
# 或单个
node pta/checks/prepare-guard.js
node pta/checks/publish-id-capture.js
```

新增同类问题时，先在这里登记样例 id，再补对应检查文件；不要把回归只写在聊天记录里。
