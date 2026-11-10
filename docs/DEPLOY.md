# 部署

一条命令起服务，数据放在 `./data`，升级只换镜像不丢配置。

## Docker Compose（推荐）

```
docker compose up -d --build
```

打开 http://localhost:8080 ，右上角应显示“服务运行中”。

常用：

```
docker compose logs -f          # 看日志
docker compose down             # 停止
docker compose up -d --build    # 改完代码重新构建
```

换端口：`PTA_PORT=9090 docker compose up -d`。

## 单条 docker run

```
docker build -t seedpod/panel:latest .
docker run -d --name seedpod -p 8080:8080 -v "$PWD/data:/data" -e TZ=Asia/Shanghai seedpod/panel:latest
```

## 目录与数据

- 面板静态文件：镜像内 `/app/pta/web`
- 数据目录：容器内 `/data`，映射到宿主机 `./data`
  - `config.json`：运行模式与速率（面板改完直接落盘）
- 镜像不含真实站点清单（`sites-data.local.js` 在 `.dockerignore` 里），容器里跑的是示例站点

## 开发调试（不重建镜像）

服务器上调试时，把源码挂进容器，改完重启即可：

```
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
# 改完代码
docker compose -f docker-compose.yml -f docker-compose.dev.yml restart
```

生产部署只用 `docker-compose.yml`，保证容器内容与镜像一致。

## 只监听本机 / 走隧道访问

镜像默认映射 `8080:8080`（全网可达）。不想暴露时把 compose 里的端口改成 `127.0.0.1:8080:8080`，再通过隧道看：

```
ssh -N -L 8080:127.0.0.1:8080 root@<你的机器>
```

然后本地打开 http://localhost:8080 。

## 挂载权限

bind mount 到 `/data` 时，宿主机目录通常属于 root，容器内的 pta 用户写不进去。镜像自带 entrypoint：以 root 启动时先把 `/data` 归给 pta，再降权运行，所以不用手动 chown。

## 公网访问（反代 + 面板密码）

不要让容器直接把 8080 绑到 0.0.0.0 裸奔，标准做法是只绑内网，再用 nginx 反代：

```
# .env
PTA_BIND=172.17.0.1      # 只给 docker 网桥，宿主外不可达
PTA_USER=admin
PTA_PASS=换成你自己的密码
```

nginx 侧（server 和一个容器同名即可，需把 nginx 加进同一网络）：

```
docker network connect seedpod_default nginx
```

```nginx
server {
    listen 443 ssl;
    server_name pta.example.com;
    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    location / {
        proxy_pass http://seedpod:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

面板自己有 HTTP Basic 认证，nginx 不用再加一层。

## 访问控制

默认只适合本机或内网。要给外部访问，先设令牌：

```
PTA_TOKEN=换成你自己的长串 docker compose up -d
```

设了之后所有 `/api` 请求都要带 `Authorization: Bearer <token>`；`/api/health` 不需要，供探活。

## 备份与升级

- 备份：拷走 `./data` 整个目录即可。
- 升级：`docker compose build --pull && docker compose up -d`，数据不动。

## 健康检查

镜像自带 healthcheck，`docker ps` 看到 `healthy` 表示服务正常；也可以手动：

```
curl -s http://localhost:8080/api/health
```

## 现在能做什么、不能做什么

能：打开面板、读写速率配置（带区间校验）、看日志流、健康检查。
不能：抓取、查重、发布、登录站点——这些还没实现，属于下一步。
