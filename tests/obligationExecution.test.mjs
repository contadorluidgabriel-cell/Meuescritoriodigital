import test from 'node:test'
import assert from 'node:assert/strict'
import { completeObligationLink } from '../src/lib/obligationExecution.js'

test('conclui somente o CNPJ solicitado e registra a data', () => {
  const source = [{
    id: 'reinf-07',
    clientes: [
      { clienteId: 'a', status: 'Pendente', recibo: '' },
      { clienteId: 'b', status: 'Pendente', recibo: '123' },
    ],
  }]

  const result = completeObligationLink(source, 'reinf-07', 'a', '2026-09-13')
  assert.equal(result.changed, true)
  assert.equal(result.obligations[0].clientes[0].status, 'Concluída')
  assert.equal(result.obligations[0].clientes[0].concluidoEm, '2026-09-13')
  assert.equal(result.obligations[0].clientes[1].status, 'Pendente')
  assert.equal(source[0].clientes[0].status, 'Pendente')
})

test('não altera vínculo já concluído', () => {
  const source = [{ id: 'reinf-07', clientes: [{ clienteId: 'a', status: 'Concluída', concluidoEm: '2026-09-12' }] }]
  const result = completeObligationLink(source, 'reinf-07', 'a', '2026-09-13')
  assert.equal(result.changed, false)
  assert.match(result.error, /já foi concluído|não está mais pendente/i)
  assert.deepEqual(result.obligations, source)
})
