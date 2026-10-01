import { appendProductionHistory } from './obligationProductivity.js'
const nonNegativeInteger = value => Math.max(0, Math.trunc(Number(value) || 0))

export function usesQuantityControl(record = {}) {
  return Boolean(record.quantitativo)
}

export function normalizedQuantityUnit(record = {}) {
  return usesQuantityControl(record) ? 'Pessoas' : ''
}

export function normalizedObligationLinkQuantity(link = {}, quantitative = false) {
  if (!quantitative) {
    const next = { ...link }
    delete next.quantidadePessoas
    delete next.quantidadeConcluida
    delete next.fechado
    return next
  }
  const total = nonNegativeInteger(link.quantidadePessoas)
  const requestedDone = nonNegativeInteger(link.quantidadeConcluida)
  const closed = Boolean(link.fechado) || link.status === 'Concluída' || (total > 0 && requestedDone >= total)
  const done = closed ? total : Math.min(total, requestedDone)
  return {
    ...link,
    quantidadePessoas: total,
    quantidadeConcluida: done,
    fechado: closed,
    status: closed ? 'Concluída' : done > 0 ? 'Em andamento' : (link.status === 'Concluída' ? 'Pendente' : (link.status || 'Pendente')),
  }
}

export function quantityValidationError(links = [], quantitative = false) {
  if (!quantitative) return ''
  if (!Array.isArray(links) || !links.length) return 'Selecione pelo menos uma empresa.'
  if (links.some(link => nonNegativeInteger(link.quantidadePessoas) < 1)) return 'Informe a quantidade de pessoas de cada empresa selecionada.'
  return ''
}

export function obligationQuantitySummary(obligation = {}) {
  const links = Array.isArray(obligation.clientes) ? obligation.clientes : []
  const totalPessoas = links.reduce((sum, link) => sum + nonNegativeInteger(link.quantidadePessoas), 0)
  const pessoasConcluidas = links.reduce((sum, link) => { const total = nonNegativeInteger(link.quantidadePessoas); const done = Boolean(link.fechado) || link.status === 'Concluída' ? total : Math.min(total, nonNegativeInteger(link.quantidadeConcluida)); return sum + done }, 0)
  const fechadas = links.filter(link => Boolean(link.fechado) || link.status === 'Concluída' || (nonNegativeInteger(link.quantidadePessoas) > 0 && nonNegativeInteger(link.quantidadeConcluida) >= nonNegativeInteger(link.quantidadePessoas))).length
  return {
    empresas: links.length,
    totalPessoas,
    pessoasConcluidas,
    pessoasPendentes: Math.max(0, totalPessoas - pessoasConcluidas),
    fechadas,
    pendentes: Math.max(0, links.length - fechadas),
    percentualFechamento: totalPessoas ? Math.round((pessoasConcluidas / totalPessoas) * 100) : (links.length ? Math.round((fechadas / links.length) * 100) : 0),
  }
}


export function updateObligationLinkQuantity(obligations = [], obligationId = '', clientId = '', completedPeople = 0, completedAt = new Date().toISOString().slice(0, 10)) {
  const targetObligationId = String(obligationId || '')
  const targetClientId = String(clientId || '')
  const requested = nonNegativeInteger(completedPeople)
  let changed = false
  let updatedLink = null
  const next = (obligations || []).map(obligation => {
    if (String(obligation?.id || '') !== targetObligationId || !obligation.quantitativo) return obligation
    const links = (obligation.clientes || []).map(link => {
      if (String(link?.clienteId || '') !== targetClientId) return link
      const total = nonNegativeInteger(link.quantidadePessoas)
      if (!total) return link
      const done = Math.min(total, requested)
      const closed = done >= total
      updatedLink = {
        ...link,
        quantidadeConcluida: done,
        historicoProducao: appendProductionHistory(link, link.quantidadeConcluida || 0, done, completedAt),
        fechado: closed,
        status: closed ? 'Concluída' : done > 0 ? 'Em andamento' : 'Pendente',
        concluidoEm: closed ? (link.concluidoEm || completedAt) : '',
      }
      changed = true
      return updatedLink
    })
    return changed ? { ...obligation, clientes: links } : obligation
  })
  if (!changed) return { changed: false, obligations, error: 'Não foi possível atualizar a quantidade desta obrigação.' }
  return { changed: true, obligations: next, link: updatedLink }
}
