// UNFYN service worker — offline + cache versionada
// A versão vem do registo (sw.js?v=X.Y), o que força novo install a cada release.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'unfyn-' + VERSION;
const CORE = ['./'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('unfyn-') && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Nunca intercetar chamadas à API (Supabase) — vão sempre à rede
  if (url.hostname.endsWith('supabase.co')) return;

  // Página (navegação): network-first, fallback cache => atualiza quando há rede, abre offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Restantes assets (fontes, ícones): cache-first com preenchimento em runtime
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && (url.protocol === 'https:')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
