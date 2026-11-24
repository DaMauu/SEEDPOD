# 密钥与轮换

## 现状

- 凭据、下载器密码、通知 token：`secretbox` AES-256-GCM，密文 `v2:<keyId>:<payload>`。
- 旧密文 `v1:` 仍可解；keyId 只用于选 key，不泄露密钥。
- 当前 key：`PTA_SECRET` → `PTA_SECRET_FILE` → `data/.secret`（自动生成，0600）。
- 旧 key：`PTA_SECRET_PREVIOUS`（逗号/空白分隔）或 `data/.secret.previous`（一行一个）。
- 站点包密钥：`PTA_SITE_PACK_KEY`，旧 key 放 `PTA_SITE_PACK_KEY_PREVIOUS`。

## 轮换步骤

1. 生成新 key，写入 `data/.secret`；把旧 key 写进 `data/.secret.previous`，或设环境变量：
   ```bash
   PTA_SECRET_PREVIOUS=<old-key> PTA_DATA=/data node pta/scripts/rotate-secret.js
   ```
2. 先看预览计数，确认 `跳过=0`。
3. 加 `--apply` 写库；脚本会先备份 `seedpod.db`。
4. 重启服务，确认 `/api/health`、凭据可读、下载器可连。
5. 确认没有 `v1` 密文后，再移除旧 key。

## 不做的事

- 不在日志回显明文或 key；凭据列表只回 `hasCookie`，单站详情按用户要求回显时 `Cache-Control: no-store`、不写日志。
- 不自动删除旧 key 文件；移除旧 key 前先跑预览确认 `跳过=0`。
