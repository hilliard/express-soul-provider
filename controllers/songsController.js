import { getDBConnection } from '../db/db.js'

/**
 * Get all songs with optional filters
 * Query params:
 *   - albumId: Filter by album ID
 *   - orphaned: Set to "true" to show only songs not on any album
 *   - search: Search by song title
 */
export async function getSongs(req, res) {
  const db = await getDBConnection()
  try {
    const { albumId, orphaned, search, genre } = req.query

    let query = `
      SELECT 
        s.id,
        s.title,
        s.duration_seconds,
        s.individual_price,
        s.is_explicit,
        s.genre,
        s.artist_human_id,
        a.stage_name as artist_stage_name,
        h.first_name || ' ' || h.last_name as artist_full_name,
        GROUP_CONCAT(p.id) as album_ids,
        GROUP_CONCAT(p.title) as album_titles,
        GROUP_CONCAT(asong.track_number) as track_numbers
      FROM songs s
      LEFT JOIN artists a ON s.artist_human_id = a.human_id
      LEFT JOIN humans h ON s.artist_human_id = h.id
      LEFT JOIN album_songs asong ON s.id = asong.song_id
      LEFT JOIN products p ON asong.album_id = p.id
    `

    let params = []
    let where = []

    if (albumId) {
      where.push('asong.album_id = ?')
      params.push(parseInt(albumId, 10))
    }

    if (orphaned === 'true') {
      where.push('asong.song_id IS NULL')
    }

    if (search) {
      where.push('s.title LIKE ?')
      params.push(`%${search}%`)
    }

    if (genre) {
      where.push('s.genre = ?')
      params.push(genre)
    }

    if (where.length > 0) {
      query += ' WHERE ' + where.join(' AND ')
    }

    query += ' GROUP BY s.id ORDER BY s.title'

    const songs = await db.all(query, params)

    // Parse the grouped data
    const formattedSongs = songs.map(song => ({
      ...song,
      albums: song.album_ids
        ? song.album_ids.split(',').map((id, idx) => ({
            id: parseInt(id),
            title: song.album_titles.split(',')[idx],
            trackNumber: parseInt(song.track_numbers.split(',')[idx])
          }))
        : []
    }))

    res.json(formattedSongs)

  } catch (err) {
    console.error('Error fetching songs:', err.message)
    res.status(500).json({ error: 'Failed to fetch songs' })
  } finally {
    await db.close()
  }
}

/**
 * Get single song
 */
export async function getSong(req, res) {
  const songId = parseInt(req.params.id, 10)

  if (isNaN(songId)) {
    return res.status(400).json({ error: 'Invalid song ID' })
  }

  const db = await getDBConnection()
  try {
    const song = await db.get(
      `SELECT 
        s.*,
        a.stage_name as artist_stage_name,
        h.first_name || ' ' || h.last_name as artist_full_name
      FROM songs s
      LEFT JOIN artists a ON s.artist_human_id = a.human_id
      LEFT JOIN humans h ON s.artist_human_id = h.id
      WHERE s.id = ?`,
      [songId]
    )

    if (!song) {
      return res.status(404).json({ error: 'Song not found' })
    }

    // Get albums this song appears on
    const albums = await db.all(
      `SELECT p.id, p.title, asong.track_number, asong.disc_number
       FROM album_songs asong
       JOIN products p ON asong.album_id = p.id
       WHERE asong.song_id = ?
       ORDER BY asong.track_number`,
      [songId]
    )

    song.albums = albums

    res.json(song)

  } catch (err) {
    console.error('Error fetching song:', err.message)
    res.status(500).json({ error: 'Failed to fetch song' })
  } finally {
    await db.close()
  }
}

/**
 * Create new song
 */
