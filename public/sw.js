// Service worker ของ Growa ทำหน้าที่รับแจ้งเตือนอย่างเดียว ไม่แคชหน้าเว็บ
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // ข้อความอ่านไม่ได้: ใช้ข้อความมาตรฐาน
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Growa', {
      body: data.body || 'มีเรื่องที่ต้องดูในแอป',
      icon: '/icon.svg',
      tag: data.tag,
      data: { url: data.url || '/consult/history' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // เปิดได้เฉพาะหน้าในเว็บนี้
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'navigate' in client) {
          return client.navigate(url).then((c) => (c || client).focus());
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
