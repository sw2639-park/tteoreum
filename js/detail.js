import { getItem, saveItem } from './db.js';
import { showSnoozeModal } from './snooze.js';
import { activateScreen, pushScreen } from './nav.js';

export function showDetail(id) {
  pushScreen({ screen: 'detail', id });
  return renderDetailScreen(id);
}

export async function renderDetailScreen(id) {
  const item = await getItem(id);
  if (!item) { history.back(); return; }

  activateScreen('detail-screen');
  renderDetail(item, document.getElementById('detail-screen'));
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

  document.getElementById('detail-back').addEventListener('click', () => history.back());

  document.getElementById('type-toggle').addEventListener('click', async () => {
    item.type = item.type === 'idea' ? 'note' : 'idea';
    await saveItem(item);
    renderDetail(item, screen);
  });

  document.getElementById('d-handle').addEventListener('click', async () => {
    item.status = 'handled';
    item.handledAt = new Date().toISOString();
    await saveItem(item);
    history.back();
  });

  document.getElementById('d-snooze').addEventListener('click', () => {
    showSnoozeModal(item, () => history.back());
  });

  document.getElementById('d-discard').addEventListener('click', async () => {
    item.status = 'discarded';
    item.discardedAt = new Date().toISOString();
    await saveItem(item);
    history.back();
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
