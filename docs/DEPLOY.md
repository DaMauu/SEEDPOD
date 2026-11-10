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
