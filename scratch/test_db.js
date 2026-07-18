const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');

app.name = 'gallery'; // Set app name to get correct userData path

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'gallery.db');
  console.log('DB Path:', dbPath);
  try {
    const db = new Database(dbPath, { readonly: true });
    
    // Check total items
    const total = db.prepare('SELECT COUNT(*) as c FROM Media').get().c;
    console.log('Total Media:', total);
    
    if (total > 0) {
      const sample = db.prepare('SELECT filename FROM Media LIMIT 1').get();
      console.log('Sample filename:', sample.filename);
      
      const q = `%dog%`;
      const query = `
          SELECT DISTINCT Media.* 
          FROM Media 
          LEFT JOIN MediaTags ON Media.id = MediaTags.media_id
          LEFT JOIN Tags ON MediaTags.tag_id = Tags.id
          WHERE Media.filename LIKE ? OR Tags.name LIKE ?
          ORDER BY Media.id DESC LIMIT ? OFFSET ?
        `;
      console.log('Result for %dog%:', db.prepare(query).all(q, q, 10, 0).length);
      
      const q2 = `%%`;
      console.log('Result for %%:', db.prepare(query).all(q2, q2, 10, 0).length);
    }
  } catch (err) {
    console.error(err);
  }
  app.quit();
});
