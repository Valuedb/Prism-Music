import type { DesktopFolderScanResult, DesktopPickedFile, Song } from '../types/index.ts';

export const buildDesktopMediaUrl = (sourcePath: string): string => {
  const g = globalThis as {
    desktopRuntime?: { isDesktop?: boolean };
    __TAURI_INTERNALS__?: { convertFileSrc?: (path: string) => string };
    __TAURI__?: {
      core?: { convertFileSrc?: (path: string) => string };
      tauri?: { convertFileSrc?: (path: string) => string };
    };
  };
  const tauriConvert =
    g.__TAURI_INTERNALS__?.convertFileSrc ??
    g.__TAURI__?.core?.convertFileSrc ??
    g.__TAURI__?.tauri?.convertFileSrc;

  if (typeof tauriConvert === 'function') {
    try {
      return tauriConvert(sourcePath);
    } catch {
      // fallback to standard media URL
    }
  }
  return `media://local?path=${encodeURIComponent(sourcePath)}`;
};

export const normalizeDiskPath = (targetPath: string, platform?: string): string => {
  const trimmed = targetPath.trim();
  if (!trimmed) return '';
  const uncPrefix = /^(\\\\|\/\/)/.test(trimmed);
  let normalized = trimmed.replace(/[\\/]+/g, '/');
  if (uncPrefix && !normalized.startsWith('//')) {
    normalized = `//${normalized.replace(/^\/+/, '')}`;
  }
  if (normalized.length > 1 && !/^[a-zA-Z]:\/$/.test(normalized)) {
    normalized = normalized.replace(/\/+$/, '');
  }
  const detectedPlatform =
    platform ?? (typeof window !== 'undefined' ? window.desktopRuntime?.platform : undefined);
  const isWindowsStyle =
    detectedPlatform === 'win32' || /^[a-zA-Z]:\//.test(normalized) || uncPrefix;
  return isWindowsStyle ? normalized.toLowerCase() : normalized;
};

export interface FolderSyncDelta {
  newEntries: DesktopPickedFile[];
  restoredUpdates: Map<string, { fileUrl: string; linkedFolderPath: string; folder?: string }>;
  removedIds: string[];
  missingIds: string[];
}

/**
 * محاسبه دقیق تغییرات پوشه متصل (فایل‌های جدید، فایل‌های بازیابی‌شده، فایل‌های حذف/جابه‌جا شده و قطع دسترسی موقت پوشه)
 */
export const computeFolderSyncDelta = (
  scan: DesktopFolderScanResult,
  existingSongs: readonly Song[],
  linkedFolderPath?: string
): FolderSyncDelta => {
  const rootKey = normalizeDiskPath(linkedFolderPath || scan.folderPath);
  const restoredUpdates = new Map<
    string,
    { fileUrl: string; linkedFolderPath: string; folder?: string }
  >();
  const removedIds: string[] = [];
  const missingIds: string[] = [];

  if (scan.missing) {
    for (const song of existingSongs) {
      const ownedByFolder =
        song.linkedFolderPath && normalizeDiskPath(song.linkedFolderPath) === rootKey;
      if (ownedByFolder && !song.fileMissing) {
        missingIds.push(song.id);
      }
    }
    return { newEntries: [], restoredUpdates, removedIds, missingIds };
  }

  const scannedByPath = new Map<string, DesktopPickedFile>();
  for (const f of scan.files) {
    scannedByPath.set(normalizeDiskPath(f.path), f);
  }

  const existingByPath = new Map<string, Song>();
  for (const song of existingSongs) {
    if (song.sourcePath) {
      existingByPath.set(normalizeDiskPath(song.sourcePath), song);
    }
  }

  for (const song of existingSongs) {
    const ownedByFolder =
      song.linkedFolderPath && normalizeDiskPath(song.linkedFolderPath) === rootKey;
    const pathKey = song.sourcePath ? normalizeDiskPath(song.sourcePath) : '';
    const matched = pathKey ? scannedByPath.get(pathKey) : undefined;

    if (matched) {
      const expectedUrl = buildDesktopMediaUrl(matched.path);
      const needsRestore =
        Boolean(song.fileMissing) ||
        song.fileUrl !== expectedUrl ||
        (!song.linkedFolderPath && Boolean(linkedFolderPath || scan.folderPath));
      if (needsRestore) {
        restoredUpdates.set(song.id, {
          fileUrl: expectedUrl,
          linkedFolderPath: linkedFolderPath || scan.folderPath,
          folder: matched.folder || song.folder,
        });
      }
    } else if (ownedByFolder) {
      removedIds.push(song.id);
    }
  }

  const newEntries = scan.files.filter((f) => !existingByPath.has(normalizeDiskPath(f.path)));
  return { newEntries, restoredUpdates, removedIds, missingIds };
};
