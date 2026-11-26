import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Disc,
  Play,
  LayoutGrid,
  List,
  ArrowUpDown,
  Search,
  X,
  MoreHorizontal,
  FolderOpen,
  SkipForward,
  ListPlus,
} from 'lucide-react';
import type { Song, Playlist } from '../types';
import { AllSongs } from './AllSongs';
import { CoverImage } from '../components/CoverImage';
import { MiniEqualizer } from '../components/MiniEqualizer';
import { getBidiTruncateStyle } from '../utils/bidi';
import { mixHex, withAlpha } from '../utils/color';
import {
  clampContextMenuPosition,
  computeAnchorMenuPosition,
  type ContextMenuPosition,
} from '../utils/contextMenu';

interface AlbumsProps {
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
  initialAlbum?: { key: string; token: number } | null;
  onBulkDeleteSongs?: (ids: string[]) => void;
  confirmBeforeDelete?: boolean;
}

interface AlbumGroup {
  key: string;
  name: string;
  artist: string;
  year?: string;
  totalDuration: number;
  songs: Song[];
  cover: string;
}

type ViewMode = 'grid' | 'list';
type SortMode = 'name' | 'tracks' | 'year';

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

export const Albums: React.FC<AlbumsProps> = ({
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
  initialAlbum = null,
  onBulkDeleteSongs,
  confirmBeforeDelete = true,
}) => {
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(() =>
    initialAlbum ? initialAlbum.key : null
  );
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortMode>('name');
  const [filterQuery, setFilterQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedPlayId, setFocusedPlayId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    album: AlbumGroup;
    position: ContextMenuPosition;
  } | null>(null);
  const portalMenuRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const initialKey = initialAlbum?.key ?? null;
  const initialToken = initialAlbum?.token ?? null;

  useEffect(() => {
    if (initialKey !== null && initialToken !== null) {
      setSelectedAlbumKey(initialKey);
    }
  }, [initialKey, initialToken]);

  const singlesLabel = t.singlesAlbum || 'تک‌آهنگ‌ها';
  const isRTL = language === 'fa';

  const openAlbumMenu = useCallback(
    (album: AlbumGroup, rect: DOMRect | null, coords?: { x: number; y: number }) => {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const menuWidth = 200;
      const itemCount = 1 + (album.songs.length > 0 ? 2 + (onPlayNext ? 1 : 0) : 0);
      const menuHeight = itemCount * 38 + 14;
      const position = coords
        ? clampContextMenuPosition({
            clientX: coords.x,
            clientY: coords.y,
            menuWidth,
            menuHeight,
            viewportWidth: vw,
            viewportHeight: vh,
            isRTL,
          })
        : rect
        ? computeAnchorMenuPosition({
            rect,
            menuWidth,
            menuHeight,
            viewportWidth: vw,
            viewportHeight: vh,
            isRTL,
          })
        : clampContextMenuPosition({
            clientX: vw / 2,
            clientY: vh / 2,
            menuWidth,
            menuHeight,
            viewportWidth: vw,
            viewportHeight: vh,
            isRTL,
          });
      setCtxMenu({ album, position });
    },
    [isRTL, onPlayNext]
  );

  useEffect(() => {
    if (!ctxMenu) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (portalMenuRef.current?.contains(target)) return;
      const triggerEl = menuTriggerRefs.current[ctxMenu.album.key];
      if (triggerEl?.contains(target)) return;
      setCtxMenu(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    const closeOnViewport = () => setCtxMenu(null);
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', closeOnViewport, true);
    window.addEventListener('resize', closeOnViewport);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', closeOnViewport, true);
      window.removeEventListener('resize', closeOnViewport);
    };
  }, [ctxMenu]);

  const groups = useMemo<AlbumGroup[]>(() => {
    const map = new Map<string, Song[]>();
    songs.forEach((song) => {
      const albumName = song.album?.trim() || singlesLabel;
      const existing = map.get(albumName);
      if (existing) {
        existing.push(song);
      } else {
        map.set(albumName, [song]);
      }
    });

    const otherWord = t.otherArtistsWord || (isRTL ? 'دیگر' : 'more');

    const list: AlbumGroup[] = Array.from(map.entries()).map(([name, albumSongs]) => {
      const uniqueArtists = Array.from(
        new Set(albumSongs.map((s) => s.artist?.trim()).filter((a): a is string => Boolean(a)))
      );
      const artistLabel =
        uniqueArtists.length === 0
          ? t.unknownArtist || 'خواننده نامشخص'
          : uniqueArtists.length === 1
          ? uniqueArtists[0]
          : isRTL
          ? `${uniqueArtists[0]} و ${uniqueArtists.length - 1} ${otherWord}`
          : `${uniqueArtists[0]} & ${uniqueArtists.length - 1} ${otherWord}`;
      const year = albumSongs.find((s) => s.year)?.year;
      const totalDuration = albumSongs.reduce(
        (sum, s) => sum + (typeof s.duration === 'number' && Number.isFinite(s.duration) && s.duration > 0 ? s.duration : 0),
        0
      );
      const cover = albumSongs.find((s) => s.cover)?.cover || '';
      return {
        key: name,
        name,
        artist: artistLabel,
        year,
        totalDuration,
        songs: albumSongs,
        cover,
      };
    });

    return list.sort((a, b) => {
      if (sortBy === 'tracks') {
        const diff = b.songs.length - a.songs.length;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }
      if (sortBy === 'year') {
        const yA = parseInt(a.year || '0', 10) || 0;
        const yB = parseInt(b.year || '0', 10) || 0;
        if (yB !== yA) return yB - yA;
      }
      return a.name.localeCompare(b.name);
    });
  }, [songs, sortBy, singlesLabel, t.unknownArtist, t.otherArtistsWord, isRTL]);

  const filteredGroups = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (album) =>
        album.name.toLowerCase().includes(q) || album.artist.toLowerCase().includes(q)
    );
  }, [groups, filterQuery]);

  const activeAlbum = useMemo(
    () => (selectedAlbumKey ? groups.find((g) => g.key === selectedAlbumKey) || null : null),
    [selectedAlbumKey, groups]
  );

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

  const currentAlbumKey = currentSong ? currentSong.album?.trim() || singlesLabel : null;

  const cycleSort = () => {
    setSortBy((prev) => (prev === 'name' ? 'tracks' : prev === 'tracks' ? 'year' : 'name'));
  };

  const sortLabel =
    sortBy === 'tracks'
      ? t.sortByTracks || 'تعداد آهنگ'
      : sortBy === 'year'
      ? t.sortByYear || 'سال انتشار'
      : t.sortAlbum || 'نام آلبوم';

  return (
    <div style={{ width: '100%', flex: 1, overflowX: 'clip' }}>
      <AnimatePresence mode="wait" initial={false}>
        {selectedAlbumKey && activeAlbum ? (
          <motion.div
            key={`album-detail-${activeAlbum.key}`}
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <AllSongs
              songs={activeAlbum.songs}
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
              title={activeAlbum.name}
              onBack={() => setSelectedAlbumKey(null)}
              backLabel={t.albumsTitle || t.albums || 'آلبوم‌ها'}
              emptyMessage={t.noSongs}
              glassCardCovers={glassCardCovers}
              onBulkDeleteSongs={onBulkDeleteSongs}
              confirmBeforeDelete={confirmBeforeDelete}
            />
          </motion.div>
        ) : (
          <motion.div
            key="albums-main"
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1,
              width: '100%',
              padding: 'clamp(12px, 2vw, 24px) clamp(16px, 3.2vw, 36px) 116px',
              direction: isRTL ? 'rtl' : 'ltr',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            {/* هدر صفحه آلبوم‌ها */}
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
                  {t.albumsTitle || t.albums || 'آلبوم‌ها'}
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
                    {groups.length} {t.albumsCountLabel || 'آلبوم'}
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
                {/* جستجوی سریع در آلبوم‌ها */}
                {groups.length > 0 && (
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      height: '36px',
                      width: 'clamp(175px, 24vw, 230px)',
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
                      placeholder={t.searchAlbums || 'جستجوی آلبوم یا خواننده...'}
                      aria-label={t.searchAlbums || 'جستجوی آلبوم یا خواننده...'}
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
                  onClick={cycleSort}
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
                  <span>{sortLabel}</span>
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
                <Disc size={36} style={{ opacity: 0.42 }} />
                <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>
                  {t.noAlbums || 'هنوز آلبومی در کتابخانه وجود ندارد.'}
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
                {filteredGroups.map((album) => {
                  const isHovered = hoveredId === album.key;
                  const isActiveAlbum = Boolean(
                    currentSong &&
                      (album.songs.some((s) => s.id === currentSong.id) ||
                        currentAlbumKey === album.key)
                  );
                  const showPlay = isHovered || focusedPlayId === album.key;
                  const isMenuOpen = ctxMenu?.album.key === album.key;

                  return (
                    <div
                      key={album.key}
                      onClick={() => setSelectedAlbumKey(album.key)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openAlbumMenu(album, null, { x: e.clientX, y: e.clientY });
                      }}
                      onMouseEnter={() => setHoveredId(album.key)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        backgroundColor: isActiveAlbum
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
                        padding: '12px 12px 14px',
                        cursor: 'pointer',
                        border: `1px solid ${
                          isActiveAlbum
                            ? theme.colors.primary
                            : isHovered
                            ? theme.colors.borderLight || withAlpha(theme.colors.primary, 0.45)
                            : theme.colors.border
                        }`,
                        boxShadow: isActiveAlbum
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
                        position: 'relative',
                        overflow: 'hidden',
                        minWidth: 0,
                      }}
                    >
                      {/* هاله شیشه‌ای لطیف پشت کارت آلبوم */}
                      {glassCardCovers && album.cover && (
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
                            src={album.cover}
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

                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: theme.radius.md || '12px',
                          overflow: 'hidden',
                          border: `1px solid ${
                            isActiveAlbum
                              ? theme.colors.primary
                              : theme.isDark
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0, 0, 0, 0.07)'
                          }`,
                          boxShadow: theme.isDark
                            ? '0 8px 20px rgba(0, 0, 0, 0.34)'
                            : '0 6px 16px rgba(0, 0, 0, 0.1)',
                          zIndex: 1,
                        }}
                      >
                        <CoverImage
                          src={album.cover}
                          alt={album.name}
                          iconSize={40}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />

                        {isActiveAlbum && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '10px',
                              insetInlineStart: '10px',
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0, 0, 0, 0.68)',
                              border: '1px solid rgba(255, 255, 255, 0.22)',
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
                            }}
                          >
                            <MiniEqualizer active={isPlaying} color="#ffffff" size="sm" />
                          </div>
                        )}

                        <button
                          ref={(el) => {
                            menuTriggerRefs.current[album.key] = el;
                          }}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMenuOpen) setCtxMenu(null);
                            else openAlbumMenu(album, e.currentTarget.getBoundingClientRect());
                          }}
                          onFocus={() => setFocusedPlayId(album.key)}
                          onBlur={() => setFocusedPlayId(null)}
                          aria-label={t.moreActions || 'Actions'}
                          title={t.moreActions || 'Actions'}
                          style={{
                            position: 'absolute',
                            top: '10px',
                            insetInlineEnd: '10px',
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            border: '1px solid rgba(255, 255, 255, 0.22)',
                            backgroundColor: isMenuOpen
                              ? theme.colors.primary
                              : 'rgba(0, 0, 0, 0.56)',
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            opacity: showPlay || isMenuOpen ? 1 : 0,
                            pointerEvents: showPlay || isMenuOpen ? 'auto' : 'none',
                            transition: 'opacity 0.16s ease, background-color 0.16s ease',
                            zIndex: 2,
                          }}
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (album.songs.length > 0) {
                              onPlaySongFromList(album.songs[0], album.songs);
                            }
                          }}
                          onFocus={() => setFocusedPlayId(album.key)}
                          onBlur={() => setFocusedPlayId(null)}
                          aria-label={`${t.playAll || 'پخش همه'} — ${album.name}`}
                          title={t.playAll || 'پخش همه'}
                          style={{
                            position: 'absolute',
                            bottom: '10px',
                            insetInlineEnd: '10px',
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: theme.colors.primary,
                            color: theme.colors.onPrimary || '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingLeft: '2px',
                            cursor: 'pointer',
                            opacity: showPlay ? 1 : 0,
                            pointerEvents: showPlay ? 'auto' : 'none',
                            transition: 'opacity 0.16s ease',
                            boxShadow: `0 6px 16px ${withAlpha(theme.colors.primary, 0.48)}`,
                          }}
                        >
                          <Play size={16} fill={theme.colors.onPrimary || '#ffffff'} />
                        </button>
                      </div>

                      <div
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          marginTop: '11px',
                          minWidth: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <h3
                          title={album.name}
                          style={{
                            margin: 0,
                            fontSize: '0.9375rem',
                            fontWeight: 700,
                            lineHeight: 1.35,
                            color: isActiveAlbum ? theme.colors.primary : theme.colors.textPrimary,
                            ...getBidiTruncateStyle(album.name, isRTL),
                          }}
                        >
                          {album.name}
                        </h3>

                        <div
                          title={album.artist}
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 500,
                            lineHeight: 1.35,
                            color: theme.colors.textSecondary,
                            ...getBidiTruncateStyle(album.artist, isRTL),
                          }}
                        >
                          {album.artist}
                        </div>

                        <div
                          style={{
                            marginTop: '2px',
                            fontSize: '0.75rem',
                            color: theme.colors.textSecondary,
                            opacity: 0.78,
                            fontVariantNumeric: 'tabular-nums',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            flexWrap: 'wrap',
                            lineHeight: 1.35,
                          }}
                        >
                          <span>
                            {album.songs.length} {t.tracksCount || 'آهنگ'}
                          </span>
                          {album.year && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{album.year}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: listGap }}>
                {filteredGroups.map((album) => {
                  const isHovered = hoveredId === album.key;
                  const isActiveAlbum = Boolean(
                    currentSong &&
                      (album.songs.some((s) => s.id === currentSong.id) ||
                        currentAlbumKey === album.key)
                  );
                  const totalDur = formatTotalDuration(album.totalDuration);
                  const isMenuOpen = ctxMenu?.album.key === album.key;

                  return (
                    <div
                      key={album.key}
                      onClick={() => setSelectedAlbumKey(album.key)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openAlbumMenu(album, null, { x: e.clientX, y: e.clientY });
                      }}
                      onMouseEnter={() => setHoveredId(album.key)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: listRowPadding,
                        backgroundColor: isActiveAlbum
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
                          isActiveAlbum
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
                        boxShadow: isActiveAlbum
                          ? `0 6px 18px ${withAlpha(theme.colors.primary, 0.22)}`
                          : 'none',
                      }}
                    >
                      {glassCardCovers && album.cover && (
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
                            src={album.cover}
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
                          width: '52px',
                          height: '52px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: `1.5px solid ${
                            isActiveAlbum ? theme.colors.primary : theme.colors.border
                          }`,
                          zIndex: 1,
                        }}
                      >
                        <CoverImage
                          src={album.cover}
                          alt={album.name}
                          iconSize={20}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                        {isActiveAlbum && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: 'rgba(0, 0, 0, 0.48)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            <MiniEqualizer active={isPlaying} color="#ffffff" size="sm" />
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                        <div
                          title={album.name}
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 700,
                            color: isActiveAlbum ? theme.colors.primary : theme.colors.textPrimary,
                            ...getBidiTruncateStyle(album.name, isRTL),
                          }}
                        >
                          {album.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            marginTop: '3px',
                            fontSize: '0.7813rem',
                            color: theme.colors.textSecondary,
                            fontVariantNumeric: 'tabular-nums',
                            minWidth: 0,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            title={album.artist}
                            style={{
                              display: 'inline-block',
                              maxWidth: '240px',
                              ...getBidiTruncateStyle(album.artist, isRTL),
                            }}
                          >
                            {album.artist}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {album.songs.length} {t.tracksCount || 'آهنگ'}
                          </span>
                          {album.year && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{album.year}</span>
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
                          if (album.songs.length > 0) {
                            onPlaySongFromList(album.songs[0], album.songs);
                          }
                        }}
                        aria-label={`${t.playAll || 'پخش همه'} — ${album.name}`}
                        title={t.playAll || 'پخش همه'}
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border:
                            isHovered || isActiveAlbum
                              ? 'none'
                              : `1px solid ${withAlpha(theme.colors.primary, 0.28)}`,
                          backgroundColor:
                            isHovered || isActiveAlbum
                              ? theme.colors.primary
                              : withAlpha(theme.colors.primary, theme.isDark ? 0.14 : 0.1),
                          color:
                            isHovered || isActiveAlbum
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

                      <button
                        ref={(el) => {
                          menuTriggerRefs.current[album.key] = el;
                        }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMenuOpen) setCtxMenu(null);
                          else openAlbumMenu(album, e.currentTarget.getBoundingClientRect());
                        }}
                        aria-label={t.moreActions || 'Actions'}
                        title={t.moreActions || 'Actions'}
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: isMenuOpen
                            ? withAlpha(theme.colors.primary, 0.16)
                            : 'transparent',
                          color: isMenuOpen ? theme.colors.primary : theme.colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'background-color 0.16s ease, color 0.16s ease',
                        }}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* منوی شناور راست‌کلیک / سه‌نقطه آلبوم‌ها */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {ctxMenu && (
              <motion.div
                key={`album-ctx-${ctxMenu.album.key}`}
                ref={portalMenuRef}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  position: 'fixed',
                  left: ctxMenu.position.left,
                  top: ctxMenu.position.top,
                  transformOrigin: `${ctxMenu.position.originY} ${ctxMenu.position.originX}`,
                  willChange: 'transform, opacity',
                  padding: '5px',
                  backgroundColor:
                    theme.colors.surfaceSolid || (theme.isDark ? '#18181c' : '#ffffff'),
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.border}`,
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.42)',
                  zIndex: 99999,
                  minWidth: 192,
                  maxWidth: 'calc(100vw - 24px)',
                  direction: isRTL ? 'rtl' : 'ltr',
                  fontFamily: theme.fonts?.main,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAlbumKey(ctxMenu.album.key);
                    setCtxMenu(null);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.isDark
                      ? 'rgba(255, 255, 255, 0.12)'
                      : 'rgba(0, 0, 0, 0.07)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.colors.textPrimary,
                    fontSize: '0.8438rem',
                    fontWeight: 500,
                    textAlign: 'start',
                  }}
                >
                  <FolderOpen size={15} /> <span>{t.open || (isRTL ? 'باز کردن' : 'Open')}</span>
                </button>
                {ctxMenu.album.songs.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onPlaySongFromList(ctxMenu.album.songs[0], ctxMenu.album.songs);
                        setCtxMenu(null);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme.isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.07)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: theme.colors.textPrimary,
                        fontSize: '0.8438rem',
                        fontWeight: 500,
                        textAlign: 'start',
                      }}
                    >
                      <Play size={15} /> <span>{t.playAll || 'پخش همه'}</span>
                    </button>
                    {onPlayNext && (
                      <button
                        type="button"
                        onClick={() => {
                          onPlayNext(ctxMenu.album.songs);
                          setCtxMenu(null);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.07)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: theme.colors.textPrimary,
                          fontSize: '0.8438rem',
                          fontWeight: 500,
                          textAlign: 'start',
                        }}
                      >
                        <SkipForward size={15} /> <span>{t.playNext || 'پخش بعدی'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        ctxMenu.album.songs.forEach((s) => addToQueue(s));
                        setCtxMenu(null);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme.isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.07)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: theme.colors.textPrimary,
                        fontSize: '0.8438rem',
                        fontWeight: 500,
                        textAlign: 'start',
                      }}
                    >
                      <ListPlus size={15} /> <span>{t.addToQueue || 'افزودن به صف'}</span>
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
