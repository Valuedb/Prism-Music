import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  Shuffle,
  X,
  Search,
  GripVertical,
  ListMusic,
  Volume2,
  BookmarkPlus,
  Check,
  CheckSquare,
  ListStart,
  Play,
  MoreHorizontal,
} from 'lucide-react';
import type { Song } from '../types';
import { withAlpha } from '../utils/color';
import { CoverImage } from './CoverImage';
import { clampContextMenuPosition, computeAnchorMenuPosition } from '../utils/contextMenu';
import {
  computeAutoScrollDelta,
  computeTargetIndexFromInsertionSlot,
} from '../utils/queueDrag';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Song[];
  currentSong: Song | null;
  currentQueueIndex?: number;
  isPlaying: boolean;
  onPlaySong: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onRemoveSelectedFromQueue?: (indices: number[]) => void;
  onPlayNextInQueue?: (index: number) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  onCreatePlaylist?: (name: string, songs: Song[]) => void;
  theme: any;
  t: any;
  isMobile: boolean;
  inFullScreen?: boolean;
}

interface ActiveDragState {
  sourceQueueIndex: number;
  song: Song;
  insertionSlot: number;
  hoverQueueIndex: number;
  indicatorPosition: 'above' | 'below';
  floatingTop: number;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  currentSong,
  currentQueueIndex = -1,
  isPlaying,
  onPlaySong,
  onRemoveFromQueue,
  onRemoveSelectedFromQueue,
  onPlayNextInQueue,
  onReorderQueue,
  onClearQueue,
  onShuffleQueue,
  onCreatePlaylist,
  theme,
  t,
  isMobile,
  inFullScreen = false,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [isSavingPlaylist, setIsSavingPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedQueueIndices, setSelectedQueueIndices] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    queueIndex: number;
    left: number;
    top: number;
    originY: 'top' | 'bottom';
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const currentSongRowRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<{
    pointerId: number;
    sourceQueueIndex: number;
    song: Song;
    startX: number;
    startY: number;
    pointerY: number;
    thresholdPx: number;
    isActive: boolean;
  } | null>(null);
  const activeDragRef = useRef<ActiveDragState | null>(null);
  const justDraggedRef = useRef(false);
  const lastSelectedAnchorRef = useRef<number | null>(null);
  const queueLengthRef = useRef(queue.length);
  const onReorderQueueRef = useRef(onReorderQueue);
  const wasOpenRef = useRef(false);
  const [isShortWindow, setIsShortWindow] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight < 680 : false
  );

  useEffect(() => {
    const handleResize = () => setIsShortWindow(window.innerHeight < 680);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    queueLengthRef.current = queue.length;
    setSelectedQueueIndices((prev) => {
      const valid = prev.filter((idx) => idx >= 0 && idx < queue.length);
      return valid.length === prev.length ? prev : valid;
    });
    if (queue.length === 0) {
      setIsSelectMode(false);
      setContextMenu(null);
    }
  }, [queue.length]);

  useEffect(() => {
    onReorderQueueRef.current = onReorderQueue;
  }, [onReorderQueue]);

  const activePointerIdRef = useRef<number | null>(null);

  const cancelDragSession = useCallback(() => {
    if (activePointerIdRef.current !== null && listScrollRef.current) {
      try {
        if (listScrollRef.current.hasPointerCapture?.(activePointerIdRef.current)) {
          listScrollRef.current.releasePointerCapture(activePointerIdRef.current);
        }
      } catch {
        // ignore pointer capture release error
      }
      activePointerIdRef.current = null;
    }
    dragSessionRef.current = null;
    activeDragRef.current = null;
    setDragState(null);
    if (typeof document !== 'undefined') {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, []);

  // ریست وضعیت‌های موقت هنگام بسته شدن کشو
  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
      setIsSavingPlaylist(false);
      setFilterQuery('');
      setIsSelectMode(false);
      setSelectedQueueIndices([]);
      setContextMenu(null);
      cancelDragSession();
    }
  }, [isOpen, cancelDragSession]);

  // بستن منوی سه‌نقطه/راست‌کلیک صف با کلیک بیرون، اسکرول یا ریسایز
  useEffect(() => {
    if (!contextMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleClose = () => setContextMenu(null);
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  // بستن کشو با کلید Escape پیش از پنجره‌های زیرین (در حال کشیدن ابتدا درگ لغو می‌شود)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (dragSessionRef.current || activeDragRef.current) {
          cancelDragSession();
          return;
        }
        if (isSelectMode) {
          setIsSelectMode(false);
          setSelectedQueueIndices([]);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, contextMenu, isSelectMode, onClose, cancelDragSession]);

  // زمان‌سنج ریست تأیید پاک‌کردن صف
  useEffect(() => {
    if (confirmClear) {
      const timer = setTimeout(() => setConfirmClear(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [confirmClear]);

  // لیست نمایشی صف دقیقاً متناظر با آیتم‌های واقعی queue است تا حذف هر آهنگ (حتی آهنگ در حال پخش) باعث بازگشت شبحی آن نشود
  const displayQueue = queue;

  const hasExactQueueMatch =
    Boolean(currentSong) &&
    currentQueueIndex >= 0 &&
    currentQueueIndex < queue.length &&
    queue[currentQueueIndex]?.id === currentSong?.id;

  // ایندکس دقیق آهنگ جاری در صف (در صورت حضور)
  const currentDisplayIndex = useMemo(() => {
    if (!currentSong) return -1;
    if (hasExactQueueMatch) return currentQueueIndex;
    return displayQueue.findIndex((s) => s.id === currentSong.id);
  }, [displayQueue, currentSong, hasExactQueueMatch, currentQueueIndex]);

  // اسکرول خودکار به آهنگ در حال پخش فقط هنگام باز شدن پنل (نه بعد از جابه‌جایی آهنگ‌ها)
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (justOpened && currentSongRowRef.current) {
      const timer = setTimeout(() => {
        currentSongRowRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSavePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = playlistName.trim();
    if (!trimmed || displayQueue.length === 0 || !onCreatePlaylist) return;
    onCreatePlaylist(trimmed, displayQueue);
    setIsSavingPlaylist(false);
    setPlaylistName('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // مجموع زمان کل صف
  const totalDurationFormatted = useMemo(() => {
    const totalSecs = displayQueue.reduce((acc, song) => acc + (song.duration || 0), 0);
    if (!totalSecs) return null;
    const mins = Math.floor(totalSecs / 60);
    const secs = Math.floor(totalSecs % 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours}h ${remMins}m`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, [displayQueue]);

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const indexedList = useMemo(() => {
    return displayQueue.map((song, displayIndex) => ({
      song,
      displayIndex,
      queueIndex: displayIndex,
    }));
  }, [displayQueue]);

  const filteredList = useMemo(() => {
    if (!filterQuery.trim()) return indexedList;
    const q = filterQuery.toLowerCase();
    return indexedList.filter(
      ({ song }) =>
        song.name.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q)
    );
  }, [indexedList, filterQuery]);

  // محاسبه‌ی جایگاه دقیق رها کردن بر اساس موقعیت عمودی نشانگر (بدون فضای مرده بین ردیف‌ها)
  const computeDropTarget = useCallback((clientY: number) => {
    const scrollEl = listScrollRef.current;
    if (!scrollEl) return null;
    const rows = Array.from(scrollEl.querySelectorAll<HTMLElement>('[data-queue-index]'));
    if (rows.length === 0) return null;

    for (let i = 0; i < rows.length; i++) {
      const el = rows[i];
      const qIdx = Number(el.dataset.queueIndex);
      if (!Number.isInteger(qIdx) || qIdx < 0) continue;
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        return {
          hoverQueueIndex: qIdx,
          indicatorPosition: 'above' as const,
          insertionSlot: qIdx,
        };
      }
      if (i === rows.length - 1) {
        return {
          hoverQueueIndex: qIdx,
          indicatorPosition: 'below' as const,
          insertionSlot: qIdx + 1,
        };
      }
    }

    const lastIdx = Number(rows[rows.length - 1].dataset.queueIndex);
    if (!Number.isInteger(lastIdx) || lastIdx < 0) return null;
    return {
      hoverQueueIndex: lastIdx,
      indicatorPosition: 'below' as const,
      insertionSlot: lastIdx + 1,
    };
  }, []);

  const syncDragStateFromPointerY = useCallback(
    (clientY: number) => {
      const session = dragSessionRef.current;
      if (!session || !session.isActive) return;
      const target = computeDropTarget(clientY);
      if (!target) return;

      const panelRect = containerRef.current?.getBoundingClientRect();
      const panelTop = panelRect?.top ?? 0;
      const panelHeight = panelRect?.height ?? 500;
      const floatingTop = Math.max(78, Math.min(panelHeight - 64, clientY - panelTop - 27));

      const prev = activeDragRef.current;
      if (
        prev &&
        prev.insertionSlot === target.insertionSlot &&
        prev.hoverQueueIndex === target.hoverQueueIndex &&
        prev.indicatorPosition === target.indicatorPosition &&
        Math.abs(prev.floatingTop - floatingTop) < 0.5
      ) {
        return;
      }

      const nextState: ActiveDragState = {
        sourceQueueIndex: session.sourceQueueIndex,
        song: session.song,
        insertionSlot: target.insertionSlot,
        hoverQueueIndex: target.hoverQueueIndex,
        indicatorPosition: target.indicatorPosition,
        floatingTop,
      };
      activeDragRef.current = nextState;
      setDragState(nextState);
    },
    [computeDropTarget]
  );

  // لیسنرهای سراسری Pointer و حلقه‌ی requestAnimationFrame برای اسکرول خودکار لبه‌ها
  useEffect(() => {
    if (!isOpen) return;

    let rafId: number | null = null;

    const tickAutoScroll = () => {
      const session = dragSessionRef.current;
      const scrollEl = listScrollRef.current;
      if (!session || !session.isActive || !scrollEl) {
        rafId = null;
        return;
      }

      const rect = scrollEl.getBoundingClientRect();
      const maxScrollTop = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
      const delta = computeAutoScrollDelta(
        session.pointerY,
        rect.top,
        rect.bottom,
        scrollEl.scrollTop,
        maxScrollTop,
        72,
        16
      );

      if (delta !== 0) {
        scrollEl.scrollTop += delta;
        syncDragStateFromPointerY(session.pointerY);
      }

      rafId = window.requestAnimationFrame(tickAutoScroll);
    };

    const ensureAutoScrollLoop = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(tickAutoScroll);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      session.pointerY = e.clientY;

      if (!session.isActive) {
        const dx = e.clientX - session.startX;
        const dy = e.clientY - session.startY;
        if (Math.hypot(dx, dy) < session.thresholdPx) return;

        session.isActive = true;
        justDraggedRef.current = true;
        activePointerIdRef.current = e.pointerId;
        try {
          listScrollRef.current?.setPointerCapture?.(e.pointerId);
        } catch {
          // ignore if element cannot capture pointer
        }
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        window.getSelection()?.removeAllRanges();
        ensureAutoScrollLoop();
      }

      syncDragStateFromPointerY(e.clientY);
    };

    const finishDrag = (e: PointerEvent, cancelled: boolean) => {
      const session = dragSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      const wasActive = session.isActive;
      const finalActive = activeDragRef.current;
      cancelDragSession();

      if (!cancelled && wasActive && finalActive) {
        const targetIndex = computeTargetIndexFromInsertionSlot(
          finalActive.sourceQueueIndex,
          finalActive.insertionSlot,
          queueLengthRef.current
        );
        if (targetIndex !== finalActive.sourceQueueIndex) {
          onReorderQueueRef.current(finalActive.sourceQueueIndex, targetIndex);
        }
      }

      if (wasActive) {
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 60);
      }
    };

    const handlePointerUp = (e: PointerEvent) => finishDrag(e, false);
    const handlePointerCancel = (e: PointerEvent) => finishDrag(e, true);
    const handleWindowBlur = () => {
      if (dragSessionRef.current) {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
          rafId = null;
        }
        cancelDragSession();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
      if (dragSessionRef.current) {
        cancelDragSession();
      }
    };
  }, [isOpen, syncDragStateFromPointerY, cancelDragSession]);

  const handleListPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isSelectMode || queue.length <= 1) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const targetEl = e.target as HTMLElement | null;
      if (!targetEl) return;
      if (targetEl.closest('[data-queue-no-drag]')) return;

      const rowEl = targetEl.closest<HTMLElement>('[data-queue-index]');
      if (!rowEl) return;

      const queueIndex = Number(rowEl.dataset.queueIndex);
      if (!Number.isInteger(queueIndex) || queueIndex < 0 || queueIndex >= queue.length) return;

      const fromHandle = Boolean(targetEl.closest('[data-queue-handle]'));
      // در لمس تنها کشیدن از دستگیره درگ انجام می‌شود تا اسکرول طبیعی لیست مختل نشود
      if (!fromHandle && e.pointerType === 'touch') return;

      // جلوگیری از شروع درگ بومی تصویر/متن مرورگر و لغو شدن pointermove روی دسکتاپ
      if (fromHandle || e.pointerType === 'mouse') {
        e.preventDefault();
      }
      if (fromHandle) {
        e.stopPropagation();
      }

      justDraggedRef.current = false;
      dragSessionRef.current = {
        pointerId: e.pointerId,
        sourceQueueIndex: queueIndex,
        song: queue[queueIndex],
        startX: e.clientX,
        startY: e.clientY,
        pointerY: e.clientY,
        thresholdPx: fromHandle ? 2 : 6,
        isActive: false,
      };
    },
    [isSelectMode, queue]
  );

  const selectedSet = useMemo(() => new Set(selectedQueueIndices), [selectedQueueIndices]);

  const selectableIndices = useMemo(
    () =>
      filteredList
        .map((item) => item.queueIndex)
        .filter((idx) => idx >= 0 && idx < queue.length),
    [filteredList, queue.length]
  );

  const allVisibleSelected =
    selectableIndices.length > 0 &&
    selectableIndices.every((idx) => selectedSet.has(idx));

  const toggleSelectIndex = useCallback((queueIndex: number, shiftKey = false) => {
    if (queueIndex < 0) return;
    if (shiftKey && lastSelectedAnchorRef.current !== null) {
      const anchor = lastSelectedAnchorRef.current;
      const start = Math.min(anchor, queueIndex);
      const end = Math.max(anchor, queueIndex);
      const range = selectableIndices.filter((idx) => idx >= start && idx <= end);
      setSelectedQueueIndices((prev) => Array.from(new Set([...prev, ...range])));
      lastSelectedAnchorRef.current = queueIndex;
      return;
    }
    lastSelectedAnchorRef.current = queueIndex;
    setSelectedQueueIndices((prev) =>
      prev.includes(queueIndex)
        ? prev.filter((idx) => idx !== queueIndex)
        : [...prev, queueIndex]
    );
  }, [selectableIndices]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedQueueIndices.length === 0) return;
    if (onRemoveSelectedFromQueue) {
      onRemoveSelectedFromQueue(selectedQueueIndices);
    } else {
      const sortedDesc = [...selectedQueueIndices].sort((a, b) => b - a);
      sortedDesc.forEach((idx) => onRemoveFromQueue(idx));
    }
    setSelectedQueueIndices([]);
    lastSelectedAnchorRef.current = null;
    setIsSelectMode(false);
  }, [selectedQueueIndices, onRemoveSelectedFromQueue, onRemoveFromQueue]);

  // میانبرهای کیبورد صف پخش: Ctrl+A انتخاب همه، Delete/Backspace حذف انتخاب‌شده‌ها
  useEffect(() => {
    if (!isOpen || queue.length === 0) return;
    const handleSelectionKeys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA' && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu(null);
        setConfirmClear(false);
        setIsSelectMode(true);
        setSelectedQueueIndices(selectableIndices);
        return;
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        isSelectMode &&
        selectedQueueIndices.length > 0
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleSelectionKeys, true);
    return () => window.removeEventListener('keydown', handleSelectionKeys, true);
  }, [isOpen, queue.length, isSelectMode, selectedQueueIndices.length, selectableIndices, handleDeleteSelected]);

  const handleRowClick = useCallback(
    (e: React.MouseEvent, queueIndex: number) => {
      if (justDraggedRef.current) return;
      if (queueIndex < 0) return;
      if (!isSelectMode && (e.ctrlKey || e.metaKey)) {
        setContextMenu(null);
        setConfirmClear(false);
        setIsSelectMode(true);
        lastSelectedAnchorRef.current = queueIndex;
        setSelectedQueueIndices([queueIndex]);
        return;
      }
      if (e.shiftKey) {
        setContextMenu(null);
        setConfirmClear(false);
        if (!isSelectMode) {
          setIsSelectMode(true);
          lastSelectedAnchorRef.current = queueIndex;
          setSelectedQueueIndices([queueIndex]);
        } else {
          toggleSelectIndex(queueIndex, true);
        }
        return;
      }
      if (isSelectMode) {
        toggleSelectIndex(queueIndex, false);
        return;
      }
      onPlaySong(queueIndex);
    },
    [isSelectMode, onPlaySong, toggleSelectIndex]
  );

  if (typeof document === 'undefined') return null;

  const draggedQueueIndex = dragState?.sourceQueueIndex ?? null;
  const floatingTop = dragState?.floatingTop ?? 0;

  const isRTL = t.close !== 'Close';
  const primaryColor = theme.colors.primary || '#0a84ff';
  const textPrimary = theme.colors.textPrimary || (theme.isDark ? '#f4f4f5' : '#18181b');
  const textSecondary = theme.colors.textSecondary || (theme.isDark ? '#a1a1aa' : '#71717a');
  const borderColor = theme.colors.border || (theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');

  const panelBackground =
    theme.glass?.bar?.background ||
    (theme.isDark ? 'rgba(24, 24, 28, 0.94)' : 'rgba(255, 255, 255, 0.94)');
  const panelBorder = theme.glass?.bar?.border || `1px solid ${borderColor}`;
  const panelShadow =
    theme.glass?.bar?.boxShadow ||
    (theme.isDark ? '-16px 0 48px rgba(0,0,0,0.52)' : '-12px 0 40px rgba(0,0,0,0.14)');

  return createPortal(
    <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="queue-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.44)' : 'rgba(0, 0, 0, 0.24)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 1000010,
          }}
        />
      )}

      {isOpen && (
        <motion.aside
          key="queue-panel"
          ref={containerRef}
          data-queue-drawer="true"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.85 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: isMobile ? 0 : isShortWindow ? '10px' : '16px',
            bottom: isMobile
              ? 0
              : inFullScreen
              ? isShortWindow
                ? '10px'
                : '16px'
              : isShortWindow
              ? '92px'
              : '112px',
            right: isMobile ? 0 : '16px',
            left: 'auto',
            width: isMobile ? 'min(380px, 88vw)' : 'min(395px, calc(100vw - 32px))',
            background: panelBackground,
            backdropFilter: `blur(${Math.max(28, theme.display?.glassBlur ?? 28)}px) saturate(185%)`,
            WebkitBackdropFilter: `blur(${Math.max(28, theme.display?.glassBlur ?? 28)}px) saturate(185%)`,
            borderRadius: isMobile ? '24px 0 0 24px' : '24px',
            border: panelBorder,
            boxShadow: panelShadow,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000011,
            overflow: 'hidden',
            color: textPrimary,
            direction: isRTL ? 'rtl' : 'ltr',
            fontFamily: theme.fonts?.main,
          }}
        >
          <style>{`
            .q-row { transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease; }
            ${dragState ? '' : `.q-row:hover .q-del-btn { opacity: 1 !important; }
            .q-row:hover { background-color: ${withAlpha(primaryColor, theme.isDark ? 0.09 : 0.06)} !important; }`}
            .q-del-btn:hover { color: #ef4444 !important; opacity: 1 !important; background-color: rgba(239, 68, 68, 0.12) !important; }
            .q-icon-btn { transition: opacity 0.15s ease, background-color 0.15s ease, transform 0.12s ease; }
            .q-icon-btn:hover { opacity: 0.85; background-color: ${withAlpha(textPrimary, theme.isDark ? 0.08 : 0.06)} !important; }
            .q-icon-btn:active { transform: scale(0.94); }
          `}</style>

          {/* هدر شیشه‌ای صف پخش */}
          <div
            style={{
              padding: isMobile ? '18px 18px 12px' : '18px 20px 12px',
              borderBottom: `1px solid ${borderColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    backgroundColor: withAlpha(primaryColor, 0.15),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: primaryColor,
                    flexShrink: 0,
                  }}
                >
                  <ListMusic size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.9688rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                    {t.queueTitle || t.queue || 'صف پخش'}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: textSecondary,
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentDisplayIndex !== -1 ? (
                      <span>
                        {(t.direction === 'ltr' || t.close === 'Close')
                          ? `Track ${currentDisplayIndex + 1} of ${displayQueue.length}`
                          : `آهنگ ${currentDisplayIndex + 1} از ${displayQueue.length}`}
                      </span>
                    ) : (
                      <span>
                        {displayQueue.length} {t.totalTracks || 'آهنگ'}
                      </span>
                    )}
                    {totalDurationFormatted && (
                      <>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{totalDurationFormatted}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ابزارهای هدر */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                {queue.length > 0 && (
                  <button
                    type="button"
                    className="q-icon-btn"
                    onClick={() => {
                      setContextMenu(null);
                      if (isSelectMode) {
                        setIsSelectMode(false);
                        setSelectedQueueIndices([]);
                        lastSelectedAnchorRef.current = null;
                      } else {
                        setIsSelectMode(true);
                        setConfirmClear(false);
                        lastSelectedAnchorRef.current = null;
                      }
                    }}
                    title={isSelectMode ? (t.done || 'تایید') : (t.select || 'انتخاب')}
                    style={{
                      background: isSelectMode
                        ? primaryColor
                        : withAlpha(textPrimary, theme.isDark ? 0.07 : 0.05),
                      border: isSelectMode
                        ? 'none'
                        : `1px solid ${withAlpha(textPrimary, 0.1)}`,
                      color: isSelectMode ? (theme.colors.onPrimary || '#ffffff') : textPrimary,
                      cursor: 'pointer',
                      padding: '5px 10px',
                      borderRadius: '9px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      fontSize: '0.7188rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <CheckSquare size={14} />
                    <span>{isSelectMode ? (t.done || (isRTL ? 'تایید' : 'Done')) : (t.select || (isRTL ? 'انتخاب' : 'Select'))}</span>
                  </button>
                )}

                {queue.length > 2 && !isSelectMode && (
                  <button
                    type="button"
                    className="q-icon-btn"
                    onClick={onShuffleQueue}
                    title={t.shuffleQueue || 'بر زدن صف'}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: textSecondary,
                      cursor: 'pointer',
                      padding: '7px',
                      borderRadius: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Shuffle size={17} />
                  </button>
                )}

                {onCreatePlaylist && displayQueue.length > 0 && !isSelectMode && (
                  <button
                    type="button"
                    className="q-icon-btn"
                    onClick={() => {
                      setIsSavingPlaylist(!isSavingPlaylist);
                      if (!playlistName) {
                        setPlaylistName(
                          (t.direction === 'ltr' || t.close === 'Close')
                            ? `Queue - ${new Date().toLocaleDateString('en-US')}`
                            : `صف پخش - ${new Date().toLocaleDateString('fa-IR')}`
                        );
                      }
                    }}
                    title={t.saveQueueAsPlaylist || 'ذخیره به عنوان پلی‌لیست'}
                    style={{
                      background: isSavingPlaylist ? withAlpha(primaryColor, 0.14) : 'none',
                      border: 'none',
                      color: isSavingPlaylist ? primaryColor : textSecondary,
                      cursor: 'pointer',
                      padding: '7px',
                      borderRadius: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BookmarkPlus size={17} />
                  </button>
                )}

                {queue.length > 0 && !isSelectMode && (
                  <button
                    type="button"
                    className="q-icon-btn"
                    onClick={() => {
                      if (confirmClear) {
                        onClearQueue();
                        setConfirmClear(false);
                      } else {
                        setConfirmClear(true);
                      }
                    }}
                    title={confirmClear ? t.clearQueueConfirm || 'حذف همه؟' : t.clearQueue || 'پاک کردن صف'}
                    style={{
                      background: confirmClear ? 'rgba(239, 68, 68, 0.15)' : 'none',
                      border: confirmClear ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                      color: confirmClear ? '#ef4444' : textSecondary,
                      cursor: 'pointer',
                      padding: confirmClear ? '4px 8px' : '7px',
                      borderRadius: '9px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                    }}
                  >
                    <Trash2 size={confirmClear ? 13 : 17} />
                    {confirmClear && <span>{t.clearQueue || 'حذف'}</span>}
                  </button>
                )}

                <button
                  type="button"
                  className="q-icon-btn"
                  onClick={onClose}
                  title={t.close || 'بستن'}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: textSecondary,
                    cursor: 'pointer',
                    padding: '7px',
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* نوار انتخاب و حذف گروهی آهنگ‌های صف */}
            <AnimatePresence>
              {isSelectMode && queue.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '11px',
                    backgroundColor: withAlpha(primaryColor, theme.isDark ? 0.12 : 0.08),
                    border: `1px solid ${withAlpha(primaryColor, 0.25)}`,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (allVisibleSelected) {
                          setSelectedQueueIndices([]);
                        } else {
                          setSelectedQueueIndices(selectableIndices);
                        }
                      }}
                      style={{
                        border: `1px solid ${borderColor}`,
                        backgroundColor: allVisibleSelected ? primaryColor : 'transparent',
                        color: allVisibleSelected ? theme.colors.onPrimary || '#fff' : textPrimary,
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.7188rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {allVisibleSelected
                        ? t.deselectAll || 'لغو انتخاب همه'
                        : t.selectAll || 'انتخاب همه'}
                    </button>
                    <span
                      style={{
                        fontSize: '0.7188rem',
                        color: textSecondary,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedQueueIndices.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={selectedQueueIndices.length === 0}
                    onClick={handleDeleteSelected}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      backgroundColor:
                        selectedQueueIndices.length > 0
                          ? '#ef4444'
                          : withAlpha(textSecondary, 0.16),
                      color: selectedQueueIndices.length > 0 ? '#ffffff' : textSecondary,
                      fontSize: '0.7188rem',
                      fontWeight: 600,
                      cursor: selectedQueueIndices.length > 0 ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{t.deleteSelected || (isRTL ? 'حذف انتخاب‌شده‌ها' : 'Delete Selected')}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* فرم ذخیره پلی‌لیست */}
            <AnimatePresence>
              {isSavingPlaylist && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleSavePlaylist}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: '12px',
                    backgroundColor: withAlpha(textPrimary, theme.isDark ? 0.05 : 0.03),
                    border: `1px solid ${borderColor}`,
                    overflow: 'hidden',
                  }}
                >
                  <input
                    type="text"
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    placeholder={t.playlistName || 'نام پلی‌لیست جدید...'}
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '0.7813rem',
                      color: textPrimary,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!playlistName.trim()}
                    style={{
                      backgroundColor: primaryColor,
                      color: theme.colors.onPrimary || '#ffffff',
                      border: 'none',
                      borderRadius: '7px',
                      padding: '5px 12px',
                      fontSize: '0.7188rem',
                      fontWeight: 600,
                      cursor: playlistName.trim() ? 'pointer' : 'not-allowed',
                      opacity: playlistName.trim() ? 1 : 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Check size={13} />
                    <span>{t.save || 'ذخیره'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSavingPlaylist(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: textSecondary,
                      fontSize: '0.7188rem',
                      cursor: 'pointer',
                      padding: '5px 8px',
                    }}
                  >
                    {t.cancel || 'لغو'}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>

            {/* پیام موفقیت ذخیره پلی‌لیست */}
            <AnimatePresence>
              {savedSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{
                    fontSize: '0.75rem',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    borderRadius: '8px',
                  }}
                >
                  <Check size={14} />
                  <span>{t.playlistSaved || 'صف در پلی‌لیست ذخیره شد'}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* فیلتر جستجو برای لیست‌های بزرگتر از ۵ قطعه */}
            {displayQueue.length > 5 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '11px',
                  backgroundColor: withAlpha(textPrimary, theme.isDark ? 0.05 : 0.03),
                  border: `1px solid ${borderColor}`,
                }}
              >
                <Search size={14} style={{ color: textSecondary, flexShrink: 0 }} />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder={t.searchInQueue || 'جستجو در صف...'}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.75rem',
                    color: textPrimary,
                  }}
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: textSecondary,
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* محتوای صف پخش */}
          <div
            ref={listScrollRef}
            onPointerDown={handleListPointerDown}
            onDragStart={(e) => e.preventDefault()}
            onScroll={() => {
              const session = dragSessionRef.current;
              if (session?.isActive) {
                syncDragStateFromPointerY(session.pointerY);
              }
            }}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '10px 14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            {displayQueue.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                {currentSong && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 11px',
                      borderRadius: '13px',
                      backgroundColor: withAlpha(primaryColor, theme.isDark ? 0.14 : 0.09),
                      border: `1px solid ${withAlpha(primaryColor, 0.3)}`,
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <CoverImage
                        src={currentSong.cover}
                        alt=""
                        iconSize={15}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: primaryColor,
                          marginBottom: '2px',
                        }}
                      >
                        {t.nowPlayingOutsideQueue || (isRTL ? 'در حال پخش (خارج از صف)' : 'Now Playing (outside queue)')}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {currentSong.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.7188rem',
                          color: textSecondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {currentSong.artist}
                      </div>
                    </div>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '44px 20px',
                    textAlign: 'center',
                    borderRadius: '16px',
                    border: `1px dashed ${borderColor}`,
                    backgroundColor: withAlpha(textPrimary, 0.02),
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: withAlpha(primaryColor, 0.12),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: primaryColor,
                    }}
                  >
                    <ListMusic size={22} />
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: textPrimary }}>
                    {t.queueEmpty || 'صف پخش خالی است'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: textSecondary, maxWidth: '240px', lineHeight: 1.4 }}>
                    {t.queueEmptyHint || 'آهنگ‌ها را برای پخش پیوسته به صف اضافه کنید.'}
                  </div>
                </div>
              </div>
            ) : filteredList.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '0.8125rem', color: textSecondary }}>
                {t.noResults || 'هیچ نتیجه‌ای یافت نشد'}
              </div>
            ) : (
              filteredList.map(({ song, displayIndex, queueIndex }) => {
                const isCurrent = currentDisplayIndex !== -1 && displayIndex === currentDisplayIndex;
                const isPast = currentDisplayIndex !== -1 && displayIndex < currentDisplayIndex;
                const isQueueItem = queueIndex >= 0;
                const isItemSelected = isQueueItem && selectedSet.has(queueIndex);
                const isItemDragged = isQueueItem && draggedQueueIndex === queueIndex;
                const isIndicatorRow =
                  Boolean(dragState) &&
                  isQueueItem &&
                  dragState?.hoverQueueIndex === queueIndex &&
                  dragState.insertionSlot !== dragState.sourceQueueIndex &&
                  dragState.insertionSlot !== dragState.sourceQueueIndex + 1;

                return (
                  <div
                    key={`${song.id}-${displayIndex}`}
                    ref={isCurrent ? currentSongRowRef : undefined}
                    data-queue-index={isQueueItem ? queueIndex : undefined}
                    className="q-row"
                    onClick={(e) => handleRowClick(e, queueIndex)}
                    onContextMenu={(e) => {
                      if (!isQueueItem) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const pos = clampContextMenuPosition({
                        clientX: e.clientX,
                        clientY: e.clientY,
                        menuWidth: 185,
                        menuHeight: onPlayNextInQueue ? 170 : 132,
                        viewportWidth: window.innerWidth,
                        viewportHeight: window.innerHeight,
                        isRTL,
                      });
                      setContextMenu({
                        queueIndex,
                        left: pos.left,
                        top: pos.top,
                        originY: pos.originY,
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '13px',
                      backgroundColor: isItemDragged
                        ? withAlpha(primaryColor, 0.08)
                        : isItemSelected
                        ? withAlpha(primaryColor, theme.isDark ? 0.24 : 0.16)
                        : isCurrent
                        ? withAlpha(primaryColor, theme.isDark ? 0.2 : 0.12)
                        : withAlpha(textPrimary, theme.isDark ? 0.04 : 0.025),
                      border: isItemDragged
                        ? `1px dashed ${withAlpha(primaryColor, 0.55)}`
                        : isItemSelected || isCurrent
                        ? `1px solid ${withAlpha(primaryColor, theme.isDark ? 0.5 : 0.38)}`
                        : `1px solid ${withAlpha(textPrimary, 0.06)}`,
                      boxShadow: isCurrent ? `0 4px 16px ${withAlpha(primaryColor, 0.14)}` : 'none',
                      opacity: isItemDragged ? 0.42 : isPast ? 0.62 : 1,
                      position: 'relative',
                      cursor: dragState ? 'grabbing' : isQueueItem ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {isIndicatorRow && dragState && (
                      <div
                        style={{
                          position: 'absolute',
                          top: dragState.indicatorPosition === 'above' ? '-4px' : undefined,
                          bottom: dragState.indicatorPosition === 'below' ? '-4px' : undefined,
                          left: '6px',
                          right: '6px',
                          height: '2.5px',
                          backgroundColor: primaryColor,
                          boxShadow: `0 0 10px ${primaryColor}`,
                          borderRadius: '2px',
                          pointerEvents: 'none',
                          zIndex: 5,
                        }}
                      />
                    )}

                    {/* چک‌باکس در حالت انتخاب چندتایی، یا شماره / اکولایزر */}
                    {isSelectMode && isQueueItem ? (
                      <div
                        data-queue-no-drag="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectIndex(queueIndex, e.shiftKey);
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: isItemSelected
                            ? `2px solid ${primaryColor}`
                            : `2px solid ${textSecondary}`,
                          backgroundColor: isItemSelected ? primaryColor : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginInline: '2px',
                          transition: 'background-color 0.14s ease, border-color 0.14s ease',
                        }}
                      >
                        {isItemSelected && <Check size={13} color={theme.colors.onPrimary || '#fff'} />}
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isCurrent ? (
                          isPlaying ? (
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                              <motion.div
                                animate={{ height: ['4px', '14px', '6px', '12px', '4px'] }}
                                transition={{ repeat: Infinity, duration: 0.85, ease: 'easeInOut' }}
                                style={{ width: '2.5px', backgroundColor: primaryColor, borderRadius: '1px' }}
                              />
                              <motion.div
                                animate={{ height: ['12px', '5px', '14px', '6px', '12px'] }}
                                transition={{ repeat: Infinity, duration: 0.95, ease: 'easeInOut' }}
                                style={{ width: '2.5px', backgroundColor: primaryColor, borderRadius: '1px' }}
                              />
                              <motion.div
                                animate={{ height: ['7px', '13px', '4px', '14px', '7px'] }}
                                transition={{ repeat: Infinity, duration: 0.75, ease: 'easeInOut' }}
                                style={{ width: '2.5px', backgroundColor: primaryColor, borderRadius: '1px' }}
                              />
                            </div>
                          ) : (
                            <Volume2 size={15} style={{ color: primaryColor }} />
                          )
                        ) : (
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              color: textSecondary,
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 500,
                            }}
                          >
                            {displayIndex + 1}
                          </span>
                        )}
                      </div>
                    )}

                    {/* کاور آهنگ */}
                    <div
                      style={{
                        position: 'relative',
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <CoverImage
                        src={song.cover}
                        alt=""
                        iconSize={16}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>

                    {/* نام آهنگ و خواننده */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? primaryColor : textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.name}</span>
                        {isCurrent && (
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              color: primaryColor,
                              opacity: 0.9,
                              flexShrink: 0,
                            }}
                          >
                            {t.nowPlayingBadge || ((t.direction === 'ltr' || t.close === 'Close') ? '(Now Playing)' : '(در حال پخش)')}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.7188rem',
                          color: textSecondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '1px',
                        }}
                      >
                        {song.artist}
                      </div>
                    </div>

                    {/* زمان قطعه */}
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: textSecondary,
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                    >
                      {formatDuration(song.duration)}
                    </span>

                    {/* حذف / منو / درگ (فقط برای آیتم‌های واقعی صف و خارج از حالت انتخاب) */}
                    {isQueueItem && !isSelectMode && (
                      <>
                        <button
                          type="button"
                          className="q-del-btn"
                          data-queue-no-drag="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFromQueue(queueIndex);
                          }}
                          title={t.removeFromQueue || 'حذف از صف'}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: textSecondary,
                            cursor: 'pointer',
                            padding: '5px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: isMobile ? 0.84 : 0.68,
                            transition: 'opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease',
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>

                        <button
                          type="button"
                          data-queue-no-drag="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pos = computeAnchorMenuPosition({
                              rect,
                              menuWidth: 185,
                              menuHeight: onPlayNextInQueue ? 170 : 132,
                              viewportWidth: window.innerWidth,
                              viewportHeight: window.innerHeight,
                              isRTL,
                              bottomReserve: inFullScreen ? (isShortWindow ? 10 : 16) : isShortWindow ? 92 : 112,
                            });
                            setContextMenu((prev) =>
                              prev?.queueIndex === queueIndex
                                ? null
                                : { queueIndex, left: pos.left, top: pos.top, originY: pos.originY }
                            );
                          }}
                          title={t.moreActions || 'Actions'}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: textSecondary,
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {/* دستگیره جابه‌جایی لمسی و ماوس */}
                        <div
                          data-queue-handle="true"
                          style={{
                            color: isItemDragged ? primaryColor : textSecondary,
                            cursor: dragState ? 'grabbing' : 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px 5px',
                            margin: '-2px -2px',
                            borderRadius: '7px',
                            flexShrink: 0,
                            touchAction: 'none',
                          }}
                          title={t.dragToReorder || ((t.direction === 'ltr' || t.close === 'Close') ? 'Drag to reorder' : 'بکشید برای جابه‌جایی')}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical size={16} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* پیش‌نمایش شناور قطعه در حال کشیدن */}
          {dragState && (
            <div
              style={{
                position: 'absolute',
                top: `${floatingTop}px`,
                left: '14px',
                right: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '13px',
                backgroundColor: theme.isDark ? 'rgba(28, 34, 44, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                border: `1.5px solid ${primaryColor}`,
                boxShadow: theme.isDark
                  ? `0 14px 32px rgba(0, 0, 0, 0.65), 0 0 0 1px ${withAlpha(primaryColor, 0.35)}`
                  : `0 12px 28px rgba(0, 0, 0, 0.18), 0 0 0 1px ${withAlpha(primaryColor, 0.25)}`,
                pointerEvents: 'none',
                zIndex: 30,
              }}
            >
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <CoverImage
                  src={dragState.song.cover}
                  alt=""
                  iconSize={15}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: primaryColor,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {dragState.song.name}
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    color: textSecondary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {dragState.song.artist}
                </div>
              </div>
              <GripVertical size={16} style={{ color: primaryColor, flexShrink: 0 }} />
            </div>
          )}

        </motion.aside>
      )}
    </AnimatePresence>

    {/* منوی سه‌نقطه و راست‌کلیک آیتم‌های صف در لایه مستقیم پورتال (خارج از transform پنل) */}
    <AnimatePresence>
      {isOpen && contextMenu && queue[contextMenu.queueIndex] && (() => {
        const menuQueueIndex = contextMenu.queueIndex;
        return (
          <motion.div
            ref={contextMenuRef}
            key="queue-context-menu"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: contextMenu.left,
              top: contextMenu.top,
              transformOrigin: contextMenu.originY === 'bottom' ? 'bottom center' : 'top center',
              minWidth: '185px',
              padding: '5px',
              borderRadius: theme.radius?.md || '12px',
              backgroundColor: theme.colors.surfaceSolid || (theme.isDark ? '#18181c' : '#ffffff'),
              border: `1px solid ${borderColor}`,
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.44)',
              zIndex: 1000030,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              direction: isRTL ? 'rtl' : 'ltr',
              fontFamily: theme.fonts?.main,
            }}
          >
            <button
              type="button"
              className="q-icon-btn"
              onClick={() => {
                onPlaySong(menuQueueIndex);
                setContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'start',
              }}
            >
              <Play size={15} />
              <span>{t.play || 'پخش'}</span>
            </button>

            {onPlayNextInQueue && menuQueueIndex !== currentQueueIndex && (
              <button
                type="button"
                className="q-icon-btn"
                onClick={() => {
                  onPlayNextInQueue(menuQueueIndex);
                  setContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'start',
                }}
              >
                <ListStart size={15} />
                <span>{t.playNext || 'پخش بعدی'}</span>
              </button>
            )}

            <button
              type="button"
              className="q-icon-btn"
              onClick={() => {
                setIsSelectMode(true);
                setSelectedQueueIndices((prev) =>
                  prev.includes(menuQueueIndex) ? prev : [...prev, menuQueueIndex]
                );
                setContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'start',
              }}
            >
              <CheckSquare size={15} />
              <span>{t.select || 'انتخاب'}</span>
            </button>

            <button
              type="button"
              className="q-icon-btn"
              onClick={() => {
                onRemoveFromQueue(menuQueueIndex);
                setContextMenu(null);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'start',
              }}
            >
              <Trash2 size={15} />
              <span>{t.removeFromQueue || 'حذف از صف'}</span>
            </button>
          </motion.div>
        );
      })()}
    </AnimatePresence>
    </>,
    document.body
  );
};
