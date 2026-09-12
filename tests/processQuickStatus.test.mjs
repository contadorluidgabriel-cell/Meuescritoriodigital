import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const quick = readFileSync(new URL('../src/components/ProcessStepQuickStatus.jsx', import.meta.url), 'utf8')
const horizon = readFileSync(new URL('../src/components/WorkHorizonBoard.jsx', import.meta.url), 'utf8')
const patch = readFileSync(new URL('../scripts/patch-process-step-statuses.mjs', import.meta.url), 'utf8')

test('controle rápido altera somente o status da etapa pelo domínio de processos', () => {
  assert.match(quick, /PROCESS_STEP_STATUSES/)
  assert.match(quick, /setProcessStepStatus/)
  assert.match(quick, /Aguardando em \/ por/)
})

test('Meu Dia permite atualizar processo sem abrir o cadastro completo', () => {
  assert.match(horizon, /ProcessStepQuickStatus/)
  assert.match(horizon, /Andamento do processo atualizado/)
  assert.match(horizon, /v12-process-actions/)
})

test('detalhe do processo recebe o mesmo controle rápido por etapa', () => {
  assert.match(patch, /ProcessStepQuickStatus/)
  assert.match(patch, /onChangeProcess=\{next => mutate\(item => Object\.assign\(item, next\)\)\}/)
})
