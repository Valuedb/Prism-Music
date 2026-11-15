import type { PlaybackPreferences } from '../types/index';

/** حداکثر ثانیه‌ی گوش‌دادن لازم تا یک پخش در playCount حساب بشه */
export const PLAY_COUNT_THRESHOLD_SECONDS = 30;

/** حداکثر تعداد آهنگ‌هایی که برای دکمه‌ی «قبلی» در حالت شافل نگه داشته می‌شه */
export const MAX_HISTORY = 100;

/** تنظیمات پیش‌فرض رفتار پخش و کتابخانه */
export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  autoPlayOnImport: false,
  rememberPlaybackPosition: true,
  confirmBeforeDelete: true,
  skipDuplicatesOnImport: true,
  seekStepSeconds: 5,
};

