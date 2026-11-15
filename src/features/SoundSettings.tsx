import React, { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Sliders,
  Gauge,
  Waves,
  Headphones,
  Speaker,
  Laptop,
  RotateCcw,
  Activity,
  Volume2,
  ShieldCheck,
  Sparkles,
  Disc3,
} from 'lucide-react';
import type {
  AudioOutputProfile,
  EqualizerSettings,
  ReverbRoom,
  SoundProfileSnapshot,
  SoundSettings as SoundSettingsType,
} from '../types';
import { EqualizerControl } from '../components/EqualizerControl';
import {
  DEFAULT_EQ_SETTINGS,
  DEFAULT_SOUND_SETTINGS,
  audioEffects,
} from '../player/audioEffects';
import {
  IOSGroupedSection,
  IOSRow,
  IOSSegmentedControl,
  IOSSlider,
  IOSSquircleIcon,
  IOSSwitch,
} from '../components/IOSSettingsPrimitives';

interface SoundSettingsProps {
  soundSettings: SoundSettingsType;
  setSoundSettings: React.Dispatch<React.SetStateAction<SoundSettingsType>>;
  equalizerSettings: EqualizerSettings;
  setEqualizerSettings: (settings: EqualizerSettings) => void;
  onBack: () => void;
  theme: any;
  t: any;
  language: string;
}

/** نوار طیف‌سنج زنده صدا با Web Audio AnalyserNode */
const LiveSpectrumPreview = ({
  enabled,
  theme,
}: {
  enabled: boolean;
  theme: any;
}) => {
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barCount = 28;

  useEffect(() => {
    if (!enabled) {
      barRefs.current.forEach((bar) => {
        if (bar) bar.style.transform = 'scaleY(0.14)';
      });
      return;
    }

    let rafId = 0;
    const bins = new Uint8Array(audioEffects.getFrequencyBinCount() || 64);

    const tick = () => {
      const ok = audioEffects.getFrequencyData(bins);
      for (let i = 0; i < barCount; i++) {
        const bar = barRefs.current[i];
        if (!bar) continue;
        if (!ok) {
          bar.style.transform = 'scaleY(0.14)';
          continue;
        }
        const binIdx = Math.min(bins.length - 1, Math.floor((i / barCount) * (bins.length * 0.72)));
        const norm = (bins[binIdx] || 0) / 255;
        const scale = Math.max(0.14, Math.min(1, norm));
        bar.style.transform = `scaleY(${scale.toFixed(3)})`;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [enabled]);

  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '4px',
        height: '38px',
        padding: '0 4px',
      }}
    >
      {Array.from({ length: barCount }).map((_, idx) => (
        <div
          key={idx}
          ref={(el) => {
            barRefs.current[idx] = el;
          }}
          style={{
            flex: 1,
            height: '100%',
            borderRadius: '3px',
            backgroundColor: theme.colors.primary,
            opacity: enabled ? 0.78 : 0.22,
            transformOrigin: 'bottom',
            transform: 'scaleY(0.14)',
            transition: enabled ? 'none' : 'transform 0.25s ease',
          }}
        />
      ))}
    </div>
  );
};

