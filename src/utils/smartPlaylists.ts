import type { Song } from '../types/index';

export const RECENTLY_ADDED_LIMIT = 50;
export const RECENTLY_PLAYED_LIMIT = 100;

let lastIssuedMaxAddedAt = 0;

/**
 * تخصیص تاریخ افزودن یکتا و صعودی برای یک دسته آهنگ واردشده:
 * - دسته جدیدتر همیشه timestamp بزرگ‌تر از دسته‌های قبلی می‌گیرد.
 * - درون یک دسته، ترتیب ورودی [0..n-1] در مرتب‌سازی نزولی حفظ می‌شود تا ترتیب آلبوم یا پوشه به‌هم نریزد.
 */
export const assignBatchAddedAt = (songs: Song[], baseNow = Date.now()): Song[] => {
  if (songs.length === 0) return songs;
  const baseTs = Math.max(baseNow, lastIssuedMaxAddedAt + 1);
  lastIssuedMaxAddedAt = baseTs + songs.length - 1;

  return songs.map((song, idx) => ({
    ...song,
    addedAt: baseTs + (songs.length - 1 - idx),
  }));
};

/**
 * ریست شمارنده در تست‌های واحد
 */
export const resetBatchAddedAtClock = (): void => {
  lastIssuedMaxAddedAt = 0;
};

/**
 * آخرین آهنگ‌های اضافه‌شده به کتابخانه (جدیدترین به قدیمی‌ترین، با سقف مشخص)
 */
export const getRecentlyAddedSongs = (
  allSongs: readonly Song[],
  limit = RECENTLY_ADDED_LIMIT
): Song[] => {
  if (allSongs.length === 0 || limit <= 0) return [];
  const indexed = allSongs.map((song, idx) => ({ song, idx }));
  indexed.sort((a, b) => {
    const diff = (b.song.addedAt || 0) - (a.song.addedAt || 0);
    if (diff !== 0) return diff;
    return b.idx - a.idx;
  });
  return indexed.slice(0, limit).map((item) => item.song);
};

/**
 * بیشترین تعداد پخش: فقط آهنگ‌هایی که حداقل ۱ بار پخش شده‌اند، مرتب‌شده از بیشترین به کمترین
 */
export const getMostPlayedSongs = (allSongs: readonly Song[]): Song[] => {
  if (allSongs.length === 0) return [];
  return allSongs
    .filter((s) => (s.playCount || 0) > 0)
    .sort((a, b) => {
      const countDiff = (b.playCount || 0) - (a.playCount || 0);
      if (countDiff !== 0) return countDiff;
      const playedDiff = (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
      if (playedDiff !== 0) return playedDiff;
      return (b.addedAt || 0) - (a.addedAt || 0);
    });
};

/**
 * آخرین پخش: آهنگ‌هایی که سابقه پخش دارند، مرتب‌شده از جدیدترین زمان پخش به قدیمی‌ترین
 */
export const getRecentlyPlayedSongs = (
  allSongs: readonly Song[],
  limit = RECENTLY_PLAYED_LIMIT
): Song[] => {
  if (allSongs.length === 0 || limit <= 0) return [];
  return allSongs
    .filter((s) => (s.lastPlayedAt || 0) > 0 || (s.playCount || 0) > 0)
    .sort((a, b) => {
      const playedDiff = (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0);
      if (playedDiff !== 0) return playedDiff;
      const countDiff = (b.playCount || 0) - (a.playCount || 0);
      if (countDiff !== 0) return countDiff;
      return (b.addedAt || 0) - (a.addedAt || 0);
    })
    .slice(0, limit);
};
