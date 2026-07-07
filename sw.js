// Service Worker do CZK MAKI — responsável por receber os pushes
// e exibir a notificação, mesmo com o navegador fechado ou em segundo plano.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Chega um push do servidor (enviado pela Edge Function "enviar-push")
self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (e) {
        payload = { titulo: 'CZK MAKI', corpo: event.data ? event.data.text() : '' };
    }

    const titulo = payload.titulo || 'CZK MAKI';
    const opcoes = {
        body: payload.corpo || '',
        icon: payload.icon || 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=200',
        badge: payload.icon || undefined,
        data: payload.dados || {},
        vibrate: [100, 50, 100]
    };

    event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Clique na notificação: foca ou abre a aba do app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow('./');
        })
    );
});
