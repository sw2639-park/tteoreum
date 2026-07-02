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

  document.addEventListener('keydown', onKeyDown);
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
