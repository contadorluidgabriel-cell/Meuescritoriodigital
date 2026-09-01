import { useEffect, useMemo, useState } from 'react'
import FinanceProReact from './FinanceProReact.jsx'
import { today, uid } from '../lib/storage.js'
import { buildInstallmentCharges, paymentSummary } from '../lib/financePro.js'
import { allPartnerBalances } from '../lib/sharedWork.js'
import {
  DEFAULT_FINANCE_CATEGORIES,
  accountBalances,
  addPaymentToPayable,
  buildPayableInstallments,
  buildRecurringEntries,
  cashFlowByDay,
  cashMovements,
  collectionEventsForCharge,
  defaultFinanceAccount,
  effectivePayableStatus,
  financeOverview,
  forecastCash,
  managerialDre,
  monthlyClosingSnapshot,
  payableSummary,
  receivableAging,
  removePaymentFromPayable,
  unassignedCash,
} from '../lib/financeComplete.js'
import '../finance-complete.css'

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateBr = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const monthLabel = value => value && /^\d{4}-\d{2}$/.test(value) ? new Date(`${value}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : value
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'
const currentMonth = () => today().slice(0, 7)

const tabs = [
  ['overview', 'Visão geral'],
  ['receber', 'Receber'],
  ['pagar', 'Pagar'],
  ['movimentos', 'Movimentações'],
  ['fluxo', 'Fluxo de caixa'],
  ['parceiros', 'Parceiros'],
  ['relatorios', 'Relatórios'],
  ['config', 'Configurações'],
]

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <div className="fc-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className={`fc-modal-card ${wide ? 'wide' : ''}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose}>×</button></header>{children}</div></div>
}

