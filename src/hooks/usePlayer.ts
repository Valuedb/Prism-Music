import { useCallback, useRef, useState } from 'react';
import { MAX_HISTORY } from '../player/constants';
import {
  nextInOrderWithIndex,
  pickNextShuffled,
  prevInOrderWithIndex,
} from '../player/navigation';
import { insertPlayNext, moveSongAfterCurrentInQueue } from '../player/queue';
import type { RepeatMode, Song } from '../types/index';
import { moveItem } from '../utils/array';
import { usePersistentState } from './usePersistentState';
import { STORAGE_KEYS } from '../storage/keys';

interface HistoryEntry {
  id: string;
  queueIndex: number;
}

const adjustIndexAfterMove = (idx: number, fromIndex: number, toIndex: number): number => {
  if (idx < 0) return -1;
  if (idx === fromIndex) return toIndex;
  if (fromIndex < toIndex && idx > fromIndex && idx <= toIndex) return idx - 1;
  if (fromIndex > toIndex && idx >= toIndex && idx < fromIndex) return idx + 1;
  return idx;
};

/**
 * حالت و منطق پخش: آهنگ فعلی، صف، اندیس دقیق آهنگ جاری در صف، شافل، تکرار و جابه‌جایی بعدی/قبلی.
 * خود عنصر <audio> در PlayerBar می‌مونه؛ این هوک فقط تصمیم می‌گیره «چی پخش بشه».
 *
 * @param songs کل کتابخانه (وقتی صف خالیه، از اینجا پخش می‌شه)
 */
