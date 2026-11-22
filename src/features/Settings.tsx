import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  DesktopFolderScanResult,
  DisplaySettings as DisplaySettingsType,
  EqualizerSettings,
  LinkedFolder,
  PlaybackPreferences,
  Playlist,
  SeekStepSeconds,
  SleepTimerState,
  Song,
  SoundSettings as SoundSettingsType,
  StartupTab,
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
  FileDown,
  FileUp,
  RotateCcw,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Upload,
  Database,
  Folder,
  FolderOpen,
  RefreshCw,
  Unlink,
  Compass,
  Home,
  ListMusic,
  Mic,
  Disc,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_DISPLAY_SETTINGS, type PaletteType, type ThemeMode } from '../theme';
import { SoundSettings } from './SoundSettings';
import { DisplaySettings } from './DisplaySettings';
import { DEFAULT_EQ_SETTINGS, DEFAULT_SOUND_SETTINGS } from '../player/audioEffects';
import { DEFAULT_PLAYBACK_PREFERENCES } from '../player/constants';
import {
  extractSongsBatched,
  findDuplicateSongIds,
  partitionDuplicateSongs,
} from '../utils/audioMetadata';
import {
  extractDiskSongsBatched,
  isDesktopRuntime,
  normalizeDiskPath,
  syncDesktopFolderResult,
} from '../utils/desktopBridge';
import {
  cleanupOrphanAudioBlobs,
  deleteAudioBlob,
  getAudioStorageStats,
  type AudioStorageStats,
} from '../storage/mediaStore';
import { getLocalDbStats, type LocalDbStats } from '../storage/kvDatabase';
import { isDisplaySettings, isEqualizerSettings, isPlaybackPreferences, isPlaylistList, isSongList, isSoundSettings } from '../types/guards';
import {
  ConfirmDialog,
  SettingsSection,
  SettingsRow,
  SettingsSegmentedControl,
  SettingsIconBadge,
  SettingsSwitch,
} from '../components/SettingsPrimitives';
import { AppLogo } from '../components/AppLogo';

interface SettingsProps {
  songs: Song[];
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  playlists?: Playlist[];
  setPlaylists?: React.Dispatch<React.SetStateAction<Playlist[]>>;
  customFolders?: string[];
  setCustomFolders?: React.Dispatch<React.SetStateAction<string[]>>;
  linkedFolders?: LinkedFolder[];
  setLinkedFolders?: React.Dispatch<React.SetStateAction<LinkedFolder[]>>;
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
  onSyncDesktopFolderScan?: (
    scan: DesktopFolderScanResult,
    options?: { allowAutoPlay?: boolean }
  ) => Promise<{ addedCount: number; removedCount: number; firstAdded?: Song }>;
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
  linkedFolders = [],
  setLinkedFolders,
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
  onSyncDesktopFolderScan,
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
  const [defaultMusicFolder, setDefaultMusicFolder] = useState<{ path: string; name: string } | null>(null);
  const [copiedContactKey, setCopiedContactKey] = useState<'telegram' | 'github' | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyContactLink = useCallback((key: 'telegram' | 'github', url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedContactKey(key);
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedContactKey(null);
      copyTimerRef.current = null;
    }, 1800);
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const isRTL = language === 'fa';

