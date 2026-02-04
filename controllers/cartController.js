import { getDBConnection } from '../db/db.js'

export async function addToCart(req, res) {
 const db = await getDBConnection()

 try {
  const productId = req.body.productId ? parseInt(req.body.productId, 10) : null
  const songId = req.body.songId ? parseInt(req.body.songId, 10) : null

  // Must specify either a product or a song
  if (!productId && !songId) {
   return res.status(400).json({ error: 'Must specify either productId or songId'})
  }

  if (productId && isNaN(productId)) {
   return res.status(400).json({ error: 'Invalid product ID'})
  }

  if (songId && isNaN(songId)) {
   return res.status(400).json({ error: 'Invalid song ID'})
  }

  const humanId = req.session.humanId

  // Check if item already exists in cart
  const existing = await db.get(
   'SELECT * FROM cart_items WHERE human_id = ? AND product_id IS ? AND song_id IS ?',
   [humanId, productId, songId]
  )

  if (existing) {
   await db.run('UPDATE cart_items SET quantity = quantity + 1 WHERE id = ?', [existing.id])
  } else {
   await db.run(
    'INSERT INTO cart_items (human_id, product_id, song_id, quantity) VALUES (?, ?, ?, 1)',
    [humanId, productId, songId]
   )
  }

  res.json({ message: 'Added to cart' })
 } finally {
  await db.close()
 }

}

export async function getCartCount(req, res) {
  const db = await getDBConnection()

  try {
    const result = await db.get(`SELECT SUM(quantity) AS totalItems FROM cart_items WHERE human_id = ?`, [req.session.humanId])
    res.json({ totalItems: result.totalItems || 0 })
  } finally {
    await db.close()
  }
}  


export async function getAll(req, res) {

  const db = await getDBConnection()

  try {
    // Get both products and songs from cart
    const items = await db.all(`
      SELECT 
        ci.id AS cartItemId, 
        ci.quantity,
        COALESCE(p.title, s.title) as title,
        COALESCE(p.artist, a.stage_name) as artist,
        COALESCE(p.price, s.individual_price) as price,
        CASE WHEN ci.product_id IS NOT NULL THEN 'product' ELSE 'song' END as type
      FROM cart_items ci
      LEFT JOIN products p ON p.id = ci.product_id
      LEFT JOIN songs s ON s.id = ci.song_id
      LEFT JOIN artists a ON s.artist_human_id = a.human_id
      WHERE ci.human_id = ?
    `, [req.session.humanId]) 

    res.json({ items: items})
  } finally {
    await db.close()
  }
}  


export async function deleteItem(req, res) {

    const db = await getDBConnection()

    try {
      const itemId = parseInt(req.params.itemId, 10)

      if (isNaN(itemId)) {
        return res.status(400).json({error: 'Invalid item ID'})
      }

      const item = await db.get('SELECT quantity FROM cart_items WHERE id = ? AND human_id = ?', [itemId, req.session.humanId])

      if (!item) {
        return res.status(400).json({error: 'Item not found'})
      }

      await db.run('DELETE FROM cart_items WHERE id = ? AND human_id = ?', [itemId, req.session.humanId])

      res.status(204).send()
    } finally {
      await db.close()
    }
  
}

export async function deleteAll(req, res) {

  const db = await getDBConnection()

  try {
    await db.run('DELETE FROM cart_items WHERE human_id = ?', [req.session.humanId])
    res.status(204).send()
  } finally {
    await db.close()
  }
  
}