export const usePlayer = (songs: readonly Song[]) => {
  const [currentSong, setCurrentSongState] = useState<Song | null>(null);
  const [queue, setQueueState] = useState<Song[]>([]);
  const [currentQueueIndex, setCurrentQueueIndexState] = useState<number>(-1);

  const [repeatMode, setRepeatMode] = usePersistentState<RepeatMode>(
    STORAGE_KEYS.repeatMode,
    'off',
    (v): v is RepeatMode => v === 'off' || v === 'all' || v === 'one'
  );
  const [isShuffle, setIsShuffleState] = usePersistentState<boolean>(
    STORAGE_KEYS.shuffle,
    false,
    (v): v is boolean => typeof v === 'boolean'
  );
  /** با هر شروع پخش یکی زیاد می‌شه تا حتی پخش مجدد همون آهنگ هم از اول شروع بشه */
  const [playToken, setPlayToken] = useState(0);

  /** رفرنس‌های همگام با state برای جلوگیری از تداخل در فراخوانی‌های پیاپی */
  const currentSongRef = useRef<Song | null>(null);
  const queueRef = useRef<Song[]>([]);
  const currentIndexRef = useRef<number>(-1);

  /** آهنگ‌های پخش‌شده در دور فعلی شافل */
  const playedIds = useRef<Set<string>>(new Set());
  /** تاریخچه‌ی پخش برای دکمه‌ی «قبلی» در حالت شافل */
  const history = useRef<HistoryEntry[]>([]);
  /** اندیس‌های اولویت‌دار «پخش بعدی» در صف تا حتی با شافل روشن هم دقیقاً آهنگ بعدی پخش شود */
  const priorityIndicesRef = useRef<number[]>([]);
  /** کش پیش‌بینی آهنگ بعدی در حالت شافل تا peekNext و playNext هم‌خوان باشند */
  const prepickedNextRef = useRef<{
    forId: string | null;
    song: Song | null;
    nextPlayed: Set<string>;
  } | null>(null);

  const setCurrentIndex = useCallback((idx: number) => {
    currentIndexRef.current = idx;
    setCurrentQueueIndexState(idx);
  }, []);

  const commitQueue = useCallback((nextQueue: Song[], nextIndex: number) => {
    queueRef.current = nextQueue;
    currentIndexRef.current = nextIndex;
    setQueueState(nextQueue);
    setCurrentQueueIndexState(nextIndex);
  }, []);

  const setCurrentSong = useCallback((song: Song | null) => {
    currentSongRef.current = song;
    setCurrentSongState(song);
  }, []);

  const remember = useCallback((nextId: string, nextQueueIndex: number) => {
    const cur = currentSongRef.current;
    if (!cur) return;
    if (cur.id === nextId && currentIndexRef.current === nextQueueIndex) return;
    history.current.push({ id: cur.id, queueIndex: currentIndexRef.current });
    if (history.current.length > MAX_HISTORY) history.current.shift();
  }, []);

  const start = useCallback(
    (song: Song) => {
      prepickedNextRef.current = null;
      setCurrentSong(song);
      setPlayToken((token) => token + 1);
    },
    [setCurrentSong]
  );

  /** بازیابی آخرین آهنگ پخش‌شده هنگام باز کردن مجدد برنامه بدون پخش خودکار */
  const restoreSong = useCallback((song: Song) => {
    if (!currentSongRef.current) {
      currentSongRef.current = song;
      setCurrentSongState(song);
    }
  }, []);

  /** پخش یک آهنگ از یک لیست (لیست می‌شه صف پخش) */
  const playSongFromList = useCallback(
    (song: Song, list: Song[], startIndex?: number) => {
      const resolvedIdx =
        typeof startIndex === 'number' &&
        startIndex >= 0 &&
        startIndex < list.length &&
        list[startIndex].id === song.id
          ? startIndex
          : list.findIndex((s) => s.id === song.id);
      remember(song.id, resolvedIdx);
      priorityIndicesRef.current = [];
      commitQueue(list, resolvedIdx);
      playedIds.current = new Set([song.id]);
      start(song);
    },
    [commitQueue, remember, start]
  );

  /** پیش‌نمایش بدون تغییر وضعیت برای آماده‌سازی Crossfade / Gapless */
  const peekNext = useCallback((): Song | null => {
    const curQueue = queueRef.current;
    for (const pIdx of priorityIndicesRef.current) {
      if (pIdx >= 0 && pIdx < curQueue.length) {
        return curQueue[pIdx];
      }
    }

    const activeList: readonly Song[] = curQueue.length > 0 ? curQueue : songs;
    const isUsingQueue = curQueue.length > 0;
    const currentId = currentSongRef.current?.id ?? null;
    const loop = repeatMode === 'all';

    if (!isShuffle) {
      return nextInOrderWithIndex(
        activeList,
        currentId,
        loop,
        isUsingQueue ? currentIndexRef.current : -1
      ).song;
    }

    const cached = prepickedNextRef.current;
    if (
      cached &&
      cached.forId === currentId &&
      (!cached.song || activeList.some((s) => s.id === cached.song!.id))
    ) {
      return cached.song;
    }
    const pick = pickNextShuffled(activeList, currentId, playedIds.current, loop);
    prepickedNextRef.current = {
      forId: currentId,
      song: pick.song,
      nextPlayed: pick.played,
    };
    return pick.song;
  }, [isShuffle, repeatMode, songs]);

  /** رفتن به آهنگ بعدی. اگه آهنگ بعدی‌ای نباشه false برمی‌گردونه */
  const playNext = useCallback((): boolean => {
    const curQueue = queueRef.current;

    while (priorityIndicesRef.current.length > 0) {
      const nextPriorityIdx = priorityIndicesRef.current.shift()!;
      if (nextPriorityIdx >= 0 && nextPriorityIdx < curQueue.length) {
        const prioritySong = curQueue[nextPriorityIdx];
        playedIds.current.add(prioritySong.id);
        remember(prioritySong.id, nextPriorityIdx);
        setCurrentIndex(nextPriorityIdx);
        start(prioritySong);
        return true;
      }
    }

    const activeList: readonly Song[] = curQueue.length > 0 ? curQueue : songs;
    const isUsingQueue = curQueue.length > 0;
    const currentId = currentSongRef.current?.id ?? null;
    const loop = repeatMode === 'all';

    if (isShuffle) {
      const cached = prepickedNextRef.current;
      let target: Song | null;
      if (
        cached &&
        cached.forId === currentId &&
        (!cached.song || activeList.some((s) => s.id === cached.song!.id))
      ) {
        playedIds.current = cached.nextPlayed;
        target = cached.song;
      } else {
        const pick = pickNextShuffled(activeList, currentId, playedIds.current, loop);
        playedIds.current = pick.played;
        target = pick.song;
      }
      prepickedNextRef.current = null;
      if (!target) return false;

      const targetIdx = isUsingQueue
        ? curQueue.findIndex((s) => s.id === target!.id)
        : -1;
      remember(target.id, targetIdx);
      if (isUsingQueue) setCurrentIndex(targetIdx);
      start(target);
      return true;
    }

    const pick = nextInOrderWithIndex(
      activeList,
      currentId,
      loop,
      isUsingQueue ? currentIndexRef.current : -1
    );
    if (!pick.song) return false;
    remember(pick.song.id, pick.index);
    if (isUsingQueue) setCurrentIndex(pick.index);
    start(pick.song);
    return true;
  }, [isShuffle, remember, repeatMode, setCurrentIndex, songs, start]);

  /** رفتن به آهنگ قبلی (در شافل: آخرین آهنگی که واقعاً گوش داده شده). اگه نباشه false */
  const playPrev = useCallback((): boolean => {
    const curQueue = queueRef.current;
    const activeList: readonly Song[] = curQueue.length > 0 ? curQueue : songs;
    const isUsingQueue = curQueue.length > 0;

    if (isShuffle) {
      let target: Song | null = null;
      let targetIdx = -1;

      while (history.current.length > 0 && !target) {
        const prevEntry = history.current.pop()!;
        if (
          isUsingQueue &&
          prevEntry.queueIndex >= 0 &&
          prevEntry.queueIndex < curQueue.length &&
          curQueue[prevEntry.queueIndex].id === prevEntry.id
        ) {
          target = curQueue[prevEntry.queueIndex];
          targetIdx = prevEntry.queueIndex;
        } else {
          const foundIdx = activeList.findIndex((song) => song.id === prevEntry.id);
          if (foundIdx !== -1 && activeList[foundIdx].id !== currentSongRef.current?.id) {
            target = activeList[foundIdx];
            targetIdx = isUsingQueue ? foundIdx : -1;
          }
        }
      }

      if (!target) return false;
      if (isUsingQueue) setCurrentIndex(targetIdx);
      start(target);
      return true;
    }

    const pick = prevInOrderWithIndex(
      activeList,
      currentSongRef.current?.id ?? null,
      repeatMode === 'all',
      isUsingQueue ? currentIndexRef.current : -1
    );
    if (!pick.song) return false;
    if (isUsingQueue) setCurrentIndex(pick.index);
    start(pick.song);
    return true;
  }, [isShuffle, repeatMode, setCurrentIndex, songs, start]);

  const setShuffle = useCallback(
    (value: boolean) => {
      prepickedNextRef.current = null;
      setIsShuffleState(value);
      playedIds.current = new Set(currentSongRef.current ? [currentSongRef.current.id] : []);
    },
    [setIsShuffleState]
  );

  const addToQueue = useCallback(
    (song: Song) => {
      prepickedNextRef.current = null;
      const nextQueue = [...queueRef.current, song];
      commitQueue(nextQueue, currentIndexRef.current);
    },
    [commitQueue]
  );

  /**
   * قراردادن یک یا چند آهنگ به عنوان «پخش بعدی» بلافاصله پس از آهنگ جاری
   * بدون حذف نسخه‌ی قبلی همان آهنگ‌ها از صف
   */
  const playNextSongs = useCallback(
    (incoming: Song | Song[]) => {
      const list = Array.isArray(incoming) ? incoming : [incoming];
      if (list.length === 0) return;

      prepickedNextRef.current = null;
      const curQueue = queueRef.current;
      const curSong = currentSongRef.current;
      const res = insertPlayNext(curQueue, curSong, list, currentIndexRef.current);

      const addedCount = res.insertedIds.length;
      const shiftedExisting = priorityIndicesRef.current.map((idx) =>
        res.insertIndex >= 0 && idx >= res.insertIndex ? idx + addedCount : idx
      );
      const insertedIndices =
        res.insertIndex >= 0
          ? Array.from({ length: addedCount }, (_, offset) => res.insertIndex + offset)
          : [];

      commitQueue(res.queue, res.currentIndex);

      if (res.startSong) {
        priorityIndicesRef.current = insertedIndices.slice(1);
        playedIds.current = new Set([res.startSong.id]);
        start(res.startSong);
      } else if (insertedIndices.length > 0) {
        priorityIndicesRef.current = [...insertedIndices, ...shiftedExisting];
      }
    },
    [commitQueue, start]
  );

  /** حذف با اندیس (نه id) تا اگه یه آهنگ دو بار توی صف بود، فقط همون یکی حذف بشه */
  const removeFromQueueAt = useCallback(
    (index: number) => {
      const prev = queueRef.current;
      if (index < 0 || index >= prev.length) return;

      const nextQueue = prev.filter((_, i) => i !== index);
      let nextCurrent = currentIndexRef.current;
      if (nextCurrent === index) {
        nextCurrent = -1;
      } else if (nextCurrent > index) {
        nextCurrent -= 1;
      }

      priorityIndicesRef.current = priorityIndicesRef.current
        .filter((idx) => idx !== index)
        .map((idx) => (idx > index ? idx - 1 : idx));

      commitQueue(nextQueue, nextCurrent);
    },
    [commitQueue]
  );

  const reorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      const prev = queueRef.current;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return;
      }
      const nextQueue = moveItem(prev, fromIndex, toIndex);
      const nextCurrent = adjustIndexAfterMove(currentIndexRef.current, fromIndex, toIndex);
      priorityIndicesRef.current = priorityIndicesRef.current.map((idx) =>
        adjustIndexAfterMove(idx, fromIndex, toIndex)
      );
      commitQueue(nextQueue, nextCurrent);
    },
    [commitQueue]
  );

  /** پخش مستقیم یکی از آهنگ‌های داخل صف بر اساس اندیس دقیق */
  const playQueueSongAt = useCallback(
    (index: number) => {
      const curQueue = queueRef.current;
      const target = curQueue[index];
      if (!target) return;
      priorityIndicesRef.current = priorityIndicesRef.current.filter((idx) => idx > index);
      remember(target.id, index);
      setCurrentIndex(index);
      playedIds.current.add(target.id);
      start(target);
    },
    [remember, setCurrentIndex, start]
  );

  /** پاک کردن کل صف پخش */
  const clearQueue = useCallback(() => {
    priorityIndicesRef.current = [];
    prepickedNextRef.current = null;
    commitQueue([], -1);
  }, [commitQueue]);

  /** بر زدن تصادفی آهنگ‌های صف پخش (با حفظ موقعیت دقیق آهنگ در حال پخش) */
  const shuffleQueue = useCallback(() => {
    priorityIndicesRef.current = [];
    prepickedNextRef.current = null;
    const prev = queueRef.current;
    if (prev.length <= 1) return;

    const currentId = currentSongRef.current?.id;
    const savedIdx = currentIndexRef.current;
    const currentIdx =
      savedIdx >= 0 && savedIdx < prev.length && (!currentId || prev[savedIdx].id === currentId)
        ? savedIdx
        : currentId
        ? prev.findIndex((s) => s.id === currentId)
        : -1;

    if (currentIdx === -1 || currentIdx >= prev.length - 2) {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      const nextCurrent =
        currentId && currentIdx !== -1 ? copy.findIndex((s) => s.id === currentId) : -1;
      commitQueue(copy, nextCurrent);
      return;
    }

    const head = prev.slice(0, currentIdx + 1);
    const tail = prev.slice(currentIdx + 1);
    for (let i = tail.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tail[i], tail[j]] = [tail[j], tail[i]];
    }
    commitQueue([...head, ...tail], currentIdx);
  }, [commitQueue]);

  /** جابه‌جایی آهنگ داخل صف به جایگاه بلافاصله پس از آهنگ جاری */
  const playNextInQueue = useCallback(
    (index: number) => {
      prepickedNextRef.current = null;
      const prev = queueRef.current;
      const target = prev[index];
      const curIdx = currentIndexRef.current;
      if (!target || index === curIdx) return;

      const { queue: nextQueue, movedId } = moveSongAfterCurrentInQueue(
        prev,
        index,
        currentSongRef.current?.id ?? null
      );
      if (!movedId) return;

      const resolvedCur =
        curIdx >= 0 && curIdx < prev.length
          ? curIdx
          : currentSongRef.current
          ? prev.findIndex((s) => s.id === currentSongRef.current!.id)
          : -1;
      let targetIdx = resolvedCur === -1 ? 0 : resolvedCur + 1;
      if (index < targetIdx) targetIdx -= 1;

      const nextCurrent = adjustIndexAfterMove(curIdx, index, targetIdx);
      const updatedPriority = priorityIndicesRef.current
        .filter((i) => i !== index)
        .map((i) => adjustIndexAfterMove(i, index, targetIdx));
      priorityIndicesRef.current = [targetIdx, ...updatedPriority];
      commitQueue(nextQueue, nextCurrent);
    },
    [commitQueue]
  );

  /** جابه‌جایی یک آهنگ یک پله به بالا یا پایین */
  const moveQueueItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= queueRef.current.length) return;
      reorderQueue(fromIndex, toIndex);
    },
    [reorderQueue]
  );

  /** وقتی اطلاعات یه آهنگ ویرایش شد، نسخه‌ی داخل صف و پلیر رو هم به‌روز کن */
  const syncSong = useCallback(
    (updated: Song) => {
      const nextQueue = queueRef.current.map((song) =>
        song.id === updated.id ? updated : song
      );
      commitQueue(nextQueue, currentIndexRef.current);
      if (currentSongRef.current?.id === updated.id) {
        setCurrentSong(updated);
      }
    },
    [commitQueue, setCurrentSong]
  );

  /** وقتی آهنگی از کتابخانه حذف شد: از صف در بیار و اگه در حال پخش بود، پلیر رو خالی کن */
  const removeSong = useCallback(
    (id: string) => {
      const prev = queueRef.current;
      const indexMap = new Map<number, number>();
      const nextQueue: Song[] = [];
      prev.forEach((song, oldIdx) => {
        if (song.id !== id) {
          indexMap.set(oldIdx, nextQueue.length);
          nextQueue.push(song);
        }
      });

      const nextCurrent = indexMap.get(currentIndexRef.current) ?? -1;
      priorityIndicesRef.current = priorityIndicesRef.current
        .map((idx) => indexMap.get(idx))
        .filter((idx): idx is number => idx !== undefined);

      commitQueue(nextQueue, nextCurrent);
      if (currentSongRef.current?.id === id) {
        setCurrentSong(null);
      }
    },
    [commitQueue, setCurrentSong]
  );

  return {
    currentSong,
    queue,
    currentQueueIndex,
    repeatMode,
    isShuffle,
    playToken,
    setRepeatMode,
    setShuffle,
    restoreSong,
    playSongFromList,
    peekNext,
    playNext,
    playPrev,
    addToQueue,
    playNextSongs,
    removeFromQueueAt,
    reorderQueue,
    playQueueSongAt,
    clearQueue,
    shuffleQueue,
    playNextInQueue,
    moveQueueItem,
    syncSong,
    removeSong,
  };
};