  const resetScrollToTop = useCallback(() => {
    let node: HTMLElement | null = rootRef.current?.parentElement ?? null;
    while (node) {
      const style = window.getComputedStyle(node);
      if (
        (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        node.scrollTop > 0
      ) {
        node.scrollTop = 0;
      }
      node = node.parentElement;
    }
    if (rootRef.current) {
      rootRef.current.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    resetScrollToTop();
    const rafId = requestAnimationFrame(resetScrollToTop);
    return () => cancelAnimationFrame(rafId);
  }, [subPage, initialSubPage?.token, resetScrollToTop]);

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
      if (isDesktopRuntime() && window.desktopRuntime?.getDefaultMusicFolder) {
        window.desktopRuntime
          .getDefaultMusicFolder()
          .then((info) => setDefaultMusicFolder(info))
          .catch(() => {});
      }
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

  const isDesktopApp = isDesktopRuntime();
  const directLinkedCount = songs.filter((s) => Boolean(s.sourcePath)).length;

  const commitImportedSongs = (imported: Song[]) => {
    if (imported.length === 0) return;
    let toAdd = imported;
    let skippedCount = 0;
    if (playbackPrefs.skipDuplicatesOnImport) {
      const partitioned = partitionDuplicateSongs(imported, songs);
      toAdd = partitioned.unique;
      skippedCount = partitioned.duplicates.length;
      partitioned.duplicates.forEach((dup) => {
        if (dup.fileUrl?.startsWith('blob:')) URL.revokeObjectURL(dup.fileUrl);
        if (!dup.sourcePath) {
          deleteAudioBlob(dup.id).catch(() => {});
        }
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
  };

  const handleDesktopPickFiles = async () => {
    const api = window.desktopRuntime;
    if (!api?.pickAudioFiles) return;
    setIsLoading(true);
    try {
      const picked = await api.pickAudioFiles();
      if (!picked || picked.length === 0) return;
      const existingPaths = new Set(
        songs.map((s) => (s.sourcePath ? normalizeDiskPath(s.sourcePath) : '')).filter(Boolean)
      );
      const freshFiles = picked.filter((f) => !existingPaths.has(normalizeDiskPath(f.path)));
      if (freshFiles.length === 0) {
        showNotice(`0 ${t.importCompleteMsg || 'فایل صوتی اضافه شد.'}`);
        return;
      }
      const imported = await extractDiskSongsBatched(freshFiles);
      commitImportedSongs(imported);
    } finally {
      setIsLoading(false);
    }
  };

  const linkAndSyncFolderScan = async (scan: DesktopFolderScanResult) => {
    const folderRecord: LinkedFolder = {
      id: scan.folderPath,
      path: scan.folderPath,
      name: scan.folderName,
      addedAt: Date.now(),
      lastSyncedAt: Date.now(),
      fileCount: scan.files.length,
    };
    setLinkedFolders?.((prev) => [
      ...prev.filter(
        (item) => normalizeDiskPath(item.path) !== normalizeDiskPath(folderRecord.path)
      ),
      folderRecord,
    ]);

    if (onSyncDesktopFolderScan) {
      const outcome = await onSyncDesktopFolderScan(scan, { allowAutoPlay: true });
      showNotice(`${outcome.addedCount} ${t.importCompleteMsg || 'فایل صوتی اضافه شد.'}`);
      refreshStorageStats();
      return;
    }

    const { newSongs } = await syncDesktopFolderResult(scan, songs);
    commitImportedSongs(newSongs);
  };

  const handleDesktopLinkFolder = async () => {
    const api = window.desktopRuntime;
    if (!api?.pickMusicFolder) return;
    setIsLoading(true);
    try {
      const scan = await api.pickMusicFolder();
      if (!scan) return;
      await linkAndSyncFolderScan(scan);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkDefaultMusicFolder = async () => {
    const api = window.desktopRuntime;
    if (!api?.scanFolder || !defaultMusicFolder) return;
    setIsLoading(true);
    try {
      const scan = await api.scanFolder(defaultMusicFolder.path);
      if (!scan) return;
      await linkAndSyncFolderScan(scan);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncSingleFolder = async (folder: LinkedFolder) => {
    const api = window.desktopRuntime;
    if (!api?.scanFolder) return;
    setIsLoading(true);
    try {
      const scan = await api.scanFolder(folder.path);
      if (!scan) {
        if (onSyncDesktopFolderScan) {
          await onSyncDesktopFolderScan({
            folderPath: folder.path,
            folderName: folder.name,
            files: [],
            missing: true,
          });
        }
        showNotice(t.fileMissingMsg || 'پوشه در مسیر قبلی پیدا نشد.');
        return;
      }

      if (onSyncDesktopFolderScan) {
        const outcome = await onSyncDesktopFolderScan(scan, { allowAutoPlay: false });
        if (outcome.addedCount > 0) {
          showNotice(`${outcome.addedCount} ${t.importCompleteMsg || 'فایل صوتی اضافه شد.'}`);
        } else {
          showNotice(t.linkedFolderSyncedMsg || 'همگام‌سازی پوشه‌ها انجام شد.');
        }
        refreshStorageStats();
        return;
      }

      const { newSongs, linkedFolder } = await syncDesktopFolderResult(scan, songs, folder.name);
      setLinkedFolders?.((prev) =>
        prev.map((item) =>
          normalizeDiskPath(item.path) === normalizeDiskPath(folder.path)
            ? { ...item, lastSyncedAt: linkedFolder.lastSyncedAt, fileCount: linkedFolder.fileCount }
            : item
        )
      );
      if (newSongs.length > 0) {
        commitImportedSongs(newSongs);
      } else {
        showNotice(t.linkedFolderSyncedMsg || 'همگام‌سازی پوشه‌ها انجام شد.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAllFolders = async () => {
    const api = window.desktopRuntime;
    if (!api?.scanFolder || linkedFolders.length === 0) return;
    setIsLoading(true);
    try {
      if (onSyncDesktopFolderScan) {
        let totalAdded = 0;
        for (const folder of linkedFolders) {
          const scan = await api.scanFolder(folder.path);
          const outcome = await onSyncDesktopFolderScan(
            scan ?? {
              folderPath: folder.path,
              folderName: folder.name,
              files: [],
              missing: true,
            },
            { allowAutoPlay: false }
          );
          totalAdded += outcome.addedCount;
        }
        if (totalAdded > 0) {
          showNotice(`${totalAdded} ${t.importCompleteMsg || 'فایل صوتی اضافه شد.'}`);
        } else {
          showNotice(t.linkedFolderSyncedMsg || 'همگام‌سازی پوشه‌ها انجام شد.');
        }
        refreshStorageStats();
        return;
      }

      let runningSongs = songs;
      const allAdded: Song[] = [];
      const countsByPath = new Map<string, number>();

      for (const folder of linkedFolders) {
        const scan = await api.scanFolder(folder.path);
        if (!scan) continue;
        const { newSongs } = await syncDesktopFolderResult(scan, runningSongs, folder.name);
        countsByPath.set(folder.path, scan.files.length);
        if (newSongs.length > 0) {
          allAdded.push(...newSongs);
          runningSongs = [...runningSongs, ...newSongs];
        }
      }

      const syncedAt = Date.now();
      setLinkedFolders?.((prev) =>
        prev.map((item) => ({
          ...item,
          lastSyncedAt: syncedAt,
          fileCount: countsByPath.get(item.path) ?? item.fileCount,
        }))
      );

      if (allAdded.length > 0) {
        commitImportedSongs(allAdded);
      } else {
        showNotice(t.linkedFolderSyncedMsg || 'همگام‌سازی پوشه‌ها انجام شد.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkFolder = (folderPath: string) => {
    const key = normalizeDiskPath(folderPath);
    setLinkedFolders?.((prev) => prev.filter((item) => normalizeDiskPath(item.path) !== key));
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
    a.download = `prism-music-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
      setLinkedFolders?.([]);
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

  const defaultTabOptions: { id: StartupTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: t.home || 'خانه', icon: <Home size={13} /> },
    { id: 'allSongs', label: t.allSongs || 'همه آهنگ‌ها', icon: <Music size={13} /> },
    { id: 'playlists', label: t.playlists || 'پلی‌لیست‌ها', icon: <ListMusic size={13} /> },
    { id: 'artists', label: t.artists || 'خواننده‌ها', icon: <Mic size={13} /> },
    { id: 'albums', label: t.albums || 'آلبوم‌ها', icon: <Disc size={13} /> },
    { id: 'folders', label: t.folders || 'پوشه‌بندی', icon: <Folder size={13} /> },
  ];
  const activeDefaultTab: StartupTab = playbackPrefs.defaultTab ?? 'home';
  const activeDefaultTabLabel =
    defaultTabOptions.find((o) => o.id === activeDefaultTab)?.label || (t.home || 'خانه');

  return (
    <div ref={rootRef} style={{ width: '100%', overflowX: 'clip' }}>
      <AnimatePresence mode="wait" initial={false} onExitComplete={resetScrollToTop}>
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

              <SettingsSection header={t.libraryOverviewSection || 'وضعیت کلی کتابخانه'} theme={theme}>
                <SettingsRow
                  theme={theme}
                  icon={<SettingsIconBadge color="#FF2D55" gradientTo="#FF375F"><Music size={16} /></SettingsIconBadge>}
                  title={t.totalLibraryTracks || 'کل آهنگ‌های کتابخانه'}
                  valueText={`${songs.length}`}
                />
                <SettingsRow
                  theme={theme}
                  icon={<SettingsIconBadge color="#34C759" gradientTo="#30D158"><Folder size={16} /></SettingsIconBadge>}
                  title={t.directLinkedTracks || 'آهنگ‌های متصل مستقیم به هارد (بدون کپی)'}
                  valueText={`${directLinkedCount}`}
                />
                <SettingsRow
                  theme={theme}
                  icon={<SettingsIconBadge color="#007AFF" gradientTo="#5AC8FA"><HardDrive size={16} /></SettingsIconBadge>}
                  title={t.offlineStoredAudio || 'فایل‌های کپی‌شده در حافظه داخلی'}
                  valueText={`${storageStats.count} (${formatBytes(storageStats.totalBytes)})`}
                />
                <SettingsRow
                  theme={theme}
                  icon={<SettingsIconBadge color="#34C759" gradientTo="#30D158"><Database size={16} /></SettingsIconBadge>}
                  title={t.localDbRecords || 'رکوردهای دیتابیس محلی (IndexedDB)'}
                  valueText={localDbStats.supported ? `${localDbStats.recordCount}` : '—'}
                  isLast={quotaUsed === null}
                />
                {quotaUsed !== null && (
                  <SettingsRow
                    theme={theme}
                    isLast
                    icon={<SettingsIconBadge color="#5856D6" gradientTo="#AF52DE"><HardDrive size={16} /></SettingsIconBadge>}
                    title={t.browserQuotaUsed || 'فضای اشغال‌شده'}
                    valueText={formatBytes(quotaUsed)}
                  />
                )}
              </SettingsSection>

              {(isDesktopApp || linkedFolders.length > 0) && (
                <SettingsSection header={t.linkedFoldersSection || 'پوشه‌های متصل موسیقی (پایش لحظه‌ای و بدون کپی)'} theme={theme}>
                  {isDesktopApp && (
                    <SettingsRow
                      theme={theme}
                      isLast={linkedFolders.length === 0}
                      icon={<SettingsIconBadge color="#0A84FF" gradientTo="#5AC8FA"><FolderUp size={16} /></SettingsIconBadge>}
                      title={t.linkFolderBtn || 'اتصال پوشه جدید'}
                      subtitle={
                        linkedFolders.length === 0
                          ? (t.linkedFoldersEmpty || '')
                          : (t.liveWatchActiveDesc || '')
                      }
                      trailing={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {defaultMusicFolder &&
                            !linkedFolders.some(
                              (f) => normalizeDiskPath(f.path) === normalizeDiskPath(defaultMusicFolder.path)
                            ) && (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={handleLinkDefaultMusicFolder}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '7px 12px',
                                  borderRadius: '999px',
                                  backgroundColor: theme.colors.background,
                                  border: `1px solid ${theme.colors.border}`,
                                  color: theme.colors.primary,
                                  fontSize: '0.7813rem',
                                  fontWeight: 600,
                                  cursor: isLoading ? 'not-allowed' : 'pointer',
                                  opacity: isLoading ? 0.6 : 1,
                                }}
                              >
                                <Music size={13} />
                                <span>{t.linkSystemMusicBtn || 'اتصال پوشه Music سیستم'}</span>
                              </button>
                            )}
                          {linkedFolders.length > 0 && (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={handleSyncAllFolders}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '7px 12px',
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
                              <RefreshCw size={13} />
                              <span>{t.syncFoldersBtn || 'همگام‌سازی پوشه‌ها'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={handleDesktopLinkFolder}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '999px',
                              border: 'none',
                              backgroundColor: theme.colors.primary,
                              color: theme.colors.onPrimary || '#fff',
                              fontSize: '0.7813rem',
                              fontWeight: 700,
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              opacity: isLoading ? 0.6 : 1,
                            }}
                          >
                            {t.linkFolderBtn || 'اتصال پوشه جدید'}
                          </button>
                        </div>
                      }
                    />
                  )}
                  {linkedFolders.map((folder, idx) => (
                    <SettingsRow
                      key={folder.id}
                      theme={theme}
                      isLast={idx === linkedFolders.length - 1}
                      icon={<SettingsIconBadge color="#30B0C7" gradientTo="#34C759"><Folder size={16} /></SettingsIconBadge>}
                      title={folder.name}
                      subtitle={
                        <span dir="ltr" style={{ display: 'inline-block', unicodeBidi: 'plaintext' }}>
                          {folder.path}
                          {typeof folder.fileCount === 'number'
                            ? ` · ${folder.fileCount} ${t.tracksUnit || 'آهنگ'}`
                            : ''}
                        </span>
                      }
                      trailing={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isDesktopApp && window.desktopRuntime?.openFolder && (
                            <button
                              type="button"
                              onClick={() => void window.desktopRuntime?.openFolder?.(folder.path)}
                              title={t.openFolderTooltip || 'باز کردن پوشه'}
                              aria-label={t.openFolderTooltip || 'باز کردن پوشه'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: theme.colors.background,
                                border: `1px solid ${theme.colors.border}`,
                                color: theme.colors.textSecondary,
                                cursor: 'pointer',
                              }}
                            >
                              <FolderOpen size={14} />
                            </button>
                          )}
                          {isDesktopApp && (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleSyncSingleFolder(folder)}
                              title={t.syncFolderOneBtn || 'همگام‌سازی'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: theme.colors.background,
                                border: `1px solid ${theme.colors.border}`,
                                color: theme.colors.primary,
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUnlinkFolder(folder.path)}
                            title={t.unlinkFolderBtn || 'قطع اتصال'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              backgroundColor: theme.colors.background,
                              border: `1px solid ${theme.colors.border}`,
                              color: '#ff453a',
                              cursor: 'pointer',
                            }}
                          >
                            <Unlink size={14} />
                          </button>
                        </div>
                      }
                    />
                  ))}
                </SettingsSection>
              )}

              <SettingsSection header={t.importSectionTitle || 'افزودن موسیقی'} theme={theme}>
                <SettingsRow
                  theme={theme}
                  icon={<SettingsIconBadge color="#34C759" gradientTo="#30D158"><Upload size={16} /></SettingsIconBadge>}
                  title={t.selectFiles || 'انتخاب فایل‌های موسیقی'}
                  subtitle={isDesktopApp ? (t.directDiskBadge || 'اتصال مستقیم هارد') : undefined}
                  trailing={
                    isDesktopApp ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={handleDesktopPickFiles}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '999px',
                          border: 'none',
                          backgroundColor: theme.colors.primary,
                          color: theme.colors.onPrimary || '#fff',
                          fontSize: '0.7813rem',
                          fontWeight: 700,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          opacity: isLoading ? 0.6 : 1,
                        }}
                      >
                        {isLoading ? t.loading : t.add || 'افزودن'}
                      </button>
                    ) : (
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
                    )
                  }
                />
                <SettingsRow
                  theme={theme}
                  isLast
                  icon={<SettingsIconBadge color="#30B0C7" gradientTo="#0A84FF"><FolderUp size={16} /></SettingsIconBadge>}
                  title={t.importFolderBtn || 'انتخاب پوشه کامل'}
                  subtitle={isDesktopApp ? (t.directDiskBadge || 'اتصال مستقیم هارد') : undefined}
                  trailing={
                    isDesktopApp ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={handleDesktopLinkFolder}
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
                      </button>
                    ) : (
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
                    )
                  }
                />
              </SettingsSection>

              <SettingsSection header={t.maintenanceSection || 'بهینه‌سازی و پاک‌سازی'} theme={theme}>
                <SettingsRow
                  theme={theme}
                  onClick={handleRemoveDuplicates}
                  icon={<SettingsIconBadge color="#FF9500" gradientTo="#FFCC00"><CopyCheck size={16} /></SettingsIconBadge>}
                  title={t.removeDuplicatesBtn || 'پاک‌سازی آهنگ‌های تکراری'}
                  subtitle={t.removeDuplicatesDesc}
                  valueText={duplicateCount > 0 ? `${duplicateCount}` : '0'}
                  showChevron
                  isRtl={isRTL}
                />
                <SettingsRow
                  theme={theme}
                  onClick={handleCleanOrphanBlobs}
                  icon={<SettingsIconBadge color="#5AC8FA" gradientTo="#007AFF"><Trash2 size={16} /></SettingsIconBadge>}
                  title={t.cleanOrphanBlobsBtn || 'پاک‌سازی فایل‌های رهاشده حافظه'}
                  subtitle={t.cleanOrphanBlobsDesc}
                  showChevron
                  isRtl={isRTL}
                />
                <SettingsRow
                  theme={theme}
                  isLast
                  destructive
                  onClick={() => setConfirmAction('resetStats')}
                  icon={<SettingsIconBadge color="#FF3B30" gradientTo="#FF453A"><RotateCcw size={16} /></SettingsIconBadge>}
                  title={t.resetPlayStatsBtn || 'صفر کردن آمار پخش'}
                  subtitle={t.resetPlayStatsDesc}
                />
              </SettingsSection>

              <SettingsSection header={t.backupSectionTitle || 'پشتیبان‌گیری و بازیابی'} theme={theme}>
                <SettingsRow
                  theme={theme}
                  onClick={handleExportBackup}
                  icon={<SettingsIconBadge color="#34C759" gradientTo="#00C7BE"><FileDown size={16} /></SettingsIconBadge>}
                  title={t.exportBackupBtn || 'خروجی پشتیبان (JSON)'}
                  subtitle={t.exportBackupDesc}
                  showChevron
                  isRtl={isRTL}
                />
                <SettingsRow
                  theme={theme}
                  isLast
                  icon={<SettingsIconBadge color="#007AFF" gradientTo="#5856D6"><FileUp size={16} /></SettingsIconBadge>}
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
              </SettingsSection>
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

              <SettingsSection header={t.shortcutsPlaybackSection || 'کنترل پخش و صدا'} theme={theme}>
                <SettingsRow theme={theme} title={t.shortcutPlayPause || 'پخش / توقف'} trailing={<KbdBadge theme={theme}>Space / K</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutPrevNext || 'آهنگ قبلی / بعدی'} trailing={<KbdBadge theme={theme}>Ctrl + ← / →</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutSeek || 'جلو / عقب رفتن'} trailing={<KbdBadge theme={theme}>← / →</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutSeekFast || 'پرش سریع ۳ برابری'} trailing={<KbdBadge theme={theme}>Shift + ← / →</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutVolume || 'افزایش / کاهش صدا'} trailing={<KbdBadge theme={theme}>+ / - · Ctrl + ↑ / ↓</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutMute || 'قطع / وصل صدا'} trailing={<KbdBadge theme={theme}>M</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutShuffle || 'روشن / خاموش کردن شافل'} trailing={<KbdBadge theme={theme}>S</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutRepeat || 'تغییر حالت تکرار'} trailing={<KbdBadge theme={theme}>R</KbdBadge>} />
                <SettingsRow theme={theme} isLast title={t.shortcutFavorite || 'افزودن / حذف از محبوب‌ها'} trailing={<KbdBadge theme={theme}>L</KbdBadge>} />
              </SettingsSection>

              <SettingsSection header={t.shortcutsNavSection || 'ناوبری و پنجره‌ها'} theme={theme}>
                <SettingsRow theme={theme} title={t.shortcutQueue || 'باز / بسته کردن صف پخش'} trailing={<KbdBadge theme={theme}>Q</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutFullscreen || 'پخش‌کننده تمام‌صفحه'} trailing={<KbdBadge theme={theme}>F</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutSearch || 'باز کردن جستجوی هوشمند'} trailing={<KbdBadge theme={theme}>Ctrl + K / F / /</KbdBadge>} />
                <SettingsRow theme={theme} title={t.shortcutSettings || 'باز کردن تنظیمات'} trailing={<KbdBadge theme={theme}>Ctrl + ,</KbdBadge>} />
                <SettingsRow theme={theme} isLast title={t.shortcutTabs || 'جابه‌جایی مستقیم بین تب‌ها'} trailing={<KbdBadge theme={theme}>Alt + 1..6</KbdBadge>} />
              </SettingsSection>
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
              <SettingsSection theme={theme}>
                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#007AFF" gradientTo="#5856D6">
                      <Globe size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.language}
                  trailing={
                    <SettingsSegmentedControl<'fa' | 'en'>
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

                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#007AFF" gradientTo="#32ADE6">
                      <Compass size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.defaultTabLabel || 'تب پیش‌فرض برنامه'}
                  subtitle={t.defaultTabDesc}
                  valueText={activeDefaultTabLabel}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                    {defaultTabOptions.map((opt) => {
                      const isSelected = activeDefaultTab === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updatePref('defaultTab', opt.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '999px',
                            border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                            backgroundColor: isSelected ? `${theme.colors.primary}22` : theme.colors.background,
                            color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                            fontSize: '0.7813rem',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {opt.icon}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </SettingsRow>

                <SettingsRow
                  theme={theme}
                  onClick={() => setSubPage('display')}
                  showChevron
                  isRtl={isRTL}
                  icon={
                    <SettingsIconBadge color="#5856D6" gradientTo="#AF52DE">
                      <Monitor size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.displayMenuTitle || 'ظاهر و نمایش (Display)'}
                  subtitle={displaySubtitleText}
                />

                <SettingsRow
                  theme={theme}
                  isLast
                  onClick={() => setSubPage('sound')}
                  showChevron
                  isRtl={isRTL}
                  icon={
                    <SettingsIconBadge color="#FF2D55" gradientTo="#FF375F">
                      <Volume2 size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.soundMenuTitle || 'صدا و افکت‌های صوتی'}
                  subtitle={soundSummaryText}
                  valueText={equalizerSettings.enabled ? 'EQ' : undefined}
                />
              </SettingsSection>

              {/* بخش ۲: پخش، تایمر و رفتار هوشمند */}
              <SettingsSection header={t.playbackBehaviorSection || 'پخش و رفتار هوشمند'} theme={theme}>
                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#5E5CE6" gradientTo="#32ADE6">
                      <Timer size={16} />
                    </SettingsIconBadge>
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
                </SettingsRow>

                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#FF9500" gradientTo="#FFCC00">
                      <SkipForward size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.seekStepLabel || 'گام جلو و عقب'}
                  subtitle={t.seekStepDesc}
                  trailing={
                    <SettingsSegmentedControl<SeekStepSeconds>
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

                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#34C759" gradientTo="#30D158">
                      <Play size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.autoPlayOnImportLabel || 'پخش خودکار پس از افزودن'}
                  subtitle={t.autoPlayOnImportDesc}
                  trailing={
                    <SettingsSwitch
                      checked={playbackPrefs.autoPlayOnImport}
                      onChange={(v) => updatePref('autoPlayOnImport', v)}
                      theme={theme}
                      ariaLabel={t.autoPlayOnImportLabel || 'Auto-Play on Import'}
                    />
                  }
                />

                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#007AFF" gradientTo="#30B0C7">
                      <Bookmark size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.rememberPlaybackLabel || 'ذخیره آخرین موقعیت پخش'}
                  subtitle={t.rememberPlaybackDesc}
                  trailing={
                    <SettingsSwitch
                      checked={playbackPrefs.rememberPlaybackPosition}
                      onChange={(v) => updatePref('rememberPlaybackPosition', v)}
                      theme={theme}
                      ariaLabel={t.rememberPlaybackLabel || 'Remember Playback Position'}
                    />
                  }
                />

                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#32ADE6" gradientTo="#007AFF">
                      <CopyCheck size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.skipDuplicatesLabel || 'جلوگیری از آهنگ‌های تکراری'}
                  subtitle={t.skipDuplicatesDesc}
                  trailing={
                    <SettingsSwitch
                      checked={playbackPrefs.skipDuplicatesOnImport}
                      onChange={(v) => updatePref('skipDuplicatesOnImport', v)}
                      theme={theme}
                      ariaLabel={t.skipDuplicatesLabel || 'Skip Duplicates'}
                    />
                  }
                />

                <SettingsRow
                  theme={theme}
                  isLast
                  icon={
                    <SettingsIconBadge color="#FF3B30" gradientTo="#FF9500">
                      <ShieldAlert size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.confirmBeforeDeleteLabel || 'تاییدیه پیش از حذف'}
                  subtitle={t.confirmBeforeDeleteDesc}
                  trailing={
                    <SettingsSwitch
                      checked={playbackPrefs.confirmBeforeDelete}
                      onChange={(v) => updatePref('confirmBeforeDelete', v)}
                      theme={theme}
                      ariaLabel={t.confirmBeforeDeleteLabel || 'Confirm Before Delete'}
                    />
                  }
                />
              </SettingsSection>

              {/* بخش ۳: کتابخانه، ذخیره‌سازی و راهنما */}
              <SettingsSection theme={theme}>
                <SettingsRow
                  theme={theme}
                  onClick={() => setSubPage('library')}
                  showChevron
                  isRtl={isRTL}
                  icon={
                    <SettingsIconBadge color="#0A84FF" gradientTo="#30B0C7">
                      <HardDrive size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.libraryStorageTitle || 'کتابخانه، حافظه و پشتیبان‌گیری'}
                  subtitle={t.libraryStorageSubtitle}
                  valueText={`${songs.length} ${t.songs || 'آهنگ'}`}
                />

                <SettingsRow
                  theme={theme}
                  isLast
                  onClick={() => setSubPage('shortcuts')}
                  showChevron
                  isRtl={isRTL}
                  icon={
                    <SettingsIconBadge color="#636366" gradientTo="#48484A">
                      <Keyboard size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.shortcutsMenuTitle || 'میانبرهای کیبورد'}
                  subtitle={t.shortcutsMenuSubtitle}
                />
              </SettingsSection>

              {/* بخش ۴: ارتباط و بازنشانی */}
              <SettingsSection header={t.aboutSectionTitle || 'درباره برنامه'} theme={theme}>
                <SettingsRow
                  theme={theme}
                  icon={<AppLogo theme={theme} size={34} />}
                  title="Prism Music"
                  subtitle={
                    isRTL
                      ? 'پخش‌کننده موسیقی با موتور اکولایزر DSP'
                      : 'Music Player with Web Audio DSP Equalizer'
                  }
                  valueText="v1.0.0"
                />

                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#2AABEE" gradientTo="#229ED9">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                      </svg>
                    </SettingsIconBadge>
                  }
                  title={t.telegramLabel || 'تلگرام'}
                  subtitle={
                    <span dir="ltr" style={{ display: 'inline-block' }}>
                      https://t.me/Valuedb
                    </span>
                  }
                  trailing={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleCopyContactLink('telegram', 'https://t.me/Valuedb')}
                        title={
                          copiedContactKey === 'telegram'
                            ? t.copiedLinkTooltip || 'کپی شد'
                            : t.copyLinkTooltip || 'کپی لینک'
                        }
                        aria-label={
                          copiedContactKey === 'telegram'
                            ? t.copiedLinkTooltip || 'کپی شد'
                            : t.copyLinkTooltip || 'کپی لینک'
                        }
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '9px',
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(15, 23, 42, 0.04)',
                          color:
                            copiedContactKey === 'telegram'
                              ? '#34C759'
                              : theme.colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedContactKey === 'telegram' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <a
                        href="https://t.me/Valuedb"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          height: '32px',
                          padding: '0 11px',
                          borderRadius: '9px',
                          backgroundColor: theme.isDark
                            ? 'rgba(42, 171, 238, 0.18)'
                            : 'rgba(42, 171, 238, 0.14)',
                          color: '#2AABEE',
                          fontSize: '0.7813rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>{t.openLinkLabel || 'مشاهده'}</span>
                        <ArrowUpRight size={14} />
                      </a>
                    </div>
                  }
                />

                <SettingsRow
                  theme={theme}
                  icon={
                    <SettingsIconBadge color="#32383F" gradientTo="#1B1F23">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </svg>
                    </SettingsIconBadge>
                  }
                  title={t.githubLabel || 'گیت‌هاب'}
                  subtitle={
                    <span dir="ltr" style={{ display: 'inline-block' }}>
                      https://github.com/Valuedb
                    </span>
                  }
                  trailing={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleCopyContactLink('github', 'https://github.com/Valuedb')}
                        title={
                          copiedContactKey === 'github'
                            ? t.copiedLinkTooltip || 'کپی شد'
                            : t.copyLinkTooltip || 'کپی لینک'
                        }
                        aria-label={
                          copiedContactKey === 'github'
                            ? t.copiedLinkTooltip || 'کپی شد'
                            : t.copyLinkTooltip || 'کپی لینک'
                        }
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '9px',
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: theme.isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(15, 23, 42, 0.04)',
                          color:
                            copiedContactKey === 'github'
                              ? '#34C759'
                              : theme.colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedContactKey === 'github' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <a
                        href="https://github.com/Valuedb"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          height: '32px',
                          padding: '0 11px',
                          borderRadius: '9px',
                          backgroundColor: theme.isDark
                            ? 'rgba(255, 255, 255, 0.09)'
                            : 'rgba(15, 23, 42, 0.07)',
                          color: theme.colors.textPrimary,
                          fontSize: '0.7813rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>{t.openLinkLabel || 'مشاهده'}</span>
                        <ArrowUpRight size={14} />
                      </a>
                    </div>
                  }
                />

                <SettingsRow
                  theme={theme}
                  isLast
                  destructive
                  onClick={() => setConfirmAction('resetAll')}
                  icon={
                    <SettingsIconBadge color="#FF3B30" gradientTo="#FF453A">
                      <RotateCcw size={16} />
                    </SettingsIconBadge>
                  }
                  title={t.resetAllSettingsBtn || 'بازگردانی تمام تنظیمات به پیش‌فرض'}
                  subtitle={t.resetAllSettingsDesc}
                />
              </SettingsSection>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
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