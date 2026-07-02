import { getItem, saveItem } from './db.js';
import { showSnoozeModal } from './snooze.js';
import { setupSwipeBack } from './gestures.js';
import { pushScreen } from './nav.js';
import { haptic } from './haptics.js';

const RELAY = 'https://tteoreum-relay.vercel.app';

let overlayEl = null;
let cleanupSwipe = null;
let currentItem = null;

export function showDetail(id) {
  pushScreen({ screen: 'detail', id });
  return renderDetailPopup(id);
}

export async function renderDetailPopup(id) {
  const item = await getItem(id);
  if (!item) { history.back(); return; }
  currentItem = item;

  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'detail-overlay';
    document.body.appendChild(overlayEl);
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) closeWithSave();
    });
    cleanupSwipe = setupSwipeBack(() => closeWithSave());
  }

  renderCard(item);
}

export function closeDetailPopup() {
  cleanupSwipe?.();
  cleanupSwipe = null;
  overlayEl?.remove();
  overlayEl = null;
  currentItem = null;
}

async function closeWithSave() {
  if (currentItem) {
    syncContentEdit(currentItem);
    await saveItem(currentItem);
  }
  history.back();
}

// 수정 중인 textarea 내용을 item에 반영 (빈 내용이면 원래 내용 유지)
function syncContentEdit(item) {
  const ta = overlayEl?.querySelector('#detail-content-input');
  if (!ta) return;
  const val = ta.value.trim();
  if (val) item.content = val;
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
        <button class="icon-btn urgent-toggle-btn ${item.urgent ? 'active' : ''}" id="urgent-toggle" aria-label="긴급 표시" title="긴급">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${item.urgent ? '#FFD27A' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </button>
      </div>
      <div class="detail-popup-body">
        <textarea class="detail-content" id="detail-content-input" rows="1">${escapeHtml(item.content)}</textarea>
        ${item.tags?.length ? `
          <div class="detail-tags">
            ${item.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        <button class="develop-btn" id="d-develop">✨ 발전</button>
        ${item.aiSummary ? `
          <div class="ai-summary">
            <div class="ai-summary-label">발전 결과</div>
            <div class="ai-summary-text">${escapeHtml(item.aiSummary)}</div>
          </div>
        ` : ''}
      </div>
      <div class="detail-actions">
        ${item.status === 'handled' ? `
          <button class="action-btn snooze-btn-d" id="d-undo">되돌리기</button>
          <button class="action-btn discard-btn" id="d-discard">폐기</button>
        ` : `
          <button class="action-btn handled-btn" id="d-handle">처리</button>
          <button class="action-btn snooze-btn-d" id="d-snooze">보류</button>
          <button class="action-btn discard-btn" id="d-discard">폐기</button>
        `}
      </div>
    </div>
  `;

  const textarea = overlayEl.querySelector('#detail-content-input');
  autoGrow(textarea);
  textarea.addEventListener('input', () => autoGrow(textarea));

  overlayEl.querySelector('#d-develop').addEventListener('click', async (e) => {
    syncContentEdit(item);
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '생각하는 중…';
    try {
      const res = await fetch(`${RELAY}/api/develop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.content }),
      });
      if (!res.ok) throw new Error('develop failed');
      const { summary } = await res.json();
      item.aiSummary = summary;
      await saveItem(item);
      renderCard(item);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '✨ 발전';
      console.warn('develop failed:', err.message);
    }
  });

  overlayEl.querySelector('#type-toggle').addEventListener('click', async () => {
    syncContentEdit(item);
    item.type = item.type === 'idea' ? 'note' : 'idea';
    await saveItem(item);
    renderCard(item);
  });

  overlayEl.querySelector('#urgent-toggle').addEventListener('click', async () => {
    syncContentEdit(item);
    item.urgent = !item.urgent;
    await saveItem(item);
    renderCard(item);
  });

  overlayEl.querySelector('#d-handle')?.addEventListener('click', async () => {
    syncContentEdit(item);
    haptic();
    item.status = 'handled';
    item.handledAt = new Date().toISOString();
    await saveItem(item);
    history.back();
  });

  overlayEl.querySelector('#d-snooze')?.addEventListener('click', () => {
    syncContentEdit(item);
    showSnoozeModal(item, () => history.back());
  });

  overlayEl.querySelector('#d-undo')?.addEventListener('click', async () => {
    syncContentEdit(item);
    haptic();
    item.status = 'unhandled';
    delete item.handledAt;
    await saveItem(item);
    history.back();
  });

  overlayEl.querySelector('#d-discard').addEventListener('click', async () => {
    syncContentEdit(item);
    haptic();
    item.status = 'discarded';
    item.discardedAt = new Date().toISOString();
    await saveItem(item);
    history.back();
  });
}

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
