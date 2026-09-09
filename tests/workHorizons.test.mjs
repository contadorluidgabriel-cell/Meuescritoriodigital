import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkHorizon, horizonEnd } from '../src/lib/workHorizons.js'

const day = '2026-09-09'
const baseOffice = {
  clients: [{ id: 'c1', nome: 'Cliente A', status: 'Ativo' }],
  tasks: [
    { id: 'late', titulo: 'Atrasada', clientId: 'c1', prazo: '2026-09-08', status: 'Pendente' },
    { id: 'today', titulo: 'Hoje', clientId: 'c1', prazo: '2026-09-09', status: 'Pendente' },
    { id: 'week', titulo: 'Semana', clientId: 'c1', prazo: '2026-09-15', status: 'Pendente' },
    { id: 'month', titulo: 'Mês', clientId: 'c1', prazo: '2026-10-08', status: 'Pendente' },
    { id: 'outside', titulo: 'Fora', clientId: 'c1', prazo: '2026-10-09', status: 'Pendente' },
    { id: 'nodate', titulo: 'Sem data', clientId: 'c1', prazo: '', status: 'Pendente' },
  ],
  processes: [], obligations: [], finance: [], financePayables: [], partners: [], history: [], settings: {},
}

test('horizonte Hoje inclui atrasados e o próprio dia', () => {
  const view = buildWorkHorizon(baseOffice, { day, horizon: 'today' })
  assert.equal(view.end, day)
  assert.deepEqual(new Set(view.items.filter(item => item.type === 'task').map(item => item.id)), new Set(['late', 'today']))
  assert.equal(view.overdue.length, 1)
  assert.equal(view.unscheduled.some(item => item.id === 'nodate'), true)
})

test('horizonte 7 dias inclui hoje até o sexto dia seguinte', () => {
  const view = buildWorkHorizon(baseOffice, { day, horizon: 'week' })
  assert.equal(view.end, '2026-09-15')
  const ids = new Set(view.items.filter(item => item.type === 'task').map(item => item.id))
  assert.equal(ids.has('late'), true)
  assert.equal(ids.has('today'), true)
  assert.equal(ids.has('week'), true)
  assert.equal(ids.has('month'), false)
})

test('horizonte 30 dias inclui até o 29º dia seguinte e agrupa por semana', () => {
  const view = buildWorkHorizon(baseOffice, { day, horizon: 'month' })
  assert.equal(horizonEnd(day, 'month'), '2026-10-08')
  const ids = new Set(view.items.filter(item => item.type === 'task').map(item => item.id))
  assert.equal(ids.has('month'), true)
  assert.equal(ids.has('outside'), false)
  assert.equal(view.groups.some(group => String(group.key).startsWith('week-')), true)
})
