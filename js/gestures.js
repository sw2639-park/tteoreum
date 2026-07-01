// 드래그백: 화면 어디서나 오른쪽으로 밀면 뒤로가기
// (Android OS가 왼쪽 엣지를 가져가므로 엣지 제한 없이 전체 감지)
export function setupSwipeBack(onBack) {
  const MIN_DIST = 90;  // 최소 수평 이동 (px)
  const MAX_V_RATIO = 0.55; // 수직 비율 상한 (이 이하여야 수평 제스처로 인식)

  let startX = 0, startY = 0, tracking = false, cancelled = false;

  function onStart(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
    cancelled = false;
  }

  function onMove(e) {
    if (!tracking || cancelled) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    // 수직 움직임이 명확하면 스크롤로 판단, 취소
    if (dy > 18 && dy > Math.abs(dx)) cancelled = true;
  }

  function onEnd(e) {
    if (!tracking) return;
    tracking = false;
    if (cancelled) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (dx > MIN_DIST && dy < dx * MAX_V_RATIO) onBack();
  }

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd, { passive: true });

  return () => {
    document.removeEventListener('touchstart', onStart);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  };
}

// 당겨서 새로고침: 스크롤 최상단에서 아래로 당기면 콜백 실행
export function setupPullToRefresh(scrollEl, onRefresh) {
  const THRESHOLD = 64;
  let startY = 0, pulling = false, indicator = null;

  function getIndicator() {
    if (indicator) return indicator;
    indicator = document.createElement('div');
    indicator.className = 'ptr-indicator';
    indicator.innerHTML = '↓';
    scrollEl.parentElement.insertBefore(indicator, scrollEl);
    return indicator;
  }

  function onStart(e) {
    if (scrollEl.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }

  function onMove(e) {
    if (!pulling) return;
    if (scrollEl.scrollTop > 0) { pulling = false; resetUI(); return; }
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) return;
    e.preventDefault();
    const ratio = Math.min(dy / THRESHOLD, 1);
    const ind = getIndicator();
    ind.style.height = (dy * 0.45) + 'px';
    ind.style.opacity = ratio;
    ind.style.transform = `rotate(${ratio * 180}deg)`;
  }

  async function onEnd(e) {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy >= THRESHOLD) {
      const ind = getIndicator();
      ind.innerHTML = '↻';
      ind.style.transform = 'rotate(0deg)';
      await onRefresh();
    }
    resetUI();
  }

  function resetUI() {
    if (!indicator) return;
    indicator.style.height = '0';
    indicator.style.opacity = '0';
    indicator.innerHTML = '↓';
    indicator.style.transform = 'rotate(0deg)';
  }

  scrollEl.addEventListener('touchstart', onStart, { passive: true });
  scrollEl.addEventListener('touchmove', onMove, { passive: false });
  scrollEl.addEventListener('touchend', onEnd, { passive: true });

  return () => {
    scrollEl.removeEventListener('touchstart', onStart);
    scrollEl.removeEventListener('touchmove', onMove);
    scrollEl.removeEventListener('touchend', onEnd);
    indicator?.remove();
    indicator = null;
  };
}
