const normalizeId = value => String(value || '')

export function processUsesOutsourcedCompanies(record = {}) {
  return Boolean(record.terceirizacaoLote)
}

export function selectedOutsourcedCompanies(record = {}) {
  return Array.isArray(record.empresasTerceirizadas)
    ? record.empresasTerceirizadas.filter(item => normalizeId(item?.companyId))
    : []
}

export function normalizedOutsourcingBatch(record = {}) {
  if (!processUsesOutsourcedCompanies(record)) {
    return {
      terceirizacaoLote: false,
      terceirizadorClientId: '',
      empresasTerceirizadas: [],
      quantitativo: Boolean(record.quantitativo),
      unidadeQuantidade: record.quantitativo ? String(record.unidadeQuantidade || 'Pessoas').trim() || 'Pessoas' : '',
    }
  }

  const companies = selectedOutsourcedCompanies(record).map(item => ({
    companyId: normalizeId(item.companyId),
    quantidadePessoas: record.quantitativo ? Math.max(0, Math.trunc(Number(item.quantidadePessoas) || 0)) : 0,
    fechado: Boolean(item.fechado),
  }))

  return {
    terceirizacaoLote: true,
    terceirizadorClientId: normalizeId(record.clientId || record.terceirizadorClientId),
    empresasTerceirizadas: companies,
    quantitativo: Boolean(record.quantitativo),
    unidadeQuantidade: record.quantitativo ? String(record.unidadeQuantidade || 'Pessoas').trim() || 'Pessoas' : '',
  }
}

export function outsourcingBatchError(record = {}, office = {}) {
  if (!processUsesOutsourcedCompanies(record)) return ''

  const clientId = normalizeId(record.clientId || record.terceirizadorClientId)
  const client = (office.clients || []).find(item => normalizeId(item.id) === clientId)
  if (!clientId || !client) return 'Selecione o cliente terceirizador.'
  if (client.perfilAtendimento !== 'Terceirizador') return 'O cliente selecionado precisa estar marcado como terceirizador.'

  const selected = selectedOutsourcedCompanies(record)
  if (!selected.length) return 'Selecione pelo menos uma empresa terceirizada.'

  const available = new Map((office.linkedCompanies || []).map(item => [normalizeId(item.id), item]))
  for (const row of selected) {
    const company = available.get(normalizeId(row.companyId))
    if (!company || company.status === 'Inativo') return 'Uma das empresas terceirizadas selecionadas não está mais disponível.'
    if (normalizeId(company.clientId) !== clientId) return 'Uma das empresas selecionadas não pertence ao cliente terceirizador informado.'
    if (record.quantitativo && Math.max(0, Math.trunc(Number(row.quantidadePessoas) || 0)) < 1) {
      return 'Informe a quantidade de pessoas de cada empresa selecionada.'
    }
  }

  return ''
}

export function outsourcingBatchSummary(record = {}) {
  const companies = selectedOutsourcedCompanies(record)
  const totalPessoas = companies.reduce((sum, item) => sum + Math.max(0, Math.trunc(Number(item.quantidadePessoas) || 0)), 0)
  const fechadas = companies.filter(item => item.fechado).length
  return {
    empresas: companies.length,
    totalPessoas,
    fechadas,
    pendentes: Math.max(0, companies.length - fechadas),
    percentualFechamento: companies.length ? Math.round((fechadas / companies.length) * 100) : 0,
  }
}
