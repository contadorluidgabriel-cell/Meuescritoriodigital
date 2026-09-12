import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkHorizon } from '../src/lib/workHorizons.js'
import { selectWorkBoard } from '../src/lib/workBoardView.js'

function officeWithObligations(obligations) {
  return {
    clients: [
      { id: 'c1', razao: 'Empresa A' },
      { id: 'c2', razao: 'Empresa B' },
    ],
    tasks: [],
    processes: [],
    obligations,
    finance: [],
    history: [],
    settings: {},
  }
}

test('Meu Dia mostra obrigação com pendência mesmo com vencimento distante ou sem vencimento', () => {
  const office = officeWithObligations([
    {
      id: 'o_far',
      nome: 'DCTFWeb 08/2026',
      clientes: [
        { clienteId: 'c1', status: 'Pendente', vencimento: '2027-12-31' },
        { clienteId: 'c2', status: 'Concluída', vencimento: '2027-12-31' },
      ],
    },
    {
      id: 'o_nodate',
      nome: 'Regularização cadastral',
      clientes: [{ clienteId: 'c1', status: 'Em andamento', vencimento: '' }],
    },
  ])

  const view = buildWorkHorizon(office, { day: '2026-09-12', horizon: 'today' })
  const selected = selectWorkBoard(view, { type: 'obligation' })
  const ids = selected.items.map(item => item.id)

  assert.deepEqual(new Set(ids), new Set(['o_far', 'o_nodate']))
  assert.equal(selected.items.filter(item => item.id === 'o_far').length, 1)
  assert.ok(selected.groups.find(group => group.key === '2026-09-12')?.items.some(item => item.id === 'o_far'))
  assert.ok(selected.groups.find(group => group.key === '2026-09-12')?.items.some(item => item.id === 'o_nodate'))
})

test('obrigação vencida com pendência continua no Meu Dia e fica em Atrasados', () => {
  const office = officeWithObligations([
    {
      id: 'o_overdue',
      nome: 'DCTFWeb 07/2026',
      clientes: [{ clienteId: 'c1', status: 'Aguardando cliente', vencimento: '2026-09-10' }],
    },
  ])

  const view = buildWorkHorizon(office, { day: '2026-09-12', horizon: 'today' })
  const selected = selectWorkBoard(view, { type: 'obligation' })
  const overdue = selected.groups.find(group => group.key === 'overdue')

  assert.ok(selected.items.some(item => item.id === 'o_overdue'))
  assert.ok(overdue?.items.some(item => item.id === 'o_overdue'))
})

test('obrigação sai do Meu Dia quando todos os CNPJs estão resolvidos', () => {
  const office = officeWithObligations([
    {
      id: 'o_done',
      nome: 'DCTFWeb 08/2026',
      clientes: [
        { clienteId: 'c1', status: 'Concluída', vencimento: '2026-09-30' },
        { clienteId: 'c2', status: 'Não se aplica', vencimento: '2026-09-30' },
      ],
    },
  ])

  const view = buildWorkHorizon(office, { day: '2026-09-12', horizon: 'today' })
  const selected = selectWorkBoard(view, { type: 'obligation' })

  assert.equal(selected.items.some(item => item.id === 'o_done'), false)
})

test('Próximos continua usando o vencimento e não puxa obrigação distante para sete dias', () => {
  const office = officeWithObligations([
    {
      id: 'o_far',
      nome: 'DCTFWeb 12/2026',
      clientes: [{ clienteId: 'c1', status: 'Pendente', vencimento: '2026-12-15' }],
    },
  ])

  const view = buildWorkHorizon(office, { day: '2026-09-12', horizon: 'week' })
  const selected = selectWorkBoard(view, { type: 'obligation' })

  assert.equal(selected.items.some(item => item.id === 'o_far'), false)
})
