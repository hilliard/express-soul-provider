import { getDBConnection } from '../db.js'

/**
 * Migration 002: Migrate Existing Users to Human-Centric Schema
 * Copies data from old 'users' table into humans, customers, email_history
 */

export async function up() {
  const db = await getDBConnection()
  
  try {
    console.log('Starting migration 002: Migrating users to humans...')
    
    await db.exec('PRAGMA foreign_keys = ON')
    
    // Get all existing users
    const users = await db.all('SELECT * FROM users')
    
    if (users.length === 0) {
      console.log('No users to migrate')
      return
    }
    
    console.log(`Found ${users.length} users to migrate`)
    
    // Get customer role ID
    const customerRole = await db.get("SELECT id FROM site_roles WHERE role_name = 'customer'")
    
    if (!customerRole) {
      throw new Error('Customer role not found. Run migration 001 first.')
    }
    
    let migrated = 0
    
    for (const user of users) {
      try {
        // 1. Split name into first_name and last_name
        const nameParts = (user.name || '').trim().split(/\s+/)
        const firstName = nameParts[0] || 'Unknown'
        const lastName = nameParts.slice(1).join(' ') || firstName
        
        console.log(`Migrating user: ${user.username} (${user.name})`)
        
        // 2. Create human record
        const humanResult = await db.run(
          `INSERT INTO humans (first_name, last_name, created_at) VALUES (?, ?, ?)`,
          [firstName, lastName, user.created_at || new Date().toISOString()]
        )
        
        const humanId = humanResult.lastID
        
        // 3. Create customer record
        await db.run(
          `INSERT INTO customers (human_id, username, password_hash, customer_since) 
           VALUES (?, ?, ?, ?)`,
          [humanId, user.username, user.password, user.created_at || new Date().toISOString()]
        )
        
        // 4. Create email history record
        await db.run(
          `INSERT INTO email_history (human_id, email, is_verified, effective_from, effective_to, change_reason)
           VALUES (?, ?, ?, ?, NULL, 'initial')`,
          [humanId, user.email, 0, user.created_at || new Date().toISOString()]
        )
        
        // 5. Assign customer role
        await db.run(
          `INSERT INTO human_site_roles (human_id, site_role_id, assigned_at)
           VALUES (?, ?, ?)`,
          [humanId, customerRole.id, new Date().toISOString()]
        )
        
        // 6. Create mapping for cart_items update (store in temp table)
        // We'll use this to update cart_items.user_id references
        await db.run(
          `CREATE TABLE IF NOT EXISTS user_human_mapping (
            old_user_id INTEGER PRIMARY KEY,
            new_human_id INTEGER NOT NULL
          )`
        )
        
        await db.run(
          `INSERT INTO user_human_mapping (old_user_id, new_human_id) VALUES (?, ?)`,
          [user.id, humanId]
        )
        
        migrated++
        console.log(`  ✓ Migrated to human_id: ${humanId}`)
        
      } catch (error) {
        console.error(`  ✗ Failed to migrate user ${user.username}:`, error.message)
        throw error
      }
    }
    
    console.log(`\n✅ Successfully migrated ${migrated}/${users.length} users`)
    
    // Show summary
    const humanCount = await db.get('SELECT COUNT(*) as count FROM humans')
    const customerCount = await db.get('SELECT COUNT(*) as count FROM customers')
    const emailCount = await db.get('SELECT COUNT(*) as count FROM email_history WHERE effective_to IS NULL')
    
    console.log('\nMigration Summary:')
    console.log(`  Humans created: ${humanCount.count}`)
    console.log(`  Customers created: ${customerCount.count}`)
    console.log(`  Active emails: ${emailCount.count}`)
    
  } catch (error) {
    console.error('❌ Migration 002 failed:', error.message)
    throw error
  } finally {
    await db.close()
  }
}

export async function down() {
  const db = await getDBConnection()
  
  try {
    console.log('Rolling back migration 002...')
    
    // Remove migrated data
    await db.exec('DELETE FROM human_site_roles')
    await db.exec('DELETE FROM email_history')
    await db.exec('DELETE FROM customers')
    await db.exec('DELETE FROM humans')
    await db.exec('DROP TABLE IF EXISTS user_human_mapping')
    
    console.log('✅ Rollback completed')
    
  } catch (error) {
    console.error('❌ Rollback failed:', error.message)
    throw error
  } finally {
    await db.close()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  up().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
