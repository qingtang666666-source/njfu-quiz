// 离线缓存：外壳 cache-first，题库索引 network-first，其它题库数据 stale-while-revalidate
const SHELL = 'njfu-shell-v3'
const DATA = 'njfu-data-v3'
const SHELL_FILES = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.includes('/data/')) {
    const isIndex = url.pathname.endsWith('/subjects.json')
    e.respondWith((async () => {
      const cache = await caches.open(DATA)
      const cached = await cache.match(req)
      // 题库索引必须拿最新：网络优先，失败才回退缓存
      if (isIndex) {
        try {
          const res = await fetch(req)
          if (res.ok) cache.put(req, res.clone())
          return res
        } catch {
          return cached || Response.error()
        }
      }
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(req, res.clone())
        return res
      }).catch(() => cached)
      return cached || network
    })())
    return
  }

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(SHELL)
      const cached = await cache.match('./index.html')
      try {
        const res = await fetch(req)
        if (res.ok) cache.put('./index.html', res.clone())
        return res
      } catch {
        return cached || Response.error()
      }
    })())
    return
  }

  e.respondWith((async () => {
    const cache = await caches.open(SHELL)
    const cached = await cache.match(req)
    if (cached) return cached
    const res = await fetch(req)
    if (res.ok && (url.pathname.includes('/assets/') || url.pathname.endsWith('.png'))) {
      cache.put(req, res.clone())
    }
    return res
  })())
})
