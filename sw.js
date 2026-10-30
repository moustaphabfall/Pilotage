/* Service worker : l'application s'ouvre hors ligne (coque en cache) ; Supabase et les polices passent toujours par le réseau. */
const CACHE = 'pilotage-v15';
const SHELL = ['./', './index.html', './manifest.webmanifest', './config.js', './supabase-adapter.js', './icons/icon-192.png', './icons/icon-512.png'];
const OCR = ['./ocr/tesseract.min.js','./ocr/worker.min.js','./ocr/tesseract-core-simd-lstm.wasm.js','./ocr/tesseract-core-lstm.wasm.js','./ocr/fra.traineddata.gz'];  // lecture de texte (OCR) hors connexion
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).then(() => Promise.all(OCR.map(u => c.add(u).catch(() => {}))))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;               // Supabase, CDN, polices : réseau
  e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
