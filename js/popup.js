import { saveItem, generateId } from './db.js';

let currentType = 'note';
let currentUrgent = false;
let overlayEl = null;
let textareaEl = null;
let onCloseCallback = null;

export function showPopup(source = 'icon', onClose) {
  onCloseCallback = onClose;
  currentType = 'note';
  currentUrgent = false;

  overlayEl = document.createElement('div');
  overlayEl.className = 'popup-overlay';
  overlayEl.innerHTML = `
    <div class="popup-card" id="popup-card">
      <button class="urgent-star-btn" id="urgent-toggle" aria-label="긴급 표시" title="긴급">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </button>
      <textarea class="popup-textarea" id="popup-ta" placeholder="지금 떠오른 것을 적어요" rows="4"></textarea>
      <div class="popup-chips">
        <button class="type-chip-btn active-note" id="chip-note">메모</button>
        <button class="type-chip-btn inactive" id="chip-idea">아이디어</button>
      </div>
      <div class="popup-footer">
        <p class="popup-hint">바깥 탭해도 저장돼요</p>
        <button class="popup-save-btn" id="popup-save">저장</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);
  textareaEl = overlayEl.querySelector('#popup-ta');

  // 키보드가 올라오면 overlay를 visual viewport에 맞게 재조정
  function adjustViewport() {
    if (!window.visualViewport) return;
    const vv = window.visualViewport;
    overlayEl.style.top = vv.offsetTop + 'px';
    overlayEl.style.height = vv.height + 'px';
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', adjustViewport);
    window.visualViewport.addEventListener('scroll', adjustViewport);
  }
  overlayEl._cleanupViewport = () => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', adjustViewport);
      window.visualViewport.removeEventListener('scroll', adjustViewport);
    }
  };

  textareaEl.focus();

  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) saveAndClose();
  });

  overlayEl.querySelector('#chip-note').addEventListener('click', () => setType('note'));
  overlayEl.querySelector('#chip-idea').addEventListener('click', () => setType('idea'));
  overlayEl.querySelector('#popup-save').addEventListener('click', () => saveAndClose());
  overlayEl.querySelector('#urgent-toggle').addEventListener('click', () => toggleUrgent());

  setupSwipeToClose(overlayEl.querySelector('#popup-card'));

  document.addEventListener('keydown', onKeyDown);
}

// 오른쪽에서 왼쪽으로 밀면 카드가 밀려나가며 닫힘 (저장 포함)
function setupSwipeToClose(card) {
  const THRESHOLD = 80;
  let startX = 0, startY = 0, dx = 0, dragging = false, locked = false;

  card.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0;
    dragging = false;
    locked = false;
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    if (!dragging) {
      if (Math.abs(x - startX) < 8 && Math.abs(y - startY) < 8) return;
      if (Math.abs(y - startY) > Math.abs(x - startX)) { locked = true; return; }
      dragging = true;
    }
    if (locked) return;
    dx = Math.min(x - startX, 0); // 왼쪽으로 미는 동작만 반응
    card.style.transform = `translateX(${dx}px)`;
    card.style.opacity = String(Math.max(1 - Math.abs(dx) / 240, 0.4));
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (!dragging || locked) return;
    card.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    if (dx < -THRESHOLD) {
      card.style.transform = 'translateX(-120%)';
      card.style.opacity = '0';
      setTimeout(() => saveAndClose(), 180);
    } else {
      card.style.transform = 'translateX(0)';
      card.style.opacity = '1';
      setTimeout(() => { card.style.transition = ''; }, 200);
    }
  });
}

function toggleUrgent() {
  currentUrgent = !currentUrgent;
  const btn = overlayEl.querySelector('#urgent-toggle');
  btn.classList.toggle('active', currentUrgent);
  btn.querySelector('path').setAttribute('fill', currentUrgent ? '#FFD27A' : 'none');
}

function setType(type) {
  currentType = type;
  const noteBtn = overlayEl.querySelector('#chip-note');
  const ideaBtn = overlayEl.querySelector('#chip-idea');
  if (type === 'note') {
    noteBtn.className = 'type-chip-btn active-note';
    ideaBtn.className = 'type-chip-btn inactive';
  } else {
    noteBtn.className = 'type-chip-btn inactive';
    ideaBtn.className = 'type-chip-btn active-idea';
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') saveAndClose();
}

async function saveAndClose() {
  const content = textareaEl?.value?.trim();
  if (content) {
    const item = {
      id: generateId(),
      content,
      source: 'icon',
      createdAt: new Date().toISOString(),
      status: 'unhandled',
      type: currentType,
      urgent: currentUrgent,
    };
    await saveItem(item);
  }
  close();
}

function close() {
  document.removeEventListener('keydown', onKeyDown);
  overlayEl?._cleanupViewport?.();
  overlayEl?.remove();
  overlayEl = null;
  textareaEl = null;
  if (onCloseCallback) onCloseCallback();
}
