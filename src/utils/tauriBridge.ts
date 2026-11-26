import type { DesktopPickedFile, DesktopFolderScanResult } from '../types';
import { isIgnoredFolderName } from './smartLibraryScanner';

interface TauriFileFilter {
  name: string;
  extensions: string[];
}

interface TauriDialogAPI {
  open?: (options?: {
    multiple?: boolean;
    directory?: boolean;
    title?: string;
    filters?: TauriFileFilter[];
  }) => Promise<string | string[] | null>;
}

interface TauriFsDirEntry {
  name?: string;
  path?: string;
  isDirectory?: boolean;
  isFile?: boolean;
  children?: TauriFsDirEntry[];
}

interface TauriFsAPI {
  readFile?: (path: string) => Promise<Uint8Array>;
  readBinaryFile?: (path: string) => Promise<Uint8Array>;
  readDir?: (path: string, options?: { recursive?: boolean }) => Promise<TauriFsDirEntry[]>;
  exists?: (path: string) => Promise<boolean>;
}

interface TauriWindowHandle {
  setTitle?: (title: string) => Promise<void>;
}

interface TauriGlobal {
  core?: {
    convertFileSrc?: (filePath: string, protocol?: string) => string;
  };
  tauri?: {
    convertFileSrc?: (filePath: string, protocol?: string) => string;
  };
  dialog?: TauriDialogAPI;
  fs?: TauriFsAPI;
  path?: {
    audioDir?: () => Promise<string>;
  };
  window?: {
    getCurrentWindow?: () => TauriWindowHandle;
    appWindow?: TauriWindowHandle;
  };
  event?: {
    listen?: (
      event: string,
      handler: (event: { payload: unknown }) => void
    ) => Promise<() => void>;
  };
  opener?: {
    revealItemInDir?: (path: string) => Promise<void>;
    openPath?: (path: string) => Promise<void>;
  };
  shell?: {
    open?: (path: string) => Promise<void>;
  };
}

interface TauriInternals {
  convertFileSrc?: (filePath: string, protocol?: string) => string;
}

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'wav',
  'flac',
  'ogg',
  'aac',
  'opus',
  'weba',
  'wma',
]);

const getTauriGlobal = (): TauriGlobal | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
};

const getTauriInternals = (): TauriInternals | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
};

export const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean(getTauriInternals() || getTauriGlobal());

export const isWindowsDesktop = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /win/i.test(platform) || /windows/i.test(ua);
};

export const convertTauriFileSrc = (filePath: string): string | null => {
  try {
    const internals = getTauriInternals();
    if (typeof internals?.convertFileSrc === 'function') {
      return internals.convertFileSrc(filePath);
    }
    const tauri = getTauriGlobal();
    if (typeof tauri?.core?.convertFileSrc === 'function') {
      return tauri.core.convertFileSrc(filePath);
    }
    if (typeof tauri?.tauri?.convertFileSrc === 'function') {
      return tauri.tauri.convertFileSrc(filePath);
    }
  } catch {
    // ignore invalid fileSrc conversion
  }
  return null;
};

export const syncDesktopWindowTitle = (title: string): void => {
  if (typeof document !== 'undefined' && document.title !== title) {
    document.title = title;
  }
  if (!isTauriRuntime()) return;
  try {
    const tauri = getTauriGlobal();
    const win = tauri?.window?.getCurrentWindow?.() ?? tauri?.window?.appWindow;
    if (win?.setTitle) {
      void Promise.resolve(win.setTitle(title)).catch(() => {});
    }
  } catch {
    // ignore missing window title capability
  }
};

const extractFileName = (filePath: string): string => {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || filePath;
};

const isAudioPath = (filePath: string): boolean => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return AUDIO_EXTENSIONS.has(ext);
};

/**
 * در صورتی که پلاگین‌های Tauri (dialog/fs) در محیط باینری در دسترس باشند،
 * پل ارتباطی استاندارد window.desktopRuntime به‌صورت خودکار متصل می‌شود.
 */
