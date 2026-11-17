import { getContrastText, mixHex, withAlpha } from './utils/color';

export type PaletteType =
  | 'classic-blue'
  | 'classic-red'
  | 'amethyst'
  | 'sapphire'
  | 'amber'
  | 'sunset'
  | 'emerald'
  | 'teal'
  | 'synthwave'
  | 'glacier'
  | 'mauve'
  | 'mint'
  | 'nordic'
  | 'default';

export type ThemeMode = 'system' | 'light' | 'dark';

const baseFonts = {
  main: "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const baseRadius = {
  sm: '8px',
  md: '12px',
  lg: '18px',
  xl: '24px',
  full: '9999px',
};

const baseTransitions = {
  fast: 'all 0.12s cubic-bezier(0.2, 0, 0, 1)',
  normal: 'all 0.22s cubic-bezier(0.2, 0, 0, 1)',
  slow: 'all 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
};

// تم‌های لایت (روشن) با سطوح شیشه‌ای و کنتراست تقویت‌شده برای خوانایی عالی
const lightThemes: Record<PaletteType, any> = {
  'classic-blue': {
    name: 'سفید آبی',
    nameEn: 'Classic Blue',
    colors: {
      primary: '#0066FF',
      accent: '#2563EB',
      secondary: '#1D4ED8',
      background: '#F4F8FF',
      surface: 'rgba(235, 243, 255, 0.80)',
      surfaceSolid: '#E3EEFF',
      surfaceHover: 'rgba(220, 234, 255, 0.92)',
      textPrimary: '#0A0E17',
      textSecondary: '#475569',
      textInverse: '#ffffff',
      border: 'rgba(0, 102, 255, 0.20)',
      borderLight: 'rgba(255, 255, 255, 0.95)',
      glow: '#0066FF',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  'classic-red': {
    name: 'سفید قرمز',
    nameEn: 'Classic Red',
    colors: {
      primary: '#DC2626',
      accent: '#EF4444',
      secondary: '#B91C1C',
      background: '#FFF6F6',
      surface: 'rgba(255, 236, 236, 0.80)',
      surfaceSolid: '#FFE4E4',
      surfaceHover: 'rgba(254, 220, 220, 0.92)',
      textPrimary: '#140808',
      textSecondary: '#5A4A4A',
      textInverse: '#ffffff',
      border: 'rgba(220, 38, 38, 0.20)',
      borderLight: 'rgba(255, 255, 255, 0.95)',
      glow: '#DC2626',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  amethyst: {
    name: 'آمیتیست بنفش',
    nameEn: 'Amethyst',
    colors: {
      primary: '#5B4BFF',
      accent: '#7C3AED',
      secondary: '#6D28D9',
      background: '#F5F6FF',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#EDE9FE',
      surfaceHover: 'rgba(91, 75, 255, 0.08)',
      textPrimary: '#0D0B2D',
      textSecondary: '#4A4568',
      textInverse: '#ffffff',
      border: 'rgba(91, 75, 255, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#8B5CF6',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  sapphire: {
    name: 'یاقوت کبود',
    nameEn: 'Sapphire',
    colors: {
      primary: '#2563EB',
      accent: '#1D4ED8',
      secondary: '#1E40AF',
      background: '#F0F6FF',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#DBEAFE',
      surfaceHover: 'rgba(37, 99, 235, 0.08)',
      textPrimary: '#0B1F3B',
      textSecondary: '#3B4D66',
      textInverse: '#ffffff',
      border: 'rgba(37, 99, 235, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#3B82F6',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  amber: {
    name: 'قهوه و موکا',
    nameEn: 'Amber Mocha',
    colors: {
      primary: '#AE541B',
      accent: '#9A4612',
      secondary: '#78350F',
      background: '#FAF4EE',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#EFE5D8',
      surfaceHover: 'rgba(198, 96, 31, 0.08)',
      textPrimary: '#1A120E',
      textSecondary: '#544237',
      textInverse: '#ffffff',
      border: 'rgba(120, 53, 15, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#C6601F',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  sunset: {
    name: 'غروب نارنجی',
    nameEn: 'Sunset',
    colors: {
      primary: '#BB460A',
      accent: '#C2410C',
      secondary: '#9A3412',
      background: '#FAF3EC',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#FFEDD5',
      surfaceHover: 'rgba(234, 88, 12, 0.08)',
      textPrimary: '#1F1D2B',
      textSecondary: '#4F433A',
      textInverse: '#ffffff',
      border: 'rgba(234, 88, 12, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#EA580C',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  emerald: {
    name: 'زمرد و بیشه',
    nameEn: 'Emerald',
    colors: {
      primary: '#15803D',
      accent: '#166534',
      secondary: '#14532D',
      background: '#F0F7F2',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#DCFCE7',
      surfaceHover: 'rgba(21, 128, 61, 0.08)',
      textPrimary: '#051F20',
      textSecondary: '#2E4D3E',
      textInverse: '#ffffff',
      border: 'rgba(21, 128, 61, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#22C55E',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  teal: {
    name: 'تالاب دریایی',
    nameEn: 'Teal Lagoon',
    colors: {
      primary: '#0F766E',
      accent: '#115E59',
      secondary: '#134E4A',
      background: '#EEF7F6',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#CCFBF1',
      surfaceHover: 'rgba(15, 118, 110, 0.08)',
      textPrimary: '#0A0F14',
      textSecondary: '#2B4C52',
      textInverse: '#ffffff',
      border: 'rgba(15, 118, 110, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#14B8A6',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  synthwave: {
    name: 'نئون سایبر',
    nameEn: 'Synthwave',
    colors: {
      primary: '#D41B44',
      accent: '#BE123C',
      secondary: '#9F1239',
      background: '#FAF2F5',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#FFE4E6',
      surfaceHover: 'rgba(225, 29, 72, 0.08)',
      textPrimary: '#1A0F2E',
      textSecondary: '#523650',
      textInverse: '#ffffff',
      border: 'rgba(225, 29, 72, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#FF6B6B',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  glacier: {
    name: 'یخچال قطبی',
    nameEn: 'Glacier',
    colors: {
      primary: '#1E5B7A',
      accent: '#2E7D9E',
      secondary: '#15445C',
      background: '#ECF3F7',
      surface: 'rgba(225, 238, 245, 0.78)',
      surfaceSolid: '#D8E7F0',
      surfaceHover: 'rgba(206, 227, 239, 0.92)',
      textPrimary: '#0B1B26',
      textSecondary: '#3E5666',
      textInverse: '#ffffff',
      border: 'rgba(30, 91, 122, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.92)',
      glow: '#2E7D9E',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  nordic: {
    name: 'نوردیک استیل',
    nameEn: 'Nordic Steel',
    colors: {
      primary: '#46616E',
      accent: '#5C7A87',
      secondary: '#334852',
      background: '#EFF2F4',
      surface: 'rgba(229, 235, 239, 0.78)',
      surfaceSolid: '#DFE6EA',
      surfaceHover: 'rgba(213, 222, 228, 0.92)',
      textPrimary: '#161D22',
      textSecondary: '#4A5B66',
      textInverse: '#ffffff',
      border: 'rgba(70, 97, 110, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.92)',
      glow: '#5C7A87',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  mauve: {
    name: 'مخملی بنفش',
    nameEn: 'Velvet Mauve',
    colors: {
      primary: '#86198F',
      accent: '#701A75',
      secondary: '#4A044E',
      background: '#FAF2F6',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#FCE7F3',
      surfaceHover: 'rgba(134, 25, 143, 0.08)',
      textPrimary: '#190019',
      textSecondary: '#50324E',
      textInverse: '#ffffff',
      border: 'rgba(134, 25, 143, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#C084FC',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  mint: {
    name: 'فیروزه و نعنا',
    nameEn: 'Mint Breeze',
    colors: {
      primary: '#0B7C72',
      accent: '#0F766E',
      secondary: '#115E59',
      background: '#EEF9F7',
      surface: 'rgba(255, 255, 255, 0.72)',
      surfaceSolid: '#CCFBF1',
      surfaceHover: 'rgba(13, 148, 136, 0.08)',
      textPrimary: '#0B3D3B',
      textSecondary: '#284D4A',
      textInverse: '#ffffff',
      border: 'rgba(13, 148, 136, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.9)',
      glow: '#14B8A6',
      danger: '#DC2626',
      success: '#16A34A',
    },
  },
  default: null as any,
};
lightThemes.default = lightThemes['classic-blue'];

// تم‌های دارک (تیره) با سطوح شیشه‌ای بلور، درخشش‌های عمیق و رنگ‌های استخراج‌شده
const darkThemes: Record<PaletteType, any> = {
  'classic-blue': {
    name: 'مشکی آبی',
    nameEn: 'Midnight Blue',
    colors: {
      primary: '#38BDF8',
      accent: '#60A5FA',
      secondary: '#1E3A8A',
      background: '#07080B',
      surface: 'rgba(15, 23, 42, 0.58)',
      surfaceSolid: '#0F172A',
      surfaceHover: 'rgba(56, 189, 248, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      textInverse: '#000000',
      border: 'rgba(56, 189, 248, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#38BDF8',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  'classic-red': {
    name: 'مشکی قرمز',
    nameEn: 'Crimson Dark',
    colors: {
      primary: '#EF4444',
      accent: '#F87171',
      secondary: '#7F1D1D',
      background: '#090505',
      surface: 'rgba(45, 15, 15, 0.58)',
      surfaceSolid: '#260B0B',
      surfaceHover: 'rgba(239, 68, 68, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#BAA3A3',
      textInverse: '#000000',
      border: 'rgba(239, 68, 68, 0.24)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#EF4444',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  amethyst: {
    name: 'آمیتیست بنفش',
    nameEn: 'Amethyst',
    colors: {
      primary: '#8B7CC7',
      accent: '#A78BFA',
      secondary: '#5A3B8C',
      background: '#0E0B1D',
      surface: 'rgba(42, 30, 77, 0.42)',
      surfaceSolid: '#1D1537',
      surfaceHover: 'rgba(139, 124, 199, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#A9A4C2',
      textInverse: '#000000',
      border: 'rgba(139, 124, 199, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#8B7CC7',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  sapphire: {
    name: 'یاقوت کبود',
    nameEn: 'Sapphire',
    colors: {
      primary: '#3B82F6',
      accent: '#60A5FA',
      secondary: '#1C2541',
      background: '#0B132B',
      surface: 'rgba(28, 37, 65, 0.46)',
      surfaceSolid: '#141D35',
      surfaceHover: 'rgba(96, 165, 250, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#94A3B8',
      textInverse: '#000000',
      border: 'rgba(96, 165, 250, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#3B82F6',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  amber: {
    name: 'قهوه و موکا',
    nameEn: 'Amber Mocha',
    colors: {
      primary: '#D5C4AE',
      accent: '#C6601F',
      secondary: '#6B4A2E',
      background: '#1A120E',
      surface: 'rgba(58, 36, 24, 0.44)',
      surfaceSolid: '#2A1A12',
      surfaceHover: 'rgba(213, 196, 174, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#BDB1A6',
      textInverse: '#000000',
      border: 'rgba(168, 132, 98, 0.24)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#C6601F',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  sunset: {
    name: 'غروب نارنجی',
    nameEn: 'Sunset',
    colors: {
      primary: '#FF7A00',
      accent: '#FFA94D',
      secondary: '#2E2A3D',
      background: '#1F1D2B',
      surface: 'rgba(46, 42, 61, 0.48)',
      surfaceSolid: '#262235',
      surfaceHover: 'rgba(255, 122, 0, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#B6B0C6',
      textInverse: '#000000',
      border: 'rgba(255, 122, 0, 0.24)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#FF7A00',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  emerald: {
    name: 'زمرد و بیشه',
    nameEn: 'Emerald',
    colors: {
      primary: '#48BB78',
      accent: '#8EB69B',
      secondary: '#163832',
      background: '#051F20',
      surface: 'rgba(22, 56, 50, 0.46)',
      surfaceSolid: '#0B2B26',
      surfaceHover: 'rgba(142, 182, 155, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#A0B9AC',
      textInverse: '#000000',
      border: 'rgba(142, 182, 155, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#48BB78',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  teal: {
    name: 'تالاب دریایی',
    nameEn: 'Teal Lagoon',
    colors: {
      primary: '#14B8A6',
      accent: '#7FB3B8',
      secondary: '#0F3D3E',
      background: '#0A0F14',
      surface: 'rgba(15, 61, 62, 0.46)',
      surfaceSolid: '#0D2D2E',
      surfaceHover: 'rgba(20, 184, 166, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#9BB8BC',
      textInverse: '#000000',
      border: 'rgba(127, 179, 184, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#14B8A6',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  synthwave: {
    name: 'نئون سایبر',
    nameEn: 'Synthwave',
    colors: {
      primary: '#FF6B6B',
      accent: '#D6598F',
      secondary: '#7A2E6F',
      background: '#1A0F2E',
      surface: 'rgba(59, 27, 79, 0.46)',
      surfaceSolid: '#2A133B',
      surfaceHover: 'rgba(255, 107, 107, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#D0A8C4',
      textInverse: '#000000',
      border: 'rgba(255, 107, 107, 0.24)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#FF6B6B',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  glacier: {
    name: 'یخچال قطبی',
    nameEn: 'Glacier',
    colors: {
      primary: '#CCD0CF',
      accent: '#4A5C6A',
      secondary: '#253745',
      background: '#06141B',
      surface: 'rgba(17, 33, 45, 0.52)',
      surfaceSolid: '#11212D',
      surfaceHover: 'rgba(74, 92, 106, 0.16)',
      textPrimary: '#FFFFFF',
      textSecondary: '#9BA8AB',
      textInverse: '#000000',
      border: 'rgba(74, 92, 106, 0.28)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#4A5C6A',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  nordic: {
    name: 'نوردیک استیل',
    nameEn: 'Nordic Steel',
    colors: {
      primary: '#C5BAC4',
      accent: '#57707A',
      secondary: '#7B919C',
      background: '#191D23',
      surface: 'rgba(38, 44, 53, 0.55)',
      surfaceSolid: '#262C35',
      surfaceHover: 'rgba(197, 186, 196, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#989DAA',
      textInverse: '#000000',
      border: 'rgba(123, 145, 156, 0.24)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#7B919C',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  mauve: {
    name: 'مخملی بنفش',
    nameEn: 'Velvet Mauve',
    colors: {
      primary: '#DFB6B2',
      accent: '#D946EF',
      secondary: '#522B5B',
      background: '#190019',
      surface: 'rgba(43, 18, 76, 0.46)',
      surfaceSolid: '#270F35',
      surfaceHover: 'rgba(223, 182, 178, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#C5A6BC',
      textInverse: '#000000',
      border: 'rgba(223, 182, 178, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#D946EF',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  mint: {
    name: 'فیروزه و نعنا',
    nameEn: 'Mint Breeze',
    colors: {
      primary: '#2DD4BF',
      accent: '#99F6E4',
      secondary: '#0F3D3B',
      background: '#0B3D3B',
      surface: 'rgba(11, 61, 59, 0.48)',
      surfaceSolid: '#0E4846',
      surfaceHover: 'rgba(45, 212, 191, 0.14)',
      textPrimary: '#FFFFFF',
      textSecondary: '#9FE0D8',
      textInverse: '#000000',
      border: 'rgba(45, 212, 191, 0.22)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      glow: '#2DD4BF',
      danger: '#FF453A',
      success: '#30D158',
    },
  },
  default: null as any,
};
darkThemes.default = darkThemes['classic-blue'];

export const DEFAULT_DISPLAY_SETTINGS: import('./types').DisplaySettings = {
  adaptiveArtworkAccent: false,
  adaptiveArtworkWallpaper: false,
  fontFamily: 'vazirmatn',
  fontScale: 1,
  listDensity: 'comfortable',
  cornerStyle: 'balanced',
  glassOpacity: 0.62,
  glassBlur: 24,
  playerBarOpacity: 0.56,
  playerBarBlur: 28,
  oledPureBlack: false,
  ambientGlow: true,
  playerBarStyle: 'floating',
  artworkStyle: 'classic',
  visualizerStyle: 'bars',
  homeLayout: 'widget',
  navigationLayout: 'top',
  reduceMotion: false,
};

const FONT_STACKS: Record<import('./types').FontChoice, string> = {
  vazirmatn: "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Roboto, sans-serif",
  editorial: "'Georgia', 'Times New Roman', 'Vazirmatn', serif",
};

const RADIUS_PRESETS: Record<import('./types').CornerStyle, typeof baseRadius> = {
  sharp: { sm: '4px', md: '6px', lg: '9px', xl: '12px', full: '9999px' },
  balanced: baseRadius,
  pill: { sm: '12px', md: '18px', lg: '24px', xl: '32px', full: '9999px' },
};

export interface ThemeDisplayOptions {
  display?: Partial<import('./types').DisplaySettings>;
  overridePrimaryHex?: string | null;
  hasWallpaper?: boolean;
}

export const getTheme = (
  mode: ThemeMode | 'light' | 'dark',
  palette: PaletteType,
  options?: ThemeDisplayOptions
) => {
  const effectiveMode = mode === 'dark' ? 'dark' : 'light';
  const paletteKey = (palette in lightThemes ? palette : 'classic-blue') as PaletteType;
  const baseTheme = effectiveMode === 'light' ? lightThemes[paletteKey] : darkThemes[paletteKey];
  const display = { ...DEFAULT_DISPLAY_SETTINGS, ...options?.display };
  const isDark = effectiveMode === 'dark';
  const hasWallpaper = Boolean(options?.hasWallpaper);

  const activePrimary = options?.overridePrimaryHex || baseTheme.colors.primary;
  const surfaceAlpha = Math.max(0.22, Math.min(0.95, display.glassOpacity));
  const blurPx = Math.max(0, Math.min(36, Math.round(display.glassBlur)));

  const resolvedBackground =
    isDark && display.oledPureBlack
      ? '#000000'
      : options?.overridePrimaryHex && !isDark
      ? mixHex(baseTheme.colors.background, activePrimary, 0.06)
      : baseTheme.colors.background;
  const resolvedSurfaceSolid =
    isDark && display.oledPureBlack
      ? '#0a0a0d'
      : options?.overridePrimaryHex
      ? mixHex(baseTheme.colors.surfaceSolid, activePrimary, isDark ? 0.10 : 0.14)
      : baseTheme.colors.surfaceSolid;

  const lightSurfaceBase = options?.overridePrimaryHex
    ? mixHex('#ffffff', activePrimary, 0.11)
    : mixHex('#ffffff', resolvedSurfaceSolid, 0.72);
  const effectiveDarkAlpha = hasWallpaper ? Math.min(surfaceAlpha, 0.68) : surfaceAlpha;
  const effectiveLightAlpha = hasWallpaper
    ? Math.min(0.82, Math.max(0.45, surfaceAlpha * 0.82))
    : Math.min(0.96, surfaceAlpha + 0.16);
  const resolvedSurface = isDark
    ? withAlpha(resolvedSurfaceSolid, effectiveDarkAlpha)
    : withAlpha(lightSurfaceBase, effectiveLightAlpha);
  const resolvedSurfaceHover = isDark
    ? withAlpha(mixHex(resolvedSurfaceSolid, activePrimary, 0.15), Math.min(0.96, effectiveDarkAlpha + 0.14))
    : withAlpha(mixHex(lightSurfaceBase, activePrimary, 0.10), Math.min(0.98, effectiveLightAlpha + 0.14));

  const colors = {
    ...baseTheme.colors,
    primary: activePrimary,
    onPrimary: getContrastText(activePrimary),
    accent: options?.overridePrimaryHex ? activePrimary : baseTheme.colors.accent,
    glow: options?.overridePrimaryHex ? activePrimary : baseTheme.colors.glow,
    background: resolvedBackground,
    surfaceSolid: resolvedSurfaceSolid,
    surface: resolvedSurface,
    surfaceHover: resolvedSurfaceHover,
    border: isDark && display.oledPureBlack
      ? withAlpha(activePrimary, 0.22)
      : options?.overridePrimaryHex
      ? withAlpha(activePrimary, 0.24)
      : baseTheme.colors.border,
  };

  const radius = RADIUS_PRESETS[display.cornerStyle] || baseRadius;
  const fonts = {
    main: FONT_STACKS[display.fontFamily] || baseFonts.main,
  };

  const baseShadows = {
    soft: isDark ? '0 8px 24px rgba(0, 0, 0, 0.35)' : `0 4px 18px ${withAlpha(activePrimary, 0.08)}`,
    hard: isDark ? '0 16px 40px rgba(0, 0, 0, 0.55)' : `0 10px 30px ${withAlpha(activePrimary, 0.14)}`,
    glow: `0 8px 30px ${withAlpha(colors.glow, 0.28)}`,
  };

  const cardFilter = blurPx > 0 ? `blur(${blurPx}px) saturate(180%)` : 'none';
  const rowFilter = blurPx > 0 ? `blur(${Math.max(0, Math.round(blurPx * 0.85))}px) saturate(160%)` : 'none';

  const glass = {
    blur: `${blurPx}px`,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    card: {
      backgroundColor: colors.surface,
      backdropFilter: cardFilter,
      WebkitBackdropFilter: cardFilter,
      border: `1px solid ${colors.border}`,
      boxShadow: isDark
        ? '0 12px 36px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
        : `0 8px 24px ${withAlpha(activePrimary, 0.07)}, inset 0 1px 0 rgba(255, 255, 255, 0.72)`,
    },
    row: {
      backgroundColor: colors.surface,
      backdropFilter: rowFilter,
      WebkitBackdropFilter: rowFilter,
      border: `1px solid ${colors.border}`,
      boxShadow: isDark
        ? '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
        : `0 2px 10px ${withAlpha(activePrimary, 0.05)}, inset 0 1px 0 rgba(255, 255, 255, 0.55)`,
    },
  };

  const { primary, surfaceSolid } = colors;
  const barAlpha = Math.max(0.15, Math.min(0.95, display.playerBarOpacity ?? 0.56));
  const barBlurPx = Math.max(0, Math.min(44, Math.round(display.playerBarBlur ?? Math.max(24, blurPx))));
  const barFilter = barBlurPx > 0 ? `blur(${barBlurPx}px) saturate(190%)` : 'none';
  const bar = isDark
    ? {
        background: `linear-gradient(180deg, ${withAlpha(
          mixHex(surfaceSolid, '#ffffff', 0.08),
          Math.min(0.96, barAlpha + 0.06)
        )} 0%, ${withAlpha(surfaceSolid, barAlpha)} 100%)`,
        backdropFilter: barFilter,
        border: `1px solid ${withAlpha(primary, 0.26)}`,
        boxShadow: [
          '0 18px 44px rgba(0, 0, 0, 0.55)',
          `0 6px 24px ${withAlpha(primary, 0.20)}`,
          'inset 0 1px 0 rgba(255, 255, 255, 0.16)',
        ].join(', '),
      }
    : {
        background: `linear-gradient(180deg, ${withAlpha(
          mixHex('#ffffff', surfaceSolid, 0.42),
          Math.min(0.95, barAlpha + 0.08)
        )} 0%, ${withAlpha(
          mixHex('#ffffff', surfaceSolid, 0.72),
          barAlpha
        )} 100%)`,
        backdropFilter: barFilter,
        border: `1px solid ${colors.border}`,
        boxShadow: [
          `0 16px 38px ${withAlpha(primary, 0.20)}`,
          '0 4px 14px rgba(0, 0, 0, 0.08)',
          'inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        ].join(', '),
      };

  return {
    ...baseTheme,
    colors,
    isDark,
    glass: { ...glass, bar },
    fonts,
    shadows: baseShadows,
    radius,
    transitions: display.reduceMotion
      ? { fast: 'none', normal: 'none', slow: 'none' }
      : baseTransitions,
    display,
  };
};