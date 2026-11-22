import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Shuffle,
  Moon,
  RefreshCw,
  Folder,
  ListMusic,
  Mic,
  Clock,
  Disc,
  Music,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Check,
  X,
} from 'lucide-react';
import type { HomeLayoutStyle, Playlist, SleepTimerState, Song } from '../types';
import type { SearchNavigateTarget } from '../components/SearchBar';
import { CoverImage } from '../components/CoverImage';
import { MarqueeText } from '../components/MarqueeText';
import { SettingsIconBadge } from '../components/SettingsPrimitives';
import { audioEffects } from '../player/audioEffects';
import { getBidiTruncateStyle } from '../utils/bidi';
import { withAlpha } from '../utils/color';

interface HomeProps {
  songs: Song[];
  playlists: Playlist[];
  customFolders: string[];
  currentSong: Song | null;
  onPlaySongFromList: (song: Song, list: Song[]) => void;
  onShuffleAll: () => void;
  onNavigateToItem: (target: SearchNavigateTarget) => void;
  onSelectTab: (tab: string) => void;
  sleepTimer: SleepTimerState;
  onSetSleepTimer: (timer: SleepTimerState) => void;
  t: any;
  theme: any;
  language: 'fa' | 'en';
  isPlaying?: boolean;
  glassCardCovers?: boolean;
  homeLayout?: HomeLayoutStyle;
  reduceMotion?: boolean;
}

