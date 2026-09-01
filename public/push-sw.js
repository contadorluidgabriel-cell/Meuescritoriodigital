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
  const options = {
    body: payload.body || 'Você tem uma atualização no escritório.',
    icon: '/app-icon-v2.svg',
    badge: '/app-icon-v2.svg',
    tag: payload.tag || 'office-notification',
    renotify: true,
    data: { url: payload.url || '/', type: payload.type || '' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
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
