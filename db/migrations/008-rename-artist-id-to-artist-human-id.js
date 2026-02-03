/**
 * Migration 008: Rename artist_id to artist_human_id
 * 
 * Updates column names in songs and order_items tables to use
 * consistent human-centric naming (artist_id -> artist_human_id)
 */

import { getDBConnection } from '../db.js'

export async function up() {
  console.log('Running migration 008: Rename artist_id to artist_human_id...')
  
  const db = await getDBConnection()
  
  try {
    // 1. Rename artist_id to artist_human_id in songs table
    await db.exec(`
      ALTER TABLE songs RENAME COLUMN artist_id TO artist_human_id
    `)
    console.log('✓ Renamed artist_id to artist_human_id in songs table')
    
    // 2. Rename artist_id to artist_human_id in order_items table
    await db.exec(`
      ALTER TABLE order_items RENAME COLUMN artist_id TO artist_human_id
    `)
    console.log('✓ Renamed artist_id to artist_human_id in order_items table')
    
    // 3. Update indexes if needed
    await db.exec(`
      DROP INDEX IF EXISTS idx_songs_artist;
      CREATE INDEX idx_songs_artist ON songs(artist_human_id);
    `)
    console.log('✓ Updated index on songs table')
    
    await db.exec(`
      DROP INDEX IF EXISTS idx_order_items_artist;
      CREATE INDEX idx_order_items_artist ON order_items(artist_human_id);
    `)
    console.log('✓ Updated index on order_items table')
    
    await db.close()
    console.log('✅ Migration 008 completed successfully\n')
    
  } catch (err) {
    await db.close()
    throw err
  }
}

export async function down() {
  console.log('Rolling back migration 008...')
  
  const db = await getDBConnection()
  
  try {
    // 1. Rename artist_human_id back to artist_id in songs table
    await db.exec(`
      ALTER TABLE songs RENAME COLUMN artist_human_id TO artist_id
    `)
    
    // 2. Rename artist_human_id back to artist_id in order_items table
    await db.exec(`
      ALTER TABLE order_items RENAME COLUMN artist_human_id TO artist_id
    `)
    
    // 3. Restore indexes
    await db.exec(`
      DROP INDEX IF EXISTS idx_songs_artist;
      CREATE INDEX idx_songs_artist ON songs(artist_id);
    `)
    
    await db.exec(`
      DROP INDEX IF EXISTS idx_order_items_artist;
      CREATE INDEX idx_order_items_artist ON order_items(artist_id);
    `)
    
    await db.close()
    console.log('✅ Migration 008 rolled back\n')
    
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
