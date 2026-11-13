/* Service worker : l'application s'ouvre hors ligne (coque en cache) ; Supabase et les polices passent toujours par le réseau. */
const CACHE = 'pilotage-v388';
const SHELL = ['./', './index.html', './manifest.webmanifest', './config.js', './supabase-adapter.js', './sharepoint-adapter.js', './vendor/msal-browser.min.js', './icons/icon-192.png', './icons/logo.svg', './icons/icon-512.png'];
const LIBS = ['./lib/pdf.min.js','./lib/pdf.worker.min.js','./lib/jspdf.umd.min.js','./lib/jspdf.plugin.autotable.min.js','./fonts/fonts.css','./fonts/space-grotesk-500-normal.woff2','./fonts/space-grotesk-600-normal.woff2','./fonts/space-grotesk-700-normal.woff2','./fonts/ibm-plex-sans-400-normal.woff2','./fonts/ibm-plex-sans-500-normal.woff2','./fonts/ibm-plex-sans-600-normal.woff2','./fonts/ibm-plex-sans-400-italic.woff2'];
const OCR = ['./ocr/tesseract.min.js','./ocr/worker.min.js','./ocr/tesseract-core-simd-lstm.wasm.js','./ocr/tesseract-core-lstm.wasm.js','./ocr/fra.traineddata.gz'];  // lecture de texte (OCR) hors connexion
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u=>c.add(new Request(u,{cache:'reload'})))).then(() => Promise.all(LIBS.concat(OCR).map(u => c.add(u).catch(() => {}))))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;               // Supabase, CDN, polices : réseau
  e.respondWith(fetch(r,{cache:'no-cache'}).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
