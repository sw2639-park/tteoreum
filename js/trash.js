import { getDiscardedItems, saveItem, deleteItem } from './db.js';
import { renderInbox } from './inbox.js';

export async function showTrash() {
  const screen = document.getElementById('trash-screen');
  screen.classList.add('active');
  document.getElementById('inbox-screen').classList.remove('active');

  await renderTrash();
}

async function renderTrash() {
  const screen = document.getElementById('trash-screen');
  const items = await getDiscardedItems();
  items.sort((a, b) => new Date(b.discardedAt) - new Date(a.discardedAt));

  screen.innerHTML = `
    <div class="header">
      <div>
        <div class="header-title">휴지통</div>
        <div class="header-sub">7일 후 자동 삭제</div>
      </div>
      <button class="icon-btn" id="back-btn">✕</button>
    </div>
    <div class="trash-list" id="trash-list"></div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    screen.classList.remove('active');
    document.getElementById('inbox-screen').classList.add('active');
    renderInbox();
  });

  const list = document.getElementById('trash-list');

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding-top:60px"><p>휴지통이 비어있음</p></div>`;
    return;
  }

  for (const item of items) {
    const daysLeft = getDaysLeft(item.discardedAt);
    const el = document.createElement('div');
    el.className = 'trash-item';
    el.innerHTML = `
      <div>
        <div class="trash-item-text">${escapeHtml(item.content)}</div>
        <div class="trash-days">${daysLeft}일 후 삭제</div>
      </div>
      <button class="restore-btn" data-id="${item.id}">복원</button>
    `;
    el.querySelector('.restore-btn').addEventListener('click', async () => {
      item.status = 'unhandled';
      delete item.discardedAt;
      await saveItem(item);
      await renderTrash();
    });
    list.appendChild(el);
  }
}

function getDaysLeft(discardedAt) {
  const cutoff = new Date(discardedAt);
  cutoff.setDate(cutoff.getDate() + 7);
  const diff = cutoff - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
