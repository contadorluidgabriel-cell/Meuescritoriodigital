import { useEffect, useMemo, useState } from 'react'
import { isDone } from '../lib/storage.js'
import { createWorkspaceInviteLink } from '../lib/inviteLinks.js'
import {
  inviteWorkspaceMember,
  listWorkspaceMembers,
  loadWorkspaceAudit,
  removeWorkspaceMember,
  roleLabel,
  updateWorkspaceMember,
} from '../lib/workspaceSync.js'
import '../user-access-v2.css'

const INTERNAL_ROLES = new Set(['admin', 'collaborator'])
const clientName = client => client?.razao || client?.nome || client?.fantasia || 'Cliente'
const partnerName = partner => partner?.nome || partner?.razao || partner?.fantasia || 'Parceiro'
const dateTime = value => value ? new Date(value).toLocaleString('pt-BR') : '—'
const inviteEmailFailed = member => member?.status === 'invited' && !member?.user_id
const statusLabel = member => member?.status === 'active' ? 'Ativo' : member?.status === 'disabled' ? 'Desativado' : inviteEmailFailed(member) ? 'Envio falhou' : 'Convite pendente'
const emptyInvite = { email: '', display_name: '', role: 'collaborator', partner_id: '' }
const detailTabs = [
  ['data', 'Dados'],
  ['companies', 'Empresas'],
  ['routines', 'Rotinas'],
  ['responsibilities', 'Responsabilidades'],
  ['history', 'Histórico'],
]
const routineOptions = [
  ['clients', 'Clientes', 'Visualizar cadastro completo das empresas da carteira.'],
  ['manage_clients', 'Alterar clientes', 'Criar e editar cadastros das empresas permitidas.'],
  ['tasks', 'Tarefas', 'Acessar e executar tarefas da carteira.'],
  ['processes', 'Processos', 'Acessar e atualizar processos da carteira.'],
  ['obligations', 'Obrigações', 'Acessar e executar obrigações vinculadas.'],
]
const financeOptions = [
  ['finance_receivables', 'Receber', 'Cobranças, recebimentos e contatos de cobrança.'],
  ['finance_payables', 'Pagar', 'Contas a pagar e fornecedores.'],
  ['finance_cash', 'Caixa', 'Contas, movimentações e fluxo de caixa.'],
  ['finance_reports', 'Relatórios / DRE', 'Indicadores, DRE e fechamentos.'],
]

function normalizedV2Permissions(member = {}) {
  const raw = member.permissions || {}
  return {
    ...raw,
    access_v2: raw.access_v2 === true,
    client_ids: Array.isArray(raw.client_ids) ? raw.client_ids.map(String) : [],
    clients: Boolean(raw.clients),
    tasks: Boolean(raw.tasks),
    processes: Boolean(raw.processes),
    obligations: Boolean(raw.obligations),
    manage_clients: Boolean(raw.clients && raw.manage_clients),
    work_visibility: raw.work_visibility === 'all_allowed' ? 'all_allowed' : 'mine_and_unassigned',
    finance_receivables: Boolean(raw.finance_receivables ?? raw.finance),
    finance_payables: Boolean(raw.finance_payables),
    finance_cash: Boolean(raw.finance_cash),
    finance_reports: Boolean(raw.finance_reports),
  }
}

function permissionSummary(member = {}) {
  if (member.role === 'partner') return 'Acesso definido pela parceria vinculada'
  if (member.permissions?.access_v2 !== true) return 'Permissões legadas'
  const p = normalizedV2Permissions(member)
  const routines = [p.clients, p.tasks, p.processes, p.obligations].filter(Boolean).length
  const finance = [p.finance_receivables, p.finance_payables, p.finance_cash, p.finance_reports].filter(Boolean).length
  return `${p.client_ids.length} empresa(s) · ${routines} rotina(s) · ${finance} acesso(s) financeiro(s)`
}

