import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addBusinessDays,
  continueProcessWaiting,
  initializeProcessPlanning,
  processActionState,
  setCurrentProcessStep,
  toggleProcessStep,
} from '../src/lib/processPlanning.js'

test('addBusinessDays ignora sábado e domingo', () => {
  assert.equal(addBusinessDays('2026-09-11', 1), '2026-09-14')
  assert.equal(addBusinessDays('2026-09-11', 3), '2026-09-16')
})

test('inicializa etapa interna com prazo calculado e preserva previsão inicial', () => {
  const process = initializeProcessPlanning({
    status: 'Novo',
    previsaoConclusao: '2026-09-25',
    etapaAtual: 0,
    etapas: [{ id: 'a', nome: 'Protocolar', status: 'Pendente', ordem: 0, responsavelTipo: 'interno', prazoDias: 2 }],
  }, '2026-09-09')
  assert.equal(process.previsaoConclusaoInicial, '2026-09-25')
  assert.equal(process.etapas[0].prazoEtapa, '2026-09-11')
  assert.equal(process.etapas[0].ativadaEm, '2026-09-09')
  assert.equal(process.status, 'Em andamento')
})

test('etapa externa entra como aguardando e recebe próxima conferência', () => {
  const process = initializeProcessPlanning({
    status: 'Novo', etapaAtual: 0,
    etapas: [{ id: 'a', nome: 'Assinatura', status: 'Pendente', ordem: 0, responsavelTipo: 'cliente', followupDias: 3 }],
  }, '2026-09-09')
  assert.equal(process.status, 'Aguardando cliente')
  assert.equal(process.etapas[0].aguardandoDesde, '2026-09-09')
  assert.equal(process.etapas[0].proximaRevisao, '2026-09-14')
})

test('concluir etapa atual avança e ativa próxima etapa', () => {
  const process = initializeProcessPlanning({
    status: 'Em andamento', etapaAtual: 0,
    etapas: [
      { id: 'a', nome: 'Preparar', status: 'Pendente', ordem: 0, responsavelTipo: 'interno', prazoDias: 1 },
      { id: 'b', nome: 'Aguardar Junta', status: 'Pendente', ordem: 1, responsavelTipo: 'orgao', followupDias: 2 },
    ],
  }, '2026-09-09')
  const result = toggleProcessStep(process, 'a', '2026-09-10')
  assert.equal(result.changed, true)
  assert.equal(result.process.etapas.find(step => step.id === 'a').status, 'Concluída')
  assert.equal(result.process.etapas.find(step => step.id === 'a').concluidoEm, '2026-09-10')
  assert.equal(result.process.etapaAtual, 1)
  assert.equal(result.process.status, 'Aguardando órgão')
  assert.equal(result.process.etapas.find(step => step.id === 'b').proximaRevisao, '2026-09-14')
})

test('continuar aguardando agenda nova conferência sem reiniciar espera', () => {
  const original = initializeProcessPlanning({
    status: 'Aguardando órgão', etapaAtual: 0,
    etapas: [{ id: 'a', nome: 'Análise', status: 'Pendente', ordem: 0, responsavelTipo: 'orgao', followupDias: 3 }],
  }, '2026-09-09')
  const result = continueProcessWaiting(original, '2026-09-14')
  assert.equal(result.changed, true)
  assert.equal(result.process.etapas[0].aguardandoDesde, '2026-09-09')
  assert.equal(result.process.etapas[0].proximaRevisao, '2026-09-17')
})

test('processActionState usa próxima conferência como data de ação', () => {
  const state = processActionState({
    prazoFinal: '2026-09-30',
    previsaoConclusao: '2026-09-25',
    etapaAtual: 0,
    etapas: [{ id: 'a', nome: 'Análise Junta', status: 'Pendente', ordem: 0, responsavelTipo: 'orgao', proximaRevisao: '2026-09-11', aguardandoDesde: '2026-09-09' }],
  }, { day: '2026-09-12' })
  assert.equal(state.actionDate, '2026-09-11')
  assert.equal(state.actionOverdue, true)
  assert.equal(state.level, 'critical')
  assert.match(state.actionLabel, /Conferir órgão/)
})

test('reabrir etapa concluída torna ela a etapa atual', () => {
  const result = toggleProcessStep({
    status: 'Em andamento', etapaAtual: 1,
    etapas: [
      { id: 'a', nome: 'Documentos', status: 'Concluída', ordem: 0, responsavelTipo: 'interno', concluidoEm: '2026-09-09' },
      { id: 'b', nome: 'Protocolo', status: 'Pendente', ordem: 1, responsavelTipo: 'interno' },
    ],
  }, 'a', '2026-09-10')
  assert.equal(result.reopened, true)
  assert.equal(result.process.etapaAtual, 0)
  assert.equal(result.process.etapas.find(step => step.id === 'a').status, 'Pendente')
  assert.equal(result.process.etapas.find(step => step.id === 'a').concluidoEm, '')
})

test('setCurrentProcessStep inicializa etapa escolhida', () => {
  const result = setCurrentProcessStep({
    status: 'Em andamento', etapaAtual: 0,
    etapas: [
      { id: 'a', nome: 'Primeira', status: 'Pendente', ordem: 0, responsavelTipo: 'interno' },
      { id: 'b', nome: 'Cliente', status: 'Pendente', ordem: 1, responsavelTipo: 'cliente', followupDias: 2 },
    ],
  }, 'b', '2026-09-09')
  assert.equal(result.changed, true)
  assert.equal(result.process.etapaAtual, 1)
  assert.equal(result.process.status, 'Aguardando cliente')
  assert.equal(result.process.etapas.find(step => step.id === 'b').proximaRevisao, '2026-09-11')
})
