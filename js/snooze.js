import { saveItem } from './db.js';

export function showSnoozeModal(item, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const tomorrow = addDays(1);
  const in3 = addDays(3);
  const nextWeek = addDays(7);

  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">언제 다시 볼까요?</div>
      <div class="snooze-presets">
        <button class="snooze-btn" data-date="${tomorrow}">내일 (${fmtDate(tomorrow)})</button>
        <button class="snooze-btn" data-date="${in3}">3일 후 (${fmtDate(in3)})</button>
        <button class="snooze-btn" data-date="${nextWeek}">다음 주 (${fmtDate(nextWeek)})</button>
        <button class="snooze-btn custom-btn" id="custom-snooze">직접 선택…</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('[data-date]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await snoozeItem(item, btn.dataset.date);
      overlay.remove();
      onDone();
    });
  });

  overlay.querySelector('#custom-snooze').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'date';
    input.min = addDays(1).slice(0, 10);
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(input);
    input.showPicker?.();
    input.addEventListener('change', async () => {
      if (input.value) {
        await snoozeItem(item, input.value + 'T07:00:00');
        overlay.remove();
        input.remove();
        onDone();
      }
    });
    input.addEventListener('blur', () => { input.remove(); });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

async function snoozeItem(item, dateStr) {
  item.status = 'snoozed';
  item.snoozeUntil = new Date(dateStr).toISOString();
  await saveItem(item);
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(7, 0, 0, 0);
  return d.toISOString();
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
