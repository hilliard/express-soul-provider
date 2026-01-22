# Migration Strategy: Soul Provider to Human-Centric Schema

## Overview

This document outlines the step-by-step migration from the current simple schema (users, products, cart_items) to the new human-centric design with role-based access control.

## Current Schema (v1)

```sql
users (id, name, email, username, password)
products (id, title, artist, price, image, year, genre, stock)
cart_items (id, user_id, product_id, quantity)
```

## Target Schema (v2)

```sql
humans (base entity for all people)
customers (extends humans - auth + customer data)
employees (extends humans - job data)
artists (extends humans - artist data)
email_history (temporal email tracking)
addresses (physical addresses)
addressable (polymorphic address links)
site_roles (role definitions)
permissions (action definitions)
human_site_roles (user ↔ role many-to-many)
site_role_permissions (role ↔ permission many-to-many)
sessions (authentication sessions)
products (minimal changes)
cart_items (links to customers.human_id)
```

## Migration Phases

### Phase 1: Create New Tables (Non-Breaking)

**Goal:** Add new schema alongside existing tables

```sql
-- Run: node db/migrations/001-create-new-schema.js
```

Creates:

- `humans`
- `email_history`
- `addresses`
- `addressable`
- `customers`
- `employees`
- `artists`
- `site_roles`
- `permissions`
- `human_site_roles`
- `site_role_permissions`
- `sessions`

### Phase 2: Data Migration

**Goal:** Copy existing `users` data into new schema

```sql
-- Run: node db/migrations/002-migrate-users-to-humans.js
```

**Steps:**

1. **Split user.name** → `first_name`, `last_name`
2. **Create humans records** from users
3. **Create customers records** (human_id, username, password_hash)
4. **Create email_history records** (current email with effective_to = NULL)
5. **Assign default 'customer' site_role** to all
6. **Update cart_items.user_id** → still references original user.id temporarily

**Data Mapping:**

```javascript
// Example transformation
const user = { id: 1, name: 'John Doe', email: 'john@example.com', username: 'john_doe', password: 'hash' }

// 1. Create human
INSERT INTO humans (first_name, last_name)
VALUES ('John', 'Doe') -- Returns human_id: 101

// 2. Create customer
INSERT INTO customers (human_id, username, password_hash)
VALUES (101, 'john_doe', 'hash')

// 3. Create email record
INSERT INTO email_history (human_id, email, effective_from, effective_to, change_reason)
VALUES (101, 'john@example.com', CURRENT_TIMESTAMP, NULL, 'initial')

// 4. Assign customer role
INSERT INTO human_site_roles (human_id, site_role_id)
SELECT 101, id FROM site_roles WHERE role_name = 'customer'
```

### Phase 3: Update Application Code

**Goal:** Switch controllers/middleware to use new schema

**Changes Required:**

#### 3.1 Database Helper (`db/db.js`)

No changes needed - same connection pattern.

#### 3.2 Auth Controller (`controllers/authController.js`)

**registerUser():**

```javascript
// OLD:
const result = await db.run(
  "INSERT INTO users (name, email, username, password) VALUES (?, ?, ?, ?)",
  [name, email, username, hashed],
);
req.session.userId = result.lastID;

// NEW:
// 1. Split name into first/last
const [firstName, ...lastNameParts] = name.trim().split(" ");
const lastName = lastNameParts.join(" ") || firstName;

// 2. Create human
const humanResult = await db.run(
  "INSERT INTO humans (first_name, last_name) VALUES (?, ?)",
  [firstName, lastName],
);
const humanId = humanResult.lastID;

// 3. Create customer
await db.run(
  "INSERT INTO customers (human_id, username, password_hash) VALUES (?, ?, ?)",
  [humanId, username, hashed],
);

// 4. Add email to history
await db.run(
  `INSERT INTO email_history (human_id, email, effective_to, change_reason) 
   VALUES (?, ?, NULL, 'initial')`,
  [humanId, email],
);

// 5. Assign customer role
const roleResult = await db.get(
  "SELECT id FROM site_roles WHERE role_name = 'customer'",
);
await db.run(
  "INSERT INTO human_site_roles (human_id, site_role_id) VALUES (?, ?)",
  [humanId, roleResult.id],
);

req.session.humanId = humanId; // Changed from userId
```

**loginUser():**

```javascript
// OLD:
const user = await db.get(
  'SELECT * FROM users WHERE username = ?',
  [username]
)
req.session.userId = user.id

// NEW:
const customer = await db.get(
  'SELECT c.human_id, c.password_hash, h.first_name
   FROM customers c
   JOIN humans h ON c.human_id = h.id
   WHERE c.username = ?',
  [username]
)
req.session.humanId = customer.human_id
```

#### 3.3 Me Controller (`controllers/meController.js`)

