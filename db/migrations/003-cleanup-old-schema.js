import { getDBConnection } from '../db.js'

/**
 * Migration 003: Update Application Tables and Drop Old Schema
 * WARNING: This is a BREAKING migration. Ensure Phase 3 (code updates) is complete.
 */

export async function up() {
  const db = await getDBConnection()
  
  try {
    console.log('Starting migration 003: Cleanup and finalize schema...')
    console.log('⚠️  WARNING: This is a breaking migration!')
    
    await db.exec('PRAGMA foreign_keys = OFF') // Temporarily disable to allow schema changes
    
    // ========================================
    // 1. BACKUP OLD USERS TABLE
    // ========================================
    
    console.log('\n1. Backing up old users table...')
    await db.exec(`CREATE TABLE IF NOT EXISTS users_backup_${Date.now()} AS SELECT * FROM users`)
    console.log('   ✓ Backup created')
    
    // ========================================
    // 2. UPDATE CART_ITEMS TABLE
    // ========================================
    
    console.log('\n2. Updating cart_items table structure...')
    
    // Check if mapping table exists
    const mappingExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user_human_mapping'"
    )
    
    if (!mappingExists) {
      throw new Error('user_human_mapping table not found. Run migration 002 first.')
    }
    
    // Create new cart_items table with correct structure
    await db.exec(`
      CREATE TABLE cart_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        human_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (human_id) REFERENCES customers(human_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `)
    
    // Copy data with mapping
    await db.exec(`
      INSERT INTO cart_items_new (id, human_id, product_id, quantity)
      SELECT ci.id, m.new_human_id, ci.product_id, ci.quantity
      FROM cart_items ci
      JOIN user_human_mapping m ON ci.user_id = m.old_user_id
    `)
    
    // Drop old and rename new
    await db.exec('DROP TABLE cart_items')
    await db.exec('ALTER TABLE cart_items_new RENAME TO cart_items')
    
    // Add indexes
    await db.exec('CREATE INDEX IF NOT EXISTS idx_cart_human ON cart_items(human_id)')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_cart_product ON cart_items(product_id)')
    
    console.log('   ✓ cart_items updated (user_id → human_id)')
    
    // ========================================
    // 3. DROP OLD USERS TABLE
    // ========================================
    
    console.log('\n3. Dropping old users table...')
    await db.exec('DROP TABLE users')
    console.log('   ✓ Old users table removed')
    
    // ========================================
    // 4. CLEANUP TEMPORARY TABLES
    // ========================================
    
    console.log('\n4. Cleaning up temporary tables...')
    await db.exec('DROP TABLE IF EXISTS user_human_mapping')
    console.log('   ✓ Temporary mapping table removed')
    
    // ========================================
    // 5. RE-ENABLE FOREIGN KEYS
    // ========================================
    
    await db.exec('PRAGMA foreign_keys = ON')
    
    // ========================================
    // 6. VERIFY INTEGRITY
    // ========================================
    
    console.log('\n5. Verifying data integrity...')
    
    const cartCount = await db.get('SELECT COUNT(*) as count FROM cart_items')
    const humanCount = await db.get('SELECT COUNT(*) as count FROM humans')
    const customerCount = await db.get('SELECT COUNT(*) as count FROM customers')
    
    console.log(`   Humans: ${humanCount.count}`)
    console.log(`   Customers: ${customerCount.count}`)
    console.log(`   Cart items: ${cartCount.count}`)
    
    // Check for orphaned cart items
    const orphaned = await db.get(`
      SELECT COUNT(*) as count FROM cart_items ci
      LEFT JOIN customers c ON ci.human_id = c.human_id
      WHERE c.human_id IS NULL
    `)
    
    if (orphaned.count > 0) {
      console.warn(`   ⚠️  WARNING: ${orphaned.count} orphaned cart items found`)
    } else {
      console.log('   ✓ No orphaned cart items')
    }
    
    console.log('\n✅ Migration 003 completed successfully!')
    console.log('\n📝 Remember to update your application code:')
    console.log('   - req.session.userId → req.session.humanId')
    console.log('   - Update all controllers and middleware')
    console.log('   - Clear existing sessions (they will be invalid)')
    
  } catch (error) {
    console.error('❌ Migration 003 failed:', error.message)
    console.error('\n⚠️  Database may be in inconsistent state!')
    console.error('   Run the down() function to rollback')
    throw error
  } finally {
    await db.close()
  }
}

export async function down() {
  console.error('❌ Cannot automatically rollback migration 003')
  console.error('This migration includes destructive changes (dropping users table)')
  console.error('\nManual rollback steps:')
  console.error('1. Restore from users_backup_TIMESTAMP table')
  console.error('2. Recreate old cart_items structure')
  console.error('3. Run migrations 002 and 001 down() functions')
  console.error('\nOr restore from database backup file: database.backup.db')
  
  throw new Error('Manual rollback required')
}

// Run if called directly with confirmation
if (import.meta.url === `file://${process.argv[1]}`) {
  const confirmArg = process.argv[2]
  
  if (confirmArg !== '--confirm') {
    console.log('⚠️  This is a BREAKING migration that will:')
    console.log('   - Drop the old users table')
    console.log('   - Update cart_items structure')
    console.log('   - Make old sessions invalid')
    console.log('\nEnsure you have:')
    console.log('   ✓ Backed up database.db')
    console.log('   ✓ Completed Phase 3 code updates')
    console.log('   ✓ Tested with new schema')
    console.log('\nRun with --confirm flag to proceed:')
    console.log('   node 003-cleanup-old-schema.js --confirm')
    process.exit(0)
  }
  
  up().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
