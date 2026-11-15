const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const parseHexRgb = (color: string): [number, number, number] | null => {
  const trimmed = color.trim();
  if (!HEX_COLOR.test(trimmed)) return null;

  const digits = trimmed.slice(1);
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/**
 * رنگ hex را با شفافیت دلخواه به rgba تبدیل می‌کند (مثلاً برای پس‌زمینه‌ی شیشه‌ای).
 * فرمت‌های #rgb و #rrggbb پشتیبانی می‌شوند؛ هر مقدار دیگر بدون تغییر برمی‌گردد.
 *
 * @param alpha عددی بین ۰ و ۱ (خارج از این بازه محدود می‌شود)
 */
export const withAlpha = (color: string, alpha: number): string => {
  const rgb = parseHexRgb(color);
  if (!rgb) return color;

  const safeAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
};

/**
 * ترکیب دو رنگ hex با نسبت مشخص (weightB بین ۰ تا ۱) برای ساخت سطوح شیشه‌ای هم‌فام با پالت
 */
export const mixHex = (hexA: string, hexB: string, weightB: number): string => {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  if (!a || !b) return hexA;

  const w = Math.min(1, Math.max(0, weightB));
  const r = Math.round(a[0] * (1 - w) + b[0] * w);
  const g = Math.round(a[1] * (1 - w) + b[1] * w);
  const bl = Math.round(a[2] * (1 - w) + b[2] * w);

  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
};

/**
 * تشخیص خودکار رنگ متن خوانا (سفید یا ذغالی تیره) روی رنگ پس‌زمینه دکمه/بج بر اساس درخشندگی W3C
 */
export const getContrastText = (bgHex: string): string => {
  const rgb = parseHexRgb(bgHex);
  if (!rgb) return '#ffffff';

  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
  return luminance > 0.42 ? '#111827' : '#ffffff';
};

