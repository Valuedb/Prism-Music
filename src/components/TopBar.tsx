import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { SearchBar, type SearchNavigateTarget } from './SearchBar';
import { withAlpha } from '../utils/color';

import type { AppTab, Playlist, Song } from '../types';

interface TopBarProps {
  currentTab: string;
  setCurrentTab: (tab: AppTab) => void;
  t: any;
  onSearch?: (term: string) => void;
  theme: any;
  songs?: Song[];
  playlists?: Playlist[];
  customFolders?: string[];
  onPlaySong?: (song: Song, list: Song[]) => void;
  onPlayNext?: (songs: Song[]) => void;
  onAddToQueue?: (song: Song) => void;
  onAddSongsToPlaylist?: (playlistId: string, songs: Song[]) => void;
  onCreatePlaylist?: (name: string, songs: Song[]) => void;
  onSearchNavigate?: (target: SearchNavigateTarget) => void;
}

export const TopBar = ({
  currentTab,
  setCurrentTab,
  t,
  onSearch,
  theme,
  songs,
  playlists,
  customFolders,
  onPlaySong,
  onPlayNext,
  onAddToQueue,
  onAddSongsToPlaylist,
  onCreatePlaylist,
  onSearchNavigate,
}: TopBarProps) => {
  const menuItems = useMemo(
    () => [
      { id: 'home', label: t.home },
      { id: 'allSongs', label: t.allSongs },
      { id: 'playlists', label: t.playlists },
      { id: 'artists', label: t.artists || 'خواننده‌ها' },
      { id: 'albums', label: t.albums || 'آلبوم‌ها' },
      { id: 'folders', label: t.folders || 'پوشه‌بندی' },
    ],
    [t.home, t.allSongs, t.playlists, t.artists, t.albums, t.folders]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [trackX, setTrackX] = useState(0);

  // محاسبه قطعی موقعیت ترک بر اساس آفست نسبی درونی تا وسط انیمیشن فنری دوباره تریگر نشود و روی پیکسل صحیح بنشیند
  const centerActiveTab = useCallback(() => {
    const activeIndex = menuItems.findIndex((item) => item.id === currentTab);
    if (activeIndex === -1) return;
    const activeEl = tabRefs.current[activeIndex];
    const track = trackRef.current;
    if (!activeEl || !track) return;

    const trackRect = track.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    if (trackRect.width <= 0 || activeRect.width <= 0) return;

    const offsetInsideTrack = activeRect.left - trackRect.left;
    const activeCenterInsideTrack = offsetInsideTrack + activeRect.width / 2;
    const nextX = Math.round(trackRect.width / 2 - activeCenterInsideTrack);

    setTrackX((prev) => (prev === nextX ? prev : nextX));
  }, [currentTab, menuItems]);

  useLayoutEffect(() => {
    centerActiveTab();
  }, [centerActiveTab]);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        centerActiveTab();
      });
      if (container) observer.observe(container);
      if (track) observer.observe(track);
    }

    const onResize = () => centerActiveTab();
    window.addEventListener('resize', onResize);

    let cancelled = false;
    document.fonts?.ready?.then(() => {
      if (!cancelled) centerActiveTab();
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [centerActiveTab]);

  const hoverBg = withAlpha(theme.colors.primary, theme.isDark ? 0.16 : 0.1);
  const topBarBg = withAlpha(
    theme.colors.surfaceSolid || theme.colors.background,
    theme.isDark ? 0.78 : 0.84
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        paddingTop: '10px',
        paddingBottom: '6px',
        backgroundColor: topBarBg,
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderBottom: `1px solid ${theme.colors.border}`,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* هدر بالایی با عنوان Prism Music و دکمه‌های جستجو و تنظیمات */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          marginBottom: '2px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            fontSize: '1.375rem',
            fontWeight: '800',
            letterSpacing: '-0.4px',
            color: theme.colors.textPrimary,
            margin: 0,
          }}
        >
          Prism Music
        </h1>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SearchBar
            onSearch={onSearch}
            placeholder={t.search}
            theme={theme}
            songs={songs}
            playlists={playlists}
            customFolders={customFolders}
            onPlaySong={onPlaySong}
            onPlayNext={onPlayNext}
            onAddToQueue={onAddToQueue}
            onAddSongsToPlaylist={onAddSongsToPlaylist}
            onCreatePlaylist={onCreatePlaylist}
            onNavigate={onSearchNavigate}
            t={t}
          />
          <button
            onClick={() => setCurrentTab('settings')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: currentTab === 'settings' ? theme.colors.primary : theme.colors.textSecondary,
              borderRadius: theme.radius?.md || '10px',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
            title={t.settings}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = hoverBg;
              e.currentTarget.style.color = theme.colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = currentTab === 'settings' ? theme.colors.primary : theme.colors.textSecondary;
            }}
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* کاروسل تب‌های سنترشده */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxSizing: 'border-box',
          minHeight: '46px',
        }}
      >
        <motion.div
          ref={trackRef}
          initial={false}
          animate={{ x: trackX }}
          transition={{
            type: 'spring',
            stiffness: 420,
            damping: 38,
            mass: 0.75,
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'clamp(10px, 1.6vw, 18px)',
            position: 'relative',
            whiteSpace: 'nowrap',
          }}
        >
          {menuItems.map((item, index) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                onClick={() => setCurrentTab(item.id as AppTab)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  height: '44px',
                  padding: '4px 10px 4px 10px',
                  fontSize: isActive
                    ? 'clamp(1.0625rem, 1.75vw, 1.1875rem)'
                    : 'clamp(0.8438rem, 1.3vw, 0.9375rem)',
                  fontWeight: isActive ? 800 : 600,
                  letterSpacing: isActive ? '-0.015em' : '0em',
                  color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  outline: 'none',
                  userSelect: 'none',
                  opacity: isActive ? 1 : theme.isDark ? 0.62 : 0.78,
                  zIndex: isActive ? 2 : 1,
                  transition: 'opacity 0.2s ease, color 0.2s ease',
                  WebkitFontSmoothing: 'antialiased',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: '28px',
                    lineHeight: '1.2',
                  }}
                >
                  {item.label}
                </span>

                {/* نشانگر ظریف کپسولی متحرک زیر تب فعال */}
                <div
                  style={{
                    height: '4px',
                    marginTop: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCenteredTabPill"
                      style={{
                        width: '24px',
                        height: '3px',
                        borderRadius: '3px',
                        backgroundColor: theme.colors.primary,
                        boxShadow: `0 2px 8px ${theme.colors.primary}77`,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 460,
                        damping: 36,
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
};