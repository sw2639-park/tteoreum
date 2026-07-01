import { purgeOldDiscarded } from './db.js';
import { renderInbox } from './inbox.js';
import { showPopup } from './popup.js';
import { initPush, showQuickCaptureNotification } from './push.js';
import { activateScreen } from './nav.js';

async function route(state) {
  const screen = state?.screen || 'inbox';

  // 상세 팝업은 오버레이라 화면 전환과 무관하게 항상 정리
  if (screen !== 'detail') {
    const d = await import('./detail.js');
    d.closeDetailPopup();
  }

  if (screen === 'trash') {
    const m = await import('./trash.js');
    await m.renderTrashScreen();
  } else if (screen === 'detail') {
    const m = await import('./detail.js');
    await m.renderDetailPopup(state.id);
  } else if (screen === 'graph') {
    const m = await import('./graph.js');
    await m.renderGraphScreen();
  } else if (screen === 'handled') {
    const m = await import('./handled.js');
    await m.renderHandledScreen();
  } else {
    activateScreen('inbox-screen');
    await renderInbox();
  }
}

async function init() {
  await purgeOldDiscarded();

  const params = new URLSearchParams(location.search);
  const popup = params.get('popup') === '1';
  const source = params.get('source') || 'icon';

  // 인박스를 항상 기본으로 렌더
  await renderInbox();
  activateScreen('inbox-screen');

  window.addEventListener('popstate', (e) => route(e.state));

  if (popup) {
    showPopup(source, () => renderInbox());
  }

  // 푸시 구독과 캡처 알림은 서로 독립적으로 시도 (하나 실패해도 다른 쪽 영향 없음)
  initPush().catch((e) => console.warn('initPush failed:', e.message));
  showQuickCaptureNotification().catch((e) => console.warn('quick capture failed:', e.message));
}

init().catch(console.error);
