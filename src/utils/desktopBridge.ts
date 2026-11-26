import type { DesktopFolderScanResult, DesktopPickedFile, LinkedFolder, Song } from '../types';
import { blobToCompactDataUrl, createFallbackCoverSvg, extractLyricsFromCommon } from './audioMetadata';
import {
  buildDesktopMediaUrl,
  computeFolderSyncDelta,
  normalizeDiskPath,
  type FolderSyncDelta,
} from './desktopPaths';
import { assignBatchAddedAt } from './smartPlaylists';

export {
  buildDesktopMediaUrl,
  computeFolderSyncDelta,
  normalizeDiskPath,
  type FolderSyncDelta,
};

export const isDesktopRuntime = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.desktopRuntime?.isDesktop);

export const getDroppedFileDiskPath = (file: File): string => {
  if (typeof window === 'undefined' || !window.desktopRuntime?.isDesktop) return '';
  try {
    const resolved = window.desktopRuntime.getPathForFile?.(file);
    if (resolved) return resolved;
  } catch {
    // ignore preload bridge error
  }
  const legacyPath = (file as File & { path?: string }).path;
  return typeof legacyPath === 'string' ? legacyPath : '';
};

const waitMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getMimeFromFileName = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.opus')) return 'audio/opus';
  if (lower.endsWith('.weba')) return 'audio/webm';
  return 'audio/mpeg';
};

const probeMediaDuration = (mediaUrl: string): Promise<number> =>
  new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    if (/^https?:/i.test(mediaUrl) && !mediaUrl.includes('asset.localhost')) {
      audio.crossOrigin = 'anonymous';
    }
    const done = (val: number) => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      resolve(val);
    };
    audio.onloadedmetadata = () => {
      done(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.onerror = () => done(0);
    audio.src = mediaUrl;
  });

/**
 * استخراج متادیتا از فایل روی هارد بدون کپی کردن فایل صوتی به IndexedDB (راهکار ۱)
 * در صورت قفل بودن لحظه‌ای فایل حین کپی در اکسپلورر، یک‌بار با تاخیر کوتاه مجدد تلاش می‌شود.
 */
export const extractSongFromDiskFile = async (
  picked: DesktopPickedFile,
  options?: { fallbackFolder?: string; linkedFolderPath?: string }
): Promise<Song | null> => {
  try {
    const api = typeof window !== 'undefined' ? window.desktopRuntime : undefined;
    let bytes = await api?.readFileBytes?.(picked.path);
    if ((!bytes || bytes.byteLength === 0) && api?.readFileBytes) {
      await waitMs(550);
      bytes = await api.readFileBytes(picked.path);
    }

    const mediaUrl = buildDesktopMediaUrl(picked.path);
    const baseTitle = picked.name.replace(/\.[^/.]+$/, '');

    let title = baseTitle;
    let artist = 'Unknown';
    let album: string | undefined;
    let year: string | undefined;
    let lyrics: string | undefined;
    let coverUrl = '';
    let duration = 0;

    if (bytes && bytes.byteLength > 0) {
      const { parseBuffer } = await import('music-metadata');
      const metadata = await parseBuffer(bytes, { mimeType: getMimeFromFileName(picked.name) });
      title = metadata.common.title || baseTitle;
      artist = metadata.common.artist || 'Unknown';
      album = metadata.common.album;
      year = metadata.common.year ? String(metadata.common.year) : undefined;
      lyrics = extractLyricsFromCommon(metadata.common.lyrics);
      duration = metadata.format.duration || 0;

      const picture = metadata.common.picture?.[0];
      if (picture) {
        const blob = new Blob([picture.data as BlobPart], { type: picture.format || 'image/jpeg' });
        coverUrl = await blobToCompactDataUrl(blob);
      }
    } else if (api?.readFileBytes) {
      // فایل هنوز توسط سیستم‌عامل قفل است یا خالی است؛ از ایندکس ناقص صرف‌نظر کن تا در تلاش مجدد خوانده شود
      return null;
    }

    if (!coverUrl) {
      coverUrl = createFallbackCoverSvg(title);
    }

    if (duration === 0) {
      duration = await probeMediaDuration(mediaUrl);
    }

    return {
      id: crypto.randomUUID(),
      name: title,
      artist,
      album,
      year,
      folder: picked.folder || options?.fallbackFolder?.trim() || undefined,
      lyrics,
      cover: coverUrl,
      fileUrl: mediaUrl,
      sourcePath: picked.path,
      linkedFolderPath: options?.linkedFolderPath,
      fileMissing: false,
      playCount: 0,
      addedAt: Date.now(),
      duration,
    };
  } catch (err) {
    console.error('[desktop] failed to index audio file:', picked.path, err);
    return null;
  }
};

export const extractDiskSongsBatched = async (
  files: DesktopPickedFile[],
  options?: { fallbackFolder?: string; linkedFolderPath?: string; batchSize?: number }
): Promise<Song[]> => {
  const batchSize = options?.batchSize ?? 4;
  const results: Song[] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const slice = files.slice(i, i + batchSize);
    const extracted = await Promise.all(
      slice.map((item) =>
        extractSongFromDiskFile(item, {
          fallbackFolder: options?.fallbackFolder,
          linkedFolderPath: options?.linkedFolderPath,
        })
      )
    );
    for (const s of extracted) {
      if (s) results.push(s);
    }
  }
  return assignBatchAddedAt(results);
};

/**
 * همگام‌سازی کامل و دوطرفه یک پوشه متصل روی دیسک
 */
export const syncDesktopFolderResult = async (
  scan: DesktopFolderScanResult,
  existingSongs: readonly Song[],
  fallbackFolder?: string
): Promise<{
  newSongs: Song[];
  restoredUpdates: Map<string, { fileUrl: string; linkedFolderPath: string; folder?: string }>;
  removedIds: string[];
  missingIds: string[];
  failedCount: number;
  matchedCount: number;
  linkedFolder: LinkedFolder;
}> => {
  const delta = computeFolderSyncDelta(scan, existingSongs, scan.folderPath);
  const newSongs =
    delta.newEntries.length > 0
      ? await extractDiskSongsBatched(delta.newEntries, {
          fallbackFolder: fallbackFolder || scan.folderName,
          linkedFolderPath: scan.folderPath,
        })
      : [];

  return {
    newSongs,
    restoredUpdates: delta.restoredUpdates,
    removedIds: delta.removedIds,
    missingIds: delta.missingIds,
    failedCount: Math.max(0, delta.newEntries.length - newSongs.length),
    matchedCount: scan.files.length,
    linkedFolder: {
      id: scan.folderPath,
      path: scan.folderPath,
      name: scan.folderName,
      addedAt: Date.now(),
      lastSyncedAt: Date.now(),
      fileCount: scan.files.length,
    },
  };
};

