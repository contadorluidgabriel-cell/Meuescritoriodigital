import test from 'node:test'
import assert from 'node:assert/strict'
import {
  answerOfficeQuery,
  buildClientTimeline,
  buildMyDay,
  buildOperationalMetrics,
  buildWeekPlan,
  collectOperationalWork,
  replanTask,
  weekBounds,
} from '../src/lib/operationalIntelligence.js'

const office = {
  clients: [
    { id: 'c1', razao: 'Cliente Alfa' },
    { id: 'c2', razao: 'Cliente Beta' },
  ],
  tasks: [
    { id: 't1', clientId: 'c1', titulo: 'Enviar folha', prazo: '2026-09-01', status: 'Pendente', prioridade: 'Alta', departamento: 'DP' },
    { id: 't2', clientId: 'c1', titulo: 'Cobrar documentos', prazo: '2026-08-29', status: 'Aguardando cliente', prioridade: 'Normal', departamento: 'Fiscal' },
    { id: 't3', clientId: 'c2', titulo: 'Revisar cadastro', prazo: '2026-09-04', status: 'Pendente', prioridade: 'Normal' },
    { id: 't4', clientId: 'c1', titulo: 'Tarefa concluída', prazo: '2026-09-01', status: 'Concluída', updatedAt: '2026-09-01T12:00:00.000Z' },
  ],
  processes: [
    { id: 'p1', clientId: 'c2', tipo: 'Alteração contratual', prazoFinal: '2026-08-31', status: 'Em andamento' },
  ],
  obligations: [
    { id: 'o1', nome: 'DCTFWeb', categoria: 'Fiscal', clientes: [{ clienteId: 'c1', vencimento: '2026-09-02', status: 'Pendente' }] },
  ],
  finance: [
    { id: 'f1', clienteId: 'c1', descricao: 'Honorários agosto', valor: 500, vencimento: '2026-08-20', competencia: '2026-08', status: 'Pendente', pagamentos: [] },
    { id: 'f2', clienteId: 'c2', descricao: 'Honorários setembro', valor: 800, vencimento: '2026-09-10', competencia: '2026-09', status: 'Pendente', pagamentos: [] },
    { id: 'f3', clienteId: 'c1', descricao: 'Honorários setembro', valor: 600, vencimento: '2026-09-05', competencia: '2026-09', status: 'Parcial', pagamentos: [{ id: 'pay1', data: '2026-09-01', valorRecebido: 200 }] },
  ],
  partners: [],
  history: [
    { id: 'h1', type: 'task', title: 'Entregar relatório', client: 'Cliente Alfa', clientId: 'c1', completedAt: '2026-08-28T10:00:00.000Z' },
  ],
}

test('weekBounds uses Monday through Sunday', () => {
  assert.deepEqual(weekBounds('2026-09-01'), { start: '2026-08-31', end: '2026-09-06' })
})

test('operational work prioritizes overdue work above upcoming work', () => {
  const items = collectOperationalWork(office, { day: '2026-09-01' })
  assert.equal(items[0].type, 'task')
  assert.equal(items[0].id, 't2')
  assert.equal(items[0].level, 'critical')
  assert.ok(items.find(item => item.id === 't1').score > items.find(item => item.id === 't3').score)
})

test('my day includes overdue and today priorities without duplicating items', () => {
  const result = buildMyDay(office, { day: '2026-09-01' })
  assert.ok(result.overdue.some(item => item.id === 't2'))
  assert.ok(result.overdue.some(item => item.id === 'p1'))
  assert.ok(result.dueToday.some(item => item.id === 't1'))
  assert.equal(new Set(result.top.map(item => item.key)).size, result.top.length)
})

test('week plan respects safe planned date when a task is re-planned', () => {
  const changedTasks = replanTask(office.tasks, 't3', '2026-09-02', '2026-09-01T12:00:00.000Z')
  const changed = { ...office, tasks: changedTasks }
  const plan = buildWeekPlan(changed, { day: '2026-09-01' })
  const wednesday = plan.days.find(row => row.date === '2026-09-02')
  assert.ok(wednesday.items.some(item => item.id === 't3'))
  const task = changedTasks.find(item => item.id === 't3')
  assert.equal(task.prazo, '2026-09-04')
  assert.equal(task.planejadoPara, '2026-09-02')
  assert.equal(task.replanejamentoHistorico.length, 1)
})

test('office query identifies overdue finance without guessing', () => {
  const result = answerOfficeQuery(office, 'quem não pagou?', { day: '2026-09-01' })
  assert.equal(result.mode, 'finance')
  assert.ok(result.items.some(item => item.id === 'f1'))
  assert.ok(!result.items.some(item => item.id === 'f2'))
})

test('office query can focus a named client', () => {
  const result = answerOfficeQuery(office, 'Cliente Alfa', { day: '2026-09-01' })
  assert.equal(result.mode, 'client')
  assert.ok(result.items.length > 0)
  assert.ok(result.items.every(item => String(item.clientId || '') === 'c1'))
})

test('client timeline combines operation and finance events', () => {
  const timeline = buildClientTimeline(office, 'c1')
  assert.ok(timeline.some(item => item.type === 'task'))
  assert.ok(timeline.some(item => item.type === 'finance' && item.detail.includes('Recebimento')))
  assert.ok(timeline.some(item => item.key === 'history-h1'))
})

test('metrics expose operation and finance without destructive calculations', () => {
  const metrics = buildOperationalMetrics(office, { day: '2026-09-01' })
  assert.ok(metrics.openWork >= 4)
  assert.ok(metrics.overdueWork >= 2)
  assert.equal(metrics.financeOverdue, 500)
  assert.equal(metrics.billedMonth, 1400)
  assert.equal(metrics.receivedMonth, 200)
})
