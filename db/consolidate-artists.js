/**
 * Script to consolidate duplicate artists and add unique constraints
 * 
 * Steps:
 * 1. Find duplicate artists by stage_name
 * 2. Merge products from duplicates to the first one
 * 3. Delete duplicate artist records
 * 4. Add unique constraint on stage_name
 */

import { getDBConnection } from './db.js'

async function consolidateArtists() {
  const db = await getDBConnection()

  try {
    console.log('Finding duplicate artists...\n')

    // 1. Find artists with duplicate stage names
    const duplicates = await db.all(`
      SELECT stage_name, COUNT(*) as count, GROUP_CONCAT(human_id) as human_ids
      FROM artists
      WHERE stage_name IS NOT NULL
      GROUP BY stage_name
      HAVING count > 1
      ORDER BY stage_name
    `)

    if (duplicates.length === 0) {
      console.log('✓ No duplicate artists found\n')
    } else {
      console.log(`Found ${duplicates.length} duplicate artist names:\n`)

      for (const dup of duplicates) {
        console.log(`  "${dup.stage_name}" (${dup.count} records)`)
        const ids = dup.human_ids.split(',')
        const keepId = ids[0]
        const mergeIds = ids.slice(1)

        console.log(`    → Keeping human_id: ${keepId}`)
        console.log(`    → Merging from: ${mergeIds.join(', ')}`)

        // Redirect all products from duplicate artists to the main one
        for (const mergeId of mergeIds) {
          const productsToUpdate = await db.all(
            'SELECT id FROM products WHERE artist_human_id = ?',
            [parseInt(mergeId)]
          )
          console.log(`      - Moving ${productsToUpdate.length} products`)

          await db.run(
            'UPDATE products SET artist_human_id = ? WHERE artist_human_id = ?',
            [parseInt(keepId), parseInt(mergeId)]
          )

          // Also update songs if artist_human_id matches
          await db.run(
            'UPDATE songs SET artist_human_id = ? WHERE artist_human_id = ?',
            [parseInt(keepId), parseInt(mergeId)]
          )
        }

        // Delete duplicate artist records
        const placeholders = mergeIds.map(() => '?').join(',')
        const query = `DELETE FROM artists WHERE human_id IN (${placeholders})`
        await db.run(query, mergeIds.map(id => parseInt(id)))

        console.log(`    ✓ Merged "${dup.stage_name}"\n`)
      }
    }

    // 2. Also check for duplicate humans by full name
    console.log('Finding duplicate humans by name...\n')

    const duplicateHumans = await db.all(`
      SELECT 
        first_name, 
        last_name, 
        COUNT(*) as count, 
        GROUP_CONCAT(id) as human_ids
      FROM humans
      WHERE is_active = 1
      GROUP BY first_name, last_name
      HAVING count > 1
      ORDER BY last_name, first_name
    `)

    if (duplicateHumans.length === 0) {
      console.log('✓ No duplicate humans found\n')
    } else {
      console.log(`⚠️  Found ${duplicateHumans.length} duplicate human names:`)
      for (const dup of duplicateHumans) {
        console.log(`  "${dup.first_name} ${dup.last_name}" (${dup.count} records)`)
        console.log(`    human_ids: ${dup.human_ids}`)
        console.log(`    Action: Manually review and merge if needed\n`)
      }
    }

    // 3. Add unique constraint on artists.stage_name
    console.log('Adding unique constraint on artists.stage_name...')
    try {
      // Note: SQLite doesn't support ALTER TABLE ADD CONSTRAINT directly
      // We'll need to recreate the table, so this is informational
      console.log('⚠️  SQLite limitation: Manual constraint addition needed')
      console.log('    See migration file for implementation\n')
    } catch (err) {
      console.log('  Error:', err.message)
    }

    console.log('✅ Consolidation complete!\n')
    console.log('Next steps:')
    console.log('  1. Run the new migration to add unique constraints')
    console.log('  2. Run migrations: node db/migrate.js up')

  } catch (err) {
    console.error('❌ Error during consolidation:', err.message)
    process.exit(1)
  } finally {
    await db.close()
  }
}

consolidateArtists()
