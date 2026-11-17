import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDesktopMediaUrl,
  computeFolderSyncDelta,
  normalizeDiskPath,
} from '../../src/utils/desktopPaths.ts';
import type { DesktopFolderScanResult, Song } from '../../src/types/index.ts';

const makeSong = (overrides: Partial<Song> & { id: string; sourcePath?: string }): Song => ({
  id: overrides.id,
  name: overrides.name ?? overrides.id,
  artist: overrides.artist ?? 'Artist',
  cover: '',
  fileUrl:
    overrides.fileUrl ??
    (overrides.sourcePath ? buildDesktopMediaUrl(overrides.sourcePath) : 'blob:mock'),
  sourcePath: overrides.sourcePath,
  linkedFolderPath: overrides.linkedFolderPath,
  fileMissing: overrides.fileMissing ?? false,
  folder: overrides.folder,
  playCount: 0,
  addedAt: 1700000000000,
});

test('normalizeDiskPath: نرمال‌سازی مسیرهای ویندوزی و یونیکس', () => {
  assert.equal(normalizeDiskPath('D:\\Music\\Pop\\'), 'd:/music/pop');
  assert.equal(normalizeDiskPath('d:/music//pop', 'win32'), 'd:/music/pop');
  assert.equal(normalizeDiskPath('\\\\NAS\\Music\\Album\\'), '//nas/music/album');
  assert.equal(normalizeDiskPath('/home/user/Music/', 'linux'), '/home/user/Music');
});

test('computeFolderSyncDelta: شناسایی فایل‌های جدید، بازیابی‌شده و حذف‌شده در پوشه متصل', () => {
  const songs: Song[] = [
    makeSong({
      id: 's-keep',
      sourcePath: 'D:\\Music\\keep.mp3',
      linkedFolderPath: 'D:\\Music',
    }),
    makeSong({
      id: 's-restore',
      sourcePath: 'D:\\Music\\restored.mp3',
      linkedFolderPath: 'D:\\Music',
      fileMissing: true,
    }),
    makeSong({
      id: 's-deleted',
      sourcePath: 'D:\\Music\\deleted.mp3',
      linkedFolderPath: 'D:\\Music',
    }),
    makeSong({
      id: 's-other-loose',
      sourcePath: 'E:\\Singles\\loose.mp3',
    }),
  ];

  const scan: DesktopFolderScanResult = {
    folderPath: 'D:\\Music',
    folderName: 'Music',
    files: [
      { path: 'd:\\music\\keep.mp3', name: 'keep.mp3', folder: 'Music' },
      { path: 'D:\\Music\\restored.mp3', name: 'restored.mp3', folder: 'Music/Rock' },
      { path: 'D:\\Music\\added.flac', name: 'added.flac', folder: 'Music' },
    ],
  };

  const delta = computeFolderSyncDelta(scan, songs);
  assert.deepEqual(
    delta.newEntries.map((e) => e.path),
    ['D:\\Music\\added.flac']
  );
  assert.deepEqual(delta.removedIds, ['s-deleted']);
  assert.deepEqual(delta.missingIds, []);
  assert.equal(delta.restoredUpdates.has('s-restore'), true);
  assert.equal(delta.restoredUpdates.get('s-restore')?.folder, 'Music/Rock');
});

test('computeFolderSyncDelta: در صورت قطع دسترسی موقت به درایو (missing) آهنگ‌ها حذف نمی‌شوند', () => {
  const songs: Song[] = [
    makeSong({
      id: 's-usb-1',
      sourcePath: 'F:\\Road\\a.mp3',
      linkedFolderPath: 'F:\\Road',
      fileMissing: false,
    }),
    makeSong({
      id: 's-local',
      sourcePath: 'C:\\Music\\b.mp3',
      linkedFolderPath: 'C:\\Music',
    }),
  ];

  const missingScan: DesktopFolderScanResult = {
    folderPath: 'F:\\Road',
    folderName: 'Road',
    files: [],
    missing: true,
  };

  const delta = computeFolderSyncDelta(missingScan, songs);
  assert.deepEqual(delta.newEntries, []);
  assert.deepEqual(delta.removedIds, []);
  assert.deepEqual(delta.missingIds, ['s-usb-1']);
});
