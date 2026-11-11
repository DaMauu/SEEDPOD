FROM node:22-alpine

ENV NODE_ENV=production \
    PTA_PORT=8080 \
    PTA_DATA=/data \
    PTA_WEB=/app/pta/web \
    TZ=Asia/Shanghai

WORKDIR /app

COPY package.json ./
COPY pta/server ./pta/server
COPY pta/web ./pta/web
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
CMD ["node", "server/app.js"]
