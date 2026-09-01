const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const response = (body: BodyInit | null, status = 200, headers: Record<string, string> = {}) => new Response(body, {
  status,
  headers: { ...corsHeaders, ...headers },
})

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return response(null, 204)
  if (req.method !== 'POST') return response(JSON.stringify({ error: 'method_not_allowed' }), 405, { 'content-type': 'application/json; charset=utf-8' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  if (!supabaseUrl) return response(JSON.stringify({ error: 'server_not_configured' }), 500, { 'content-type': 'application/json; charset=utf-8' })

  const authorization = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  if (!authorization) return response(JSON.stringify({ error: 'unauthorized', message: 'Sessão inválida.' }), 401, { 'content-type': 'application/json; charset=utf-8' })

  let body = '{}'
  try { body = await req.text() } catch {}

  try {
    const upstream = await fetch(`${supabaseUrl}/functions/v1/office-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      body: body || '{}',
    })
    const text = await upstream.text()
    return response(text, upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    })
  } catch (error) {
    console.error('office-workspace-web upstream failed', (error as Error)?.message || String(error))
    return response(JSON.stringify({ error: 'workspace_unavailable', message: 'Não foi possível acessar o escritório agora.' }), 502, { 'content-type': 'application/json; charset=utf-8' })
  }
})
