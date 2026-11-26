import { useEffect, useRef } from 'react';

export interface DesktopShortcutActions {
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekBy: (deltaSeconds: number) => void;
  onSeekPercent?: (fraction: number) => void;
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

const NON_TEXT_INPUT_TYPES = new Set([
  'range',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
  'color',
]);

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const inputType = ((target as HTMLInputElement).type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(inputType);
  }
  return false;
};

const hasOpenModal = (): boolean =>
  typeof document !== 'undefined' &&
  Boolean(document.querySelector('[role="dialog"], [data-modal-open="true"]'));

/**
 * میانبرهای کیبورد استاندارد دسکتاپ با پشتیبانی کامل از چیدمان فارسی/انگلیسی (بر اساس e.code):
 * Space / K / MediaPlayPause: پخش/توقف | Ctrl+Left/Right یا N/P: قبلی/بعدی | Left/Right: جلو/عقب (تنظیمی، پیش‌فرض ۵ ثانیه)
 * 0..9: پرش درصدی در آهنگ (۰٪ تا ۹۰٪) | Ctrl+Up/Down یا +/-: کنترل صدا | M: بی‌صدا
 * S: شافل | R: تکرار | L: محبوب | Q: صف | F: تمام‌صفحه | Ctrl+F/K یا /: جستجو | Ctrl+,: تنظیمات | Alt+1..6: تب‌ها
 */
export const useKeyboardShortcuts = (
  actions: DesktopShortcutActions,
  seekStepSeconds = 5
) => {
  const actionsRef = useRef(actions);
  const seekStepRef = useRef(seekStepSeconds);
  const interceptedSpaceRef = useRef(false);

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
      if (e.key === 'MediaStop') {
        e.preventDefault();
        actionsRef.current.onTogglePlay();
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

      // اگر اسلایدر رنج ولوم یا اسکرول فوکوس داشت، کلیدهای چپ/راست باعث تداخل نشوند
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) {
          interceptedSpaceRef.current = true;
          actionsRef.current.onTogglePlay();
        }
        return;
      }

      if (e.code === 'KeyK') {
        e.preventDefault();
        if (!e.repeat) actionsRef.current.onTogglePlay();
      } else if (e.code === 'KeyN' && !e.shiftKey) {
        e.preventDefault();
        actionsRef.current.onNext();
      } else if (e.code === 'KeyP' && !e.shiftKey) {
        e.preventDefault();
        actionsRef.current.onPrev();
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
      } else if (!e.shiftKey) {
        const seekDigitMatch = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
        if (seekDigitMatch && actionsRef.current.onSeekPercent) {
          e.preventDefault();
          actionsRef.current.onSeekPercent(Number(seekDigitMatch[1]) / 10);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && interceptedSpaceRef.current) {
        interceptedSpaceRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleBlur = () => {
      interceptedSpaceRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
};


