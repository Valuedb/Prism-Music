/**
 * محاسبه‌ی اندیس مقصد در آرایه‌ی صف پس از رها کردن روی یک شکاف درجی (insertionSlot).
 * insertionSlot عددی از 0 تا queueLength است (0 یعنی قبل از اولین آیتم، queueLength یعنی بعد از آخرین آیتم).
 */
export const computeTargetIndexFromInsertionSlot = (
  fromIndex: number,
  insertionSlot: number,
  queueLength: number
): number => {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(insertionSlot) ||
    !Number.isInteger(queueLength) ||
    queueLength <= 1 ||
    fromIndex < 0 ||
    fromIndex >= queueLength
  ) {
    return fromIndex;
  }

  const clampedSlot = Math.max(0, Math.min(queueLength, insertionSlot));
  if (clampedSlot === fromIndex || clampedSlot === fromIndex + 1) {
    return fromIndex;
  }

  return fromIndex < clampedSlot ? clampedSlot - 1 : clampedSlot;
};

/**
 * محاسبه‌ی سرعت اسکرول خودکار (پیکسل در هر فریم) هنگام کشیدن آیتم نزدیک لبه‌ی بالا یا پایین لیست.
 */
export const computeAutoScrollDelta = (
  pointerY: number,
  containerTop: number,
  containerBottom: number,
  scrollTop: number,
  maxScrollTop: number,
  edgeZonePx = 64,
  maxStepPx = 14
): number => {
  if (maxScrollTop <= 0 || containerBottom <= containerTop) return 0;

  if (pointerY < containerTop + edgeZonePx && scrollTop > 0) {
    const distIntoEdge = containerTop + edgeZonePx - pointerY;
    const ratio = Math.min(1, Math.max(0, distIntoEdge / edgeZonePx));
    const speed = Math.max(1.5, Math.round(ratio * ratio * maxStepPx * 10) / 10);
    return -Math.min(scrollTop, speed);
  }

  if (pointerY > containerBottom - edgeZonePx && scrollTop < maxScrollTop) {
    const distIntoEdge = pointerY - (containerBottom - edgeZonePx);
    const ratio = Math.min(1, Math.max(0, distIntoEdge / edgeZonePx));
    const speed = Math.max(1.5, Math.round(ratio * ratio * maxStepPx * 10) / 10);
    return Math.min(maxScrollTop - scrollTop, speed);
  }

  return 0;
};
