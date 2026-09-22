import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'MED_PROCESS_COMPLETION_FIX_20260922'

function replaceOnce(source, previous, next, description) {
  if (!source.includes(previous)) throw new Error(`Process completion patch: missing ${description}`)
  return source.replace(previous, next)
}

export function applyProcessCompletionPatch(root) {
  const planningPath = `${root}src/lib/processPlanning.js`
  let planning = readFileSync(planningPath, 'utf8')
  if (!planning.includes(marker)) {
    planning = replaceOnce(
      planning,
      "  next.etapaAtual = index\n  if (!isDone(next.status)) next.status = processStatusFromStep(initialized)\n  return { process: next, changed: true, step: initialized }",
      "  next.etapaAtual = index\n  if (isDone(next.status) && !processStepSettled(initialized)) {\n    next.status = processStatusFromStep(initialized)\n    next.dataConclusao = ''\n  } else if (!isDone(next.status)) next.status = processStatusFromStep(initialized)\n  return { process: next, changed: true, step: initialized }",
      'reopening via current step',
    )
    planning = replaceOnce(
      planning,
      "  next.etapas = (next.etapas || []).map(step => String(step.id) === String(stepId) ? updated : step)\n  const ordered = orderedProcessSteps(next)",
      "  next.etapas = (next.etapas || []).map(step => String(step.id) === String(stepId) ? updated : step)\n  if (isDone(next.status) && !processStepSettled(updated)) {\n    next.status = processStatusFromStep(updated)\n    next.dataConclusao = ''\n    next.etapaAtual = Math.max(0, orderedProcessSteps(next).findIndex(step => String(step.id) === String(stepId)))\n  }\n  const ordered = orderedProcessSteps(next)",
      'reopening via quick status',
    )
    planning = `// ${marker}\n` + planning
    writeFileSync(planningPath, planning)
  }

  const processesPath = `${root}src/components/ProcessesReact.jsx`
  let processes = readFileSync(processesPath, 'utf8')
  if (processes.includes(marker)) return
  processes = replaceOnce(
    processes,
    "status: previous?.status || step.status || 'Pendente'",
    "status: step.status || previous?.status || 'Pendente'",
    'edited step status precedence',
  )
  processes = replaceOnce(
    processes,
    "concluidoEm: previous?.concluidoEm || step.concluidoEm || ''",
    "concluidoEm: processStepSettled(step.status || previous?.status) ? (step.concluidoEm || previous?.concluidoEm || today()) : ''",
    'step completion date after editing',
  )
  processes = replaceOnce(
    processes,
    "    const saved = normalized.id ? normalized : { ...normalized, id: uid('proc') }",
    "    const unfinishedStep = processActionState(normalized).step\n    if (isDone(normalized.status) && unfinishedStep) Object.assign(normalized, setCurrentProcessStep(normalized, unfinishedStep.id).process)\n    if (isDone(normalized.status)) normalized.dataConclusao ||= today()\n    else normalized.dataConclusao = ''\n    const saved = normalized.id ? normalized : { ...normalized, id: uid('proc') }",
    'process status and completion date on editor save',
  )
  processes = replaceOnce(
    processes,
    "{action.dependency !== 'interno' && !isDone(process.status) ? <button type=\"button\" className=\"primary\" onClick={continueWaiting}>Continuar aguardando</button> : null}</header>",
    "{action.dependency !== 'interno' && !isDone(process.status) ? <button type=\"button\" className=\"primary\" onClick={continueWaiting}>Continuar aguardando</button> : null}{action.allStepsDone && action.stepCount > 0 && !isDone(process.status) ? <button type=\"button\" className=\"primary\" onClick={() => mutate(item => { item.status = 'Concluído'; item.dataConclusao = today() })}>Concluir processo</button> : null}</header>",
    'finalize process action button',
  )
  processes = "import { processStepSettled } from '../lib/processPlanning.js'\n// " + marker + "\n" + processes
  writeFileSync(processesPath, processes)
}
