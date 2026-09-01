import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Notification center patch failed (${label})`)
  return source.replace(from, to)
}

export function applyNotificationCenterPatch(root) {
  const path = `${root}src/App.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("summarizeNotifications } from './lib/notificationCenter.js'")) return

  source = replaceOrFail(
    source,
    "import { collectCalendarEvents } from './lib/calendarEvents.js'",
    "import { collectOfficeNotifications, summarizeNotifications } from './lib/notificationCenter.js'\nimport './notification-center.css'",
    'notification imports',
  )

  const helperStart = source.indexOf('function localDateOnly(value) {')
  const appStart = source.indexOf('export default function App() {')
  if (helperStart < 0 || appStart < 0 || helperStart > appStart) throw new Error('Notification center patch failed (legacy deadline helpers)')
  source = source.slice(0, helperStart) + source.slice(appStart)

  const notificationStart = source.indexOf('  const notificationItems = useMemo(')
  const searchStart = source.indexOf('  const searchResults = useMemo(', notificationStart)
  if (notificationStart < 0 || searchStart < 0) throw new Error('Notification center patch failed (notification memo)')
  source = source.slice(0, notificationStart) + `  const notificationItems = useMemo(() => collectOfficeNotifications(office, { daysBefore: notificationDays }), [office, notificationDays])\n  const notificationSummary = useMemo(() => summarizeNotifications(notificationItems), [notificationItems])\n\n` + source.slice(searchStart)

  const openStart = source.indexOf('  function openNotification(event) {')
  const calendarStart = source.indexOf('  function openCalendarEvent(event) {', openStart)
  if (openStart < 0 || calendarStart < 0) throw new Error('Notification center patch failed (notification navigation)')
  source = source.slice(0, openStart) + `  function openNotification(event) {\n    setNotificationsOpen(false)\n    if (event.type === 'finance' || event.type === 'partner') {\n      openFinanceForClient(event.clientId || '')\n      return\n    }\n    openCalendarEvent(event)\n  }\n\n` + source.slice(calendarStart)

  source = replaceOrFail(source, 'Agenda do escritório · atualização automática', 'Central do escritório · atualização automática', 'panel subtitle')

  source = replaceOrFail(
    source,
    `        <div className="notification-summary">\n          <span className={notificationSummary.overdue ? 'danger' : ''}><b>{notificationSummary.overdue}</b><small>Vencidas</small></span>\n          <span className={notificationSummary.today ? 'warning' : ''}><b>{notificationSummary.today}</b><small>Hoje</small></span>\n          <span><b>{notificationSummary.upcoming}</b><small>Próximas</small></span>\n        </div>`,
    `        <div className="notification-summary">\n          <span className={notificationSummary.critical ? 'danger' : ''}><b>{notificationSummary.critical}</b><small>Críticos</small></span>\n          <span className={notificationSummary.attention ? 'attention' : ''}><b>{notificationSummary.attention}</b><small>Atenção</small></span>\n          <span className={notificationSummary.info ? 'info' : ''}><b>{notificationSummary.info}</b><small>Próximos</small></span>\n        </div>`,
    'priority summary',
  )

  const listStart = source.indexOf('        <div className="notification-list">')
  const moreStart = source.indexOf('        {notificationItems.length > 40 ?', listStart)
  if (listStart < 0 || moreStart < 0) throw new Error('Notification center patch failed (notification list)')
  source = source.slice(0, listStart) + `        <div className="notification-list">\n          {notificationItems.length ? notificationItems.slice(0, 40).map(item => <button type="button" className={\`notification-item level-\${item.level} \${item.days < 0 ? 'overdue' : item.days === 0 ? 'today' : ''}\`} key={item.key} onClick={() => openNotification(item)}>\n            <span className={\`notification-kind \${item.type}\`}>{item.kindLabel}</span>\n            <strong>{item.title}</strong>\n            <small>{item.subtitle}</small>\n          </button>) : <div className="notification-empty"><b>Tudo em dia</b><small>Nenhuma pendência operacional, financeira ou de parceiros dentro dos critérios atuais.</small></div>}\n        </div>\n` + source.slice(moreStart)

  source = replaceOrFail(
    source,
    `        <footer><span>Itens concluídos saem dos alertas automaticamente.</span><button type="button" onClick={() => navigate('calendario')}>Abrir calendário</button></footer>`,
    `        <footer><span>Pendências resolvidas saem dos alertas automaticamente.</span><div className="notification-footer-actions"><button type="button" onClick={() => navigate('calendario')}>Calendário</button><button type="button" onClick={() => navigate('honorarios')}>Financeiro</button></div></footer>`,
    'notification footer',
  )

  writeFileSync(path, source)
}
