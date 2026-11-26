import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampContextMenuPosition,
  computeAnchorMenuPosition,
} from '../src/utils/contextMenu.ts';
import { removeIndicesFromQueue } from '../src/utils/queueDrag.ts';

test('clampContextMenuPosition keeps cursor menu inside right/bottom edges on 800x600 window', () => {
  const pos = clampContextMenuPosition({
    clientX: 760,
    clientY: 540,
    menuWidth: 200,
    menuHeight: 220,
    viewportWidth: 800,
    viewportHeight: 600,
  });

  assert.ok(pos.left >= 12);
  assert.ok(pos.left + 200 <= 800 - 12);
  assert.ok(pos.top >= 12);
  assert.ok(pos.top + 220 <= 600 - 16);
  assert.equal(pos.originY, 'bottom');
  assert.equal(pos.originX, 'right');
});

test('clampContextMenuPosition flips smoothly in RTL without overflowing left viewport edge', () => {
  const pos = clampContextMenuPosition({
    clientX: 40,
    clientY: 120,
    menuWidth: 190,
    menuHeight: 200,
    viewportWidth: 1024,
    viewportHeight: 768,
    isRTL: true,
  });

  assert.ok(pos.left >= 12);
  assert.equal(pos.top, 120);
  assert.equal(pos.originY, 'top');
});

test('computeAnchorMenuPosition opens upwards when button sits near bottom player bar', () => {
  const pos = computeAnchorMenuPosition({
    rect: { left: 680, right: 712, top: 470, bottom: 502 },
    menuWidth: 188,
    menuHeight: 240,
    viewportWidth: 800,
    viewportHeight: 600,
    isRTL: false,
  });

  assert.equal(pos.originY, 'bottom');
  assert.ok(pos.top < 470);
  assert.ok(pos.left + 188 <= 800 - 12);
});

test('removeIndicesFromQueue deletes multiple non-contiguous items and shifts currentIndex & priorityIndices', () => {
  const queue = ['a', 'b', 'c', 'd', 'e', 'f'];
  const result = removeIndicesFromQueue(queue, [0, 2, 5], 3, [4, 2, 1]);

  assert.deepEqual(result.queue, ['b', 'd', 'e']);
  // 'd' moved from index 3 -> 1
  assert.equal(result.currentIndex, 1);
  // priority 4 ('e')->2, 2 ('c')->removed, 1 ('b')->0
  assert.deepEqual(result.priorityIndices, [2, 0]);
});

test('removeIndicesFromQueue resets currentIndex to -1 if active track slot is removed', () => {
  const queue = ['x', 'y', 'z'];
  const result = removeIndicesFromQueue(queue, [1], 1, [2]);

  assert.deepEqual(result.queue, ['x', 'z']);
  assert.equal(result.currentIndex, -1);
  assert.deepEqual(result.priorityIndices, [1]);
});
