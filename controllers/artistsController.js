import { getDBConnection } from '../db/db.js'

// Get all artists
export async function getArtists(req, res) {
  const db = await getDBConnection()
  try {
    const artists = await db.all(`
      SELECT 
        a.human_id,
        a.stage_name,
        a.bio,
        a.website,
        h.first_name,
        h.last_name,
        h.first_name || ' ' || h.last_name AS full_name
      FROM artists a
      JOIN humans h ON a.human_id = h.id
      WHERE h.is_active = 1
      ORDER BY a.stage_name
    `)
    
    res.json(artists)
    
  } catch (err) {
    console.error('Error fetching artists:', err)
    res.status(500).json({ error: 'Failed to fetch artists' })
  } finally {
    await db.close()
  }
}

// Get single artist
export async function getArtist(req, res) {
  const { id } = req.params
  const db = await getDBConnection()
  
  try {
    const artist = await db.get(`
      SELECT 
        a.human_id,
        a.stage_name,
        a.bio,
        a.website,
        a.debut_year,
        h.first_name,
        h.last_name,
        h.first_name || ' ' || h.last_name AS full_name
      FROM artists a
      JOIN humans h ON a.human_id = h.id
      WHERE a.human_id = ?
    `, [id])
    
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' })
    }
    
    res.json(artist)
    
  } catch (err) {
    console.error('Error fetching artist:', err)
    res.status(500).json({ error: 'Failed to fetch artist' })
  } finally {
    await db.close()
  }
}

// Create new artist
export async function createArtist(req, res) {
  const { firstName, lastName, stageName, bio, website, debutYear } = req.body
  
  if (!firstName || !lastName || !stageName) {
    return res.status(400).json({ 
      error: 'First name, last name, and stage name are required' 
    })
  }
  
  const db = await getDBConnection()
  try {
    // 1. Create human record
    const humanResult = await db.run(
      'INSERT INTO humans (first_name, last_name) VALUES (?, ?)',
      [firstName.trim(), lastName.trim()]
    )
    
    const humanId = humanResult.lastID
    
    // 2. Create artist record
    await db.run(
      `INSERT INTO artists (human_id, stage_name, bio, website, debut_year) 
       VALUES (?, ?, ?, ?, ?)`,
      [humanId, stageName.trim(), bio || null, website || null, debutYear || null]
    )
    
    res.status(201).json({ 
      message: 'Artist created successfully',
      artistId: humanId,
      stageName: stageName.trim()
    })
    
  } catch (err) {
    console.error('Error creating artist:', err)
    res.status(500).json({ error: 'Failed to create artist' })
  } finally {
    await db.close()
  }
}

// Update artist
export async function updateArtist(req, res) {
  const { id } = req.params
  const { firstName, lastName, stageName, bio, website, debutYear } = req.body
  
  const db = await getDBConnection()
  try {
    // Update human record
    if (firstName || lastName) {
      await db.run(
        'UPDATE humans SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name) WHERE id = ?',
        [firstName?.trim(), lastName?.trim(), id]
      )
    }
    
    // Update artist record
    await db.run(
      `UPDATE artists 
       SET stage_name = COALESCE(?, stage_name),
           bio = COALESCE(?, bio),
           website = COALESCE(?, website),
           debut_year = COALESCE(?, debut_year)
       WHERE human_id = ?`,
      [stageName?.trim(), bio, website, debutYear, id]
    )
    
    res.json({ message: 'Artist updated successfully' })
    
  } catch (err) {
    console.error('Error updating artist:', err)
    res.status(500).json({ error: 'Failed to update artist' })
  } finally {
    await db.close()
  }
}

// Search artists by name
export async function searchArtists(req, res) {
  const { query } = req.query
  
  if (!query) {
    return res.status(400).json({ error: 'Search query required' })
  }
  
  const db = await getDBConnection()
  try {
    const searchPattern = `%${query}%`
    const artists = await db.all(`
      SELECT 
        a.human_id,
        a.stage_name,
        h.first_name || ' ' || h.last_name AS full_name
      FROM artists a
      JOIN humans h ON a.human_id = h.id
      WHERE a.stage_name LIKE ? 
         OR h.first_name LIKE ?
         OR h.last_name LIKE ?
      ORDER BY a.stage_name
      LIMIT 20
    `, [searchPattern, searchPattern, searchPattern])
    
    res.json(artists)
    
  } catch (err) {
    console.error('Error searching artists:', err)
    res.status(500).json({ error: 'Failed to search artists' })
  } finally {
    await db.close()
  }
}