export async function createSong(req, res) {
  let { title, duration_seconds, individual_price, artist_human_id, genre, is_explicit } = req.body

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' })
  }

  title = title.trim()

  const db = await getDBConnection()
  try {
    // Validate artist_human_id if provided
    if (artist_human_id) {
      const artist = await db.get('SELECT id FROM artists WHERE human_id = ?', [artist_human_id])
      if (!artist) {
        return res.status(400).json({ error: 'Invalid artist ID' })
      }
    }

    const result = await db.run(
      `INSERT INTO songs (title, duration_seconds, individual_price, artist_human_id, genre, is_explicit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title,
        duration_seconds || null,
        individual_price || 0.99,
        artist_human_id || null,
        genre || null,
        is_explicit || 0
      ]
    )

    res.status(201).json({
      message: 'Song created successfully',
      id: result.lastID
    })

  } catch (err) {
    console.error('Error creating song:', err.message)
    res.status(500).json({ error: 'Failed to create song', details: err.message })
  } finally {
    await db.close()
  }
}

/**
 * Update song
 */
export async function updateSong(req, res) {
  const songId = parseInt(req.params.id, 10)

  if (isNaN(songId)) {
    return res.status(400).json({ error: 'Invalid song ID' })
  }

  let { title, duration_seconds, individual_price, artist_human_id, genre, is_explicit } = req.body

  if (title) {
    title = title.trim()
  }

  try {
    const db = await getDBConnection()

    // Check if song exists
    const song = await db.get('SELECT id FROM songs WHERE id = ?', [songId])
    if (!song) {
      return res.status(404).json({ error: 'Song not found' })
    }

    // Validate artist_human_id if provided
    if (artist_human_id) {
      const artist = await db.get('SELECT id FROM artists WHERE human_id = ?', [artist_human_id])
      if (!artist) {
        return res.status(400).json({ error: 'Invalid artist ID' })
      }
    }

    // Build dynamic update query
    const updates = []
    const params = []

    if (title !== undefined) {
      updates.push('title = ?')
      params.push(title)
    }
    if (duration_seconds !== undefined) {
      updates.push('duration_seconds = ?')
      params.push(duration_seconds)
    }
    if (individual_price !== undefined) {
      updates.push('individual_price = ?')
      params.push(individual_price)
    }
    if (artist_human_id !== undefined) {
      updates.push('artist_human_id = ?')
      params.push(artist_human_id)
    }
    if (genre !== undefined) {
      updates.push('genre = ?')
      params.push(genre)
    }
    if (is_explicit !== undefined) {
      updates.push('is_explicit = ?')
      params.push(is_explicit ? 1 : 0)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    params.push(songId)
    const query = `UPDATE songs SET ${updates.join(', ')} WHERE id = ?`

    await db.run(query, params)

    await db.close()
    res.json({ message: 'Song updated successfully' })

  } catch (err) {
    console.error('Error updating song:', err.message)
    res.status(500).json({ error: 'Failed to update song', details: err.message })
  }
}

/**
 * Delete song
 */
export async function deleteSong(req, res) {
  const songId = parseInt(req.params.id, 10)

  if (isNaN(songId)) {
    return res.status(400).json({ error: 'Invalid song ID' })
  }

  try {
    const db = await getDBConnection()

    // Check if song exists
    const song = await db.get('SELECT id, title FROM songs WHERE id = ?', [songId])
    if (!song) {
      return res.status(404).json({ error: 'Song not found' })
    }

    // Delete from album_songs (cascade will handle this, but be explicit)
    await db.run('DELETE FROM album_songs WHERE song_id = ?', [songId])

    // Delete song
    await db.run('DELETE FROM songs WHERE id = ?', [songId])

    await db.close()
    res.status(204).send()

  } catch (err) {
    console.error('Error deleting song:', err.message)
    res.status(500).json({ error: 'Failed to delete song', details: err.message })
  }
}

/**
 * Link song to album (add to album_songs)
 */
export async function linkSongToAlbum(req, res) {
  const songId = parseInt(req.params.id, 10)
  const albumId = parseInt(req.params.albumId, 10)
  let { track_number, disc_number } = req.body

  if (isNaN(songId) || isNaN(albumId)) {
    return res.status(400).json({ error: 'Invalid song or album ID' })
  }

  track_number = track_number || 1
  disc_number = disc_number || 1

  try {
    const db = await getDBConnection()

    // Verify song and album exist
    const song = await db.get('SELECT id FROM songs WHERE id = ?', [songId])
    const album = await db.get('SELECT id FROM products WHERE id = ? AND type IN ("Album", "Single", "EP")', [albumId])

    if (!song) {
      return res.status(404).json({ error: 'Song not found' })
    }
    if (!album) {
      return res.status(404).json({ error: 'Album not found' })
    }

    // Check if already linked
    const existing = await db.get(
      'SELECT * FROM album_songs WHERE album_id = ? AND song_id = ?',
      [albumId, songId]
    )

    if (existing) {
      return res.status(400).json({ error: 'Song is already on this album' })
    }

    // Link song to album
    await db.run(
      'INSERT INTO album_songs (album_id, song_id, track_number, disc_number) VALUES (?, ?, ?, ?)',
      [albumId, songId, track_number, disc_number]
    )

    await db.close()
    res.status(201).json({ message: 'Song linked to album successfully' })

  } catch (err) {
    console.error('Error linking song to album:', err.message)
    res.status(500).json({ error: 'Failed to link song to album', details: err.message })
  }
}

/**
 * Unlink song from album (remove from album_songs)
 */
export async function unlinkSongFromAlbum(req, res) {
  const songId = parseInt(req.params.id, 10)
  const albumId = parseInt(req.params.albumId, 10)

  if (isNaN(songId) || isNaN(albumId)) {
    return res.status(400).json({ error: 'Invalid song or album ID' })
  }

  try {
    const db = await getDBConnection()

    const result = await db.run(
      'DELETE FROM album_songs WHERE album_id = ? AND song_id = ?',
      [albumId, songId]
    )

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Song-album link not found' })
    }

    await db.close()
    res.status(204).send()

  } catch (err) {
    console.error('Error unlinking song from album:', err.message)
    res.status(500).json({ error: 'Failed to unlink song from album', details: err.message })
  }
}
