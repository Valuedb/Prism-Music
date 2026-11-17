import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  tooltipBgColor?: string;
  tooltipTextColor?: string;
  tooltipBorderColor?: string;
  variant?: 'bar' | 'fullscreen';
  negativeRemaining?: boolean;
  seekStepSeconds?: number;
  ariaLabel?: string;
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
  tooltipBgColor,
  tooltipTextColor,
  tooltipBorderColor,
  variant = 'bar',
  negativeRemaining = false,
  seekStepSeconds = 5,
  ariaLabel = 'Seek track position',
}: ProgressScrubberProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const latestDragRef = useRef<DragState | null>(null);
  const onSeekRef = useRef(onSeek);
  const activeSongKey = songKey || 'none';

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

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
  const halfBubbleEstimate = hoverTimeFormatted.length >= 6 ? 26 : 21;
  const tooltipCenterPx = activeHover
    ? clampTooltipCenterPx(activeHover.ratio, activeHover.trackWidth, halfBubbleEstimate)
    : 0;

  const isFullscreen = variant === 'fullscreen';
  const trackThickness = showHoverUi ? 6 : isFullscreen ? 4 : 3;
  const resolvedTooltipBg =
    tooltipBgColor ||
    (isDarkSurface ? 'rgba(20, 20, 28, 0.94)' : 'rgba(255, 255, 255, 0.96)');
  const resolvedTooltipText = tooltipTextColor || (isDarkSurface ? '#ffffff' : '#111827');
  const resolvedTooltipBorder =
    tooltipBorderColor ||
    (isDarkSurface ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 23, 42, 0.12)');
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
        {/* تولتیپ زمان دقیق قسمت هاور شده */}
        {showHoverUi && activeHover && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: isFullscreen ? 'calc(100% + 6px)' : 'calc(100% + 8px)',
              left: `${tooltipCenterPx}px`,
              transform: 'translateX(-50%)',
              padding: '3px 7px',
              borderRadius: '7px',
              backgroundColor: resolvedTooltipBg,
              color: resolvedTooltipText,
              border: `1px solid ${resolvedTooltipBorder}`,
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.32)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              fontSize: '0.6875rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 40,
            }}
          >
            {hoverTimeFormatted}
          </div>
        )}

        {/* خط پس‌زمینه و پرشدگی پیشرفت */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: `${trackThickness}px`,
            backgroundColor: trackBgColor,
            backdropFilter: 'blur(10px)',
            borderRadius: '999px',
            transition: 'height 0.15s ease',
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
                borderRadius: '999px',
              }}
            />
          )}

          {/* خط پیشرفت پخش واقعی */}
          <div
            style={{
              position: 'relative',
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: primaryColor,
              borderRadius: '999px',
              boxShadow: glowColor,
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
              transform: 'translate(-50%, -50%)',
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

        {/* دستگیره دایره‌ای موقعیت فعلی هنگام هاور یا کشیدن */}
        {canInteract && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: `${progressPercent}%`,
              top: '50%',
              width: isDraggingForCurrentSong ? '13px' : '11px',
              height: isDraggingForCurrentSong ? '13px' : '11px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              border: `2px solid ${primaryColor}`,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.42)',
              transform: showHoverUi
                ? 'translate(-50%, -50%) scale(1)'
                : 'translate(-50%, -50%) scale(0)',
              opacity: showHoverUi ? 1 : 0,
              transition: isDraggingForCurrentSong
                ? 'transform 0.1s ease, opacity 0.12s ease'
                : 'transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.16s ease',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      <span
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
