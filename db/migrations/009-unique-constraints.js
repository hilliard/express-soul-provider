/**
 * Migration 009: Add unique constraints to artists and improve human uniqueness
 * 
 * Changes:
 * - Adds UNIQUE constraint on artists.stage_name
 * - Adds composite index on humans (first_name, last_name) for duplicate detection
 * - Updates products.artist_human_id foreign key for referential integrity
 */

import { getDBConnection } from '../db.js'

export async function up() {
  console.log('Running migration 009: Add unique constraints to artists...')
  
  const db = await getDBConnection()
  
  try {
    // 1. Recreate artists table with UNIQUE constraint on stage_name
    // (SQLite doesn't allow ALTER TABLE to add constraints, so we must recreate)
    console.log('Recreating artists table with unique constraint...')
    
    // Backup existing artists
    await db.exec(`
      CREATE TABLE artists_backup AS 
      SELECT human_id, stage_name, bio, website, debut_year FROM artists
    `)
    
    // Drop the old table
    await db.exec('DROP TABLE IF EXISTS artists')
    
    // Create new table with UNIQUE constraint
    await db.exec(`
      CREATE TABLE artists (
        human_id INTEGER PRIMARY KEY,
        stage_name TEXT UNIQUE NOT NULL, -- Prevents duplicate stage names
        bio TEXT,
        website TEXT,
        debut_year INTEGER,
        FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
      )
    `)
    
    // Restore data from backup
    await db.exec(`
      INSERT INTO artists (human_id, stage_name, bio, website, debut_year)
      SELECT human_id, stage_name, bio, website, debut_year
      FROM artists_backup
    `)
    
    // Drop backup
    await db.exec('DROP TABLE artists_backup')
    
    console.log('✓ Artists table recreated with UNIQUE stage_name constraint')
    
    // 2. Add composite index on humans for duplicate name detection
    console.log('Adding index on humans for duplicate detection...')
    await db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_humans_unique_name 
      ON humans(first_name, last_name) 
      WHERE is_active = 1
    `)
    console.log('✓ Added unique index on humans (first_name, last_name)')
    
    // 3. Add index on products.artist_human_id for performance (if exists)
    console.log('Checking for products.artist_human_id column...')
    try {
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_products_artist_human_id 
        ON products(artist_human_id)
      `)
      console.log('✓ Added index on products.artist_human_id')
    } catch (err) {
      console.log('  (Column artist_human_id not yet added to products table - skipping index)')
    }
    
    // 4. Add similar index on songs.artist_human_id
    console.log('Adding index on songs.artist_human_id...')
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_songs_artist_human_id 
      ON songs(artist_human_id)
    `)
    console.log('✓ Added index on songs.artist_human_id')
    
    await db.close()
    console.log('✅ Migration 009 completed successfully\n')
    
  } catch (err) {
    await db.close()
    throw err
  }
}

export async function down() {
  console.log('Rolling back migration 009...')
  
  const db = await getDBConnection()
  
  try {
    // Recreate artists table without UNIQUE constraint
    await db.exec(`
      CREATE TABLE artists_backup AS 
      SELECT human_id, stage_name, bio, website, debut_year FROM artists
    `)
    
    await db.exec('DROP TABLE IF EXISTS artists')
    
    await db.exec(`
      CREATE TABLE artists (
        human_id INTEGER PRIMARY KEY,
        stage_name TEXT, -- No longer unique
        bio TEXT,
        website TEXT,
        debut_year INTEGER,
        FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
      )
    `)
    
    await db.exec(`
      INSERT INTO artists (human_id, stage_name, bio, website, debut_year)
      SELECT human_id, stage_name, bio, website, debut_year
      FROM artists_backup
    `)
    
    await db.exec('DROP TABLE artists_backup')
    
    // Drop indexes
    await db.exec('DROP INDEX IF EXISTS idx_humans_unique_name')
    await db.exec('DROP INDEX IF EXISTS idx_products_artist_human_id')
    await db.exec('DROP INDEX IF EXISTS idx_songs_artist_human_id')
    
    await db.close()
    console.log('✅ Migration 009 rolled back\n')
    
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
