# Utilities

Administrative and maintenance scripts for Soul Provider.

## Ruby Scripts

### Prerequisites

```bash
gem install sqlite3
```

## verify_media_files.rb

Verifies that all song file paths in the database point to existing files.

**Usage:**

```bash
# Basic verification
ruby utils/verify_media_files.rb

# Verbose output
ruby utils/verify_media_files.rb --verbose

# Attempt automatic fixes
ruby utils/verify_media_files.rb --fix

# Both verbose and fix
ruby utils/verify_media_files.rb --fix --verbose
```

**Features:**

- ✓ Checks all songs in the database for valid file paths
- ✓ Identifies missing files
- ✓ Finds orphaned files (files on disk not in database)
- ✓ Can auto-fix missing files by searching for them
- ✓ Updates verification timestamps in media_files table
- ✓ Returns exit code 1 if issues found (useful for CI/CD)

**Output:**

- Valid files: Files found at expected paths
- Missing files: Database references but file doesn't exist
- Null paths: Songs without file_path set
- Orphaned files: Files on disk not referenced in database

## organize_music_files.rb

Organizes audio files into structured folder hierarchy: `Artist-Name/Album-Name/songs`

**Usage:**

```bash
# Dry run (preview changes)
ruby utils/organize_music_files.rb --dry-run

# Execute organization
ruby utils/organize_music_files.rb

# Specify custom source directory
ruby utils/organize_music_files.rb --source-dir=path/to/files
```

**Folder Structure Created:**

```
public/media/music_files/
├── Marvin-Gaye/
│   ├── Whats-Going-On/
│   │   ├── 01-whats-going-on.mp3
│   │   ├── 02-whats-happening-brother.mp3
│   │   └── ...
│   └── Lets-Get-It-On/
│       └── ...
├── Stevie-Wonder/
│   └── Songs-In-The-Key-Of-Life/
│       ├── 01-love-s-in-need-of-love-today.mp3
│       └── ...
└── Singles/
    └── standalone-track.mp3
```

**Features:**

- ✓ Organizes by Artist → Album → Tracks
- ✓ Standalone songs (not on any album) go to `Singles/` folder
- ✓ Prefixes filenames with track numbers (01-, 02-, etc.)
- ✓ Updates database with new file paths
- ✓ Sanitizes folder and file names
- ✓ Dry-run mode for safety

**How it Works:**

1. Queries database for all albums with songs (via bridge table)
2. Creates folder structure: `music_files/Artist/Album/`
3. Moves files and updates database paths
4. Finds standalone songs using `NOT EXISTS` query (3NF efficient)
5. Places orphaned songs in `Singles/` directory

## Common Workflows

### After Uploading New Music Files

```bash
# 1. Verify all files are accessible
ruby utils/verify_media_files.rb --verbose

# 2. Organize into proper structure
ruby utils/organize_music_files.rb --dry-run
ruby utils/organize_music_files.rb

# 3. Re-verify after organization
ruby utils/verify_media_files.rb
```

### Before Deploying

```bash
# Ensure no missing files
ruby utils/verify_media_files.rb
if [ $? -ne 0 ]; then
  echo "❌ Media verification failed!"
  exit 1
fi
```

### Troubleshooting Missing Files

```bash
# Find and attempt to fix missing files
ruby utils/verify_media_files.rb --fix --verbose

# Check for orphaned files not in database
ruby utils/verify_media_files.rb | grep "Orphaned"
```

## Database Queries

### Find Standalone Songs (3NF Approach)

Using `NOT EXISTS` (most efficient in 2026):

```sql
SELECT song_id, title
FROM songs s
WHERE NOT EXISTS (
    SELECT 1
    FROM album_songs asong
    WHERE asong.song_id = s.song_id
);
```

Alternative using `LEFT JOIN`:

```sql
SELECT s.song_id, s.title
FROM songs s
LEFT JOIN album_songs asong ON s.song_id = asong.song_id
WHERE asong.song_id IS NULL;
```

### Songs on Multiple Albums

```sql
SELECT
    s.title,
    COUNT(DISTINCT asong.album_id) as album_count,
    GROUP_CONCAT(p.title, ', ') as albums
FROM songs s
INNER JOIN album_songs asong ON s.id = asong.song_id
INNER JOIN products p ON asong.album_id = p.id
GROUP BY s.id
HAVING album_count > 1;
```

## Notes

- Scripts are idempotent - safe to run multiple times
- Always test with `--dry-run` first
- Database is automatically backed up before migrations
- File paths are always relative to `public/` directory
- ISRC codes must be unique across all songs
