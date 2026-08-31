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
import SharedFinanceEditor from './SharedFinanceEditor.jsx'
import '../finance-react.css'

const statuses = ['Pendente', 'Recebido', 'Atrasado', 'Cancelado']
const currentCompetence = () => today().slice(0, 7)
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const partnerName = partner => partner?.nome || partner?.razao || 'Parceiro'
const normalizeText = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'

function normalizedCharge(charge, client) {
  const normalized = {
    ...charge,
    id: charge.id || uid('fin'),
    clienteId: String(charge.clienteId || ''),
    cliente: charge.cliente || '',
    descricao: charge.descricao || charge.referencia || 'Honorários contábeis',
    competencia: charge.competencia || '',
    vencimento: charge.vencimento || charge.data || '',
    valor: Number(charge.valor) || 0,
    status: statuses.includes(charge.status) ? charge.status : 'Pendente',
    recebidoEm: charge.recebidoEm || '',
    origem: charge.origem || 'manual',
    origemTipo: charge.origemTipo || '',
    origemId: charge.origemId || '',
  }
  if (!charge.compartilhado && !(charge.origem === 'recorrente' && client?.perfilAtendimento === 'Compartilhado')) return normalized
  return normalizeSharedCharge(normalized, client)
}

function Modal({ onClose, children }) {
  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label="Nova cobrança" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="finance-modal-card"><header><div><h2>Nova cobrança</h2><p>Honorário recorrente extra ou serviço específico.</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div>
}

