/* Firebase Messaging background handler (SDK must match the page SDK). */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');
const firebaseConfig = {
  apiKey: 'AIzaSyAvH3aQzUQJDQTWbMIjxaQAsXWAh-ysr-8',
  authDomain: 'kearshehta.firebaseapp.com',
  projectId: 'kearshehta',
  storageBucket: 'kearshehta.firebasestorage.app',
  messagingSenderId: '856762365647',
  appId: '1:856762365647:web:9089379c117568363a29ba'
};
firebase.initializeApp(firebaseConfig);
const appBaseUrl = self.registration.scope;
firebase.messaging().onBackgroundMessage(({ notification, data }) => {
  self.registration.showNotification(notification?.title || data?.title || 'الدورة الرمضانية بششتا', {
    body: notification?.body || data?.body || '',
    icon: new URL('icon-192.png', appBaseUrl).href,
    badge: new URL('icon-192.png', appBaseUrl).href,
    data: { url: data?.url || './' }
  });
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => new URL(client.url).origin === self.location.origin);
    return existing ? existing.navigate(url).then(() => existing.focus()) : clients.openWindow(url);
  }));
});
