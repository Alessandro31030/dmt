/* DEARID ME — service worker.
   Per pubblicare una nuova versione: sostituisci i file e alza il numero qui sotto. */
const CACHE = 'dearid-v6';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Pagina: prima la rete (così gli aggiornamenti arrivano da soli), dopo 3 s o offline la copia salvata. */
function pageFirstNetwork(req) {
  return caches.open(CACHE).then(cache => {
    const net = fetch(req).then(res => {
      if (res && res.ok) cache.put('index.html', res.clone());
      return res;
    });
    const timeout = new Promise(r => setTimeout(r, 3000)).then(() => cache.match('index.html'));
    return Promise.race([net.catch(() => cache.match('index.html')), timeout])
      .then(r => r || net)
      .catch(() => cache.match('index.html'));
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(pageFirstNetwork(req));
    return;
  }
  /* File dell'app: copia salvata, aggiornata in background. */
  if (url.origin === location.origin) {
    e.respondWith(caches.open(CACHE).then(cache => cache.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  /* Font di Google: salvati alla prima apertura, poi funzionano offline. */
  if (FONTS.test(req.url)) {
    e.respondWith(caches.open(CACHE).then(cache => cache.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }))));
  }
  /* Meteo (Open-Meteo) e tutto il resto: sempre dalla rete, nessuna cache. */
});
