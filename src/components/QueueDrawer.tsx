import React, { useState, useMemo, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import type { Song } from '../types';
import { withAlpha } from '../utils/color';
import { CoverImage } from './CoverImage';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Song[];
  currentSong: Song | null;
  currentQueueIndex?: number;
  isPlaying: boolean;
  onPlaySong: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  onCreatePlaylist?: (name: string, songs: Song[]) => void;
  theme: any;
  t: any;
  isMobile: boolean;
  inFullScreen?: boolean;
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
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(null);
  const [dragOverQueueIndex, setDragOverQueueIndex] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSongRowRef = useRef<HTMLDivElement>(null);

  // ریست وضعیت‌های موقت هنگام بسته شدن کشو
  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
      setIsSavingPlaylist(false);
      setFilterQuery('');
      setDraggedQueueIndex(null);
      setDragOverQueueIndex(null);
    }
  }, [isOpen]);

  // بستن کشو با کلید Escape پیش از پنجره‌های زیرین
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // زمان‌سنج ریست تأیید پاک‌کردن صف
  useEffect(() => {
    if (confirmClear) {
      const timer = setTimeout(() => setConfirmClear(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [confirmClear]);

  const hasExactQueueMatch =
    Boolean(currentSong) &&
    currentQueueIndex >= 0 &&
    currentQueueIndex < queue.length &&
    queue[currentQueueIndex]?.id === currentSong?.id;

  // اگر آهنگ جاری داخل صف نیست، برای نمایش یکپارچه در ابتدای لیست نمایشی قرار می‌گیرد
  const hasVirtualCurrent = useMemo(
    () => Boolean(currentSong && !hasExactQueueMatch && !queue.some((s) => s.id === currentSong.id)),
    [queue, currentSong, hasExactQueueMatch]
  );

  const displayQueue = useMemo(() => {
    const list = [...queue];
    if (hasVirtualCurrent && currentSong) {
      list.unshift(currentSong);
    }
    return list;
  }, [queue, currentSong, hasVirtualCurrent]);

  // ایندکس دقیق آهنگ جاری در لیست نمایشی
  const currentDisplayIndex = useMemo(() => {
    if (!currentSong) return -1;
    if (hasVirtualCurrent) return 0;
    if (hasExactQueueMatch) return currentQueueIndex;
    return displayQueue.findIndex((s) => s.id === currentSong.id);
  }, [displayQueue, currentSong, hasVirtualCurrent, hasExactQueueMatch, currentQueueIndex]);

  // اسکرول خودکار به آهنگ در حال پخش هنگام باز شدن پنل
  useEffect(() => {
    if (isOpen && currentSongRowRef.current) {
      const timer = setTimeout(() => {
        currentSongRowRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentDisplayIndex]);

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
      queueIndex: hasVirtualCurrent ? displayIndex - 1 : displayIndex,
    }));
  }, [displayQueue, hasVirtualCurrent]);

  const filteredList = useMemo(() => {
    if (!filterQuery.trim()) return indexedList;
    const q = filterQuery.toLowerCase();
    return indexedList.filter(
      ({ song }) =>
        song.name.toLowerCase().includes(q) ||
        song.artist.toLowerCase().includes(q)
    );
  }, [indexedList, filterQuery]);

  const handleDragStart = (e: React.DragEvent, queueIndex: number) => {
    if (queueIndex < 0) return;
    e.dataTransfer.setData('text/plain', queueIndex.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggedQueueIndex(queueIndex);
  };

  const handleDragOver = (e: React.DragEvent, queueIndex: number) => {
    if (queueIndex < 0) return;
    e.preventDefault();
    if (draggedQueueIndex === null || draggedQueueIndex === queueIndex) return;
    setDragOverQueueIndex(queueIndex);
  };

  const handleDrop = (e: React.DragEvent, targetQueueIndex: number) => {
    e.preventDefault();
    if (targetQueueIndex >= 0) {
      const raw = e.dataTransfer.getData('text/plain');
      const sourceQueueIndex = raw !== '' ? parseInt(raw, 10) : draggedQueueIndex;
      if (
        sourceQueueIndex !== null &&
        !isNaN(sourceQueueIndex) &&
        sourceQueueIndex >= 0 &&
        sourceQueueIndex !== targetQueueIndex
      ) {
        onReorderQueue(sourceQueueIndex, targetQueueIndex);
      }
    }
    setDraggedQueueIndex(null);
    setDragOverQueueIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedQueueIndex(null);
    setDragOverQueueIndex(null);
  };

  if (typeof document === 'undefined') return null;

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
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.85 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: isMobile ? 0 : '16px',
            bottom: isMobile ? 0 : inFullScreen ? '16px' : '112px',
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
            .q-row:hover .q-del-btn { opacity: 1 !important; }
            .q-row:hover { background-color: ${withAlpha(primaryColor, theme.isDark ? 0.09 : 0.06)} !important; }
            .q-icon-btn { transition: opacity 0.15s ease, background-color 0.15s ease, transform 0.12s ease; }
            .q-icon-btn:hover { opacity: 0.78; background-color: ${withAlpha(textPrimary, theme.isDark ? 0.08 : 0.06)} !important; }
            .q-icon-btn:active { transform: scale(0.92); }
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
                {queue.length > 2 && (
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

                {onCreatePlaylist && displayQueue.length > 0 && (
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

                {queue.length > 0 && (
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
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            {displayQueue.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 20px',
                  textAlign: 'center',
                  borderRadius: '16px',
                  border: `1px dashed ${borderColor}`,
                  backgroundColor: withAlpha(textPrimary, 0.02),
                  gap: '10px',
                  marginTop: '10px',
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
            ) : filteredList.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: '0.8125rem', color: textSecondary }}>
                {t.noResults || 'هیچ نتیجه‌ای یافت نشد'}
              </div>
            ) : (
              filteredList.map(({ song, displayIndex, queueIndex }) => {
                const isCurrent = currentDisplayIndex !== -1 && displayIndex === currentDisplayIndex;
                const isPast = currentDisplayIndex !== -1 && displayIndex < currentDisplayIndex;
                const isQueueItem = queueIndex >= 0;
                const isItemDragged = isQueueItem && draggedQueueIndex === queueIndex;
                const isOver = isQueueItem && dragOverQueueIndex === queueIndex;

                return (
                  <div
                    key={`${song.id}-${displayIndex}`}
                    ref={isCurrent ? currentSongRowRef : undefined}
                    className="q-row"
                    draggable={isQueueItem}
                    onDragStart={(e) => handleDragStart(e, queueIndex)}
                    onDragOver={(e) => handleDragOver(e, queueIndex)}
                    onDrop={(e) => handleDrop(e, queueIndex)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      if (isQueueItem) {
                        onPlaySong(queueIndex);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '13px',
                      backgroundColor: isCurrent
                        ? withAlpha(primaryColor, theme.isDark ? 0.2 : 0.12)
                        : isOver
                        ? withAlpha(primaryColor, 0.15)
                        : withAlpha(textPrimary, theme.isDark ? 0.04 : 0.025),
                      border: isCurrent
                        ? `1px solid ${withAlpha(primaryColor, theme.isDark ? 0.45 : 0.34)}`
                        : isOver
                        ? `1px solid ${primaryColor}`
                        : `1px solid ${withAlpha(textPrimary, 0.06)}`,
                      boxShadow: isCurrent ? `0 4px 16px ${withAlpha(primaryColor, 0.14)}` : 'none',
                      opacity: isItemDragged ? 0.35 : isPast ? 0.62 : 1,
                      transform: isOver ? 'scale(1.01)' : 'scale(1)',
                      position: 'relative',
                      cursor: isQueueItem ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {isOver && draggedQueueIndex !== null && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '2px',
                          backgroundColor: primaryColor,
                          boxShadow: `0 0 8px ${primaryColor}`,
                          borderRadius: '1px',
                        }}
                      />
                    )}

                    {/* شماره یا اکولایزر آهنگ جاری */}
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

                    {/* حذف از صف (فقط برای آیتم‌های واقعی صف) */}
                    {isQueueItem && (
                      <>
                        <button
                          type="button"
                          className="q-del-btn"
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
                            opacity: isMobile ? 0.72 : 0,
                            transition: 'opacity 0.15s ease',
                            flexShrink: 0,
                          }}
                        >
                          <X size={15} />
                        </button>

                        {/* دستگیره جابه‌جایی */}
                        <div
                          style={{
                            color: textSecondary,
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
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
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body
  );
};
