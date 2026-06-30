import { purgeOldDiscarded } from './db.js';
import { renderInbox } from './inbox.js';
import { showPopup } from './popup.js';
import { initPush } from './push.js';

async function init() {
  await purgeOldDiscarded();

  const params = new URLSearchParams(location.search);
  const popup = params.get('popup') === '1';
  const source = params.get('source') || 'icon';

  // 인박스를 항상 기본으로 렌더
  await renderInbox();
  document.getElementById('inbox-screen').classList.add('active');

  if (popup) {
    showPopup(source, () => renderInbox());
  }

  // 푸시 구독 초기화 (백그라운드, 실패해도 앱 동작 무관)
  initPush().catch(() => {});
}

init().catch(console.error);
