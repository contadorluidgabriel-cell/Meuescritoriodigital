import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkHorizon } from '../src/lib/workHorizons.js'

function officeWithProcesses(processes) {
  return {
    clients: [{ id: 'c1', razao: 'Empresa Teste' }],
    tasks: [],
    processes,
    obligations: [],
    finance: [],
    history: [],
    settings: {},
  }
}

test('Meu Dia mostra todo processo ativo mesmo com prazo muito distante ou sem prazo', () => {
  const office = officeWithProcesses([
    { id: 'p_far', clientId: 'c1', tipo: 'Alteração contratual', status: 'Em andamento', prazoFinal: '2027-12-31' },
    { id: 'p_wait', clientId: 'c1', tipo: 'Abertura', status: 'Aguardando órgão', prazoFinal: '' },
  ])

  const view = buildWorkHorizon(office, { day: '2026-09-12', horizon: 'today' })
  const ids = view.items.filter(item => item.type === 'process').map(item => item.id)

  assert.deepEqual(new Set(ids), new Set(['p_far', 'p_wait']))
  assert.ok(view.groups.find(group => group.key === '2026-09-12')?.items.some(item => item.id === 'p_far'))
  assert.ok(view.groups.find(group => group.key === '2026-09-12')?.items.some(item => item.id === 'p_wait'))
})

test('processo ativo atrasado continua no Meu Dia e fica no grupo de atrasados', () => {
  const office = officeWithProcesses([
    { id: 'p_overdue', clientId: 'c1', tipo: 'Baixa', status: 'Em andamento', prazoFinal: '2026-09-10' },
  ])

  const view = buildWorkHorizon(office, { day: '2026-09-12', horizon: 'today' })
  const overdue = view.groups.find(group => group.key === 'overdue')

  assert.ok(view.items.some(item => item.type === 'process' && item.id === 'p_overdue'))
  assert.ok(overdue?.items.some(item => item.id === 'p_overdue'))
})

test('processos concluídos ou cancelados não aparecem no Meu Dia', () => {
  const office = officeWithProcesses([
    { id: 'p_done', clientId: 'c1', tipo: 'Abertura', status: 'Concluído', prazoFinal: '2026-09-12' },
    { id: 'p_cancelled', clientId: 'c1', tipo: 'Alteração', status: 'Cancelado', prazoFinal: '2026-09-10' },
  ])

  const view = buildWorkHorizon(office, { day: '2026-09-12', horizon: 'today' })
  const ids = view.items.filter(item => item.type === 'process').map(item => item.id)

  assert.equal(ids.includes('p_done'), false)
  assert.equal(ids.includes('p_cancelled'), false)
})
