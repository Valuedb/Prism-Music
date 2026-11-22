import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AppWindow, Camera, HardDrive, Loader2, RotateCcw } from 'lucide-react';
import type { Song } from '../types';
import { CoverImage } from './CoverImage';
import { blobToCompactDataUrl } from '../utils/audioMetadata';
import { isDesktopRuntime } from '../utils/desktopBridge';
import { withAlpha } from '../utils/color';

interface EditSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  onSave: (updatedSong: Song) => void;
  theme: any;
  t: any;
}

const isDiskTagWritableExtension = (diskPath?: string): boolean =>
  Boolean(diskPath && /\.(mp3|flac)$/i.test(diskPath));

/**
 * مودال ویرایش تگ‌ها و کاور آهنگ
 * امکان انتخاب واضح ذخیره فقط در برنامه یا نوشتن مستقیم تگ‌ها روی فایل اصلی در هارد دیسک
 */
export const EditSongModal: React.FC<EditSongModalProps> = ({
  isOpen,
  onClose,
  song,
  onSave,
  theme,
  t,
}) => {
  const [formData, setFormData] = useState<Partial<Song>>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isWritingDisk, setIsWritingDisk] = useState(false);
  const [diskWriteError, setDiskWriteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** پر کردن مقادیر اولیه فرم هنگام باز شدن مودال */
  useEffect(() => {
    if (isOpen && song) {
      setImageError(null);
      setIsPromptOpen(false);
      setIsWritingDisk(false);
      setDiskWriteError(null);
      setFormData({
        name: song.name || '',
        artist: song.artist || '',
        album: song.album || '',
        folder: song.folder || '',
        year: song.year || '',
        lyrics: song.lyrics || '',
        cover: song.cover || '',
      });
    }
  }, [isOpen, song]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isWritingDisk) return;
      if (isPromptOpen) {
        setIsPromptOpen(false);
        setDiskWriteError(null);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isPromptOpen, isWritingDisk, onClose]);

  /** تغییر تصویر کاور با تبدیل استاندارد JPEG برای سازگاری کامل با تگ فایل صوتی */
  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError(t.imageFileError || 'لطفاً یک فایل تصویری معتبر انتخاب کنید.');
      return;
    }

    setImageError(null);
    const compactDataUrl = await blobToCompactDataUrl(file);
    if (compactDataUrl) {
      setFormData((prev) => ({ ...prev, cover: compactDataUrl }));
    }
  };

  /** بازنشانی کاور به کاور اصلی آهنگ */
  const handleResetCover = () => {
    if (song) {
      setFormData((prev) => ({ ...prev, cover: song.cover }));
    }
  };

  const buildUpdatedSong = (): Song | null => {
    if (!song) return null;
    return {
      ...song,
      name: (formData.name || '').trim() || song.name,
      artist: (formData.artist || '').trim() || song.artist,
      album: (formData.album || '').trim() || song.album,
      folder: (formData.folder || '').trim() || undefined,
      year: (formData.year || '').trim() || song.year,
      lyrics: (formData.lyrics || '').trim() || undefined,
      cover: formData.cover || song.cover,
    };
  };

  /** باز کردن پرسش تایید نحوه ذخیره تغییرات */
  const handleRequestSave = () => {
    if (!song) return;
    setDiskWriteError(null);
    setIsPromptOpen(true);
  };

  /** گزینه ۱: ذخیره تغییرات فقط در دیتابیس داخلی برنامه */
  const handleConfirmAppOnly = () => {
    if (isWritingDisk) return;
    const updated = buildUpdatedSong();
    if (updated) {
      onSave(updated);
    }
    setIsPromptOpen(false);
    onClose();
  };

  const hasDesktopBridge = isDesktopRuntime() && Boolean(window.desktopRuntime?.writeSongTags);
  const hasDiskPath = Boolean(song?.sourcePath && song.sourcePath.trim());
  const isWritableFormat = isDiskTagWritableExtension(song?.sourcePath);
  const canWriteToDisk = hasDesktopBridge && hasDiskPath && isWritableFormat;

  const diskUnavailableReason = !hasDesktopBridge
    ? t.saveDiskUnavailableWeb ||
      'در محیط پیش‌نمایش مرورگر امکان تغییر مستقیم فایل روی هارد نیست؛ این قابلیت در نسخه دسکتاپ فعال است.'
    : !hasDiskPath
    ? t.saveDiskUnavailableNoPath ||
      'این آهنگ مسیر مستقیمی روی هارد ندارد (در حافظه داخلی برنامه ذخیره شده است).'
    : !isWritableFormat
    ? t.saveDiskUnavailableFormat ||
      'نوشتن مستقیم تگ روی هارد فعلاً فقط برای فایل‌های MP3 و FLAC پشتیبانی می‌شود.'
    : null;

  /** گزینه ۲: نوشتن مستقیم تگ‌ها روی فایل صوتی در هارد و همگام‌سازی برنامه */
  const handleConfirmSaveToDisk = async () => {
    if (!song || !canWriteToDisk || isWritingDisk || !window.desktopRuntime?.writeSongTags) return;
    const updated = buildUpdatedSong();
    if (!updated || !song.sourcePath) return;

    setDiskWriteError(null);
    setIsWritingDisk(true);

    try {
      const coverCandidate =
        updated.cover && !updated.cover.startsWith('data:image/svg+xml')
          ? updated.cover
          : undefined;

      const result = await window.desktopRuntime.writeSongTags({
        filePath: song.sourcePath,
        title: updated.name,
        artist: updated.artist,
        album: updated.album,
        year: updated.year,
        lyrics: updated.lyrics,
        coverDataUrl: coverCandidate,
      });

      if (!result?.ok) {
        setDiskWriteError(
          `${t.saveDiskWriteFailed || 'نوشتن روی فایل هارد ناموفق بود:'} ${
            result?.error || 'Unknown error'
          }`
        );
        setIsWritingDisk(false);
        return;
      }

      onSave(updated);
      setIsWritingDisk(false);
      setIsPromptOpen(false);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setDiskWriteError(`${t.saveDiskWriteFailed || 'نوشتن روی فایل هارد ناموفق بود:'} ${message}`);
      setIsWritingDisk(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const primaryColor = theme.colors.primary || '#0a84ff';

  return createPortal(
    <AnimatePresence>
      {isOpen && song && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={() => {
            if (!isWritingDisk && !isPromptOpen) onClose();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999999,
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: theme.colors.surfaceSolid || theme.colors.surface,
              padding: '24px 20px',
              borderRadius: theme.radius.lg,
              width: '100%',
              maxWidth: '440px',
              maxHeight: '88vh',
              overflowY: 'auto',
              border: `1px solid ${theme.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {/* هدر مودال */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                style={btnSecondaryStyle(theme)}
              >
                {t.cancel}
              </motion.button>

              <h2
                style={{
                  margin: 0,
                  fontSize: '1.0625rem',
                  color: theme.colors.textPrimary,
                  fontWeight: '700',
                  textAlign: 'center',
                }}
              >
                {t.editSong || 'ویرایش اطلاعات آهنگ'}
              </h2>

              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleRequestSave}
                style={btnPrimaryStyle(theme)}
              >
                {t.save || 'ذخیره'}
              </motion.button>
            </div>

            {/* بخش ویرایش و پیش‌نمایش کاور */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 0 6px 0',
              }}
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                onClick={() => fileInputRef.current?.click()}
                title={t.changeCover || 'تغییر کاور'}
                style={{
                  position: 'relative',
                  width: '130px',
                  height: '130px',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: `2px solid ${theme.colors.border}`,
                  boxShadow: theme.shadows.medium,
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CoverImage
                  src={formData.cover}
                  alt=""
                  iconSize={42}
                  iconColor={theme.colors.textSecondary}
                  fallbackBg="rgba(0,0,0,0.2)"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* لایه هاور دوربین */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    color: '#ffffff',
                    transition: 'opacity 0.2s',
                  }}
                >
                  <Camera size={26} />
                  <span style={{ fontSize: '0.6875rem', fontWeight: '600' }}>
                    {t.changeCover || 'تغییر کاور'}
                  </span>
                </div>
              </motion.div>

              {/* ورودی مخفی انتخاب فایل تصویر */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void handleCoverFileChange(e);
                }}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...btnSecondaryStyle(theme),
                    fontSize: '0.75rem',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Camera size={14} />
                  <span>{t.uploadFromDevice || 'انتخاب عکس'}</span>
                </motion.button>

                {formData.cover !== song.cover && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleResetCover}
                    style={{
                      ...btnSecondaryStyle(theme),
                      fontSize: '0.75rem',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>{t.resetCover || 'بازنشانی'}</span>
                  </motion.button>
                )}
              </div>
              {imageError && (
                <div style={{ fontSize: '0.75rem', color: theme.colors.danger || '#ff453a', textAlign: 'center' }}>
                  {imageError}
                </div>
              )}
            </div>

            {/* فرم فیلدهای متادیتا */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle(theme)}>{t.songName || 'نام آهنگ'}</label>
                <input
                  type="text"
                  placeholder={t.songName || 'نام آهنگ'}
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle(theme)}
                />
              </div>

              <div>
                <label style={labelStyle(theme)}>{t.artist || 'خواننده'}</label>
                <input
                  type="text"
                  placeholder={t.artist || 'خواننده'}
                  value={formData.artist || ''}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  style={inputStyle(theme)}
                />
              </div>

              <div>
                <label style={labelStyle(theme)}>{t.album || 'آلبوم'}</label>
                <input
                  type="text"
                  placeholder={t.album || 'آلبوم'}
                  value={formData.album || ''}
                  onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                  style={inputStyle(theme)}
                />
              </div>

              <div>
                <label style={labelStyle(theme)}>{t.folder || 'پوشه'}</label>
                <input
                  type="text"
                  placeholder={t.folderPlaceholder || 'مثال: راک / منتخب'}
                  value={formData.folder || ''}
                  onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                  style={inputStyle(theme)}
                />
              </div>

              <div>
                <label style={labelStyle(theme)}>{t.year || 'سال انتشار'}</label>
                <input
                  type="text"
                  placeholder={t.year || 'سال انتشار'}
                  value={formData.year || ''}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  style={inputStyle(theme)}
                />
              </div>

              <div>
                <label style={labelStyle(theme)}>{t.lyrics || 'متن ترانه'}</label>
                <textarea
                  rows={4}
                  placeholder={t.lyricsPlaceholder || 'متن ترانه...'}
                  value={formData.lyrics || ''}
                  onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
                  style={{
                    ...inputStyle(theme),
                    resize: 'vertical',
                    minHeight: '88px',
                    lineHeight: 1.55,
                    fontFamily: theme.fonts?.main,
                  }}
                />
              </div>
            </div>
          </motion.div>

          {/* پنجره تایید مجزا و استاندارد برای انتخاب ذخیره فقط در برنامه یا روی هارد (بدون تغییرشکل کادر اصلی) */}
          <AnimatePresence>
            {isPromptOpen && (
              <motion.div
                key="save-scope-overlay"
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isWritingDisk) {
                    setIsPromptOpen(false);
                    setDiskWriteError(null);
                  }
                }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 10000010,
                  backgroundColor: 'rgba(0, 0, 0, 0.58)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  boxSizing: 'border-box',
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: '410px',
                    borderRadius: '20px',
                    backgroundColor: theme.colors.surfaceSolid || theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    padding: '22px 20px 18px',
                    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.72)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: '1.0625rem',
                        fontWeight: 700,
                        color: theme.colors.textPrimary,
                      }}
                    >
                      {t.saveScopeTitle || 'نحوه ذخیره تغییرات'}
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8438rem',
                        lineHeight: 1.6,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {t.saveScopeQuestion ||
                        'این ویرایش‌ها فقط داخل برنامه ذخیره شوند یا مستقیماً داخل خود فایل روی هارد هم ثبت گردند؟'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* گزینه ۱: فقط در برنامه */}
                    <motion.button
                      type="button"
                      disabled={isWritingDisk}
                      whileHover={isWritingDisk ? undefined : { y: -1 }}
                      whileTap={isWritingDisk ? undefined : { scale: 0.985 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      onClick={handleConfirmAppOnly}
                      style={{
                        width: '100%',
                        textAlign: 'start',
                        padding: '13px 14px',
                        borderRadius: '14px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: withAlpha(theme.colors.background, 0.75),
                        color: theme.colors.textPrimary,
                        cursor: isWritingDisk ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        opacity: isWritingDisk ? 0.55 : 1,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          backgroundColor: withAlpha(primaryColor, 0.14),
                          color: primaryColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <AppWindow size={19} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                          {t.saveAppOnlyTitle || 'فقط روی برنامه'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7813rem',
                            lineHeight: 1.5,
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {t.saveAppOnlyDesc ||
                            'تغییرات فقط در کتابخانه Prism Music ذخیره می‌شوند و فایل صوتی روی هارد بدون تغییر می‌ماند.'}
                        </span>
                      </div>
                    </motion.button>

                    {/* گزینه ۲: کامل روی هارد و برنامه */}
                    <motion.button
                      type="button"
                      disabled={!canWriteToDisk || isWritingDisk}
                      whileHover={!canWriteToDisk || isWritingDisk ? undefined : { y: -1 }}
                      whileTap={!canWriteToDisk || isWritingDisk ? undefined : { scale: 0.985 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      onClick={() => {
                        void handleConfirmSaveToDisk();
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'start',
                        padding: '13px 14px',
                        borderRadius: '14px',
                        border: canWriteToDisk
                          ? `1px solid ${withAlpha(primaryColor, 0.55)}`
                          : `1px solid ${theme.colors.border}`,
                        backgroundColor: canWriteToDisk
                          ? withAlpha(primaryColor, 0.12)
                          : withAlpha(theme.colors.background, 0.45),
                        color: theme.colors.textPrimary,
                        cursor: !canWriteToDisk || isWritingDisk ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        opacity: !canWriteToDisk ? 0.68 : 1,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          backgroundColor: canWriteToDisk
                            ? primaryColor
                            : withAlpha(theme.colors.textSecondary, 0.16),
                          color: canWriteToDisk ? theme.colors.onPrimary || '#ffffff' : theme.colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isWritingDisk ? (
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Loader2 size={19} />
                          </motion.span>
                        ) : (
                          <HardDrive size={19} />
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                          {isWritingDisk
                            ? t.saveDiskWriting || 'در حال ذخیره روی فایل هارد...'
                            : t.saveDiskAndAppTitle || 'کامل روی هارد و برنامه'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7813rem',
                            lineHeight: 1.5,
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {t.saveDiskAndAppDesc ||
                            'تگ‌ها و کاور مستقیماً داخل خود فایل صوتی روی هارد نوشته می‌شوند تا در ویندوز و سایر برنامه‌ها هم ثبت بمانند.'}
                        </span>
                        {song.sourcePath && (
                          <span
                            dir="ltr"
                            style={{
                              marginTop: '4px',
                              fontSize: '0.6875rem',
                              color: theme.colors.textSecondary,
                              fontFamily: 'var(--mono)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={song.sourcePath}
                          >
                            {song.sourcePath}
                          </span>
                        )}
                        {diskUnavailableReason && (
                          <span
                            style={{
                              marginTop: '4px',
                              fontSize: '0.75rem',
                              lineHeight: 1.45,
                              color: theme.colors.warning || '#f59e0b',
                              fontWeight: 500,
                            }}
                          >
                            {diskUnavailableReason}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {diskWriteError && (
                      <motion.div
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          backgroundColor: withAlpha(theme.colors.danger || '#ff453a', 0.14),
                          border: `1px solid ${withAlpha(theme.colors.danger || '#ff453a', 0.4)}`,
                          color: theme.colors.danger || '#ff453a',
                          fontSize: '0.7813rem',
                          lineHeight: 1.5,
                        }}
                      >
                        {diskWriteError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '2px' }}>
                    <motion.button
                      type="button"
                      disabled={isWritingDisk}
                      whileTap={isWritingDisk ? undefined : { scale: 0.96 }}
                      onClick={() => {
                        setIsPromptOpen(false);
                        setDiskWriteError(null);
                      }}
                      style={{
                        ...btnSecondaryStyle(theme),
                        opacity: isWritingDisk ? 0.5 : 1,
                        cursor: isWritingDisk ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {t.backToEdit || 'بازگشت به ویرایش'}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const labelStyle = (theme: any) => ({
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: '600',
  marginBottom: '4px',
  color: theme.colors.textSecondary,
});

const inputStyle = (theme: any) => ({
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '10px 14px',
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border}`,
  backgroundColor: theme.colors.background,
  color: theme.colors.textPrimary,
  fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 0.2s',
});

const btnPrimaryStyle = (theme: any) => ({
  padding: '8px 18px',
  borderRadius: theme.radius.sm,
  border: 'none',
  backgroundColor: theme.colors.primary,
  color: theme.colors.onPrimary || '#ffffff',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '0.875rem',
  transition: 'opacity 0.2s',
});

const btnSecondaryStyle = (theme: any) => ({
  padding: '8px 14px',
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border}`,
  backgroundColor: 'transparent',
  color: theme.colors.textPrimary,
  cursor: 'pointer',
  fontWeight: '500',
  fontSize: '0.875rem',
  transition: 'background-color 0.2s',
});