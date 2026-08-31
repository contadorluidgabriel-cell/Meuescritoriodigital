import { useEffect, useMemo, useState } from 'react'
import { today, uid } from '../lib/storage.js'
import { buildMissingRecurringCharges } from '../lib/financeRecurring.js'
import {
  allPartnerBalances,
  clientPartnerIds,
  normalizeSharedCharge,
  partnerShares,
  sharedChargeError,
  sharedReceiver,
  sharedSplit,
  SETTLEMENT_DONE,
  SETTLEMENT_PENDING,
} from '../lib/sharedWork.js'
import {
  FINANCE_STATUSES,
  addPaymentToCharge,
  buildInstallmentCharges,
  chargePayments,
  delinquencyByClient,
  effectiveChargeStatus,
  financeMetrics,
  forecast30Days,
  paymentSummary,
  previousCompetence,
  removePaymentFromCharge,
} from '../lib/financePro.js'
import { downloadFinanceDocument } from '../lib/financePdf.js'
import SharedFinanceEditor from './SharedFinanceEditor.jsx'
import PaymentEditor from './PaymentEditor.jsx'
import '../finance-react.css'
import '../finance-pro.css'

const currentCompetence = () => today().slice(0, 7)
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'
const normalizeText = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'
const pct = value => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function normalizedCharge(charge, client, day) {
  let normalized = {
    ...charge,
    id: charge.id || uid('fin'),
    clienteId: String(charge.clienteId || ''),
    cliente: charge.cliente || '',
    descricao: charge.descricao || charge.referencia || 'Honorários contábeis',
    competencia: charge.competencia || '',
    vencimento: charge.vencimento || charge.data || '',
    valor: Number(charge.valor) || 0,
    origem: charge.origem || 'manual',
    origemTipo: charge.origemTipo || '',
    origemId: charge.origemId || '',
    pagamentos: Array.isArray(charge.pagamentos) ? charge.pagamentos : [],
  }
  if (charge.compartilhado || (charge.origem === 'recorrente' && client?.perfilAtendimento === 'Compartilhado')) normalized = normalizeSharedCharge(normalized, client)
  const summary = paymentSummary({ ...normalized, status: charge.status, recebidoEm: charge.recebidoEm })
  normalized.status = effectiveChargeStatus({ ...normalized, status: charge.status, recebidoEm: charge.recebidoEm }, day)
  normalized.valorRecebido = summary.receivedCash
  normalized.saldo = summary.balance
  normalized.recebidoEm = normalized.status === 'Recebido' ? (charge.recebidoEm || summary.lastPaymentDate) : ''
  return normalized
}

function Modal({ onClose, title = 'Nova cobrança', subtitle = 'Honorário recorrente extra ou serviço específico.', children }) {
  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="finance-modal-card"><header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div>
}

