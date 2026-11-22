export type AppTab =
  | 'home'
  | 'allSongs'
  | 'playlists'
  | 'artists'
  | 'albums'
  | 'folders'
  | 'settings';

export type StartupTab = Exclude<AppTab, 'settings'>;

/** یک آهنگ در کتابخانه */
export interface Song {
  id: string;
  name: string;
  artist: string;
  cover: string;
  fileUrl: string;
  sourcePath?: string;
  linkedFolderPath?: string;
  fileMissing?: boolean;
  playCount: number;
  addedAt: number;
  album?: string;
  folder?: string;
  year?: string;
  duration?: number;
  isFavorite?: boolean;
  lastPlayedAt?: number;
  lyrics?: string;
}

export interface LinkedFolder {
  id: string;
  path: string;
  name: string;
  addedAt: number;
  lastSyncedAt?: number;
  fileCount?: number;
}

export interface DesktopPickedFile {
  path: string;
  name: string;
  folder?: string;
  size?: number;
}

export interface DesktopFolderScanResult {
  folderPath: string;
  folderName: string;
  files: DesktopPickedFile[];
  missing?: boolean;
}

export interface WriteSongTagsPayload {
  filePath: string;
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  lyrics?: string;
  coverDataUrl?: string;
}

export interface WriteSongTagsResult {
  ok: boolean;
  code?: string;
  error?: string;
}

export interface DesktopRuntimeAPI {
  platform: string;
  isDesktop: boolean;
  getPathForFile?: (file: File) => string;
  pickAudioFiles?: () => Promise<DesktopPickedFile[]>;
  pickMusicFolder?: () => Promise<DesktopFolderScanResult | null>;
  scanFolder?: (folderPath: string) => Promise<DesktopFolderScanResult | null>;
  watchFolders?: (paths: string[]) => Promise<void>;
  onFolderChanged?: (callback: (scan: DesktopFolderScanResult) => void) => () => void;
  readFileBytes?: (filePath: string) => Promise<Uint8Array | null>;
  writeSongTags?: (payload: WriteSongTagsPayload) => Promise<WriteSongTagsResult>;
  checkPathsExist?: (paths: string[]) => Promise<Record<string, boolean>>;
  showItemInFolder?: (filePath: string) => Promise<boolean>;
  openFolder?: (folderPath: string) => Promise<boolean>;
  inspectPaths?: (paths: string[]) => Promise<{ dirs: string[]; files: DesktopPickedFile[] }>;
  getDefaultMusicFolder?: () => Promise<{ path: string; name: string } | null>;
  consumePendingOpenFiles?: () => Promise<DesktopPickedFile[]>;
  onOpenFiles?: (callback: (files: DesktopPickedFile[]) => void) => () => void;
}

declare global {
  interface Window {
    desktopRuntime?: DesktopRuntimeAPI;
  }
}

export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
}

export type RepeatMode = 'off' | 'all' | 'one';

/** حالت‌های پیش‌فرض اکولایزر */
export type EqualizerPreset =
  | 'flat'
  | 'bassBoost'
  | 'pop'
  | 'rock'
  | 'jazz'
  | 'vocal'
  | 'electronic'
  | 'custom';

/** تنظیمات اکولایزر و افکت‌های صوتی */
export interface EqualizerSettings {
  enabled: boolean;
  preset: EqualizerPreset;
  bands: number[]; // ۵ باند فرکانسی برحسب دسی‌بل (-12 تا +12)
  bassBoost: number; // تقویت بیس برحسب دسی‌بل (0 تا +12)
}

export type SleepTimerState =
  | { mode: 'off' }
  | { mode: 'until'; endsAt: number; durationMinutes?: number }
  | { mode: 'songEnd' };

export type ReverbRoom = 'off' | 'studio' | 'hall' | 'cathedral';
export type AudioOutputProfile = 'default' | 'headphones' | 'speaker';
export type EqBandMode = '5band' | '10band';

export interface SoundProfileSnapshot {
  eq: EqualizerSettings;
  bands10: number[];
  eqMode: EqBandMode;
  preampDb: number;
  spatialSurround: number;
  reverbRoom: ReverbRoom;
  reverbMix: number;
}

export interface SoundSettings {
  crossfadeSeconds: number;
  fadeOnPlayPause: boolean;
  gaplessPlayback: boolean;
  playbackSpeed: number;
  preservePitch: boolean;
  reverbRoom: ReverbRoom;
  reverbMix: number;
  spatialSurround: number;
  volumeNormalization: boolean;
  stereoBalance: number;
  monoAudio: boolean;
  preampDb: number;
  maxVolumeLimit: number;
  eqMode: EqBandMode;
  bands10: number[];
  outputProfile: AudioOutputProfile;
  profilePresets: Partial<Record<AudioOutputProfile, SoundProfileSnapshot>>;
  liveVisualizer: boolean;
}

export type FontChoice = 'vazirmatn' | 'system' | 'editorial';
export type ListDensity = 'compact' | 'comfortable' | 'spacious';
export type CornerStyle = 'sharp' | 'balanced' | 'pill';
export type PlayerBarStyle = 'floating' | 'docked';
export type ArtworkStyle = 'classic' | 'vinyl';
export type VisualizerStyle = 'bars' | 'wave' | 'ring';
export type HomeLayoutStyle = 'wide' | 'widget';
export type NavigationLayoutStyle = 'top' | 'sidebar';
export type SeekStepSeconds = 5 | 10 | 15;

export interface PlaybackPreferences {
  autoPlayOnImport: boolean;
  rememberPlaybackPosition: boolean;
  confirmBeforeDelete: boolean;
  skipDuplicatesOnImport: boolean;
  seekStepSeconds: SeekStepSeconds;
  defaultTab?: StartupTab;
}

export interface DisplaySettings {
  adaptiveArtworkAccent: boolean;
  adaptiveArtworkWallpaper: boolean;
  fontFamily: FontChoice;
  fontScale: number;
  listDensity: ListDensity;
  cornerStyle: CornerStyle;
  glassOpacity: number;
  glassBlur: number;
  playerBarOpacity?: number;
  playerBarBlur?: number;
  oledPureBlack: boolean;
  ambientGlow: boolean;
  playerBarStyle: PlayerBarStyle;
  artworkStyle: ArtworkStyle;
  visualizerStyle: VisualizerStyle;
  homeLayout?: HomeLayoutStyle;
  navigationLayout?: NavigationLayoutStyle;
  reduceMotion: boolean;
}
