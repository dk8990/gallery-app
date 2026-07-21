import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { scanDirectory } from '../scanner';

export function registerScannerHandlers(
  mainWindow: () => BrowserWindow | null, 
  activeScans: Map<string, AbortController>,
  scanningDirectories: Set<string>,
  debouncedLibraryUpdate: () => void
) {
  ipcMain.handle('scan-directory', async (event, dirPath: string) => {
    if (activeScans.has(dirPath)) {
      activeScans.get(dirPath)?.abort();
    }
    
    const controller = new AbortController();
    activeScans.set(dirPath, controller);
    scanningDirectories.add(dirPath);
  
    const mw = mainWindow();
    if (mw) {
      mw.webContents.send('scan-status', { scanningDirectories: Array.from(scanningDirectories) });
    }
    
    scanDirectory(dirPath, controller.signal).finally(() => {
      if (activeScans.get(dirPath) === controller) {
        activeScans.delete(dirPath);
      }
      scanningDirectories.delete(dirPath);
      const mwAfter = mainWindow();
      if (mwAfter && !mwAfter.isDestroyed()) {
        mwAfter.webContents.send('scan-status', { scanningDirectories: Array.from(scanningDirectories) });
        if (scanningDirectories.size === 0) {
          debouncedLibraryUpdate();
        }
      }
    });
    
    return { status: 'started' };
  });
  
  ipcMain.handle('stop-scan', (event, dirPath: string) => {
    if (activeScans.has(dirPath)) {
      activeScans.get(dirPath)?.abort();
      activeScans.delete(dirPath);
      scanningDirectories.delete(dirPath);
      
      const mw = mainWindow();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send('scan-status', { scanningDirectories: Array.from(scanningDirectories) });
      }
      return { success: true };
    }
    return { success: false };
  });
  
  ipcMain.handle('get-scan-status', () => {
    return { scanningDirectories: Array.from(scanningDirectories) };
  });
}
