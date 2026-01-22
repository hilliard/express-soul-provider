# Database Schema Diagram

## Human-Centric Design Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HUMANS (Base Entity)                            │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ id, first_name, last_name, dob, gender, phone, is_active       │    │
│  └────────────────────────────────────────────────────────────────┘    │
└────────┬───────────────────┬───────────────────┬──────────────────────┘
         │                   │                   │
         │ 1:1               │ 1:1               │ 1:1
         ▼                   ▼                   ▼
    ┌──────────┐       ┌───────────┐      ┌──────────┐
    │CUSTOMERS │       │ EMPLOYEES │      │ ARTISTS  │
    ├──────────┤       ├───────────┤      ├──────────┤
    │human_id  │       │ human_id  │      │human_id  │
    │username  │       │job_title  │      │stage_name│
    │password  │       │department │      │bio       │
    │loyalty   │       │salary     │      │website   │
    └──────────┘       └───────────┘      └──────────┘
```

## RBAC (Role-Based Access Control)

```
┌────────────┐              ┌──────────────────┐              ┌─────────────┐
│  HUMANS    │──────────────│ HUMAN_SITE_ROLES │──────────────│ SITE_ROLES  │
├────────────┤   many:many  ├──────────────────┤   many:many  ├─────────────┤
│ id         │              │ human_id         │              │ id          │
│ first_name │              │ site_role_id     │              │ role_name   │
│ last_name  │              │ assigned_at      │              │ description │
└────────────┘              │ expires_at       │              └─────────────┘
                            └──────────────────┘                     │
                                                                     │
                                                                     │
                            ┌──────────────────┐                     │
                            │ SITE_ROLE_       │◄────────────────────┘
                            │ PERMISSIONS      │   many:many
                            ├──────────────────┤
                            │ site_role_id     │
                            │ permission_id    │
                            └──────────────────┘
                                     │
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  PERMISSIONS     │
                            ├──────────────────┤
                            │ id               │
                            │ permission_name  │
                            │ resource         │
                            │ action           │
                            │ description      │
                            └──────────────────┘
```

## Temporal Data (Email History)

```
┌────────────┐        1:many         ┌──────────────────┐
│  HUMANS    │◄──────────────────────│  EMAIL_HISTORY   │
├────────────┤                       ├──────────────────┤
│ id         │                       │ id               │
│ first_name │                       │ human_id         │
│ last_name  │                       │ email            │
└────────────┘                       │ is_verified      │
                                     │ effective_from   │
                                     │ effective_to     │ ← NULL = current
                                     │ change_reason    │
                                     └──────────────────┘

Example History:
┌────────┬────────────────────┬─────────────────┬──────────────┐
│human_id│ email              │ effective_from  │ effective_to │
├────────┼────────────────────┼─────────────────┼──────────────┤
│   1    │ old@example.com    │ 2024-01-01      │ 2024-06-15   │
│   1    │ new@example.com    │ 2024-06-15      │ NULL ✓       │ ← Current
└────────┴────────────────────┴─────────────────┴──────────────┘
```

## Polymorphic Associations (Addresses)

```
                            ┌──────────────────┐
                            │   ADDRESSES      │
                            ├──────────────────┤
                            │ id               │
                            │ street_line1     │
                            │ city             │
                            │ state            │
                            │ postal_code      │
                            │ country          │
                            └─────────┬────────┘
                                      │
                                      │ many:1
                                      ▼
                            ┌──────────────────┐
                            │  ADDRESSABLE     │
                            ├──────────────────┤
                            │ address_id       │
                            │ entity_type      │◄─── 'human', 'supplier', etc.
                            │ entity_id        │◄─── Foreign key to entity
                            │ is_primary       │
                            │ effective_from   │
                            │ effective_to     │
                            └─────────┬────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     │                │                │
                     ▼                ▼                ▼
              ┌──────────┐     ┌──────────┐    ┌──────────┐
              │  HUMANS  │     │SUPPLIERS │    │BUSINESSES│
              └──────────┘     └──────────┘    └──────────┘
```

## Complete Soul Provider Schema (After Migration)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION & USERS                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  HUMANS ──1:1──► CUSTOMERS (username, password_hash)                   │
│    │                 │                                                  │
│    │                 └──1:many──► CART_ITEMS ◄──many:1── PRODUCTS      │
│    │                                                                    │
│    ├──1:many──► EMAIL_HISTORY (temporal tracking)                      │
│    │                                                                    │
│    └──many:many──► HUMAN_SITE_ROLES ◄──many:1── SITE_ROLES            │
│                                                       │                 │
│                                                       └──many:many──►   │
│                                                          PERMISSIONS    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                            PRODUCTS & SALES                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PRODUCTS (title, artist, price, image, year, genre, stock)            │
│      │                                                                  │
│      └──1:many──► CART_ITEMS (quantity, added_at)                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Example: User Registration

```
1. POST /api/auth/register
   ├─ name: "John Doe"
   ├─ email: "john@example.com"
   └─ username: "john_doe"
         │
         ▼
2. Split name
   ├─ first_name: "John"
   └─ last_name: "Doe"
         │
         ▼
