import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { DEFAULT_PLAYBACK_PREFERENCES, PLAY_COUNT_THRESHOLD_SECONDS } from '../player/constants';
import type { DisplaySettings, PlaybackPreferences, Playlist, RepeatMode, SleepTimerState, Song, SoundSettings } from '../types';
import { FullScreenPlayer } from './FullScreenPlayer';
import { QueueDrawer } from './QueueDrawer';
import { CoverImage } from './CoverImage';
import { MarqueeText } from './MarqueeText';
import { ProgressScrubber } from './ProgressScrubber';
import { syncMediaSession, syncMediaSessionPosition } from '../utils/mediaSession';
import { DEFAULT_SOUND_SETTINGS, audioEffects } from '../player/audioEffects';
import { DEFAULT_DISPLAY_SETTINGS } from '../theme';
import { usePersistentState } from '../hooks/usePersistentState';
import { STORAGE_KEYS } from '../storage/keys';
import { readJSON, writeJSON } from '../storage/safeStorage';
import { getAudioBlob } from '../storage/mediaStore';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { withAlpha } from '../utils/color';

/**
 * رنگ‌ها و متریال نوار پلیر Prism Music هماهنگ با پالت و تم روشن/تاریک:
 * - سطح شیشه‌ای نوار (پس‌زمینه، لبه و سایه) از theme.glass.bar می‌آید (src/theme.ts)
 * - رنگ متن‌ها و آیکون‌ها از پالت فعال می‌آید تا با تم روشن و تیره کاملاً هماهنگ باشد
 */
const getBarPalette = (theme: any) => ({
  title: theme.colors.textPrimary || (theme.isDark ? '#ffffff' : '#1d1f1f'),
  secondary: theme.colors.textSecondary || (theme.isDark ? 'rgba(235, 235, 245, 0.65)' : 'rgba(60, 60, 67, 0.65)'),
  icon: theme.colors.textPrimary || (theme.isDark ? '#ffffff' : '#1d1d1f'),
  iconDim: theme.colors.textSecondary || (theme.isDark ? 'rgba(235, 235, 245, 0.65)' : 'rgba(60, 60, 67, 0.65)'),
});

/** افکت لمس/کلیک نرم و ساده دکمه‌های نوار پخش (بدون تاری یا پرش در هاور) */
const BUTTON_CSS = `
.pb-btn { transition: opacity 0.16s ease; }
.pb-btn:active:not(:disabled) { opacity: 0.6; transition-duration: 0.08s; }
`;

interface PlayerBarProps {
  currentSong: Song | null;
  queue: Song[];
  currentQueueIndex?: number;
  removeFromQueue: (index: number) => void;
  removeFromQueueIndices?: (indices: number[]) => void;
  onPlayNextInQueue?: (index: number) => void;
  playNext: () => boolean;
  playPrev: () => boolean;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  repeatMode: RepeatMode;
  setRepeatMode: (mode: RepeatMode) => void;
  isShuffle: boolean;
  setIsShuffle: (val: boolean) => void;
  playToken: number;
  onSongPlayed: (id: string) => void;
  onSongStarted?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  t: any;
  theme: any;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onPlayQueueSong?: (index: number) => void;
  onClearQueue?: () => void;
  onShuffleQueue?: () => void;
  playlists?: Playlist[];
  onAddSongToPlaylist?: (playlistId: string, song: Song) => void;
  onCreatePlaylist?: (name: string, songs: Song[]) => void;
  onSelectTabIndex?: (index: number) => void;
  onOpenSettings?: () => void;
  sleepTimer?: SleepTimerState;
  onClearSleepTimer?: () => void;
  peekNext?: () => Song | null;
  soundSettings?: SoundSettings;
  displaySettings?: DisplaySettings;
  playbackPrefs?: PlaybackPreferences;
  onUpdateSong?: (updatedSong: Song) => void;
  onDeleteSong?: (id: string) => void;
}

type AudioWithPitchFlags = HTMLAudioElement & {
  preservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
  mozPreservesPitch?: boolean;
};

const applyDeckPlaybackParams = (
  audio: HTMLAudioElement | null,
  vol: number,
  speed: number,
  preservePitch: boolean
) => {
  if (!audio) return;
  const targetElementVol = audioEffects.isDeckAttached(audio) ? 1 : vol;
  if (Math.abs(audio.volume - targetElementVol) > 1e-4) {
    audio.volume = targetElementVol;
  }
  const clampedRate = Math.max(0.5, Math.min(2, speed || 1));
  if (audio.playbackRate !== clampedRate) {
    audio.playbackRate = clampedRate;
  }
  const flagged = audio as AudioWithPitchFlags;
  flagged.preservesPitch = preservePitch;
  flagged.webkitPreservesPitch = preservePitch;
  flagged.mozPreservesPitch = preservePitch;
};

