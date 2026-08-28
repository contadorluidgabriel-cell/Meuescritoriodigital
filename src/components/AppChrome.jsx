import { useEffect, useState } from 'react'
import { Button, Icon } from './ui/SaasUI.jsx'

export const navigationGroups = [
  { label: 'Visão geral', items: [['dashboard', 'Painel Principal', 'dashboard'], ['calendario', 'Calendário', 'calendar']] },
  { label: 'Operação', items: [['clientes', 'Clientes', 'clients'], ['tarefas', 'Tarefas', 'tasks'], ['processos', 'Processos', 'processes'], ['obrigacoes', 'Obrigações', 'obligations']] },
  { label: 'Gestão', items: [['honorarios', 'Financeiro', 'finance']] },
]

export const pageNames = Object.fromEntries(navigationGroups.flatMap(group => group.items.map(([id, label]) => [id, label])).concat([['configuracoes', 'Configurações']]))

const mobilePrimary = [
  ['dashboard', 'Painel', 'dashboard'],
  ['calendario', 'Agenda', 'calendar'],
  ['clientes', 'Clientes', 'clients'],
  ['tarefas', 'Tarefas', 'tasks'],
]

const mobileMore = [
  ['processos', 'Processos', 'processes'],
  ['obrigacoes', 'Obrigações', 'obligations'],
  ['honorarios', 'Financeiro', 'finance'],
  ['configuracoes', 'Configurações', 'settings'],
]

export function AppSidebar({ currentView, identity, sync, collapsed, notificationsOpen = false, onToggle, onNavigate, onSignOut }) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const mobileMoreActive = mobileMore.some(([id]) => id === currentView)
  const go = id => { setMobileMoreOpen(false); onNavigate(id) }

  useEffect(() => { setMobileMoreOpen(false) }, [currentView, notificationsOpen])

  return <>
    <aside className="react-sidebar saas-sidebar app-sidebar-desktop">
      <header className="react-brand saas-brand">
        <span className="react-logo">{identity.initials || 'ED'}</span>
        <div className="saas-brand-copy"><strong>{identity.office}</strong><small>{identity.system} · V11.1</small></div>
        <Button variant="ghost-inverse" size="sm" icon={collapsed ? 'chevronRight' : 'chevronLeft'} iconOnly className="collapse-button" onClick={onToggle}>{collapsed ? 'Expandir menu' : 'Recolher menu'}</Button>
      </header>

      <div className="react-nav-stack saas-nav-stack saas-desktop-nav">
        {navigationGroups.map(group => <section className="react-nav-group saas-nav-group" key={group.label}>
          <div className="react-nav-title">{group.label}</div>
          <nav aria-label={group.label}>{group.items.map(([id, label, icon]) => <button type="button" className={currentView === id ? 'active' : ''} onClick={() => go(id)} title={label} key={id}><Icon name={icon} size={18} /><span>{label}</span></button>)}</nav>
        </section>)}
      </div>

      <div className="saas-sidebar-bottom">
        <nav aria-label="Preferências"><button type="button" className={currentView === 'configuracoes' ? 'active' : ''} onClick={() => go('configuracoes')} title="Configurações"><Icon name="settings" size={18} /><span>Configurações</span></button></nav>
        <footer className="react-profile saas-profile"><span>{identity.initials || 'ME'}</span><div><strong>{identity.user}</strong><small>{identity.role} · {sync}</small></div><Button variant="ghost-inverse" size="sm" icon="logout" iconOnly onClick={onSignOut}>Sair</Button></footer>
      </div>
    </aside>

    <nav className="saas-mobile-nav app-mobile-nav" aria-label="Navegação principal mobile">
      {mobilePrimary.map(([id, label, icon]) => <button type="button" className={currentView === id ? 'active' : ''} onClick={() => go(id)} aria-current={currentView === id ? 'page' : undefined} key={id}><span className="saas-mobile-nav-icon"><Icon name={icon} size={19} /></span><span className="saas-mobile-nav-label">{label}</span></button>)}
      <button type="button" className={mobileMoreActive || mobileMoreOpen ? 'active' : ''} onClick={() => setMobileMoreOpen(current => !current)} aria-expanded={mobileMoreOpen}><span className="saas-mobile-nav-icon"><Icon name="more" size={20} /></span><span className="saas-mobile-nav-label">Mais</span></button>
    </nav>

    {mobileMoreOpen ? <>
      <button type="button" className="saas-mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)} aria-label="Fechar menu" />
      <section className="saas-mobile-more-sheet app-mobile-more-panel" aria-label="Mais módulos">
        <header><div><strong>Mais áreas</strong><small>Gestão e configurações do escritório</small></div><button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="Fechar"><Icon name="close" size={18} /></button></header>
        <div className="saas-mobile-more-grid">
          {mobileMore.map(([id, label, icon]) => <button type="button" className={currentView === id ? 'active' : ''} onClick={() => go(id)} aria-current={currentView === id ? 'page' : undefined} key={id}><span className="saas-mobile-more-icon"><Icon name={icon} size={19} /></span><div><strong>{label}</strong><small>{id === 'processos' ? 'Fluxos e protocolos' : id === 'obrigacoes' ? 'Prazos e entregas' : id === 'honorarios' ? 'Honorários e recebimentos' : 'Sistema e integrações'}</small></div></button>)}
        </div>
        <footer><div><span>{identity.initials || 'ME'}</span><div><strong>{identity.user}</strong><small>{identity.role} · {sync}</small></div></div><Button variant="secondary" size="sm" icon="logout" onClick={onSignOut}>Sair</Button></footer>
      </section>
    </> : null}
  </>
}