export default function UserAccessManager({ office, update, access, onRefresh }) {
  const workspaceId = access?.workspace?.id || ''
  const ownerUserId = String(access?.workspace?.owner_user_id || '')
  const [members, setMembers] = useState([])
  const [audit, setAudit] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detailTab, setDetailTab] = useState('data')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState(emptyInvite)
  const [inviteLinks, setInviteLinks] = useState({})
  const [companyQuery, setCompanyQuery] = useState('')

  const clients = useMemo(() => (office.clients || []).slice().sort((a, b) => clientName(a).localeCompare(clientName(b), 'pt-BR')), [office.clients])
  const clientNames = useMemo(() => new Map(clients.map(client => [String(client.id), clientName(client)])), [clients])
  const partners = useMemo(() => (office.partners || []).filter(partner => partner.status !== 'Inativo'), [office.partners])
  const selected = useMemo(() => members.find(member => String(member.id) === String(selectedId)) || members[0] || null, [members, selectedId])
  const ownerSelected = Boolean(selected?.user_id && String(selected.user_id) === ownerUserId)
  const internalSelected = INTERNAL_ROLES.has(String(selected?.role || ''))
  const v2Selected = internalSelected && selected?.permissions?.access_v2 === true && !ownerSelected
  const selectedPermissions = useMemo(() => normalizedV2Permissions(selected || {}), [selected])

  const activeMembers = useMemo(() => members.filter(member => member.status === 'active' && member.user_id), [members])
  const assignments = useMemo(() => {
    const rows = []
    ;(office.tasks || []).forEach(task => {
      if (!isDone(task.status)) rows.push({ kind: 'task', id: String(task.id), clientId: String(task.clientId || ''), title: task.titulo || 'Tarefa', client: task.clientId ? clientNames.get(String(task.clientId)) || 'Cliente' : 'Interna', due: task.prazo || '', responsible: String(task.responsavelUserId || '') })
    })
    ;(office.processes || []).forEach(process => {
      if (!isDone(process.status)) rows.push({ kind: 'process', id: String(process.id), clientId: String(process.clientId || ''), title: process.tipo || process.nome || 'Processo', client: clientNames.get(String(process.clientId)) || 'Cliente', due: process.prazoFinal || process.prazo || '', responsible: String(process.responsavelUserId || '') })
    })
    ;(office.obligations || []).forEach(obligation => (obligation.clientes || []).forEach(link => {
      if (!isDone(link.status) && link.status !== 'Não se aplica') rows.push({ kind: 'obligation', id: String(obligation.id), clientId: String(link.clienteId || ''), title: obligation.nome || 'Obrigação', client: clientNames.get(String(link.clienteId)) || 'Cliente', due: link.vencimento || obligation.vencimento || '', responsible: String(link.responsavelUserId || '') })
    }))
    return rows.sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')))
  }, [clientNames, office.obligations, office.processes, office.tasks])
  const selectedAssignments = useMemo(() => {
    if (!selected?.user_id) return []
    return assignments.filter(item => item.responsible === String(selected.user_id))
  }, [assignments, selected?.user_id])
  const selectedHistory = useMemo(() => {
    if (!selected) return []
    return audit.filter(entry => String(entry.actor_user_id || '') === String(selected.user_id || '') || (entry.entity_type === 'member' && String(entry.entity_id || '') === String(selected.id)))
  }, [audit, selected])
  const visibleClients = useMemo(() => {
    const query = companyQuery.trim().toLowerCase()
    if (!query) return clients
    return clients.filter(client => `${clientName(client)} ${client.documento || client.cnpj || client.cpf || ''}`.toLowerCase().includes(query))
  }, [clients, companyQuery])

  useEffect(() => {
    let active = true
    if (!workspaceId) return undefined
    setLoading(true)
    Promise.all([listWorkspaceMembers(workspaceId), loadWorkspaceAudit(workspaceId)]).then(([team, activity]) => {
      if (!active) return
      const nextMembers = team.members || []
      setMembers(nextMembers)
      setAudit(activity.audit || [])
      setSelectedId(current => current && nextMembers.some(member => String(member.id) === String(current)) ? current : String(nextMembers[0]?.id || ''))
    }).catch(error => { if (active) setMessage(error?.message || 'Não foi possível carregar os usuários.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [workspaceId])

  async function refreshTeam(preferredId = '') {
    const [team, activity] = await Promise.all([listWorkspaceMembers(workspaceId), loadWorkspaceAudit(workspaceId)])
    const nextMembers = team.members || []
    setMembers(nextMembers)
    setAudit(activity.audit || [])
    const target = preferredId || selectedId
    if (target && nextMembers.some(member => String(member.id) === String(target))) setSelectedId(String(target))
    else setSelectedId(String(nextMembers[0]?.id || ''))
  }

  async function mutateMember(member, values, successMessage = 'Acesso atualizado.') {
    if (!member) return
    setBusy(true); setMessage('')
    try {
      await updateWorkspaceMember(workspaceId, { member_id: member.id, ...values })
      await refreshTeam(member.id)
      setMessage(successMessage)
    } catch (error) {
      setMessage(error?.message || 'Não foi possível atualizar o acesso.')
    } finally { setBusy(false) }
  }

  async function submitInvite(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const result = await inviteWorkspaceMember(workspaceId, {
        email: invite.email,
        display_name: invite.display_name,
        role: invite.role,
        partner_id: invite.role === 'partner' ? invite.partner_id : '',
      })
      setInvite(emptyInvite)
      setShowInvite(false)
      await refreshTeam(result.member?.id || '')
      setDetailTab('data')
      setMessage(result.email_sent
        ? 'Usuário convidado. Configure as empresas e rotinas antes de liberar a operação.'
        : `Usuário criado, mas o e-mail não foi enviado. ${result.note || 'Use o link de acesso para compartilhar o convite.'}`)
    } catch (error) {
      setMessage(error?.message || 'Não foi possível criar o usuário.')
    } finally { setBusy(false) }
  }

  async function generateInviteLink(member, replace = false) {
    if (!member || member.status !== 'invited') return
    if (replace && !window.confirm(`Cancelar links anteriores de ${member.display_name || member.email} e gerar um novo?`)) return
    setBusy(true); setMessage('')
    try {
      const result = await createWorkspaceInviteLink(workspaceId, member.id, { replace })
      setInviteLinks(current => ({ ...current, [String(member.id)]: result }))
      try { await navigator.clipboard.writeText(result.link) } catch {}
      setMessage(replace ? 'Links anteriores cancelados. Novo link gerado.' : 'Link de acesso gerado e copiado quando permitido pelo navegador.')
    } catch (error) {
      setMessage(error?.message || 'Não foi possível gerar o link de acesso.')
    } finally { setBusy(false) }
  }

  async function copyInviteLink(member) {
    const item = inviteLinks[String(member.id)]
    if (!item?.link) return generateInviteLink(member)
    try { await navigator.clipboard.writeText(item.link); setMessage('Link copiado.') }
    catch { setMessage('Não foi possível copiar automaticamente. Selecione o link manualmente.') }
  }

  async function removeMember(member) {
    if (!member || ownerSelected || !window.confirm(`Remover o acesso de ${member.display_name || member.email}?`)) return
    setBusy(true); setMessage('')
    try {
      await removeWorkspaceMember(workspaceId, member.id)
      await refreshTeam('')
      setMessage('Acesso removido.')
    } catch (error) { setMessage(error?.message || 'Não foi possível remover o acesso.') }
    finally { setBusy(false) }
  }

  async function activateV2(member) {
    if (!member || !INTERNAL_ROLES.has(member.role)) return
    if (!window.confirm('Ativar o controle detalhado V2 para este usuário? O acesso operacional começará fechado e você configurará empresas e rotinas em seguida.')) return
    await mutateMember(member, { permissions: { access_v2: true } }, 'Controle detalhado V2 ativado. Configure Empresas e Rotinas.')
    setDetailTab('companies')
  }

  async function savePermissions(next, successMessage = 'Permissões atualizadas.') {
    if (!selected || !v2Selected) return
    const normalized = {
      ...selectedPermissions,
      ...next,
      access_v2: true,
    }
    if (!normalized.clients) normalized.manage_clients = false
    normalized.finance = Boolean(normalized.finance_receivables)
    normalized.finance_edit = Boolean(normalized.finance_receivables || normalized.finance_payables || normalized.finance_cash)
    await mutateMember(selected, { permissions: normalized }, successMessage)
  }

  async function toggleCompany(clientId) {
    const current = new Set(selectedPermissions.client_ids)
    if (current.has(String(clientId))) current.delete(String(clientId)); else current.add(String(clientId))
    await savePermissions({ client_ids: [...current] }, 'Carteira de empresas atualizada.')
  }

  function assign(kind, id, clientId, userId) {
    update(draft => {
      if (kind === 'task') {
        const row = (draft.tasks || []).find(item => String(item.id) === String(id))
        if (row) { row.responsavelUserId = userId; row.updatedAt = new Date().toISOString() }
      }
      if (kind === 'process') {
        const row = (draft.processes || []).find(item => String(item.id) === String(id))
        if (row) { row.responsavelUserId = userId; row.updatedAt = new Date().toISOString() }
      }
      if (kind === 'obligation') {
        const obligation = (draft.obligations || []).find(item => String(item.id) === String(id))
        const link = obligation?.clientes?.find(item => String(item.clienteId) === String(clientId))
        if (link) { link.responsavelUserId = userId; link.updatedAt = new Date().toISOString() }
      }
    })
  }

  if (loading) return <div className="user-access-shell"><div className="user-access-loading">Carregando usuários…</div></div>

  return <div className="user-access-shell">
    <header className="user-access-hero">
      <div><span>Gestão de acesso</span><h1>Usuários</h1><p>Defina quem entra, quais empresas pode acessar, quais rotinas executa e quais dados financeiros enxerga.</p></div>
      <div className="user-access-hero-actions"><button type="button" onClick={() => onRefresh?.()}>Atualizar dados</button><button type="button" className="primary" onClick={() => setShowInvite(current => !current)}>+ Novo usuário</button></div>
    </header>

    {message ? <div className="user-access-message">{message}</div> : null}

    {showInvite ? <form className="user-access-invite" onSubmit={submitInvite}>
      <header><div><span>Novo acesso</span><h2>Convidar usuário</h2></div><button type="button" onClick={() => setShowInvite(false)}>Fechar</button></header>
      <div className="user-access-form-grid">
        <label>Nome<input value={invite.display_name} onChange={event => setInvite(current => ({ ...current, display_name: event.target.value }))} /></label>
        <label>E-mail<input type="email" required value={invite.email} onChange={event => setInvite(current => ({ ...current, email: event.target.value }))} /></label>
        <label>Perfil<select value={invite.role} onChange={event => setInvite(current => ({ ...current, role: event.target.value, partner_id: '' }))}><option value="collaborator">Colaborador</option><option value="admin">Administrador</option><option value="partner">Parceiro</option></select></label>
        {invite.role === 'partner' ? <label>Parceiro vinculado<select required value={invite.partner_id} onChange={event => setInvite(current => ({ ...current, partner_id: event.target.value }))}><option value="">Selecione…</option>{partners.map(partner => <option key={partner.id} value={partner.id}>{partnerName(partner)}</option>)}</select></label> : <div className="user-access-safe-note"><strong>Acesso inicial fechado</strong><span>O usuário será criado sem empresas e sem rotinas operacionais. Depois do convite, configure o acesso nesta tela.</span></div>}
      </div>
      <button className="primary" disabled={busy}>{busy ? 'Aguarde…' : 'Criar e convidar'}</button>
    </form> : null}

    <div className="user-access-layout">
      <aside className="user-access-list-panel">
        <header><div><span>Acessos</span><h2>{members.length} usuário(s)</h2></div></header>
        <div className="user-access-list">{members.map(member => {
          const active = String(member.id) === String(selected?.id || '')
          const owner = Boolean(member.user_id && String(member.user_id) === ownerUserId)
          return <button type="button" className={active ? 'active' : ''} key={member.id} onClick={() => { setSelectedId(String(member.id)); setDetailTab('data') }}>
            <span className="user-access-avatar">{String(member.display_name || member.email || '?').slice(0, 2).toUpperCase()}</span>
            <span className="user-access-list-copy"><strong>{member.display_name || member.email}</strong><small>{member.email}</small><span><b>{owner ? 'Proprietário' : roleLabel(member.role)}</b><i className={`status-${member.status}`}>{statusLabel(member)}</i></span><em>{permissionSummary(member)}</em></span>
          </button>
        })}</div>
      </aside>

      <main className="user-access-detail">
        {!selected ? <div className="user-access-empty">Nenhum usuário cadastrado.</div> : <>
          <header className="user-access-detail-header">
            <div><span>{ownerSelected ? 'Proprietário' : roleLabel(selected.role)}</span><h2>{selected.display_name || selected.email}</h2><p>{selected.email} · {statusLabel(selected)}</p></div>
            {!ownerSelected ? <div className="user-access-detail-actions"><button type="button" disabled={busy} onClick={() => mutateMember(selected, { status: selected.status === 'disabled' ? 'active' : 'disabled' }, selected.status === 'disabled' ? 'Acesso reativado.' : 'Acesso desativado.')}>{selected.status === 'disabled' ? 'Reativar' : 'Desativar'}</button><button type="button" className="danger" disabled={busy} onClick={() => removeMember(selected)}>Remover</button></div> : null}
          </header>

          <nav className="user-access-tabs">{detailTabs.map(([id, label]) => <button type="button" key={id} className={detailTab === id ? 'active' : ''} onClick={() => setDetailTab(id)}>{label}</button>)}</nav>

          {detailTab === 'data' ? <section className="user-access-card">
            <header><div><span>Identidade</span><h3>Dados do usuário</h3></div></header>
            <div className="user-access-form-grid">
              <label>Nome<input value={selected.display_name || ''} disabled={ownerSelected || busy} onChange={() => {}} onBlur={event => { if (event.target.value !== selected.display_name) mutateMember(selected, { display_name: event.target.value }, 'Nome atualizado.') }} readOnly={ownerSelected} /></label>
              <label>E-mail<input value={selected.email || ''} readOnly /></label>
              <label>Perfil<select value={selected.role} disabled={ownerSelected || selected.role === 'partner' || busy} onChange={event => mutateMember(selected, { role: event.target.value }, 'Perfil atualizado.')}><option value="collaborator">Colaborador</option><option value="admin">Administrador</option>{selected.role === 'partner' ? <option value="partner">Parceiro</option> : null}</select></label>
              <label>Status<input value={statusLabel(selected)} readOnly /></label>
            </div>
            {selected.role === 'partner' ? <div className="user-access-safe-note"><strong>Parceiro</strong><span>O escopo continua sendo definido pela parceria e pelas responsabilidades compartilhadas do escritório.</span></div> : ownerSelected ? <div className="user-access-safe-note success"><strong>Acesso total</strong><span>O proprietário do workspace mantém acesso integral e não pode ser rebaixado ou removido.</span></div> : v2Selected ? <div className="user-access-safe-note success"><strong>Permissões V2 ativas</strong><span>Carteira, rotinas e visibilidade são aplicadas na interface e também no backend.</span></div> : <div className="user-access-legacy"><div><strong>Este usuário ainda usa o modelo legado.</strong><span>Nenhuma migração foi feita automaticamente. Ative o controle detalhado somente quando estiver pronto para configurar o acesso.</span></div><button type="button" disabled={busy} onClick={() => activateV2(selected)}>Ativar Permissões V2</button></div>}

            {selected.status === 'invited' ? <div className="user-access-invite-link-card"><strong>Convite pendente</strong><p>Você pode gerar um link de uso único e enviar pelo WhatsApp.</p>{inviteLinks[String(selected.id)] ? <div><input readOnly value={inviteLinks[String(selected.id)].link} /><button type="button" disabled={busy} onClick={() => copyInviteLink(selected)}>Copiar</button></div> : null}<div className="user-access-inline-actions"><button type="button" disabled={busy} onClick={() => generateInviteLink(selected, false)}>{inviteLinks[String(selected.id)] ? 'Gerar outro link' : 'Gerar link de acesso'}</button><button type="button" disabled={busy} onClick={() => generateInviteLink(selected, true)}>Substituir links</button></div></div> : null}
          </section> : null}

          {detailTab === 'companies' ? <section className="user-access-card">
            <header><div><span>Carteira</span><h3>Empresas permitidas</h3><p>O usuário só recebe dados das empresas marcadas aqui.</p></div>{v2Selected ? <b>{selectedPermissions.client_ids.length}/{clients.length}</b> : null}</header>
            {!internalSelected || ownerSelected ? <div className="user-access-empty">{ownerSelected ? 'O proprietário acessa todas as empresas.' : 'Parceiros usam a carteira definida pela parceria.'}</div> : !v2Selected ? <div className="user-access-empty">Ative Permissões V2 na aba Dados para configurar a carteira.</div> : <>
              <div className="user-access-company-toolbar"><input value={companyQuery} onChange={event => setCompanyQuery(event.target.value)} placeholder="Buscar empresa…" /><div><button type="button" disabled={busy} onClick={() => savePermissions({ client_ids: clients.map(client => String(client.id)) }, 'Todas as empresas foram liberadas.')}>Selecionar todas</button><button type="button" disabled={busy} onClick={() => savePermissions({ client_ids: [] }, 'Carteira zerada.')}>Nenhuma</button></div></div>
              <div className="user-access-company-list">{visibleClients.map(client => { const id = String(client.id); const checked = selectedPermissions.client_ids.includes(id); return <label key={id} className={checked ? 'checked' : ''}><input type="checkbox" disabled={busy} checked={checked} onChange={() => toggleCompany(id)} /><span><strong>{clientName(client)}</strong><small>{client.documento || client.cnpj || client.cpf || 'Sem documento'}</small></span></label> })}</div>
            </>}
          </section> : null}

          {detailTab === 'routines' ? <section className="user-access-card">
            <header><div><span>Escopo funcional</span><h3>Rotinas e financeiro</h3><p>Controle quais módulos e dados o usuário pode utilizar.</p></div></header>
            {!internalSelected || ownerSelected ? <div className="user-access-empty">{ownerSelected ? 'O proprietário tem todas as rotinas.' : 'O acesso do parceiro segue as regras da parceria.'}</div> : !v2Selected ? <div className="user-access-empty">Ative Permissões V2 na aba Dados para configurar as rotinas.</div> : <div className="user-access-routine-grid">
              <div className="user-access-routine-section"><h4>Operação</h4>{routineOptions.map(([key, label, description]) => <label key={key}><input type="checkbox" disabled={busy || (key === 'manage_clients' && !selectedPermissions.clients)} checked={Boolean(selectedPermissions[key])} onChange={event => savePermissions({ [key]: event.target.checked }, `${label} atualizado.`)} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>
              <div className="user-access-routine-section"><h4>Financeiro</h4>{financeOptions.map(([key, label, description]) => <label key={key}><input type="checkbox" disabled={busy} checked={Boolean(selectedPermissions[key])} onChange={event => savePermissions({ [key]: event.target.checked }, `${label} atualizado.`)} /><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>
            </div>}
          </section> : null}

          {detailTab === 'responsibilities' ? <section className="user-access-card">
            <header><div><span>Distribuição</span><h3>Responsabilidades</h3><p>Defina a visibilidade operacional e acompanhe os itens atribuídos ao usuário.</p></div><b>{selectedAssignments.length}</b></header>
            {v2Selected ? <div className="user-access-visibility"><label className={selectedPermissions.work_visibility === 'mine_and_unassigned' ? 'active' : ''}><input type="radio" name="work_visibility" checked={selectedPermissions.work_visibility === 'mine_and_unassigned'} onChange={() => savePermissions({ work_visibility: 'mine_and_unassigned' }, 'Visibilidade atualizada.')} /><span><strong>Meus + não atribuídos</strong><small>Mostra trabalhos atribuídos ao usuário e itens ainda sem responsável.</small></span></label><label className={selectedPermissions.work_visibility === 'all_allowed' ? 'active' : ''}><input type="radio" name="work_visibility" checked={selectedPermissions.work_visibility === 'all_allowed'} onChange={() => savePermissions({ work_visibility: 'all_allowed' }, 'Visibilidade atualizada.')} /><span><strong>Todos da carteira</strong><small>Mostra todos os trabalhos das empresas permitidas.</small></span></label></div> : null}
            {!selected?.user_id ? <div className="user-access-empty">O usuário ainda não concluiu o acesso. As atribuições ficam disponíveis após vincular a conta.</div> : <div className="user-access-assignment-list">{selectedAssignments.length ? selectedAssignments.map(item => <article key={`${item.kind}-${item.id}-${item.clientId}`}><div><small>{item.kind === 'task' ? 'Tarefa' : item.kind === 'process' ? 'Processo' : 'Obrigação'}</small><strong>{item.title}</strong><span>{item.client} · {item.due ? new Date(`${item.due}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem prazo'}</span></div><select value={item.responsible} onChange={event => assign(item.kind, item.id, item.clientId, event.target.value)}><option value="">Não atribuído</option>{activeMembers.map(member => <option key={member.id} value={member.user_id}>{member.display_name || member.email}</option>)}</select></article>) : <div className="user-access-empty">Nenhum trabalho atribuído diretamente a este usuário.</div>}</div>}
          </section> : null}

          {detailTab === 'history' ? <section className="user-access-card">
            <header><div><span>Rastreabilidade</span><h3>Histórico do usuário</h3><p>Alterações do acesso e atividades registradas no workspace.</p></div><button type="button" onClick={() => refreshTeam(selected.id)}>Atualizar</button></header>
            <div className="user-access-history">{selectedHistory.length ? selectedHistory.map(entry => <article key={entry.id}><div><strong>{entry.summary || entry.action}</strong><small>{entry.actor_name || 'Usuário'} · {roleLabel(entry.actor_role)}</small></div><span>{dateTime(entry.created_at)}</span></article>) : <div className="user-access-empty">Nenhum evento registrado para este usuário.</div>}</div>
          </section> : null}
        </>}
      </main>
    </div>
  </div>
}
