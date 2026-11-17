import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  MoreHorizontal,
  SkipForward,
  Trash2,
  CheckSquare,
  ArrowUpDown,
  Play,
  Info,
  FolderPlus,
  Check,
  Heart,
  ArrowLeft,
  ArrowRight,
  X,
} from 'lucide-react';
import type { Song, Playlist } from '../types';
import { EditSongModal } from '../components/EditSongModal';
import { SongInfoModal } from '../components/SongInfoModal';
import { CoverImage } from '../components/CoverImage';
import { IOSConfirmDialog } from '../components/IOSSettingsPrimitives';
import { mixHex, withAlpha } from '../utils/color';

// ================= اینترفیس پراپ‌ها =================

interface AllSongsProps {
  songs: Song[];
  playlists: Playlist[];
  currentSong: Song | null;
  isPlaying?: boolean;
  onPlaySongFromList: (song: Song, list: Song[]) => void;
  onCreatePlaylist?: (name: string, selectedSongs: Song[]) => void;
  addToQueue?: (song: Song) => void;
  onPlayNext?: (songs: Song | Song[]) => void;
  onDeleteSong: (id: string) => void;
  onUpdateSong: (updatedSong: Song) => void;
  onAddSongToPlaylist: (playlistId: string, song: Song) => void;
  onToggleFavorite?: (id: string) => void;
  t: any;
  searchTerm?: string;
  theme: any;
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  emptyMessage?: string;
  glassCardCovers?: boolean;
  headerActions?: React.ReactNode;
  onBulkDeleteSongs?: (ids: string[]) => void;
  deleteActionLabel?: string;
  confirmBeforeDelete?: boolean;
}

// ================= کامپوننت اصلی =================