```javascript
// OLD:
if (!req.session.userId) {
  return res.json({ isLoggedIn: false });
}
const user = await db.get("SELECT name FROM users WHERE id = ?", [
  req.session.userId,
]);
res.json({ isLoggedIn: true, name: user.name });

// NEW:
if (!req.session.humanId) {
  return res.json({ isLoggedIn: false });
}
const human = await db.get(
  `SELECT first_name || ' ' || last_name AS name 
   FROM humans WHERE id = ?`,
  [req.session.humanId],
);
res.json({ isLoggedIn: true, name: human.name });
```

#### 3.4 Cart Controller (`controllers/cartController.js`)

Replace all `req.session.userId` with `req.session.humanId`:

```javascript
// OLD:
const userId = req.session.userId;
const existing = await db.get(
  "SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?",
  [userId, productId],
);

// NEW:
const humanId = req.session.humanId;
const existing = await db.get(
  "SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?",
  [humanId, productId],
);
// Note: cart_items.user_id column will be renamed to human_id in Phase 4
```

#### 3.5 Middleware (`middleware/requireAuth.js`)

```javascript
// OLD:
if (!req.session.userId) {
  return res.status(401).json({ error: "Unauthorized" });
}

// NEW:
if (!req.session.humanId) {
  return res.status(401).json({ error: "Unauthorized" });
}

// ENHANCED with permission checking:
export async function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.session.humanId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = await getDBConnection();

    // Check if human has the required permission through any role
    const hasPermission = await db.get(
      `SELECT 1 FROM human_site_roles hsr
       JOIN site_role_permissions srp ON hsr.site_role_id = srp.site_role_id
       JOIN permissions p ON srp.permission_id = p.id
       WHERE hsr.human_id = ? 
       AND p.permission_name = ?
       AND (hsr.expires_at IS NULL OR hsr.expires_at > datetime('now'))`,
      [req.session.humanId, permissionName],
    );

    if (!hasPermission) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}
```

### Phase 4: Schema Cleanup (Breaking Changes)

**Goal:** Remove old tables, finalize constraints

```sql
-- Run: node db/migrations/003-cleanup-old-schema.js
```

1. **Rename cart_items.user_id** → `human_id`
2. **Add foreign key** cart_items.human_id → customers.human_id
3. **Drop old users table** (after backup)
4. **Update products.artist** (TEXT) → optionally link to artists table via new `artist_id INTEGER`

### Phase 5: Optional Enhancements

#### 5.1 Link Products to Artists

```sql
ALTER TABLE products ADD COLUMN artist_id INTEGER;
ALTER TABLE products ADD FOREIGN KEY (artist_id) REFERENCES artists(human_id);
-- Keep artist TEXT for now, gradually populate artist_id
```

#### 5.2 Add Order History

```sql
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    human_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT CHECK(status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (human_id) REFERENCES customers(human_id)
);

CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

## Rollback Strategy

Each migration file should include a `down()` function:

```javascript
// migrations/001-create-new-schema.js
export async function up(db) {
  // Create tables...
}

export async function down(db) {
  await db.exec("DROP TABLE IF EXISTS human_site_roles");
  await db.exec("DROP TABLE IF EXISTS site_role_permissions");
  // ... drop all new tables in reverse order
}
```

## Testing Checklist

### Phase 1-2 (Data Migration)

- [ ] All existing users migrated to humans + customers
- [ ] Email history created for all users
- [ ] Customer role assigned to all
- [ ] No data loss (row counts match)

### Phase 3 (Code Update)

- [ ] User registration creates human + customer + email_history
- [ ] Login works with new schema
- [ ] Session stores humanId
- [ ] Cart operations work
- [ ] `/api/auth/me` returns correct user data

### Phase 4 (Cleanup)

- [ ] Old users table backed up
- [ ] Foreign keys working
- [ ] No orphaned records

## Migration Commands

```bash
# 1. Backup current database
cp database.db database.backup.db

# 2. Run migrations
node db/migrations/001-create-new-schema.js
node db/migrations/002-migrate-users-to-humans.js

# 3. Test with old code (should still work)
npm start

# 4. Update application code (Phase 3)
# Deploy new controllers/middleware

# 5. Cleanup
node db/migrations/003-cleanup-old-schema.js

# 6. Verify
node logTable.js  # Check humans, customers, email_history
```

## Benefits After Migration

✅ **Flexible roles**: Users can be customers AND employees  
✅ **Email history**: Track email changes over time  
✅ **Scalable auth**: RBAC with granular permissions  
✅ **Future-proof**: Easy to add suppliers, contractors, etc.  
✅ **Portable**: Same pattern works across all your projects  
✅ **Audit trail**: Know who changed what and when

## Considerations

⚠️ **Breaking changes** in Phase 4 - coordinate with frontend  
⚠️ **Session keys change** - existing sessions will be invalidated  
⚠️ **More complex queries** - joins required for user data  
⚠️ **SQLite limitations** - temporal queries slower than PostgreSQL

## Next Steps

1. Review this migration plan
2. Create backup of current database
3. Run Phase 1 migration scripts
4. Test with existing code (should be non-breaking)
5. Update application code incrementally
6. Complete Phase 4 cleanup when ready
