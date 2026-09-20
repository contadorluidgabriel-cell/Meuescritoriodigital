// Política conservadora: qualquer referência exata ao identificador em outro módulo impede a exclusão.
const labels = {
  med_cnpjs_vinculados: 'CNPJs vinculados', linkedCompanies: 'CNPJs vinculados',
  med_tarefas: 'tarefas', tasks: 'tarefas', med_processos: 'processos', processes: 'processos',
  med_obrigacoes: 'obrigações', obligations: 'obrigações', med_financeiro: 'cobranças', finance: 'cobranças',
  med_financeiro_pagar: 'contas a pagar', financePayables: 'contas a pagar',
  med_financeiro_movimentos: 'movimentações financeiras', financeMovements: 'movimentações financeiras',
  med_financeiro_cobrancas_eventos: 'histórico de cobranças', financeCollectionEvents: 'histórico de cobranças',
  med_financeiro_recorrencias: 'recorrências financeiras', financeRecurrences: 'recorrências financeiras',
  med_financeiro_fechamentos: 'fechamentos financeiros', financeClosings: 'fechamentos financeiros',
  med_historico_painel: 'histórico do escritório', history: 'histórico do escritório',
  med_parceiros_trabalho: 'parceiros', partners: 'parceiros',
}

function containsExactReference(value, id, depth = 0) {
  // Em caso de estrutura desconhecida/profundidade excessiva, falhar de forma conservadora.
  if (depth > 40) return true
  if (value == null || typeof value === 'boolean') return false
  if (typeof value === 'string' || typeof value === 'number') return String(value) === id
  if (Array.isArray(value)) return value.some(item => containsExactReference(item, id, depth + 1))
  if (typeof value === 'object') return Object.values(value).some(item => containsExactReference(item, id, depth + 1))
  return false
}

export function clientDependencies(data = {}, clientId = '') {
  const id = String(clientId || '').trim()
  if (!id) return [{ key: 'invalid', label: 'identificador inválido', count: 1 }]
  const blockers = []
  for (const [key, records] of Object.entries(data || {})) {
    if (key === 'clients' || key === 'med_clientes') continue
    if (!Array.isArray(records) && !(records && typeof records === 'object')) continue
    const count = Array.isArray(records)
      ? records.filter(item => containsExactReference(item, id)).length
      : Number(containsExactReference(records, id))
    if (count) blockers.push({ key, label: labels[key] || key, count })
  }
  return blockers
}

export function clientHasEmbeddedHistory(client = {}) {
  return ['comunicacoes', 'honorariosHistorico', 'pagamentos', 'historico', 'historicoAtendimento']
    .some(key => Array.isArray(client?.[key]) && client[key].length > 0)
}
