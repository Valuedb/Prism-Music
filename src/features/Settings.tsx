import React, { useState, useEffect, useCallback } from 'react';
import type {
  DisplaySettings as DisplaySettingsType,
  EqualizerSettings,
  PlaybackPreferences,
  Playlist,
  SeekStepSeconds,
  SleepTimerState,
  Song,
  SoundSettings as SoundSettingsType,
} from '../types';
import {
  Globe,
  Music,
  FolderUp,
  Timer,
  Volume2,
  Monitor,
  HardDrive,
  Keyboard,
  Play,
  Bookmark,
  ShieldAlert,
  CopyCheck,
  SkipForward,
  Trash2,
  Sparkles,
  FileDown,
  FileUp,
  RotateCcw,
  Info,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Upload,
  Database,
  Code2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_DISPLAY_SETTINGS, type PaletteType, type ThemeMode } from '../theme';
import { SoundSettings } from './SoundSettings';
import { DisplaySettings } from './DisplaySettings';
import { DEFAULT_EQ_SETTINGS, DEFAULT_SOUND_SETTINGS } from '../player/audioEffects';
import { DEFAULT_PLAYBACK_PREFERENCES } from '../player/constants';
import { DEMO_SONGS } from '../player/demoSongs';
import {
  extractSongsBatched,
  findDuplicateSongIds,
  partitionDuplicateSongs,
} from '../utils/audioMetadata';
import {
  cleanupOrphanAudioBlobs,
  deleteAudioBlob,
  getAudioStorageStats,
  type AudioStorageStats,
} from '../storage/mediaStore';
import { getLocalDbStats, type LocalDbStats } from '../storage/kvDatabase';
import { isDisplaySettings, isEqualizerSettings, isPlaybackPreferences, isPlaylistList, isSongList, isSoundSettings } from '../types/guards';
import {
  IOSConfirmDialog,
  IOSGroupedSection,
  IOSRow,
  IOSSegmentedControl,
  IOSSquircleIcon,
  IOSSwitch,
} from '../components/IOSSettingsPrimitives';

interface SettingsProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  playlists?: Playlist[];
  setPlaylists?: React.Dispatch<React.SetStateAction<Playlist[]>>;
  customFolders?: string[];
  setCustomFolders?: React.Dispatch<React.SetStateAction<string[]>>;
  t: any;
  language: string;
  setLanguage: (lang: 'fa' | 'en') => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colorPalette: PaletteType;
  setColorPalette: (palette: PaletteType) => void;
  equalizerSettings: EqualizerSettings;
  setEqualizerSettings: (settings: EqualizerSettings) => void;
  soundSettings?: SoundSettingsType;
  setSoundSettings?: React.Dispatch<React.SetStateAction<SoundSettingsType>>;
  displaySettings?: DisplaySettingsType;
  setDisplaySettings?: React.Dispatch<React.SetStateAction<DisplaySettingsType>>;
  playbackPrefs?: PlaybackPreferences;
  setPlaybackPrefs?: React.Dispatch<React.SetStateAction<PlaybackPreferences>>;
  theme: any;
  customBackground?: string | null;
  setCustomBackground?: (bg: string | null) => void;
  customBgBlur?: number;
  setCustomBgBlur?: (blur: number) => void;
  customBgDim?: number;
  setCustomBgDim?: (dim: number) => void;
  glassCardCovers?: boolean;
  setGlassCardCovers?: (enabled: boolean) => void;
  sleepTimer?: SleepTimerState;
  onSetSleepTimer?: (timer: SleepTimerState) => void;
  onPlayImported?: (song: Song, list: Song[]) => void;
  onDeleteSongsBatch?: (ids: string[]) => void;
  onCloseSettings?: () => void;
  initialSubPage?: { page: SettingsSubPage; token: number } | null;
}

export type SettingsSubPage = 'main' | 'display' | 'sound' | 'library' | 'shortcuts';

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const KbdBadge: React.FC<{ children: React.ReactNode; theme: any }> = ({ children, theme }) => (
  <kbd
    dir="ltr"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4px 9px',
      borderRadius: '7px',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(60,60,67,0.08)',
      border: `1px solid ${theme.isDark ? 'rgba(255,255,255,0.16)' : 'rgba(60,60,67,0.18)'}`,
      color: theme.colors.textPrimary,
      fontSize: '0.75rem',
      fontWeight: 700,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </kbd>
);

