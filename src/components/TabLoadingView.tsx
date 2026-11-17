import React from 'react';

interface TabLoadingViewProps {
  theme: any;
  subtitle?: string;
  reduceMotion?: boolean;
  isRTL?: boolean;
}

const SPOKES = Array.from({ length: 12 }, (_, i) => i);

export const TabLoadingView: React.FC<TabLoadingViewProps> = ({
  theme,
  subtitle,
  reduceMotion = false,
  isRTL = false,
}) => {
  const color = theme?.colors?.textPrimary || '#ffffff';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
      aria-label={subtitle || 'Loading'}
      style={{
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        paddingBottom: '108px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className={reduceMotion ? undefined : 'activity-indicator-fade-in'}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          {SPOKES.map((index) => {
            const angle = index * 30;
            const staticOpacity = 0.2 + (index / 11) * 0.72;
            return (
              <rect
                key={index}
                x="14.7"
                y="2"
                width="2.6"
                height="7.6"
                rx="1.3"
                fill={color}
                transform={`rotate(${angle} 16 16)`}
                className={reduceMotion ? undefined : 'activity-spoke'}
                style={
                  reduceMotion
                    ? { opacity: staticOpacity }
                    : { animationDelay: `-${((12 - index) * 0.07).toFixed(2)}s` }
                }
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
