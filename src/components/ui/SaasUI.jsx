const paths = {
  dashboard: <><path d="M3 13h8V3H3z"/><path d="M13 21h8V11h-8z"/><path d="M13 3h8v6h-8z"/><path d="M3 15h8v6H3z"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  clients: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  tasks: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7.5 12 3 3 6-7"/></>,
  processes: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M8 12h5a5 5 0 0 0 5-5"/></>,
  obligations: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 13l2.2 2.2 4.8-5"/></>,
  finance: <><path d="M4 6.5h14a3 3 0 0 1 3 3V19H6a3 3 0 0 1-3-3V7.5A3.5 3.5 0 0 1 6.5 4H18"/><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z"/></>,
  settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M3 12a9 9 0 0 1 .18-1.8l2.1-.58.82-1.98-1.08-1.9A9 9 0 0 1 7.75 3.7l1.9 1.08 1.98-.82.58-2.1a9 9 0 0 1 3.58 0l.58 2.1 1.98.82 1.9-1.08a9 9 0 0 1 2.73 2.04l-1.08 1.9.82 1.98 2.1.58a9 9 0 0 1 0 3.6l-2.1.58-.82 1.98 1.08 1.9a9 9 0 0 1-2.73 2.04l-1.9-1.08-1.98.82-.58 2.1a9 9 0 0 1-3.58 0l-.58-2.1-1.98-.82-1.9 1.08a9 9 0 0 1-2.73-2.04l1.08-1.9-.82-1.98-2.1-.58A9 9 0 0 1 3 12Z"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  chevronLeft: <path d="m15 18-6-6 6-6"/>,
  chevronRight: <path d="m9 18 6-6-6-6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  warning: <><path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v4M12 17h.01"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
}

export function Icon({ name, size = 18, className = '' }) {
  return <svg className={`saas-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.info}</svg>
}

export function Button({ variant = 'secondary', size = 'md', icon, iconOnly = false, className = '', children, ...props }) {
  return <button className={`ui-button ui-button--${variant} ui-button--${size} ${iconOnly ? 'ui-button--icon' : ''} ${className}`} {...props}>{icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}{iconOnly ? <span className="sr-only">{children}</span> : children}</button>
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`ui-badge ui-badge--${tone} ${className}`}>{children}</span>
}

export function Card({ as: Tag = 'section', className = '', children, ...props }) {
  return <Tag className={`ui-card ${className}`} {...props}>{children}</Tag>
}

export function PageHeader({ eyebrow, title, description, meta, actions, className = '' }) {
  return <header className={`ui-page-header ${className}`}><div className="ui-page-heading">{eyebrow ? <span className="ui-page-eyebrow">{eyebrow}</span> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}</div><div className="ui-page-header-side">{meta}{actions}</div></header>
}

export function Field({ label, hint, error, required = false, full = false, children, className = '' }) {
  return <label className={`ui-field ${full ? 'ui-field--full' : ''} ${error ? 'ui-field--error' : ''} ${className}`}><span className="ui-field-label">{label}{required ? <em aria-hidden="true">*</em> : null}</span>{children}{error ? <small className="ui-field-error">{error}</small> : hint ? <small className="ui-field-hint">{hint}</small> : null}</label>
}

export function ModalShell({ title, description, onClose, children, footer, size = 'md', className = '' }) {
  return <div className="ui-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}><section className={`ui-modal-panel ui-modal-panel--${size} ${className}`}><header className="ui-modal-header"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><Button variant="ghost" icon="close" iconOnly onClick={onClose}>Fechar</Button></header><div className="ui-modal-body">{children}</div>{footer ? <footer className="ui-modal-footer">{footer}</footer> : null}</section></div>
}

export function EmptyState({ icon = 'info', title = 'Nada por aqui', description, action, className = '' }) {
  return <div className={`ui-empty ${className}`}><span className="ui-empty-icon"><Icon name={icon} size={20} /></span><div><strong>{title}</strong>{description ? <p>{description}</p> : null}</div>{action}</div>
}

export function Skeleton({ lines = 3, className = '' }) {
  return <div className={`ui-skeleton ${className}`} aria-hidden="true">{Array.from({ length: lines }, (_, index) => <span key={index} style={{ width: `${Math.max(42, 100 - index * 14)}%` }} />)}</div>
}

export function Alert({ tone = 'info', title, children, className = '' }) {
  const icon = tone === 'success' ? 'check' : tone === 'warning' || tone === 'danger' ? 'warning' : 'info'
  return <div className={`ui-alert ui-alert--${tone} ${className}`}><Icon name={icon} size={17} /><div>{title ? <strong>{title}</strong> : null}{children ? <p>{children}</p> : null}</div></div>
}
