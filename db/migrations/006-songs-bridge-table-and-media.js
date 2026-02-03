/**
 * Migration 006: Songs Bridge Table and Media Management
 * 
 * Implements 3NF design with bridge tables for songs that can appear on multiple albums
 * Adds media file tracking, ISRC codes, and download management
 * 
 * Key Changes:
 * - Separates albums and songs (songs can be on multiple albums)
 * - Adds album_songs bridge table
 * - Adds media_files table for audio/video file tracking
 * - Adds download_links table for order fulfillment
 * - Adds file_path, ISRC, BPM, is_explicit to songs
 */

import { getDBConnection } from '../db.js'

export async function up() {
  console.log('Running migration 006: Songs bridge table and media management...')
  
  const db = await getDBConnection()
  
  try {
    // 1. Create albums table (products with type='Album', 'Single', 'EP')
    // Note: We keep products table for all product types, albums reference it
    console.log('Creating albums reference...')
    
    // 2. Drop existing songs table and recreate with enhanced schema
    await db.exec('DROP TABLE IF EXISTS songs')
    
    await db.exec(`
      CREATE TABLE songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist_human_id INTEGER, -- Link to artists.human_id
        title TEXT NOT NULL,
        
        -- ISRC: International Standard Recording Code (optional - most songs won't have this)
        isrc TEXT UNIQUE, -- 12 characters: CC-XXX-YY-NNNNN, NULL allowed
        
        -- Duration in seconds for calculations
        duration_seconds INTEGER,
        
        -- Metadata
        bpm INTEGER, -- Beats per minute
        is_explicit INTEGER DEFAULT 0 CHECK(is_explicit IN (0, 1)),
        
        -- Genre (matches canonical GENRES list in productsController)
        genre TEXT CHECK(genre IN ('RnB', 'Soul', 'Funk', 'Jazz', 'Gospel', 'Blues', 
                                    'Disco', 'Rock', 'Pop', 'Country', 'HipHop', 'Rap',
                                    'Classical', 'Reggae', 'Electronic', 'Dance', 'World')),
        
        -- File management
        file_path TEXT, -- Relative path: media/audio/artist-name/album-name/01-song-title.mp3
        file_format TEXT CHECK(file_format IN ('mp3', 'wav', 'aiff', 'aac', 'flac', 'ogg')),
        file_size_bytes INTEGER,
        
        -- Artwork/imagery
        image_path TEXT, -- Optional cover art for single releases
        
        -- Inventory (for physical singles/vinyl)
        stock_quantity INTEGER DEFAULT 0,
        
        -- Pricing (for singles)
        individual_price REAL DEFAULT 0.99,
        
        -- Timestamps
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        
        -- Foreign key to artists table (from human-centric schema)
        FOREIGN KEY (artist_human_id) REFERENCES artists(human_id) ON DELETE SET NULL,
        
        -- Constraints
        CHECK (duration_seconds > 0 OR duration_seconds IS NULL),
        CHECK (individual_price >= 0)
      )
    `)
    console.log('✓ Created enhanced songs table')
    
    // 3. Create bridge table for many-to-many relationship
    await db.exec(`
      CREATE TABLE album_songs (
        album_id INTEGER NOT NULL, -- References products.id where type IN ('Album', 'Single', 'EP')
        song_id INTEGER NOT NULL,
        track_number INTEGER NOT NULL,
        disc_number INTEGER DEFAULT 1,
        PRIMARY KEY (album_id, song_id),
        FOREIGN KEY (album_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
        CHECK (track_number > 0),
        CHECK (disc_number > 0)
      )
    `)
    console.log('✓ Created album_songs bridge table')
    
    // 4. Create media_files table for tracking all media assets
    await db.exec(`
      CREATE TABLE media_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('song', 'video', 'artwork')),
        entity_id INTEGER NOT NULL, -- References songs.id or products.id
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL, -- mp3, mp4, jpg, etc.
        file_size_bytes INTEGER,
        mime_type TEXT,
        is_verified INTEGER DEFAULT 0 CHECK(is_verified IN (0, 1)),
        last_verified_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(entity_type, entity_id, file_path)
      )
    `)
    console.log('✓ Created media_files table')
    
    // 5. Create download_links table for order fulfillment
    await db.exec(`
      CREATE TABLE download_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        song_id INTEGER,
        product_id INTEGER, -- For album downloads
        download_token TEXT NOT NULL UNIQUE, -- UUID for secure downloads
        download_count INTEGER DEFAULT 0,
        max_downloads INTEGER DEFAULT 3,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CHECK (song_id IS NOT NULL OR product_id IS NOT NULL)
      )
    `)
    console.log('✓ Created download_links table')
    
    // 6. Create indexes for performance
    await db.exec(`
      CREATE INDEX idx_songs_artist ON songs(artist_human_id);
      CREATE INDEX idx_songs_genre ON songs(genre);
      CREATE INDEX idx_songs_isrc ON songs(isrc);
      CREATE INDEX idx_album_songs_album ON album_songs(album_id);
      CREATE INDEX idx_album_songs_song ON album_songs(song_id);
      CREATE INDEX idx_album_songs_track ON album_songs(album_id, disc_number, track_number);
      CREATE INDEX idx_media_files_entity ON media_files(entity_type, entity_id);
      CREATE INDEX idx_media_files_verified ON media_files(is_verified);
      CREATE INDEX idx_download_links_token ON download_links(download_token);
      CREATE INDEX idx_download_links_order ON download_links(order_id);
      CREATE INDEX idx_download_links_expires ON download_links(expires_at);
    `)
    console.log('✓ Created indexes')
    
    await db.close()
    console.log('✅ Migration 006 completed successfully\n')
    
  } catch (err) {
    await db.close()
    throw err
  }
}

export async function down() {
  console.log('Rolling back migration 006...')
  
  const db = await getDBConnection()
  
  try {
    // Drop indexes
    await db.exec(`
      DROP INDEX IF EXISTS idx_songs_artist;
      DROP INDEX IF EXISTS idx_songs_genre;
      DROP INDEX IF EXISTS idx_songs_isrc;
      DROP INDEX IF EXISTS idx_album_songs_album;
      DROP INDEX IF EXISTS idx_album_songs_song;
      DROP INDEX IF EXISTS idx_album_songs_track;
      DROP INDEX IF EXISTS idx_media_files_entity;
      DROP INDEX IF EXISTS idx_media_files_verified;
      DROP INDEX IF EXISTS idx_download_links_token;
      DROP INDEX IF EXISTS idx_download_links_order;
      DROP INDEX IF EXISTS idx_download_links_expires;
    `)
    
    // Drop tables in reverse order (respecting foreign keys)
    await db.exec('DROP TABLE IF EXISTS download_links')
    await db.exec('DROP TABLE IF EXISTS media_files')
    await db.exec('DROP TABLE IF EXISTS album_songs')
    await db.exec('DROP TABLE IF EXISTS songs')
    
    // Recreate basic songs table from migration 005
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
    
    await db.close()
    console.log('✅ Migration 006 rolled back\n')
    
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
