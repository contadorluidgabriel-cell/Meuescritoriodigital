import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  processActionState,
  setCurrentProcessStep,
  setProcessStepStatus,
  toggleProcessStep,
} from '../src/lib/processPlanning.js'

const completed = () => ({
  id: 'proc-ficticio',
  status: 'Concluído',
  dataConclusao: '2026-09-20',
  etapaAtual: 1,
  etapas: [
    { id: 'a', nome: 'Documentos', ordem: 0, status: 'Concluída', responsavelTipo: 'interno', concluidoEm: '2026-09-19' },
    { id: 'b', nome: 'Protocolo', ordem: 1, status: 'Concluída', responsavelTipo: 'interno', concluidoEm: '2026-09-20' },
  ],
})

test('reabrir etapa por alternância reabre processo, limpa datas e recoloca próxima ação', () => {
  const result = toggleProcessStep(completed(), 'a', '2026-09-22')
  assert.equal(result.changed, true)
  assert.equal(result.reopened, true)
  assert.equal(result.process.status, 'Em andamento')
  assert.equal(result.process.dataConclusao, '')
  assert.equal(result.process.etapaAtual, 0)
  assert.equal(result.process.etapas[0].status, 'Pendente')
  assert.equal(result.process.etapas[0].concluidoEm, '')
  assert.match(processActionState(result.process, { day: '2026-09-22' }).actionLabel, /Documentos/)
  assert.equal(completed().status, 'Concluído')
})

test('reabrir etapa por controle de status também reabre processo', () => {
  const result = setProcessStepStatus(completed(), 'b', 'Em andamento', { baseDate: '2026-09-22' })
  assert.equal(result.changed, true)
  assert.equal(result.process.status, 'Em andamento')
  assert.equal(result.process.dataConclusao, '')
  assert.equal(result.process.etapaAtual, 1)
  assert.equal(result.process.etapas[1].concluidoEm, '')
})

test('selecionar como atual uma etapa pendente reabre processo já encerrado', () => {
  const original = completed()
  original.etapas[0].status = 'Pendente'
  const result = setCurrentProcessStep(original, 'a', '2026-09-22')
  assert.equal(result.process.status, 'Em andamento')
  assert.equal(result.process.dataConclusao, '')
  assert.equal(result.process.etapaAtual, 0)
})

test('última etapa terminada oferece encerramento explícito no detalhe', () => {
  const original = completed()
  original.status = 'Em andamento'
  original.dataConclusao = ''
  const action = processActionState(original, { day: '2026-09-22' })
  assert.equal(action.allStepsDone, true)
  assert.equal(action.actionLabel, 'Concluir processo')
  const ui = readFileSync('src/components/ProcessesReact.jsx', 'utf8')
  assert.match(ui, /action\.allStepsDone && action\.stepCount > 0 && !isDone\(process\.status\)/)
  assert.match(ui, /item\.status = 'Concluído'; item\.dataConclusao = today\(\)/)
})

test('edição salva status novo e não conserva data de uma etapa reaberta', () => {
  const ui = readFileSync('src/components/ProcessesReact.jsx', 'utf8')
  assert.match(ui, /status: step\.status \|\| previous\?\.status \|\| 'Pendente'/)
  assert.doesNotMatch(ui, /status: previous\?\.status \|\| step\.status/)
  assert.match(ui, /concluidoEm: processStepSettled\(step\.status \|\| previous\?\.status\) \?/)
  assert.match(ui, /else normalized\.dataConclusao = ''/)
})
