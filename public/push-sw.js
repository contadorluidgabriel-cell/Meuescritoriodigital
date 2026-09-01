self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { body: event.data?.text?.() || '' } }
  const title = payload.title || 'Meu Escritório Digital'
  const actions = Array.isArray(payload.actions) && payload.actions.length
    ? payload.actions.slice(0, 2)
    : [{ action: 'open-day', title: 'Abrir Meu Dia' }, { action: 'open-pending', title: 'Pendências' }]
  const options = {
    body: payload.body || 'Você tem uma atualização no escritório.',
    icon: '/app-icon-v2.svg',
    badge: '/app-icon-v2.svg',
    tag: payload.tag || 'office-notification',
    renotify: true,
    actions,
    data: { url: payload.url || '/?push=meu-dia', type: payload.type || '' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const actionTargets = {
    'open-day': '/?push=meu-dia',
    'open-pending': '/?push=pendencias',
    'open-finance': '/?push=honorarios',
    'open-tasks': '/?push=tarefas',
  }
  const path = actionTargets[event.action] || event.notification.data?.url || '/?push=meu-dia'
  const target = new URL(path, self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    for (const client of windows) {
      try {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target)
          return client.focus()
        }
      } catch {}
    }
    return self.clients.openWindow(target)
  }))
})
