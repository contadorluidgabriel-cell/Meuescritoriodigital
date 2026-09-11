import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('menu lateral nao expõe Pendencias como modulo duplicado', () => {
  const source = read('src/components/AppChrome.jsx')
  assert.equal(source.includes("common.pending"), false)
  assert.match(source, /Visão geral'.*common\.myDay, common\.calendar/s)
  assert.match(source, /Gestão'.*Painel do Escritório/s)
})

test('Meu Dia possui somente Hoje, Pendencias e Proximos', () => {
  const source = read('src/components/OperationalCommandCenter.jsx')
  assert.match(source, /\['today', 'Hoje'\]/)
  assert.match(source, /\['pending', 'Pendências'\]/)
  assert.match(source, /\['upcoming', 'Próximos'\]/)
  assert.equal(source.includes("['metrics', 'Indicadores']"), false)
  assert.equal(source.includes("['ask', 'Consultar']"), false)
  assert.match(source, /WorkHorizonBoard/)
})

test('Painel do Escritorio e gerencial e nao executa conclusoes operacionais', () => {
  const source = read('src/components/Dashboard.jsx')
  assert.match(source, /MED_MANAGEMENT_DASHBOARD/)
  assert.match(source, /buildManagementDashboard/)
  assert.match(source, /O que merece sua atenção/)
  assert.match(source, /Saúde por departamento/)
  assert.match(source, /Visão gerencial/)
  assert.equal(source.includes('useGoogleTasks('), false)
  assert.equal(source.includes('function completeItems'), false)
  assert.equal(source.includes('completeTask('), false)
  assert.equal(source.includes('appendNextRecurringTask'), false)
  assert.equal(source.includes('TaskQuickExecution'), false)
})

test('Painel executivo usa hierarquia visual sem multiplicar cards aninhados', () => {
  const source = read('src/components/Dashboard.jsx')
  const css = read('src/management-dashboard.css')
  assert.match(source, /mgmt-focus-grid/)
  assert.match(source, /mgmt-finance-result/)
  assert.match(source, /mgmt-aging-track/)
  assert.match(source, /mgmt-health-track/)
  assert.match(source, /pontos vs\. mês anterior/)
  assert.equal(source.includes('p.p.'), false)
  assert.match(css, /\.mgmt-focus-grid/)
  assert.match(css, /grid-template-columns:minmax\(0,1\.6fr\)/)
  assert.match(css, /\.mgmt-finance-result/)
  assert.match(css, /\.mgmt-aging-track/)
  assert.match(css, /\.mgmt-health-track/)
})

test('horizonte operacional suporta modo hoje e proximos sem duplicar telas', () => {
  const source = read('src/components/WorkHorizonBoard.jsx')
  assert.match(source, /mode === 'today'/)
  assert.match(source, /mode === 'upcoming'/)
  assert.match(source, /\['week', 'month'\]/)
  assert.match(source, /onShowPending/)
})

test('Meu Dia abre focado em tarefas processos e obrigacoes', () => {
  const board = read('src/components/WorkHorizonBoard.jsx')
  const view = read('src/lib/workBoardView.js')
  assert.match(board, /useState\('operation'\)/)
  assert.match(board, /\['operation', 'Operação'\]/)
  assert.match(board, /\['finance', 'Financeiro'\]/)
  assert.match(board, /Tarefas/)
  assert.match(board, /Processos/)
  assert.match(board, /Obrigações/)
  assert.match(board, /finance-option/)
  assert.match(view, /operationalTypes = \['task', 'process', 'obligation'\]/)
  assert.match(view, /type === 'operation'/)
})
