import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampTabIndex,
  computeWheelStepDirection,
  dampSwipeOffset,
  evaluateSwipeAxisLock,
  extractFirmContentWheelDelta,
  resolveContentSwipeStep,
  resolveDragTargetTabIndex,
} from '../src/utils/tabScroll.ts';

test('computeWheelStepDirection handles vertical wheel in LTR and RTL', () => {
  assert.equal(computeWheelStepDirection({ deltaX: 0, deltaY: 100, isRTL: false }), 1);
  assert.equal(computeWheelStepDirection({ deltaX: 0, deltaY: -100, isRTL: false }), -1);
  assert.equal(computeWheelStepDirection({ deltaX: 0, deltaY: 100, isRTL: true }), 1);
  assert.equal(computeWheelStepDirection({ deltaX: 0, deltaY: -100, isRTL: true }), -1);
});

test('computeWheelStepDirection respects horizontal trackpad direction in LTR vs RTL', () => {
  assert.equal(computeWheelStepDirection({ deltaX: 40, deltaY: 0, isRTL: false }), 1);
  assert.equal(computeWheelStepDirection({ deltaX: -40, deltaY: 0, isRTL: false }), -1);
  assert.equal(computeWheelStepDirection({ deltaX: -40, deltaY: 0, isRTL: true }), 1);
  assert.equal(computeWheelStepDirection({ deltaX: 40, deltaY: 0, isRTL: true }), -1);
});

test('computeWheelStepDirection returns 0 on zero delta', () => {
  assert.equal(computeWheelStepDirection({ deltaX: 0, deltaY: 0, isRTL: false }), 0);
});

test('resolveDragTargetTabIndex picks closest center and nudges short flicks', () => {
  const centers = [100, 220, 340, 460];
  assert.equal(
    resolveDragTargetTabIndex({
      tabCenters: centers,
      containerCenter: 332,
      currentIndex: 0,
      dragDeltaX: -200,
      isRTL: false,
    }),
    2
  );

  assert.equal(
    resolveDragTargetTabIndex({
      tabCenters: centers,
      containerCenter: 225,
      currentIndex: 1,
      dragDeltaX: -32,
      isRTL: false,
    }),
    2
  );

  assert.equal(
    resolveDragTargetTabIndex({
      tabCenters: centers,
      containerCenter: 225,
      currentIndex: 1,
      dragDeltaX: 32,
      isRTL: true,
    }),
    2
  );
});

test('clampTabIndex bounds indices safely', () => {
  assert.equal(clampTabIndex(-3, 6), 0);
  assert.equal(clampTabIndex(9, 6), 5);
  assert.equal(clampTabIndex(2, 6), 2);
  assert.equal(clampTabIndex(2, 0), 0);
});

test('extractFirmContentWheelDelta rejects vertical or diagonal scroll noise', () => {
  assert.equal(extractFirmContentWheelDelta({ deltaX: 0, deltaY: 120, shiftKey: false, isRTL: false }), 0);
  assert.equal(extractFirmContentWheelDelta({ deltaX: 20, deltaY: 15, shiftKey: false, isRTL: false }), 0);
  assert.equal(extractFirmContentWheelDelta({ deltaX: 3, deltaY: 0, shiftKey: false, isRTL: false }), 0);
  assert.equal(extractFirmContentWheelDelta({ deltaX: 45, deltaY: 5, shiftKey: false, isRTL: false }), 45);
  assert.equal(extractFirmContentWheelDelta({ deltaX: -45, deltaY: 5, shiftKey: false, isRTL: true }), 45);
  assert.equal(extractFirmContentWheelDelta({ deltaX: 0, deltaY: 80, shiftKey: true, isRTL: false }), 80);
});

test('evaluateSwipeAxisLock strictly prioritizes horizontal vs vertical scroll', () => {
  assert.equal(evaluateSwipeAxisLock(10, 8), 'pending');
  assert.equal(evaluateSwipeAxisLock(30, 25), 'vertical');
  assert.equal(evaluateSwipeAxisLock(12, 30), 'vertical');
  assert.equal(evaluateSwipeAxisLock(48, 12), 'horizontal');
  assert.equal(evaluateSwipeAxisLock(-50, 15), 'horizontal');
});

test('resolveContentSwipeStep requires firm distance or fast flick and respects RTL', () => {
  assert.equal(resolveContentSwipeStep({ dx: -50, elapsedMs: 300, isRTL: false }), 0);
  assert.equal(resolveContentSwipeStep({ dx: -100, elapsedMs: 400, isRTL: false }), 1);
  assert.equal(resolveContentSwipeStep({ dx: 100, elapsedMs: 400, isRTL: false }), -1);
  assert.equal(resolveContentSwipeStep({ dx: 100, elapsedMs: 400, isRTL: true }), 1);
  assert.equal(resolveContentSwipeStep({ dx: -100, elapsedMs: 400, isRTL: true }), -1);
  assert.equal(resolveContentSwipeStep({ dx: -64, elapsedMs: 80, isRTL: false }), 1);
});

test('dampSwipeOffset caps stiff rubberband visual travel', () => {
  assert.equal(dampSwipeOffset(100), 28);
  assert.equal(dampSwipeOffset(400), 52);
  assert.equal(dampSwipeOffset(-400), -52);
});
