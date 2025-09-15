// sw.js — PWA CTĐ, CTCT (safe & auto-update)
const VERSION = 'v3-2025-09-15';
const STATIC_CACHE  = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

// Chỉ để các asset TĨNH thật sự ổn định ở đây
const STATIC_ASSETS = [
  './style.css',                 // dùng đường dẫn tương đối
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.webmanifest',
  './index.html'                 // fallback khi offline điều hướng
];

// ---- Install: precache static ----
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// ---- Activate: cleanup old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ---- Fetch strategies ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;

  // Điều hướng (bấm link trang) → network-first với fallback index.html
  if (req.mode === 'navigate') {
    event.respondWith(htmlNetworkFirst(req));
    return;
  }

  // CSS → stale-while-revalidate (hết dính CSS cũ)
  if (req.destination === 'style' || url.pathname.endsWith('style.css')) {
    event.respondWith(cssStaleWhileRevalidate(req));
    return;
  }

  // Ảnh/Icon → cache-first
  if (req.destination === 'image') {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Script/JSON/API → network-first (ưu tiên bản mới)
  if (req.destination === 'script' || url.pathname.endsWith('.js') ||
      req.headers.get('accept')?.includes('application/json')) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // Còn lại:
  // - Cùng origin: thử cache trước cho asset tĩnh
  // - Khác origin (Apps Script…): network-first
  if (isSameOrigin) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
  } else {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
  }
});

// ---------- Helpers ----------
async function cssStaleWhileRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  const fetchPromise = fetch(req, { cache: 'no-store' })
    .then(res => { cache.put(req, res.clone()); return res; })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req, { cache: 'no-store' });
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req, { ignoreSearch: true }) ||
                   await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function htmlNetworkFirst(req) {
  try {
    return await fetch(req, { cache: 'no-store' });
  } catch {
    const cached = await caches.match('./index.html');
    return cached || new Response('Offline', { status: 503 });
  }
}
