import { useMemo, useState } from 'react'
import { uid } from '../lib/storage.js'
import { PROCESS_DEPENDENCIES } from '../lib/processPlanning.js'
import './models-react.css'

const taxOptions = ['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Outro']
const priorityOptions = ['Baixa', 'Normal', 'Alta', 'Urgente']
const recurrenceOptions = [
  ['', 'Não recorrente'],
  ['daily', 'Diária'],
  ['weekly', 'Semanal'],
  ['monthly', 'Mensal'],
]

const taskEmpty = {
  id: '', titulo: '', departamento: '', regimes: [], descricao: '', prioridade: 'Normal',
  diasPrazo: 0, recorrencia: '', usaCompetencia: false, competenciaAvancoAutomatico: true, subtarefas: '',
}
const processEmpty = { id: '', nome: '', departamento: '', descricao: '', etapas: [] }

const departmentName = item => typeof item === 'string' ? item : item?.name
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const stepText = step => step?.nome || ''

function allowed(access, key) {
  const membership = access?.membership || {}
  if (membership.role === 'partner' || membership.role === 'pending') return false
  const permissions = membership.permissions || {}
  return permissions.access_v2 === true ? permissions[key] === true : permissions[key] !== false
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <div className="models-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className={`models-modal-card ${wide ? 'wide' : ''}`}>
      <header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      {children}
    </div>
  </div>
}

