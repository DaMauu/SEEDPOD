---
name: DB & Migration
description: 数据库、schema、迁移、事务：先备份/恢复演练，事务短且不包含 HTTP/文件请求。
---

## 何时用
改 schema、索引、迁移、事务、队列/词条/发布表的多步写入。

## 步骤
1. 先备份并按 `pta/docs/BACKUP.md` 恢复到临时目录，验证 `integrity ok`；不通过停手。
2. 只改 `db.js` / `routes-*.js` / `app-fastify.js`；不引入 ORM。
3. 多步写收口到小函数，用 `tx(db, fn)`；事务内不做 HTTP、下载、图床上传。
4. 迁移带版本，旧数据可读；未来版本不降级。
5. 跑 `backup`、`transactions`、相关检查 + 全量。

## 输出
- 备份/恢复证据
- 事务边界与回滚点
- 迁移前后兼容性
