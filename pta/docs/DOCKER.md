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

## 验证

```bash
curl -s http://127.0.0.1:8080/api/health
# {"ok":true,"data":{"version":"...","db":"sqlite",...}}
```

容器健康检查每 30 秒跑一次；启动失败先看 `docker logs seedpod`。
