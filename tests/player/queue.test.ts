import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveItem } from '../../src/utils/array.ts';
import {
  insertPlayNext,
  moveSongAfterCurrentInQueue,
  peekPrioritySong,
  popPrioritySong,
} from '../../src/player/queue.ts';
import type { Song } from '../../src/types/index.ts';

const makeSong = (id: string): Song => ({
  id,
  name: `Song ${id}`,
  artist: 'Artist',
  cover: '',
  fileUrl: `blob:${id}`,
  playCount: 0,
  addedAt: 0,
});

test('queue: جابه‌جایی آهنگ به جایگاه بعدی (Play Next)', () => {
  const songs = ['a', 'b', 'c', 'd'].map(makeSong);
  const reordered = moveItem(songs, 2, 0);
  assert.equal(reordered[0].id, 'c');
  assert.equal(reordered[1].id, 'a');
  assert.equal(reordered[2].id, 'b');
  assert.equal(reordered[3].id, 'd');
});

test('queue: جابه‌جایی تک‌پله‌ای به بالا و پایین', () => {
  const songs = ['a', 'b', 'c'].map(makeSong);
  const movedDown = moveItem(songs, 0, 1);
  assert.deepEqual(movedDown.map(s => s.id), ['b', 'a', 'c']);

  const movedUp = moveItem(songs, 2, 1);
  assert.deepEqual(movedUp.map(s => s.id), ['a', 'c', 'b']);
});

test('insertPlayNext: قرار دادن آهنگ بلافاصله بعد از آهنگ جاری در صف بدون حذف نسخه قبلی', () => {
  const [a, b, c, d, e, f] = ['a', 'b', 'c', 'd', 'e', 'f'].map(makeSong);
  // آهنگ e جدید است و باید بلافاصله بعد از b (اندیس 1) قرار گیرد
  const res = insertPlayNext([a, b, c, d], b, [e], 1);
  assert.deepEqual(res.queue.map(s => s.id), ['a', 'b', 'e', 'c', 'd']);
  assert.equal(res.startSong, null);
  assert.deepEqual(res.insertedIds, ['e']);
  assert.equal(res.insertIndex, 2);
  assert.equal(res.currentIndex, 1);

  // سناریوی کاربر: در صف [a, b, c, d, e, f] وقتی a در حال پخش است و e انتخاب می‌شود:
  // e به خانه 2 (اندیس 1) اضافه می‌شود و نسخه قبلی e به خانه 6 (اندیس 5) منتقل می‌گردد
  const resKeepOriginal = insertPlayNext([a, b, c, d, e, f], a, [e], 0);
  assert.deepEqual(resKeepOriginal.queue.map(s => s.id), ['a', 'e', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(resKeepOriginal.insertIndex, 1);
  assert.equal(resKeepOriginal.currentIndex, 0);
});

test('insertPlayNext: صف خالی با آهنگ جاری یا بدون آهنگ جاری', () => {
  const [a, b, c] = ['a', 'b', 'c'].map(makeSong);
  const withCurrent = insertPlayNext([], a, [b, c]);
  assert.deepEqual(withCurrent.queue.map(s => s.id), ['a', 'b', 'c']);
  assert.equal(withCurrent.startSong, null);
  assert.equal(withCurrent.insertIndex, 1);
  assert.equal(withCurrent.currentIndex, 0);

  const withoutCurrent = insertPlayNext([], null, [b, c]);
  assert.deepEqual(withoutCurrent.queue.map(s => s.id), ['b', 'c']);
  assert.equal(withoutCurrent.startSong?.id, 'b');
  assert.equal(withoutCurrent.insertIndex, 0);
  assert.equal(withoutCurrent.currentIndex, 0);
});

test('priorityNext: اولویت پخش بعدی حتی با وجود آیتم ناموجود در صف', () => {
  const songs = ['a', 'b', 'c'].map(makeSong);
  assert.equal(peekPrioritySong(['missing', 'c', 'b'], songs)?.id, 'c');

  const popped = popPrioritySong(['missing', 'c', 'b'], songs);
  assert.equal(popped.song?.id, 'c');
  assert.deepEqual(popped.remainingIds, ['b']);
});

test('moveSongAfterCurrentInQueue: انتقال آهنگ از قبل یا بعد به بلافاصله پس از آهنگ جاری', () => {
  const songs = ['a', 'b', 'c', 'd', 'e'].map(makeSong);

  // انتقال آیتم بعد از آهنگ جاری (e -> بلافاصله بعد از b)
  const fromAfter = moveSongAfterCurrentInQueue(songs, 4, 'b');
  assert.deepEqual(fromAfter.queue.map(s => s.id), ['a', 'b', 'e', 'c', 'd']);
  assert.equal(fromAfter.movedId, 'e');

  // انتقال آیتم قبل از آهنگ جاری (a -> بلافاصله بعد از c)
  const fromBefore = moveSongAfterCurrentInQueue(songs, 0, 'c');
  assert.deepEqual(fromBefore.queue.map(s => s.id), ['b', 'c', 'a', 'd', 'e']);
  assert.equal(fromBefore.movedId, 'a');

  // نبودن آهنگ جاری -> انتقال به ابتدای صف
  const noCurrent = moveSongAfterCurrentInQueue(songs, 3, 'missing');
  assert.deepEqual(noCurrent.queue.map(s => s.id), ['d', 'a', 'b', 'c', 'e']);
  assert.equal(noCurrent.movedId, 'd');

  // اندیس نامعتبر -> بدون تغییر
  const invalid = moveSongAfterCurrentInQueue(songs, -1, 'b');
  assert.deepEqual(invalid.queue.map(s => s.id), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(invalid.movedId, null);
});
