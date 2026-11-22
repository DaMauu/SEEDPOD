/* meta.config 的 JSON schema 版本与迁移：只改结构，不删旧值。
   未知字段原样保留；旧配置在启动时升级一次，写回前也会迁移。 */
const SCHEMA_VERSION = 1;
const FLOW_VERSION = 1;
const SCHEDULER_VERSION = 1;
const BOOL_KEYS = ['realCrawl', 'realPublish', 'realImages', 'autoDupe', 'detail', 'testOnly'];
/* 配置默认值只在这维护；路由、抓取、调度都从这里读，不要再各写一份 */
const DEFAULTS = {
  runMode: 'test', listInterval: 10, interval: 60, windowMinutes: 60, maxPerWindow: 20,
  breaker: 3, autoDupe: false, realCrawl: false, realPublish: false, realImages: false,
  detail: true, testOnly: true, retryMax: 2, retryBackoffMin: 15, targetHost: '', concurrency: 1
};

function truthy(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function migrate(raw) {
  const out = Object.assign({}, raw && typeof raw === 'object' ? raw : {});
  const from = Number(out.schemaVersion) || 0;
  if (from > SCHEMA_VERSION) return out;
  if (from < 1) {
    /* v0 → v1：布尔值归一、目标站 host 统一小写；其它字段不动 */
    BOOL_KEYS.forEach(function (k) {
      if (out[k] !== undefined) out[k] = truthy(out[k]);
    });
    if (out.targetHost !== undefined && out.targetHost !== null) {
      out.targetHost = String(out.targetHost).trim().toLowerCase().slice(0, 200);
    }
    out.schemaVersion = 1;
  }
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

function read(ctx) {
  let raw = null;
  try {
    const row = ctx.one("SELECT v FROM meta WHERE k = 'config'");
    raw = JSON.parse(row ? row.v : 'null');
  } catch (e) { raw = null; }
  return migrate(raw);
}
/* 库里的值覆盖默认值；未知字段保留 */
function readWithDefaults(ctx) {
  return Object.assign({}, DEFAULTS, read(ctx));
}
function write(ctx, cfg) {
  const out = migrate(cfg);
  ctx.db.prepare("INSERT INTO meta(k, v) VALUES('config', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
    .run(JSON.stringify(out));
  return out;
}
/* 启动时升级已有配置；没有配置行就不创建，避免改变默认行为 */
function ensure(ctx) {
  try {
    const row = ctx.one("SELECT v FROM meta WHERE k = 'config'");
    if (!row) return null;
    const raw = JSON.parse(row.v || 'null');
    const out = migrate(raw);
    if (JSON.stringify(out) !== JSON.stringify(raw)) {
      ctx.db.prepare("INSERT INTO meta(k, v) VALUES('config', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
        .run(JSON.stringify(out));
    }
    return out;
  } catch (e) { return null; }
}

function migrateFlow(raw) {
  const out = Object.assign({}, raw && typeof raw === 'object' ? raw : {});
  const from = Number(out.schemaVersion) || 0;
  if (from > FLOW_VERSION) return out;
  out.schemaVersion = FLOW_VERSION;
  return out;
}
function migrateScheduler(raw) {
  const out = Object.assign({}, raw && typeof raw === 'object' ? raw : {});
  const from = Number(out.schemaVersion) || 0;
  if (from > SCHEDULER_VERSION) return out;
  out.schemaVersion = SCHEDULER_VERSION;
  return out;
}
function ensureKey(ctx, key, fn) {
  try {
    const row = ctx.one('SELECT v FROM meta WHERE k = ?', key);
    if (!row) return null;
    const raw = JSON.parse(row.v || 'null');
    const out = fn(raw);
    if (JSON.stringify(out) !== JSON.stringify(raw)) {
      ctx.db.prepare("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(key, JSON.stringify(out));
    }
    return out;
  } catch (e) { return null; }
}
function ensureAll(ctx) {
  return {
    config: ensure(ctx),
    flow: ensureKey(ctx, 'flow', migrateFlow),
    scheduler: ensureKey(ctx, 'scheduler', migrateScheduler)
  };
}

module.exports = { DEFAULTS: DEFAULTS, SCHEMA_VERSION, FLOW_VERSION, SCHEDULER_VERSION, migrate, migrateFlow, migrateScheduler, read, readWithDefaults, write, ensure, ensureAll };
