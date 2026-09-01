import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOfficeDigest, buildTaskDigest, periodKey, shouldDispatch, weekBounds } from '../supabase/functions/office-push-dispatch/digest.js'

const payload = {
  med_clientes: [{ id: 'c1', razao: 'Cliente Alfa' }],
  med_tarefas: [
    { id: 'a', clientId: 'c1', titulo: 'Hoje pendente', prazo: '2026-09-01', status: 'Pendente', prioridade: 'Alta' },
    { id: 'b', clientId: 'c1', titulo: 'Hoje concluída', prazo: '2026-09-01', status: 'Concluída', updatedAt: '2026-09-01T12:00:00Z' },
    { id: 'c', clientId: 'c1', titulo: 'Atrasada', prazo: '2026-08-31', status: 'Pendente' },
    { id: 'd', clientId: 'c1', titulo: 'Amanhã', prazo: '2026-09-02', status: 'Pendente' },
    { id: 'e', clientId: 'c1', titulo: 'Sexta', prazo: '2026-09-04', status: 'Pendente' },
  ],
  med_processos: [{ id: 'p1', clientId: 'c1', tipo: 'Alteração contratual', prazoFinal: '2026-09-03', status: 'Em andamento' }],
  med_obrigacoes: [{ id: 'o1', nome: 'DCTFWeb', clientes: [{ clienteId: 'c1', vencimento: '2026-09-02', status: 'Pendente' }] }],
  med_financeiro: [
    { id: 'f1', clienteId: 'c1', descricao: 'Honorários agosto', valor: 500, vencimento: '2026-08-20', status: 'Pendente', pagamentos: [] },
    { id: 'f2', clienteId: 'c1', descricao: 'Honorários setembro', valor: 600, vencimento: '2026-09-05', status: 'Parcial', pagamentos: [{ id: 'pay', data: '2026-09-01', valorRecebido: 200 }] },
  ],
  med_historico_painel: [{ id: 'h1', completedAt: '2026-09-01T11:00:00Z' }],
}

test('resumo diário legado conta tarefas do dia e atrasadas', () => {
  const digest = buildTaskDigest(payload, 'daily', '2026-09-01')
  assert.equal(digest.title, 'Tarefas de hoje · 2')
  assert.match(digest.body, /1 pendente de 2/)
  assert.match(digest.body, /1 atrasada/)
  assert.equal(digest.url, '/?push=tarefas')
})

test('fechamento legado mostra concluídas do dia, pendências e atraso', () => {
  const digest = buildTaskDigest(payload, 'closing', '2026-09-01')
  assert.equal(digest.title, 'Fechamento do dia')
  assert.match(digest.body, /1\/2 tarefas do dia concluídas/)
  assert.match(digest.body, /1 pendente/)
  assert.match(digest.body, /1 atrasada/)
})

test('resumo semanal legado usa semana de segunda a domingo', () => {
  assert.deepEqual(weekBounds('2026-09-01'), { start: '2026-08-31', end: '2026-09-06' })
  const digest = buildTaskDigest(payload, 'weekly', '2026-09-01')
  assert.equal(digest.title, 'Tarefas da semana · 5')
  assert.match(digest.body, /4 pendentes/)
  assert.match(digest.body, /1 concluída/)
  assert.equal(periodKey('weekly', '2026-09-01'), '2026-08-31')
})

test('digest inteligente agrupa operação e financeiro no começo do dia', () => {
  const digest = buildOfficeDigest(payload, 'daily', '2026-09-01', {
    include_tasks: true, include_processes: true, include_obligations: true, include_finance: true,
  })
  assert.match(digest.title, /Meu Dia/)
  assert.match(digest.body, /1 atraso/)
  assert.match(digest.body, /R\$\s*500,00 vencidos/)
  assert.match(digest.body, /Primeiro:/)
  assert.equal(digest.url, '/?push=meu-dia')
  assert.equal(digest.actions[0].action, 'open-day')
})

test('check-in do meio do dia informa progresso sem criar tarefa', () => {
  const digest = buildOfficeDigest(payload, 'midday', '2026-09-01', {})
  assert.equal(digest.title, 'Check-in do dia')
  assert.match(digest.body, /entrega registrada/)
  assert.match(digest.body, /item de hoje pendente/)
})

test('fechamento semanal inclui entregas e recebimentos registrados', () => {
  const digest = buildOfficeDigest(payload, 'weekly_closing', '2026-09-04', {})
  assert.equal(digest.title, 'Fechamento semanal')
  assert.match(digest.body, /entrega registrada/)
  assert.match(digest.body, /R\$\s*200,00 recebidos/)
  assert.equal(periodKey('weekly_closing', '2026-09-04'), '2026-08-31')
})

test('preferência de categoria exclui financeiro do digest quando desativado', () => {
  const digest = buildOfficeDigest(payload, 'daily', '2026-09-01', { include_finance: false })
  assert.doesNotMatch(digest.body, /500,00 vencidos/)
})

test('dispatcher respeita horários, janelas e dias semanais novos e antigos', () => {
  const preference = {
    enabled: true,
    timezone: 'UTC',
    daily_enabled: true,
    daily_time: '08:00',
    midday_enabled: true,
    midday_time: '14:00',
    weekly_enabled: true,
    weekly_weekday: 2,
    weekly_time: '08:00',
    closing_enabled: true,
    closing_time: '18:00',
    weekly_closing_enabled: true,
    weekly_closing_weekday: 5,
    weekly_closing_time: '18:00',
  }
  assert.equal(shouldDispatch(preference, 'daily', new Date('2026-09-01T08:05:00Z')), true)
  assert.equal(shouldDispatch(preference, 'daily', new Date('2026-09-01T08:15:00Z')), false)
  assert.equal(shouldDispatch(preference, 'midday', new Date('2026-09-01T14:10:00Z')), true)
  assert.equal(shouldDispatch(preference, 'weekly', new Date('2026-09-01T08:05:00Z')), true)
  assert.equal(shouldDispatch({ ...preference, weekly_weekday: 1 }, 'weekly', new Date('2026-09-01T08:05:00Z')), false)
  assert.equal(shouldDispatch(preference, 'closing', new Date('2026-09-01T18:10:00Z')), true)
  assert.equal(shouldDispatch(preference, 'weekly_closing', new Date('2026-09-04T18:10:00Z')), true)
  assert.equal(shouldDispatch(preference, 'weekly_closing', new Date('2026-09-03T18:10:00Z')), false)
})
