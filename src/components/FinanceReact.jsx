import { useEffect, useMemo, useState } from 'react'
import { today, uid } from '../lib/storage.js'
import { buildMissingRecurringCharges } from '../lib/financeRecurring.js'
import SharedFinanceEditor from './SharedFinanceEditor.jsx'
import '../finance-react.css'

const statuses = ['Pendente', 'Recebido', 'Atrasado', 'Cancelado']
const currentCompetence = () => today().slice(0, 7)
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const normalizeText = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'

function normalizedCharge(charge) {
  const normalized = {
    id: charge.id || uid('fin'), clienteId: String(charge.clienteId || ''), cliente: charge.cliente || '',
    descricao: charge.descricao || charge.referencia || 'Honorários contábeis', competencia: charge.competencia || '',
    vencimento: charge.vencimento || charge.data || '', valor: Number(charge.valor) || 0,
    status: statuses.includes(charge.status) ? charge.status : 'Pendente', recebidoEm: charge.recebidoEm || '', origem: charge.origem || 'manual',
  }
  if (!charge.compartilhado) return normalized
  return {
    ...normalized,
    compartilhado: true,
    parceiroId: String(charge.parceiroId || ''),
    compartilhadoRecebedor: charge.compartilhadoRecebedor || 'Escritorio',
    compartilhadoMinhaParte: Number(charge.compartilhadoMinhaParte) || 0,
    compartilhadoParceiroParte: Number(charge.compartilhadoParceiroParte) || 0,
    compartilhadoPersonalizado: Boolean(charge.compartilhadoPersonalizado),
  }
}

function Modal({ onClose, children }) {
  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label="Nova cobrança avulsa" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="finance-modal-card"><header><div><h2>Nova cobrança avulsa</h2><p>Honorário de cliente avulso ou serviço específico.</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div>
}

