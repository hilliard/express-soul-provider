# Database Migrations

This directory contains database migration scripts for transitioning from the simple user schema to a human-centric design with RBAC.

## Quick Start

```bash
# 1. Backup your database
cp database.db database.backup.db

# 2. Check current status
node db/migrate.js status

# 3. Run migrations
node db/migrate.js up

# 4. Verify
node logTable.js
```

## Migration Files

### 001-create-new-schema.js

Creates all new tables alongside existing ones (non-breaking):

- humans, customers, employees, artists
- email_history (temporal tracking)
- site_roles, permissions, RBAC tables

**Safe to run** - Does not modify existing tables or data.

### 002-migrate-users-to-humans.js

Migrates existing user data to new schema:

- Splits user.name → first_name, last_name
- Creates humans records
- Creates customers records (auth credentials)
- Creates email_history records
- Assigns default 'customer' role

**Safe to run** - Does not delete existing data.

### 003-cleanup-old-schema.js ⚠️

Finalizes migration (BREAKING):

- Updates cart_items.user_id → human_id
- Drops old users table
- Enables foreign key constraints

**BREAKING** - Must update application code first!
Run with: `node db/migrations/003-cleanup-old-schema.js --confirm`

## Migration Runner

The `migrate.js` utility tracks which migrations have been executed:

```bash
# Run all pending migrations
node db/migrate.js up

# Rollback last migration
node db/migrate.js down

# Check status
node db/migrate.js status
```

### Status Output

```
Migration Status
────────────────────────────────────────────────────────────
✅ Executed  001: create-new-schema
✅ Executed  002: migrate-users-to-humans
⏸️  Pending   003: cleanup-old-schema
```

## Migration Phases

### Phase 1: Schema Creation (Day 1)

```bash
node db/migrations/001-create-new-schema.js
```

- Creates new tables
- Seeds default roles and permissions
- **No impact on existing code**

### Phase 2: Data Migration (Day 1-2)

```bash
node db/migrations/002-migrate-users-to-humans.js
```

- Copies user data to new schema
- Creates mapping table for Phase 3
- **Existing code still works**

### Phase 3: Code Updates (Day 2-5)

Update application code:

- ✏️ [controllers/authController.js](../controllers/authController.js)
- ✏️ [controllers/cartController.js](../controllers/cartController.js)
- ✏️ [controllers/meController.js](../controllers/meController.js)
- ✏️ [middleware/requireAuth.js](../middleware/requireAuth.js)

See [migration-strategy.md](migration-strategy.md) for detailed code changes.

### Phase 4: Cleanup (Day 5+)

```bash
node db/migrations/003-cleanup-old-schema.js --confirm
```

- Drops old users table
- Finalizes schema
- **BREAKING - Code must be updated first!**

## Rollback

### Auto-Rollback (Phases 1-2)

```bash
node db/migrate.js down
```

### Manual Rollback (Phase 3)

Migration 003 creates a backup table before dropping users:

```sql
-- Find backup table
SELECT name FROM sqlite_master
WHERE type='table' AND name LIKE 'users_backup_%';

-- Restore (example)
CREATE TABLE users AS SELECT * FROM users_backup_1737586800000;
```

Or restore from filesystem backup:

```bash
cp database.backup.db database.db
```

## Testing Migrations

### Test on Empty Database

```bash
# Create test database
cp database.db database.test.db
rm database.db
node createTable.js
node seedTable.js

# Run migrations
node db/migrate.js up

# Verify
node logTable.js
```

### Test on Production Copy

```bash
# Copy production DB
cp database.db database.prod-test.db

# Update db.js temporarily to use test DB
# Run migrations
node db/migrate.js up
```

## Common Issues

### Issue: Foreign key constraint failed

**Solution:** Ensure `PRAGMA foreign_keys = ON` is set.

### Issue: Migration 002 fails - users table not found

**Solution:** Run migration 001 first or ensure users table exists.

### Issue: Migration 003 - user_human_mapping not found

**Solution:** Run migration 002 first.

### Issue: Existing sessions don't work after migration

**Expected:** Sessions use `userId`, new code uses `humanId`. Users must re-login.

## Verification Queries

After each migration, verify data integrity:

```bash
# After Migration 001
node logTable.js  # Check new tables exist

# After Migration 002
sqlite3 database.db "SELECT COUNT(*) FROM humans"
sqlite3 database.db "SELECT COUNT(*) FROM customers"
sqlite3 database.db "SELECT COUNT(*) FROM users"  # Should match

# After Migration 003
sqlite3 database.db "SELECT COUNT(*) FROM cart_items"
sqlite3 database.db "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"  # Should be empty
```

## Next Steps

1. ✅ Review [migration-strategy.md](migration-strategy.md)
2. ✅ Review [schema-template.sql](schema-template.sql)
3. ⏸️ Backup production database
4. ⏸️ Run migration 001 and 002
5. ⏸️ Update application code
6. ⏸️ Test thoroughly
7. ⏸️ Run migration 003 (breaking)

## References

- [Migration Strategy Guide](migration-strategy.md) - Complete walkthrough
- [Schema Template](schema-template.sql) - Reusable for other projects
- [Copilot Instructions](../.github/copilot-instructions.md) - Updated with migration info
