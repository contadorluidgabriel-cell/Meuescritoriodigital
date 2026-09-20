import test from 'node:test'
import assert from 'node:assert/strict'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../src/lib/supabase.js'

// Teste real do endpoint publicado, sem credenciais nem mutações no banco.
// A API deve rejeitar tanto requisições anônimas quanto tokens inválidos.
const endpoint = `${SUPABASE_URL}/functions/v1/office-client-delete`
const payload = JSON.stringify({ workspace_id: '00000000-0000-0000-0000-000000000000', client_id: 'cli_teste_inexistente', confirmation: 'EXCLUIR' })

test('endpoint publicado rejeita requisição anônima sem alterar cadastros', { timeout: 20000 }, async () => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: payload,
    signal: AbortSignal.timeout(15000),
  })
  assert.equal(response.status, 401, `Falha no bloqueio anônimo: HTTP ${response.status}; ${await response.text()}`)
})

test('endpoint publicado rejeita bearer inválido sem alterar cadastros', { timeout: 20000 }, async () => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer invalid-smoke-test-token', 'Content-Type': 'application/json' },
    body: payload,
    signal: AbortSignal.timeout(15000),
  })
  assert.equal(response.status, 401, `Falha no bloqueio de token inválido: HTTP ${response.status}; ${await response.text()}`)
})
