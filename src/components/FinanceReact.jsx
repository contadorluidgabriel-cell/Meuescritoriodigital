import { useEffect, useMemo, useState } from 'react'
import { today, uid } from '../lib/storage.js'
import '../finance-react.css'

const statuses = ['Pendente', 'Recebido', 'Atrasado', 'Cancelado']
const currentCompetence = () => today().slice(0, 7)
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const normalizeText = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—'

function normalizedCharge(charge) {
  return {
    id: charge.id || uid('fin'), clienteId: String(charge.clienteId || ''), cliente: charge.cliente || '',
    descricao: charge.descricao || charge.referencia || 'Honorários contábeis', competencia: charge.competencia || '',
    vencimento: charge.vencimento || charge.data || '', valor: Number(charge.valor) || 0,
    status: statuses.includes(charge.status) ? charge.status : 'Pendente', recebidoEm: charge.recebidoEm || '', origem: charge.origem || 'manual',
  }
}

function Modal({ onClose, children }) {
  return <div className="finance-modal" role="dialog" aria-modal="true" aria-label="Nova cobrança avulsa" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="finance-modal-card"><header><div><h2>Nova cobrança avulsa</h2><p>Honorário de cliente avulso ou serviço específico.</p></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>{children}</div></div>
}

function Field({ label, full = false, children }) { return <label className={`finance-field ${full ? 'full' : ''}`}><span>{label}</span>{children}</label> }

function ChargeForm({ clients, competence, onClose, onSave }) {
  const [draft, setDraft] = useState({ clienteId: '', descricao: '', valor: '', vencimento: today(), competencia: competence, status: 'Pendente' })
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

export default function FinanceReact({ office, update, sync }) {
  const [competence, setCompetence] = useState(currentCompetence), [status, setStatus] = useState(''), [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false), [notice, setNotice] = useState('')
  const clients = office.clients || [], finance = office.finance || []
  const clientsById = useMemo(() => new Map(clients.map(client => [String(client.id), client])), [clients])
  const activeClients = useMemo(() => clients.filter(client => client.status !== 'Inativo'), [clients])
  const rows = useMemo(() => finance.filter(charge => (!competence || charge.competencia === competence) && (!status || charge.status === status) && (!query || normalizeText(`${clientName(clientsById.get(String(charge.clienteId)))} ${charge.cliente} ${charge.descricao}`).includes(normalizeText(query)))), [clientsById, competence, finance, query, status])
  const totals = useMemo(() => finance.reduce((result, charge) => { if (charge.competencia === competence && charge.status in result) result[charge.status] += Number(charge.valor) || 0; return result }, { Recebido: 0, Pendente: 0, Atrasado: 0 }), [competence, finance])

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

  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 2800); return () => clearTimeout(timer) }, [notice])

  function saveCharge(charge) { update(draft => { draft.finance = [...draft.finance, charge] }); setCreating(false); setNotice('Cobrança salva.') }
  function changeStatus(id, nextStatus) { update(draft => { const charge = draft.finance.find(item => String(item.id) === String(id)); if (!charge) return; const previous = charge.status; charge.status = nextStatus; charge.recebidoEm = nextStatus === 'Recebido' ? (previous === 'Recebido' ? charge.recebidoEm : today()) : '' }); setNotice(nextStatus === 'Recebido' ? 'Recebimento registrado.' : 'Status atualizado.') }
  function deleteCharge(id) { if (!window.confirm('Excluir esta cobrança?')) return; update(draft => { draft.finance = draft.finance.filter(item => String(item.id) !== String(id)) }); setNotice('Cobrança excluída.') }
  function generateRecurring() {
    const [year, month] = competence.split('-').map(Number)
    if (!year || !month) { setNotice('Selecione uma competência válida.'); return }
    let created = 0
    update(draft => {
      const existing = new Set(draft.finance.filter(charge => charge.origem === 'recorrente' && charge.competencia === competence).map(charge => String(charge.clienteId)))
      const additions = activeClients.filter(client => client.relacionamento === 'Recorrente' && Number(client.mensalidade ?? client.honorario ?? 0) > 0 && !existing.has(String(client.id))).map(client => {
        const requested = Math.max(1, Number(client.vencimento) || 10), lastDay = new Date(year, month, 0).getDate(), day = Math.min(requested, lastDay)
        created += 1
        return { id: uid('fin'), clienteId: String(client.id), cliente: clientName(client), descricao: 'Honorários contábeis', competencia: competence, vencimento: `${competence}-${String(day).padStart(2, '0')}`, valor: Number(client.mensalidade ?? client.honorario ?? 0) || 0, status: 'Pendente', recebidoEm: '', origem: 'recorrente' }
      })
      draft.finance = [...draft.finance, ...additions]
    })
    setNotice(created ? `${created} cobrança(s) recorrente(s) gerada(s).` : 'Nenhuma nova cobrança recorrente para gerar.')
  }

  return <div className="react-module-page finance-page"><div className="react-module-topbar"><div><h1>Financeiro</h1><p>Controle simples dos honorários dos clientes.</p></div><div className="react-module-actions"><span className="sync-indicator">{sync}</span><button type="button" className="primary" onClick={() => setCreating(true)}>+ Nova cobrança avulsa</button></div></div><div className="finance-kpis"><article><small>Recebido</small><strong>{money(totals.Recebido)}</strong></article><article><small>A receber</small><strong>{money(totals.Pendente)}</strong></article><article className="overdue"><small>Em atraso</small><strong>{money(totals.Atrasado)}</strong></article></div><section className="finance-card"><div className="finance-toolbar"><label><span>Competência</span><input type="month" value={competence} onInput={event => setCompetence(event.currentTarget.value)} onChange={event => setCompetence(event.target.value)} /></label><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filtrar por status"><option value="">Todos os status</option>{statuses.map(item => <option key={item}>{item}</option>)}</select><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente ou descrição" /><button type="button" onClick={generateRecurring}>Gerar recorrentes</button></div><div className="finance-table"><div className="finance-row finance-head"><span>Cliente</span><span>Descrição</span><span>Competência</span><span>Vencimento</span><span>Valor</span><span>Status</span><span /></div>{rows.map(charge => { const client = clientsById.get(String(charge.clienteId)); return <article className="finance-row" key={charge.id}><div><b>{client ? clientName(client) : (charge.cliente || 'Cliente')}</b>{client?.status === 'Inativo' ? <em>Inativo</em> : null}</div><span>{charge.descricao}</span><span>{charge.competencia || '—'}</span><span>{formatDate(charge.vencimento)}</span><strong>{money(charge.valor)}</strong><div><select className={`finance-status status-${normalizeText(charge.status)}`} value={charge.status} onChange={event => changeStatus(charge.id, event.target.value)} aria-label={`Status de ${charge.descricao}`}>{statuses.map(item => <option key={item}>{item}</option>)}</select>{charge.recebidoEm ? <small>Recebido em {formatDate(charge.recebidoEm)}</small> : null}</div><button type="button" className="danger" onClick={() => deleteCharge(charge.id)} aria-label={`Excluir cobrança ${charge.descricao}`}>×</button></article>})}{!rows.length ? <p className="finance-empty">Nenhuma cobrança nesta competência.</p> : null}</div></section>{creating ? <ChargeForm clients={activeClients} competence={competence} onClose={() => setCreating(false)} onSave={saveCharge} /> : null}{notice ? <div className="finance-notice" role="status">{notice}</div> : null}</div>
}
