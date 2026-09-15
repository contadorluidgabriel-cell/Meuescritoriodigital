export async function functionErrorMessage(error, fallback = 'Falha na operação.') {
  const context = error?.context
  if (context) {
    try {
      const response = typeof context.clone === 'function' ? context.clone() : context
      if (typeof response?.json === 'function') {
        const payload = await response.json()
        if (payload?.message) return String(payload.message)
        if (payload?.error_description) return String(payload.error_description)
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim()
      }
    } catch {
      try {
        const response = typeof context.clone === 'function' ? context.clone() : context
        if (typeof response?.text === 'function') {
          const text = String(await response.text()).trim()
          if (text) return text.slice(0, 500)
        }
      } catch {}
    }
  }

  const message = String(error?.message || '').trim()
  if (message && message !== 'Edge Function returned a non-2xx status code') return message
  return fallback
}
