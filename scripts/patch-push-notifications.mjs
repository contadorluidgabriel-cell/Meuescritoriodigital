import { readFileSync, writeFileSync } from 'node:fs'

function replaceOrFail(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Push notifications patch failed (${label})`)
  return source.replace(from, to)
}

export function applyPushNotificationsPatch(root) {
  const path = `${root}src/App.jsx`
  let source = readFileSync(path, 'utf8')
  if (source.includes("PushNotificationSettings from './components/PushNotificationSettings.jsx'")) return

  source = replaceOrFail(
    source,
    "import { AppSidebar, AppTopbar } from './components/AppChrome.jsx'",
    "import { AppSidebar, AppTopbar } from './components/AppChrome.jsx'\nimport PushNotificationSettings from './components/PushNotificationSettings.jsx'\nimport './push-notifications.css'",
    'imports',
  )

  source = replaceOrFail(
    source,
    "  const [view, setView] = useState(localPreview ? 'clientes' : 'dashboard')",
    "  const requestedPushView = new URLSearchParams(window.location.search).get('push')\n  const initialPushView = ['tarefas', 'calendario', 'honorarios'].includes(requestedPushView) ? requestedPushView : 'dashboard'\n  const [view, setView] = useState(localPreview ? 'clientes' : initialPushView)",
    'notification deep link',
  )

  source = replaceOrFail(
    source,
    `        </label>\n        <div className="notification-list">`,
    `        </label>\n        <PushNotificationSettings session={session} />\n        <div className="notification-list">`,
    'settings panel',
  )

  writeFileSync(path, source)
}
