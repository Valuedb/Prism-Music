import test from 'node:test';
import assert from 'node:assert/strict';
import type { Song } from '../../src/types/index.ts';
import {
  assignBatchAddedAt,
  getMostPlayedSongs,
  getRecentlyAddedSongs,
  getRecentlyPlayedSongs,
  resetBatchAddedAtClock,
} from '../../src/utils/smartPlaylists.ts';

const makeSong = (overrides: Partial<Song> & { id: string }): Song => ({
  name: overrides.id,
  artist: 'Artist',
  cover: '',
  fileUrl: `file:///${overrides.id}.mp3`,
  playCount: 0,
  addedAt: 1000,
  ...overrides,
});

test('assignBatchAddedAt: ترتیب دسته حفظ می‌شود و دسته‌های جدید همیشه بالاتر قرار می‌گیرند', () => {
  resetBatchAddedAtClock();

  const batch1 = assignBatchAddedAt(
    [makeSong({ id: 'b1-1' }), makeSong({ id: 'b1-2' }), makeSong({ id: 'b1-3' })],
    10_000
  );
  // حتی اگر در همان میلی‌ثانیه دسته دوم اضافه شود، باید کاملاً از دسته اول جدیدتر باشد
  const batch2 = assignBatchAddedAt(
    [makeSong({ id: 'b2-1' }), makeSong({ id: 'b2-2' })],
    10_000
  );

  const recent = getRecentlyAddedSongs([...batch1, ...batch2]);
  assert.deepEqual(
    recent.map((s) => s.id),
    ['b2-1', 'b2-2', 'b1-1', 'b1-2', 'b1-3']
  );
});

test('getRecentlyAddedSongs: جدیدترین‌ها اول می‌آیند و سقف تعداد رعایت می‌شود', () => {
  const songs = [
    makeSong({ id: 's1', addedAt: 100 }),
    makeSong({ id: 's2', addedAt: 500 }),
    makeSong({ id: 's3', addedAt: 300 }),
    makeSong({ id: 's4', addedAt: 500 }), // هم‌زمان با s2 اما دیرتر اضافه شده
  ];

  const topTwo = getRecentlyAddedSongs(songs, 2);
  assert.deepEqual(
    topTwo.map((s) => s.id),
    ['s4', 's2']
  );

  const all = getRecentlyAddedSongs(songs, 10);
  assert.deepEqual(
    all.map((s) => s.id),
    ['s4', 's2', 's3', 's1']
  );
});

test('getMostPlayedSongs: آهنگ‌های پخش‌نشده حذف و بیشترین پخش با tie-breaker مرتب می‌شوند', () => {
  const songs = [
    makeSong({ id: 'never-played', playCount: 0, addedAt: 9000 }),
    makeSong({ id: 'low', playCount: 2, lastPlayedAt: 5000 }),
    makeSong({ id: 'top', playCount: 15, lastPlayedAt: 2000 }),
    makeSong({ id: 'tied-older', playCount: 5, lastPlayedAt: 1000 }),
    makeSong({ id: 'tied-newer', playCount: 5, lastPlayedAt: 8000 }),
  ];

  const result = getMostPlayedSongs(songs);
  assert.deepEqual(
    result.map((s) => s.id),
    ['top', 'tied-newer', 'tied-older', 'low']
  );
});

test('getRecentlyPlayedSongs: فقط آهنگ‌های پخش‌شده بر اساس جدیدترین زمان پخش مرتب می‌شوند', () => {
  const songs = [
    makeSong({ id: 'unplayed', playCount: 0, addedAt: 99999 }),
    makeSong({ id: 'played-first', playCount: 8, lastPlayedAt: 1000 }),
    makeSong({ id: 'played-latest', playCount: 1, lastPlayedAt: 9000 }),
    makeSong({ id: 'played-mid', playCount: 3, lastPlayedAt: 5000 }),
    makeSong({ id: 'legacy-no-ts', playCount: 4 }),
  ];

  const result = getRecentlyPlayedSongs(songs);
  assert.deepEqual(
    result.map((s) => s.id),
    ['played-latest', 'played-mid', 'played-first', 'legacy-no-ts']
  );
});
