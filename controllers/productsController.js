import { getDBConnection } from '../db/db.js'

// Canonical genre list - matches songs table CHECK constraint
const GENRES = [
  'RnB',
  'Soul', 
  'Funk',
  'Jazz',
  'Gospel',
  'Blues',
  'Disco',
  'Rock',
  'Pop',
  'Country',
  'HipHop',
  'Rap',
  'Classical',
  'Reggae',
  'Electronic',
  'Dance',
  'World'
]

export async function getGenres(req, res) {
  // Return canonical list instead of querying database
  // This ensures consistency with songs table schema
  res.json(GENRES)
}

export async function getSingleProduct(req, res) {
  const db = await getDBConnection()
  try {
    const productId = parseInt(req.params.id, 10)

    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' })
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId])

    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.json(product)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product', details: err.message })
  } finally {
    await db.close()
  }
}

export async function getProducts(req, res) {

  const db = await getDBConnection()

  try {
    let query = 'SELECT * FROM products'
    let params = []

    const { genre, search, type } = req.query
    
    // console.log('getProducts called with:', { genre, search, type })

    if (type) {
      // Filter by product type (Album, Single, EP, Merch)
      // console.log('Filtering by type:', type)
      query += ' WHERE type = ?'
      params.push(type)
    } else if (genre) {
      // Filter by genre (for music products)
      query += ' WHERE genre = ?'
      params.push(genre)
    } else if (search) {
      // Search across multiple fields including type
      query += ' WHERE title LIKE ? OR artist LIKE ? OR genre LIKE ? OR type LIKE ?'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }
    
    const products = await db.all(query, params)
    
   // console.log('Query:', query)
   // console.log('Params:', params)
   // console.log('Products returned:', products.length)

    res.json(products)
  } catch (err) {
    res.status(500).json({error: 'Failed to fetch products', details: err.message})
  } finally {
    await db.close()
  }

}

