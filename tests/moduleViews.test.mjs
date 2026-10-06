import test from 'node:test'
import assert from 'node:assert/strict'
import { obligationViewOf, partnerViewOf, processViewOf, taskViewOf } from '../src/lib/moduleViews.js'

test('processos são classificados sem duplicar a base', () => {
  assert.equal(processViewOf({ status: 'Concluído', etapas: [] }), 'completed')
  assert.equal(processViewOf({
    status: 'Aguardando cliente',
    etapaAtual: 0,
    etapas: [{ id: 'e1', nome: 'Documentos', status: 'Aguardando cliente', responsavelTipo: 'cliente', ativa: true, ordem: 0 }],
  }), 'waiting')
  assert.equal(processViewOf({
    status: 'Em andamento',
    etapaAtual: 0,
    etapas: [{ id: 'e1', nome: 'Analisar', status: 'Em andamento', responsavelTipo: 'interno', ativa: true, ordem: 0 }],
  }), 'active')
})

test('tarefas priorizam conclusão e aguardando cliente antes da responsabilidade', () => {
  assert.equal(taskViewOf({ status: 'Concluída', responsavelUserId: 'u1' }, 'u1'), 'completed')
  assert.equal(taskViewOf({ status: 'Aguardando cliente', responsavelUserId: 'u1' }, 'u1'), 'waiting')
  assert.equal(taskViewOf({ status: 'Pendente', responsavelUserId: 'u1' }, 'u1'), 'mine')
  assert.equal(taskViewOf({ status: 'Em andamento', responsavelUserId: 'u2' }, 'u1'), 'team')
  assert.equal(taskViewOf({ status: 'Pendente', responsavelUserId: '' }, 'u1'), 'mine')
  assert.equal(taskViewOf({ status: 'Pendente', responsavelUserId: '', compartilhadoParceiroId: 'p1' }, 'u1'), 'team')
})

test('obrigações usam o andamento agregado dos vínculos', () => {
  assert.equal(obligationViewOf({ clientes: [{ status: 'Pendente' }, { status: 'Pendente' }] }), 'pending')
  assert.equal(obligationViewOf({ clientes: [{ status: 'Em andamento' }, { status: 'Pendente' }] }), 'progress')
  assert.equal(obligationViewOf({ clientes: [{ status: 'Aguardando cliente' }] }), 'progress')
  assert.equal(obligationViewOf({ clientes: [{ status: 'Concluída' }, { status: 'Pendente' }] }), 'progress')
  assert.equal(obligationViewOf({ clientes: [{ status: 'Concluída' }, { status: 'Não se aplica' }] }), 'completed')
})

test('parceiros ativos e inativos continuam na mesma coleção', () => {
  assert.equal(partnerViewOf({ status: 'Ativo' }), 'active')
  assert.equal(partnerViewOf({ status: 'Inativo' }), 'inactive')
  assert.equal(partnerViewOf({}), 'active')
})