function Field({ label, full = false, children }) { return <label className={`finance-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }

function ChargeForm({ clients, competence, initialClientId = '', onClose, onSave }) {
  const defaultClientId = clients.some(item => String(item.id) === String(initialClientId)) ? String(initialClientId) : ''
  const [draft, setDraft] = useState({ clienteId: defaultClientId, descricao: '', valor: '', vencimento: today(), competencia: competence || currentCompetence(), status: 'Pendente' })
  const [error, setError] = useState('')
  function setField(name, value) { setDraft(current => ({ ...current, [name]: value })) }
  function submit(event) {
    event.preventDefault()
    const value = Number(draft.valor)
    if (!draft.clienteId || !draft.descricao.trim() || value <= 0 || !draft.vencimento) { setError('Preencha cliente, descrição, valor e vencimento.'); return }
    const client = clients.find(item => String(item.id) === draft.clienteId)
    onSave({ id: uid('fin'), clienteId: draft.clienteId, cliente: clientName(client), descricao: draft.descricao.trim(), competencia: draft.competencia || draft.vencimento.slice(0, 7), vencimento: draft.vencimento, valor: value, status: draft.status, recebidoEm: draft.status === 'Recebido' ? today() : '', origem: 'manual' })
  }
  return <Modal onClose={onClose}><form className="finance-form" onSubmit={submit}><Field label="Cliente *" full><select value={draft.clienteId} onChange={event => setField('clienteId', event.target.value)}><option value="">Selecione</option>{clients.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}</option>)}</select></Field><Field label="Descrição *" full><input value={draft.descricao} onChange={event => setField('descricao', event.target.value)} placeholder="Ex.: Alteração contratual" /></Field><Field label="Valor *"><input type="number" min="0" step="0.01" value={draft.valor} onChange={event => setField('valor', event.target.value)} /></Field><Field label="Vencimento *"><input type="date" value={draft.vencimento} onInput={event => setField('vencimento', event.currentTarget.value)} onChange={event => setField('vencimento', event.target.value)} /></Field><Field label="Competência"><input type="month" value={draft.competencia} onInput={event => setField('competencia', event.currentTarget.value)} onChange={event => setField('competencia', event.target.value)} /></Field><Field label="Status"><select value={draft.status} onChange={event => setField('status', event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select></Field>{error ? <p className="finance-error">{error}</p> : null}<footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Salvar cobrança</button></footer></form></Modal>
}

export default function FinanceReact({ office, update, sync, initialClientId = '', openClientRequest = 0, openNewRequest = 0 }) {
  const [competence, setCompetence] = useState(currentCompetence), [status, setStatus] = useState(''), [query, setQuery] = useState(''), [clientFilter, setClientFilter] = useState('')
  const [creating, setCreating] = useState(false), [notice, setNotice] = useState('')
  const [editingShared, setEditingShared] = useState('')
  const clients = office.clients || [], finance = office.finance || [], partners = office.partners || []
  const clientsById = useMemo(() => new Map(clients.map(client => [String(client.id), client])), [clients])
  const partnersById = useMemo(() => new Map(partners.map(partner => [String(partner.id), partner])), [partners])
  const activeClients = useMemo(() => clients.filter(client => client.status !== 'Inativo'), [clients])
  const rows = useMemo(() => finance.filter(charge => (!competence || charge.competencia === competence) && (!clientFilter || String(charge.clienteId) === String(clientFilter)) && (!status || charge.status === status) && (!query || normalizeText(`${clientName(clientsById.get(String(charge.clienteId)))} ${charge.cliente} ${charge.descricao}`).includes(normalizeText(query)))), [clientFilter, clientsById, competence, finance, query, status])
  const totals = useMemo(() => finance.reduce((result, charge) => { if ((!competence || charge.competencia === competence) && (!clientFilter || String(charge.clienteId) === String(clientFilter)) && charge.status in result) result[charge.status] += Number(charge.valor) || 0; return result }, { Recebido: 0, Pendente: 0, Atrasado: 0 }), [clientFilter, competence, finance])
  const rawSharedCharge = useMemo(() => finance.find(charge => String(charge.id) === String(editingShared)) || null, [editingShared, finance])
  const sharedClient = rawSharedCharge ? clientsById.get(String(rawSharedCharge.clienteId)) : null
  const sharedEditorCharge = rawSharedCharge ? {
    ...rawSharedCharge,
    parceiroId: rawSharedCharge.parceiroId || sharedClient?.parceiroId || '',
    compartilhadoRecebedor: rawSharedCharge.compartilhadoRecebedor || sharedClient?.compartilhadoRecebedor || 'Escritorio',
    compartilhadoMinhaParte: rawSharedCharge.compartilhado ? (Number(rawSharedCharge.compartilhadoMinhaParte) || 0) : (Number(sharedClient?.compartilhadoMinhaParte) || 0),
    compartilhadoParceiroParte: rawSharedCharge.compartilhado ? (Number(rawSharedCharge.compartilhadoParceiroParte) || 0) : (Number(sharedClient?.compartilhadoParceiroParte) || 0),
  } : null
  const sharedPartner = sharedEditorCharge ? partnersById.get(String(sharedEditorCharge.parceiroId || '')) : null

  useEffect(() => {
    const seen = new Set(), normalized = [], day = today()
    let changed = false
    finance.forEach(raw => {
      const charge = normalizedCharge(raw)
      if (seen.has(charge.id)) { changed = true; return }
      seen.add(charge.id)
      if (charge.status === 'Pendente' && charge.vencimento && charge.vencimento < day) { charge.status = 'Atrasado'; changed = true }
      if (JSON.stringify(charge) !== JSON.stringify(raw)) changed = true
      normalized.push(charge)
    })
    if (changed) update(draft => { draft.finance = normalized })
  }, [finance, update])

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
    setClientFilter(String(initialClientId))
    setCompetence('')
    setStatus('')
    setQuery('')
  }, [initialClientId, openClientRequest])

  useEffect(() => {
    if (!initialClientId || !openNewRequest) return
    setClientFilter(String(initialClientId))
    setCreating(true)
  }, [initialClientId, openNewRequest])

  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 2800); return () => clearTimeout(timer) }, [notice])

  function saveCharge(charge) { update(draft => { draft.finance = [...draft.finance, charge] }); setCreating(false); setNotice('Cobrança salva.') }
  function changeStatus(id, nextStatus) { update(draft => { const charge = draft.finance.find(item => String(item.id) === String(id)); if (!charge) return; const previous = charge.status; charge.status = nextStatus; charge.recebidoEm = nextStatus === 'Recebido' ? (previous === 'Recebido' ? charge.recebidoEm : today()) : '' }); setNotice(nextStatus === 'Recebido' ? 'Recebimento registrado.' : 'Status atualizado.') }
  function deleteCharge(id) { if (!window.confirm('Excluir esta cobrança?')) return; update(draft => { draft.finance = draft.finance.filter(item => String(item.id) !== String(id)) }); setNotice('Cobrança excluída.') }
  function saveSharedAdjustment(values) {
    if (!editingShared) return
    update(draft => {
      const charge = (draft.finance || []).find(item => String(item.id) === String(editingShared))
      if (!charge) return
      const client = (draft.clients || []).find(item => String(item.id) === String(charge.clienteId))
      Object.assign(charge, values, { compartilhado: true, parceiroId: charge.parceiroId || client?.parceiroId || '' })
    })
    setEditingShared('')
    setNotice('Divisão desta competência atualizada.')
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

  return <div className="react-module-page finance-page"><div className="react-module-topbar"><div><h1>Financeiro</h1><p>Honorários mensais recorrentes são gerados automaticamente para clientes ativos.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}</span><button type="button" className="primary" onClick={() => setCreating(true)}>+ Nova cobrança</button></div></div><div className="finance-kpis"><article><small>Recebido</small><strong>{money(totals.Recebido)}</strong></article><article><small>A receber</small><strong>{money(totals.Pendente)}</strong></article><article className="overdue"><small>Em atraso</small><strong>{money(totals.Atrasado)}</strong></article></div><section className="finance-card"><div className="finance-toolbar"><select value={clientFilter} onChange={event => setClientFilter(event.target.value)} aria-label="Filtrar por cliente"><option value="">Todos os clientes</option>{clients.map(client => <option value={String(client.id)} key={client.id}>{clientName(client)}</option>)}</select><label><span>Competência</span><input type="month" value={competence} onInput={event => setCompetence(event.currentTarget.value)} onChange={event => setCompetence(event.target.value)} /></label><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="">Todos os status</option>{statuses.map(item => <option key={item}>{item}</option>)}</select><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente ou descrição" /><button type="button" onClick={generateRecurring}>Verificar recorrentes</button></div><div className="finance-table"><div className="finance-row finance-head"><span>Cliente</span><span>Descrição</span><span>Competência</span><span>Vencimento</span><span>Valor</span><span>Status</span><span /></div>{rows.map(charge => {
    const client = clientsById.get(String(charge.clienteId))
    const sharedRecurring = client?.perfilAtendimento === 'Compartilhado' && charge.origem === 'recorrente'
    const partner = sharedRecurring ? partnersById.get(String(charge.parceiroId || client?.parceiroId || '')) : null
    const receiver = charge.compartilhadoRecebedor || client?.compartilhadoRecebedor || 'Escritorio'
    const mine = charge.compartilhado ? Number(charge.compartilhadoMinhaParte) || 0 : Number(client?.compartilhadoMinhaParte) || 0
    const theirs = charge.compartilhado ? Number(charge.compartilhadoParceiroParte) || 0 : Number(client?.compartilhadoParceiroParte) || 0
    return <article className="finance-row" key={charge.id}><div><b>{client ? clientName(client) : (charge.cliente || 'Cliente')}</b>{client?.status === 'Inativo' ? <em>Inativo</em> : null}</div><div><span>{charge.descricao}</span>{sharedRecurring ? <small>{partner?.nome || 'Parceiro'} · {receiver === 'Parceiro' ? 'parceiro recebe' : 'meu escritório recebe'} · minha parte {money(mine)} · parceiro {money(theirs)}{charge.compartilhadoPersonalizado ? ' · ajustado neste mês' : ' · padrão'}</small> : null}</div><span>{charge.competencia || '—'}</span><span>{formatDate(charge.vencimento)}</span><strong>{money(charge.valor)}</strong><div><select className={`finance-status status-${normalizeText(charge.status)}`} value={charge.status} onChange={event => changeStatus(charge.id, event.target.value)} aria-label={`Status de ${charge.descricao}`}>{statuses.map(item => <option key={item}>{item}</option>)}</select>{charge.recebidoEm ? <small>Recebido em {formatDate(charge.recebidoEm)}</small> : null}</div><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{sharedRecurring ? <button type="button" onClick={() => setEditingShared(String(charge.id))}>Divisão</button> : null}<button type="button" className="danger" onClick={() => deleteCharge(charge.id)} aria-label={`Excluir cobrança ${charge.descricao}`}>×</button></div></article>
  })}{!rows.length ? <p className="finance-empty">Nenhuma cobrança nesta competência.</p> : null}</div></section>{creating ? <ChargeForm clients={activeClients} competence={competence} initialClientId={clientFilter || initialClientId} onClose={() => setCreating(false)} onSave={saveCharge} /> : null}{sharedEditorCharge ? <SharedFinanceEditor charge={sharedEditorCharge} partner={sharedPartner} onClose={() => setEditingShared('')} onSave={saveSharedAdjustment} /> : null}{notice ? <div className="finance-notice" role="status">{notice}</div> : null}</div>
}