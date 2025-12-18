// sw.js - Service Worker Optimizado
const CACHE_NAME = 'bar-v2-full';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './css/modal.css',
  './js/script.js',
  './js/config.js',
  './img/logo.png', // Logo local actualizado según index.html
  './manifest.json',
  // Recursos Externos Críticos (Fuentes e Iconos)
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;800&family=Yellowtail&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=600&q=60' // Imagen Hero
];

// Instalación: Guardar archivos estáticos y críticos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activación: Limpiar cachés viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Peticiones: Stale-While-Revalidate para imágenes, Cache First para lo demás
self.addEventListener('fetch', (e) => {
  // Estrategia específica para imágenes (destino 'image')
  if (e.request.destination === 'image') {
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(e.request).then((cachedResponse) => {
          const fetchPromise = fetch(e.request).then((networkResponse) => {
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // Estrategia Cache First para código y fuentes
    e.respondWith(
      caches.match(e.request).then((response) => {
        return response || fetch(e.request);
      })
    );
  }
});