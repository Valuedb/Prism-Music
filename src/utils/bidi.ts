import type { CSSProperties } from 'react';

const RTL_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/;

/**
 * تشخیص اینکه رشته دارای کاراکتر راست‌به‌چپ (فارسی/عربی/عبری) است یا خیر
 */
export const isRTLString = (text: string): boolean => RTL_CHAR_REGEX.test(text);

/**
 * استایل کوتاه‌سازی تک‌خطی با حفظ جهت اصلی متن و چسبیدن به تراز رابط کاربری:
 * - متن انگلیسی داخل رابط فارسی همواره از انتهای واقعی خود («Diet Mountain Dew...») برش می‌خورد،
 *   نه از ابتدای آن («...Mountain Dew»).
 * - در حالت جا شدن کامل در باکس، متن مطابق جهت رابط کاربری تراز می‌شود تا از کاور جدا نشود.
 */
export const getBidiTruncateStyle = (
  text: string,
  uiIsRTL: boolean,
  explicitAlign?: CSSProperties['textAlign']
): CSSProperties => ({
  direction: isRTLString(text) ? 'rtl' : 'ltr',
  unicodeBidi: 'plaintext',
  textAlign: explicitAlign ?? (uiIsRTL ? 'right' : 'left'),
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});
