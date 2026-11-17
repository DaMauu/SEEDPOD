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
