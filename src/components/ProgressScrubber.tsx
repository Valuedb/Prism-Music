import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clampTooltipCenterPx,
  computeScrubPosition,
  formatTrackTime,
} from '../utils/time';
import { withAlpha } from '../utils/color';

export interface ProgressScrubberProps {
  songKey?: string | null;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  primaryColor: string;
  trackBgColor: string;
  timeTextColor: string;
  glowColor?: string;
  isDarkSurface?: boolean;
  tooltipTextColor?: string;
  variant?: 'bar' | 'fullscreen';
  negativeRemaining?: boolean;
  seekStepSeconds?: number;
  ariaLabel?: string;
  isPlaying?: boolean;
  getLiveTime?: () => { currentTime: number; duration: number } | null;
}

interface HoverState {
  ratio: number;
  trackWidth: number;
}

interface DragState {
  songKey: string;
  time: number;
}

export const ProgressScrubber = memo(({
  songKey = 'active',
  currentTime,
  duration,
  onSeek,
  primaryColor,
  trackBgColor,
  timeTextColor,
  glowColor,
  isDarkSurface = true,
  tooltipTextColor,
  variant = 'bar',
  negativeRemaining = false,
  seekStepSeconds = 5,
  ariaLabel = 'Seek track position',
  isPlaying = false,
  getLiveTime,
}: ProgressScrubberProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const elapsedTextRef = useRef<HTMLSpanElement>(null);
  const remainingTextRef = useRef<HTMLSpanElement>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const latestDragRef = useRef<DragState | null>(null);
  const onSeekRef = useRef(onSeek);
  const getLiveTimeRef = useRef(getLiveTime);
  const activeSongKey = songKey || 'none';

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    getLiveTimeRef.current = getLiveTime;
  }, [getLiveTime]);

  const [isHovering, setIsHovering] = useState(false);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeCurrent =
    Number.isFinite(currentTime) && currentTime > 0
      ? safeDuration > 0
        ? Math.min(safeDuration, currentTime)
        : currentTime
      : 0;
  const canInteract = safeDuration > 0;

  const isDraggingForCurrentSong =
    canInteract && dragState !== null && dragState.songKey === activeSongKey;
  const displayTime = isDraggingForCurrentSong ? dragState.time : safeCurrent;
  const progressPercent =
    safeDuration > 0 ? Math.min(100, Math.max(0, (displayTime / safeDuration) * 100)) : 0;
  const progressRatio = progressPercent / 100;

  const isLivePlaybackActive = isPlaying && !isDraggingForCurrentSong && Boolean(getLiveTime);
  const safeDurationRef = useRef(safeDuration);
  const negativeRemainingRef = useRef(negativeRemaining);

  useEffect(() => {
    safeDurationRef.current = safeDuration;
  }, [safeDuration]);

  useEffect(() => {
    negativeRemainingRef.current = negativeRemaining;
  }, [negativeRemaining]);

  // همگام‌سازی فوری استاتیک نوار پیشرفت قبل از رندر فریم (بدون پرش هنگام توقف یا کشیدن)
  useLayoutEffect(() => {
    if (isLivePlaybackActive) return;
    if (fillRef.current) {
      fillRef.current.style.transform = `scaleX(${progressRatio})`;
    }
    if (elapsedTextRef.current) {
      const nextElapsed = formatTrackTime(displayTime);
      if (elapsedTextRef.current.textContent !== nextElapsed) {
        elapsedTextRef.current.textContent = nextElapsed;
      }
    }
    if (remainingTextRef.current) {
      const nextRemaining = negativeRemaining
        ? `-${formatTrackTime(Math.max(0, safeDuration - displayTime))}`
        : formatTrackTime(safeDuration);
      if (remainingTextRef.current.textContent !== nextRemaining) {
        remainingTextRef.current.textContent = nextRemaining;
      }
    }
  }, [
    isLivePlaybackActive,
    progressRatio,
    displayTime,
    safeDuration,
    negativeRemaining,
    activeSongKey,
  ]);

  // همگام‌سازی نرم ۶۰fps روی GPU هنگام پخش بدون ری‌استارت‌شدن در تیک‌های timeupdate
  useEffect(() => {
    if (!isLivePlaybackActive) return;

    let rafId = 0;
    const tick = () => {
      const live = getLiveTimeRef.current?.();
      if (live) {
        const fallbackDur = safeDurationRef.current;
        const liveDur =
          Number.isFinite(live.duration) && live.duration > 0 ? live.duration : fallbackDur;
        const rawCur = Number.isFinite(live.currentTime) && live.currentTime > 0 ? live.currentTime : 0;
        const liveCur = liveDur > 0 ? Math.min(liveDur, rawCur) : rawCur;
        const ratio = liveDur > 0 ? Math.min(1, Math.max(0, liveCur / liveDur)) : 0;

        if (fillRef.current) {
          fillRef.current.style.transform = `scaleX(${ratio})`;
        }
        if (elapsedTextRef.current) {
          const nextElapsed = formatTrackTime(liveCur);
          if (elapsedTextRef.current.textContent !== nextElapsed) {
            elapsedTextRef.current.textContent = nextElapsed;
          }
        }
        if (remainingTextRef.current) {
          const nextRemaining = negativeRemainingRef.current
            ? `-${formatTrackTime(Math.max(0, liveDur - liveCur))}`
            : formatTrackTime(liveDur);
          if (remainingTextRef.current.textContent !== nextRemaining) {
            remainingTextRef.current.textContent = nextRemaining;
          }
        }
        if (trackRef.current) {
          const rounded = String(Math.round(liveCur));
          if (trackRef.current.getAttribute('aria-valuenow') !== rounded) {
            trackRef.current.setAttribute('aria-valuenow', rounded);
          }
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isLivePlaybackActive, activeSongKey]);

  const measurePointer = useCallback(
    (clientX: number): { ratio: number; time: number; trackWidth: number } | null => {
      const el = trackRef.current;
      if (!el || safeDuration <= 0) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const { ratio, time } = computeScrubPosition(clientX, rect.left, rect.width, safeDuration);
      return { ratio, time, trackWidth: rect.width };
    },
    [safeDuration]
  );

  // مدیریت یکپارچه کشیدن اسلایدر روی پنجره تا در صورت خروج نشانگر از نوار، درگ متوقف یا قفل نشود
  useEffect(() => {
    if (!isDraggingForCurrentSong) return;

    const handleWindowPointerMove = (ev: PointerEvent) => {
      if (dragPointerIdRef.current !== null && ev.pointerId !== dragPointerIdRef.current) return;
      const measured = measurePointer(ev.clientX);
      if (!measured) return;
      const nextDrag: DragState = { songKey: activeSongKey, time: measured.time };
      latestDragRef.current = nextDrag;
      setDragState(nextDrag);
      setHoverState({ ratio: measured.ratio, trackWidth: measured.trackWidth });
    };

    const finishDrag = (ev: PointerEvent, commitSeek: boolean) => {
      if (dragPointerIdRef.current !== null && ev.pointerId !== dragPointerIdRef.current) return;
      const measured = measurePointer(ev.clientX);
      const pending = latestDragRef.current;

      if (commitSeek && pending && pending.songKey === activeSongKey) {
        onSeekRef.current(measured ? measured.time : pending.time);
      }

      dragPointerIdRef.current = null;
      latestDragRef.current = null;
      setDragState(null);

      const el = trackRef.current;
      if (el && ev.pointerType !== 'touch') {
        const rect = el.getBoundingClientRect();
        const inside =
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom;
        if (inside && rect.width > 0 && safeDuration > 0) {
          const { ratio } = computeScrubPosition(ev.clientX, rect.left, rect.width, safeDuration);
          setIsHovering(true);
          setHoverState({ ratio, trackWidth: rect.width });
          return;
        }
      }
      setIsHovering(false);
      setHoverState(null);
    };

    const handleWindowPointerUp = (ev: PointerEvent) => finishDrag(ev, true);
    const handleWindowPointerCancel = (ev: PointerEvent) => finishDrag(ev, false);
    const handleWindowBlur = () => {
      dragPointerIdRef.current = null;
      latestDragRef.current = null;
      setDragState(null);
      setIsHovering(false);
      setHoverState(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [activeSongKey, isDraggingForCurrentSong, measurePointer, safeDuration]);

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canInteract || e.pointerType === 'touch') return;
    setIsHovering(true);
    const measured = measurePointer(e.clientX);
    if (measured) {
      setHoverState({ ratio: measured.ratio, trackWidth: measured.trackWidth });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canInteract || e.pointerType === 'touch') return;
    setIsHovering(true);
    const measured = measurePointer(e.clientX);
    if (measured) {
      setHoverState({ ratio: measured.ratio, trackWidth: measured.trackWidth });
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    setIsHovering(false);
    if (!isDraggingForCurrentSong) {
      setHoverState(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canInteract) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const measured = measurePointer(e.clientX);
    if (!measured) return;

    dragPointerIdRef.current = e.pointerId;
    const nextDrag: DragState = { songKey: activeSongKey, time: measured.time };
    latestDragRef.current = nextDrag;
    setDragState(nextDrag);
    setHoverState({ ratio: measured.ratio, trackWidth: measured.trackWidth });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canInteract) return;
    let nextTime: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      nextTime = Math.min(safeDuration, safeCurrent + seekStepSeconds);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      nextTime = Math.max(0, safeCurrent - seekStepSeconds);
    } else if (e.key === 'Home') {
      nextTime = 0;
    } else if (e.key === 'End') {
      nextTime = safeDuration;
    }
    if (nextTime !== null) {
      e.preventDefault();
      e.stopPropagation();
      onSeek(nextTime);
    }
  };

  const activeHover = canInteract ? hoverState : null;
  const showHoverUi = canInteract && (isDraggingForCurrentSong || (isHovering && activeHover !== null));
  const hoverPercent = activeHover ? activeHover.ratio * 100 : null;
  const hoverTime = isDraggingForCurrentSong
    ? displayTime
    : activeHover
    ? activeHover.ratio * safeDuration
    : 0;
  const hoverTimeFormatted = formatTrackTime(hoverTime);
  const halfBubbleEstimate = hoverTimeFormatted.length >= 6 ? 22 : 15;
  const tooltipCenterPx = activeHover
    ? clampTooltipCenterPx(activeHover.ratio, activeHover.trackWidth, halfBubbleEstimate)
    : 0;

  const isFullscreen = variant === 'fullscreen';
  const restScaleY = isFullscreen ? 4 / 6 : 3 / 6;
  const resolvedTooltipText = tooltipTextColor || (isDarkSurface ? '#ffffff' : '#111827');
  const ghostHoverColor = withAlpha(primaryColor, isDarkSurface ? 0.34 : 0.28);

  const rightTimeLabel = negativeRemaining
    ? `-${formatTrackTime(Math.max(0, safeDuration - displayTime))}`
    : formatTrackTime(safeDuration);

  return (
    <div
      dir="ltr"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        userSelect: 'none',
      }}
    >
      <span
        ref={elapsedTextRef}
        style={{
          fontSize: isFullscreen ? '0.7188rem' : '0.625rem',
          color: timeTextColor,
          minWidth: isFullscreen ? '32px' : '30px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: isFullscreen ? 500 : 400,
          flexShrink: 0,
        }}
      >
        {formatTrackTime(displayTime)}
      </span>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={canInteract ? 0 : -1}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(safeDuration)}
        aria-valuenow={Math.round(displayTime)}
        aria-valuetext={formatTrackTime(displayTime)}
        aria-disabled={!canInteract}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          position: 'relative',
          height: isFullscreen ? '24px' : '18px',
          display: 'flex',
          alignItems: 'center',
          cursor: canInteract ? 'pointer' : 'default',
          touchAction: 'none',
          outline: 'none',
        }}
      >
        {/* نمایش زمان دقیق قسمت هاور شده به صورت متن ساده بدون کادر */}
        {showHoverUi && activeHover && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: isFullscreen ? 'calc(100% + 4px)' : 'calc(100% + 5px)',
              left: 0,
              transform: `translate3d(${Math.round(tooltipCenterPx)}px, 0, 0) translateX(-50%)`,
              color: resolvedTooltipText,
              textShadow: isDarkSurface
                ? '0 1px 6px rgba(0, 0, 0, 0.72)'
                : '0 1px 4px rgba(255, 255, 255, 0.85)',
              fontSize: isFullscreen ? '0.75rem' : '0.6875rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 40,
            }}
          >
            {hoverTimeFormatted}
          </div>
        )}

        {/* خط پس‌زمینه و پرشدگی پیشرفت با بزرگنمایی نرم روی GPU بدون لرزش */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '6px',
            backgroundColor: trackBgColor,
            borderRadius: '999px',
            transformOrigin: 'center center',
            transform: showHoverUi ? 'scaleY(1)' : `scaleY(${restScaleY})`,
            transition: 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {/* پیش‌نمایش شفاف محدوده هاور شده */}
          {showHoverUi && hoverPercent !== null && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: `${hoverPercent}%`,
                backgroundColor: ghostHoverColor,
                borderRadius: 0,
              }}
            />
          )}

          {/* خط پیشرفت پخش واقعی با لبه پیشروی تیز و رندر نرم ۶۰fps */}
          <div
            ref={fillRef}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              backgroundColor: primaryColor,
              borderRadius: 0,
              boxShadow: glowColor,
              transformOrigin: 'left center',
              willChange: 'transform',
            }}
          />
        </div>

        {/* نشانگر عمودی دقیق موقعیت نشانگر روی نوار هنگام هاور */}
        {showHoverUi && hoverPercent !== null && !isDraggingForCurrentSong && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: `${hoverPercent}%`,
              top: '50%',
              transform: 'translate3d(-50%, -50%, 0)',
              width: '2px',
              height: isFullscreen ? '12px' : '10px',
              borderRadius: '2px',
              backgroundColor: isDarkSurface
                ? 'rgba(255, 255, 255, 0.85)'
                : 'rgba(15, 23, 42, 0.65)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      <span
        ref={remainingTextRef}
        style={{
          fontSize: isFullscreen ? '0.7188rem' : '0.625rem',
          color: timeTextColor,
          minWidth: isFullscreen ? '32px' : '30px',
          textAlign: 'left',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: isFullscreen ? 500 : 400,
          flexShrink: 0,
        }}
      >
        {rightTimeLabel}
      </span>
    </div>
  );
});

ProgressScrubber.displayName = 'ProgressScrubber';