export const initTauriDesktopBridge = (): void => {
  if (typeof window === 'undefined' || !isTauriRuntime()) return;
  if (window.desktopRuntime?.isDesktop) return;

  const tauri = getTauriGlobal();
  const dialog = tauri?.dialog;
  const fs = tauri?.fs;
  if (!dialog?.open || (!fs?.readDir && !fs?.readFile && !fs?.readBinaryFile)) {
    return;
  }

  const readFileBytes = async (filePath: string): Promise<Uint8Array | null> => {
    try {
      const data = fs.readFile
        ? await fs.readFile(filePath)
        : await fs.readBinaryFile?.(filePath);
      return data ? new Uint8Array(data) : null;
    } catch {
      return null;
    }
  };

  const scanFolder = async (folderPath: string): Promise<DesktopFolderScanResult | null> => {
    if (!fs.readDir) return null;
    try {
      if (fs.exists) {
        try {
          const exists = await fs.exists(folderPath);
          if (!exists) {
            return {
              folderPath,
              folderName: extractFileName(folderPath),
              files: [],
              missing: true,
            };
          }
        } catch {
          // ignore exists error and attempt readDir directly
        }
      }

      const files: DesktopPickedFile[] = [];
      const rootName = extractFileName(folderPath);

      const walk = async (dirPath: string, relFolder: string) => {
        let entries: TauriFsDirEntry[];
        try {
          entries = await fs.readDir!(dirPath);
        } catch {
          return;
        }
        for (const entry of entries) {
          const name = entry.name || (entry.path ? extractFileName(entry.path) : '');
          if (!name) continue;
          const sep = dirPath.includes('\\') ? '\\' : '/';
          const fullPath =
            entry.path || `${dirPath.replace(/[\\/]+$/, '')}${sep}${name}`;
          const isDir = Boolean(entry.isDirectory || Array.isArray(entry.children));
          if (isDir) {
            if (isIgnoredFolderName(name)) continue;
            await walk(fullPath, relFolder ? `${relFolder}/${name}` : name);
          } else if (isAudioPath(name)) {
            files.push({
              path: fullPath,
              name,
              folder: relFolder || rootName,
            });
          }
        }
      };

      await walk(folderPath, rootName);
      return {
        folderPath,
        folderName: rootName,
        files,
      };
    } catch {
      return null;
    }
  };

  let watchedPaths: string[] = [];
  const lastFingerprints = new Map<string, string>();
  const folderChangeListeners = new Set<(scan: DesktopFolderScanResult) => void>();
  let watchTimerId: number | null = null;
  let watchBusy = false;

  const computeFingerprint = (scan: DesktopFolderScanResult): string => {
    if (scan.missing) return '__missing__';
    return scan.files
      .map((f) => f.path)
      .sort()
      .join('|');
  };

  const pollWatchedFolders = async () => {
    if (watchBusy || watchedPaths.length === 0 || folderChangeListeners.size === 0) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    watchBusy = true;
    try {
      for (const folderPath of watchedPaths) {
        const scan = await scanFolder(folderPath);
        if (!scan) continue;
        const fp = computeFingerprint(scan);
        const prev = lastFingerprints.get(folderPath);
        lastFingerprints.set(folderPath, fp);
        if (prev !== undefined && prev !== fp) {
          folderChangeListeners.forEach((cb) => cb(scan));
        }
      }
    } finally {
      watchBusy = false;
    }
  };

  const ensureWatchLoop = () => {
    if (watchedPaths.length > 0 && watchTimerId === null) {
      watchTimerId = window.setInterval(() => {
        void pollWatchedFolders();
      }, 5000);
    } else if (watchedPaths.length === 0 && watchTimerId !== null) {
      window.clearInterval(watchTimerId);
      watchTimerId = null;
    }
  };

  window.desktopRuntime = {
    platform: isWindowsDesktop() ? 'win32' : 'desktop',
    isDesktop: true,
    readFileBytes,
    pickAudioFiles: async () => {
      const selected = await dialog.open?.({
        multiple: true,
        directory: false,
        filters: [
          {
            name: 'Audio Files',
            extensions: Array.from(AUDIO_EXTENSIONS),
          },
        ],
      });
      if (!selected) return [];
      const paths = Array.isArray(selected) ? selected : [selected];
      return paths.filter(isAudioPath).map((p) => ({
        path: p,
        name: extractFileName(p),
      }));
    },
    pickFolderPath: async () => {
      const selected = await dialog.open?.({
        multiple: false,
        directory: true,
      });
      if (!selected || Array.isArray(selected)) return null;
      return {
        path: selected,
        name: extractFileName(selected),
      };
    },
    pickMusicFolder: async () => {
      const selected = await dialog.open?.({
        multiple: false,
        directory: true,
      });
      if (!selected || Array.isArray(selected)) return null;
      return scanFolder(selected);
    },
    scanFolder,
    watchFolders: async (paths: string[]) => {
      watchedPaths = Array.from(new Set(paths.filter(Boolean)));
      for (const known of Array.from(lastFingerprints.keys())) {
        if (!watchedPaths.includes(known)) {
          lastFingerprints.delete(known);
        }
      }
      for (const p of watchedPaths) {
        if (!lastFingerprints.has(p)) {
          const initialScan = await scanFolder(p);
          if (initialScan) {
            lastFingerprints.set(p, computeFingerprint(initialScan));
          }
        }
      }
      ensureWatchLoop();
    },
    onFolderChanged: (callback) => {
      folderChangeListeners.add(callback);
      return () => {
        folderChangeListeners.delete(callback);
      };
    },
    inspectPaths: async (paths: string[]) => {
      const dirs: string[] = [];
      const files: DesktopPickedFile[] = [];
      for (const p of paths) {
        if (!p) continue;
        if (isAudioPath(p)) {
          files.push({ path: p, name: extractFileName(p) });
          continue;
        }
        if (fs.readDir) {
          try {
            await fs.readDir(p);
            dirs.push(p);
          } catch {
            // not a readable directory
          }
        }
      }
      return { dirs, files };
    },
    checkPathsExist: fs.exists
      ? async (paths: string[]) => {
          const out: Record<string, boolean> = {};
          await Promise.all(
            paths.map(async (p) => {
              try {
                out[p] = Boolean(await fs.exists!(p));
              } catch {
                out[p] = true;
              }
            })
          );
          return out;
        }
      : undefined,
    showItemInFolder: tauri?.opener?.revealItemInDir
      ? async (filePath: string) => {
          await tauri.opener!.revealItemInDir!(filePath);
          return true;
        }
      : undefined,
    openFolder: tauri?.opener?.openPath || tauri?.shell?.open
      ? async (folderPath: string) => {
          if (tauri?.opener?.openPath) {
            await tauri.opener.openPath(folderPath);
          } else {
            await tauri?.shell?.open?.(folderPath);
          }
          return true;
        }
      : undefined,
    getDefaultMusicFolder: tauri?.path?.audioDir
      ? async () => {
          const audioPath = await tauri.path!.audioDir!();
          return audioPath ? { path: audioPath, name: extractFileName(audioPath) } : null;
        }
      : undefined,
    onOpenFiles: (callback) => {
      const listen = tauri?.event?.listen;
      if (!listen) return () => {};
      let active = true;
      const unlistenPromises = [
        listen('tauri://drag-drop', (event) => {
          if (!active) return;
          const payload = event.payload as { paths?: unknown } | unknown;
          const rawPaths =
            payload && typeof payload === 'object' && 'paths' in payload && Array.isArray(payload.paths)
              ? payload.paths
              : [];
          const picked = rawPaths
            .filter((p): p is string => typeof p === 'string' && isAudioPath(p))
            .map((p) => ({ path: p, name: extractFileName(p) }));
          if (picked.length > 0) callback(picked);
        }),
        listen('tauri://file-drop', (event) => {
          if (!active) return;
          const rawPaths = Array.isArray(event.payload) ? event.payload : [];
          const picked = rawPaths
            .filter((p): p is string => typeof p === 'string' && isAudioPath(p))
            .map((p) => ({ path: p, name: extractFileName(p) }));
          if (picked.length > 0) callback(picked);
        }),
      ];
      return () => {
        active = false;
        unlistenPromises.forEach((p) => {
          void p.then((unlisten) => unlisten()).catch(() => {});
        });
      };
    },
  };
};

