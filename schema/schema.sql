-- VTL Evosystem — D1 Database Schema
-- Architecture V2.0 — Section 4.4
-- Table name standard: apps_catalog (US English, no 'ue') — Platform Interface Specification V1
-- Run via: wrangler d1 execute vtl-evosystem --file=schema/schema.sql

-- ─────────────────────────────────────────────
-- MEMBERS
-- All registered members across all tiers
-- Stripe Customer ID linked to every record
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    membership_tier TEXT NOT NULL DEFAULT 'unregistered',
    -- Tiers: unregistered | base_mylynx | mylynx_gold | trade | developer | plus | pro
    membership_status TEXT NOT NULL DEFAULT 'inactive',
    -- Statuses: active | inactive | lapsed | cancelled
    link3_stage1_access INTEGER NOT NULL DEFAULT 0, -- 1 = yes
    link3_stage2_access INTEGER NOT NULL DEFAULT 0,
    link3_stage3_access INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_stripe_customer ON members(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_members_tier ON members(membership_tier);

-- ─────────────────────────────────────────────
-- BUSINESSES
-- All LinxLocal-Trade subscriber records
-- Writes: LinxLocal-Trade | Reads: LinxLocal, AppWow, myLynx
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    member_id TEXT NOT NULL REFERENCES members(id),
    business_name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    description TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    postcode TEXT,
    country TEXT NOT NULL DEFAULT 'GB',
    latitude REAL,
    longitude REAL,
    phone TEXT,
    email TEXT,
    website TEXT,
    opening_hours TEXT, -- JSON string
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_businesses_member ON businesses(member_id);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_location ON businesses(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_businesses_active ON businesses(is_active);

-- ─────────────────────────────────────────────
-- VEHICLES
-- All CarLinx-Trade vehicle listings
-- Writes: CarLinx-Trade | Reads: CarLinx, AppWow, myLynx
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    member_id TEXT NOT NULL REFERENCES members(id),
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    variant TEXT,
    year INTEGER NOT NULL,
    mileage INTEGER,
    fuel_type TEXT,
    transmission TEXT,
    colour TEXT,
    body_type TEXT,
    price INTEGER, -- stored in pence/cents
    currency TEXT NOT NULL DEFAULT 'GBP',
    condition TEXT NOT NULL DEFAULT 'used', -- new | used
    description TEXT,
    location_city TEXT,
    location_postcode TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vehicles_member ON vehicles(member_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles(make, model);
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);

-- ─────────────────────────────────────────────
-- PROPERTIES
-- All HomeLinx-Trade property listings
-- Writes: HomeLinx-Trade | Reads: HomeLinx, AppWow, myLynx
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    member_id TEXT NOT NULL REFERENCES members(id),
    property_type TEXT NOT NULL, -- residential | commercial | land
    listing_type TEXT NOT NULL,  -- sale | rent
    bedrooms INTEGER,
    bathrooms INTEGER,
    address_line1 TEXT,
    city TEXT,
    postcode TEXT,
    country TEXT NOT NULL DEFAULT 'GB',
    latitude REAL,
    longitude REAL,
    price INTEGER, -- stored in pence/cents
    currency TEXT NOT NULL DEFAULT 'GBP',
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_properties_member ON properties(member_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type, listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);

-- ─────────────────────────────────────────────
-- MENUS
-- All MenuLinx-Trade menu and service listings
-- Writes: MenuLinx-Trade | Reads: LinxLocal, AppWow, myLynx
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menus (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    member_id TEXT NOT NULL REFERENCES members(id),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price INTEGER, -- stored in pence/cents
    currency TEXT NOT NULL DEFAULT 'GBP',
    dietary_info TEXT, -- JSON string: vegan, gluten-free etc
    is_available INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menus_business ON menus(business_id);
CREATE INDEX IF NOT EXISTS idx_menus_category ON menus(category);
CREATE INDEX IF NOT EXISTS idx_menus_available ON menus(is_available);

-- ─────────────────────────────────────────────
-- APPS CATALOG
-- AppWow app listings including third party submissions
-- Platform standard: apps_catalog (not apps_catalogue)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apps_catalog (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    app_name TEXT NOT NULL,
    short_name TEXT,
    developer_id TEXT REFERENCES members(id),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    app_url TEXT NOT NULL,
    icon_r2_key TEXT,        -- R2_MEDIA reference
    screenshots_r2_keys TEXT, -- JSON array of R2_MEDIA keys
    manifest_url TEXT,
    is_evosystem INTEGER NOT NULL DEFAULT 0, -- 1 = own evosystem IA
    is_featured INTEGER NOT NULL DEFAULT 0,
    listing_status TEXT NOT NULL DEFAULT 'pending',
    -- statuses: pending | scanning | verified | rejected | suspended
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_apps_catalog_category ON apps_catalog(category);
CREATE INDEX IF NOT EXISTS idx_apps_catalog_status ON apps_catalog(listing_status);
CREATE INDEX IF NOT EXISTS idx_apps_catalog_featured ON apps_catalog(is_featured);
CREATE INDEX IF NOT EXISTS idx_apps_catalog_evosystem ON apps_catalog(is_evosystem);

-- ─────────────────────────────────────────────
-- APP VERIFICATIONS
-- Verification status, scan results and audit records per listed app
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_verifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    app_id TEXT NOT NULL REFERENCES apps_catalog(id),
    verification_type TEXT NOT NULL, -- automated_scan | manual_review
    status TEXT NOT NULL,            -- pass | fail | pending
    score INTEGER,                   -- 0-100 scan score
    notes TEXT,
    reviewed_by TEXT,                -- admin member_id for manual reviews
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_verifications_app ON app_verifications(app_id);
CREATE INDEX IF NOT EXISTS idx_app_verifications_status ON app_verifications(status);

-- ─────────────────────────────────────────────
-- DEVELOPER SUBMISSIONS
-- Third party developer submission records
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS developer_submissions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    member_id TEXT NOT NULL REFERENCES members(id),
    app_name TEXT NOT NULL,
    app_url TEXT NOT NULL,
    manifest_url TEXT,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    submission_notes TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    -- statuses: received | scanning | in_review | approved | rejected
    app_id TEXT REFERENCES apps_catalog(id), -- set when approved and listed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dev_submissions_member ON developer_submissions(member_id);
CREATE INDEX IF NOT EXISTS idx_dev_submissions_status ON developer_submissions(status);

-- ─────────────────────────────────────────────
-- LINK3 ITEMS
-- All items in the LINK3 sales pipeline
-- No fiscal fields. Ever.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS link3_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    seller_member_id TEXT NOT NULL REFERENCES members(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    entry_stage INTEGER NOT NULL, -- 1, 2, or 3 — seller chooses
    current_stage INTEGER NOT NULL,
    stage_status TEXT NOT NULL DEFAULT 'active',
    -- statuses: active | completed | lapsed | withdrawn
    stage_expires_at TEXT,       -- datetime when current stage expires
    image_r2_keys TEXT,          -- JSON array of R2_MEDIA keys
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_link3_items_seller ON link3_items(seller_member_id);
CREATE INDEX IF NOT EXISTS idx_link3_items_stage ON link3_items(current_stage, stage_status);
CREATE INDEX IF NOT EXISTS idx_link3_items_active ON link3_items(is_active);

-- ─────────────────────────────────────────────
-- MYLYNX GOLD OFFERS
-- myLynx-gold specific offers surfaced in LinxMart
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mylynx_gold_offers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    member_id TEXT NOT NULL REFERENCES members(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    offer_type TEXT NOT NULL, -- product | service | experience
    is_active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gold_offers_member ON mylynx_gold_offers(member_id);
CREATE INDEX IF NOT EXISTS idx_gold_offers_active ON mylynx_gold_offers(is_active);

-- ─────────────────────────────────────────────
-- STRIPE EVENTS
-- Webhook log — audit trail only
-- No fiscal transaction records held by VTL
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY, -- Stripe event ID (evt_xxx)
    event_type TEXT NOT NULL,
    stripe_customer_id TEXT,
    member_id TEXT REFERENCES members(id),
    payload_hash TEXT,   -- hash of payload for integrity, not the payload itself
    processed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_customer ON stripe_events(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed);
