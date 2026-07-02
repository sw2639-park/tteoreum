// 브라우저 기본 confirm() 대신 앱 스타일에 맞춘 확인 모달
export function showConfirm(message, confirmLabel = '확인', cancelLabel = '취소') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-card">
        <p class="confirm-message">${message}</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-cancel" id="confirm-cancel">${cancelLabel}</button>
          <button class="confirm-btn confirm-ok" id="confirm-ok">${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector('#confirm-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('#confirm-ok').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
  });
}
