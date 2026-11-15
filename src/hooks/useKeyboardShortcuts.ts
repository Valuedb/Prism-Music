import { useEffect, useRef } from 'react';

export interface DesktopShortcutActions {
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekBy: (deltaSeconds: number) => void;
  onVolumeBy: (deltaVolume: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavoriteCurrent: () => void;
  onToggleQueue: () => void;
  onToggleFullScreen: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onSelectTabIndex: (index: number) => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
};

const hasOpenModal = (): boolean =>
  typeof document !== 'undefined' &&
  Boolean(document.querySelector('[role="dialog"], [data-modal-open="true"]'));

/**
 * میانبرهای کیبورد استاندارد دسکتاپ با پشتیبانی کامل از چیدمان فارسی/انگلیسی (بر اساس e.code):
 * Space / K / MediaPlayPause: پخش/توقف | Ctrl+Left/Right: قبلی/بعدی | Left/Right: جلو/عقب (تنظیمی، پیش‌فرض ۵ ثانیه)
 * Ctrl+Up/Down یا +/-: کنترل صدا | M: بی‌صدا | S: شافل | R: تکرار | L: محبوب | Q: صف | F: تمام‌صفحه
 * Ctrl+F: جستجو | Ctrl+,: تنظیمات | Alt+1..6: جابه‌جایی بین تب‌ها
 */
export const useKeyboardShortcuts = (
  actions: DesktopShortcutActions,
  seekStepSeconds = 5
) => {
  const actionsRef = useRef(actions);
  const seekStepRef = useRef(seekStepSeconds);

  useEffect(() => {
    actionsRef.current = actions;
    seekStepRef.current = seekStepSeconds;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // کلیدهای سخت‌افزاری مدیا همیشه عمل کنند
      if (e.key === 'MediaPlayPause') {
        e.preventDefault();
        actionsRef.current.onTogglePlay();
        return;
      }
      if (e.key === 'MediaTrackNext') {
        e.preventDefault();
        actionsRef.current.onNext();
        return;
      }
      if (e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        actionsRef.current.onPrev();
        return;
      }

      if (hasOpenModal()) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyF') {
          e.preventDefault();
          actionsRef.current.onOpenSearch();
          return;
        }
        if (e.code === 'Comma') {
          e.preventDefault();
          actionsRef.current.onOpenSettings();
          return;
        }
      }

      if (isEditableTarget(e.target)) return;

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const digitMatch = /^Digit([1-6])$/.exec(e.code);
        if (digitMatch) {
          e.preventDefault();
          actionsRef.current.onSelectTabIndex(Number(digitMatch[1]) - 1);
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          actionsRef.current.onNext();
          return;
        }
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          actionsRef.current.onPrev();
          return;
        }
        if (e.code === 'ArrowUp') {
          e.preventDefault();
          actionsRef.current.onVolumeBy(0.05);
          return;
        }
        if (e.code === 'ArrowDown') {
          e.preventDefault();
          actionsRef.current.onVolumeBy(-0.05);
          return;
        }
        return;
      }

      if (e.altKey) return;

      const step = Math.max(1, seekStepRef.current || 5);

      if (e.code === 'Space' || e.code === 'KeyK') {
        e.preventDefault();
        actionsRef.current.onTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        actionsRef.current.onSeekBy(e.shiftKey ? step * 3 : step);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        actionsRef.current.onSeekBy(e.shiftKey ? -step * 3 : -step);
      } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        actionsRef.current.onVolumeBy(0.05);
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        actionsRef.current.onVolumeBy(-0.05);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        actionsRef.current.onToggleMute();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        actionsRef.current.onToggleShuffle();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        actionsRef.current.onCycleRepeat();
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        actionsRef.current.onToggleFavoriteCurrent();
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        actionsRef.current.onToggleQueue();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        actionsRef.current.onToggleFullScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};

