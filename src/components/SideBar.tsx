import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Disc,
  Folder,
  Home,
  ListMusic,
  Menu,
  Mic,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from 'lucide-react';
import { SearchBar, type SearchNavigateTarget } from './SearchBar';
import { withAlpha } from '../utils/color';
import type { AppTab, Playlist, Song } from '../types';

interface SideBarProps {
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
  isDesktopViewport: boolean;
  sidebarWidth: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isDockedPlayer?: boolean;
  reduceMotion?: boolean;
  isRTL: boolean;
}

export const SideBar = ({
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
  isDesktopViewport,
  sidebarWidth,
  isCollapsed = false,
  onToggleCollapse,
  isDockedPlayer = false,
  reduceMotion = false,
  isRTL,
}: SideBarProps) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const menuItems = useMemo(
    () => [
      { id: 'home' as AppTab, label: t.home, icon: Home },
      { id: 'allSongs' as AppTab, label: t.allSongs, icon: Music },
      { id: 'playlists' as AppTab, label: t.playlists, icon: ListMusic },
      { id: 'artists' as AppTab, label: t.artists || 'خواننده‌ها', icon: Mic },
      { id: 'albums' as AppTab, label: t.albums || 'آلبوم‌ها', icon: Disc },
      { id: 'folders' as AppTab, label: t.folders || 'پوشه‌بندی', icon: Folder },
    ],
    [t.home, t.allSongs, t.playlists, t.artists, t.albums, t.folders]
  );

  const sidebarBg = withAlpha(
    theme.colors.surfaceSolid || theme.colors.background,
    theme.isDark ? 0.78 : 0.84
  );
  const hoverBg = withAlpha(theme.colors.primary, theme.isDark ? 0.16 : 0.1);

  const handleSelectTab = (tab: AppTab) => {
    setHoveredItemId(null);
    setCurrentTab(tab);
    setMobileDrawerOpen(false);
  };

  const renderSidebarBody = (inDrawer: boolean) => {
    const isCollapsedRail = !inDrawer && isCollapsed;
    const collapseLabel = t.collapseSidebar || (isRTL ? 'بستن سایدبار' : 'Collapse Sidebar');
    const expandLabel = t.expandSidebar || (isRTL ? 'باز کردن سایدبار' : 'Expand Sidebar');

    return (
      <aside
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: sidebarBg,
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderRight: `1px solid ${theme.colors.border}`,
          padding: inDrawer
            ? '16px 12px 20px'
            : isCollapsedRail
            ? isDockedPlayer
              ? '16px 10px 108px'
              : '16px 10px 120px'
            : isDockedPlayer
            ? '16px 12px 108px'
            : '16px 12px 120px',
          boxSizing: 'border-box',
          userSelect: 'none',
          transition: reduceMotion ? 'none' : 'padding 0.22s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: 0,
            flex: '1 1 auto',
          }}
        >
          {/* هدر سایدبار با عنوان وسط‌چین Prism Music و دکمه باز/بسته‌شدن */}
          {isCollapsedRail ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '34px',
              }}
            >
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label={expandLabel}
                  title={expandLabel}
                  onMouseEnter={() => setHoveredItemId('toggle-collapse')}
                  onMouseLeave={() =>
                    setHoveredItemId((prev) => (prev === 'toggle-collapse' ? null : prev))
                  }
                  style={{
                    width: '38px',
                    height: '34px',
                    borderRadius: theme.radius?.md || '10px',
                    border: 'none',
                    backgroundColor:
                      hoveredItemId === 'toggle-collapse' ? hoverBg : 'transparent',
                    color:
                      hoveredItemId === 'toggle-collapse'
                        ? theme.colors.textPrimary
                        : theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.16s ease, color 0.16s ease',
                  }}
                >
                  <PanelLeftOpen size={18} />
                </button>
              )}
            </div>
          ) : (
            <div
              dir="ltr"
              style={{
                display: 'grid',
                gridTemplateColumns: '26px minmax(0, 1fr) 26px',
                alignItems: 'center',
                gap: '2px',
                minHeight: '34px',
              }}
            >
              <span aria-hidden="true" />
              <h1
                style={{
                  fontSize: '1.125rem',
                  fontWeight: 800,
                  letterSpacing: '-0.35px',
                  color: theme.colors.textPrimary,
                  margin: 0,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Prism Music
              </h1>

              {inDrawer ? (
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label={t.close || 'Close'}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: theme.radius?.md || '10px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={17} />
                </button>
              ) : onToggleCollapse ? (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label={collapseLabel}
                  title={collapseLabel}
                  onMouseEnter={() => setHoveredItemId('toggle-collapse')}
                  onMouseLeave={() =>
                    setHoveredItemId((prev) => (prev === 'toggle-collapse' ? null : prev))
                  }
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: theme.radius?.md || '10px',
                    border: 'none',
                    backgroundColor:
                      hoveredItemId === 'toggle-collapse' ? hoverBg : 'transparent',
                    color:
                      hoveredItemId === 'toggle-collapse'
                        ? theme.colors.textPrimary
                        : theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.16s ease, color 0.16s ease',
                  }}
                >
                  <PanelLeftClose size={16} />
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          )}

          {/* جستجوی یکدست هماهنگ با نوار بالا و حالت جمع‌شده */}
          <SearchBar
            triggerVariant={isCollapsedRail ? 'sidebar-collapsed' : 'sidebar'}
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

          {/* لیست تب‌ها با ظاهر مینیمال و نشانگر کپسولی درخشان */}
          <nav
            aria-label="Primary Navigation"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              overflowY: 'auto',
              paddingTop: '2px',
            }}
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const isHovered = !isActive && hoveredItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  onMouseEnter={() => setHoveredItemId(item.id)}
                  onMouseLeave={() =>
                    setHoveredItemId((prev) => (prev === item.id ? null : prev))
                  }
                  aria-label={item.label}
                  title={isCollapsedRail ? item.label : undefined}
                  style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: isCollapsedRail ? '42px' : '38px',
                    paddingBlock: isCollapsedRail ? 0 : '7px',
                    paddingInlineStart: isCollapsedRail ? 0 : '14px',
                    paddingInlineEnd: isCollapsedRail ? 0 : '10px',
                    borderRadius: theme.radius?.md || '10px',
                    border: 'none',
                    backgroundColor: isHovered ? hoverBg : 'transparent',
                    color: isActive
                      ? theme.colors.primary
                      : isHovered
                      ? theme.colors.textPrimary
                      : theme.colors.textSecondary,
                    opacity: isActive ? 1 : isHovered ? 0.96 : theme.isDark ? 0.62 : 0.78,
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsedRail ? 'center' : 'flex-start',
                    gap: isCollapsedRail ? 0 : '10px',
                    cursor: 'pointer',
                    textAlign: 'start',
                    outline: 'none',
                    transition: 'opacity 0.22s ease, color 0.22s ease, background-color 0.16s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId={inDrawer ? 'activeMobileSidebarPill' : 'activeDesktopSidebarPill'}
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                      style={{
                        position: 'absolute',
                        insetInlineStart: '2px',
                        top: 'calc(50% - 10px)',
                        width: '3px',
                        height: '20px',
                        borderRadius: '3px',
                        backgroundColor: theme.colors.primary,
                        boxShadow: `0 2px 8px ${theme.colors.primary}77`,
                      }}
                    />
                  )}
                  <Icon
                    size={isCollapsedRail ? 19 : 17}
                    strokeWidth={isActive ? 2.4 : 2}
                    style={{ flexShrink: 0 }}
                  />
                  {!isCollapsedRail && (
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: '1.25',
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* دکمه تنظیمات در پایین سایدبار */}
        <div
          style={{
            paddingTop: '10px',
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          {(() => {
            const isSettingsActive = currentTab === 'settings';
            const isSettingsHovered = !isSettingsActive && hoveredItemId === 'settings';
            const settingsLabel = t.settings || 'تنظیمات';
            return (
              <button
                type="button"
                onClick={() => handleSelectTab('settings')}
                onMouseEnter={() => setHoveredItemId('settings')}
                onMouseLeave={() =>
                  setHoveredItemId((prev) => (prev === 'settings' ? null : prev))
                }
                aria-label={settingsLabel}
                title={isCollapsedRail ? settingsLabel : undefined}
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: isCollapsedRail ? '42px' : '38px',
                  paddingBlock: isCollapsedRail ? 0 : '7px',
                  paddingInlineStart: isCollapsedRail ? 0 : '14px',
                  paddingInlineEnd: isCollapsedRail ? 0 : '10px',
                  borderRadius: theme.radius?.md || '10px',
                  border: 'none',
                  backgroundColor: isSettingsHovered ? hoverBg : 'transparent',
                  color: isSettingsActive
                    ? theme.colors.primary
                    : isSettingsHovered
                    ? theme.colors.textPrimary
                    : theme.colors.textSecondary,
                  opacity: isSettingsActive
                    ? 1
                    : isSettingsHovered
                    ? 0.96
                    : theme.isDark
                    ? 0.62
                    : 0.78,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsedRail ? 'center' : 'flex-start',
                  gap: isCollapsedRail ? 0 : '10px',
                  cursor: 'pointer',
                  textAlign: 'start',
                  transition: 'opacity 0.22s ease, color 0.22s ease, background-color 0.16s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSettingsActive && (
                  <motion.div
                    layoutId={inDrawer ? 'activeMobileSidebarPill' : 'activeDesktopSidebarPill'}
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    style={{
                      position: 'absolute',
                      insetInlineStart: '2px',
                      top: 'calc(50% - 10px)',
                      width: '3px',
                      height: '20px',
                      borderRadius: '3px',
                      backgroundColor: theme.colors.primary,
                      boxShadow: `0 2px 8px ${theme.colors.primary}77`,
                    }}
                  />
                )}
                <Settings
                  size={isCollapsedRail ? 19 : 17}
                  strokeWidth={isSettingsActive ? 2.4 : 2}
                  style={{ flexShrink: 0 }}
                />
                {!isCollapsedRail && <span>{settingsLabel}</span>}
              </button>
            );
          })()}
        </div>
      </aside>
    );
  };

  // نمای دسکتاپ: سایدبار قابل باز و بسته شدن در سمت چپ صفحه
  if (isDesktopViewport) {
    return (
      <div
        style={{
          width: `${sidebarWidth}px`,
          flexShrink: 0,
          height: '100%',
          zIndex: 60,
          position: 'relative',
          overflow: 'hidden',
          transition: reduceMotion ? 'none' : 'width 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {renderSidebarBody(false)}
      </div>
    );
  }

  // نمای موبایل / پنجره باریک: هدر جمع‌وجور هماهنگ با نوار بالا + کشوی سمت چپ
  const activeMenuItem = menuItems.find((m) => m.id === currentTab);
  const currentTitle =
    currentTab === 'settings'
      ? t.settings || 'تنظیمات'
      : activeMenuItem?.label || 'Prism Music';

  return (
    <>
      <div
        dir="ltr"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px',
          backgroundColor: sidebarBg,
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderBottom: `1px solid ${theme.colors.border}`,
          zIndex: 55,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open Navigation Drawer"
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              borderRadius: theme.radius?.md || '10px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Menu size={21} />
          </button>

          <span
            style={{
              fontSize: '1.125rem',
              fontWeight: 800,
              letterSpacing: '-0.35px',
              color: theme.colors.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentTitle}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <SearchBar
            triggerVariant="icon"
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
            type="button"
            onClick={() => setCurrentTab('settings')}
            aria-label={t.settings || 'Settings'}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color:
                currentTab === 'settings' ? theme.colors.primary : theme.colors.textSecondary,
              borderRadius: theme.radius?.md || '10px',
            }}
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileDrawerOpen && (
          <div
            dir="ltr"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: theme.isDark ? 'rgba(0,0,0,0.62)' : 'rgba(15,23,42,0.36)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />
            <motion.div
              initial={reduceMotion ? false : { x: -280 }}
              animate={{ x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: -280 }}
              transition={{ type: 'spring', stiffness: 390, damping: 36 }}
              style={{
                position: 'relative',
                width: '264px',
                maxWidth: '82vw',
                height: '100%',
                zIndex: 1,
                boxShadow: '12px 0 36px rgba(0, 0, 0, 0.35)',
              }}
            >
              {renderSidebarBody(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
