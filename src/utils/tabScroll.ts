export interface WheelDirectionInput {
  deltaX: number;
  deltaY: number;
  isRTL: boolean;
}

/**
 * تشخیص جهت اسکرول بین تب‌ها بر اساس ورودی چرخ ماوس یا تاچ‌پد و جهت چیدمان زبان (RTL / LTR)
 */
export const computeWheelStepDirection = ({
  deltaX,
  deltaY,
  isRTL,
}: WheelDirectionInput): -1 | 0 | 1 => {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX === 0 && absY === 0) return 0;

  if (absX > absY) {
    if (isRTL) {
      return deltaX < 0 ? 1 : -1;
    }
    return deltaX > 0 ? 1 : -1;
  }

  return deltaY > 0 ? 1 : -1;
};

export const clampTabIndex = (index: number, count: number): number => {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, index));
};

export interface DragTargetInput {
  tabCenters: number[];
  containerCenter: number;
  currentIndex: number;
  dragDeltaX: number;
  isRTL: boolean;
}

/**
 * انتخاب تب مقصد پس از رها کردن کشیدن افقی روی نوار تب‌ها
 */
export const resolveDragTargetTabIndex = ({
  tabCenters,
  containerCenter,
  currentIndex,
  dragDeltaX,
  isRTL,
}: DragTargetInput): number => {
  if (tabCenters.length === 0) return 0;
  const safeCurrent = clampTabIndex(currentIndex, tabCenters.length);

  let closestIndex = safeCurrent;
  let minDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < tabCenters.length; i += 1) {
    const dist = Math.abs(tabCenters[i] - containerCenter);
    if (dist < minDist) {
      minDist = dist;
      closestIndex = i;
    }
  }

  if (closestIndex === safeCurrent && Math.abs(dragDeltaX) >= 24) {
    const step = isRTL ? (dragDeltaX > 0 ? 1 : -1) : dragDeltaX < 0 ? 1 : -1;
    return clampTabIndex(safeCurrent + step, tabCenters.length);
  }

  return closestIndex;
};

export interface ContentWheelInput {
  deltaX: number;
  deltaY: number;
  shiftKey: boolean;
  isRTL: boolean;
}

/**
 * ارزیابی سخت‌گیرانه اسکرول افقی محتوای اصلی برای جلوگیری از تغییر تصادفی تب هنگام اسکرول عمودی
 * فقط اسکرول کاملاً افقی (deltaX غالب >= 2.5x deltaY) یا Shift+Wheel پذیرفته می‌شود.
 */
export const extractFirmContentWheelDelta = ({
  deltaX,
  deltaY,
  shiftKey,
  isRTL,
}: ContentWheelInput): number => {
  if (shiftKey && Math.abs(deltaY) >= 4 && Math.abs(deltaX) < Math.abs(deltaY)) {
    return deltaY;
  }

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < 4 || absX <= absY * 2.5) {
    return 0;
  }

  return isRTL ? -deltaX : deltaX;
};

export const CONTENT_WHEEL_COMMIT_THRESHOLD = 125;
export const CONTENT_SWIPE_LOCK_DEADZONE = 22;
export const CONTENT_SWIPE_DISTANCE_THRESHOLD = 92;
export const CONTENT_SWIPE_FLICK_MIN_DISTANCE = 56;
export const CONTENT_SWIPE_FLICK_VELOCITY = 0.6; // px per ms

export type SwipeLockState = 'pending' | 'horizontal' | 'vertical';

export const evaluateSwipeAxisLock = (dx: number, dy: number): SwipeLockState => {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < CONTENT_SWIPE_LOCK_DEADZONE && absY < CONTENT_SWIPE_LOCK_DEADZONE) {
    return 'pending';
  }
  if (absX > absY * 2.2) {
    return 'horizontal';
  }
  return 'vertical';
};

/**
 * محاسبه مقدار جابه‌جایی میراشده هنگام کشیدن تا حس سفتی و استحکام به کاربر منتقل شود
 */
export const dampSwipeOffset = (dx: number, maxVisualOffset = 52): number => {
  const damped = dx * 0.28;
  return Math.max(-maxVisualOffset, Math.min(maxVisualOffset, Math.round(damped)));
};

export const resolveContentSwipeStep = ({
  dx,
  elapsedMs,
  isRTL,
}: {
  dx: number;
  elapsedMs: number;
  isRTL: boolean;
}): -1 | 0 | 1 => {
  const absX = Math.abs(dx);
  const velocity = absX / Math.max(16, elapsedMs);
  const committed =
    absX >= CONTENT_SWIPE_DISTANCE_THRESHOLD ||
    (absX >= CONTENT_SWIPE_FLICK_MIN_DISTANCE && velocity >= CONTENT_SWIPE_FLICK_VELOCITY);

  if (!committed) return 0;

  if (isRTL) {
    return dx > 0 ? 1 : -1;
  }
  return dx < 0 ? 1 : -1;
};
