# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY pta/web-src ./pta/web-src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    PTA_PORT=8080 \
    PTA_DATA=/data \
    PTA_WEB=/app/pta/web/dist \
    TZ=Asia/Shanghai
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY pta/server ./pta/server
COPY --from=build /app/pta/web/dist ./pta/web/dist
COPY CHANGELOG.md /CHANGELOG.md
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN apk add --no-cache su-exec \
 && chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data \
 && addgroup -S pta && adduser -S pta -G pta \
 && chown -R pta:pta /data /app
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PTA_PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "pta/server/app-fastify.js"]
