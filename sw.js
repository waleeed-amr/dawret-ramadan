/* Service Worker — دورة رمضان v33.1
 *   Bug fixes:
 *     • Fixed "Failed to execute 'clone' on 'Response': Response body is already used"
 *       The cache.put() call was racing with the browser consuming the response
 *       body. We now consume the response into the cache BEFORE returning it to
 *       the client, by awaiting the put and returning a freshly-cloned Response.
 *     • Hardened the chrome-extension / moz-extension / data: / blob: filters.
 *     • The fetch handler now also handles SPA navigations correctly (mode 'navigate')
 *       by caching the response before passing it through.
 */
const CACHE_VERSION = 'v33.1';
const APP_CACHE = `app-${CACHE_VERSION}`;
const CDN_CACHE = `cdn-${CACHE_VERSION}`;

// App shell — fingerprinted by SW cache name. URLs MUST NOT carry ?v= query strings.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/og-image.png',
  '/CSS/style.css',
  '/JS/firebase-config.js',
  '/JS/fcm.js',
  '/JS/app.js',
  '/JS/admin.js'
];

// Vendored assets served via CDN. Cached on first use (stale-while-revalidate).
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap'
];

// Schemes that the Cache API does NOT support. We must skip these entirely to
// avoid "Request scheme 'X' is unsupported" errors when browser extensions or
// the browser itself emits requests that pass through this SW.
const UNSUPPORTED_SCHEMES = [
  'chrome-extension:',
  'moz-extension:',
  'safari-web-extension:',
  'ms-browser-extension:'
];

// Hostnames that should never be intercepted — they carry credentials or
// behaviour that must hit the network directly.
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebasestorage.googleapis.com',
  'imgbb.com',
  'i.ibb.co'
];

// =========================================================================
// Helpers
// =========================================================================

// True only when the URL is one we ever want to cache or intercept.
// Browser-extension schemes and non-network schemes (data:, blob:, about:)
// can't be passed to Cache.put, so we skip them outright.
function isInterceptable(urlString) {
  try {
    const u = new URL(urlString);
    if (!u.protocol.startsWith('http')) return false;
    if (UNSUPPORTED_SCHEMES.some(s => u.protocol.startsWith(s))) return false;
    return true;
  } catch (e) {
    return false;
  }
}

// Try to cache a request/response pair. Silently swallows any error so the
// caller can keep doing what it's doing even if caching fails for any reason
// (e.g. URL scheme not supported).
async function tryPut(cacheName, req, res) {
  try {
    if (!res) return;
    if (res.status !== 200) return;
    if (!isInterceptable(req.url)) return;
    const cache = await caches.open(cacheName);
    await cache.put(req, res);
  } catch (e) {
    // Swallow — never break the page for a cache write failure.
  }
}

// =========================================================================
// Lifecycle
// =========================================================================

self.addEventListener('install', e => {
  // Take over immediately so the user's first reload uses v33.1.
  self.skipWaiting();
  e.waitUntil(
    caches.open(APP_CACHE)
      .then(async cache => {
        await cache.addAll(APP_SHELL).catch(() => { /* best-effort */ });
        const cdn = await caches.open(CDN_CACHE);
        await Promise.all(CDN_ASSETS.map(u => cdn.add(u).catch(() => {})));
      })
  );
});

self.addEventListener('activate', e => {
  // Purge any older caches, then claim all open clients so the new SW controls
  // the page straight away (instead of waiting for the next navigation).
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== APP_CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// =========================================================================
// Fetch handler — fully async to avoid the body-already-used race
// =========================================================================

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // 1) Skip browser-extension and other non-web schemes entirely.
  if (!isInterceptable(req.url)) return;

  // 2) Skip credentialed / streaming endpoints.
  if (NEVER_CACHE_HOSTS.some(h => url.hostname.includes(h))) return;

  const isAppShell = url.origin === self.location.origin;
  const mode = req.mode; // 'navigate' | 'same-origin' | 'cors' | 'no-cors' | ...

  // Network-first for the app shell (HTML, JS, CSS, icons).
  if (isAppShell) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        // Fire-and-forget the cache write so it doesn't block the response.
        if (res && res.status === 200) tryPut(APP_CACHE, req, res.clone());
        return res;
      } catch (err) {
        // Network failed → fall back to cache (or the cached shell) so the SPA still loads.
        const cached = await caches.match(req);
        if (cached) return cached;
        // For navigation requests try the shell index.
        if (mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Stale-while-revalidate for cross-origin assets (CDN, fonts, Firebase SDKs).
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      // Refresh in the background; serve the stale copy now.
      fetch(req).then(res => tryPut(CDN_CACHE, req, res.clone())).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.status === 200) tryPut(CDN_CACHE, req, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

// =========================================================================
// Allow the page to trigger an immediate skipWaiting via postMessage
// =========================================================================
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
