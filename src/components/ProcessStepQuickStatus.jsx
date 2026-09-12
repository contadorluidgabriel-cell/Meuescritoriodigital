import { useEffect, useState } from 'react'
import {
  PROCESS_STEP_STATUSES,
  currentProcessStep,
  normalizeProcessStepStatus,
  orderedProcessSteps,
  setProcessStepStatus,
} from '../lib/processPlanning.js'
import '../process-quick-status.css'

function selectedStep(process, stepId) {
  if (stepId !== undefined && stepId !== null && stepId !== '') {
    return orderedProcessSteps(process).find(step => String(step.id) === String(stepId)) || null
  }
  return currentProcessStep(process).step
}

export default function ProcessStepQuickStatus({ process, stepId = '', onChangeProcess, compact = false }) {
  const step = selectedStep(process, stepId)
  const status = normalizeProcessStepStatus(step?.status)
  const [waitingTarget, setWaitingTarget] = useState(step?.aguardandoEm || '')

  useEffect(() => {
    setWaitingTarget(step?.aguardandoEm || '')
  }, [step?.id, step?.aguardandoEm])

  if (!step) return null

  const waiting = status.startsWith('Aguardando ')

  function applyStatus(nextStatus) {
    const result = setProcessStepStatus(process, step.id, nextStatus, {
      waitingTarget: waitingTarget || step.aguardandoEm || '',
    })
    if (result.changed) onChangeProcess?.(result.process)
  }

  function saveWaitingTarget() {
    const target = waitingTarget.trim()
    if (target === String(step.aguardandoEm || '').trim()) return
    const result = setProcessStepStatus(process, step.id, status, { waitingTarget: target })
    if (result.changed) onChangeProcess?.(result.process)
  }

  return <div className={`process-quick-status ${compact ? 'compact' : ''}`}>
    <label>
      <span>{compact ? 'Status' : `Status · ${step.nome || 'Etapa atual'}`}</span>
      <select value={status} onChange={event => applyStatus(event.target.value)} aria-label={`Status da etapa ${step.nome || 'atual'}`}>
        {PROCESS_STEP_STATUSES.map(option => <option value={option} key={option}>{option}</option>)}
      </select>
    </label>
    {waiting ? <label className="process-quick-waiting">
      <span>Aguardando em / por</span>
      <input
        value={waitingTarget}
        onChange={event => setWaitingTarget(event.target.value)}
        onBlur={saveWaitingTarget}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
        placeholder="Ex.: Junta Comercial"
        aria-label={`Aguardando em ou por na etapa ${step.nome || 'atual'}`}
      />
    </label> : null}
  </div>
}
