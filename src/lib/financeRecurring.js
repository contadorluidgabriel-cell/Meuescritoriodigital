import { monthlyFeeForCompetence } from './financeEditing.js'
import { normalizedSharedClientFields, SETTLEMENT_PENDING } from './sharedWork.js'

const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

export function buildMissingRecurringCharges({ clients = [], finance = [], competence = '', clientId = '', makeId } = {}) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(competence || ''))
  if (!match) return []

  const year = Number(match[1])
  const month = Number(match[2])
  if (!year || month < 1 || month > 12) return []

  const existing = new Set(
    finance
      .filter(charge => charge?.origem === 'recorrente' && charge?.competencia === competence)
      .map(charge => String(charge?.clienteId || '')),
  )

  return clients
    .filter(client => {
      const id = String(client?.id || '')
      const monthlyValue = monthlyFeeForCompetence(client, competence)
      return id
        && client?.status !== 'Inativo'
        && client?.relacionamento === 'Recorrente'
        && monthlyValue > 0
        && (!clientId || id === String(clientId))
        && !existing.has(id)
    })
    .map(client => {
      const requestedDay = Math.max(1, Number(client?.vencimento) || 10)
      const lastDay = new Date(year, month, 0).getDate()
      const dueDay = Math.min(requestedDay, lastDay)
      const monthlyValue = monthlyFeeForCompetence(client, competence)
      const base = {
        id: typeof makeId === 'function' ? makeId() : `fin-${competence}-${client.id}`,
        clienteId: String(client.id),
        cliente: clientName(client),
        descricao: 'Honorários contábeis',
        competencia: competence,
        vencimento: `${competence}-${String(dueDay).padStart(2, '0')}`,
        valor: monthlyValue,
        status: 'Pendente',
        recebidoEm: '',
        origem: 'recorrente',
      }

      if (client?.perfilAtendimento !== 'Compartilhado') return base
      const shared = normalizedSharedClientFields({ ...client, mensalidade: monthlyValue })
      return {
        ...base,
        compartilhado: true,
        parceiroIds: shared.parceiroIds,
        parceiroId: shared.parceiroId,
        compartilhadoRecebedor: shared.compartilhadoRecebedor,
        compartilhadoMinhaParte: shared.compartilhadoMinhaParte,
        compartilhadoPartesParceiros: shared.compartilhadoPartesParceiros,
        compartilhadoParceiroParte: shared.compartilhadoParceiroParte,
        compartilhadoAcertoStatus: SETTLEMENT_PENDING,
        compartilhadoAcertoEm: '',
        compartilhadoObservacao: '',
        compartilhadoPersonalizado: false,
      }
    })
}