function Field({ label, full = false, children }) { return <label className={`finance-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }

function ChargeForm({ office, clients, partners, competence, initialClientId = '', onClose, onSave }) {
  const defaultClient = clients.find(item => String(item.id) === String(initialClientId)) || null
  const defaultPartnerIds = defaultClient?.perfilAtendimento === 'Compartilhado' ? clientPartnerIds(defaultClient) : []
  const [draft, setDraft] = useState({
    clienteId: defaultClient ? String(defaultClient.id) : '',
    descricao: '', valor: '', vencimento: today(), competencia: competence || currentCompetence(), sourceRef: '', parcelas: 1,
    compartilhado: Boolean(defaultClient?.perfilAtendimento === 'Compartilhado'), parceiroIds: defaultPartnerIds,
    compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: '', compartilhadoPartesParceiros: defaultPartnerIds.map(parceiroId => ({ parceiroId, valor: 0 })),
  })
  const [error, setError] = useState('')
  const selectedClient = clients.find(item => String(item.id) === String(draft.clienteId)) || null
  const clientPartnerSet = new Set(clientPartnerIds(selectedClient))
  const selectedPartnerIds = (draft.parceiroIds || []).map(String).filter(id => clientPartnerSet.has(id))
  const selectedPartners = selectedPartnerIds.map(id => partners.find(partner => String(partner.id) === id)).filter(Boolean)
  const shares = partnerShares({ ...draft, parceiroIds: selectedPartnerIds }, selectedClient).filter(item => selectedPartnerIds.includes(item.parceiroId))
  const shareMap = new Map(shares.map(item => [item.parceiroId, Number(item.valor) || 0]))
  const sharedEnabled = selectedClient?.perfilAtendimento === 'Compartilhado' && Boolean(draft.compartilhado)
  const sourceChoices = useMemo(() => {
    const clientId = String(draft.clienteId || '')
    if (!clientId) return []
    const tasks = (office.tasks || []).filter(item => String(item.clientId) === clientId).map(item => ({ value: `task:${item.id}`, label: `Tarefa · ${item.titulo || 'Sem título'}` }))
    const processes = (office.processes || []).filter(item => String(item.clientId) === clientId || (item.relacionados || []).some(id => String(id) === clientId)).map(item => ({ value: `process:${item.id}`, label: `Processo · ${item.tipo || 'Sem tipo'}` }))
    const obligations = (office.obligations || []).filter(item => (item.clientes || []).some(link => String(link.clienteId) === clientId)).map(item => ({ value: `obligation:${item.id}`, label: `Obrigação · ${item.nome || 'Sem nome'}` }))
    return [...tasks, ...processes, ...obligations]
  }, [draft.clienteId, office.obligations, office.processes, office.tasks])

  function setField(name, value) { setDraft(current => ({ ...current, [name]: value })) }
  function changeClient(id) {
    const client = clients.find(item => String(item.id) === String(id)) || null
    const ids = client?.perfilAtendimento === 'Compartilhado' ? clientPartnerIds(client) : []
    setDraft(current => ({ ...current, clienteId: String(id || ''), sourceRef: '', compartilhado: Boolean(client?.perfilAtendimento === 'Compartilhado'), parceiroIds: ids, compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: '', compartilhadoPartesParceiros: ids.map(parceiroId => ({ parceiroId, valor: 0 })) }))
    setError('')
  }
  function togglePartner(id) {
    const key = String(id)
    const nextIds = selectedPartnerIds.includes(key) ? selectedPartnerIds.filter(item => item !== key) : [...selectedPartnerIds, key]
    const nextShares = nextIds.map(parceiroId => ({ parceiroId, valor: shareMap.get(parceiroId) || 0 }))
    let receiver = draft.compartilhadoRecebedor || 'Escritorio'
    if (receiver.startsWith('partner:') && !nextIds.includes(receiver.slice(8))) receiver = 'Escritorio'
    setDraft(current => ({ ...current, parceiroIds: nextIds, compartilhadoPartesParceiros: nextShares, compartilhadoRecebedor: receiver }))
  }
  function setShare(id, value) {
    const key = String(id)
    const next = selectedPartnerIds.map(parceiroId => ({ parceiroId, valor: parceiroId === key ? Math.max(0, Number(value) || 0) : (shareMap.get(parceiroId) || 0) }))
    setField('compartilhadoPartesParceiros', next)
  }
  function submit(event) {
    event.preventDefault()
    const value = Number(draft.valor)
    const installments = Math.max(1, Math.min(60, Number(draft.parcelas) || 1))
    if (!draft.clienteId || !draft.descricao.trim() || value <= 0 || !draft.vencimento) { setError('Preencha cliente, descrição, valor e vencimento.'); return }
    const client = selectedClient
    const [sourceType = '', sourceId = ''] = String(draft.sourceRef || '').split(':')
    let base = {
      id: uid('fin'), clienteId: draft.clienteId, cliente: clientName(client), descricao: draft.descricao.trim(),
      competencia: draft.competencia || draft.vencimento.slice(0, 7), vencimento: draft.vencimento, valor: value,
      status: 'Pendente', recebidoEm: '', pagamentos: [], origem: 'manual', origemTipo: sourceType, origemId: sourceId,
    }
    if (sharedEnabled) {
      base = normalizeSharedCharge({
        ...base, compartilhado: true, parceiroIds: selectedPartnerIds, parceiroId: selectedPartnerIds[0] || '',
        compartilhadoRecebedor: draft.compartilhadoRecebedor || 'Escritorio', compartilhadoMinhaParte: Number(draft.compartilhadoMinhaParte) || 0,
        compartilhadoPartesParceiros: selectedPartnerIds.map(parceiroId => ({ parceiroId, valor: shareMap.get(parceiroId) || 0 })),
        compartilhadoAcertoStatus: SETTLEMENT_PENDING, compartilhadoAcertoEm: '', compartilhadoObservacao: '', compartilhadoPersonalizado: true,
      }, client)
      const validationError = sharedChargeError(base, client)
      if (validationError) { setError(validationError); return }
    }
    const charges = buildInstallmentCharges(base, installments, prefix => uid(prefix))
    onSave(charges)
  }

  const splitPreview = sharedEnabled ? sharedSplit({ ...draft, valor: Number(draft.valor) || 0, compartilhadoPartesParceiros: selectedPartnerIds.map(parceiroId => ({ parceiroId, valor: shareMap.get(parceiroId) || 0 })) }, selectedClient) : null

  return <Modal onClose={onClose}><form className="finance-form" onSubmit={submit}>
    <Field label="Cliente *" full><select value={draft.clienteId} onChange={event => changeClient(event.target.value)}><option value="">Selecione</option>{clients.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.relacionamento === 'Avulso' ? ' · avulso' : ''}{client.perfilAtendimento === 'Compartilhado' ? ' · compartilhado' : ''}</option>)}</select></Field>
    <Field label="Descrição *" full><input value={draft.descricao} onChange={event => setField('descricao', event.target.value)} placeholder="Ex.: Alteração contratual" /></Field>
    {sourceChoices.length ? <Field label="Vincular ao trabalho" full><select value={draft.sourceRef} onChange={event => setField('sourceRef', event.target.value)}><option value="">Sem vínculo específico</option>{sourceChoices.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field> : null}
    <Field label="Valor total *"><input type="number" min="0" step="0.01" value={draft.valor} onChange={event => setField('valor', event.target.value)} /></Field>
    <Field label="Parcelas"><input type="number" min="1" max="60" step="1" value={draft.parcelas} onChange={event => setField('parcelas', event.target.value)} /></Field>
    <Field label="Primeiro vencimento *"><input type="date" value={draft.vencimento} onInput={event => setField('vencimento', event.currentTarget.value)} onChange={event => setField('vencimento', event.target.value)} /></Field>
    <Field label="Primeira competência"><input type="month" value={draft.competencia} onInput={event => setField('competencia', event.currentTarget.value)} onChange={event => setField('competencia', event.target.value)} /></Field>
    {Number(draft.parcelas) > 1 ? <div className="finance-field full installment-note"><span>Parcelamento</span><small>O sistema dividirá {money(Number(draft.valor) || 0)} em {draft.parcelas} parcelas mensais, ajustando centavos automaticamente.</small></div> : null}

    {selectedClient?.perfilAtendimento === 'Compartilhado' ? <div className="finance-field full shared-service-box"><span>Compartilhamento deste serviço</span><label className="third-party-toggle"><input type="checkbox" checked={Boolean(draft.compartilhado)} onChange={event => setField('compartilhado', event.target.checked)} /> Este serviço possui divisão financeira com parceiro</label>{sharedEnabled ? <>
      <div className="choice-list">{clientPartnerIds(selectedClient).map(id => { const partner = partners.find(item => String(item.id) === id); return partner ? <label key={id}><input type="checkbox" checked={selectedPartnerIds.includes(id)} onChange={() => togglePartner(id)} /> {partnerName(partner)}{partner.status === 'Inativo' ? ' (inativo)' : ''}</label> : null })}</div>
      <div className="shared-finance-default-grid">
        <label><span>Quem recebeu</span><select value={sharedReceiver(draft, selectedClient)} onChange={event => setField('compartilhadoRecebedor', event.target.value)}><option value="Escritorio">Meu escritório</option>{selectedPartners.map(partner => <option key={partner.id} value={`partner:${partner.id}`}>{partnerName(partner)}</option>)}<option value="CadaUm">Cada um recebe sua parte</option></select></label>
        <label><span>Minha parte</span><input type="number" min="0" step="0.01" value={draft.compartilhadoMinhaParte} onChange={event => setField('compartilhadoMinhaParte', event.target.value)} /></label>
        {selectedPartners.map(partner => <label key={partner.id}><span>Parte de {partnerName(partner)}</span><input type="number" min="0" step="0.01" value={shareMap.get(String(partner.id)) || 0} onChange={event => setShare(partner.id, event.target.value)} /></label>)}
      </div>
      {splitPreview ? <div className={`shared-finance-check ${Math.abs(splitPreview.difference) > 0.009 ? 'invalid' : ''}`}><span>Total {money(splitPreview.total)}</span><span>Divisão {money(splitPreview.splitTotal)}</span><span>Diferença {money(splitPreview.difference)}</span></div> : null}
    </> : null}</div> : null}

    {error ? <p className="finance-error">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary">{Number(draft.parcelas) > 1 ? 'Criar parcelas' : 'Salvar cobrança'}</button></footer>
  </form></Modal>
}

function downloadCsv(rows, clientsById) {
  const header = ['Cliente','Descrição','Competência','Vencimento','Valor','Recebido','Saldo','Status','Parcela']
  const escape = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const data = rows.map(charge => {
    const summary = paymentSummary(charge)
    const client = clientsById.get(String(charge.clienteId))
    return [clientName(client), charge.descricao, charge.competencia, charge.vencimento, summary.total.toFixed(2), summary.receivedCash.toFixed(2), summary.balance.toFixed(2), charge.status, charge.parcelaTotal > 1 ? `${charge.parcelaNumero}/${charge.parcelaTotal}` : ''].map(escape).join(';')
  })
  const blob = new Blob([`\ufeff${header.map(escape).join(';')}\n${data.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `financeiro-${today()}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function FinanceProReact({ office, update, sync, initialClientId = '', openClientRequest = 0, openNewRequest = 0 }) {
  const day = today()
  const [competence, setCompetence] = useState(currentCompetence), [status, setStatus] = useState(''), [query, setQuery] = useState(''), [clientFilter, setClientFilter] = useState(''), [partnerFilter, setPartnerFilter] = useState('')
  const [creating, setCreating] = useState(false), [notice, setNotice] = useState(''), [editingShared, setEditingShared] = useState(''), [paymentChargeId, setPaymentChargeId] = useState('')
  const clients = office.clients || [], finance = office.finance || [], partners = office.partners || []
  const clientsById = useMemo(() => new Map(clients.map(client => [String(client.id), client])), [clients])
  const partnersById = useMemo(() => new Map(partners.map(partner => [String(partner.id), partner])), [partners])
  const activeClients = useMemo(() => clients.filter(client => client.status !== 'Inativo'), [clients])
  const partnerBalances = useMemo(() => allPartnerBalances(finance, clients, partners), [clients, finance, partners])
  const partnerTotals = useMemo(() => partnerBalances.reduce((result, item) => ({ aPagar: result.aPagar + item.aPagar, aReceber: result.aReceber + item.aReceber }), { aPagar: 0, aReceber: 0 }), [partnerBalances])
  const metrics = useMemo(() => financeMetrics(finance, { competence, clientId: clientFilter, day }), [clientFilter, competence, day, finance])
  const prevCompetence = previousCompetence(competence)
  const previous = useMemo(() => financeMetrics(finance, { competence: prevCompetence, clientId: clientFilter, day }), [clientFilter, day, finance, prevCompetence])
  const forecast = useMemo(() => forecast30Days(finance, day), [day, finance])
  const delinquency = useMemo(() => delinquencyByClient(finance, clients, day), [clients, day, finance])
  const billingVariation = previous.billed > 0 ? ((metrics.billed - previous.billed) / previous.billed) * 100 : null

  const rows = useMemo(() => finance.map(charge => normalizedCharge(charge, clientsById.get(String(charge.clienteId)), day)).filter(charge => {
    const client = clientsById.get(String(charge.clienteId))
    const normalized = charge.compartilhado ? normalizeSharedCharge(charge, client) : charge
    const partnerAllowed = !partnerFilter || (normalized.compartilhado && clientPartnerIds(normalized).includes(String(partnerFilter)))
    return (!competence || charge.competencia === competence)
      && (!clientFilter || String(charge.clienteId) === String(clientFilter))
      && (!status || charge.status === status)
      && partnerAllowed
      && (!query || normalizeText(`${clientName(client)} ${charge.cliente} ${charge.descricao} ${charge.compartilhadoObservacao || ''}`).includes(normalizeText(query)))
  }).sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || ''))), [clientFilter, clientsById, competence, day, finance, partnerFilter, query, status])

  const rawSharedCharge = useMemo(() => finance.find(charge => String(charge.id) === String(editingShared)) || null, [editingShared, finance])
  const sharedClient = rawSharedCharge ? clientsById.get(String(rawSharedCharge.clienteId)) || {} : null
  const sharedEditorCharge = rawSharedCharge ? normalizeSharedCharge(rawSharedCharge, sharedClient) : null
  const paymentCharge = useMemo(() => finance.find(charge => String(charge.id) === String(paymentChargeId)) || null, [finance, paymentChargeId])

  useEffect(() => {
    const seen = new Set(), normalized = []
    let changed = false
    finance.forEach(raw => {
      const client = clientsById.get(String(raw.clienteId))
      const charge = normalizedCharge(raw, client, day)
      if (seen.has(charge.id)) { changed = true; return }
      seen.add(charge.id)
      if (JSON.stringify(charge) !== JSON.stringify(raw)) changed = true
      normalized.push(charge)
    })
    if (changed) update(draft => { draft.finance = normalized })
  }, [clientsById, day, finance, update])

  useEffect(() => {
    const month = currentCompetence()
    const preview = buildMissingRecurringCharges({ clients: activeClients, finance, competence: month, makeId: () => uid('fin') })
    if (!preview.length) return
    let created = 0
    update(draft => {
      const additions = buildMissingRecurringCharges({ clients: draft.clients || [], finance: draft.finance || [], competence: month, makeId: () => uid('fin') })
      if (!additions.length) return
      created = additions.length
      draft.finance = [...(draft.finance || []), ...additions]
    })
    if (created) setNotice(`${created} cobrança${created === 1 ? '' : 's'} mensal${created === 1 ? '' : 'is'} gerada${created === 1 ? '' : 's'} automaticamente.`)
  }, [activeClients, finance, update])

  useEffect(() => { if (!initialClientId || !openClientRequest) return; setClientFilter(String(initialClientId)); setCompetence(''); setStatus(''); setQuery(''); setPartnerFilter('') }, [initialClientId, openClientRequest])
  useEffect(() => { if (!initialClientId || !openNewRequest) return; setClientFilter(String(initialClientId)); setCreating(true) }, [initialClientId, openNewRequest])
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 3200); return () => clearTimeout(timer) }, [notice])

  function saveCharges(charges) {
    const list = Array.isArray(charges) ? charges : [charges]
    update(draft => { draft.finance = [...(draft.finance || []), ...list] })
    setCreating(false)
    setNotice(list.length > 1 ? `${list.length} parcelas criadas.` : 'Cobrança salva.')
  }
  function changeStatus(charge, nextStatus) {
    const summary = paymentSummary(charge)
    if (nextStatus === 'Recebido' || nextStatus === 'Parcial') { setPaymentChargeId(String(charge.id)); return }
    if (nextStatus === 'Cancelado' && summary.receivedCash > 0.009) { setNotice('Estorne os recebimentos antes de cancelar esta cobrança.'); return }
    if (nextStatus === 'Atrasado') { setNotice('O atraso é calculado automaticamente pelo vencimento.'); return }
    update(draft => {
      const target = (draft.finance || []).find(item => String(item.id) === String(charge.id)); if (!target) return
      target.status = nextStatus
      if (nextStatus === 'Pendente') target.recebidoEm = ''
    })
  }
  function registerPayment(payment) {
    if (!paymentChargeId) return
    update(draft => {
      const index = (draft.finance || []).findIndex(item => String(item.id) === String(paymentChargeId)); if (index < 0) return
      draft.finance[index] = addPaymentToCharge(draft.finance[index], payment, () => uid('pay'))
    })
    setPaymentChargeId(''); setNotice('Recebimento registrado. O saldo foi atualizado automaticamente.')
  }
  function removePayment(paymentId) {
    if (!paymentChargeId || !window.confirm('Estornar esta baixa? O saldo da cobrança será recalculado.')) return
    update(draft => {
      const index = (draft.finance || []).findIndex(item => String(item.id) === String(paymentChargeId)); if (index < 0) return
      const next = removePaymentFromCharge(draft.finance[index], paymentId, day)
      if (next.status !== 'Recebido' && next.compartilhado) { next.compartilhadoAcertoStatus = SETTLEMENT_PENDING; next.compartilhadoAcertoEm = '' }
      draft.finance[index] = next
    })
    setNotice('Baixa estornada e saldo recalculado.')
  }
  function deleteCharge(id) { if (!window.confirm('Excluir esta cobrança?')) return; update(draft => { draft.finance = (draft.finance || []).filter(item => String(item.id) !== String(id)) }); setNotice('Cobrança excluída.') }
  function saveSharedAdjustment(values) {
    if (!editingShared) return
    update(draft => { const charge = (draft.finance || []).find(item => String(item.id) === String(editingShared)); if (charge) Object.assign(charge, values, { compartilhado: true }) })
    setEditingShared(''); setNotice('Divisão e acerto atualizados.')
  }
  function generateRecurring() {
    if (!/^\d{4}-\d{2}$/.test(competence)) { setNotice('Selecione uma competência válida.'); return }
    const additions = buildMissingRecurringCharges({ clients: activeClients, finance, competence, clientId: clientFilter, makeId: () => uid('fin') })
    if (!additions.length) { setNotice('Nenhuma cobrança recorrente pendente para gerar.'); return }
    update(draft => { const fresh = buildMissingRecurringCharges({ clients: draft.clients || [], finance: draft.finance || [], competence, clientId: clientFilter, makeId: () => uid('fin') }); if (fresh.length) draft.finance = [...(draft.finance || []), ...fresh] })
    setNotice(`${additions.length} cobrança${additions.length === 1 ? '' : 's'} recorrente${additions.length === 1 ? '' : 's'} gerada${additions.length === 1 ? '' : 's'}.`)
  }
  function generateDocument(charge, type) {
    const client = clientsById.get(String(charge.clienteId)) || {}
    const summary = paymentSummary(charge)
    if (type === 'receipt' && summary.receivedCash <= 0.009) { setNotice('Registre um recebimento antes de gerar o recibo.'); return }
    const issueField = type === 'receipt' ? 'reciboEmitidoEm' : 'faturaEmitidaEm'
    const issueDate = charge[issueField] || day
    const documentCharge = { ...charge, [issueField]: issueDate, ...(type === 'invoice' ? { faturaEmitidaEm: issueDate } : {}) }
    update(draft => { const target = (draft.finance || []).find(item => String(item.id) === String(charge.id)); if (target && !target[issueField]) target[issueField] = issueDate })
    const number = downloadFinanceDocument({ type, charge: documentCharge, client, office })
    setNotice(`${type === 'receipt' ? 'Recibo' : 'Fatura'} ${number} gerado em PDF.`)
  }

  const paidRate = metrics.billed > 0 ? metrics.received / metrics.billed * 100 : 0
  const recurringRate = metrics.billed > 0 ? metrics.recurring / metrics.billed * 100 : 0

  return <div className="react-module-page finance-page finance-pro-page">
    <div className="react-module-topbar"><div><h1>Financeiro</h1><p>Contas a receber, parcelamentos, baixas, inadimplência, documentos e acertos em um único fluxo.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}</span><button type="button" onClick={() => downloadCsv(rows, clientsById)}>Exportar CSV</button><button type="button" className="primary" onClick={() => setCreating(true)}>+ Nova cobrança</button></div></div>

    <div className="finance-pro-kpis">
      <article><small>Faturado</small><strong>{money(metrics.billed)}</strong><span>{billingVariation == null ? 'Sem base no mês anterior' : `${billingVariation >= 0 ? '+' : ''}${pct(billingVariation)} vs. ${prevCompetence}`}</span></article>
      <article><small>Recebido</small><strong>{money(metrics.received)}</strong><span>{pct(paidRate)} do faturado</span></article>
      <article><small>A receber</small><strong>{money(metrics.open)}</strong><span>Saldo ainda em aberto</span></article>
      <article className="overdue"><small>Vencido</small><strong>{money(metrics.overdue)}</strong><span>{delinquency.length} cliente(s) inadimplente(s)</span></article>
      <article><small>Próximos 30 dias</small><strong>{money(forecast)}</strong><span>Previsão global de recebimento</span></article>
    </div>

    <section className="finance-insights-grid">
      <article className="finance-insight-card"><div><small>Composição do faturamento</small><strong>{pct(recurringRate)} recorrente</strong></div><div className="finance-mix-bar"><i style={{ width: `${Math.min(100, recurringRate)}%` }} /></div><p>{money(metrics.recurring)} recorrente · {money(metrics.single)} avulso/extra</p></article>
      <article className="finance-insight-card"><div><small>Eficiência de recebimento</small><strong>{pct(paidRate)}</strong></div><div className="finance-mix-bar"><i style={{ width: `${Math.min(100, paidRate)}%` }} /></div><p>{money(metrics.received)} efetivamente recebido no período selecionado.</p></article>
      <article className="finance-insight-card partner-mini"><div><small>Acertos com parceiros</small><strong>{money(partnerTotals.aPagar - partnerTotals.aReceber)}</strong></div><p>{money(partnerTotals.aPagar)} a repassar · {money(partnerTotals.aReceber)} a receber.</p></article>
    </section>

    {delinquency.length ? <section className="finance-card delinquency-section"><div className="section-title-row"><div><h2>Inadimplência</h2><p>Clientes com saldo vencido, ordenados pelo maior valor em aberto.</p></div><strong>{money(delinquency.reduce((sum, item) => sum + item.total, 0))}</strong></div><div className="delinquency-grid">{delinquency.slice(0, 8).map(item => <button type="button" key={item.clienteId} onClick={() => { setClientFilter(item.clienteId); setCompetence(''); setStatus('') }}><b>{clientName(item.cliente)}</b><span>{item.cobrancas} cobrança(s) · desde {formatDate(item.maisAntiga)}</span><strong>{money(item.total)}</strong></button>)}</div></section> : null}

    {partnerBalances.some(item => item.aPagar || item.aReceber) ? <section className="finance-card partner-balance-section"><div className="partner-balance-head"><div><h2>Acertos com parceiros</h2><p>Valores entram aqui após o cliente quitar a cobrança e saem quando o acerto é liquidado.</p></div></div><div className="partner-balance-grid">{partnerBalances.filter(item => item.aPagar || item.aReceber).map(item => <article key={item.id}><b>{partnerName(item)}</b><span>A pagar: {money(item.aPagar)}</span><span>A receber: {money(item.aReceber)}</span><strong>Saldo: {money(item.saldo)}</strong></article>)}</div></section> : null}

    <section className="finance-card"><div className="finance-toolbar finance-pro-toolbar">
      <select value={clientFilter} onChange={event => setClientFilter(event.target.value)} aria-label="Filtrar por cliente"><option value="">Todos os clientes</option>{clients.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}</option>)}</select>
      <select value={partnerFilter} onChange={event => setPartnerFilter(event.target.value)} aria-label="Filtrar por parceiro"><option value="">Todos os parceiros</option>{partners.map(partner => <option value={String(partner.id)} key={partner.id}>{partnerName(partner)}{partner.status === 'Inativo' ? ' (inativo)' : ''}</option>)}</select>
      <label><span>Competência</span><input type="month" value={competence} onInput={event => setCompetence(event.currentTarget.value)} onChange={event => setCompetence(event.target.value)} /></label>
      <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="">Todos os status</option>{FINANCE_STATUSES.map(item => <option key={item}>{item}</option>)}</select>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente ou descrição" />
      <button type="button" onClick={generateRecurring}>Verificar recorrentes</button>
      {(clientFilter || partnerFilter || competence || status || query) ? <button type="button" onClick={() => { setClientFilter(''); setPartnerFilter(''); setCompetence(''); setStatus(''); setQuery('') }}>Limpar filtros</button> : null}
    </div>

    <div className="finance-table finance-pro-table"><div className="finance-row finance-head"><span>Cliente</span><span>Descrição</span><span>Vencimento</span><span>Valor</span><span>Recebimento</span><span>Status</span><span /></div>{rows.map(charge => {
      const client = clientsById.get(String(charge.clienteId))
      const summary = paymentSummary(charge)
      const shared = Boolean(charge.compartilhado || (charge.origem === 'recorrente' && client?.perfilAtendimento === 'Compartilhado'))
      const normalized = shared ? normalizeSharedCharge(charge, client) : charge
      const split = shared ? sharedSplit(normalized, client) : null
      const receiver = shared ? sharedReceiver(normalized, client) : ''
      const names = shared ? partnerShares(normalized, client).map(item => partnerName(partnersById.get(item.parceiroId))).join(', ') : ''
      const settlement = shared ? charge.status !== 'Recebido' ? 'Divisão prevista' : receiver === 'CadaUm' ? 'Sem repasse' : normalized.compartilhadoAcertoStatus === SETTLEMENT_DONE ? (receiver === 'Escritorio' ? 'Repasse pago' : 'Valor recebido do parceiro') : receiver === 'Escritorio' ? 'Repasse pendente' : 'A receber do parceiro' : ''
      const overduePartial = summary.balance > 0.009 && charge.vencimento && charge.vencimento < day
      return <article className={`finance-row ${overduePartial ? 'row-overdue' : ''}`} key={charge.id}>
        <div><b>{client ? clientName(client) : (charge.cliente || 'Cliente')}</b><small>{charge.competencia || 'Sem competência'}{charge.parcelaTotal > 1 ? ` · Parcela ${charge.parcelaNumero}/${charge.parcelaTotal}` : ''}</small></div>
        <div><span>{charge.descricao}</span>{shared ? <small>Compartilhado · {names || 'Parceiro'} · minha parte {money(split.mine)} · parceiros {money(split.partnerTotal)} · {settlement}</small> : null}{charge.origemTipo ? <small>Vínculo: {charge.origemTipo} · {charge.origemId}</small> : null}</div>
        <div><b>{formatDate(charge.vencimento)}</b>{overduePartial ? <small className="overdue-text">Saldo vencido</small> : null}</div>
        <div><strong>{money(summary.total)}</strong>{summary.discounts ? <small>Desconto {money(summary.discounts)}</small> : null}{summary.surcharges ? <small>Acréscimo {money(summary.surcharges)}</small> : null}</div>
        <div className="payment-cell"><b>{money(summary.receivedCash)}</b><small>Saldo {money(summary.balance)}</small>{summary.lastPaymentDate ? <small>Última baixa {formatDate(summary.lastPaymentDate)}</small> : null}<button type="button" onClick={() => setPaymentChargeId(String(charge.id))}>{summary.balance > 0.009 ? 'Registrar baixa' : 'Ver baixas'}</button></div>
        <div><select className={`finance-status status-${normalizeText(charge.status)}`} value={charge.status} onChange={event => changeStatus(charge, event.target.value)} aria-label={`Status de ${charge.descricao}`}>{FINANCE_STATUSES.map(item => <option key={item}>{item}</option>)}</select></div>
        <div className="finance-row-actions finance-doc-actions"><button type="button" onClick={() => generateDocument(charge, 'invoice')}>Fatura PDF</button>{summary.receivedCash > 0.009 ? <button type="button" onClick={() => generateDocument(charge, 'receipt')}>Recibo PDF</button> : null}{shared ? <button type="button" onClick={() => setEditingShared(String(charge.id))}>Divisão</button> : null}<button type="button" className="danger" onClick={() => deleteCharge(charge.id)} aria-label={`Excluir cobrança ${charge.descricao}`}>×</button></div>
      </article>
    })}{!rows.length ? <p className="finance-empty">Nenhuma cobrança nesta seleção.</p> : null}</div></section>

    {creating ? <ChargeForm office={office} clients={activeClients} partners={partners} competence={competence} initialClientId={clientFilter || initialClientId} onClose={() => setCreating(false)} onSave={saveCharges} /> : null}
    {sharedEditorCharge ? <SharedFinanceEditor charge={sharedEditorCharge} client={sharedClient || {}} partners={partners} onClose={() => setEditingShared('')} onSave={saveSharedAdjustment} /> : null}
    {paymentCharge ? <PaymentEditor charge={paymentCharge} onClose={() => setPaymentChargeId('')} onSave={registerPayment} onRemove={removePayment} /> : null}
    {notice ? <div className="finance-notice" role="status">{notice}</div> : null}
  </div>
}
