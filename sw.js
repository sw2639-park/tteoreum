const CACHE_NAME = 'tteoreum-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/db.js',
  '/js/popup.js',
  '/js/inbox.js',
  '/js/snooze.js',
  '/js/trash.js',
  '/js/detail.js',
  '/js/push.js',
  '/js/graph.js',
  '/js/gestures.js',
  '/js/nav.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 공유 타겟 처리
  if (url.pathname === '/share-target' && e.request.method === 'POST') {
    e.respondWith(handleShareTarget(e.request));
    return;
  }

  // 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const title = formData.get('title') || '';
  const text = formData.get('text') || '';
  const url = formData.get('url') || '';

  const content = [title, text, url].filter(Boolean).join('\n').trim();

  if (content) {
    const item = {
      id: crypto.randomUUID(),
      content,
      source: 'share',
      createdAt: new Date().toISOString(),
      status: 'unhandled',
      type: 'note',
    };
    await saveToIDB(item);
  }

  return Response.redirect('/?source=share', 303);
}

// 서비스워커 내 IndexedDB 접근
function saveToIDB(item) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tteoreum', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('captures')) {
        const store = db.createObjectStore('captures', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('captures', 'readwrite');
      tx.objectStore('captures').put(item);
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

// Phase 1에서 추가될 푸시 수신 처리 (스텁)
self.addEventListener('push', (e) => {
  e.waitUntil(handlePush(e));
});

async function handlePush(e) {
  const data = e.data?.json() || {};
  const count = await countUnhandled();
  const isSunday = new Date().getDay() === 0;

  let body = `미처리 ${count}건`;
  if (isSunday && data.weeklySummary) {
    body += `\n${data.weeklySummary}`;
  }

  await self.registration.showNotification(body, {
    tag: 'daily-check',
    renotify: false,
    silent: true,
    icon: '/icons/status-mono.png',
    badge: '/icons/status-mono.png',
    actions: [{ action: 'capture', title: '기록하기' }],
    data: { intent: 'popup-input' }
  });
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/?source=notification&popup=1'));
});

function countUnhandled() {
  return new Promise((resolve) => {
    const req = indexedDB.open('tteoreum', 1);
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('captures', 'readonly');
      const store = tx.objectStore('captures');
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const now = new Date();
        const count = getAllReq.result.filter(item => {
          if (item.status === 'discarded' || item.status === 'handled') return false;
          if (item.status === 'snoozed') {
            return item.snoozeUntil && new Date(item.snoozeUntil) <= now;
          }
          return true;
        }).length;
        resolve(count);
      };
      getAllReq.onerror = () => resolve(0);
    };
    req.onerror = () => resolve(0);
  });
}
