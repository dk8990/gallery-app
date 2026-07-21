import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { pathToFileURL } from 'url';
import * as http from 'http';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { db } from './db';
import { scanDirectory, processFile, removeFile } from './scanner';
import * as chokidar from 'chokidar';
import { autoUpdater } from 'electron-updater';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath((ffmpegStatic as string).replace(/app\.asar/i, 'app.asar.unpacked'));
}
if (ffprobeStatic) {
  ffmpeg.setFfprobePath(ffprobeStatic.path.replace(/app\.asar/i, 'app.asar.unpacked'));
}

const ffprobeCache = new Map<string, ffmpeg.FfprobeData>();

const streamingServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const filepath = url.searchParams.get('path');
    
    if (!filepath) {
      res.statusCode = 400;
      return res.end('Missing path');
    }

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*'
    });

    const startTime = url.searchParams.get('startTime');

    // Check cache first for instant metadata
    let metadata = ffprobeCache.get(filepath);
    
    if (!metadata) {
      metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
        ffmpeg.ffprobe(filepath, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      ffprobeCache.set(filepath, metadata);
    }

    const vStream = metadata.streams.find(s => s.codec_type === 'video');
    const aStream = metadata.streams.find(s => s.codec_type === 'audio');
    
    const vcodec = (vStream?.codec_name === 'h264') ? 'copy' : 'libx264';
    const acodec = (aStream?.codec_name === 'aac') ? 'copy' : 'aac';

    let command = ffmpeg(filepath);
    if (startTime) {
      command = command.setStartTime(parseFloat(startTime));
    }

    const outputOptions = [
      '-movflags frag_keyframe+empty_moov', // Enable fragmented mp4 for streaming
      '-preset ultrafast', // Fast encoding
      `-vcodec ${vcodec}`, // Dynamic video codec
      `-acodec ${acodec}`, // Dynamic audio codec
      '-threads 0'
    ];

    if (vcodec === 'libx264') {
      outputOptions.push('-tune zerolatency', '-tune fastdecode');
    }

    command
      .format('mp4')
      .outputOptions(outputOptions)
      .on('error', (err) => {
        console.error('FFmpeg streaming error:', err);
        if (!res.writableEnded) res.end();
      })
      .pipe(res, { end: true });
      
    req.on('close', () => {
      // ffmpeg process is automatically killed when pipe destination closes
    });
  } catch (err) {
    console.error('Streaming server error:', err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.end();
    }
  }
});

streamingServer.listen(4000, () => {
  console.log('Streaming server listening on port 4000');
});

