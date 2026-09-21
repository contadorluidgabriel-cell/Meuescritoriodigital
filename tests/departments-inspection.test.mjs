import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import test from 'node:test'
import { normalizeDepartments, DEFAULT_DEPARTMENT_NAMES } from '../src/lib/departments.js'
import { defaults, payloadToOffice } from '../src/lib/storage.js'
import { applyDepartmentsPatch } from '../scripts/patch-departments.mjs'

const names = departments => departments.map(item => item.name)

test('novos escritórios têm os cinco departamentos anteriores e Comercial', () => {
  assert.deepEqual(names(defaults.departments), [...DEFAULT_DEPARTMENT_NAMES])
  assert.ok(defaults.departments.every(item => item.active === true))
})

test('migração preserva departamentos existentes, reativa os legados e acrescenta Comercial uma vez', () => {
  const source = [{name:'Fiscal',active:false,id:'antigo'}, {name:'Personalizado',active:false}, 'DP']
  const departments = normalizeDepartments(source)
  assert.deepEqual(names(departments), ['Fiscal','Personalizado','DP','Comercial'])
  assert.equal(departments[0].id, 'antigo')
  assert.ok(departments.every(item => item.active === true))
  assert.deepEqual(normalizeDepartments(departments), departments)
  assert.equal(source[0].active,false)
})

test('snapshot existente inclui Comercial sem alterar as demais coleções', () => {
  const source = {med_departamentos:[{name:'Fiscal',active:false}],med_tarefas:[{id:'t1',titulo:'Antiga'}]}
  const office = payloadToOffice(source)
  assert.deepEqual(names(office.departments),['Fiscal','Comercial'])
  assert.deepEqual(office.tasks,source.med_tarefas)
  assert.equal(source.med_departamentos[0].active,false)
})

test('interface de Configurações lista departamentos sem interruptor e Tarefas não filtra inativos', () => {
  const html = readFileSync('legacy-v10-7.html','utf8')
  const start = html.indexOf('function renderDepartments(){')
  const end = html.indexOf('function ensureVisualThemeSelector(){',start)
  assert.ok(start>0 && end>start)
  const renderer = html.slice(start,end)
  assert.ok(renderer.includes('Disponível nos cadastros e filtros do escritório.'))
  assert.ok(!renderer.includes('data-department-index'))
  assert.ok(!renderer.includes('input type="checkbox"'))
  assert.ok(html.includes('MED_DEPARTMENTS_ALWAYS_AVAILABLE_V1'))
  assert.ok(html.includes("'Comercial'"))
  const task = readFileSync('src/components/TasksReactBase.jsx','utf8')
  assert.ok(!task.includes('filter(item => item.active !== false)'))
  assert.ok(task.includes("(office.departments || []).map(item => typeof item === 'string' ? item : item?.name)"))
})

test('patch pode ser executado duas vezes sem modificar novamente o conteúdo', () => {
  const htmlBefore = readFileSync('legacy-v10-7.html','utf8')
  const taskBefore = readFileSync('src/components/TasksReactBase.jsx','utf8')
  applyDepartmentsPatch(`${process.cwd()}/`)
  assert.equal(readFileSync('legacy-v10-7.html','utf8'),htmlBefore)
  assert.equal(readFileSync('src/components/TasksReactBase.jsx','utf8'),taskBefore)
})
