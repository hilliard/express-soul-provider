# Media Management & Bridge Table Design

## Overview

Soul Provider uses a **3rd Normal Form (3NF)** database design with bridge tables to handle the complex relationship where songs can appear on multiple albums (original releases, compilations, "Best Of" collections, soundtracks, etc.).

## Architecture Decisions

### Why Bridge Tables?

**The Problem:**

- A song like "What's Going On" might appear on:
  - Original album: "What's Going On" (1971)
  - Compilation: "Marvin Gaye's Greatest Hits" (1976)
  - Soundtrack: "The Big Chill" (1983)

**Traditional Approach (Denormalized):**

- Store duplicate song records for each album
- ❌ Wastes storage
- ❌ Creates data inconsistencies
- ❌ Makes updates difficult

**Bridge Table Approach (3NF):**

- Single song record
- `album_songs` table links songs to multiple albums
- ✅ No data duplication
- ✅ Single source of truth
- ✅ Easy to update metadata

## Database Schema

### Core Tables

#### songs

```sql
CREATE TABLE songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_human_id INTEGER,            -- FK to artists.human_id
    title TEXT NOT NULL,
    isrc TEXT UNIQUE,                   -- International Standard Recording Code
    duration_seconds INTEGER,
    bpm INTEGER,                        -- Beats per minute
    is_explicit INTEGER DEFAULT 0,
    genre TEXT,
    file_path TEXT,                     -- media/audio/artist/album/01-song.mp3
    file_format TEXT,                   -- mp3, wav, aiff, aac, flac, ogg
    file_size_bytes INTEGER,
    individual_price REAL DEFAULT 0.99,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_human_id) REFERENCES artists(human_id)
)
```

#### album_songs (Bridge Table)

```sql
CREATE TABLE album_songs (
    album_id INTEGER NOT NULL,          -- FK to products.id
    song_id INTEGER NOT NULL,           -- FK to songs.id
    track_number INTEGER NOT NULL,
    disc_number INTEGER DEFAULT 1,
    PRIMARY KEY (album_id, song_id),    -- Composite key prevents duplicates
    FOREIGN KEY (album_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
)
```

#### media_files (File Tracking)

```sql
CREATE TABLE media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,          -- 'song', 'video', 'artwork'
    entity_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes INTEGER,
    mime_type TEXT,
    is_verified INTEGER DEFAULT 0,
    last_verified_at TEXT,
    UNIQUE(entity_type, entity_id, file_path)
)
```

#### download_links (Order Fulfillment)

```sql
CREATE TABLE download_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    song_id INTEGER,                    -- For individual song downloads
    product_id INTEGER,                 -- For album downloads
    download_token TEXT NOT NULL UNIQUE,
    download_count INTEGER DEFAULT 0,
    max_downloads INTEGER DEFAULT 3,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (song_id) REFERENCES songs(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
)
```

## File Organization

### Directory Structure

```
public/
├── media/
│   ├── audio/                          # Unorganized uploads
│   │   ├── temp-upload-1.mp3
│   │   └── temp-upload-2.mp3
│   ├── music_files/                    # Organized structure (post-processing)
│   │   ├── Marvin-Gaye/
│   │   │   ├── Whats-Going-On/
│   │   │   │   ├── 01-whats-going-on.mp3
│   │   │   │   ├── 02-whats-happening-brother.mp3
│   │   │   │   └── ...
│   │   │   └── Lets-Get-It-On/
│   │   │       └── ...
│   │   ├── Stevie-Wonder/
│   │   │   └── Songs-In-The-Key-Of-Life/
│   │   │       └── ...
│   │   └── Singles/                    # Standalone tracks
│   │       └── unreleased-demo.mp3
│   └── video/                          # Future: Music videos
│       └── artist/album/video.mp4
└── images/                             # Album artwork
    └── ...
```

### File Path Convention

**In Database:**

```
media/music_files/Artist-Name/Album-Name/01-song-title.mp3
```

**Naming Rules:**

- Artist/Album names: Sanitized (alphanumeric, hyphens only)
- Song files: Track number prefix (01-, 02-, etc.)
- Lowercase, hyphenated
- No special characters

## Common Queries

### 1. Get All Songs for an Album (with track order)

```sql
SELECT
    s.id,
    s.title,
    s.duration_seconds,
    s.file_path,
    asong.track_number,
    asong.disc_number
FROM songs s
INNER JOIN album_songs asong ON s.id = asong.song_id
WHERE asong.album_id = ?
ORDER BY asong.disc_number, asong.track_number;
```

### 2. Find Standalone Songs (NOT on any album)

**Using NOT EXISTS (Most Efficient):**

```sql
SELECT song_id, title, file_path
FROM songs s
WHERE NOT EXISTS (
    SELECT 1
    FROM album_songs asong
    WHERE asong.song_id = s.song_id
);
```

**Using LEFT JOIN:**

```sql
SELECT s.song_id, s.title, s.file_path
FROM songs s
LEFT JOIN album_songs asong ON s.song_id = asong.song_id
WHERE asong.song_id IS NULL;
```

### 3. Find Songs on Multiple Albums

```sql
SELECT
    s.title,
    s.artist_human_id,
    COUNT(DISTINCT asong.album_id) as album_count,
    GROUP_CONCAT(p.title, ' | ') as albums
FROM songs s
INNER JOIN album_songs asong ON s.id = asong.song_id
INNER JOIN products p ON asong.album_id = p.id
GROUP BY s.id
HAVING album_count > 1
ORDER BY album_count DESC;
```

