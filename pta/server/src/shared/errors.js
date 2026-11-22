/* 统一错误码注册表：code、阶段、级别、中文说明、是否可重试。
   先做适配层，不一次替换所有散落字符串；旧码通过 LEGACY 映射到新码。 */
const CODES = {
  PHASE_EXCEPTION: { stage: 'scheduler', level: 'error', message: '调度阶段异常', retryable: true },
  FAILPOINT: { stage: 'scheduler', level: 'warn', message: '测试故障注入', retryable: false },
  UNKNOWN: { stage: 'unknown', level: 'error', message: '未分类错误', retryable: false },
  REAL_CRAWL_DISABLED: { stage: 'crawl', level: 'warn', message: '真抓取未打开', retryable: false },
  REAL_PUBLISH_DISABLED: { stage: 'publish', level: 'warn', message: '真发布未打开', retryable: false },
  REAL_IMAGES_DISABLED: { stage: 'image', level: 'warn', message: '图床实传未打开', retryable: false },
  LOGIN_REQUIRED: { stage: 'target', level: 'error', message: '目标站登录失效', retryable: false },
  NO_COOKIE: { stage: 'target', level: 'error', message: '缺少站点 cookie', retryable: false },
  NO_TARGET_DEF: { stage: 'target', level: 'error', message: '缺少目标站定义', retryable: false },
  TARGET_UNREACHABLE: { stage: 'target', level: 'error', message: '目标站连不上', retryable: true },
  PLAN_FAILED: { stage: 'target', level: 'error', message: '上传计划失败', retryable: false },
  UPLOAD_REJECTED: { stage: 'publish', level: 'error', message: '目标站拒绝上传', retryable: false },
  UPLOAD_UNCONFIRMED: { stage: 'publish', level: 'warn', message: '上传结果不确定', retryable: true },
  UPLOAD_EXCEPTION: { stage: 'publish', level: 'error', message: '上传异常', retryable: true },
  ALREADY_SUBMITTED: { stage: 'publish', level: 'warn', message: '已提交过', retryable: false },
  TARGET_EXISTS: { stage: 'dedupe', level: 'info', message: '目标站已有资源', retryable: false },
  RESTRICTED_SOURCE: { stage: 'publish', level: 'warn', message: '源种禁转/限转', retryable: false },
  BDINFO_REQUIRED: { stage: 'publish', level: 'warn', message: 'BDInfo/MediaInfo 不齐', retryable: false },
  SHOTS_REQUIRED: { stage: 'publish', level: 'warn', message: '截图未全部保留', retryable: false },
  VERIFY_FAILED: { stage: 'publish', level: 'warn', message: '发布后回查未找到', retryable: true },
  TORRENT_UNAVAILABLE: { stage: 'publish', level: 'error', message: '源种不可用', retryable: true },
  SOURCE_CHECK_FAILED: { stage: 'publish', level: 'error', message: '源种检查失败', retryable: true },
  NO_SOURCE_TITLE: { stage: 'review', level: 'warn', message: '拿不到源资源标题', retryable: true },
  IMAGE_MIRROR_FAILED: { stage: 'image', level: 'warn', message: '图片转存失败', retryable: true },
  IMAGE_HOST_UNVERIFIED: { stage: 'image', level: 'error', message: '图床未验证', retryable: false },
  IMAGE_HOST_NOT_CONFIGURED: { stage: 'image', level: 'error', message: '图床未配置', retryable: false },
  IMAGES_MIRROR_FAILED: { stage: 'image', level: 'warn', message: '图片转存全部失败', retryable: true },
  IMAGES_MIRRORED_PARTIAL: { stage: 'image', level: 'warn', message: '部分图片转存失败', retryable: true },
  RETRY_FAILED: { stage: 'retry', level: 'error', message: '重试失败', retryable: true },
  NO_CATEGORY_TYPES: { stage: 'crawl', level: 'warn', message: '站点没保存抓取类型', retryable: false },
  NO_CATEGORY_MATCH: { stage: 'crawl', level: 'warn', message: '类型没匹配到站点分类', retryable: false },
  CLEAN_REQUIRED: { stage: 'publish', level: 'warn', message: '源种需先清洗', retryable: false },
  CLEAN_FAILED: { stage: 'publish', level: 'error', message: '种子清洗失败', retryable: false },
  UPLOAD_IN_PROGRESS: { stage: 'publish', level: 'warn', message: '同目标站正在提交', retryable: true },
  DEDUPE_FAILED: { stage: 'dedupe', level: 'error', message: '查重失败', retryable: true },
  TEST_ITEM_BLOCKED: { stage: 'publish', level: 'warn', message: '测试种子被拦截', retryable: false },
  TEST_ONLY: { stage: 'publish', level: 'warn', message: '测试站模式拦截主站', retryable: false },
  BUSY: { stage: 'crawl', level: 'warn', message: '同站点正在抓取', retryable: true },
  SITE_PACK_UNAVAILABLE: { stage: 'crawl', level: 'error', message: '站点包不可用', retryable: false },
  SOURCE_FETCH_FAILED: { stage: 'publish', level: 'error', message: '源种下载失败', retryable: true },
  NO_SOURCE_URL: { stage: 'publish', level: 'error', message: '没有源种下载地址', retryable: false }
};

/* 旧字符串码/别名 → 新码；没有映射的保持原样，统计时归 UNKNOWN。 */
const LEGACY = {
  CRAWL_FAILED: 'TARGET_UNREACHABLE',
  CRAWL_HTTP_401: 'LOGIN_REQUIRED',
  CRAWL_HTTP_403: 'LOGIN_REQUIRED',
  TARGET_HTTP: 'TARGET_UNREACHABLE',
  NO_ITEM: 'UNKNOWN',
  NOT_FOUND: 'UNKNOWN',
  META_FAILED: 'UNKNOWN',
  UPSTREAM_FAILED: 'TARGET_UNREACHABLE'
};

function normalize(code) {
  const c = String(code || '').trim();
  if (!c) return 'UNKNOWN';
  if (CODES[c]) return c;
  if (LEGACY[c]) return LEGACY[c];
  return 'UNKNOWN';
}
function describe(code) {
  const key = normalize(code);
  const d = CODES[key] || CODES.UNKNOWN;
  return { code: key, legacy: String(code || ''), stage: d.stage, level: d.level, message: d.message, retryable: d.retryable };
}
function retryable(code) { return describe(code).retryable; }

module.exports = { CODES, LEGACY, normalize, describe, retryable };
