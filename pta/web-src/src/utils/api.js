export async function getJson(url, opts) {
  try {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}))
    return await r.json()
  } catch (e) { return null }
}

export async function patchUser(body) {
  return getJson('/api/config/user', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
}
export async function putFlow(sets, rxBody) {
  const body = { sets }
  if (rxBody) body.rx = rxBody
  return getJson('/api/flow', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  })
}

/* 统一 API 客户端：同源、JSON、错误码到文案只在这里映射。
   页面不再各自拼 fetch，也不直接猜 error 形状。 */
const CODE_TEXT = {
  UPLOAD_IN_PROGRESS: '这个目标站正在提交，等这次结束',
  CLEAN_REQUIRED: '源种带 passkey，必须先清洗再提交',
  ALREADY_SUBMITTED: '这个条目已经提交过，不能重复操作',
  REAL_PUBLISH_DISABLED: '真发布还没打开',
  REAL_CRAWL_DISABLED: '真抓取还没打开',
  TEST_ITEM_BLOCKED: '测试种子不能提交到主站',
  TEST_ONLY: '测试站模式：主站被拦住了',
  TARGET_EXISTS: '目标站已有这条资源',
  UNAUTHORIZED: '登录已失效，请重新登录',
  NOT_FOUND: '条目不存在',
  BAD_STATE: '当前状态不允许这个操作'
}

export function errorText(body, fallback) {
  const err = body && body.error
  if (err && err.code && CODE_TEXT[err.code]) return CODE_TEXT[err.code]
  if (err && err.message) return err.message
  if (body && body.message) return body.message
  return fallback || '请求失败'
}

export async function apiJson(path, opts) {
  const o = Object.assign({ credentials: 'same-origin' }, opts || {})
  if (o.body !== undefined && typeof o.body !== 'string') {
    o.headers = Object.assign({ 'content-type': 'application/json' }, o.headers || {})
    o.body = JSON.stringify(o.body)
  }
  const r = await fetch(path, o)
  const body = await r.json().catch(() => null)
  return { status: r.status, body: body, ok: !!(body && body.ok) }
}

export function qs(params) {
  const u = new URLSearchParams()
  Object.keys(params || {}).forEach(function (k) {
    const v = params[k]
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v))
  })
  return u.toString()
}
