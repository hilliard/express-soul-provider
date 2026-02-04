import { getDBConnection } from './db/db.js'

async function queryProducts() {
  const db = await getDBConnection()

  try {
    // SELECT - View all products
    const allProducts = await db.all('SELECT * FROM products')
    console.log('All products:', allProducts)

    // SELECT with WHERE - Filter products
    const albumsOnly = await db.all('SELECT * FROM products WHERE type = ?', ['Album'])
    console.log('Albums only:', albumsOnly)

    // SELECT single product
    const product = await db.get('SELECT * FROM products WHERE id = ?', [1])
    console.log('Product ID 1:', product)

    // INSERT - Add new product
    const result = await db.run(
      'INSERT INTO products (title, artist, price, image, year, genre, stock, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['Test Album', 'Test Artist', 9.99, 'test.png', 2024, 'Soul', 10, 'Album']
    )
    console.log('Inserted product ID:', result.lastID)

    // UPDATE - Modify a product
    await db.run(
      'UPDATE products SET price = ? WHERE id = ?',
      [19.99, 1]
    )
    console.log('Updated product ID 1')

    // DELETE - Remove a product
    await db.run('DELETE FROM products WHERE id = ?', [999])
    console.log('Deleted product')

  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await db.close()
  }
}

queryProducts()