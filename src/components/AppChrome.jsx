import { useEffect, useMemo, useState } from 'react'
import { roleLabel } from '../lib/workspaceSync.js'
import { Button, Icon } from './ui/SaasUI.jsx'

const item = (id, label, icon) => [id, label, icon]
const common = {
  myDay: item('meu-dia', 'Meu Dia', 'dashboard'),
  pending: item('pendencias', 'Pendências', 'obligations'),
  calendar: item('calendario', 'Calendário', 'calendar'),
  clients: item('clientes', 'Clientes', 'clients'),
  tasks: item('tarefas', 'Tarefas', 'tasks'),
  processes: item('processos', 'Processos', 'processes'),
  obligations: item('obrigacoes', 'Obrigações', 'obligations'),
}

export const pageNames = {
  'meu-dia': 'Meu Dia', pendencias: 'Pendências', dashboard: 'Painel Principal', calendario: 'Calendário', clientes: 'Clientes', tarefas: 'Tarefas', processos: 'Processos', obrigacoes: 'Obrigações', honorarios: 'Financeiro', equipe: 'Equipe', 'financeiro-parceiro': 'Financeiro compartilhado', configuracoes: 'Configurações',
}

export function navigationGroupsForAccess(access = {}) {
  const membership = access?.membership || {}
  const role = membership.role || 'admin'
  const permissions = membership.permissions || {}
  if (role === 'partner') return [
    { label: 'Visão geral', items: [common.myDay, common.calendar] },
    { label: 'Operação', items: [common.pending, common.clients, common.tasks, common.processes, common.obligations] },
    { label: 'Parceria', items: [item('financeiro-parceiro', 'Financeiro compartilhado', 'finance')] },
  ]
  if (role === 'collaborator') {
    const operation = [common.pending]
    if (permissions.clients !== false) operation.push(common.clients)
    if (permissions.tasks !== false) operation.push(common.tasks)
    if (permissions.processes !== false) operation.push(common.processes)
    if (permissions.obligations !== false) operation.push(common.obligations)
    const management = []
    if (permissions.finance) management.push(item('honorarios', 'Financeiro', 'finance'))
    return [
      { label: 'Visão geral', items: [common.myDay, common.calendar] },
      { label: 'Operação', items: operation },
      ...(management.length ? [{ label: 'Gestão', items: management }] : []),
    ]
  }
  return [
    { label: 'Visão geral', items: [common.myDay, item('dashboard', 'Painel Principal', 'dashboard'), common.calendar] },
    { label: 'Operação', items: [common.pending, common.clients, common.tasks, common.processes, common.obligations] },
    { label: 'Gestão', items: [item('honorarios', 'Financeiro', 'finance'), item('equipe', 'Equipe', 'clients')] },
  ]
}

function mobileItems(access = {}) {
  const groups = navigationGroupsForAccess(access)
  const all = groups.flatMap(group => group.items)
  const role = access?.membership?.role || 'admin'
  const preferredIds = role === 'partner'
    ? ['meu-dia', 'tarefas', 'clientes', 'calendario']
    : ['meu-dia', 'tarefas', 'clientes', 'calendario']
  const primary = preferredIds.map(id => all.find(row => row[0] === id)).filter(Boolean).slice(0, 4)
  const primaryIds = new Set(primary.map(row => row[0]))
  const more = all.filter(row => !primaryIds.has(row[0]))
  if (role !== 'partner') more.push(item('configuracoes', 'Configurações', 'settings'))
  return { primary, more }
}

