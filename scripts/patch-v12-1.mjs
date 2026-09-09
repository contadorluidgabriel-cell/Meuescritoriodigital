import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (!source.includes(from)) throw new Error(`V12.1 patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

function patchProcesses(root) {
  const path = `${root}src/components/ProcessesReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("processActionState } from '../lib/processPlanning.js'")) return

  source = replaceRequired(
    source,
    "import { buildProcessFinanceCharges, normalizedProcessFinance, processFinanceError, processHasFinanceCharge } from '../lib/processFinance.js'",
    "import { buildProcessFinanceCharges, normalizedProcessFinance, processFinanceError, processHasFinanceCharge } from '../lib/processFinance.js'\nimport { PROCESS_DEPENDENCIES, continueProcessWaiting, initializeProcessPlanning, processActionState, setCurrentProcessStep, toggleProcessStep } from '../lib/processPlanning.js'\nimport '../process-planning-v12-1.css'",
    'process planning imports',
    path,
  )

  source = replaceRequired(
    source,
    "function add() { onChange([...steps, { id: uid(modelMode ? 'me' : 'et'), nome: '', opcional: false, included: true, ativa: true, status: 'Pendente' }]) }",
    "function add() { onChange([...steps, { id: uid(modelMode ? 'me' : 'et'), nome: '', opcional: false, included: true, ativa: true, status: 'Pendente', responsavelTipo: 'interno', prazoDias: 1, followupDias: 3, prazoEtapa: '', proximaRevisao: '', aguardandoDesde: '', concluidoEm: '' }]) }",
    'new step planning defaults',
    path,
  )

  const stepInput = "<input value={step.nome || ''} onChange={event => patchStep(index, { nome: event.target.value })} placeholder=\"Nome da etapa\" /><div className=\"process-step-options\">"
  const stepPlanning = `<input value={step.nome || ''} onChange={event => patchStep(index, { nome: event.target.value })} placeholder="Nome da etapa" /><div className="process-step-planning"><label><span>Depende de</span><select value={step.responsavelTipo || 'interno'} onChange={event => patchStep(index, { responsavelTipo: event.target.value, proximaRevisao: event.target.value === 'interno' ? '' : step.proximaRevisao, aguardandoDesde: event.target.value === 'interno' ? '' : step.aguardandoDesde })}>{Object.values(PROCESS_DEPENDENCIES).map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>{modelMode ? <label><span>Prazo ao ativar</span><div className="process-step-number"><input type="number" min="0" max="365" value={step.prazoDias ?? 1} onChange={event => patchStep(index, { prazoDias: Math.max(0, Number(event.target.value) || 0) })} /><em>dias úteis</em></div></label> : <label><span>Prazo da etapa</span><input type="date" value={step.prazoEtapa || ''} onChange={event => patchStep(index, { prazoEtapa: event.target.value })} /></label>}{(step.responsavelTipo || 'interno') !== 'interno' ? modelMode ? <label><span>Revisar a cada</span><div className="process-step-number"><input type="number" min="1" max="365" value={step.followupDias ?? 3} onChange={event => patchStep(index, { followupDias: Math.max(1, Number(event.target.value) || 1) })} /><em>dias úteis</em></div></label> : <><label><span>Próxima conferência</span><input type="date" value={step.proximaRevisao || ''} onChange={event => patchStep(index, { proximaRevisao: event.target.value })} /></label><label><span>Aguardando desde</span><input type="date" value={step.aguardandoDesde || ''} onChange={event => patchStep(index, { aguardandoDesde: event.target.value })} /></label></> : null}</div><div className="process-step-options">`
  source = replaceRequired(source, stepInput, stepPlanning, 'step planning editor', path)

  source = replaceRequired(
    source,
    "const name = draft.nome.trim(), steps = draft.etapas.map((step, index) => ({ id: step.id || uid('me'), nome: step.nome.trim(), opcional: step.opcional === true, ordem: index })).filter(step => step.nome)",
    "const name = draft.nome.trim(), steps = draft.etapas.map((step, index) => ({ id: step.id || uid('me'), nome: step.nome.trim(), opcional: step.opcional === true, ordem: index, responsavelTipo: step.responsavelTipo || 'interno', prazoDias: Math.max(0, Number(step.prazoDias) || 0), followupDias: Math.max(1, Number(step.followupDias) || 3) })).filter(step => step.nome)",
    'model planning save',
    path,
  )

  source = replaceRequired(
    source,
    "dataAbertura: process?.dataAbertura || today(), prazoFinal: process?.prazoFinal || '', status: process?.status || 'Novo'",
    "dataAbertura: process?.dataAbertura || today(), prazoFinal: process?.prazoFinal || '', previsaoConclusao: process?.previsaoConclusao || '', previsaoConclusaoInicial: process?.previsaoConclusaoInicial || '', status: process?.status || 'Novo'",
    'process forecast defaults',
    path,
  )

  source = replaceRequired(
    source,
    "etapas: orderedSteps(model.etapas).map(step => ({ ...step, id: uid('et'), status: 'Pendente', ativa: true, included: !step.opcional }))",
    "etapas: orderedSteps(model.etapas).map(step => ({ ...step, id: uid('et'), status: 'Pendente', ativa: true, included: !step.opcional, responsavelTipo: step.responsavelTipo || 'interno', prazoDias: Math.max(0, Number(step.prazoDias) || 0), followupDias: Math.max(1, Number(step.followupDias) || 3), prazoEtapa: '', proximaRevisao: '', aguardandoDesde: '', concluidoEm: '' }))",
    'apply model planning defaults',
    path,
  )

  const processStepsSave = "const steps = draft.etapas.filter(step => step.included !== false).map((step, index) => { const previous = previousByName.get(normalize(step.nome)); return { id: previous?.id || step.id || uid('et'), nome: step.nome.trim(), opcional: step.opcional === true, ativa: true, status: previous?.status || step.status || 'Pendente', ordem: index } }).filter(step => step.nome)"
  const processStepsSaveV121 = "const steps = draft.etapas.filter(step => step.included !== false).map((step, index) => { const previous = previousByName.get(normalize(step.nome)); return { id: previous?.id || step.id || uid('et'), nome: step.nome.trim(), opcional: step.opcional === true, ativa: true, status: previous?.status || step.status || 'Pendente', ordem: index, responsavelTipo: step.responsavelTipo || previous?.responsavelTipo || 'interno', prazoDias: Math.max(0, Number(step.prazoDias ?? previous?.prazoDias) || 0), followupDias: Math.max(1, Number(step.followupDias ?? previous?.followupDias) || 3), prazoEtapa: step.prazoEtapa || previous?.prazoEtapa || '', proximaRevisao: step.proximaRevisao || previous?.proximaRevisao || '', aguardandoDesde: step.aguardandoDesde || previous?.aguardandoDesde || '', concluidoEm: previous?.concluidoEm || step.concluidoEm || '', ativadaEm: previous?.ativadaEm || step.ativadaEm || '' } }).filter(step => step.nome)"
  source = replaceRequired(source, processStepsSave, processStepsSaveV121, 'process step planning save', path)

  source = replaceRequired(
    source,
    "<Field label=\"Data de abertura\"><input type=\"date\" value={draft.dataAbertura} onInput={event => setField('dataAbertura', event.currentTarget.value)} onChange={event => setField('dataAbertura', event.target.value)} /></Field><Field label=\"Prazo final\"><input type=\"date\" value={draft.prazoFinal} onInput={event => setField('prazoFinal', event.currentTarget.value)} onChange={event => setField('prazoFinal', event.target.value)} /></Field>",
    "<Field label=\"Data de abertura\"><input type=\"date\" value={draft.dataAbertura} onInput={event => setField('dataAbertura', event.currentTarget.value)} onChange={event => setField('dataAbertura', event.target.value)} /></Field><Field label=\"Conclusão interna prevista\" hint=\"Meta operacional do escritório; não substitui o prazo final.\"><input type=\"date\" value={draft.previsaoConclusao || ''} onInput={event => setField('previsaoConclusao', event.currentTarget.value)} onChange={event => setField('previsaoConclusao', event.target.value)} /></Field><Field label=\"Prazo final / externo\"><input type=\"date\" value={draft.prazoFinal} onInput={event => setField('prazoFinal', event.currentTarget.value)} onChange={event => setField('prazoFinal', event.target.value)} /></Field>",
    'process forecast fields',
    path,
  )

  source = replaceRequired(
    source,
    "const steps = orderedSteps(process.etapas), current = steps[Number(process.etapaAtual || 0)]",
    "const steps = orderedSteps(process.etapas), current = steps[Number(process.etapaAtual || 0)], action = processActionState(process)",
    'process details action state',
    path,
  )

  source = replaceRequired(
    source,
    "function setCurrent(stepId) { mutate(item => { item.etapaAtual = Math.max(0, orderedSteps(item.etapas).findIndex(step => String(step.id) === String(stepId))) }) }\n  function toggleStep(stepId) { mutate(item => { const step = item.etapas.find(row => String(row.id) === String(stepId)); if (step) step.status = isDone(step.status) ? 'Pendente' : 'Concluída' }) }",
    "function setCurrent(stepId) { mutate(item => { const result = setCurrentProcessStep(item, stepId); if (result.changed) Object.assign(item, result.process) }) }\n  function toggleStep(stepId) { mutate(item => { const result = toggleProcessStep(item, stepId); if (result.changed) Object.assign(item, result.process) }) }",
    'process detail domain actions',
    path,
  )

  source = replaceRequired(
    source,
    "function addStep() { const name = newStep.trim(); if (!name) return; mutate(item => { item.etapas = [...(item.etapas || []), { id: uid('et'), nome: name, opcional: false, ativa: true, status: 'Pendente', ordem: (item.etapas || []).length }] }); setNewStep('') }",
    "function addStep() { const name = newStep.trim(); if (!name) return; mutate(item => { item.etapas = [...(item.etapas || []), { id: uid('et'), nome: name, opcional: false, ativa: true, status: 'Pendente', ordem: (item.etapas || []).length, responsavelTipo: 'interno', prazoDias: 1, followupDias: 3, prazoEtapa: '', proximaRevisao: '', aguardandoDesde: '', concluidoEm: '' }] }); setNewStep('') }\n  function continueWaiting() { mutate(item => { const result = continueProcessWaiting(item); if (result.changed) Object.assign(item, result.process) }) }",
    'process add step and waiting action',
    path,
  )

  source = replaceRequired(
    source,
    "<article><small>Prazo final</small><strong>{formatDate(process.prazoFinal)}</strong></article><article><small>Cliente</small>",
    "<article><small>Conclusão interna</small><strong>{formatDate(process.previsaoConclusao)}</strong></article><article><small>Prazo final</small><strong>{formatDate(process.prazoFinal)}</strong></article><article><small>Cliente</small>",
    'process detail internal forecast',
    path,
  )

  source = replaceRequired(
    source,
    "</div><section><header><div><h3>Etapas</h3><p>Defina a etapa atual e acompanhe cada conclusão.</p></div></header>",
    "</div><section className={`process-next-action level-${action.level}`}><header><div><h3>Próxima ação</h3><p>O processo entra no radar por esta ação, sem perder o prazo final.</p></div>{action.dependency !== 'interno' && !isDone(process.status) ? <button type=\"button\" className=\"primary\" onClick={continueWaiting}>Continuar aguardando</button> : null}</header><div className=\"process-next-action-grid\"><article><small>Ação</small><strong>{action.actionLabel}</strong></article><article><small>Quando agir</small><strong>{formatDate(action.actionDate)}</strong></article><article><small>Depende de</small><strong>{action.dependencyLabel}</strong></article>{action.waitingSince ? <article><small>Aguardando desde</small><strong>{formatDate(action.waitingSince)}</strong></article> : null}</div></section><section><header><div><h3>Etapas</h3><p>Defina a etapa atual e acompanhe cada conclusão.</p></div></header>",
    'process next action panel',
    path,
  )

  const detailStep = "<div><b>{step.nome}</b>{step.opcional ? <em>Opcional</em> : null}<small>{step.status || 'Pendente'}</small></div>"
  const detailStepV121 = "<div><b>{step.nome}</b>{step.opcional ? <em>Opcional</em> : null}<small>{step.status || 'Pendente'} · {PROCESS_DEPENDENCIES[step.responsavelTipo || 'interno']?.label || 'Escritório'}{step.prazoEtapa ? ` · prazo ${formatDate(step.prazoEtapa)}` : ''}{step.proximaRevisao ? ` · conferir ${formatDate(step.proximaRevisao)}` : ''}{step.aguardandoDesde ? ` · aguardando desde ${formatDate(step.aguardandoDesde)}` : ''}</small></div>"
  source = replaceRequired(source, detailStep, detailStepV121, 'process detail step metadata', path)

  source = replaceRequired(
    source,
    "function saveProcess(process) { update(draft => { draft.processes = process.id ? draft.processes.map(item => String(item.id) === String(process.id) ? process : item) : [...draft.processes, { ...process, id: uid('proc') }] }); setEditing(null); setNotice('Processo salvo.') }",
    "function saveProcess(process) { const normalized = initializeProcessPlanning({ ...process, previsaoConclusaoInicial: process.previsaoConclusaoInicial || process.previsaoConclusao || '' }, process.dataAbertura || today()); update(draft => { draft.processes = normalized.id ? draft.processes.map(item => String(item.id) === String(normalized.id) ? normalized : item) : [...draft.processes, { ...normalized, id: uid('proc') }] }); setEditing(null); setNotice('Processo salvo.') }",
    'process save planning initialization',
    path,
  )

  source = replaceRequired(
    source,
    "function duplicateProcess(process) { const copy = { ...structuredClone(process), id: uid('proc'), tipo: `${process.tipo} (cópia)`, status: 'Novo', dataAbertura: today(), dataConclusao: '', prazoFinal: '', etapaAtual: 0, etapas: (process.etapas || []).map((step, index) => ({ ...step, id: uid('et'), status: 'Pendente', ordem: index })), protocolos: [] }; update(draft => { draft.processes = [...draft.processes, copy] }); setNotice('Processo duplicado sem protocolos ou conclusões.') }",
    "function duplicateProcess(process) { const copy = initializeProcessPlanning({ ...structuredClone(process), id: uid('proc'), tipo: `${process.tipo} (cópia)`, status: 'Novo', dataAbertura: today(), dataConclusao: '', prazoFinal: '', previsaoConclusao: '', previsaoConclusaoInicial: '', etapaAtual: 0, etapas: (process.etapas || []).map((step, index) => ({ ...step, id: uid('et'), status: 'Pendente', ordem: index, prazoEtapa: '', proximaRevisao: '', aguardandoDesde: '', concluidoEm: '', ativadaEm: '' })), protocolos: [] }, today()); update(draft => { draft.processes = [...draft.processes, copy] }); setNotice('Processo duplicado sem protocolos, conclusões ou datas operacionais.') }",
    'duplicate process planning reset',
    path,
  )

  source = replaceRequired(
    source,
    "{rows.map(process => { const progress = processProgress(process); return <article key={process.id}>",
    "{rows.map(process => { const progress = processProgress(process), planning = processActionState(process); return <article key={process.id}>",
    'process list planning state',
    path,
  )

  source = replaceRequired(
    source,
    "<small>{clientName(clientsById.get(String(process.clientId)))} · {process.status || 'Novo'} · prazo {formatDate(process.prazoFinal)}{process.terceirizado ? ` · Terceirizado: ${process.terceiroNome || 'Sem nome'} · ${formatCnpj(process.terceiroCnpj)}` : ''}</small>",
    "<small>{clientName(clientsById.get(String(process.clientId)))} · {process.status || 'Novo'} · próxima ação {formatDate(planning.actionDate)} · prazo final {formatDate(process.prazoFinal)}{process.terceirizado ? ` · Terceirizado: ${process.terceiroNome || 'Sem nome'} · ${formatCnpj(process.terceiroCnpj)}` : ''}</small><small className={`process-action-summary level-${planning.level}`}>{planning.actionLabel}{process.previsaoConclusao ? ` · conclusão interna ${formatDate(process.previsaoConclusao)}` : ''}</small>",
    'process list next action',
    path,
  )

  source = replaceRequired(
    source,
    "<li key={step.id}>{step.nome}{step.opcional ? <em>Opcional</em> : null}</li>",
    "<li key={step.id}>{step.nome}{step.opcional ? <em>Opcional</em> : null}<small>{PROCESS_DEPENDENCIES[step.responsavelTipo || 'interno']?.label || 'Escritório'} · prazo em {Math.max(0, Number(step.prazoDias) || 0)} dia(s) útil(eis){(step.responsavelTipo || 'interno') !== 'interno' ? ` · revisar a cada ${Math.max(1, Number(step.followupDias) || 3)} dia(s) útil(eis)` : ''}</small></li>",
    'process model planning summary',
    path,
  )

  writeFileSync(path, source)
}

