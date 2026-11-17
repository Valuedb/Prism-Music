import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Clock,
  Play,
  Music,
  Mic,
  Disc,
  Folder,
  ListMusic,
  Trash2,
  ArrowUpRight,
  Check,
  CheckSquare,
  ListStart,
  ListPlus,
  FolderPlus,
  Plus,
} from 'lucide-react';
import type { Playlist, Song } from '../types';
import { STORAGE_KEYS } from '../storage/keys';
import { CoverImage } from './CoverImage';
import { getBidiTruncateStyle } from '../utils/bidi';
import { withAlpha } from '../utils/color';

export interface SearchNavigateTarget {
  tab: 'artists' | 'albums' | 'folders' | 'playlists';
  key: string;
}

interface SearchBarProps {
  onSearch?: (term: string) => void;
  placeholder?: string;
  theme: any;
  songs?: Song[];
  playlists?: Playlist[];
  customFolders?: string[];
  onPlaySong?: (song: Song, list: Song[]) => void;
  onPlayNext?: (songs: Song[]) => void;
  onAddToQueue?: (song: Song) => void;
  onAddSongsToPlaylist?: (playlistId: string, songs: Song[]) => void;
  onCreatePlaylist?: (name: string, songs: Song[]) => void;
  onNavigate?: (target: SearchNavigateTarget) => void;
  t?: any;
  triggerVariant?: 'icon' | 'sidebar' | 'sidebar-collapsed';
  triggerLabel?: string;
}

type SearchCategoryTab = 'all' | 'songs' | 'artists' | 'albums' | 'folders' | 'playlists';

const UNCATEGORIZED_FOLDER_ID = '__uncategorized__';

// نرمال‌سازی حروف فارسی و انگلیسی برای جستجوی هوشمند و بدون حساسیت به حروف عربی/فارسی
const normalize = (text?: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // حذف اعراب
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[آأإء]/g, 'ا')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // حذف نیم‌فاصله اضافی
    .trim();
};