const isEditableElement = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/**
 * بهینه‌سازی رفتار WebView2 در Tauri و دسکتاپ ویندوز:
 * - جلوگیری از منوی راست‌کلیک مرورگر بیرون از فیلدهای متنی
 * - مسدودکردن کلیدهای پیش‌فرض مرورگر (چاپ، ذخیره صفحه، رفرش تصادفی، سورس، ناوبری با Alt)
 * - جلوگیری از زوم تصادفی با Ctrl+Wheel در محیط دسکتاپ
 */
export const applyDesktopWebViewHardening = (): (() => void) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const root = document.documentElement;
  const isTauri = isTauriRuntime();
  const isDesktopShell = isTauri || Boolean(window.desktopRuntime?.isDesktop);
  const isWin = isWindowsDesktop();

  if (isDesktopShell || isWin) {
    root.classList.add('desktop-runtime');
  }
  if (isWin) {
    root.classList.add('windows-desktop');
  }

  if (!isDesktopShell) {
    return () => {
      root.classList.remove('desktop-runtime', 'windows-desktop');
    };
  }

  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (isEditableElement(target) || target?.closest('[data-allow-contextmenu="true"]')) {
      return;
    }
    e.preventDefault();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const editable = isEditableElement(e.target);

    if (e.key === 'F3' || e.key === 'F5' || e.key === 'F7') {
      e.preventDefault();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const code = e.code;
      if (
        code === 'KeyP' ||
        code === 'KeyS' ||
        code === 'KeyU' ||
        code === 'KeyG' ||
        code === 'KeyR' ||
        code === 'KeyJ' ||
        code === 'KeyH'
      ) {
        e.preventDefault();
        return;
      }
      if (!editable && (code === 'Equal' || code === 'Minus' || code === 'Digit0')) {
        e.preventDefault();
        return;
      }
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
      }
    }
  };

  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  };

  window.addEventListener('contextmenu', handleContextMenu);
  window.addEventListener('keydown', handleKeyDown, { capture: true });
  window.addEventListener('wheel', handleWheel, { passive: false });

  return () => {
    root.classList.remove('desktop-runtime', 'windows-desktop');
    window.removeEventListener('contextmenu', handleContextMenu);
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
    window.removeEventListener('wheel', handleWheel);
  };
};
