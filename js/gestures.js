// 드래그백: 왼쪽 끝에서 오른쪽으로 스와이프 → 뒤로가기
export function setupSwipeBack(onBack) {
  const EDGE = 36;       // 왼쪽 가장자리 감지 영역 (px)
  const MIN_DIST = 80;   // 최소 이동 거리

  let startX = 0, startY = 0, active = false;

  function onStart(e) {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    if (x > EDGE) return;
    startX = x; startY = y; active = true;
  }

  function onEnd(e) {
    if (!active) return;
    active = false;
    const x = e.changedTouches[0].clientX;
    const y = e.changedTouches[0].clientY;
    const dx = x - startX;
    const dy = Math.abs(y - startY);
    if (dx > MIN_DIST && dy < dx * 0.6) onBack();
  }

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchend', onEnd, { passive: true });

  return () => {
    document.removeEventListener('touchstart', onStart);
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
