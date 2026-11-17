const DB_NAME = 'prism-music-media-db';
const DB_VERSION = 1;
const AUDIO_STORE = 'audioBlobs';

let cachedDbPromise: Promise<IDBDatabase | null> | null = null;

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          db.createObjectStore(AUDIO_STORE);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          cachedDbPromise = null;
        };
        db.onclose = () => {
          cachedDbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        cachedDbPromise = null;
        resolve(null);
      };
    } catch {
      cachedDbPromise = null;
      resolve(null);
    }
  });

  return cachedDbPromise;
}

export async function saveAudioBlob(songId: string, blob: Blob): Promise<void> {
  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE, 'readwrite');
      tx.objectStore(AUDIO_STORE).put(blob, songId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getAudioBlob(songId: string): Promise<Blob | null> {
  const db = await openMediaDb();
  if (!db) return null;

  return new Promise<Blob | null>((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE, 'readonly');
      const req = tx.objectStore(AUDIO_STORE).get(songId);
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** بازیابی دسته‌ای فایل‌های صوتی برای سرعت بالا هنگام باز کردن کتابخانه‌های بزرگ در دسکتاپ */
export async function getAudioBlobsBatch(songIds: string[]): Promise<Map<string, Blob>> {
  const result = new Map<string, Blob>();
  if (songIds.length === 0) return result;
  const db = await openMediaDb();
  if (!db) return result;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE, 'readonly');
      const store = tx.objectStore(AUDIO_STORE);
      for (const id of songIds) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result instanceof Blob) {
            result.set(id, req.result);
          }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

  return result;
}

export async function deleteAudioBlob(songId: string): Promise<void> {
  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE, 'readwrite');
      tx.objectStore(AUDIO_STORE).delete(songId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export interface AudioStorageStats {
  count: number;
  totalBytes: number;
}

/** محاسبه تعداد و حجم کل فایل‌های صوتی ذخیره‌شده در IndexedDB */
export async function getAudioStorageStats(): Promise<AudioStorageStats> {
  const db = await openMediaDb();
  if (!db) return { count: 0, totalBytes: 0 };

  return new Promise<AudioStorageStats>((resolve) => {
    let count = 0;
    let totalBytes = 0;
    try {
      const tx = db.transaction(AUDIO_STORE, 'readonly');
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        count += 1;
        if (cursor.value instanceof Blob) {
          totalBytes += cursor.value.size;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve({ count, totalBytes });
      tx.onerror = () => resolve({ count: 0, totalBytes: 0 });
    } catch {
      resolve({ count: 0, totalBytes: 0 });
    }
  });
}

/** پاک‌سازی فایل‌های صوتی بی‌صاحب که دیگر در کتابخانه وجود ندارند */
export async function cleanupOrphanAudioBlobs(
  validSongIds: Set<string>
): Promise<{ removedCount: number; freedBytes: number }> {
  const db = await openMediaDb();
  if (!db) return { removedCount: 0, freedBytes: 0 };

  return new Promise<{ removedCount: number; freedBytes: number }>((resolve) => {
    let removedCount = 0;
    let freedBytes = 0;
    try {
      const tx = db.transaction(AUDIO_STORE, 'readwrite');
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = String(cursor.key);
        if (!validSongIds.has(key)) {
          if (cursor.value instanceof Blob) {
            freedBytes += cursor.value.size;
          }
          removedCount += 1;
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve({ removedCount, freedBytes });
      tx.onerror = () => resolve({ removedCount: 0, freedBytes: 0 });
    } catch {
      resolve({ removedCount: 0, freedBytes: 0 });
    }
  });
}

export async function clearAllAudioBlobs(): Promise<void> {
  const db = await openMediaDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(AUDIO_STORE, 'readwrite');
      tx.objectStore(AUDIO_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
