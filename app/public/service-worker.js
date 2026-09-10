const CACHE_NAME = 'trade-business-shell-v2'
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

// Network-first for API calls (financial data must never be served stale
// from cache); cache-first only for the static app shell. This app does
// NOT support offline financial editing, per spec.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) return // let it hit the network normally
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})

self.addEventListener('push', (event) => {
  let payload = { title: 'Trade Business', body: 'You have a new notification.' }
  try { payload = event.data.json() } catch { /* use default */ }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: payload.data || {}
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const obligationId = event.notification.data?.payableId || event.notification.data?.receivableId
  const type = event.notification.data?.obligationType
  const path = obligationId
    ? (type === 'PAYABLE' ? `/payables/${obligationId}` : `/receivables/${obligationId}`)
    : '/notifications'
  const targetUrl = new URL(path, self.location.origin).href

  // Prefer focusing and navigating an already-open window over spawning a
  // duplicate one, so tapping a notification while the app is already
  // open (just backgrounded/locked) feels like switching to it, not
  // launching a second copy.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-navigate', path })
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})
