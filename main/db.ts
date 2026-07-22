import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

let _db: Database.Database | null = null;
let currentLibraryPath: string | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    throw new Error('Database not initialized. Call initDB(libraryPath) first.');
  }
  return _db;
}

export function getLibraryPath(): string {
  if (!currentLibraryPath) {
    throw new Error('Library path not set.');
  }
  return currentLibraryPath;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
    currentLibraryPath = null;
  }
}

/**
 * Validates a library folder. Creates standard subdirectories if it doesn't exist.
 */
function ensureLibraryStructure(libraryPath: string) {
  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
  }
  
  const thumbnailsDir = path.join(libraryPath, 'thumbnails');
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }
}

export function initDB(libraryPath: string) {
  if (_db) {
    _db.close();
  }

  currentLibraryPath = libraryPath;
  ensureLibraryStructure(libraryPath);

  const dbPath = path.join(libraryPath, 'gallery.db');
  _db = new Database(dbPath);
  
  _db.pragma('journal_mode = WAL');

  // Create tables
  _db.exec(`
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
    _db.exec(`ALTER TABLE Media ADD COLUMN width INTEGER;`);
  } catch (e: any) {
    // Ignore duplicate column errors
  }
  try {
    _db.exec(`ALTER TABLE Media ADD COLUMN height INTEGER;`);
  } catch (e: any) {
    // Ignore duplicate column errors
  }
  try {
    _db.exec(`ALTER TABLE Media ADD COLUMN duration REAL;`);
  } catch (e: any) {
    // Ignore duplicate column errors
  }
  
  autoRemapDriveLetters(libraryPath);
}

/**
 * Checks if tracked directories exist. If not, attempts to remap them
 * assuming the drive letter has changed to match the library's current drive letter.
 */
function autoRemapDriveLetters(libraryPath: string) {
  const db = getDb();
  const libDrive = path.parse(libraryPath).root;
  
  const dirs = db.prepare('SELECT id, path FROM Directories').all() as { id: number, path: string }[];
  
  const updateDirStmt = db.prepare('UPDATE Directories SET path = ? WHERE id = ?');
  const updateMediaStmt = db.prepare('UPDATE Media SET filepath = ? WHERE filepath LIKE ?');

  db.transaction(() => {
    for (const dir of dirs) {
      if (!fs.existsSync(dir.path)) {
        // Directory is missing, try remapping the drive letter
        const originalDrive = path.parse(dir.path).root;
        const relativePath = dir.path.substring(originalDrive.length);
        const newPath = path.join(libDrive, relativePath);
        
        if (fs.existsSync(newPath)) {
          console.log(`Auto-remapped drive letter: ${dir.path} -> ${newPath}`);
          updateDirStmt.run(newPath, dir.id);
          
          // Also update all media files starting with this directory path
          // SQLite LIKE is case-insensitive by default. We replace the prefix.
          const mediaRows = db.prepare('SELECT id, filepath FROM Media WHERE filepath LIKE ?').all(dir.path + '%') as {id: number, filepath: string}[];
          const updateSingleMedia = db.prepare('UPDATE Media SET filepath = ? WHERE id = ?');
          
          for (const m of mediaRows) {
            // Replace the original root prefix with the new one
            const newMediaPath = path.join(libDrive, m.filepath.substring(originalDrive.length));
            updateSingleMedia.run(newMediaPath, m.id);
          }
        }
      }
    }
  })();
}