function Field({ label, full = false, children }) { return <label className={`fc-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }

function PayableForm({ categories, onClose, onSave }) {
  const [draft, setDraft] = useState({ descricao: '', fornecedor: '', categoriaId: 'desp-outras', valor: '', parcelas: 1, vencimento: today(), competencia: currentMonth(), observacao: '' })
  const [error, setError] = useState('')
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  function submit(event) {
    event.preventDefault()
    const value = Number(draft.valor || 0)
    if (!draft.descricao.trim() || value <= 0 || !draft.vencimento) { setError('Informe descrição, valor e vencimento.'); return }
    const base = {
      id: uid('pagar'), descricao: draft.descricao.trim(), fornecedor: draft.fornecedor.trim(), categoriaId: draft.categoriaId || 'desp-outras',
      valor: value, vencimento: draft.vencimento, competencia: draft.competencia || draft.vencimento.slice(0, 7), observacao: draft.observacao.trim(),
      status: 'Pendente', pagamentos: [], origem: 'manual', createdAt: new Date().toISOString(),
    }
    onSave(buildPayableInstallments(base, Number(draft.parcelas || 1), prefix => uid(prefix)))
  }
  return <Modal title="Nova conta a pagar" subtitle="Despesa, fornecedor, parcelamento e competência." onClose={onClose}><form className="fc-form" onSubmit={submit}>
    <Field label="Descrição *" full><input value={draft.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex.: Licença do sistema" /></Field>
    <Field label="Fornecedor"><input value={draft.fornecedor} onChange={e => set('fornecedor', e.target.value)} placeholder="Fornecedor ou favorecido" /></Field>
    <Field label="Categoria"><select value={draft.categoriaId} onChange={e => set('categoriaId', e.target.value)}>{categories.filter(item => item.tipo === 'despesa' && item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field>
    <Field label="Valor total *"><input type="number" min="0" step="0.01" value={draft.valor} onChange={e => set('valor', e.target.value)} /></Field>
    <Field label="Parcelas"><input type="number" min="1" max="120" value={draft.parcelas} onChange={e => set('parcelas', e.target.value)} /></Field>
    <Field label="Primeiro vencimento *"><input type="date" value={draft.vencimento} onChange={e => set('vencimento', e.target.value)} /></Field>
    <Field label="Primeira competência"><input type="month" value={draft.competencia} onChange={e => set('competencia', e.target.value)} /></Field>
    <Field label="Observação" full><input value={draft.observacao} onChange={e => set('observacao', e.target.value)} placeholder="Opcional" /></Field>
    {Number(draft.parcelas) > 1 ? <p className="fc-hint full">O valor será dividido em parcelas mensais com ajuste automático de centavos.</p> : null}
    {error ? <p className="fc-error full">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Salvar conta</button></footer>
  </form></Modal>
}

function PayablePaymentModal({ payable, accounts, defaultAccountId, onClose, onSave, onRemove }) {
  const summary = payableSummary(payable)
  const [draft, setDraft] = useState({ data: today(), valorPago: summary.balance, desconto: 0, acrescimo: 0, contaId: defaultAccountId || accounts[0]?.id || '', formaPagamento: 'Pix', observacao: '' })
  const [error, setError] = useState('')
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  function submit(event) {
    event.preventDefault()
    if (!draft.data || Number(draft.valorPago || 0) <= 0) { setError('Informe data e valor pago.'); return }
    try { onSave({ ...draft, valorPago: Number(draft.valorPago), desconto: Number(draft.desconto), acrescimo: Number(draft.acrescimo) }) } catch (err) { setError(err.message) }
  }
  return <Modal title={summary.balance > 0.009 ? 'Registrar pagamento' : 'Histórico de pagamentos'} subtitle={payable.descricao || 'Conta a pagar'} onClose={onClose}>
    <div className="fc-payment-summary"><span><small>Original</small><b>{money(summary.total)}</b></span><span><small>Pago</small><b>{money(summary.paidCash)}</b></span><span><small>Saldo</small><b>{money(summary.balance)}</b></span></div>
    {summary.balance > 0.009 ? <form className="fc-form" onSubmit={submit}>
      <Field label="Data *"><input type="date" value={draft.data} onChange={e => set('data', e.target.value)} /></Field>
      <Field label="Valor pago *"><input type="number" min="0" step="0.01" value={draft.valorPago} onChange={e => set('valorPago', e.target.value)} /></Field>
      <Field label="Desconto"><input type="number" min="0" step="0.01" value={draft.desconto} onChange={e => set('desconto', e.target.value)} /></Field>
      <Field label="Acréscimo"><input type="number" min="0" step="0.01" value={draft.acrescimo} onChange={e => set('acrescimo', e.target.value)} /></Field>
      <Field label="Conta"><select value={draft.contaId} onChange={e => set('contaId', e.target.value)}><option value="">Sem conta</option>{accounts.filter(item => item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Forma"><select value={draft.formaPagamento} onChange={e => set('formaPagamento', e.target.value)}><option>Pix</option><option>Transferência</option><option>Boleto</option><option>Cartão</option><option>Dinheiro</option><option>Outro</option></select></Field>
      <Field label="Observação" full><input value={draft.observacao} onChange={e => set('observacao', e.target.value)} /></Field>
      {error ? <p className="fc-error full">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Registrar pagamento</button></footer>
    </form> : null}
    <section className="fc-history"><h3>Pagamentos registrados</h3>{summary.payments.length ? summary.payments.map(item => <article key={item.id}><div><b>{dateBr(item.data)} · {money(item.valorPago)}</b><small>{accounts.find(account => String(account.id) === String(item.contaId))?.nome || 'Sem conta'}{item.observacao ? ` · ${item.observacao}` : ''}</small></div><button type="button" className="danger" onClick={() => onRemove(item.id)}>Estornar</button></article>) : <p>Nenhum pagamento registrado.</p>}</section>
  </Modal>
}

function MovementForm({ accounts, categories, onClose, onSave }) {
  const [draft, setDraft] = useState({ tipo: 'saida', data: today(), competencia: currentMonth(), descricao: '', categoriaId: 'desp-outras', contaId: accounts[0]?.id || '', contaDestinoId: '', valor: '', realizado: true, observacao: '' })
  const [error, setError] = useState('')
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  function submit(event) {
    event.preventDefault()
    if (!draft.descricao.trim() || Number(draft.valor || 0) <= 0 || !draft.data || !draft.contaId) { setError('Informe descrição, valor, data e conta.'); return }
    if (draft.tipo === 'transferencia' && (!draft.contaDestinoId || draft.contaDestinoId === draft.contaId)) { setError('Selecione uma conta de destino diferente.'); return }
    onSave({ ...draft, id: uid('mov'), valor: Number(draft.valor), createdAt: new Date().toISOString(), categoriaId: draft.tipo === 'transferencia' ? '' : draft.categoriaId })
  }
  const categoryType = draft.tipo === 'entrada' ? 'receita' : 'despesa'
  return <Modal title="Nova movimentação" subtitle="Entrada, saída ou transferência entre contas." onClose={onClose}><form className="fc-form" onSubmit={submit}>
    <Field label="Tipo"><select value={draft.tipo} onChange={e => set('tipo', e.target.value)}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="transferencia">Transferência</option></select></Field>
    <Field label="Data"><input type="date" value={draft.data} onChange={e => set('data', e.target.value)} /></Field>
    <Field label="Descrição" full><input value={draft.descricao} onChange={e => set('descricao', e.target.value)} /></Field>
    <Field label="Valor"><input type="number" min="0" step="0.01" value={draft.valor} onChange={e => set('valor', e.target.value)} /></Field>
    <Field label="Competência"><input type="month" value={draft.competencia} onChange={e => set('competencia', e.target.value)} /></Field>
    <Field label={draft.tipo === 'transferencia' ? 'Conta de origem' : 'Conta'}><select value={draft.contaId} onChange={e => set('contaId', e.target.value)}><option value="">Selecione</option>{accounts.filter(item => item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field>
    {draft.tipo === 'transferencia' ? <Field label="Conta de destino"><select value={draft.contaDestinoId} onChange={e => set('contaDestinoId', e.target.value)}><option value="">Selecione</option>{accounts.filter(item => item.ativo !== false && item.id !== draft.contaId).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field> : <Field label="Categoria"><select value={draft.categoriaId} onChange={e => set('categoriaId', e.target.value)}>{categories.filter(item => item.tipo === categoryType && item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field>}
    <Field label="Situação"><select value={draft.realizado ? '1' : '0'} onChange={e => set('realizado', e.target.value === '1')}><option value="1">Realizada</option><option value="0">Prevista</option></select></Field>
    <Field label="Observação" full><input value={draft.observacao} onChange={e => set('observacao', e.target.value)} /></Field>
    {error ? <p className="fc-error full">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Salvar movimentação</button></footer>
  </form></Modal>
}

function AccountForm({ onClose, onSave }) {
  const [draft, setDraft] = useState({ nome: '', tipo: 'Banco', saldoInicial: 0, dataSaldoInicial: today(), observacao: '' })
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  return <Modal title="Nova conta financeira" subtitle="Banco, carteira, caixa ou outra conta de movimentação." onClose={onClose}><form className="fc-form" onSubmit={event => { event.preventDefault(); if (!draft.nome.trim()) return; onSave({ ...draft, id: uid('conta'), saldoInicial: Number(draft.saldoInicial || 0), ativo: true }) }}>
    <Field label="Nome" full><input required value={draft.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex.: Nubank PJ" /></Field>
    <Field label="Tipo"><select value={draft.tipo} onChange={e => set('tipo', e.target.value)}><option>Banco</option><option>Carteira digital</option><option>Caixa</option><option>Dinheiro</option><option>Outro</option></select></Field>
    <Field label="Saldo inicial"><input type="number" step="0.01" value={draft.saldoInicial} onChange={e => set('saldoInicial', e.target.value)} /></Field>
    <Field label="Data do saldo"><input type="date" value={draft.dataSaldoInicial} onChange={e => set('dataSaldoInicial', e.target.value)} /></Field>
    <Field label="Observação" full><input value={draft.observacao} onChange={e => set('observacao', e.target.value)} /></Field>
    <footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Criar conta</button></footer>
  </form></Modal>
}

function CategoryForm({ onClose, onSave }) {
  const [draft, setDraft] = useState({ nome: '', tipo: 'despesa', grupo: 'Despesas operacionais' })
  return <Modal title="Nova categoria" subtitle="Classificação usada no fluxo e na DRE gerencial." onClose={onClose}><form className="fc-form" onSubmit={event => { event.preventDefault(); if (!draft.nome.trim()) return; onSave({ id: uid('cat'), nome: draft.nome.trim(), tipo: draft.tipo, grupo: draft.grupo.trim() || (draft.tipo === 'receita' ? 'Receitas' : 'Despesas'), ativo: true }) }}>
    <Field label="Nome" full><input required value={draft.nome} onChange={e => setDraft(current => ({ ...current, nome: e.target.value }))} /></Field>
    <Field label="Tipo"><select value={draft.tipo} onChange={e => setDraft(current => ({ ...current, tipo: e.target.value }))}><option value="receita">Receita</option><option value="despesa">Despesa</option></select></Field>
    <Field label="Grupo"><input value={draft.grupo} onChange={e => setDraft(current => ({ ...current, grupo: e.target.value }))} /></Field>
    <footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Criar categoria</button></footer>
  </form></Modal>
}

function RecurrenceForm({ clients, categories, onClose, onSave }) {
  const [draft, setDraft] = useState({ tipo: 'despesa', descricao: '', fornecedor: '', clienteId: '', categoriaId: 'desp-sistemas', valor: '', diaVencimento: 10, inicioCompetencia: currentMonth(), fimCompetencia: '' })
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const categoryType = draft.tipo === 'receita' ? 'receita' : 'despesa'
  return <Modal title="Nova recorrência" subtitle="Gera automaticamente a receita ou despesa quando o Financeiro é aberto." onClose={onClose}><form className="fc-form" onSubmit={event => { event.preventDefault(); if (!draft.descricao.trim() || Number(draft.valor || 0) <= 0) return; onSave({ ...draft, id: uid('recfin'), valor: Number(draft.valor), diaVencimento: Number(draft.diaVencimento), ativo: true, createdAt: new Date().toISOString() }) }}>
    <Field label="Tipo"><select value={draft.tipo} onChange={e => { const tipo = e.target.value; setDraft(current => ({ ...current, tipo, categoriaId: tipo === 'receita' ? 'rec-outras' : 'desp-sistemas' })) }}><option value="despesa">Despesa</option><option value="receita">Receita</option></select></Field>
    <Field label="Descrição"><input required value={draft.descricao} onChange={e => set('descricao', e.target.value)} /></Field>
    {draft.tipo === 'despesa' ? <Field label="Fornecedor"><input value={draft.fornecedor} onChange={e => set('fornecedor', e.target.value)} /></Field> : <Field label="Cliente"><select value={draft.clienteId} onChange={e => set('clienteId', e.target.value)}><option value="">Receita sem cliente</option>{clients.map(client => <option value={client.id} key={client.id}>{clientName(client)}</option>)}</select></Field>}
    <Field label="Categoria"><select value={draft.categoriaId} onChange={e => set('categoriaId', e.target.value)}>{categories.filter(item => item.tipo === categoryType && item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></Field>
    <Field label="Valor"><input type="number" min="0" step="0.01" value={draft.valor} onChange={e => set('valor', e.target.value)} /></Field>
    <Field label="Dia do vencimento"><input type="number" min="1" max="31" value={draft.diaVencimento} onChange={e => set('diaVencimento', e.target.value)} /></Field>
    <Field label="Início"><input type="month" value={draft.inicioCompetencia} onChange={e => set('inicioCompetencia', e.target.value)} /></Field>
    <Field label="Fim opcional"><input type="month" value={draft.fimCompetencia} onChange={e => set('fimCompetencia', e.target.value)} /></Field>
    <footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary">Salvar recorrência</button></footer>
  </form></Modal>
}

function CollectionModal({ charge, clientsById, events, onClose, onEvent, onAgreement }) {
  const summary = paymentSummary(charge)
  const [draft, setDraft] = useState({ tipo: 'whatsapp', data: today(), observacao: '', promessaData: '', parcelas: 2, primeiroVencimento: today() })
  const client = clientsById.get(String(charge.clienteId))
  const history = collectionEventsForCharge(events, charge.id)
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  function submit(event) {
    event.preventDefault()
    if (draft.tipo === 'acordo') {
      onAgreement(charge, { ...draft, parcelas: Number(draft.parcelas || 1) })
      return
    }
    onEvent({ id: uid('cobevt'), chargeId: String(charge.id), tipo: draft.tipo, data: draft.data, promessaData: draft.promessaData, observacao: draft.observacao.trim(), createdAt: new Date().toISOString() })
  }
  return <Modal title="Régua de cobrança" subtitle={`${clientName(client)} · saldo ${money(summary.balance)}`} onClose={onClose} wide><div className="fc-collection-layout"><form className="fc-form" onSubmit={submit}>
    <Field label="Ação"><select value={draft.tipo} onChange={e => set('tipo', e.target.value)}><option value="whatsapp">Contato por WhatsApp</option><option value="telefone">Ligação</option><option value="email">E-mail</option><option value="promessa">Promessa de pagamento</option><option value="observacao">Observação</option><option value="acordo">Criar acordo parcelado</option></select></Field>
    <Field label="Data"><input type="date" value={draft.data} onChange={e => set('data', e.target.value)} /></Field>
    {draft.tipo === 'promessa' ? <Field label="Prometeu pagar em"><input type="date" value={draft.promessaData} onChange={e => set('promessaData', e.target.value)} /></Field> : null}
    {draft.tipo === 'acordo' ? <><Field label="Parcelas"><input type="number" min="1" max="60" value={draft.parcelas} onChange={e => set('parcelas', e.target.value)} /></Field><Field label="Primeiro vencimento"><input type="date" value={draft.primeiroVencimento} onChange={e => set('primeiroVencimento', e.target.value)} /></Field><p className="fc-hint full">O acordo será criado sobre o saldo atual de {money(summary.balance)}. A cobrança original será preservada como cancelada por acordo.</p></> : null}
    <Field label="Observação" full><textarea value={draft.observacao} onChange={e => set('observacao', e.target.value)} placeholder="O que foi combinado?" /></Field>
    <footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary">{draft.tipo === 'acordo' ? 'Gerar acordo' : 'Registrar contato'}</button></footer>
  </form><section className="fc-history"><h3>Histórico de cobrança</h3>{history.length ? history.map(item => <article key={item.id}><div><b>{dateBr(item.data)} · {item.tipo}</b><small>{item.promessaData ? `Promessa: ${dateBr(item.promessaData)} · ` : ''}{item.observacao || 'Sem observação'}</small></div></article>) : <p>Nenhum contato registrado.</p>}</section></div></Modal>
}

function Metric({ label, value, detail, danger = false, good = false }) { return <article className={`fc-metric ${danger ? 'danger' : ''} ${good ? 'good' : ''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article> }

export default function FinanceCompleteReact({ office, update, sync, initialClientId = '', openClientRequest = 0, openNewRequest = 0 }) {
  const day = today()
  const [tab, setTab] = useState('overview')
  const [competence, setCompetence] = useState(currentMonth)
  const [creatingPayable, setCreatingPayable] = useState(false)
  const [payingId, setPayingId] = useState('')
  const [creatingMovement, setCreatingMovement] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [creatingRecurrence, setCreatingRecurrence] = useState(false)
  const [collectingId, setCollectingId] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (initialClientId || openClientRequest || openNewRequest) setTab('receber')
  }, [initialClientId, openClientRequest, openNewRequest])

  useEffect(() => {
    const missingCategories = !(office.financeCategories || []).length
    const missingAccounts = !(office.financeAccounts || []).length
    const missingDefault = !office.financeConfig?.defaultAccountId
    if (!missingCategories && !missingAccounts && !missingDefault) return
    update(draft => {
      if (!(draft.financeCategories || []).length) draft.financeCategories = structuredClone(DEFAULT_FINANCE_CATEGORIES)
      if (!(draft.financeAccounts || []).length) draft.financeAccounts = [defaultFinanceAccount(() => 'finance-main')]
      if (!draft.financeConfig || typeof draft.financeConfig !== 'object') draft.financeConfig = {}
      if (!draft.financeConfig.defaultAccountId) draft.financeConfig.defaultAccountId = draft.financeAccounts[0]?.id || ''
      if (!draft.financeConfig.forecastDays) draft.financeConfig.forecastDays = 30
    })
  }, [office.financeAccounts, office.financeCategories, office.financeConfig, update])

  useEffect(() => {
    if (!(office.financeRecurrences || []).some(item => item.ativo !== false)) return
    const generated = buildRecurringEntries(office, competence, prefix => uid(prefix))
    if (!generated.receivables.length && !generated.payables.length) return
    update(draft => {
      draft.finance = [...(draft.finance || []), ...generated.receivables]
      draft.financePayables = [...(draft.financePayables || []), ...generated.payables]
    })
    setNotice(`${generated.receivables.length + generated.payables.length} lançamento(s) recorrente(s) gerado(s) para ${monthLabel(competence)}.`)
  }, [competence, office, update])

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3200); return () => clearTimeout(timer) }, [notice])

  const categories = office.financeCategories || DEFAULT_FINANCE_CATEGORIES
  const accounts = office.financeAccounts || []
  const clientsById = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), client])), [office.clients])
  const overview = useMemo(() => financeOverview(office, { day, competence }), [office, day, competence])
  const forecast = useMemo(() => forecastCash(office, { day, days: Number(office.financeConfig?.forecastDays || 30) }), [office, day])
  const balances = useMemo(() => accountBalances(office, day), [office, day])
  const unassigned = useMemo(() => unassignedCash(office), [office])
  const ledger = useMemo(() => cashMovements(office), [office])
  const flow = useMemo(() => cashFlowByDay(office, { start: `${competence}-01`, end: `${competence}-31` }), [office, competence])
  const dre = useMemo(() => managerialDre(office, competence), [office, competence])
  const payables = useMemo(() => (office.financePayables || []).map(item => ({ ...item, _summary: payableSummary(item), _status: effectivePayableStatus(item, day) })).sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || ''))), [office.financePayables, day])
  const overdueReceivables = useMemo(() => receivableAging(office.finance || [], day).filter(item => item.overdue), [office.finance, day])
  const partnerBalances = useMemo(() => allPartnerBalances(office.finance || [], office.clients || [], office.partners || []), [office.finance, office.clients, office.partners])
  const paying = payables.find(item => String(item.id) === String(payingId)) || null
  const collecting = (office.finance || []).find(item => String(item.id) === String(collectingId)) || null
  const totalFlowEntries = flow.reduce((sum, row) => sum + row.entries, 0)
  const totalFlowExits = flow.reduce((sum, row) => sum + row.exits, 0)

  function savePayables(rows) { update(draft => { draft.financePayables = [...(draft.financePayables || []), ...rows] }); setCreatingPayable(false); setNotice(`${rows.length} conta(s) a pagar criada(s).`) }
  function savePayablePayment(payment) {
    update(draft => { const index = (draft.financePayables || []).findIndex(item => String(item.id) === String(payingId)); if (index >= 0) draft.financePayables[index] = addPaymentToPayable(draft.financePayables[index], payment, () => uid('ppay')) })
    setPayingId(''); setNotice('Pagamento registrado no fluxo de caixa.')
  }
  function removePayablePayment(paymentId) { update(draft => { const index = (draft.financePayables || []).findIndex(item => String(item.id) === String(payingId)); if (index >= 0) draft.financePayables[index] = removePaymentFromPayable(draft.financePayables[index], paymentId, day) }); setNotice('Pagamento estornado.') }
  function saveMovement(row) { update(draft => { draft.financeMovements = [...(draft.financeMovements || []), row] }); setCreatingMovement(false); setNotice(row.realizado ? 'Movimentação registrada.' : 'Movimentação prevista adicionada à projeção.') }
  function saveAccount(row) { update(draft => { draft.financeAccounts = [...(draft.financeAccounts || []), row]; if (!draft.financeConfig?.defaultAccountId) draft.financeConfig = { ...(draft.financeConfig || {}), defaultAccountId: row.id } }); setCreatingAccount(false) }
  function saveCategory(row) { update(draft => { draft.financeCategories = [...(draft.financeCategories || []), row] }); setCreatingCategory(false) }
  function saveRecurrence(row) { update(draft => { draft.financeRecurrences = [...(draft.financeRecurrences || []), row] }); setCreatingRecurrence(false); setNotice('Recorrência cadastrada. O mês atual será gerado automaticamente.') }
  function addCollectionEvent(row) { update(draft => { draft.financeCollectionEvents = [...(draft.financeCollectionEvents || []), row] }); setCollectingId(''); setNotice('Contato de cobrança registrado.') }
  function createAgreement(charge, agreement) {
    const summary = paymentSummary(charge)
    if (summary.balance <= 0.009 || !agreement.primeiroVencimento) return
    update(draft => {
      const index = (draft.finance || []).findIndex(item => String(item.id) === String(charge.id))
      if (index < 0) return
      draft.finance[index] = { ...draft.finance[index], status: 'Cancelado', canceladoMotivo: 'Substituída por acordo', acordoGeradoEm: new Date().toISOString() }
      const base = {
        id: uid('fin'), clienteId: charge.clienteId, cliente: charge.cliente, descricao: `Acordo · ${charge.descricao || 'Cobrança'}`,
        competencia: agreement.primeiroVencimento.slice(0, 7), vencimento: agreement.primeiroVencimento, valor: summary.balance,
        categoriaId: charge.categoriaId || 'rec-honorarios', status: 'Pendente', pagamentos: [], origem: 'acordo', acordoOrigemId: String(charge.id),
      }
      const rows = buildInstallmentCharges(base, Math.max(1, Number(agreement.parcelas || 1)), prefix => uid(prefix))
      draft.finance.push(...rows)
      draft.financeCollectionEvents = [...(draft.financeCollectionEvents || []), { id: uid('cobevt'), chargeId: String(charge.id), tipo: 'acordo', data: agreement.data || day, observacao: agreement.observacao || `${rows.length} parcela(s)`, createdAt: new Date().toISOString(), novosLancamentos: rows.map(row => row.id) }]
    })
    setCollectingId(''); setNotice('Acordo criado sem apagar a cobrança original.')
  }
  function closeMonth() {
    const snapshot = { id: uid('fech'), ...monthlyClosingSnapshot(office, competence) }
    update(draft => { draft.financeClosings = [...(draft.financeClosings || []).filter(item => String(item.competencia) !== String(competence)), snapshot] })
    setNotice(`Fechamento gerencial de ${monthLabel(competence)} salvo.`)
  }
  function downloadCsv() {
    const rows = [['Data','Tipo','Descrição','Conta','Categoria','Valor','Origem']]
    const accountMap = new Map(accounts.map(item => [String(item.id), item.nome]))
    const categoryMap = new Map(categories.map(item => [String(item.id), item.nome]))
    ledger.filter(row => row.data?.slice(0, 7) === competence).forEach(row => rows.push([row.data,row.tipo,row.descricao,accountMap.get(String(row.contaId)) || 'Sem conta',categoryMap.get(String(row.categoriaId)) || '',Number(row.valor || 0).toFixed(2),row.sourceType || 'manual']))
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `fluxo-caixa-${competence}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="fc-shell">
    {notice ? <div className="fc-notice" role="status">{notice}</div> : null}
    <header className="fc-hero"><div><span>Financeiro do escritório</span><h1>Financeiro</h1><p>Entradas, saídas, caixa, parceiros e resultado gerencial em uma única operação.</p></div><div className="fc-hero-actions"><label>Competência<input type="month" value={competence} onChange={e => setCompetence(e.target.value)} /></label><button type="button" onClick={() => setCreatingMovement(true)}>+ Movimentação</button></div></header>
    <nav className="fc-tabs">{tabs.map(([id, label]) => <button type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>{label}</button>)}</nav>

    {tab === 'overview' ? <>
      <section className="fc-metrics"><Metric label="Saldo nas contas" value={money(overview.cashBalance)} detail={`${balances.filter(item => item.ativo !== false).length} conta(s) ativa(s)`} good={overview.cashBalance >= 0} /><Metric label="Entradas no mês" value={money(overview.entriesMonth)} detail="Regime de caixa" good /><Metric label="Saídas no mês" value={money(overview.exitsMonth)} detail="Regime de caixa" /><Metric label="Resultado de caixa" value={money(overview.cashResultMonth)} detail={monthLabel(competence)} good={overview.cashResultMonth >= 0} danger={overview.cashResultMonth < 0} /><Metric label="A receber" value={money(overview.receivableOpen)} detail={`${money(overview.receivableOverdue)} vencido`} danger={overview.receivableOverdue > 0} /><Metric label="A pagar" value={money(overview.payableOpen)} detail={`${money(overview.payableOverdue)} vencido`} danger={overview.payableOverdue > 0} /><Metric label={`Previsão ${office.financeConfig?.forecastDays || 30} dias`} value={money(forecast.projectedBalance)} detail={`+${money(forecast.incoming)} / -${money(forecast.outgoing)}`} good={forecast.projectedBalance >= 0} danger={forecast.projectedBalance < 0} /><Metric label="Resultado gerencial" value={money(dre.result)} detail="Receitas − despesas por competência" good={dre.result >= 0} danger={dre.result < 0} /></section>
      {unassigned.quantidade ? <div className="fc-warning"><strong>{unassigned.quantidade} movimentação(ões) sem conta vinculada.</strong><span>O fluxo geral considera os lançamentos, mas o saldo por conta só fica confiável após definir a conta nos novos pagamentos/recebimentos.</span></div> : null}
      <div className="fc-grid-two"><section className="fc-panel"><header><div><span>Disponibilidade</span><h2>Saldos por conta</h2></div><button type="button" onClick={() => setCreatingAccount(true)}>Nova conta</button></header><div className="fc-account-list">{balances.map(account => <article key={account.id}><div><strong>{account.nome}</strong><small>{account.tipo}{account.ativo === false ? ' · inativa' : ''}</small></div><b>{money(account.saldoAtual)}</b></article>)}</div></section>
      <section className="fc-panel"><header><div><span>Projeção</span><h2>Próximos {office.financeConfig?.forecastDays || 30} dias</h2></div><button type="button" onClick={() => setTab('fluxo')}>Detalhar</button></header><div className="fc-forecast"><div><span>Saldo atual</span><b>{money(forecast.startBalance)}</b></div><div><span>Entradas previstas</span><b>+ {money(forecast.incoming)}</b></div><div><span>Saídas previstas</span><b>- {money(forecast.outgoing)}</b></div><div className={forecast.projectedBalance < 0 ? 'danger' : 'good'}><span>Saldo projetado</span><b>{money(forecast.projectedBalance)}</b></div></div></section></div>
      <section className="fc-panel"><header><div><span>Inadimplência</span><h2>Clientes que precisam de cobrança</h2></div><button type="button" onClick={() => setTab('receber')}>Todas as cobranças</button></header><div className="fc-table-wrap"><table><thead><tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Saldo</th><th>Último contato</th><th></th></tr></thead><tbody>{overdueReceivables.slice(0, 12).map(({ charge, summary }) => { const history = collectionEventsForCharge(office.financeCollectionEvents || [], charge.id); return <tr key={charge.id}><td>{clientName(clientsById.get(String(charge.clienteId)))}</td><td>{charge.descricao}</td><td>{dateBr(charge.vencimento)}</td><td><b>{money(summary.balance)}</b></td><td>{history[0] ? `${dateBr(history[0].data)} · ${history[0].tipo}` : 'Sem contato'}</td><td><button type="button" onClick={() => setCollectingId(String(charge.id))}>Cobrar / acordo</button></td></tr> })}{!overdueReceivables.length ? <tr><td colSpan="6" className="fc-empty">Nenhuma cobrança vencida.</td></tr> : null}</tbody></table></div></section>
    </> : null}

    {tab === 'receber' ? <section className="fc-embedded-receivable"><FinanceProReact office={office} update={update} sync={sync} initialClientId={initialClientId} openClientRequest={openClientRequest} openNewRequest={openNewRequest} /></section> : null}

    {tab === 'pagar' ? <section className="fc-panel"><header><div><span>Contas a pagar</span><h2>Despesas e compromissos</h2><p>Baixa total ou parcial, descontos, acréscimos e parcelamentos.</p></div><button type="button" className="primary" onClick={() => setCreatingPayable(true)}>+ Nova conta</button></header><div className="fc-table-wrap"><table><thead><tr><th>Descrição</th><th>Fornecedor</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Saldo</th><th>Status</th><th></th></tr></thead><tbody>{payables.filter(item => !competence || item.competencia === competence).map(item => <tr key={item.id}><td><strong>{item.descricao}</strong>{item.parcelaTotal > 1 ? <small>Parcela {item.parcelaNumero}/{item.parcelaTotal}</small> : null}</td><td>{item.fornecedor || '—'}</td><td>{item.competencia || '—'}</td><td>{dateBr(item.vencimento)}</td><td>{money(item._summary.total)}</td><td>{money(item._summary.paidCash)}</td><td><b>{money(item._summary.balance)}</b></td><td><span className={`fc-status ${item._status.toLowerCase()}`}>{item._status}</span></td><td><button type="button" onClick={() => setPayingId(String(item.id))}>{item._summary.balance > 0.009 ? 'Pagar' : 'Histórico'}</button></td></tr>)}{!payables.filter(item => !competence || item.competencia === competence).length ? <tr><td colSpan="9" className="fc-empty">Nenhuma conta nesta competência.</td></tr> : null}</tbody></table></div></section> : null}

    {tab === 'movimentos' ? <section className="fc-panel"><header><div><span>Extrato consolidado</span><h2>Movimentações</h2><p>Recebimentos, pagamentos e lançamentos manuais sem duplicidade.</p></div><button type="button" className="primary" onClick={() => setCreatingMovement(true)}>+ Movimentação</button></header><div className="fc-table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Conta</th><th>Categoria</th><th>Origem</th><th>Valor</th></tr></thead><tbody>{ledger.filter(row => !competence || row.data?.slice(0, 7) === competence).map(row => <tr key={row.id}><td>{dateBr(row.data)}</td><td><span className={`fc-kind ${row.tipo}`}>{row.tipo}</span></td><td>{row.descricao}</td><td>{accounts.find(account => String(account.id) === String(row.contaId))?.nome || 'Sem conta'}</td><td>{categories.find(category => String(category.id) === String(row.categoriaId))?.nome || (row.transfer ? 'Transferência' : '—')}</td><td>{row.sourceType === 'receivable' ? 'Conta a receber' : row.sourceType === 'payable' ? 'Conta a pagar' : 'Manual'}</td><td className={row.tipo === 'entrada' ? 'positive' : 'negative'}>{row.tipo === 'entrada' ? '+' : '-'} {money(row.valor)}</td></tr>)}</tbody></table></div></section> : null}

    {tab === 'fluxo' ? <><section className="fc-metrics compact"><Metric label="Entradas realizadas" value={money(totalFlowEntries)} detail={monthLabel(competence)} good /><Metric label="Saídas realizadas" value={money(totalFlowExits)} detail={monthLabel(competence)} /><Metric label="Fluxo líquido" value={money(totalFlowEntries - totalFlowExits)} detail="Entradas − saídas" good={totalFlowEntries >= totalFlowExits} danger={totalFlowEntries < totalFlowExits} /><Metric label="Saldo projetado" value={money(forecast.projectedBalance)} detail={`até ${dateBr(forecast.end)}`} good={forecast.projectedBalance >= 0} danger={forecast.projectedBalance < 0} /></section><section className="fc-panel"><header><div><span>Regime de caixa</span><h2>Fluxo diário</h2></div></header><div className="fc-flow-list">{flow.map(row => <article key={row.date}><span>{dateBr(row.date)}</span><div><small>Entradas</small><b className="positive">+ {money(row.entries)}</b></div><div><small>Saídas</small><b className="negative">- {money(row.exits)}</b></div><strong className={row.net >= 0 ? 'positive' : 'negative'}>{money(row.net)}</strong></article>)}{!flow.length ? <p className="fc-empty">Nenhuma movimentação realizada nesta competência.</p> : null}</div></section></> : null}

    {tab === 'parceiros' ? <section className="fc-panel"><header><div><span>Financeiro compartilhado</span><h2>Acertos com parceiros</h2><p>Valores calculados a partir das cobranças compartilhadas já existentes.</p></div><button type="button" onClick={() => setTab('receber')}>Abrir cobranças</button></header><div className="fc-partner-grid">{partnerBalances.map(partner => <article key={partner.id}><header><div><strong>{partnerName(partner)}</strong><small>{partner.status || 'Ativo'}</small></div><span className={partner.saldo >= 0 ? 'positive' : 'negative'}>{money(Math.abs(partner.saldo))}</span></header><div><span>A pagar ao parceiro <b>{money(partner.aPagar)}</b></span><span>A receber do parceiro <b>{money(partner.aReceber)}</b></span></div><footer>{partner.saldo < 0 ? 'Escritório deve ao parceiro' : partner.saldo > 0 ? 'Parceiro deve ao escritório' : 'Sem acerto pendente'}</footer></article>)}{!partnerBalances.length ? <p className="fc-empty">Nenhum parceiro cadastrado.</p> : null}</div></section> : null}

    {tab === 'relatorios' ? <><section className="fc-grid-two"><section className="fc-panel"><header><div><span>DRE gerencial</span><h2>{monthLabel(competence)}</h2><p>Visão por competência. Não substitui a escrituração contábil oficial.</p></div></header><div className="fc-dre"><div className="main"><span>Receitas</span><b>{money(dre.revenue)}</b></div>{dre.revenueGroups.map(row => <div key={row.group}><span>{row.group}</span><b>{money(row.value)}</b></div>)}<div className="main expense"><span>Despesas</span><b>- {money(dre.expense)}</b></div>{dre.expenseGroups.map(row => <div key={row.group}><span>{row.group}</span><b>- {money(row.value)}</b></div>)}<div className={`result ${dre.result >= 0 ? 'positive' : 'negative'}`}><span>Resultado gerencial</span><b>{money(dre.result)}</b></div></div></section><section className="fc-panel"><header><div><span>Fechamento mensal</span><h2>Consolidar competência</h2></div></header><div className="fc-closing"><p>Salva uma fotografia gerencial do mês: saldos, recebimentos, pagamentos e DRE.</p><button type="button" className="primary" onClick={closeMonth}>Fechar {monthLabel(competence)}</button><button type="button" onClick={downloadCsv}>Exportar fluxo CSV</button></div></section></section><section className="fc-panel"><header><div><span>Histórico</span><h2>Fechamentos salvos</h2></div></header><div className="fc-closing-history">{(office.financeClosings || []).slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia))).map(item => <article key={item.id || item.competencia}><div><strong>{monthLabel(item.competencia)}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : ''}</small></div><span>Receita {money(item.dre?.revenue)}</span><span>Despesa {money(item.dre?.expense)}</span><b className={(item.dre?.result || 0) >= 0 ? 'positive' : 'negative'}>{money(item.dre?.result)}</b></article>)}{!(office.financeClosings || []).length ? <p className="fc-empty">Nenhum fechamento salvo.</p> : null}</div></section></> : null}

    {tab === 'config' ? <div className="fc-grid-two"><section className="fc-panel"><header><div><span>Caixa</span><h2>Contas financeiras</h2></div><button type="button" onClick={() => setCreatingAccount(true)}>+ Conta</button></header><div className="fc-account-list">{balances.map(account => <article key={account.id}><div><strong>{account.nome}</strong><small>{account.tipo} · saldo inicial {money(account.saldoInicial)}</small></div><b>{money(account.saldoAtual)}</b></article>)}</div><label className="fc-setting">Conta padrão<select value={office.financeConfig?.defaultAccountId || ''} onChange={e => update(draft => { draft.financeConfig = { ...(draft.financeConfig || {}), defaultAccountId: e.target.value } })}><option value="">Nenhuma</option>{accounts.filter(item => item.ativo !== false).map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><label className="fc-setting">Horizonte da previsão<select value={Number(office.financeConfig?.forecastDays || 30)} onChange={e => update(draft => { draft.financeConfig = { ...(draft.financeConfig || {}), forecastDays: Number(e.target.value) } })}><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option></select></label></section>
    <section className="fc-panel"><header><div><span>Classificação</span><h2>Categorias</h2></div><button type="button" onClick={() => setCreatingCategory(true)}>+ Categoria</button></header><div className="fc-category-list">{categories.map(item => <article key={item.id}><span className={item.tipo}>{item.tipo}</span><div><strong>{item.nome}</strong><small>{item.grupo}</small></div><button type="button" onClick={() => update(draft => { const row = draft.financeCategories.find(category => String(category.id) === String(item.id)); if (row) row.ativo = row.ativo === false })}>{item.ativo === false ? 'Ativar' : 'Desativar'}</button></article>)}</div></section>
    <section className="fc-panel fc-full"><header><div><span>Automação</span><h2>Recorrências financeiras</h2><p>Despesas e receitas repetitivas são geradas uma vez por competência.</p></div><button type="button" onClick={() => setCreatingRecurrence(true)}>+ Recorrência</button></header><div className="fc-table-wrap"><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Dia</th><th>Início</th><th>Fim</th><th>Status</th><th></th></tr></thead><tbody>{(office.financeRecurrences || []).map(item => <tr key={item.id}><td>{item.tipo}</td><td>{item.descricao}</td><td>{money(item.valor)}</td><td>{item.diaVencimento}</td><td>{item.inicioCompetencia}</td><td>{item.fimCompetencia || '—'}</td><td>{item.ativo === false ? 'Pausada' : 'Ativa'}</td><td><button type="button" onClick={() => update(draft => { const row = draft.financeRecurrences.find(rec => String(rec.id) === String(item.id)); if (row) row.ativo = row.ativo === false })}>{item.ativo === false ? 'Ativar' : 'Pausar'}</button></td></tr>)}</tbody></table></div></section></div> : null}

    {creatingPayable ? <PayableForm categories={categories} onClose={() => setCreatingPayable(false)} onSave={savePayables} /> : null}
    {paying ? <PayablePaymentModal payable={paying} accounts={accounts} defaultAccountId={office.financeConfig?.defaultAccountId} onClose={() => setPayingId('')} onSave={savePayablePayment} onRemove={removePayablePayment} /> : null}
    {creatingMovement ? <MovementForm accounts={accounts} categories={categories} onClose={() => setCreatingMovement(false)} onSave={saveMovement} /> : null}
    {creatingAccount ? <AccountForm onClose={() => setCreatingAccount(false)} onSave={saveAccount} /> : null}
    {creatingCategory ? <CategoryForm onClose={() => setCreatingCategory(false)} onSave={saveCategory} /> : null}
    {creatingRecurrence ? <RecurrenceForm clients={office.clients || []} categories={categories} onClose={() => setCreatingRecurrence(false)} onSave={saveRecurrence} /> : null}
    {collecting ? <CollectionModal charge={collecting} clientsById={clientsById} events={office.financeCollectionEvents || []} onClose={() => setCollectingId('')} onEvent={addCollectionEvent} onAgreement={createAgreement} /> : null}
  </div>
}
