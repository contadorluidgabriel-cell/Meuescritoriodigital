import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const viewSource = readFileSync('src/lib/moduleViews.js', 'utf8')

test('Tarefas usa A Fazer e Concluídas e direciona Modelos para a área própria', () => {
  const source = readFileSync('src/components/TasksReactBase.jsx', 'utf8')
  assert.match(source, /MED_TASK_OPERATIONAL_VIEWS_V1/)
  for (const label of ['A Fazer', 'Concluídas']) assert.match(viewSource, new RegExp(label))
  assert.match(source, /taskViewOf\(task\)/)
  assert.match(source, /onNavigate\?\.\('modelos'\)/)
  assert.doesNotMatch(source, /onClick=\{\(\) => setView\('models'\)\}>Modelos/)
})

test('Processos usa execução, espera externa e concluídos como visões', () => {
  const source = readFileSync('src/components/ProcessesReact.jsx', 'utf8')
  assert.match(source, /MED_PROCESS_OPERATIONAL_VIEWS_V1/)
  for (const label of ['Em andamento', 'Aguardando terceiros\/cliente', 'Concluídos']) assert.match(viewSource, new RegExp(label))
  assert.match(source, /processViewOf\(process\) === processView/)
  assert.match(source, /onNavigate\?\.\('modelos'\)/)
})

test('Obrigações possui Pendentes, Em andamento, Concluídas e Todas', () => {
  const source = readFileSync('src/components/ObligationsWorkspace.jsx', 'utf8')
  assert.match(source, /MED_OBLIGATION_OPERATIONAL_VIEWS_V1/)
  for (const label of ['Pendentes', 'Em andamento', 'Concluídas', 'Todas']) assert.match(viewSource, new RegExp(label))
  assert.match(source, /obligationViewOf\(obligation\) === tab/)
  assert.match(source, /tab === 'all' \? matchingRows/)
  assert.match(source, /tab=\{tab === 'completed' \? 'history' : 'open'\}/)
})

test('Parceiros separa ativos e inativos sem criar outra base', () => {
  const source = readFileSync('src/components/PartnersPanel.jsx', 'utf8')
  assert.match(source, /MED_PARTNER_OPERATIONAL_VIEWS_V1/)
  assert.match(source, /PARTNER_VIEW_OPTIONS/)
  assert.match(source, /partnerViewOf\(partner\) === partnerView/)
  assert.match(source, /setPartnerView\(partnerViewOf\(record\)\)/)
})

test('Modelos vira área própria com Tarefas e Processos e filtro por área', () => {
  const app = readFileSync('src/App.jsx', 'utf8')
  const chrome = readFileSync('src/components/AppChrome.jsx', 'utf8')
  const source = readFileSync('src/components/ModelsReact.jsx', 'utf8')
  assert.match(app, /view === 'modelos'/)
  assert.match(app, /<ModelsReact office=\{office\}/)
  assert.match(chrome, /models: item\('modelos', 'Modelos'/)
  assert.match(chrome, /modelos: 'Modelos'/)
  assert.match(source, /Tipos de modelos/)
  assert.match(source, />Tarefas</)
  assert.match(source, />Processos</)
  assert.match(source, /Todas as áreas/)
  assert.match(source, /office\.taskTemplates/)
  assert.match(source, /office\.processModels/)
})
