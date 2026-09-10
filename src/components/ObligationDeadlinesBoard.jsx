import { useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import { OBLIGATION_DEADLINE_FILTERS, buildObligationDeadlineView, obligationDeadlineMeta } from '../lib/obligationDeadlines.js'
import '../obligation-deadlines.css'

const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : ''
const clientLabel = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'

export default function ObligationDeadlinesBoard({ office, onOpenObligation, onNavigate, day = today() }) {
  const [scope, setScope] = useState('all')
  const [clientId, setClientId] = useState('')
  const [category, setCategory] = useState('')
  const clients = office?.clients || []
  const obligations = office?.obligations || []
  const clientsById = useMemo(() => new Map(clients.map(client => [String(client.id), client])), [clients])
  const categories = useMemo(() => [...new Set(obligations.map(item => String(item.categoria || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [obligations])
  const clientOptions = useMemo(() => clients
    .filter(client => obligations.some(obligation => (obligation.clientes || []).some(link => String(link.clienteId) === String(client.id))))
    .sort((a, b) => clientLabel(a).localeCompare(clientLabel(b), 'pt-BR')), [clients, obligations])
  const view = useMemo(() => buildObligationDeadlineView(obligations, { day, scope, clientId, category }), [obligations, day, scope, clientId, category])
  const hasContextFilter = Boolean(clientId || category)

  function clearContextFilters() {
    setClientId('')
    setCategory('')
  }

  return <section className="obligation-deadlines-board" aria-label="Prazos das obrigações">
    <header className="obligation-deadlines-header">
      <div>
        <span>Controle operacional</span>
        <h2>Prazos das obrigações</h2>
        <p>Cada cliente é acompanhado pelo seu próprio vencimento oficial. A competência aparece separadamente para não ser confundida com a data limite de entrega ou pagamento.</p>
      </div>
      {onNavigate ? <button type="button" className="obligation-deadline-calendar" onClick={() => onNavigate('calendario')}>Ver calendário</button> : null}
    </header>

    <nav className="obligation-deadline-scopes" aria-label="Filtrar obrigações por vencimento">
      {OBLIGATION_DEADLINE_FILTERS.map(([id, label]) => <button type="button" className={scope === id ? 'active' : ''} onClick={() => setScope(id)} key={id}>
        <span>{label}</span><b>{view.counts[id] || 0}</b>
      </button>)}
    </nav>

    <div className="obligation-deadline-context-filters">
      <label><span>Cliente</span><select value={clientId} onChange={event => setClientId(event.target.value)}><option value="">Todos</option>{clientOptions.map(client => <option value={String(client.id)} key={client.id}>{clientLabel(client)}</option>)}</select></label>
      <label><span>Departamento / categoria</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todos</option>{categories.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
      {hasContextFilter ? <button type="button" className="obligation-deadline-clear" onClick={clearContextFilters}>Limpar filtros</button> : null}
    </div>

    <div className="obligation-deadline-summary"><strong>{view.total}</strong><span>{view.total === 1 ? 'vínculo pendente' : 'vínculos pendentes'}</span></div>

    <div className="obligation-deadline-list">
      {view.items.length ? view.items.map(item => {
        const meta = obligationDeadlineMeta(item, day)
        const client = clientsById.get(String(item.clientId))
        return <article className={`obligation-deadline-card tone-${meta.tone}`} key={item.key}>
          <div className="obligation-deadline-copy">
            <div className="obligation-deadline-tags">
              <span>Obrigação</span>
              {item.status ? <b className={String(item.status).toLowerCase().includes('aguardando') ? 'waiting' : ''}>{item.status}</b> : null}
              {item.categoria ? <b>{item.categoria}</b> : null}
            </div>
            <strong>{item.nome}</strong>
            <small>{clientLabel(client)}{item.competencia ? ` · Competência ${item.competencia}` : ''}{item.tipo ? ` · ${item.tipo}` : ''}</small>
            <div className="obligation-deadline-date-row">
              <span className={`deadline-${meta.tone}`}>{meta.label}</span>
              {meta.due ? <small>Vencimento oficial {dateLabel(meta.due)}</small> : null}
              {item.recibo ? <small>Protocolo/recibo informado</small> : null}
            </div>
          </div>
          <button type="button" className="obligation-deadline-open" onClick={() => onOpenObligation?.(item.obligationId, item.clientId)}>Abrir</button>
        </article>
      }) : <div className="obligation-deadline-empty"><span>✓</span><strong>Nenhuma obrigação neste filtro.</strong><small>Altere o período ou os filtros de cliente e departamento.</small></div>}
    </div>
  </section>
}
