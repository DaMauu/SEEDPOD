# Docker 部署

两阶段镜像：构建阶段装依赖并跑 `npm run build`；运行阶段只带 `dist`、`server` 和生产依赖。

## 构建

```bash
docker build -t seedpod/panel:latest .
```

## 单容器

```bash
mkdir -p data
docker run -d --name seedpod \
  -p 127.0.0.1:8080:8080 \
  -v "$PWD/data:/data" \
  -e PTA_USER=admin -e PTA_PASS='换成你的密码' \
  --restart unless-stopped \
  seedpod/panel:latest
```

## compose

```bash
cat > .env <<'EOF'
PTA_USER=admin
PTA_PASS=换成你的密码
EOF
docker compose up -d --build
```

默认只绑定 `127.0.0.1`；要对外再设 `PTA_BIND=0.0.0.0`，前面务必有 HTTPS 反代。

## 数据与密钥

- 数据卷 `/data`：SQLite、cookie 密文、日志、站点定义。
- 密钥默认 `data/.secret`；想分离就挂一个只读文件并设 `PTA_SECRET_FILE=/run/secrets/seedpod`：
  ```yaml
  volumes:
    - ./secrets/seedpod.secret:/run/secrets/seedpod:ro
  environment:
    PTA_SECRET_FILE: /run/secrets/seedpod
  ```
- HTTPS 访问时设 `PTA_COOKIE_SECURE=1`。
- 简介图片转存（可选）：设 `PTA_IMAGE_HOST_URL`（multipart 上传接口），可选 `PTA_IMAGE_HOST_FIELD`（默认 `file`）、`PTA_IMAGE_HOST_TOKEN`（Bearer）。再在面板里打开 `realImages`；不配就保留源站外链。
- 外部触发（可选）：设 `PTA_HOOK_TOKEN`，然后
  ```bash
  curl -s -X POST http://127.0.0.1:8080/api/hooks/run \
    -H "x-hook-token: $PTA_HOOK_TOKEN" -H 'content-type: application/json' \
    -d '{"steps":["crawl","screen","dedupe","review"]}'
  ```
  不设这个变量时接口返回 404，等于关闭。

## 验证

```bash
curl -s http://127.0.0.1:8080/api/health
# {"ok":true,"data":{"version":"...","db":"sqlite",...}}
```

容器健康检查每 30 秒跑一次；启动失败先看 `docker logs seedpod`。

## 备份与恢复

备份文件含 SQLite、`.secret` 和私有站点定义，属于敏感文件，默认权限 0600；不要放公开目录。

```bash
# 备份（可先 docker compose stop，热备也安全）
bash pta/scripts/backup.sh ./data ./seedpod-backup-$(date +%Y%m%d-%H%M%S).tar.gz

# 恢复：先停容器；目标已有 seedpod.db 时默认拒绝，确认覆盖加 FORCE=1
docker compose stop
FORCE=1 bash pta/scripts/restore.sh ./seedpod-backup-YYYYmmdd-HHMMSS.tar.gz ./data
docker compose up -d
curl -s http://127.0.0.1:8080/api/health
```

- 备份包含 `seedpod.db`、`.secret`、`site-defs/`、`site-pack.json`、`library.json` 等；不包含日志和旧备份。
- SQLite 用 `VACUUM INTO` 做一致性快照，避免 WAL 未合并导致丢数据；没有 `node:sqlite` 时回退 `db + WAL + SHM` 一起备份。
- 恢复会先清掉旧 `seedpod.db-wal` / `seedpod.db-shm`，避免新旧状态拼在一起。
- 如果用了外部 `PTA_SECRET_FILE`，那份密钥要单独备份。

### 备份恢复演练（2026-11-18 · v0.7.185）

- `docker build` 成功；`docker compose up -d` 后 `/api/health` 返回 `ok:true`。
- 容器内创建一条队列记录，重启容器后记录仍在。
- `backup.sh` 生成 0600 备份，tar 内只有 `./seedpod.db` 和 `./.secret`（没有日志/WAL）。
- `restore.sh` 恢复到新数据目录，`docker compose up` 后 health 正常，队列记录仍在。

## Telegram 通知

两种方式，环境变量优先：

1. **面板**：设置 → 通知，填 Bot Token 和 Chat ID，保存后点「发送测试」。token 用 AES-GCM 存 `/data/seedpod.db`，接口只回是否配置，不回显 token。
2. **compose `.env`**：

```bash
TELEGRAM_BOT_TOKEN=123456:replace-me
TELEGRAM_ALLOWED_USER_ID=123456789
docker compose up -d
```

环境变量会覆盖面板配置；`.env` 已 gitignore，不要提交。通用 webhook 可用 `PTA_NOTIFY_WEBHOOK=https://...`，POST `{event,text,at}`。
