import type { Song } from '../types/index';

/**
 * توابع خالص (بدون React) برای انتخاب آهنگ بعدی/قبلی.
 * همه‌ی منطق جابه‌جایی اینجاست تا بدون مرورگر قابل تست باشه.
 */

export interface IndexedTrackPick {
  song: Song | null;
  index: number;
}

const resolveCurrentIndex = (
  list: readonly Song[],
  currentId: string | null,
  currentIndex: number
): number => {
  if (
    Number.isInteger(currentIndex) &&
    currentIndex >= 0 &&
    currentIndex < list.length &&
    (!currentId || list[currentIndex].id === currentId)
  ) {
    return currentIndex;
  }
  if (!currentId) return -1;
  return list.findIndex((song) => song.id === currentId);
};

/** آهنگ بعدی و اندیس دقیق آن به ترتیب لیست (پشتیبانی از آهنگ‌های تکراری در صف) */
export const nextInOrderWithIndex = (
  list: readonly Song[],
  currentId: string | null,
  loop: boolean,
  currentIndex = -1
): IndexedTrackPick => {
  if (list.length === 0) return { song: null, index: -1 };

  const index = resolveCurrentIndex(list, currentId, currentIndex);
  if (index === -1) return { song: list[0], index: 0 };
  if (index < list.length - 1) return { song: list[index + 1], index: index + 1 };
  return loop ? { song: list[0], index: 0 } : { song: null, index: -1 };
};

/** آهنگ قبلی و اندیس دقیق آن به ترتیب لیست (پشتیبانی از آهنگ‌های تکراری در صف) */
export const prevInOrderWithIndex = (
  list: readonly Song[],
  currentId: string | null,
  loop: boolean,
  currentIndex = -1
): IndexedTrackPick => {
  if (list.length === 0) return { song: null, index: -1 };

  const index = resolveCurrentIndex(list, currentId, currentIndex);
  if (index === -1) return { song: list[0], index: 0 };
  if (index > 0) return { song: list[index - 1], index: index - 1 };
  if (loop) {
    const lastIdx = list.length - 1;
    return { song: list[lastIdx], index: lastIdx };
  }
  return { song: null, index: -1 };
};

/** آهنگ بعدی به ترتیب لیست. اگه به انتها برسیم: با loop به اول برمی‌گرده، وگرنه null */
export const nextInOrder = (
  list: readonly Song[],
  currentId: string | null,
  loop: boolean,
  currentIndex = -1
): Song | null => nextInOrderWithIndex(list, currentId, loop, currentIndex).song;

/** آهنگ قبلی به ترتیب لیست. اگه به ابتدا برسیم: با loop به آخر می‌ره، وگرنه null */
export const prevInOrder = (
  list: readonly Song[],
  currentId: string | null,
  loop: boolean,
  currentIndex = -1
): Song | null => prevInOrderWithIndex(list, currentId, loop, currentIndex).song;

export interface ShufflePick {
  /** آهنگ انتخاب‌شده. null یعنی همه‌ی آهنگ‌ها یک بار پخش شدن و loop خاموشه */
  song: Song | null;
  /** مجموعه‌ی شناسه‌ی آهنگ‌های پخش‌شده در این دور (شامل آهنگ انتخاب‌شده) */
  played: Set<string>;
}

/**
 * شافل واقعی: در هر «دور» هر آهنگ دقیقاً یک بار پخش می‌شه.
 * وقتی دور تموم شد، با loop یه دور جدید شروع می‌شه (بدون تکرار آهنگ فعلی پشت سر هم).
 */
export const pickNextShuffled = (
  list: readonly Song[],
  currentId: string | null,
  played: ReadonlySet<string>,
  loop: boolean,
  random: () => number = Math.random,
): ShufflePick => {
  let used = new Set(played);
  if (currentId) used.add(currentId);

  let candidates = list.filter((song) => !used.has(song.id));

  if (candidates.length === 0) {
    if (!loop) return { song: null, played: used };

    used = new Set(currentId ? [currentId] : []);
    candidates = list.filter((song) => song.id !== currentId);
    if (candidates.length === 0) candidates = [...list]; // لیست تک‌آهنگی
  }

  if (candidates.length === 0) return { song: null, played: used };

  const song = candidates[Math.floor(random() * candidates.length)];
  used.add(song.id);
  return { song, played: used };
};
