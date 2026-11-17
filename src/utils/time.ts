/**
 * فرمت استاندارد زمان آهنگ (دقیقه:ثانیه) با ایمنی کامل در برابر مقادیر نامعتبر
 */
export function formatTrackTime(seconds: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * محاسبه دقیق نسبت (0 تا 1) و زمان متناظر روی نوار پیشرفت بر اساس مختصات افقی نشانگر
 */
export function computeScrubPosition(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  duration: number
): { ratio: number; time: number } {
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(rectLeft) ||
    !Number.isFinite(rectWidth) ||
    rectWidth <= 0 ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return { ratio: 0, time: 0 };
  }
  const ratio = Math.min(1, Math.max(0, (clientX - rectLeft) / rectWidth));
  return {
    ratio,
    time: ratio * duration,
  };
}

/**
 * محدودسازی موقعیت افقی مرکز تولتیپ زمان تا در لبه‌های ۰٪ و ۱۰۰٪ از کادر نوار بیرون نزند
 */
export function clampTooltipCenterPx(
  ratio: number,
  trackWidth: number,
  halfBubblePx = 22
): number {
  if (!Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  const safeRatio = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const safeHalf = Math.max(0, halfBubblePx);
  if (trackWidth <= safeHalf * 2) {
    return trackWidth / 2;
  }
  return Math.max(safeHalf, Math.min(trackWidth - safeHalf, safeRatio * trackWidth));
}