export function AppSidebar({ currentView, identity, sync, collapsed, notificationsOpen = false, access = {}, onSwitchWorkspace, onToggle, onNavigate, onSignOut }) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const groups = useMemo(() => navigationGroupsForAccess(access), [access])
  const mobile = useMemo(() => mobileItems(access), [access])
  const mobileMoreActive = mobile.more.some(([id]) => id === currentView)
  const membership = access?.membership || {}
  const displayName = membership.display_name || identity.user
  const displayRole = membership.role ? roleLabel(membership.role) : identity.role
  const go = id => { setMobileMoreOpen(false); onNavigate(id) }

  useEffect(() => { setMobileMoreOpen(false) }, [currentView, notificationsOpen])

  return <>
    <aside className="react-sidebar saas-sidebar app-sidebar-desktop">
      <header className="react-brand saas-brand">
        <span className="react-logo">{identity.initials || 'ED'}</span>
        <div className="saas-brand-copy"><strong>{access?.workspace?.name || identity.office}</strong><small>{identity.system} · V11.1</small></div>
        <Button variant="ghost-inverse" size="sm" icon={collapsed ? 'chevronRight' : 'chevronLeft'} iconOnly className="collapse-button" onClick={onToggle}>{collapsed ? 'Expandir menu' : 'Recolher menu'}</Button>
      </header>

      {access?.workspaces?.length > 1 ? <label className="workspace-switcher"><span>Escritório ativo</span><select value={access.workspace?.id || ''} onChange={event => onSwitchWorkspace?.(event.target.value)}>{access.workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name} · {roleLabel(workspace.role)}</option>)}</select></label> : null}

      <div className="react-nav-stack saas-nav-stack saas-desktop-nav">
        {groups.map(group => <section className="react-nav-group saas-nav-group" key={group.label}>
          <div className="react-nav-title">{group.label}</div>
          <nav aria-label={group.label}>{group.items.map(([id, label, icon]) => <button type="button" className={currentView === id ? 'active' : ''} onClick={() => go(id)} title={label} key={id}><Icon name={icon} size={18} /><span>{label}</span></button>)}</nav>
        </section>)}
      </div>

      <div className="saas-sidebar-bottom">
        {membership.role !== 'partner' ? <nav aria-label="Preferências"><button type="button" className={currentView === 'configuracoes' ? 'active' : ''} onClick={() => go('configuracoes')} title="Configurações"><Icon name="settings" size={18} /><span>Configurações</span></button></nav> : null}
        <footer className="react-profile saas-profile"><span>{String(displayName || 'ME').slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>{displayRole} · {sync}</small></div><Button variant="ghost-inverse" size="sm" icon="logout" iconOnly onClick={onSignOut}>Sair</Button></footer>
      </div>
    </aside>

    <nav className="saas-mobile-nav app-mobile-nav" aria-label="Navegação principal mobile">
      {mobile.primary.map(([id, label, icon]) => <button type="button" className={currentView === id ? 'active' : ''} onClick={() => go(id)} aria-current={currentView === id ? 'page' : undefined} key={id}><span className="saas-mobile-nav-icon"><Icon name={icon} size={19} /></span><span className="saas-mobile-nav-label">{label}</span></button>)}
      <button type="button" className={mobileMoreActive || mobileMoreOpen ? 'active' : ''} onClick={() => setMobileMoreOpen(current => !current)} aria-expanded={mobileMoreOpen}><span className="saas-mobile-nav-icon"><Icon name="more" size={20} /></span><span className="saas-mobile-nav-label">Mais</span></button>
    </nav>

    {mobileMoreOpen ? <>
      <button type="button" className="saas-mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)} aria-label="Fechar menu" />
      <section className="saas-mobile-more-sheet app-mobile-more-panel" aria-label="Mais módulos">
        <header><div><strong>Mais áreas</strong><small>{access?.workspace?.name || 'Gestão do escritório'}</small></div><button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="Fechar"><Icon name="close" size={18} /></button></header>
        <div className="saas-mobile-more-grid">
          {mobile.more.map(([id, label, icon]) => <button type="button" className={currentView === id ? 'active' : ''} onClick={() => go(id)} aria-current={currentView === id ? 'page' : undefined} key={id}><span className="saas-mobile-more-icon"><Icon name={icon} size={19} /></span><div><strong>{label}</strong><small>{id === 'pendencias' ? 'Tudo que exige atenção' : id === 'processos' ? 'Fluxos e protocolos' : id === 'obrigacoes' ? 'Prazos e entregas' : id === 'honorarios' || id === 'financeiro-parceiro' ? 'Honorários e recebimentos' : id === 'equipe' ? 'Usuários e responsabilidades' : id === 'dashboard' ? 'Visão gerencial tradicional' : 'Sistema e preferências'}</small></div></button>)}
        </div>
        <footer><div><span>{String(displayName || 'ME').slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>{displayRole} · {sync}</small></div></div><Button variant="secondary" size="sm" icon="logout" onClick={onSignOut}>Sair</Button></footer>
      </section>
    </> : null}
  </>
}

export function AppTopbar({ currentView, query, onQueryChange, searchResults, onChooseResult, notificationsCount, notificationsOpen, onToggleNotifications, identity, access = {} }) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const closeMobileSearch = () => { setMobileSearchOpen(false); onQueryChange('') }
  const membership = access?.membership || {}
  const displayName = membership.display_name || identity.user
  const displayRole = membership.role ? roleLabel(membership.role) : identity.role

  useEffect(() => { setMobileSearchOpen(false) }, [currentView, notificationsOpen])

  return <header className="saas-topbar">
    <div className="saas-topbar-context"><span>{access?.workspace?.name || 'Meu Escritório Digital'}</span><strong>{pageNames[currentView] || 'Sistema'}</strong></div>
    <div className="saas-mobile-topbar-context"><strong>{pageNames[currentView] || 'Sistema'}</strong><small>{access?.workspace?.name || 'Meu Escritório Digital'}</small></div>

    <div className={`saas-topbar-search-wrap ${mobileSearchOpen ? 'mobile-open' : ''}`}>
      <label className="saas-topbar-search"><Icon name="search" size={17} /><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Buscar clientes, tarefas, processos…" aria-label="Busca global" /></label>
      <button type="button" className="saas-mobile-search-close" onClick={closeMobileSearch} aria-label="Fechar busca"><Icon name="close" size={17} /></button>
      {query.trim() ? <div className="saas-search-results" role="listbox" aria-label="Resultados da busca">{searchResults.length ? searchResults.slice(0, 8).map(item => <button type="button" role="option" key={item.key} onClick={() => { onChooseResult(item); setMobileSearchOpen(false) }}><span className={`saas-search-kind ${item.type}`}>{item.typeLabel}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></button>) : <div className="saas-search-empty">Nenhum resultado encontrado.</div>}</div> : null}
    </div>

    <div className="saas-topbar-actions">
      <button type="button" className={`saas-mobile-search-button ${mobileSearchOpen ? 'active' : ''}`} onClick={() => { setMobileSearchOpen(current => !current); if (notificationsOpen) onToggleNotifications() }} aria-label="Buscar no sistema" aria-expanded={mobileSearchOpen}><Icon name="search" size={18} /></button>
      <button type="button" className={`saas-notification-button ${notificationsCount ? 'has-alerts' : ''}`} onClick={() => { setMobileSearchOpen(false); onToggleNotifications() }} aria-label={`Notificações: ${notificationsCount} alerta(s)`} aria-expanded={notificationsOpen}><Icon name="bell" size={18} />{notificationsCount ? <b>{notificationsCount > 99 ? '99+' : notificationsCount}</b> : null}</button>
      <div className="saas-topbar-profile" title={displayName}><span>{String(displayName || 'ME').slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>{displayRole}</small></div></div>
    </div>
  </header>
}
