import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDisplaySettings, isEqualizerSettings, isLinkedFolderList, isPlaylistList, isSongList, isSoundSettings } from '../../src/types/guards.ts';
import { DEFAULT_SOUND_SETTINGS } from '../../src/player/audioEffects.ts';

const song = { id: '1', name: 'n', fileUrl: 'blob:x' };

test('isSongList: آرایه‌ی معتبر و خالی', () => {
  assert.equal(isSongList([]), true);
  assert.equal(isSongList([song]), true);
});

test('isSongList: داده‌ی خراب رد می‌شه', () => {
  assert.equal(isSongList(null), false);
  assert.equal(isSongList({}), false);
  assert.equal(isSongList([{ id: 1 }]), false);
  assert.equal(isSongList([song, 'x']), false);
});

test('isPlaylistList: ساختار پلی‌لیست', () => {
  assert.equal(isPlaylistList([{ id: 'p', name: 'P', songs: [song] }]), true);
  assert.equal(isPlaylistList([{ id: 'p', name: 'P' }]), false);
  assert.equal(isPlaylistList('x'), false);
});

test('isEqualizerSettings: اعتبارسنجی تنظیمات اکولایزر', () => {
  const valid = {
    enabled: true,
    preset: 'flat',
    bands: [0, 2, -1, 3, 0],
    bassBoost: 4,
  };
  assert.equal(isEqualizerSettings(valid), true);
  assert.equal(isEqualizerSettings({ ...valid, bands: [0, 1] }), false);
  assert.equal(isEqualizerSettings({ ...valid, enabled: 'yes' }), false);
  assert.equal(isEqualizerSettings(null), false);
});

test('isSoundSettings: اعتبارسنجی تنظیمات پیشرفته صدا', () => {
  assert.equal(isSoundSettings(DEFAULT_SOUND_SETTINGS), true);
  assert.equal(isSoundSettings({ ...DEFAULT_SOUND_SETTINGS, crossfadeSeconds: 6, reverbRoom: 'hall' }), true);
  assert.equal(isSoundSettings({ ...DEFAULT_SOUND_SETTINGS, bands10: [0, 1] }), false);
  assert.equal(isSoundSettings({ ...DEFAULT_SOUND_SETTINGS, reverbRoom: 'invalid' }), false);
  assert.equal(isSoundSettings(null), false);
});

test('isDisplaySettings: اعتبارسنجی تنظیمات ظاهر و نمایش', () => {
  const validDisplay = {
    adaptiveArtworkAccent: false,
    adaptiveArtworkWallpaper: false,
    fontFamily: 'vazirmatn',
    fontScale: 1,
    listDensity: 'comfortable',
    cornerStyle: 'balanced',
    glassOpacity: 0.62,
    glassBlur: 24,
    oledPureBlack: false,
    ambientGlow: true,
    playerBarStyle: 'floating',
    artworkStyle: 'classic',
    visualizerStyle: 'bars',
    reduceMotion: false,
  };
  assert.equal(isDisplaySettings(validDisplay), true);
  assert.equal(isDisplaySettings({ ...validDisplay, cornerStyle: 'pill', artworkStyle: 'vinyl' }), true);
  assert.equal(isDisplaySettings({ ...validDisplay, navigationLayout: 'top' }), true);
  assert.equal(isDisplaySettings({ ...validDisplay, navigationLayout: 'sidebar' }), true);
  assert.equal(isDisplaySettings({ ...validDisplay, navigationLayout: 'bottom' }), false);
  assert.equal(isDisplaySettings({ ...validDisplay, cornerStyle: 'invalid' }), false);
  assert.equal(isDisplaySettings({ ...validDisplay, visualizerStyle: 'unknown' }), false);
  assert.equal(isDisplaySettings(null), false);
});

test('isLinkedFolderList: اعتبارسنجی پوشه‌های متصل دسکتاپ', () => {
  assert.equal(
    isLinkedFolderList([
      { id: 'D:\\Music', path: 'D:\\Music', name: 'Music', addedAt: 1700000000000, fileCount: 42 },
    ]),
    true
  );
  assert.equal(isLinkedFolderList([{ id: '1', path: 123, name: 'x', addedAt: 1 }]), false);
  assert.equal(isLinkedFolderList('invalid'), false);
  assert.equal(
    isSongList([{ id: 's1', name: 'Song', fileUrl: 'media://local?path=D%3A%5CMusic%5Ca.mp3', sourcePath: 'D:\\Music\\a.mp3' }]),
    true
  );
});

test('isPlaybackPreferences: اعتبارسنجی تب پیش‌فرض و ترجیحات پخش', async () => {
  const { isPlaybackPreferences } = await import('../../src/types/guards.ts');
  const { DEFAULT_PLAYBACK_PREFERENCES } = await import('../../src/player/constants.ts');
  assert.equal(isPlaybackPreferences(DEFAULT_PLAYBACK_PREFERENCES), true);
  assert.equal(isPlaybackPreferences({ ...DEFAULT_PLAYBACK_PREFERENCES, defaultTab: 'albums' }), true);
  assert.equal(isPlaybackPreferences({ ...DEFAULT_PLAYBACK_PREFERENCES, defaultTab: undefined }), true);
  assert.equal(isPlaybackPreferences({ ...DEFAULT_PLAYBACK_PREFERENCES, defaultTab: 'settings' }), false);
  assert.equal(isPlaybackPreferences({ ...DEFAULT_PLAYBACK_PREFERENCES, defaultTab: 'unknown' }), false);
});
