const { app, BrowserWindow, dialog, ipcMain, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'aac', 'opus', 'weba', 'wma'];
const AUDIO_EXT_RE = /\.(mp3|m4a|wav|flac|ogg|aac|opus|weba|wma)$/i;
const IGNORED_TEMP_RE = /(\.(tmp|part|crdownload|download|bak)|~)$/i;

const MIME_MAP = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.weba': 'audio/webm',
  '.wma': 'audio/x-ms-wma',
};

// ثبت پروتکل امن media:// قبل از آماده‌شدن اپ برای استریم مستقیم فایل‌های صوتی روی هارد بدون کپی و بدون خطای CORS
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

const normalizePathKey = (targetPath) => {
  const resolved = path.resolve(targetPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const isSafeAudioPath = (candidate) => {
  if (typeof candidate !== 'string' || !candidate.trim()) return null;
  const resolved = path.resolve(candidate);
  if (!AUDIO_EXT_RE.test(resolved)) return null;
  return resolved;
};

const buildPickedFileEntries = async (filePaths) => {
  const items = [];
  for (const filePath of filePaths) {
    const resolved = isSafeAudioPath(filePath);
    if (!resolved) continue;
    try {
      const stat = await fs.promises.stat(resolved);
      if (!stat.isFile()) continue;
      items.push({
        path: resolved,
        name: path.basename(resolved),
        size: stat.size,
      });
    } catch {
      // ignore unreadable file
    }
  }
  return items;
};

const extractAudioFilesFromArgv = (argv) => {
  if (!Array.isArray(argv)) return [];
  const results = [];
  const seen = new Set();
  for (const arg of argv) {
    if (typeof arg !== 'string' || arg.startsWith('-')) continue;
    const resolved = isSafeAudioPath(arg);
    if (!resolved) continue;
    const key = normalizePathKey(resolved);
    if (seen.has(key)) continue;
    try {
      const stat = fs.statSync(resolved);
      if (stat.isFile()) {
        seen.add(key);
        results.push(resolved);
      }
    } catch {
      // ignore missing/unreadable arg
    }
  }
  return results;
};

const scanAudioDirectory = async (rootDir) => {
  const resolvedRoot = path.resolve(rootDir);
  const rootName = path.basename(resolvedRoot) || resolvedRoot;

  let rootStat;
  try {
    rootStat = await fs.promises.stat(resolvedRoot);
  } catch {
    return null;
  }
  if (!rootStat.isDirectory()) return null;

  const files = [];

  const walk = async (currentDir, relativeFolder, depth) => {
    if (depth > 12) return;
    let entries;
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.startsWith('~$')) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const nextFolder = relativeFolder ? `${relativeFolder}/${entry.name}` : entry.name;
        await walk(fullPath, nextFolder, depth + 1);
      } else if (entry.isFile() && AUDIO_EXT_RE.test(entry.name)) {
        try {
          const stat = await fs.promises.stat(fullPath);
          files.push({
            path: fullPath,
            name: entry.name,
            folder: relativeFolder || rootName,
            size: stat.size,
          });
        } catch {
          // رد کردن فایل غیرقابل دسترس
        }
      }
    }
  };

  await walk(resolvedRoot, rootName, 0);
  return {
    folderPath: resolvedRoot,
    folderName: rootName,
    files,
  };
};

