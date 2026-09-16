import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  appendNextRecurringTaskWithMeta,
  competenciaStepMonths,
  nextTaskCompetencia,
  taskCompetenciaError,
} from '../src/lib/taskRecurrence.js'

const taskSource = () => readFileSync(new URL('../src/components/TasksReactBase.jsx', import.meta.url), 'utf8')

test('competência avança pela regra explícita da recorrência', () => {
  assert.equal(competenciaStepMonths('mensal'), 1)
  assert.equal(competenciaStepMonths('bimestral'), 2)
  assert.equal(competenciaStepMonths('trimestral'), 3)
  assert.equal(competenciaStepMonths('semestral'), 6)
  assert.equal(competenciaStepMonths('anual'), 12)
  assert.equal(competenciaStepMonths('semanal'), 0)

  assert.equal(nextTaskCompetencia('2026-08', 'mensal'), '2026-09')
  assert.equal(nextTaskCompetencia('2026-11', 'bimestral'), '2027-01')
  assert.equal(nextTaskCompetencia('2026-08', 'trimestral'), '2026-11')
  assert.equal(nextTaskCompetencia('2026-08', 'semanal'), '2026-08')
  assert.equal(nextTaskCompetencia('2026-08', 'mensal', false), '2026-08')
})

test('recorrência mensal com competência cria próxima execução independente do prazo', () => {
  const task = {
    id: 't1', titulo: 'Fechamento fiscal', clientId: 'c1', status: 'Concluída',
    prazo: '2026-09-15', recorrencia: 'mensal', usaCompetencia: true, competencia: '2026-08',
    competenciaAvancoAutomatico: true,
    observacao: 'Competência finalizada', comentarios: [{ id: 'c1', texto: 'OK' }], subtarefas: [],
  }
  const result = appendNextRecurringTaskWithMeta([task], task, [{ id: 'c1', status: 'Ativo' }])
  const next = result.tasks.find(item => item.id === result.generatedTaskId)
  assert.ok(next)
  assert.equal(next.prazo, '2026-10-15')
  assert.equal(next.usaCompetencia, true)
  assert.equal(next.competencia, '2026-09')
  assert.equal(next.competenciaAvancoAutomatico, true)
  assert.equal(next.observacao, '')
  assert.deepEqual(next.comentarios, [])
})

test('recorrências de dias ou semanas mantêm a competência até ajuste manual', () => {
  const task = {
    id: 't-week', titulo: 'Conferência semanal', clientId: 'c1', status: 'Concluída',
    prazo: '2026-09-18', recorrencia: 'semanal', usaCompetencia: true, competencia: '2026-09',
    competenciaAvancoAutomatico: true, subtarefas: [],
  }
  const result = appendNextRecurringTaskWithMeta([task], task, [{ id: 'c1', status: 'Ativo' }])
  const next = result.tasks.find(item => item.id === result.generatedTaskId)
  assert.ok(next)
  assert.equal(next.prazo, '2026-09-25')
  assert.equal(next.competencia, '2026-09')
  assert.equal(next.competenciaAvancoAutomatico, false)
})

test('usuário pode desativar avanço automático mesmo em recorrência mensal', () => {
  const task = {
    id: 't-manual', titulo: 'Rotina mensal', clientId: 'c1', status: 'Concluída',
    prazo: '2026-09-15', recorrencia: 'mensal', usaCompetencia: true, competencia: '2026-08',
    competenciaAvancoAutomatico: false, subtarefas: [],
  }
  const result = appendNextRecurringTaskWithMeta([task], task, [{ id: 'c1', status: 'Ativo' }])
  const next = result.tasks.find(item => item.id === result.generatedTaskId)
  assert.ok(next)
  assert.equal(next.competencia, '2026-08')
  assert.equal(next.competenciaAvancoAutomatico, false)
})

test('tarefa sem controle por competência continua sem competência', () => {
  const task = {
    id: 't2', titulo: 'Ligar para cliente', clientId: 'c1', status: 'Concluída',
    prazo: '2026-09-20', recorrencia: 'mensal', usaCompetencia: false, competencia: '', subtarefas: [],
  }
  const result = appendNextRecurringTaskWithMeta([task], task, [{ id: 'c1', status: 'Ativo' }])
  const next = result.tasks.find(item => item.id === result.generatedTaskId)
  assert.ok(next)
  assert.equal(next.usaCompetencia, false)
  assert.equal(next.competencia, '')
})

test('validação de domínio exige competência válida apenas quando o controle está ligado', () => {
  assert.equal(taskCompetenciaError({ usaCompetencia: false, competencia: '' }), '')
  assert.equal(taskCompetenciaError({ usaCompetencia: true, competencia: '' }), 'Informe uma competência válida.')
  assert.equal(taskCompetenciaError({ usaCompetencia: true, competencia: '2026-13' }), 'Informe uma competência válida.')
  assert.equal(taskCompetenciaError({ usaCompetencia: true, competencia: '2026-09' }), '')
})

test('duplicidade de recorrência considera também a competência', () => {
  const completed = {
    id: 't3', titulo: 'Fechamento fiscal', clientId: 'c1', status: 'Concluída',
    prazo: '2026-09-15', recorrencia: 'mensal', usaCompetencia: true, competencia: '2026-08', subtarefas: [],
  }
  const otherCompetencia = {
    id: 't4', titulo: 'Fechamento fiscal', clientId: 'c1', status: 'Pendente',
    prazo: '2026-10-15', recorrencia: 'mensal', usaCompetencia: true, competencia: '2026-10', subtarefas: [],
  }
  const different = appendNextRecurringTaskWithMeta([completed, otherCompetencia], completed, [{ id: 'c1', status: 'Ativo' }])
  assert.ok(different.generatedTaskId)
  assert.equal(different.tasks.find(item => item.id === different.generatedTaskId)?.competencia, '2026-09')

  const sameCompetencia = { ...otherCompetencia, id: 't5', competencia: '2026-09' }
  const duplicate = appendNextRecurringTaskWithMeta([completed, sameCompetencia], completed, [{ id: 'c1', status: 'Ativo' }])
  assert.equal(duplicate.generatedTaskId, '')
})

test('interface trata competência como opcional e seleção em lote respeita o filtro', () => {
  const source = taskSource()
  assert.match(source, /Usar competência/)
  assert.match(source, /Controlar esta tarefa por competência/)
  assert.match(source, /Avançar competência automaticamente com a recorrência/)
  assert.match(source, /Filtrar por competência/)
  assert.match(source, /Competência do histórico/)
  assert.match(source, /const visibleRows = useMemo/)
  assert.match(source, /visibleRows\.forEach/)
  assert.match(source, /const visibleSelected = visibleRows\.length/)
  assert.match(source, /taskCompetenciaError\(editing\)/)
  assert.match(source, /Competência ·/)
})

test('modelos podem definir que suas tarefas usam competência sem fixar um mês', () => {
  const source = taskSource()
  assert.match(source, /As tarefas deste modelo usam competência/)
  assert.match(source, /usaCompetencia: Boolean\(editingTemplate\.usaCompetencia\)/)
  assert.match(source, /competencia: ''/)
})
