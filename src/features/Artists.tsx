import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
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
  const [ctxMenu, setCtxMenu] = useState<{
    artist: ArtistGroup;
    position: ContextMenuPosition;
  } | null>(null);
  const portalMenuRef = useRef<HTMLDivElement | null>(null);
  const menuTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const initialName = initialArtist?.name ?? null;
  const initialToken = initialArtist?.token ?? null;

  useEffect(() => {
    if (initialName !== null && initialToken !== null) {
      setSelectedArtist(initialName);
    }
  }, [initialName, initialToken]);

  const openArtistMenu = useCallback(
    (artist: ArtistGroup, rect: DOMRect | null, coords?: { x: number; y: number }) => {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const isRtlDir = language === 'fa';
      const menuWidth = 200;
      const itemCount = 1 + (artist.songs.length > 0 ? 2 + (onPlayNext ? 1 : 0) : 0);
      const menuHeight = itemCount * 38 + 14;
      const position = coords
        ? clampContextMenuPosition({
            clientX: coords.x,
            clientY: coords.y,
            menuWidth,
            menuHeight,
            viewportWidth: vw,
            viewportHeight: vh,
            isRTL: isRtlDir,
          })
        : rect
        ? computeAnchorMenuPosition({
            rect,
            menuWidth,
            menuHeight,
            viewportWidth: vw,
            viewportHeight: vh,
            isRTL: isRtlDir,
          })
        : clampContextMenuPosition({
            clientX: vw / 2,
            clientY: vh / 2,
            menuWidth,
            menuHeight,
            viewportWidth: vw,
            viewportHeight: vh,
            isRTL: isRtlDir,
          });
      setCtxMenu({ artist, position });
    },
    [language, onPlayNext]
  );

  useEffect(() => {
    if (!ctxMenu) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (portalMenuRef.current?.contains(target)) return;
      const triggerEl = menuTriggerRefs.current[ctxMenu.artist.name];
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
              padding: 'clamp(12px, 2vw, 24px) clamp(16px, 3.2vw, 36px) 116px',
              direction: isRTL ? 'rtl' : 'ltr',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
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
                  gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(146px, 18vw, 178px), 1fr))',
                  gap: gridGap,
                  rowGap: density === 'compact' ? '18px' : '24px',
                }}
              >
                {filteredGroups.map((artist) => {
                  const isHovered = hoveredId === artist.name;
                  const isActiveArtist = Boolean(
                    currentSong &&
                      (artist.songs.some((s) => s.id === currentSong.id) ||
                        currentArtistKey === artist.name)
                  );
                  const showPlay = isHovered || focusedPlayId === artist.name;
                  const isMenuOpen = ctxMenu?.artist.name === artist.name;

                  return (
                    <div
                      key={artist.name}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedArtist(artist.name)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openArtistMenu(artist, null, { x: e.clientX, y: e.clientY });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedArtist(artist.name);
                        }
                      }}
                      onMouseEnter={() => setHoveredId(artist.name)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        padding: '8px 6px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        position: 'relative',
                        minWidth: 0,
                        outline: 'none',
                      }}
                    >
                      <button
                        ref={(el) => {
                          menuTriggerRefs.current[artist.name] = el;
                        }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMenuOpen) setCtxMenu(null);
                          else openArtistMenu(artist, e.currentTarget.getBoundingClientRect());
                        }}
                        onFocus={() => setFocusedPlayId(artist.name)}
                        onBlur={() => setFocusedPlayId(null)}
                        aria-label={t.moreActions || 'Actions'}
                        title={t.moreActions || 'Actions'}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          insetInlineEnd: '8px',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: `1px solid ${theme.colors.border}`,
                          backgroundColor: isMenuOpen
                            ? theme.colors.primary
                            : theme.colors.surfaceSolid || (theme.isDark ? '#1c1c20' : '#ffffff'),
                          color: isMenuOpen
                            ? theme.colors.onPrimary || '#ffffff'
                            : theme.colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          opacity: showPlay || isMenuOpen ? 1 : 0,
                          pointerEvents: showPlay || isMenuOpen ? 'auto' : 'none',
                          transition: 'opacity 0.16s ease, background-color 0.16s ease',
                          zIndex: 3,
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {/* آواتار کاملاً دایره‌ای خواننده با ابعاد یکسان عرض و ارتفاع */}
                      <div
                        style={{
                          position: 'relative',
                          width: 'clamp(124px, 15vw, 150px)',
                          height: 'clamp(124px, 15vw, 150px)',
                          aspectRatio: '1 / 1',
                          flexShrink: 0,
                          zIndex: 1,
                        }}
                      >
                        {/* هاله نوری دایره‌ای پشت آواتار */}
                        {glassCardCovers && artist.cover && (
                          <div
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              inset: '-10px',
                              borderRadius: '50%',
                              overflow: 'hidden',
                              pointerEvents: 'none',
                              zIndex: 0,
                              opacity: isActiveArtist || isHovered ? (theme.isDark ? 0.48 : 0.34) : theme.isDark ? 0.24 : 0.14,
                              filter: 'blur(20px) saturate(165%)',
                              transition: 'opacity 0.22s ease',
                            }}
                          >
                            <img
                              src={artist.cover}
                              alt=""
                              draggable={false}
                              style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          </div>
                        )}

                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            backgroundColor: surfaceBase,
                            border: `${isActiveArtist ? '2.5px' : '2px'} solid ${
                              isActiveArtist
                                ? theme.colors.primary
                                : isHovered
                                ? theme.colors.borderLight || withAlpha(theme.colors.primary, 0.55)
                                : theme.isDark
                                ? 'rgba(255, 255, 255, 0.14)'
                                : 'rgba(0, 0, 0, 0.08)'
                            }`,
                            boxShadow: isActiveArtist
                              ? `0 12px 28px ${withAlpha(theme.colors.primary, 0.34)}`
                              : isHovered
                              ? `0 16px 32px rgba(0, 0, 0, ${theme.isDark ? 0.42 : 0.14}), 0 0 22px ${withAlpha(
                                  theme.colors.glow || theme.colors.primary,
                                  0.26
                                )}`
                              : theme.isDark
                              ? '0 10px 24px rgba(0, 0, 0, 0.38)'
                              : '0 8px 20px rgba(0, 0, 0, 0.11)',
                            transition:
                              'border-color 0.2s ease, box-shadow 0.2s ease',
                            zIndex: 1,
                          }}
                        >
                          <CoverImage
                            src={artist.cover}
                            alt={artist.name}
                            iconSize={40}
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              display: 'block',
                              transform: isHovered ? 'scale(1.045)' : 'scale(1)',
                              transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
                            }}
                          />

                          {isActiveArtist && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0, 0, 0, 0.46)',
                                backdropFilter: 'blur(2px)',
                                WebkitBackdropFilter: 'blur(2px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                              }}
                            >
                              <MiniEqualizer active={isPlaying} color="#ffffff" size="md" />
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
                            bottom: '4px',
                            insetInlineEnd: '4px',
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            border: `2px solid ${
                              theme.colors.surfaceSolid || theme.colors.background
                            }`,
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
                            boxShadow: `0 6px 18px ${withAlpha(theme.colors.primary, 0.48)}`,
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
                          margin: '12px 0 0 0',
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
                          marginTop: '3px',
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
                  const isActiveArtist = Boolean(
                    currentSong &&
                      (artist.songs.some((s) => s.id === currentSong.id) ||
                        currentArtistKey === artist.name)
                  );
                  const totalDur = formatTotalDuration(artist.totalDuration);
                  const isMenuOpen = ctxMenu?.artist.name === artist.name;

                  return (
                    <div
                      key={artist.name}
                      onClick={() => setSelectedArtist(artist.name)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openArtistMenu(artist, null, { x: e.clientX, y: e.clientY });
                      }}
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
                          width: '52px',
                          height: '52px',
                          minWidth: '52px',
                          minHeight: '52px',
                          aspectRatio: '1 / 1',
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
                            borderRadius: '50%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                        {isActiveArtist && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: '50%',
                              backgroundColor: 'rgba(0, 0, 0, 0.46)',
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

                      <button
                        ref={(el) => {
                          menuTriggerRefs.current[artist.name] = el;
                        }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isMenuOpen) setCtxMenu(null);
                          else openArtistMenu(artist, e.currentTarget.getBoundingClientRect());
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

      {/* منوی شناور راست‌کلیک / سه‌نقطه خواننده‌ها */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {ctxMenu && (
              <motion.div
                key={`artist-ctx-${ctxMenu.artist.name}`}
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
                    setSelectedArtist(ctxMenu.artist.name);
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
                {ctxMenu.artist.songs.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onPlaySongFromList(ctxMenu.artist.songs[0], ctxMenu.artist.songs);
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
                          onPlayNext(ctxMenu.artist.songs);
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
                        ctxMenu.artist.songs.forEach((s) => addToQueue(s));
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
