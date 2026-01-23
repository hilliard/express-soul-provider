/**
 * Migration Runner
 * Executes database migrations in sequence
 * 
 * Usage:
 *   node db/migrate.js              - Run all pending migrations
 *   node db/migrate.js up           - Run all pending migrations
 *   node db/migrate.js down         - Rollback last migration
 *   node db/migrate.js status       - Show migration status
 */

import { getDBConnection } from './db.js'
import * as migration001 from './migrations/001-create-new-schema.js'
import * as migration002 from './migrations/002-migrate-users-to-humans.js'
import * as migration003 from './migrations/003-cleanup-old-schema.js'
import * as migration004 from './migrations/004-create-orders-and-coupons.js'
import * as migration005 from './migrations/005-add-songs-and-product-types.js'

const migrations = [
  { id: '001', name: 'create-new-schema', module: migration001 },
  { id: '002', name: 'migrate-users-to-humans', module: migration002 },
  { id: '003', name: 'cleanup-old-schema', module: migration003 },
  { id: '004', name: 'create-orders-and-coupons', module: migration004 },
  { id: '005', name: 'add-songs-and-product-types', module: migration005 }
]

async function createMigrationsTable() {
  const db = await getDBConnection()
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await db.close()
}

async function getExecutedMigrations() {
  const db = await getDBConnection()
  const executed = await db.all('SELECT id FROM migrations ORDER BY id')
  await db.close()
  return executed.map(m => m.id)
}

async function recordMigration(id, name) {
  const db = await getDBConnection()
  await db.run('INSERT INTO migrations (id, name) VALUES (?, ?)', [id, name])
  await db.close()
}

async function removeMigrationRecord(id) {
  const db = await getDBConnection()
  await db.run('DELETE FROM migrations WHERE id = ?', [id])
  await db.close()
}

async function runMigrations() {
  await createMigrationsTable()
  
  const executed = await getExecutedMigrations()
  const pending = migrations.filter(m => !executed.includes(m.id))
  
  if (pending.length === 0) {
    console.log('✅ All migrations are up to date')
    return
  }
  
  console.log(`Found ${pending.length} pending migration(s)\n`)
  
  for (const migration of pending) {
    console.log(`Running migration ${migration.id}: ${migration.name}`)
    console.log('─'.repeat(60))
    
    try {
      await migration.module.up()
      await recordMigration(migration.id, migration.name)
      console.log(`✅ Migration ${migration.id} completed\n`)
    } catch (error) {
      console.error(`\n❌ Migration ${migration.id} failed:`, error.message)
      console.error('Stopping migration process.')
      process.exit(1)
    }
  }
  
  console.log('✅ All migrations completed successfully')
}

async function rollbackLastMigration() {
  await createMigrationsTable()
  
  const executed = await getExecutedMigrations()
  
  if (executed.length === 0) {
    console.log('No migrations to rollback')
    return
  }
  
  const lastId = executed[executed.length - 1]
  const migration = migrations.find(m => m.id === lastId)
  
  if (!migration) {
    console.error(`Migration ${lastId} not found in migration list`)
    process.exit(1)
  }
  
  console.log(`Rolling back migration ${migration.id}: ${migration.name}`)
  console.log('─'.repeat(60))
  
  try {
    await migration.module.down()
    await removeMigrationRecord(migration.id)
    console.log(`✅ Migration ${migration.id} rolled back\n`)
  } catch (error) {
    console.error(`\n❌ Rollback failed:`, error.message)
    process.exit(1)
  }
}

async function showStatus() {
  await createMigrationsTable()
  
  const executed = await getExecutedMigrations()
  
  console.log('Migration Status')
  console.log('─'.repeat(60))
  
  for (const migration of migrations) {
    const status = executed.includes(migration.id) ? '✅ Executed' : '⏸️  Pending'
    console.log(`${status}  ${migration.id}: ${migration.name}`)
  }
  
  console.log()
}

// Main execution
const command = process.argv[2] || 'up'

switch (command) {
  case 'up':
    runMigrations().catch(err => {
      console.error(err)
      process.exit(1)
    })
    break
    
  case 'down':
    rollbackLastMigration().catch(err => {
      console.error(err)
      process.exit(1)
    })
    break
    
  case 'status':
    showStatus().catch(err => {
      console.error(err)
      process.exit(1)
    })
    break
    
  default:
    console.error(`Unknown command: ${command}`)
    console.log('Usage: node db/migrate.js [up|down|status]')
    process.exit(1)
}
