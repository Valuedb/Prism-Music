import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isRTLString } from '../utils/bidi';

interface MarqueeTextProps {
  text: string;
  style?: React.CSSProperties;
  speedPxPerSec?: number;
  gapPx?: number;
  pauseAtEdgeMs?: number;
}

/**
 * نمایشگر هوشمند متن چرخشی (مشابه زیرنویس شبکه‌های خبری):
 * - تراز افقی متن از کانتینر والد (راست در فارسی / چپ در انگلیسی یا مرکز) پیروی می‌کند تا عنوان انگلیسی
 *   در رابط فارسی به سمت مقابل صفحه نپرد.
 * - اگر متن جا بشود کاملاً ثابت و بدون افکت رندر می‌شود و در صورت نیاز از انتهای واقعی خود برش می‌خورد.
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
  const [parentIsRTL, setParentIsRTL] = useState(false);
  const [parentTextAlign, setParentTextAlign] = useState<string>('');
  const [overflowState, setOverflowState] = useState<{
    isOverflowing: boolean;
    shiftPx: number;
  }>({ isOverflowing: false, shiftPx: 0 });

  const uniqueId = useId().replace(/:/g, '');
  const isRTLText = useMemo(() => isRTLString(text), [text]);

  useLayoutEffect(() => {
    const syncDirection = () => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const computed = window.getComputedStyle(parent);
      const nextIsRTL = computed.direction === 'rtl';
      const nextTextAlign = computed.textAlign || '';
      setParentIsRTL((prev) => (prev === nextIsRTL ? prev : nextIsRTL));
      setParentTextAlign((prev) => (prev === nextTextAlign ? prev : nextTextAlign));
    };

    syncDirection();
    const dirAncestor = containerRef.current?.closest('[dir]');
    if (!dirAncestor || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(syncDirection);
    observer.observe(dirAncestor, { attributes: true, attributeFilter: ['dir', 'style'] });
    return () => observer.disconnect();
  }, [text]);

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
  const resolvedTextAlign =
    style?.textAlign ||
    (parentTextAlign === 'center' ? 'center' : parentIsRTL ? 'right' : 'left');

  return (
    <div
      ref={containerRef}
      dir={isOverflowing ? (isRTLText ? 'rtl' : 'ltr') : undefined}
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
        textAlign: resolvedTextAlign,
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
          dir={isRTLText ? 'rtl' : 'ltr'}
          style={{
            display: 'block',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            unicodeBidi: 'plaintext',
            textAlign: resolvedTextAlign,
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
};
