const CACHE_NAME = 'controle-financeiro-static-v6.8';
const STATIC_VERSION = 'controle-financeiro-static-v6.8';

let ativacaoSolicitadaPeloUsuario = false;

self.addEventListener('activate', (event) => {
  // Só limpamos caches antigos e assumimos as páginas abertas quando o usuário
  // clicou em "Atualizar". Isso evita atualização automática por lifecycle do SW.
  if (!ativacaoSolicitadaPeloUsuario) {
    return;
  }

  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const isStaticAsset = url.pathname.startsWith('/static/') || url.pathname === '/manifest.json';
  if (!isStaticAsset) {
    return;
  }

  const assetVersion = url.searchParams.get('v');
  const canCacheAsset = url.pathname === '/manifest.json' || !assetVersion || assetVersion === STATIC_VERSION;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(new Request(event.request, { cache: 'reload' })).then((response) => {
        if (!response || !response.ok) {
          return response;
        }

        if (canCacheAsset) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        type: 'VERSION',
        cacheName: CACHE_NAME,
        staticVersion: STATIC_VERSION
      });
    }
    return;
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    ativacaoSolicitadaPeloUsuario = true;
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (error) {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'Controle Financeiro';
  const notificationIcon = `/static/icon/icon-192x192.png?v=${encodeURIComponent(STATIC_VERSION)}`;
  const options = {
    body: payload.body || 'Você tem um novo aviso.',
    icon: notificationIcon,
    badge: notificationIcon,
    tag: payload.tag || 'controle-financeiro-notificacao',
    data: {
      url: payload.url || '/gestao/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : '/gestao/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
