import React, { useState, useEffect, memo } from 'react';
import { Music } from 'lucide-react';

interface CoverImageProps {
  src?: string | null;
  alt?: string;
  style?: React.CSSProperties;
  iconSize?: number;
  iconColor?: string;
  fallbackBg?: string;
}

export const CoverImage: React.FC<CoverImageProps> = memo(({
  src,
  alt = '',
  style,
  iconSize = 20,
  iconColor = 'rgba(128, 136, 150, 0.62)',
  fallbackBg = 'rgba(128, 136, 150, 0.14)',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        aria-label={alt}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fallbackBg,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <Music size={iconSize} color={iconColor} strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
      style={style}
    />
  );
});
