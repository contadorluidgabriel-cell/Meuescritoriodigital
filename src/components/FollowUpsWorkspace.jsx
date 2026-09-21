import { useEffect, useMemo, useState } from 'react'
import { today } from '../lib/storage.js'
import './follow-ups.css'

const blank = () => ({ title: '', clientId: '', sourceType: 'manual', sourceId: '', checkDate: today(), protocol: '', consultationUrl: '', description: '', responsibleUserId: '' })
const name = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const dateText = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data'
const eventText = entry => entry.type === 'consultation' ? 'Consulta sem resultado' : entry.type === 'confirmed' ? 'Resultado confirmado' : 'Acompanhamento reaberto'
const titleOf = (type, record) => type === 'process' ? record?.tipo || 'Processo' : record?.titulo || 'Serviço'
const isDone = value => /conclu/i.test(String(value || ''))

function Field({ label, required = false, children, wide = false }) {
  return <label className={`follow-field ${wide ? 'wide' : ''}`}><span>{label}{required ? ' *' : ''}</span>{children}</label>
}

function Form({ initial, office, members, userId, records, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...blank(), ...initial, responsibleUserId: initial?.responsibleUserId || userId }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const linked = draft.sourceType !== 'manual'
  const processes = (office.processes || []).filter(record => isDone(record.status) || String(record.id) === String(draft.sourceId))
  const tasks = (office.tasks || []).filter(record => isDone(record.status) || String(record.id) === String(draft.sourceId))
  const sources = draft.sourceType === 'process' ? processes : tasks
  const linkedItem = linked ? sources.find(record => String(record.id) === String(draft.sourceId)) : null
  const linkedClientId = linkedItem?.clientId || ''
  const patch = (key, value) => setDraft(current => ({ ...current, [key]: value }))

  async function submit(event) {
    event.preventDefault()
    if (!draft.title.trim() || !draft.checkDate) { setError('Preencha o assunto e a próxima data.'); return }
    if (linked && !draft.sourceId) { setError('Selecione o processo ou serviço de origem.'); return }
    if (linked && records.some(row => row.status === 'active' && row.id !== initial?.id && row.sourceType === draft.sourceType && String(row.sourceId) === String(draft.sourceId))) { setError('Este trabalho já possui um acompanhamento ativo.'); return }
    setBusy(true); setError('')
    try {
      await onSave({ ...draft, title: draft.title.trim(), clientId: linked ? linkedClientId : draft.clientId, responsibleUserId: draft.responsibleUserId || userId })
      onClose()
    } catch (cause) { setError(cause?.message || 'Não foi possível salvar.') } finally { setBusy(false) }
  }

  return <div className="follow-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="follow-modal" role="dialog" aria-modal="true" aria-label={initial?.id ? 'Editar acompanhamento' : 'Novo acompanhamento'}>
    <header className="follow-modal-header"><div><span>LEMBRETE DE RESULTADO</span><h2>{initial?.id ? 'Editar acompanhamento' : 'Novo acompanhamento'}</h2><p>Registre apenas o que precisa voltar a conferir.</p></div><button type="button" className="follow-icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}>×</button></header>
    <form onSubmit={submit}><div className="follow-form-grid">
      <Field label="Origem"><select value={draft.sourceType} onChange={event => setDraft(current => ({ ...current, sourceType: event.target.value, sourceId: '', clientId: '', title: '' }))}><option value="manual">Cadastro manual</option><option value="process">Processo concluído</option><option value="task">Serviço / tarefa concluída</option></select></Field>
      {linked ? <Field label="Trabalho concluído" required><select value={draft.sourceId} onChange={event => { const record = sources.find(item => String(item.id) === event.target.value); setDraft(current => ({ ...current, sourceId: event.target.value, clientId: record?.clientId || '', title: current.title || `Verificar resultado: ${titleOf(current.sourceType, record)}` })) }}><option value="">Selecione</option>{sources.map(record => <option key={record.id} value={record.id}>{titleOf(draft.sourceType, record)}</option>)}</select></Field> : <Field label="Cliente (opcional)"><select value={draft.clientId} onChange={event => patch('clientId', event.target.value)}><option value="">Sem cliente vinculado</option>{(office.clients || []).map(client => <option key={client.id} value={client.id}>{name(client)}</option>)}</select></Field>}
      <Field label="Assunto" required wide><input maxLength="240" value={draft.title} onChange={event => patch('title', event.target.value)} placeholder="Ex.: Verificar deferimento da alteração contratual" /></Field>
      <Field label="Próxima conferência" required><input type="date" value={draft.checkDate} onChange={event => patch('checkDate', event.target.value)} /></Field>
      <Field label="Responsável"><select value={draft.responsibleUserId || userId} onChange={event => patch('responsibleUserId', event.target.value)}>{(members.length ? members : [{ id: userId, name: 'Eu' }]).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field>
      <Field label="Protocolo (opcional)"><input maxLength="240" value={draft.protocol} onChange={event => patch('protocol', event.target.value)} placeholder="Número do protocolo" /></Field>
      <Field label="Link de consulta (opcional)"><input type="url" maxLength="1000" value={draft.consultationUrl} onChange={event => patch('consultationUrl', event.target.value)} placeholder="https://..." /></Field>
      <Field label="Descrição (opcional)" wide><textarea rows="3" maxLength="4000" value={draft.description} onChange={event => patch('description', event.target.value)} placeholder="Detalhes que ajudam a lembrar o que conferir" /></Field>
    </div>{error ? <p className="follow-error" role="alert">{error}</p> : null}<footer className="follow-form-actions"><button type="button" className="follow-button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="follow-button primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar acompanhamento'}</button></footer></form>
  </section></div>
}

export function FollowUpsToday({ records = [], office = {}, userId = '', onOpen, onNavigate }) {
  const clients = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), client])), [office.clients])
  const active = records.filter(row => row.status === 'active' && String(row.responsibleUserId) === String(userId)).sort((a, b) => String(a.checkDate).localeCompare(String(b.checkDate)))
  const currentDay = today()
  return <section className="follow-today" aria-label="Acompanhamentos do Meu Dia"><header><div><span>RESULTADOS A CONFERIR</span><h2>Acompanhamentos <b>{active.length}</b></h2></div><button type="button" onClick={() => onNavigate?.('acompanhamentos')}>Ver todos</button></header>
    {active.length ? <div className="follow-today-list">{active.map(row => <button type="button" key={row.id} className={`follow-today-item ${row.checkDate === currentDay ? 'is-today' : ''}`} onClick={() => onOpen?.(row.id)}><span className="follow-today-dot" /><span className="follow-today-copy"><strong>{row.title}</strong><small>{row.clientId ? name(clients.get(String(row.clientId))) : 'Assunto interno'} · {row.checkDate === currentDay ? 'Conferir hoje' : row.checkDate < currentDay ? `Conferência pendente · ${dateText(row.checkDate)}` : `Conferir em ${dateText(row.checkDate)}`}</small></span><span className="follow-chevron">›</span></button>)}</div> : <p className="follow-empty-small">Nenhum resultado aguardando conferência.</p>}
  </section>
}

