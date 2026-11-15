import type { Song } from '../types/index';

export interface PlayNextInsertResult {
  queue: Song[];
  /** اگر هیچ آهنگی در حال پخش نباشد، اولین آهنگ برای شروع آماده می‌شود */
  startSong: Song | null;
  insertedIds: string[];
  /** اندیس شروع درج آهنگ‌های جدید در صف */
  insertIndex: number;
  /** اندیس آهنگ در حال پخش در صف جدید */
  currentIndex: number;
}

/**
 * افزودن یک یا چند آهنگ به عنوان «پخش بعدی» بلافاصله بعد از آهنگ جاری،
 * بدون حذف یا جابه‌جا کردن نسخه قبلی همان آهنگ‌ها در ادامه یا ابتدای صف.
 * مثال: در صف [1, 2, 3, 4, 5, 6] وقتی آهنگ 1 در حال پخش است و 5 برای Play Next انتخاب شود،
 * صف تبدیل به [1, 5, 2, 3, 4, 5, 6] می‌شود (آهنگ 5 در خانه 2 اضافه و نسخه قبلی‌اش به خانه 6 منتقل می‌شود).
 */
export const insertPlayNext = (
  currentQueue: readonly Song[],
  currentSong: Song | null,
  incoming: readonly Song[],
  currentIndex = -1,
): PlayNextInsertResult => {
  if (incoming.length === 0) {
    return {
      queue: [...currentQueue],
      startSong: null,
      insertedIds: [],
      insertIndex: -1,
      currentIndex,
    };
  }

  // حذف تکراری‌های درون خود ورودی با حفظ ترتیب
  const uniqueIncoming: Song[] = [];
  const incomingIdSet = new Set<string>();
  for (const s of incoming) {
    if (!incomingIdSet.has(s.id)) {
      incomingIdSet.add(s.id);
      uniqueIncoming.push(s);
    }
  }
  const insertedIds = uniqueIncoming.map((s) => s.id);

  if (currentQueue.length === 0) {
    if (!currentSong) {
      return {
        queue: [...uniqueIncoming],
        startSong: uniqueIncoming[0],
        insertedIds,
        insertIndex: 0,
        currentIndex: 0,
      };
    }
    return {
      queue: [currentSong, ...uniqueIncoming],
      startSong: null,
      insertedIds,
      insertIndex: 1,
      currentIndex: 0,
    };
  }

  const hasValidCurrentIndex =
    Number.isInteger(currentIndex) &&
    currentIndex >= 0 &&
    currentIndex < currentQueue.length &&
    (!currentSong || currentQueue[currentIndex].id === currentSong.id);

  const resolvedCurrentIdx = hasValidCurrentIndex
    ? currentIndex
    : currentSong
    ? currentQueue.findIndex((s) => s.id === currentSong.id)
    : -1;

  if (resolvedCurrentIdx === -1) {
    return {
      queue: [...uniqueIncoming, ...currentQueue],
      startSong: null,
      insertedIds,
      insertIndex: 0,
      currentIndex: -1,
    };
  }

  const head = currentQueue.slice(0, resolvedCurrentIdx + 1);
  const tail = currentQueue.slice(resolvedCurrentIdx + 1);

  return {
    queue: [...head, ...uniqueIncoming, ...tail],
    startSong: null,
    insertedIds,
    insertIndex: resolvedCurrentIdx + 1,
    currentIndex: resolvedCurrentIdx,
  };
};

/**
 * انتخاب اولین آهنگ معتبر از صف اولویت‌دار «پخش بعدی» که در لیست پخش موجود است
 */
export const peekPrioritySong = (
  priorityIds: readonly string[],
  baseList: readonly Song[],
): Song | null => {
  for (const id of priorityIds) {
    const found = baseList.find((s) => s.id === id);
    if (found) return found;
  }
  return null;
};

/**
 * مصرف اولین آهنگ معتبر از صف اولویت‌دار «پخش بعدی» و بازگرداندن لیست باقیمانده
 */
export const popPrioritySong = (
  priorityIds: readonly string[],
  baseList: readonly Song[],
): { song: Song | null; remainingIds: string[] } => {
  for (let i = 0; i < priorityIds.length; i++) {
    const id = priorityIds[i];
    const found = baseList.find((s) => s.id === id);
    if (found) {
      return {
        song: found,
        remainingIds: priorityIds.slice(i + 1),
      };
    }
  }
  return { song: null, remainingIds: [] };
};

/**
 * انتقال یک آهنگ در صف دقیقاً به خانه بلافاصله بعد از آهنگ در حال پخش (Play Next واقعی در صف)
 */
export const moveSongAfterCurrentInQueue = (
  queue: readonly Song[],
  fromIndex: number,
  currentSongId: string | null
): { queue: Song[]; movedId: string | null } => {
  if (
    !Number.isInteger(fromIndex) ||
    fromIndex < 0 ||
    fromIndex >= queue.length
  ) {
    return { queue: [...queue], movedId: null };
  }

  const moved = queue[fromIndex];
  const currentIdx = currentSongId
    ? queue.findIndex((s) => s.id === currentSongId)
    : -1;

  if (currentIdx === fromIndex) {
    return { queue: [...queue], movedId: null };
  }

  let targetIndex = currentIdx === -1 ? 0 : currentIdx + 1;
  if (fromIndex < targetIndex) {
    targetIndex -= 1;
  }

  if (fromIndex === targetIndex) {
    return { queue: [...queue], movedId: moved.id };
  }

  const next = [...queue];
  next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, moved);
  return { queue: next, movedId: moved.id };
};
