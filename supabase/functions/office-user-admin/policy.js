const normalize = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()

export function settledStatus(value = '') {
  const status = normalize(value)
  return status.startsWith('conclu') || status.startsWith('cancel') || status === 'nao se aplica'
}

export function assignmentSummary(payload = {}, userId = '') {
  const target = String(userId || '')
  if (!target) return { clients: 0, tasks: 0, processes: 0, obligations: 0, total: 0 }

  const clients = (Array.isArray(payload.med_clientes) ? payload.med_clientes : [])
    .filter(client => String(client?.responsavelPrincipalUserId || '') === target).length

  const tasks = (Array.isArray(payload.med_tarefas) ? payload.med_tarefas : [])
    .filter(task => String(task?.responsavelUserId || '') === target && !settledStatus(task?.status)).length

  const processes = (Array.isArray(payload.med_processos) ? payload.med_processos : [])
    .filter(process => String(process?.responsavelUserId || '') === target && !settledStatus(process?.status)).length

  let obligations = 0
  for (const obligation of Array.isArray(payload.med_obrigacoes) ? payload.med_obrigacoes : []) {
    for (const link of Array.isArray(obligation?.clientes) ? obligation.clientes : []) {
      if (String(link?.responsavelUserId || '') === target && !settledStatus(link?.status)) obligations += 1
    }
  }

  return { clients, tasks, processes, obligations, total: clients + tasks + processes + obligations }
}

export function assignmentBlockMessage(summary = {}) {
  const rows = [
    ['cliente(s)', Number(summary.clients || 0)],
    ['tarefa(s)', Number(summary.tasks || 0)],
    ['processo(s)', Number(summary.processes || 0)],
    ['obrigação(ões)', Number(summary.obligations || 0)],
  ].filter(([, count]) => count > 0)
  if (!rows.length) return ''
  return `Antes de excluir definitivamente, redistribua as responsabilidades pendentes: ${rows.map(([label, count]) => `${count} ${label}`).join(', ')}.`
}
