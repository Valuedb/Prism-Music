import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup, useDragControls } from 'framer-motion';
import { Heart, Music, Edit3, Check, X } from 'lucide-react';
import type { ArtworkStyle, RepeatMode, Song, VisualizerStyle } from '../types';
import { withAlpha } from '../utils/color';
import { QueueDrawer } from './QueueDrawer';
import { MarqueeText } from './MarqueeText';
import { audioEffects } from '../player/audioEffects';

interface LyricLine {
  time: number | null;
  text: string;
}

const parseLyrics = (raw?: string): { lines: LyricLine[]; isSynced: boolean } => {
  if (!raw || !raw.trim()) return { lines: [], isSynced: false };
  const rawLines = raw.split(/\r?\n/);
  const parsed: LyricLine[] = [];
  let hasTimed = false;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (parsed.length > 0 && parsed[parsed.length - 1].text !== '') {
        parsed.push({ time: null, text: '' });
      }
      continue;
    }
    const match = trimmed.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/);
    if (match) {
      hasTimed = true;
      const mins = Number(match[1]);
      const secs = Number(match[2]);
      const fracStr = match[3] || '0';
      const frac = Number(fracStr) / Math.pow(10, fracStr.length);
      const time = mins * 60 + secs + frac;
      const text = match[4].trim();
      if (text) parsed.push({ time, text });
    } else {
      parsed.push({ time: null, text: trimmed });
    }
  }
  return { lines: parsed, isSynced: hasTimed };
};

interface FullScreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playNext: () => boolean | void;
  playPrev: () => boolean | void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  maxVolFactor?: number;
  onVolumeChange: (newVol: number) => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: RepeatMode;
  onToggleRepeat: () => void;
  queue: Song[];
  currentQueueIndex?: number;
  removeFromQueue: (index: number) => void;
  onToggleFavorite?: (id: string) => void;
  reorderQueue?: (fromIndex: number, toIndex: number) => void;
  onPlayQueueSong?: (index: number) => void;
  onClearQueue?: () => void;
  onShuffleQueue?: () => void;
  onCreatePlaylist?: (name: string, songs: Song[]) => void;
  onUpdateSong?: (updatedSong: Song) => void;
  liveVisualizer?: boolean;
  artworkStyle?: ArtworkStyle;
  visualizerStyle?: VisualizerStyle;
  t: any;
  theme: any;
}

const FullScreenVisualizer: React.FC<{
  active: boolean;
  color: string;
  variant: VisualizerStyle;
}> = ({ active, color, variant }) => {
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barCount = variant === 'wave' ? 32 : 28;

  useEffect(() => {
    if (variant === 'ring') return;
    if (!active) {
      barRefs.current.forEach((bar) => {
        if (bar) {
          bar.style.transform = 'scaleY(0.14)';
          bar.style.opacity = '0.32';
          bar.style.boxShadow = 'none';
        }
      });
      return;
    }

    let rafId = 0;
    const bins = new Uint8Array(audioEffects.getFrequencyBinCount() || 128);
    const smoothed = new Float32Array(barCount);
    const glowTint = withAlpha(color, 0.55);

    const tick = (now: number) => {
      const ok = audioEffects.getFrequencyData(bins);
      const mid = (barCount - 1) / 2;
      const maxMusicalBin = Math.min(bins.length - 1, 52);
      let maxEnergy = 0;
      if (ok) {
        for (let b = 0; b <= maxMusicalBin; b++) {
          if (bins[b] > maxEnergy) maxEnergy = bins[b];
        }
      }

      for (let i = 0; i < barCount; i++) {
        const bar = barRefs.current[i];
        if (!bar) continue;

        let target: number;
        if (!ok || maxEnergy === 0) {
          // نبض ملایم در زمان مکث کوتاه یا در دسترس‌نبودن لحظه‌ای آنالایزر
          const phase = now * 0.0042 + i * 0.42;
          const wave = 0.5 + 0.5 * Math.sin(phase) * Math.cos(phase * 0.55);
          target = 0.18 + wave * 0.34;
        } else {
          const linearPos =
            variant === 'wave'
              ? Math.abs(i - mid) / Math.max(1, mid)
              : i / Math.max(1, barCount - 1);
          const curvedPos = Math.pow(linearPos, 1.55);
          const binIdx = Math.min(
            maxMusicalBin,
            Math.floor(curvedPos * maxMusicalBin)
          );
          const nextBin = Math.min(maxMusicalBin, binIdx + 1);
          const raw = (bins[binIdx] * 0.72 + bins[nextBin] * 0.28) / 255;
          const boosted = Math.pow(raw, 0.72) * (1.06 + linearPos * 0.24);
          target = Math.max(0.14, Math.min(1, boosted));
        }

        // حمله سریع و افت نرم برای حرکت طبیعی اکولایزر
        const prev = smoothed[i] || 0.14;
        const rate = target > prev ? 0.52 : 0.24;
        const nextVal = prev + (target - prev) * rate;
        smoothed[i] = nextVal;

        bar.style.transform = `scaleY(${nextVal.toFixed(3)})`;
        bar.style.opacity = (0.36 + nextVal * 0.64).toFixed(2);
        bar.style.boxShadow = nextVal > 0.66 ? `0 0 10px ${glowTint}` : 'none';
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [active, barCount, color, variant]);

  if (variant === 'ring') return null;

  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: variant === 'wave' ? 'center' : 'flex-end',
        justifyContent: 'center',
        gap: variant === 'wave' ? '4px' : '4px',
        height: variant === 'wave' ? '36px' : '34px',
        width: variant === 'wave' ? 'min(268px, 74vw)' : 'min(252px, 70vw)',
        margin: '12px auto 0',
        opacity: active ? 1 : 0.42,
        transition: 'opacity 0.25s ease',
      }}
    >
      {Array.from({ length: barCount }).map((_, idx) => (
        <div
          key={idx}
          ref={(el) => {
            barRefs.current[idx] = el;
          }}
          style={{
            flex: 1,
            maxWidth: '5px',
            height: '100%',
            borderRadius: '999px',
            background: `linear-gradient(to top, ${withAlpha(color, 0.68)}, ${color})`,
            transformOrigin: variant === 'wave' ? 'center' : 'bottom',
            transform: 'scaleY(0.14)',
            opacity: 0.35,
          }}
        />
      ))}
    </div>
  );
};