### 4. Get Download Links for Completed Order

```sql
SELECT
    s.title,
    s.file_path,
    dl.download_token,
    dl.download_count,
    dl.max_downloads,
    dl.expires_at
FROM download_links dl
INNER JOIN songs s ON dl.song_id = s.id
WHERE dl.order_id = ?
AND dl.expires_at > datetime('now');
```

### 5. Verify All Files Exist

```sql
-- Songs with missing files
SELECT
    s.id,
    s.title,
    s.file_path
FROM songs s
WHERE s.file_path IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM media_files mf
    WHERE mf.entity_type = 'song'
    AND mf.entity_id = s.id
    AND mf.is_verified = 1
);
```

## Maintenance Workflows

### 1. After Uploading New Audio Files

```bash
# 1. Verify files are accessible
ruby utils/verify_media_files.rb --verbose

# 2. Organize into Artist/Album structure
ruby utils/organize_music_files.rb --dry-run  # Preview
ruby utils/organize_music_files.rb            # Execute

# 3. Re-verify
ruby utils/verify_media_files.rb
```

### 2. Before Order Fulfillment

```javascript
// Generate download links for all songs in order
async function createDownloadLinks(orderId, productIds) {
  const db = await getDBConnection();

  for (const productId of productIds) {
    // Get all songs for this product
    const songs = await db.all(
      `SELECT song_id FROM album_songs WHERE album_id = ?`,
      [productId],
    );

    // Create download link for each song
    for (const song of songs) {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.run(
        `INSERT INTO download_links 
         (order_id, song_id, download_token, expires_at) 
         VALUES (?, ?, ?, ?)`,
        [orderId, song.song_id, token, expiresAt.toISOString()],
      );
    }
  }

  await db.close();
}
```

### 3. Cleanup Expired Downloads

```sql
-- Delete expired download links
DELETE FROM download_links
WHERE expires_at < datetime('now');

-- Or mark as expired
UPDATE download_links
SET download_count = max_downloads
WHERE expires_at < datetime('now');
```

## File Storage vs. Database BLOBs

### Why File Paths Instead of BLOBs?

**Advantages:**

- ✅ CDN-friendly (serve static files efficiently)
- ✅ Easier backups (standard file system tools)
- ✅ Streaming support (partial content, range requests)
- ✅ Database stays small and fast
- ✅ Direct file access for processing

**Disadvantages:**

- ⚠️ Files can be deleted/moved (requires verification)
- ⚠️ Two systems to maintain (DB + filesystem)

**Mitigation:**

- Regular file verification (`verify_media_files.rb`)
- Backup strategy for both DB and files
- Media files table tracks verification status

## Migration Strategy

### Running the Migration

```bash
# Check migration status
node db/migrate.js status

# Run migration 006
node db/migrate.js up

# Rollback if needed
node db/migrate.js down
```

### Data Migration Steps

1. **Existing songs table** has `product_id` (one-to-many)
2. **New schema** uses bridge table (many-to-many)
3. **Migration creates:**
   - New enhanced songs table
   - album_songs bridge table
   - Copies existing data: `product_id` → `album_id` in bridge

```javascript
// Example migration data copy
const existingSongs = await db.all('SELECT * FROM songs_old')
for (const song of existingSongs) {
  // Insert song
  const result = await db.run(
    'INSERT INTO songs (title, file_path, ...) VALUES (?, ?, ...)',
    [song.title, song.file_path, ...]
  )

  // Create bridge entry
  await db.run(
    'INSERT INTO album_songs (album_id, song_id, track_number) VALUES (?, ?, ?)',
    [song.product_id, result.lastID, song.track_number]
  )
}
```

## Future Enhancements

### Streaming Support

```javascript
// controllers/streamController.js
export async function streamSong(req, res) {
  const { songId } = req.params;
  const db = await getDBConnection();

  const song = await db.get("SELECT file_path FROM songs WHERE id = ?", [
    songId,
  ]);
  const filePath = path.join("public", song.file_path);

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  if (range) {
    // Partial content for seeking
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Content-Length": end - start + 1,
      "Content-Type": "audio/mpeg",
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": "audio/mpeg",
    });
    fs.createReadStream(filePath).pipe(res);
  }

  await db.close();
}
```

### Video Support

```sql
-- Already supported in media_files table
INSERT INTO media_files (entity_type, entity_id, file_path, file_type)
VALUES ('video', song_id, 'media/video/artist/album/music-video.mp4', 'mp4');
```

## Security Considerations

1. **Download Tokens:** UUIDs prevent guessing
2. **Expiration:** Links expire after 30 days
3. **Download Limits:** Max 3 downloads per purchase
4. **File Access:** Never expose direct file paths to frontend
5. **Verification:** Regular file integrity checks

## Performance Optimization

### Indexes

```sql
CREATE INDEX idx_album_songs_album ON album_songs(album_id);
CREATE INDEX idx_album_songs_song ON album_songs(song_id);
CREATE INDEX idx_download_links_token ON download_links(download_token);
CREATE INDEX idx_media_files_verified ON media_files(is_verified);
```

### Query Efficiency

- Use `NOT EXISTS` instead of `LEFT JOIN` for standalone songs
- Composite primary key on bridge table prevents duplicates
- Foreign keys with CASCADE for automatic cleanup