function patchOperationalIntelligence(root) {
  const path = `${root}src/lib/operationalIntelligence.js`
  let source = readFileSync(path, 'utf8')
  if (!source.includes("from './processPlanning.js'")) {
    source = replaceRequired(source, "import { today, isDone } from './storage.js'", "import { today, isDone } from './storage.js'\nimport { processActionState } from './processPlanning.js'", 'operational process planning import', path)
  }
  const oldBlock = `  ;(office.processes || []).forEach(process => {
    const done = processDone(process)
    if (!includeDone && done) return
    const due = String(process.prazoFinal || '')
    const days = due ? daysBetween(day, due) : null
    const score = dueScore(days) + (normalize(process.status).includes('aguard') ? 8 : 0)
    items.push({
      key: \`process:\${process.id}\`,
      type: 'process',
      kindLabel: 'Processo',
      id: String(process.id || ''),
      clientId: String(process.clientId || ''),
      client: clientName(clients.get(String(process.clientId))),
      title: process.tipo || 'Processo',
      subtitle: process.status || 'Processo em andamento',
      due,
      planned: '',
      effectiveDate: due,
      days,
      status: process.status || 'Em andamento',
      priority: '',
      score,
      level: operationalLevel(days, score, process.status),
      done,
      view: 'processos',
    })
  })`
  const newBlock = `  ;(office.processes || []).forEach(process => {
    const done = processDone(process)
    if (!includeDone && done) return
    const action = processActionState(process, { day })
    const due = String(action.officialDue || process.prazoFinal || '')
    const effectiveDate = String(action.actionDate || action.internalDue || due || '')
    const days = effectiveDate ? daysBetween(day, effectiveDate) : null
    const officialDays = due ? daysBetween(day, due) : null
    const score = dueScore(days) + (officialDays !== null && officialDays <= 3 ? 28 : 0) + (normalize(process.status).includes('aguard') ? 8 : 0)
    items.push({
      key: \`process:\${process.id}\`,
      type: 'process',
      kindLabel: 'Processo',
      id: String(process.id || ''),
      clientId: String(process.clientId || ''),
      client: clientName(clients.get(String(process.clientId))),
      title: process.tipo || 'Processo',
      subtitle: action.actionLabel || process.status || 'Processo em andamento',
      due,
      planned: '',
      effectiveDate,
      actionDate: String(action.actionDate || ''),
      internalDue: String(action.internalDue || ''),
      dependency: action.dependency,
      dependencyLabel: action.dependencyLabel,
      waitingSince: action.waitingSince,
      days,
      status: process.status || 'Em andamento',
      priority: '',
      score,
      level: action.level === 'critical' ? 'critical' : action.level === 'attention' ? 'attention' : operationalLevel(days, score, process.status),
      done,
      view: 'processos',
    })
  })`
  source = replaceRequired(source, oldBlock, newBlock, 'operational process action date', path)
  writeFileSync(path, source)
}

