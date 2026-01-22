import { getDBConnection } from '../db.js'

/**
 * Migration 001: Create New Human-Centric Schema
 * This is non-breaking - creates new tables alongside existing ones
 */

export async function up() {
  const db = await getDBConnection()
  
  try {
    console.log('Starting migration 001: Creating new schema...')
    
    await db.exec('PRAGMA foreign_keys = ON')
    
    // ========================================
    // CORE TABLES
    // ========================================
    
    console.log('Creating humans table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS humans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE,
        gender TEXT CHECK(gender IN ('M', 'F', 'Other', 'PreferNotToSay')),
        phone_number TEXT,
        is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_humans_name ON humans(last_name, first_name)')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_humans_active ON humans(is_active)')
    
    console.log('Creating email_history table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS email_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        human_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0 CHECK(is_verified IN (0, 1)),
        effective_from TEXT DEFAULT CURRENT_TIMESTAMP,
        effective_to TEXT,
        change_reason TEXT CHECK(change_reason IN ('initial', 'user_updated', 'admin_updated', 'verification')),
        FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
      )
    `)
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_email_human ON email_history(human_id)')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_email_current ON email_history(human_id, effective_to) WHERE effective_to IS NULL')
    await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_email_unique_active ON email_history(email) WHERE effective_to IS NULL')
    
    // ========================================
    // ADDRESS SYSTEM (Polymorphic)
    // ========================================
    
    console.log('Creating addresses table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        street_line1 TEXT NOT NULL,
        street_line2 TEXT,
        city TEXT NOT NULL,
        state_province TEXT,
        postal_code TEXT,
        country TEXT NOT NULL DEFAULT 'USA',
        address_type TEXT CHECK(address_type IN ('billing', 'shipping', 'business', 'home')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_addresses_postal ON addresses(postal_code)')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_addresses_city ON addresses(city)')
    
    console.log('Creating addressable table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS addressable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('human', 'supplier', 'business')),
        entity_id INTEGER NOT NULL,
        is_primary INTEGER DEFAULT 0 CHECK(is_primary IN (0, 1)),
        effective_from TEXT DEFAULT CURRENT_TIMESTAMP,
        effective_to TEXT,
        FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE
      )
    `)
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_addressable_entity ON addressable(entity_type, entity_id)')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_addressable_current ON addressable(effective_to) WHERE effective_to IS NULL')
    
    // ========================================
    // ROLE TABLES
    // ========================================
    
    console.log('Creating customers table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        human_id INTEGER PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        customer_since TEXT DEFAULT CURRENT_TIMESTAMP,
        loyalty_points INTEGER DEFAULT 0,
        FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
      )
    `)
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_customers_username ON customers(username)')
    
    console.log('Creating employees table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        human_id INTEGER PRIMARY KEY,
        employee_number TEXT UNIQUE,
        job_title TEXT,
        department TEXT,
        salary REAL,
        hire_date TEXT DEFAULT CURRENT_TIMESTAMP,
        termination_date TEXT,
        FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
      )
    `)
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number)')
    
    console.log('Creating artists table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS artists (
        human_id INTEGER PRIMARY KEY,
        stage_name TEXT UNIQUE,
        bio TEXT,
        website TEXT,
        debut_year INTEGER,
        FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
      )
    `)
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_artists_stage_name ON artists(stage_name)')
    
    // ========================================
    // RBAC TABLES
    // ========================================
    
    console.log('Creating site_roles table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS site_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    console.log('Creating permissions table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        permission_name TEXT NOT NULL UNIQUE,
        resource TEXT,
        action TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    await db.exec('CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource, action)')
    
    console.log('Creating human_site_roles table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS human_site_roles (
        human_id INTEGER NOT NULL,
        site_role_id INTEGER NOT NULL,
        assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
        assigned_by INTEGER,
        expires_at TEXT,
        PRIMARY KEY (human_id, site_role_id),
        FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE,
        FOREIGN KEY (site_role_id) REFERENCES site_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES humans(id)
      )
    `)
    
    console.log('Creating site_role_permissions table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS site_role_permissions (
        site_role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        PRIMARY KEY (site_role_id, permission_id),
        FOREIGN KEY (site_role_id) REFERENCES site_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      )
    `)
    
    // ========================================
    // SEED DEFAULT ROLES & PERMISSIONS
    // ========================================
    
    console.log('Seeding default site roles...')
    await db.run(`INSERT OR IGNORE INTO site_roles (role_name, description) VALUES ('admin', 'Full system access')`)
    await db.run(`INSERT OR IGNORE INTO site_roles (role_name, description) VALUES ('customer', 'Regular customer access')`)
    await db.run(`INSERT OR IGNORE INTO site_roles (role_name, description) VALUES ('employee', 'Staff member access')`)
    await db.run(`INSERT OR IGNORE INTO site_roles (role_name, description) VALUES ('artist', 'Artist portal access')`)
    
    console.log('Seeding default permissions...')
    const permissions = [
      ['products.create', 'products', 'create', 'Can create products'],
      ['products.read', 'products', 'read', 'Can view products'],
      ['products.update', 'products', 'update', 'Can edit products'],
      ['products.delete', 'products', 'delete', 'Can delete products'],
      ['orders.create', 'orders', 'create', 'Can create orders'],
      ['orders.read', 'orders', 'read', 'Can view orders'],
      ['users.manage', 'users', 'manage', 'Can manage user accounts'],
      ['cart.manage', 'cart', 'manage', 'Can manage shopping cart']
    ]
    
    for (const [name, resource, action, desc] of permissions) {
      await db.run(
        `INSERT OR IGNORE INTO permissions (permission_name, resource, action, description) VALUES (?, ?, ?, ?)`,
        [name, resource, action, desc]
      )
    }
    
    console.log('Assigning permissions to roles...')
    // Admin gets all permissions
    await db.exec(`
      INSERT OR IGNORE INTO site_role_permissions (site_role_id, permission_id)
      SELECT sr.id, p.id FROM site_roles sr, permissions p
      WHERE sr.role_name = 'admin'
    `)
    
    // Customer gets limited permissions
    await db.exec(`
      INSERT OR IGNORE INTO site_role_permissions (site_role_id, permission_id)
      SELECT sr.id, p.id FROM site_roles sr, permissions p
      WHERE sr.role_name = 'customer' 
      AND p.permission_name IN ('products.read', 'orders.create', 'orders.read', 'cart.manage')
    `)
    
    console.log('✅ Migration 001 completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration 001 failed:', error.message)
    throw error
  } finally {
    await db.close()
  }
}

export async function down() {
  const db = await getDBConnection()
  
  try {
    console.log('Rolling back migration 001...')
    
    // Drop in reverse order to respect foreign keys
    await db.exec('DROP TABLE IF EXISTS site_role_permissions')
    await db.exec('DROP TABLE IF EXISTS human_site_roles')
    await db.exec('DROP TABLE IF EXISTS permissions')
    await db.exec('DROP TABLE IF EXISTS site_roles')
    await db.exec('DROP TABLE IF EXISTS artists')
    await db.exec('DROP TABLE IF EXISTS employees')
    await db.exec('DROP TABLE IF EXISTS customers')
    await db.exec('DROP TABLE IF EXISTS addressable')
    await db.exec('DROP TABLE IF EXISTS addresses')
    await db.exec('DROP TABLE IF EXISTS email_history')
    await db.exec('DROP TABLE IF EXISTS humans')
    
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
