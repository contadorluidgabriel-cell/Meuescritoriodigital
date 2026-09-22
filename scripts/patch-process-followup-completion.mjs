import { readFileSync, writeFileSync } from 'node:fs'

const marker = 'MED_PROCESS_QUICK_FOLLOWUP_V1'

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Process follow-up completion patch: missing ${label}`)
  return source.replace(before, after)
}

export function applyProcessFollowUpCompletionPatch(root) {
  const path = `${root}src/components/ProcessesReact.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes(marker)) return

  source = replaceRequired(
    source,
    'function ProcessDetails({ process, clientsById, update, onClose, followUps, onOpenFollowUp }) {',
    'function ProcessDetails({ process, clientsById, update, onClose, followUps, onOpenFollowUp, onStartFollowUp }) {',
    'process details props',
  )
  source = replaceRequired(
    source,
    '<ProcessDetails process={detailProcess} clientsById={clientsById} followUps={followUps} onOpenFollowUp={onOpenFollowUp} update={update}',
    '<ProcessDetails process={detailProcess} clientsById={clientsById} followUps={followUps} onOpenFollowUp={onOpenFollowUp} onStartFollowUp={onStartFollowUp} update={update}',
    'process details wiring',
  )
  const closeButton = '<button type="button" className="primary" onClick={() => mutate(item => { item.status = \'Concluído\'; item.dataConclusao = today() })}>Concluir processo</button> : null}'
  const followUpButton = `{action.allStepsDone && action.stepCount > 0 && !isDone(process.status) && !followUps?.records?.some(row => row.status === 'active' && row.sourceType === 'process' && String(row.sourceId) === String(process.id)) ? <button type="button" className="primary" onClick={() => { mutate(item => { item.status = 'Concluído'; item.dataConclusao = today() }); onStartFollowUp?.({ sourceType: 'process', sourceId: process.id, clientId: process.clientId, title: 'Verificar resultado: ' + (process.tipo || 'Processo'), checkDate: today() }) }}>Concluir e acompanhar</button> : null}`
  source = replaceRequired(source, closeButton, closeButton + followUpButton, 'optional follow-up button')
  writeFileSync(path, `// ${marker}\n` + source)
}
