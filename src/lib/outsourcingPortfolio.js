import { obligationQuantitySummary } from './obligationQuantity.js'

const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const settled = status => ['concluida', 'nao se aplica'].includes(normalize(status))

export function outsourcingPortfolio(office = {}, clientId = '') {
  const ownerId = String(clientId || '')
  const companies = (office.linkedCompanies || []).filter(company => String(company.clientId || '') === ownerId && company.status !== 'Inativo')
  const companyIds = new Set(companies.map(company => String(company.id)))
  const companyById = new Map(companies.map(company => [String(company.id), company]))
  const rows = []

  ;(office.obligations || []).forEach(obligation => {
    const links = (obligation.clientes || []).filter(link => companyIds.has(String(link.clienteId || '')))
    if (!links.length) return
    links.forEach(link => {
      const totalPeople = Math.max(0, Math.trunc(Number(link.quantidadePessoas) || 0))
      const completedPeople = settled(link.status) || link.fechado
        ? totalPeople
        : Math.min(totalPeople, Math.max(0, Math.trunc(Number(link.quantidadeConcluida) || 0)))
      rows.push({
        obligationId: String(obligation.id || ''),
        obligationName: obligation.nome || 'Obrigação',
        category: obligation.categoria || 'Outros',
        competence: obligation.competencia || '',
        due: link.vencimento || obligation.vencimento || '',
        companyId: String(link.clienteId || ''),
        companyName: companyById.get(String(link.clienteId || ''))?.razao || 'Empresa terceirizada',
        status: link.status || 'Pendente',
        quantitative: Boolean(obligation.quantitativo),
        totalPeople,
        completedPeople,
        pendingPeople: Math.max(0, totalPeople - completedPeople),
        completed: settled(link.status),
      })
    })
  })

  const obligations = [...new Set(rows.map(row => row.obligationId))]
  const openRows = rows.filter(row => !row.completed)
  const totalPeople = rows.reduce((sum, row) => sum + row.totalPeople, 0)
  const completedPeople = rows.reduce((sum, row) => sum + row.completedPeople, 0)

  return {
    companies,
    companyCount: companies.length,
    obligations: rows,
    obligationCount: obligations.length,
    openObligationCount: new Set(openRows.map(row => row.obligationId)).size,
    openLinkCount: openRows.length,
    totalPeople,
    completedPeople,
    pendingPeople: Math.max(0, totalPeople - completedPeople),
    peoplePercent: totalPeople ? Math.round(completedPeople * 100 / totalPeople) : 0,
  }
}
