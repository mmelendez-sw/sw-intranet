/**
 * Persistent SharePoint image blob cache (IndexedDB).
 * Avoids localStorage data-URL quota blowups that caused cache misses and slow reloads.
 */

const DB_NAME = 'sw-intranet-images';
const DB_VERSION = 1;
const STORE = 'blobs';

type ImageRecord = {
  url: string;
  blob: Blob;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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
}

export async function idbGetImageBlob(url: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(url);
      req.onsuccess = () => {
        const row = req.result as ImageRecord | undefined;
        resolve(row?.blob || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSetImageBlob(url: string, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put({ url, blob, savedAt: Date.now() } satisfies ImageRecord);
    });
  } catch (err) {
    console.warn('[sharePointImageIdb] write failed:', err);
  }
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
