import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Upload } from 'lucide-react';
import { PlayerBar } from './components/PlayerBar';
import { TopBar } from './components/TopBar';
import { SideBar } from './components/SideBar';
import { TabLoadingView } from './components/TabLoadingView';
import type { SearchNavigateTarget } from './components/SearchBar';
import { Home } from './features/Home';
import { usePersistentState } from './hooks/usePersistentState';
import { usePlayer } from './hooks/usePlayer';
import { STORAGE_KEYS } from './storage/keys';
import { readJSON } from './storage/safeStorage';
import {
  isDisplaySettings,
  isEqualizerSettings,
  isLinkedFolderList,
  isPlaybackPreferences,
  isPlaylistList,
  isSongList,
  isSoundSettings,
} from './types/guards';
import type {
  DesktopFolderScanResult,
  DesktopPickedFile,
  DisplaySettings,
  EqualizerSettings,
  LinkedFolder,
  PlaybackPreferences,
  Playlist,
  SleepTimerState,
  Song,
  SoundSettings,
} from './types';
import { DEFAULT_EQ_SETTINGS, DEFAULT_SOUND_SETTINGS, audioEffects } from './player/audioEffects';
import { DEFAULT_PLAYBACK_PREFERENCES } from './player/constants';
import { translations, type Language } from './locales';
import { DEFAULT_DISPLAY_SETTINGS, getTheme, type PaletteType, type ThemeMode } from './theme';
import { getAudioBlobsBatch, deleteAudioBlob } from './storage/mediaStore';
import {
  extractDroppedAudioFiles,
  extractSongsBatched,
  partitionDuplicateSongs,
} from './utils/audioMetadata';
import {
  buildDesktopMediaUrl,
  extractDiskSongsBatched,
  getDroppedFileDiskPath,
  isDesktopRuntime,
  normalizeDiskPath,
  syncDesktopFolderResult,
} from './utils/desktopBridge';
import { extractDominantHex } from './utils/artworkColor';
import {
  applyDesktopWebViewHardening,
  initTauriDesktopBridge,
  syncDesktopWindowTitle,
} from './utils/tauriBridge';
import {
  CONTENT_WHEEL_COMMIT_THRESHOLD,
  clampTabIndex,
  dampSwipeOffset,
  evaluateSwipeAxisLock,
  extractFirmContentWheelDelta,
  resolveContentSwipeStep,
  type SwipeLockState,
} from './utils/tabScroll';

const isLegacyDemoTrack = (song: Song) =>
  (song.id === 'demo-1' || song.id === 'demo-2' || song.id === 'demo-3') &&
  song.fileUrl.startsWith('data:audio/wav;base64,');

// بارگذاری تنبل صفحات غیر اول برای سرعت بالای راه‌اندازی روی ویندوز
const AllSongs = lazy(() => import('./features/AllSongs').then((m) => ({ default: m.AllSongs })));
const Playlists = lazy(() => import('./features/Playlists').then((m) => ({ default: m.Playlists })));
const Artists = lazy(() => import('./features/Artists').then((m) => ({ default: m.Artists })));
const Albums = lazy(() => import('./features/Albums').then((m) => ({ default: m.Albums })));
const Folders = lazy(() => import('./features/Folders').then((m) => ({ default: m.Folders })));
const Settings = lazy(() => import('./features/Settings').then((m) => ({ default: m.Settings })));

const tabs = ['home', 'allSongs', 'playlists', 'artists', 'albums', 'folders'] as const;

