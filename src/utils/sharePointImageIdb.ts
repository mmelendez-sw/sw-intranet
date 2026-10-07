/**
 * Persistent SharePoint image blob cache (IndexedDB).
 * Avoids localStorage data-URL quota blowups that caused cache misses and slow reloads.
 *
 * Each row carries a version marker (Graph eTag) and the last time it was revalidated so
 * contentService can show the cached blob immediately and re-check SharePoint in the
 * background. The store is capped at MAX_ENTRIES (oldest saved first are evicted).
 */

const DB_NAME = 'sw-intranet-images';
const DB_VERSION = 1;
const STORE = 'blobs';
const MAX_ENTRIES = 200;

export type ImageRecord = {
  url: string;
  blob: Blob;
  savedAt: number;
  /** Last successful revalidation against SharePoint (defaults to savedAt). */
  checkedAt?: number;
  /** Graph driveItem eTag when known; older rows have none. */
  version?: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

export async function idbGetImageRecord(url: string): Promise<ImageRecord | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(url);
      req.onsuccess = () => {
        const row = req.result as ImageRecord | undefined;
        resolve(row?.blob ? row : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSetImageBlob(url: string, blob: Blob, version?: string): Promise<void> {
  try {
    const db = await openDb();
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put({ url, blob, savedAt: now, checkedAt: now, version } satisfies ImageRecord);
    });
    await pruneOldest(db);
  } catch (err) {
    console.warn('[sharePointImageIdb] write failed:', err);
  }
}

/** Record a revalidation that found the cached blob still current. */
export async function idbMarkImageChecked(url: string, version?: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE);
      const req = store.get(url);
      req.onsuccess = () => {
        const row = req.result as ImageRecord | undefined;
        if (!row) return;
        store.put({ ...row, checkedAt: Date.now(), version: version ?? row.version } satisfies ImageRecord);
      };
    });
  } catch {
    // ignore — next visit simply revalidates again
  }
}

/** Evict the oldest-saved rows beyond MAX_ENTRIES. */
async function pruneOldest(db: IDBDatabase): Promise<void> {
  const rows = await new Promise<Array<{ url: string; savedAt: number }>>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result <= MAX_ENTRIES) {
        resolve([]);
        return;
      }
      const collected: Array<{ url: string; savedAt: number }> = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve(collected);
          return;
        }
        const row = cursor.value as ImageRecord;
        collected.push({ url: row.url, savedAt: row.savedAt || 0 });
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    };
    countReq.onerror = () => reject(countReq.error);
  });
  if (rows.length <= MAX_ENTRIES) return;

  rows.sort((a, b) => a.savedAt - b.savedAt);
  const evict = rows.slice(0, rows.length - MAX_ENTRIES);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    evict.forEach((row) => store.delete(row.url));
  });
}

/** Best-effort cleanup of legacy localStorage data-URL image cache keys. */
export function clearLegacyLocalStorageImageCache(): void {
  if (typeof localStorage === 'undefined') return;
  const prefix = 'intranet-sp-img:';
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // ignore
  }
}
