import { useEffect, useMemo, useState } from 'react'
import { isDone } from '../lib/storage.js'
import { inviteWorkspaceMember, listWorkspaceMembers, loadWorkspaceAudit, removeWorkspaceMember, roleLabel, updateWorkspaceMember } from '../lib/workspaceSync.js'

const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const partnerName = partner => partner?.nome || partner?.razao || partner?.fantasia || 'Parceiro'
const statusLabel = status => status === 'active' ? 'Ativo' : status === 'disabled' ? 'Desativado' : 'Convite pendente'
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const financePermissions = [
  ['finance_receivables', 'Receber', 'Cobranças, recebimentos e régua de cobrança'],
  ['finance_payables', 'Pagar', 'Despesas, fornecedores e pagamentos'],
  ['finance_cash', 'Caixa e movimentações', 'Contas, transferências e fluxo de caixa'],
  ['finance_reports', 'Relatórios / DRE', 'Indicadores, DRE e fechamentos em leitura'],
]
const defaultInvite = { email: '', display_name: '', role: 'collaborator', partner_id: '', manage_clients: false, finance_receivables: false, finance_payables: false, finance_cash: false, finance_reports: false }

function normalizedPermissions(value = {}) {
  const receivables = Boolean(value.finance_receivables ?? value.finance)
  return { ...value, finance_receivables: receivables, finance_payables: Boolean(value.finance_payables), finance_cash: Boolean(value.finance_cash), finance_reports: Boolean(value.finance_reports) }
}
function withFinanceDependency(current, key, checked) {
  const next = { ...current, [key]: checked }
  if (checked && (key === 'finance_cash' || key === 'finance_reports')) {
    next.finance_receivables = true
    next.finance_payables = true
  }
  return next
}

