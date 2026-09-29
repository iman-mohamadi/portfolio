// Service worker: instant repeat visits + offline. Bump VERSION to invalidate everything.
const VERSION = 'im-v1'
const SHELL = ['/', '/classic.html', '/manifest.webmanifest', '/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

const swr = async (req) => {
  const cache = await caches.open(VERSION), hit = await cache.match(req)
  const net = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r }).catch(() => hit)
  return hit || net
}
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url)
  if (req.method !== 'GET') return
  // pages: network first, cached copy when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put(req, c)); return r }).catch(() => caches.match(req).then((r) => r || caches.match('/'))))
    return
  }
  if (url.origin === location.origin) {
    // hashed build assets never change → cache first
    if (url.pathname.startsWith('/assets/')) { e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put(req, c)); return r }))); return }
    e.respondWith(swr(req)); return
  }
  // fonts etc. from Google
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(swr(req))
})
