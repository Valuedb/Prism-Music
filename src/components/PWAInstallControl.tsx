import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Monitor, Share, CheckCircle2, WifiOff, X, Database } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { withAlpha } from '../utils/color';

interface PWAInstallControlProps {
  theme: any;
  t: any;
  isRTL: boolean;
  variant?: 'icon' | 'pill';
}

export const PWAInstallControl: React.FC<PWAInstallControlProps> = ({
  theme,
  t,
  isRTL,
  variant = 'icon',
}) => {
  const { isInstallable, isInstalled, isIOS, isWindows, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGuideOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guideOpen]);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    setGuideOpen(true);
  };

  const hoverBg = withAlpha(theme.colors.primary, theme.isDark ? 0.16 : 0.1);

  return (
    <>
      {variant === 'pill' ? (
        <button
          type="button"
          onClick={handleClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.onPrimary || '#ffffff',
            border: 'none',
            padding: '6px 13px',
            borderRadius: '999px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.7813rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Monitor size={14} />
          <span>{t.installAppBtn || 'نصب به عنوان برنامه'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          title={isWindows ? t.installOnWindows || 'نصب مستقل روی ویندوز' : t.desktopInstall || 'نصب برنامه'}
          aria-label={t.desktopInstall || 'Install App'}
          style={{
            background: isInstallable
              ? withAlpha(theme.colors.primary, theme.isDark ? 0.18 : 0.12)
              : 'none',
            border: isInstallable
              ? `1px solid ${withAlpha(theme.colors.primary, 0.35)}`
              : 'none',
            padding: isInstallable ? '6px 10px' : '8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            cursor: 'pointer',
            color: isInstallable ? theme.colors.primary : theme.colors.textSecondary,
            borderRadius: theme.radius?.md || '10px',
            fontSize: '0.75rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            transition: 'background-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = hoverBg;
            e.currentTarget.style.color = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isInstallable
              ? withAlpha(theme.colors.primary, theme.isDark ? 0.18 : 0.12)
              : 'transparent';
            e.currentTarget.style.color = isInstallable
              ? theme.colors.primary
              : theme.colors.textSecondary;
          }}
        >
          <Monitor size={18} />
          {isInstallable && (
            <span className="hidden sm:inline">{t.installAppBtn || 'نصب'}</span>
          )}
        </button>
      )}

      {guideOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setGuideOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '18px',
              zIndex: 9999999,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              dir={isRTL ? 'rtl' : 'ltr'}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '440px',
                borderRadius: theme.radius?.xl || '24px',
                backgroundColor: withAlpha(theme.colors.surfaceSolid || theme.colors.background, 0.96),
                border: `1px solid ${theme.colors.border}`,
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
                padding: '22px',
                color: theme.colors.textPrimary,
                fontFamily: theme.fonts?.main,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '11px',
                      backgroundColor: withAlpha(theme.colors.primary, 0.16),
                      color: theme.colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isIOS ? <Share size={18} /> : <Monitor size={18} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                      {t.installGuideTitle || 'نصب مستقل روی ویندوز و دستگاه'}
                    </h3>
                    <p
                      style={{
                        margin: '2px 0 0 0',
                        fontSize: '0.7813rem',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {t.installGuideSubtitle ||
                        'اجرای تمام‌صفحه، آفلاین و بدون نیاز به مرورگر'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  aria-label={t.close || 'Close'}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(60,60,67,0.08)',
                    color: theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: '14px',
                  marginBottom: '16px',
                }}
              >
                {(isIOS
                  ? [
                      t.iosInstallStep1 ||
                        '۱. در مرورگر Safari روی دکمه اشتراک‌گذاری (Share) در پایین صفحه بزنید.',
                      t.iosInstallStep2 ||
                        '۲. گزینه Add to Home Screen را انتخاب و تایید کنید.',
                    ]
                  : [
                      t.windowsInstallStep1 ||
                        '۱. در مرورگر Chrome یا Microsoft Edge ویندوز، روی آیکون نصب در نوار آدرس یا منوی مرورگر کلیک کنید.',
                      t.windowsInstallStep2 ||
                        '۲. گزینه Install Music Player / نصب به‌عنوان برنامه (Apps → Install this site as an app) را انتخاب کنید.',
                      t.windowsInstallStep3 ||
                        '۳. برنامه روی دسکتاپ و منوی Start ویندوز نصب می‌شود و فایل‌های صوتی، پلی‌لیست‌ها و تنظیمات در دیتابیس آفلاین IndexedDB ذخیره می‌شوند.',
                    ]
                ).map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(60,60,67,0.055)',
                      fontSize: '0.8125rem',
                      lineHeight: 1.55,
                    }}
                  >
                    <CheckCircle2
                      size={16}
                      color={theme.colors.primary}
                      style={{ marginTop: '3px', flexShrink: 0 }}
                    />
                    <span>{step}</span>
                  </div>
                ))}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 12px',
                    borderRadius: '11px',
                    backgroundColor: withAlpha(theme.colors.primary, 0.1),
                    color: theme.colors.primary,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  <Database size={15} style={{ flexShrink: 0 }} />
                  <span>
                    {t.localDbActive ||
                      'دیتابیس آفلاین IndexedDB برای آهنگ‌ها، پلی‌لیست‌ها و تنظیمات فعال است'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.onPrimary || '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t.done || 'متوجه شدم'}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export const OfflineIndicator: React.FC<{ theme: any; t: any; isRTL: boolean }> = ({
  theme,
  t,
  isRTL,
}) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '6px 14px',
        borderRadius: '999px',
        backgroundColor: withAlpha(theme.colors.surfaceSolid || '#1c1c1e', 0.94),
        border: `1px solid ${theme.colors.border}`,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        color: theme.colors.textPrimary,
        fontSize: '0.75rem',
        fontWeight: 600,
        pointerEvents: 'none',
      }}
    >
      <WifiOff size={14} color="#ff9500" />
      <span>{t.offlineModeBadge || 'حالت آفلاین — پخش از دیتابیس محلی'}</span>
    </div>
  );
};
