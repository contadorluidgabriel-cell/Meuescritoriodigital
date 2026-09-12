import test from 'node:test'
import assert from 'node:assert/strict'
import { taskAdvanceMeta, taskIsInAdvanceWindow } from '../src/lib/taskAdvance.js'
import { buildWorkHorizon } from '../src/lib/workHorizons.js'

test('antecedência calcula a janela antes do prazo', () => {
  const task = { prazo: '2026-09-15', antecedenciaDias: 5 }
  const meta = taskAdvanceMeta(task, '2026-09-10')
  assert.equal(meta.start, '2026-09-10')
  assert.equal(meta.remaining, 5)
  assert.equal(meta.active, true)
  assert.equal(taskIsInAdvanceWindow(task, '2026-09-09'), false)
  assert.equal(taskIsInAdvanceWindow(task, '2026-09-15'), true)
  assert.equal(taskIsInAdvanceWindow(task, '2026-09-16'), false)
})

test('tarefa dentro da antecedência aparece no horizonte Hoje antes do prazo', () => {
  const office = {
    clients: [{ id: 'c1', razao: 'Empresa Alpha' }],
    tasks: [{
      id: 't1',
      clientId: 'c1',
      titulo: 'Fechamento fiscal',
      status: 'Pendente',
      prioridade: 'Normal',
      prazo: '2026-09-15',
      antecedenciaDias: 5,
    }],
    processes: [],
    obligations: [],
    finance: [],
    notifications: [],
  }

  const before = buildWorkHorizon(office, { day: '2026-09-09', horizon: 'today' })
  const active = buildWorkHorizon(office, { day: '2026-09-10', horizon: 'today' })
  const stillActive = buildWorkHorizon(office, { day: '2026-09-14', horizon: 'today' })

  assert.equal(before.items.some(item => item.id === 't1'), false)
  assert.equal(active.items.some(item => item.id === 't1'), true)
  assert.equal(stillActive.items.some(item => item.id === 't1'), true)
  assert.equal(active.groups.find(group => group.key === '2026-09-10')?.items.some(item => item.id === 't1'), true)
})

test('sem antecedência a tarefa só entra no Hoje no próprio prazo', () => {
  const office = {
    clients: [],
    tasks: [{ id: 't2', titulo: 'Tarefa comum', status: 'Pendente', prazo: '2026-09-15', antecedenciaDias: 0 }],
    processes: [],
    obligations: [],
    finance: [],
    notifications: [],
  }

  assert.equal(buildWorkHorizon(office, { day: '2026-09-14', horizon: 'today' }).items.some(item => item.id === 't2'), false)
  assert.equal(buildWorkHorizon(office, { day: '2026-09-15', horizon: 'today' }).items.some(item => item.id === 't2'), true)
})
