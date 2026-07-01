import { getAllItems, saveItem } from './db.js';
import { activateScreen, pushScreen } from './nav.js';

export function showHandled() {
  pushScreen({ screen: 'handled' });
  return renderHandledScreen();
}

export async function renderHandledScreen() {
  activateScreen('handled-screen');
  await renderHandledList();
}

async function renderHandledList() {
  const screen = document.getElementById('handled-screen');
  const all = await getAllItems();
  const items = all.filter(i => i.status === 'handled');
  items.sort((a, b) => new Date(b.handledAt) - new Date(a.handledAt));

  screen.innerHTML = `
    <div class="header">
      <div>
        <div class="header-title">완료함</div>
        <div class="header-sub">처리된 ${items.length}건</div>
      </div>
      <button class="icon-btn" id="handled-back-btn">✕</button>
    </div>
    <div class="handled-list" id="handled-list"></div>
  `;

  document.getElementById('handled-back-btn').addEventListener('click', () => history.back());

  const list = document.getElementById('handled-list');

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding-top:60px"><p>아직 처리된 항목이 없음</p></div>`;
    return;
  }

  for (const item of items) {
    const chipClass = item.type === 'idea' ? 'chip-idea' : 'chip-note';
    const chipLabel = item.type === 'idea' ? '아이디어' : '메모';
    const el = document.createElement('div');
    el.className = 'handled-item';
    el.innerHTML = `
      <span class="item-type-chip ${chipClass}">${chipLabel}</span>
      <div class="handled-item-body">
        <div class="handled-item-text">${escapeHtml(item.content)}</div>
        <div class="handled-item-meta">${formatDate(item.handledAt)} 처리</div>
      </div>
      <button class="reopen-btn" data-id="${item.id}">되돌리기</button>
    `;
    el.querySelector('.reopen-btn').addEventListener('click', async () => {
      item.status = 'unhandled';
      delete item.handledAt;
      await saveItem(item);
      await renderHandledList();
    });
    list.appendChild(el);
  }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
