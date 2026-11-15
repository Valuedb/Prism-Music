import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

interface MarqueeTextProps {
  text: string;
  style?: React.CSSProperties;
  speedPxPerSec?: number;
  gapPx?: number;
  pauseAtEdgeMs?: number;
}

const RTL_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/;

/**
 * نمایشگر هوشمند متن چرخشی (مشابه زیرنویس شبکه‌های خبری):
 * - اگر متن جا بشود کاملاً ثابت و بدون افکت رندر می‌شود.
 * - اگر متن طولانی‌تر از کادر باشد، پیوسته و نرم با GPU (translate3d) می‌چرخد.
 */
export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  style,
  speedPxPerSec = 34,
  gapPx = 42,
  pauseAtEdgeMs = 1100,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflowState, setOverflowState] = useState<{
    isOverflowing: boolean;
    shiftPx: number;
  }>({ isOverflowing: false, shiftPx: 0 });

  const uniqueId = useId().replace(/:/g, '');
  const isRTLText = useMemo(() => RTL_CHAR_REGEX.test(text), [text]);

  useEffect(() => {
    const checkOverflow = () => {
      const container = containerRef.current;
      const measure = measureRef.current;
      if (!container || !measure) return;
      const containerWidth = container.clientWidth;
      const textWidth = measure.scrollWidth;
      const overflows = containerWidth > 0 && textWidth > containerWidth + 2;
      setOverflowState((prev) => {
        const nextShift = overflows ? textWidth + gapPx : 0;
        if (prev.isOverflowing === overflows && Math.abs(prev.shiftPx - nextShift) < 1) {
          return prev;
        }
        return { isOverflowing: overflows, shiftPx: nextShift };
      });
    };

    checkOverflow();
    const rafId = window.requestAnimationFrame(checkOverflow);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(checkOverflow);
      observer.observe(containerRef.current);
      if (measureRef.current) observer.observe(measureRef.current);
    } else {
      window.addEventListener('resize', checkOverflow);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', checkOverflow);
    };
  }, [text, gapPx]);

  const { isOverflowing, shiftPx } = overflowState;
  const moveSeconds = shiftPx > 0 ? Math.max(5.5, shiftPx / speedPxPerSec) : 8;
  const pauseSeconds = pauseAtEdgeMs / 1000;
  const totalDuration = moveSeconds + pauseSeconds;
  const pausePercent = Math.min(28, Math.round((pauseSeconds / totalDuration) * 100));
  const animName = `mq_${uniqueId}`;
  const targetTranslate = isRTLText ? shiftPx : -shiftPx;

  return (
    <div
      ref={containerRef}
      dir={isRTLText ? 'rtl' : 'ltr'}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        whiteSpace: 'nowrap',
        WebkitMaskImage: isOverflowing
          ? 'linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)'
          : undefined,
        maskImage: isOverflowing
          ? 'linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)'
          : undefined,
        ...style,
      }}
    >
      {/* عنصر مخفی برای اندازه‌گیری دقیق عرض واقعی متن */}
      <span
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          left: 0,
          top: 0,
        }}
      >
        {text}
      </span>

      {isOverflowing ? (
        <>
          <style>{`
            @keyframes ${animName} {
              0%, ${pausePercent}% {
                transform: translate3d(0, 0, 0);
              }
              100% {
                transform: translate3d(${targetTranslate}px, 0, 0);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .${animName}-track {
                animation: none !important;
              }
            }
          `}</style>
          <div
            className={`${animName}-track`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              willChange: 'transform',
              animation: `${animName} ${totalDuration.toFixed(2)}s linear infinite`,
            }}
          >
            <span style={{ paddingInlineEnd: `${gapPx}px`, whiteSpace: 'nowrap' }}>{text}</span>
            <span aria-hidden="true" style={{ paddingInlineEnd: `${gapPx}px`, whiteSpace: 'nowrap' }}>
              {text}
            </span>
          </div>
        </>
      ) : (
        <span
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
};
