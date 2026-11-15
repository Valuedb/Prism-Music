import React, { useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Disc3,
  Eye,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Sliders,
  Smartphone,
  Sparkles,
  Sun,
  Type,
  Upload,
} from 'lucide-react';
import type {
  ArtworkStyle,
  CornerStyle,
  DisplaySettings as DisplaySettingsType,
  FontChoice,
  HomeLayoutStyle,
  ListDensity,
  PlayerBarStyle,
  VisualizerStyle,
} from '../types';
import { DEFAULT_DISPLAY_SETTINGS, type PaletteType, type ThemeMode } from '../theme';
import {
  IOSGroupedSection,
  IOSRow,
  IOSSegmentedControl,
  IOSSlider,
  IOSSquircleIcon,
  IOSSwitch,
} from '../components/IOSSettingsPrimitives';

interface DisplaySettingsProps {
  displaySettings: DisplaySettingsType;
  setDisplaySettings: React.Dispatch<React.SetStateAction<DisplaySettingsType>>;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colorPalette: PaletteType;
  setColorPalette: (palette: PaletteType) => void;
  customBackground?: string | null;
  setCustomBackground?: (bg: string | null) => void;
  customBgBlur?: number;
  setCustomBgBlur?: (blur: number) => void;
  customBgDim?: number;
  setCustomBgDim?: (dim: number) => void;
  glassCardCovers?: boolean;
  setGlassCardCovers?: (enabled: boolean) => void;
  onBack: () => void;
  theme: any;
  t: any;
  language: string;
}

const PALETTES: { id: PaletteType; labelFa: string; labelEn: string; color: string; secondaryColor: string }[] = [
  { id: 'classic-blue', labelFa: 'آبی کلاسیک', labelEn: 'Classic Blue', color: '#0066FF', secondaryColor: '#38BDF8' },
  { id: 'classic-red', labelFa: 'قرمز کلاسیک', labelEn: 'Classic Red', color: '#DC2626', secondaryColor: '#EF4444' },
  { id: 'nordic', labelFa: 'نوردیک استیل', labelEn: 'Nordic Steel', color: '#46616E', secondaryColor: '#C5BAC4' },
  { id: 'glacier', labelFa: 'اقیانوس و قطب', labelEn: 'Glacier', color: '#1E5B7A', secondaryColor: '#8FBCD4' },
  { id: 'amethyst', labelFa: 'آمیتیست بنفش', labelEn: 'Amethyst', color: '#8B7CC7', secondaryColor: '#5A3B8C' },
  { id: 'sapphire', labelFa: 'یاقوت کبود', labelEn: 'Sapphire', color: '#3B82F6', secondaryColor: '#1C2541' },
  { id: 'amber', labelFa: 'قهوه و موکا', labelEn: 'Amber Mocha', color: '#C6601F', secondaryColor: '#A88462' },
  { id: 'sunset', labelFa: 'غروب نارنجی', labelEn: 'Sunset', color: '#FF7A00', secondaryColor: '#FFA94D' },
  { id: 'emerald', labelFa: 'زمرد و بیشه', labelEn: 'Emerald', color: '#48BB78', secondaryColor: '#163832' },
  { id: 'teal', labelFa: 'تالاب دریایی', labelEn: 'Teal', color: '#14B8A6', secondaryColor: '#7FB3B8' },
  { id: 'synthwave', labelFa: 'نئون سایبر', labelEn: 'Synthwave', color: '#FF6B6B', secondaryColor: '#D6598F' },
  { id: 'mauve', labelFa: 'مخملی بنفش', labelEn: 'Mauve', color: '#D946EF', secondaryColor: '#DFB6B2' },
  { id: 'mint', labelFa: 'فیروزه و نعنا', labelEn: 'Mint', color: '#2DD4BF', secondaryColor: '#99F6E4' },
];

