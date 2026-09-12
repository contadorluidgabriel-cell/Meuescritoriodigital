import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (!source.includes(from)) throw new Error(`Process step status patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

export function applyProcessStepStatusesPatch(root) {
  const path = `${root}src/components/ProcessesReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes('PROCESS_STEP_STATUSES')) return

  source = replaceRequired(
    source,
    "import { PROCESS_DEPENDENCIES, continueProcessWaiting, initializeProcessPlanning, processActionState, setCurrentProcessStep, toggleProcessStep } from '../lib/processPlanning.js'",
    "import { PROCESS_DEPENDENCIES, PROCESS_STEP_STATUSES, continueProcessWaiting, initializeProcessPlanning, processActionState, processStepStatusLabel, setCurrentProcessStep, toggleProcessStep } from '../lib/processPlanning.js'\nimport ProcessStepQuickStatus from './ProcessStepQuickStatus.jsx'",
    'process planning status imports',
    path,
  )

  source = replaceRequired(
    source,
    '<div className="process-step-planning"><label><span>Depende de</span>',
    '<div className="process-step-planning">{!modelMode ? <label><span>Status da etapa</span><select value={step.status || \'Pendente\'} onChange={event => patchStep(index, { status: event.target.value })}>{PROCESS_STEP_STATUSES.map(status => <option value={status} key={status}>{status}</option>)}</select></label> : null}<label><span>Depende de</span>',
    'step operational status field',
    path,
  )

  source = replaceRequired(
    source,
    '>{Object.values(PROCESS_DEPENDENCIES).map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>{modelMode ?',
    '>{Object.values(PROCESS_DEPENDENCIES).map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>{!modelMode && String(step.status || \'\').startsWith(\'Aguardando\') ? <label className="process-waiting-target"><span>Aguardando em / por</span><input value={step.aguardandoEm || \'\'} onChange={event => patchStep(index, { aguardandoEm: event.target.value })} placeholder="Ex.: Junta Comercial, Prefeitura, cliente" /></label> : null}{modelMode ?',
    'step waiting target field',
    path,
  )

  source = replaceRequired(
    source,
    "ativadaEm: previous?.ativadaEm || step.ativadaEm || '' } }).filter(step => step.nome)",
    "ativadaEm: previous?.ativadaEm || step.ativadaEm || '', aguardandoEm: step.aguardandoEm || previous?.aguardandoEm || '' } }).filter(step => step.nome)",
    'persist step waiting target',
    path,
  )

  source = replaceRequired(
    source,
    "<small>{step.status || 'Pendente'} · {PROCESS_DEPENDENCIES[step.responsavelTipo || 'interno']?.label || 'Escritório'}",
    "<small>{processStepStatusLabel(step)} · {PROCESS_DEPENDENCIES[step.responsavelTipo || 'interno']?.label || 'Escritório'}",
    'step detail status label',
    path,
  )

  source = replaceRequired(
    source,
    "<div><b>{step.nome}</b>{step.opcional ? <em>Opcional</em> : null}<small>{processStepStatusLabel(step)} · {PROCESS_DEPENDENCIES[step.responsavelTipo || 'interno']?.label || 'Escritório'}{step.prazoEtapa ? ` · prazo ${formatDate(step.prazoEtapa)}` : ''}{step.proximaRevisao ? ` · conferir ${formatDate(step.proximaRevisao)}` : ''}{step.aguardandoDesde ? ` · aguardando desde ${formatDate(step.aguardandoDesde)}` : ''}</small></div>",
    "<div className=\"process-step-copy\"><b>{step.nome}</b>{step.opcional ? <em>Opcional</em> : null}<small>{processStepStatusLabel(step)} · {PROCESS_DEPENDENCIES[step.responsavelTipo || 'interno']?.label || 'Escritório'}{step.prazoEtapa ? ` · prazo ${formatDate(step.prazoEtapa)}` : ''}{step.proximaRevisao ? ` · conferir ${formatDate(step.proximaRevisao)}` : ''}{step.aguardandoDesde ? ` · aguardando desde ${formatDate(step.aguardandoDesde)}` : ''}</small><ProcessStepQuickStatus process={process} stepId={step.id} onChangeProcess={next => mutate(item => Object.assign(item, next))} compact /></div>",
    'step detail quick status',
    path,
  )

  source = replaceRequired(
    source,
    '<div className="process-next-action-grid"><article><small>Ação</small>',
    '<div className="process-next-action-grid"><article><small>Status</small><strong>{action.stepStatusLabel || process.status || \'Em andamento\'}</strong></article><article><small>Ação</small>',
    'next action status summary',
    path,
  )

  writeFileSync(path, source)
}
