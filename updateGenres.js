import { getDBConnection } from './db/db.js'

async function updateGenresAndArtists() {
  const db = await getDBConnection()
  
  try {
    console.log('Updating products with new genres and Motown artists...')
    
    await db.run(`UPDATE products SET genre = 'RnB', artist = 'The Supremes' WHERE id = 1`)
    await db.run(`UPDATE products SET genre = 'Soul', artist = 'Marvin Gaye' WHERE id = 2`)
    await db.run(`UPDATE products SET genre = 'Funk', artist = 'Stevie Wonder' WHERE id = 3`)
    await db.run(`UPDATE products SET genre = 'RnB', artist = 'Smokey Robinson' WHERE id = 4`)
    await db.run(`UPDATE products SET genre = 'Gospel', artist = 'The Temptations' WHERE id = 5`)
    await db.run(`UPDATE products SET genre = 'Funk', artist = 'Diana Ross' WHERE id = 6`)
    await db.run(`UPDATE products SET genre = 'Soul', artist = 'Gladys Knight' WHERE id = 7`)
    await db.run(`UPDATE products SET genre = 'Soul', artist = 'The Four Tops' WHERE id = 8`)
    await db.run(`UPDATE products SET genre = 'Blues', artist = 'James Brown' WHERE id = 9`)
    await db.run(`UPDATE products SET genre = 'Soul', artist = 'Martha Reeves' WHERE id = 10`)
    
    console.log('✅ Database updated successfully!')
    
    // Verify
    const products = await db.all('SELECT id, title, artist, genre FROM products ORDER BY id')
    console.table(products)
    
  } catch (error) {
    console.error('Error updating database:', error)
  } finally {
    await db.close()
  }
}

updateGenresAndArtists()
