import { app, BrowserWindow, protocol, net, ipcMain } from 'electron';
import * as path from 'path';
import * as fsSync from 'fs';
import { pathToFileURL } from 'url';
import { getDb, initDB } from './db';
import { initConfig, getConfig } from './config';
import { processFile, removeFile, removeDirectory } from './scanner';
import * as chokidar from 'chokidar';
import { autoUpdater } from 'electron-updater';
import { startStreamingServer } from './server';
import { registerSystemHandlers } from './ipc/systemHandlers';
import { registerMediaHandlers } from './ipc/mediaHandlers';
import { registerScannerHandlers } from './ipc/scannerHandlers';

let mainWindow: BrowserWindow | null = null;
let watcher: chokidar.FSWatcher | null = null;
let updateTimeout: NodeJS.Timeout | null = null;

const activeScans = new Map<string, AbortController>();
const scanningDirectories = new Set<string>();

function debouncedLibraryUpdate() {
  if (updateTimeout) clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('library-updated');
    }
  }, 1000);
}

function setupWatcher() {
  try {
    const db = getDb();
    const dirs = db.prepare('SELECT path FROM Directories').all() as { path: string }[];
    const dirPaths = dirs.map(d => d.path);
    
    watcher = chokidar.watch(dirPaths, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    watcher
      .on('add', async (filePath: string) => {
        await processFile(filePath);
        debouncedLibraryUpdate();
      })
      .on('change', async (filePath: string) => {
        await processFile(filePath);
        debouncedLibraryUpdate();
      })
      .on('unlink', (filePath: string) => {
        removeFile(filePath);
        debouncedLibraryUpdate();
      })
      .on('unlinkDir', (dirPath: string) => {
        removeDirectory(dirPath);
        debouncedLibraryUpdate();
      });
  } catch (error) {
    console.error('Failed to setup watcher:', error);
  }
}

function createWindow() {
  const isDev = !app.isPackaged;
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://-/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register handlers that depend on mainWindow here
  registerSystemHandlers(mainWindow);
}

export function startLibraryServices() {
  startStreamingServer();
  setupWatcher();
  
  // Notify frontend to refresh
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('library-updated');
  }
}

export function stopLibraryServices() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  
  for (const controller of activeScans.values()) {
    controller.abort();
  }
  activeScans.clear();
  scanningDirectories.clear();
  
  // Notify frontend
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scan-status', { scanningDirectories: [] });
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
  initConfig();
  const config = getConfig();

  // Register other handlers
  registerMediaHandlers(() => mainWindow, () => watcher, activeScans, scanningDirectories);
  registerScannerHandlers(() => mainWindow, activeScans, scanningDirectories, debouncedLibraryUpdate);
  
  // Example IPC handler for testing
  ipcMain.handle('ping', async (event, message) => {
    console.log('Received ping from renderer:', message);
    return 'pong from main process!';
  });

  protocol.handle('media', (request) => {
    const filepath = request.url.replace('media://', '').split('?')[0];
    const decodedPath = decodeURIComponent(filepath);
    return net.fetch(pathToFileURL(decodedPath).toString());
  });

  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const decodedPath = decodeURIComponent(url.pathname);
    let filepath = path.join(__dirname, '../out', decodedPath);
    
    try {
      if (!fsSync.existsSync(filepath) || fsSync.statSync(filepath).isDirectory()) {
        filepath = path.join(__dirname, '../out/index.html');
      }
    } catch (e) {
      filepath = path.join(__dirname, '../out/index.html');
    }

    return net.fetch(pathToFileURL(filepath).toString());
  });

  createWindow();

  if (config.activeLibraryPath) {
    try {
      initDB(config.activeLibraryPath);
      startLibraryServices();
    } catch (e) {
      console.error('Failed to auto-load library:', e);
    }
  }

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
