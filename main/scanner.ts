import * as fs from 'fs/promises';
import * as path from 'path';
import { getDb, getLibraryPath } from './db';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { app } from 'electron';
import crypto from 'crypto';
import { BrowserWindow } from 'electron';

let processedCount = 0;

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic.replace(/app\.asar/i, 'app.asar.unpacked'));
}
if (ffprobeStatic && ffprobeStatic.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path.replace(/app\.asar/i, 'app.asar.unpacked'));
}

const validExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mkv']);

async function generateImageThumbnail(filePath: string, destPath: string): Promise<{width: number, height: number}> {
  const image = sharp(filePath);
  const metadata = await image.metadata();
  await image
    .resize({ width: 300 })
    .jpeg({ quality: 80 })
    .toFile(destPath);
  return { width: metadata.width || 0, height: metadata.height || 0 };
}

function generateVideoThumbnail(filePath: string, destPath: string): Promise<{width: number, height: number, duration: number}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const width = videoStream?.width || 0;
      const height = videoStream?.height || 0;
      const duration = metadata.format.duration || 0;

      ffmpeg(filePath)
        .screenshots({
          timestamps: ['10%'],
          filename: path.basename(destPath),
          folder: path.dirname(destPath),
          size: '300x?'
        })
        .on('end', () => resolve({ width, height, duration }))
        .on('error', (err) => reject(err));
    });
  });
}

export async function processFile(fullPath: string) {
  const ext = path.extname(fullPath).toLowerCase();
  if (!validExtensions.has(ext)) return;

  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM Media WHERE filepath = ?').get(fullPath);
    if (existing) return; // Already scanned

    const stats = await fs.stat(fullPath);
    const type = ['.mp4', '.webm', '.mkv'].includes(ext) ? 'video' : 'image';
    
    const hash = crypto.createHash('md5').update(fullPath).digest('hex');
    const thumbFilename = `${hash}.jpg`;
    const thumbnailsDir = path.join(getLibraryPath(), 'thumbnails');
    const thumbPath = path.join(thumbnailsDir, thumbFilename);

    let dimensions = { width: 0, height: 0, duration: 0 };
    
    if (type === 'image') {
      const imgDims = await generateImageThumbnail(fullPath, thumbPath);
      dimensions = { ...imgDims, duration: 0 };
    } else {
      dimensions = await generateVideoThumbnail(fullPath, thumbPath);
    }

    const filename = path.basename(fullPath);
    db.prepare(`
      INSERT INTO Media (filepath, filename, type, size, thumbnail_path, width, height, duration, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fullPath, filename, type, stats.size, thumbPath, dimensions.width, dimensions.height, dimensions.duration, stats.birthtime.toISOString());
    console.log(`Indexed: ${filename}`);
  } catch (error) {
    console.error(`Failed to process ${fullPath}:`, error);
  } finally {
    processedCount++;
    if (processedCount % 50 === 0) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('library-updated');
      }
    }
  }
}

export function removeFile(fullPath: string) {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id, thumbnail_path FROM Media WHERE filepath = ?').get(fullPath) as { id: number, thumbnail_path: string } | undefined;
    if (existing) {
      db.prepare('DELETE FROM Media WHERE id = ?').run(existing.id);
      fs.unlink(existing.thumbnail_path).catch(() => {});
      console.log(`Removed: ${path.basename(fullPath)}`);
    }
  } catch (err) {
    console.error(`Failed to remove ${fullPath}:`, err);
  }
}

export function removeDirectory(dirPath: string) {
  try {
    const db = getDb();
    // Use LIKE to find all files that start with the directory path followed by a separator
    const pathPrefix = dirPath + path.sep + '%';
    const existingMedia = db.prepare('SELECT id, thumbnail_path FROM Media WHERE filepath LIKE ?').all(pathPrefix) as { id: number, thumbnail_path: string }[];
    
    if (existingMedia.length > 0) {
      db.prepare('DELETE FROM Media WHERE filepath LIKE ?').run(pathPrefix);
      for (const media of existingMedia) {
        fs.unlink(media.thumbnail_path).catch(() => {});
      }
      console.log(`Removed directory contents: ${dirPath} (${existingMedia.length} items)`);
    }
  } catch (err) {
    console.error(`Failed to remove directory ${dirPath}:`, err);
  }
}

let fileCheckCount = 0;

export async function scanDirectory(dirPath: string, signal?: AbortSignal) {
  if (signal?.aborted) return;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (signal?.aborted) return;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== '.gallery-library') {
          await scanDirectory(fullPath, signal);
        }
      } else {
        try {
          await processFile(fullPath);
        } catch (fileErr) {
          console.error(`Error processing file ${fullPath}:`, fileErr);
        }
      }
      
      fileCheckCount++;
      if (fileCheckCount % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    console.error(`Error scanning ${dirPath}:`, err);
  }
}