export const FullScreenPlayer: React.FC<FullScreenPlayerProps> = memo(({
  isOpen,
  onClose,
  currentSong,
  isPlaying,
  onTogglePlay,
  playNext,
  playPrev,
  currentTime,
  duration,
  onSeek,
  volume,
  maxVolFactor = 1,
  onVolumeChange,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  queue,
  currentQueueIndex,
  removeFromQueue,
  onToggleFavorite,
  reorderQueue,
  onPlayQueueSong,
  onClearQueue,
  onShuffleQueue,
  onCreatePlaylist,
  onUpdateSong,
  liveVisualizer = true,
  artworkStyle = 'classic',
  visualizerStyle = 'bars',
  t,
  theme,
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);
  const [isHeartPopping, setIsHeartPopping] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const ringHaloRef = useRef<HTMLDivElement>(null);
  const ringInnerHaloRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLButtonElement | null>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!isOpen) {
      setShowQueue(false);
      setShowLyrics(false);
      setIsEditingLyrics(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!liveVisualizer || visualizerStyle !== 'ring' || !isOpen || !isPlaying) {
      if (ringHaloRef.current) {
        ringHaloRef.current.style.transform = 'scale(1)';
        ringHaloRef.current.style.opacity = '0';
      }
      if (ringInnerHaloRef.current) {
        ringInnerHaloRef.current.style.transform = 'scale(1)';
        ringInnerHaloRef.current.style.opacity = '0';
      }
      return;
    }

    let rafId = 0;
    const bins = new Uint8Array(audioEffects.getFrequencyBinCount() || 128);
    let smoothBass = 0;
    let smoothMid = 0;
    const tick = (now: number) => {
      const ok = audioEffects.getFrequencyData(bins);
      let bass = 0;
      let mid = 0;
      if (!ok) {
        bass = 0.25 + 0.18 * Math.sin(now * 0.005);
        mid = 0.2 + 0.15 * Math.cos(now * 0.006);
      } else {
        for (let i = 0; i < 6; i++) bass += bins[i] || 0;
        for (let i = 6; i < 24; i++) mid += bins[i] || 0;
        bass = Math.pow(bass / (6 * 255), 0.78);
        mid = Math.pow(mid / (18 * 255), 0.75);
      }

      smoothBass += (bass - smoothBass) * (bass > smoothBass ? 0.55 : 0.25);
      smoothMid += (mid - smoothMid) * (mid > smoothMid ? 0.5 : 0.25);

      if (ringHaloRef.current) {
        ringHaloRef.current.style.transform = `scale(${(1 + smoothBass * 0.22).toFixed(3)})`;
        ringHaloRef.current.style.opacity = (0.32 + smoothBass * 0.68).toFixed(2);
      }
      if (ringInnerHaloRef.current) {
        ringInnerHaloRef.current.style.transform = `scale(${(1 + smoothMid * 0.13).toFixed(3)})`;
        ringInnerHaloRef.current.style.opacity = (0.28 + smoothMid * 0.65).toFixed(2);
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [liveVisualizer, visualizerStyle, isOpen, isPlaying]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setCoverError(false);
    setIsEditingLyrics(false);
    setLyricsDraft(currentSong?.lyrics || '');
  }, [currentSong?.id, currentSong?.cover, currentSong?.lyrics]);

  const parsedLyrics = useMemo(() => parseLyrics(currentSong?.lyrics), [currentSong?.lyrics]);

  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics.isSynced) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.lines.length; i++) {
      const tVal = parsedLyrics.lines[i].time;
      if (tVal !== null && currentTime >= tVal - 0.15) {
        activeIdx = i;
      }
    }
    return activeIdx;
  }, [parsedLyrics, currentTime]);

  useEffect(() => {
    if (!showLyrics || isEditingLyrics || activeLyricIndex < 0) return;
    activeLyricRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [showLyrics, isEditingLyrics, activeLyricIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showQueue) {
        if (isEditingLyrics) {
          setIsEditingLyrics(false);
        } else if (showLyrics) {
          setShowLyrics(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showQueue, isEditingLyrics, showLyrics, onClose]);

  if (typeof document === 'undefined') return null;

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const volumePercent = Math.max(0, Math.min(100, volume * 100));

  const primaryColor = theme?.colors?.primary || '#0a84ff';
  const songTitleColor = '#ffffff';
  const artistColor = 'rgba(255, 255, 255, 0.72)';
  const iconColor = '#ffffff';
  const iconActiveColor = primaryColor;
  const iconInactiveColor = 'rgba(255, 255, 255, 0.5)';
  const glowColor = `0 0 12px ${withAlpha(primaryColor, 0.7)}`;

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && currentSong && (
        <motion.div
          key="full-screen-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999998,
            backgroundColor: 'rgba(0, 0, 0, 0.58)',
          }}
        />
      )}
      {isOpen && currentSong && (
        <motion.div
          key="full-screen-player"
          initial={{ y: '100%', scale: 0.96, borderRadius: '28px' }}
          animate={{ y: 0, scale: 1, borderRadius: '0px' }}
          exit={{
            y: '100%',
            scale: 0.96,
            borderRadius: '28px',
            transition: { duration: 0.36, ease: [0.32, 0.72, 0, 1] },
          }}
          transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.04, bottom: 0.65 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 110 || info.velocity.y > 380) {
              onClose();
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: '#0e0e13',
            color: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            direction: 'ltr',
            boxShadow: '0 -12px 48px rgba(0, 0, 0, 0.65)',
            transformOrigin: 'center bottom',
          }}
        >
          {/* پس‌زمینه محو داینامیک کاور */}
          {currentSong.cover && !coverError ? (
            <motion.div
              initial={{ opacity: 0, scale: 1.42 }}
              animate={{ opacity: 1, scale: 1.3 }}
              exit={{ opacity: 0, scale: 1.36 }}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url(${currentSong.cover})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(85px) brightness(0.35) saturate(1.7)',
                pointerEvents: 'none',
              }}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at 50% 35%, ${withAlpha(primaryColor, 0.16)} 0%, transparent 65%)`,
                pointerEvents: 'none',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(12, 12, 16, 0.56)',
              pointerEvents: 'none',
            }}
          />

          {/* محتوای داخلی تمام‌صفحه */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '100%',
              maxWidth: showLyrics
                ? isMobile
                  ? '460px'
                  : '880px'
                : isMobile
                ? '420px'
                : '540px',
              margin: '0 auto',
              padding: isMobile
                ? 'clamp(14px, 2.5vh, 22px) 22px clamp(26px, 5.5vh, 44px)'
                : 'clamp(16px, 2.5vh, 24px) 28px clamp(28px, 5.5vh, 46px)',
              boxSizing: 'border-box',
              justifyContent: 'space-between',
              transition: 'max-width 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* هدر: دستگیره کشویی، دکمه بستن، عنوان و گزینه‌های علاقه‌مندی و صف */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
              transition={{ duration: 0.34, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                dragControls.start(e);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                flexShrink: 0,
                touchAction: 'none',
                cursor: 'grab',
              }}
            >
              <button
                onClick={onClose}
                aria-label={t.close || 'Close'}
                style={{
                  ...btnStyle,
                  width: '40px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: 'rgba(255, 255, 255, 0.35)',
                  marginBottom: '10px',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  position: 'relative',
                }}
              >
                <button
                  onClick={onClose}
                  title={t.close || 'بستن'}
                  style={{
                    ...btnStyle,
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    transition: 'background-color 0.2s, scale 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
                    zIndex: 2,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                <span
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.72)',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.nowPlaying || 'در حال پخش'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
                  {onToggleFavorite ? (
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      whileHover={{ opacity: 0.82 }}
                      animate={
                        isHeartPopping
                          ? { scale: [1, 1.35, 0.9, 1.12, 1] }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.32, ease: 'easeOut' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(currentSong.id);
                        setIsHeartPopping(true);
                        setTimeout(() => setIsHeartPopping(false), 450);
                      }}
                      title={
                        currentSong.isFavorite
                          ? t.removeFromFavorites || 'Remove from Favourites'
                          : t.addToFavorites || 'Add to Favourites'
                      }
                      style={{
                        ...btnStyle,
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: currentSong.isFavorite
                          ? 'rgba(255, 59, 48, 0.28)'
                          : 'rgba(255, 255, 255, 0.1)',
                        color: currentSong.isFavorite ? '#ff3b30' : '#ffffff',
                        boxShadow: currentSong.isFavorite
                          ? '0 0 16px rgba(255, 59, 48, 0.6)'
                          : 'none',
                      }}
                    >
                      <Heart
                        size={19}
                        fill={currentSong.isFavorite ? '#ff3b30' : 'none'}
                        color={currentSong.isFavorite ? '#ff3b30' : '#ffffff'}
                        strokeWidth={currentSong.isFavorite ? 0 : 2}
                      />
                    </motion.button>
                  ) : (
                    <div style={{ width: '38px', height: '38px' }} />
                  )}
                </div>
              </div>
            </motion.div>

            {/* محتوای وسط: کاور، نام آهنگ و ویژوالایزر (و متن ترانه با انیمیشن جابه‌جایی به چپ) */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 0,
                padding: '8px 0',
                width: '100%',
              }}
            >
              <LayoutGroup id="fullscreen-lyrics-group">
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 250, damping: 27, mass: 0.88 }}
                  style={{
                    display: 'flex',
                    flexDirection: showLyrics ? 'row' : 'column',
                    alignItems: 'center',
                    justifyContent: showLyrics ? 'space-between' : 'center',
                    gap: showLyrics ? (isMobile ? '14px' : '32px') : '0px',
                    width: '100%',
                    height: showLyrics ? '100%' : 'auto',
                    minHeight: 0,
                  }}
                >
                  {/* ستون چپ/وسط: کاور و عنوان آهنگ */}
                  <motion.div
                    layout
                    transition={{ type: 'spring', stiffness: 250, damping: 27, mass: 0.88 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: showLyrics ? 'flex-start' : 'center',
                      width: showLyrics ? (isMobile ? '106px' : '220px') : '100%',
                      flexShrink: 0,
                    }}
                  >
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.76, y: 32 }}
                      animate={{
                        opacity: 1,
                        scale: isPlaying ? 1 : showLyrics ? 0.96 : 0.88,
                        y: isPlaying ? 0 : showLyrics ? 0 : 6,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.84,
                        y: 22,
                        transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] },
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 245,
                        damping: 25,
                        mass: 0.82,
                      }}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transformOrigin: showLyrics ? 'left center' : 'center center',
                      }}
                    >
                      {!showLyrics && liveVisualizer && visualizerStyle === 'ring' && (
                        <>
                          <div
                            ref={ringHaloRef}
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              inset: '-18px',
                              borderRadius: artworkStyle === 'vinyl' ? '50%' : theme?.radius?.xl || '30px',
                              border: `2px solid ${withAlpha(primaryColor, 0.72)}`,
                              boxShadow: `0 0 38px ${withAlpha(primaryColor, 0.56)}`,
                              pointerEvents: 'none',
                              opacity: 0,
                            }}
                          />
                          <div
                            ref={ringInnerHaloRef}
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              inset: '-8px',
                              borderRadius: artworkStyle === 'vinyl' ? '50%' : theme?.radius?.xl || '24px',
                              border: `1.5px solid ${withAlpha(primaryColor, 0.5)}`,
                              boxShadow: `inset 0 0 18px ${withAlpha(primaryColor, 0.35)}`,
                              pointerEvents: 'none',
                              opacity: 0,
                            }}
                          />
                        </>
                      )}
                      <motion.div
                        layout
                        animate={{
                          boxShadow: isPlaying
                            ? '0 24px 50px rgba(0,0,0,0.65)'
                            : '0 10px 24px rgba(0,0,0,0.35)',
                        }}
                        transition={{
                          layout: { type: 'spring', stiffness: 250, damping: 27 },
                          boxShadow: { duration: 0.35 },
                        }}
                        className={
                          artworkStyle === 'vinyl'
                            ? isPlaying
                              ? 'vinyl-spin'
                              : 'vinyl-spin-paused'
                            : undefined
                        }
                        style={{
                          position: 'relative',
                          width: showLyrics
                            ? isMobile
                              ? '96px'
                              : '176px'
                            : 'min(230px, 58vw, 29vh)',
                          height: showLyrics
                            ? isMobile
                              ? '96px'
                              : '176px'
                            : 'min(230px, 58vw, 29vh)',
                          borderRadius:
                            artworkStyle === 'vinyl'
                              ? '50%'
                              : showLyrics
                              ? isMobile
                                ? '14px'
                                : '18px'
                              : theme?.radius?.xl || '20px',
                          overflow: 'hidden',
                          border:
                            artworkStyle === 'vinyl'
                              ? showLyrics
                                ? '4px solid rgba(20, 20, 26, 0.92)'
                                : '6px solid rgba(20, 20, 26, 0.92)'
                              : '1px solid rgba(255, 255, 255, 0.14)',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition:
                            'width 0.38s cubic-bezier(0.22, 1, 0.36, 1), height 0.38s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.35s ease',
                        }}
                      >
                        {currentSong.cover && !coverError ? (
                          <img
                            src={currentSong.cover}
                            alt={currentSong.name}
                            onError={() => setCoverError(true)}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <Music
                            size={showLyrics ? (isMobile ? 30 : 42) : 56}
                            color="rgba(255, 255, 255, 0.35)"
                            strokeWidth={1.4}
                          />
                        )}
                        {artworkStyle === 'vinyl' && (
                          <>
                            <div
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                inset: '14%',
                                borderRadius: '50%',
                                border: '1px solid rgba(255,255,255,0.14)',
                                pointerEvents: 'none',
                              }}
                            />
                            <div
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                width: showLyrics ? '16px' : '28px',
                                height: showLyrics ? '16px' : '28px',
                                borderRadius: '50%',
                                backgroundColor: '#121216',
                                border: showLyrics
                                  ? '2px solid rgba(255, 255, 255, 0.35)'
                                  : '3px solid rgba(255, 255, 255, 0.35)',
                                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)',
                                pointerEvents: 'none',
                              }}
                            />
                          </>
                        )}
                      </motion.div>
                    </motion.div>

                    <motion.div
                      layout="position"
                      animate={{
                        scale: isPlaying ? 1 : showLyrics ? 0.98 : 0.94,
                        opacity: isPlaying ? 1 : 0.88,
                      }}
                      transition={{
                        layout: { type: 'spring', stiffness: 250, damping: 27 },
                        type: 'spring',
                        stiffness: 240,
                        damping: 24,
                      }}
                      style={{
                        marginTop: showLyrics ? '10px' : '14px',
                        textAlign: showLyrics ? 'left' : 'center',
                        width: '100%',
                        padding: showLyrics ? '0 2px' : '0 8px',
                        boxSizing: 'border-box',
                        transformOrigin: showLyrics ? 'left top' : 'center top',
                      }}
                    >
                      {showLyrics ? (
                        <div
                          style={{
                            fontSize: isMobile ? '0.8125rem' : '1.0625rem',
                            fontWeight: '700',
                            color: songTitleColor,
                            whiteSpace: 'normal',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            letterSpacing: '-0.2px',
                            lineHeight: 1.28,
                          }}
                        >
                          {currentSong.name}
                        </div>
                      ) : (
                        <MarqueeText
                          text={currentSong.name}
                          speedPxPerSec={32}
                          gapPx={40}
                          style={{
                            fontSize: 'clamp(1.0625rem, 4.5vw, 1.3125rem)',
                            fontWeight: '700',
                            color: songTitleColor,
                            letterSpacing: '-0.2px',
                            lineHeight: 1.28,
                          }}
                        />
                      )}
                      <MarqueeText
                        text={currentSong.artist}
                        speedPxPerSec={30}
                        gapPx={38}
                        style={{
                          fontSize: showLyrics
                            ? isMobile
                              ? '0.7188rem'
                              : '0.8438rem'
                            : 'clamp(13px, 3.4vw, 15px)',
                          color: artistColor,
                          marginTop: '4px',
                        }}
                      />
                      {!showLyrics && liveVisualizer && (
                        <FullScreenVisualizer
                          active={isOpen && isPlaying}
                          color={primaryColor}
                          variant={visualizerStyle}
                        />
                      )}
                    </motion.div>
                  </motion.div>

                  {/* ستون راست: نمایش و ویرایش متن ترانه (Lyrics) */}
                  <AnimatePresence>
                    {showLyrics && (
                      <motion.div
                        key="lyrics-panel"
                        initial={{ opacity: 0, x: 26, scale: 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          x: 18,
                          scale: 0.98,
                          transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] },
                        }}
                        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: '100%',
                          maxHeight: isMobile ? '44vh' : '50vh',
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative',
                        }}
                      >
                        {onUpdateSong && !isEditingLyrics && (
                          <button
                            type="button"
                            onClick={() => {
                              setLyricsDraft(currentSong.lyrics || '');
                              setIsEditingLyrics(true);
                            }}
                            title={currentSong.lyrics ? t.editLyrics || 'ویرایش متن' : t.addLyrics || 'افزودن متن'}
                            style={{
                              ...btnStyle,
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              zIndex: 5,
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(255, 255, 255, 0.12)',
                              color: 'rgba(255, 255, 255, 0.8)',
                            }}
                          >
                            <Edit3 size={14} />
                          </button>
                        )}

                        {isEditingLyrics ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              height: '100%',
                              width: '100%',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.16)',
                              borderRadius: '18px',
                              padding: '12px',
                              boxSizing: 'border-box',
                            }}
                          >
                            <textarea
                              value={lyricsDraft}
                              onChange={(e) => setLyricsDraft(e.target.value)}
                              placeholder={t.lyricsPlaceholder || 'متن ترانه را وارد کنید...'}
                              dir="auto"
                              style={{
                                flex: 1,
                                width: '100%',
                                minHeight: '140px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                color: '#ffffff',
                                fontSize: isMobile ? '0.8125rem' : '0.9063rem',
                                lineHeight: 1.6,
                                fontFamily: theme?.fonts?.main,
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setIsEditingLyrics(false)}
                                style={{
                                  ...btnStyle,
                                  padding: '6px 12px',
                                  borderRadius: '10px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  color: '#ffffff',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  gap: '4px',
                                }}
                              >
                                <X size={14} />
                                <span>{t.cancel || 'لغو'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (onUpdateSong) {
                                    onUpdateSong({
                                      ...currentSong,
                                      lyrics: lyricsDraft.trim() || undefined,
                                    });
                                  }
                                  setIsEditingLyrics(false);
                                }}
                                style={{
                                  ...btnStyle,
                                  padding: '6px 14px',
                                  borderRadius: '10px',
                                  backgroundColor: primaryColor,
                                  color: theme?.colors?.onPrimary || '#ffffff',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  gap: '4px',
                                }}
                              >
                                <Check size={14} />
                                <span>{t.save || 'ذخیره'}</span>
                              </button>
                            </div>
                          </div>
                        ) : parsedLyrics.lines.length === 0 ? (
                          <div
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              gap: '12px',
                              padding: '16px',
                            }}
                          >
                            <div
                              style={{
                                fontSize: isMobile ? '0.8438rem' : '0.9375rem',
                                fontWeight: 600,
                                color: 'rgba(255, 255, 255, 0.56)',
                                lineHeight: 1.5,
                              }}
                            >
                              {t.noLyrics || 'متن ترانه‌ای برای این آهنگ موجود نیست'}
                            </div>
                            {onUpdateSong && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLyricsDraft('');
                                  setIsEditingLyrics(true);
                                }}
                                style={{
                                  ...btnStyle,
                                  padding: '8px 16px',
                                  borderRadius: '12px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                                  color: '#ffffff',
                                  fontSize: '0.7813rem',
                                  fontWeight: 600,
                                  gap: '6px',
                                }}
                              >
                                <Edit3 size={14} />
                                <span>{t.addLyrics || 'افزودن متن ترانه'}</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div
                            className="lyrics-scroll"
                            style={{
                              flex: 1,
                              overflowY: 'auto',
                              padding: '26px 8px 34px 4px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: parsedLyrics.isSynced ? (isMobile ? '10px' : '14px') : isMobile ? '8px' : '12px',
                              WebkitMaskImage:
                                'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                              maskImage:
                                'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
                              scrollbarWidth: 'none',
                            }}
                          >
                            {parsedLyrics.lines.map((line, idx) => {
                              if (!line.text) {
                                return <div key={idx} style={{ height: '10px', flexShrink: 0 }} />;
                              }
                              const isActive = parsedLyrics.isSynced && idx === activeLyricIndex;
                              const isPast = parsedLyrics.isSynced && idx < activeLyricIndex;
                              return (
                                <button
                                  key={idx}
                                  ref={isActive ? activeLyricRef : undefined}
                                  type="button"
                                  dir="auto"
                                  disabled={line.time === null}
                                  onClick={() => {
                                    if (line.time !== null) {
                                      onSeek(line.time);
                                    }
                                  }}
                                  style={{
                                    ...btnStyle,
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'start',
                                    cursor: line.time !== null ? 'pointer' : 'default',
                                    fontSize: parsedLyrics.isSynced
                                      ? isMobile
                                        ? isActive
                                          ? '1.0625rem'
                                          : '0.9375rem'
                                        : isActive
                                        ? '1.4375rem'
                                        : '1.1875rem'
                                      : isMobile
                                      ? '0.9375rem'
                                      : '1.1875rem',
                                    fontWeight: isActive ? 800 : 700,
                                    lineHeight: 1.45,
                                    color: parsedLyrics.isSynced
                                      ? isActive
                                        ? '#ffffff'
                                        : isPast
                                        ? 'rgba(255, 255, 255, 0.36)'
                                        : 'rgba(255, 255, 255, 0.56)'
                                      : 'rgba(255, 255, 255, 0.9)',
                                    textShadow: isActive
                                      ? `0 0 22px ${withAlpha(primaryColor, 0.55)}`
                                      : 'none',
                                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                                    transformOrigin: 'left center',
                                    transition:
                                      'color 0.25s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), text-shadow 0.25s ease',
                                    flexShrink: 0,
                                  }}
                                >
                                  {line.text}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </LayoutGroup>
            </div>

            {/* کنترل‌های پخش، نوار زمان و ولوم */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: 16,
                transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] },
              }}
              transition={{ duration: 0.38, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '14px', flexShrink: 0 }}
            >
              {/* دکمه‌های متن ترانه (چپ) و صف پخش (راست) دقیقاً بالای نوار پیشرفت */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  marginBottom: '-2px',
                }}
              >
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ opacity: 0.85 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  onClick={() => setShowLyrics((prev) => !prev)}
                  title={t.lyrics || 'Lyrics'}
                  style={{
                    ...btnStyle,
                    padding: '4px 10px',
                    height: '26px',
                    borderRadius: '8px',
                    border: showLyrics
                      ? `1px solid ${withAlpha(primaryColor, 0.7)}`
                      : '1px solid rgba(255, 255, 255, 0.18)',
                    backgroundColor: showLyrics
                      ? withAlpha(primaryColor, 0.24)
                      : 'rgba(255, 255, 255, 0.08)',
                    color: showLyrics ? iconActiveColor : 'rgba(255, 255, 255, 0.88)',
                    fontSize: '0.7188rem',
                    fontWeight: 600,
                    letterSpacing: '0.1px',
                    lineHeight: 1,
                    boxShadow: showLyrics ? `0 0 12px ${withAlpha(primaryColor, 0.35)}` : 'none',
                    transition:
                      'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  {t.lyrics || 'Lyrics'}
                </motion.button>

                <motion.button
                  type="button"
                  data-queue-toggle="true"
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ opacity: 0.82 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  onClick={() => setShowQueue((prev) => !prev)}
                  title={t.queue || 'Queue'}
                  style={{
                    ...btnStyle,
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: showQueue
                      ? withAlpha(primaryColor, 0.28)
                      : 'rgba(255, 255, 255, 0.1)',
                    color: showQueue ? iconActiveColor : '#ffffff',
                    boxShadow: showQueue ? `0 0 14px ${withAlpha(primaryColor, 0.45)}` : 'none',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
                  </svg>
                </motion.button>
              </div>

              {/* نوار پیشرفت زمان */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}
                onMouseEnter={() => setIsHoveringProgress(true)}
                onMouseLeave={() => setIsHoveringProgress(false)}
              >
                <span style={{ fontSize: '0.7188rem', color: artistColor, minWidth: '32px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {formatTime(currentTime)}
                </span>
                <div style={{ flex: 1, position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: isHoveringProgress ? '6px' : '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.22)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '999px',
                      transition: 'height 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        backgroundColor: primaryColor,
                        borderRadius: '999px',
                        boxShadow: glowColor,
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                      zIndex: 2,
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.7188rem', color: artistColor, minWidth: '30px', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                  {formatTime(duration)}
                </span>
              </div>

              {/* دکمه‌های اصلی پخش */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? '16px' : '34px',
                  padding: '0 4px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ opacity: 0.78 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  onClick={onToggleShuffle}
                  title={isShuffle ? (t.shuffleOn || 'Shuffle On') : (t.shuffleOff || 'Shuffle Off')}
                  style={{
                    ...btnStyle,
                    color: isShuffle ? iconActiveColor : iconInactiveColor,
                    width: isMobile ? '42px' : '46px',
                    height: isMobile ? '42px' : '46px',
                    borderRadius: '50%',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  <svg width={isMobile ? 20 : 22} height={isMobile ? 20 : 22} viewBox="0 0 16 16" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M0 3.5A.5.5 0 0 1 .5 3H1c2.202 0 3.827 1.24 4.874 2.418.49.552.865 1.102 1.126 1.532.26-.43.636-.98 1.126-1.532C9.173 4.24 10.798 3 13 3v1c-1.798 0-3.173 1.01-4.126 2.082A9.6 9.6 0 0 0 7.556 8a9.6 9.6 0 0 0 1.317 1.918C9.828 10.99 11.204 12 13 12v1c-2.202 0-3.827-1.24-4.874-2.418A10.6 10.6 0 0 1 7 9.05c-.26.43-.636.98-1.126 1.532C4.827 11.76 3.202 13 1 13H.5a.5.5 0 0 1 0-1H1c1.798 0 3.173-1.01 4.126-2.082A9.6 9.6 0 0 0 6.444 8a9.6 9.6 0 0 0-1.317-1.918C4.172 5.01 2.796 4 1 4H.5a.5.5 0 0 1-.5-.5"
                    />
                    <path d="M13 5.466V1.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192m0 9v-3.932a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192" />
                  </svg>
                  {isShuffle && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        width: '4.5px',
                        height: '4.5px',
                        borderRadius: '50%',
                        backgroundColor: iconActiveColor,
                        boxShadow: glowColor,
                      }}
                    />
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ opacity: 0.78 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  onClick={() => playPrev()}
                  title={t.previous || 'Previous'}
                  style={{
                    ...btnStyle,
                    color: iconColor,
                    width: isMobile ? '46px' : '54px',
                    height: isMobile ? '46px' : '54px',
                    flexShrink: 0,
                  }}
                >
                  <svg width={isMobile ? 26 : 30} height={isMobile ? 26 : 30} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8.404 7.304a.802.802 0 0 0 0 1.392l6.363 3.692c.52.302 1.233-.043 1.233-.696V4.308c0-.653-.713-.998-1.233-.696z" />
                    <path d="M.404 7.304a.802.802 0 0 0 0 1.392l6.363 3.692c.52.302 1.233-.043 1.233-.696V4.308c0-.653-.713-.998-1.233-.696z" />
                  </svg>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ opacity: 0.82 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  onClick={onTogglePlay}
                  title={isPlaying ? (t.pause || 'Pause') : (t.play || 'Play')}
                  style={{
                    ...btnStyle,
                    color: iconColor,
                    width: isMobile ? '54px' : '64px',
                    height: isMobile ? '54px' : '64px',
                    flexShrink: 0,
                  }}
                >
                  {isPlaying ? (
                    <svg width={isMobile ? 42 : 48} height={isMobile ? 42 : 48} viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5" />
                    </svg>
                  ) : (
                    <svg width={isMobile ? 42 : 48} height={isMobile ? 42 : 48} viewBox="0 0 16 16" fill="currentColor" style={{ transform: 'translateX(2px)' }}>
                      <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                    </svg>
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ opacity: 0.78 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  onClick={() => playNext()}
                  title={t.next || 'Next'}
                  style={{
                    ...btnStyle,
                    color: iconColor,
                    width: isMobile ? '46px' : '54px',
                    height: isMobile ? '46px' : '54px',
                    flexShrink: 0,
                  }}
                >
                  <svg width={isMobile ? 26 : 30} height={isMobile ? 26 : 30} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M7.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C.713 12.69 0 12.345 0 11.692V4.308c0-.653.713-.998 1.233-.696z" />
                    <path d="M15.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C8.713 12.69 8 12.345 8 11.692V4.308c0-.653.713-.998 1.233-.696z" />
                  </svg>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ opacity: 0.78 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  onClick={onToggleRepeat}
                  title={
                    repeatMode === 'one'
                      ? (t.repeatOne || 'Repeat One')
                      : repeatMode === 'all'
                      ? (t.repeatAll || 'Repeat All')
                      : (t.repeatOff || 'Repeat Off')
                  }
                  style={{
                    ...btnStyle,
                    color: repeatMode !== 'off' ? iconActiveColor : iconInactiveColor,
                    width: isMobile ? '42px' : '46px',
                    height: isMobile ? '42px' : '46px',
                    borderRadius: '50%',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {repeatMode === 'one' ? (
                    <svg width={isMobile ? 20 : 22} height={isMobile ? 20 : 22} viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11 4v1.466a.25.25 0 0 0 .41.192l2.36-1.966a.25.25 0 0 0 0-.384l-2.36-1.966a.25.25 0 0 0-.41.192V3H5a5 5 0 0 0-4.48 7.223.5.5 0 0 0 .896-.446A4 4 0 0 1 5 4zm4.48 1.777a.5.5 0 0 0-.896.446A4 4 0 0 1 11 12H5.001v-1.466a.25.25 0 0 0-.41-.192l-2.36 1.966a.25.25 0 0 0 0 .384l2.36 1.966a.25.25 0 0 0 .41-.192V13h6a5 5 0 0 0 4.48-7.223Z" />
                      <path d="M9 5.5a.5.5 0 0 0-.854-.354l-1.75 1.75a.5.5 0 1 0 .708.708L8 6.707V10.5a.5.5 0 0 0 1 0z" />
                    </svg>
                  ) : (
                    <svg width={isMobile ? 20 : 22} height={isMobile ? 20 : 22} viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11 5.466V4H5a4 4 0 0 0-3.584 5.777.5.5 0 1 1-.896.446A5 5 0 0 1 5 3h6V1.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192m3.81.086a.5.5 0 0 1 .67.225A5 5 0 0 1 11 13H5v1.466a.25.25 0 0 1-.41.192l-2.36-1.966a.25.25 0 0 1 0-.384l2.36-1.966a.25.25 0 0 1 .41.192V12h6a4 4 0 0 0 3.585-5.777.5.5 0 0 1 .225-.67Z" />
                    </svg>
                  )}
                  {repeatMode !== 'off' && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '3px',
                        width: '4.5px',
                        height: '4.5px',
                        borderRadius: '50%',
                        backgroundColor: iconActiveColor,
                        boxShadow: glowColor,
                      }}
                    />
                  )}
                </motion.button>
              </div>

              {/* ردیف پایین: اسلایدر ولوم کاملاً وسط‌چین */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  marginTop: '2px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    maxWidth: '300px',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={() => setIsHoveringVolume(true)}
                  onMouseLeave={() => setIsHoveringVolume(false)}
                  onWheel={(e) => {
                    e.preventDefault();
                    const delta = e.deltaY < 0 ? 0.05 : -0.05;
                    onVolumeChange(Math.max(0, Math.min(maxVolFactor, volume + delta)));
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onVolumeChange(0)}
                    title={t.mute || 'Mute'}
                    style={{ ...btnStyle, color: iconInactiveColor }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 9v6h4l5 5V4L11 9H7z" />
                    </svg>
                  </button>

                  <div style={{ flex: 1, position: 'relative', height: '22px', display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: isHoveringVolume ? '5px' : '3px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '999px',
                        transition: 'height 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: `${volumePercent}%`,
                          height: '100%',
                          backgroundColor: primaryColor,
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(e) => onVolumeChange(Number(e.target.value))}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 2,
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onVolumeChange(maxVolFactor)}
                    title={t.maxVolume || 'Max Volume'}
                    style={{ ...btnStyle, color: iconInactiveColor }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          <QueueDrawer
            isOpen={showQueue}
            onClose={() => setShowQueue(false)}
            queue={queue}
            currentSong={currentSong}
            currentQueueIndex={currentQueueIndex}
            isPlaying={isPlaying}
            onPlaySong={(idx: number) => onPlayQueueSong?.(idx)}
            onRemoveFromQueue={removeFromQueue}
            onReorderQueue={(from, to) => reorderQueue?.(from, to)}
            onClearQueue={() => onClearQueue?.()}
            onShuffleQueue={() => onShuffleQueue?.()}
            onCreatePlaylist={onCreatePlaylist}
            theme={theme}
            t={t}
            isMobile={isMobile}
            inFullScreen
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}, (prev, next) => {
  if (!prev.isOpen && !next.isOpen) return true;
  return false;
});
