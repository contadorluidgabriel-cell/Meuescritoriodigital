import { readFileSync, writeFileSync } from 'node:fs'
import { applyLegacySettingsBridgePatch } from './patch-legacy-settings-bridge.mjs'
import { applyFollowUpsPatch } from './patch-follow-ups.mjs'
import { applyFollowUpsLinkedV2 } from './patch-follow-ups-linked-v2.mjs'
import { applyFollowUpsFinalPatch } from './patch-follow-ups-final.mjs'
import { applyProcessCompletionPatch } from './patch-process-completion.mjs'

function replaceRequired(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source
  if (!source.includes(oldValue)) throw new Error(`Departments patch: missing ${label}`)
  return source.replace(oldValue, newValue)
}

export function applyDepartmentsPatch(root) {
  const legacyPath = `${root}legacy-v10-7.html`
  let legacy = readFileSync(legacyPath, 'utf8')
  if (!legacy.includes('MED_DEPARTMENTS_ALWAYS_AVAILABLE_V1')) {
    const getStart = legacy.indexOf('function getDepartments(){')
    const getEnd = legacy.indexOf('function applyIdentity(){', getStart)
    if (getStart < 0 || getEnd < 0) throw new Error('Departments patch: legacy getters not found')
    const getters = `/* MED_DEPARTMENTS_ALWAYS_AVAILABLE_V1 */\nfunction getDepartments(){const saved=Store.get(K.departments,null),seen=new Set(),names=[...DEPARTMENT_NAMES,...(Array.isArray(saved)?saved.map(x=>typeof x==='string'?x:x?.name):[]),'Comercial'];return names.filter(name=>{const key=String(name||'').trim().toLocaleLowerCase('pt-BR');if(!key||seen.has(key))return false;seen.add(key);return true}).map(name=>({name,active:true}))}\n`
    legacy = legacy.slice(0,getStart)+getters+legacy.slice(getEnd)

    const renderStart = legacy.indexOf('function renderDepartments(){')
    const renderEnd = legacy.indexOf('function ensureVisualThemeSelector(){',renderStart)
    if (renderStart < 0 || renderEnd < 0) throw new Error('Departments patch: legacy department renderer not found')
    const renderer = `function renderDepartments(){const el=document.getElementById('departmentList');if(!el)return;el.innerHTML=getDepartments().map(d=>` + '`' + `<div class="department-row"><div><strong>\${U.esc(d.name)}</strong><small>Disponível nos cadastros e filtros do escritório.</small></div></div>` + '`' + `).join('')}\n`
    legacy = legacy.slice(0,renderStart)+renderer+legacy.slice(renderEnd)
    legacy = replaceRequired(legacy,
      'Desativar uma área não apaga registros antigos; apenas retira a opção de novos cadastros.',
      'Áreas do escritório disponíveis para classificar os trabalhos.',
      'settings description')
    writeFileSync(legacyPath,legacy)
  }

  const taskPath = `${root}src/components/TasksReactBase.jsx`
  let tasks = readFileSync(taskPath,'utf8')
  tasks = replaceRequired(tasks,
    '(office.departments || []).filter(item => item.active !== false).map(item => item.name)',
    "(office.departments || []).map(item => typeof item === 'string' ? item : item?.name)",
    'task department choices')
  writeFileSync(taskPath,tasks)
  applyLegacySettingsBridgePatch(root)
  applyFollowUpsPatch(root)
  applyFollowUpsLinkedV2(root)
  applyFollowUpsFinalPatch(root)
  applyProcessCompletionPatch(root)
}
