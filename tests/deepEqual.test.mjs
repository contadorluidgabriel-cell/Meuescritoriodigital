import test from 'node:test'
import assert from 'node:assert/strict'
import { deepEqual } from '../src/lib/deepEqual.js'

test('deepEqual ignora a ordem das chaves em objetos aninhados', () => {
  const left = {
    id: 'fin-1',
    status: 'Pendente',
    pagamento: { valor: 400, data: '2026-09-09' },
    parceiros: [{ parceiroId: 'p1', valor: 200 }],
  }
  const right = {
    parceiros: [{ valor: 200, parceiroId: 'p1' }],
    pagamento: { data: '2026-09-09', valor: 400 },
    status: 'Pendente',
    id: 'fin-1',
  }

  assert.equal(deepEqual(left, right), true)
})

test('deepEqual continua detectando alterações reais', () => {
  assert.equal(deepEqual({ valor: 400 }, { valor: 401 }), false)
  assert.equal(deepEqual([1, 2], [2, 1]), false)
})