export const AllSongs = ({
  songs,
  playlists,
  currentSong,
  isPlaying = false,
  onPlaySongFromList,
  onCreatePlaylist: _onCreatePlaylist,
  addToQueue,
  onPlayNext,
  onDeleteSong,
  onUpdateSong,
  onAddSongToPlaylist,
  onToggleFavorite,
  t,
  searchTerm = '',
  theme,
  title,
  onBack,
  backLabel,
  emptyMessage,
  glassCardCovers = true,
  headerActions,
  onBulkDeleteSongs,
  deleteActionLabel,
  confirmBeforeDelete = true,
}: AllSongsProps) => {
  // استیت‌های انتخاب
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // استیت‌های منوها
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  }>({ top: 0, right: 16 });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'artist'>(
    'date'
  );

  // استیت‌های UI
  const [hoveredSongId, setHoveredSongId] = useState<string | null>(
    null
  );
  const [hoveredMenuId, setHoveredMenuId] = useState<string | null>(
    null
  );
  const [hoveredDropdownItem, setHoveredDropdownItem] = useState<string | null>(null);

  // استیت‌های مودال
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [infoSong, setInfoSong] = useState<Song | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [playlistTargetSongIds, setPlaylistTargetSongIds] = useState<string[]>([]);
  const [targetPlaylistId, setTargetPlaylistId] = useState<
    string | null
  >(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);

  // استیت ریسپانسیو موبایل و منوی سه‌نقطه عملیات گروهی
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);

  useEffect(() => {
    setHoveredDropdownItem(null);
  }, [activeMenuId, isSortMenuOpen, isBulkMenuOpen]);

  // رفرنس‌ها
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const songMenuRefs = useRef<{
    [key: string]: HTMLDivElement | null;
  }>({});
  const activeSongDropdownRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // ================= افکت‌ها =================

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isSelectMode || selectedSongs.length === 0) {
      setIsBulkMenuOpen(false);
    }
  }, [isSelectMode, selectedSongs.length]);

  /** بستن منوها هنگام کلیک در بیرون */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSortMenuOpen &&
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target as Node)
      ) {
        setIsSortMenuOpen(false);
      }
      if (
        isBulkMenuOpen &&
        bulkMenuRef.current &&
        !bulkMenuRef.current.contains(event.target as Node)
      ) {
        setIsBulkMenuOpen(false);
      }
      if (activeMenuId) {
        const menuRef = songMenuRefs.current[activeMenuId];
        const clickedTrigger = menuRef?.contains(event.target as Node);
        const clickedDropdown = activeSongDropdownRef.current?.contains(event.target as Node);
        if (!clickedTrigger && !clickedDropdown) {
          setActiveMenuId(null);
        }
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsBulkMenuOpen(false);
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [activeMenuId, isSortMenuOpen, isBulkMenuOpen]);

  /** بستن منوی سه‌نقطه هنگام اسکرول، تغییر اندازه یا فشردن Escape */
  useEffect(() => {
    if (!activeMenuId) return;
    const handleClose = (e: Event) => {
      if (
        e.type === 'scroll' &&
        activeSongDropdownRef.current &&
        e.target instanceof Node &&
        activeSongDropdownRef.current.contains(e.target)
      ) {
        return;
      }
      setActiveMenuId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenuId(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuId]);

  // ================= توابع کمکی =================

  /** تبدیل ثانیه به فرمت دقیقه:ثانیه */
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ================= منطق داده‌ها =================

  /** فیلتر و مرتب‌سازی آهنگ‌ها (مموایز شده برای جلوگیری از پردازش مجدد هنگام هاور ماوس) */
  const filteredAndSortedSongs = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return songs
      .filter(
        (song) =>
          song.name.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (sortBy === 'date') return b.addedAt - a.addedAt;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
        return 0;
      });
  }, [songs, searchTerm, sortBy]);

  // ================= توابع کنترلی =================

  /** انتخاب یا لغو انتخاب یک آهنگ */
  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!isSelectMode) return;
    const isAlreadySelected = selectedSongs.includes(id);
    const nextSelected = isAlreadySelected
      ? selectedSongs.filter((s) => s !== id)
      : [...selectedSongs, id];

    setSelectedSongs(nextSelected);
    if (isAlreadySelected && nextSelected.length === 0) {
      setIsSelectMode(false);
    }
  };

  /** انتخاب همه یا لغو انتخاب همه */
  const handleSelectAll = () => {
    if (
      selectedSongs.length === filteredAndSortedSongs.length &&
      filteredAndSortedSongs.length > 0
    ) {
      exitSelectMode();
    } else {
      setSelectedSongs(filteredAndSortedSongs.map((s) => s.id));
      setIsSelectMode(true);
    }
  };

  /** ورود به حالت انتخاب از نوار بالا یا خروج از آن */
  const handleToggleSelectMode = () => {
    if (isSelectMode) {
      exitSelectMode();
    } else {
      setIsSelectMode(true);
      setSelectedSongs([]);
      setIsSortMenuOpen(false);
      setActiveMenuId(null);
    }
  };

  /** خروج از حالت انتخاب */
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedSongs([]);
  };

  /** پخش آهنگ‌های انتخاب‌شده */
  const handlePlaySelected = () => {
    const selectedSet = new Set(selectedSongs);
    const toPlay = filteredAndSortedSongs.filter((s) => selectedSet.has(s.id));
    if (toPlay.length === 0) return;
    onPlaySongFromList(toPlay[0], toPlay);
    exitSelectMode();
  };

  const executeDeleteIds = (ids: string[]) => {
    if (ids.length === 0) return;
    if (ids.length === 1 && !onBulkDeleteSongs) {
      onDeleteSong(ids[0]);
    } else if (onBulkDeleteSongs) {
      onBulkDeleteSongs(ids);
    } else {
      ids.forEach((id) => onDeleteSong(id));
    }
    setActiveMenuId(null);
    if (isSelectMode) exitSelectMode();
  };

  /** حذف یک آهنگ با تأییدیه iOS */
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirmBeforeDelete) {
      executeDeleteIds([id]);
      return;
    }
    setActiveMenuId(null);
    setPendingDeleteIds([id]);
  };

  /** حذف گروهی آهنگ‌های انتخاب شده با تأییدیه iOS */
  const handleBulkDelete = () => {
    if (selectedSongs.length === 0) return;
    if (!confirmBeforeDelete) {
      executeDeleteIds(selectedSongs);
      return;
    }
    setPendingDeleteIds([...selectedSongs]);
  };

  /** پخش بعدی گروهی آهنگ‌های انتخاب شده */
  const handleBulkPlayNext = () => {
    const selectedSet = new Set(selectedSongs);
    const toQueue = filteredAndSortedSongs.filter((s) => selectedSet.has(s.id));
    if (toQueue.length === 0) return;
    if (onPlayNext) {
      onPlayNext(toQueue);
    } else if (addToQueue) {
      toQueue.forEach((s) => addToQueue(s));
    }
    exitSelectMode();
  };

  /** باز کردن مودال انتخاب پلی‌لیست */
  const handleOpenPlaylistModal = (songId?: string) => {
    const ids = songId ? [songId] : selectedSongs;
    if (ids.length === 0) return;
    setPlaylistTargetSongIds(ids);
    setTargetPlaylistId(null);
    setIsPlaylistModalOpen(true);
    setActiveMenuId(null);
  };

  /** بستن مودال انتخاب پلی‌لیست */
  const closePlaylistModal = () => {
    setIsPlaylistModalOpen(false);
    setTargetPlaylistId(null);
    setPlaylistTargetSongIds([]);
  };

  /** تایید نهایی افزودن به پلی‌لیست */
  const handleConfirmAddToPlaylist = () => {
    if (!targetPlaylistId) return;
    const targetIds = playlistTargetSongIds.length > 0 ? playlistTargetSongIds : selectedSongs;
    const toAdd = songs.filter((s) => targetIds.includes(s.id));
    toAdd.forEach((s) =>
      onAddSongToPlaylist(targetPlaylistId, s)
    );
    closePlaylistModal();
    if (isSelectMode) exitSelectMode();
  };

  /** محاسبه موقعیت منوی سه‌نقطه در ویوپورت با در نظر گرفتن نوار بالا و پلیر شناور پایین */
  const handleOpenMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    songId: string
  ) => {
    e.stopPropagation();
    if (activeMenuId === songId) {
      setActiveMenuId(null);
      return;
    }
    const buttonRect = e.currentTarget.getBoundingClientRect();
    const estimatedMenuHeight = onToggleFavorite ? 255 : 218;
    const spaceBelow = window.innerHeight - buttonRect.bottom - 115;
    const spaceAbove = buttonRect.top - 80;
    const openUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const right = Math.max(12, window.innerWidth - buttonRect.right);

    if (openUp) {
      setMenuPosition({
        bottom: Math.max(12, window.innerHeight - buttonRect.top + 6),
        right,
      });
    } else {
      const rawTop = buttonRect.bottom + 6;
      const maxTop = Math.max(12, window.innerHeight - estimatedMenuHeight - 16);
      setMenuPosition({
        top: Math.min(rawTop, maxTop),
        right,
      });
    }
    setActiveMenuId(songId);
  };

  const activeMenuSong = useMemo(
    () =>
      activeMenuId
        ? filteredAndSortedSongs.find((s) => s.id === activeMenuId) ?? null
        : null,
    [activeMenuId, filteredAndSortedSongs]
  );

  // ================= رندر =================
  return (
    <div ref={pageRef} style={styles.container}>
      {/* هدر دسته‌بندی در صورت باز شدن از بخش خانه */}
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
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
                {t.close !== 'Close' ? <ArrowRight size={19} /> : <ArrowLeft size={19} />}
                <span>{backLabel || t.back}</span>
              </button>
            )}
            <h1
              style={{
                fontSize: 'clamp(1.25rem, 2.5vw, 1.625rem)',
                fontWeight: '800',
                color: theme.colors.textPrimary,
                margin: 0,
              }}
            >
              {title}
            </h1>
            <span
              style={{
                fontSize: '0.8125rem',
                color: theme.colors.textSecondary,
                fontWeight: '500',
              }}
            >
              ({filteredAndSortedSongs.length} {t.tracksCount || 'آهنگ'})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {headerActions}
            {filteredAndSortedSongs.length > 0 && !isSelectMode && (
              <button
                onClick={() =>
                  onPlaySongFromList(
                    filteredAndSortedSongs[0],
                    filteredAndSortedSongs
                  )
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: theme.radius.md,
                  border: 'none',
                  backgroundColor: theme.colors.primary,
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.8125rem',
                  transition: 'opacity 0.2s',
                }}
              >
                <Play size={15} fill="#fff" />
                <span>{t.playAll || 'پخش همه'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* نوار دکمه‌های بالا (مرتب‌سازی، انتخاب و دکمه‌های عملیات روی آهنگ‌های انتخابی) */}
      <div style={styles.headerActions}>
        <div
          style={{
            marginInlineEnd: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            minWidth: 0,
          }}
        >
          {isSelectMode && (
            <>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  ...styles.actionBtn(theme, selectedSongs.length === filteredAndSortedSongs.length && filteredAndSortedSongs.length > 0),
                  padding: isMobile ? '6px 10px' : '6px 12px',
                  fontSize: isMobile ? '0.7813rem' : '0.8125rem',
                }}
              >
                {selectedSongs.length === filteredAndSortedSongs.length &&
                filteredAndSortedSongs.length > 0
                  ? t.deselectAll || 'لغو انتخاب همه'
                  : t.selectAll || 'انتخاب همه'}
              </button>
              {selectedSongs.length > 0 && (
                <span
                  style={{
                    fontSize: '0.7813rem',
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedSongs.length}{!isMobile ? ` ${t.selected || 'انتخاب شده'}` : ''}
                </span>
              )}
            </>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          {isSelectMode && selectedSongs.length > 0 && !isMobile && (
            <>
              <button
                type="button"
                onClick={handlePlaySelected}
                style={styles.actionBtn(theme, true)}
              >
                <Play size={14} fill="currentColor" />
                <span>{t.play || 'پخش'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenPlaylistModal()}
                style={styles.actionBtn(theme, false)}
              >
                <FolderPlus size={15} />
                <span>{t.addToPlaylist || 'افزودن به لیست'}</span>
              </button>

              <button
                type="button"
                onClick={handleBulkPlayNext}
                style={styles.actionBtn(theme, false)}
              >
                <SkipForward size={15} />
                <span>{t.playNext || 'پخش بعدی'}</span>
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                style={{
                  ...styles.actionBtn(theme, false),
                  color: theme.colors.danger || '#ff453a',
                  borderColor: withAlpha(theme.colors.danger || '#ff453a', 0.35),
                  backgroundColor: withAlpha(theme.colors.danger || '#ff453a', 0.1),
                }}
              >
                <Trash2 size={15} />
                <span>{deleteActionLabel || t.deleteSong}</span>
              </button>
            </>
          )}

          {isSelectMode && selectedSongs.length > 0 && isMobile && (
            <div style={{ position: 'relative' }} ref={bulkMenuRef}>
              <button
                type="button"
                aria-label={t.moreActions || 'Actions'}
                onClick={() => setIsBulkMenuOpen((prev) => !prev)}
                style={{
                  ...styles.actionBtn(theme, isBulkMenuOpen),
                  padding: '6px 10px',
                }}
              >
                <MoreHorizontal size={17} />
              </button>
              {isBulkMenuOpen && (
                <div style={styles.dropdown(theme, '190px')}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkMenuOpen(false);
                      handlePlaySelected();
                    }}
                    style={menuItemStyle(theme, false, hoveredDropdownItem === 'bulk-play')}
                    onMouseEnter={() => setHoveredDropdownItem('bulk-play')}
                    onMouseLeave={() => setHoveredDropdownItem(null)}
                  >
                    <Play size={15} />
                    <span>{t.play || 'پخش'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkMenuOpen(false);
                      handleOpenPlaylistModal();
                    }}
                    style={menuItemStyle(theme, false, hoveredDropdownItem === 'bulk-playlist')}
                    onMouseEnter={() => setHoveredDropdownItem('bulk-playlist')}
                    onMouseLeave={() => setHoveredDropdownItem(null)}
                  >
                    <FolderPlus size={15} />
                    <span>{t.addToPlaylist || 'افزودن به لیست'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkMenuOpen(false);
                      handleBulkPlayNext();
                    }}
                    style={menuItemStyle(theme, false, hoveredDropdownItem === 'bulk-next')}
                    onMouseEnter={() => setHoveredDropdownItem('bulk-next')}
                    onMouseLeave={() => setHoveredDropdownItem(null)}
                  >
                    <SkipForward size={15} />
                    <span>{t.playNext || 'پخش بعدی'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkMenuOpen(false);
                      handleBulkDelete();
                    }}
                    style={{
                      ...menuItemStyle(theme, false, hoveredDropdownItem === 'bulk-delete', true),
                      color: theme.colors.danger || '#ff453a',
                    }}
                    onMouseEnter={() => setHoveredDropdownItem('bulk-delete')}
                    onMouseLeave={() => setHoveredDropdownItem(null)}
                  >
                    <Trash2 size={15} />
                    <span>{deleteActionLabel || t.deleteSong}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {songs.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectMode}
              style={{
                ...styles.actionBtn(theme, isSelectMode),
                padding: isMobile ? '6px 10px' : '6px 12px',
              }}
            >
              {isSelectMode ? <X size={15} /> : <CheckSquare size={15} />}
              <span>{isSelectMode ? t.cancel || 'لغو' : t.select || 'انتخاب'}</span>
            </button>
          )}

          {songs.length > 0 && !(isMobile && isSelectMode) && (
            <div style={{ position: 'relative' }} ref={sortMenuRef}>
              <button
                type="button"
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                style={styles.actionBtn(theme, isSortMenuOpen)}
              >
                <ArrowUpDown size={15} /> {t.sortBy}
              </button>
              {isSortMenuOpen && (
                <div style={styles.dropdown(theme, '160px')}>
                  {['date', 'name', 'artist'].map((type) => {
                    const isActive = sortBy === type;
                    const itemKey = `sort-${type}`;
                    return (
                      <button
                        type="button"
                        key={type}
                        onClick={() => {
                          setSortBy(type as any);
                          setIsSortMenuOpen(false);
                        }}
                        style={menuItemStyle(theme, isActive, hoveredDropdownItem === itemKey)}
                        onMouseEnter={() => setHoveredDropdownItem(itemKey)}
                        onMouseLeave={() => setHoveredDropdownItem(null)}
                      >
                        {type === 'date'
                          ? t.sortDate
                          : type === 'name'
                          ? t.sortName
                          : t.sortArtist}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* لیست آهنگ‌ها */}
      {filteredAndSortedSongs.length === 0 ? (
        <div
          style={{
            padding: '50px 20px',
            textAlign: 'center',
            color: theme.colors.textSecondary,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            border: `1px dashed ${theme.colors.border}`,
            margin: '20px 0',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '500' }}>
            {emptyMessage || (songs.length === 0 ? t.noSongs : t.notFound)}
          </p>
        </div>
      ) : (
        <div
          style={{
            ...styles.listContainer,
            gap:
              theme.display?.listDensity === 'compact'
                ? '5px'
                : theme.display?.listDensity === 'spacious'
                ? '13px'
                : '8px',
          }}
        >
          {filteredAndSortedSongs.map((song) => {
            const isHovered = hoveredSongId === song.id;
            const isSelected = selectedSongs.includes(song.id);
            const isMenuHovered = hoveredMenuId === song.id;
            const isMenuOpen = activeMenuId === song.id;
            const isCurrentSong = currentSong?.id === song.id;
            const isTrackPlaying = isCurrentSong && isPlaying;

            return (
              <div
                key={song.id}
                onMouseEnter={() => setHoveredSongId(song.id)}
                onMouseLeave={() => {
                  setHoveredSongId(null);
                  setHoveredMenuId(null);
                }}
                onClick={(e) =>
                  isSelectMode
                    ? toggleSelect(e, song.id)
                    : onPlaySongFromList(
                        song,
                        filteredAndSortedSongs
                      )
                }
                style={styles.songRow(
                  theme,
                  isSelected,
                  isHovered,
                  isMenuOpen,
                  isCurrentSong,
                  glassCardCovers
                )}
              >
                {/* پس‌زمینه کاور شیشه‌ای روی کارت آهنگ بدون شکست افقی رندر */}
                {glassCardCovers && song.cover && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: theme.radius?.lg || '16px',
                      overflow: 'hidden',
                      contain: 'strict',
                      transform: 'translateZ(0)',
                      zIndex: 0,
                      pointerEvents: 'none',
                    }}
                  >
                    <img
                      src={song.cover}
                      alt=""
                      style={{
                        position: 'absolute',
                        inset: '-30px',
                        width: 'calc(100% + 60px)',
                        height: 'calc(100% + 60px)',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        filter: 'blur(26px) saturate(165%)',
                        opacity: theme.isDark ? 0.34 : 0.22,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor:
                          isSelected || isCurrentSong
                            ? withAlpha(
                                mixHex(
                                  theme.isDark ? theme.colors.surfaceSolid : mixHex('#ffffff', theme.colors.surfaceSolid, 0.72),
                                  theme.colors.primary,
                                  isSelected ? 0.2 : 0.14
                                ),
                                theme.isDark ? 0.44 : 0.56
                              )
                            : withAlpha(
                                theme.isDark ? theme.colors.surfaceSolid : mixHex('#ffffff', theme.colors.surfaceSolid, 0.72),
                                theme.isDark ? 0.36 : 0.46
                              ),
                      }}
                    />
                  </div>
                )}

                {isSelectMode && (
                  <div
                    onClick={(e) =>
                      toggleSelect(e, song.id)
                    }
                    style={{
                      ...styles.checkbox(
                        theme,
                        isSelected
                      ),
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {isSelected && (
                      <Check size={14} color={theme.colors.onPrimary || '#fff'} />
                    )}
                  </div>
                )}

                <div
                  style={{
                    position: 'relative',
                    width: '46px',
                    height: '46px',
                    minWidth: '46px',
                    minHeight: '46px',
                    aspectRatio: '1 / 1',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    zIndex: 1,
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.25)',
                  }}
                >
                  <CoverImage
                    src={song.cover}
                    alt=""
                    iconSize={20}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: '10px',
                    }}
                  />

                  {isCurrentSong && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        background: 'transparent',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          gap: '2.5px',
                          height: '15px',
                          filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.9))',
                        }}
                      >
                        <motion.span
                          animate={
                            isTrackPlaying
                              ? { scaleY: [0.25, 0.95, 0.35, 0.8, 0.25] }
                              : { scaleY: 0.3 }
                          }
                          transition={
                            isTrackPlaying
                              ? {
                                  duration: 0.75,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                }
                              : { duration: 0.25 }
                          }
                          style={{
                            width: '2.5px',
                            height: '15px',
                            backgroundColor: '#ffffff',
                            borderRadius: '1.5px',
                            transformOrigin: 'bottom',
                            display: 'block',
                          }}
                        />
                        <motion.span
                          animate={
                            isTrackPlaying
                              ? { scaleY: [0.6, 0.25, 1, 0.45, 0.9, 0.6] }
                              : { scaleY: 0.55 }
                          }
                          transition={
                            isTrackPlaying
                              ? {
                                  duration: 0.65,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                  delay: 0.1,
                                }
                              : { duration: 0.25 }
                          }
                          style={{
                            width: '2.5px',
                            height: '15px',
                            backgroundColor: '#ffffff',
                            borderRadius: '1.5px',
                            transformOrigin: 'bottom',
                            display: 'block',
                          }}
                        />
                        <motion.span
                          animate={
                            isTrackPlaying
                              ? { scaleY: [0.35, 0.85, 0.2, 0.95, 0.4, 0.35] }
                              : { scaleY: 0.35 }
                          }
                          transition={
                            isTrackPlaying
                              ? {
                                  duration: 0.8,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                  delay: 0.2,
                                }
                              : { duration: 0.25 }
                          }
                          style={{
                            width: '2.5px',
                            height: '15px',
                            backgroundColor: '#ffffff',
                            borderRadius: '1.5px',
                            transformOrigin: 'bottom',
                            display: 'block',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div
                  style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}
                >
                  <div
                    style={{
                      ...styles.songTitle(
                        theme,
                        isSelected
                      ),
                      color: isCurrentSong
                        ? theme.colors.primary
                        : isSelected
                        ? theme.colors.primary
                        : theme.colors.textPrimary,
                    }}
                  >
                    {song.name}
                  </div>
                  <div style={styles.songArtist(theme)}>
                    {song.artist}{' '}
                    {song.album
                      ? `• ${song.album}`
                      : ''}
                  </div>
                </div>

                <div style={{ ...styles.duration(theme), position: 'relative', zIndex: 1 }}>
                  {formatTime(song.duration || 0)}
                </div>

                {!isSelectMode && (
                  <div
                    ref={(el) => {
                      songMenuRefs.current[song.id] =
                        el;
                    }}
                    style={{
                      position: 'relative',
                      zIndex: isMenuOpen ? 999 : 1,
                    }}
                    onMouseEnter={() =>
                      setHoveredMenuId(song.id)
                    }
                    onMouseLeave={() =>
                      setHoveredMenuId(null)
                    }
                  >
                    <button
                      onClick={(e) =>
                        handleOpenMenu(e, song.id)
                      }
                      style={styles.moreBtn(
                        theme,
                        isMenuHovered
                      )}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* منوی سه‌نقطه آهنگ به صورت Portal برای جلوگیری از بریده شدن در لیست‌های کوتاه */}
      {activeMenuSong &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={activeSongDropdownRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...styles.songMenu(theme),
              ...menuPosition,
              direction: t.deleteSong === 'حذف آهنگ' ? 'rtl' : 'ltr',
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsSelectMode(true);
                setSelectedSongs((prev) =>
                  prev.includes(activeMenuSong.id) ? prev : [...prev, activeMenuSong.id]
                );
                setActiveMenuId(null);
              }}
              style={menuItemStyle(theme, false, hoveredDropdownItem === 'song-select')}
              onMouseEnter={() => setHoveredDropdownItem('song-select')}
              onMouseLeave={() => setHoveredDropdownItem(null)}
            >
              <CheckSquare size={16} />{' '}
              {t.select || 'انتخاب'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setInfoSong(activeMenuSong);
                setIsInfoModalOpen(true);
                setActiveMenuId(null);
              }}
              style={menuItemStyle(theme, false, hoveredDropdownItem === 'song-info')}
              onMouseEnter={() => setHoveredDropdownItem('song-info')}
              onMouseLeave={() => setHoveredDropdownItem(null)}
            >
              <Info size={16} />{' '}
              {t.songInfo || 'اطلاعات آهنگ'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenPlaylistModal(activeMenuSong.id);
              }}
              style={menuItemStyle(theme, false, hoveredDropdownItem === 'song-playlist')}
              onMouseEnter={() => setHoveredDropdownItem('song-playlist')}
              onMouseLeave={() => setHoveredDropdownItem(null)}
            >
              <FolderPlus size={16} />{' '}
              {t.addToPlaylist || 'Add to Playlist'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onPlayNext) {
                  onPlayNext(activeMenuSong);
                } else if (addToQueue) {
                  addToQueue(activeMenuSong);
                }
                setActiveMenuId(null);
              }}
              style={menuItemStyle(theme, false, hoveredDropdownItem === 'song-next')}
              onMouseEnter={() => setHoveredDropdownItem('song-next')}
              onMouseLeave={() => setHoveredDropdownItem(null)}
            >
              <SkipForward size={16} />{' '}
              {t.playNext || 'پخش بعدی'}
            </button>
            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(activeMenuSong.id);
                  setActiveMenuId(null);
                }}
                style={menuItemStyle(theme, false, hoveredDropdownItem === 'song-fav')}
                onMouseEnter={() => setHoveredDropdownItem('song-fav')}
                onMouseLeave={() => setHoveredDropdownItem(null)}
              >
                <Heart
                  size={16}
                  fill={activeMenuSong.isFavorite ? '#ff3b30' : 'none'}
                  color={
                    activeMenuSong.isFavorite
                      ? '#ff3b30'
                      : theme.colors.textPrimary
                  }
                />{' '}
                {activeMenuSong.isFavorite
                  ? t.removeFromFavorites || 'Remove from Favourites'
                  : t.addToFavorites || 'Add to Favourites'}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => handleDelete(e, activeMenuSong.id)}
              style={{
                ...menuItemStyle(theme, false, hoveredDropdownItem === 'song-delete', true),
                color: theme.colors.danger,
              }}
              onMouseEnter={() => setHoveredDropdownItem('song-delete')}
              onMouseLeave={() => setHoveredDropdownItem(null)}
            >
              <Trash2 size={16} />{' '}
              {deleteActionLabel || t.deleteSong}
            </button>
          </div>,
          document.body
        )}

      {/* مودال نمایش اطلاعات کامل آهنگ */}
      <SongInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        song={infoSong}
        onEdit={(songToEdit) => {
          setEditingSong(songToEdit);
          setIsEditModalOpen(true);
        }}
        theme={theme}
        t={t}
      />

      {/* مودال ویرایش */}
      <EditSongModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        song={editingSong}
        onSave={(updated) => onUpdateSong(updated)}
        theme={theme}
        t={t}
      />

      {/* مودال انتخاب پلی‌لیست */}
      {isPlaylistModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={closePlaylistModal}
            style={styles.modalOverlay}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              style={styles.modalBox(theme)}
            >
              <h3
                style={{
                  margin: '0 0 20px 0',
                  color: theme.colors.textPrimary,
                  textAlign: 'center',
                }}
              >
                {t.selectPlaylist || 'انتخاب پلی‌لیست'}
              </h3>
              <div style={styles.modalList}>
                {playlists.length === 0 ? (
                  <p
                    style={{
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {t.noPlaylists ||
                      'هیچ پلی‌لیستی وجود ندارد.'}
                  </p>
                ) : (
                  playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() =>
                        setTargetPlaylistId(pl.id)
                      }
                      style={{
                        ...styles.modalItem(theme),
                        borderColor:
                          targetPlaylistId === pl.id
                            ? theme.colors.primary
                            : theme.colors.border,
                        backgroundColor:
                          targetPlaylistId === pl.id
                            ? `${theme.colors.primary}20`
                            : theme.colors.surface,
                      }}
                    >
                      {pl.name}{' '}
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color:
                            theme.colors
                              .textSecondary,
                        }}
                      >
                        ({pl.songs.length}{' '}
                        {t.songs || 'آهنگ'})
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  marginTop: '20px',
                }}
              >
                <button
                  onClick={closePlaylistModal}
                  style={styles.modalBtn(theme, false)}
                >
                  {t.cancel || 'لغو'}
                </button>
                <button
                  onClick={handleConfirmAddToPlaylist}
                  disabled={!targetPlaylistId}
                  style={styles.modalBtn(
                    theme,
                    true,
                    !targetPlaylistId
                  )}
                >
                  {t.add || 'افزودن'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <IOSConfirmDialog
        isOpen={pendingDeleteIds !== null}
        title={deleteActionLabel || t.deleteSong || 'حذف آهنگ'}
        message={t.deleteConfirm}
        confirmLabel={deleteActionLabel || t.deleteSong || 'حذف'}
        cancelLabel={t.cancel || 'لغو'}
        destructive
        theme={theme}
        isRtl={t.cancel === 'لغو' || t.home === 'خانه'}
        onCancel={() => setPendingDeleteIds(null)}
        onConfirm={() => {
          const ids = pendingDeleteIds || [];
          setPendingDeleteIds(null);
          executeDeleteIds(ids);
        }}
      />
    </div>
  );
};

