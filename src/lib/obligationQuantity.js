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
    delete next.fechado
    return next
  }
  const closed = Boolean(link.fechado) || link.status === 'Concluída'
  return {
    ...link,
    quantidadePessoas: nonNegativeInteger(link.quantidadePessoas),
    fechado: closed,
    status: closed ? 'Concluída' : (link.status === 'Concluída' ? 'Pendente' : (link.status || 'Pendente')),
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
  const fechadas = links.filter(link => Boolean(link.fechado) || link.status === 'Concluída').length
  return {
    empresas: links.length,
    totalPessoas,
    fechadas,
    pendentes: Math.max(0, links.length - fechadas),
    percentualFechamento: links.length ? Math.round((fechadas / links.length) * 100) : 0,
  }
}
