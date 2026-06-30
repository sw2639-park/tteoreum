import { purgeOldDiscarded } from './db.js';
import { renderInbox } from './inbox.js';
import { showPopup } from './popup.js';

async function init() {
  // 7일 지난 휴지통 항목 자동 삭제
  await purgeOldDiscarded();

  const params = new URLSearchParams(location.search);
  const popup = params.get('popup') === '1';
  const source = params.get('source') || 'icon';

  // 인박스를 항상 기본으로 렌더
  await renderInbox();
  document.getElementById('inbox-screen').classList.add('active');

  if (popup) {
    showPopup(source, () => renderInbox());
  }
}

init().catch(console.error);
