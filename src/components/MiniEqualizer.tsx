import React from 'react';
import { motion } from 'framer-motion';

interface MiniEqualizerProps {
  active: boolean;
  color?: string;
  size?: 'sm' | 'md';
}

/**
 * اکولایزر مینیاتوری هموار با انیمیشن Compositor-Only (scaleY) روی کاور آلبوم‌ها و خواننده‌ها
 */
export const MiniEqualizer: React.FC<MiniEqualizerProps> = ({
  active,
  color = '#ffffff',
  size = 'md',
}) => {
  const height = size === 'sm' ? 13 : 16;
  const barWidth = size === 'sm' ? '2.5px' : '3px';
  const gap = size === 'sm' ? '2px' : '2.5px';

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        gap,
        height: `${height}px`,
        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))',
      }}
    >
      <motion.span
        animate={
          active
            ? { scaleY: [0.28, 0.96, 0.36, 0.82, 0.28] }
            : { scaleY: 0.35 }
        }
        transition={
          active
            ? { duration: 0.72, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
        style={{
          width: barWidth,
          height: `${height}px`,
          borderRadius: '2px',
          backgroundColor: color,
          transformOrigin: 'bottom',
          display: 'block',
        }}
      />
      <motion.span
        animate={
          active
            ? { scaleY: [0.64, 0.26, 1.0, 0.46, 0.88, 0.64] }
            : { scaleY: 0.68 }
        }
        transition={
          active
            ? { duration: 0.62, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
        style={{
          width: barWidth,
          height: `${height}px`,
          borderRadius: '2px',
          backgroundColor: color,
          transformOrigin: 'bottom',
          display: 'block',
        }}
      />
      <motion.span
        animate={
          active
            ? { scaleY: [0.42, 0.88, 0.3, 0.94, 0.42] }
            : { scaleY: 0.48 }
        }
        transition={
          active
            ? { duration: 0.78, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
        style={{
          width: barWidth,
          height: `${height}px`,
          borderRadius: '2px',
          backgroundColor: color,
          transformOrigin: 'bottom',
          display: 'block',
        }}
      />
    </span>
  );
};