// مدیریت پایش لحظه‌ای پوشه‌های متصل روی دیسک (fs.watch با debounce و پاک‌سازی ایمن)
const createFolderWatcherManager = (getWindow) => {
  /** @type {Map<string, { rootPath: string; watchers: fs.FSWatcher[]; timer: NodeJS.Timeout | null }>} */
  const active = new Map();

  const closeEntryWatchers = (entry) => {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    for (const watcher of entry.watchers) {
      try {
        watcher.close();
      } catch {
        // ignore watcher close error
      }
    }
    entry.watchers = [];
  };

  const attachFallbackRecursiveWatchers = async (dirPath, entry, onEvent, depth = 0) => {
    if (depth > 12) return;
    try {
      const w = fs.watch(dirPath, { persistent: false }, onEvent);
      entry.watchers.push(w);
    } catch {
      return;
    }
    try {
      const subEntries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const sub of subEntries) {
        if (sub.isDirectory() && !sub.name.startsWith('.') && sub.name !== 'node_modules') {
          await attachFallbackRecursiveWatchers(path.join(dirPath, sub.name), entry, onEvent, depth + 1);
        }
      }
    } catch {
      // ignore unreadable subdir
    }
  };

  const scheduleRescan = (key, eventType, filename) => {
    const entry = active.get(key);
    if (!entry) return;

    if (typeof filename === 'string' && filename.length > 0) {
      const base = path.basename(filename);
      if (base.startsWith('.') || base.startsWith('~$') || IGNORED_TEMP_RE.test(base)) {
        return;
      }
      // رویداد تغییر محتوای فایل‌های غیرصوتی (مثل فایل عکس یا تکست) نادیده گرفته شود،
      // اما رویداد rename همیشه بررسی شود چون می‌تواند ساخت/تغییرنام/حذف زیرپوشه یا فایل باشد.
      if (eventType === 'change' && path.extname(base) && !AUDIO_EXT_RE.test(base)) {
        return;
      }
    }

    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(async () => {
      entry.timer = null;
      const latestEntry = active.get(key);
      if (!latestEntry) return;

      const win = getWindow();
      if (!win || win.isDestroyed()) return;

      const scan = await scanAudioDirectory(latestEntry.rootPath);
      if (!scan) {
        win.webContents.send('desktop:folder-changed', {
          folderPath: latestEntry.rootPath,
          folderName: path.basename(latestEntry.rootPath) || latestEntry.rootPath,
          files: [],
          missing: true,
        });
        return;
      }

      // در سیستم‌هایی که watch بازگشتی پشتیبانی نشود، پوشه‌های جدید را هم تحت نظر بگیر
      if (latestEntry.watchers.length > 1) {
        for (const w of latestEntry.watchers) {
          try {
            w.close();
          } catch {
            // ignore
          }
        }
        latestEntry.watchers = [];
        await attachFallbackRecursiveWatchers(
          latestEntry.rootPath,
          latestEntry,
          (ev, name) => scheduleRescan(key, ev, name)
        );
      }

      if (!win.isDestroyed()) {
        win.webContents.send('desktop:folder-changed', scan);
      }
    }, 650);
  };

  const startWatchingRoot = async (folderPath) => {
    const resolvedRoot = path.resolve(folderPath);
    const key = normalizePathKey(resolvedRoot);
    if (active.has(key)) return;

    try {
      const stat = await fs.promises.stat(resolvedRoot);
      if (!stat.isDirectory()) return;
    } catch {
      return;
    }

    const entry = { rootPath: resolvedRoot, watchers: [], timer: null };
    active.set(key, entry);

    const onEvent = (eventType, filename) => {
      scheduleRescan(key, eventType, typeof filename === 'string' ? filename : '');
    };

    try {
      const watcher = fs.watch(resolvedRoot, { recursive: true, persistent: false }, onEvent);
      watcher.on('error', () => {
        // در صورت قطع درایو یا خطا، وضعیت missing گزارش داده شود
        scheduleRescan(key, 'rename', '');
      });
      entry.watchers.push(watcher);
    } catch {
      // بازگشت خودکار به watch چندسطحی در پلتفرم‌هایی که recursive پشتیبانی نمی‌کنند
      await attachFallbackRecursiveWatchers(resolvedRoot, entry, onEvent);
    }
  };

  const setWatchedFolders = async (paths) => {
    const desired = new Map();
    if (Array.isArray(paths)) {
      for (const p of paths) {
        if (typeof p === 'string' && p.trim()) {
          const resolved = path.resolve(p);
          desired.set(normalizePathKey(resolved), resolved);
        }
      }
    }

    for (const [key, entry] of active.entries()) {
      if (!desired.has(key)) {
        closeEntryWatchers(entry);
        active.delete(key);
      }
    }

    for (const [key, resolvedPath] of desired.entries()) {
      if (!active.has(key)) {
        await startWatchingRoot(resolvedPath);
      }
    }
  };

  const disposeAll = () => {
    for (const entry of active.values()) {
      closeEntryWatchers(entry);
    }
    active.clear();
  };

  return { setWatchedFolders, disposeAll };
};