3. INSERT INTO humans
   └─► Returns human_id: 101
         │
         ▼
4. INSERT INTO customers
   ├─ human_id: 101
   ├─ username: "john_doe"
   └─ password_hash: "bcrypt..."
         │
         ▼
5. INSERT INTO email_history
   ├─ human_id: 101
   ├─ email: "john@example.com"
   ├─ effective_from: NOW
   └─ effective_to: NULL ✓
         │
         ▼
6. Assign customer role
   INSERT INTO human_site_roles
   ├─ human_id: 101
   └─ site_role_id: 2 (customer)
         │
         ▼
7. Set session
   req.session.humanId = 101
         │
         ▼
8. Return success
   res.status(201).json({ message: 'User registered' })
```

## Query Patterns Comparison

### Before (Simple Schema)

```sql
-- Get user with cart
SELECT u.name, u.email, COUNT(ci.id) as cart_count
FROM users u
LEFT JOIN cart_items ci ON u.id = ci.user_id
WHERE u.id = ?
```

### After (Human-Centric)

```sql
-- Get human with current email and cart
SELECT
  h.first_name || ' ' || h.last_name as name,
  e.email,
  COUNT(ci.id) as cart_count
FROM humans h
JOIN customers c ON h.id = c.human_id
LEFT JOIN email_history e ON h.id = e.human_id AND e.effective_to IS NULL
LEFT JOIN cart_items ci ON c.human_id = ci.human_id
WHERE h.id = ?
```

## Migration Phases Visualized

```
Phase 1: CREATE NEW SCHEMA (Non-Breaking)
┌──────────────────────────┬──────────────────────┐
│  EXISTING SCHEMA         │  NEW SCHEMA          │
├──────────────────────────┼──────────────────────┤
│  users                   │                      │
│  products                │  humans ✓            │
│  cart_items              │  customers ✓         │
│                          │  email_history ✓     │
│                          │  site_roles ✓        │
│                          │  permissions ✓       │
└──────────────────────────┴──────────────────────┘
         Both schemas coexist ← Safe

Phase 2: MIGRATE DATA (Non-Breaking)
┌──────────────────────────┬──────────────────────┐
│  EXISTING SCHEMA         │  NEW SCHEMA          │
├──────────────────────────┼──────────────────────┤
│  users (100 rows)        │  humans (100 rows) ✓ │
│  products                │  customers (100) ✓   │
│  cart_items              │  email_history (100)✓│
│                          │  + role assignments ✓│
└──────────────────────────┴──────────────────────┘
      Data duplicated ← Still safe to rollback

Phase 3: UPDATE CODE (Manual)
  ✏️  Update controllers
  ✏️  Update middleware
  ✏️  Change session.userId → session.humanId
  ✏️  Test everything

Phase 4: CLEANUP (Breaking)
┌──────────────────────────┬──────────────────────┐
│  EXISTING SCHEMA         │  NEW SCHEMA          │
├──────────────────────────┼──────────────────────┤
│  users ✗ DROPPED         │  humans ✓            │
│  products                │  customers ✓         │
│  cart_items ✗ MODIFIED   │  email_history ✓     │
│                          │  site_roles ✓        │
│                          │  permissions ✓       │
│                          │  cart_items ✓        │
│                          │   (now uses human_id)│
└──────────────────────────┴──────────────────────┘
     Old schema removed ← Point of no return
```

## Permission Flow Example

```
User Request: DELETE /api/products/123
     │
     ▼
requirePermission('products.delete') middleware
     │
     ├─► Check session.humanId exists? ✓
     │
     ├─► Query:
     │   SELECT 1 FROM human_site_roles hsr
     │   JOIN site_role_permissions srp ON hsr.site_role_id = srp.site_role_id
     │   JOIN permissions p ON srp.permission_id = p.id
     │   WHERE hsr.human_id = 101
     │   AND p.permission_name = 'products.delete'
     │
     ├─► Result: Found (user is admin)
     │
     ▼
Allow request to proceed to controller
     │
     ▼
deleteProduct() executes
```

## Why This Design?

```
BEFORE (Monolithic)              AFTER (Modular)
┌─────────────────┐             ┌───────────┐
│ users           │             │ humans    │ ← Base entity
├─────────────────┤             ├───────────┤
│ id              │             │ id        │
│ name            │             │ first_name│
│ email           │             │ last_name │
│ username        │             └───────────┘
│ password        │                   │
│ role (TEXT)     │                   ├──► customers (auth)
│ salary? NULL    │                   ├──► employees (work)
│ stage_name? NULL│                   └──► artists (music)
│ bio? NULL       │
└─────────────────┘             email_history (temporal)
  Many NULL fields              site_roles (RBAC)
  Hard to query                 permissions (granular)
  Can't be multiple roles       Clean, normalized
```

---

**Legend:**

- `1:1` = One-to-one relationship
- `1:many` = One-to-many relationship
- `many:many` = Many-to-many relationship
- `✓` = Current/Active record (effective_to IS NULL)
- `◄─`, `──►` = Foreign key relationships
