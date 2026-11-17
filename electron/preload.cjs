const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktopRuntime', {
  platform: process.platform,
  isDesktop: true,
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file) || '';
      }
      return (file && typeof file.path === 'string' && file.path) || '';
    } catch {
      return '';
    }
  },
  pickAudioFiles: () => ipcRenderer.invoke('desktop:pick-audio-files'),
  pickMusicFolder: () => ipcRenderer.invoke('desktop:pick-music-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('desktop:scan-folder', folderPath),
  watchFolders: (paths) => ipcRenderer.invoke('desktop:watch-folders', paths),
  onFolderChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, scan) => callback(scan);
    ipcRenderer.on('desktop:folder-changed', listener);
    return () => {
      ipcRenderer.removeListener('desktop:folder-changed', listener);
    };
  },
  readFileBytes: (filePath) => ipcRenderer.invoke('desktop:read-file-bytes', filePath),
  checkPathsExist: (paths) => ipcRenderer.invoke('desktop:check-paths-exist', paths),
  showItemInFolder: (filePath) => ipcRenderer.invoke('desktop:show-in-folder', filePath),
  openFolder: (folderPath) => ipcRenderer.invoke('desktop:open-folder', folderPath),
  inspectPaths: (paths) => ipcRenderer.invoke('desktop:inspect-paths', paths),
  getDefaultMusicFolder: () => ipcRenderer.invoke('desktop:get-default-music-folder'),
  consumePendingOpenFiles: () => ipcRenderer.invoke('desktop:consume-pending-open-files'),
  onOpenFiles: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, files) => callback(files);
    ipcRenderer.on('desktop:open-files', listener);
    return () => {
      ipcRenderer.removeListener('desktop:open-files', listener);
    };
  },
});

