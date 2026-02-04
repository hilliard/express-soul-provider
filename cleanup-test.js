import { getDBConnection } from './db/db.js'

async function cleanup() {
  const db = await getDBConnection()
  
  try {
    // Delete the incomplete album
    await db.run('DELETE FROM album_songs WHERE album_id = 22')
    await db.run('DELETE FROM songs WHERE id IN (SELECT song_id FROM album_songs WHERE album_id = 22)')
    await db.run('DELETE FROM products WHERE id = 22')
    
    console.log('✓ Deleted old Hotter Than July album')
    
    // Check if Stevie Wonder artist exists
    const stevie = await db.get("SELECT * FROM artists WHERE LOWER(stage_name) = LOWER('Stevie Wonder')")
    if (stevie) {
      console.log('✓ Stevie Wonder artist found:', stevie)
    } else {
      console.log('✗ Stevie Wonder artist NOT found')
    }
    
    // Check songs
    const songs = await db.all('SELECT id, title, artist_human_id FROM songs WHERE title IN ("Did I Hear You Say You Love Me", "All I Do", "Rocket Love")')
    console.log('Remaining songs:', songs)
    
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await db.close()
  }
}

cleanup()
