import test from 'node:test'
import assert from 'node:assert/strict'
import { deadlineMatchesScope } from '../src/lib/deadlineUtils.js'
import { entityDisplayName, entityDocument, entityKey, obligationLinkEntityType, splitEntityKey } from '../src/lib/entityUtils.js'
import { normalizeText } from '../src/lib/textUtils.js'

test('normalização textual preserva a comparação usada pelos módulos', () => {
  assert.equal(normalizeText('  Aguardando Cliente  '), 'aguardando cliente')
  assert.equal(normalizeText('Não se aplica'), 'nao se aplica')
  assert.equal(normalizeText('MÉDIA'), 'media')
})

test('filtro de prazo central mantém as mesmas janelas operacionais', () => {
  const day = '2026-09-11'
  assert.equal(deadlineMatchesScope({ due: '2026-09-10', scope: 'overdue', day }), true)
  assert.equal(deadlineMatchesScope({ due: day, scope: 'today', day }), true)
  assert.equal(deadlineMatchesScope({ due: '2026-09-12', scope: 'tomorrow', day }), true)
  assert.equal(deadlineMatchesScope({ due: '2026-09-17', scope: 'week', day }), true)
  assert.equal(deadlineMatchesScope({ due: '2026-10-10', scope: 'month', day }), true)
  assert.equal(deadlineMatchesScope({ due: '', scope: 'waiting', day, waiting: true }), true)
  assert.equal(deadlineMatchesScope({ due: day, scope: 'all', day, completed: true }), false)
})

test('resolução de entidade mantém cliente e CNPJ terceirizado separados', () => {
  const clients = new Map([['c1', { id: 'c1' }]])
  const linked = new Map([['l1', { id: 'l1' }]])
  assert.equal(obligationLinkEntityType({ clienteId: 'c1' }, clients, linked), 'client')
  assert.equal(obligationLinkEntityType({ clienteId: 'l1' }, clients, linked), 'linkedCompany')
  assert.equal(obligationLinkEntityType({ clienteId: 'x', entityType: 'linkedCompany' }, clients, linked), 'linkedCompany')
  assert.equal(obligationLinkEntityType({ clienteId: 'x', entidadeTipo: 'terceirizado' }, clients, linked), 'linkedCompany')
})

test('chave e apresentação de entidade são canônicas', () => {
  assert.equal(entityDisplayName({ razao: 'Empresa A', nome: 'Outro' }), 'Empresa A')
  assert.equal(entityDocument({ cnpj: '123' }), '123')
  assert.equal(entityKey('linkedCompany', 'abc'), 'linkedCompany|abc')
  assert.deepEqual(splitEntityKey('linkedCompany|abc|1'), { entityType: 'linkedCompany', entityId: 'abc|1' })
})