export const Settings = ({
  songs,
  setSongs,
  playlists = [],
  setPlaylists,
  customFolders = [],
  setCustomFolders,
  t,
  language,
  setLanguage,
  themeMode,
  setThemeMode,
  colorPalette,
  setColorPalette,
  equalizerSettings,
  setEqualizerSettings,
  soundSettings = DEFAULT_SOUND_SETTINGS,
  setSoundSettings,
  displaySettings = DEFAULT_DISPLAY_SETTINGS,
  setDisplaySettings,
  playbackPrefs = DEFAULT_PLAYBACK_PREFERENCES,
  setPlaybackPrefs,
  theme,
  customBackground,
  setCustomBackground,
  customBgBlur = 10,
  setCustomBgBlur,
  customBgDim = 45,
  setCustomBgDim,
  glassCardCovers = true,
  setGlassCardCovers,
  sleepTimer = { mode: 'off' },
  onSetSleepTimer,
  onPlayImported,
  onDeleteSongsBatch,
  onCloseSettings,
  initialSubPage,
}: SettingsProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [subPage, setSubPage] = useState<SettingsSubPage>(initialSubPage?.page || 'main');
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [storageStats, setStorageStats] = useState<AudioStorageStats>({ count: 0, totalBytes: 0 });
  const [localDbStats, setLocalDbStats] = useState<LocalDbStats>({ supported: true, recordCount: 0 });
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'resetStats' | 'resetAll' | null>(null);
  const [copiedContact, setCopiedContact] = useState<'telegram' | 'github' | null>(null);

  const isRTL = language === 'fa';

  const handleCopyContact = useCallback((key: 'telegram' | 'github', value: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopiedContact(key);
    window.setTimeout(() => {
      setCopiedContact((prev) => (prev === key ? null : prev));
    }, 1800);
  }, []);

  useEffect(() => {
    if (initialSubPage?.page) {
      setSubPage(initialSubPage.page);
    }
  }, [initialSubPage?.page, initialSubPage?.token]);

  const refreshStorageStats = useCallback(async () => {
    try {
      const [stats, dbStats] = await Promise.all([
        getAudioStorageStats(),
        getLocalDbStats(),
      ]);
      setStorageStats(stats);
      setLocalDbStats(dbStats);
    } catch {
      // ignore IndexedDB read failure
    }
    try {
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        if (typeof est.usage === 'number') setQuotaUsed(est.usage);
      }
    } catch {
      // ignore quota failure
    }
  }, []);

  useEffect(() => {
    if (subPage === 'library') {
      refreshStorageStats();
    }
  }, [subPage, songs.length, refreshStorageStats]);

  // کلید Escape برای بازگشت پلکانی در زیرصفحه‌ها یا بستن تنظیمات
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"], [data-modal-open="true"]')) return;
      if (subPage !== 'main') {
        setSubPage('main');
      } else {
        onCloseSettings?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subPage, onCloseSettings]);

  useEffect(() => {
    if (sleepTimer.mode !== 'until') return;
    setNowTs(Date.now());
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sleepTimer]);

  const showNotice = useCallback((msg: string) => {
    setFeedbackBanner(msg);
    window.setTimeout(() => {
      setFeedbackBanner((curr) => (curr === msg ? null : curr));
    }, 3800);
  }, []);

  const remainingSleepSeconds =
    sleepTimer.mode === 'until'
      ? Math.max(0, Math.ceil((sleepTimer.endsAt - nowTs) / 1000))
      : 0;

  const sleepStatusLabel = (() => {
    if (sleepTimer.mode === 'until') {
      const m = Math.floor(remainingSleepSeconds / 60);
      const s = remainingSleepSeconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
    if (sleepTimer.mode === 'songEnd') {
      return t.endOfSong || 'پایان آهنگ فعلی';
    }
    return t.sleepTimerOff || 'خاموش';
  })();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const files = input.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    try {
      const imported = await extractSongsBatched(Array.from(files));
      if (imported.length === 0) return;

      let toAdd = imported;
      let skippedCount = 0;
      if (playbackPrefs.skipDuplicatesOnImport) {
        const partitioned = partitionDuplicateSongs(imported, songs);
        toAdd = partitioned.unique;
        skippedCount = partitioned.duplicates.length;
        partitioned.duplicates.forEach((dup) => {
          if (dup.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(dup.fileUrl);
          deleteAudioBlob(dup.id).catch(() => {});
        });
      }

      if (toAdd.length > 0) {
        const nextList = [...songs, ...toAdd];
        setSongs(nextList);
        if (playbackPrefs.autoPlayOnImport && onPlayImported) {
          onPlayImported(toAdd[0], nextList);
        }
      }

      const addedText = `${toAdd.length} ${t.importCompleteMsg || 'فایل صوتی اضافه شد.'}`;
      const skipText = skippedCount > 0 ? ` (${skippedCount} ${t.duplicatesSkippedMsg || 'تکراری رد شد.'})` : '';
      showNotice(`${addedText}${skipText}`);
      refreshStorageStats();
    } finally {
      setIsLoading(false);
      input.value = '';
    }
  };

  const folderUploadProps = {
    webkitdirectory: '',
    directory: '',
  } as React.InputHTMLAttributes<HTMLInputElement>;

  const updatePref = <K extends keyof PlaybackPreferences>(
    key: K,
    value: PlaybackPreferences[K]
  ) => {
    setPlaybackPrefs?.((prev) => ({ ...prev, [key]: value }));
  };

  const handleRemoveDuplicates = () => {
    const dupIds = findDuplicateSongIds(songs);
    if (dupIds.length === 0) {
      showNotice(t.noDuplicatesMsg || 'آهنگ تکراری‌ای پیدا نشد.');
      return;
    }
    if (onDeleteSongsBatch) {
      onDeleteSongsBatch(dupIds);
    } else {
      const dupSet = new Set(dupIds);
      setSongs((prev) => prev.filter((s) => !dupSet.has(s.id)));
      dupIds.forEach((id) => deleteAudioBlob(id).catch(() => {}));
    }
    showNotice(`${dupIds.length} ${t.duplicatesRemovedMsg || 'آهنگ تکراری حذف شد.'}`);
    refreshStorageStats();
  };

  const handleCleanOrphanBlobs = async () => {
    const { removedCount, freedBytes } = await cleanupOrphanAudioBlobs(
      new Set(songs.map((s) => s.id))
    );
    if (removedCount === 0) {
      showNotice(t.noOrphansMsg || 'فایل رهاشده‌ای در حافظه وجود ندارد.');
    } else {
      showNotice(
        `${removedCount} ${t.orphansCleanedMsg || 'فایل رهاشده پاک‌سازی شد.'} (${formatBytes(freedBytes)})`
      );
    }
    refreshStorageStats();
  };

  const handleRestoreDemoTracks = () => {
    setSongs((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const missing = DEMO_SONGS.filter((demo) => !existingIds.has(demo.id));
      return missing.length > 0 ? [...prev, ...missing] : prev;
    });
    showNotice(t.demoRestoredMsg || 'آهنگ‌های نمونه بازگردانی شدند.');
  };

  const handleExportBackup = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      songs: songs.map((s) => ({
        ...s,
        // آدرس‌های موقت blob در پشتیبان ذخیره نمی‌شوند تا با IndexedDB یا دمو تداخل نداشته باشند
        fileUrl: s.fileUrl.startsWith('blob:') ? `blob://backup/${s.id}` : s.fileUrl,
      })),
      playlists,
      customFolders,
      settings: {
        language,
        themeMode,
        colorPalette,
        displaySettings,
        soundSettings,
        equalizerSettings,
        playbackPrefs,
        glassCardCovers,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apple-music-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotice(t.backupExportedMsg || 'فایل پشتیبان با موفقیت دانلود شد.');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(String(ev.target?.result || ''));
        if (!raw || typeof raw !== 'object') {
          showNotice(t.backupInvalidMsg || 'فرمت فایل پشتیبان معتبر نیست.');
          return;
        }
        if (isPlaylistList(raw.playlists) && setPlaylists) {
          setPlaylists(raw.playlists);
        }
        if (Array.isArray(raw.customFolders) && raw.customFolders.every((x: unknown) => typeof x === 'string') && setCustomFolders) {
          setCustomFolders(raw.customFolders);
        }
        if (isSongList(raw.songs)) {
          setSongs((prev) => {
            const prevMap = new Map(prev.map((s) => [s.id, s]));
            const merged = raw.songs.map((s: Song) => {
              const local = prevMap.get(s.id);
              if (local && s.fileUrl.startsWith('blob://backup/')) {
                return { ...s, fileUrl: local.fileUrl };
              }
              return s;
            });
            return merged;
          });
        }
        if (raw.settings && typeof raw.settings === 'object') {
          const st = raw.settings as Record<string, unknown>;
          if (st.language === 'fa' || st.language === 'en') setLanguage(st.language);
          if (st.themeMode === 'system' || st.themeMode === 'light' || st.themeMode === 'dark') {
            setThemeMode(st.themeMode);
          }
          if (typeof st.colorPalette === 'string') setColorPalette(st.colorPalette as PaletteType);
          if (isDisplaySettings(st.displaySettings) && setDisplaySettings) setDisplaySettings(st.displaySettings);
          if (isSoundSettings(st.soundSettings) && setSoundSettings) setSoundSettings(st.soundSettings);
          if (isEqualizerSettings(st.equalizerSettings)) setEqualizerSettings(st.equalizerSettings);
          if (isPlaybackPreferences(st.playbackPrefs) && setPlaybackPrefs) setPlaybackPrefs(st.playbackPrefs);
          if (typeof st.glassCardCovers === 'boolean' && setGlassCardCovers) setGlassCardCovers(st.glassCardCovers);
        }
        showNotice(t.backupImportedMsg || 'نسخه پشتیبان با موفقیت بازیابی شد.');
      } catch {
        showNotice(t.backupInvalidMsg || 'فرمت فایل پشتیبان معتبر نیست.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmExecute = () => {
    if (confirmAction === 'resetStats') {
      setSongs((prev) => prev.map((s) => ({ ...s, playCount: 0, lastPlayedAt: undefined })));
      if (setPlaylists) {
        setPlaylists((prev) =>
          prev.map((p) => ({
            ...p,
            songs: p.songs.map((s) => ({ ...s, playCount: 0, lastPlayedAt: undefined })),
          }))
        );
      }
      showNotice(t.statsResetDone || 'آمار پخش بازنشانی شد.');
    } else if (confirmAction === 'resetAll') {
      setThemeMode('system');
      setColorPalette('classic-blue');
      setCustomBackground?.(null);
      setCustomBgBlur?.(10);
      setCustomBgDim?.(45);
      setGlassCardCovers?.(true);
      setDisplaySettings?.({ ...DEFAULT_DISPLAY_SETTINGS });
      setEqualizerSettings({ ...DEFAULT_EQ_SETTINGS, bands: [...DEFAULT_EQ_SETTINGS.bands] });
      setSoundSettings?.({
        ...DEFAULT_SOUND_SETTINGS,
        bands10: [...DEFAULT_SOUND_SETTINGS.bands10],
        profilePresets: {},
      });
      setPlaybackPrefs?.({ ...DEFAULT_PLAYBACK_PREFERENCES });
      showNotice(t.resetAllDoneMsg || 'تمام تنظیمات به حالت پیش‌فرض بازگردانده شد.');
    }
    setConfirmAction(null);
  };

  const soundSummaryParts: string[] = [];
  if (equalizerSettings.enabled) {
    soundSummaryParts.push(
      soundSettings.eqMode === '10band' ? t.eqMode10Band || '۱۰ بانده' : t.eqMode5Band || '۵ بانده'
    );
  }
  if (soundSettings.crossfadeSeconds > 0) {
    soundSummaryParts.push(`${t.crossfadeShort || 'Crossfade'} ${soundSettings.crossfadeSeconds}${t.secondsShort || 's'}`);
  }
  if (soundSettings.playbackSpeed !== 1) {
    soundSummaryParts.push(`${soundSettings.playbackSpeed.toFixed(2)}x`);
  }
  const soundSummaryText =
    soundSummaryParts.length > 0
      ? soundSummaryParts.join(' · ')
      : t.soundMenuSubtitle || 'اکولایزر، کراس‌فید، سرعت پخش، ریورب و تعادل خروجی';

  const displaySubtitleText = [
    themeMode === 'system' ? t.system || 'سیستم' : themeMode === 'dark' ? t.dark : t.light,
    displaySettings.oledPureBlack && theme.isDark ? 'OLED' : null,
    displaySettings.adaptiveArtworkAccent
      ? t.adaptiveAccentLabel || 'رنگ پویا'
      : isRTL
      ? theme.name
      : theme.nameEn || theme.name,
  ]
    .filter(Boolean)
    .join(' · ');

  const duplicateCount = findDuplicateSongIds(songs).length;

  return (
    <div style={{ width: '100%', overflowX: 'clip' }}>
      <AnimatePresence mode="wait" initial={false}>
        {subPage === 'sound' && setSoundSettings ? (
          <motion.div
            key="settings-sub-sound"
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <SoundSettings
              soundSettings={soundSettings}
              setSoundSettings={setSoundSettings}
              equalizerSettings={equalizerSettings}
              setEqualizerSettings={setEqualizerSettings}
              onBack={() => setSubPage('main')}
              theme={theme}
              t={t}
              language={language}
            />
          </motion.div>
        ) : subPage === 'display' && setDisplaySettings ? (
          <motion.div
            key="settings-sub-display"
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <DisplaySettings
              displaySettings={displaySettings}
              setDisplaySettings={setDisplaySettings}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              colorPalette={colorPalette}
              setColorPalette={setColorPalette}
              customBackground={customBackground}
              setCustomBackground={setCustomBackground}
              customBgBlur={customBgBlur}
              setCustomBgBlur={setCustomBgBlur}
              customBgDim={customBgDim}
              setCustomBgDim={setCustomBgDim}
              glassCardCovers={glassCardCovers}
              setGlassCardCovers={setGlassCardCovers}
              onBack={() => setSubPage('main')}
              theme={theme}
              t={t}
              language={language}
            />
          </motion.div>
        ) : subPage === 'library' ? (
          <motion.div
            key="settings-sub-library"
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1,
              padding: 'clamp(14px, 3vw, 32px)',
              paddingBottom: '140px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: '100%', maxWidth: '820px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => setSubPage('main')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    padding: '6px 4px',
                    color: theme.colors.primary,
                    cursor: 'pointer',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                  }}
                >
                  {isRTL ? <ArrowRight size={19} /> : <ArrowLeft size={19} />}
                  <span>{t.settings || 'تنظیمات'}</span>
                </button>
                <h1 style={{ fontSize: 'clamp(1.1875rem, 2.5vw, 1.5rem)', fontWeight: 800, margin: 0, color: theme.colors.textPrimary }}>
                  {t.libraryStorageTitle || 'کتابخانه و پشتیبان‌گیری'}
                </h1>
                <div style={{ width: '72px' }} />
              </div>

              {feedbackBanner && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    backgroundColor: `${theme.colors.primary}20`,
                    border: `1px solid ${theme.colors.primary}55`,
                    color: theme.colors.textPrimary,
                    fontSize: '0.8438rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={17} color={theme.colors.primary} />
                  <span>{feedbackBanner}</span>
                </div>
              )}

              <IOSGroupedSection header={t.libraryOverviewSection || 'وضعیت کلی کتابخانه'} theme={theme}>
                <IOSRow
                  theme={theme}
                  icon={<IOSSquircleIcon color="#FF2D55" gradientTo="#FF375F"><Music size={16} /></IOSSquircleIcon>}
                  title={t.totalLibraryTracks || 'کل آهنگ‌های کتابخانه'}
                  valueText={`${songs.length}`}
                />
                <IOSRow
                  theme={theme}
                  icon={<IOSSquircleIcon color="#007AFF" gradientTo="#5AC8FA"><HardDrive size={16} /></IOSSquircleIcon>}
                  title={t.offlineStoredAudio || 'فایل‌های صوتی ذخیره‌شده در حافظه'}
                  valueText={`${storageStats.count} (${formatBytes(storageStats.totalBytes)})`}
                />
                <IOSRow
                  theme={theme}
                  icon={<IOSSquircleIcon color="#34C759" gradientTo="#30D158"><Database size={16} /></IOSSquircleIcon>}
                  title={t.localDbRecords || 'رکوردهای دیتابیس محلی (IndexedDB)'}
                  valueText={localDbStats.supported ? `${localDbStats.recordCount}` : '—'}
                  isLast={quotaUsed === null}
                />
                {quotaUsed !== null && (
                  <IOSRow
                    theme={theme}
                    isLast
                    icon={<IOSSquircleIcon color="#5856D6" gradientTo="#AF52DE"><HardDrive size={16} /></IOSSquircleIcon>}
                    title={t.browserQuotaUsed || 'فضای اشغال‌شده مرورگر'}
                    valueText={formatBytes(quotaUsed)}
                  />
                )}
              </IOSGroupedSection>

              <IOSGroupedSection header={t.importSectionTitle || 'افزودن موسیقی'} theme={theme}>
                <IOSRow
                  theme={theme}
                  icon={<IOSSquircleIcon color="#34C759" gradientTo="#30D158"><Upload size={16} /></IOSSquircleIcon>}
                  title={t.selectFiles || 'انتخاب فایل‌های موسیقی'}
                  trailing={
                    <label
                      style={{
                        padding: '7px 14px',
                        borderRadius: '999px',
                        backgroundColor: theme.colors.primary,
                        color: theme.colors.onPrimary || '#fff',
                        fontSize: '0.7813rem',
                        fontWeight: 700,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      {isLoading ? t.loading : t.add || 'افزودن'}
                      <input type="file" accept="audio/*" multiple disabled={isLoading} onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                  }
                />
                <IOSRow
                  theme={theme}
                  isLast
                  icon={<IOSSquircleIcon color="#30B0C7" gradientTo="#0A84FF"><FolderUp size={16} /></IOSSquircleIcon>}
                  title={t.importFolderBtn || 'انتخاب پوشه کامل'}
                  trailing={
                    <label
                      style={{
                        padding: '7px 14px',
                        borderRadius: '999px',
                        backgroundColor: theme.colors.background,
                        border: `1px solid ${theme.colors.border}`,
                        color: theme.colors.textPrimary,
                        fontSize: '0.7813rem',
                        fontWeight: 600,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      {t.importFolder || 'وارد کردن پوشه'}
                      <input type="file" accept="audio/*" multiple disabled={isLoading} {...folderUploadProps} onChange={handleFileUpload} style={{ display: 'none' }} />
                    </label>
                  }
                />
              </IOSGroupedSection>

              <IOSGroupedSection header={t.maintenanceSection || 'بهینه‌سازی و پاک‌سازی'} theme={theme}>
                <IOSRow
                  theme={theme}
                  onClick={handleRemoveDuplicates}
                  icon={<IOSSquircleIcon color="#FF9500" gradientTo="#FFCC00"><CopyCheck size={16} /></IOSSquircleIcon>}
                  title={t.removeDuplicatesBtn || 'پاک‌سازی آهنگ‌های تکراری'}
                  subtitle={t.removeDuplicatesDesc}
                  valueText={duplicateCount > 0 ? `${duplicateCount}` : '0'}
                  showChevron
                  isRtl={isRTL}
                />
                <IOSRow
                  theme={theme}
                  onClick={handleCleanOrphanBlobs}
                  icon={<IOSSquircleIcon color="#5AC8FA" gradientTo="#007AFF"><Trash2 size={16} /></IOSSquircleIcon>}
                  title={t.cleanOrphanBlobsBtn || 'پاک‌سازی فایل‌های رهاشده حافظه'}
                  subtitle={t.cleanOrphanBlobsDesc}
                  showChevron
                  isRtl={isRTL}
                />
                <IOSRow
                  theme={theme}
                  onClick={handleRestoreDemoTracks}
                  icon={<IOSSquircleIcon color="#AF52DE" gradientTo="#FF2D55"><Sparkles size={16} /></IOSSquircleIcon>}
                  title={t.restoreDemoBtn || 'بازیابی آهنگ‌های نمونه'}
                  subtitle={t.restoreDemoDesc}
                  showChevron
                  isRtl={isRTL}
                />
                <IOSRow
                  theme={theme}
                  isLast
                  destructive
                  onClick={() => setConfirmAction('resetStats')}
                  icon={<IOSSquircleIcon color="#FF3B30" gradientTo="#FF453A"><RotateCcw size={16} /></IOSSquircleIcon>}
                  title={t.resetPlayStatsBtn || 'صفر کردن آمار پخش'}
                  subtitle={t.resetPlayStatsDesc}
                />
              </IOSGroupedSection>

              <IOSGroupedSection header={t.backupSectionTitle || 'پشتیبان‌گیری و بازیابی'} theme={theme}>
                <IOSRow
                  theme={theme}
                  onClick={handleExportBackup}
                  icon={<IOSSquircleIcon color="#34C759" gradientTo="#00C7BE"><FileDown size={16} /></IOSSquircleIcon>}
                  title={t.exportBackupBtn || 'خروجی پشتیبان (JSON)'}
                  subtitle={t.exportBackupDesc}
                  showChevron
                  isRtl={isRTL}
                />
                <IOSRow
                  theme={theme}
                  isLast
                  icon={<IOSSquircleIcon color="#007AFF" gradientTo="#5856D6"><FileUp size={16} /></IOSSquircleIcon>}
                  title={t.importBackupBtn || 'بازیابی از فایل پشتیبان'}
                  subtitle={t.importBackupDesc}
                  trailing={
                    <label
                      style={{
                        padding: '7px 13px',
                        borderRadius: '999px',
                        backgroundColor: theme.colors.background,
                        border: `1px solid ${theme.colors.border}`,
                        color: theme.colors.primary,
                        fontSize: '0.7813rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      JSON
                      <input type="file" accept="application/json,.json" onChange={handleImportBackup} style={{ display: 'none' }} />
                    </label>
                  }
                />
              </IOSGroupedSection>
            </div>
          </motion.div>
        ) : subPage === 'shortcuts' ? (
          <motion.div
            key="settings-sub-shortcuts"
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1,
              padding: 'clamp(14px, 3vw, 32px)',
              paddingBottom: '140px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: '100%', maxWidth: '820px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => setSubPage('main')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    padding: '6px 4px',
                    color: theme.colors.primary,
                    cursor: 'pointer',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                  }}
                >
                  {isRTL ? <ArrowRight size={19} /> : <ArrowLeft size={19} />}
                  <span>{t.settings || 'تنظیمات'}</span>
                </button>
                <h1 style={{ fontSize: 'clamp(1.1875rem, 2.5vw, 1.5rem)', fontWeight: 800, margin: 0, color: theme.colors.textPrimary }}>
                  {t.shortcutsPageTitle || 'میانبرهای کیبورد'}
                </h1>
                <div style={{ width: '72px' }} />
              </div>

              <IOSGroupedSection header={t.shortcutsPlaybackSection || 'کنترل پخش و صدا'} theme={theme}>
                <IOSRow theme={theme} title={t.shortcutPlayPause || 'پخش / توقف'} trailing={<KbdBadge theme={theme}>Space / K</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutPrevNext || 'آهنگ قبلی / بعدی'} trailing={<KbdBadge theme={theme}>Ctrl + ← / →</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutSeek || 'جلو / عقب رفتن'} trailing={<KbdBadge theme={theme}>← / →</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutSeekFast || 'پرش سریع ۳ برابری'} trailing={<KbdBadge theme={theme}>Shift + ← / →</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutVolume || 'افزایش / کاهش صدا'} trailing={<KbdBadge theme={theme}>+ / - · Ctrl + ↑ / ↓</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutMute || 'قطع / وصل صدا'} trailing={<KbdBadge theme={theme}>M</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutShuffle || 'روشن / خاموش کردن شافل'} trailing={<KbdBadge theme={theme}>S</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutRepeat || 'تغییر حالت تکرار'} trailing={<KbdBadge theme={theme}>R</KbdBadge>} />
                <IOSRow theme={theme} isLast title={t.shortcutFavorite || 'افزودن / حذف از محبوب‌ها'} trailing={<KbdBadge theme={theme}>L</KbdBadge>} />
              </IOSGroupedSection>

              <IOSGroupedSection header={t.shortcutsNavSection || 'ناوبری و پنجره‌ها'} theme={theme}>
                <IOSRow theme={theme} title={t.shortcutQueue || 'باز / بسته کردن صف پخش'} trailing={<KbdBadge theme={theme}>Q</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutFullscreen || 'پخش‌کننده تمام‌صفحه'} trailing={<KbdBadge theme={theme}>F</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutSearch || 'باز کردن جستجوی هوشمند'} trailing={<KbdBadge theme={theme}>Ctrl + K / F / /</KbdBadge>} />
                <IOSRow theme={theme} title={t.shortcutSettings || 'باز کردن تنظیمات'} trailing={<KbdBadge theme={theme}>Ctrl + ,</KbdBadge>} />
                <IOSRow theme={theme} isLast title={t.shortcutTabs || 'جابه‌جایی مستقیم بین تب‌ها'} trailing={<KbdBadge theme={theme}>Alt + 1..6</KbdBadge>} />
              </IOSGroupedSection>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="settings-main"
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1,
              width: '100%',
              padding: 'clamp(14px, 3vw, 32px)',
              paddingBottom: '140px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ width: '100%', maxWidth: '820px' }}>
              <h1
                style={{
                  fontSize: 'clamp(1.625rem, 3.2vw, 2.125rem)',
                  fontWeight: 800,
                  marginBottom: '20px',
                  marginTop: 0,
                  color: theme.colors.textPrimary,
                  letterSpacing: '-0.025em',
                }}
              >
                {t.settings}
              </h1>

              {feedbackBanner && (
                <div
                  style={{
                    marginBottom: '18px',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    backgroundColor: `${theme.colors.primary}20`,
                    border: `1px solid ${theme.colors.primary}55`,
                    color: theme.colors.textPrimary,
                    fontSize: '0.8438rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={17} color={theme.colors.primary} />
                  <span>{feedbackBanner}</span>
                </div>
              )}

              {/* بخش ۱: ظاهر، صدا و زبان */}
              <IOSGroupedSection theme={theme}>
                <IOSRow
                  theme={theme}
                  icon={
                    <IOSSquircleIcon color="#007AFF" gradientTo="#5856D6">
                      <Globe size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.language}
                  trailing={
                    <IOSSegmentedControl<'fa' | 'en'>
                      groupId="settings-language"
                      compact
                      theme={theme}
                      value={language as 'fa' | 'en'}
                      onChange={(lang) => setLanguage(lang)}
                      options={[
                        { value: 'fa', label: 'فارسی' },
                        { value: 'en', label: 'English' },
                      ]}
                    />
                  }
                />

                <IOSRow
                  theme={theme}
                  onClick={() => setSubPage('display')}
                  showChevron
                  isRtl={isRTL}
                  icon={
                    <IOSSquircleIcon color="#5856D6" gradientTo="#AF52DE">
                      <Monitor size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.displayMenuTitle || 'ظاهر و نمایش (Display)'}
                  subtitle={displaySubtitleText}
                />

                <IOSRow
                  theme={theme}
                  isLast
                  onClick={() => setSubPage('sound')}
                  showChevron
                  isRtl={isRTL}
                  icon={
                    <IOSSquircleIcon color="#FF2D55" gradientTo="#FF375F">
                      <Volume2 size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.soundMenuTitle || 'صدا و افکت‌های صوتی'}
                  subtitle={soundSummaryText}
                  valueText={equalizerSettings.enabled ? 'EQ' : undefined}
                />
              </IOSGroupedSection>

              {/* بخش ۲: پخش، تایمر و رفتار هوشمند */}
              <IOSGroupedSection header={t.playbackBehaviorSection || 'پخش و رفتار هوشمند'} theme={theme}>
                <IOSRow
                  theme={theme}
                  icon={
                    <IOSSquircleIcon color="#5E5CE6" gradientTo="#32ADE6">
                      <Timer size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.sleepTimer || 'تایمر خواب'}
                  subtitle={t.sleepTimerDesc}
                  valueText={sleepStatusLabel}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'off', label: t.sleepTimerOff || 'خاموش' },
                      { id: '5', mins: 5, label: `5 ${t.sleepMinutes || 'دقیقه'}` },
                      { id: '10', mins: 10, label: `10 ${t.sleepMinutes || 'دقیقه'}` },
                      { id: '15', mins: 15, label: `15 ${t.sleepMinutes || 'دقیقه'}` },
                      { id: '30', mins: 30, label: `30 ${t.sleepMinutes || 'دقیقه'}` },
                      { id: '45', mins: 45, label: `45 ${t.sleepMinutes || 'دقیقه'}` },
                      { id: '60', mins: 60, label: `60 ${t.sleepMinutes || 'دقیقه'}` },
                      { id: 'songEnd', label: t.endOfSong || 'پایان آهنگ فعلی' },
                    ].map((opt) => {
                      const isActive =
                        opt.id === 'off'
                          ? sleepTimer.mode === 'off'
                          : opt.id === 'songEnd'
                          ? sleepTimer.mode === 'songEnd'
                          : sleepTimer.mode === 'until' && sleepTimer.durationMinutes === opt.mins;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (!onSetSleepTimer) return;
                            if (opt.id === 'off') {
                              onSetSleepTimer({ mode: 'off' });
                            } else if (opt.id === 'songEnd') {
                              onSetSleepTimer({ mode: 'songEnd' });
                            } else if (opt.mins) {
                              onSetSleepTimer({
                                mode: 'until',
                                endsAt: Date.now() + opt.mins * 60 * 1000,
                                durationMinutes: opt.mins,
                              });
                            }
                          }}
                          style={{
                            padding: '6px 11px',
                            borderRadius: '999px',
                            border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
                            backgroundColor: isActive ? `${theme.colors.primary}22` : theme.colors.background,
                            color: isActive ? theme.colors.primary : theme.colors.textPrimary,
                            fontSize: '0.7813rem',
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </IOSRow>

                <IOSRow
                  theme={theme}
                  icon={
                    <IOSSquircleIcon color="#FF9500" gradientTo="#FFCC00">
                      <SkipForward size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.seekStepLabel || 'گام جلو و عقب'}
                  subtitle={t.seekStepDesc}
                  trailing={
                    <IOSSegmentedControl<SeekStepSeconds>
                      groupId="settings-seek-step"
                      compact
                      theme={theme}
                      value={playbackPrefs.seekStepSeconds}
                      onChange={(val) => updatePref('seekStepSeconds', val)}
                      options={[
                        { value: 5, label: `5${t.secondsShort || 's'}` },
                        { value: 10, label: `10${t.secondsShort || 's'}` },
                        { value: 15, label: `15${t.secondsShort || 's'}` },
                      ]}
                    />
                  }
                />

                <IOSRow
                  theme={theme}
                  icon={
                    <IOSSquircleIcon color="#34C759" gradientTo="#30D158">
                      <Play size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.autoPlayOnImportLabel || 'پخش خودکار پس از افزودن'}
                  subtitle={t.autoPlayOnImportDesc}
                  trailing={
                    <IOSSwitch
                      checked={playbackPrefs.autoPlayOnImport}
                      onChange={(v) => updatePref('autoPlayOnImport', v)}
                      theme={theme}
                      ariaLabel={t.autoPlayOnImportLabel || 'Auto-Play on Import'}
                    />
                  }
                />

                <IOSRow
                  theme={theme}
                  icon={
                    <IOSSquircleIcon color="#007AFF" gradientTo="#30B0C7">
                      <Bookmark size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.rememberPlaybackLabel || 'ذخیره آخرین موقعیت پخش'}
                  subtitle={t.rememberPlaybackDesc}
                  trailing={
                    <IOSSwitch
                      checked={playbackPrefs.rememberPlaybackPosition}
                      onChange={(v) => updatePref('rememberPlaybackPosition', v)}
                      theme={theme}
                      ariaLabel={t.rememberPlaybackLabel || 'Remember Playback Position'}
                    />
                  }
                />

                <IOSRow
                  theme={theme}
                  icon={
                    <IOSSquircleIcon color="#32ADE6" gradientTo="#007AFF">
                      <CopyCheck size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.skipDuplicatesLabel || 'جلوگیری از آهنگ‌های تکراری'}
                  subtitle={t.skipDuplicatesDesc}
                  trailing={
                    <IOSSwitch
                      checked={playbackPrefs.skipDuplicatesOnImport}
                      onChange={(v) => updatePref('skipDuplicatesOnImport', v)}
                      theme={theme}
                      ariaLabel={t.skipDuplicatesLabel || 'Skip Duplicates'}
                    />
                  }
                />

                <IOSRow
                  theme={theme}
                  isLast
                  icon={
                    <IOSSquircleIcon color="#FF3B30" gradientTo="#FF9500">
                      <ShieldAlert size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.confirmBeforeDeleteLabel || 'تاییدیه پیش از حذف'}
                  subtitle={t.confirmBeforeDeleteDesc}
                  trailing={
                    <IOSSwitch
                      checked={playbackPrefs.confirmBeforeDelete}
                      onChange={(v) => updatePref('confirmBeforeDelete', v)}
                      theme={theme}
                      ariaLabel={t.confirmBeforeDeleteLabel || 'Confirm Before Delete'}
                    />
                  }
                />
              </IOSGroupedSection>

              {/* بخش ۳: کتابخانه، ذخیره‌سازی و راهنما */}
              <IOSGroupedSection theme={theme}>
                <IOSRow
                  theme={theme}
                  onClick={() => setSubPage('library')}
                  showChevron
                  isRtl={isRTL}
                  icon={
                    <IOSSquircleIcon color="#0A84FF" gradientTo="#30B0C7">
                      <HardDrive size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.libraryStorageTitle || 'کتابخانه، حافظه و پشتیبان‌گیری'}
                  subtitle={t.libraryStorageSubtitle}
                  valueText={`${songs.length} ${t.songs || 'آهنگ'}`}
                />

                <IOSRow
                  theme={theme}
                  isLast
                  onClick={() => setSubPage('shortcuts')}
                  showChevron
                  isRtl={isRTL}
                  icon={
                    <IOSSquircleIcon color="#636366" gradientTo="#48484A">
                      <Keyboard size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.shortcutsMenuTitle || 'میانبرهای کیبورد'}
                  subtitle={t.shortcutsMenuSubtitle}
                />
              </IOSGroupedSection>

              {/* بخش ۴: ارتباط با من (تلگرام و گیت‌هاب) */}
              <IOSGroupedSection
                header={t.contactSectionTitle || 'ارتباط با من'}
                footer={
                  t.contactSectionFooter ||
                  'توسعه‌یافته توسط @Valuedb — برای ارتباط مستقیم یا مشاهده سورس، روی لینک‌ها بزنید.'
                }
                theme={theme}
              >
                <div
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    borderBottom: `1px solid ${
                      theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(60, 60, 67, 0.12)'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: `linear-gradient(135deg, ${theme.colors.primary}, ${
                          theme.colors.accent || '#5E5CE6'
                        })`,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 6px 16px ${theme.colors.primary}44`,
                      }}
                    >
                      <Code2 size={19} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        dir="ltr"
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 800,
                          color: theme.colors.textPrimary,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        @Valuedb
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: theme.colors.textSecondary,
                          marginTop: '1px',
                        }}
                      >
                        {t.contactCreatorRole || 'طراح و توسعه‌دهنده'}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '999px',
                      backgroundColor: `${theme.colors.primary}18`,
                      color: theme.colors.primary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Web Audio · React
                  </span>
                </div>

                {/* لینک تلگرام */}
                <a
                  href="https://t.me/Valuedb"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '13px 16px',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.isDark
                      ? 'rgba(255, 255, 255, 0.045)'
                      : 'rgba(0, 0, 0, 0.025)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <IOSSquircleIcon color="#2AABEE" gradientTo="#229ED9">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                      </svg>
                    </IOSSquircleIcon>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.9063rem',
                          fontWeight: 600,
                          color: theme.colors.textPrimary,
                        }}
                      >
                        {t.telegramLabel || 'تلگرام'}
                      </div>
                      <div
                        dir="ltr"
                        style={{
                          fontSize: '0.75rem',
                          color: theme.colors.textSecondary,
                          marginTop: '1px',
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        t.me/Valuedb
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopyContact('telegram', 'https://t.me/Valuedb');
                      }}
                      title="@Valuedb"
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '9px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(60,60,67,0.06)',
                        color:
                          copiedContact === 'telegram'
                            ? '#34C759'
                            : theme.colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedContact === 'telegram' ? <Check size={14} /> : <Copy size={13} />}
                    </button>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(42, 171, 238, 0.14)',
                        color: '#2AABEE',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>{t.openLinkLabel || 'مشاهده'}</span>
                      <ArrowUpRight size={13} />
                    </span>
                  </div>
                </a>

                <div
                  style={{
                    height: '1px',
                    backgroundColor: theme.isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(60, 60, 67, 0.12)',
                    marginInlineStart: '58px',
                  }}
                />

                {/* لینک گیت‌هاب */}
                <a
                  href="https://github.com/Valuedb"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '13px 16px',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.isDark
                      ? 'rgba(255, 255, 255, 0.045)'
                      : 'rgba(0, 0, 0, 0.025)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <IOSSquircleIcon color="#24292F" gradientTo="#0D1117">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                    </IOSSquircleIcon>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.9063rem',
                          fontWeight: 600,
                          color: theme.colors.textPrimary,
                        }}
                      >
                        {t.githubLabel || 'گیت‌هاب'}
                      </div>
                      <div
                        dir="ltr"
                        style={{
                          fontSize: '0.75rem',
                          color: theme.colors.textSecondary,
                          marginTop: '1px',
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        github.com/Valuedb
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopyContact('github', 'https://github.com/Valuedb');
                      }}
                      title="github.com/Valuedb"
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '9px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(60,60,67,0.06)',
                        color:
                          copiedContact === 'github'
                            ? '#34C759'
                            : theme.colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedContact === 'github' ? <Check size={14} /> : <Copy size={13} />}
                    </button>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        borderRadius: '999px',
                        backgroundColor: theme.isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(36, 41, 47, 0.1)',
                        color: theme.colors.textPrimary,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>{t.openLinkLabel || 'مشاهده'}</span>
                      <ArrowUpRight size={13} />
                    </span>
                  </div>
                </a>
              </IOSGroupedSection>

              {/* بخش ۵: درباره موتور و بازنشانی */}
              <IOSGroupedSection header={t.aboutSectionTitle || 'برنامه و بازنشانی'} theme={theme}>
                <IOSRow
                  theme={theme}
                  icon={
                    <IOSSquircleIcon color="#8E8E93" gradientTo="#636366">
                      <Info size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.appEngineLabel || 'موتور صدا'}
                  valueText="Web Audio DSP 48kHz"
                />

                <IOSRow
                  theme={theme}
                  isLast
                  destructive
                  onClick={() => setConfirmAction('resetAll')}
                  icon={
                    <IOSSquircleIcon color="#FF3B30" gradientTo="#FF453A">
                      <RotateCcw size={16} />
                    </IOSSquircleIcon>
                  }
                  title={t.resetAllSettingsBtn || 'بازگردانی تمام تنظیمات به پیش‌فرض'}
                  subtitle={t.resetAllSettingsDesc}
                />
              </IOSGroupedSection>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <IOSConfirmDialog
        isOpen={confirmAction !== null}
        title={
          confirmAction === 'resetAll'
            ? t.resetAllConfirmTitle || 'بازگردانی تمام تنظیمات؟'
            : t.resetPlayStatsBtn || 'صفر کردن آمار پخش'
        }
        message={
          confirmAction === 'resetAll'
            ? t.resetAllConfirmMsg
            : t.resetPlayStatsConfirm
        }
        confirmLabel={confirmAction === 'resetAll' ? t.resetAllSettingsBtn || 'بازنشانی' : t.save || 'تایید'}
        cancelLabel={t.cancel || 'لغو'}
        destructive
        theme={theme}
        isRtl={isRTL}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmExecute}
      />
    </div>
  );
};