const formatTrackDuration = (seconds?: number): string => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatTotalLibraryTime = (totalSeconds: number, t: any): string => {
  if (!totalSeconds || totalSeconds <= 0) return `0 ${t.minutesShort || 'm'}`;
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} ${t.minutesShort || 'm'}`;
  }
  return `${hours} ${t.hoursShort || 'h'} ${minutes} ${t.minutesShort || 'm'}`;
};

const formatCountdown = (seconds: number): string => {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

interface QuickAccessEntry {
  id: string;
  kind: 'playlist' | 'folder';
  name: string;
  songs: Song[];
  cover: string;
}

interface TopArtistEntry {
  name: string;
  songs: Song[];
  totalPlays: number;
  cover: string;
}

const WAVE_REST_PROFILE = [0.24, 0.4, 0.58, 0.78, 0.94, 0.78, 0.58, 0.4, 0.24] as const;
const WAVE_ACTIVE_ENVELOPE = [0.46, 0.66, 0.82, 0.94, 1.0, 0.94, 0.82, 0.66, 0.46] as const;
const MOTION_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const Home: React.FC<HomeProps> = ({
  songs,
  playlists,
  customFolders,
  currentSong,
  onPlaySongFromList,
  onShuffleAll,
  onNavigateToItem,
  onSelectTab,
  sleepTimer,
  onSetSleepTimer,
  t,
  theme,
  language,
  isPlaying = false,
  glassCardCovers = true,
  homeLayout = 'widget',
  reduceMotion = false,
}) => {
  const isRTL = language === 'fa';
  const rootContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const isSmallPhone = containerWidth < 460;
  const isMobile = containerWidth < 620;
  const isTablet = containerWidth >= 620 && containerWidth < 880;
  const isDesktop = containerWidth >= 880;
  const isWideDesktop = containerWidth >= 1060;
  const [pickSeed, setPickSeed] = useState(0);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [hoveredSongId, setHoveredSongId] = useState<string | null>(null);
  const [hoveredHeroSong, setHoveredHeroSong] = useState(false);
  const [hoveredQuickId, setHoveredQuickId] = useState<string | null>(null);
  const [hoveredArtist, setHoveredArtist] = useState<string | null>(null);
  const [hoveredStatIdx, setHoveredStatIdx] = useState<number | null>(null);
  const sleepButtonRef = useRef<HTMLButtonElement>(null);
  const sleepPortalRef = useRef<HTMLDivElement>(null);
  const waveBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [sleepMenuPos, setSleepMenuPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    const el = rootContainerRef.current;
    const syncWindowWidth = () => {
      const next = el?.clientWidth || window.innerWidth;
      if (next > 0) setContainerWidth(next);
    };
    syncWindowWidth();

    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect?.width;
        if (w && w > 0) {
          setContainerWidth(Math.round(w));
        }
      });
      observer.observe(el);
    }

    window.addEventListener('resize', syncWindowWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncWindowWidth);
    };
  }, []);

  // به‌روزرسانی شمارنده تایمر خواب فقط وقتی تایمر زمان‌دار فعال است
  useEffect(() => {
    if (sleepTimer.mode !== 'until') return;
    setNowTs(Date.now());
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sleepTimer]);

  const updateSleepMenuPos = useCallback(() => {
    const btn = sleepButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 195;
    const menuEstHeight = sleepTimer.mode !== 'off' ? 236 : 190;
    const rawLeft = isRTL ? rect.left : rect.right - menuWidth;
    const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, rawLeft));
    const fitsBelow = rect.bottom + 8 + menuEstHeight <= window.innerHeight - 105;
    const top = fitsBelow
      ? rect.bottom + 8
      : Math.max(12, rect.top - menuEstHeight - 8);
    setSleepMenuPos({ top, left });
  }, [isRTL, sleepTimer.mode]);

  // بستن منوی تایمر خواب با کلیک بیرون یا Escape
  useEffect(() => {
    if (!sleepMenuOpen) return;
    updateSleepMenuPos();
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        sleepButtonRef.current?.contains(target) ||
        sleepPortalRef.current?.contains(target)
      ) {
        return;
      }
      setSleepMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSleepMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', updateSleepMenuPos);
    window.addEventListener('scroll', updateSleepMenuPos, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', updateSleepMenuPos);
      window.removeEventListener('scroll', updateSleepMenuPos, true);
    };
  }, [sleepMenuOpen, updateSleepMenuPos]);

  // آهنگ اصلی برای باکس Continue Listening / Now Playing
  const heroSong = useMemo<Song | null>(() => {
    if (currentSong) return currentSong;
    if (songs.length === 0) return null;
    const lastPlayed = [...songs]
      .filter((s) => (s.lastPlayedAt ?? 0) > 0)
      .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
    if (lastPlayed.length > 0) return lastPlayed[0];
    return [...songs].sort((a, b) => b.addedAt - a.addedAt)[0];
  }, [currentSong, songs]);

  const isHeroPlaying = Boolean(
    isPlaying && currentSong && heroSong && currentSong.id === heroSong.id
  );

  // انیمیشن اکولایزر گرافیکی زنده با تشخیص ضربه بیس (Bass Punch)، AGC سریع و واکنش لحظه‌ای
  useEffect(() => {
    if (homeLayout !== 'widget') return;

    if (!isHeroPlaying) {
      waveBarsRef.current.forEach((bar, idx) => {
        if (!bar) return;
        const rest = WAVE_REST_PROFILE[idx] ?? 0.5;
        bar.style.transform = `scaleY(${rest.toFixed(3)})`;
      });
      return;
    }

    let rafId = 0;
    const bins = new Uint8Array(audioEffects.getFrequencyBinCount() || 256);
    const smoothed = new Float32Array(WAVE_ACTIVE_ENVELOPE.length);
    for (let i = 0; i < smoothed.length; i++) {
      smoothed[i] = WAVE_REST_PROFILE[i];
    }
    let runningPeak = 76;
    let prevAvg = 0;
    let prevBass = 0;

    const tick = (now: number) => {
      const ok = audioEffects.getFrequencyData(bins);
      const limit = Math.min(bins.length - 1, 108);
      let framePeak = 0;
      let frameSum = 0;
      let bassSum = 0;
      const bassSpan = Math.min(6, Math.max(1, limit));

      if (ok && limit > 0) {
        for (let i = 1; i <= limit; i++) {
          const val = bins[i];
          if (val > framePeak) framePeak = val;
          frameSum += val;
          if (i <= bassSpan) {
            bassSum += val;
          }
        }
      }

      const hasAudio = ok && framePeak > 2;
      if (hasAudio) {
        runningPeak = Math.max(34, runningPeak * 0.976, framePeak * 1.02);
      }

      const frameAvg = hasAudio ? frameSum / limit / runningPeak : 0;
      const bassNorm = hasAudio ? Math.min(1.3, bassSum / (bassSpan * runningPeak)) : 0;
      const bassPunch = Math.max(0, bassNorm - prevBass) * 2.5;
      const flux = Math.max(0, frameAvg - prevAvg) * 2.2;
      prevAvg = prevAvg * 0.65 + frameAvg * 0.35;
      prevBass = prevBass * 0.6 + bassNorm * 0.4;

      const centerIdx = (WAVE_ACTIVE_ENVELOPE.length - 1) / 2;

      for (let i = 0; i < WAVE_ACTIVE_ENVELOPE.length; i++) {
        const bar = waveBarsRef.current[i];
        if (!bar) continue;
        const distFromCenter = Math.abs(i - centerIdx);
        const normDist = distFromCenter / centerIdx;
        const envelope = WAVE_ACTIVE_ENVELOPE[i];

        const organicWave =
          0.5 +
          0.5 *
            Math.sin(now * 0.0095 - distFromCenter * 0.95 + (i - centerIdx) * 0.32) *
            Math.cos(now * 0.0046 + i * 0.68);

        let energy: number;
        if (!hasAudio) {
          energy = 0.2 + organicWave * 0.78;
        } else {
          // نگاشت لگاریتمی فرکانس‌ها: مرکز=ساب‌بیس، میانی=وکال و ریتم، اطراف=تیز و های‌هت
          const bandStart = Math.max(1, Math.floor(Math.pow(normDist, 1.45) * Math.max(12, limit - 8)) + 1);
          const bandEnd = Math.min(limit, bandStart + 6);
          let bandSum = 0;
          for (let b = bandStart; b <= bandEnd; b++) {
            bandSum += bins[b];
          }
          const bandNorm = bandSum / ((bandEnd - bandStart + 1) * runningPeak);
          const dynamicContrast = Math.pow(Math.min(1, bandNorm * 1.45), 1.35);
          const centerPunch = bassPunch * (1 - normDist * 0.55);
          energy = Math.min(
            1,
            0.1 + dynamicContrast * 0.68 + centerPunch * 0.46 + flux * 0.36 + organicWave * 0.14
          );
        }

        const target = Math.max(0.14, Math.min(1.12, envelope * (0.14 + energy * 0.98)));
        const prev = smoothed[i];
        const next = prev + (target - prev) * (target > prev ? 0.68 : 0.26);
        smoothed[i] = next;
        bar.style.transform = `scaleY(${next.toFixed(3)})`;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isHeroPlaying, homeLayout]);

  // محاسبه آمار کتابخانه و آرتیست‌های برتر
  const {
    totalDurationSeconds,
    artistsCount,
    albumsCount,
    foldersCount,
    topArtists,
  } = useMemo(() => {
    let totalDur = 0;
    const albumSet = new Set<string>();
    const folderSet = new Set<string>(
      customFolders.map((f) => f.trim()).filter(Boolean)
    );
    const artistMap = new Map<string, Song[]>();

    songs.forEach((song) => {
      if (song.duration && Number.isFinite(song.duration)) {
        totalDur += song.duration;
      }
      if (song.album?.trim()) {
        albumSet.add(song.album.trim().toLowerCase());
      }
      if (song.folder?.trim()) {
        folderSet.add(song.folder.trim());
      }
      const artistName = song.artist?.trim() || (t.unknownArtist || 'Unknown');
      const existing = artistMap.get(artistName);
      if (existing) existing.push(song);
      else artistMap.set(artistName, [song]);
    });

    const artistsSorted: TopArtistEntry[] = Array.from(artistMap.entries())
      .map(([name, artistSongs]) => {
        const totalPlays = artistSongs.reduce((acc, s) => acc + (s.playCount || 0), 0);
        const cover = artistSongs.find((s) => s.cover)?.cover || '';
        return { name, songs: artistSongs, totalPlays, cover };
      })
      .sort((a, b) => {
        if (b.totalPlays !== a.totalPlays) return b.totalPlays - a.totalPlays;
        return b.songs.length - a.songs.length;
      });

    return {
      totalDurationSeconds: totalDur,
      artistsCount: artistMap.size,
      albumsCount: albumSet.size,
      foldersCount: folderSet.size,
      topArtists: artistsSorted,
    };
  }, [songs, customFolders, t.unknownArtist]);

  // انتخاب ۶ آهنگ پیشنهادی با قابلیت Refresh
  const quickPicks = useMemo<Song[]>(() => {
    if (songs.length === 0) return [];
    const scored = songs.map((song, idx) => {
      let hash = (pickSeed + 1) * 2654435761 + idx * 97;
      for (let i = 0; i < song.id.length; i++) {
        hash = (hash * 31 + song.id.charCodeAt(i)) >>> 0;
      }
      return { song, score: hash };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 6).map((item) => item.song);
  }, [songs, pickSeed]);

  // دسترسی سریع به پلی‌لیست‌ها و فولدرهای ساخته‌شده
  const quickAccessItems = useMemo<QuickAccessEntry[]>(() => {
    const items: QuickAccessEntry[] = [];

    playlists.forEach((pl) => {
      items.push({
        id: pl.id,
        kind: 'playlist',
        name: pl.name,
        songs: pl.songs,
        cover: pl.songs.find((s) => s.cover)?.cover || '',
      });
    });

    const folderMap = new Map<string, Song[]>();
    customFolders.forEach((f) => {
      const trimmed = f.trim();
      if (trimmed) folderMap.set(trimmed, []);
    });
    songs.forEach((song) => {
      const f = song.folder?.trim();
      if (!f) return;
      const list = folderMap.get(f);
      if (list) list.push(song);
      else folderMap.set(f, [song]);
    });

    folderMap.forEach((folderSongs, folderName) => {
      items.push({
        id: folderName,
        kind: 'folder',
        name: folderName,
        songs: folderSongs,
        cover: folderSongs.find((s) => s.cover)?.cover || '',
      });
    });

    return items
      .sort((a, b) => b.songs.length - a.songs.length)
      .slice(0, 4);
  }, [playlists, customFolders, songs]);

  const handleHeroPrimaryAction = () => {
    if (!heroSong) return;
    if (currentSong && currentSong.id === heroSong.id) {
      window.dispatchEvent(new CustomEvent('app:toggle-play'));
    } else {
      onPlaySongFromList(heroSong, songs);
    }
  };

  const handleHeroOpenFullScreen = () => {
    if (!heroSong) return;
    if (!currentSong || currentSong.id !== heroSong.id) {
      onPlaySongFromList(heroSong, songs);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('app:open-fullscreen'));
      }, 60);
      return;
    }
    window.dispatchEvent(new CustomEvent('app:open-fullscreen'));
  };

  const remainingSleepSeconds =
    sleepTimer.mode === 'until'
      ? Math.max(0, Math.ceil((sleepTimer.endsAt - nowTs) / 1000))
      : 0;

  const isSleepActive = sleepTimer.mode !== 'off';

  const sleepButtonLabel =
    sleepTimer.mode === 'until'
      ? formatCountdown(remainingSleepSeconds)
      : sleepTimer.mode === 'songEnd'
      ? t.sleepAfterSong || 'پایان این آهنگ'
      : t.sleepTimer || 'تایمر خواب';

  const topArtist = topArtists[0] || null;
  const surfaceHoverBg =
    theme.colors.surfaceHover || withAlpha(theme.colors.surfaceSolid || '#ffffff', 0.9);
  const menuBg = withAlpha(theme.colors.surfaceSolid || theme.colors.background, 0.97);
  const menuItemHover = withAlpha(theme.colors.primary, theme.isDark ? 0.16 : 0.1);
  const onPrimaryColor = theme.colors.onPrimary || '#ffffff';
  const DirectionalChevron = isRTL ? ChevronLeft : ChevronRight;
  const hairline = theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(60, 60, 67, 0.12)';

  const sectionAnim = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.26, delay, ease: MOTION_EASE },
        };

  // کارت دسترسی سریع (مشترک در هر دو چیدمان)
  const renderQuickAccessCard = () => (
    <motion.div
      {...sectionAnim(0.06)}
      style={{
        backgroundColor: theme.colors.surface,
        backdropFilter: 'blur(24px) saturate(170%)',
        WebkitBackdropFilter: 'blur(24px) saturate(170%)',
        borderRadius: theme.radius.xl || '20px',
        border: `1px solid ${theme.colors.border}`,
        padding: isMobile ? '14px 14px' : '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: theme.colors.textPrimary,
          }}
        >
          {t.quickAccess || 'دسترسی سریع'}
        </h2>
        <button
          onClick={() => onSelectTab('playlists')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: theme.colors.primary,
            fontSize: '0.7813rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span>{t.viewAll || 'مشاهده همه'}</span>
          <DirectionalChevron size={14} />
        </button>
      </div>

      {quickAccessItems.length === 0 ? (
        <div
          style={{
            padding: '14px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.8125rem', color: theme.colors.textSecondary }}>
            {t.noQuickAccess || 'هنوز پلی‌لیست یا پوشه‌ای ساخته نشده است.'}
          </p>
          <div>
            <button
              onClick={() => onSelectTab('playlists')}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: withAlpha(theme.colors.primary, theme.isDark ? 0.1 : 0.07),
                color: theme.colors.textPrimary,
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.createPlaylistOrFolder || 'ساخت پلی‌لیست'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {quickAccessItems.map((item) => {
            const keyId = `${item.kind}:${item.id}`;
            const isHovered = hoveredQuickId === keyId;

            return (
              <motion.div
                key={keyId}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.12 }}
                onClick={() =>
                  onNavigateToItem({
                    tab: item.kind === 'playlist' ? 'playlists' : 'folders',
                    key: item.id,
                  })
                }
                onMouseEnter={() => setHoveredQuickId(keyId)}
                onMouseLeave={() => setHoveredQuickId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 10px',
                  borderRadius: '12px',
                  backgroundColor: isHovered ? menuItemHover : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.16s ease',
                }}
              >
                {item.cover ? (
                  <CoverImage
                    src={item.cover}
                    alt={item.name}
                    iconSize={16}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '10px',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '10px',
                      backgroundColor:
                        item.kind === 'folder'
                          ? 'rgba(10, 132, 255, 0.15)'
                          : 'rgba(94, 92, 230, 0.15)',
                      color: item.kind === 'folder' ? '#0a84ff' : '#5e5ce6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.kind === 'folder' ? <Folder size={18} /> : <ListMusic size={18} />}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: theme.colors.textPrimary,
                      ...getBidiTruncateStyle(item.name, isRTL),
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: theme.colors.textSecondary,
                      fontVariantNumeric: 'tabular-nums',
                      marginTop: '2px',
                    }}
                  >
                    {item.kind === 'folder'
                      ? t.folderLabel || 'پوشه'
                      : t.playlistLabel || 'پلی‌لیست'}{' '}
                    · {item.songs.length} {t.tracksCount || 'آهنگ'}
                  </div>
                </div>

                {item.songs.length > 0 && (
                  <motion.button
                    whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlaySongFromList(item.songs[0], item.songs);
                    }}
                    title={t.playAll || 'پخش'}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: theme.colors.primary,
                      color: onPrimaryColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Play size={13} fill={onPrimaryColor} />
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  // کارت آرتیست‌های برتر (مشترک در هر دو چیدمان)
  const renderTopArtistsCard = () => (
    <motion.div
      {...sectionAnim(0.1)}
      style={{
        backgroundColor: theme.colors.surface,
        backdropFilter: 'blur(24px) saturate(170%)',
        WebkitBackdropFilter: 'blur(24px) saturate(170%)',
        borderRadius: theme.radius.xl || '20px',
        border: `1px solid ${theme.colors.border}`,
        padding: isMobile ? '14px 14px' : '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 700,
            color: theme.colors.textPrimary,
          }}
        >
          {t.topArtists || 'خواننده‌های برتر'}
        </h2>
        <button
          onClick={() => onSelectTab('artists')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: theme.colors.primary,
            fontSize: '0.7813rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span>{t.viewAll || 'مشاهده همه'}</span>
          <DirectionalChevron size={14} />
        </button>
      </div>

      {topArtists.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: theme.colors.textSecondary }}>
          {t.noArtists || 'هنوز خواننده‌ای در کتابخانه وجود ندارد.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {topArtists.slice(0, 4).map((artist) => {
            const isHovered = hoveredArtist === artist.name;
            return (
              <motion.div
                key={artist.name}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.12 }}
                onClick={() =>
                  onNavigateToItem({ tab: 'artists', key: artist.name })
                }
                onMouseEnter={() => setHoveredArtist(artist.name)}
                onMouseLeave={() => setHoveredArtist(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 10px',
                  borderRadius: '12px',
                  backgroundColor: isHovered ? menuItemHover : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.16s ease',
                }}
              >
                <CoverImage
                  src={artist.cover}
                  alt={artist.name}
                  iconSize={16}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: theme.colors.textPrimary,
                      ...getBidiTruncateStyle(artist.name, isRTL),
                    }}
                  >
                    {artist.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: theme.colors.textSecondary,
                      fontVariantNumeric: 'tabular-nums',
                      marginTop: '2px',
                    }}
                  >
                    {artist.songs.length} {t.tracksCount || 'آهنگ'} ·{' '}
                    {artist.totalPlays} {t.plays || 'پخش'}
                  </div>
                </div>

                <motion.button
                  whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlaySongFromList(artist.songs[0], artist.songs);
                  }}
                  title={t.playAll || 'پخش'}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: theme.colors.primary,
                    color: onPrimaryColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Play size={13} fill={onPrimaryColor} />
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  // ردیف انتخاب سریع (Quick Picks)
  const renderQuickPicksSection = () => (
    <motion.div {...sectionAnim(0.12)} style={{ marginBottom: isMobile ? '18px' : '26px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '1.0625rem',
            fontWeight: 700,
            color: theme.colors.textPrimary,
          }}
        >
          {t.quickPicks || 'انتخاب سریع'}
        </h2>

        {songs.length > 1 && (
          <motion.button
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            onClick={() => setPickSeed((s) => s + 1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '10px',
              padding: '6px 12px',
              color: theme.colors.textSecondary,
              fontSize: '0.7813rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'color 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.colors.textPrimary;
              e.currentTarget.style.borderColor = theme.colors.primary + '88';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.colors.textSecondary;
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            <RefreshCw size={13} />
            <span>{t.refreshPicks || 'تغییر پیشنهادها'}</span>
          </motion.button>
        )}
      </div>

      {quickPicks.length === 0 ? (
        <p style={{ color: theme.colors.textSecondary, fontSize: '0.875rem' }}>
          {t.noSongs || 'هنوز آهنگی اضافه نشده است.'}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : 'repeat(auto-fit, minmax(min(100%, 245px), 1fr))',
            gap: isMobile ? '8px' : '10px',
          }}
        >
          {quickPicks.map((song) => {
            const isCurrent = currentSong?.id === song.id;
            const isHovered = hoveredSongId === song.id;

            return (
              <motion.div
                key={song.id}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                transition={{ duration: 0.12 }}
                onClick={() => onPlaySongFromList(song, quickPicks)}
                onMouseEnter={() => setHoveredSongId(song.id)}
                onMouseLeave={() => setHoveredSongId(null)}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '14px',
                  border: `1px solid ${
                    isCurrent
                      ? theme.colors.primary
                      : isHovered
                      ? theme.colors.primary + '66'
                      : theme.colors.border
                  }`,
                  backgroundColor: isHovered ? surfaceHoverBg : theme.colors.surface,
                  backdropFilter: 'blur(20px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                  cursor: 'pointer',
                  transition: 'background-color 0.18s ease, border-color 0.18s ease',
                }}
              >
                {glassCardCovers && song.cover && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: `url(${song.cover})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(18px)',
                      opacity: theme.isDark ? 0.16 : 0.12,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                  <CoverImage
                    src={song.cover}
                    alt={song.name}
                    iconSize={18}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '10px',
                      objectFit: 'cover',
                    }}
                  />
                  {(isHovered || isCurrent) && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '10px',
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play size={16} fill="#ffffff" color="#ffffff" />
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: isCurrent ? theme.colors.primary : theme.colors.textPrimary,
                      ...getBidiTruncateStyle(song.name, isRTL),
                    }}
                  >
                    {song.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7813rem',
                      color: theme.colors.textSecondary,
                      marginTop: '2px',
                      ...getBidiTruncateStyle(song.artist || '', isRTL),
                    }}
                  >
                    {song.artist}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    color: theme.colors.textSecondary,
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {formatTrackDuration(song.duration)}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  // دکمه تایمر خواب به همراه منوی پورتال
  const renderSleepTimerButton = () => (
    <div style={{ position: 'relative', flex: isMobile ? '1 1 auto' : undefined }}>
      <motion.button
        ref={sleepButtonRef}
        type="button"
        whileHover={reduceMotion ? undefined : { scale: 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: 0.95 }}
        onClick={() => {
          if (!sleepMenuOpen) updateSleepMenuPos();
          setSleepMenuOpen((prev) => !prev);
        }}
        style={{
          width: isMobile ? '100%' : 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '7px',
          padding: isMobile ? '9px 12px' : '9px 14px',
          borderRadius: '13px',
          border: `1px solid ${isSleepActive ? theme.colors.primary : theme.colors.border}`,
          backgroundColor: isSleepActive
            ? withAlpha(theme.colors.primary, 0.15)
            : withAlpha(theme.colors.primary, theme.isDark ? 0.1 : 0.07),
          color: isSleepActive ? theme.colors.primary : theme.colors.textPrimary,
          fontSize: '0.8438rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontVariantNumeric: 'tabular-nums',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        <Moon size={15} />
        <span>{sleepButtonLabel}</span>
      </motion.button>
    </div>
  );

  // لیست عمودی آمار کتابخانه به سبک Grouped List (برای نوع دوم در پایین صفحه)
  const statRows = [
    {
      id: 'duration',
      label: t.totalDuration || 'مجموع زمان',
      value: `${formatTotalLibraryTime(totalDurationSeconds, t)} · ${songs.length} ${
        t.tracksCount || 'آهنگ'
      }`,
      icon: <Clock size={16} />,
      color: theme.colors.primary,
      gradientTo: theme.colors.accent || '#5E5CE6',
      onClick: () => onSelectTab('allSongs'),
    },
    {
      id: 'artists',
      label: t.artists || 'خواننده‌ها',
      value: `${artistsCount} ${t.artistsCountLabel || 'خواننده'}`,
      icon: <Mic size={16} />,
      color: '#FF9500',
      gradientTo: '#FF5E3A',
      onClick: () => onSelectTab('artists'),
    },
    {
      id: 'albumsFolders',
      label: `${t.albums || 'آلبوم‌ها'} / ${t.folders || 'پوشه‌بندی'}`,
      value: `${albumsCount} · ${foldersCount}`,
      icon: <Disc size={16} />,
      color: '#5E5CE6',
      gradientTo: '#0A84FF',
      onClick: () => onSelectTab('albums'),
    },
    {
      id: 'topArtist',
      label: t.topArtist || 'محبوب‌ترین خواننده',
      value: topArtist ? topArtist.name : '—',
      icon: <Music size={16} />,
      color: '#FF3B30',
      gradientTo: '#FF2D55',
      onClick: () => {
        if (topArtist) {
          onNavigateToItem({ tab: 'artists', key: topArtist.name });
        } else {
          onSelectTab('artists');
        }
      },
    },
  ];

  const renderVerticalStatsList = () => (
    <motion.div {...sectionAnim(0.16)} style={{ marginBottom: '10px' }}>
      <div
        style={{
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: theme.colors.textSecondary,
          padding: '0 8px 10px',
        }}
      >
        {t.libraryInsights || 'آمار کتابخانه'}
      </div>

      <div
        style={{
          backgroundColor: theme.colors.surface,
          backdropFilter: 'blur(24px) saturate(175%)',
          WebkitBackdropFilter: 'blur(24px) saturate(175%)',
          borderRadius: theme.radius.xl || '20px',
          border: `1px solid ${theme.colors.border}`,
          overflow: 'hidden',
          boxShadow: theme.isDark
            ? '0 8px 26px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
            : '0 4px 16px rgba(15, 23, 42, 0.045), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        }}
      >
        {statRows.map((row, idx) => {
          const isLast = idx === statRows.length - 1;
          const isHovered = hoveredStatIdx === idx;
          return (
            <div key={row.id}>
              <motion.button
                type="button"
                whileTap={reduceMotion ? undefined : { scale: 0.992 }}
                transition={{ duration: 0.1 }}
                onClick={row.onClick}
                onMouseEnter={() => setHoveredStatIdx(idx)}
                onMouseLeave={() => setHoveredStatIdx(null)}
                style={{
                  width: '100%',
                  padding: isMobile ? '11px 12px' : '13px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '8px' : '12px',
                  border: 'none',
                  backgroundColor: isHovered ? menuItemHover : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'start',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px', minWidth: 0 }}>
                  <SettingsIconBadge color={row.color} gradientTo={row.gradientTo} size={30}>
                    {row.icon}
                  </SettingsIconBadge>
                  <span
                    style={{
                      fontSize: '0.9063rem',
                      fontWeight: 600,
                      color: theme.colors.textPrimary,
                    }}
                  >
                    {row.label}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8438rem',
                      fontWeight: 600,
                      color: theme.colors.textSecondary,
                      fontVariantNumeric: 'tabular-nums',
                      maxWidth: isMobile ? '44vw' : '240px',
                      ...getBidiTruncateStyle(String(row.value || ''), isRTL, isRTL ? 'left' : 'right'),
                    }}
                  >
                    {row.value}
                  </span>
                  <DirectionalChevron
                    size={16}
                    color={
                      theme.isDark ? 'rgba(235, 235, 245, 0.36)' : 'rgba(60, 60, 67, 0.36)'
                    }
                  />
                </div>
              </motion.button>

              {!isLast && (
                <div
                  style={{
                    height: '1px',
                    backgroundColor: hairline,
                    marginInlineStart: isMobile ? '50px' : '58px',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );

  // نوار ۴ ستونه آمار کتابخانه (برای نوع اول: حالت پهن قبلی)
  const renderWideStatsGrid = () => (
    <motion.div
      {...sectionAnim(0.06)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
        gap: '1px',
        backgroundColor: theme.colors.border,
        borderRadius: theme.radius.xl || '20px',
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        marginBottom: '26px',
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.surface,
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          padding: '15px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Clock size={19} color={theme.colors.primary} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.7188rem', color: theme.colors.textSecondary }}>
            {t.totalDuration || 'مجموع زمان'}
          </div>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: theme.colors.textPrimary,
              fontVariantNumeric: 'tabular-nums',
              marginTop: '3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {formatTotalLibraryTime(totalDurationSeconds, t)} · {songs.length}{' '}
            {t.tracksCount || 'آهنگ'}
          </div>
        </div>
      </div>

      <button
        onClick={() => onSelectTab('artists')}
        style={{
          backgroundColor: theme.colors.surface,
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          padding: '15px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'start',
        }}
      >
        <Mic size={19} color="#ff9500" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.7188rem', color: theme.colors.textSecondary }}>
            {t.artists || 'خواننده‌ها'}
          </div>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: theme.colors.textPrimary,
              fontVariantNumeric: 'tabular-nums',
              marginTop: '3px',
            }}
          >
            {artistsCount} {t.artistsCountLabel || 'خواننده'}
          </div>
        </div>
      </button>

      <button
        onClick={() => onSelectTab('albums')}
        style={{
          backgroundColor: theme.colors.surface,
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          padding: '15px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'start',
        }}
      >
        <Disc size={19} color="#5e5ce6" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.7188rem', color: theme.colors.textSecondary }}>
            {(t.albums || 'آلبوم‌ها') + ' / ' + (t.folders || 'پوشه‌بندی')}
          </div>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: theme.colors.textPrimary,
              fontVariantNumeric: 'tabular-nums',
              marginTop: '3px',
            }}
          >
            {albumsCount} · {foldersCount}
          </div>
        </div>
      </button>

      <button
        onClick={() => {
          if (topArtist) {
            onNavigateToItem({ tab: 'artists', key: topArtist.name });
          } else {
            onSelectTab('artists');
          }
        }}
        style={{
          backgroundColor: theme.colors.surface,
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          padding: '15px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'start',
        }}
      >
        <Music size={19} color="#ff3b30" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.7188rem', color: theme.colors.textSecondary }}>
            {t.topArtist || 'محبوب‌ترین خواننده'}
          </div>
          <div
            style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: theme.colors.textPrimary,
              marginTop: '3px',
              ...getBidiTruncateStyle(topArtist ? topArtist.name : '—', isRTL),
            }}
          >
            {topArtist ? topArtist.name : '—'}
          </div>
        </div>
      </button>
    </motion.div>
  );

  return (
    <div
      ref={rootContainerRef}
      style={{
        flex: 1,
        padding: isMobile
          ? '10px 12px 156px'
          : 'clamp(10px, 1.8vw, 18px) clamp(14px, 3.2vw, 34px) 136px',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {homeLayout === 'wide' ? (
          /* ================================================================
           * نوع ۱: نمای پهن کلاسیک (همون حالت پهن قبلی)
           * ================================================================ */
          <motion.div
            key="home-layout-wide"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: MOTION_EASE }}
          >
            {/* کارت پهن Continue Listening / Now Playing */}
            <div
              style={{
                position: 'relative',
                borderRadius: theme.radius.xl || '24px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                boxShadow: theme.isDark
                  ? '0 14px 36px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
                  : '0 10px 28px rgba(0, 0, 0, 0.055), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
                padding: 'clamp(16px, 2.6vw, 24px)',
                marginBottom: '18px',
                overflow: 'hidden',
              }}
            >
              {heroSong?.cover && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-24px',
                      backgroundImage: `url(${heroSong.cover})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(34px) saturate(160%)',
                      opacity: theme.isDark ? 0.3 : 0.18,
                      transform: 'scale(1.1)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: theme.isDark
                        ? `linear-gradient(120deg, ${withAlpha(theme.colors.surfaceSolid, 0.72)} 0%, ${withAlpha(theme.colors.surfaceSolid, 0.92)} 100%)`
                        : `linear-gradient(120deg, ${withAlpha(theme.colors.surfaceSolid, 0.76)} 0%, ${withAlpha(theme.colors.surfaceSolid, 0.92)} 100%)`,
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '18px',
                }}
              >
                <div
                  role={heroSong ? 'button' : undefined}
                  tabIndex={heroSong ? 0 : undefined}
                  onClick={handleHeroOpenFullScreen}
                  onKeyDown={(e) => {
                    if (heroSong && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleHeroOpenFullScreen();
                    }
                  }}
                  onMouseEnter={() => heroSong && setHoveredHeroSong(true)}
                  onMouseLeave={() => setHoveredHeroSong(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flex: '1 1 280px',
                    minWidth: 0,
                    cursor: heroSong ? 'pointer' : 'default',
                    outline: 'none',
                  }}
                >
                  <CoverImage
                    src={heroSong?.cover}
                    alt={heroSong?.name || ''}
                    iconSize={34}
                    iconColor={theme.colors.textSecondary}
                    fallbackBg={
                      theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
                    }
                    style={{
                      width: isDesktop ? '98px' : '82px',
                      height: isDesktop ? '98px' : '82px',
                      borderRadius: '18px',
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: `1px solid ${theme.colors.border}`,
                      boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25)',
                    }}
                  />

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        letterSpacing: isRTL ? '0' : '1.1px',
                        textTransform: 'uppercase',
                        color: theme.colors.primary,
                      }}
                    >
                      {isHeroPlaying
                        ? t.nowPlaying || 'در حال پخش'
                        : t.continueListening || 'ادامه گوش دادن'}
                    </div>
                    <div style={{ marginTop: '4px', minWidth: 0 }}>
                      <MarqueeText
                        text={heroSong ? heroSong.name : t.noSongSelected || 'آهنگی انتخاب نشده'}
                        gapPx={28}
                        speedPxPerSec={30}
                        style={{
                          fontSize: 'clamp(1.125rem, 2.2vw, 1.375rem)',
                          fontWeight: 800,
                          color: hoveredHeroSong ? theme.colors.primary : theme.colors.textPrimary,
                          lineHeight: 1.25,
                          transition: 'color 0.15s ease',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '0.8438rem',
                        color: theme.colors.textSecondary,
                        ...getBidiTruncateStyle(
                          heroSong
                            ? heroSong.album?.trim()
                              ? `${heroSong.artist} · ${heroSong.album}`
                              : `${heroSong.artist} · ${formatTrackDuration(heroSong.duration)}`
                            : t.noSongs || 'هنوز آهنگی اضافه نشده است.',
                          isRTL
                        ),
                      }}
                    >
                      {heroSong
                        ? heroSong.album?.trim()
                          ? `${heroSong.artist} · ${heroSong.album}`
                          : `${heroSong.artist} · ${formatTrackDuration(heroSong.duration)}`
                        : t.noSongs || 'هنوز آهنگی اضافه نشده است.'}
                    </div>
                  </div>
                </div>

                {/* دکمه‌های کنترلی افقی */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <motion.button
                    type="button"
                    whileHover={reduceMotion || !heroSong ? undefined : { scale: 1.03 }}
                    whileTap={reduceMotion || !heroSong ? undefined : { scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 28 }}
                    onClick={handleHeroPrimaryAction}
                    disabled={!heroSong}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      borderRadius: '13px',
                      border: 'none',
                      backgroundColor: theme.colors.primary,
                      color: onPrimaryColor,
                      fontSize: '0.8438rem',
                      fontWeight: 700,
                      cursor: heroSong ? 'pointer' : 'not-allowed',
                      opacity: heroSong ? 1 : 0.45,
                      boxShadow: `0 6px 18px ${withAlpha(theme.colors.primary, 0.35)}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={isHeroPlaying ? 'wide-pause' : 'wide-play'}
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.78 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78 }}
                        transition={{ duration: 0.14 }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
                      >
                        {isHeroPlaying ? (
                          <Pause size={15} fill={onPrimaryColor} />
                        ) : (
                          <Play size={15} fill={onPrimaryColor} />
                        )}
                        <span>
                          {isHeroPlaying
                            ? t.pausePlayback || 'توقف پخش'
                            : t.resumePlayback || 'ادامه پخش'}
                        </span>
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={reduceMotion || songs.length === 0 ? undefined : { scale: 1.02 }}
                    whileTap={reduceMotion || songs.length === 0 ? undefined : { scale: 0.95 }}
                    onClick={onShuffleAll}
                    disabled={songs.length === 0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '9px 15px',
                      borderRadius: '13px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: withAlpha(theme.colors.primary, theme.isDark ? 0.1 : 0.07),
                      color: theme.colors.textPrimary,
                      fontSize: '0.8438rem',
                      fontWeight: 600,
                      cursor: songs.length > 0 ? 'pointer' : 'not-allowed',
                      opacity: songs.length > 0 ? 1 : 0.5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Shuffle size={15} />
                    <span>{t.shuffleAll || 'پخش تصادفی همه'}</span>
                  </motion.button>

                  {renderSleepTimerButton()}
                </div>
              </div>
            </div>

            {renderWideStatsGrid()}
            {renderQuickPicksSection()}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                gap: '18px',
              }}
            >
              {renderQuickAccessCard()}
              {renderTopArtistsCard()}
            </div>
          </motion.div>
        ) : (
          /* ================================================================
           * نوع ۲: ویجت مدرن Now Playing + دسترسی سریع و آرتیست‌ها در بالا + آمار عمودی در پایین
           * ================================================================ */
          <motion.div
            key="home-layout-widget"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: MOTION_EASE }}
          >
            {/* ردیف ۱: ویجت مدرن در یک سمت + کنترل‌های سریع، دسترسی سریع و آرتیست‌های برتر در سمت دیگر */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isDesktop
                  ? isWideDesktop
                    ? 'minmax(275px, 315px) 1fr'
                    : 'minmax(248px, 280px) 1fr'
                  : '1fr',
                gap: isMobile ? '12px' : '16px',
                marginBottom: isMobile ? '18px' : '26px',
                alignItems: 'stretch',
              }}
            >
              {/* ستون ۱: ویجت Now Playing + دکمه پویانمایی‌شده + اکولایزر زنده */}
              <motion.div
                {...sectionAnim(0)}
                style={{
                  position: 'relative',
                  minWidth: 0,
                  borderRadius: theme.radius.xl || '26px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.surface,
                  backdropFilter: 'blur(30px) saturate(185%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(185%)',
                  boxShadow: theme.isDark
                    ? '0 16px 40px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.09)'
                    : '0 10px 28px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                  padding: isMobile ? '18px 14px 16px' : '22px 20px 20px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {heroSong?.cover && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: '-28px',
                        backgroundImage: `url(${heroSong.cover})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(36px) saturate(165%)',
                        opacity: theme.isDark ? 0.36 : 0.22,
                        transform: 'scale(1.12)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: theme.isDark
                          ? `linear-gradient(180deg, ${withAlpha(theme.colors.surfaceSolid, 0.62)} 0%, ${withAlpha(theme.colors.surfaceSolid, 0.88)} 100%)`
                          : `linear-gradient(180deg, ${withAlpha(theme.colors.surfaceSolid, 0.72)} 0%, ${withAlpha(theme.colors.surfaceSolid, 0.9)} 100%)`,
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div
                    role={heroSong ? 'button' : undefined}
                    tabIndex={heroSong ? 0 : undefined}
                    onClick={handleHeroOpenFullScreen}
                    onKeyDown={(e) => {
                      if (heroSong && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleHeroOpenFullScreen();
                      }
                    }}
                    onMouseEnter={() => heroSong && setHoveredHeroSong(true)}
                    onMouseLeave={() => setHoveredHeroSong(false)}
                    style={{
                      cursor: heroSong ? 'pointer' : 'default',
                      outline: 'none',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <motion.div
                      animate={
                        reduceMotion
                          ? undefined
                          : { scale: isHeroPlaying ? 1 : 0.96 }
                      }
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                    >
                      <CoverImage
                        src={heroSong?.cover}
                        alt={heroSong?.name || ''}
                        iconSize={40}
                        iconColor={theme.colors.textSecondary}
                        fallbackBg={
                          theme.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
                        }
                        style={{
                          width: isSmallPhone ? '96px' : isDesktop ? '128px' : '112px',
                          height: isSmallPhone ? '96px' : isDesktop ? '128px' : '112px',
                          borderRadius: '20px',
                          objectFit: 'cover',
                          display: 'block',
                          border: `1px solid ${theme.colors.border}`,
                          boxShadow: isHeroPlaying
                            ? `0 16px 36px ${withAlpha(theme.colors.primary, 0.28)}`
                            : '0 12px 26px rgba(0, 0, 0, 0.26)',
                          transition: 'box-shadow 0.28s ease',
                        }}
                      />
                    </motion.div>

                    <div
                      style={{
                        marginTop: '14px',
                        fontSize: '0.6563rem',
                        fontWeight: 700,
                        letterSpacing: isRTL ? '0' : '1.4px',
                        textTransform: 'uppercase',
                        color: isHeroPlaying ? theme.colors.primary : theme.colors.textSecondary,
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {isHeroPlaying
                        ? t.nowPlaying || 'NOW PLAYING'
                        : t.continueListening || 'CONTINUE LISTENING'}
                    </div>

                    <div
                      style={{
                        marginTop: '4px',
                        width: '100%',
                        maxWidth: isMobile ? '100%' : '260px',
                        minWidth: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <MarqueeText
                        text={heroSong ? heroSong.name : t.noSongSelected || 'آهنگی انتخاب نشده'}
                        gapPx={28}
                        speedPxPerSec={28}
                        style={{
                          fontSize: '1.1563rem',
                          fontWeight: 800,
                          color: hoveredHeroSong ? theme.colors.primary : theme.colors.textPrimary,
                          lineHeight: 1.28,
                          transition: 'color 0.15s ease',
                          textAlign: 'center',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: '3px',
                        width: '100%',
                        maxWidth: isMobile ? '100%' : '240px',
                        minWidth: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <MarqueeText
                        text={
                          heroSong
                            ? heroSong.artist
                            : t.noSongs || 'هنوز آهنگی اضافه نشده است.'
                        }
                        gapPx={24}
                        speedPxPerSec={24}
                        style={{
                          fontSize: '0.8438rem',
                          fontWeight: 500,
                          color: theme.colors.textSecondary,
                          textAlign: 'center',
                        }}
                      />
                    </div>
                  </div>

                  {/* دکمه کپسولی پخش/توقف با انیمیشن تغییر وضعیت */}
                  <motion.button
                    type="button"
                    onClick={handleHeroPrimaryAction}
                    disabled={!heroSong}
                    whileHover={reduceMotion || !heroSong ? undefined : { scale: 1.04 }}
                    whileTap={reduceMotion || !heroSong ? undefined : { scale: 0.91 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 26 }}
                    style={{
                      marginTop: '14px',
                      minWidth: '108px',
                      height: '36px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 22px',
                      borderRadius: '999px',
                      border: `1px solid ${
                        isHeroPlaying
                          ? withAlpha(theme.colors.primary, 0.45)
                          : withAlpha(theme.colors.textPrimary, theme.isDark ? 0.14 : 0.1)
                      }`,
                      backgroundColor: isHeroPlaying
                        ? theme.colors.primary
                        : theme.isDark
                        ? 'rgba(255, 255, 255, 0.16)'
                        : 'rgba(60, 60, 67, 0.1)',
                      color: isHeroPlaying ? onPrimaryColor : theme.colors.textPrimary,
                      boxShadow: isHeroPlaying
                        ? `0 8px 22px ${withAlpha(theme.colors.primary, 0.38)}`
                        : 'none',
                      fontSize: '0.8438rem',
                      fontWeight: 700,
                      cursor: heroSong ? 'pointer' : 'not-allowed',
                      opacity: heroSong ? 1 : 0.45,
                      transition:
                        'background-color 0.24s cubic-bezier(0.22, 1, 0.36, 1), color 0.2s ease, border-color 0.22s ease, box-shadow 0.24s ease',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={isHeroPlaying ? 'widget-pause' : 'widget-play'}
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.72, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, y: -4 }}
                        transition={{ duration: 0.16, ease: MOTION_EASE }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '7px',
                        }}
                      >
                        {isHeroPlaying ? (
                          <Pause size={14} fill={onPrimaryColor} />
                        ) : (
                          <Play size={14} fill={theme.colors.textPrimary} />
                        )}
                        <span>
                          {isHeroPlaying
                            ? t.pausePlayback || t.pause || (isRTL ? 'توقف' : 'Pause')
                            : t.resumePlayback || t.play || (isRTL ? 'پخش' : 'Play')}
                        </span>
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>

                  {/* اکولایزر گرافیکی متقارن زنده (کنترل کامل از طریق rAF بدون تداخل style.transform ری‌اکت) */}
                  <div
                    aria-hidden="true"
                    style={{
                      marginTop: '14px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      opacity: isHeroPlaying ? 1 : 0.55,
                      transition: 'opacity 0.24s ease',
                    }}
                  >
                    {WAVE_ACTIVE_ENVELOPE.map((_, idx) => (
                      <div
                        key={idx}
                        ref={(el) => {
                          waveBarsRef.current[idx] = el;
                        }}
                        style={{
                          width: '4.5px',
                          height: '38px',
                          borderRadius: '999px',
                          backgroundColor: isHeroPlaying
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                          boxShadow: isHeroPlaying
                            ? `0 0 8px ${withAlpha(theme.colors.primary, 0.32)}`
                            : 'none',
                          transformOrigin: 'center',
                          willChange: 'transform',
                          transition: isHeroPlaying
                            ? 'background-color 0.2s ease'
                            : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* ستون ۲: نوار کنترل‌های سریع + دسترسی سریع و آرتیست‌های برتر در بالا */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  minWidth: 0,
                }}
              >
                {/* نوار کنترل‌های سریع */}
                <motion.div
                  {...sectionAnim(0.03)}
                  style={{
                    backgroundColor: theme.colors.surface,
                    backdropFilter: 'blur(26px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(26px) saturate(180%)',
                    borderRadius: theme.radius.xl || '22px',
                    border: `1px solid ${theme.colors.border}`,
                    padding: isMobile ? '13px 14px' : '15px 18px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? '10px' : '12px',
                    boxShadow: theme.isDark
                      ? '0 10px 28px rgba(0, 0, 0, 0.24)'
                      : '0 6px 20px rgba(0, 0, 0, 0.045)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: isMobile ? '1 1 100%' : '1 1 170px' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: theme.colors.primary,
                      }}
                    >
                      {t.continueListening || 'ادامه گوش دادن'}
                    </div>
                    <div
                      style={{
                        marginTop: '3px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: theme.colors.textPrimary,
                        ...getBidiTruncateStyle(
                          heroSong
                            ? heroSong.album?.trim()
                              ? `${heroSong.album} · ${formatTrackDuration(heroSong.duration)}`
                              : formatTrackDuration(heroSong.duration)
                            : t.noSongs || 'هنوز آهنگی اضافه نشده است.',
                          isRTL
                        ),
                      }}
                    >
                      {heroSong
                        ? heroSong.album?.trim()
                          ? `${heroSong.album} · ${formatTrackDuration(heroSong.duration)}`
                          : formatTrackDuration(heroSong.duration)
                        : t.noSongs || 'هنوز آهنگی اضافه نشده است.'}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      width: isMobile ? '100%' : 'auto',
                    }}
                  >
                    {heroSong && (
                      <motion.button
                        type="button"
                        whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                        onClick={handleHeroOpenFullScreen}
                        style={{
                          flex: isMobile ? '1 1 auto' : undefined,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '7px',
                          padding: isMobile ? '9px 12px' : '9px 15px',
                          borderRadius: '13px',
                          border: 'none',
                          backgroundColor: theme.colors.primary,
                          color: onPrimaryColor,
                          fontSize: '0.8438rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: `0 6px 16px ${withAlpha(theme.colors.primary, 0.35)}`,
                        }}
                      >
                        <Maximize2 size={14} />
                        <span>{t.fullPlayerLabel || (isRTL ? 'پخش تمام‌صفحه' : 'Full Player')}</span>
                      </motion.button>
                    )}

                    <motion.button
                      type="button"
                      whileHover={reduceMotion || songs.length === 0 ? undefined : { scale: 1.02 }}
                      whileTap={reduceMotion || songs.length === 0 ? undefined : { scale: 0.95 }}
                      onClick={onShuffleAll}
                      disabled={songs.length === 0}
                      style={{
                        flex: isMobile ? '1 1 auto' : undefined,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        padding: isMobile ? '9px 12px' : '9px 15px',
                        borderRadius: '13px',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: withAlpha(
                          theme.colors.primary,
                          theme.isDark ? 0.1 : 0.07
                        ),
                        color: theme.colors.textPrimary,
                        fontSize: '0.8438rem',
                        fontWeight: 600,
                        cursor: songs.length > 0 ? 'pointer' : 'not-allowed',
                        opacity: songs.length > 0 ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Shuffle size={15} />
                      <span>{t.shuffleAll || 'پخش تصادفی همه'}</span>
                    </motion.button>

                    {renderSleepTimerButton()}
                  </div>
                </motion.div>

                {/* دسترسی سریع به پلی‌لیست‌ها + آرتیست‌های برتر در بالای صفحه در کنار ویجت */}
                <div
                  style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns:
                      isWideDesktop || isTablet ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                    gap: isMobile ? '12px' : '14px',
                    alignItems: 'stretch',
                  }}
                >
                  {renderQuickAccessCard()}
                  {renderTopArtistsCard()}
                </div>
              </div>
            </div>

            {/* ردیف ۲: انتخاب سریع (Quick Picks) */}
            {renderQuickPicksSection()}

            {/* ردیف ۳: آمار کتابخانه به‌صورت لیست عمودی در پایین صفحه */}
            {renderVerticalStatsList()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* منوی پورتال تایمر خواب */}
      {sleepMenuOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={sleepPortalRef}
            style={{
              position: 'fixed',
              top: sleepMenuPos.top,
              left: sleepMenuPos.left,
              width: '195px',
              padding: '6px',
              borderRadius: theme.radius.md || '14px',
              backgroundColor: menuBg,
              backdropFilter: 'blur(26px) saturate(180%)',
              WebkitBackdropFilter: 'blur(26px) saturate(180%)',
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 18px 42px rgba(0, 0, 0, 0.48)',
              zIndex: 999999,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {[15, 30, 60].map((mins) => {
              const isPresetActive =
                sleepTimer.mode === 'until' && sleepTimer.durationMinutes === mins;
              return (
                <button
                  key={mins}
                  onClick={() => {
                    onSetSleepTimer({
                      mode: 'until',
                      endsAt: Date.now() + mins * 60 * 1000,
                      durationMinutes: mins,
                    });
                    setSleepMenuOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: isPresetActive ? theme.colors.primary : theme.colors.textPrimary,
                    fontSize: '0.8125rem',
                    fontWeight: isPresetActive ? 700 : 500,
                    textAlign: 'start',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = menuItemHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>
                    {mins} {t.sleepMinutes || 'دقیقه'}
                  </span>
                  {isPresetActive && <Check size={14} />}
                </button>
              );
            })}

            <button
              onClick={() => {
                onSetSleepTimer({ mode: 'songEnd' });
                setSleepMenuOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color:
                  sleepTimer.mode === 'songEnd'
                    ? theme.colors.primary
                    : theme.colors.textPrimary,
                fontSize: '0.8125rem',
                fontWeight: sleepTimer.mode === 'songEnd' ? 700 : 500,
                textAlign: 'start',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = menuItemHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span>{t.endOfSong || 'پایان آهنگ فعلی'}</span>
              {sleepTimer.mode === 'songEnd' && <Check size={14} />}
            </button>

            {isSleepActive && (
              <>
                <div
                  style={{
                    height: '1px',
                    backgroundColor: theme.colors.border,
                    margin: '3px 4px',
                  }}
                />
                <button
                  onClick={() => {
                    onSetSleepTimer({ mode: 'off' });
                    setSleepMenuOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: theme.colors.danger || '#ff453a',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    textAlign: 'start',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 69, 58, 0.14)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={14} />
                  <span>{t.sleepTimerOff || 'خاموش'}</span>
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};