const registerMediaProtocol = () => {
  protocol.handle('media', async (request) => {
    try {
      const reqUrl = new URL(request.url);
      const rawPath = reqUrl.searchParams.get('path');
      const resolved = isSafeAudioPath(rawPath);
      if (!resolved) {
        return new Response('Forbidden', { status: 403 });
      }

      const stat = await fs.promises.stat(resolved);
      if (!stat.isFile()) {
        return new Response('Not Found', { status: 404 });
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      const totalSize = stat.size;
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        if (!match) {
          return new Response('Invalid Range', { status: 416 });
        }

        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(totalSize - 1, Number(match[2])) : totalSize - 1;

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= totalSize) {
          return new Response('Range Not Satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${totalSize}` },
          });
        }

        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(resolved, { start, end });
        return new Response(Readable.toWeb(stream), {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          },
        });
      }

      const stream = fs.createReadStream(resolved);
      return new Response(Readable.toWeb(stream), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  let mainWindow = null;
  let rendererOpenFilesReady = false;
  const pendingOpenFilePaths = new Set(extractAudioFilesFromArgv(process.argv.slice(1)));

  const watcherManager = createFolderWatcherManager(() => mainWindow);

  const dispatchOpenFiles = async (filePaths) => {
    const validPaths = filePaths.filter((p) => Boolean(isSafeAudioPath(p)));
    if (validPaths.length === 0) return;

    if (!rendererOpenFilesReady || !mainWindow || mainWindow.isDestroyed()) {
      for (const p of validPaths) pendingOpenFilePaths.add(path.resolve(p));
      return;
    }

    const picked = await buildPickedFileEntries(validPaths);
    if (picked.length > 0 && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:open-files', picked);
    }
  };

  const registerDesktopIpc = () => {
    ipcMain.handle('desktop:pick-audio-files', async () => {
      const res = await dialog.showOpenDialog(mainWindow || undefined, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio Files', extensions: AUDIO_EXTENSIONS }],
      });
      if (res.canceled || !Array.isArray(res.filePaths)) return [];
      return buildPickedFileEntries(res.filePaths);
    });

    ipcMain.handle('desktop:pick-music-folder', async () => {
      const res = await dialog.showOpenDialog(mainWindow || undefined, {
        properties: ['openDirectory'],
      });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) return null;
      return scanAudioDirectory(res.filePaths[0]);
    });

    ipcMain.handle('desktop:scan-folder', async (_event, folderPath) => {
      if (typeof folderPath !== 'string' || !folderPath.trim()) return null;
      return scanAudioDirectory(folderPath);
    });

    ipcMain.handle('desktop:watch-folders', async (_event, paths) => {
      await watcherManager.setWatchedFolders(paths);
    });

    ipcMain.handle('desktop:read-file-bytes', async (_event, filePath) => {
      const resolved = isSafeAudioPath(filePath);
      if (!resolved) return null;
      try {
        const buf = await fs.promises.readFile(resolved);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      } catch {
        return null;
      }
    });

    ipcMain.handle('desktop:check-paths-exist', async (_event, paths) => {
      const statusMap = {};
      if (!Array.isArray(paths)) return statusMap;
      await Promise.all(
        paths.map(async (p) => {
          const resolved = isSafeAudioPath(p);
          if (!resolved) {
            if (typeof p === 'string') statusMap[p] = false;
            return;
          }
          try {
            await fs.promises.access(resolved, fs.constants.R_OK);
            statusMap[p] = true;
          } catch {
            statusMap[p] = false;
          }
        })
      );
      return statusMap;
    });

    ipcMain.handle('desktop:show-in-folder', async (_event, filePath) => {
      const resolved = isSafeAudioPath(filePath);
      if (!resolved) return false;
      try {
        await fs.promises.access(resolved, fs.constants.F_OK);
        shell.showItemInFolder(resolved);
        return true;
      } catch {
        return false;
      }
    });

    ipcMain.handle('desktop:open-folder', async (_event, folderPath) => {
      if (typeof folderPath !== 'string' || !folderPath.trim()) return false;
      const resolved = path.resolve(folderPath);
      try {
        const stat = await fs.promises.stat(resolved);
        if (!stat.isDirectory()) return false;
        const errMsg = await shell.openPath(resolved);
        return errMsg === '';
      } catch {
        return false;
      }
    });

    ipcMain.handle('desktop:inspect-paths', async (_event, paths) => {
      const dirs = [];
      const files = [];
      if (!Array.isArray(paths)) return { dirs, files };
      const seen = new Set();

      for (const raw of paths) {
        if (typeof raw !== 'string' || !raw.trim()) continue;
        const resolved = path.resolve(raw);
        const key = normalizePathKey(resolved);
        if (seen.has(key)) continue;
        seen.add(key);

        try {
          const stat = await fs.promises.stat(resolved);
          if (stat.isDirectory()) {
            dirs.push(resolved);
          } else if (stat.isFile() && AUDIO_EXT_RE.test(resolved)) {
            files.push({
              path: resolved,
              name: path.basename(resolved),
              size: stat.size,
            });
          }
        } catch {
          // ignore invalid dropped path
        }
      }
      return { dirs, files };
    });

    ipcMain.handle('desktop:get-default-music-folder', async () => {
      try {
        const musicPath = app.getPath('music');
        if (!musicPath) return null;
        const resolved = path.resolve(musicPath);
        const stat = await fs.promises.stat(resolved);
        if (!stat.isDirectory()) return null;
        return {
          path: resolved,
          name: path.basename(resolved) || 'Music',
        };
      } catch {
        return null;
      }
    });

    ipcMain.handle('desktop:consume-pending-open-files', async () => {
      rendererOpenFilesReady = true;
      if (pendingOpenFilePaths.size === 0) return [];
      const paths = Array.from(pendingOpenFilePaths);
      pendingOpenFilePaths.clear();
      return buildPickedFileEntries(paths);
    });
  };

  const createMainWindow = () => {
    rendererOpenFilesReady = false;
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 760,
      minHeight: 560,
      show: false,
      backgroundColor: '#0c0a18',
      autoHideMenuBar: true,
      title: 'Prism Music',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });

    let shown = false;
    const revealWindow = () => {
      if (shown || !mainWindow || mainWindow.isDestroyed()) return;
      shown = true;
      mainWindow.show();
    };

    mainWindow.once('ready-to-show', revealWindow);
    setTimeout(revealWindow, 3500);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://') || url.startsWith('http://')) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    if (isDev && process.env.VITE_DEV_SERVER_URL) {
      void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }

    mainWindow.on('closed', () => {
      rendererOpenFilesReady = false;
      mainWindow = null;
    });
  };

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    void dispatchOpenFiles([filePath]);
  });

  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const audioFiles = extractAudioFilesFromArgv(commandLine.slice(1));
    if (audioFiles.length > 0) {
      void dispatchOpenFiles(audioFiles);
    }
  });

  app.whenReady().then(() => {
    registerMediaProtocol();
    registerDesktopIpc();
    createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('will-quit', () => {
    watcherManager.disposeAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

