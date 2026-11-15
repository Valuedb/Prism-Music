/**
 * دیتابیس لوکال ساختاریافته بر پایه IndexedDB برای ذخیره‌سازی پایدار و حجیم
 * کتابخانه، پلی‌لیست‌ها، فولدرها، کاورها، متن ترانه و تنظیمات برنامه (مخصوص اجرای مستقل دسکتاپ و PWA).
 */

const APP_DB_NAME = 'apple-music-local-db';
const APP_DB_VERSION = 1;
const STORE_LIBRARY = 'library';
const STORE_PLAYLISTS = 'playlists';
const STORE_SETTINGS = 'settings';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getStoreForKey(key: string): string {
  if (key === 'musicLibrary' || key === 'musicFolders') return STORE_LIBRARY;
  if (key === 'playlists') return STORE_PLAYLISTS;
  return STORE_SETTINGS;
}

function openAppDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(APP_DB_NAME, APP_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_LIBRARY)) {
          db.createObjectStore(STORE_LIBRARY);
        }
        if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
          db.createObjectStore(STORE_PLAYLISTS);
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

export async function dbReadValue<T>(key: string): Promise<T | undefined> {
  const db = await openAppDb();
  if (!db) return undefined;
  const storeName = getStoreForKey(key);

  return new Promise<T | undefined>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function dbWriteValue(key: string, value: unknown): Promise<boolean> {
  const db = await openAppDb();
  if (!db) return false;
  const storeName = getStoreForKey(key);

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function dbDeleteValue(key: string): Promise<void> {
  const db = await openAppDb();
  if (!db) return;
  const storeName = getStoreForKey(key);

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export interface LocalDbStats {
  supported: boolean;
  recordCount: number;
}

export async function getLocalDbStats(): Promise<LocalDbStats> {
  const db = await openAppDb();
  if (!db) return { supported: false, recordCount: 0 };

  const storeNames = [STORE_LIBRARY, STORE_PLAYLISTS, STORE_SETTINGS];
  return new Promise<LocalDbStats>((resolve) => {
    let recordCount = 0;
    try {
      const tx = db.transaction(storeNames, 'readonly');
      for (const name of storeNames) {
        const req = tx.objectStore(name).count();
        req.onsuccess = () => {
          recordCount += req.result || 0;
        };
      }
      tx.oncomplete = () => resolve({ supported: true, recordCount });
      tx.onerror = () => resolve({ supported: true, recordCount: 0 });
    } catch {
      resolve({ supported: false, recordCount: 0 });
    }
  });
}
