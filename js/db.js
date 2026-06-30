const DB_NAME = 'tteoreum';
const DB_VERSION = 1;
const STORE = 'captures';

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(mode = 'readonly') {
  return _db.transaction(STORE, mode).objectStore(STORE);
}

export function generateId() {
  return crypto.randomUUID();
}

export async function saveItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx('readwrite').put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getItem(id) {
  await openDB();
  return new Promise((resolve, reject) => {
    const req = tx().get(id);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllItems() {
  await openDB();
  return new Promise((resolve, reject) => {
    const req = tx().getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteItem(id) {
  await openDB();
  return new Promise((resolve, reject) => {
    const req = tx('readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getInboxItems() {
  const all = await getAllItems();
  const now = new Date();
  return all.filter(item => {
    if (item.status === 'discarded' || item.status === 'handled') return false;
    if (item.status === 'snoozed') {
      return item.snoozeUntil && new Date(item.snoozeUntil) <= now;
    }
    return true;
  });
}

export async function getDiscardedItems() {
  const all = await getAllItems();
  return all.filter(i => i.status === 'discarded');
}

export async function purgeOldDiscarded() {
  const all = await getAllItems();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const toDelete = all.filter(i =>
    i.status === 'discarded' && i.discardedAt && new Date(i.discardedAt) < cutoff
  );
  for (const item of toDelete) await deleteItem(item.id);
  return toDelete.length;
}

export async function countUnhandled() {
  const items = await getInboxItems();
  return items.length;
}
