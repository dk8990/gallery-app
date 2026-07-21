import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: (message: string) => ipcRenderer.invoke('ping', message),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('scan-directory', dirPath),
  getScanStatus: () => ipcRenderer.invoke('get-scan-status'),
  getFolders: () => ipcRenderer.invoke('get-folders'),
  getMedia: (page: number, limit: number, searchQuery?: string, activeFolder?: string, filterType?: string, sortBy?: string, startDate?: string, endDate?: string) => 
    ipcRenderer.invoke('get-media', page, limit, searchQuery, activeFolder, filterType, sortBy, startDate, endDate),
  clearDatabase: () => ipcRenderer.invoke('clear-database'),
  addTag: (mediaId: number, tagName: string) => ipcRenderer.invoke('add-tag', mediaId, tagName),
  addTagMultiple: (mediaIds: number[], tagName: string) => ipcRenderer.invoke('add-tag-multiple', mediaIds, tagName),
  removeTag: (mediaId: number, tagId: number) => ipcRenderer.invoke('remove-tag', mediaId, tagId),
  getTags: (mediaId: number) => ipcRenderer.invoke('get-tags', mediaId),
  addDirectory: (dirPath: string) => ipcRenderer.invoke('add-directory', dirPath),
  removeDirectory: (id: number) => ipcRenderer.invoke('remove-directory', id),
  getDirectories: () => ipcRenderer.invoke('get-directories'),
  revealInExplorer: (filepath: string) => ipcRenderer.invoke('reveal-in-explorer', filepath),
  deleteMedia: (id: number, filepath: string) => ipcRenderer.invoke('delete-media', id, filepath),
  deleteMediaMultiple: (items: {id: number, filepath: string}[]) => ipcRenderer.invoke('delete-media-multiple', items),
  copyMediaMultiple: (filepaths: string[], destination: string) => ipcRenderer.invoke('copy-media-multiple', filepaths, destination),
  copyMediaClipboardMultiple: (filepaths: string[]) => ipcRenderer.invoke('copy-media-clipboard-multiple', filepaths),
  rotateMedia: (id: number, filepath: string) => ipcRenderer.invoke('rotate-media', id, filepath),
  setWallpaper: (filepath: string) => ipcRenderer.invoke('set-wallpaper', filepath),
  shareMedia: (filepath: string) => ipcRenderer.invoke('share-media', filepath),
  onLibraryUpdated: (callback: () => void) => {
    ipcRenderer.removeAllListeners('library-updated');
    ipcRenderer.on('library-updated', () => callback());
  },
  onScanStatus: (callback: (status: { scanningDirectories: string[] }) => void) => {
    ipcRenderer.removeAllListeners('scan-status');
    ipcRenderer.on('scan-status', (event, status) => callback(status));
  },
});