export default function FollowUpsWorkspace({ office, followUps, userId, manager = false, onOpenClient, onOpenSource, onCreateTask, focusId = '', focusRequest = 0 }) {
  const { records, members, loading, error, act, refresh } = followUps
  const [tab, setTab] = useState('active')
  const [clientFilter, setClientFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [form, setForm] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [nextDate, setNextDate] = useState(today())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const clients = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), client])), [office.clients])
  const people = useMemo(() => new Map(members.map(member => [String(member.id), member.name])), [members])
  const currentDay = today()
  const selected = records.find(row => row.id === selectedId) || null

  useEffect(() => { if (focusRequest && focusId) { setSelectedId(focusId); setTab('active') } }, [focusId, focusRequest])
  useEffect(() => { if (selected) setNextDate(selected.checkDate || today()) }, [selectedId, selected?.checkDate])
  const visible = records.filter(row => row.status === tab && (!clientFilter || row.clientId === clientFilter) && (!ownerFilter || row.responsibleUserId === ownerFilter)).sort((a, b) => String(a.checkDate).localeCompare(String(b.checkDate)))
  const activeCount = records.filter(row => row.status === 'active').length
  const todayCount = records.filter(row => row.status === 'active' && row.checkDate === currentDay).length

  async function run(action, values = {}, success = '') {
    setBusy(true); setNotice('')
    try { await act(action, values); setNotice(success); setNote(''); return true }
    catch (cause) { setNotice(cause?.message || 'Não foi possível atualizar.'); return false }
    finally { setBusy(false) }
  }
  function openEdit(row) { setForm(row ? { ...row } : blank()) }
  async function deleteSelected() {
    if (!selected || !window.confirm(`Excluir definitivamente o acompanhamento “${selected.title}”? Esta ação não pode ser desfeita.`)) return
    if (await run('delete', { id: selected.id }, 'Acompanhamento excluído.')) setSelectedId('')
  }

  return <div className="follow-workspace">
    <header className="follow-hero"><div><span>CONTROLE DE RESULTADOS</span><h1>Acompanhamentos</h1><p>O trabalho terminou. Aqui ficam apenas os resultados que você não quer esquecer de conferir.</p></div><button type="button" className="follow-button primary" onClick={() => openEdit(null)}>+ Novo acompanhamento</button></header>
    <div className="follow-overview"><article><span>Ativos</span><strong>{activeCount}</strong><small>Resultados aguardados</small></article><article><span>Conferir hoje</span><strong>{todayCount}</strong><small>Consultas marcadas para hoje</small></article><article><span>Encerrados</span><strong>{records.filter(row => row.status === 'confirmed').length}</strong><small>Resultados confirmados</small></article></div>
    <section className="follow-panel"><div className="follow-toolbar"><nav aria-label="Situação do acompanhamento"><button type="button" className={tab === 'active' ? 'selected' : ''} onClick={() => { setTab('active'); setSelectedId('') }}>Ativos ({activeCount})</button><button type="button" className={tab === 'confirmed' ? 'selected' : ''} onClick={() => { setTab('confirmed'); setSelectedId('') }}>Histórico</button></nav><div className="follow-filters"><label><span>Cliente</span><select value={clientFilter} onChange={event => setClientFilter(event.target.value)}><option value="">Todos os clientes</option>{(office.clients || []).map(client => <option key={client.id} value={client.id}>{name(client)}</option>)}</select></label>{manager ? <label><span>Responsável</span><select value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)}><option value="">Todos os responsáveis</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label> : null}</div></div>
      {error ? <div className="follow-error" role="alert">{error} <button type="button" onClick={() => refresh()}>Tentar novamente</button></div> : null}
      {notice ? <p className="follow-notice" role="status">{notice}</p> : null}
      {loading && !records.length ? <p className="follow-empty">Carregando acompanhamentos…</p> : visible.length ? <div className="follow-list">{visible.map(row => <button className={`follow-row ${selectedId === row.id ? 'selected' : ''}`} type="button" key={row.id} onClick={() => setSelectedId(row.id)}><span className={`follow-row-marker ${row.checkDate === currentDay && row.status === 'active' ? 'today' : ''}`} /><span className="follow-row-copy"><strong>{row.title}</strong><small>{row.clientId ? name(clients.get(String(row.clientId))) : 'Assunto interno'} · {people.get(String(row.responsibleUserId)) || 'Responsável'}</small></span><span className="follow-row-date"><strong>{dateText(row.checkDate)}</strong><small>{row.status === 'confirmed' ? 'Resultado confirmado' : row.checkDate === currentDay ? 'Conferir hoje' : row.checkDate < currentDay ? 'Conferência pendente' : 'Próxima conferência'}</small></span><span className="follow-chevron">›</span></button>)}</div> : <p className="follow-empty">{tab === 'active' ? 'Nenhum acompanhamento ativo nesta seleção.' : 'Nenhum resultado confirmado nesta seleção.'}</p>}
    </section>
    {selected ? <div className="follow-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setSelectedId('') }}><section className="follow-modal follow-detail" role="dialog" aria-modal="true" aria-label="Detalhes do acompanhamento"><header className="follow-modal-header"><div><span>{selected.status === 'active' ? 'AGUARDANDO RESULTADO' : 'RESULTADO CONFIRMADO'}</span><h2>{selected.title}</h2><p>{selected.clientId ? name(clients.get(String(selected.clientId))) : 'Assunto interno'} · {people.get(String(selected.responsibleUserId)) || 'Responsável'}</p></div><button type="button" className="follow-icon-button" aria-label="Fechar" disabled={busy} onClick={() => setSelectedId('')}>×</button></header>
      <div className="follow-detail-body"><div className="follow-detail-metadata"><div><small>Conferência</small><strong>{dateText(selected.checkDate)}</strong></div><div><small>Protocolo</small><strong>{selected.protocol || 'Não informado'}</strong></div></div>
        {selected.description ? <p className="follow-description">{selected.description}</p> : null}
        <div className="follow-links">{selected.consultationUrl ? <a href={selected.consultationUrl} target="_blank" rel="noopener noreferrer">Abrir consulta ↗</a> : null}{selected.clientId ? <button type="button" onClick={() => onOpenClient?.(selected.clientId)}>Abrir cliente</button> : null}{selected.sourceId ? <button type="button" onClick={() => onOpenSource?.(selected.sourceType, selected.sourceId)}>Abrir trabalho original</button> : null}<button type="button" onClick={() => openEdit(selected)}>Editar dados</button></div>
        {selected.status === 'active' ? <div className="follow-check"><h3>Ainda sem resultado?</h3><p>Registre a consulta e marque quando conferir novamente.</p><label>Próxima conferência<input type="date" value={nextDate} onChange={event => setNextDate(event.target.value)} /></label><label>Observação (opcional)<textarea rows="2" maxLength="1000" value={note} onChange={event => setNote(event.target.value)} placeholder="Ex.: órgão informou que continua em análise" /></label><div className="follow-detail-actions"><button className="follow-button secondary" type="button" disabled={busy || !nextDate} onClick={() => run('defer', { id: selected.id, checkDate: nextDate, note }, 'Consulta registrada. Próxima data atualizada.')}>Ainda sem resultado</button><button className="follow-button primary" type="button" disabled={busy} onClick={() => run('confirm', { id: selected.id }, 'Resultado confirmado. Acompanhamento encerrado.')}>Resultado confirmado</button></div>{onCreateTask ? <button className="follow-link-button" type="button" onClick={() => onCreateTask(selected.clientId, selected.title)}>Surgiu uma exigência? Criar tarefa</button> : null}</div> : <div className="follow-check"><h3>Resultado confirmado</h3><p>Esse acompanhamento está no histórico. O trabalho original continua concluído.</p><label>Data para voltar a conferir<input type="date" value={nextDate} onChange={event => setNextDate(event.target.value)} /></label><button className="follow-button secondary" type="button" disabled={busy || !nextDate} onClick={() => run('reopen', { id: selected.id, checkDate: nextDate }, 'Acompanhamento reaberto.')}>Reabrir acompanhamento</button></div>}
        <section className="follow-history"><h3>Histórico de consultas</h3>{selected.history?.length ? [...selected.history].reverse().map((entry, index) => <article key={`${entry.at}-${index}`}><span className="follow-history-dot" /><div><strong>{eventText(entry)}</strong><small>{new Date(entry.at).toLocaleString('pt-BR')}{entry.nextDate ? ` · próxima: ${dateText(entry.nextDate)}` : ''}</small>{entry.note ? <p>{entry.note}</p> : null}</div></article>) : <p>Nenhuma consulta registrada ainda.</p>}</section>
      </div><footer className="follow-detail-footer"><button type="button" onClick={deleteSelected} disabled={busy}>Excluir acompanhamento</button><button type="button" className="follow-button secondary" onClick={() => setSelectedId('')} disabled={busy}>Fechar</button></footer>
    </section></div> : null}
    {form ? <Form initial={form} office={office} records={records} members={members} userId={userId} onClose={() => setForm(null)} onSave={values => act(form.id ? 'update' : 'create', { ...values, id: form.id })} /> : null}
  </div>
}
