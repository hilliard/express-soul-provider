-- ========================================
-- REUSABLE HUMAN-CENTRIC DATABASE SCHEMA
-- SQLite Compatible | Portable Design
-- ========================================

PRAGMA foreign_keys = ON;

-- ========================================
-- CORE HUMAN ENTITY
-- ========================================

CREATE TABLE humans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK(gender IN ('M', 'F', 'Other', 'PreferNotToSay')),
    phone_number TEXT,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_humans_name ON humans(last_name, first_name);
CREATE INDEX idx_humans_active ON humans(is_active);

-- ========================================
-- EMAIL HISTORY (Temporal Tracking)
-- ========================================

CREATE TABLE email_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    human_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    is_verified INTEGER DEFAULT 0 CHECK(is_verified IN (0, 1)),
    effective_from TEXT DEFAULT CURRENT_TIMESTAMP,
    effective_to TEXT, -- NULL = current/active email
    change_reason TEXT CHECK(change_reason IN ('initial', 'user_updated', 'admin_updated', 'verification')),
    FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
);

CREATE INDEX idx_email_human ON email_history(human_id);
CREATE INDEX idx_email_current ON email_history(human_id, effective_to) WHERE effective_to IS NULL;
CREATE UNIQUE INDEX idx_email_unique_active ON email_history(email) WHERE effective_to IS NULL;

-- ========================================
-- ADDRESS SYSTEM (Polymorphic)
-- ========================================

CREATE TABLE addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    street_line1 TEXT NOT NULL,
    street_line2 TEXT,
    city TEXT NOT NULL,
    state_province TEXT,
    postal_code TEXT,
    country TEXT NOT NULL DEFAULT 'USA',
    address_type TEXT CHECK(address_type IN ('billing', 'shipping', 'business', 'home')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addresses_postal ON addresses(postal_code);
CREATE INDEX idx_addresses_city ON addresses(city);

-- Links addresses to any entity (human, supplier, etc)
CREATE TABLE addressable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('human', 'supplier', 'business')),
    entity_id INTEGER NOT NULL,
    is_primary INTEGER DEFAULT 0 CHECK(is_primary IN (0, 1)),
    effective_from TEXT DEFAULT CURRENT_TIMESTAMP,
    effective_to TEXT, -- NULL = currently active
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE
);

CREATE INDEX idx_addressable_entity ON addressable(entity_type, entity_id);
CREATE INDEX idx_addressable_current ON addressable(effective_to) WHERE effective_to IS NULL;

-- ========================================
-- ROLE TABLES (Class Table Inheritance)
-- ========================================

-- CUSTOMERS
CREATE TABLE customers (
    human_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    customer_since TEXT DEFAULT CURRENT_TIMESTAMP,
    loyalty_points INTEGER DEFAULT 0,
    FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
);

CREATE INDEX idx_customers_username ON customers(username);

-- EMPLOYEES
CREATE TABLE employees (
    human_id INTEGER PRIMARY KEY,
    employee_number TEXT UNIQUE,
    job_title TEXT,
    department TEXT,
    salary REAL,
    hire_date TEXT DEFAULT CURRENT_TIMESTAMP,
    termination_date TEXT,
    FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
);

CREATE INDEX idx_employees_number ON employees(employee_number);
CREATE INDEX idx_employees_active ON employees(termination_date) WHERE termination_date IS NULL;

-- ARTISTS (for music store context)
CREATE TABLE artists (
    human_id INTEGER PRIMARY KEY,
    stage_name TEXT UNIQUE,
    bio TEXT,
    website TEXT,
    debut_year INTEGER,
    FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
);

CREATE INDEX idx_artists_stage_name ON artists(stage_name);

-- ========================================
-- SITE ROLES & PERMISSIONS (RBAC)
-- ========================================

CREATE TABLE site_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    permission_name TEXT NOT NULL UNIQUE,
    resource TEXT, -- e.g., 'products', 'users', 'orders'
    action TEXT, -- e.g., 'create', 'read', 'update', 'delete'
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_resource ON permissions(resource, action);

-- Many-to-many: Humans to Site Roles
CREATE TABLE human_site_roles (
    human_id INTEGER NOT NULL,
    site_role_id INTEGER NOT NULL,
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER, -- human_id of admin who assigned
    expires_at TEXT, -- NULL = no expiration
    PRIMARY KEY (human_id, site_role_id),
    FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE,
    FOREIGN KEY (site_role_id) REFERENCES site_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES humans(id)
);

-- Many-to-many: Roles to Permissions
CREATE TABLE site_role_permissions (
    site_role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (site_role_id, permission_id),
    FOREIGN KEY (site_role_id) REFERENCES site_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ========================================
-- AUTHENTICATION
-- ========================================

-- Login sessions
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    human_id INTEGER NOT NULL,
    session_data TEXT, -- JSON blob for session storage
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (human_id) REFERENCES humans(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_human ON sessions(human_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ========================================
-- SEED DATA (Optional - Remove in production)
-- ========================================

-- Default site roles
INSERT INTO site_roles (role_name, description) VALUES
('admin', 'Full system access'),
('customer', 'Regular customer access'),
('employee', 'Staff member access'),
('artist', 'Artist portal access');

-- Default permissions
INSERT INTO permissions (permission_name, resource, action, description) VALUES
('products.create', 'products', 'create', 'Can create products'),
('products.read', 'products', 'read', 'Can view products'),
('products.update', 'products', 'update', 'Can edit products'),
('products.delete', 'products', 'delete', 'Can delete products'),
('orders.create', 'orders', 'create', 'Can create orders'),
('orders.read', 'orders', 'read', 'Can view orders'),
('users.manage', 'users', 'manage', 'Can manage user accounts'),
('cart.manage', 'cart', 'manage', 'Can manage shopping cart');

-- Assign permissions to roles
INSERT INTO site_role_permissions (site_role_id, permission_id)
SELECT sr.id, p.id FROM site_roles sr, permissions p
WHERE sr.role_name = 'admin'; -- Admin gets all permissions

INSERT INTO site_role_permissions (site_role_id, permission_id)
SELECT sr.id, p.id FROM site_roles sr, permissions p
WHERE sr.role_name = 'customer' 
AND p.permission_name IN ('products.read', 'orders.create', 'orders.read', 'cart.manage');

-- ========================================
-- HELPER VIEWS (Optional)
-- ========================================

-- Current active emails
CREATE VIEW v_current_emails AS
SELECT human_id, email, is_verified, effective_from
FROM email_history
WHERE effective_to IS NULL;

-- Current active addresses
CREATE VIEW v_current_addresses AS
SELECT a.*, ab.entity_type, ab.entity_id, ab.is_primary
FROM addresses a
JOIN addressable ab ON a.id = ab.address_id
WHERE ab.effective_to IS NULL;

-- Human full profile (basic)
CREATE VIEW v_human_profiles AS
SELECT 
    h.id,
    h.first_name,
    h.last_name,
    h.first_name || ' ' || h.last_name AS full_name,
    e.email,
    e.is_verified,
    h.phone_number,
    h.date_of_birth,
    h.gender,
    h.is_active,
    h.created_at
FROM humans h
LEFT JOIN v_current_emails e ON h.id = e.human_id;
