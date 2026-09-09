import test from 'node:test'
import assert from 'node:assert/strict'
import { processActionState } from '../src/lib/processPlanning.js'

test('processo com todas as etapas concluídas pede encerramento, não reexecução', () => {
  const state = processActionState({
    status: 'Em andamento',
    previsaoConclusao: '2026-09-15',
    prazoFinal: '2026-09-20',
    etapaAtual: 1,
    etapas: [
      { id: 'a', nome: 'Documentos', status: 'Concluída', ordem: 0, responsavelTipo: 'interno' },
      { id: 'b', nome: 'Protocolar', status: 'Concluída', ordem: 1, responsavelTipo: 'interno' },
    ],
  }, { day: '2026-09-12' })
  assert.equal(state.step, null)
  assert.equal(state.allStepsDone, true)
  assert.equal(state.actionLabel, 'Concluir processo')
  assert.equal(state.actionDate, '2026-09-15')
})
