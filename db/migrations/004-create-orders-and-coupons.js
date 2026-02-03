/**
 * Migration 004: Create Orders and Coupons System
 * 
 * This migration adds:
 * 1. orders table - tracks customer orders with status and totals
 * 2. order_items table - line items for each order (products, quantities, prices)
 * 3. coupons table - discount codes created by vendors/artists
 * 4. order_coupons table - links applied coupons to orders
 * 
 * Cart items remain separate as "draft orders" until checkout
 */

import { getDBConnection } from '../db.js'

export async function up() {
  const db = await getDBConnection()
  
  try {
    console.log('Creating orders table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        human_id INTEGER NOT NULL,
        order_number TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' 
          CHECK(status IN ('pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')),
        subtotal REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        FOREIGN KEY (human_id) REFERENCES customers(human_id) ON DELETE RESTRICT
      )
    `)
    
    await db.exec(`
      CREATE INDEX idx_orders_human ON orders(human_id);
      CREATE INDEX idx_orders_status ON orders(status);
      CREATE INDEX idx_orders_created ON orders(created_at);
      CREATE INDEX idx_orders_number ON orders(order_number);
    `)
    
    console.log('Creating order_items table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        artist_human_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
        FOREIGN KEY (artist_human_id) REFERENCES artists(human_id) ON DELETE SET NULL
      )
    `)
    
    await db.exec(`
      CREATE INDEX idx_order_items_order ON order_items(order_id);
      CREATE INDEX idx_order_items_product ON order_items(product_id);
      CREATE INDEX idx_order_items_artist ON order_items(artist_human_id);
    `)
    
    console.log('Creating coupons table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed_amount')),
        discount_value REAL NOT NULL,
        min_purchase_amount REAL DEFAULT 0,
        max_discount_amount REAL,
        creator_type TEXT NOT NULL CHECK(creator_type IN ('admin', 'vendor', 'artist')),
        creator_id INTEGER NOT NULL,
        valid_from TEXT DEFAULT CURRENT_TIMESTAMP,
        valid_until TEXT,
        max_uses INTEGER,
        times_used INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES humans(id) ON DELETE CASCADE
      )
    `)
    
    await db.exec(`
      CREATE UNIQUE INDEX idx_coupons_code ON coupons(code);
      CREATE INDEX idx_coupons_active ON coupons(is_active, valid_from, valid_until);
      CREATE INDEX idx_coupons_creator ON coupons(creator_type, creator_id);
    `)
    
    console.log('Creating order_coupons table...')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS order_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        coupon_id INTEGER NOT NULL,
        discount_applied REAL NOT NULL,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE RESTRICT
      )
    `)
    
    await db.exec(`
      CREATE INDEX idx_order_coupons_order ON order_coupons(order_id);
      CREATE INDEX idx_order_coupons_coupon ON order_coupons(coupon_id);
    `)
    
    console.log('✅ Orders and coupons system created successfully')
    
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  } finally {
    await db.close()
  }
}

export async function down() {
  const db = await getDBConnection()
  
  try {
    console.log('Rolling back orders and coupons system...')
    
    await db.exec('DROP TABLE IF EXISTS order_coupons')
    await db.exec('DROP TABLE IF EXISTS order_items')
    await db.exec('DROP TABLE IF EXISTS orders')
    await db.exec('DROP TABLE IF EXISTS coupons')
    
    console.log('✅ Rollback complete')
    
  } catch (error) {
    console.error('Rollback failed:', error)
    throw error
  } finally {
    await db.close()
  }
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  up().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
