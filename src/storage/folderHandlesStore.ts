import { isIgnoredFolderName } from '../utils/smartLibraryScanner';

export interface BrowserDirectoryHandleLike {
  kind: 'directory';
  name: string;
  entries?: () => AsyncIterable<[string, BrowserHandleEntry]>;
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

interface BrowserFileHandleLike {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
}

type BrowserHandleEntry = BrowserDirectoryHandleLike | BrowserFileHandleLike;

const DB_NAME = 'prism-music-folder-handles';
const DB_VERSION = 1;
const STORE_NAME = 'folderHandles';

let cachedDbPromise: Promise<IDBDatabase | null> | null = null;

function openHandleDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
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

export const supportsDirectoryPicker = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
};

export const pickBrowserDirectoryHandle = async (): Promise<
  | { status: 'picked'; handle: BrowserDirectoryHandleLike }
  | { status: 'cancelled' }
  | { status: 'unsupported' }
> => {
  const picker =
    typeof window !== 'undefined'
      ? (
          window as unknown as {
            showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<BrowserDirectoryHandleLike>;
          }
        ).showDirectoryPicker
      : undefined;

  if (typeof picker !== 'function') {
    return { status: 'unsupported' };
  }

  try {
    const handle = await picker({ mode: 'read' });
    return { status: 'picked', handle };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    // Cross-origin preview frames block showDirectoryPicker with SecurityError — fall back gracefully
    return { status: 'unsupported' };
  }
};

export const ensureDirectoryHandlePermission = async (
  handle: BrowserDirectoryHandleLike
): Promise<boolean> => {
  try {
    if (typeof handle.queryPermission === 'function') {
      const state = await handle.queryPermission({ mode: 'read' });
      if (state === 'granted') return true;
    }
    if (typeof handle.requestPermission === 'function') {
      const requested = await handle.requestPermission({ mode: 'read' });
      return requested === 'granted';
    }
    return true;
  } catch {
    return false;
  }
};

export const saveDirectoryHandle = async (
  folderId: string,
  handle: BrowserDirectoryHandleLike
): Promise<void> => {
  const db = await openHandleDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, folderId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

export const getDirectoryHandle = async (
  folderId: string
): Promise<BrowserDirectoryHandleLike | null> => {
  const db = await openHandleDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(folderId);
      req.onsuccess = () => {
        const res = req.result as BrowserDirectoryHandleLike | undefined;
        resolve(res && res.kind === 'directory' ? res : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const deleteDirectoryHandle = async (folderId: string): Promise<void> => {
  const db = await openHandleDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(folderId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

const isAudioFileCandidate = (file: File): boolean =>
  file.type.startsWith('audio/') ||
  /\.(mp3|m4a|wav|flac|ogg|aac|opus|weba|wma)$/i.test(file.name);

export const collectAudioFilesFromDirectoryHandle = async (
  rootHandle: BrowserDirectoryHandleLike,
  onDiscoverCount?: (count: number) => void
): Promise<Array<{ file: File; folder: string; relativePath: string }>> => {
  const results: Array<{ file: File; folder: string; relativePath: string }> = [];
  const rootName = rootHandle.name || 'Music';

  const walk = async (dir: BrowserDirectoryHandleLike, relFolder: string) => {
    if (typeof dir.entries !== 'function') return;
    try {
      for await (const [entryName, handle] of dir.entries()) {
        if (!entryName) continue;
        if (handle.kind === 'directory') {
          if (isIgnoredFolderName(entryName)) continue;
          await walk(handle, relFolder ? `${relFolder}/${entryName}` : entryName);
        } else if (handle.kind === 'file') {
          try {
            const file = await handle.getFile();
            if (isAudioFileCandidate(file)) {
              const folderLabel = relFolder || rootName;
              results.push({
                file,
                folder: folderLabel,
                relativePath: `${folderLabel}/${file.name}`,
              });
              onDiscoverCount?.(results.length);
            }
          } catch {
            // Skip unreadable file without failing the scan
          }
        }
      }
    } catch {
      // Skip unreadable subdirectory without failing the scan
    }
  };

  await walk(rootHandle, rootName);
  return results;
};
