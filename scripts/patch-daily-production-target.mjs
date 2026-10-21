import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, from, to, label, path) {
  if (source.includes(to)) return source
  if (!source.includes(from)) throw new Error(`Daily production target patch failed (${label}) in ${path}`)
  return source.replace(from, to)
}

export function applyDailyProductionTargetPatch(root) {
  const productivityPath = ${root}src/lib/obligationProductivity.js
  let productivity = readFileSync(productivityPath, 'utf8')
  productivity = replaceRequired(
    productivity,
    `  const requiredPerDay = completedAll
    ? 0
    : daysRemaining > 0
      ? Math.ceil(pending / daysRemaining)
      : pending

  const averagePerDay = pace.averagePerDay`,
    `  const requiredPerDay = completedAll
    ? 0
    : daysRemaining > 0
      ? Math.ceil(pending / daysRemaining)
      : pending
  // A meta personalizada não substitui o ritmo necessário recalculado pelo prazo.
  const savedDailyGoal = integer(link.metaDiariaPersonalizada)
  const dailyGoal = completedAll ? 0 : savedDailyGoal > 0 ? savedDailyGoal : requiredPerDay
  const goalIsCustom = savedDailyGoal > 0
  const goalBelowRequired = !completedAll && goalIsCustom && dailyGoal < requiredPerDay

  const averagePerDay = pace.averagePerDay`,
    'separate required pace from custom goal',
    productivityPath,
  )
  productivity = replaceRequired(
    productivity,
    `    todayTarget: requiredPerDay,
    doneToday,
    remainingToday: requiredPerDay,`,
    `    todayTarget: dailyGoal,
    dailyGoal,
    goalIsCustom,
    goalBelowRequired,
    suggestedDailyGoal: requiredPerDay,
    doneToday,
    remainingToday: Math.max(0, dailyGoal - doneToday),`,
    'link productivity output',
    productivityPath,
  )
  productivity = replaceRequired(
    productivity,
    `  const requiredToday = active.reduce((sum, row) => sum + row.requiredPerDay, 0)
  const nextRequiredPerDay = requiredToday
  const remainingToday = requiredToday`,
    `  const requiredToday = active.reduce((sum, row) => sum + row.requiredPerDay, 0)
  const dailyGoalToday = active.reduce((sum, row) => sum + row.dailyGoal, 0)
  const goalBelowRequired = active.some(row => row.goalBelowRequired)
  const nextRequiredPerDay = requiredToday
  const remainingToday = requiredToday`,
    'aggregate custom goal',
    productivityPath,
  )
  productivity = replaceRequired(
    productivity,
    `    requiredToday,
    nextRequiredPerDay,`,
    `    requiredToday,
    dailyGoalToday,
    goalBelowRequired,
    nextRequiredPerDay,`,
    'aggregate productivity output',
    productivityPath,
  )
  writeFileSync(productivityPath, productivity)

  const workspacePath = ${root}src/components/ObligationsWorkspace.jsx
  let workspace = readFileSync(workspacePath, 'utf8')
  workspace = replaceRequired(
    workspace,
    `import { appendProductionHistory } from '../lib/obligationProductivity.js'`,
    `import { appendProductionHistory, linkProductivity } from '../lib/obligationProductivity.js'`,
    'productivity import',
    workspacePath,
  )
  workspace = replaceRequired(
    workspace,
    `{obligation.quantitativo ? <><Field label="Total de pessoas"><input type="number" min="1" step="1" value={row.quantidadePessoas || ''} onChange={event => changeRow(row, { quantidadePessoas: event.target.value })} /></Field><Field label="Pessoas concluídas"><input type="number" min="0" max={Number(row.quantidadePessoas) || undefined} step="1" value={row.quantidadeConcluida ?? 0} onChange={event => changeRow(row, { quantidadeConcluida: event.target.value })} /></Field></> : <Field label="Status"><select value={row.status || 'Pendente'} onChange={event => changeRow(row, { status: event.target.value })}>{obligationStatuses.map(status => <option key={status}>{status}</option>)}</select></Field>}`,
    `{obligation.quantitativo ? <><Field label="Total de pessoas"><input type="number" min="1" step="1" value={row.quantidadePessoas || ''} onChange={event => changeRow(row, { quantidadePessoas: event.target.value })} /></Field><Field label="Pessoas concluídas"><input type="number" min="0" max={Number(row.quantidadePessoas) || undefined} step="1" value={row.quantidadeConcluida ?? 0} onChange={event => changeRow(row, { quantidadeConcluida: event.target.value })} /></Field><Field label="Meta diária personalizada" hint={`Em branco usa o ritmo necessário automático: ${linkProductivity(row, row.vencimento || obligation.vencimento || '', today()).requiredPerDay} pessoas/dia.`}><input type="number" min="1" step="1" value={row.metaDiariaPersonalizada ?? ''} onChange={event => changeRow(row, { metaDiariaPersonalizada: event.target.value === '' ? '' : Math.max(1, Math.trunc(Number(event.target.value) || 1)) })} placeholder={String(linkProductivity(row, row.vencimento || obligation.vencimento || '', today()).requiredPerDay || 'Automática')} /></Field></> : <Field label="Status"><select value={row.status || 'Pendente'} onChange={event => changeRow(row, { status: event.target.value })}>{obligationStatuses.map(status => <option key={status}>{status}</option>)}</select></Field>}`,
    'editable daily goal',
    workspacePath,
  )
  writeFileSync(workspacePath, workspace)

  const accordionPath = ${root}src/components/ObligationAccordionList.jsx
  let accordion = readFileSync(accordionPath, 'utf8')
  accordion = replaceRequired(
    accordion,
    `{productivity.overdue ? `Prazo vencido · ${productivity.pending} pessoas pendentes` : productivity.requiredToday > 0 ? `Meta hoje ${productivity.requiredToday} · feitas ${productivity.doneToday} · faltam ${productivity.remainingToday}` : productivity.mixedDue ? `Próximo ritmo: ${productivity.nextRequiredPerDay}/dia` : `Sem meta hoje · próximo ritmo ${productivity.nextRequiredPerDay}/dia`}`,
    `{productivity.overdue ? `Prazo vencido · ${productivity.pending} pessoas pendentes` : productivity.requiredToday > 0 ? `Meta definida ${productivity.dailyGoalToday} · feitas ${productivity.doneToday} · faltam ${Math.max(0, productivity.dailyGoalToday - productivity.doneToday)} · ritmo necessário ${productivity.requiredToday}/dia${productivity.goalBelowRequired ? ' · META ABAIXO DO NECESSÁRIO' : ''}` : productivity.mixedDue ? `Próximo ritmo necessário: ${productivity.nextRequiredPerDay}/dia` : `Sem meta hoje · ritmo necessário ${productivity.nextRequiredPerDay}/dia`}`,
    'daily target display',
    accordionPath,
  )
  writeFileSync(accordionPath, accordion)
}
