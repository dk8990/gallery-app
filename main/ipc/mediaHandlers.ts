import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { db } from '../db';
import type { FSWatcher } from 'chokidar';

export function registerMediaHandlers(
  mainWindow: () => BrowserWindow | null, 
  watcher: () => FSWatcher | null,
  activeScans: Map<string, AbortController>,
  scanningDirectories: Set<string>
) {
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
      const mw = mainWindow();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send('scan-status', { scanningDirectories: [] });
      }
  
      const dirs = db.prepare('SELECT path FROM Directories').all() as { path: string }[];
      dirs.forEach(d => {
        const w = watcher();
        if (w) w.unwatch(d.path);
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
      const w = watcher();
      if (w) w.add(dirPath);
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
        const w = watcher();
        if (w) w.unwatch(dir.path);
      }
      db.prepare('DELETE FROM Directories WHERE id = ?').run(id);
  
      const mw = mainWindow();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send('scan-status', { scanningDirectories: Array.from(scanningDirectories) });
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
}
