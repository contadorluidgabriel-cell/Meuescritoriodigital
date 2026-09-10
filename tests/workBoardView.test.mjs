import test from 'node:test'
import assert from 'node:assert/strict'
import { selectWorkBoard, workItemSummary } from '../src/lib/workBoardView.js'

const late = { key: 'task-late', type: 'task', level: 'attention' }
const urgent = { key: 'finance-urgent', type: 'finance', level: 'critical' }
const partner = { key: 'partner-urgent', type: 'partner', level: 'critical' }
const noDate = { key: 'task-unscheduled', type: 'task' }
const view = {
  items: [late, urgent, partner], overdue: [late], critical: [urgent, partner], unscheduled: [noDate],
  groups: [{ key: 'overdue', items: [late] }, { key: 'today', items: [late, urgent, partner] }],
}

test('situação e tipo se combinam sem misturar atrasados e críticos', () => {
  assert.deepEqual(selectWorkBoard(view, { scope: 'overdue' }).items, [late])
  const criticalFinance = selectWorkBoard(view, { scope: 'critical', type: 'finance' })
  assert.deepEqual(criticalFinance.items, [urgent, partner])
  assert.equal(criticalFinance.counts.task, 0)
  assert.equal(criticalFinance.counts.finance, 2)
  assert.deepEqual(selectWorkBoard(view, { scope: 'overdue', type: 'finance' }).groups, [])
})

test('registro atrasado replanejado aparece uma vez, no grupo prioritário', () => {
  const selected = selectWorkBoard(view)
  assert.deepEqual(selected.groups.map(group => group.items.map(item => item.key)), [['task-late'], ['finance-urgent', 'partner-urgent']])
  assert.equal(selected.groups.flatMap(group => group.items).length, selected.items.length)
})

test('sem data mostra seus registros e não os mistura no período', () => {
  assert.deepEqual(selectWorkBoard(view, { scope: 'unscheduled' }).groups[0].items, [noDate])
  assert.deepEqual(selectWorkBoard(view, { scope: 'unscheduled', type: 'finance' }).items, [])
  assert.equal(selectWorkBoard(view).items.includes(noDate), false)
})

test('resumo remove cliente duplicado preservando saldo e atraso', () => {
  assert.equal(workItemSummary({ client: '64.538.336 Daniel da Silva', subtitle: '64.538.336 Daniel da Silva · 31 dias em atraso · saldo R$ 50,00' }), '64.538.336 Daniel da Silva · 31 dias em atraso · saldo R$ 50,00')
  assert.equal(workItemSummary({ client: 'José Silva', subtitle: ' jose silva · José Silva Filho · saldo R$ 20,00' }), 'José Silva · José Silva Filho · saldo R$ 20,00')
  assert.equal(workItemSummary({ subtitle: '' }), 'Escritório')
})
