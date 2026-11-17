import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Play,
  LayoutGrid,
  List,
  ArrowUpDown,
  Search,
  X,
} from 'lucide-react';
import type { Song, Playlist } from '../types';
import { AllSongs } from './AllSongs';
import { CoverImage } from '../components/CoverImage';
import { getBidiTruncateStyle } from '../utils/bidi';
import { mixHex, withAlpha } from '../utils/color';

interface ArtistsProps {
  songs: Song[];
  playlists: Playlist[];
  currentSong: Song | null;
  isPlaying?: boolean;
  onPlaySongFromList: (song: Song, list: Song[]) => void;
  onCreatePlaylist: (name: string, selectedSongs: Song[]) => void;
  addToQueue: (song: Song) => void;
  onPlayNext?: (songs: Song | Song[]) => void;
  onDeleteSong: (id: string) => void;
  onUpdateSong: (updatedSong: Song) => void;
  onAddSongToPlaylist: (playlistId: string, song: Song) => void;
  onToggleFavorite: (id: string) => void;
  t: any;
  theme: any;
  language: 'fa' | 'en';
  glassCardCovers?: boolean;
  initialArtist?: { name: string; token: number } | null;
  onBulkDeleteSongs?: (ids: string[]) => void;
  confirmBeforeDelete?: boolean;
}

interface ArtistGroup {
  name: string;
  songs: Song[];
  albumsCount: number;
  totalDuration: number;
  cover: string;
}

type ViewMode = 'grid' | 'list';
type SortMode = 'name' | 'tracks';

const formatTotalDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  if (!Number.isFinite(total) || total <= 0) return '';
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const MiniEqualizer: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-flex',
      alignItems: 'flex-end',
      gap: '2px',
      height: '13px',
    }}
  >
    <span
      className={active ? 'mini-eq-1' : undefined}
      style={{
        width: '2.5px',
        height: active ? '10px' : '5px',
        borderRadius: '2px',
        backgroundColor: '#ffffff',
        display: 'block',
      }}
    />
    <span
      className={active ? 'mini-eq-2' : undefined}
      style={{
        width: '2.5px',
        height: active ? '13px' : '9px',
        borderRadius: '2px',
        backgroundColor: '#ffffff',
        display: 'block',
      }}
    />
    <span
      className={active ? 'mini-eq-3' : undefined}
      style={{
        width: '2.5px',
        height: active ? '8px' : '6px',
        borderRadius: '2px',
        backgroundColor: '#ffffff',
        display: 'block',
      }}
    />
  </span>
);

