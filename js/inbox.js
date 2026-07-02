import { getInboxItems, saveItem, getAllItems } from './db.js';
import { showPopup } from './popup.js';
import { showSnoozeModal } from './snooze.js';
import { setupPullToRefresh } from './gestures.js';
import { showConfirm } from './confirm.js';
import { haptic } from './haptics.js';

const SWIPE_THRESHOLD = 56;
const CONFIRM_THRESHOLD = 90;

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
        <img class="brand-icon" src="/icons/icon-192.png" width="28" height="28" alt="" />
        <div>
          <div class="header-title">떠오름</div>
          <div class="header-sub">미처리 ${unhandledCount}건 · 처리율 ${rate}%</div>
        </div>
      </div>
      <div class="header-icons">
        <button class="icon-btn" id="graph-btn" title="그래프뷰">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </button>
        <button class="icon-btn" id="handled-btn" title="완료함">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg>
        </button>
        <button class="icon-btn" id="trash-btn" title="휴지통">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
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
  document.getElementById('handled-btn').addEventListener('click', () => {
    import('./handled.js').then(m => m.showHandled());
  });

  // 당겨서 새로고침
  const listEl = document.getElementById('inbox-list');
  if (listEl) setupPullToRefresh(listEl, () => renderInbox());

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
  const urgent = items.filter(i => i.urgent);
  const rest = items.filter(i => !i.urgent);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - todayStart.getDay());

  const today = [], thisWeek = [], older = [];
  for (const item of rest) {
    const d = new Date(item.createdAt);
    if (d >= todayStart) today.push(item);
    else if (d >= weekStart) thisWeek.push(item);
    else older.push(item);
  }
  return [['🌟 긴급', urgent], ['오늘', today], ['이번 주', thisWeek], ['오래됨', older]];
}

function buildItemRow(item) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.dataset.id = item.id;

  const chipClass = item.type === 'idea' ? 'chip-idea' : 'chip-note';
  const chipLabel = item.type === 'idea' ? '아이디어' : '메모';
  const dateStr = formatDate(item.createdAt);

  row.innerHTML = `
    <div class="item-bg item-bg-right">보류 ⏰</div>
    <div class="item-bg item-bg-left">처리 ✓</div>
    <div class="item-content">
      <span class="item-type-chip ${chipClass}">${chipLabel}</span>
      ${item.urgent ? '<span class="urgent-badge">★</span>' : ''}
      <div class="item-text">${escapeHtml(item.content)}</div>
      <span class="item-time">${dateStr}</span>
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

    if (dx < -CONFIRM_THRESHOLD) {
      content.style.transform = `translateX(-110%)`;
      await new Promise(r => setTimeout(r, 180));
      await markHandled(item);
    } else if (dx > CONFIRM_THRESHOLD) {
      content.style.transform = 'translateX(0)';
      bgRight.style.opacity = 0;
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
      const ok = await showConfirm('이 항목을 휴지통으로 보낼까요?', '휴지통으로', '취소');
      if (ok) {
        haptic();
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
  haptic();
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