function App() {
  const [currentTabIndex, setCurrentTabIndex] = useState(() => {
    const savedPrefs = readJSON<PlaybackPreferences>(
      STORAGE_KEYS.playbackPrefs,
      DEFAULT_PLAYBACK_PREFERENCES,
      isPlaybackPreferences
    );
    const idx = tabs.indexOf(savedPrefs.defaultTab ?? 'home');
    return idx >= 0 ? idx : 0;
  });
  const currentTab = tabs[currentTabIndex];
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSubPage, setSettingsSubPage] = useState<{
    page: 'main' | 'sound' | 'display' | 'library' | 'shortcuts';
    token: number;
  } | null>(null);

  const [language, setLanguage] = usePersistentState<Language>(
    'appLanguage',
    'fa',
    (v): v is Language => v === 'fa' || v === 'en'
  );
  const [navTarget, setNavTarget] = useState<(SearchNavigateTarget & { token: number }) | null>(
    null
  );
  const [themeMode, setThemeMode] = usePersistentState<ThemeMode>(
    'appThemeMode',
    'system',
    (v): v is ThemeMode => v === 'system' || v === 'light' || v === 'dark'
  );
  const [colorPalette, setColorPalette] = usePersistentState<PaletteType>(
    STORAGE_KEYS.palette,
    'classic-blue',
    (v): v is PaletteType => typeof v === 'string'
  );
  const [customBackground, setCustomBackground] = usePersistentState<string | null>(
    STORAGE_KEYS.customBg,
    null,
    (v): v is string | null => v === null || typeof v === 'string'
  );
  const [customBgBlur, setCustomBgBlur] = usePersistentState<number>(
    STORAGE_KEYS.customBgBlur,
    10,
    (v): v is number => typeof v === 'number'
  );
  const [customBgDim, setCustomBgDim] = usePersistentState<number>(
    STORAGE_KEYS.customBgDim,
    45,
    (v): v is number => typeof v === 'number'
  );
  const [glassCardCovers, setGlassCardCovers] = usePersistentState<boolean>(
    STORAGE_KEYS.glassCardCovers,
    true,
    (v): v is boolean => typeof v === 'boolean'
  );
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistentState<boolean>(
    STORAGE_KEYS.sidebarCollapsed,
    false,
    (v): v is boolean => typeof v === 'boolean'
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({ mode: 'off' });
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);

  // تشخیص حالت تیره/روشن سیستم و عرض پنجره برای تطبیق نوار کناری
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  // بهینه‌سازی محیط Tauri و دسکتاپ ویندوز + اتصال پل Tauri در صورت وجود پلاگین‌ها
  useEffect(() => {
    initTauriDesktopBridge();
    return applyDesktopWebViewHardening();
  }, []);

  // فعال‌سازی واکنش لمسی فوری (Active state) در مرورگرهای لمسی
  useEffect(() => {
    const handleTouchStart = () => {};
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => window.removeEventListener('touchstart', handleTouchStart);
  }, []);

  const contentViewportRef = useRef<HTMLDivElement>(null);
  const [contentSwipeX, setContentSwipeX] = useState(0);
  const tabIndexRef = useRef(currentTabIndex);
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const isRTLStateRef = useRef(language === 'fa');

  useEffect(() => {
    tabIndexRef.current = currentTabIndex;
    isSettingsOpenRef.current = isSettingsOpen;
    isRTLStateRef.current = language === 'fa';
  }, [currentTabIndex, isSettingsOpen, language]);

  const [songs, setSongs] = usePersistentState<Song[]>(STORAGE_KEYS.library, [], isSongList);

  useEffect(() => {
    if (songs.some(isLegacyDemoTrack)) {
      setSongs((prev) => prev.filter((song) => !isLegacyDemoTrack(song)));
    }
  }, [songs, setSongs]);
  const [playlists, setPlaylists] = usePersistentState<Playlist[]>(STORAGE_KEYS.playlists, [], isPlaylistList);
  const [customFolders, setCustomFolders] = usePersistentState<string[]>(
    STORAGE_KEYS.folders,
    [],
    (v): v is string[] => Array.isArray(v) && v.every((item) => typeof item === 'string')
  );
  const [equalizerSettings, setEqualizerSettings] = usePersistentState<EqualizerSettings>(
    STORAGE_KEYS.equalizer,
    DEFAULT_EQ_SETTINGS,
    isEqualizerSettings
  );
  const [soundSettings, setSoundSettings] = usePersistentState<SoundSettings>(
    STORAGE_KEYS.soundSettings,
    DEFAULT_SOUND_SETTINGS,
    isSoundSettings
  );
  const [displaySettings, setDisplaySettings] = usePersistentState<DisplaySettings>(
    STORAGE_KEYS.displaySettings,
    DEFAULT_DISPLAY_SETTINGS,
    isDisplaySettings
  );
  const [playbackPrefs, setPlaybackPrefs] = usePersistentState<PlaybackPreferences>(
    STORAGE_KEYS.playbackPrefs,
    DEFAULT_PLAYBACK_PREFERENCES,
    isPlaybackPreferences
  );
  const [linkedFolders, setLinkedFolders] = usePersistentState<LinkedFolder[]>(
    STORAGE_KEYS.linkedFolders,
    [],
    isLinkedFolderList
  );
  const [adaptivePrimaryHex, setAdaptivePrimaryHex] = useState<string | null>(null);
  const player = usePlayer(songs);

  const songsRef = useRef(songs);
  const playbackPrefsRef = useRef(playbackPrefs);
  const linkedFoldersRef = useRef(linkedFolders);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  useEffect(() => {
    playbackPrefsRef.current = playbackPrefs;
  }, [playbackPrefs]);

  useEffect(() => {
    linkedFoldersRef.current = linkedFolders;
  }, [linkedFolders]);

  const desktopSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const folderRetryTimersRef = useRef<Map<string, number>>(new Map());
  const lastFocusSyncRef = useRef(0);
  const applyDesktopFolderScanRef = useRef<
    ((
      scan: DesktopFolderScanResult,
      options?: { allowAutoPlay?: boolean; scheduleRetry?: boolean }
    ) => Promise<{ addedCount: number; removedCount: number; firstAdded?: Song }>) | null
  >(null);

  const enqueueDesktopTask = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = desktopSyncQueueRef.current.then(task, task);
    desktopSyncQueueRef.current = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }, []);

  const applyDesktopFolderScan = useCallback(
    (
      scan: DesktopFolderScanResult,
      options?: { allowAutoPlay?: boolean; scheduleRetry?: boolean }
    ): Promise<{ addedCount: number; removedCount: number; firstAdded?: Song }> =>
      enqueueDesktopTask(async () => {
        const linkedItem = linkedFoldersRef.current.find(
          (item) => normalizeDiskPath(item.path) === normalizeDiskPath(scan.folderPath)
        );
        const result = await syncDesktopFolderResult(
          scan,
          songsRef.current,
          linkedItem?.name || scan.folderName
        );

        let runningSongs = [...songsRef.current];
        const removedSet = new Set(result.removedIds);
        const missingSet = new Set(result.missingIds);
        let changedSongs = false;

        if (removedSet.size > 0) {
          runningSongs = runningSongs.filter((s) => !removedSet.has(s.id));
          changedSongs = true;
        }

        if (result.restoredUpdates.size > 0 || missingSet.size > 0) {
          runningSongs = runningSongs.map((s) => {
            const restore = result.restoredUpdates.get(s.id);
            if (restore) {
              changedSongs = true;
              return {
                ...s,
                fileMissing: false,
                fileUrl: restore.fileUrl,
                linkedFolderPath: restore.linkedFolderPath,
                folder: restore.folder || s.folder,
              };
            }
            if (missingSet.has(s.id) && !s.fileMissing) {
              changedSongs = true;
              return { ...s, fileMissing: true };
            }
            return s;
          });
        }

        const uniqueNewSongs =
          result.newSongs.length > 0
            ? playbackPrefsRef.current.skipDuplicatesOnImport
              ? partitionDuplicateSongs(result.newSongs, runningSongs).unique
              : result.newSongs
            : [];

        if (uniqueNewSongs.length > 0) {
          runningSongs = [...runningSongs, ...uniqueNewSongs];
          changedSongs = true;
        }

        if (changedSongs) {
          songsRef.current = runningSongs;
          setSongs(runningSongs);

          if (removedSet.size > 0 || result.restoredUpdates.size > 0 || missingSet.size > 0) {
            setPlaylists((prev) =>
              prev.map((pl) => ({
                ...pl,
                songs: pl.songs
                  .filter((s) => !removedSet.has(s.id))
                  .map((s) => {
                    const restore = result.restoredUpdates.get(s.id);
                    if (restore) {
                      return {
                        ...s,
                        fileMissing: false,
                        fileUrl: restore.fileUrl,
                        linkedFolderPath: restore.linkedFolderPath,
                        folder: restore.folder || s.folder,
                      };
                    }
                    if (missingSet.has(s.id) && !s.fileMissing) {
                      return { ...s, fileMissing: true };
                    }
                    return s;
                  }),
              }))
            );

            for (const removedId of removedSet) {
              player.removeSong(removedId);
            }
            for (const [id, restore] of result.restoredUpdates.entries()) {
              const updatedTarget = runningSongs.find((s) => s.id === id);
              if (updatedTarget) {
                player.syncSong({
                  ...updatedTarget,
                  fileMissing: false,
                  fileUrl: restore.fileUrl,
                  linkedFolderPath: restore.linkedFolderPath,
                  folder: restore.folder || updatedTarget.folder,
                });
              }
            }
            for (const missingId of missingSet) {
              const updatedTarget = runningSongs.find((s) => s.id === missingId);
              if (updatedTarget) {
                player.syncSong({ ...updatedTarget, fileMissing: true });
              }
            }
          }
        }

        const now = Date.now();
        const rootKey = normalizeDiskPath(scan.folderPath);
        setLinkedFolders((prev) =>
          prev.map((item) =>
            normalizeDiskPath(item.path) === rootKey
              ? {
                  ...item,
                  lastSyncedAt: now,
                  fileCount: scan.missing ? item.fileCount : scan.files.length,
                }
              : item
          )
        );

        if (
          options?.scheduleRetry !== false &&
          result.failedCount > 0 &&
          !scan.missing &&
          window.desktopRuntime?.scanFolder
        ) {
          const prevTimer = folderRetryTimersRef.current.get(rootKey);
          if (prevTimer) window.clearTimeout(prevTimer);
          const timerId = window.setTimeout(() => {
            folderRetryTimersRef.current.delete(rootKey);
            void window.desktopRuntime?.scanFolder?.(scan.folderPath).then((retryScan) => {
              if (retryScan) {
                void applyDesktopFolderScanRef.current?.(retryScan, { scheduleRetry: false });
              }
            });
          }, 1500);
          folderRetryTimersRef.current.set(rootKey, timerId);
        }

        if (options?.allowAutoPlay && uniqueNewSongs.length > 0) {
          if (playbackPrefsRef.current.autoPlayOnImport || !player.currentSong) {
            player.playSongFromList(uniqueNewSongs[0], runningSongs);
          }
        }

        return {
          addedCount: uniqueNewSongs.length,
          removedCount: removedSet.size,
          firstAdded: uniqueNewSongs[0],
        };
      }),
    [enqueueDesktopTask, player, setLinkedFolders, setPlaylists, setSongs]
  );

  useEffect(() => {
    applyDesktopFolderScanRef.current = applyDesktopFolderScan;
  }, [applyDesktopFolderScan]);

  const handleOpenExternalFiles = useCallback(
    (pickedFiles: DesktopPickedFile[]) =>
      enqueueDesktopTask(async () => {
        if (!pickedFiles || pickedFiles.length === 0) return;

        const existingByPath = new Map<string, Song>();
        for (const s of songsRef.current) {
          if (s.sourcePath) {
            existingByPath.set(normalizeDiskPath(s.sourcePath), s);
          }
        }

        const alreadyPresent: Song[] = [];
        const toImport: DesktopPickedFile[] = [];

        for (const item of pickedFiles) {
          const matched = existingByPath.get(normalizeDiskPath(item.path));
          if (matched) {
            alreadyPresent.push(matched);
          } else {
            toImport.push(item);
          }
        }

        let runningSongs = [...songsRef.current];
        const imported =
          toImport.length > 0 ? await extractDiskSongsBatched(toImport) : [];

        if (imported.length > 0) {
          runningSongs = [...runningSongs, ...imported];
          songsRef.current = runningSongs;
          setSongs(runningSongs);
        }

        const targetSong = imported[0] || alreadyPresent[0];
        if (targetSong) {
          const cleanTarget = targetSong.fileMissing
            ? {
                ...targetSong,
                fileMissing: false,
                fileUrl: buildDesktopMediaUrl(targetSong.sourcePath || targetSong.fileUrl),
              }
            : targetSong;
          if (targetSong.fileMissing) {
            runningSongs = runningSongs.map((s) => (s.id === cleanTarget.id ? cleanTarget : s));
            songsRef.current = runningSongs;
            setSongs(runningSongs);
          }
          player.playSongFromList(cleanTarget, runningSongs);
        }
      }),
    [enqueueDesktopTask, player, setSongs]
  );

  // همگام‌سازی خودکار وضعیت پایش لحظه‌ای پوشه‌های متصل روی دیسک در پس‌زمینه
  useEffect(() => {
    if (!isDesktopRuntime() || !window.desktopRuntime?.watchFolders) return;
    void window.desktopRuntime.watchFolders(linkedFolders.map((f) => f.path));
  }, [linkedFolders]);

  // اعمال یکپارچه‌ی تمام تنظیمات صدا و اکولایزر روی موتور DSP خروجی صوتی
  useEffect(() => {
    audioEffects.applySettings(equalizerSettings);
  }, [equalizerSettings]);

  useEffect(() => {
    audioEffects.applySoundSettings(soundSettings);
  }, [soundSettings]);

  // بازیابی یکپارچه و سریع لینک‌های فایل‌های صوتی ذخیره‌شده در IndexedDB + بازیابی آخرین آهنگ پخش‌شده + پایش زنده پوشه‌ها
  useEffect(() => {
    let cancelled = false;
    const retryTimers = folderRetryTimersRef.current;

    const rehydrateAudioUrls = async () => {
      const localSongIds = songs
        .filter((s) => s.fileUrl.startsWith('blob:'))
        .map((s) => s.id);

      const blobUrlMap = new Map<string, string>();
      if (localSongIds.length > 0) {
        const blobs = await getAudioBlobsBatch(localSongIds);
        if (cancelled) return;
        blobs.forEach((blob, id) => {
          blobUrlMap.set(id, URL.createObjectURL(blob));
        });
      }

      if (cancelled) return;

      let restoredList = songs;
      if (blobUrlMap.size > 0) {
        restoredList = songs.map((s) => {
          const freshUrl = blobUrlMap.get(s.id);
          return freshUrl ? { ...s, fileUrl: freshUrl } : s;
        });

        setSongs((prev) =>
          prev.map((s) => {
            const freshUrl = blobUrlMap.get(s.id);
            return freshUrl ? { ...s, fileUrl: freshUrl } : s;
          })
        );

        setPlaylists((prev) =>
          prev.map((p) => ({
            ...p,
            songs: p.songs.map((s) => {
              const freshUrl = blobUrlMap.get(s.id);
              return freshUrl ? { ...s, fileUrl: freshUrl } : s;
            }),
          }))
        );
      }

      // بازیابی آخرین آهنگ در حال پخش نشست قبلی (در صورت فعال بودن تنظیم)
      if (playbackPrefsRef.current.rememberPlaybackPosition) {
        const savedPlayback = readJSON<{ songId?: string; currentTime?: number } | null>(
          STORAGE_KEYS.lastPlayback,
          null
        );
        if (savedPlayback?.songId) {
          const lastSong = restoredList.find((s) => s.id === savedPlayback.songId);
          if (lastSong) {
            player.restoreSong(lastSong);
          }
        }
      }
    };

    rehydrateAudioUrls();

    const syncLinkedFolders = async () => {
      if (!isDesktopRuntime() || !window.desktopRuntime?.scanFolder) return;
      const api = window.desktopRuntime;
      for (const folder of linkedFoldersRef.current) {
        if (cancelled) return;
        const scan = await api.scanFolder!(folder.path);
        if (cancelled) return;
        await applyDesktopFolderScan(
          scan ?? {
            folderPath: folder.path,
            folderName: folder.name,
            files: [],
            missing: true,
          }
        );
      }
    };

    // بررسی وجود فایل‌های متصل مستقیم به هارد و همگام‌سازی خودکار پوشه‌های دسکتاپ هنگام شروع
    const syncDesktopLibraryOnLaunch = async () => {
      if (!isDesktopRuntime() || !window.desktopRuntime) return;
      const api = window.desktopRuntime;

      const diskPaths = songsRef.current
        .map((s) => s.sourcePath)
        .filter((p): p is string => Boolean(p));

      if (diskPaths.length > 0 && api.checkPathsExist) {
        const statusMap = await api.checkPathsExist(diskPaths);
        if (cancelled) return;
        setSongs((prev) => {
          let changed = false;
          const next = prev.map((s) => {
            if (!s.sourcePath) return s;
            const exists = statusMap[s.sourcePath] !== false;
            const expectedUrl = buildDesktopMediaUrl(s.sourcePath);
            if (Boolean(s.fileMissing) !== !exists || s.fileUrl !== expectedUrl) {
              changed = true;
              return { ...s, fileMissing: !exists, fileUrl: expectedUrl };
            }
            return s;
          });
          if (changed) songsRef.current = next;
          return changed ? next : prev;
        });
      }

      await syncLinkedFolders();

      if (api.consumePendingOpenFiles) {
        const pendingFiles = await api.consumePendingOpenFiles();
        if (!cancelled && pendingFiles.length > 0) {
          await handleOpenExternalFiles(pendingFiles);
        }
      }
    };

    void syncDesktopLibraryOnLaunch();

    const unsubFolderWatch = window.desktopRuntime?.onFolderChanged?.((scan) => {
      if (!cancelled) {
        void applyDesktopFolderScan(scan);
      }
    });

    const unsubOpenFiles = window.desktopRuntime?.onOpenFiles?.((files) => {
      if (!cancelled && files.length > 0) {
        void handleOpenExternalFiles(files);
      }
    });

    const handleWindowFocusSync = () => {
      if (!isDesktopRuntime() || linkedFoldersRef.current.length === 0) return;
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 6000) return;
      lastFocusSyncRef.current = now;
      void syncLinkedFolders();
    };

    window.addEventListener('focus', handleWindowFocusSync);

    return () => {
      cancelled = true;
      unsubFolderWatch?.();
      unsubOpenFiles?.();
      window.removeEventListener('focus', handleWindowFocusSync);
      for (const id of retryTimers.values()) {
        window.clearTimeout(id);
      }
      retryTimers.clear();
    };
    // فقط یک‌بار هنگام شروع برنامه اجرا شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = translations[language];
  const resolvedMode: 'light' | 'dark' =
    themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    let cancelled = false;
    const coverUrl = player.currentSong?.cover;
    if (!displaySettings.adaptiveArtworkAccent || !coverUrl) {
      setAdaptivePrimaryHex(null);
      return;
    }
    extractDominantHex(coverUrl, resolvedMode === 'light').then((hex) => {
      if (!cancelled) setAdaptivePrimaryHex(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [displaySettings.adaptiveArtworkAccent, player.currentSong?.cover, resolvedMode]);

  const activeBackdrop =
    displaySettings.adaptiveArtworkWallpaper && player.currentSong?.cover
      ? player.currentSong.cover
      : customBackground;

  const theme = getTheme(resolvedMode, colorPalette, {
    display: displaySettings,
    overridePrimaryHex: adaptivePrimaryHex,
    hasWallpaper: Boolean(activeBackdrop),
  });

  // همگام‌سازی کلاس dark، فونت، مقیاس و کاهش انیمیشن
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const scale = displaySettings.fontScale || 1;
    root.style.setProperty('--app-font', theme.fonts.main);
    root.style.setProperty('--ui-scale', String(scale));
    root.style.fontSize = `${(16 * scale).toFixed(2)}px`;
    root.setAttribute('data-density', displaySettings.listDensity);
    root.setAttribute('data-reduce-motion', displaySettings.reduceMotion ? 'true' : 'false');
    document.body.style.backgroundColor = theme.colors.background;
    document.body.style.color = theme.colors.textPrimary;
  }, [
    resolvedMode,
    theme.fonts.main,
    theme.colors.background,
    theme.colors.textPrimary,
    displaySettings.fontScale,
    displaySettings.listDensity,
    displaySettings.reduceMotion,
  ]);

  // همگام‌سازی عنوان پنجره دسکتاپ/ویندوز با آهنگ در حال پخش
  useEffect(() => {
    if (player.currentSong) {
      const artistSuffix = player.currentSong.artist ? ` — ${player.currentSong.artist}` : '';
      syncDesktopWindowTitle(`${player.currentSong.name}${artistSuffix} · Prism Music`);
    } else {
      syncDesktopWindowTitle('Prism Music');
    }
  }, [player.currentSong]);

  // اسکرول و سوایپ افقی سفت و سخت روی محتوای اصلی برای جابه‌جایی بین تب‌ها بدون تداخل با اسکرول عمودی
  useEffect(() => {
    const viewport = contentViewportRef.current;
    if (!viewport) return;

    const isBlockedTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest('[role="dialog"], [data-modal-open="true"], [data-no-tab-swipe="true"]')) {
        return true;
      }
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') {
        return true;
      }
      return Boolean(target.closest('[role="slider"]'));
    };

    const hasInnerHorizontalScroll = (target: EventTarget | null): boolean => {
      let cursor = target instanceof HTMLElement ? target : null;
      while (cursor && cursor !== viewport) {
        if (cursor.scrollWidth > cursor.clientWidth + 4) {
          const ox = window.getComputedStyle(cursor).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
        cursor = cursor.parentElement;
      }
      return false;
    };

    let wheelAccum = 0;
    let lastWheelAt = 0;
    let wheelCooldownUntil = 0;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || isSettingsOpenRef.current) return;
      if (document.querySelector('[role="dialog"], [data-modal-open="true"]')) return;
      if (isSwipeBlockedTargetCheck(e.target) || hasInnerHorizontalScroll(e.target)) return;

      const delta = extractFirmContentWheelDelta({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        shiftKey: e.shiftKey,
        isRTL: isRTLStateRef.current,
      });

      if (delta === 0) return;

      e.preventDefault();
      const now = Date.now();
      if (now < wheelCooldownUntil) return;
      if (now - lastWheelAt > 200) {
        wheelAccum = 0;
      }
      lastWheelAt = now;
      wheelAccum += delta;

      if (Math.abs(wheelAccum) < CONTENT_WHEEL_COMMIT_THRESHOLD) return;

      const step = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      wheelCooldownUntil = now + 460;

      const nextIdx = clampTabIndex(tabIndexRef.current + step, tabs.length);
      if (nextIdx !== tabIndexRef.current) {
        setNavTarget(null);
        setCurrentTabIndex(nextIdx);
      }
    };

    function isSwipeBlockedTargetCheck(target: EventTarget | null): boolean {
      return isBlockedTarget(target);
    }

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let lastDx = 0;
    let lock: SwipeLockState = 'pending';

    const detachSwipe = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };

    const resetSwipe = (commit: boolean) => {
      detachSwipe();
      const lockedHorizontal = lock === 'horizontal';
      const finalDx = lastDx;
      const elapsed = Date.now() - startAt;
      pointerId = null;
      lock = 'pending';
      lastDx = 0;
      setContentSwipeX(0);

      if (!commit || !lockedHorizontal) return;
      const step = resolveContentSwipeStep({
        dx: finalDx,
        elapsedMs: elapsed,
        isRTL: isRTLStateRef.current,
      });
      if (step !== 0) {
        const nextIdx = clampTabIndex(tabIndexRef.current + step, tabs.length);
        if (nextIdx !== tabIndexRef.current) {
          setNavTarget(null);
          setCurrentTabIndex(nextIdx);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (lock === 'pending') {
        const nextLock = evaluateSwipeAxisLock(dx, dy);
        if (nextLock === 'pending') return;
        lock = nextLock;
        if (lock === 'vertical') {
          resetSwipe(false);
          return;
        }
      }

      if (lock === 'horizontal') {
        lastDx = dx;
        setContentSwipeX(dampSwipeOffset(dx));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      resetSwipe(true);
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      resetSwipe(false);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || isSettingsOpenRef.current) return;
      if (document.querySelector('[role="dialog"], [data-modal-open="true"]')) return;
      if (isBlockedTarget(e.target) || hasInnerHorizontalScroll(e.target)) return;

      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startAt = Date.now();
      lastDx = 0;
      lock = 'pending';

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('pointerdown', onPointerDown);

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('pointerdown', onPointerDown);
      detachSwipe();
    };
  }, []);

  const markSongStarted = useCallback(
    (id: string) => {
      const now = Date.now();
      const target = songsRef.current.find((s) => s.id === id);
      setSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, lastPlayedAt: now } : s))
      );
      setPlaylists((prev) =>
        prev.map((p) => ({
          ...p,
          songs: p.songs.map((s) => (s.id === id ? { ...s, lastPlayedAt: now } : s)),
        }))
      );
      if (target && player.currentSong?.id === id) {
        player.syncSong({ ...target, lastPlayedAt: now });
      }
    },
    [player, setPlaylists, setSongs]
  );

  /** ثبت خودکار زمان آخرین پخش برای تغییر ترک از طریق صف، کراس‌فید، گپ‌لس یا میانبرها */
  useEffect(() => {
    const currentId = player.currentSong?.id;
    if (player.playToken <= 0 || !currentId) return;
    markSongStarted(currentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.playToken, player.currentSong?.id]);

  /** وقتی یک پخش «واقعی» حساب شد، شمارنده‌ی پخش زیاد می‌شه و تاریخ پخش ثبت می‌شه */
  const handleSongPlayed = useCallback(
    (id: string) => {
      const now = Date.now();
      const existing = songsRef.current.find((s) => s.id === id);
      setSongs((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, playCount: (s.playCount || 0) + 1, lastPlayedAt: now } : s
        )
      );
      setPlaylists((prev) =>
        prev.map((p) => ({
          ...p,
          songs: p.songs.map((s) =>
            s.id === id ? { ...s, playCount: (s.playCount || 0) + 1, lastPlayedAt: now } : s
          ),
        }))
      );
      if (existing && player.currentSong?.id === id) {
        player.syncSong({
          ...existing,
          playCount: (existing.playCount || 0) + 1,
          lastPlayedAt: now,
        });
      }
    },
    [player, setPlaylists, setSongs]
  );

  /** تغییر وضعیت آهنگ محبوب (Favorite) */
  const toggleFavoriteSong = useCallback(
    (id: string) => {
      if (player.currentSong && player.currentSong.id === id) {
        player.syncSong({
          ...player.currentSong,
          isFavorite: !player.currentSong.isFavorite,
        });
      } else {
        const active = songs.find((s) => s.id === id);
        if (active) {
          player.syncSong({
            ...active,
            isFavorite: !active.isFavorite,
          });
        }
      }

      setSongs((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s))
      );

      setPlaylists((prev) =>
        prev.map((p) => ({
          ...p,
          songs: p.songs.map((s) => (s.id === id ? { ...s, isFavorite: !s.isFavorite } : s)),
        }))
      );
    },
    [player, setPlaylists, setSongs, songs]
  );

  /** پخش یک آهنگ از لیست و به‌روزرسانی تاریخچه پخش */
  const handlePlaySongFromList = useCallback(
    (song: Song, list: Song[]) => {
      player.playSongFromList(song, list);
    },
    [player]
  );

  const handleShuffleAll = useCallback(() => {
    if (songs.length === 0) return;
    player.setShuffle(true);
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    handlePlaySongFromList(randomSong, songs);
  }, [songs, player, handlePlaySongFromList]);

  const handleClearSleepTimer = useCallback(() => {
    setSleepTimer({ mode: 'off' });
  }, []);

  const handleCreatePlaylist = useCallback(
    (name: string, selectedSongs: Song[]) => {
      const newPlaylist: Playlist = {
        id: crypto.randomUUID(),
        name: name,
        songs: selectedSongs,
      };
      setPlaylists((prev) => [...prev, newPlaylist]);
    },
    [setPlaylists]
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
    },
    [setPlaylists]
  );

  const renamePlaylist = useCallback(
    (id: string, newName: string) => {
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
    },
    [setPlaylists]
  );

  const updatePlaylistSongs = useCallback(
    (id: string, newSongs: Song[]) => {
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, songs: newSongs } : p)));
    },
    [setPlaylists]
  );

  const updateSong = useCallback(
    (updatedSong: Song) => {
      setSongs((prev) => prev.map((s) => (s.id === updatedSong.id ? updatedSong : s)));
      setPlaylists((prev) =>
        prev.map((p) => ({
          ...p,
          songs: p.songs.map((s) => (s.id === updatedSong.id ? updatedSong : s)),
        }))
      );
      player.syncSong(updatedSong);
    },
    [player, setPlaylists, setSongs]
  );

  const addSongToPlaylist = useCallback(
    (playlistId: string, song: Song) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id === playlistId && !p.songs.some((s) => s.id === song.id)) {
            return { ...p, songs: [...p.songs, song] };
          }
          return p;
        })
      );
    },
    [setPlaylists]
  );

  const handleAddSongsToPlaylist = useCallback(
    (playlistId: string, selectedSongs: Song[]) => {
      if (selectedSongs.length === 0) return;
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id !== playlistId) return p;
          const existingIds = new Set(p.songs.map((s) => s.id));
          const uniqueToAdd = selectedSongs.filter((s) => !existingIds.has(s.id));
          if (uniqueToAdd.length === 0) return p;
          return { ...p, songs: [...p.songs, ...uniqueToAdd] };
        })
      );
    },
    [setPlaylists]
  );

  const deleteSong = useCallback(
    (id: string) => {
      setSongs((prev) => {
        const target = prev.find((s) => s.id === id);
        if (target?.fileUrl.startsWith('blob:')) {
          URL.revokeObjectURL(target.fileUrl);
        }
        return prev.filter((s) => s.id !== id);
      });
      setPlaylists((prev) =>
        prev.map((p) => ({ ...p, songs: p.songs.filter((s) => s.id !== id) }))
      );
      player.removeSong(id);
      void deleteAudioBlob(id);
    },
    [player, setPlaylists, setSongs]
  );

  const handleBulkDeleteSongs = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      setSongs((prev) => {
        prev.forEach((s) => {
          if (idSet.has(s.id) && s.fileUrl.startsWith('blob:')) {
            URL.revokeObjectURL(s.fileUrl);
          }
        });
        return prev.filter((s) => !idSet.has(s.id));
      });
      setPlaylists((prev) =>
        prev.map((p) => ({ ...p, songs: p.songs.filter((s) => !idSet.has(s.id)) }))
      );
      ids.forEach((id) => {
        player.removeSong(id);
        void deleteAudioBlob(id);
      });
    },
    [player, setPlaylists, setSongs]
  );

  const handleCreateFolder = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setCustomFolders((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    },
    [setCustomFolders]
  );

  const handleRenameFolder = useCallback(
    (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return;
      setCustomFolders((prev) => {
        const filtered = prev.filter((f) => f !== oldName && f !== trimmed);
        return [...filtered, trimmed];
      });
      setSongs((prev) =>
        prev.map((s) => (s.folder?.trim() === oldName ? { ...s, folder: trimmed } : s))
      );
      setPlaylists((prev) =>
        prev.map((p) => ({
          ...p,
          songs: p.songs.map((s) => (s.folder?.trim() === oldName ? { ...s, folder: trimmed } : s)),
        }))
      );
      if (player.currentSong?.folder?.trim() === oldName) {
        player.syncSong({ ...player.currentSong, folder: trimmed });
      }
    },
    [player, setCustomFolders, setPlaylists, setSongs]
  );

  const handleDeleteFolder = useCallback(
    (name: string) => {
      setCustomFolders((prev) => prev.filter((f) => f !== name));
      setSongs((prev) =>
        prev.map((s) => (s.folder?.trim() === name ? { ...s, folder: undefined } : s))
      );
      setPlaylists((prev) =>
        prev.map((p) => ({
          ...p,
          songs: p.songs.map((s) => (s.folder?.trim() === name ? { ...s, folder: undefined } : s)),
        }))
      );
      if (player.currentSong?.folder?.trim() === name) {
        player.syncSong({ ...player.currentSong, folder: undefined });
      }
    },
    [player, setCustomFolders, setPlaylists, setSongs]
  );

  const handleAssignSongsToFolder = useCallback(
    (songIds: string[], folderName: string) => {
      const trimmed = folderName.trim();
      if (!trimmed) return;
      setCustomFolders((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      const idSet = new Set(songIds);
      setSongs((prev) => prev.map((s) => (idSet.has(s.id) ? { ...s, folder: trimmed } : s)));
      setPlaylists((prev) =>
        prev.map((p) => ({
          ...p,
          songs: p.songs.map((s) => (idSet.has(s.id) ? { ...s, folder: trimmed } : s)),
        }))
      );
      if (player.currentSong && idSet.has(player.currentSong.id)) {
        player.syncSong({ ...player.currentSong, folder: trimmed });
      }
    },
    [player, setCustomFolders, setPlaylists, setSongs]
  );

  const setTab = useCallback(
    (tab: string) => {
      if (tab === 'settings') {
        setSettingsSubPage((prev) =>
          isSettingsOpen ? prev : { page: 'main', token: Date.now() }
        );
        setIsSettingsOpen((prev) => !prev);
        return;
      }
      const index = tabs.findIndex((name) => name === tab);
      if (index === -1) return;
      setNavTarget(null);
      if (index !== currentTabIndex) {
        setCurrentTabIndex(index);
      }
      setIsSettingsOpen(false);
    },
    [currentTabIndex, isSettingsOpen]
  );

  const handleNavigateFromSearch = useCallback(
    (target: SearchNavigateTarget) => {
      const index = tabs.findIndex((name) => name === target.tab);
      if (index === -1) return;
      setNavTarget({ ...target, token: Date.now() });
      if (index !== currentTabIndex) {
        setCurrentTabIndex(index);
      }
      setIsSettingsOpen(false);
    },
    [currentTabIndex]
  );

  // رها کردن فایل‌ها یا پوشه‌های صوتی از Windows Explorer در هر نقطه از پنجره برنامه
  const hasDraggedFiles = (dt: DataTransfer | null): boolean =>
    Boolean(dt && Array.from(dt.types || []).includes('Files'));

  const handleWindowDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleWindowDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleWindowDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const handleWindowDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFiles(false);

    // در اجرای مستقل دسکتاپ: پوشه‌های رهاشده متصل و پایش می‌شوند و فایل‌ها بدون کپی به دیتابیس لینک می‌گردند
    if (isDesktopRuntime() && window.desktopRuntime?.inspectPaths && e.dataTransfer.files?.length) {
      const api = window.desktopRuntime;
      const droppedPaths = Array.from(e.dataTransfer.files)
        .map(getDroppedFileDiskPath)
        .filter(Boolean);

      if (droppedPaths.length > 0) {
        const inspected = await api.inspectPaths!(droppedPaths);
        let firstImportedSong: Song | undefined;

        for (const dirPath of inspected.dirs) {
          const scan = await api.scanFolder?.(dirPath);
          if (!scan) continue;
          const folderRecord: LinkedFolder = {
            id: scan.folderPath,
            path: scan.folderPath,
            name: scan.folderName,
            addedAt: Date.now(),
            lastSyncedAt: Date.now(),
            fileCount: scan.files.length,
          };
          setLinkedFolders((prev) => [
            ...prev.filter((item) => normalizeDiskPath(item.path) !== normalizeDiskPath(scan.folderPath)),
            folderRecord,
          ]);
          const outcome = await applyDesktopFolderScan(scan, { allowAutoPlay: false });
          if (!firstImportedSong && outcome.firstAdded) {
            firstImportedSong = outcome.firstAdded;
          }
        }

        if (inspected.files.length > 0) {
          const existingPaths = new Set(
            songsRef.current
              .map((s) => (s.sourcePath ? normalizeDiskPath(s.sourcePath) : ''))
              .filter(Boolean)
          );
          const freshFiles = inspected.files.filter(
            (f) => !existingPaths.has(normalizeDiskPath(f.path))
          );
          if (freshFiles.length > 0) {
            const diskSongs = await extractDiskSongsBatched(freshFiles);
            const prefs = playbackPrefsRef.current;
            const { unique } = prefs.skipDuplicatesOnImport
              ? partitionDuplicateSongs(diskSongs, songsRef.current)
              : { unique: diskSongs };
            if (unique.length > 0) {
              const updated = [...songsRef.current, ...unique];
              songsRef.current = updated;
              setSongs(updated);
              if (!firstImportedSong) firstImportedSong = unique[0];
            }
          }
        }

        if (firstImportedSong && (playbackPrefsRef.current.autoPlayOnImport || !player.currentSong)) {
          player.playSongFromList(firstImportedSong, songsRef.current);
        }
        return;
      }
    }

    const extractedItems = await extractDroppedAudioFiles(e.dataTransfer);
    if (extractedItems.length === 0) return;

    const newSongs = await extractSongsBatched(extractedItems);
    if (newSongs.length === 0) return;

    const prefs = playbackPrefsRef.current;
    const existing = songsRef.current;
    const { unique, duplicates } = prefs.skipDuplicatesOnImport
      ? partitionDuplicateSongs(newSongs, existing)
      : { unique: newSongs, duplicates: [] as Song[] };

    if (duplicates.length > 0) {
      duplicates.forEach((dup) => {
        if (dup.fileUrl.startsWith('blob:')) URL.revokeObjectURL(dup.fileUrl);
        void deleteAudioBlob(dup.id);
      });
    }

    if (unique.length === 0) return;

    const updated = [...existing, ...unique];
    setSongs(updated);
    if (prefs.autoPlayOnImport || !player.currentSong) {
      player.playSongFromList(unique[0], updated);
    }
  };

  const renderContent = () => {
    if (isSettingsOpen) {
      return (
        <Settings
          songs={songs}
          setSongs={setSongs}
          playlists={playlists}
          setPlaylists={setPlaylists}
          customFolders={customFolders}
          setCustomFolders={setCustomFolders}
          linkedFolders={linkedFolders}
          setLinkedFolders={setLinkedFolders}
          t={t}
          language={language}
          setLanguage={setLanguage}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          colorPalette={colorPalette}
          setColorPalette={setColorPalette}
          equalizerSettings={equalizerSettings}
          setEqualizerSettings={setEqualizerSettings}
          soundSettings={soundSettings}
          setSoundSettings={setSoundSettings}
          displaySettings={displaySettings}
          setDisplaySettings={setDisplaySettings}
          playbackPrefs={playbackPrefs}
          setPlaybackPrefs={setPlaybackPrefs}
          theme={theme}
          customBackground={customBackground}
          setCustomBackground={setCustomBackground}
          customBgBlur={customBgBlur}
          setCustomBgBlur={setCustomBgBlur}
          customBgDim={customBgDim}
          setCustomBgDim={setCustomBgDim}
          glassCardCovers={glassCardCovers}
          setGlassCardCovers={setGlassCardCovers}
          sleepTimer={sleepTimer}
          onSetSleepTimer={setSleepTimer}
          onPlayImported={handlePlaySongFromList}
          onDeleteSongsBatch={handleBulkDeleteSongs}
          onSyncDesktopFolderScan={applyDesktopFolderScan}
          onCloseSettings={() => setIsSettingsOpen(false)}
          initialSubPage={settingsSubPage}
        />
      );
    }

    switch (currentTab) {
      case 'home':
        return (
          <Home
            songs={songs}
            playlists={playlists}
            customFolders={customFolders}
            currentSong={player.currentSong}
            onPlaySongFromList={handlePlaySongFromList}
            onShuffleAll={handleShuffleAll}
            onPlayNext={player.playNextSongs}
            addToQueue={player.addToQueue}
            onToggleFavorite={toggleFavoriteSong}
            onNavigateToItem={handleNavigateFromSearch}
            onSelectTab={setTab}
            sleepTimer={sleepTimer}
            onSetSleepTimer={setSleepTimer}
            t={t}
            theme={theme}
            language={language}
            isPlaying={isPlaying}
            glassCardCovers={glassCardCovers}
            homeLayout={displaySettings.homeLayout ?? 'widget'}
            reduceMotion={displaySettings.reduceMotion}
          />
        );
      case 'allSongs':
        return (
          <AllSongs
            songs={songs}
            playlists={playlists}
            currentSong={player.currentSong}
            isPlaying={isPlaying}
            onPlaySongFromList={handlePlaySongFromList}
            onCreatePlaylist={handleCreatePlaylist}
            addToQueue={player.addToQueue}
            onPlayNext={player.playNextSongs}
            onDeleteSong={deleteSong}
            onBulkDeleteSongs={handleBulkDeleteSongs}
            confirmBeforeDelete={playbackPrefs.confirmBeforeDelete}
            onUpdateSong={updateSong}
            onAddSongToPlaylist={addSongToPlaylist}
            onToggleFavorite={toggleFavoriteSong}
            t={t}
            theme={theme}
            glassCardCovers={glassCardCovers}
          />
        );
      case 'playlists':
        return (
          <Playlists
            playlists={playlists}
            allSongs={songs}
            currentSong={player.currentSong}
            isPlaying={isPlaying}
            onPlaySongFromList={handlePlaySongFromList}
            addToQueue={player.addToQueue}
            onPlayNext={player.playNextSongs}
            onDeleteSong={deleteSong}
            onBulkDeleteSongs={handleBulkDeleteSongs}
            confirmBeforeDelete={playbackPrefs.confirmBeforeDelete}
            onUpdateSong={updateSong}
            onAddSongToPlaylist={addSongToPlaylist}
            onToggleFavorite={toggleFavoriteSong}
            t={t}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={deletePlaylist}
            onRenamePlaylist={renamePlaylist}
            onUpdatePlaylistSongs={updatePlaylistSongs}
            theme={theme}
            language={language}
            glassCardCovers={glassCardCovers}
            initialPlaylist={
              navTarget?.tab === 'playlists' ? { id: navTarget.key, token: navTarget.token } : null
            }
          />
        );
      case 'artists':
        return (
          <Artists
            songs={songs}
            playlists={playlists}
            currentSong={player.currentSong}
            isPlaying={isPlaying}
            onPlaySongFromList={handlePlaySongFromList}
            onCreatePlaylist={handleCreatePlaylist}
            addToQueue={player.addToQueue}
            onPlayNext={player.playNextSongs}
            onDeleteSong={deleteSong}
            onBulkDeleteSongs={handleBulkDeleteSongs}
            confirmBeforeDelete={playbackPrefs.confirmBeforeDelete}
            onUpdateSong={updateSong}
            onAddSongToPlaylist={addSongToPlaylist}
            onToggleFavorite={toggleFavoriteSong}
            t={t}
            theme={theme}
            language={language}
            glassCardCovers={glassCardCovers}
            initialArtist={
              navTarget?.tab === 'artists' ? { name: navTarget.key, token: navTarget.token } : null
            }
          />
        );
      case 'albums':
        return (
          <Albums
            songs={songs}
            playlists={playlists}
            currentSong={player.currentSong}
            isPlaying={isPlaying}
            onPlaySongFromList={handlePlaySongFromList}
            onCreatePlaylist={handleCreatePlaylist}
            addToQueue={player.addToQueue}
            onPlayNext={player.playNextSongs}
            onDeleteSong={deleteSong}
            onBulkDeleteSongs={handleBulkDeleteSongs}
            confirmBeforeDelete={playbackPrefs.confirmBeforeDelete}
            onUpdateSong={updateSong}
            onAddSongToPlaylist={addSongToPlaylist}
            onToggleFavorite={toggleFavoriteSong}
            t={t}
            theme={theme}
            language={language}
            glassCardCovers={glassCardCovers}
            initialAlbum={
              navTarget?.tab === 'albums' ? { key: navTarget.key, token: navTarget.token } : null
            }
          />
        );
      case 'folders':
        return (
          <Folders
            songs={songs}
            setSongs={setSongs}
            playlists={playlists}
            customFolders={customFolders}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onAssignSongsToFolder={handleAssignSongsToFolder}
            currentSong={player.currentSong}
            isPlaying={isPlaying}
            onPlaySongFromList={handlePlaySongFromList}
            onCreatePlaylist={handleCreatePlaylist}
            addToQueue={player.addToQueue}
            onPlayNext={player.playNextSongs}
            onDeleteSong={deleteSong}
            onBulkDeleteSongs={handleBulkDeleteSongs}
            confirmBeforeDelete={playbackPrefs.confirmBeforeDelete}
            skipDuplicatesOnImport={playbackPrefs.skipDuplicatesOnImport}
            onUpdateSong={updateSong}
            onAddSongToPlaylist={addSongToPlaylist}
            onToggleFavorite={toggleFavoriteSong}
            t={t}
            theme={theme}
            language={language}
            glassCardCovers={glassCardCovers}
            initialFolder={
              navTarget?.tab === 'folders' ? { id: navTarget.key, token: navTarget.token } : null
            }
            onLinkDesktopFolder={(folder) =>
              setLinkedFolders((prev) => [
                ...prev.filter(
                  (item) => normalizeDiskPath(item.path) !== normalizeDiskPath(folder.path)
                ),
                folder,
              ])
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <MotionConfig reducedMotion={displaySettings.reduceMotion ? 'always' : 'user'}>
    <div
      onDragEnter={handleWindowDragEnter}
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        backgroundColor: theme.colors.background,
        color: theme.colors.textPrimary,
        fontFamily: theme.fonts.main,
        overflow: 'hidden',
        direction: language === 'fa' ? 'rtl' : 'ltr',
        position: 'relative',
      }}
    >
      {/* پس‌زمینه انتخابی کاربر یا کاور پویا (Custom / Adaptive Wallpaper) */}
      {activeBackdrop && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <img
            src={activeBackdrop}
            alt=""
            style={{
              position: 'absolute',
              inset: '-28px',
              width: 'calc(100% + 56px)',
              height: 'calc(100% + 56px)',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              filter: `blur(${
                displaySettings.adaptiveArtworkWallpaper && player.currentSong?.cover
                  ? Math.max(24, customBgBlur)
                  : customBgBlur
              }px)`,
              transform: 'scale(1.06)',
              transition: displaySettings.reduceMotion ? 'none' : 'filter 0.3s ease, opacity 0.35s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: theme.isDark
                ? `rgba(0, 0, 0, ${((customBgDim * 0.85) / 100).toFixed(3)})`
                : `rgba(255, 255, 255, ${((customBgDim * 0.45) / 100).toFixed(3)})`,
              transition: displaySettings.reduceMotion ? 'none' : 'background-color 0.25s ease',
            }}
          />
        </div>
      )}

      {/* هاله نور پس‌زمینه زنده و سیال */}
      {displaySettings.ambientGlow && (
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
          opacity: activeBackdrop ? 0.22 : 1,
          transition: 'opacity 0.4s ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            left: '12%',
            width: '45vw',
            height: '45vw',
            minWidth: '320px',
            minHeight: '320px',
            borderRadius: '50%',
            background: theme.isDark
              ? `radial-gradient(circle, ${theme.colors.primary}38 0%, ${theme.colors.glow || theme.colors.primary}18 50%, transparent 70%)`
              : `radial-gradient(circle, ${theme.colors.primary}3d 0%, ${theme.colors.glow || theme.colors.primary}1f 52%, transparent 72%)`,
            filter: 'blur(75px)',
            opacity: theme.isDark ? 0.75 : 0.72,
            transform: 'translate3d(0,0,0)',
            transition: 'background 0.4s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '12%',
            right: '-8%',
            width: '50vw',
            height: '50vw',
            minWidth: '360px',
            minHeight: '360px',
            borderRadius: '50%',
            background: theme.isDark
              ? `radial-gradient(circle, ${theme.colors.accent || theme.colors.primary}30 0%, ${theme.colors.secondary || theme.colors.primary}16 50%, transparent 70%)`
              : `radial-gradient(circle, ${theme.colors.accent || theme.colors.primary}34 0%, ${theme.colors.secondary || theme.colors.primary}1c 52%, transparent 72%)`,
            filter: 'blur(90px)',
            opacity: theme.isDark ? 0.65 : 0.65,
            transform: 'translate3d(0,0,0)',
            transition: 'background 0.4s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '30%',
            width: '38vw',
            height: '38vw',
            minWidth: '260px',
            minHeight: '260px',
            borderRadius: '50%',
            background: theme.isDark
              ? `radial-gradient(circle, ${theme.colors.secondary || theme.colors.primary}24 0%, transparent 70%)`
              : `radial-gradient(circle, ${theme.colors.glow || theme.colors.primary}2b 0%, transparent 72%)`,
            filter: 'blur(80px)',
            opacity: theme.isDark ? 0.55 : 0.58,
            transform: 'translate3d(0,0,0)',
            transition: 'background 0.4s ease',
          }}
        />
      </div>
      )}

      {(() => {
        const navLayout = displaySettings.navigationLayout ?? 'top';
        const isDesktopViewport = viewportWidth >= 768;
        const expandedSidebarWidth =
          viewportWidth >= 1440 ? 220 : viewportWidth >= 1024 ? 204 : 184;
        const sidebarWidth = sidebarCollapsed ? 64 : expandedSidebarWidth;
        const showDesktopSidebar = navLayout === 'sidebar' && isDesktopViewport;
        const isDockedPlayer = (displaySettings.playerBarStyle ?? 'floating') === 'docked';

        return (
          <>
            <div
              dir={navLayout === 'sidebar' ? 'ltr' : language === 'fa' ? 'rtl' : 'ltr'}
              style={{
                display: 'flex',
                flexDirection: showDesktopSidebar ? 'row' : 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {navLayout === 'sidebar' ? (
                <SideBar
                  currentTab={isSettingsOpen ? 'settings' : currentTab}
                  setCurrentTab={setTab}
                  t={t}
                  theme={theme}
                  songs={songs}
                  playlists={playlists}
                  customFolders={customFolders}
                  onPlaySong={handlePlaySongFromList}
                  onPlayNext={player.playNextSongs}
                  onAddToQueue={player.addToQueue}
                  onAddSongsToPlaylist={handleAddSongsToPlaylist}
                  onCreatePlaylist={handleCreatePlaylist}
                  onSearchNavigate={handleNavigateFromSearch}
                  isDesktopViewport={isDesktopViewport}
                  sidebarWidth={sidebarWidth}
                  isCollapsed={sidebarCollapsed}
                  onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
                  isDockedPlayer={isDockedPlayer}
                  reduceMotion={displaySettings.reduceMotion}
                  isRTL={language === 'fa'}
                />
              ) : (
                <TopBar
                  currentTab={isSettingsOpen ? 'settings' : currentTab}
                  setCurrentTab={setTab}
                  t={t}
                  theme={theme}
                  songs={songs}
                  playlists={playlists}
                  customFolders={customFolders}
                  onPlaySong={handlePlaySongFromList}
                  onPlayNext={player.playNextSongs}
                  onAddToQueue={player.addToQueue}
                  onAddSongsToPlaylist={handleAddSongsToPlaylist}
                  onCreatePlaylist={handleCreatePlaylist}
                  onSearchNavigate={handleNavigateFromSearch}
                  isRTL={language === 'fa'}
                  reduceMotion={displaySettings.reduceMotion}
                />
              )}

              <div
                ref={contentViewportRef}
                dir={language === 'fa' ? 'rtl' : 'ltr'}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  position: 'relative',
                  overflow: 'hidden',
                  touchAction: 'pan-y',
                  zIndex: 1,
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isSettingsOpen ? 'settings' : currentTab}
                    initial={displaySettings.reduceMotion ? false : { opacity: 0 }}
                    animate={{
                      opacity: 1,
                      x: displaySettings.reduceMotion ? 0 : contentSwipeX,
                    }}
                    exit={displaySettings.reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    transition={
                      contentSwipeX !== 0
                        ? { x: { duration: 0 }, opacity: { duration: 0.1 } }
                        : {
                            duration: displaySettings.reduceMotion ? 0 : 0.13,
                            ease: 'easeOut',
                          }
                    }
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      scrollbarGutter: 'stable',
                      backgroundColor: 'transparent',
                    }}
                  >
                    <Suspense
                      fallback={
                        <TabLoadingView
                          theme={theme}
                          subtitle={t.loadingTab || 'در حال بارگذاری...'}
                          reduceMotion={displaySettings.reduceMotion}
                          isRTL={language === 'fa'}
                        />
                      }
                    >
                      {renderContent()}
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div
              dir="ltr"
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 120,
                direction: 'ltr',
              }}
            >
        <PlayerBar
          currentSong={player.currentSong}
          queue={player.queue}
          currentQueueIndex={player.currentQueueIndex}
          removeFromQueue={player.removeFromQueueAt}
          removeFromQueueIndices={player.removeFromQueueIndices}
          onPlayNextInQueue={player.playNextInQueue}
          playNext={player.playNext}
          playPrev={player.playPrev}
          reorderQueue={player.reorderQueue}
          repeatMode={player.repeatMode}
          setRepeatMode={player.setRepeatMode}
          isShuffle={player.isShuffle}
          setIsShuffle={player.setShuffle}
          playToken={player.playToken}
          onSongPlayed={handleSongPlayed}
          onSongStarted={markSongStarted}
          onToggleFavorite={toggleFavoriteSong}
          onUpdateSong={updateSong}
          t={t}
          theme={theme}
          onPlayStateChange={setIsPlaying}
          onPlayQueueSong={player.playQueueSongAt}
          onClearQueue={player.clearQueue}
          onShuffleQueue={player.shuffleQueue}
          playlists={playlists}
          onAddSongToPlaylist={addSongToPlaylist}
          onCreatePlaylist={handleCreatePlaylist}
          onDeleteSong={deleteSong}
          onSelectTabIndex={(idx) => {
            if (tabs[idx]) setTab(tabs[idx]);
          }}
          onOpenSettings={() => setTab('settings')}
          sleepTimer={sleepTimer}
          onClearSleepTimer={handleClearSleepTimer}
          peekNext={player.peekNext}
          soundSettings={soundSettings}
          displaySettings={displaySettings}
          playbackPrefs={playbackPrefs}
        />
      </div>
          </>
        );
      })()}

      {/* راهنمای رها کردن فایل/پوشه فقط هنگام کشیدن فایل روی پنجره ویندوز */}
      {isDraggingFiles && (
        <div
          style={{
            position: 'fixed',
            inset: 16,
            zIndex: 999999,
            borderRadius: '24px',
            border: `2px dashed ${theme.colors.primary}`,
            backgroundColor: theme.colors.surfaceHover || theme.colors.surface,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            pointerEvents: 'none',
          }}
        >
          <Upload size={44} color={theme.colors.primary} />
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: theme.colors.textPrimary }}>
            {t.dropAudioTitle || 'فایل یا پوشه موسیقی را اینجا رها کنید'}
          </div>
          <div style={{ fontSize: '0.875rem', color: theme.colors.textSecondary }}>
            {t.dropAudioHint || 'برای افزودن فوری به کتابخانه رها کنید'}
          </div>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}

export default App;