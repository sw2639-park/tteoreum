import { getItem, saveItem } from './db.js';
import { renderInbox } from './inbox.js';
import { showSnoozeModal } from './snooze.js';
import { setupSwipeBack } from './gestures.js';

let _cleanupSwipeBack = null;

export async function showDetail(id) {
  const item = await getItem(id);
  if (!item) return;

  const screen = document.getElementById('detail-screen');
  screen.classList.add('active');
  document.getElementById('inbox-screen').classList.remove('active');

  _cleanupSwipeBack?.();
  _cleanupSwipeBack = setupSwipeBack(() => goBack());

  renderDetail(item, screen);
}

function renderDetail(item, screen) {
  const chipClass = item.type === 'idea' ? 'chip-idea' : 'chip-note';
  const chipLabel = item.type === 'idea' ? '아이디어' : '메모';
  const dateStr = new Date(item.createdAt).toLocaleString('ko-KR', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  screen.innerHTML = `
    <div class="header">
      <button class="icon-btn" id="detail-back">←</button>
      <div class="header-title">상세</div>
      <div style="width:36px"></div>
    </div>
    <div class="detail-body">
      <div class="detail-content">${escapeHtml(item.content)}</div>
      <div class="detail-meta">
        <span class="detail-type-chip item-type-chip ${chipClass}" id="type-toggle">${chipLabel}</span>
        <span>${dateStr}</span>
      </div>
    </div>
    <div class="detail-actions">
      <button class="action-btn handled-btn" id="d-handle">처리 ✓</button>
      <button class="action-btn snooze-btn-d" id="d-snooze">보류 ⏰</button>
      <button class="action-btn discard-btn" id="d-discard">폐기</button>
    </div>
  `;

  document.getElementById('detail-back').addEventListener('click', goBack);

  document.getElementById('type-toggle').addEventListener('click', async () => {
    item.type = item.type === 'idea' ? 'note' : 'idea';
    await saveItem(item);
    renderDetail(item, screen);
  });

  document.getElementById('d-handle').addEventListener('click', async () => {
    item.status = 'handled';
    item.handledAt = new Date().toISOString();
    await saveItem(item);
    goBack();
  });

  document.getElementById('d-snooze').addEventListener('click', () => {
    showSnoozeModal(item, goBack);
  });

  document.getElementById('d-discard').addEventListener('click', async () => {
    item.status = 'discarded';
    item.discardedAt = new Date().toISOString();
    await saveItem(item);
    goBack();
  });
}

function goBack() {
  _cleanupSwipeBack?.();
  _cleanupSwipeBack = null;
  document.getElementById('detail-screen').classList.remove('active');
  document.getElementById('inbox-screen').classList.add('active');
  renderInbox();
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
