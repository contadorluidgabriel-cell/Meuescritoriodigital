import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(source, before, after, label, path) {
  if (source.includes(after)) return source
  if (!source.includes(before)) throw new Error(`Partner accounting patch failed (${label}) in ${path}`)
  return source.replace(before, after)
}

export function applyPartnerAccountingPatch(root) {
  const ledgerPath = `${root}src/lib/financeComplete.js`
  let ledger = readFileSync(ledgerPath, 'utf8')
  ledger = replaceRequired(ledger,
    "import { addMonths, buildInstallmentCharges, chargePayments, paymentSummary } from './financePro.js'",
    "import { addMonths, buildInstallmentCharges, chargePayments, paymentSummary } from './financePro.js'\nimport { officeCustomerCash, partnerAllocation, partnerSettlementCash } from './partnerAccounting.js'",
    'partner accounting import', ledgerPath)
  ledger = replaceRequired(ledger,
    "export function cashMovements(office = {}) {\n  const rows = []\n  ;(office.finance || []).forEach(charge => {\n    if (normalize(charge.status) === 'cancelado') return",
    "export function cashMovements(office = {}) {\n  const rows = []\n  const clientsById = new Map((office.clients || []).map(client => [String(client.id), client]))\n  ;(office.finance || []).forEach(charge => {\n    // Conservar entradas que realmente ocorreram antes do cancelamento/renegociação.\n    if (normalize(charge.status) === 'cancelado' && !chargePayments(charge).length) return",
    'customer payment custody', ledgerPath)
  ledger = replaceRequired(ledger,
    "    chargePayments(charge).forEach(payment => {\n      if (!payment.data || moneyValue(payment.valorRecebido) <= 0) return\n      rows.push({",
    "    chargePayments(charge).forEach(payment => {\n      if (!payment.data || moneyValue(payment.valorRecebido) <= 0) return\n      const officeCash = officeCustomerCash(charge, clientsById.get(String(charge.clienteId)) || {}, payment)\n      if (officeCash <= 0) return\n      rows.push({",
    'ignore partner-owned customer receipts', ledgerPath)
  ledger = replaceRequired(ledger,
    "        contaId: String(payment.contaId || ''), valor: moneyValue(payment.valorRecebido), realizado: true,",
    "        contaId: String(payment.contaId || ''), valor: officeCash, realizado: true,",
    'correct office customer cash value', ledgerPath)
  ledger = replaceRequired(ledger,
    "  ;(office.financePayables || []).forEach(payable => {\n    if (normalize(payable.status) === 'cancelado') return",
    "  ;(office.finance || []).forEach(charge => {\n    const settlement = partnerSettlementCash(charge, clientsById.get(String(charge.clienteId)) || {})\n    if (settlement) rows.push(settlement)\n  })\n  ;(office.financePayables || []).forEach(payable => {\n    if (normalize(payable.status) === 'cancelado') return",
    'registered partner settlements enter the cash ledger', ledgerPath)
  ledger = replaceRequired(ledger,
    "export function managerialDre(office = {}, competence = '') {\n  const categories = new Map((office.financeCategories || DEFAULT_FINANCE_CATEGORIES).map(item => [String(item.id), item]))",
    "export function managerialDre(office = {}, competence = '') {\n  const categories = new Map((office.financeCategories || DEFAULT_FINANCE_CATEGORIES).map(item => [String(item.id), item]))\n  const clientsById = new Map((office.clients || []).map(client => [String(client.id), client]))",
    'managerial client lookup', ledgerPath)
  ledger = replaceRequired(ledger,
    "  let revenue = 0, expense = 0\n  ;(office.finance || []).forEach(charge => {",
    "  let revenue = 0, expense = 0, partnerShare = 0\n  ;(office.finance || []).forEach(charge => {",
    'partner share accumulator', ledgerPath)
  ledger = replaceRequired(ledger,
    "    revenue += value\n    revenueGroups.set(group, moneyValue((revenueGroups.get(group) || 0) + value))",
    "    revenue += value\n    partnerShare += partnerAllocation(charge, clientsById.get(String(charge.clienteId)) || {}).partnerTotal\n    revenueGroups.set(group, moneyValue((revenueGroups.get(group) || 0) + value))",
    'partner allocation on charges', ledgerPath)
  ledger = replaceRequired(ledger,
    "    revenue: moneyValue(revenue), expense: moneyValue(expense), result: Math.round((revenue - expense) * 100) / 100,",
    "    revenue: moneyValue(revenue), expense: moneyValue(expense), partnerShare: moneyValue(partnerShare),\n    officeRevenue: moneyValue(Math.max(0, revenue - partnerShare)),\n    result: Math.round((revenue - partnerShare - expense) * 100) / 100,",
    'managerial result net of partner allocations', ledgerPath)
  writeFileSync(ledgerPath, ledger)

  const pagePath = `${root}src/components/FinanceCompleteReact.jsx`
  let page = readFileSync(pagePath, 'utf8')
  page = replaceRequired(page,
    "import { allPartnerBalances } from '../lib/sharedWork.js'",
    "import { allPartnerBalances } from '../lib/sharedWork.js'\nimport { missingPartnerSettlements } from '../lib/partnerAccounting.js'",
    'reconciliation alert import', pagePath)
  page = replaceRequired(page,
    "  const partnerBalances = useMemo(() => allPartnerBalances(office.finance || [], office.clients || [], office.partners || []), [office.finance, office.clients, office.partners])",
    "  const partnerBalances = useMemo(() => allPartnerBalances(office.finance || [], office.clients || [], office.partners || []), [office.finance, office.clients, office.partners])\n  const settlementsToReconcile = useMemo(() => missingPartnerSettlements(office), [office])",
    'reconciliation alert calculation', pagePath)
  page = replaceRequired(page,
    "      {unassigned.quantidade ? <div className=\"fc-warning\">",
    "      {settlementsToReconcile.length ? <div className=\"fc-warning\"><strong>{settlementsToReconcile.length} acerto(s) com parceiros marcados como liquidados sem movimento bancário conciliado.</strong><span>Abra a cobrança em Receber → Divisão e registre data e conta apenas se o repasse ocorreu. Nenhuma entrada retroativa foi criada automaticamente.</span></div> : null}\n      {unassigned.quantidade ? <div className=\"fc-warning\">",
    'legacy settlements warning', pagePath)
  page = replaceRequired(page,
    '<Metric label="Resultado gerencial" value={money(dre.result)}',
    '<Metric label="Parte dos parceiros" value={money(dre.partnerShare)} detail="Participação nos serviços da competência" /><Metric label="Receita atribuída ao escritório" value={money(dre.officeRevenue)} detail="Bruto menos participação dos parceiros" /><Metric label="Resultado gerencial" value={money(dre.result)}',
    'managerial overview metrics', pagePath)
  page = replaceRequired(page,
    '<div className="main expense"><span>Despesas</span>',
    '<div><span>Participação dos parceiros (gerencial)</span><b>- {money(dre.partnerShare)}</b></div><div><span>Receita atribuída ao escritório</span><b>{money(dre.officeRevenue)}</b></div><div className="main expense"><span>Despesas</span>',
    'managerial statement allocation', pagePath)
  page = replaceRequired(page,
    '<p>Visão por competência. Não substitui a escrituração contábil oficial.</p>',
    '<p>Bruto menos participação econômica dos parceiros e despesas. A classificação fiscal/contábil depende dos contratos e não é definida por este relatório.</p>',
    'managerial statement disclosure', pagePath)
  writeFileSync(pagePath, page)

  const editorPath = `${root}src/components/SharedFinanceEditor.jsx`
  let editor = readFileSync(editorPath, 'utf8')
  editor = replaceRequired(editor,
    'export default function SharedFinanceEditor({ charge, client, partners = [], onClose, onSave }) {',
    'export default function SharedFinanceEditor({ charge, client, partners = [], accounts = [], onClose, onSave }) {',
    'settlement account props', editorPath)
  editor = replaceRequired(editor,
    "  const [error, setError] = useState('')\n  const partnersById",
    "  const [error, setError] = useState('')\n  const [recordSettlement, setRecordSettlement] = useState(false)\n  const [settlementDate, setSettlementDate] = useState(charge?.compartilhadoAcertoEm || today())\n  const [settlementAccountId, setSettlementAccountId] = useState('')\n  const partnersById",
    'settlement entry form state', editorPath)
  editor = replaceRequired(editor,
    "    const settled = normalized.compartilhadoRecebedor === 'CadaUm' ? SETTLEMENT_DONE : (draft.compartilhadoAcertoStatus || SETTLEMENT_PENDING)\n    onSave({",
    "    const settled = normalized.compartilhadoRecebedor === 'CadaUm' ? SETTLEMENT_DONE : (draft.compartilhadoAcertoStatus || SETTLEMENT_PENDING)\n    const priorCash = charge?.compartilhadoAcertoPagamento\n    const expectedAmount = receiver === 'Escritorio' ? split.partnerTotal : receiver === 'CadaUm' ? 0 : split.mine\n    if (priorCash && (settled !== SETTLEMENT_DONE || receiver !== sharedReceiver(charge, client) || Math.abs(expectedAmount - Number(priorCash.valor || 0)) > 0.009)) {\n      setError('Este repasse já movimentou o caixa. Para mudar o recebedor, o valor ou estornar, registre uma correção financeira antes.'); return\n    }\n    if (settled === SETTLEMENT_DONE && expectedAmount > 0 && !priorCash && charge?.compartilhadoAcertoStatus !== SETTLEMENT_DONE && !recordSettlement) {\n      setError('Para liquidar o acerto, registre a data e a conta em que o repasse ocorreu.'); return\n    }\n    if (recordSettlement && expectedAmount > 0 && (!settlementDate || !settlementAccountId || settled !== SETTLEMENT_DONE)) {\n      setError('Confirme a liquidação e informe a data e a conta financeira do repasse.'); return\n    }\n    const settlementPayment = recordSettlement && expectedAmount > 0\n      ? { data: settlementDate, contaId: settlementAccountId, valor: expectedAmount }\n      : (priorCash || null)\n    onSave({",
    'settlement posting validation', editorPath)
  editor = replaceRequired(editor,
    "      compartilhadoAcertoEm: settled === SETTLEMENT_DONE ? (draft.compartilhadoAcertoEm || today()) : '',",
    "      compartilhadoAcertoEm: settled === SETTLEMENT_DONE ? (recordSettlement ? settlementDate : (draft.compartilhadoAcertoEm || today())) : '',\n      compartilhadoAcertoPagamento: settlementPayment,",
    'persist explicit settlement cash details', editorPath)
  editor = replaceRequired(editor,
    '<label className="finance-field full"><span>Observação desta competência/serviço</span>',
    "{receiver !== 'CadaUm' && !charge?.compartilhadoAcertoPagamento ? <div className=\"finance-field full\"><span>Conciliação financeira do acerto</span>{charge?.compartilhadoAcertoStatus === SETTLEMENT_DONE ? <small>Acerto histórico liquidado sem lançamento de caixa: confira o extrato antes de registrar a movimentação.</small> : null}<label><input type=\"checkbox\" checked={recordSettlement} onChange={event => setRecordSettlement(event.target.checked)} /> Registrar {receiver === 'Escritorio' ? 'saída' : 'entrada'} real de {money(receiver === 'Escritorio' ? split.partnerTotal : split.mine)} na conta do escritório</label>{recordSettlement ? <><label><span>Data do repasse *</span><input type=\"date\" value={settlementDate} onChange={event => setSettlementDate(event.target.value)} /></label><label><span>Conta financeira *</span><select value={settlementAccountId} onChange={event => setSettlementAccountId(event.target.value)}><option value=\"\">Selecione a conta</option>{accounts.filter(account => account.ativo !== false).map(account => <option value={account.id} key={account.id}>{account.nome}</option>)}</select></label></> : null}</div> : null}\n        {charge?.compartilhadoAcertoPagamento ? <p className=\"finance-field full\">Repasse registrado no caixa em {charge.compartilhadoAcertoPagamento.data}, no valor de {money(charge.compartilhadoAcertoPagamento.valor)}. Alterações financeiras exigem lançamento de ajuste.</p> : null}\n        <label className=\"finance-field full\"><span>Observação desta competência/serviço</span>",
    'explicit bank settlement controls', editorPath)
  writeFileSync(editorPath, editor)

  const receivablePath = `${root}src/components/FinanceProReact.jsx`
  let receivables = readFileSync(receivablePath, 'utf8')
  receivables = replaceRequired(receivables,
    "  function deleteCharge(id) { if (!window.confirm('Excluir esta cobrança?')) return; update(draft => { draft.finance = (draft.finance || []).filter(item => String(item.id) !== String(id)) }); setNotice('Cobrança excluída.') }",
    "  function deleteCharge(id) { const target = finance.find(item => String(item.id) === String(id)); if (target && (chargePayments(target).length || target.compartilhadoAcertoPagamento)) { setNotice('Não é possível excluir cobrança com baixa ou repasse: preserve o histórico financeiro.'); return } if (!window.confirm('Excluir esta cobrança?')) return; update(draft => { draft.finance = (draft.finance || []).filter(item => String(item.id) !== String(id)) }); setNotice('Cobrança excluída.') }",
    'prevent deleting posted payments', receivablePath)
  receivables = replaceRequired(receivables,
    "  function removePayment(paymentId) {\n    if (!paymentChargeId || !window.confirm('Estornar esta baixa? O saldo da cobrança será recalculado.')) return",
    "  function removePayment(paymentId) {\n    const currentCharge = finance.find(item => String(item.id) === String(paymentChargeId))\n    if (currentCharge?.compartilhadoAcertoPagamento) { setNotice('O repasse já movimentou o caixa. Concilie ou estorne o acerto antes da baixa do cliente.'); return }\n    if (!paymentChargeId || !window.confirm('Estornar esta baixa? O saldo da cobrança será recalculado.')) return",
    'protect payments with posted settlement', receivablePath)
  receivables = replaceRequired(receivables,
    'SharedFinanceEditor charge={sharedEditorCharge} client={sharedClient || {}} partners={partners} onClose=',
    'SharedFinanceEditor charge={sharedEditorCharge} client={sharedClient || {}} partners={partners} accounts={office.financeAccounts || []} onClose=',
    'supply settlement bank accounts', receivablePath)
  receivables = replaceRequired(receivables,
    'Eficiência de recebimento</small>',
    'Quitação das cobranças</small>',
    'customer paid versus bank cash label', receivablePath)
  receivables = replaceRequired(receivables,
    '{money(metrics.received)} efetivamente recebido no período selecionado.',
    '{money(metrics.received)} quitado pelos clientes, inclusive valores recebidos diretamente por parceiros. Confira o caixa para o dinheiro efetivamente recebido pelo escritório.',
    'customer paid versus bank cash disclosure', receivablePath)
  writeFileSync(receivablePath, receivables)
}
