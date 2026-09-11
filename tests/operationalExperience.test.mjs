import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectWorkBoard } from '../src/lib/workBoardView.js'
import { obligationProgress, pendingReasonIds } from '../src/lib/operationalPresentation.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Meu Dia consolida uma obrigacao em um card mesmo com varios CNPJs', () => {
  const obligationA = { key: 'obligation:o1:c1', type: 'obligation', id: 'o1', clientId: 'c1' }
  const obligationB = { key: 'obligation:o1:c2', type: 'obligation', id: 'o1', clientId: 'c2' }
  const task = { key: 'task:t1', type: 'task', id: 't1' }
  const view = { items: [obligationA, obligationB, task], overdue: [], critical: [], unscheduled: [], groups: [{ key: 'today', label: 'Hoje', items: [obligationA, obligationB, task] }] }
  const selected = selectWorkBoard(view, { type: 'operation' })
  assert.equal(selected.items.length, 2)
  assert.equal(selected.counts.obligation, 1)
  assert.equal(selected.groups[0].items.length, 2)
})

test('progresso da obrigacao separa concluidos, N/A e pendentes', () => {
  const office = {
    clients: [{ id: 'c1', razao: 'A' }, { id: 'c2', razao: 'B' }, { id: 'c3', razao: 'C' }],
    linkedCompanies: [],
    obligations: [{ id: 'o1', clientes: [
      { clienteId: 'c1', status: 'Concluída' },
      { clienteId: 'c2', status: 'Não se aplica' },
      { clienteId: 'c3', status: 'Pendente' },
    ] }],
  }
  const progress = obligationProgress(office, 'o1')
  assert.equal(progress.total, 3)
  assert.equal(progress.done, 2)
  assert.equal(progress.open, 1)
  assert.equal(progress.firstPendingClientId, 'c3')
})

test('caixa de pendencias classifica atraso, sem data e sem responsavel', () => {
  const office = { tasks: [{ id: 't1', titulo: 'Teste', responsavel: '' }], processes: [], obligations: [] }
  const overdue = pendingReasonIds({ type: 'task', id: 't1', key: 'task:t1', due: '2026-09-09', effectiveDate: '2026-09-09', status: 'Pendente' }, office, '2026-09-10')
  assert.equal(overdue.has('overdue'), true)
  assert.equal(overdue.has('unassigned'), true)
  const unscheduled = pendingReasonIds({ type: 'task', id: 't1', key: 'task:t1', status: 'Pendente' }, office, '2026-09-10')
  assert.equal(unscheduled.has('unscheduled'), true)
})

test('Meu Dia usa caixa de excecoes e financeiro permanece secundario', () => {
  const command = read('src/components/OperationalCommandCenter.jsx')
  const pending = read('src/components/PendingInbox.jsx')
  const horizon = read('src/components/WorkHorizonBoard.jsx')
  assert.match(command, /PendingInbox/)
  assert.match(pending, /Caixa de exceções/)
  assert.match(pending, /Apoio financeiro/)
  assert.match(horizon, /Ver pendentes/)
  assert.match(horizon, /Abrir próxima ação/)
})

test('Painel do Escritorio adiciona leitura executiva sem executar a operacao', () => {
  const dashboard = read('src/components/Dashboard.jsx')
  const insights = read('src/components/ManagementInsights.jsx')
  assert.match(dashboard, /ManagementInsights/)
  assert.match(insights, /Taxa de recebimento/)
  assert.match(insights, /mês anterior/)
  assert.equal(dashboard.includes('function completeItems'), false)
})
