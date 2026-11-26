import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBrowserFolderLocationId,
  formatFolderBreadcrumb,
  inferFolderLocationNameFromFiles,
  isIgnoredFolderName,
} from '../../src/utils/smartLibraryScanner.ts';

test('isIgnoredFolderName filters system, trash, and hidden metadata folders', () => {
  assert.equal(isIgnoredFolderName(''), true);
  assert.equal(isIgnoredFolderName('   '), true);
  assert.equal(isIgnoredFolderName('$RECYCLE.BIN'), true);
  assert.equal(isIgnoredFolderName('System Volume Information'), true);
  assert.equal(isIgnoredFolderName('__MACOSX'), true);
  assert.equal(isIgnoredFolderName('.Trash-1000'), true);
  assert.equal(isIgnoredFolderName('node_modules'), true);

  assert.equal(isIgnoredFolderName('Persian Rock'), false);
  assert.equal(isIgnoredFolderName('2025 Albums'), false);
});

test('formatFolderBreadcrumb separates nested folder leaf name from parent path', () => {
  assert.deepEqual(formatFolderBreadcrumb('Music'), {
    displayName: 'Music',
  });

  assert.deepEqual(formatFolderBreadcrumb('Music/Rock/Live 2024'), {
    displayName: 'Live 2024',
    parentLabel: 'Music / Rock',
  });

  assert.deepEqual(formatFolderBreadcrumb('D:\\Audio\\Archive\\Favorites'), {
    displayName: 'Favorites',
    parentLabel: 'D: / Audio / Archive',
  });
});

test('inferFolderLocationNameFromFiles extracts root directory from webkitRelativePath', () => {
  const f1 = { name: 'track.mp3', webkitRelativePath: 'My Music/Pop/track.mp3' } as unknown as File;
  const f2 = { name: 'other.mp3' } as unknown as File;

  assert.equal(inferFolderLocationNameFromFiles([f2, f1]), 'My Music');
  assert.equal(inferFolderLocationNameFromFiles([f2]), 'Music Folder');
});

test('buildBrowserFolderLocationId produces stable browser-folder identifiers', () => {
  assert.equal(buildBrowserFolderLocationId('My Music Library'), 'browser-folder://my-music-library');
  assert.equal(buildBrowserFolderLocationId('موزیک‌های جدید'), 'browser-folder://موزیکهای-جدید');
  assert.equal(buildBrowserFolderLocationId('   '), 'browser-folder://music');
});
