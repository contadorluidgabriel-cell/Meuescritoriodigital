import test from 'node:test'
import assert from 'node:assert/strict'
import { invokeEdgeJson } from '../src/lib/edgeFunctionFetch.js'

test('preserva mensagem JSON em resposta HTTP 409', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    error: 'disable_first',
    message: 'Desative o usuário antes de excluir a conta definitivamente.',
  }), { status: 409, headers: { 'content-type': 'application/json' } })

  await assert.rejects(
    () => invokeEdgeJson('office-user-admin', {
      body: { action: 'delete_user' },
      token: 'teste',
      fallback: 'Falha ao excluir o usuário.',
      fetchImpl,
    }),
    /Desative o usuário antes de excluir a conta definitivamente\./,
  )
})

test('preserva mensagem de erro mesmo quando o corpo vem como JSON textual', async () => {
  const fetchImpl = async () => new Response('{"message":"Responsabilidades pendentes."}', { status: 409 })
  await assert.rejects(
    () => invokeEdgeJson('office-user-admin', { token: 'teste', fetchImpl }),
    /Responsabilidades pendentes\./,
  )
})

test('retorna JSON normalmente em resposta 2xx', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ ok: true, value: 7 }), { status: 200 })
  assert.deepEqual(
    await invokeEdgeJson('office-workspace-web', { token: 'teste', fetchImpl }),
    { ok: true, value: 7 },
  )
})

test('usa fallback quando a resposta de erro não possui mensagem útil', async () => {
  const fetchImpl = async () => new Response('', { status: 500 })
  await assert.rejects(
    () => invokeEdgeJson('office-user-admin', { token: 'teste', fallback: 'Falha segura.', fetchImpl }),
    /Falha segura\./,
  )
})
