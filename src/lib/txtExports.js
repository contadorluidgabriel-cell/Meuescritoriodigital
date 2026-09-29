const clean = value => String(value ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
const list = value => Array.isArray(value) ? value : []
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const yesNo = value => value ? 'Sim' : 'Não'
const clientName = client => clean(client?.razao || client?.nome || client?.fantasia || 'Cliente sem nome')
const partnerName = partner => clean(partner?.nome || partner?.razao || partner?.fantasia || partner?.id || 'Parceiro')

function line(label, value) {
  const text = clean(value)
  return text ? `${label}: ${text}` : `${label}: -`
}

function section(title, rows) {
  return [`\n=== ${title} ===`, ...rows].join('\n')
}

function partnerNames(office, ids = []) {
  const byId = new Map(list(office.partners).map(partner => [String(partner.id), partnerName(partner)]))
  return [...new Set(list(ids).map(id => byId.get(String(id)) || clean(id)).filter(Boolean))].join(', ')
}

function sharedPartnerIds(record = {}) {
  return [...new Set([
    ...list(record.parceiroIds),
    record.parceiroId,
    ...list(record.compartilhadoPartesParceiros).map(item => item?.parceiroId),
  ].map(value => clean(value)).filter(Boolean))]
}

function header(title, total) {
  return [
    'MEU ESCRITÓRIO DIGITAL',
    `EXPORTAÇÃO: ${title}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total de registros principais: ${total}`,
    '',
  ].join('\n')
}

export function buildClientsTxt(office = {}) {
  const clients = list(office.clients)
  const body = clients.map((client, index) => {
    const partners = partnerNames(office, sharedPartnerIds(client))
    return [
      `--- CLIENTE ${index + 1} ---`,
      line('ID', client.id),
      line('Tipo', client.tipo),
      line(client.tipo === 'PF' ? 'Nome' : 'Razão social', client.razao || client.nome),
      line('Nome fantasia', client.fantasia),
      line('CPF/CNPJ', client.documento),
      line('Status', client.status),
      line('Relacionamento', client.relacionamento),
      line('Forma de atendimento', client.perfilAtendimento),
      line('Parceiro(s)', partners),
      line('Tributação', client.tributacao),
      line('Atividade', client.atividade),
      line('Departamentos', list(client.departamentos).join(', ')),
      line('Telefone', client.telefone),
      line('WhatsApp', client.whatsapp),
      line('E-mail', client.email),
      line('Endereço', client.endereco),
      line('Data de entrada', client.dataEntrada),
      line('Data de saída', client.dataSaida),
      line('Motivo da saída', client.motivoSaida),
      line('Mensalidade', client.mensalidade ? money(client.mensalidade) : ''),
      line('Dia de vencimento', client.vencimento),
      line('Google Drive', client.drive),
      line('Observações', client.observacoes),
    ].join('\n')
  })
  return header('CLIENTES', clients.length) + body.join('\n\n')
}

function processStepLines(process = {}) {
  const steps = list(process.etapas).slice().sort((a, b) => Number(a?.ordem || 0) - Number(b?.ordem || 0))
  if (!steps.length) return ['Etapas: -']
  return ['Etapas:', ...steps.map((step, index) => {
    const details = [
      clean(step.status || 'Pendente'),
      step.responsavelTipo ? `responsável: ${clean(step.responsavelTipo)}` : '',
      step.prazoEtapa ? `prazo: ${clean(step.prazoEtapa)}` : '',
      step.proximaRevisao ? `revisão: ${clean(step.proximaRevisao)}` : '',
      step.opcional ? 'opcional' : '',
    ].filter(Boolean).join(' | ')
    return `  ${index + 1}. ${clean(step.nome || 'Etapa')} — ${details}`
  })]
}

function processProtocolLines(process = {}) {
  const protocols = list(process.protocolos)
  if (!protocols.length) return ['Protocolos: -']
  return ['Protocolos:', ...protocols.map((item, index) => `  ${index + 1}. ${clean(item?.numero || item?.protocolo || item?.valor || item)}${item?.data ? ` | ${clean(item.data)}` : ''}`)]
}

export function buildProcessesTxt(office = {}) {
  const processes = list(office.processes)
  const clientsById = new Map(list(office.clients).map(client => [String(client.id), client]))
  const body = processes.map((process, index) => {
    const client = clientsById.get(String(process.clientId))
    const partners = partnerNames(office, sharedPartnerIds(process))
    return [
      `--- PROCESSO ${index + 1} ---`,
      line('ID', process.id),
      line('Cliente', client ? clientName(client) : process.clientId),
      line('CPF/CNPJ do cliente', client?.documento),
      line('Tipo', process.tipo),
      line('Modelo', process.modeloId),
      line('Status', process.status),
      line('Origem', process.origem),
      line('Data de abertura', process.dataAbertura),
      line('Prazo final', process.prazoFinal),
      line('Previsão de conclusão', process.previsaoConclusao),
      line('Data de conclusão', process.dataConclusao),
      line('Responsável', process.responsavel),
      line('Parceiro(s)', partners),
      line('Google Drive', process.drive),
      line('Observações', process.observacoes),
      ...processStepLines(process),
      ...processProtocolLines(process),
    ].join('\n')
  })
  return header('PROCESSOS', processes.length) + body.join('\n\n')
}

function paymentLines(charge = {}) {
  const payments = list(charge.pagamentos)
  if (!payments.length) return ['Baixas: -']
  return ['Baixas:', ...payments.map((item, index) => {
    const value = item?.valorRecebido ?? item?.valor ?? 0
    const parts = [
      item?.data ? clean(item.data) : '',
      value ? money(value) : '',
      item?.contaId ? `conta ${clean(item.contaId)}` : '',
      item?.observacao ? clean(item.observacao) : '',
    ].filter(Boolean)
    return `  ${index + 1}. ${parts.join(' | ')}`
  })]
}

function financeRecord(title, item = {}, clientsById = new Map(), accountsById = new Map(), categoriesById = new Map()) {
  const client = clientsById.get(String(item.clienteId || item.clientId || ''))
  return [
    title,
    line('ID', item.id),
    line('Cliente', client ? clientName(client) : item.cliente || item.clientName),
    line('Descrição', item.descricao || item.nome),
    line('Competência', item.competencia),
    line('Data', item.data),
    line('Vencimento', item.vencimento),
    line('Valor', item.valor != null ? money(item.valor) : ''),
    line('Valor recebido', item.valorRecebido != null ? money(item.valorRecebido) : ''),
    line('Saldo', item.saldo != null ? money(item.saldo) : ''),
    line('Status', item.status),
    line('Tipo', item.tipo),
    line('Conta', accountsById.get(String(item.contaId || '')) || item.contaId),
    line('Categoria', categoriesById.get(String(item.categoriaId || '')) || item.categoriaId),
    line('Origem', item.origem || item.sourceType || item.origemTipo),
    line('Observação', item.observacao || item.observacoes),
    ...paymentLines(item),
  ].join('\n')
}

export function buildFinanceTxt(office = {}) {
  const receivables = list(office.finance)
  const payables = list(office.financePayables)
  const movements = list(office.financeMovements)
  const accounts = list(office.financeAccounts)
  const categories = list(office.financeCategories)
  const recurrences = list(office.financeRecurrences)
  const closings = list(office.financeClosings)
  const collectionEvents = list(office.financeCollectionEvents)
  const clientsById = new Map(list(office.clients).map(client => [String(client.id), client]))
  const accountsById = new Map(accounts.map(item => [String(item.id), clean(item.nome || item.name)]))
  const categoriesById = new Map(categories.map(item => [String(item.id), clean(item.nome || item.name)]))
  const total = receivables.length + payables.length + movements.length

  const sections = []

  sections.push(section('CONTAS A RECEBER', receivables.length
    ? receivables.map((item, index) => financeRecord(`--- RECEBÍVEL ${index + 1} ---`, item, clientsById, accountsById, categoriesById))
    : ['Nenhum registro.']))

  sections.push(section('CONTAS A PAGAR', payables.length
    ? payables.map((item, index) => financeRecord(`--- PAGÁVEL ${index + 1} ---`, item, clientsById, accountsById, categoriesById))
    : ['Nenhum registro.']))

  sections.push(section('MOVIMENTAÇÕES', movements.length
    ? movements.map((item, index) => financeRecord(`--- MOVIMENTAÇÃO ${index + 1} ---`, item, clientsById, accountsById, categoriesById))
    : ['Nenhum registro.']))

  sections.push(section('CONTAS FINANCEIRAS', accounts.length
    ? accounts.map((item, index) => [`--- CONTA ${index + 1} ---`, line('ID', item.id), line('Nome', item.nome || item.name), line('Tipo', item.tipo), line('Saldo inicial', item.saldoInicial != null ? money(item.saldoInicial) : ''), line('Ativa', yesNo(item.ativo !== false))].join('\n'))
    : ['Nenhum registro.']))

  sections.push(section('CATEGORIAS', categories.length
    ? categories.map((item, index) => `${index + 1}. ${clean(item.nome || item.name || item.id)}${item.tipo ? ` | ${clean(item.tipo)}` : ''}`)
    : ['Nenhum registro.']))

  sections.push(section('RECORRÊNCIAS', recurrences.length
    ? recurrences.map((item, index) => [`--- RECORRÊNCIA ${index + 1} ---`, line('ID', item.id), line('Descrição', item.descricao || item.nome), line('Tipo', item.tipo), line('Valor', item.valor != null ? money(item.valor) : ''), line('Dia', item.dia || item.vencimentoDia), line('Ativa', yesNo(item.ativo !== false))].join('\n'))
    : ['Nenhum registro.']))

  sections.push(section('FECHAMENTOS', closings.length
    ? closings.map((item, index) => [`--- FECHAMENTO ${index + 1} ---`, line('Competência', item.competencia), line('Data', item.data || item.geradoEm), line('Resultado', item.resultado != null ? money(item.resultado) : ''), line('Observação', item.observacao)].join('\n'))
    : ['Nenhum registro.']))

  sections.push(section('HISTÓRICO DE COBRANÇA', collectionEvents.length
    ? collectionEvents.map((item, index) => [`--- EVENTO ${index + 1} ---`, line('Cobrança', item.chargeId), line('Tipo', item.tipo), line('Data', item.data), line('Observação', item.observacao)].join('\n'))
    : ['Nenhum registro.']))

  return header('FINANCEIRO', total) + sections.join('\n')
}

export function buildTxtExport(office = {}, type = '') {
  if (type === 'clients') return buildClientsTxt(office)
  if (type === 'processes') return buildProcessesTxt(office)
  if (type === 'finance') return buildFinanceTxt(office)
  throw new Error('Tipo de exportação TXT inválido.')
}

export function txtExportFilename(type = '', date = new Date()) {
  const stamp = date.toISOString().slice(0, 10)
  const names = { clients: 'clientes', processes: 'processos', finance: 'financeiro' }
  return `med-${names[type] || 'dados'}-${stamp}.txt`
}

export function downloadTxtExport(office = {}, type = '') {
  const content = buildTxtExport(office, type)
  const blob = new Blob(['\uFEFF', content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = txtExportFilename(type)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
