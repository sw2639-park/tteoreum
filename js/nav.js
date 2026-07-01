import { setupSwipeBack } from './gestures.js';

const SCREEN_IDS = ['inbox-screen', 'trash-screen', 'detail-screen', 'graph-screen'];

let cleanupSwipe = null;

// 화면 전환: history 상태와 무관하게 순수 DOM 전환만 담당
export function activateScreen(id) {
  SCREEN_IDS.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('active', s === id);
  });

  cleanupSwipe?.();
  cleanupSwipe = null;
  if (id !== 'inbox-screen') {
    cleanupSwipe = setupSwipeBack(() => history.back());
  }
}

// 새 화면으로 진입 (히스토리 스택에 쌓음) — 뒤로가기/시스템 제스처가
// 앱 종료가 아닌 이전 화면 복귀로 동작하게 함
export function pushScreen(state) {
  history.pushState(state, '');
}