function Field({ label, full = false, children }) { return <label className={`finance-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }

function ChargeForm({ office, clients, partners, competence, initialClientId = '', onClose, onSave }) {
  const defaultClient = clients.find(item => String(item.id) === String(initialClientId)) || null
  const defaultPartnerIds = defaultClient?.perfilAtendimento === 'Compartilhado' ? clientPartnerIds(defaultClient) : []
  const [draft, setDraft] = useState({
    clienteId: defaultClient ? String(defaultClient.id) : '',
    descricao: '', valor: '', vencimento: today(), competencia: competence || currentCompetence(), status: 'Pendente', sourceRef: '',
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
    setDraft(current => ({
      ...current,
      clienteId: String(id || ''), sourceRef: '', compartilhado: Boolean(client?.perfilAtendimento === 'Compartilhado'),
      parceiroIds: ids, compartilhadoRecebedor: 'Escritorio', compartilhadoMinhaParte: '',
      compartilhadoPartesParceiros: ids.map(parceiroId => ({ parceiroId, valor: 0 })),
    }))
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
    if (!draft.clienteId || !draft.descricao.trim() || value <= 0 || !draft.vencimento) { setError('Preencha cliente, descrição, valor e vencimento.'); return }
    const client = selectedClient
    const [sourceType = '', sourceId = ''] = String(draft.sourceRef || '').split(':')
    const base = {
      id: uid('fin'), clienteId: draft.clienteId, cliente: clientName(client), descricao: draft.descricao.trim(),
      competencia: draft.competencia || draft.vencimento.slice(0, 7), vencimento: draft.vencimento, valor: value,
      status: draft.status, recebidoEm: draft.status === 'Recebido' ? today() : '', origem: 'manual', origemTipo: sourceType, origemId: sourceId,
    }
    if (!sharedEnabled) { onSave(base); return }
    const candidate = normalizeSharedCharge({
      ...base,
      compartilhado: true,
      parceiroIds: selectedPartnerIds,
      parceiroId: selectedPartnerIds[0] || '',
      compartilhadoRecebedor: draft.compartilhadoRecebedor || 'Escritorio',
      compartilhadoMinhaParte: Number(draft.compartilhadoMinhaParte) || 0,
      compartilhadoPartesParceiros: selectedPartnerIds.map(parceiroId => ({ parceiroId, valor: shareMap.get(parceiroId) || 0 })),
      compartilhadoAcertoStatus: SETTLEMENT_PENDING,
      compartilhadoAcertoEm: '',
      compartilhadoObservacao: '',
      compartilhadoPersonalizado: true,
    }, client)
    const validationError = sharedChargeError(candidate, client)
    if (validationError) { setError(validationError); return }
    onSave(candidate)
  }

  const splitPreview = sharedEnabled ? sharedSplit({ ...draft, valor: Number(draft.valor) || 0, compartilhadoPartesParceiros: selectedPartnerIds.map(parceiroId => ({ parceiroId, valor: shareMap.get(parceiroId) || 0 })) }, selectedClient) : null

  return <Modal onClose={onClose}><form className="finance-form" onSubmit={submit}>
    <Field label="Cliente *" full><select value={draft.clienteId} onChange={event => changeClient(event.target.value)}><option value="">Selecione</option>{clients.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}{client.relacionamento === 'Avulso' ? ' · avulso' : ''}{client.perfilAtendimento === 'Compartilhado' ? ' · compartilhado' : ''}</option>)}</select></Field>
    <Field label="Descrição *" full><input value={draft.descricao} onChange={event => setField('descricao', event.target.value)} placeholder="Ex.: Alteração contratual" /></Field>
    {sourceChoices.length ? <Field label="Vincular ao trabalho" full><select value={draft.sourceRef} onChange={event => setField('sourceRef', event.target.value)}><option value="">Sem vínculo específico</option>{sourceChoices.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field> : null}
    <Field label="Valor *"><input type="number" min="0" step="0.01" value={draft.valor} onChange={event => setField('valor', event.target.value)} /></Field>
    <Field label="Vencimento *"><input type="date" value={draft.vencimento} onInput={event => setField('vencimento', event.currentTarget.value)} onChange={event => setField('vencimento', event.target.value)} /></Field>
    <Field label="Competência"><input type="month" value={draft.competencia} onInput={event => setField('competencia', event.currentTarget.value)} onChange={event => setField('competencia', event.target.value)} /></Field>
    <Field label="Status"><select value={draft.status} onChange={event => setField('status', event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select></Field>

    {selectedClient?.perfilAtendimento === 'Compartilhado' ? <div className="finance-field full shared-service-box"><span>Compartilhamento deste serviço</span><label className="third-party-toggle"><input type="checkbox" checked={Boolean(draft.compartilhado)} onChange={event => setField('compartilhado', event.target.checked)} /> Este serviço possui divisão financeira com parceiro</label>{sharedEnabled ? <>
      <div className="choice-list">{clientPartnerIds(selectedClient).map(id => { const partner = partners.find(item => String(item.id) === id); return partner ? <label key={id}><input type="checkbox" checked={selectedPartnerIds.includes(id)} onChange={() => togglePartner(id)} /> {partnerName(partner)}{partner.status === 'Inativo' ? ' (inativo)' : ''}</label> : null })}</div>
      <div className="shared-finance-default-grid">
        <label><span>Quem recebeu</span><select value={sharedReceiver(draft, selectedClient)} onChange={event => setField('compartilhadoRecebedor', event.target.value)}><option value="Escritorio">Meu escritório</option>{selectedPartners.map(partner => <option key={partner.id} value={`partner:${partner.id}`}>{partnerName(partner)}</option>)}<option value="CadaUm">Cada um recebe sua parte</option></select></label>
        <label><span>Minha parte</span><input type="number" min="0" step="0.01" value={draft.compartilhadoMinhaParte} onChange={event => setField('compartilhadoMinhaParte', event.target.value)} /></label>
        {selectedPartners.map(partner => <label key={partner.id}><span>Parte de {partnerName(partner)}</span><input type="number" min="0" step="0.01" value={shareMap.get(String(partner.id)) || 0} onChange={event => setShare(partner.id, event.target.value)} /></label>)}
      </div>
      {splitPreview ? <div className={`shared-finance-check ${Math.abs(splitPreview.difference) > 0.009 ? 'invalid' : ''}`}><span>Total {money(splitPreview.total)}</span><span>Divisão {money(splitPreview.splitTotal)}</span><span>Diferença {money(splitPreview.difference)}</span></div> : null}
    </> : null}</div> : null}

    {error ? <p className="finance-error">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar cobrança</button></footer>
  </form></Modal>
}

export default function FinanceReact({ office, update, sync, initialClientId = '', openClientRequest = 0, openNewRequest = 0 }) {
  const [competence, setCompetence] = useState(currentCompetence), [status, setStatus] = useState(''), [query, setQuery] = useState(''), [clientFilter, setClientFilter] = useState(''), [partnerFilter, setPartnerFilter] = useState('')
  const [creating, setCreating] = useState(false), [notice, setNotice] = useState(''), [editingShared, setEditingShared] = useState('')
  const clients = office.clients || [], finance = office.finance || [], partners = office.partners || []
  const clientsById = useMemo(() => new Map(clients.map(client => [String(client.id), client])), [clients])
  const partnersById = useMemo(() => new Map(partners.map(partner => [String(partner.id), partner])), [partners])
  const activeClients = useMemo(() => clients.filter(client => client.status !== 'Inativo'), [clients])
  const partnerBalances = useMemo(() => allPartnerBalances(finance, clients, partners), [clients, finance, partners])
  const partnerTotals = useMemo(() => partnerBalances.reduce((result, item) => ({ aPagar: result.aPagar + item.aPagar, aReceber: result.aReceber + item.aReceber }), { aPagar: 0, aReceber: 0 }), [partnerBalances])
  const rows = useMemo(() => finance.filter(charge => {
    const client = clientsById.get(String(charge.clienteId))
    const normalized = charge.compartilhado || (charge.origem === 'recorrente' && client?.perfilAtendimento === 'Compartilhado') ? normalizeSharedCharge(charge, client) : charge
    const partnerAllowed = !partnerFilter || (normalized.compartilhado && clientPartnerIds(normalized).includes(String(partnerFilter)))
    return (!competence || charge.competencia === competence)
      && (!clientFilter || String(charge.clienteId) === String(clientFilter))
      && (!status || charge.status === status)
      && partnerAllowed
      && (!query || normalizeText(`${clientName(client)} ${charge.cliente} ${charge.descricao} ${charge.compartilhadoObservacao || ''}`).includes(normalizeText(query)))
  }), [clientFilter, clientsById, competence, finance, partnerFilter, query, status])
  const totals = useMemo(() => finance.reduce((result, charge) => {
    if ((!competence || charge.competencia === competence) && (!clientFilter || String(charge.clienteId) === String(clientFilter)) && charge.status in result) result[charge.status] += Number(charge.valor) || 0
    return result
  }, { Recebido: 0, Pendente: 0, Atrasado: 0 }), [clientFilter, competence, finance])
  const rawSharedCharge = useMemo(() => finance.find(charge => String(charge.id) === String(editingShared)) || null, [editingShared, finance])
  const sharedClient = rawSharedCharge ? clientsById.get(String(rawSharedCharge.clienteId)) || {} : null
  const sharedEditorCharge = rawSharedCharge ? normalizeSharedCharge(rawSharedCharge, sharedClient) : null

  useEffect(() => {
    const seen = new Set(), normalized = [], day = today()
    let changed = false
    finance.forEach(raw => {
      const client = clientsById.get(String(raw.clienteId))
      const charge = normalizedCharge(raw, client)
      if (seen.has(charge.id)) { changed = true; return }
      seen.add(charge.id)
      if (charge.status === 'Pendente' && charge.vencimento && charge.vencimento < day) { charge.status = 'Atrasado'; changed = true }
      if (JSON.stringify(charge) !== JSON.stringify(raw)) changed = true
      normalized.push(charge)
    })
    if (changed) update(draft => { draft.finance = normalized })
  }, [clientsById, finance, update])

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

  useEffect(() => {
    if (!initialClientId || !openClientRequest) return
    setClientFilter(String(initialClientId)); setCompetence(''); setStatus(''); setQuery(''); setPartnerFilter('')
  }, [initialClientId, openClientRequest])
  useEffect(() => { if (!initialClientId || !openNewRequest) return; setClientFilter(String(initialClientId)); setCreating(true) }, [initialClientId, openNewRequest])
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 2800); return () => clearTimeout(timer) }, [notice])

  function saveCharge(charge) { update(draft => { draft.finance = [...(draft.finance || []), charge] }); setCreating(false); setNotice('Cobrança salva.') }
  function changeStatus(id, nextStatus) {
    update(draft => {
      const charge = (draft.finance || []).find(item => String(item.id) === String(id)); if (!charge) return
      const previous = charge.status; charge.status = nextStatus; charge.recebidoEm = nextStatus === 'Recebido' ? (previous === 'Recebido' ? charge.recebidoEm : today()) : ''
    })
    setNotice(nextStatus === 'Recebido' ? 'Recebimento registrado. O acerto com parceiro já entrou no saldo pendente.' : 'Status atualizado.')
  }
  function deleteCharge(id) { if (!window.confirm('Excluir esta cobrança?')) return; update(draft => { draft.finance = (draft.finance || []).filter(item => String(item.id) !== String(id)) }); setNotice('Cobrança excluída.') }
  function saveSharedAdjustment(values) {
    if (!editingShared) return
    update(draft => {
      const charge = (draft.finance || []).find(item => String(item.id) === String(editingShared)); if (!charge) return
      Object.assign(charge, values, { compartilhado: true })
    })
    setEditingShared(''); setNotice('Divisão e acerto atualizados.')
  }
  function generateRecurring() {
    if (!/^\d{4}-\d{2}$/.test(competence)) { setNotice('Selecione uma competência válida.'); return }
    const additions = buildMissingRecurringCharges({ clients: activeClients, finance, competence, clientId: clientFilter, makeId: () => uid('fin') })
    if (!additions.length) { setNotice('Nenhuma cobrança recorrente pendente para gerar.'); return }
    update(draft => {
      const fresh = buildMissingRecurringCharges({ clients: draft.clients || [], finance: draft.finance || [], competence, clientId: clientFilter, makeId: () => uid('fin') })
      if (fresh.length) draft.finance = [...(draft.finance || []), ...fresh]
    })
    setNotice(`${additions.length} cobrança${additions.length === 1 ? '' : 's'} recorrente${additions.length === 1 ? '' : 's'} gerada${additions.length === 1 ? '' : 's'}.`)
  }

  return <div className="react-module-page finance-page">
    <div className="react-module-topbar"><div><h1>Financeiro</h1><p>Honorários do escritório e acertos com parceiros no mesmo fluxo.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}</span><button type="button" className="primary" onClick={() => setCreating(true)}>+ Nova cobrança</button></div></div>
    <div className="finance-kpis"><article><small>Recebido de clientes</small><strong>{money(totals.Recebido)}</strong></article><article><small>A receber de clientes</small><strong>{money(totals.Pendente)}</strong></article><article className="overdue"><small>Em atraso</small><strong>{money(totals.Atrasado)}</strong></article><article><small>A repassar parceiros</small><strong>{money(partnerTotals.aPagar)}</strong></article><article><small>A receber parceiros</small><strong>{money(partnerTotals.aReceber)}</strong></article></div>

    {partnerBalances.some(item => item.aPagar || item.aReceber) ? <section className="finance-card partner-balance-section"><div className="partner-balance-head"><div><h2>Acertos com parceiros</h2><p>Somente valores de cobranças recebidas e ainda não liquidadas.</p></div></div><div className="partner-balance-grid">{partnerBalances.filter(item => item.aPagar || item.aReceber).map(item => <article key={item.id}><b>{partnerName(item)}</b><span>A pagar: {money(item.aPagar)}</span><span>A receber: {money(item.aReceber)}</span><strong>Saldo: {money(item.saldo)}</strong></article>)}</div></section> : null}

    <section className="finance-card"><div className="finance-toolbar">
      <select value={clientFilter} onChange={event => setClientFilter(event.target.value)} aria-label="Filtrar por cliente"><option value="">Todos os clientes</option>{clients.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}</option>)}</select>
      <select value={partnerFilter} onChange={event => setPartnerFilter(event.target.value)} aria-label="Filtrar por parceiro"><option value="">Todos os parceiros</option>{partners.map(partner => <option value={String(partner.id)} key={partner.id}>{partnerName(partner)}{partner.status === 'Inativo' ? ' (inativo)' : ''}</option>)}</select>
      <label><span>Competência</span><input type="month" value={competence} onInput={event => setCompetence(event.currentTarget.value)} onChange={event => setCompetence(event.target.value)} /></label>
      <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="">Todos os status</option>{statuses.map(item => <option key={item}>{item}</option>)}</select>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente ou descrição" /><button type="button" onClick={generateRecurring}>Verificar recorrentes</button>
    </div>
    <div className="finance-table"><div className="finance-row finance-head"><span>Cliente</span><span>Descrição</span><span>Competência</span><span>Vencimento</span><span>Valor</span><span>Status</span><span /></div>{rows.map(charge => {
      const client = clientsById.get(String(charge.clienteId))
      const shared = Boolean(charge.compartilhado || (charge.origem === 'recorrente' && client?.perfilAtendimento === 'Compartilhado'))
      const normalized = shared ? normalizeSharedCharge(charge, client) : charge
      const split = shared ? sharedSplit(normalized, client) : null
      const receiver = shared ? sharedReceiver(normalized, client) : ''
      const names = shared ? partnerShares(normalized, client).map(item => partnerName(partnersById.get(item.parceiroId))).join(', ') : ''
      const settlement = shared
        ? charge.status !== 'Recebido' ? 'Divisão prevista'
          : receiver === 'CadaUm' ? 'Sem repasse'
            : normalized.compartilhadoAcertoStatus === SETTLEMENT_DONE ? (receiver === 'Escritorio' ? 'Repasse pago' : 'Valor recebido do parceiro')
              : receiver === 'Escritorio' ? 'Repasse pendente' : 'A receber do parceiro'
        : ''
      return <article className="finance-row" key={charge.id}>
        <div><b>{client ? clientName(client) : (charge.cliente || 'Cliente')}</b>{client?.status === 'Inativo' ? <em>Inativo</em> : null}</div>
        <div><span>{charge.descricao}</span>{shared ? <small>Compartilhado · {names || 'Parceiro'} · minha parte {money(split.mine)} · parceiros {money(split.partnerTotal)} · {settlement}{normalized.compartilhadoObservacao ? ` · ${normalized.compartilhadoObservacao}` : ''}</small> : null}{charge.origemTipo ? <small>Vínculo: {charge.origemTipo} · {charge.origemId}</small> : null}</div>
        <span>{charge.competencia || '—'}</span><span>{formatDate(charge.vencimento)}</span><strong>{money(charge.valor)}</strong>
        <div><select className={`finance-status status-${normalizeText(charge.status)}`} value={charge.status} onChange={event => changeStatus(charge.id, event.target.value)} aria-label={`Status de ${charge.descricao}`}>{statuses.map(item => <option key={item}>{item}</option>)}</select>{charge.recebidoEm ? <small>Recebido em {formatDate(charge.recebidoEm)}</small> : null}</div>
        <div className="finance-row-actions">{shared ? <button type="button" onClick={() => setEditingShared(String(charge.id))}>Divisão</button> : null}<button type="button" className="danger" onClick={() => deleteCharge(charge.id)} aria-label={`Excluir cobrança ${charge.descricao}`}>×</button></div>
      </article>
    })}{!rows.length ? <p className="finance-empty">Nenhuma cobrança nesta seleção.</p> : null}</div></section>

    {creating ? <ChargeForm office={office} clients={activeClients} partners={partners} competence={competence} initialClientId={clientFilter || initialClientId} onClose={() => setCreating(false)} onSave={saveCharge} /> : null}
    {sharedEditorCharge ? <SharedFinanceEditor charge={sharedEditorCharge} client={sharedClient || {}} partners={partners} onClose={() => setEditingShared('')} onSave={saveSharedAdjustment} /> : null}
    {notice ? <div className="finance-notice" role="status">{notice}</div> : null}
  </div>
}
