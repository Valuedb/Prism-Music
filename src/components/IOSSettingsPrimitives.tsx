import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { withAlpha } from '../utils/color';

/* ============================================================================
 * Native Settings Primitives
 * ============================================================================ */

interface IOSSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  theme: any;
  disabled?: boolean;
  ariaLabel?: string;
}

export const IOSSwitch: React.FC<IOSSwitchProps> = ({
  checked,
  onChange,
  theme,
  disabled = false,
  ariaLabel,
}) => {
  const isDark = Boolean(theme?.isDark);
  const trackOff = isDark ? 'rgba(120, 120, 128, 0.36)' : 'rgba(120, 120, 128, 0.22)';
  const trackOn = theme?.colors?.primary || '#34C759';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      style={{
        position: 'relative',
        width: '51px',
        height: '31px',
        padding: 0,
        borderRadius: '999px',
        border: checked
          ? '1px solid transparent'
          : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        backgroundColor: checked ? trackOn : trackOff,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        transition: 'background-color 0.24s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: checked
          ? `inset 0 0 0 1px ${withAlpha(trackOn, 0.3)}`
          : 'inset 0 1px 2px rgba(0, 0, 0, 0.12)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <motion.span
        layout={false}
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
        style={{
          position: 'absolute',
          top: '1px',
          left: '1px',
          width: '27px',
          height: '27px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          boxShadow:
            '0 3px 8px rgba(0, 0, 0, 0.18), 0 1px 1px rgba(0, 0, 0, 0.12)',
          pointerEvents: 'none',
        }}
      />
    </button>
  );
};

interface SegmentOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
}

interface IOSSegmentedControlProps<T extends string | number> {
  groupId: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  theme: any;
  fullWidth?: boolean;
  compact?: boolean;
}

