---
name: Site Adaptation
description: 站点包、适配器、抓取/上传规则：不碰真实站，不写站名/网址，cookie 只存密文，先干跑和夹具。
---

## 何时用
涉及 `pta/server/adapters/*`、`site-pack`、站点定义、抓取/上传字段、站点探测。

## 步骤
1. 读 `pta/docs/SITE-PACK.md`、`UPSTREAM.md`、`ADAPTERS.md`。
2. 只用夹具/本地 mock；真实站需要用户明确授权，且只读、限速、单次。
3. 站点差异放站点包/私有 `data/site-defs`，引擎逻辑进代码；不把站点配置写死进适配器。
4. 先 dry-run/plan，再验证错误码和字段；不重复提交、不直传源种。
5. 回复和日志不写站名、网址、cookie、passkey。

## 已知边界
- `NO_FORM` 可能是账号等级不足或站点只走候选流程，不一定是解析器问题。
- cookie 解不开先查密钥环境，不要重新导入覆盖。
