import { getDBConnection } from '../db/db.js'

export async function addToCart(req, res) {
 const db = await getDBConnection()

 const productId = parseInt(req.body.productId, 10)

 if (isNaN(productId)) {
  return res.status(400).json({ error: 'Invalid product ID'})
 }

 const humanId = req.session.humanId

 const existing = await db.get('SELECT * FROM cart_items WHERE human_id = ? AND product_id = ?', [humanId, productId])

 if (existing) {
  await db.run('UPDATE cart_items SET quantity = quantity + 1 WHERE id = ?', [existing.id])
 } else {
  await db.run('INSERT INTO cart_items (human_id, product_id, quantity) VALUES (?, ?, 1)', [humanId, productId])
 }

 res.json({ message: 'Added to cart' })

}

export async function getCartCount(req, res) {
  const db = await getDBConnection()

  const result = await db.get(`SELECT SUM(quantity) AS totalItems FROM cart_items WHERE human_id = ?`, [req.session.humanId])

  res.json({ totalItems: result.totalItems || 0 })
}  


export async function getAll(req, res) {

  const db = await getDBConnection()

  const items = await db.all(`SELECT ci.id AS cartItemId, ci.quantity, p.title, p.artist, p.price FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.human_id = ?`, [req.session.humanId]) 

  res.json({ items: items})
}  


export async function deleteItem(req, res) {

    const db = await getDBConnection()

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
  
}

export async function deleteAll(req, res) {

  const db = await getDBConnection()

  await db.run('DELETE FROM cart_items WHERE human_id = ?', [req.session.humanId])

  res.status(204).send()
  
}