const formatTime = (seconds?: number): string => {
  if (!seconds || isNaN(seconds)) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const SearchBar = ({
  onSearch,
  placeholder,
  theme,
  songs = [],
  playlists = [],
  customFolders = [],
  onPlaySong,
  onPlayNext,
  onAddToQueue,
  onAddSongsToPlaylist,
  onCreatePlaylist,
  onNavigate,
  t = {},
  triggerVariant = 'icon',
  triggerLabel,
}: SearchBarProps) => {
  const uiIsRTL = t?.direction === 'rtl' || t?.home === 'خانه';
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchCategoryTab>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [actionToast, setActionToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  // بارگذاری تاریخچه جستجوهای اخیر از localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.recentSearches || 'recentSearches');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(
            parsed.filter((item): item is string => typeof item === 'string').slice(0, 8)
          );
        }
      }
    } catch {
      // نادیده گرفتن خطای خواندن لوکال‌استوریج
    }
  }, []);

  // ذخیره تاریخچه جدید
  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(
          STORAGE_KEYS.recentSearches || 'recentSearches',
          JSON.stringify(updated)
        );
      } catch {
        // نادیده گرفتن خطا
      }
      return updated;
    });
  }, []);

  // حذف یک عبارت از تاریخچه
  const removeRecentSearch = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== term);
      try {
        localStorage.setItem(
          STORAGE_KEYS.recentSearches || 'recentSearches',
          JSON.stringify(updated)
        );
      } catch {
        // نادیده گرفتن خطا
      }
      return updated;
    });
  };

  // پاک کردن تمام تاریخچه
  const clearAllRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.recentSearches || 'recentSearches');
    } catch {
      // نادیده گرفتن خطا
    }
  };

  const showToastMessage = useCallback((msg: string) => {
    setActionToast(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setActionToast(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedSongIds([]);
    setShowPlaylistPicker(false);
    setNewPlaylistName('');
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    exitSelectMode();
    if (onSearch) {
      onSearch('');
    }
  }, [onSearch, exitSelectMode]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  // کلید میانبر Cmd/Ctrl + K و کلید / برای باز کردن سریع جستجو (سازگار با کیبورد فارسی/انگلیسی)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const otherDialogOpen = Boolean(
        document.querySelector('[role="dialog"]:not([data-search-modal="true"]), [data-modal-open="true"]:not([data-search-modal="true"])')
      );
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        if (otherDialogOpen && !isOpen) return;
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        handleClose();
      } else if (e.code === 'Slash' && !e.ctrlKey && !e.metaKey && !e.altKey && !isOpen) {
        if (otherDialogOpen) return;
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
        e.preventDefault();
        setIsOpen(true);
      }
    };
    const handleOpenSearchEvent = () => setIsOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('app:open-search', handleOpenSearchEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('app:open-search', handleOpenSearchEvent);
    };
  }, [isOpen, handleClose]);

  // فوکوس خودکار هنگام باز شدن مودال
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => {
        document.body.style.overflow = originalOverflow;
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  const handleSelectRecent = (term: string) => {
    setQuery(term);
    if (onSearch) {
      onSearch(term);
    }
    inputRef.current?.focus();
  };

  const singlesLabel = t.singlesAlbum || 'Singles';
  const uncategorizedLabel = t.uncategorizedFolder || 'بدون پوشه';
  const unknownArtistLabel = t.unknownArtist || 'Unknown';

  // فیلتر بلادرنگ هوشمند در تمام بخش‌های کتابخانه (آهنگ‌ها، آرتیست‌ها، آلبوم‌ها، فولدرها و پلی‌لیست‌ها)
  const {
    filteredSongs,
    filteredArtists,
    filteredAlbums,
    filteredFolders,
    filteredPlaylists,
  } = useMemo(() => {
    const norm = normalize(query);
    if (!norm) {
      return {
        filteredSongs: [],
        filteredArtists: [],
        filteredAlbums: [],
        filteredFolders: [],
        filteredPlaylists: [],
      };
    }

    // ۱. فیلتر آهنگ‌ها
    const matchedSongs = songs.filter(
      (s) =>
        normalize(s.name).includes(norm) ||
        normalize(s.artist).includes(norm) ||
        (s.album && normalize(s.album).includes(norm)) ||
        (s.folder && normalize(s.folder).includes(norm))
    );

    // ۲. فیلتر آرتیست‌ها
    const artistMap = new Map<
      string,
      { artist: string; songs: Song[]; albumsCount: number; cover: string }
    >();
    songs.forEach((s) => {
      const artistName = s.artist?.trim() || unknownArtistLabel;
      const existing = artistMap.get(artistName);
      if (existing) {
        existing.songs.push(s);
        if (!existing.cover && s.cover) existing.cover = s.cover;
      } else {
        artistMap.set(artistName, {
          artist: artistName,
          songs: [s],
          albumsCount: 0,
          cover: s.cover || '',
        });
      }
    });
    const matchedArtists = Array.from(artistMap.values())
      .filter((item) => normalize(item.artist).includes(norm))
      .map((item) => ({
        ...item,
        albumsCount: new Set(
          item.songs.map((s) => s.album?.trim()).filter((a): a is string => Boolean(a))
        ).size,
      }));

    // ۳. فیلتر آلبوم‌ها
    const albumMap = new Map<
      string,
      { key: string; album: string; artist: string; songs: Song[]; cover: string }
    >();
    songs.forEach((s) => {
      const albumName = s.album?.trim() || singlesLabel;
      const existing = albumMap.get(albumName);
      if (existing) {
        existing.songs.push(s);
        if (!existing.cover && s.cover) existing.cover = s.cover;
      } else {
        albumMap.set(albumName, {
          key: albumName,
          album: albumName,
          artist: s.artist?.trim() || unknownArtistLabel,
          songs: [s],
          cover: s.cover || '',
        });
      }
    });
    const matchedAlbums = Array.from(albumMap.values())
      .map((item) => {
        const uniqueArtists = Array.from(
          new Set(item.songs.map((s) => s.artist?.trim()).filter(Boolean))
        );
        const artistLabel =
          uniqueArtists.length === 0
            ? unknownArtistLabel
            : uniqueArtists.length === 1
            ? uniqueArtists[0]
            : `${uniqueArtists[0]} & ${uniqueArtists.length - 1}`;
        return { ...item, artist: artistLabel };
      })
      .filter(
        (item) =>
          (item.key !== singlesLabel || normalize(singlesLabel).includes(norm)) &&
          (normalize(item.album).includes(norm) || normalize(item.artist).includes(norm))
      );

    // ۴. فیلتر فولدربندی‌ها (فولدرهای ساخته‌شده + فولدرهای آهنگ‌ها)
    const folderMap = new Map<string, Song[]>();
    customFolders.forEach((folderName) => {
      const trimmed = folderName.trim();
      if (trimmed && !folderMap.has(trimmed)) {
        folderMap.set(trimmed, []);
      }
    });
    const uncategorizedSongs: Song[] = [];
    songs.forEach((s) => {
      const folderName = s.folder?.trim();
      if (folderName) {
        const list = folderMap.get(folderName);
        if (list) list.push(s);
        else folderMap.set(folderName, [s]);
      } else {
        uncategorizedSongs.push(s);
      }
    });

    const folderEntries: { id: string; name: string; isUncategorized: boolean; songs: Song[] }[] =
      Array.from(folderMap.entries()).map(([name, list]) => ({
        id: name,
        name,
        isUncategorized: false,
        songs: list,
      }));
    if (uncategorizedSongs.length > 0) {
      folderEntries.push({
        id: UNCATEGORIZED_FOLDER_ID,
        name: uncategorizedLabel,
        isUncategorized: true,
        songs: uncategorizedSongs,
      });
    }
    const matchedFolders = folderEntries.filter((f) => normalize(f.name).includes(norm));

    // ۵. فیلتر پلی‌لیست‌ها
    const matchedPlaylists = playlists.filter((p) => normalize(p.name).includes(norm));

    return {
      filteredSongs: matchedSongs,
      filteredArtists: matchedArtists,
      filteredAlbums: matchedAlbums,
      filteredFolders: matchedFolders,
      filteredPlaylists: matchedPlaylists,
    };
  }, [query, songs, playlists, customFolders, singlesLabel, uncategorizedLabel, unknownArtistLabel]);

  // اگر تب انتخاب‌شده فعلی دیگر نتیجه‌ای ندارد، به‌صورت خودکار روی «همه» بیفتد
  const effectiveTab: SearchCategoryTab = useMemo(() => {
    if (activeTab === 'songs' && filteredSongs.length === 0) return 'all';
    if (activeTab === 'artists' && filteredArtists.length === 0) return 'all';
    if (activeTab === 'albums' && filteredAlbums.length === 0) return 'all';
    if (activeTab === 'folders' && filteredFolders.length === 0) return 'all';
    if (activeTab === 'playlists' && filteredPlaylists.length === 0) return 'all';
    return activeTab;
  }, [
    activeTab,
    filteredSongs.length,
    filteredArtists.length,
    filteredAlbums.length,
    filteredFolders.length,
    filteredPlaylists.length,
  ]);

  // لیست آهنگ‌های قابل انتخاب در نمای فعلی (پیشنهادی‌ها یا نتایج جستجو)
  const displayedSongs = useMemo(() => {
    if (!query.trim()) return songs.slice(0, 6);
    if (effectiveTab === 'all') return filteredSongs.slice(0, 6);
    if (effectiveTab === 'songs') return filteredSongs.slice(0, 30);
    return [];
  }, [query, songs, effectiveTab, filteredSongs]);

  const songByIdMap = useMemo(() => {
    const map = new Map<string, Song>();
    songs.forEach((s) => map.set(s.id, s));
    return map;
  }, [songs]);

  const selectedSongsList = useMemo(
    () => selectedSongIds.map((id) => songByIdMap.get(id)).filter((s): s is Song => Boolean(s)),
    [selectedSongIds, songByIdMap]
  );

  // خروج خودکار از حالت انتخاب هنگام تغییر به تب غیرآهنگ
  useEffect(() => {
    if (query.trim() && effectiveTab !== 'all' && effectiveTab !== 'songs' && isSelectMode) {
      exitSelectMode();
    }
  }, [query, effectiveTab, isSelectMode, exitSelectMode]);

  const toggleSelectSong = useCallback((songId: string) => {
    setSelectedSongIds((prev) => {
      const exists = prev.includes(songId);
      const next = exists ? prev.filter((id) => id !== songId) : [...prev, songId];
      if (next.length === 0 && prev.length > 0) {
        setIsSelectMode(false);
        setShowPlaylistPicker(false);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAllDisplayed = useCallback(() => {
    const displayedIds = displayedSongs.map((s) => s.id);
    if (displayedIds.length === 0) return;
    const allSelected = displayedIds.every((id) => selectedSongIds.includes(id));
    if (allSelected) {
      const remaining = selectedSongIds.filter((id) => !displayedIds.includes(id));
      setSelectedSongIds(remaining);
      if (remaining.length === 0) {
        setIsSelectMode(false);
        setShowPlaylistPicker(false);
      }
    } else {
      setSelectedSongIds((prev) => Array.from(new Set([...prev, ...displayedIds])));
    }
  }, [displayedSongs, selectedSongIds]);

  const handleQuickPlayNext = useCallback(
    (e: React.MouseEvent, song: Song) => {
      e.stopPropagation();
      saveRecentSearch(query || song.name);
      onPlayNext?.([song]);
      showToastMessage(`${t.addedToPlayNext || 'به پخش بعدی اضافه شد'} · ${song.name}`);
    },
    [onPlayNext, query, saveRecentSearch, showToastMessage, t.addedToPlayNext]
  );

  const handleQuickAddToQueue = useCallback(
    (e: React.MouseEvent, song: Song) => {
      e.stopPropagation();
      saveRecentSearch(query || song.name);
      onAddToQueue?.(song);
      showToastMessage(`${t.addedToQueueMsg || 'به صف پخش اضافه شد'} · ${song.name}`);
    },
    [onAddToQueue, query, saveRecentSearch, showToastMessage, t.addedToQueueMsg]
  );

  const handleBulkPlay = useCallback(() => {
    if (selectedSongsList.length === 0) return;
    saveRecentSearch(query || selectedSongsList[0].name);
    onPlaySong?.(selectedSongsList[0], selectedSongsList);
    handleClose();
  }, [selectedSongsList, query, saveRecentSearch, onPlaySong, handleClose]);

  const handleBulkPlayNext = useCallback(() => {
    if (selectedSongsList.length === 0) return;
    saveRecentSearch(query || selectedSongsList[0].name);
    onPlayNext?.(selectedSongsList);
    showToastMessage(`${selectedSongsList.length} ${t.addedCountPlayNext || 'آهنگ به پخش بعدی اضافه شد'}`);
    exitSelectMode();
  }, [selectedSongsList, query, saveRecentSearch, onPlayNext, showToastMessage, t.addedCountPlayNext, exitSelectMode]);

  const handleBulkAddToQueue = useCallback(() => {
    if (selectedSongsList.length === 0) return;
    saveRecentSearch(query || selectedSongsList[0].name);
    selectedSongsList.forEach((s) => onAddToQueue?.(s));
    showToastMessage(`${selectedSongsList.length} · ${t.addedToQueueMsg || 'به صف پخش اضافه شد'}`);
    exitSelectMode();
  }, [selectedSongsList, query, saveRecentSearch, onAddToQueue, showToastMessage, t.addedToQueueMsg, exitSelectMode]);

  const handleConfirmPlaylistPick = useCallback(
    (playlistId: string, playlistNameLabel: string) => {
      if (selectedSongsList.length === 0) return;
      onAddSongsToPlaylist?.(playlistId, selectedSongsList);
      showToastMessage(`${t.addedToPlaylistMsg || 'به پلی‌لیست اضافه شد'} · ${playlistNameLabel}`);
      exitSelectMode();
    },
    [selectedSongsList, onAddSongsToPlaylist, showToastMessage, t.addedToPlaylistMsg, exitSelectMode]
  );

  const handleCreateAndAddPlaylist = useCallback(() => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed || selectedSongsList.length === 0) return;
    onCreatePlaylist?.(trimmed, selectedSongsList);
    showToastMessage(`${t.addedToPlaylistMsg || 'به پلی‌لیست اضافه شد'} · ${trimmed}`);
    exitSelectMode();
  }, [newPlaylistName, selectedSongsList, onCreatePlaylist, showToastMessage, t.addedToPlaylistMsg, exitSelectMode]);

  // پخش یک آهنگ از نتایج
  const handlePlaySongItem = (song: Song, list: Song[] = songs) => {
    if (isSelectMode) {
      toggleSelectSong(song.id);
      return;
    }
    saveRecentSearch(query || song.name);
    if (onPlaySong) {
      onPlaySong(song, list);
    }
    handleClose();
  };

  // پخش فوری تمام آهنگ‌های یک گروه (آرتیست، آلبوم، فولدر یا پلی‌لیست)
  const handlePlayGroup = (groupSongs: Song[], label: string) => {
    if (groupSongs.length === 0) return;
    saveRecentSearch(query || label);
    if (onPlaySong) {
      onPlaySong(groupSongs[0], groupSongs);
    }
    handleClose();
  };

  // ورود مستقیم به تب و آیتم انتخاب‌شده از نتایج جستجو
  const handleNavigateTarget = (
    target: SearchNavigateTarget,
    fallbackSongs: Song[],
    label: string
  ) => {
    saveRecentSearch(query || label);
    if (onNavigate) {
      onNavigate(target);
      handleClose();
      return;
    }
    if (fallbackSongs.length > 0 && onPlaySong) {
      onPlaySong(fallbackSongs[0], fallbackSongs);
    }
    handleClose();
  };

  const totalResultsCount =
    filteredSongs.length +
    filteredArtists.length +
    filteredAlbums.length +
    filteredFolders.length +
    filteredPlaylists.length;

  const canSelectInCurrentView = displayedSongs.length > 0;
  const allDisplayedSelected =
    displayedSongs.length > 0 && displayedSongs.every((s) => selectedSongIds.includes(s.id));

  const isDark = theme.isDark;
  const textColor = theme.colors.textPrimary;
  const textMuted = theme.colors.textSecondary;
  const primaryColor = theme.colors.primary;
  const onPrimaryColor = theme.colors.onPrimary || '#ffffff';
  const surfaceBg = withAlpha(
    theme.colors.surfaceSolid || theme.colors.background,
    isDark ? 0.90 : 0.93
  );
  const cardBorder = theme.colors.border;
  const hoverBg = withAlpha(primaryColor, isDark ? 0.14 : 0.09);

  const filterChips: { id: SearchCategoryTab; label: string; count: number }[] = [
    { id: 'all', label: t.all || 'همه', count: totalResultsCount },
    { id: 'songs', label: t.songsCategory || 'آهنگ‌ها', count: filteredSongs.length },
    {
      id: 'artists',
      label: t.artistsCategory || t.artists || 'خواننده‌ها',
      count: filteredArtists.length,
    },
    { id: 'albums', label: t.albumsCategory || t.albums || 'آلبوم‌ها', count: filteredAlbums.length },
    {
      id: 'folders',
      label: t.foldersCategory || t.folders || 'پوشه‌بندی',
      count: filteredFolders.length,
    },
    {
      id: 'playlists',
      label: t.playlistsCategory || t.playlists || 'پلی‌لیست‌ها',
      count: filteredPlaylists.length,
    },
  ];

  return (
    <>
      {triggerVariant === 'sidebar' ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.985 }}
          onClick={handleOpen}
          aria-label={t.search || 'Search'}
          title={`${t.search || 'Search'} (Ctrl+K)`}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px 11px',
            borderRadius: theme.radius?.md || '10px',
            border: '1px solid transparent',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 0, 0, 0.035)',
            color: textMuted,
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500,
            transition: 'background-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = hoverBg;
            e.currentTarget.style.color = textColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDark
              ? 'rgba(255, 255, 255, 0.045)'
              : 'rgba(0, 0, 0, 0.035)';
            e.currentTarget.style.color = textMuted;
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <Search size={16} style={{ flexShrink: 0 }} />
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {triggerLabel || (uiIsRTL ? 'جستجو...' : 'Search...')}
            </span>
          </span>
          <kbd
            style={{
              fontSize: '0.625rem',
              padding: '2px 5px',
              borderRadius: '5px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: textMuted,
              flexShrink: 0,
              fontFamily: 'inherit',
            }}
          >
            Ctrl+K
          </kbd>
        </motion.button>
      ) : triggerVariant === 'sidebar-collapsed' ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={handleOpen}
          aria-label={t.search || 'Search'}
          title={`${t.search || 'Search'} (Ctrl+K)`}
          style={{
            width: '100%',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            borderRadius: theme.radius?.md || '10px',
            border: '1px solid transparent',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 0, 0, 0.035)',
            color: textMuted,
            cursor: 'pointer',
            transition: 'background-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = hoverBg;
            e.currentTarget.style.color = textColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDark
              ? 'rgba(255, 255, 255, 0.045)'
              : 'rgba(0, 0, 0, 0.035)';
            e.currentTarget.style.color = textMuted;
          }}
        >
          <Search size={18} />
        </motion.button>
      ) : (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          onClick={handleOpen}
          aria-label={t.search || 'Search'}
          title={`${t.search || 'Search'} (Ctrl+K)`}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: textMuted,
            borderRadius: theme.radius?.md || '10px',
            transition: 'background-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = hoverBg;
            e.currentTarget.style.color = textColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = textMuted;
          }}
        >
          <Search size={22} />
        </motion.button>
      )}

      {/* مودال هوشمند جستجو با پورتال مستقیم به بدنه صفحه */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div
                dir={t?.direction || (t?.home === 'خانه' ? 'rtl' : 'ltr')}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 99999,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: 'min(76px, 10vh)',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  paddingBottom: '24px',
                  boxSizing: 'border-box',
                  fontFamily: theme?.fonts?.main || 'system-ui, -apple-system, sans-serif',
                }}
              >
                {/* لایه بلوری تاریک پس‌زمینه */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={handleClose}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.68)' : 'rgba(15, 23, 42, 0.42)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                />

                {/* پنجره اصلی جستجو */}
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  data-search-modal="true"
                  initial={{ opacity: 0, scale: 0.95, y: -16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -12 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '610px',
                    maxHeight: 'min(660px, 82vh)',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: surfaceBg,
                    backdropFilter: 'blur(36px) saturate(190%)',
                    WebkitBackdropFilter: 'blur(36px) saturate(190%)',
                    borderRadius: '24px',
                    border: `1px solid ${cardBorder}`,
                    boxShadow: isDark
                      ? `0 24px 60px rgba(0, 0, 0, 0.65), 0 0 32px ${theme.colors.glow || primaryColor}24, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
                      : '0 20px 50px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                    overflow: 'hidden',
                    zIndex: 1,
                  }}
                >
                  {/* هدر جستجو و اینپوت اصلی */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '14px 18px',
                      borderBottom: `1px solid ${cardBorder}`,
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: primaryColor,
                        flexShrink: 0,
                      }}
                    >
                      <Search size={22} />
                    </div>

                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      placeholder={
                        placeholder ||
                        t.searchHint ||
                        'جستجوی آهنگ، خواننده، آلبوم، پوشه یا پلی‌لیست...'
                      }
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '0.9375rem',
                        color: textColor,
                        fontWeight: '500',
                        fontFamily: 'inherit',
                        padding: '4px 8px',
                        direction: 'inherit',
                      }}
                    />

                    {/* دکمه پاک کردن متن جستجو */}
                    {query && (
                      <motion.button
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        onClick={() => handleQueryChange('')}
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: textColor,
                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        <X size={14} />
                      </motion.button>
                    )}

                    {/* دکمه فعال‌سازی حالت انتخاب در جستجو */}
                    {canSelectInCurrentView && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isSelectMode) {
                            exitSelectMode();
                          } else {
                            setIsSelectMode(true);
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: isSelectMode
                            ? primaryColor
                            : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.05)',
                          border: `1px solid ${isSelectMode ? primaryColor : cardBorder}`,
                          borderRadius: '10px',
                          padding: '6px 10px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: isSelectMode ? onPrimaryColor : textColor,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                        }}
                      >
                        <CheckSquare size={14} />
                        <span>{isSelectMode ? (t.cancel || 'لغو') : (t.select || 'انتخاب')}</span>
                      </button>
                    )}

                    {/* دکمه بستن سریع */}
                    <button
                      onClick={handleClose}
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        border: `1px solid ${cardBorder}`,
                        borderRadius: '10px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: textMuted,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = textColor;
                        e.currentTarget.style.backgroundColor = hoverBg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = textMuted;
                        e.currentTarget.style.backgroundColor = isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.05)';
                      }}
                    >
                      {t.close || 'بستن'}
                    </button>
                  </div>

                  {/* پیام بازخورد سریع برای پخش بعدی / افزودن به صف / پلی‌لیست */}
                  <AnimatePresence>
                    {actionToast && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.16 }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: withAlpha(primaryColor, isDark ? 0.2 : 0.12),
                          borderBottom: `1px solid ${withAlpha(primaryColor, 0.3)}`,
                          color: textColor,
                          fontSize: '0.7813rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexShrink: 0,
                        }}
                      >
                        <Check size={15} color={primaryColor} style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {actionToast}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* نوار ابزار انتخاب گروهی داخل مودال جستجو */}
                  <AnimatePresence>
                    {isSelectMode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        style={{
                          overflow: 'hidden',
                          borderBottom: `1px solid ${cardBorder}`,
                          backgroundColor: withAlpha(primaryColor, isDark ? 0.1 : 0.06),
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={handleToggleSelectAllDisplayed}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 10px',
                                borderRadius: '9px',
                                border: `1px solid ${cardBorder}`,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)',
                                color: textColor,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {allDisplayedSelected
                                ? t.deselectAll || 'لغو انتخاب همه'
                                : t.selectAll || 'انتخاب همه'}
                            </button>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: primaryColor,
                              }}
                            >
                              {selectedSongsList.length} {t.selected || 'انتخاب شده'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              disabled={selectedSongsList.length === 0}
                              onClick={handleBulkPlay}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 10px',
                                borderRadius: '9px',
                                border: 'none',
                                backgroundColor: primaryColor,
                                color: onPrimaryColor,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: selectedSongsList.length === 0 ? 'default' : 'pointer',
                                opacity: selectedSongsList.length === 0 ? 0.45 : 1,
                              }}
                            >
                              <Play size={13} fill={onPrimaryColor} />
                              <span>{t.play || 'پخش'}</span>
                            </button>

                            {onPlayNext && (
                              <button
                                type="button"
                                disabled={selectedSongsList.length === 0}
                                onClick={handleBulkPlayNext}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '6px 10px',
                                  borderRadius: '9px',
                                  border: `1px solid ${withAlpha(primaryColor, 0.35)}`,
                                  backgroundColor: withAlpha(primaryColor, isDark ? 0.18 : 0.12),
                                  color: textColor,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: selectedSongsList.length === 0 ? 'default' : 'pointer',
                                  opacity: selectedSongsList.length === 0 ? 0.45 : 1,
                                }}
                              >
                                <ListStart size={14} color={primaryColor} />
                                <span>{t.playNext || 'پخش بعدی'}</span>
                              </button>
                            )}

                            {onAddToQueue && (
                              <button
                                type="button"
                                disabled={selectedSongsList.length === 0}
                                onClick={handleBulkAddToQueue}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '6px 10px',
                                  borderRadius: '9px',
                                  border: `1px solid ${cardBorder}`,
                                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)',
                                  color: textColor,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: selectedSongsList.length === 0 ? 'default' : 'pointer',
                                  opacity: selectedSongsList.length === 0 ? 0.45 : 1,
                                }}
                              >
                                <ListPlus size={14} />
                                <span>{t.addToQueue || 'افزودن به صف'}</span>
                              </button>
                            )}

                            {(onAddSongsToPlaylist || onCreatePlaylist) && (
                              <button
                                type="button"
                                disabled={selectedSongsList.length === 0}
                                onClick={() => setShowPlaylistPicker((prev) => !prev)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '6px 10px',
                                  borderRadius: '9px',
                                  border: `1px solid ${cardBorder}`,
                                  backgroundColor: showPlaylistPicker
                                    ? withAlpha(primaryColor, 0.2)
                                    : isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : 'rgba(255,255,255,0.75)',
                                  color: textColor,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: selectedSongsList.length === 0 ? 'default' : 'pointer',
                                  opacity: selectedSongsList.length === 0 ? 0.45 : 1,
                                }}
                              >
                                <FolderPlus size={14} />
                                <span>{t.addToPlaylist || 'پلی‌لیست'}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {showPlaylistPicker && selectedSongsList.length > 0 && (
                          <div
                            style={{
                              padding: '10px 14px 12px',
                              borderTop: `1px solid ${cardBorder}`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.55)',
                            }}
                          >
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: textMuted }}>
                              {t.selectPlaylist || 'انتخاب پلی‌لیست'}
                            </div>
                            {playlists.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {playlists.map((pl) => (
                                  <button
                                    key={pl.id}
                                    type="button"
                                    onClick={() => handleConfirmPlaylistPick(pl.id, pl.name)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '5px 10px',
                                      borderRadius: '10px',
                                      border: `1px solid ${cardBorder}`,
                                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
                                      color: textColor,
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <ListMusic size={13} color={primaryColor} />
                                    <span>{pl.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {onCreatePlaylist && (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={newPlaylistName}
                                  onChange={(e) => setNewPlaylistName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreateAndAddPlaylist();
                                  }}
                                  placeholder={t.playlistName || 'اسم پلی‌لیست...'}
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    padding: '6px 10px',
                                    borderRadius: '9px',
                                    border: `1px solid ${cardBorder}`,
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#ffffff',
                                    color: textColor,
                                    fontSize: '0.75rem',
                                    outline: 'none',
                                  }}
                                />
                                <button
                                  type="button"
                                  disabled={!newPlaylistName.trim()}
                                  onClick={handleCreateAndAddPlaylist}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '6px 10px',
                                    borderRadius: '9px',
                                    border: 'none',
                                    backgroundColor: primaryColor,
                                    color: onPrimaryColor,
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: newPlaylistName.trim() ? 'pointer' : 'default',
                                    opacity: newPlaylistName.trim() ? 1 : 0.45,
                                  }}
                                >
                                  <Plus size={13} />
                                  <span>{t.create || 'ساخت'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* تب‌های فیلتر دسته‌بندی هوشمند هنگام تایپ عبارت */}
                  {query.trim().length > 0 && totalResultsCount > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        borderBottom: `1px solid ${cardBorder}`,
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        flexShrink: 0,
                      }}
                    >
                      {filterChips
                        .filter((chip) => chip.id === 'all' || chip.count > 0)
                        .map((chip) => {
                          const isSelected = effectiveTab === chip.id;
                          return (
                            <button
                              key={chip.id}
                              onClick={() => setActiveTab(chip.id)}
                              style={{
                                border: 'none',
                                borderRadius: '20px',
                                padding: '5px 12px',
                                fontSize: '0.75rem',
                                fontWeight: isSelected ? '700' : '500',
                                backgroundColor: isSelected
                                  ? primaryColor
                                  : isDark
                                  ? 'rgba(255, 255, 255, 0.07)'
                                  : 'rgba(0, 0, 0, 0.05)',
                                color: isSelected ? onPrimaryColor : textMuted,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {chip.label} ({chip.count})
                            </button>
                          );
                        })}
                    </div>
                  )}

                  {/* محتوای نتایج اسکرول‌شونده */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '12px 14px',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* بخش اول: در صورت خالی بودن اینپوت جستجو -> نمایش جستجوهای اخیر و پیشنهادی */}
                    {!query.trim() && (
                      <div>
                        {recentSearches.length > 0 ? (
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '10px',
                                padding: '0 6px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.8125rem',
                                  fontWeight: '600',
                                  color: textMuted,
                                }}
                              >
                                <Clock size={15} />
                                <span>{t.recentSearches || 'جستجوهای اخیر'}</span>
                              </div>

                              <button
                                onClick={clearAllRecent}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: textMuted,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = textColor)}
                                onMouseLeave={(e) => (e.currentTarget.style.color = textMuted)}
                              >
                                <Trash2 size={13} />
                                <span>{t.clearRecent || 'پاک کردن همه'}</span>
                              </button>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                marginBottom: '16px',
                              }}
                            >
                              {recentSearches.map((term) => (
                                <div
                                  key={term}
                                  onClick={() => handleSelectRecent(term)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    backgroundColor: isDark
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(0, 0, 0, 0.05)',
                                    border: `1px solid ${cardBorder}`,
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    color: textColor,
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = isDark
                                      ? 'rgba(255, 255, 255, 0.14)'
                                      : 'rgba(0, 0, 0, 0.09)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = isDark
                                      ? 'rgba(255, 255, 255, 0.08)'
                                      : 'rgba(0, 0, 0, 0.05)';
                                  }}
                                >
                                  <span>{term}</span>
                                  <span
                                    onClick={(e) => removeRecentSearch(e, term)}
                                    title={t.deleteSong || 'حذف'}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: textMuted,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <X size={13} />
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '28px 16px',
                              color: textMuted,
                              fontSize: '0.8125rem',
                            }}
                          >
                            <Clock size={28} style={{ opacity: 0.4, margin: '0 auto 8px auto' }} />
                            <div>
                              {t.searchHint ||
                                'نام آهنگ، خواننده، آلبوم، پوشه یا پلی‌لیست را تایپ کنید...'}
                            </div>
                          </div>
                        )}

                        {songs.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                color: textMuted,
                                marginBottom: '8px',
                                padding: '0 6px',
                              }}
                            >
                              {t.recommended || 'پیشنهادی‌ها'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {displayedSongs.map((s) => {
                                const isRowSelected = selectedSongIds.includes(s.id);
                                return (
                                  <div
                                    key={s.id}
                                    onClick={() => handlePlaySongItem(s)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px',
                                      padding: '8px 10px',
                                      borderRadius: '12px',
                                      cursor: 'pointer',
                                      border: isRowSelected
                                        ? `1px solid ${primaryColor}`
                                        : '1px solid transparent',
                                      backgroundColor: isRowSelected
                                        ? withAlpha(primaryColor, isDark ? 0.18 : 0.11)
                                        : 'transparent',
                                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isRowSelected) e.currentTarget.style.backgroundColor = hoverBg;
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isRowSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                    }}
                                  >
                                    {isSelectMode && (
                                      <div
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          borderRadius: '6px',
                                          border: isRowSelected
                                            ? `1.5px solid ${primaryColor}`
                                            : `1.5px solid ${textMuted}`,
                                          backgroundColor: isRowSelected ? primaryColor : 'transparent',
                                          color: onPrimaryColor,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          flexShrink: 0,
                                        }}
                                      >
                                        {isRowSelected && <Check size={13} strokeWidth={3} />}
                                      </div>
                                    )}
                                    <CoverImage
                                      src={s.cover}
                                      alt=""
                                      iconSize={16}
                                      style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '8px',
                                        objectFit: 'cover',
                                        flexShrink: 0,
                                      }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: '0.875rem',
                                          fontWeight: '600',
                                          color: textColor,
                                          ...getBidiTruncateStyle(s.name, uiIsRTL),
                                        }}
                                      >
                                        {s.name}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '0.75rem',
                                          color: textMuted,
                                          ...getBidiTruncateStyle(s.artist || '', uiIsRTL),
                                        }}
                                      >
                                        {s.artist}
                                      </div>
                                    </div>
                                    {!isSelectMode && (
                                      <div
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {onPlayNext && (
                                          <button
                                            type="button"
                                            onClick={(e) => handleQuickPlayNext(e, s)}
                                            title={t.playNext || 'پخش بعدی'}
                                            aria-label={t.playNext || 'Play Next'}
                                            style={{
                                              width: '28px',
                                              height: '28px',
                                              borderRadius: '8px',
                                              border: 'none',
                                              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                                              color: textColor,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            <ListStart size={14} color={primaryColor} />
                                          </button>
                                        )}
                                        {onAddToQueue && (
                                          <button
                                            type="button"
                                            onClick={(e) => handleQuickAddToQueue(e, s)}
                                            title={t.addToQueue || 'افزودن به صف'}
                                            aria-label={t.addToQueue || 'Add to Queue'}
                                            style={{
                                              width: '28px',
                                              height: '28px',
                                              borderRadius: '8px',
                                              border: 'none',
                                              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                                              color: textMuted,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            <ListPlus size={14} />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handlePlaySongItem(s)}
                                          title={t.playNow || 'پخش همین حالا'}
                                          aria-label={t.play || 'Play'}
                                          style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            color: primaryColor,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <Play size={15} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* بخش دوم: نمایش نتایج دسته‌بندی‌شده */}
                    {query.trim().length > 0 && (
                      <div>
                        {totalResultsCount === 0 ? (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '40px 16px',
                              color: textMuted,
                            }}
                          >
                            <Music size={36} style={{ opacity: 0.35, margin: '0 auto 12px auto' }} />
                            <div
                              style={{
                                fontSize: '0.9375rem',
                                fontWeight: '600',
                                color: textColor,
                                marginBottom: '6px',
                              }}
                            >
                              {t.noResults || 'هیچ نتیجه‌ای یافت نشد'}
                            </div>
                            <div style={{ fontSize: '0.8125rem' }}>
                              {(t.direction === 'ltr' || t.close === 'Close')
                                ? `No matches found for "${query}". Try a different keyword.`
                                : `نتیجه‌ای برای «${query}» پیدا نشد. عبارت دیگری را امتحان کنید.`}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* ۱. دسته‌بندی: آهنگ‌ها */}
                            {(effectiveTab === 'all' || effectiveTab === 'songs') &&
                              filteredSongs.length > 0 && (
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '0.8125rem',
                                      fontWeight: '700',
                                      color: textMuted,
                                      marginBottom: '8px',
                                      padding: '0 6px',
                                    }}
                                  >
                                    <Music size={15} color={primaryColor} />
                                    <span>{t.songsCategory || 'آهنگ‌ها'}</span>
                                    <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>
                                      ({filteredSongs.length})
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredSongs
                                      .slice(0, effectiveTab === 'songs' ? 30 : 6)
                                      .map((song) => {
                                        const isRowSelected = selectedSongIds.includes(song.id);
                                        return (
                                          <div
                                            key={song.id}
                                            onClick={() => handlePlaySongItem(song, filteredSongs)}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '10px',
                                              padding: '8px 10px',
                                              borderRadius: '14px',
                                              cursor: 'pointer',
                                              border: isRowSelected
                                                ? `1px solid ${primaryColor}`
                                                : '1px solid transparent',
                                              backgroundColor: isRowSelected
                                                ? withAlpha(primaryColor, isDark ? 0.18 : 0.11)
                                                : 'transparent',
                                              transition: 'background-color 0.15s ease, border-color 0.15s ease',
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!isRowSelected) e.currentTarget.style.backgroundColor = hoverBg;
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isRowSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
                                          >
                                            {isSelectMode && (
                                              <div
                                                style={{
                                                  width: '20px',
                                                  height: '20px',
                                                  borderRadius: '6px',
                                                  border: isRowSelected
                                                    ? `1.5px solid ${primaryColor}`
                                                    : `1.5px solid ${textMuted}`,
                                                  backgroundColor: isRowSelected ? primaryColor : 'transparent',
                                                  color: onPrimaryColor,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  flexShrink: 0,
                                                }}
                                              >
                                                {isRowSelected && <Check size={13} strokeWidth={3} />}
                                              </div>
                                            )}

                                            <CoverImage
                                              src={song.cover}
                                              alt=""
                                              iconSize={16}
                                              style={{
                                                width: '42px',
                                                height: '42px',
                                                borderRadius: '10px',
                                                objectFit: 'cover',
                                                border: `1px solid ${cardBorder}`,
                                                flexShrink: 0,
                                              }}
                                            />

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div
                                                style={{
                                                  fontSize: '0.875rem',
                                                  fontWeight: '600',
                                                  color: textColor,
                                                  ...getBidiTruncateStyle(song.name, uiIsRTL),
                                                }}
                                              >
                                                {song.name}
                                              </div>
                                              <div
                                                style={{
                                                  fontSize: '0.75rem',
                                                  color: textMuted,
                                                  marginTop: '2px',
                                                  ...getBidiTruncateStyle(
                                                    `${song.artist}${song.album ? ` • ${song.album}` : ''}`,
                                                    uiIsRTL
                                                  ),
                                                }}
                                              >
                                                {song.artist}
                                                {song.album ? ` • ${song.album}` : ''}
                                              </div>
                                            </div>

                                            {song.duration ? (
                                              <span
                                                style={{
                                                  fontSize: '0.75rem',
                                                  color: textMuted,
                                                  fontVariantNumeric: 'tabular-nums',
                                                  flexShrink: 0,
                                                }}
                                              >
                                                {formatTime(song.duration)}
                                              </span>
                                            ) : null}

                                            {!isSelectMode && (
                                              <div
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {onPlayNext && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleQuickPlayNext(e, song)}
                                                    title={t.playNext || 'پخش بعدی'}
                                                    aria-label={t.playNext || 'Play Next'}
                                                    style={{
                                                      width: '28px',
                                                      height: '28px',
                                                      borderRadius: '8px',
                                                      border: 'none',
                                                      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                                                      color: textColor,
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      cursor: 'pointer',
                                                    }}
                                                  >
                                                    <ListStart size={14} color={primaryColor} />
                                                  </button>
                                                )}
                                                {onAddToQueue && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => handleQuickAddToQueue(e, song)}
                                                    title={t.addToQueue || 'افزودن به صف'}
                                                    aria-label={t.addToQueue || 'Add to Queue'}
                                                    style={{
                                                      width: '28px',
                                                      height: '28px',
                                                      borderRadius: '8px',
                                                      border: 'none',
                                                      backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                                                      color: textMuted,
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      cursor: 'pointer',
                                                    }}
                                                  >
                                                    <ListPlus size={14} />
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => handlePlaySongItem(song, filteredSongs)}
                                                  title={t.playNow || 'پخش همین حالا'}
                                                  aria-label={t.play || 'Play'}
                                                  style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    backgroundColor: 'transparent',
                                                    color: primaryColor,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  <Play size={15} />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}

                            {/* ۲. دسته‌بندی: خواننده‌ها */}
                            {(effectiveTab === 'all' || effectiveTab === 'artists') &&
                              filteredArtists.length > 0 && (
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '0.8125rem',
                                      fontWeight: '700',
                                      color: textMuted,
                                      marginBottom: '8px',
                                      padding: '0 6px',
                                    }}
                                  >
                                    <Mic size={15} color={primaryColor} />
                                    <span>{t.artistsCategory || t.artists || 'خواننده‌ها'}</span>
                                    <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>
                                      ({filteredArtists.length})
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredArtists
                                      .slice(0, effectiveTab === 'artists' ? 20 : 4)
                                      .map((art) => (
                                        <div
                                          key={art.artist}
                                          onClick={() =>
                                            handleNavigateTarget(
                                              { tab: 'artists', key: art.artist },
                                              art.songs,
                                              art.artist
                                            )
                                          }
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '8px 10px',
                                            borderRadius: '14px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s ease',
                                          }}
                                          onMouseEnter={(e) =>
                                            (e.currentTarget.style.backgroundColor = hoverBg)
                                          }
                                          onMouseLeave={(e) =>
                                            (e.currentTarget.style.backgroundColor = 'transparent')
                                          }
                                        >
                                          <CoverImage
                                            src={art.cover}
                                            alt=""
                                            iconSize={16}
                                            style={{
                                              width: '42px',
                                              height: '42px',
                                              borderRadius: '50%',
                                              objectFit: 'cover',
                                              border: `1px solid ${cardBorder}`,
                                              flexShrink: 0,
                                            }}
                                          />
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                              style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                color: textColor,
                                                ...getBidiTruncateStyle(art.artist, uiIsRTL),
                                              }}
                                            >
                                              {art.artist}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: textMuted }}>
                                              {art.songs.length} {t.tracksCount || 'آهنگ'}
                                              {art.albumsCount > 0 &&
                                                ` · ${art.albumsCount} ${t.albumsCountLabel || 'آلبوم'}`}
                                            </div>
                                          </div>
                                          {art.songs.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayGroup(art.songs, art.artist);
                                              }}
                                              title={t.playAll || 'پخش همه'}
                                              style={{
                                                background: isDark
                                                  ? 'rgba(255,255,255,0.08)'
                                                  : 'rgba(0,0,0,0.06)',
                                                border: 'none',
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: primaryColor,
                                                flexShrink: 0,
                                              }}
                                            >
                                              <Play size={14} fill={primaryColor} />
                                            </button>
                                          )}
                                          <ArrowUpRight
                                            size={16}
                                            color={textMuted}
                                            style={{ opacity: 0.65, flexShrink: 0 }}
                                          />
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                            {/* ۳. دسته‌بندی: آلبوم‌ها */}
                            {(effectiveTab === 'all' || effectiveTab === 'albums') &&
                              filteredAlbums.length > 0 && (
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '0.8125rem',
                                      fontWeight: '700',
                                      color: textMuted,
                                      marginBottom: '8px',
                                      padding: '0 6px',
                                    }}
                                  >
                                    <Disc size={15} color={primaryColor} />
                                    <span>{t.albumsCategory || t.albums || 'آلبوم‌ها'}</span>
                                    <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>
                                      ({filteredAlbums.length})
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredAlbums
                                      .slice(0, effectiveTab === 'albums' ? 20 : 4)
                                      .map((alb) => (
                                        <div
                                          key={alb.key}
                                          onClick={() =>
                                            handleNavigateTarget(
                                              { tab: 'albums', key: alb.key },
                                              alb.songs,
                                              alb.album
                                            )
                                          }
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '8px 10px',
                                            borderRadius: '14px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s ease',
                                          }}
                                          onMouseEnter={(e) =>
                                            (e.currentTarget.style.backgroundColor = hoverBg)
                                          }
                                          onMouseLeave={(e) =>
                                            (e.currentTarget.style.backgroundColor = 'transparent')
                                          }
                                        >
                                          <CoverImage
                                            src={alb.cover}
                                            alt=""
                                            iconSize={16}
                                            style={{
                                              width: '42px',
                                              height: '42px',
                                              borderRadius: '8px',
                                              objectFit: 'cover',
                                              border: `1px solid ${cardBorder}`,
                                              flexShrink: 0,
                                            }}
                                          />
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                              style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                color: textColor,
                                                ...getBidiTruncateStyle(alb.album, uiIsRTL),
                                              }}
                                            >
                                              {alb.album}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: textMuted }}>
                                              {alb.artist} • {alb.songs.length}{' '}
                                              {t.tracksCount || 'آهنگ'}
                                            </div>
                                          </div>
                                          {alb.songs.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayGroup(alb.songs, alb.album);
                                              }}
                                              title={t.playAll || 'پخش همه'}
                                              style={{
                                                background: isDark
                                                  ? 'rgba(255,255,255,0.08)'
                                                  : 'rgba(0,0,0,0.06)',
                                                border: 'none',
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: primaryColor,
                                                flexShrink: 0,
                                              }}
                                            >
                                              <Play size={14} fill={primaryColor} />
                                            </button>
                                          )}
                                          <ArrowUpRight
                                            size={16}
                                            color={textMuted}
                                            style={{ opacity: 0.65, flexShrink: 0 }}
                                          />
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                            {/* ۴. دسته‌بندی: فولدربندی‌ها */}
                            {(effectiveTab === 'all' || effectiveTab === 'folders') &&
                              filteredFolders.length > 0 && (
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '0.8125rem',
                                      fontWeight: '700',
                                      color: textMuted,
                                      marginBottom: '8px',
                                      padding: '0 6px',
                                    }}
                                  >
                                    <Folder size={15} color={primaryColor} />
                                    <span>{t.foldersCategory || t.folders || 'پوشه‌بندی'}</span>
                                    <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>
                                      ({filteredFolders.length})
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredFolders
                                      .slice(0, effectiveTab === 'folders' ? 20 : 4)
                                      .map((folder) => (
                                        <div
                                          key={folder.id}
                                          onClick={() =>
                                            handleNavigateTarget(
                                              { tab: 'folders', key: folder.id },
                                              folder.songs,
                                              folder.name
                                            )
                                          }
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '8px 10px',
                                            borderRadius: '14px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s ease',
                                          }}
                                          onMouseEnter={(e) =>
                                            (e.currentTarget.style.backgroundColor = hoverBg)
                                          }
                                          onMouseLeave={(e) =>
                                            (e.currentTarget.style.backgroundColor = 'transparent')
                                          }
                                        >
                                          <div
                                            style={{
                                              width: '42px',
                                              height: '42px',
                                              borderRadius: '10px',
                                              backgroundColor: `${primaryColor}1F`,
                                              border: `1px solid ${cardBorder}`,
                                              color: primaryColor,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0,
                                            }}
                                          >
                                            <Folder size={18} />
                                          </div>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                              style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                color: textColor,
                                                ...getBidiTruncateStyle(folder.name, uiIsRTL),
                                              }}
                                            >
                                              {folder.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: textMuted }}>
                                              {folder.songs.length} {t.tracksCount || 'آهنگ'}
                                            </div>
                                          </div>
                                          {folder.songs.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayGroup(folder.songs, folder.name);
                                              }}
                                              title={t.playAll || 'پخش همه'}
                                              style={{
                                                background: isDark
                                                  ? 'rgba(255,255,255,0.08)'
                                                  : 'rgba(0,0,0,0.06)',
                                                border: 'none',
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: primaryColor,
                                                flexShrink: 0,
                                              }}
                                            >
                                              <Play size={14} fill={primaryColor} />
                                            </button>
                                          )}
                                          <ArrowUpRight
                                            size={16}
                                            color={textMuted}
                                            style={{ opacity: 0.65, flexShrink: 0 }}
                                          />
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                            {/* ۵. دسته‌بندی: پلی‌لیست‌ها */}
                            {(effectiveTab === 'all' || effectiveTab === 'playlists') &&
                              filteredPlaylists.length > 0 && (
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '0.8125rem',
                                      fontWeight: '700',
                                      color: textMuted,
                                      marginBottom: '8px',
                                      padding: '0 6px',
                                    }}
                                  >
                                    <ListMusic size={15} color={primaryColor} />
                                    <span>
                                      {t.playlistsCategory || t.playlists || 'پلی‌لیست‌ها'}
                                    </span>
                                    <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>
                                      ({filteredPlaylists.length})
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredPlaylists
                                      .slice(0, effectiveTab === 'playlists' ? 20 : 4)
                                      .map((pl) => (
                                        <div
                                          key={pl.id}
                                          onClick={() =>
                                            handleNavigateTarget(
                                              { tab: 'playlists', key: pl.id },
                                              pl.songs,
                                              pl.name
                                            )
                                          }
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '8px 10px',
                                            borderRadius: '14px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s ease',
                                          }}
                                          onMouseEnter={(e) =>
                                            (e.currentTarget.style.backgroundColor = hoverBg)
                                          }
                                          onMouseLeave={(e) =>
                                            (e.currentTarget.style.backgroundColor = 'transparent')
                                          }
                                        >
                                          <CoverImage
                                            src={pl.songs[0]?.cover}
                                            alt=""
                                            iconSize={16}
                                            style={{
                                              width: '42px',
                                              height: '42px',
                                              borderRadius: '10px',
                                              objectFit: 'cover',
                                              border: `1px solid ${cardBorder}`,
                                              flexShrink: 0,
                                            }}
                                          />
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                              style={{
                                                fontSize: '0.875rem',
                                                fontWeight: '600',
                                                color: textColor,
                                                ...getBidiTruncateStyle(pl.name, uiIsRTL),
                                              }}
                                            >
                                              {pl.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: textMuted }}>
                                              {pl.songs.length} {t.tracksCount || 'آهنگ'}
                                            </div>
                                          </div>
                                          {pl.songs.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayGroup(pl.songs, pl.name);
                                              }}
                                              title={t.playAll || 'پخش همه'}
                                              style={{
                                                background: isDark
                                                  ? 'rgba(255,255,255,0.08)'
                                                  : 'rgba(0,0,0,0.06)',
                                                border: 'none',
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: primaryColor,
                                                flexShrink: 0,
                                              }}
                                            >
                                              <Play size={14} fill={primaryColor} />
                                            </button>
                                          )}
                                          <ArrowUpRight
                                            size={16}
                                            color={textMuted}
                                            style={{ opacity: 0.65, flexShrink: 0 }}
                                          />
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* فوتر باریک با کلیدهای راهنما */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 18px',
                      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.03)',
                      borderTop: `1px solid ${cardBorder}`,
                      fontSize: '0.6875rem',
                      color: textMuted,
                    }}
                  >
                    <span>{t.smartSearchFooter || 'جستجوی هوشمند در تمام کتابخانه'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <kbd
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.07)',
                          fontSize: '0.625rem',
                        }}
                      >
                        Esc
                      </kbd>{' '}
                      {t.toClose || 'برای خروج'}
                    </span>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};