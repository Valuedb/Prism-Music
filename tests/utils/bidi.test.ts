import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBidiTruncateStyle, isRTLString } from '../../src/utils/bidi.ts';

test('isRTLString: تشخیص صحیح متون فارسی و انگلیسی', () => {
  assert.equal(isRTLString('Midnight Sunset'), false);
  assert.equal(isRTLString('Diet Mountain Dew Lana Del Rey'), false);
  assert.equal(isRTLString('آهنگ شاد جدید'), true);
  assert.equal(isRTLString('میکس - Sunset'), true);
});

test('getBidiTruncateStyle: جلوگیری از پرش و معکوس‌شدن سه‌نقطه در رابط فارسی و انگلیسی', () => {
  const enInFa = getBidiTruncateStyle('Diet Mountain Dew Lana Del Rey', true);
  assert.equal(enInFa.direction, 'ltr');
  assert.equal(enInFa.textAlign, 'right');
  assert.equal(enInFa.unicodeBidi, 'plaintext');
  assert.equal(enInFa.textOverflow, 'ellipsis');

  const faInFa = getBidiTruncateStyle('غروب شبانه', true);
  assert.equal(faInFa.direction, 'rtl');
  assert.equal(faInFa.textAlign, 'right');

  const enInEn = getBidiTruncateStyle('Midnight Sunset', false);
  assert.equal(enInEn.direction, 'ltr');
  assert.equal(enInEn.textAlign, 'left');

  const centeredEnInFa = getBidiTruncateStyle('Midnight Sunset', true, 'center');
  assert.equal(centeredEnInFa.direction, 'ltr');
  assert.equal(centeredEnInFa.textAlign, 'center');
});
