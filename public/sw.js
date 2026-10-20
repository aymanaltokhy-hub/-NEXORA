// MADAR service worker. Pages/manifest: network-first (new deployments show up immediately, cache only when offline).
// Hashed build assets: cache-first (immutable). Old caches are deleted on activation.
const C = 'madar-v3'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png']
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).catch(() => {})) })
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())))
const put = (req, res) => { if (res && res.ok) { const cp = res.clone(); caches.open(C).then((c) => c.put(req, cp)) } return res }
self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url); if (req.method !== 'GET' || u.origin !== location.origin) return
  const fresh = req.mode === 'navigate' || /\/(index\.html|manifest\.webmanifest|sw\.js)?$/.test(u.pathname) && !u.pathname.includes('/assets/')
  if (fresh) e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => put(req, r)).catch(() => caches.match(req).then((h) => h || caches.match('./index.html'))))
  else e.respondWith(caches.match(req).then((h) => h || fetch(req).then((r) => put(req, r)).catch(() => caches.match('./index.html'))))
})