export function IOSSegmentedControl<T extends string | number>({
  groupId,
  options,
  value,
  onChange,
  theme,
  fullWidth = false,
  compact = false,
}: IOSSegmentedControlProps<T>) {
  const isDark = Boolean(theme?.isDark);
  const trackBg = isDark ? 'rgba(118, 118, 128, 0.24)' : 'rgba(118, 118, 128, 0.13)';
  const pillBg = isDark ? 'rgba(255, 255, 255, 0.18)' : '#FFFFFF';
  const pillShadow = isDark
    ? '0 2px 8px rgba(0, 0, 0, 0.35), 0 0 0 0.5px rgba(255, 255, 255, 0.12)'
    : '0 2px 6px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.06)';

  return (
    <div
      role="tablist"
      style={{
        display: fullWidth ? 'grid' : 'inline-flex',
        gridTemplateColumns: fullWidth ? `repeat(${options.length}, minmax(0, 1fr))` : undefined,
        alignItems: 'center',
        padding: '3px',
        borderRadius: '11px',
        backgroundColor: trackBg,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
        gap: '2px',
        width: fullWidth ? '100%' : 'auto',
        boxSizing: 'border-box',
      }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={(e) => {
              e.stopPropagation();
              onChange(option.value);
            }}
            style={{
              position: 'relative',
              border: 'none',
              background: 'transparent',
              padding: compact ? '0.3125rem 0.625rem' : '0.4375rem 0.75rem',
              borderRadius: '0.5313rem',
              cursor: 'pointer',
              fontSize: compact ? '0.75rem' : '0.7813rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3125rem',
              whiteSpace: 'nowrap',
              transition: 'color 0.18s ease',
              zIndex: 1,
              minWidth: 0,
            }}
          >
            {isActive && (
              <motion.span
                layoutId={`ios-seg-${groupId}`}
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '8.5px',
                  backgroundColor: pillBg,
                  boxShadow: pillShadow,
                  zIndex: -1,
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface IOSSquircleIconProps {
  color: string;
  gradientTo?: string;
  size?: number;
  children: React.ReactNode;
}

export const IOSSquircleIcon: React.FC<IOSSquircleIconProps> = ({
  color,
  gradientTo,
  size = 30,
  children,
}) => (
  <div
    style={{
      width: `${(size / 16).toFixed(4)}rem`,
      height: `${(size / 16).toFixed(4)}rem`,
      borderRadius: `${((size * 0.27) / 16).toFixed(4)}rem`,
      background: gradientTo
        ? `linear-gradient(145deg, ${color}, ${gradientTo})`
        : `linear-gradient(145deg, ${color}, ${withAlpha(color, 0.84)})`,
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxShadow: `0 2px 6px ${withAlpha(color, 0.34)}, inset 0 1px 0 rgba(255,255,255,0.28)`,
    }}
  >
    {children}
  </div>
);

interface IOSGroupedSectionProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  theme: any;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const IOSGroupedSection: React.FC<IOSGroupedSectionProps> = ({
  header,
  footer,
  theme,
  children,
  style,
}) => {
  const isDark = Boolean(theme?.isDark);
  return (
    <section style={{ marginBottom: '1.375rem', ...style }}>
      {header && (
        <div
          style={{
            fontSize: '0.7813rem',
            fontWeight: 600,
            color: theme.colors.textSecondary,
            padding: '0 0.875rem 0.5rem',
            letterSpacing: '0.01em',
          }}
        >
          {header}
        </div>
      )}
      <div
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius?.xl || '18px',
          border: `1px solid ${theme.colors.border}`,
          overflow: 'hidden',
          backdropFilter: theme.effects?.glassBlur || 'blur(24px)',
          WebkitBackdropFilter: theme.effects?.glassBlur || 'blur(24px)',
          boxShadow: isDark
            ? '0 8px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
            : '0 4px 16px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        }}
      >
        {children}
      </div>
      {footer && (
        <div
          style={{
            fontSize: '0.75rem',
            lineHeight: 1.55,
            color: theme.colors.textSecondary,
            padding: '0.5rem 0.875rem 0',
          }}
        >
          {footer}
        </div>
      )}
    </section>
  );
};

interface IOSRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  valueText?: React.ReactNode;
  onClick?: () => void;
  showChevron?: boolean;
  isRtl?: boolean;
  isLast?: boolean;
  destructive?: boolean;
  theme: any;
  children?: React.ReactNode;
}

export const IOSRow: React.FC<IOSRowProps> = ({
  title,
  subtitle,
  icon,
  trailing,
  valueText,
  onClick,
  showChevron = false,
  isRtl = false,
  isLast = false,
  destructive = false,
  theme,
  children,
}) => {
  const isDark = Boolean(theme?.isDark);
  const hairline = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(60, 60, 67, 0.12)';
  const hoverBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.025)';
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div style={{ position: 'relative' }}>
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        style={{
          padding: '0.8125rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: children ? '0.625rem' : 0,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (onClick) e.currentTarget.style.backgroundColor = hoverBg;
        }}
        onMouseLeave={(e) => {
          if (onClick) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            {icon}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.9063rem',
                  fontWeight: 600,
                  color: destructive ? '#FF453A' : theme.colors.textPrimary,
                  lineHeight: 1.35,
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: theme.colors.textSecondary,
                    lineHeight: 1.45,
                    marginTop: '2px',
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {valueText !== undefined && (
              <span
                style={{
                  fontSize: '0.8438rem',
                  color: theme.colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {valueText}
              </span>
            )}
            {trailing}
            {showChevron && (
              <ChevronIcon
                size={17}
                color={isDark ? 'rgba(235, 235, 245, 0.35)' : 'rgba(60, 60, 67, 0.35)'}
              />
            )}
          </div>
        </div>
        {children}
      </div>

      {!isLast && (
        <div
          style={{
            height: '1px',
            backgroundColor: hairline,
            marginInlineStart: icon ? '58px' : '16px',
          }}
        />
      )}
    </div>
  );
};

interface IOSSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  theme: any;
  centeredZero?: boolean;
}

export const IOSSlider: React.FC<IOSSliderProps> = ({
  value,
  min,
  max,
  step,
  onChange,
  theme,
  centeredZero = false,
}) => {
  const isDark = Boolean(theme?.isDark);
  const trackOff = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(60, 60, 67, 0.16)';
  const range = Math.max(0.0001, max - min);
  const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));

  const background = centeredZero
    ? value >= 0
      ? `linear-gradient(to right, ${trackOff} 0%, ${trackOff} 50%, ${theme.colors.primary} 50%, ${theme.colors.primary} ${pct}%, ${trackOff} ${pct}%, ${trackOff} 100%)`
      : `linear-gradient(to right, ${trackOff} 0%, ${trackOff} ${pct}%, ${theme.colors.primary} ${pct}%, ${theme.colors.primary} 50%, ${trackOff} 50%, ${trackOff} 100%)`
    : `linear-gradient(to right, ${theme.colors.primary} 0%, ${theme.colors.primary} ${pct}%, ${trackOff} ${pct}%, ${trackOff} 100%)`;

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      dir="ltr"
      style={{
        width: '100%',
        height: '5px',
        borderRadius: '999px',
        appearance: 'none',
        WebkitAppearance: 'none',
        cursor: 'pointer',
        accentColor: theme.colors.primary,
        background,
        outline: 'none',
      }}
    />
  );
};

interface IOSConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  theme: any;
  isRtl?: boolean;
}

export const IOSConfirmDialog: React.FC<IOSConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  theme,
  isRtl = false,
}) => {
  const isDark = Boolean(theme?.isDark);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-confirm-title"
          data-modal-open="true"
          dir={isRtl ? 'rtl' : 'ltr'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onCancel}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000010,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(15, 23, 42, 0.36)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: theme?.fonts?.main || 'system-ui, sans-serif',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '340px',
              borderRadius: '20px',
              backgroundColor: theme.colors.surfaceSolid || theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              boxShadow: isDark
                ? '0 24px 60px rgba(0,0,0,0.65)'
                : '0 20px 50px rgba(15,23,42,0.18)',
              overflow: 'hidden',
              textAlign: 'center',
            }}
          >
            <div style={{ padding: '22px 20px 18px' }}>
              <h3
                id="ios-confirm-title"
                style={{
                  margin: 0,
                  fontSize: '1.0313rem',
                  fontWeight: 700,
                  color: theme.colors.textPrimary,
                  lineHeight: 1.4,
                }}
              >
                {title}
              </h3>
              {message && (
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: '0.8125rem',
                    lineHeight: 1.55,
                    color: theme.colors.textSecondary,
                  }}
                >
                  {message}
                </p>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                borderTop: `1px solid ${
                  isDark ? 'rgba(255,255,255,0.1)' : 'rgba(60,60,67,0.15)'
                }`,
              }}
            >
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '13px 10px',
                  border: 'none',
                  borderInlineEnd: `1px solid ${
                    isDark ? 'rgba(255,255,255,0.1)' : 'rgba(60,60,67,0.15)'
                  }`,
                  backgroundColor: 'transparent',
                  color: theme.colors.primary,
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                }}
                style={{
                  padding: '13px 10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: destructive ? '#FF453A' : theme.colors.primary,
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