export const Artists: React.FC<ArtistsProps> = ({
  songs,
  playlists,
  currentSong,
  isPlaying = false,
  onPlaySongFromList,
  onCreatePlaylist,
  addToQueue,
  onPlayNext,
  onDeleteSong,
  onUpdateSong,
  onAddSongToPlaylist,
  onToggleFavorite,
  t,
  theme,
  language,
  glassCardCovers = true,
  initialArtist = null,
  onBulkDeleteSongs,
  confirmBeforeDelete = true,
}) => {
  const [selectedArtist, setSelectedArtist] = useState<string | null>(() =>
    initialArtist ? initialArtist.name : null
  );
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortMode>('tracks');
  const [filterQuery, setFilterQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedPlayId, setFocusedPlayId] = useState<string | null>(null);

  useEffect(() => {
    if (initialArtist) {
      setSelectedArtist(initialArtist.name);
    }
  }, [initialArtist]);

  const groups = useMemo<ArtistGroup[]>(() => {
    const map = new Map<string, Song[]>();
    songs.forEach((song) => {
      const artistName = song.artist?.trim() || (t.unknownArtist || 'خواننده نامشخص');
      const existing = map.get(artistName);
      if (existing) {
        existing.push(song);
      } else {
        map.set(artistName, [song]);
      }
    });

    const list: ArtistGroup[] = Array.from(map.entries()).map(([name, artistSongs]) => {
      const uniqueAlbums = new Set(
        artistSongs
          .map((s) => s.album?.trim())
          .filter((a): a is string => Boolean(a))
      );
      const totalDuration = artistSongs.reduce(
        (sum, s) => sum + (typeof s.duration === 'number' && Number.isFinite(s.duration) && s.duration > 0 ? s.duration : 0),
        0
      );
      const cover = artistSongs.find((s) => s.cover)?.cover || '';
      return {
        name,
        songs: artistSongs,
        albumsCount: uniqueAlbums.size,
        totalDuration,
        cover,
      };
    });

    return list.sort((a, b) => {
      if (sortBy === 'tracks') {
        const diff = b.songs.length - a.songs.length;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [songs, sortBy, t.unknownArtist]);

  const filteredGroups = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((artist) => artist.name.toLowerCase().includes(q));
  }, [groups, filterQuery]);

  const activeGroup = useMemo(
    () => (selectedArtist ? groups.find((g) => g.name === selectedArtist) || null : null),
    [selectedArtist, groups]
  );

  const isRTL = language === 'fa';
  const density = theme.display?.listDensity || 'comfortable';
  const glassBlur = theme.display?.glassBlur ?? 24;
  const surfaceBase = theme.isDark
    ? theme.colors.surfaceSolid || theme.colors.background
    : mixHex('#ffffff', theme.colors.surfaceSolid || '#f5f5f7', 0.72);
  const hoverBg =
    theme.colors.surfaceHover ||
    withAlpha(mixHex(surfaceBase, theme.colors.primary, 0.08), theme.isDark ? 0.85 : 0.92);

  const gridGap = density === 'compact' ? '12px' : density === 'spacious' ? '20px' : '16px';
  const listGap = density === 'compact' ? '6px' : density === 'spacious' ? '12px' : '8px';
  const listRowPadding =
    density === 'compact' ? '8px 12px' : density === 'spacious' ? '13px 16px' : '10px 14px';

  const currentArtistKey = currentSong
    ? currentSong.artist?.trim() || (t.unknownArtist || 'خواننده نامشخص')
    : null;

  return (
    <div style={{ width: '100%', flex: 1, overflowX: 'clip' }}>
      <AnimatePresence mode="wait" initial={false}>
        {selectedArtist && activeGroup ? (
          <motion.div
            key={`artist-detail-${activeGroup.name}`}
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <AllSongs
              songs={activeGroup.songs}
              playlists={playlists}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlaySongFromList={onPlaySongFromList}
              onCreatePlaylist={onCreatePlaylist}
              addToQueue={addToQueue}
              onPlayNext={onPlayNext}
              onDeleteSong={onDeleteSong}
              onUpdateSong={onUpdateSong}
              onAddSongToPlaylist={onAddSongToPlaylist}
              onToggleFavorite={onToggleFavorite}
              t={t}
              theme={theme}
              title={activeGroup.name}
              onBack={() => setSelectedArtist(null)}
              backLabel={t.artistsTitle || t.artists || 'خواننده‌ها'}
              emptyMessage={t.noSongs}
              glassCardCovers={glassCardCovers}
              onBulkDeleteSongs={onBulkDeleteSongs}
              confirmBeforeDelete={confirmBeforeDelete}
            />
          </motion.div>
        ) : (
          <motion.div
            key="artists-main"
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1,
              width: '100%',
              padding: 'clamp(12px, 2vw, 24px) clamp(16px, 4vw, 40px) 136px',
              direction: isRTL ? 'rtl' : 'ltr',
              boxSizing: 'border-box',
            }}
          >
            {/* هدر صفحه خواننده‌ها */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '22px',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h1
                  style={{
                    fontSize: 'clamp(1.45rem, 3vw, 1.9rem)',
                    fontWeight: 800,
                    color: theme.colors.textPrimary,
                    margin: 0,
                    letterSpacing: '-0.35px',
                    lineHeight: 1.2,
                  }}
                >
                  {t.artistsTitle || t.artists || 'خواننده‌ها'}
                </h1>
                <div
                  style={{
                    marginTop: '5px',
                    fontSize: '0.8125rem',
                    color: theme.colors.textSecondary,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    {groups.length} {t.artistsCountLabel || 'خواننده'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {songs.length} {t.tracksCount || 'آهنگ'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                {/* جستجوی سریع در خواننده‌ها */}
                {groups.length > 0 && (
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      height: '36px',
                      width: 'clamp(170px, 24vw, 220px)',
                      backgroundColor: theme.colors.surface,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radius.md,
                      paddingInline: '10px',
                      gap: '7px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Search
                      size={14}
                      color={theme.colors.textSecondary}
                      style={{ flexShrink: 0 }}
                    />
                    <input
                      type="text"
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder={t.searchArtists || 'جستجوی خواننده...'}
                      aria-label={t.searchArtists || 'جستجوی خواننده...'}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: theme.colors.textPrimary,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                      }}
                    />
                    {filterQuery && (
                      <button
                        type="button"
                        onClick={() => setFilterQuery('')}
                        aria-label={t.clearSearch || 'پاک کردن جستجو'}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: theme.isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.08)',
                          color: theme.colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          padding: 0,
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}

                {/* تغییر مرتب‌سازی */}
                <button
                  type="button"
                  onClick={() => setSortBy((prev) => (prev === 'tracks' ? 'name' : 'tracks'))}
                  style={{
                    height: '36px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 13px',
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.textPrimary,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box',
                  }}
                >
                  <ArrowUpDown size={14} color={theme.colors.primary} />
                  <span>
                    {sortBy === 'tracks'
                      ? t.sortByTracks || 'تعداد آهنگ'
                      : t.sortArtist || 'اسم خواننده'}
                  </span>
                </button>

                {/* سوییچ نمایش گرید / لیست */}
                <div
                  style={{
                    height: '36px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.radius.md,
                    padding: '3px',
                    gap: '2px',
                    boxSizing: 'border-box',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    aria-label={t.viewGrid || 'نمایش باکس'}
                    title={t.viewGrid || 'نمایش باکس'}
                    style={{
                      width: '30px',
                      height: '28px',
                      borderRadius: theme.radius.sm,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor:
                        viewMode === 'grid' ? withAlpha(theme.colors.primary, 0.16) : 'transparent',
                      color:
                        viewMode === 'grid' ? theme.colors.primary : theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    aria-label={t.viewList || 'نمایش لیست'}
                    title={t.viewList || 'نمایش لیست'}
                    style={{
                      width: '30px',
                      height: '28px',
                      borderRadius: theme.radius.sm,
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor:
                        viewMode === 'list' ? withAlpha(theme.colors.primary, 0.16) : 'transparent',
                      color:
                        viewMode === 'list' ? theme.colors.primary : theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* وضعیت خالی کتابخانه یا جستجو */}
            {groups.length === 0 ? (
              <div
                style={{
                  padding: '56px 20px',
                  textAlign: 'center',
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  border: `1px dashed ${theme.colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Mic size={36} style={{ opacity: 0.42 }} />
                <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>
                  {t.noArtists || 'هنوز خواننده‌ای در کتابخانه وجود ندارد.'}
                </p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div
                style={{
                  padding: '48px 20px',
                  textAlign: 'center',
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radius.lg,
                  border: `1px dashed ${theme.colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Search size={32} style={{ opacity: 0.42 }} />
                <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>
                  {t.noResults || 'هیچ نتیجه‌ای یافت نشد'}
                </p>
                <button
                  type="button"
                  onClick={() => setFilterQuery('')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: theme.radius.md,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.primary,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.clearSearch || 'پاک کردن جستجو'}
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(150px, 19vw, 188px), 1fr))',
                  gap: gridGap,
                }}
              >
                {filteredGroups.map((artist) => {
                  const isHovered = hoveredId === artist.name;
                  const isActiveArtist = currentArtistKey === artist.name;
                  const showPlay = isHovered || focusedPlayId === artist.name;

                  return (
                    <div
                      key={artist.name}
                      onClick={() => setSelectedArtist(artist.name)}
                      onMouseEnter={() => setHoveredId(artist.name)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        backgroundColor: isActiveArtist
                          ? withAlpha(
                              mixHex(surfaceBase, theme.colors.primary, theme.isDark ? 0.18 : 0.14),
                              theme.isDark ? 0.72 : 0.85
                            )
                          : isHovered
                          ? hoverBg
                          : theme.colors.surface,
                        backdropFilter: `blur(${glassBlur}px) saturate(180%)`,
                        WebkitBackdropFilter: `blur(${glassBlur}px) saturate(180%)`,
                        borderRadius: theme.radius.xl || '20px',
                        padding: '18px 14px 16px',
                        cursor: 'pointer',
                        border: `1px solid ${
                          isActiveArtist
                            ? theme.colors.primary
                            : isHovered
                            ? theme.colors.borderLight || withAlpha(theme.colors.primary, 0.45)
                            : theme.colors.border
                        }`,
                        boxShadow: isActiveArtist
                          ? `0 12px 28px ${withAlpha(theme.colors.primary, 0.22)}`
                          : isHovered
                          ? `0 16px 34px rgba(0, 0, 0, ${theme.isDark ? 0.32 : 0.1}), 0 0 18px ${withAlpha(
                              theme.colors.glow || theme.colors.primary,
                              0.18
                            )}`
                          : theme.isDark
                          ? '0 6px 20px rgba(0, 0, 0, 0.2)'
                          : '0 3px 12px rgba(0, 0, 0, 0.045)',
                        transition:
                          'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        minWidth: 0,
                      }}
                    >
                      {/* هاله شیشه‌ای لطیف پشت کارت خواننده */}
                      {glassCardCovers && artist.cover && (
                        <div
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: theme.radius.xl || '20px',
                            overflow: 'hidden',
                            contain: 'strict',
                            transform: 'translateZ(0)',
                            pointerEvents: 'none',
                            zIndex: 0,
                          }}
                        >
                          <img
                            src={artist.cover}
                            alt=""
                            style={{
                              position: 'absolute',
                              inset: '-32px',
                              width: 'calc(100% + 64px)',
                              height: 'calc(100% + 64px)',
                              objectFit: 'cover',
                              filter: 'blur(30px) saturate(160%)',
                              opacity: theme.isDark ? 0.24 : 0.15,
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: withAlpha(
                                surfaceBase,
                                theme.isDark ? 0.56 : 0.68
                              ),
                            }}
                          />
                        </div>
                      )}

                      {/* محفظه آواتار دایره‌ای با دکمه پخش بیرون‌زده بدون برش */}
                      <div
                        style={{
                          position: 'relative',
                          width: 'min(76%, 126px)',
                          aspectRatio: '1 / 1',
                          flexShrink: 0,
                          zIndex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: `2px solid ${
                              isActiveArtist
                                ? theme.colors.primary
                                : theme.isDark
                                ? 'rgba(255, 255, 255, 0.14)'
                                : 'rgba(0, 0, 0, 0.08)'
                            }`,
                            boxShadow: theme.isDark
                              ? '0 10px 24px rgba(0, 0, 0, 0.38)'
                              : '0 8px 20px rgba(0, 0, 0, 0.12)',
                            position: 'relative',
                          }}
                        >
                          <CoverImage
                            src={artist.cover}
                            alt={artist.name}
                            iconSize={36}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />

                          {isActiveArtist && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.42)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                              }}
                            >
                              <MiniEqualizer active={isPlaying} />
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (artist.songs.length > 0) {
                              onPlaySongFromList(artist.songs[0], artist.songs);
                            }
                          }}
                          onFocus={() => setFocusedPlayId(artist.name)}
                          onBlur={() => setFocusedPlayId(null)}
                          aria-label={`${t.playAll || 'پخش همه'} — ${artist.name}`}
                          title={t.playAll || 'پخش همه'}
                          style={{
                            position: 'absolute',
                            bottom: '2px',
                            insetInlineEnd: '2px',
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            border: `2px solid ${
                              theme.colors.surfaceSolid || theme.colors.background
                            }`,
                            backgroundColor: theme.colors.primary,
                            color: theme.colors.onPrimary || '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: showPlay ? 1 : 0,
                            pointerEvents: showPlay ? 'auto' : 'none',
                            transition: 'opacity 0.16s ease',
                            boxShadow: `0 6px 16px ${withAlpha(theme.colors.primary, 0.45)}`,
                            zIndex: 2,
                          }}
                        >
                          <Play size={15} fill={theme.colors.onPrimary || '#ffffff'} />
                        </button>
                      </div>

                      <h3
                        title={artist.name}
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          margin: '14px 0 0 0',
                          fontSize: '0.9375rem',
                          fontWeight: 700,
                          lineHeight: 1.35,
                          color: isActiveArtist ? theme.colors.primary : theme.colors.textPrimary,
                          width: '100%',
                          minWidth: 0,
                          ...getBidiTruncateStyle(artist.name, isRTL, 'center'),
                        }}
                      >
                        {artist.name}
                      </h3>

                      <div
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          marginTop: '4px',
                          fontSize: '0.75rem',
                          color: theme.colors.textSecondary,
                          fontVariantNumeric: 'tabular-nums',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          flexWrap: 'wrap',
                          lineHeight: 1.4,
                        }}
                      >
                        <span>
                          {artist.songs.length} {t.tracksCount || 'آهنگ'}
                        </span>
                        {artist.albumsCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {artist.albumsCount} {t.albumsCountLabel || 'آلبوم'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: listGap }}>
                {filteredGroups.map((artist) => {
                  const isHovered = hoveredId === artist.name;
                  const isActiveArtist = currentArtistKey === artist.name;
                  const totalDur = formatTotalDuration(artist.totalDuration);

                  return (
                    <div
                      key={artist.name}
                      onClick={() => setSelectedArtist(artist.name)}
                      onMouseEnter={() => setHoveredId(artist.name)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: listRowPadding,
                        backgroundColor: isActiveArtist
                          ? withAlpha(
                              mixHex(surfaceBase, theme.colors.primary, theme.isDark ? 0.18 : 0.14),
                              theme.isDark ? 0.72 : 0.85
                            )
                          : isHovered
                          ? hoverBg
                          : theme.colors.surface,
                        backdropFilter: `blur(${glassBlur}px) saturate(170%)`,
                        WebkitBackdropFilter: `blur(${glassBlur}px) saturate(170%)`,
                        border: `1px solid ${
                          isActiveArtist
                            ? theme.colors.primary
                            : isHovered
                            ? theme.colors.borderLight || withAlpha(theme.colors.primary, 0.35)
                            : theme.colors.border
                        }`,
                        borderRadius: theme.radius.lg || '16px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        transition:
                          'background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                        boxShadow: isActiveArtist
                          ? `0 6px 18px ${withAlpha(theme.colors.primary, 0.22)}`
                          : 'none',
                      }}
                    >
                      {glassCardCovers && artist.cover && (
                        <div
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: theme.radius.lg || '16px',
                            overflow: 'hidden',
                            contain: 'strict',
                            transform: 'translateZ(0)',
                            pointerEvents: 'none',
                            zIndex: 0,
                          }}
                        >
                          <img
                            src={artist.cover}
                            alt=""
                            style={{
                              position: 'absolute',
                              inset: '-30px',
                              width: 'calc(100% + 60px)',
                              height: 'calc(100% + 60px)',
                              objectFit: 'cover',
                              filter: 'blur(26px) saturate(160%)',
                              opacity: theme.isDark ? 0.26 : 0.16,
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: withAlpha(
                                surfaceBase,
                                theme.isDark ? 0.52 : 0.65
                              ),
                            }}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          position: 'relative',
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: `1.5px solid ${
                            isActiveArtist ? theme.colors.primary : theme.colors.border
                          }`,
                          zIndex: 1,
                        }}
                      >
                        <CoverImage
                          src={artist.cover}
                          alt={artist.name}
                          iconSize={20}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        {isActiveArtist && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: 'rgba(0, 0, 0, 0.45)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            <MiniEqualizer active={isPlaying} />
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                        <div
                          title={artist.name}
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 700,
                            color: isActiveArtist ? theme.colors.primary : theme.colors.textPrimary,
                            ...getBidiTruncateStyle(artist.name, isRTL),
                          }}
                        >
                          {artist.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7813rem',
                            color: theme.colors.textSecondary,
                            marginTop: '3px',
                            fontVariantNumeric: 'tabular-nums',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>
                            {artist.songs.length} {t.tracksCount || 'آهنگ'}
                          </span>
                          {artist.albumsCount > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {artist.albumsCount} {t.albumsCountLabel || 'آلبوم'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {totalDur && (
                        <span
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            fontSize: '0.75rem',
                            color: theme.colors.textSecondary,
                            fontVariantNumeric: 'tabular-nums',
                            flexShrink: 0,
                          }}
                        >
                          {totalDur}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (artist.songs.length > 0) {
                            onPlaySongFromList(artist.songs[0], artist.songs);
                          }
                        }}
                        aria-label={`${t.playAll || 'پخش همه'} — ${artist.name}`}
                        title={t.playAll || 'پخش همه'}
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border:
                            isHovered || isActiveArtist
                              ? 'none'
                              : `1px solid ${withAlpha(theme.colors.primary, 0.28)}`,
                          backgroundColor:
                            isHovered || isActiveArtist
                              ? theme.colors.primary
                              : withAlpha(theme.colors.primary, theme.isDark ? 0.14 : 0.1),
                          color:
                            isHovered || isActiveArtist
                              ? theme.colors.onPrimary || '#ffffff'
                              : theme.colors.primary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition:
                            'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease',
                        }}
                      >
                        <Play size={15} fill="currentColor" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
