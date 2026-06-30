const VAPID_PUBLIC_KEY = 'BIoQGf12CafMgKocxsg9XuU1C8lZy1bA2MS2sNPPrG2bUhMCwr-wgZIYWBYWpa9EJeRxDSIxqkIJGAP8pFTGMhY';
const RELAY_URL = 'https://tteoreum-relay.vercel.app';

export async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const reg = await navigator.serviceWorker.ready;

  // 이미 구독 중이면 재전송
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sendSubscription(sub);
    return;
  }

  // 알림 권한 요청
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  // 구독 생성
  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  await sendSubscription(sub);
}

async function sendSubscription(sub) {
  try {
    await fetch(`${RELAY_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch (e) {
    console.warn('push subscription sync failed:', e.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
