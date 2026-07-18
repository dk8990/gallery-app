import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

// Store DB in the user data folder so it persists across updates
const dbPath = path.join(app.getPath('userData'), 'gallery.db');

export function initDB() {
  const db = new Database(dbPath);
  
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS Media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filepath TEXT UNIQUE NOT NULL,
      filename TEXT NOT NULL,
      type TEXT NOT NULL, -- 'image' or 'video'
      size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      thumbnail_path TEXT,
      width INTEGER,
      height INTEGER,
      duration REAL
    );

    CREATE TABLE IF NOT EXISTS Tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS MediaTags (
      media_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (media_id, tag_id),
      FOREIGN KEY(media_id) REFERENCES Media(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES Tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Directories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL
    );
  `);

  try {
    db.exec(`ALTER TABLE Media ADD COLUMN width INTEGER;`);
  } catch (e: any) {
    // Ignore duplicate column errors
  }
  
  try {
    db.exec(`ALTER TABLE Media ADD COLUMN height INTEGER;`);
  } catch (e: any) {
    // Ignore duplicate column errors
  }

  try {
    db.exec(`ALTER TABLE Media ADD COLUMN duration REAL;`);
  } catch (e: any) {
    // Ignore duplicate column errors
  }

  return db;
}

export const db = initDB();
