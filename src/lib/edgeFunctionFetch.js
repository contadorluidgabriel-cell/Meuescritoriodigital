import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase.js'

function messageFromBody(body) {
  if (body == null) return ''
  if (typeof body === 'string') {
    const text = body.trim()
    if (!text) return ''
    try { return messageFromBody(JSON.parse(text)) || '' } catch { return text.startsWith('<') ? '' : text }
  }
  if (typeof body === 'object') {
    for (const key of ['message', 'error_description', 'error']) {
      const value = body?.[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return ''
}

function parseBody(text = '') {
  const value = String(text || '').trim()
  if (!value) return null
  try { return JSON.parse(value) } catch { return value }
}

export async function invokeEdgeJson(functionName, {
  body = {},
  token = '',
  fallback = 'Falha ao executar a operação.',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!functionName) throw new Error(fallback)
  if (!token) throw new Error('Sua sessão expirou. Entre novamente.')
  if (typeof fetchImpl !== 'function') throw new Error(fallback)

  let response
  try {
    response = await fetchImpl(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    })
  } catch (error) {
    const message = String(error?.message || '').trim()
    throw new Error(message || fallback)
  }

  const text = await response.text().catch(() => '')
  const data = parseBody(text)
  if (!response.ok) throw new Error(messageFromBody(data) || fallback)
  if (data && typeof data === 'object' && data.error) throw new Error(messageFromBody(data) || fallback)
  return data
}

export { messageFromBody as edgeFunctionMessageFromBody }