export function AppTopbar({ currentView, query, onQueryChange, searchResults, onChooseResult, notificationsCount, notificationsOpen, onToggleNotifications, identity }) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const closeMobileSearch = () => { setMobileSearchOpen(false); onQueryChange('') }

  useEffect(() => { setMobileSearchOpen(false) }, [currentView, notificationsOpen])

  return <header className="saas-topbar">
    <div className="saas-topbar-context"><span>Meu Escritório Digital</span><strong>{pageNames[currentView] || 'Sistema'}</strong></div>
    <div className="saas-mobile-topbar-context"><strong>{pageNames[currentView] || 'Sistema'}</strong><small>Meu Escritório Digital</small></div>

    <div className={`saas-topbar-search-wrap ${mobileSearchOpen ? 'mobile-open' : ''}`}>
      <label className="saas-topbar-search"><Icon name="search" size={17} /><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Buscar clientes, tarefas, processos…" aria-label="Busca global" /></label>
      <button type="button" className="saas-mobile-search-close" onClick={closeMobileSearch} aria-label="Fechar busca"><Icon name="close" size={17} /></button>
      {query.trim() ? <div className="saas-search-results" role="listbox" aria-label="Resultados da busca">{searchResults.length ? searchResults.slice(0, 8).map(item => <button type="button" role="option" key={item.key} onClick={() => { onChooseResult(item); setMobileSearchOpen(false) }}><span className={`saas-search-kind ${item.type}`}>{item.typeLabel}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></button>) : <div className="saas-search-empty">Nenhum resultado encontrado.</div>}</div> : null}
    </div>

    <div className="saas-topbar-actions">
      <button type="button" className={`saas-mobile-search-button ${mobileSearchOpen ? 'active' : ''}`} onClick={() => { setMobileSearchOpen(current => !current); if (notificationsOpen) onToggleNotifications() }} aria-label="Buscar no sistema" aria-expanded={mobileSearchOpen}><Icon name="search" size={18} /></button>
      <button type="button" className={`saas-notification-button ${notificationsCount ? 'has-alerts' : ''}`} onClick={() => { setMobileSearchOpen(false); onToggleNotifications() }} aria-label={`Notificações: ${notificationsCount} alerta(s)`} aria-expanded={notificationsOpen}><Icon name="bell" size={18} />{notificationsCount ? <b>{notificationsCount > 99 ? '99+' : notificationsCount}</b> : null}</button>
      <div className="saas-topbar-profile" title={identity.user}><span>{identity.initials || 'ME'}</span><div><strong>{identity.user}</strong><small>{identity.role}</small></div></div>
    </div>
  </header>
}