export const SoundSettings: React.FC<SoundSettingsProps> = ({
  soundSettings,
  setSoundSettings,
  equalizerSettings,
  setEqualizerSettings,
  onBack,
  theme,
  t,
  language,
}) => {
  const isRTL = language === 'fa';

  const updateSound = <K extends keyof SoundSettingsType>(
    key: K,
    value: SoundSettingsType[K]
  ) => {
    setSoundSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectProfile = (targetProfile: AudioOutputProfile) => {
    if (targetProfile === soundSettings.outputProfile) return;

    const currentSnapshot: SoundProfileSnapshot = {
      eq: {
        ...equalizerSettings,
        bands: [...equalizerSettings.bands],
      },
      bands10: [...soundSettings.bands10],
      eqMode: soundSettings.eqMode,
      preampDb: soundSettings.preampDb,
      spatialSurround: soundSettings.spatialSurround,
      reverbRoom: soundSettings.reverbRoom,
      reverbMix: soundSettings.reverbMix,
    };

    const nextSnapshots = {
      ...soundSettings.profilePresets,
      [soundSettings.outputProfile]: currentSnapshot,
    };

    const targetSnapshot = nextSnapshots[targetProfile];
    if (targetSnapshot) {
      setEqualizerSettings({
        ...targetSnapshot.eq,
        bands: [...targetSnapshot.eq.bands],
      });
      setSoundSettings((prev) => ({
        ...prev,
        outputProfile: targetProfile,
        profilePresets: nextSnapshots,
        bands10: [...targetSnapshot.bands10],
        eqMode: targetSnapshot.eqMode,
        preampDb: targetSnapshot.preampDb,
        spatialSurround: targetSnapshot.spatialSurround,
        reverbRoom: targetSnapshot.reverbRoom,
        reverbMix: targetSnapshot.reverbMix,
      }));
    } else {
      setSoundSettings((prev) => ({
        ...prev,
        outputProfile: targetProfile,
        profilePresets: nextSnapshots,
      }));
    }
  };

  const handleResetAllAudio = () => {
    setEqualizerSettings({ ...DEFAULT_EQ_SETTINGS, bands: [...DEFAULT_EQ_SETTINGS.bands] });
    setSoundSettings({
      ...DEFAULT_SOUND_SETTINGS,
      bands10: [...DEFAULT_SOUND_SETTINGS.bands10],
      profilePresets: {},
    });
  };

  const applySpeedMood = (mood: 'normal' | 'slowed' | 'nightcore') => {
    if (mood === 'normal') {
      setSoundSettings((prev) => ({
        ...prev,
        playbackSpeed: 1,
        preservePitch: true,
        reverbRoom: 'off',
      }));
    } else if (mood === 'slowed') {
      setSoundSettings((prev) => ({
        ...prev,
        playbackSpeed: 0.85,
        preservePitch: false,
        reverbRoom: 'hall',
        reverbMix: prev.reverbRoom === 'off' ? 0.34 : prev.reverbMix,
      }));
    } else {
      setSoundSettings((prev) => ({
        ...prev,
        playbackSpeed: 1.25,
        preservePitch: false,
        reverbRoom: 'off',
      }));
    }
  };

  const balanceLabel =
    Math.abs(soundSettings.stereoBalance) < 0.04
      ? t.balanceCenter || 'مرکز'
      : soundSettings.stereoBalance < 0
      ? `${t.balanceLeft || 'چپ'} ${Math.round(Math.abs(soundSettings.stereoBalance) * 100)}%`
      : `${t.balanceRight || 'راست'} ${Math.round(soundSettings.stereoBalance * 100)}%`;

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
        {/* نوار ناوبری iOS */}
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
            {t.soundPageTitle || 'تنظیمات صدا'}
          </h1>

          <button
            type="button"
            onClick={handleResetAllAudio}
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
            <span>{t.resetSoundSettings || 'بازنشانی صدا'}</span>
          </button>
        </div>

        {/* طیف زنده صدا */}
        <IOSGroupedSection theme={theme}>
          <div style={{ padding: '14px 18px' }}>
            <LiveSpectrumPreview enabled={soundSettings.liveVisualizer} theme={theme} />
          </div>
        </IOSGroupedSection>

        {/* بخش ۱: انتقال و پخش پیوسته */}
        <IOSGroupedSection header={t.soundSectionTransitions || 'انتقال و پخش پیوسته'} theme={theme}>
          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#FF2D55" gradientTo="#FF375F">
                <Disc3 size={16} />
              </IOSSquircleIcon>
            }
            title={t.crossfadeLabel || 'محو شدن بین آهنگ‌ها (Crossfade)'}
            subtitle={t.crossfadeDesc}
            valueText={
              soundSettings.crossfadeSeconds === 0
                ? t.off || 'خاموش'
                : `${soundSettings.crossfadeSeconds} ${t.secondsShort || 'ثانیه'}`
            }
          >
            <IOSSlider
              value={soundSettings.crossfadeSeconds}
              min={0}
              max={12}
              step={1}
              onChange={(val) => updateSound('crossfadeSeconds', val)}
              theme={theme}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.fadePlayPauseLabel || 'نرم‌شدن شروع و توقف'}
            subtitle={t.fadePlayPauseDesc}
            trailing={
              <IOSSwitch
                checked={soundSettings.fadeOnPlayPause}
                onChange={(next) => updateSound('fadeOnPlayPause', next)}
                theme={theme}
                ariaLabel={t.fadePlayPauseLabel || 'Fade on Play Pause'}
              />
            }
          />

          <IOSRow
            theme={theme}
            isLast
            title={t.gaplessLabel || 'پخش بدون وقفه (Gapless)'}
            subtitle={t.gaplessDesc}
            trailing={
              <IOSSwitch
                checked={soundSettings.gaplessPlayback}
                onChange={(next) => updateSound('gaplessPlayback', next)}
                theme={theme}
                ariaLabel={t.gaplessLabel || 'Gapless Playback'}
              />
            }
          />
        </IOSGroupedSection>

        {/* بخش ۲: سرعت و فضای صدا */}
        <IOSGroupedSection header={t.soundSectionAtmosphere || 'سرعت و فضای صدا'} theme={theme}>
          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#FF9500" gradientTo="#FFCC00">
                <Gauge size={16} />
              </IOSSquircleIcon>
            }
            title={t.playbackSpeedLabel || 'سرعت پخش'}
            subtitle={t.playbackSpeedDesc}
            valueText={`${soundSettings.playbackSpeed.toFixed(2)}x`}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
              {[
                { id: 'slowed' as const, label: t.presetSlowedReverb || 'Slowed + Reverb' },
                { id: 'normal' as const, label: t.presetNormalSpeed || 'عادی 1.0x' },
                { id: 'nightcore' as const, label: t.presetNightcore || 'Nightcore' },
              ].map((presetBtn) => (
                <button
                  key={presetBtn.id}
                  type="button"
                  onClick={() => applySpeedMood(presetBtn.id)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '999px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.textPrimary,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {presetBtn.label}
                </button>
              ))}
            </div>
            <IOSSlider
              value={soundSettings.playbackSpeed}
              min={0.5}
              max={2.0}
              step={0.05}
              onChange={(val) => updateSound('playbackSpeed', Number(val.toFixed(2)))}
              theme={theme}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.preservePitchLabel || 'حفظ زیر و بمی صدا'}
            subtitle={t.preservePitchDesc}
            trailing={
              <IOSSwitch
                checked={soundSettings.preservePitch}
                onChange={(next) => updateSound('preservePitch', next)}
                theme={theme}
                ariaLabel={t.preservePitchLabel || 'Preserve Pitch'}
              />
            }
          />

          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#AF52DE" gradientTo="#5856D6">
                <Waves size={16} />
              </IOSSquircleIcon>
            }
            title={t.reverbRoomLabel || 'افکت فضا و ریورب'}
            subtitle={t.reverbRoomDesc}
          >
            <IOSSegmentedControl<ReverbRoom>
              groupId="sound-reverb-room"
              fullWidth
              theme={theme}
              value={soundSettings.reverbRoom}
              onChange={(val) => updateSound('reverbRoom', val)}
              options={[
                { value: 'off', label: t.reverbOff || 'خاموش' },
                { value: 'studio', label: t.reverbStudio || 'استودیو' },
                { value: 'hall', label: t.reverbHall || 'سالن' },
                { value: 'cathedral', label: t.reverbCathedral || 'کلیسا' },
              ]}
            />
            {soundSettings.reverbRoom !== 'off' && (
              <div style={{ marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: theme.colors.textSecondary, marginBottom: '6px' }}>
                  <span>{t.reverbMixLabel || 'شدت ریورب'}</span>
                  <span style={{ fontWeight: 700, color: theme.colors.primary, fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(soundSettings.reverbMix * 100)}%
                  </span>
                </div>
                <IOSSlider
                  value={Math.round(soundSettings.reverbMix * 100)}
                  min={0}
                  max={100}
                  step={2}
                  onChange={(val) => updateSound('reverbMix', val / 100)}
                  theme={theme}
                />
              </div>
            )}
          </IOSRow>

          <IOSRow
            theme={theme}
            isLast
            icon={
              <IOSSquircleIcon color="#007AFF" gradientTo="#32ADE6">
                <Sparkles size={16} />
              </IOSSquircleIcon>
            }
            title={t.spatialSurroundLabel || 'صدای سه‌بعدی (Surround)'}
            subtitle={t.spatialSurroundDesc}
            valueText={`${soundSettings.spatialSurround}%`}
          >
            <IOSSlider
              value={soundSettings.spatialSurround}
              min={0}
              max={100}
              step={5}
              onChange={(val) => updateSound('spatialSurround', val)}
              theme={theme}
            />
          </IOSRow>
        </IOSGroupedSection>

        {/* بخش ۳: تعادل و کیفیت خروجی */}
        <IOSGroupedSection header={t.soundSectionDynamics || 'تعادل و کیفیت خروجی'} theme={theme}>
          <IOSRow
            theme={theme}
            title={t.volumeNormLabel || 'نرمال‌سازی بلندی صدا'}
            subtitle={t.volumeNormDesc}
            trailing={
              <IOSSwitch
                checked={soundSettings.volumeNormalization}
                onChange={(next) => updateSound('volumeNormalization', next)}
                theme={theme}
                ariaLabel={t.volumeNormLabel || 'Volume Normalization'}
              />
            }
          />

          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#34C759" gradientTo="#30D158">
                <Volume2 size={16} />
              </IOSSquircleIcon>
            }
            title={t.preampLabel || 'تقویت ورودی (Pre-Amp)'}
            subtitle={t.preampDesc}
            trailing={
              <button
                type="button"
                onClick={() => updateSound('preampDb', 0)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.8438rem',
                  fontWeight: 700,
                  color: soundSettings.preampDb !== 0 ? theme.colors.primary : theme.colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {soundSettings.preampDb > 0 ? `+${soundSettings.preampDb}` : soundSettings.preampDb} {t.db || 'dB'}
              </button>
            }
          >
            <IOSSlider
              value={soundSettings.preampDb}
              min={-12}
              max={12}
              step={1}
              centeredZero
              onChange={(val) => updateSound('preampDb', val)}
              theme={theme}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.stereoBalanceLabel || 'بالانس چپ و راست'}
            subtitle={t.stereoBalanceDesc}
            trailing={
              <button
                type="button"
                onClick={() => updateSound('stereoBalance', 0)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: Math.abs(soundSettings.stereoBalance) >= 0.04 ? theme.colors.primary : theme.colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {balanceLabel}
              </button>
            }
          >
            <IOSSlider
              value={Math.round(soundSettings.stereoBalance * 100)}
              min={-100}
              max={100}
              step={5}
              centeredZero
              onChange={(val) => updateSound('stereoBalance', val / 100)}
              theme={theme}
            />
          </IOSRow>

          <IOSRow
            theme={theme}
            title={t.monoAudioLabel || 'حالت مونو (Mono)'}
            subtitle={t.monoAudioDesc}
            trailing={
              <IOSSwitch
                checked={soundSettings.monoAudio}
                onChange={(next) => updateSound('monoAudio', next)}
                theme={theme}
                ariaLabel={t.monoAudioLabel || 'Mono Audio'}
              />
            }
          />

          <IOSRow
            theme={theme}
            isLast
            icon={
              <IOSSquircleIcon color="#30B0C7" gradientTo="#32ADE6">
                <ShieldCheck size={16} />
              </IOSSquircleIcon>
            }
            title={t.maxVolumeLimitLabel || 'سقف ایمن ولوم'}
            subtitle={t.maxVolumeLimitDesc}
            valueText={`${soundSettings.maxVolumeLimit}%`}
          >
            <IOSSlider
              value={soundSettings.maxVolumeLimit}
              min={20}
              max={100}
              step={5}
              onChange={(val) => updateSound('maxVolumeLimit', val)}
              theme={theme}
            />
          </IOSRow>
        </IOSGroupedSection>

        {/* بخش ۴: پروفایل خروجی و اکولایزر پیشرفته */}
        <IOSGroupedSection header={t.soundSectionEqualizer || 'اکولایزر و پروفایل خروجی'} theme={theme}>
          <IOSRow
            theme={theme}
            icon={
              <IOSSquircleIcon color="#5856D6" gradientTo="#007AFF">
                <Sliders size={16} />
              </IOSSquircleIcon>
            }
            title={t.outputProfileLabel || 'پروفایل خروجی صدا'}
            subtitle={t.outputProfileDesc}
          >
            <IOSSegmentedControl<AudioOutputProfile>
              groupId="sound-output-profile"
              fullWidth
              theme={theme}
              value={soundSettings.outputProfile}
              onChange={handleSelectProfile}
              options={[
                { value: 'default', label: <><Laptop size={13} /><span>{t.profileDefault || 'پیش‌فرض'}</span></> },
                { value: 'headphones', label: <><Headphones size={13} /><span>{t.profileHeadphones || 'هدفون'}</span></> },
                { value: 'speaker', label: <><Speaker size={13} /><span>{t.profileSpeaker || 'اسپیکر'}</span></> },
              ]}
            />
          </IOSRow>

          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,67,0.12)'}` }}>
            <EqualizerControl
              settings={equalizerSettings}
              onChange={setEqualizerSettings}
              eqMode={soundSettings.eqMode}
              bands10={soundSettings.bands10}
              onChangeEqMode={(mode) => updateSound('eqMode', mode)}
              onChangeBands10={(bands) => updateSound('bands10', bands)}
              theme={theme}
              t={t}
              embedded
            />
          </div>

          <IOSRow
            theme={theme}
            isLast
            icon={
              <IOSSquircleIcon color="#FF2D55" gradientTo="#AF52DE">
                <Activity size={16} />
              </IOSSquircleIcon>
            }
            title={t.liveVisualizerLabel || 'واکنش‌گرای زنده صدا (Visualizer)'}
            subtitle={t.liveVisualizerDesc}
            trailing={
              <IOSSwitch
                checked={soundSettings.liveVisualizer}
                onChange={(next) => updateSound('liveVisualizer', next)}
                theme={theme}
                ariaLabel={t.liveVisualizerLabel || 'Live Visualizer'}
              />
            }
          />
        </IOSGroupedSection>
      </div>
    </div>
  );
};
