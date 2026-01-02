// This file is intentionally left blank for now.
// A full implementation would require a backend to send push notifications.
self.addEventListener('push', event => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/vite.svg'
  });
});
