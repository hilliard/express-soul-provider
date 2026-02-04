/**
 * Script to add "Hotter Than July" album and link existing songs
 */

import { getDBConnection } from './db/db.js'

async function addHotterThanJulyAlbum() {
  const db = await getDBConnection()

  try {
    console.log('Starting album creation...\n')

    // 1. Verify Stevie Wonder (human_id 19) exists
    const human = await db.get(
      'SELECT id, first_name, last_name FROM humans WHERE id = ?',
      [19]
    )

    if (!human) {
      console.error('❌ Error: Stevie Wonder (human_id 19) not found')
      await db.close()
      return
    }

    console.log(`✓ Found human: ${human.first_name} ${human.last_name}`)

    // 2. Check if artist record exists, if not create it
    let artist = await db.get(
      'SELECT human_id, stage_name FROM artists WHERE human_id = ?',
      [19]
    )

    if (!artist) {
      console.log('  Creating artist record...')
      await db.run(
        'INSERT INTO artists (human_id, stage_name) VALUES (?, ?)',
        [19, 'Stevie Wonder']
      )
      artist = { human_id: 19, stage_name: 'Stevie Wonder' }
    }

    console.log(`✓ Artist: ${artist.stage_name}\n`)

    // 3. Create the album product
    const result = await db.run(
      `INSERT INTO products (title, artist, price, image, year, genre, stock, type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Hotter Than July',      // title
        'Stevie Wonder',         // artist (text field for display)
        39.99,                   // price (album price)
        'hotter-than-july.png',  // image (you may need to adjust)
        1980,                    // year
        'RnB',                   // genre
        12,                      // stock
        'Album'                  // type
      ]
    )

    const albumId = result.lastID
    console.log(`✓ Created album "Hotter Than July" with ID: ${albumId}\n`)

    // 3. Get all 10 songs that need to be linked
    const songs = await db.all(
      `SELECT id, title FROM songs WHERE artist_human_id = 19 AND genre = 'RnB' ORDER BY id`,
      []
    )

    console.log(`Found ${songs.length} songs to link:\n`)

    // 4. Link each song to the album
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i]
      const trackNumber = i + 1

      await db.run(
        `INSERT INTO album_songs (album_id, song_id, track_number, disc_number)
         VALUES (?, ?, ?, 1)`,
        [albumId, song.id, trackNumber]
      )

      console.log(`  ${trackNumber}. ${song.title}`)
    }

    console.log(`\n✅ Successfully linked ${songs.length} songs to "Hotter Than July" album!`)
    console.log(`\nAlbum Details:`)
    console.log(`  - Product ID: ${albumId}`)
    console.log(`  - Title: Hotter Than July`)
    console.log(`  - Artist: Stevie Wonder`)
    console.log(`  - Year: 1980`)
    console.log(`  - Genre: RnB`)
    console.log(`  - Price: $39.99`)
    console.log(`  - Tracks: ${songs.length}`)

    await db.close()

  } catch (err) {
    console.error('❌ Error:', err.message)
    await db.close()
    process.exit(1)
  }
}

addHotterThanJulyAlbum()