function Field({ label, full = false, hint, children }) {
  return <label className={`models-field ${full ? 'full' : ''}`}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

export default function ModelsReact({ office, update, sync, access }) {
  const canTasks = allowed(access, 'tasks')
  const canProcesses = allowed(access, 'processes')
  const defaultTab = canTasks ? 'tasks' : 'processes'
  const [tab, setTab] = useState(defaultTab)
  const [department, setDepartment] = useState('')
  const [query, setQuery] = useState('')
  const [taskEditing, setTaskEditing] = useState(null)
  const [processEditing, setProcessEditing] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const departments = useMemo(() => [...new Set((office.departments || [])
    .filter(item => typeof item === 'string' || item?.active !== false)
    .map(departmentName)
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [office.departments])

  const taskModels = useMemo(() => (office.taskTemplates || []).filter(model => {
    if (department && String(model.departamento || '') !== department) return false
    if (query && !normalize(`${model.titulo} ${model.descricao} ${model.departamento} ${(model.regimes || []).join(' ')}`).includes(normalize(query))) return false
    return true
  }).sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR')), [department, office.taskTemplates, query])

  const processModels = useMemo(() => (office.processModels || []).filter(model => {
    if (department && String(model.departamento || '') !== department) return false
    if (query && !normalize(`${model.nome} ${model.descricao} ${model.departamento} ${(model.etapas || []).map(stepText).join(' ')}`).includes(normalize(query))) return false
    return true
  }).sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')), [department, office.processModels, query])

  function switchTab(next) {
    setTab(next)
    setQuery('')
    setDepartment('')
  }

  function openTask(model = null) {
    setError('')
    setTaskEditing(model ? {
      ...taskEmpty,
      ...structuredClone(model),
      regimes: [...(model.regimes || [])],
      subtarefas: (model.subtarefas || []).map(item => item?.titulo || item?.nome || String(item)).join('\n'),
    } : { ...taskEmpty, regimes: [] })
  }

  function saveTask(event) {
    event.preventDefault()
    const title = String(taskEditing.titulo || '').trim()
    if (!title) { setError('Informe o título do modelo.'); return }
    const model = {
      ...taskEditing,
      id: taskEditing.id || uid('tmod'),
      titulo: title,
      departamento: String(taskEditing.departamento || ''),
      regimes: [...(taskEditing.regimes || [])],
      descricao: String(taskEditing.descricao || '').trim(),
      prioridade: taskEditing.prioridade || 'Normal',
      diasPrazo: Math.max(0, Number(taskEditing.diasPrazo) || 0),
      recorrencia: taskEditing.recorrencia || '',
      usaCompetencia: Boolean(taskEditing.usaCompetencia),
      competenciaAvancoAutomatico: Boolean(taskEditing.usaCompetencia && taskEditing.recorrencia === 'monthly' && taskEditing.competenciaAvancoAutomatico !== false),
      subtarefas: String(taskEditing.subtarefas || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean),
    }
    update(draft => {
      const current = draft.taskTemplates || []
      draft.taskTemplates = current.some(item => String(item.id) === String(model.id))
        ? current.map(item => String(item.id) === String(model.id) ? model : item)
        : [...current, model]
    })
    setTaskEditing(null)
    setNotice('Modelo de tarefa salvo.')
  }

  function removeTask(model) {
    if (!window.confirm(`Excluir o modelo “${model.titulo}”? As tarefas já criadas não serão alteradas.`)) return
    update(draft => { draft.taskTemplates = (draft.taskTemplates || []).filter(item => String(item.id) !== String(model.id)) })
    setNotice('Modelo de tarefa excluído.')
  }

  function toggleRegime(regime) {
    setTaskEditing(current => ({ ...current, regimes: current.regimes.includes(regime) ? current.regimes.filter(item => item !== regime) : [...current.regimes, regime] }))
  }

  function openProcess(model = null) {
    setError('')
    setProcessEditing(model ? {
      ...processEmpty,
      ...structuredClone(model),
      etapas: (model.etapas || []).map((step, index) => ({
        id: step.id || uid('met'),
        nome: step.nome || '',
        opcional: Boolean(step.opcional),
        responsavelTipo: step.responsavelTipo || 'interno',
        prazoDias: Math.max(0, Number(step.prazoDias) || 0),
        followupDias: Math.max(1, Number(step.followupDias) || 3),
        ordem: index,
      })),
    } : { ...processEmpty, etapas: [] })
  }

  function addStep() {
    setProcessEditing(current => ({ ...current, etapas: [...current.etapas, { id: uid('met'), nome: '', opcional: false, responsavelTipo: 'interno', prazoDias: 1, followupDias: 3, ordem: current.etapas.length }] }))
  }

  function patchStep(index, patch) {
    setProcessEditing(current => ({ ...current, etapas: current.etapas.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step) }))
  }

  function removeStep(index) {
    setProcessEditing(current => ({ ...current, etapas: current.etapas.filter((_, stepIndex) => stepIndex !== index).map((step, order) => ({ ...step, ordem: order })) }))
  }

  function moveStep(index, direction) {
    setProcessEditing(current => {
      const target = index + direction
      if (target < 0 || target >= current.etapas.length) return current
      const steps = [...current.etapas]
      ;[steps[index], steps[target]] = [steps[target], steps[index]]
      return { ...current, etapas: steps.map((step, order) => ({ ...step, ordem: order })) }
    })
  }

  function saveProcess(event) {
    event.preventDefault()
    const name = String(processEditing.nome || '').trim()
    const steps = (processEditing.etapas || []).map((step, index) => ({
      id: step.id || uid('met'),
      nome: String(step.nome || '').trim(),
      opcional: Boolean(step.opcional),
      responsavelTipo: step.responsavelTipo || 'interno',
      prazoDias: Math.max(0, Number(step.prazoDias) || 0),
      followupDias: Math.max(1, Number(step.followupDias) || 3),
      ordem: index,
    })).filter(step => step.nome)
    if (!name) { setError('Informe o nome do modelo.'); return }
    if (!steps.length) { setError('Adicione pelo menos uma etapa ao processo.'); return }
    const model = {
      ...processEditing,
      id: processEditing.id || uid('pmod'),
      nome: name,
      departamento: String(processEditing.departamento || ''),
      descricao: String(processEditing.descricao || '').trim(),
      etapas: steps,
    }
    update(draft => {
      const current = draft.processModels || []
      draft.processModels = current.some(item => String(item.id) === String(model.id))
        ? current.map(item => String(item.id) === String(model.id) ? model : item)
        : [...current, model]
    })
    setProcessEditing(null)
    setNotice('Modelo de processo salvo.')
  }

  function removeProcess(model) {
    if (!window.confirm(`Excluir o modelo “${model.nome}”? Os processos já criados manterão suas etapas.`)) return
    update(draft => { draft.processModels = (draft.processModels || []).filter(item => String(item.id) !== String(model.id)) })
    setNotice('Modelo de processo excluído.')
  }

  if (!canTasks && !canProcesses) return <div className="models-page"><section className="models-empty-page"><h1>Modelos</h1><p>Seu acesso atual não permite gerenciar modelos de tarefas ou processos.</p></section></div>

  const visibleTab = tab === 'tasks' && !canTasks ? 'processes' : tab === 'processes' && !canProcesses ? 'tasks' : tab

  return <div className="react-module-page models-page">
    <div className="react-module-topbar"><div><h1>Modelos</h1><p>Padrões reutilizáveis para criar tarefas e processos sem misturar configuração com a operação diária.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}</span><button type="button" className="primary" onClick={() => visibleTab === 'tasks' ? openTask() : openProcess()}>+ Novo modelo</button></div></div>

    <div className="module-view-tabs models-main-tabs" role="tablist" aria-label="Tipos de modelos">
      {canTasks ? <button type="button" role="tab" aria-selected={visibleTab === 'tasks'} className={visibleTab === 'tasks' ? 'active' : ''} onClick={() => switchTab('tasks')}><span>Tarefas</span><b>{(office.taskTemplates || []).length}</b></button> : null}
      {canProcesses ? <button type="button" role="tab" aria-selected={visibleTab === 'processes'} className={visibleTab === 'processes' ? 'active' : ''} onClick={() => switchTab('processes')}><span>Processos</span><b>{(office.processModels || []).length}</b></button> : null}
    </div>

    <section className="models-card">
      <div className="models-toolbar"><input value={query} onChange={event => setQuery(event.target.value)} placeholder={visibleTab === 'tasks' ? 'Buscar modelo de tarefa' : 'Buscar modelo de processo'} /><select value={department} onChange={event => setDepartment(event.target.value)}><option value="">Todas as áreas</option>{departments.map(name => <option key={name}>{name}</option>)}</select></div>

      {visibleTab === 'tasks' ? <div className="models-grid">{taskModels.map(model => <article key={model.id} className="model-card"><header><div><span>TAREFA</span><h3>{model.titulo}</h3><p>{model.descricao || 'Sem descrição.'}</p></div><em>{model.diasPrazo || 0} dia(s)</em></header><div className="model-meta"><span>{model.departamento || 'Sem área'}</span><span>{model.recorrencia ? recurrenceOptions.find(([id]) => id === model.recorrencia)?.[1] || model.recorrencia : 'Não recorrente'}</span><span>{(model.subtarefas || []).length} subtarefa(s)</span></div><footer><button type="button" onClick={() => openTask(model)}>Editar</button><button type="button" className="danger-text" onClick={() => removeTask(model)}>Excluir</button></footer></article>)}{!taskModels.length ? <div className="models-empty">Nenhum modelo de tarefa encontrado nesta visão.</div> : null}</div> : null}

      {visibleTab === 'processes' ? <div className="models-grid">{processModels.map(model => <article key={model.id} className="model-card process-model-card"><header><div><span>PROCESSO</span><h3>{model.nome}</h3><p>{model.descricao || 'Sem descrição.'}</p></div><em>{(model.etapas || []).length} etapa(s)</em></header><div className="model-meta"><span>{model.departamento || 'Sem área'}</span></div><ol>{(model.etapas || []).map(step => <li key={step.id || step.nome}><b>{step.nome}</b><small>{PROCESS_DEPENDENCIES[step.responsavelTipo || 'interno']?.label || 'Escritório'} · {Math.max(0, Number(step.prazoDias) || 0)} dia(s) útil(eis){step.opcional ? ' · opcional' : ''}</small></li>)}</ol><footer><button type="button" onClick={() => openProcess(model)}>Editar</button><button type="button" className="danger-text" onClick={() => removeProcess(model)}>Excluir</button></footer></article>)}{!processModels.length ? <div className="models-empty">Nenhum modelo de processo encontrado nesta visão.</div> : null}</div> : null}
    </section>

    {notice ? <div className="models-notice" role="status">{notice}</div> : null}

    {taskEditing ? <Modal title={taskEditing.id ? 'Editar modelo de tarefa' : 'Novo modelo de tarefa'} subtitle="Defina o padrão. Os campos continuam editáveis ao criar uma tarefa." onClose={() => setTaskEditing(null)} wide><form className="models-form" onSubmit={saveTask}>
      <Field label="Título *" full><input value={taskEditing.titulo} onChange={event => setTaskEditing(current => ({ ...current, titulo: event.target.value }))} /></Field>
      <Field label="Área / departamento"><select value={taskEditing.departamento} onChange={event => setTaskEditing(current => ({ ...current, departamento: event.target.value }))}><option value="">Sem área específica</option>{departments.map(name => <option key={name}>{name}</option>)}</select></Field>
      <Field label="Prioridade"><select value={taskEditing.prioridade} onChange={event => setTaskEditing(current => ({ ...current, prioridade: event.target.value }))}>{priorityOptions.map(item => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Prazo em dias"><input type="number" min="0" step="1" value={taskEditing.diasPrazo} onChange={event => setTaskEditing(current => ({ ...current, diasPrazo: event.target.value }))} /></Field>
      <Field label="Recorrência"><select value={taskEditing.recorrencia} onChange={event => setTaskEditing(current => ({ ...current, recorrencia: event.target.value, competenciaAvancoAutomatico: event.target.value === 'monthly' ? current.competenciaAvancoAutomatico !== false : false }))}>{recurrenceOptions.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></Field>
      <Field label="Regimes" full><div className="models-choice-list">{taxOptions.map(regime => <label key={regime}><input type="checkbox" checked={taskEditing.regimes.includes(regime)} onChange={() => toggleRegime(regime)} /> {regime}</label>)}</div></Field>
      <Field label="Competência" full><div className="models-choice-list stacked"><label><input type="checkbox" checked={Boolean(taskEditing.usaCompetencia)} onChange={event => setTaskEditing(current => ({ ...current, usaCompetencia: event.target.checked, competenciaAvancoAutomatico: event.target.checked && current.recorrencia === 'monthly' ? current.competenciaAvancoAutomatico !== false : false }))} /> Tarefas deste modelo usam competência</label>{taskEditing.usaCompetencia && taskEditing.recorrencia === 'monthly' ? <label><input type="checkbox" checked={taskEditing.competenciaAvancoAutomatico !== false} onChange={event => setTaskEditing(current => ({ ...current, competenciaAvancoAutomatico: event.target.checked }))} /> Avançar competência com a recorrência mensal</label> : null}</div></Field>
      <Field label="Descrição" full><textarea value={taskEditing.descricao} onChange={event => setTaskEditing(current => ({ ...current, descricao: event.target.value }))} /></Field>
      <Field label="Subtarefas" full hint="Uma por linha."><textarea value={taskEditing.subtarefas} onChange={event => setTaskEditing(current => ({ ...current, subtarefas: event.target.value }))} placeholder={'Solicitar documentos\nConferir dados\nTransmitir'} /></Field>
      {error ? <p className="models-error">{error}</p> : null}<footer className="models-form-actions"><button type="button" onClick={() => setTaskEditing(null)}>Cancelar</button><button className="primary">Salvar modelo</button></footer>
    </form></Modal> : null}

    {processEditing ? <Modal title={processEditing.id ? 'Editar modelo de processo' : 'Novo modelo de processo'} subtitle="Monte o fluxo padrão de etapas. Processos já criados não são alterados." onClose={() => setProcessEditing(null)} wide><form className="models-form" onSubmit={saveProcess}>
      <Field label="Nome *"><input value={processEditing.nome} onChange={event => setProcessEditing(current => ({ ...current, nome: event.target.value }))} /></Field>
      <Field label="Área / departamento"><select value={processEditing.departamento || ''} onChange={event => setProcessEditing(current => ({ ...current, departamento: event.target.value }))}><option value="">Sem área específica</option>{departments.map(name => <option key={name}>{name}</option>)}</select></Field>
      <Field label="Descrição" full><textarea value={processEditing.descricao} onChange={event => setProcessEditing(current => ({ ...current, descricao: event.target.value }))} /></Field>
      <div className="models-field full process-model-steps"><div className="process-model-steps-head"><span>Etapas *</span><button type="button" onClick={addStep}>+ Etapa</button></div>{processEditing.etapas.map((step, index) => <article key={step.id || index}><div className="step-order"><button type="button" disabled={!index} onClick={() => moveStep(index, -1)}>↑</button><button type="button" disabled={index === processEditing.etapas.length - 1} onClick={() => moveStep(index, 1)}>↓</button></div><div className="step-fields"><input value={step.nome} onChange={event => patchStep(index, { nome: event.target.value })} placeholder="Nome da etapa" /><select value={step.responsavelTipo || 'interno'} onChange={event => patchStep(index, { responsavelTipo: event.target.value })}>{Object.values(PROCESS_DEPENDENCIES).map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select><label><span>Prazo útil</span><input type="number" min="0" step="1" value={step.prazoDias} onChange={event => patchStep(index, { prazoDias: event.target.value })} /></label>{step.responsavelTipo !== 'interno' ? <label><span>Revisar a cada</span><input type="number" min="1" step="1" value={step.followupDias} onChange={event => patchStep(index, { followupDias: event.target.value })} /></label> : null}<label className="step-optional"><input type="checkbox" checked={Boolean(step.opcional)} onChange={event => patchStep(index, { opcional: event.target.checked })} /> Opcional</label></div><button type="button" className="step-remove" onClick={() => removeStep(index)}>×</button></article>)}{!processEditing.etapas.length ? <p>Nenhuma etapa adicionada.</p> : null}</div>
      {error ? <p className="models-error">{error}</p> : null}<footer className="models-form-actions"><button type="button" onClick={() => setProcessEditing(null)}>Cancelar</button><button className="primary">Salvar modelo</button></footer>
    </form></Modal> : null}
  </div>
}
