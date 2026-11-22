import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAutoScrollDelta,
  computeTargetIndexFromInsertionSlot,
} from '../src/utils/queueDrag.ts';
import { moveItem } from '../src/utils/array.ts';

test('computeTargetIndexFromInsertionSlot: انتقال آهنگ ۸ به ابتدای صف', () => {
  const target = computeTargetIndexFromInsertionSlot(7, 0, 9);
  assert.equal(target, 0);
  const reordered = moveItem([0, 1, 2, 3, 4, 5, 6, 7, 8], 7, target);
  assert.equal(reordered[0], 7);
  assert.equal(reordered[1], 0);
});

test('computeTargetIndexFromInsertionSlot: انتقال رو به پایین بدون خطای off-by-one', () => {
  const target = computeTargetIndexFromInsertionSlot(1, 5, 9);
  assert.equal(target, 4);
  const reordered = moveItem([0, 1, 2, 3, 4, 5], 1, target);
  assert.deepEqual(reordered, [0, 2, 3, 4, 1, 5]);
});

test('computeTargetIndexFromInsertionSlot: رها کردن در همان جایگاه تغییری نمی‌دهد', () => {
  assert.equal(computeTargetIndexFromInsertionSlot(4, 4, 9), 4);
  assert.equal(computeTargetIndexFromInsertionSlot(4, 5, 9), 4);
});

test('computeAutoScrollDelta: اسکرول خودکار به بالا هنگام کشیدن نزدیک لبه یا بالای هدر', () => {
  const deltaNearTop = computeAutoScrollDelta(120, 100, 500, 140, 300, 64, 15);
  assert.ok(deltaNearTop < 0);

  const deltaAboveHeader = computeAutoScrollDelta(60, 100, 500, 140, 300, 64, 15);
  assert.equal(deltaAboveHeader, -15);
});

test('computeAutoScrollDelta: اسکرول خودکار به پایین هنگام کشیدن نزدیک یا پایین انتهای لیست', () => {
  const deltaNearBottom = computeAutoScrollDelta(480, 100, 500, 50, 300, 64, 15);
  assert.ok(deltaNearBottom > 0);

  const deltaBelowBottom = computeAutoScrollDelta(530, 100, 500, 50, 300, 64, 15);
  assert.equal(deltaBelowBottom, 15);
});

test('computeAutoScrollDelta: در محدوده امن یا انتهای اسکرول مقدار صفر برمی‌گرداند', () => {
  assert.equal(computeAutoScrollDelta(300, 100, 500, 100, 300, 64, 15), 0);
  assert.equal(computeAutoScrollDelta(110, 100, 500, 0, 300, 64, 15), 0);
  assert.equal(computeAutoScrollDelta(490, 100, 500, 300, 300, 64, 15), 0);
});