const makeMeshWallpaper = (c1: string, c2: string, c3: string, c4: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <radialGradient id="g1" cx="20%" cy="20%" r="65%"><stop offset="0%" stop-color="${c2}" stop-opacity="0.9"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/></radialGradient>
      <radialGradient id="g2" cx="85%" cy="30%" r="65%"><stop offset="0%" stop-color="${c3}" stop-opacity="0.85"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/></radialGradient>
      <radialGradient id="g3" cx="50%" cy="90%" r="70%"><stop offset="0%" stop-color="${c4}" stop-opacity="0.85"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="800" height="600" fill="${c1}"/>
    <rect width="800" height="600" fill="url(#g1)"/>
    <rect width="800" height="600" fill="url(#g2)"/>
    <rect width="800" height="600" fill="url(#g3)"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/** والپیپرهای آفلاین و بومی سبک Apple Mesh */
const WALLPAPER_PRESETS = [
  { id: 'midnight', labelFa: 'شفق نیلی', labelEn: 'Midnight Indigo', url: makeMeshWallpaper('#090D1F', '#1D4ED8', '#7C3AED', '#0EA5E9') },
  { id: 'aurora', labelFa: 'شفق قطبی', labelEn: 'Aurora Borealis', url: makeMeshWallpaper('#061A1E', '#10B981', '#06B6D4', '#3B82F6') },
  { id: 'velvet', labelFa: 'مخمل غروب', labelEn: 'Velvet Dusk', url: makeMeshWallpaper('#1A0918', '#EC4899', '#8B5CF6', '#F97316') },
  { id: 'obsidian', labelFa: 'ابسیدین دودی', labelEn: 'Obsidian Silk', url: makeMeshWallpaper('#0B0B10', '#334155', '#64748B', '#1E293B') },
  { id: 'sunrise', labelFa: 'سپیده روشن', labelEn: 'Soft Sunrise', url: makeMeshWallpaper('#F5EFE6', '#FBBF24', '#FB7185', '#38BDF8') },
  { id: 'glacier-light', labelFa: 'نسیم قطبی', labelEn: 'Glacier Mist', url: makeMeshWallpaper('#ECF5FF', '#60A5FA', '#A78BFA', '#34D399') },
];

export const DisplaySettings: React.FC<DisplaySettingsProps> = ({
  displaySettings,
  setDisplaySettings,
  themeMode,
  setThemeMode,
  colorPalette,
  setColorPalette,
  customBackground,
  setCustomBackground,
  customBgBlur = 10,
  setCustomBgBlur,
  customBgDim = 45,
  setCustomBgDim,
  glassCardCovers = true,
  setGlassCardCovers,
  onBack,
  theme,
  t,
  language,
}) => {
  const isRTL = language === 'fa';
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const updateDisplay = <K extends keyof DisplaySettingsType>(
    key: K,
    value: DisplaySettingsType[K]
  ) => {
    setDisplaySettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetAllDisplay = () => {
    setDisplaySettings({ ...DEFAULT_DISPLAY_SETTINGS });
    setThemeMode('system');
    setColorPalette('classic-blue');
    setCustomBackground?.(null);
    setCustomBgBlur?.(10);
    setCustomBgDim?.(45);
    setGlassCardCovers?.(true);
  };

  const handleApplyCustomWallpaper = (dataUrl: string) => {
    if (displaySettings.adaptiveArtworkWallpaper) {
      updateDisplay('adaptiveArtworkWallpaper', false);
    }
    setCustomBackground?.(dataUrl);
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') return;
      // فشرده‌سازی هوشمند تصاویر خیلی حجیم برای ذخیره‌سازی مطمئن و اجرای روان
      if (file.type !== 'image/svg+xml' && result.length > 350_000) {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1920;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const optimized = canvas.toDataURL('image/jpeg', 0.86);
            handleApplyCustomWallpaper(optimized);
            return;
          }
          handleApplyCustomWallpaper(result);
        };
        img.onerror = () => handleApplyCustomWallpaper(result);
        img.src = result;
      } else {
        handleApplyCustomWallpaper(result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div
      style={{
        flex: 1,
        padding: 'clamp(14px, 3vw, 32px)',
        paddingBottom: '140px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: '820px' }}>
        {/* نوار ناوبری بالا */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
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
            {isRTL ? <ArrowRight size={19} /> : <ArrowLeft size={19} />}
            <span>{t.settings || 'تنظیمات'}</span>
          </button>

          <h1
            style={{
              fontSize: 'clamp(1.25rem, 2.6vw, 1.625rem)',
              fontWeight: 800,
              margin: 0,
              color: theme.colors.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            {t.displayPageTitle || 'ظاهر و نمایش'}
          </h1>

          <button
            type="button"
            onClick={handleResetAllDisplay}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '999px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: '0.7813rem',
              fontWeight: 600,
            }}
          >
            <RotateCcw size={14} />
            <span>{t.resetDisplaySettings || 'بازنشانی'}</span>
          </button>
        </div>

        {/* کارت خلاصه تم فعال */}
        <IOSGroupedSection theme={theme}>
          <IOSRow
            theme={theme}
            isLast
            icon={
              <IOSSquircleIcon color={theme.colors.primary} gradientTo={theme.colors.accent || theme.colors.secondary} size={36}>
                <Disc3 size={20} />
              </IOSSquircleIcon>
            }
            title={
              (isRTL ? theme.name : (theme.nameEn || theme.name)) ||
              (theme.isDark ? t.dark : t.light)
            }
            subtitle={[
              themeMode === 'system' ? t.system || 'سیستم' : theme.isDark ? t.dark : t.light,
              displaySettings.oledPureBlack && theme.isDark ? 'OLED' : null,
              `${Math.round(displaySettings.fontScale * 100)}%`,
              displaySettings.playerBarStyle === 'docked'
                ? t.playerBarDocked || 'تمام‌عرض'
                : t.playerBarFloating || 'شناور',
            ]
              .filter(Boolean)
              .join(' · ')}
            trailing={
              <div
                style={{
                  width: '44px',
                  height: '10px',
                  borderRadius: '999px',
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: '65%', height: '100%', backgroundColor: theme.colors.primary, borderRadius: '999px' }} />
              </div>
            }
          />
        </IOSGroupedSection>

        {/* بخش ۱: تم و رنگ‌بندی هوشمند */}
        <IOSGroupedSection header={t.displaySectionTheme || 'تم و رنگ‌بندی هوشمند'} theme={theme}>
          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#5856D6" gradientTo="#7C3AED">
                {themeMode === 'dark' ? <Moon size={16} /> : themeMode === 'light' ? <Sun size={16} /> : <Smartphone size={16} />}
              </IOSSquircleIcon>
            }
            title={t.theme || 'تم برنامه'}
            subtitle={themeMode === 'system' ? t.system || 'پیش‌فرض سیستم' : themeMode === 'dark' ? t.dark : t.light}
          >
            <IOSSegmentedControl<ThemeMode>
              groupId="display-theme-mode"
              fullWidth
              theme={theme}
              value={themeMode}
              onChange={setThemeMode}
              options={[
                { value: 'system', label: <><Smartphone size={13} /><span>{t.system || 'سیستم'}</span></> },
                { value: 'light', label: <><Sun size={13} /><span>{t.light || 'روشن'}</span></> },
                { value: 'dark', label: <><Moon size={13} /><span>{t.dark || 'تیره'}</span></> },
              ]}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#1C1C1E" gradientTo="#3A3A3C">
                <Moon size={16} />
              </IOSSquircleIcon>
            }
            title={t.oledPureBlackLabel || 'حالت مشکی مطلق (OLED)'}
            subtitle={t.oledPureBlackDesc || 'استفاده از پس‌زمینه تمام‌مشکی در تم تیره برای کنتراست بیشتر'}
            trailing={
              <IOSSwitch
                checked={displaySettings.oledPureBlack}
                onChange={(next) => updateDisplay('oledPureBlack', next)}
                theme={theme}
                ariaLabel={t.oledPureBlackLabel || 'OLED'}
              />
            }
          />

          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#FF2D55" gradientTo="#FF9500">
                <Palette size={16} />
              </IOSSquircleIcon>
            }
            title={t.colorPalette || 'پالت رنگی'}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {PALETTES.map((palette) => {
                const selected =
                  colorPalette === palette.id ||
                  (colorPalette === 'default' && palette.id === 'classic-blue');
                return (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => setColorPalette(palette.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '6px 11px',
                      borderRadius: '11px',
                      border: selected
                        ? `1.5px solid ${palette.color}`
                        : `1px solid ${theme.colors.border}`,
                      backgroundColor: selected ? `${palette.color}20` : theme.colors.background,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${palette.color} 50%, ${palette.secondaryColor} 50%)`,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: selected ? 700 : 500,
                        color: selected ? theme.colors.textPrimary : theme.colors.textSecondary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isRTL ? palette.labelFa : palette.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </IOSRow>

          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#AF52DE" gradientTo="#5856D6">
                <Sparkles size={16} />
              </IOSSquircleIcon>
            }
            title={t.adaptiveAccentLabel || 'رنگ تاکیدی هوشمند از کاور'}
            subtitle={t.adaptiveAccentDesc || 'استخراج خودکار رنگ غالب کاور آهنگ فعلی'}
            trailing={
              <IOSSwitch
                checked={displaySettings.adaptiveArtworkAccent}
                onChange={(next) => updateDisplay('adaptiveArtworkAccent', next)}
                theme={theme}
                ariaLabel={t.adaptiveAccentLabel || 'Adaptive Accent'}
              />
            }
          />

          <IOSRow
            theme={theme}
            isLast
            icon={
              <IOSSquircleIcon color="#32ADE6" gradientTo="#007AFF">
                <Sparkles size={16} />
              </IOSSquircleIcon>
            }
            title={t.ambientGlowLabel || 'هاله‌های نورانی پس‌زمینه'}
            subtitle={t.ambientGlowDesc || 'نمایش گرادیان‌های رنگی نرم در پشت صفحات برنامه'}
            trailing={
              <IOSSwitch
                checked={displaySettings.ambientGlow}
                onChange={(next) => updateDisplay('ambientGlow', next)}
                theme={theme}
                ariaLabel={t.ambientGlowLabel || 'Ambient Glow'}
              />
            }
          />
        </IOSGroupedSection>

        {/* بخش ۲: پس‌زمینه و متریال شیشه‌ای */}
        <IOSGroupedSection header={t.displaySectionBackdrop || 'پس‌زمینه و متریال شیشه‌ای'} theme={theme}>
          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#FF9500" gradientTo="#FF3B30">
                <ImageIcon size={16} />
              </IOSSquircleIcon>
            }
            title={t.adaptiveWallpaperLabel || 'والپیپر پویا با کاور آهنگ'}
            subtitle={t.adaptiveWallpaperDesc || 'تبدیل خودکار کاور تار شده آهنگ فعلی به پس‌زمینه کل برنامه'}
            trailing={
              <IOSSwitch
                checked={displaySettings.adaptiveArtworkWallpaper}
                onChange={(next) => updateDisplay('adaptiveArtworkWallpaper', next)}
                theme={theme}
                ariaLabel={t.adaptiveWallpaperLabel || 'Dynamic Wallpaper'}
              />
            }
          />

          <IOSRow
            theme={theme}
            title={t.customBackground || 'پس‌زمینه دلخواه برنامه'}
            subtitle={t.selectWallpaperHint}
            trailing={
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {customBackground && (
                  <button
                    type="button"
                    onClick={() => setCustomBackground?.(null)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 10px',
                      borderRadius: '999px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.background,
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>{t.resetWallpaper || 'پیش‌فرض'}</span>
                  </button>
                )}
                <input
                  ref={wallpaperInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleWallpaperUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => wallpaperInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: 'none',
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.onPrimary || '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.7813rem',
                    fontWeight: 600,
                  }}
                >
                  <Upload size={13} />
                  <span>{t.uploadWallpaper || 'انتخاب تصویر'}</span>
                </button>
              </div>
            }
          >
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
              {WALLPAPER_PRESETS.map((preset) => {
                const isSelected = !displaySettings.adaptiveArtworkWallpaper && customBackground === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyCustomWallpaper(preset.url)}
                    title={isRTL ? preset.labelFa : preset.labelEn}
                    style={{
                      position: 'relative',
                      width: '76px',
                      height: '52px',
                      borderRadius: '11px',
                      overflow: 'hidden',
                      border: isSelected
                        ? `2.5px solid ${theme.colors.primary}`
                        : `1px solid ${theme.colors.border}`,
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={preset.url}
                      alt={isRTL ? preset.labelFa : preset.labelEn}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {isSelected && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: `${theme.colors.primary}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={17} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {(customBackground || displaySettings.adaptiveArtworkWallpaper) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '14px',
                  marginTop: '6px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: theme.colors.textSecondary, marginBottom: '6px' }}>
                    <span>{t.wallpaperBlur || 'میزان تاری'}</span>
                    <span style={{ fontWeight: 700, color: theme.colors.primary, fontVariantNumeric: 'tabular-nums' }}>{customBgBlur}px</span>
                  </div>
                  <IOSSlider value={customBgBlur} min={0} max={36} step={1} onChange={(v) => setCustomBgBlur?.(v)} theme={theme} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: theme.colors.textSecondary, marginBottom: '6px' }}>
                    <span>{t.wallpaperDim || 'تیرگی لایه محافظ'}</span>
                    <span style={{ fontWeight: 700, color: theme.colors.primary, fontVariantNumeric: 'tabular-nums' }}>{customBgDim}%</span>
                  </div>
                  <IOSSlider value={customBgDim} min={0} max={85} step={1} onChange={(v) => setCustomBgDim?.(v)} theme={theme} />
                </div>
              </div>
            )}
          </IOSRow>

          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#007AFF" gradientTo="#30B0C7">
                <Layers size={16} />
              </IOSSquircleIcon>
            }
            title={t.glassCardCovers || 'کاور شیشه‌ای روی کارت آهنگ‌ها'}
            subtitle={t.glassCardCoversDesc}
            trailing={
              <IOSSwitch
                checked={glassCardCovers}
                onChange={(next) => setGlassCardCovers?.(next)}
                theme={theme}
                ariaLabel={t.glassCardCovers || 'Glass Card Covers'}
              />
            }
          />

          <IOSRow
            theme={theme}
            title={t.glassOpacityLabel || 'شفافیت لایه‌های شیشه‌ای'}
            valueText={`${Math.round(displaySettings.glassOpacity * 100)}%`}
          >
            <IOSSlider
              value={Math.round(displaySettings.glassOpacity * 100)}
              min={25}
              max={95}
              step={5}
              onChange={(val) => updateDisplay('glassOpacity', val / 100)}
              theme={theme}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            isLast
            title={t.glassBlurLabel || 'میزان بلور شیشه'}
            valueText={`${displaySettings.glassBlur}px`}
          >
            <IOSSlider
              value={displaySettings.glassBlur}
              min={0}
              max={36}
              step={2}
              onChange={(val) => updateDisplay('glassBlur', val)}
              theme={theme}
            />
          </IOSRow>
        </IOSGroupedSection>

        {/* بخش ۳: فونت، چیدمان و انیمیشن */}
        <IOSGroupedSection header={t.displaySectionTypography || 'فونت، چیدمان و انیمیشن'} theme={theme}>
          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#0A84FF" gradientTo="#5856D6">
                <LayoutGrid size={16} />
              </IOSSquircleIcon>
            }
            title={t.homeLayoutLabel || 'چیدمان صفحه خانه'}
            subtitle={t.homeLayoutDesc || 'انتخاب بین نمای پهن کلاسیک (نوع اول) یا نمای ویجتی مدرن (نوع دوم)'}
          >
            <IOSSegmentedControl<HomeLayoutStyle>
              groupId="display-home-layout"
              fullWidth
              theme={theme}
              value={displaySettings.homeLayout || 'widget'}
              onChange={(val) => updateDisplay('homeLayout', val)}
              options={[
                {
                  value: 'wide',
                  label: (
                    <>
                      <LayoutTemplate size={13} />
                      <span>{t.homeLayoutWide || 'نوع ۱: حالت پهن'}</span>
                    </>
                  ),
                },
                {
                  value: 'widget',
                  label: (
                    <>
                      <LayoutGrid size={13} />
                      <span>{t.homeLayoutWidget || 'نوع ۲: ویجت مدرن'}</span>
                    </>
                  ),
                },
              ]}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#34C759" gradientTo="#30D158">
                <Type size={16} />
              </IOSSquircleIcon>
            }
            title={t.fontFamilyLabel || 'فونت برنامه'}
            subtitle={t.fontFamilyDesc}
          >
            <IOSSegmentedControl<FontChoice>
              groupId="display-font-family"
              fullWidth
              theme={theme}
              value={displaySettings.fontFamily}
              onChange={(val) => updateDisplay('fontFamily', val)}
              options={[
                { value: 'vazirmatn', label: t.fontVazirmatn || 'وزیرمتن' },
                { value: 'system', label: t.fontSystem || 'سیستم' },
                { value: 'editorial', label: t.fontEditorial || 'ادیتوریال' },
              ]}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.fontScaleLabel || 'مقیاس و اندازه متن'}
            subtitle={t.fontScaleDesc}
            valueText={`${Math.round(displaySettings.fontScale * 100)}%`}
          >
            <IOSSlider
              value={Math.round(displaySettings.fontScale * 100)}
              min={80}
              max={125}
              step={5}
              onChange={(val) => updateDisplay('fontScale', val / 100)}
              theme={theme}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.cornerStyleLabel || 'فرم گوشه‌ها'}
            subtitle={t.cornerStyleDesc}
          >
            <IOSSegmentedControl<CornerStyle>
              groupId="display-corner-style"
              fullWidth
              theme={theme}
              value={displaySettings.cornerStyle}
              onChange={(val) => updateDisplay('cornerStyle', val)}
              options={[
                { value: 'sharp', label: t.cornerSharp || 'تیز' },
                { value: 'balanced', label: t.cornerBalanced || 'متعادل' },
                { value: 'pill', label: t.cornerPill || 'بسیار گرد' },
              ]}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.listDensityLabel || 'تراکم لیست‌ها'}
            subtitle={t.listDensityDesc}
          >
            <IOSSegmentedControl<ListDensity>
              groupId="display-list-density"
              fullWidth
              theme={theme}
              value={displaySettings.listDensity}
              onChange={(val) => updateDisplay('listDensity', val)}
              options={[
                { value: 'compact', label: t.densityCompact || 'فشرده' },
                { value: 'comfortable', label: t.densityComfortable || 'استاندارد' },
                { value: 'spacious', label: t.densitySpacious || 'باز و راحت' },
              ]}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            isLast
            icon={
              <IOSSquircleIcon color="#8E8E93" gradientTo="#636366">
                <Eye size={16} />
              </IOSSquircleIcon>
            }
            title={t.reduceMotionLabel || 'کاهش انیمیشن‌ها'}
            subtitle={t.reduceMotionDesc}
            trailing={
              <IOSSwitch
                checked={displaySettings.reduceMotion}
                onChange={(next) => updateDisplay('reduceMotion', next)}
                theme={theme}
                ariaLabel={t.reduceMotionLabel || 'Reduce Motion'}
              />
            }
          />
        </IOSGroupedSection>

        {/* بخش ۴: ظاهر پخش‌کننده و تمام‌صفحه */}
        <IOSGroupedSection header={t.displaySectionPlayer || 'ظاهر پخش‌کننده و تمام‌صفحه'} theme={theme}>
          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#0A84FF" gradientTo="#5E5CE6">
                <Monitor size={16} />
              </IOSSquircleIcon>
            }
            title={t.playerBarStyleLabel || 'استایل نوار پلیر پایین'}
            subtitle={t.playerBarStyleDesc}
          >
            <IOSSegmentedControl<PlayerBarStyle>
              groupId="display-player-bar"
              fullWidth
              theme={theme}
              value={displaySettings.playerBarStyle}
              onChange={(val) => updateDisplay('playerBarStyle', val)}
              options={[
                { value: 'floating', label: t.playerBarFloating || 'شناور' },
                { value: 'docked', label: t.playerBarDocked || 'تمام‌عرض' },
              ]}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.playerBarOpacityLabel || 'شفافیت شیشه‌ای نوار پخش'}
            subtitle={t.playerBarOpacityDesc}
            valueText={`${Math.round((displaySettings.playerBarOpacity ?? 0.56) * 100)}%`}
          >
            <IOSSlider
              value={Math.round((displaySettings.playerBarOpacity ?? 0.56) * 100)}
              min={15}
              max={95}
              step={5}
              onChange={(val) => updateDisplay('playerBarOpacity', val / 100)}
              theme={theme}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.playerBarBlurLabel || 'شدت بلور شیشه‌ای نوار پخش'}
            subtitle={t.playerBarBlurDesc}
            valueText={`${displaySettings.playerBarBlur ?? 28}px`}
          >
            <IOSSlider
              value={displaySettings.playerBarBlur ?? 28}
              min={0}
              max={44}
              step={2}
              onChange={(val) => updateDisplay('playerBarBlur', val)}
              theme={theme}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#FF375F" gradientTo="#FF2D55">
                <Disc3 size={16} />
              </IOSSquircleIcon>
            }
            title={t.artworkStyleLabel || 'سبک کاور در تمام‌صفحه'}
            subtitle={t.artworkStyleDesc}
          >
            <IOSSegmentedControl<ArtworkStyle>
              groupId="display-artwork-style"
              fullWidth
              theme={theme}
              value={displaySettings.artworkStyle}
              onChange={(val) => updateDisplay('artworkStyle', val)}
              options={[
                { value: 'classic', label: t.artworkClassic || 'کلاسیک' },
                { value: 'vinyl', label: t.artworkVinyl || 'صفحه وینیل' },
              ]}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            isLast
            icon={
              <IOSSquircleIcon color="#5AC8FA" gradientTo="#007AFF">
                <Sliders size={16} />
              </IOSSquircleIcon>
            }
            title={t.visualizerStyleLabel || 'استایل ویژوالایزر'}
            subtitle={t.visualizerStyleDesc}
          >
            <IOSSegmentedControl<VisualizerStyle>
              groupId="display-visualizer-style"
              fullWidth
              theme={theme}
              value={displaySettings.visualizerStyle}
              onChange={(val) => updateDisplay('visualizerStyle', val)}
              options={[
                { value: 'bars', label: t.vizBars || 'میله‌ای' },
                { value: 'wave', label: t.vizWave || 'موج نرم' },
                { value: 'ring', label: t.vizRing || 'هاله دور کاور' },
              ]}
            />
          </IOSRow>
        </IOSGroupedSection>
      </div>
    </div>
  );
};
