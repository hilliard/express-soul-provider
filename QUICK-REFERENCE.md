# Human-Centric Database Pattern - Quick Reference

## Schema at a Glance

```
humans                    (base entity: first_name, last_name, dob, gender, phone)
  ├─ customers           (human_id, username, password_hash, loyalty_points)
  ├─ employees           (human_id, job_title, department, salary)
  └─ artists             (human_id, stage_name, bio, website)

email_history            (human_id, email, effective_from, effective_to)
addresses                (street, city, state, postal_code, country)
addressable              (address_id, entity_type, entity_id, effective_from/to)

site_roles               (role_name, description)
permissions              (permission_name, resource, action)
human_site_roles         (human_id ↔ site_role_id)
site_role_permissions    (site_role_id ↔ permission_id)
```

## Common Queries

### Get Current Email

```javascript
const email = await db.get(
  "SELECT email FROM email_history WHERE human_id = ? AND effective_to IS NULL",
  [humanId],
);
```

### Get User's Roles

```javascript
const roles = await db.all(
  `SELECT sr.role_name FROM human_site_roles hsr
   JOIN site_roles sr ON hsr.site_role_id = sr.id
   WHERE hsr.human_id = ?`,
  [humanId],
);
```

### Check Permission

```javascript
const hasPermission = await db.get(
  `SELECT 1 FROM human_site_roles hsr
   JOIN site_role_permissions srp ON hsr.site_role_id = srp.site_role_id
   JOIN permissions p ON srp.permission_id = p.id
   WHERE hsr.human_id = ? AND p.permission_name = ?`,
  [humanId, "products.delete"],
);
```

### Get Full User Profile

```javascript
const user = await db.get(
  `SELECT 
    h.id,
    h.first_name || ' ' || h.last_name AS full_name,
    e.email,
    c.username,
    c.loyalty_points
   FROM humans h
   JOIN customers c ON h.id = c.human_id
   LEFT JOIN email_history e ON h.id = e.human_id AND e.effective_to IS NULL
   WHERE h.id = ?`,
  [humanId],
);
```

### Create User with Email History

```javascript
// 1. Create human
const human = await db.run(
  "INSERT INTO humans (first_name, last_name) VALUES (?, ?)",
  [firstName, lastName],
);

// 2. Create customer
await db.run(
  "INSERT INTO customers (human_id, username, password_hash) VALUES (?, ?, ?)",
  [human.lastID, username, passwordHash],
);

// 3. Add email
await db.run(
  `INSERT INTO email_history (human_id, email, effective_to, change_reason) 
   VALUES (?, ?, NULL, 'initial')`,
  [human.lastID, email],
);

// 4. Assign role
const role = await db.get(
  "SELECT id FROM site_roles WHERE role_name = 'customer'",
);
await db.run(
  "INSERT INTO human_site_roles (human_id, site_role_id) VALUES (?, ?)",
  [human.lastID, role.id],
);
```

### Update Email (with history)

```javascript
// 1. Close old email record
await db.run(
  `UPDATE email_history 
   SET effective_to = datetime('now'), change_reason = 'user_updated'
   WHERE human_id = ? AND effective_to IS NULL`,
  [humanId],
);

// 2. Insert new email
await db.run(
  `INSERT INTO email_history (human_id, email, effective_to, change_reason)
   VALUES (?, ?, NULL, 'user_updated')`,
  [humanId, newEmail],
);
```

## Migration Commands

```bash
# Status check
node db/migrate.js status

# Run all pending
node db/migrate.js up

# Rollback last
node db/migrate.js down

# Individual migrations
node db/migrations/001-create-new-schema.js
node db/migrations/002-migrate-users-to-humans.js
node db/migrations/003-cleanup-old-schema.js --confirm
```

## Session Management Changes

### Before (Legacy)

```javascript
req.session.userId = user.id;
const userId = req.session.userId;
```

### After (Human-Centric)

```javascript
req.session.humanId = customer.human_id;
const humanId = req.session.humanId;
```

## Middleware Patterns

### Basic Auth Check

```javascript
export function requireAuth(req, res, next) {
  if (!req.session.humanId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
```

### Permission Check

```javascript
export function requirePermission(permissionName) {
  return async (req, res, next) => {
    if (!req.session.humanId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = await getDBConnection();
    const hasPermission = await db.get(
      `SELECT 1 FROM human_site_roles hsr
       JOIN site_role_permissions srp ON hsr.site_role_id = srp.site_role_id
       JOIN permissions p ON srp.permission_id = p.id
       WHERE hsr.human_id = ? AND p.permission_name = ?`,
      [req.session.humanId, permissionName],
    );

    if (!hasPermission) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

// Usage
router.delete(
  "/products/:id",
  requirePermission("products.delete"),
  deleteProduct,
);
```

## Key Files

| File                                                                    | Purpose                         |
| ----------------------------------------------------------------------- | ------------------------------- |
| [db/schema-template.sql](db/schema-template.sql)                        | Reusable schema for ANY project |
| [db/migration-strategy.md](db/migration-strategy.md)                    | Complete migration guide        |
| [db/migrate.js](db/migrate.js)                                          | Migration runner                |
| [db/migrations/001-\*.js](db/migrations/001-create-new-schema.js)       | Create new tables               |
| [db/migrations/002-\*.js](db/migrations/002-migrate-users-to-humans.js) | Migrate data                    |
| [db/migrations/003-\*.js](db/migrations/003-cleanup-old-schema.js)      | Drop old tables ⚠️              |

## Troubleshooting

### "Foreign key constraint failed"

```bash
# Enable foreign keys
sqlite3 database.db "PRAGMA foreign_keys = ON"
```

### "users table not found" (after migration 003)

**Expected** - Old table was dropped. Use `humans` + `customers` instead.

### "Sessions don't work after migration"

**Expected** - Session key changed (`userId` → `humanId`). Users must re-login.

### Check migration status

```bash
sqlite3 database.db "SELECT * FROM migrations"
```

## Benefits

✅ **Multiple roles** - Customer + employee in one person  
✅ **History tracking** - Email/address changes over time  
✅ **Granular permissions** - RBAC with fine control  
✅ **Scalable** - Easy to add suppliers, contractors  
✅ **Portable** - Same pattern across projects  
✅ **Audit trail** - Who changed what when

## Copy This Pattern

Use [db/schema-template.sql](db/schema-template.sql) in ANY project:

1. Copy file to new project
2. Customize role tables (vendors, contractors, etc.)
3. Adjust permissions for your domain
4. Run schema: `sqlite3 database.db < schema-template.sql`
5. Enjoy consistent, scalable design!