export const PlayerBar = ({
  currentSong,
  queue,
  currentQueueIndex,
  removeFromQueue,
  removeFromQueueIndices,
  onPlayNextInQueue,
  playNext,
  playPrev,
  reorderQueue,
  repeatMode,
  setRepeatMode,
  isShuffle,
  setIsShuffle,
  playToken,
  onSongPlayed,
  onSongStarted,
  onToggleFavorite,
  t,
  theme,
  onPlayStateChange,
  onPlayQueueSong,
  onClearQueue,
  onShuffleQueue,
  playlists = [],
  onAddSongToPlaylist,
  onCreatePlaylist,
  onSelectTabIndex,
  onOpenSettings,
  sleepTimer,
  onClearSleepTimer,
  peekNext,
  soundSettings = DEFAULT_SOUND_SETTINGS,
  displaySettings = DEFAULT_DISPLAY_SETTINGS,
  playbackPrefs = DEFAULT_PLAYBACK_PREFERENCES,
  onUpdateSong,
  onDeleteSong,
}: PlayerBarProps) => {
  const audioRefA = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');
  const getActiveAudio = useCallback(
    () => (activeDeckRef.current === 'A' ? audioRefA.current : audioRefB.current),
    []
  );
  const getStandbyAudio = useCallback(
    () => (activeDeckRef.current === 'A' ? audioRefB.current : audioRefA.current),
    []
  );

  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayState = useCallback(
    (playing: boolean) => {
      setIsPlaying(playing);
      onPlayStateChange?.(playing);
    },
    [onPlayStateChange]
  );

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showQueue, setShowQueue] = useState(false);
  const [showFsQueue, setShowFsQueue] = useState(false);
  const [volume, setVolume] = usePersistentState<number>(
    STORAGE_KEYS.volume,
    1,
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
  );
  const lastNonZeroVolumeRef = useRef<number>(volume > 0 ? volume : 1);
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isHeartPopping, setIsHeartPopping] = useState(false);
  const heartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (heartTimerRef.current) {
        window.clearTimeout(heartTimerRef.current);
      }
    };
  }, []);

  const maxVolFactor = Math.max(0.2, Math.min(1, (soundSettings.maxVolumeLimit ?? 100) / 100));
  const effectiveVolume = Math.min(volume, maxVolFactor);

  /** برای هر پخش فقط یک بار playCount زیاد بشه */
  const countedRef = useRef(false);
  const retriedRecoveryRef = useRef<string | null>(null);
  const lastPosSyncRef = useRef(0);
  const lastPlaybackSaveRef = useRef(0);
  const pendingResumeTimeRef = useRef<number | null>(null);
  const pauseFadeTimerRef = useRef<number | null>(null);
  const suppressNextPauseSyncRef = useRef(false);
  const crossfadingToIdRef = useRef<string | null>(null);
  const crossfadeCleanupTimerRef = useRef<number | null>(null);
  const preloadedRef = useRef<{ songId: string; url: string } | null>(null);
  const skipNextLoadRef = useRef<string | null>(null);
  const songUrl = currentSong?.fileUrl ?? null;

  // رفرنس‌های پایدار برای جلوگیری از closure کهنه در MediaSession و کلیدهای میانبر
  const playNextRef = useRef(playNext);
  const playPrevRef = useRef(playPrev);
  const peekNextRef = useRef(peekNext);
  const onToggleFavoriteRef = useRef(onToggleFavorite);
  const onSongStartedRef = useRef(onSongStarted);
  const songDurationRef = useRef<number>(currentSong?.duration || 0);

  useEffect(() => {
    playNextRef.current = playNext;
    playPrevRef.current = playPrev;
    peekNextRef.current = peekNext;
    onToggleFavoriteRef.current = onToggleFavorite;
    onSongStartedRef.current = onSongStarted;
    songDurationRef.current = currentSong?.duration || 0;
  });

  const getLivePlaybackTime = useCallback(() => {
    const audio = getActiveAudio();
    if (!audio) return null;
    const liveDur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : songDurationRef.current > 0
        ? songDurationRef.current
        : 0;
    return {
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: liveDur,
    };
  }, [getActiveAudio]);

  // همگام‌سازی ولوم ایمن (با رمپ ضدخش Web Audio)، سرعت پخش و حفظ زیر و بمی روی هر دو دک صوتی
  useEffect(() => {
    audioEffects.setMasterVolume(effectiveVolume);
    applyDeckPlaybackParams(
      audioRefA.current,
      effectiveVolume,
      soundSettings.playbackSpeed,
      soundSettings.preservePitch
    );
    applyDeckPlaybackParams(
      audioRefB.current,
      effectiveVolume,
      soundSettings.playbackSpeed,
      soundSettings.preservePitch
    );
    if (volume > 0) {
      lastNonZeroVolumeRef.current = volume;
    }
  }, [volume, effectiveVolume, soundSettings.playbackSpeed, soundSettings.preservePitch]);

  // اتصال هر دو دک صوتی به موتور اکولایزر و افکت‌ها
  useEffect(() => {
    if (audioRefA.current) audioEffects.attach(audioRefA.current);
    if (audioRefB.current) audioEffects.attach(audioRefB.current);
    return () => {
      if (pauseFadeTimerRef.current) window.clearTimeout(pauseFadeTimerRef.current);
      if (crossfadeCleanupTimerRef.current) window.clearTimeout(crossfadeCleanupTimerRef.current);
    };
  }, []);

  // نمایش نام آهنگ در نوار عنوان پنجره و تسک‌بار ویندوز هنگام پخش
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (currentSong && isPlaying) {
      document.title = `▶ ${currentSong.name} - ${currentSong.artist} | Prism Music`;
    } else if (currentSong) {
      document.title = `${currentSong.name} - ${currentSong.artist} | Prism Music`;
    } else {
      document.title = 'Prism Music';
    }
  }, [currentSong, isPlaying]);

  // بازیابی زمان آخرین پخش (فقط اگر playToken == 0 و گزینه ذخیره موقعیت فعال باشد)
  useEffect(() => {
    if (!playbackPrefs.rememberPlaybackPosition) {
      pendingResumeTimeRef.current = null;
      try {
        localStorage.removeItem(STORAGE_KEYS.lastPlayback);
      } catch {
        // نادیده گرفتن خطا
      }
      return;
    }
    if (playToken !== 0 || !currentSong) return;
    const saved = readJSON<{ songId?: string; currentTime?: number } | null>(
      STORAGE_KEYS.lastPlayback,
      null
    );
    if (saved && saved.songId === currentSong.id && typeof saved.currentTime === 'number' && saved.currentTime > 0) {
      pendingResumeTimeRef.current = saved.currentTime;
    }
  }, [currentSong, playToken, playbackPrefs.rememberPlaybackPosition]);

  // بارگذاری و پخش آهنگ با پشتیبانی از Crossfade و Gapless و Fade
  useEffect(() => {
    if (currentSong && skipNextLoadRef.current === currentSong.id) {
      skipNextLoadRef.current = null;
      preloadedRef.current = null;
      countedRef.current = false;
      retriedRecoveryRef.current = null;
      const active = getActiveAudio();
      if (active) {
        setDuration(active.duration || songDurationRef.current || 0);
        setCurrentTime(active.currentTime || 0);
      }
      return;
    }

    if (crossfadeCleanupTimerRef.current) {
      window.clearTimeout(crossfadeCleanupTimerRef.current);
      crossfadeCleanupTimerRef.current = null;
    }
    if (pauseFadeTimerRef.current) {
      window.clearTimeout(pauseFadeTimerRef.current);
      pauseFadeTimerRef.current = null;
    }
    crossfadingToIdRef.current = null;
    preloadedRef.current = null;

    const standby = getStandbyAudio();
    if (standby) {
      audioEffects.cancelDeckFade(standby);
      standby.pause();
      standby.removeAttribute('src');
      standby.load();
      audioEffects.setDeckGain(standby, 1, 0);
    }

    const audio = getActiveAudio();
    if (!audio) return;
    countedRef.current = false;
    retriedRecoveryRef.current = null;
    audioEffects.attach(audio);
    audioEffects.cancelDeckFade(audio);
    applyDeckPlaybackParams(
      audio,
      effectiveVolume,
      soundSettings.playbackSpeed,
      soundSettings.preservePitch
    );

    if (!songUrl) {
      setCurrentTime(0);
      setDuration(0);
      handlePlayState(false);
      if (!audio.paused) {
        audioEffects.setDeckGain(audio, 0, 0.024);
        pauseFadeTimerRef.current = window.setTimeout(() => {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
          pauseFadeTimerRef.current = null;
        }, 32);
      } else {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

    setDuration(songDurationRef.current || 0);
    audio.src = songUrl;

    if (playToken === 0) {
      audioEffects.setDeckGain(audio, 1, 0);
      const resumeAt = pendingResumeTimeRef.current ?? 0;
      setCurrentTime(resumeAt);
      const applyResumeTime = () => {
        if (pendingResumeTimeRef.current !== null && Number.isFinite(audio.duration)) {
          const clamped = Math.min(pendingResumeTimeRef.current, audio.duration || pendingResumeTimeRef.current);
          audio.currentTime = clamped;
          setCurrentTime(clamped);
          pendingResumeTimeRef.current = null;
        }
      };
      audio.addEventListener('loadedmetadata', applyResumeTime, { once: true });
      return () => audio.removeEventListener('loadedmetadata', applyResumeTime);
    }

    setCurrentTime(0);
    pendingResumeTimeRef.current = null;
    suppressNextPauseSyncRef.current = false;
    audioEffects.resumeContext();
    audioEffects.setDeckGain(audio, 0.001, 0);
    audio
      .play()
      .then(() => {
        audioEffects.setDeckGain(audio, 1, soundSettings.fadeOnPlayPause ? 0.2 : 0.022);
        handlePlayState(true);
      })
      .catch((err: unknown) => {
        audioEffects.setDeckGain(audio, 1, 0);
        if (err instanceof DOMException && err.name === 'AbortError') return;
        handlePlayState(false);
        console.error(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songUrl, playToken, handlePlayState]);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // ذخیره زمان فعلی پخش هنگام بستن پنجره ویندوز (بدون ثبت مجدد لیسنر در هر تیک پخش)
  useEffect(() => {
    const savePlaybackPosition = () => {
      if (!currentSong) return;
      const tPos = getActiveAudio()?.currentTime ?? currentTimeRef.current;
      writeJSON(STORAGE_KEYS.lastPlayback, { songId: currentSong.id, currentTime: tPos });
    };
    window.addEventListener('beforeunload', savePlaybackPosition);
    window.addEventListener('pagehide', savePlaybackPosition);
    return () => {
      window.removeEventListener('beforeunload', savePlaybackPosition);
      window.removeEventListener('pagehide', savePlaybackPosition);
    };
  }, [currentSong, getActiveAudio]);

  const handleTimeUpdate = (deck: 'A' | 'B') => {
    if (deck !== activeDeckRef.current) return;
    if (pauseFadeTimerRef.current) return;
    const audio = getActiveAudio();
    if (!audio || audio.paused) return;
    if (!isPlaying) {
      handlePlayState(true);
    }
    const nowTime = audio.currentTime;
    const totalDur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : songDurationRef.current || 0;
    setCurrentTime(nowTime);
    setDuration(totalDur);

    const nowMs = Date.now();
    if (nowMs - lastPosSyncRef.current > 950) {
      lastPosSyncRef.current = nowMs;
      syncMediaSessionPosition(totalDur, nowTime, audio.playbackRate || 1);
    }
    if (playbackPrefs.rememberPlaybackPosition && currentSong && nowMs - lastPlaybackSaveRef.current > 4000) {
      lastPlaybackSaveRef.current = nowMs;
      writeJSON(STORAGE_KEYS.lastPlayback, { songId: currentSong.id, currentTime: nowTime });
    }

    if (currentSong && !countedRef.current) {
      const effectiveDur =
        Number.isFinite(totalDur) && totalDur > 0
          ? totalDur
          : songDurationRef.current > 0
          ? songDurationRef.current
          : Infinity;
      const threshold = Math.min(PLAY_COUNT_THRESHOLD_SECONDS, effectiveDur / 2);
      if (nowTime >= threshold) {
        countedRef.current = true;
        onSongPlayed(currentSong.id);
      }
    }

    // مدیریت Crossfade و پیش‌بارگذاری Gapless
    if (
      totalDur > 0 &&
      Number.isFinite(totalDur) &&
      repeatMode !== 'one' &&
      sleepTimer?.mode !== 'songEnd'
    ) {
      const remaining = totalDur - nowTime;
      const crossfadeSec = soundSettings.crossfadeSeconds || 0;

      if (
        crossfadeSec > 0 &&
        totalDur > crossfadeSec * 2 + 2 &&
        remaining <= crossfadeSec &&
        remaining > 0.25 &&
        !crossfadingToIdRef.current
      ) {
        const nextSong = peekNextRef.current?.() ?? null;
        const standby = getStandbyAudio();
        if (nextSong && standby) {
          crossfadingToIdRef.current = nextSong.id;
          const outgoing = audio;
          const nextDeck: 'A' | 'B' = activeDeckRef.current === 'A' ? 'B' : 'A';
          audioEffects.attach(standby);
          applyDeckPlaybackParams(
            standby,
            effectiveVolume,
            soundSettings.playbackSpeed,
            soundSettings.preservePitch
          );
          if (preloadedRef.current?.songId !== nextSong.id) {
            standby.src = nextSong.fileUrl;
            standby.currentTime = 0;
          }
          audioEffects.setDeckGain(standby, 0.001, 0);
          activeDeckRef.current = nextDeck;
          skipNextLoadRef.current = nextSong.id;

          const fadeDur = Math.max(0.4, Math.min(crossfadeSec, remaining));
          standby
            .play()
            .then(() => {
              audioEffects.setDeckGain(standby, 1, fadeDur);
              audioEffects.setDeckGain(outgoing, 0, fadeDur);
              crossfadeCleanupTimerRef.current = window.setTimeout(() => {
                outgoing.pause();
                outgoing.removeAttribute('src');
                outgoing.load();
                audioEffects.setDeckGain(outgoing, 1, 0);
                crossfadingToIdRef.current = null;
              }, fadeDur * 1000 + 80);
              playNextRef.current();
            })
            .catch(() => {
              activeDeckRef.current = nextDeck === 'A' ? 'B' : 'A';
              skipNextLoadRef.current = null;
              crossfadingToIdRef.current = null;
              audioEffects.setDeckGain(standby, 1, 0);
            });
        }
      } else if (
        crossfadeSec === 0 &&
        soundSettings.gaplessPlayback &&
        totalDur > 5 &&
        remaining <= 3.5 &&
        remaining > 0.2
      ) {
        const nextSong = peekNextRef.current?.() ?? null;
        const standby = getStandbyAudio();
        if (nextSong && standby && preloadedRef.current?.songId !== nextSong.id) {
          preloadedRef.current = { songId: nextSong.id, url: nextSong.fileUrl };
          standby.src = nextSong.fileUrl;
          standby.preload = 'auto';
          standby.load();
        }
      }
    }
  };

  const fadeOutAndPauseDeck = useCallback(
    (audio: HTMLAudioElement | null, onAfterPause?: () => void) => {
      if (!audio) {
        onAfterPause?.();
        return;
      }
      if (pauseFadeTimerRef.current) {
        window.clearTimeout(pauseFadeTimerRef.current);
        pauseFadeTimerRef.current = null;
      }
      if (audio.paused) {
        audioEffects.setDeckGain(audio, 0, 0);
        handlePlayState(false);
        onAfterPause?.();
        return;
      }
      const fadeSec = soundSettings.fadeOnPlayPause ? 0.06 : 0.018;
      const waitMs = soundSettings.fadeOnPlayPause ? 68 : 24;
      const snapTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setCurrentTime(snapTime);
      audioEffects.setDeckGain(audio, 0, fadeSec);
      handlePlayState(false);
      pauseFadeTimerRef.current = window.setTimeout(() => {
        suppressNextPauseSyncRef.current = true;
        audio.pause();
        // گین را در 0 نگه می‌داریم و به 1 برنمی‌گردانیم تا هیچ تیک صوتی در لحظه توقف رخ ندهد
        audioEffects.setDeckGain(audio, 0, 0);
        pauseFadeTimerRef.current = null;
        onAfterPause?.();
      }, waitMs);
    },
    [handlePlayState, soundSettings.fadeOnPlayPause]
  );

  const togglePlay = useCallback(() => {
    const audio = getActiveAudio();
    if (!audio || !currentSong) return;
    audioEffects.resumeContext();

    // اگر کاربر وسط انیمیشن توقف دوباره Play زد، بلافاصله رمپ توقف لغو و صدا بازگردانده شود
    if (pauseFadeTimerRef.current) {
      window.clearTimeout(pauseFadeTimerRef.current);
      pauseFadeTimerRef.current = null;
      suppressNextPauseSyncRef.current = false;
      audioEffects.setDeckGain(audio, 1, soundSettings.fadeOnPlayPause ? 0.14 : 0.022);
      handlePlayState(true);
      return;
    }

    if (audio.paused) {
      suppressNextPauseSyncRef.current = false;
      audioEffects.setDeckGain(audio, 0.001, 0);
      audio
        .play()
        .then(() => {
          audioEffects.setDeckGain(audio, 1, soundSettings.fadeOnPlayPause ? 0.18 : 0.022);
          handlePlayState(true);
          if (playToken === 0) {
            onSongStartedRef.current?.(currentSong.id);
          }
        })
        .catch(console.error);
    } else {
      fadeOutAndPauseDeck(audio);
    }
  }, [currentSong, fadeOutAndPauseDeck, getActiveAudio, handlePlayState, playToken, soundSettings.fadeOnPlayPause]);

  useEffect(() => {
    const handleExternalToggle = () => {
      togglePlay();
    };
    window.addEventListener('app:toggle-play', handleExternalToggle);
    return () => window.removeEventListener('app:toggle-play', handleExternalToggle);
  }, [togglePlay]);

  useEffect(() => {
    const handleExternalOpenFullScreen = () => {
      if (currentSong) setIsNowPlayingOpen(true);
    };
    window.addEventListener('app:open-fullscreen', handleExternalOpenFullScreen);
    return () =>
      window.removeEventListener('app:open-fullscreen', handleExternalOpenFullScreen);
  }, [currentSong]);

  useEffect(() => {
    if (!sleepTimer || sleepTimer.mode !== 'until') return;
    const remainingMs = Math.max(0, sleepTimer.endsAt - Date.now());
    const timer = window.setTimeout(() => {
      const active = getActiveAudio();
      const standby = getStandbyAudio();
      if (standby && !standby.paused) {
        audioEffects.setDeckGain(standby, 0, 0.026);
        window.setTimeout(() => standby.pause(), 34);
      } else {
        standby?.pause();
      }
      fadeOutAndPauseDeck(active, () => {
        onClearSleepTimer?.();
      });
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [sleepTimer, fadeOutAndPauseDeck, getActiveAudio, getStandbyAudio, onClearSleepTimer]);

  const toggleRepeat = useCallback(() => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  }, [repeatMode, setRepeatMode]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Math.min(maxVolFactor, Number(e.target.value));
    setVolume(vol);
    audioEffects.setMasterVolume(vol);
    applyDeckPlaybackParams(audioRefA.current, vol, soundSettings.playbackSpeed, soundSettings.preservePitch);
    applyDeckPlaybackParams(audioRefB.current, vol, soundSettings.playbackSpeed, soundSettings.preservePitch);
  };

  const handleSeek = useCallback(
    (newTime: number) => {
      const audio = getActiveAudio();
      if (!audio || !Number.isFinite(newTime)) return;
      const maxDur = audio.duration || duration || 0;
      const clamped = Math.max(0, maxDur ? Math.min(maxDur, newTime) : newTime);
      audio.currentTime = clamped;
      setCurrentTime(clamped);
      syncMediaSessionPosition(maxDur, clamped, audio.playbackRate || 1);
    },
    [duration, getActiveAudio]
  );

  const handleSeekRef = useRef(handleSeek);
  useEffect(() => {
    handleSeekRef.current = handleSeek;
  }, [handleSeek]);

  const handleDirectVolumeChange = useCallback(
    (newVol: number) => {
      const clamped = Math.max(0, Math.min(maxVolFactor, Math.round(newVol * 100) / 100));
      setVolume(clamped);
      audioEffects.setMasterVolume(clamped);
      applyDeckPlaybackParams(
        audioRefA.current,
        clamped,
        soundSettings.playbackSpeed,
        soundSettings.preservePitch
      );
      applyDeckPlaybackParams(
        audioRefB.current,
        clamped,
        soundSettings.playbackSpeed,
        soundSettings.preservePitch
      );
    },
    [maxVolFactor, setVolume, soundSettings.playbackSpeed, soundSettings.preservePitch]
  );

  const handleToggleMute = useCallback(() => {
    if (volume > 0) {
      lastNonZeroVolumeRef.current = volume;
      handleDirectVolumeChange(0);
    } else {
      handleDirectVolumeChange(lastNonZeroVolumeRef.current > 0 ? lastNonZeroVolumeRef.current : 1);
    }
  }, [volume, handleDirectVolumeChange]);

  // کلیدهای میانبر دسکتاپ ویندوز
  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onNext: () => playNextRef.current(),
    onPrev: () => playPrevRef.current(),
    onSeekBy: (delta) => {
      const audio = getActiveAudio();
      if (!audio || !currentSong) return;
      handleSeekRef.current(audio.currentTime + delta);
    },
    onSeekPercent: (fraction) => {
      if (!currentSong) return;
      const live = getLivePlaybackTime();
      if (live && live.duration > 0) {
        handleSeekRef.current(live.duration * fraction);
      }
    },
    onVolumeBy: (delta) => handleDirectVolumeChange(volume + delta),
    onToggleMute: handleToggleMute,
    onToggleShuffle: () => setIsShuffle(!isShuffle),
    onCycleRepeat: toggleRepeat,
    onToggleFavoriteCurrent: () => {
      if (currentSong) onToggleFavoriteRef.current?.(currentSong.id);
    },
    onToggleQueue: () => {
      if (isNowPlayingOpen) {
        setShowFsQueue((prev) => !prev);
      } else {
        setShowQueue((prev) => !prev);
      }
    },
    onToggleFullScreen: () => {
      if (currentSong) {
        setIsNowPlayingOpen((prev) => {
          if (prev) setShowFsQueue(false);
          return !prev;
        });
      }
    },
    onOpenSearch: () => window.dispatchEvent(new CustomEvent('app:open-search')),
    onOpenSettings: () => onOpenSettings?.(),
    onSelectTabIndex: (idx) => onSelectTabIndex?.(idx),
  }, playbackPrefs.seekStepSeconds);

  useEffect(() => {
    syncMediaSession(currentSong, isPlaying, {
      onPlay: () => {
        const audio = getActiveAudio();
        if (!audio) return;
        audioEffects.resumeContext();
        audioEffects.setDeckGain(audio, 0.001, 0);
        audio
          .play()
          .then(() => {
            audioEffects.setDeckGain(audio, 1, soundSettings.fadeOnPlayPause ? 0.18 : 0.022);
            handlePlayState(true);
          })
          .catch(console.error);
      },
      onPause: () => {
        fadeOutAndPauseDeck(getActiveAudio());
      },
      onNext: () => {
        playNextRef.current();
      },
      onPrev: () => {
        playPrevRef.current();
      },
      onSeek: (time) => {
        handleSeekRef.current(time);
      },
    });
  }, [currentSong, isPlaying, fadeOutAndPauseDeck, getActiveAudio, handlePlayState, soundSettings.fadeOnPlayPause]);

  const handleDurationSync = (deck: 'A' | 'B') => {
    if (deck !== activeDeckRef.current) return;
    const audio = getActiveAudio();
    if (!audio) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }
  };

  const handleSongEnd = (deck: 'A' | 'B') => {
    if (deck !== activeDeckRef.current) return;
    if (currentSong && !countedRef.current) {
      countedRef.current = true;
      onSongPlayed(currentSong.id);
    }
    if (sleepTimer?.mode === 'songEnd') {
      const active = getActiveAudio();
      const endDur =
        active && Number.isFinite(active.duration) && active.duration > 0
          ? active.duration
          : duration;
      if (endDur > 0) setCurrentTime(endDur);
      handlePlayState(false);
      onClearSleepTimer?.();
      return;
    }
    if (repeatMode === 'one') {
      const audio = getActiveAudio();
      if (audio) {
        countedRef.current = false;
        audio.currentTime = 0;
        setCurrentTime(0);
        if (currentSong) onSongStartedRef.current?.(currentSong.id);
        audio.play().catch(console.error);
      }
      return;
    }

    // پخش بدون وقفه (Gapless) در صورت آماده بودن دک دوم
    if (
      soundSettings.gaplessPlayback &&
      soundSettings.crossfadeSeconds === 0
    ) {
      const nextSong = peekNextRef.current?.() ?? null;
      const standby = getStandbyAudio();
      const outgoing = getActiveAudio();
      if (
        nextSong &&
        standby &&
        preloadedRef.current?.songId === nextSong.id &&
        standby.readyState >= 2
      ) {
        const nextDeck: 'A' | 'B' = activeDeckRef.current === 'A' ? 'B' : 'A';
        audioEffects.attach(standby);
        applyDeckPlaybackParams(
          standby,
          effectiveVolume,
          soundSettings.playbackSpeed,
          soundSettings.preservePitch
        );
        audioEffects.setDeckGain(standby, 1, 0);
        activeDeckRef.current = nextDeck;
        skipNextLoadRef.current = nextSong.id;
        standby
          .play()
          .then(() => {
            if (outgoing) {
              outgoing.pause();
              outgoing.removeAttribute('src');
              outgoing.load();
            }
            playNextRef.current();
          })
          .catch(() => {
            activeDeckRef.current = nextDeck === 'A' ? 'B' : 'A';
            skipNextLoadRef.current = null;
            if (!playNextRef.current()) handlePlayState(false);
          });
        return;
      }
    }

    if (!playNext()) {
      const active = getActiveAudio();
      const endDur =
        active && Number.isFinite(active.duration) && active.duration > 0
          ? active.duration
          : duration;
      if (endDur > 0) setCurrentTime(endDur);
      handlePlayState(false);
    }
  };

  // بازیابی خودکار از IndexedDB برای ترک‌های کپی‌شده، یا علامت‌گذاری فایل مفقود برای ترک‌های متصل به هارد
  const handleAudioError = async (deck: 'A' | 'B') => {
    if (deck !== activeDeckRef.current) return;
    const audio = getActiveAudio();
    if (currentSong && currentSong.sourcePath) {
      if (!currentSong.fileMissing) {
        onUpdateSong?.({ ...currentSong, fileMissing: true });
      }
      handlePlayState(false);
      return;
    }
    if (currentSong && audio && retriedRecoveryRef.current !== currentSong.id) {
      retriedRecoveryRef.current = currentSong.id;
      const blob = await getAudioBlob(currentSong.id);
      if (blob) {
        const freshUrl = URL.createObjectURL(blob);
        onUpdateSong?.({ ...currentSong, fileUrl: freshUrl });
        audio.src = freshUrl;
        audio.play().then(() => handlePlayState(true)).catch(() => handlePlayState(false));
        return;
      }
    }
    handlePlayState(false);
  };

  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = viewport.width < 768;
  const isCompactDesktop = !isMobile && viewport.width < 960;
  const isShortWindow = !isMobile && viewport.height < 680;

  const volumePercent = effectiveVolume * 100;

  // # درخشش نوار پیشرفت (بر اساس پالت)
  const glowColor = `0 0 14px ${theme.colors.glow || theme.colors.primary}`;

  // # رنگ‌ها و متریال هماهنگ با پالت فعال (تم روشن/تاریک)
  const palette = getBarPalette(theme);
  const songTitleColor = palette.title;
  const artistColor = palette.secondary;
  const iconColor = palette.icon;
  const iconActiveColor = theme.colors.primary;
  const iconInactiveColor = palette.iconDim;

  const btnStyle = {
    background: 'none',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  };

  const isDocked = displaySettings.playerBarStyle === 'docked';

  return (
      <div
        style={{
          boxSizing: 'border-box',
          height: isMobile ? '66px' : isCompactDesktop || isShortWindow ? '80px' : '92px',
          width: isDocked ? '100%' : isMobile ? '320px' : '92%',
          maxWidth: isDocked ? '100%' : isMobile ? 'calc(100% - 24px)' : '1040px',
          // # سطح شیشه‌ای نوار (پس‌زمینه، لبه، بلور و سایه) از تم می‌آید
          background: theme.glass.bar.background,
          backdropFilter: theme.glass.bar.backdropFilter || `blur(${theme.display?.playerBarBlur ?? theme.display?.glassBlur ?? 28}px) saturate(190%)`,
          WebkitBackdropFilter: theme.glass.bar.backdropFilter || `blur(${theme.display?.playerBarBlur ?? theme.display?.glassBlur ?? 28}px) saturate(190%)`,
          borderRadius: isDocked ? '0px' : isMobile ? theme.radius.lg || '18px' : theme.radius.xl || '24px',
          margin: isDocked
            ? '0'
            : isMobile
            ? '0 auto 12px auto'
            : isShortWindow || isCompactDesktop
            ? '0 auto 10px auto'
            : '0 auto 16px auto',
          display: isMobile ? 'flex' : 'grid',
          gridTemplateColumns: isMobile
            ? undefined
            : isCompactDesktop
            ? 'minmax(0, 1fr) minmax(240px, min(500px, 46%)) minmax(0, 1fr)'
            : 'minmax(0, 1fr) minmax(280px, min(560px, 48%)) minmax(0, 1fr)',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : undefined,
          padding: isMobile ? '0 10px' : isCompactDesktop ? '0 16px' : '0 24px',
          position: 'relative',
          color: songTitleColor,
          zIndex: 20,
          boxShadow: isDocked ? '0 -8px 28px rgba(0,0,0,0.22)' : theme.glass.bar.boxShadow,
          border: isDocked ? 'none' : theme.glass.bar.border,
          borderTop: isDocked ? theme.glass.bar.border : theme.glass.bar.border,
          gap: isMobile ? '8px' : isCompactDesktop ? '10px' : '14px',
        }}
      >
        <style>{BUTTON_CSS}</style>

        {/* # کامپوننت حرفه‌ای صف پخش (دسکتاپ و موبایل) */}
        <QueueDrawer
          isOpen={showQueue}
          onClose={() => setShowQueue(false)}
          queue={queue}
          currentSong={currentSong}
          currentQueueIndex={currentQueueIndex}
          isPlaying={isPlaying}
          onPlaySong={(idx: number) => onPlayQueueSong?.(idx)}
          onRemoveFromQueue={removeFromQueue}
          onRemoveSelectedFromQueue={removeFromQueueIndices}
          onPlayNextInQueue={onPlayNextInQueue}
          onReorderQueue={reorderQueue}
          onClearQueue={() => onClearQueue?.()}
          onShuffleQueue={() => onShuffleQueue?.()}
          onCreatePlaylist={onCreatePlaylist}
          theme={theme}
          t={t}
          isMobile={isMobile}
        />

      {/* # اطلاعات آهنگ (کلیک برای باز کردن تمام صفحه) */}
      <div
        onClick={() => currentSong && setIsNowPlayingOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '10px' : '12px',
          width: isMobile ? 'auto' : '100%',
          maxWidth: isMobile ? undefined : '280px',
          flex: isMobile ? 1 : undefined,
          justifySelf: isMobile ? undefined : 'start',
          minWidth: 0,
          cursor: currentSong ? 'pointer' : 'default',
        }}
      >
        {currentSong ? (
          <>
            <CoverImage
              src={currentSong.cover}
              alt=""
              iconSize={isMobile ? 18 : 20}
              iconColor={palette.iconDim}
              fallbackBg={theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
              style={{
                width: isMobile ? '42px' : '48px',
                height: isMobile ? '42px' : '48px',
                minWidth: isMobile ? '42px' : '48px',
                borderRadius: theme.radius.sm,
                objectFit: 'cover',
                border: theme.isDark
                  ? '1px solid rgba(255, 255, 255, 0.16)'
                  : '1px solid rgba(0, 0, 0, 0.12)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}
            />
            <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
              <MarqueeText
                text={currentSong.name}
                speedPxPerSec={32}
                gapPx={36}
                style={{
                  fontWeight: '600',
                  fontSize: isMobile ? '0.8125rem' : '0.875rem',
                  color: songTitleColor,
                }}
              />
              <MarqueeText
                text={currentSong.artist}
                speedPxPerSec={30}
                gapPx={36}
                style={{
                  color: artistColor,
                  fontSize: isMobile ? '0.6875rem' : '0.75rem',
                  marginTop: '2px',
                }}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              color: artistColor,
              fontSize: isMobile ? '0.8125rem' : '0.875rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t.noSongSelected || '---'}
          </div>
        )}
      </div>

      {/* # کنترل‌ها و نوار پیشرفت */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: isMobile ? 'auto' : '100%',
          maxWidth: isMobile ? 'none' : '100%',
          justifySelf: isMobile ? undefined : 'center',
          paddingBottom: isMobile ? '0' : '4px',
        }}
      >
        {/* نوار پیشرفت فقط در دسکتاپ نمایش داده می‌شود */}
        {!isMobile && (
          <div style={{ width: '100%', marginTop: '0px', marginBottom: '4px' }}>
            <ProgressScrubber
              songKey={currentSong?.id || 'none'}
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              isPlaying={isPlaying}
              getLiveTime={getLivePlaybackTime}
              primaryColor={theme.colors.primary}
              trackBgColor={theme.isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.1)'}
              timeTextColor={artistColor}
              glowColor={glowColor}
              isDarkSurface={theme.isDark}
              tooltipTextColor={theme.colors.textPrimary}
              variant="bar"
              seekStepSeconds={playbackPrefs.seekStepSeconds}
            />
          </div>
        )}

        {/* دکمه‌های کنترل */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '2px' : isCompactDesktop ? '14px' : '24px',
          }}
        >
          {!isMobile && (
            <button
              className="pb-btn"
              onClick={() => setIsShuffle(!isShuffle)}
              title={`${isShuffle ? (t.shuffleOn || 'Shuffle On') : (t.shuffleOff || 'Shuffle Off')} (S)`}
              style={{
                ...btnStyle,
                width: isCompactDesktop ? '32px' : '36px',
                height: isCompactDesktop ? '32px' : '36px',
                position: 'relative',
                color: isShuffle ? iconActiveColor : iconInactiveColor,
              }}
            >
              <svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M0 3.5A.5.5 0 0 1 .5 3H1c2.202 0 3.827 1.24 4.874 2.418.49.552.865 1.102 1.126 1.532.26-.43.636-.98 1.126-1.532C9.173 4.24 10.798 3 13 3v1c-1.798 0-3.173 1.01-4.126 2.082A9.6 9.6 0 0 0 7.556 8a9.6 9.6 0 0 0 1.317 1.918C9.828 10.99 11.204 12 13 12v1c-2.202 0-3.827-1.24-4.874-2.418A10.6 10.6 0 0 1 7 9.05c-.26.43-.636.98-1.126 1.532C4.827 11.76 3.202 13 1 13H.5a.5.5 0 0 1 0-1H1c1.798 0 3.173-1.01 4.126-2.082A9.6 9.6 0 0 0 6.444 8a9.6 9.6 0 0 0-1.317-1.918C4.172 5.01 2.796 4 1 4H.5a.5.5 0 0 1-.5-.5"
                />
                <path d="M13 5.466V1.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192m0 9v-3.932a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192" />
              </svg>
              {isShuffle && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: iconActiveColor,
                    boxShadow: glowColor,
                  }}
                />
              )}
            </button>
          )}

          <button
            className="pb-btn"
            onClick={(e) => {
              e.stopPropagation();
              playPrev();
            }}
            title={t.previous || 'Previous'}
            style={{
              ...btnStyle,
              width: isMobile ? '26px' : isCompactDesktop ? '36px' : '42px',
              height: isMobile ? '26px' : isCompactDesktop ? '36px' : '42px',
              color: iconColor,
            }}
          >
            <svg width={isMobile ? '17' : isCompactDesktop ? '22' : '27'} height={isMobile ? '17' : isCompactDesktop ? '22' : '27'} viewBox="0 0 16 16" fill="currentColor">
              <path d="M8.404 7.304a.802.802 0 0 0 0 1.392l6.363 3.692c.52.302 1.233-.043 1.233-.696V4.308c0-.653-.713-.998-1.233-.696z" />
              <path d="M.404 7.304a.802.802 0 0 0 0 1.392l6.363 3.692c.52.302 1.233-.043 1.233-.696V4.308c0-.653-.713-.998-1.233-.696z" />
            </svg>
          </button>

          <button
            className="pb-btn"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            title={isPlaying ? t.pause || 'Pause' : t.play || 'Play'}
            style={{
              ...btnStyle,
              width: isMobile ? '32px' : isCompactDesktop ? '42px' : '48px',
              height: isMobile ? '32px' : isCompactDesktop ? '42px' : '48px',
              color: iconColor,
              flexShrink: 0,
            }}
          >
            {isPlaying ? (
              <svg width={isMobile ? '22' : isCompactDesktop ? '32' : '38'} height={isMobile ? '22' : isCompactDesktop ? '32' : '38'} viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5" />
              </svg>
            ) : (
              <svg
                width={isMobile ? '22' : isCompactDesktop ? '32' : '38'}
                height={isMobile ? '22' : isCompactDesktop ? '32' : '38'}
                viewBox="0 0 16 16"
                fill="currentColor"
                style={{ transform: 'translateX(1.5px)' }}
              >
                <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
              </svg>
            )}
          </button>

          <button
            className="pb-btn"
            onClick={(e) => {
              e.stopPropagation();
              playNext();
            }}
            title={t.next || 'Next'}
            style={{
              ...btnStyle,
              width: isMobile ? '26px' : isCompactDesktop ? '36px' : '42px',
              height: isMobile ? '26px' : isCompactDesktop ? '36px' : '42px',
              color: iconColor,
            }}
          >
            <svg width={isMobile ? '17' : isCompactDesktop ? '22' : '27'} height={isMobile ? '17' : isCompactDesktop ? '22' : '27'} viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C.713 12.69 0 12.345 0 11.692V4.308c0-.653.713-.998 1.233-.696z" />
              <path d="M15.596 7.304a.802.802 0 0 1 0 1.392l-6.363 3.692C8.713 12.69 8 12.345 8 11.692V4.308c0-.653.713-.998 1.233-.696z" />
            </svg>
          </button>

          {!isMobile && (
            <button
              className="pb-btn"
              onClick={() => toggleRepeat()}
              title={`${
                repeatMode === 'one'
                  ? t.repeatOne || 'Repeat One'
                  : repeatMode === 'all'
                  ? t.repeatAll || 'Repeat All'
                  : t.repeatOff || 'Repeat Off'
              } (R)`}
              style={{
                ...btnStyle,
                width: isCompactDesktop ? '32px' : '36px',
                height: isCompactDesktop ? '32px' : '36px',
                position: 'relative',
                color: repeatMode !== 'off' ? iconActiveColor : iconInactiveColor,
              }}
            >
              {repeatMode === 'one' ? (
                <svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11 4v1.466a.25.25 0 0 0 .41.192l2.36-1.966a.25.25 0 0 0 0-.384l-2.36-1.966a.25.25 0 0 0-.41.192V3H5a5 5 0 0 0-4.48 7.223.5.5 0 0 0 .896-.446A4 4 0 0 1 5 4zm4.48 1.777a.5.5 0 0 0-.896.446A4 4 0 0 1 11 12H5.001v-1.466a.25.25 0 0 0-.41-.192l-2.36 1.966a.25.25 0 0 0 0 .384l2.36 1.966a.25.25 0 0 0 .41-.192V13h6a5 5 0 0 0 4.48-7.223Z" />
                  <path d="M9 5.5a.5.5 0 0 0-.854-.354l-1.75 1.75a.5.5 0 1 0 .708.708L8 6.707V10.5a.5.5 0 0 0 1 0z" />
                </svg>
              ) : (
                <svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11 5.466V4H5a4 4 0 0 0-3.584 5.777.5.5 0 1 1-.896.446A5 5 0 0 1 5 3h6V1.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384l-2.36 1.966a.25.25 0 0 1-.41-.192m3.81.086a.5.5 0 0 1 .67.225A5 5 0 0 1 11 13H5v1.466a.25.25 0 0 1-.41.192l-2.36-1.966a.25.25 0 0 1 0-.384l2.36-1.966a.25.25 0 0 1 .41.192V12h6a4 4 0 0 0 3.585-5.777.5.5 0 0 1 .225-.67Z" />
                </svg>
              )}
              {repeatMode !== 'off' && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: iconActiveColor,
                    boxShadow: glowColor,
                  }}
                />
              )}
            </button>
          )}
        </div>
      </div>

      {/* # کنترل صدا، علاقه‌مندی و صف فقط در دسکتاپ */}
      {!isMobile && (
        <div
          style={{
            minWidth: 0,
            width: '100%',
            justifySelf: 'end',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '34px' }}
            onMouseEnter={() => setIsHoveringVolume(true)}
            onMouseLeave={() => setIsHoveringVolume(false)}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.05 : -0.05;
              handleDirectVolumeChange(volume + delta);
            }}
          >
            <button
              className="pb-btn"
              onClick={handleToggleMute}
              title={`${volume === 0 ? (t.unmute || 'Unmute') : (t.mute || 'Mute')} (M)`}
              style={{
                ...btnStyle,
                width: '32px',
                height: '32px',
                color: iconInactiveColor,
              }}
            >
              {volume === 0 ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                height: isHoveringVolume ? '128px' : '0px',
                width: '40px',
                opacity: isHoveringVolume ? 1 : 0,
                overflow: 'hidden',
                transition: 'opacity 0.2s ease, height 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
                backgroundColor: withAlpha(theme.colors.surfaceSolid || theme.colors.background, 0.96),
                backdropFilter: 'blur(16px)',
                borderRadius: theme.radius.lg,
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: isHoveringVolume ? '10px 0' : '0',
                marginBottom: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              {/* # درصد صدا */}
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: theme.colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round(volumePercent)}
              </span>
              <div style={{ position: 'relative', width: '20px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.1)',
                    borderRadius: '2px',
                    left: '8px',
                  }}
                ></div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    height: `${volumePercent}%`,
                    width: '4px',
                    backgroundColor: theme.colors.primary,
                    borderRadius: '2px',
                    left: '8px',
                  }}
                ></div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={effectiveVolume}
                  onChange={handleVolumeChange}
                  style={{
                    position: 'absolute',
                    width: '80px',
                    height: '20px',
                    transform: 'rotate(-90deg)',
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 2,
                    left: '-30px',
                    top: '30px',
                  }}
                />
              </div>
            </div>
          </div>

          {currentSong && onToggleFavorite && (
            <button
              type="button"
              className="pb-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(currentSong.id);
                if (heartTimerRef.current) {
                  window.clearTimeout(heartTimerRef.current);
                }
                setIsHeartPopping(true);
                heartTimerRef.current = window.setTimeout(() => {
                  setIsHeartPopping(false);
                  heartTimerRef.current = null;
                }, 170);
              }}
              title={
                currentSong.isFavorite
                  ? t.removeFromFavorites || 'Remove from Favourites'
                  : t.addToFavorites || 'Add to Favourites'
              }
              style={{
                ...btnStyle,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                color: currentSong.isFavorite ? '#ff3b30' : iconInactiveColor,
                flexShrink: 0,
              }}
            >
              <motion.span
                initial={false}
                animate={{ scale: isHeartPopping ? 1.18 : 1 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  willChange: 'transform',
                }}
              >
                <Heart
                  size={18}
                  fill={currentSong.isFavorite ? '#ff3b30' : 'none'}
                  color={currentSong.isFavorite ? '#ff3b30' : iconInactiveColor}
                  strokeWidth={2}
                />
              </motion.span>
            </button>
          )}

          <button
            className="pb-btn"
            data-queue-toggle="true"
            onClick={() => setShowQueue(!showQueue)}
            title={`${t.queue || 'Play Queue'} (Q)`}
            style={{
              ...btnStyle,
              padding: isCompactDesktop ? '6px' : '6px 8px',
              borderRadius: '10px',
              color: showQueue ? iconActiveColor : iconInactiveColor,
              backgroundColor: 'transparent',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
            </svg>
            {!isCompactDesktop && (
              <span style={{ fontSize: '0.8125rem', fontWeight: '600' }}>{t.queue}</span>
            )}
          </button>
        </div>
      )}
      <audio
        ref={audioRefA}
        onLoadedMetadata={() => handleDurationSync('A')}
        onDurationChange={() => handleDurationSync('A')}
        onTimeUpdate={() => handleTimeUpdate('A')}
        onEnded={() => handleSongEnd('A')}
        onPlay={() => {
          if (activeDeckRef.current !== 'A') return;
          audioEffects.resumeContext();
          handlePlayState(true);
        }}
        onPlaying={() => {
          if (activeDeckRef.current === 'A') handlePlayState(true);
        }}
        onPause={() => {
          if (activeDeckRef.current !== 'A' || pauseFadeTimerRef.current) return;
          if (suppressNextPauseSyncRef.current) {
            suppressNextPauseSyncRef.current = false;
            handlePlayState(false);
            return;
          }
          if (audioRefA.current && isPlaying) {
            setCurrentTime(audioRefA.current.currentTime || 0);
          }
          handlePlayState(false);
        }}
        onError={() => handleAudioError('A')}
      />
      <audio
        ref={audioRefB}
        onLoadedMetadata={() => handleDurationSync('B')}
        onDurationChange={() => handleDurationSync('B')}
        onTimeUpdate={() => handleTimeUpdate('B')}
        onEnded={() => handleSongEnd('B')}
        onPlay={() => {
          if (activeDeckRef.current !== 'B') return;
          audioEffects.resumeContext();
          handlePlayState(true);
        }}
        onPlaying={() => {
          if (activeDeckRef.current === 'B') handlePlayState(true);
        }}
        onPause={() => {
          if (activeDeckRef.current !== 'B' || pauseFadeTimerRef.current) return;
          if (suppressNextPauseSyncRef.current) {
            suppressNextPauseSyncRef.current = false;
            handlePlayState(false);
            return;
          }
          if (audioRefB.current && isPlaying) {
            setCurrentTime(audioRefB.current.currentTime || 0);
          }
          handlePlayState(false);
        }}
        onError={() => handleAudioError('B')}
      />

      <FullScreenPlayer
        isOpen={isNowPlayingOpen}
        onClose={() => {
          setIsNowPlayingOpen(false);
          setShowFsQueue(false);
        }}
        currentSong={currentSong}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        playNext={playNext}
        playPrev={playPrev}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        getLiveTime={getLivePlaybackTime}
        volume={effectiveVolume}
        maxVolFactor={maxVolFactor}
        onVolumeChange={handleDirectVolumeChange}
        isShuffle={isShuffle}
        onToggleShuffle={() => setIsShuffle(!isShuffle)}
        repeatMode={repeatMode}
        onToggleRepeat={toggleRepeat}
        queue={queue}
        currentQueueIndex={currentQueueIndex}
        removeFromQueue={removeFromQueue}
        removeFromQueueIndices={removeFromQueueIndices}
        onPlayNextInQueue={onPlayNextInQueue}
        isQueueOpen={showFsQueue}
        onToggleQueue={() => setShowFsQueue((prev) => !prev)}
        onCloseQueue={() => setShowFsQueue(false)}
        reorderQueue={reorderQueue}
        onPlayQueueSong={onPlayQueueSong}
        onClearQueue={onClearQueue}
        onShuffleQueue={onShuffleQueue}
        playlists={playlists}
        onAddSongToPlaylist={onAddSongToPlaylist}
        onCreatePlaylist={onCreatePlaylist}
        onToggleFavorite={onToggleFavorite}
        onUpdateSong={onUpdateSong}
        onDeleteSong={onDeleteSong}
        onOpenSettings={onOpenSettings}
        confirmBeforeDelete={playbackPrefs.confirmBeforeDelete}
        liveVisualizer={soundSettings.liveVisualizer}
        artworkStyle={displaySettings.artworkStyle}
        visualizerStyle={displaySettings.visualizerStyle}
        t={t}
        theme={theme}
      />
    </div>
  );
};