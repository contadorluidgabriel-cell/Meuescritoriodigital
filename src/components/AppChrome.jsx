import { Button, Icon } from './ui/SaasUI.jsx'

export const navigationGroups = [
  { label: 'Visão geral', items: [['dashboard', 'Painel Principal', 'dashboard'], ['calendario', 'Calendário', 'calendar']] },
  { label: 'Operação', items: [['clientes', 'Clientes', 'clients'], ['tarefas', 'Tarefas', 'tasks'], ['processos', 'Processos', 'processes'], ['obrigacoes', 'Obrigações', 'obligations']] },
  { label: 'Gestão', items: [['honorarios', 'Financeiro', 'finance']] },
]

export const pageNames = Object.fromEntries(navigationGroups.flatMap(group => group.items.map(([id, label]) => [id, label])).concat([['configuracoes', 'Configurações']]))

export function AppSidebar({ currentView, identity, sync, collapsed, onToggle, onNavigate, onSignOut }) {
  return <aside className="react-sidebar saas-sidebar">
    <header className="react-brand saas-brand">
      <span className="react-logo">{identity.initials || 'ED'}</span>
      <div className="saas-brand-copy"><strong>{identity.office}</strong><small>{identity.system} · V11.1</small></div>
      <Button variant="ghost-inverse" size="sm" icon={collapsed ? 'chevronRight' : 'chevronLeft'} iconOnly className="collapse-button" onClick={onToggle}>{collapsed ? 'Expandir menu' : 'Recolher menu'}</Button>
    </header>

    <div className="react-nav-stack saas-nav-stack">
      {navigationGroups.map(group => <section className="react-nav-group saas-nav-group" key={group.label}>
        <div className="react-nav-title">{group.label}</div>
        <nav aria-label={group.label}>{group.items.map(([id, label, icon]) => <button type="button" className={currentView === id ? 'active' : ''} onClick={() => onNavigate(id)} title={label} key={id}><Icon name={icon} size={18} /><span>{label}</span></button>)}</nav>
      </section>)}
    </div>

    <div className="saas-sidebar-bottom">
      <nav aria-label="Preferências"><button type="button" className={currentView === 'configuracoes' ? 'active' : ''} onClick={() => onNavigate('configuracoes')} title="Configurações"><Icon name="settings" size={18} /><span>Configurações</span></button></nav>
      <footer className="react-profile saas-profile"><span>{identity.initials || 'ME'}</span><div><strong>{identity.user}</strong><small>{identity.role} · {sync}</small></div><Button variant="ghost-inverse" size="sm" icon="logout" iconOnly onClick={onSignOut}>Sair</Button></footer>
    </div>
  </aside>
}

export function AppTopbar({ currentView, query, onQueryChange, searchResults, onChooseResult, notificationsCount, notificationsOpen, onToggleNotifications, identity }) {
  return <header className="saas-topbar">
    <div className="saas-topbar-context"><span>Meu Escritório Digital</span><strong>{pageNames[currentView] || 'Sistema'}</strong></div>
    <div className="saas-topbar-search-wrap">
      <label className="saas-topbar-search"><Icon name="search" size={17} /><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Buscar clientes, tarefas, processos…" aria-label="Busca global" /></label>
      {query.trim() ? <div className="saas-search-results" role="listbox" aria-label="Resultados da busca">{searchResults.length ? searchResults.slice(0, 8).map(item => <button type="button" role="option" key={item.key} onClick={() => onChooseResult(item)}><span className={`saas-search-kind ${item.type}`}>{item.typeLabel}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></button>) : <div className="saas-search-empty">Nenhum resultado encontrado.</div>}</div> : null}
    </div>
    <div className="saas-topbar-actions">
      <button type="button" className={`saas-notification-button ${notificationsCount ? 'has-alerts' : ''}`} onClick={onToggleNotifications} aria-label={`Notificações: ${notificationsCount} alerta(s)`} aria-expanded={notificationsOpen}><Icon name="bell" size={18} />{notificationsCount ? <b>{notificationsCount > 99 ? '99+' : notificationsCount}</b> : null}</button>
      <div className="saas-topbar-profile" title={identity.user}><span>{identity.initials || 'ME'}</span><div><strong>{identity.user}</strong><small>{identity.role}</small></div></div>
    </div>
  </header>
}