let mainWindow: BrowserWindow | null = null;

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
    // In development, load the Next.js dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the statically exported Next.js HTML via custom protocol
    mainWindow.loadURL('app://-/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let watcher: chokidar.FSWatcher | null = null;
let updateTimeout: NodeJS.Timeout | null = null;

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
      });
  } catch (error) {
    console.error('Failed to setup watcher:', error);
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {
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

  setupWatcher();
  createWindow();

  // Check for updates
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

// Example IPC handler for testing
ipcMain.handle('ping', async (event, message) => {
  console.log('Received ping from renderer:', message);
  return 'pong from main process!';
});

ipcMain.handle('select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

const activeScans = new Map<string, AbortController>();
let scanningDirectories = new Set<string>();

ipcMain.handle('scan-directory', async (event, dirPath: string) => {
  if (activeScans.has(dirPath)) {
    activeScans.get(dirPath)?.abort();
  }
  
  const controller = new AbortController();
  activeScans.set(dirPath, controller);
  scanningDirectories.add(dirPath);

  if (mainWindow) {
    mainWindow.webContents.send('scan-status', { scanningDirectories: Array.from(scanningDirectories) });
  }
  
  scanDirectory(dirPath, controller.signal).finally(() => {
    if (activeScans.get(dirPath) === controller) {
      activeScans.delete(dirPath);
    }
    scanningDirectories.delete(dirPath);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-status', { scanningDirectories: Array.from(scanningDirectories) });
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
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-status', { scanningDirectories: Array.from(scanningDirectories) });
    }
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('get-scan-status', () => {
  return { scanningDirectories: Array.from(scanningDirectories) };
});

ipcMain.handle('get-folders', () => {
  try {
    const query = `SELECT DISTINCT replace(filepath, filename, '') as dirpath FROM Media`;
    const rows = db.prepare(query).all() as { dirpath: string }[];
    return { success: true, folders: rows.map(r => r.dirpath) };
  } catch (error) {
    console.error('Failed to get folders from DB:', error);
    return { success: false, folders: [] };
  }
});

ipcMain.handle('get-media', (event, page: number = 1, limit: number = 50, searchQuery?: string, activeFolder?: string, filterType?: string, sortBy?: string, startDate?: string, endDate?: string) => {
  try {
    const offset = (page - 1) * limit;
    
    let baseQuery = `
      SELECT DISTINCT Media.* 
      FROM Media 
      LEFT JOIN MediaTags ON Media.id = MediaTags.media_id
      LEFT JOIN Tags ON MediaTags.tag_id = Tags.id
      WHERE 1=1
    `;
    
    let countBaseQuery = `
      SELECT COUNT(DISTINCT Media.id) as count 
      FROM Media 
      LEFT JOIN MediaTags ON Media.id = MediaTags.media_id
      LEFT JOIN Tags ON MediaTags.tag_id = Tags.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (searchQuery) {
      baseQuery += ` AND (Media.filename LIKE ? OR Tags.name LIKE ?)`;
      countBaseQuery += ` AND (Media.filename LIKE ? OR Tags.name LIKE ?)`;
      const q = `%${searchQuery}%`;
      params.push(q, q);
    }
    
    if (activeFolder) {
      baseQuery += ` AND Media.filepath LIKE ?`;
      countBaseQuery += ` AND Media.filepath LIKE ?`;
      params.push(`${activeFolder}%`);
    }
    
    if (filterType && filterType !== 'All') {
      baseQuery += ` AND Media.type = ?`;
      countBaseQuery += ` AND Media.type = ?`;
      params.push(filterType);
    }

    if (startDate) {
      baseQuery += ` AND date(Media.created_at) >= date(?)`;
      countBaseQuery += ` AND date(Media.created_at) >= date(?)`;
      params.push(startDate);
    }

    if (endDate) {
      baseQuery += ` AND date(Media.created_at) <= date(?)`;
      countBaseQuery += ` AND date(Media.created_at) <= date(?)`;
      params.push(endDate);
    }
    
    let orderClause = 'ORDER BY Media.id DESC';
    if (sortBy === 'Oldest') orderClause = 'ORDER BY Media.created_at ASC';
    else if (sortBy === 'Newest') orderClause = 'ORDER BY Media.created_at DESC';
    else if (sortBy === 'Largest') orderClause = 'ORDER BY Media.size DESC';
    else if (sortBy === 'Smallest') orderClause = 'ORDER BY Media.size ASC';
    else if (sortBy === 'Random') orderClause = 'ORDER BY RANDOM()';
    
    const query = limit > 0 
      ? `${baseQuery} ${orderClause} LIMIT ? OFFSET ?`
      : `${baseQuery} ${orderClause}`;
      
    const queryParams = limit > 0 ? [...params, limit, offset] : params;
    
    const items = db.prepare(query).all(...queryParams);
    const totalRow = db.prepare(countBaseQuery).get(...params) as { count: number };
    
    return {
      items,
      total: totalRow.count,
      page,
      totalPages: limit > 0 ? Math.ceil(totalRow.count / limit) : 1
    };
  } catch (error) {
    console.error('Failed to get media from DB:', error);
    return { items: [], total: 0, page: 1, totalPages: 0 };
  }
});

ipcMain.handle('clear-database', () => {
  try {
    for (const controller of activeScans.values()) {
      controller.abort();
    }
    activeScans.clear();
    scanningDirectories.clear();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-status', { scanningDirectories: [] });
    }

    const dirs = db.prepare('SELECT path FROM Directories').all() as { path: string }[];
    dirs.forEach(d => {
      if (watcher) watcher.unwatch(d.path);
    });

    db.prepare('DELETE FROM Directories').run();
    db.prepare('DELETE FROM Media').run();
    db.prepare('DELETE FROM Tags').run();
    db.prepare('DELETE FROM MediaTags').run();
    return { success: true };
  } catch (error) {
    console.error('Failed to clear database:', error);
    return { success: false };
  }
});

ipcMain.handle('add-tag', (event, mediaId: number, tagName: string) => {
  try {
    const name = tagName.trim().toLowerCase();
    if (!name) return { success: false, error: 'Tag name cannot be empty' };

    let tag = db.prepare('SELECT * FROM Tags WHERE name = ?').get(name) as { id: number, name: string };
    if (!tag) {
      const result = db.prepare('INSERT INTO Tags (name) VALUES (?)').run(name);
      tag = { id: result.lastInsertRowid as number, name };
    }

    try {
      db.prepare('INSERT INTO MediaTags (media_id, tag_id) VALUES (?, ?)').run(mediaId, tag.id);
    } catch (e: any) {
      if (e.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') throw e;
    }

    return { success: true, tag };
  } catch (error) {
    console.error('Failed to add tag:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('add-tag-multiple', (event, mediaIds: number[], tagName: string) => {
  try {
    const name = tagName.trim().toLowerCase();
    if (!name) return { success: false, error: 'Tag name cannot be empty' };

    let tag = db.prepare('SELECT * FROM Tags WHERE name = ?').get(name) as { id: number, name: string };
    if (!tag) {
      const result = db.prepare('INSERT INTO Tags (name) VALUES (?)').run(name);
      tag = { id: result.lastInsertRowid as number, name };
    }

    const insertStmt = db.prepare('INSERT INTO MediaTags (media_id, tag_id) VALUES (?, ?)');
    for (const mediaId of mediaIds) {
      try {
        insertStmt.run(mediaId, tag.id);
      } catch (e: any) {
        if (e.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY') throw e;
      }
    }

    return { success: true, tag };
  } catch (error) {
    console.error('Failed to bulk add tag:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('remove-tag', (event, mediaId: number, tagId: number) => {
  try {
    db.prepare('DELETE FROM MediaTags WHERE media_id = ? AND tag_id = ?').run(mediaId, tagId);
    return { success: true };
  } catch (error) {
    console.error('Failed to remove tag:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-tags', (event, mediaId: number) => {
  try {
    const tags = db.prepare(`
      SELECT Tags.id, Tags.name 
      FROM Tags 
      JOIN MediaTags ON Tags.id = MediaTags.tag_id 
      WHERE MediaTags.media_id = ?
    `).all(mediaId);
    return { success: true, tags };
  } catch (error) {
    console.error('Failed to get tags:', error);
    return { success: false, tags: [] };
  }
});

ipcMain.handle('add-directory', (event, dirPath: string) => {
  try {
    db.prepare('INSERT OR IGNORE INTO Directories (path) VALUES (?)').run(dirPath);
    if (watcher) watcher.add(dirPath);
    return { success: true };
  } catch (error) {
    console.error('Failed to add directory:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('remove-directory', (event, id: number) => {
  try {
    const dir = db.prepare('SELECT path FROM Directories WHERE id = ?').get(id) as { path: string };
    if (dir) {
      if (activeScans.has(dir.path)) {
        activeScans.get(dir.path)?.abort();
        activeScans.delete(dir.path);
        scanningDirectories.delete(dir.path);
      }
      db.prepare('DELETE FROM Media WHERE filepath LIKE ?').run(`${dir.path}%`);
      if (watcher) watcher.unwatch(dir.path);
    }
    db.prepare('DELETE FROM Directories WHERE id = ?').run(id);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-status', { scanningDirectories: Array.from(scanningDirectories) });
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to remove directory:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-directories', () => {
  try {
    const dirs = db.prepare('SELECT * FROM Directories').all();
    return { success: true, directories: dirs };
  } catch (error) {
    console.error('Failed to get directories:', error);
    return { success: false, directories: [] };
  }
});

import { shell } from 'electron';
import sharp from 'sharp';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

ipcMain.handle('reveal-in-explorer', (event, filepath: string) => {
  shell.showItemInFolder(filepath);
  return { success: true };
});

ipcMain.handle('delete-media', async (event, id: number, filepath: string) => {
  try {
    await fs.unlink(filepath).catch(() => {});
    db.prepare('DELETE FROM Media WHERE id = ?').run(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete media:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('delete-media-multiple', async (event, items: {id: number, filepath: string}[]) => {
  try {
    const deleteStmt = db.prepare('DELETE FROM Media WHERE id = ?');
    for (const item of items) {
      await fs.unlink(item.filepath).catch(() => {});
      deleteStmt.run(item.id);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to bulk delete media:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('copy-media-multiple', async (event, filepaths: string[], destination: string) => {
  try {
    for (const filepath of filepaths) {
      const destPath = path.join(destination, path.basename(filepath));
      await fs.copyFile(filepath, destPath);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to bulk copy media:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('rotate-media', async (event, id: number, filepath: string) => {
  try {
    const fileBuffer = await fs.readFile(filepath);
    const rotatedBuffer = await sharp(fileBuffer).rotate(90).toBuffer();
    await fs.writeFile(filepath, rotatedBuffer);
    
    // Also regenerate thumbnail
    const thumbPath = db.prepare('SELECT thumbnail_path FROM Media WHERE id = ?').get(id) as { thumbnail_path: string };
    if (thumbPath && thumbPath.thumbnail_path) {
      await sharp(rotatedBuffer)
        .resize({ width: 300 })
        .jpeg({ quality: 80 })
        .toFile(thumbPath.thumbnail_path)
        .catch(() => {});
    }
    // Update dimensions in DB
    const metadata = await sharp(rotatedBuffer).metadata();
    if (metadata.width && metadata.height) {
      db.prepare('UPDATE Media SET width = ?, height = ? WHERE id = ?').run(metadata.width, metadata.height, id);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to rotate media:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('set-wallpaper', async (event, filepath: string) => {
  try {
    if (process.platform === 'win32') {
      const script = `
        $path = "${filepath}"
        $code = @'
        using System.Runtime.InteropServices;
        public class Wallpaper {
          [DllImport("user32.dll", CharSet = CharSet.Auto)]
          public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
        }
'@
        Add-Type -TypeDefinition $code
        # SPI_SETDESKWALLPAPER = 0x0014
        [Wallpaper]::SystemParametersInfo(0x0014, 0, $path, 0x01 -bor 0x02)
      `;
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      await execPromise(`powershell -EncodedCommand ${encodedScript}`);
    } else if (process.platform === 'darwin') {
      await execPromise(`osascript -e 'tell application "Finder" to set desktop picture to POSIX file "${filepath}"'`);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to set wallpaper:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('share-media', async (event, filepath: string) => {
  try {
    if (process.platform === 'win32') {
      const script = `Set-Clipboard -Path "${filepath}"`;
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      await execPromise(`powershell -EncodedCommand ${encodedScript}`);
    } else if (process.platform === 'darwin') {
      await execPromise(`osascript -e 'set the clipboard to POSIX file "${filepath}"'`);
    } else {
      shell.showItemInFolder(filepath);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to copy media to clipboard:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('copy-media-clipboard-multiple', async (event, filepaths: string[]) => {
  try {
    if (process.platform === 'win32') {
      const pathsString = filepaths.map(p => `"${p}"`).join(', ');
      const script = `Set-Clipboard -Path ${pathsString}`;
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      await execPromise(`powershell -EncodedCommand ${encodedScript}`);
    } else if (process.platform === 'darwin') {
      // macOS pbcopy isn't natively great for multiple files unless we use AppleScript
      const pathsString = filepaths.map(p => `POSIX file "${p}"`).join(', ');
      await execPromise(`osascript -e 'set the clipboard to {${pathsString}}'`);
    } else {
      // Fallback
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to copy multiple media to clipboard:', error);
    return { success: false, error: String(error) };
  }
});
