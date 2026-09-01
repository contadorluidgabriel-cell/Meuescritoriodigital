import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTaskDigest, periodKey, shouldDispatch, weekBounds } from '../supabase/functions/office-push-dispatch/digest.js'

const payload = {
  med_tarefas: [
    { id: 'a', titulo: 'Hoje pendente', prazo: '2026-09-01', status: 'Pendente' },
    { id: 'b', titulo: 'Hoje concluída', prazo: '2026-09-01', status: 'Concluída' },
    { id: 'c', titulo: 'Atrasada', prazo: '2026-08-31', status: 'Pendente' },
    { id: 'd', titulo: 'Amanhã', prazo: '2026-09-02', status: 'Pendente' },
    { id: 'e', titulo: 'Sexta', prazo: '2026-09-04', status: 'Pendente' },
  ],
}

test('resumo diário conta tarefas do dia e atrasadas', () => {
  const digest = buildTaskDigest(payload, 'daily', '2026-09-01')
  assert.equal(digest.title, 'Tarefas de hoje · 2')
  assert.match(digest.body, /1 pendente de 2/)
  assert.match(digest.body, /1 atrasada/)
  assert.equal(digest.url, '/?push=tarefas')
})

test('fechamento mostra concluídas do dia, pendências e atraso', () => {
  const digest = buildTaskDigest(payload, 'closing', '2026-09-01')
  assert.equal(digest.title, 'Fechamento do dia')
  assert.match(digest.body, /1\/2 tarefas do dia concluídas/)
  assert.match(digest.body, /1 pendente/)
  assert.match(digest.body, /1 atrasada/)
})

test('resumo semanal usa semana de segunda a domingo', () => {
  assert.deepEqual(weekBounds('2026-09-01'), { start: '2026-08-31', end: '2026-09-06' })
  const digest = buildTaskDigest(payload, 'weekly', '2026-09-01')
  assert.equal(digest.title, 'Tarefas da semana · 5')
  assert.match(digest.body, /4 pendentes/)
  assert.match(digest.body, /1 concluída/)
  assert.equal(periodKey('weekly', '2026-09-01'), '2026-08-31')
})

test('dispatcher respeita horário, janela e dia semanal', () => {
  const preference = {
    enabled: true,
    timezone: 'UTC',
    daily_enabled: true,
    daily_time: '08:00',
    weekly_enabled: true,
    weekly_weekday: 2,
    weekly_time: '08:00',
    closing_enabled: true,
    closing_time: '18:00',
  }
  assert.equal(shouldDispatch(preference, 'daily', new Date('2026-09-01T08:05:00Z')), true)
  assert.equal(shouldDispatch(preference, 'daily', new Date('2026-09-01T08:15:00Z')), false)
  assert.equal(shouldDispatch(preference, 'weekly', new Date('2026-09-01T08:05:00Z')), true)
  assert.equal(shouldDispatch({ ...preference, weekly_weekday: 1 }, 'weekly', new Date('2026-09-01T08:05:00Z')), false)
  assert.equal(shouldDispatch(preference, 'closing', new Date('2026-09-01T18:10:00Z')), true)
})