export async function createProduct(req, res) {
  
  let { title, artist, price, image, year, genre, stock, type, songs } = req.body

  // Validate required fields (all products need title, artist, price, image)
  if (!title || !artist || !price || !image) {
    return res.status(400).json({ error: 'Title, artist, price, and image are required' })
  }

  // Trim string inputs
  title = title.trim()
  artist = artist.trim()
  image = image.trim()
  
  // Default type to 'Album' if not provided
  type = type ? type.trim() : 'Album'
  
  // Validate type
  const validTypes = ['Album', 'Single', 'EP', 'Merch']
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Type must be Album, Single, EP, or Merch' })
  }

  // For music products, require year and genre
  if (['Album', 'Single', 'EP'].includes(type)) {
    if (!year || !genre) {
      return res.status(400).json({ error: 'Year and genre are required for music products' })
    }
    genre = genre.trim()
  }

  // Validate data types
  const priceNum = parseFloat(price)
  const stockNum = stock !== undefined ? parseInt(stock, 10) : 12

  if (isNaN(priceNum) || priceNum <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number' })
  }

  if (isNaN(stockNum) || stockNum < 0) {
    return res.status(400).json({ error: 'Stock must be a non-negative number' })
  }

  // Validate year for music products
  let yearNum = null
  if (year) {
    yearNum = parseInt(year, 10)
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      return res.status(400).json({ error: 'Invalid year' })
    }
  }

  try {
    const db = await getDBConnection()

    // Insert product
    const result = await db.run(
      'INSERT INTO products (title, artist, price, image, year, genre, stock, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, artist, priceNum, image, yearNum, genre || null, stockNum, type]
    )

    const productId = result.lastID
    
    // For music products, try to find or create the artist in artists table
    let artistHumanId = null
    if (['Album', 'Single', 'EP'].includes(type)) {
      // Try to find artist by stage_name (case-insensitive match)
      let artistRecord = await db.get(
        'SELECT human_id FROM artists WHERE LOWER(stage_name) = LOWER(?)',
        [artist.trim()]
      )
      
      // If artist doesn't exist, create a new human and artist record
      if (!artistRecord) {
        // Create a human record for this artist
        const humanResult = await db.run(
          'INSERT INTO humans (first_name, last_name) VALUES (?, ?)',
          [artist.trim(), ''] // Single name artists: store full name in first_name
        )
        
        const newHumanId = humanResult.lastID
        
        // Create artist record
        await db.run(
          'INSERT INTO artists (human_id, stage_name) VALUES (?, ?)',
          [newHumanId, artist.trim()]
        )
        
        artistHumanId = newHumanId
      } else {
        artistHumanId = artistRecord.human_id
      }
    }

    // Insert songs if provided (using bridge table pattern)
    let songsInserted = 0
    if (songs && Array.isArray(songs) && songs.length > 0) {
      for (const song of songs) {
        const { track_number, title: songTitle, duration_seconds, individual_price, artist_override, disc_number } = song
        
        if (!songTitle || !songTitle.trim()) {
          continue // Skip songs without a title
        }
        
        // 1. Create the song record with artist_human_id
        const songResult = await db.run(
          `INSERT INTO songs (title, duration_seconds, individual_price, artist_human_id, genre, is_explicit) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            songTitle.trim(),
            duration_seconds || null,
            individual_price || 0.99,
            artistHumanId, // Set artist_human_id from the album's artist
            song.genre || productGenre || null, // Use song genre if specified, otherwise album genre
            song.is_explicit ? 1 : 0
          ]
        )
        
        const songId = songResult.lastID
        
        // 2. Link song to album via bridge table
        await db.run(
          `INSERT INTO album_songs (album_id, song_id, track_number, disc_number) 
           VALUES (?, ?, ?, ?)`,
          [
            productId,
            songId,
            track_number || 1,
            disc_number || 1
          ]
        )
        
        songsInserted++
      }
    }

    res.status(201).json({ 
      message: 'Product created successfully',
      productId: productId,
      songsAdded: songsInserted
    })

  } catch (err) {
    console.error('Create product error:', err)
    res.status(500).json({ error: 'Failed to create product', details: err.message })
  }
}

export async function updateProduct(req, res) {
  const productId = parseInt(req.params.id, 10)
  
  if (isNaN(productId)) {
    return res.status(400).json({ error: 'Invalid product ID' })
  }

  let { title, artist, price, image, year, genre, stock, type } = req.body

  // Validate required fields
  if (!title || !artist || !price || !image) {
    return res.status(400).json({ error: 'Title, artist, price, and image are required' })
  }

  // Trim string inputs
  title = title.trim()
  artist = artist.trim()
  image = image.trim()
  type = type ? type.trim() : 'Album'

  // Validate type
  const validTypes = ['Album', 'Single', 'EP', 'Merch']
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Type must be Album, Single, EP, or Merch' })
  }

  try {
    const db = await getDBConnection()

    // Check if product exists
    const existing = await db.get('SELECT id FROM products WHERE id = ?', [productId])
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Update product
    await db.run(
      `UPDATE products 
       SET title = ?, artist = ?, price = ?, image = ?, year = ?, genre = ?, stock = ?, type = ?
       WHERE id = ?`,
      [title, artist, price, image, year, genre, stock, type, productId]
    )

    res.json({ message: 'Product updated successfully', productId })

  } catch (err) {
    console.error('Error updating product:', err.message)
    res.status(500).json({ error: 'Failed to update product', details: err.message })
  }
}

export async function deleteProduct(req, res) {
  const productId = parseInt(req.params.id, 10)
  
  if (isNaN(productId)) {
    return res.status(400).json({ error: 'Invalid product ID' })
  }

  try {
    const db = await getDBConnection()

    // Check if product exists
    const existing = await db.get('SELECT id, title FROM products WHERE id = ?', [productId])
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Delete product (cart_items will be cascade deleted due to FK constraint)
    const result = await db.run('DELETE FROM products WHERE id = ?', [productId])
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found or already deleted' })
    }

    res.status(204).send() // No content on successful delete

  } catch (err) {
    console.error('Error deleting product:', err.message)
    
    // Check if it's a foreign key constraint error
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(400).json({ 
        error: 'Cannot delete product',
        details: 'Product is referenced by other records'
      })
    }
    
    res.status(500).json({ error: 'Failed to delete product', details: err.message })
  }
}
