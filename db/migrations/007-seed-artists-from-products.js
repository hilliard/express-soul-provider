/**
 * Migration 007: Seed Artists from Existing Products
 * 
 * Converts product.artist TEXT strings into artist entities
 * Creates humans and artists records from unique artist names in products table
 */

import { getDBConnection } from '../db.js'

export async function up() {
  console.log('Running migration 007: Seed artists from products...')
  
  const db = await getDBConnection()
  
  try {
    // Get unique artist names from products (excluding merchandise)
    const uniqueArtists = await db.all(`
      SELECT DISTINCT artist 
      FROM products 
      WHERE artist IS NOT NULL 
      AND type IN ('Album', 'Single', 'EP')
      ORDER BY artist
    `)
    
    console.log(`Found ${uniqueArtists.length} unique artists`)
    
    for (const row of uniqueArtists) {
      const artistName = row.artist.trim()
      
      // Split name into first/last (simple heuristic)
      const nameParts = artistName.split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || firstName
      
      // Check if artist already exists
      const existing = await db.get(
        'SELECT human_id FROM artists WHERE stage_name = ?',
        [artistName]
      )
      
      if (existing) {
        console.log(`  ⊘ Artist already exists: ${artistName}`)
        continue
      }
      
      // Create human record
      const humanResult = await db.run(
        'INSERT INTO humans (first_name, last_name) VALUES (?, ?)',
        [firstName, lastName]
      )
      
      const humanId = humanResult.lastID
      
      // Create artist record
      await db.run(
        'INSERT INTO artists (human_id, stage_name) VALUES (?, ?)',
        [humanId, artistName]
      )
      
      console.log(`  ✓ Created artist: ${artistName} (ID: ${humanId})`)
    }
    
    // Add artist permissions if they don't exist
    const artistCreatePerm = await db.get(
      "SELECT id FROM permissions WHERE permission_name = 'artists.create'"
    )
    
    if (!artistCreatePerm) {
      await db.run(
        `INSERT INTO permissions (permission_name, resource, action, description) 
         VALUES ('artists.create', 'artists', 'create', 'Can create artist profiles')`
      )
      console.log('  ✓ Added artists.create permission')
    }
    
    const artistUpdatePerm = await db.get(
      "SELECT id FROM permissions WHERE permission_name = 'artists.update'"
    )
    
    if (!artistUpdatePerm) {
      await db.run(
        `INSERT INTO permissions (permission_name, resource, action, description) 
         VALUES ('artists.update', 'artists', 'update', 'Can update artist profiles')`
      )
      console.log('  ✓ Added artists.update permission')
    }
    
    // Grant permissions to admin role
    const adminRole = await db.get("SELECT id FROM site_roles WHERE role_name = 'admin'")
    const artistRole = await db.get("SELECT id FROM site_roles WHERE role_name = 'artist'")
    
    if (adminRole) {
      const perms = await db.all("SELECT id FROM permissions WHERE permission_name LIKE 'artists.%'")
      for (const perm of perms) {
        await db.run(
          'INSERT OR IGNORE INTO site_role_permissions (site_role_id, permission_id) VALUES (?, ?)',
          [adminRole.id, perm.id]
        )
      }
      console.log('  ✓ Granted artist permissions to admin role')
    }
    
    if (artistRole) {
      const updatePerm = await db.get("SELECT id FROM permissions WHERE permission_name = 'artists.update'")
      if (updatePerm) {
        await db.run(
          'INSERT OR IGNORE INTO site_role_permissions (site_role_id, permission_id) VALUES (?, ?)',
          [artistRole.id, updatePerm.id]
        )
        console.log('  ✓ Granted artist update permission to artist role')
      }
    }
    
    await db.close()
    console.log('✅ Migration 007 completed successfully\n')
    
  } catch (err) {
    await db.close()
    throw err
  }
}

export async function down() {
  console.log('Rolling back migration 007...')
  
  const db = await getDBConnection()
  
  try {
    // Remove artist permissions
    await db.run("DELETE FROM permissions WHERE permission_name LIKE 'artists.%'")
    
    // Note: We don't delete the artist/human records as they might be in use
    console.log('⚠️  Artist records preserved (manual cleanup required if needed)')
    
    await db.close()
    console.log('✅ Migration 007 rolled back\n')
    
  } catch (err) {
    await db.close()
    throw err
  }
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  up().catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
}
