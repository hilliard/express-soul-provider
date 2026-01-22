# Soul Provider - AI Coding Instructions

## Project Overview

Online music store built with Express.js, SQLite, and vanilla JavaScript frontend. Session-based authentication with protected cart functionality.

**🔄 Schema Migration In Progress:** Transitioning from simple user auth to human-centric design with RBAC. See [migration-strategy.md](../db/migration-strategy.md) for details.

## Architecture

### Backend Structure

- **Entry**: [server.js](../server.js) - Express app with session middleware, static file serving, route mounting
- **Database**: SQLite via `sqlite` package, connection factory in [db/db.js](../db/db.js)
- **Pattern**: Controller-Router separation (controllers handle business logic, routes define endpoints)
- **Auth**: Session-based using `express-session` (migrating from `userId` to `humanId`)

### Key Routes

- `/api/products` - Public product listing/filtering
- `/api/auth` - Registration, login, logout
- `/api/auth/me` - Check current user session
- `/api/cart` - Protected cart operations (requires `requireAuth` middleware)

### Database Schema

#### Current (Legacy - Phase Out After Migration)

- **products**: id, title, artist, price, image, year, genre, stock
- **users**: id, name, email, username, password (bcrypt hashed)
- **cart_items**: id, user_id, product_id, quantity

#### Target (Human-Centric Design)

- **humans**: Base entity for all people (id, first_name, last_name, dob, gender, phone)
- **customers**: Role table (human_id, username, password_hash, loyalty_points)
- **employees**: Role table (human_id, job_title, department, salary)
- **artists**: Role table (human_id, stage_name, bio, website)
- **email_history**: Temporal tracking (human_id, email, effective_from, effective_to)
- **site_roles**: RBAC roles (id, role_name, description)
- **permissions**: RBAC actions (id, permission_name, resource, action)
- **human_site_roles**: Many-to-many user ↔ roles
- **site_role_permissions**: Many-to-many role ↔ permissions
- **cart_items**: Updated to reference human_id

## Critical Patterns

### Database Access

Always use `getDBConnection()` from [db/db.js](../db/db.js):

```javascript
const db = await getDBConnection();
const items = await db.all(query, params); // Multiple rows
const item = await db.get(query, params); // Single row
const result = await db.run(query, params); // INSERT/UPDATE (returns lastID)
```

### Authentication Flow

1. **Login/Register** sets `req.session.userId` (see [authController.js](../controllers/authController.js))
2. **Protected routes** use `requireAuth` middleware (see [middleware/requireAuth.js](../middleware/requireAuth.js))
3. **Frontend** checks auth via `/api/auth/me` endpoint (see [public/js/authUI.js](../public/js/authUI.js))

### Query Building Pattern

Dynamic SQL with parameterized queries (prevents SQL injection):

```javascript
// Example from productsController.js
let query = "SELECT * FROM products";
let params = [];
if (genre) {
  query += " WHERE genre = ?";
  params.push(genre);
}
const products = await db.all(query, params);
```

For LIKE searches, use wildcard pattern: `const searchPattern = \`%${search}%\``

### Cart Logic

- Adding existing item increments quantity (UPDATE)
- Adding new item inserts with quantity=1 (INSERT)
- Deletion uses composite key: `cart_items.id` AND `user_id` for security

## Development Workflows

### Database Setup (Legacy)

```bash
node createTable.js    # Create products table
node seedTable.js      # Populate with data from data.js
node logTable.js       # Debug - view table contents (edit tableName variable)
```

### Database Migration (Human-Centric Schema)

```bash
# Check migration status
node db/migrate.js status

# Run all pending migrations
node db/migrate.js up

# Rollback last migration
node db/migrate.js down

# Or run individual migrations
node db/migrations/001-create-new-schema.js
node db/migrations/002-migrate-users-to-humans.js
node db/migrations/003-cleanup-old-schema.js --confirm  # ⚠️ BREAKING
```

**Migration Phases:**

1. **001**: Creates new human-centric tables (non-breaking)
2. **002**: Migrates existing users → humans + customers + email_history
3. **003**: Updates cart_items, drops old users table (BREAKING)

See [migration-strategy.md](../db/migration-strategy.md) for complete guide.

### Running the App

```bash
npm start             # Starts server on http://localhost:5600
```

Session secret: Uses `SPIRAL_SESSION_SECRET` env var or defaults to hardcoded value.

### Project Files

- [data.js](../data.js) - Product seed data array
- [hint.md](../hint.md) - Development hints for search implementation
- [db/schema-template.sql](../db/schema-template.sql) - Reusable human-centric schema for other projects
- [db/migration-strategy.md](../db/migration-strategy.md) - Complete migration guide
- [db/migrate.js](../db/migrate.js) - Migration runner utility

## Frontend Structure

- **Static files**: [public/](../public/) served by Express
- **Services**: [productService.js](../public/js/productService.js), [cartService.js](../public/js/cartService.js) - API calls
- **UI**: Separate files for rendering (productUI.js) vs API interaction
- **Auth UI**: [authUI.js](../public/js/authUI.js) - `checkAuth()` returns user name or false

## Common Conventions

- ES6 modules (`"type": "module"` in package.json)
- Named exports for controllers/routers
- Trim user inputs before validation
- Return early with error responses (guard clauses)
- Use `parseInt(id, 10)` and check `isNaN()` for numeric route params
- 401 for auth errors, 403 for permission denied, 400 for validation, 500 for server errors
- 204 No Content for successful DELETE operations

## Migration Considerations

### Session Management (Post-Migration)

After Phase 3 migration, update all controllers:

- `req.session.userId` → `req.session.humanId`
- Existing sessions will be invalidated (users must re-login)

### Permission Checking (Enhanced Auth)

Use `requirePermission()` middleware for granular access:

```javascript
// Example: Protect admin-only routes
import { requirePermission } from "../middleware/requireAuth.js";
router.delete(
  "/products/:id",
  requirePermission("products.delete"),
  deleteProduct,
);
```

### Temporal Data Queries

For email/address history, always query with `effective_to IS NULL` for current records:

```javascript
const currentEmail = await db.get(
  "SELECT email FROM email_history WHERE human_id = ? AND effective_to IS NULL",
  [humanId],
);
```

### Multiple Roles

Humans can have multiple roles simultaneously (customer + employee). Query all roles:

```javascript
const roles = await db.all(
  `SELECT sr.role_name FROM human_site_roles hsr
   JOIN site_roles sr ON hsr.site_role_id = sr.id
   WHERE hsr.human_id = ?`,
  [humanId],
);
```

## Portable Schema Pattern

The [schema-template.sql](../db/schema-template.sql) provides a **reusable pattern** for other projects:

- ✅ Human-centric base entity
- ✅ Class table inheritance for roles (customers, employees, artists)
- ✅ Temporal tracking (email/address history)
- ✅ RBAC with permissions
- ✅ Polymorphic associations (addressable pattern)
- ✅ SQLite-compatible, migrates easily to PostgreSQL/MySQL
- 401 for auth errors, 400 for validation errors, 500 for server errors
- 204 No Content for successful DELETE operations
