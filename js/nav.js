import { setupSwipeBack } from './gestures.js';

const SCREEN_IDS = ['inbox-screen', 'trash-screen', 'graph-screen', 'handled-screen'];

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

// 같은 깊이의 화면끼리 옆으로 이동 (히스토리를 쌓지 않고 교체) —
// 그래프↔완료함↔휴지통처럼 나란히 넘나들 때, 뒤로가기는 항상 메인화면으로 바로 가야 하므로 사용
export function replaceScreen(state) {
  history.replaceState(state, '');
}
