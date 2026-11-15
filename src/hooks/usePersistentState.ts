import { useEffect, useRef, useState } from 'react';
import { readJSON, writeJSON } from '../storage/safeStorage';
import { dbReadValue, dbWriteValue } from '../storage/kvDatabase';

const persistEverywhere = (key: string, value: unknown) => {
  const localOk = writeJSON(key, value);
  try {
    if (localOk) {
      localStorage.removeItem(`${key}.idbOnly`);
    } else {
      localStorage.setItem(`${key}.idbOnly`, '1');
    }
  } catch {
    // نادیده گرفتن محدودیت localStorage؛ دیتابیس IndexedDB داده را نگه می‌دارد
  }
  void dbWriteValue(key, value);
};

/**
 * هوک ذخیره‌سازی دوگانه (IndexedDB + localStorage):
 * - خواندن هم‌زمان از localStorage برای باز شدن فوری بدون پرش تصویر
 * - همگام‌سازی خودکار با دیتابیس IndexedDB برای نگهداری مطمئن پلی‌لیست‌ها، کتابخانه‌های حجیم و تنظیمات روی ویندوز
 */
export const usePersistentState = <T>(
  key: string,
  fallback: T,
  isValid?: (value: unknown) => value is T
) => {
  const [value, setValue] = useState<T>(() => readJSON(key, fallback, isValid));
  const isFirstRender = useRef(true);
  const latestRef = useRef({ key, value });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const userTouchedRef = useRef(false);

  useEffect(() => {
    latestRef.current = { key, value };
  }, [key, value]);

  // بازیابی از دیتابیس IndexedDB در شروع (یا مهاجرت خودکار داده‌های قبلی به دیتابیس)
  useEffect(() => {
    let cancelled = false;
    const syncWithDatabase = async () => {
      const dbValue = await dbReadValue<unknown>(key);
      if (cancelled || userTouchedRef.current) return;

      const idbOnly = (() => {
        try {
          return localStorage.getItem(`${key}.idbOnly`) === '1' || localStorage.getItem(key) === null;
        } catch {
          return false;
        }
      })();

      if (dbValue !== undefined && (!isValid || isValid(dbValue))) {
        if (idbOnly) {
          setValue(dbValue as T);
          writeJSON(key, dbValue);
        }
      } else {
        // اولین اجرا یا مهاجرت داده‌ی فعلی به IndexedDB
        void dbWriteValue(key, latestRef.current.value);
      }
    };

    void syncWithDatabase();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    userTouchedRef.current = true;
    dirtyRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (dirtyRef.current) {
        dirtyRef.current = false;
        persistEverywhere(latestRef.current.key, latestRef.current.value);
      }
    }, 180);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [key, value]);

  // ذخیره قطعی هنگام بستن پنجره یا مخفی شدن تب در ویندوز
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (dirtyRef.current) {
        dirtyRef.current = false;
        persistEverywhere(latestRef.current.key, latestRef.current.value);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
      flush();
    };
  }, []);

  return [value, setValue] as const;
};
