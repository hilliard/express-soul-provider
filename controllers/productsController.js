import { getDBConnection } from '../db/db.js'

export async function getGenres(req, res) {

  try {

    const db = await getDBConnection()

    const genreRows = await db.all('SELECT DISTINCT genre FROM products')
    const genres = genreRows.map(row => row.genre)
    res.json(genres)

  } catch (err) {

    res.status(500).json({error: 'Failed to fetch genres', details: err.message})

  }
}

export async function getProducts(req, res) {

  try {

    const db = await getDBConnection()

    let query = 'SELECT * FROM products'
    let params = []

    const { genre, search } = req.query

    if (genre) {

      query += ' WHERE genre = ?'
      params.push(genre)

    } else if (search) {

      query += ' WHERE title LIKE ? OR artist LIKE ? OR genre LIKE ?'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
      
    }
    
    const products = await db.all(query, params)

    res.json(products)


  } catch (err) {

    res.status(500).json({error: 'Failed to fetch products', details: err.message})

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

    // Insert songs if provided
    let songsInserted = 0
    if (songs && Array.isArray(songs) && songs.length > 0) {
      for (const song of songs) {
        const { track_number, title: songTitle, duration_seconds, individual_price, artist_override } = song
        
        if (!songTitle || !songTitle.trim()) {
          continue // Skip songs without a title
        }
        
        await db.run(
          `INSERT INTO songs (product_id, track_number, title, duration_seconds, individual_price, artist_override) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            productId,
            track_number || 1,
            songTitle.trim(),
            duration_seconds || null,
            individual_price || 0.99,
            artist_override && artist_override.trim() ? artist_override.trim() : null
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

