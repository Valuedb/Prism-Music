import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTooltipCenterPx,
  computeScrubPosition,
  formatTrackTime,
} from '../../src/utils/time.ts';

test('formatTrackTime: فرمت دقیق زمان و ایمنی در برابر مقادیر نامعتبر', () => {
  assert.equal(formatTrackTime(0), '0:00');
  assert.equal(formatTrackTime(-5), '0:00');
  assert.equal(formatTrackTime(Number.NaN), '0:00');
  assert.equal(formatTrackTime(Number.POSITIVE_INFINITY), '0:00');
  assert.equal(formatTrackTime(5.9), '0:05');
  assert.equal(formatTrackTime(60), '1:00');
  assert.equal(formatTrackTime(125.7), '2:05');
  assert.equal(formatTrackTime(3661), '61:01');
});

test('computeScrubPosition: محاسبه دقیق نسبت و زمان هاور/کلیک در محدوده ۰ تا ۱', () => {
  assert.deepEqual(computeScrubPosition(100, 100, 200, 120), { ratio: 0, time: 0 });
  assert.deepEqual(computeScrubPosition(200, 100, 200, 120), { ratio: 0.5, time: 60 });
  assert.deepEqual(computeScrubPosition(300, 100, 200, 120), { ratio: 1, time: 120 });

  // خروج نشانگر از چپ یا راست کادر باید کاملاً مهار شود
  assert.deepEqual(computeScrubPosition(20, 100, 200, 120), { ratio: 0, time: 0 });
  assert.deepEqual(computeScrubPosition(500, 100, 200, 120), { ratio: 1, time: 120 });

  // مدت‌زمان صفر یا عرض صفر نباید NaN برگرداند
  assert.deepEqual(computeScrubPosition(150, 100, 0, 120), { ratio: 0, time: 0 });
  assert.deepEqual(computeScrubPosition(150, 100, 200, 0), { ratio: 0, time: 0 });
});

test('clampTooltipCenterPx: جلوگیری از بیرون‌زدگی حباب زمان در ابتدا و انتهای نوار', () => {
  assert.equal(clampTooltipCenterPx(0, 200, 22), 22);
  assert.equal(clampTooltipCenterPx(1, 200, 22), 178);
  assert.equal(clampTooltipCenterPx(0.5, 200, 22), 100);
  // نوار بسیار باریک نباید مقدار خارج از مرکز بدهد
  assert.equal(clampTooltipCenterPx(0.1, 30, 22), 15);
  assert.equal(clampTooltipCenterPx(0.5, 0, 22), 0);
});
