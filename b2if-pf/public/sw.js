const CACHE = 'b2if-pf-v5';

const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Instala e pré-cacheia os arquivos estáticos essenciais
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia: Network First (tenta rede, cai no cache se offline)
self.addEventListener('fetch', e => {
  // Ignora requisições não-GET e externas (ex: Supabase)
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (!url.origin.includes(self.location.hostname)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Salva no cache só respostas válidas de assets
        if (res.ok && (url.pathname.startsWith('/assets/') || STATIC.includes(url.pathname))) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
