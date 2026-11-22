import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit2,
  X,
  Music,
  User,
  Disc,
  Folder,
  Calendar,
  Clock,
  BarChart2,
  CalendarPlus,
  Heart,
  HardDrive,
  Copy,
  Check,
  FolderOpen,
} from 'lucide-react';
import type { Song } from '../types';
import { CoverImage } from './CoverImage';
import { withAlpha } from '../utils/color';
import { isDesktopRuntime } from '../utils/desktopBridge';

interface SongInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  onEdit: (song: Song) => void;
  theme: any;
  t: any;
}

const formatDuration = (seconds?: number) => {
  if (!seconds || isNaN(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const SongInfoModal: React.FC<SongInfoModalProps> = ({
  isOpen,
  onClose,
  song,
  onEdit,
  theme,
  t,
}) => {
  const [copiedPath, setCopiedPath] = React.useState(false);

  useEffect(() => {
    setCopiedPath(false);
  }, [song?.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const isRTL = t.exit === 'خروج' || t.close === 'بستن';
  const primaryColor = theme.colors.primary || '#0a84ff';
  const textPrimary = theme.colors.textPrimary;
  const textSecondary = theme.colors.textSecondary;
  const borderColor = theme.colors.border;

  const formattedDate = song?.addedAt
    ? new Date(song.addedAt).toLocaleDateString(isRTL ? 'fa-IR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const handleCopyPath = () => {
    if (!song?.sourcePath || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(song.sourcePath).catch(() => {});
    setCopiedPath(true);
    window.setTimeout(() => setCopiedPath(false), 1800);
  };

  const handleShowInFolder = () => {
    if (!song?.sourcePath || !window.desktopRuntime?.showItemInFolder) return;
    void window.desktopRuntime.showItemInFolder(song.sourcePath);
  };

  const canRevealInFolder =
    Boolean(song?.sourcePath) &&
    !song?.fileMissing &&
    isDesktopRuntime() &&
    Boolean(window.desktopRuntime?.showItemInFolder);

  const infoRows: Array<{
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
    label: string;
    value: string;
    tabular?: boolean;
    isPath?: boolean;
    isWarning?: boolean;
  }> = song
    ? [
        { icon: Music, label: t.songName || 'نام آهنگ', value: song.name || '—' },
        { icon: User, label: t.artist || 'نام خواننده', value: song.artist || (t.unknownArtist || '—') },
        { icon: Disc, label: t.album || 'آلبوم', value: song.album?.trim() || t.unknownAlbum || '—' },
        { icon: Folder, label: t.folder || 'پوشه', value: song.folder?.trim() || t.noFolder || '—' },
        { icon: Calendar, label: t.year || 'سال انتشار', value: song.year?.trim() || '—' },
        { icon: Clock, label: t.durationLabel || 'مدت زمان', value: formatDuration(song.duration), tabular: true },
        { icon: BarChart2, label: t.playCountLabel || 'تعداد پخش', value: String(song.playCount ?? 0), tabular: true },
        { icon: CalendarPlus, label: t.dateAddedLabel || 'تاریخ افزودن', value: formattedDate },
        song.sourcePath
          ? {
              icon: HardDrive,
              label: t.filePathLabel || 'مسیر فایل',
              value: song.sourcePath,
              isPath: true,
              isWarning: Boolean(song.fileMissing),
            }
          : {
              icon: HardDrive,
              label: t.fileStorageSourceLabel || 'محل نگهداری',
              value: t.storedInAppMemory || 'حافظه داخلی برنامه',
            },
      ]
    : [];

  return createPortal(
    <AnimatePresence>
      {isOpen && song && (
        <motion.div
          key="song-info-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.68)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
            padding: '16px',
            boxSizing: 'border-box',
            direction: isRTL ? 'rtl' : 'ltr',
          }}
        >
          <motion.div
            key="song-info-sheet"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: withAlpha(theme.colors.surfaceSolid || theme.colors.surface, 0.96),
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '440px',
              maxHeight: '88vh',
              overflowY: 'auto',
              border: `1px solid ${borderColor}`,
              boxShadow: theme.isDark
                ? '0 24px 64px rgba(0, 0, 0, 0.65)'
                : '0 20px 50px rgba(0, 0, 0, 0.16)',
              padding: '20px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              fontFamily: theme.fonts?.main,
              color: textPrimary,
            }}
          >
            {/* هدر مودال اطلاعات آهنگ */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ width: '32px' }} />
              <h2
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: textPrimary,
                  letterSpacing: '-0.01em',
                }}
              >
                {t.songInfo || 'اطلاعات آهنگ'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.exit || t.close || 'خروج'}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: `1px solid ${borderColor}`,
                  backgroundColor: withAlpha(textPrimary, theme.isDark ? 0.08 : 0.05),
                  color: textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* کارت کاور و عنوان بالا */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px',
                borderRadius: '18px',
                backgroundColor: withAlpha(textPrimary, theme.isDark ? 0.05 : 0.03),
                border: `1px solid ${borderColor}`,
              }}
            >
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.28)',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <CoverImage
                  src={song.cover}
                  alt={song.name}
                  iconSize={28}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {song.name}
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    color: textSecondary,
                    marginTop: '3px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {song.artist || t.unknownArtist}
                </div>
              </div>

              {song.isFavorite && (
                <div
                  title={t.favourite || 'محبوب'}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 59, 48, 0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Heart size={15} fill="#ff3b30" color="#ff3b30" />
                </div>
              )}
            </div>

            {/* جدول گروهی اطلاعات آهنگ */}
            <div
              style={{
                borderRadius: '18px',
                backgroundColor: withAlpha(textPrimary, theme.isDark ? 0.045 : 0.025),
                border: `1px solid ${borderColor}`,
                overflow: 'hidden',
              }}
            >
              {infoRows.map((row, idx) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      alignItems: row.isPath ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '11px 14px',
                      borderBottom:
                        idx < infoRows.length - 1 ? `1px solid ${borderColor}` : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '9px',
                        color: textSecondary,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        flexShrink: 0,
                        paddingTop: row.isPath ? '2px' : 0,
                      }}
                    >
                      <Icon size={15} style={{ color: row.isWarning ? '#ff453a' : primaryColor, opacity: 0.9 }} />
                      <span>{row.label}</span>
                    </div>
                    {row.isPath ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minWidth: 0,
                          flex: 1,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <div
                          dir="ltr"
                          title={row.value}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: row.isWarning ? '#ff453a' : textPrimary,
                            textAlign: 'left',
                            wordBreak: 'break-all',
                            lineHeight: 1.45,
                            unicodeBidi: 'plaintext',
                          }}
                        >
                          {row.value}
                          {row.isWarning && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: '0.6875rem',
                                color: '#ff453a',
                                marginTop: '2px',
                              }}
                            >
                              {t.fileMissingShort || 'فایل در مسیر پیدا نشد'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {canRevealInFolder && (
                            <button
                              type="button"
                              onClick={handleShowInFolder}
                              title={t.showInFolderTooltip || 'نمایش در پوشه سیستم'}
                              aria-label={t.showInFolderTooltip || 'نمایش در پوشه سیستم'}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                border: `1px solid ${borderColor}`,
                                backgroundColor: withAlpha(textPrimary, theme.isDark ? 0.08 : 0.05),
                                color: primaryColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <FolderOpen size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleCopyPath}
                            title={copiedPath ? (t.copiedPathMsg || 'مسیر کپی شد') : (t.copyPathTooltip || 'کپی مسیر فایل')}
                            aria-label={t.copyPathTooltip || 'کپی مسیر فایل'}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              border: `1px solid ${borderColor}`,
                              backgroundColor: withAlpha(textPrimary, theme.isDark ? 0.08 : 0.05),
                              color: copiedPath ? '#34c759' : textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            {copiedPath ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: textPrimary,
                          textAlign: 'end',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: row.tabular ? 'tabular-nums' : undefined,
                        }}
                      >
                        {row.value}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* دکمه‌های پایین: ویرایش اطلاعات و خروج */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  height: '44px',
                  borderRadius: '14px',
                  border: `1px solid ${borderColor}`,
                  backgroundColor: withAlpha(textPrimary, theme.isDark ? 0.06 : 0.04),
                  color: textPrimary,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <X size={16} />
                <span>{t.exit || t.close || 'خروج'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = song;
                  onClose();
                  onEdit(target);
                }}
                style={{
                  flex: 1.3,
                  height: '44px',
                  borderRadius: '14px',
                  border: 'none',
                  backgroundColor: primaryColor,
                  color: theme.colors.onPrimary || '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  boxShadow: `0 6px 18px ${withAlpha(primaryColor, 0.35)}`,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Edit2 size={15} />
                <span>{t.editInfo || t.editSong || 'ویرایش اطلاعات'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
