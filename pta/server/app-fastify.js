/* SEEDPOD 后端 v2：Node + Fastify + SQLite。
   与现有 server/app.js 的接口路径保持一致，逐步把处理器搬过来；搬完再切 systemd。
   本文件先落地健康检查、开发信息、静态文件与 SQLite 健康读数。 */
const path = require('path');
const fs = require('fs');
const Fastify = require('fastify');
const fastifyStatic = require('@fastify/static');
const { openDB, kvGet } = require('./db');

const PORT = Number(process.env.PTA_PORT || 8090);
const DATA_DIR = path.resolve(process.env.PTA_DATA || path.join(__dirname, '..', '..', 'data'));
const WEB_DIR = path.resolve(process.env.PTA_WEB || path.join(__dirname, '..', 'web'));
const VERSION = require('../../package.json').version;
const DEV_DATE = '2026-11-13';

const db = openDB(path.join(DATA_DIR, 'seedpod.db'));

function counts() {
  const one = (t) => {
    try { return db.prepare('SELECT COUNT(*) AS n FROM ' + t).get().n; } catch (e) { return 0; }
  };
  return { catalog: one('catalog'), queue: one('queue'), sites: one('sites'), downloaders: one('downloaders'), credentials: one('credentials') };
}

async function build() {
  const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });

  app.get('/api/health', async () => ({
    ok: true,
    data: { version: VERSION, uptime: Math.round(process.uptime()), db: 'sqlite', counts: counts() }
  }));

  app.get('/api/dev', async () => ({
    ok: true,
    data: {
      version: VERSION, devDate: DEV_DATE, node: process.version,
      stack: { front: 'Vue 3 + 原生 CSS（无构建）', back: 'Node ' + process.version.split('.')[0].replace('v', '') + ' + Fastify 5 + SQLite' },
      counts: counts()
    }
  }));

  app.register(fastifyStatic, { root: WEB_DIR, prefix: '/', wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url.startsWith('/api/')) return reply.code(404).send({ ok: false, error: { code: 'NOT_FOUND', message: '接口不存在：' + req.raw.url } });
    return reply.sendFile('index.html');
  });

  return app;
}

if (require.main === module) {
  build().then((app) => app.listen({ port: PORT, host: '0.0.0.0' }))
    .then(() => console.log('SEEDPOD v2 (fastify+sqlite) on :' + PORT))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { build, db, counts, DATA_DIR, WEB_DIR, VERSION };
