import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PROCESS_DEPENDENCIES,
  PROCESS_STEP_STATUSES,
  processActionState,
  processStepSettled,
  processStepStatusLabel,
  setProcessStepStatus,
} from '../src/lib/processPlanning.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function processWithSteps(etapas, extra = {}) {
  return {
    id: 'p1',
    status: 'Em andamento',
    etapaAtual: 0,
    etapas,
    ...extra,
  }
}

test('etapas oferecem status operacionais sem misturar orgao e terceiro', () => {
  assert.deepEqual(PROCESS_STEP_STATUSES, [
    'Pendente',
    'Em andamento',
    'Aguardando cliente',
    'Aguardando órgão',
    'Aguardando terceiro',
    'Em análise',
    'Em exigência',
    'Concluída',
    'Não se aplica',
  ])
  assert.equal(PROCESS_DEPENDENCIES.orgao.label, 'Órgão')
  assert.equal(PROCESS_DEPENDENCIES.terceiro.label, 'Terceiro')
})

test('status aguardando orgao registra alvo e atualiza status geral do processo', () => {
  const process = processWithSteps([
    { id: 'a', nome: 'Registro', status: 'Em andamento', ordem: 0, responsavelTipo: 'interno', followupDias: 3 },
  ])
  const result = setProcessStepStatus(process, 'a', 'Aguardando órgão', { waitingTarget: 'Junta Comercial', baseDate: '2026-09-12' })
  const step = result.process.etapas[0]

  assert.equal(result.changed, true)
  assert.equal(step.status, 'Aguardando órgão')
  assert.equal(step.responsavelTipo, 'orgao')
  assert.equal(step.aguardandoEm, 'Junta Comercial')
  assert.equal(step.aguardandoDesde, '2026-09-12')
  assert.equal(step.proximaRevisao, '2026-09-16')
  assert.equal(result.process.status, 'Aguardando órgão')
  assert.equal(processStepStatusLabel(step), 'Aguardando Junta Comercial')

  const action = processActionState(result.process, { day: '2026-09-12' })
  assert.equal(action.stepStatusLabel, 'Aguardando Junta Comercial')
  assert.equal(action.dependencyLabel, 'Junta Comercial')
  assert.match(action.actionLabel, /Conferir Junta Comercial/)
})

test('em exigencia vira status geral e gera acao de resolver exigencia', () => {
  const process = processWithSteps([
    { id: 'a', nome: 'DBE', status: 'Em andamento', ordem: 0, responsavelTipo: 'interno', prazoEtapa: '2026-09-15' },
  ])
  const result = setProcessStepStatus(process, 'a', 'Em exigência', { baseDate: '2026-09-12' })
  assert.equal(result.process.status, 'Em exigência')
  assert.equal(result.process.etapas[0].status, 'Em exigência')
  assert.match(processActionState(result.process, { day: '2026-09-12' }).actionLabel, /Resolver exigência/)
})

test('nao se aplica encerra a etapa e avanca para a proxima', () => {
  const process = processWithSteps([
    { id: 'a', nome: 'Etapa opcional', status: 'Pendente', ordem: 0, responsavelTipo: 'interno' },
    { id: 'b', nome: 'Protocolar', status: 'Pendente', ordem: 1, responsavelTipo: 'interno', prazoDias: 1 },
  ])
  const result = setProcessStepStatus(process, 'a', 'Não se aplica', { baseDate: '2026-09-12' })
  assert.equal(processStepSettled(result.process.etapas.find(step => step.id === 'a')), true)
  assert.equal(result.process.etapas.find(step => step.id === 'a').status, 'Não se aplica')
  assert.equal(result.process.etapaAtual, 1)
  assert.equal(result.process.etapas.find(step => step.id === 'b').ativadaEm, '2026-09-12')
})

test('patch de processos expõe status e alvo de espera no editor', () => {
  const patch = read('scripts/patch-process-step-statuses.mjs')
  const vite = read('vite.config.js')
  assert.match(patch, /Status da etapa/)
  assert.match(patch, /Aguardando em \/ por/)
  assert.match(patch, /processStepStatusLabel/)
  assert.match(vite, /applyProcessStepStatusesPatch\(root\)/)
})