export default function TeamManagement({ office, update, access, onRefresh }) {
  const workspaceId = access?.workspace?.id || ''
  const [tab, setTab] = useState('members')
  const [members, setMembers] = useState([])
  const [audit, setAudit] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [invite, setInvite] = useState(defaultInvite)
  const clients = useMemo(() => new Map((office.clients || []).map(client => [String(client.id), clientName(client)])), [office.clients])
  const partners = useMemo(() => (office.partners || []).filter(partner => partner.status !== 'Inativo'), [office.partners])
  const activeMembers = useMemo(() => members.filter(member => member.status === 'active'), [members])

  useEffect(() => {
    let active = true
    if (!workspaceId) return undefined
    setLoading(true)
    Promise.all([listWorkspaceMembers(workspaceId), loadWorkspaceAudit(workspaceId)]).then(([team, activity]) => {
      if (!active) return
      setMembers(team.members || [])
      setAudit(activity.audit || [])
    }).catch(error => { if (active) setMessage(error?.message || 'Não foi possível carregar a equipe.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workspaceId])

  async function refreshTeam() {
    const [team, activity] = await Promise.all([listWorkspaceMembers(workspaceId), loadWorkspaceAudit(workspaceId)])
    setMembers(team.members || []); setAudit(activity.audit || [])
  }
  function collaboratorPermissions(source = invite) {
    return { clients: true, tasks: true, processes: true, obligations: true, manage_clients: Boolean(source.manage_clients), delete_records: false, finance_receivables: Boolean(source.finance_receivables), finance_payables: Boolean(source.finance_payables), finance_cash: Boolean(source.finance_cash), finance_reports: Boolean(source.finance_reports), finance: Boolean(source.finance_receivables), finance_edit: Boolean(source.finance_receivables || source.finance_payables || source.finance_cash) }
  }
  async function submitInvite(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const result = await inviteWorkspaceMember(workspaceId, { email: invite.email, display_name: invite.display_name, role: invite.role, partner_id: invite.role === 'partner' ? invite.partner_id : '', permissions: invite.role === 'collaborator' ? collaboratorPermissions(invite) : undefined })
      setInvite(defaultInvite)
      setMessage(result.email_sent ? 'Convite enviado por e-mail.' : `Acesso cadastrado. ${result.note || 'O usuário pode entrar com este e-mail.'}`)
      await refreshTeam()
    } catch (error) { setMessage(error?.message || 'Não foi possível enviar o convite.') } finally { setBusy(false) }
  }
  async function toggleMember(member) {
    setBusy(true); setMessage('')
    try { await updateWorkspaceMember(workspaceId, { member_id: member.id, status: member.status === 'disabled' ? 'active' : 'disabled' }); await refreshTeam(); setMessage(member.status === 'disabled' ? 'Acesso reativado.' : 'Acesso desativado.') }
    catch (error) { setMessage(error?.message || 'Não foi possível alterar o acesso.') } finally { setBusy(false) }
  }
  async function removeMember(member) {
    if (!window.confirm(`Remover o acesso de ${member.display_name || member.email}?`)) return
    setBusy(true); setMessage('')
    try { await removeWorkspaceMember(workspaceId, member.id); await refreshTeam(); setMessage('Acesso removido.') }
    catch (error) { setMessage(error?.message || 'Não foi possível remover o acesso.') } finally { setBusy(false) }
  }
  async function changePermission(member, key, checked) {
    const current = normalizedPermissions(member.permissions || {})
    let next = withFinanceDependency(current, key, checked)
    if (key === 'manage_clients') next = { ...current, manage_clients: checked }
    next.finance = Boolean(next.finance_receivables)
    next.finance_edit = Boolean(next.finance_receivables || next.finance_payables || next.finance_cash)
    setBusy(true); setMessage('')
    try { await updateWorkspaceMember(workspaceId, { member_id: member.id, permissions: next }); await refreshTeam(); setMessage('Permissões atualizadas.') }
    catch (error) { setMessage(error?.message || 'Não foi possível atualizar as permissões.') } finally { setBusy(false) }
  }
  function assign(kind, id, clientId, userId) {
    update(draft => {
      if (kind === 'task') { const row = (draft.tasks || []).find(item => String(item.id) === String(id)); if (row) { row.responsavelUserId = userId; row.updatedAt = new Date().toISOString() } }
      if (kind === 'process') { const row = (draft.processes || []).find(item => String(item.id) === String(id)); if (row) { row.responsavelUserId = userId; row.updatedAt = new Date().toISOString() } }
      if (kind === 'obligation') { const obligation = (draft.obligations || []).find(item => String(item.id) === String(id)); const link = obligation?.clientes?.find(item => String(item.clienteId) === String(clientId)); if (link) { link.responsavelUserId = userId; link.updatedAt = new Date().toISOString() } }
    })
  }
  const assignments = useMemo(() => {
    const rows = []
    ;(office.tasks || []).forEach(task => { if (!isDone(task.status)) rows.push({ kind: 'task', id: String(task.id), clientId: String(task.clientId || ''), title: task.titulo || 'Tarefa', client: task.clientId ? clients.get(String(task.clientId)) || 'Cliente' : 'Interna', due: task.prazo || '', responsible: String(task.responsavelUserId || '') }) })
    ;(office.processes || []).forEach(process => { if (!isDone(process.status)) rows.push({ kind: 'process', id: String(process.id), clientId: String(process.clientId || ''), title: process.tipo || 'Processo', client: clients.get(String(process.clientId)) || 'Cliente', due: process.prazoFinal || '', responsible: String(process.responsavelUserId || '') }) })
    ;(office.obligations || []).forEach(obligation => (obligation.clientes || []).forEach(link => { if (!isDone(link.status) && link.status !== 'Não se aplica') rows.push({ kind: 'obligation', id: String(obligation.id), clientId: String(link.clienteId || ''), title: obligation.nome || 'Obrigação', client: clients.get(String(link.clienteId)) || 'Cliente', due: link.vencimento || '', responsible: String(link.responsavelUserId || '') }) }))
    return rows.sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')))
  }, [clients, office.obligations, office.processes, office.tasks])

  if (loading) return <div className="team-shell"><div className="team-loading">Carregando equipe…</div></div>
  return <div className="team-shell">
    <header className="team-hero"><div><span>Equipe do escritório</span><h1>{access.workspace?.name || 'Meu Escritório'}</h1><p>Usuários, responsabilidades, permissões financeiras e auditoria.</p></div><button type="button" onClick={() => onRefresh?.()}>Atualizar dados</button></header>
    {message ? <div className="team-message">{message}</div> : null}
    <nav className="team-tabs"><button type="button" className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>Usuários</button><button type="button" className={tab === 'assignments' ? 'active' : ''} onClick={() => setTab('assignments')}>Responsáveis</button><button type="button" className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Auditoria</button></nav>
    {tab === 'members' ? <div className="team-layout">
      <section className="team-panel"><header><div><span>Acessos</span><h2>Membros do escritório</h2></div><b>{members.length}</b></header><div className="team-member-list">{members.map(member => {
        const linkedPartner = member.partner_id ? partners.find(partner => String(partner.id) === String(member.partner_id)) : null
        const owner = String(member.user_id || '') === String(access.workspace?.owner_user_id || '')
        const perms = normalizedPermissions(member.permissions || {})
        return <article className="team-member" key={member.id}><div className="team-avatar">{String(member.display_name || member.email || '?').slice(0, 2).toUpperCase()}</div><div className="team-member-copy"><strong>{member.display_name || member.email}</strong><small>{member.email}</small><div><span className={`role-${member.role}`}>{roleLabel(member.role)}</span><span className={`status-${member.status}`}>{statusLabel(member.status)}</span>{linkedPartner ? <span>Vinculado: {partnerName(linkedPartner)}</span> : null}</div>{member.role === 'collaborator' ? <div className="team-permissions member-permissions"><strong>Permissões</strong>{financePermissions.map(([key, label]) => <label key={key}><input type="checkbox" disabled={busy} checked={Boolean(perms[key])} onChange={event => changePermission(member, key, event.target.checked)} /> {label}</label>)}<label><input type="checkbox" disabled={busy} checked={Boolean(perms.manage_clients)} onChange={event => changePermission(member, 'manage_clients', event.target.checked)} /> Alterar clientes</label></div> : null}</div><div className="team-member-actions">{owner ? <span>Proprietário</span> : <><button type="button" disabled={busy} onClick={() => toggleMember(member)}>{member.status === 'disabled' ? 'Reativar' : 'Desativar'}</button><button type="button" className="danger" disabled={busy} onClick={() => removeMember(member)}>Remover</button></>}</div></article>
      })}</div></section>
      <form className="team-panel team-invite" onSubmit={submitInvite}><header><div><span>Novo acesso</span><h2>Convidar usuário</h2></div></header><label>Nome<input value={invite.display_name} onChange={event => setInvite(current => ({ ...current, display_name: event.target.value }))} /></label><label>E-mail<input type="email" required value={invite.email} onChange={event => setInvite(current => ({ ...current, email: event.target.value }))} /></label><label>Perfil<select value={invite.role} onChange={event => setInvite(current => ({ ...current, role: event.target.value, partner_id: '' }))}><option value="collaborator">Colaborador</option><option value="partner">Parceiro</option></select></label>{invite.role === 'partner' ? <label>Parceiro cadastrado<select required value={invite.partner_id} onChange={event => setInvite(current => ({ ...current, partner_id: event.target.value }))}><option value="">Selecione…</option>{partners.map(partner => <option key={partner.id} value={partner.id}>{partnerName(partner)}</option>)}</select><small>O login receberá apenas os clientes, trabalhos e financeiro compartilhado desta parceria.</small></label> : <div className="team-permissions"><strong>Permissões do colaborador</strong>{financePermissions.map(([key, label, description]) => <label key={key}><input type="checkbox" checked={Boolean(invite[key])} onChange={event => setInvite(current => withFinanceDependency(current, key, event.target.checked))} /> <span>{label}<small>{description}</small></span></label>)}<label><input type="checkbox" checked={invite.manage_clients} onChange={event => setInvite(current => ({ ...current, manage_clients: event.target.checked }))} /> Pode alterar cadastro de clientes</label><small>Caixa e Relatórios habilitam Receber e Pagar automaticamente para manter os cálculos completos.</small></div>}<button className="primary" disabled={busy}>{busy ? 'Aguarde…' : 'Enviar convite'}</button></form>
    </div> : null}
    {tab === 'assignments' ? <section className="team-panel"><header><div><span>Distribuição de trabalho</span><h2>Responsáveis</h2></div><b>{assignments.length}</b></header><div className="team-assignment-table"><div className="team-assignment-head"><span>Item</span><span>Cliente</span><span>Prazo</span><span>Responsável</span></div>{assignments.map(item => <div className="team-assignment-row" key={`${item.kind}-${item.id}-${item.clientId}`}><div><small>{item.kind === 'task' ? 'Tarefa' : item.kind === 'process' ? 'Processo' : 'Obrigação'}</small><strong>{item.title}</strong></div><span>{item.client}</span><span>{item.due ? new Date(`${item.due}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'}</span><select value={item.responsible} onChange={event => assign(item.kind, item.id, item.clientId, event.target.value)}><option value="">Não atribuído</option>{activeMembers.map(member => <option key={member.id} value={member.user_id || ''} disabled={!member.user_id}>{member.display_name || member.email} · {roleLabel(member.role)}</option>)}</select></div>)}</div></section> : null}
    {tab === 'audit' ? <section className="team-panel"><header><div><span>Rastreabilidade</span><h2>Auditoria</h2><p>Alterações no workspace registram autor, tipo e horário.</p></div><button type="button" onClick={refreshTeam}>Atualizar</button></header><div className="team-audit-list">{audit.length ? audit.map(entry => <article key={entry.id}><div><strong>{entry.summary || entry.action}</strong><small>{entry.actor_name || 'Usuário'} · {roleLabel(entry.actor_role)}</small></div><span>{dateTime(entry.created_at)}</span></article>) : <p>Nenhuma alteração registrada ainda.</p>}</div></section> : null}
  </div>
}
