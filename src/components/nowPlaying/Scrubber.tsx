import { memo } from 'react';
import { ProgressScrubber } from '../ProgressScrubber';

interface ScrubberProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  primaryColor?: string;
}

/**
 * نوار پیشرفت آهنگ (Scrubber) با پیش‌نمایش زمان هنگام هاور و نمایش زمان باقی‌مانده
 */
export const Scrubber = memo(({
  currentTime,
  duration,
  onSeek,
  primaryColor = '#0a84ff',
}: ScrubberProps) => (
  <div style={{ width: '100%', padding: '6px 0' }}>
    <ProgressScrubber
      currentTime={currentTime}
      duration={duration}
      onSeek={onSeek}
      primaryColor={primaryColor}
      trackBgColor="rgba(255, 255, 255, 0.22)"
      timeTextColor="rgba(255, 255, 255, 0.68)"
      isDarkSurface
      tooltipTextColor="#ffffff"
      variant="fullscreen"
      negativeRemaining
    />
  </div>
));

Scrubber.displayName = 'Scrubber';
