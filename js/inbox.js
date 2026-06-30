import { getInboxItems, saveItem, getAllItems } from './db.js';
import { showPopup } from './popup.js';
import { showSnoozeModal } from './snooze.js';

const SWIPE_THRESHOLD = 72;
const CONFIRM_THRESHOLD = 120;

export async function renderInbox() {
  const items = await getInboxItems();
  items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const screen = document.getElementById('inbox-screen');
  const unhandledCount = items.length;
  const allHandled = (await getAllItems()).filter(i => i.status === 'handled').length;
  const total = unhandledCount + allHandled;
  const rate = total > 0 ? Math.round((allHandled / total) * 100) : 0;

  screen.innerHTML = `
    <div class="header">
      <div class="header-brand">
        <svg class="brand-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="15.5" r="5" stroke="currentColor" stroke-width="1.8"/>
          <line x1="12" y1="10.5" x2="12" y2="5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="12" cy="3.5" r="1.8" fill="currentColor"/>
        </svg>
        <div>
          <div class="header-title">떠오름</div>
          <div class="header-sub">미처리 ${unhandledCount}건 · 처리율 ${rate}%</div>
        </div>
      </div>
      <div class="header-icons">
        <button class="icon-btn" id="graph-btn" title="그래프뷰">🕸</button>
        <button class="icon-btn" id="trash-btn" title="휴지통">🗑</button>
      </div>
    </div>
    <div class="inbox-list" id="inbox-list"></div>
    <button class="fab" id="fab-btn">+</button>
  `;

  document.getElementById('fab-btn').addEventListener('click', () => {
    showPopup('icon', () => renderInbox());
  });
  document.getElementById('graph-btn').addEventListener('click', () => {
    import('./graph.js').then(m => m.showGraph());
  });
  document.getElementById('trash-btn').addEventListener('click', () => {
    import('./trash.js').then(m => m.showTrash());
  });

  const list = document.getElementById('inbox-list');

  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p class="empty-main">지금 이 순간은 맑음</p>
        <p class="empty-sub">떠오르는 게 있으면 바로 적어두세요</p>
      </div>
    `;
    return;
  }

  const groups = groupByDate(items);
  for (const [label, groupItems] of groups) {
    if (groupItems.length === 0) continue;
    const labelEl = document.createElement('div');
    labelEl.className = 'date-label';
    labelEl.textContent = label;
    list.appendChild(labelEl);
    for (const item of groupItems) {
      list.appendChild(buildItemRow(item));
    }
  }
}

function groupByDate(items) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - todayStart.getDay());

  const today = [], thisWeek = [], older = [];
  for (const item of items) {
    const d = new Date(item.createdAt);
    if (d >= todayStart) today.push(item);
    else if (d >= weekStart) thisWeek.push(item);
    else older.push(item);
  }
  return [['오늘', today], ['이번 주', thisWeek], ['오래됨', older]];
}

function buildItemRow(item) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.dataset.id = item.id;

  const chipClass = item.type === 'idea' ? 'chip-idea' : 'chip-note';
  const chipLabel = item.type === 'idea' ? '아이디어' : '메모';
  const dateStr = formatDate(item.createdAt);

  row.innerHTML = `
    <div class="item-bg item-bg-right">처리 ✓</div>
    <div class="item-bg item-bg-left">보류 ⏰</div>
    <div class="item-content">
      <span class="item-type-chip ${chipClass}">${chipLabel}</span>
      <div>
        <div class="item-text">${escapeHtml(item.content)}</div>
        <div class="item-meta">${dateStr}</div>
      </div>
    </div>
  `;

  const content = row.querySelector('.item-content');
  const bgRight = row.querySelector('.item-bg-right');
  const bgLeft = row.querySelector('.item-bg-left');

  setupSwipe(row, content, bgRight, bgLeft, item);
  setupLongPress(row, item);
  content.addEventListener('click', () => {
    import('./detail.js').then(m => m.showDetail(item.id));
  });

  return row;
}

function setupSwipe(row, content, bgRight, bgLeft, item) {
  let startX = 0, startY = 0, dx = 0, dragging = false, locked = false;

  row.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0;
    dragging = false;
    locked = false;
  }, { passive: true });

  row.addEventListener('touchmove', (e) => {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    if (!dragging) {
      if (Math.abs(x - startX) < 8 && Math.abs(y - startY) < 8) return;
      if (Math.abs(y - startY) > Math.abs(x - startX)) { locked = true; return; }
      dragging = true;
    }
    if (locked) return;
    e.preventDefault();
    dx = x - startX;
    content.style.transform = `translateX(${dx}px)`;
    const ratio = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
    if (dx > 0) {
      bgRight.style.opacity = ratio;
      bgLeft.style.opacity = 0;
    } else {
      bgLeft.style.opacity = ratio;
      bgRight.style.opacity = 0;
    }
  }, { passive: false });

  row.addEventListener('touchend', async () => {
    if (!dragging || locked) return;
    content.style.transition = 'transform 0.2s ease';
    bgRight.style.transition = 'opacity 0.2s';
    bgLeft.style.transition = 'opacity 0.2s';

    if (dx > CONFIRM_THRESHOLD) {
      content.style.transform = `translateX(110%)`;
      await new Promise(r => setTimeout(r, 180));
      await markHandled(item);
    } else if (dx < -CONFIRM_THRESHOLD) {
      content.style.transform = 'translateX(0)';
      bgLeft.style.opacity = 0;
      showSnoozeModal(item, () => renderInbox());
    } else {
      content.style.transform = 'translateX(0)';
      bgRight.style.opacity = 0;
      bgLeft.style.opacity = 0;
    }
    setTimeout(() => {
      content.style.transition = '';
      bgRight.style.transition = '';
      bgLeft.style.transition = '';
    }, 200);
  });
}

function setupLongPress(row, item) {
  let timer = null;
  const content = row.querySelector('.item-content');

  content.addEventListener('touchstart', () => {
    timer = setTimeout(async () => {
      timer = null;
      if (confirm('이 항목을 휴지통으로 보낼까요?')) {
        item.status = 'discarded';
        item.discardedAt = new Date().toISOString();
        await saveItem(item);
        renderInbox();
      }
    }, 600);
  }, { passive: true });

  content.addEventListener('touchend', () => { clearTimeout(timer); timer = null; });
  content.addEventListener('touchmove', () => { clearTimeout(timer); timer = null; });
}

async function markHandled(item) {
  item.status = 'handled';
  item.handledAt = new Date().toISOString();
  await saveItem(item);
  await renderInbox();
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffH = diffMs / 3600000;
  if (diffH < 1) return `${Math.max(1, Math.round(diffMs / 60000))}분 전`;
  if (diffH < 24) return `${Math.round(diffH)}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
