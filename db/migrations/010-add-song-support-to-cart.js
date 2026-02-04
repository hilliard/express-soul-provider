/**
 * Migration 010: Add Song Support to Cart
 * 
 * Allows individual songs to be added to cart alongside products
 * - Add song_id column to cart_items
 * - Make product_id nullable
 * - Add constraint that either product_id or song_id must be set
 */

import { getDBConnection } from '../db.js'

export async function up() {
  console.log('Running migration 010: Add song support to cart...')
  
  const db = await getDBConnection()
  
  try {
    // 1. Rename old cart_items table
    await db.exec('ALTER TABLE cart_items RENAME TO cart_items_old')
    console.log('✓ Renamed old cart_items table')
    
    // 2. Create new cart_items table with song_id support
    await db.exec(`
      CREATE TABLE cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        human_id INTEGER NOT NULL,
        product_id INTEGER,
        song_id INTEGER,
        quantity INTEGER NOT NULL DEFAULT 1,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (human_id) REFERENCES customers(human_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
        CHECK (product_id IS NOT NULL OR song_id IS NOT NULL),
        UNIQUE (human_id, product_id, song_id)
      )
    `)
    console.log('✓ Created new cart_items table with song support')
    
    // 3. Copy data from old table
    await db.exec(`
      INSERT INTO cart_items (id, human_id, product_id, quantity, added_at)
      SELECT id, human_id, product_id, quantity, added_at
      FROM cart_items_old
    `)
    console.log('✓ Migrated cart data')
    
    // 4. Drop old table
    await db.exec('DROP TABLE cart_items_old')
    console.log('✓ Dropped old cart_items table')
    
    // 5. Create indexes for performance
    await db.exec(`
      CREATE INDEX idx_cart_human ON cart_items(human_id);
      CREATE INDEX idx_cart_product ON cart_items(product_id);
      CREATE INDEX idx_cart_song ON cart_items(song_id);
    `)
    console.log('✓ Created indexes')
    
    await db.close()
    console.log('✅ Migration 010 completed successfully\n')
    
  } catch (err) {
    await db.close()
    throw err
  }
}

export async function down() {
  console.log('Rolling back migration 010...')
  
  const db = await getDBConnection()
  
  try {
    // Rename new table
    await db.exec('ALTER TABLE cart_items RENAME TO cart_items_new')
    
    // Recreate old table
    await db.exec(`
      CREATE TABLE cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        human_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (human_id) REFERENCES customers(human_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `)
    
    // Copy back data (only products)
    await db.exec(`
      INSERT INTO cart_items (id, human_id, product_id, quantity, added_at)
      SELECT id, human_id, product_id, quantity, added_at
      FROM cart_items_new
      WHERE song_id IS NULL
    `)
    
    // Drop new table
    await db.exec('DROP TABLE cart_items_new')
    
    await db.close()
    console.log('✅ Migration 010 rolled back\n')
    
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