// ================= استایل‌های مجزا =================

/** استایل آیتم‌های منو */
const menuItemStyle = (
  theme: any,
  active: boolean = false,
  hovered: boolean = false,
  danger: boolean = false
) => ({
  width: '100%',
  padding: '9px 12px',
  borderRadius: '8px',
  textAlign: 'start' as const,
  border: 'none',
  outline: 'none',
  backgroundColor: active
    ? withAlpha(theme.colors.primary, 0.16)
    : hovered
    ? danger
      ? 'rgba(255, 69, 58, 0.15)'
      : theme.isDark
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(0, 0, 0, 0.07)'
    : 'transparent',
  color: active
    ? theme.colors.primary
    : theme.colors.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: '9px',
  fontSize: '0.8125rem',
  fontWeight: active ? 600 : 500,
  transition: 'background-color 0.12s ease',
  cursor: 'pointer',
});

/** مجموعه استایل‌های داخلی */
const styles = {
  container: {
    flex: 1,
    minHeight: '100%',
    boxSizing: 'border-box' as const,
    padding:
      'clamp(12px, 2vw, 24px) clamp(16px, 4vw, 40px) 130px',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'clamp(16px, 3vw, 24px)',
    minHeight: '34px',
    position: 'relative' as const,
    zIndex: 20,
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  actionBtn: (theme: any, active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: theme.radius.md,
    border: active
      ? 'none'
      : `1px solid ${theme.colors.border}`,
    backgroundColor: active
      ? theme.colors.primary
      : theme.colors.surface,
    color: active ? (theme.colors.onPrimary || '#fff') : theme.colors.textPrimary,
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.8125rem',
    height: '34px',
    whiteSpace: 'nowrap' as const,
    transition: 'background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease',
  }),
  dropdown: (
    theme: any,
    minWidth: string = '185px'
  ) => ({
    position: 'absolute' as const,
    top: 'calc(100% + 6px)',
    insetInlineEnd: 0,
    padding: '5px',
    backgroundColor: theme.colors.surfaceSolid || (theme.isDark ? '#18181c' : '#ffffff'),
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.42)',
    zIndex: 50,
    minWidth,
    overflow: 'hidden',
    isolation: 'isolate' as const,
    transform: 'translate3d(0, 0, 0)',
    backfaceVisibility: 'hidden' as const,
    contain: 'layout paint' as const,
  }),
  songRow: (
    theme: any,
    isSelected: boolean,
    isHovered: boolean,
    isMenuOpen: boolean,
    isCurrentSong?: boolean,
    glassCardCovers?: boolean,
  ) => {
    const surfaceBase = theme.isDark
      ? theme.colors.surfaceSolid
      : mixHex('#ffffff', theme.colors.surfaceSolid, 0.72);
    const activeAlpha = theme.isDark ? 0.76 : 0.86;
    const baseOpacity = Math.max(0.32, Math.min(0.92, theme.display?.glassOpacity ?? 0.65));

    return {
      display: 'flex',
      alignItems: 'center',
      direction: 'ltr' as const,
      textAlign: 'left' as const,
      gap:
        theme.display?.listDensity === 'compact'
          ? '10px'
          : theme.display?.listDensity === 'spacious'
          ? '16px'
          : '14px',
      padding:
        theme.display?.listDensity === 'compact'
          ? '5px 12px'
          : theme.display?.listDensity === 'spacious'
          ? '12px 16px'
          : '8px 14px',
      borderRadius: theme.radius?.lg || '16px',
      cursor: 'pointer',
      position: 'relative' as const,
      transition: 'background-color 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1)',
      backdropFilter: `blur(${theme.display?.glassBlur ?? 24}px) saturate(180%)`,
      WebkitBackdropFilter: `blur(${theme.display?.glassBlur ?? 24}px) saturate(180%)`,
      backgroundColor: isSelected
        ? withAlpha(mixHex(surfaceBase, theme.colors.primary, theme.isDark ? 0.24 : 0.18), activeAlpha)
        : isCurrentSong
        ? withAlpha(mixHex(surfaceBase, theme.colors.primary, theme.isDark ? 0.18 : 0.14), activeAlpha)
        : isHovered
        ? (theme.colors.surfaceHover || withAlpha(mixHex(surfaceBase, theme.colors.primary, 0.08), Math.min(0.94, baseOpacity + 0.16)))
        : glassCardCovers
        ? withAlpha(surfaceBase, theme.isDark ? Math.max(0.48, baseOpacity * 0.85) : Math.max(0.68, baseOpacity * 0.95))
        : theme.colors.surface,
      border: `1px solid ${
        isSelected || isCurrentSong
          ? theme.colors.primary
          : isHovered
          ? (theme.isDark ? 'rgba(255, 255, 255, 0.26)' : withAlpha(theme.colors.primary, 0.35))
          : theme.colors.border
      }`,
      boxShadow: isCurrentSong
        ? `0 6px 20px ${withAlpha(theme.colors.primary, 0.28)}, inset 0 1px 0 ${theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.75)'}`
        : isHovered
        ? (theme.isDark
            ? '0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.10)'
            : '0 6px 18px rgba(0, 0, 0, 0.09), inset 0 1px 0 rgba(255,255,255,0.8)')
        : (theme.isDark
            ? '0 2px 10px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
            : '0 2px 10px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255,255,255,0.65)'),
      zIndex: isMenuOpen ? 100 : 1,
    };
  },
  checkbox: (theme: any, isSelected: boolean) => ({
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    border: isSelected
      ? `2px solid ${theme.colors.primary}`
      : `2px solid ${theme.colors.textSecondary}`,
    backgroundColor: isSelected
      ? theme.colors.primary
      : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background-color 0.16s ease, border-color 0.16s ease',
    cursor: 'pointer',
  }),
  coverImage: {
    width: '46px',
    height: '46px',
    minWidth: '46px',
    minHeight: '46px',
    aspectRatio: '1 / 1',
    display: 'block',
    borderRadius: '10px',
    objectFit: 'cover' as const,
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.22)',
    filter: 'none',
  },
  playOverlay: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songTitle: (theme: any, isSelected: boolean) => ({
    fontWeight: '600',
    fontSize: 'clamp(0.8125rem, 1.4vw, 0.9375rem)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'left' as const,
    textShadow: theme.isDark ? '0 1px 4px rgba(0, 0, 0, 0.9)' : 'none',
    color: isSelected
      ? theme.colors.primary
      : theme.colors.textPrimary,
  }),
  songArtist: (theme: any) => ({
    fontSize: 'clamp(0.6875rem, 1.2vw, 0.8125rem)',
    color: theme.colors.textSecondary,
    marginTop: '2px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'left' as const,
    textShadow: theme.isDark ? '0 1px 3px rgba(0, 0, 0, 0.8)' : 'none',
  }),
  duration: (theme: any) => ({
    fontSize: '0.75rem',
    color: theme.colors.textSecondary,
    marginInlineEnd: '-2px',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: '1',
  }),
  moreBtn: (theme: any, isHovered: boolean) => ({
    background: isHovered
      ? (theme.isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0,0,0,0.06)')
      : 'none',
    border: isHovered
      ? `1px solid ${theme.colors.border}`
      : 'none',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.16s ease, border-color 0.16s ease',
  }),
  songMenu: (theme: any) => ({
    position: 'fixed' as const,
    padding: '5px',
    backgroundColor: theme.colors.surfaceSolid || (theme.isDark ? '#18181c' : '#ffffff'),
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.hard,
    zIndex: 99999,
    minWidth: '188px',
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100vh - 24px)',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    fontFamily: theme.fonts?.main,
    isolation: 'isolate' as const,
    transform: 'translate3d(0, 0, 0)',
    backfaceVisibility: 'hidden' as const,
    contain: 'layout paint' as const,
  }),
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999999,
    padding: 20,
    boxSizing: 'border-box' as const,
  },
  modalBox: (theme: any) => ({
    backgroundColor: withAlpha(theme.colors.surfaceSolid, 0.95),
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    padding: 24,
    borderRadius: theme.radius.xl || '22px',
    width: '100%',
    maxWidth: 400,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.15)',
  }),
  modalList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    maxHeight: '40vh',
    overflowY: 'auto' as const,
  },
  modalItem: (theme: any) => ({
    width: '100%',
    padding: '12px 16px',
    textAlign: 'start' as const,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    color: theme.colors.textPrimary,
    transition: 'all 0.2s',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  modalBtn: (
    theme: any,
    primary: boolean,
    disabled: boolean = false
  ) => ({
    flex: 1,
    padding: '10px',
    borderRadius: theme.radius.md,
    border: primary
      ? 'none'
      : `1px solid ${theme.colors.border}`,
    backgroundColor: primary
      ? disabled
        ? theme.colors.border
        : theme.colors.primary
      : 'transparent',
    color: primary
      ? disabled
        ? theme.colors.textSecondary
        : (theme.colors.onPrimary || '#fff')
      : theme.colors.textPrimary,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600,
  }),
};