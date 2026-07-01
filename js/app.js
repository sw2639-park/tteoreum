import { purgeOldDiscarded } from './db.js';
import { renderInbox } from './inbox.js';
import { showPopup } from './popup.js';
import { initPush } from './push.js';
import { activateScreen } from './nav.js';

async function route(state) {
  const screen = state?.screen || 'inbox';
  if (screen === 'trash') {
    const m = await import('./trash.js');
    await m.renderTrashScreen();
  } else if (screen === 'detail') {
    const m = await import('./detail.js');
    await m.renderDetailScreen(state.id);
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

  // 푸시 구독 초기화 (백그라운드, 실패해도 앱 동작 무관)
  initPush().catch(() => {});
}

init().catch(console.error);
