/**
 * Migration 005: Add Songs Table and Product Types
 * 
 * - Adds 'type' column to products (Album, Single, EP, Merch)
 * - Makes year and genre nullable (merch won't have these)
 * - Creates songs table for album tracks
 */

import { getDBConnection } from '../db.js'

export async function up() {
  console.log('Running migration 005: Add songs table and product types...')
  
  const db = await getDBConnection()
  
  try {
    // 1. Add type column to products (default to 'Album' for existing records)
    await db.exec(`
      ALTER TABLE products 
      ADD COLUMN type TEXT CHECK(type IN ('Album', 'Single', 'EP', 'Merch')) DEFAULT 'Album'
    `)
    console.log('✓ Added type column to products table')
    
    // 2. Create songs table
    await db.exec(`
      CREATE TABLE songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        track_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        duration_seconds INTEGER,
        individual_price REAL DEFAULT 0.99,
        artist_override TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `)
    console.log('✓ Created songs table')
    
    // 3. Create indexes for better query performance
    await db.exec(`
      CREATE INDEX idx_songs_product ON songs(product_id);
      CREATE INDEX idx_songs_track ON songs(product_id, track_number);
      CREATE INDEX idx_products_type ON products(type);
    `)
    console.log('✓ Created indexes')
    
    await db.close()
    console.log('✅ Migration 005 completed successfully\n')
    
  } catch (err) {
    await db.close()
    throw err
  }
}

export async function down() {
  console.log('Rolling back migration 005...')
  
  const db = await getDBConnection()
  
  try {
    // Drop indexes
    await db.exec(`
      DROP INDEX IF EXISTS idx_songs_product;
      DROP INDEX IF EXISTS idx_songs_track;
      DROP INDEX IF EXISTS idx_products_type;
    `)
    
    // Drop songs table
    await db.exec('DROP TABLE IF EXISTS songs')
    
    // Remove type column from products
    // Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    await db.exec(`
      CREATE TABLE products_backup AS SELECT 
        id, title, artist, price, image, year, genre, stock 
      FROM products
    `)
    await db.exec('DROP TABLE products')
    await db.exec('ALTER TABLE products_backup RENAME TO products')
    
    await db.close()
    console.log('✅ Migration 005 rolled back\n')
    
  } catch (err) {
    await db.close()
    throw err
  }
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  up().catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
}
