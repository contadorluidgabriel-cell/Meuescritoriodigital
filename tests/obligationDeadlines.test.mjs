import test from 'node:test'
import assert from 'node:assert/strict'
import { buildObligationDeadlineView, flattenObligationDeadlines, obligationLinkMatchesDeadline } from '../src/lib/obligationDeadlines.js'

const day = '2026-09-10'
const obligations = [
  {
    id: 'o1', nome: 'PGDAS 08/2026', tipo: 'PGDAS', competencia: '2026-08', categoria: 'Fiscal',
    clientes: [
      { clienteId: 'c1', vencimento: '2026-09-09', status: 'Pendente' },
      { clienteId: 'c2', vencimento: '2026-09-10', status: 'Em andamento' },
      { clienteId: 'c3', vencimento: '2026-09-11', status: 'Aguardando cliente' },
      { clienteId: 'c4', vencimento: '', status: 'Aguardando cliente' },
      { clienteId: 'c5', vencimento: '2026-09-12', status: 'Concluída' },
      { clienteId: 'c6', vencimento: '2026-09-12', status: 'Não se aplica' },
    ],
  },
  {
    id: 'o2', nome: 'Folha', tipo: 'eSocial', competencia: '2026-09', categoria: 'DP',
    clientes: [
      { clienteId: 'c1', vencimento: '2026-09-16', status: 'Pendente' },
      { clienteId: 'c2', vencimento: '2026-09-17', status: 'Pendente' },
      { clienteId: 'c7', vencimento: '2026-10-09', status: 'Pendente' },
      { clienteId: 'c8', vencimento: '2026-10-10', status: 'Pendente' },
    ],
  },
]

test('cada cliente vira um item de prazo independente', () => {
  const items = flattenObligationDeadlines(obligations)
  assert.equal(items.length, 10)
  assert.equal(items[0].competencia, '2026-08')
  assert.equal(items[0].categoria, 'Fiscal')
})

test('classifica o vencimento oficial nos períodos definidos', () => {
  const items = flattenObligationDeadlines(obligations)
  assert.equal(obligationLinkMatchesDeadline(items[0], 'overdue', day), true)
  assert.equal(obligationLinkMatchesDeadline(items[1], 'today', day), true)
  assert.equal(obligationLinkMatchesDeadline(items[2], 'tomorrow', day), true)
  assert.equal(obligationLinkMatchesDeadline(items[6], 'week', day), true)
  assert.equal(obligationLinkMatchesDeadline(items[7], 'week', day), false)
  assert.equal(obligationLinkMatchesDeadline(items[8], 'month', day), true)
  assert.equal(obligationLinkMatchesDeadline(items[9], 'month', day), false)
})

test('aguardando cliente aparece mesmo sem vencimento e concluídas não entram', () => {
  const view = buildObligationDeadlineView(obligations, { day, scope: 'waiting' })
  assert.deepEqual(view.items.map(item => item.clientId), ['c3', 'c4'])
  assert.equal(view.counts.all, 8)
  assert.equal(view.counts.waiting, 2)
})

test('filtros de cliente e departamento/categoria afetam lista e contadores', () => {
  const fiscal = buildObligationDeadlineView(obligations, { day, scope: 'all', clientId: 'c1', category: 'Fiscal' })
  assert.deepEqual(fiscal.items.map(item => item.key), ['o1|c1'])
  assert.equal(fiscal.counts.overdue, 1)
  assert.equal(fiscal.counts.today, 0)

  const dp = buildObligationDeadlineView(obligations, { day, scope: 'all', clientId: 'c1', category: 'DP' })
  assert.deepEqual(dp.items.map(item => item.key), ['o2|c1'])
  assert.equal(dp.counts.week, 1)
})
