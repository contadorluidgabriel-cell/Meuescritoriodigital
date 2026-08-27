export const obligationStatuses = ['Pendente', 'Em andamento', 'Aguardando cliente', 'Concluída', 'Não se aplica']

export function obligationProgress(obligation) {
  const clients = obligation.clientes || []
  const applicable = clients.filter(link => link.status !== 'Não se aplica')
  const done = applicable.filter(link => /conclu|recebido/i.test(String(link.status || ''))).length
  return { total: clients.length, done, applicable: applicable.length, pct: applicable.length ? Math.round(done / applicable.length * 100) : 0 }
}

export function nextObligationDue(obligation, currentDay) {
  const dates = (obligation.clientes || []).map(link => link.vencimento).filter(Boolean).sort()
  return dates.find(date => date >= currentDay) || dates[0] || ''
}

export function nextObligationCompetence(value) {
  const competence = String(value || '').trim()
  if (/^\d{4}$/.test(competence)) return String(Number(competence) + 1)
  const monthly = competence.match(/^(\d{4})-(\d{2})$/)
  if (!monthly) return ''
  const date = new Date(Number(monthly[1]), Number(monthly[2]) - 1, 1, 12)
  date.setMonth(date.getMonth() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
