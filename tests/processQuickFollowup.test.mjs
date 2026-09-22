import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')

test('conclusão rápida oferece opção sem acompanhamento e com acompanhamento opcional', () => {
  const process = read('src/components/ProcessesReact.jsx')
  assert.match(process, /Concluir processo<\/button>/)
  assert.match(process, /Concluir e acompanhar<\/button>/)
  assert.match(process, /action\.allStepsDone && action\.stepCount > 0 && !isDone\(process\.status\)/)
  assert.match(process, /!followUps\?\.records\?\.some\(row => row\.status === 'active' && row\.sourceType === 'process'/)
})

test('concluir e acompanhar encerra processo e abre rascunho vinculado, sem criar automaticamente', () => {
  const process = read('src/components/ProcessesReact.jsx')
  assert.match(process, /item\.status = 'Concluído'; item\.dataConclusao = today\(\)/)
  assert.match(process, /onStartFollowUp\?\.\(\{ sourceType: 'process', sourceId: process\.id, clientId: process\.clientId/)
  assert.match(process, /onStartFollowUp=\{onStartFollowUp\} update=\{update\}/)
  const app = read('src/App.jsx')
  assert.match(app, /onStartFollowUp=\{startFollowUpFromWork\}/)
  const followUps = read('src/components/FollowUpsWorkspace.jsx')
  assert.match(followUps, /createRequest && createDraft/)
  assert.match(followUps, /Salvar acompanhamento/)
})