function patchWorkHorizons(root) {
  const path = `${root}src/lib/workHorizons.js`
  let source = readFileSync(path, 'utf8')
  source = replaceRequired(
    source,
    "  const overdue = all.filter(item => {\n    const due = officialDue(item)\n    return due && due < day\n  })",
    "  const overdue = all.filter(item => {\n    const due = officialDue(item)\n    const action = itemDate(item)\n    return Boolean((action && action < day) || (due && due < day))\n  })",
    'work horizon action overdue',
    path,
  )
  writeFileSync(path, source)
}

function patchHorizonBoard(root) {
  const path = `${root}src/components/WorkHorizonBoard.jsx`
  let source = readFileSync(path, 'utf8')
  source = replaceRequired(
    source,
    "function deadline(item, day) {\n  if (item.planned && item.planned !== item.due) return `Planejado ${dateLabel(item.planned)} · prazo ${dateLabel(item.due) || 'não definido'}`",
    "function deadline(item, day) {\n  if (item.type === 'process' && item.actionDate) { const actionText = item.actionDate < day ? `Ação atrasada desde ${dateLabel(item.actionDate)}` : item.actionDate === day ? 'Ação hoje' : `Próxima ação ${dateLabel(item.actionDate)}`; return `${actionText}${item.internalDue ? ` · concluir internamente ${dateLabel(item.internalDue)}` : ''}${item.due ? ` · prazo final ${dateLabel(item.due)}` : ''}` }\n  if (item.planned && item.planned !== item.due) return `Planejado ${dateLabel(item.planned)} · prazo ${dateLabel(item.due) || 'não definido'}`",
    'process horizon deadline label',
    path,
  )
  source = replaceRequired(
    source,
    "<button type=\"button\" className={view.overdue.length ? 'danger' : ''} onClick={() => setFilter('all')}><span>Atrasados</span><strong>{view.overdue.length}</strong><small>prazo oficial vencido</small></button>",
    "<button type=\"button\" className={view.overdue.length ? 'danger' : ''} onClick={() => setFilter('all')}><span>Em atraso</span><strong>{view.overdue.length}</strong><small>ação, etapa ou prazo vencido</small></button>",
    'horizon overdue label',
    path,
  )
  writeFileSync(path, source)
}

function patchVersion(root) {
  const chromePath = `${root}src/components/AppChrome.jsx`
  let chrome = readFileSync(chromePath, 'utf8')
  chrome = chrome.replaceAll('V12.0', 'V12.1')
  writeFileSync(chromePath, chrome)

  const storagePath = `${root}src/lib/storage.js`
  let storage = readFileSync(storagePath, 'utf8')
  storage = storage.replace("meta: { version: '12.0' }", "meta: { version: '12.1' }")
  writeFileSync(storagePath, storage)
}

export function applyV121Patch(root) {
  patchProcesses(root)
  patchOperationalIntelligence(root)
  patchWorkHorizons(root)
  patchHorizonBoard(root)
  patchVersion(root)
}
