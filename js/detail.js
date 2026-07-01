import { getItem, saveItem } from './db.js';
import { showSnoozeModal } from './snooze.js';
import { setupSwipeBack } from './gestures.js';
import { pushScreen } from './nav.js';

let overlayEl = null;
let cleanupSwipe = null;

export function showDetail(id) {
  pushScreen({ screen: 'detail', id });
  return renderDetailPopup(id);
}

export async function renderDetailPopup(id) {
  const item = await getItem(id);
  if (!item) { history.back(); return; }

  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'detail-overlay';
    document.body.appendChild(overlayEl);
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) history.back();
    });
    cleanupSwipe = setupSwipeBack(() => history.back());
  }

  renderCard(item);
}

export function closeDetailPopup() {
  cleanupSwipe?.();
  cleanupSwipe = null;
  overlayEl?.remove();
  overlayEl = null;
}

function renderCard(item) {
  const chipClass = item.type === 'idea' ? 'chip-idea' : 'chip-note';
  const chipLabel = item.type === 'idea' ? '아이디어' : '메모';
  const dateStr = new Date(item.createdAt).toLocaleString('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  overlayEl.innerHTML = `
    <div class="detail-popup-card">
      <div class="detail-popup-top">
        <span class="detail-type-chip item-type-chip ${chipClass}" id="type-toggle">${chipLabel}</span>
        <span class="detail-popup-date">${dateStr}</span>
        <button class="icon-btn detail-close-btn" id="detail-close">✕</button>
      </div>
      <div class="detail-popup-body">
        <div class="detail-content">${escapeHtml(item.content)}</div>
      </div>
      <div class="detail-actions">
        <button class="action-btn handled-btn" id="d-handle">처리 ✓</button>
        <button class="action-btn snooze-btn-d" id="d-snooze">보류 ⏰</button>
        <button class="action-btn discard-btn" id="d-discard">폐기</button>
      </div>
    </div>
  `;

  overlayEl.querySelector('#detail-close').addEventListener('click', () => history.back());

  overlayEl.querySelector('#type-toggle').addEventListener('click', async () => {
    item.type = item.type === 'idea' ? 'note' : 'idea';
    await saveItem(item);
    renderCard(item);
  });

  overlayEl.querySelector('#d-handle').addEventListener('click', async () => {
    item.status = 'handled';
    item.handledAt = new Date().toISOString();
    await saveItem(item);
    history.back();
  });

  overlayEl.querySelector('#d-snooze').addEventListener('click', () => {
    showSnoozeModal(item, () => history.back());
  });

  overlayEl.querySelector('#d-discard').addEventListener('click', async () => {
    item.status = 'discarded';
    item.discardedAt = new Date().toISOString();
    await saveItem(item);
    history.back();
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
