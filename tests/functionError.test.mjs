import test from 'node:test'
import assert from 'node:assert/strict'
import { functionErrorMessage } from '../src/lib/functionError.js'

test('usa a mensagem JSON retornada pela Edge Function', async () => {
  const error = {
    message: 'Edge Function returned a non-2xx status code',
    context: new Response(JSON.stringify({ message: 'Desative o usuário antes de excluir a conta definitivamente.' }), {
      status: 409,
      headers: { 'content-type': 'application/json' },
    }),
  }
  assert.equal(
    await functionErrorMessage(error, 'Falha na operação.'),
    'Desative o usuário antes de excluir a conta definitivamente.',
  )
})

test('mantém mensagem útil do cliente quando não há resposta estruturada', async () => {
  const error = { message: 'Network request failed' }
  assert.equal(await functionErrorMessage(error, 'Falha na operação.'), 'Network request failed')
})

test('usa fallback para mensagem genérica sem contexto', async () => {
  const error = { message: 'Edge Function returned a non-2xx status code' }
  assert.equal(await functionErrorMessage(error, 'Falha na operação.'), 'Falha na operação.')
})
