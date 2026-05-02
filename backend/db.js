import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

export const isDatabaseConfigured = Boolean(DATABASE_URL);

export const pool = isDatabaseConfigured
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    })
  : null;

export async function initializeDatabase() {
  if (!pool) {
    console.warn("DATABASE_URL is not set. PostgreSQL endpoints are disabled.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      telegram_id BIGINT UNIQUE,
      username TEXT NOT NULL,
      avatar TEXT,
      rating INTEGER NOT NULL DEFAULT 0,
      reviews INTEGER NOT NULL DEFAULT 0,
      tenure TEXT NOT NULL DEFAULT '0 days',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS listings (
      id UUID PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(20, 9) NOT NULL CHECK (price >= 0),
      currency TEXT NOT NULL DEFAULT 'TON',
      region TEXT,
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_new BOOLEAN NOT NULL DEFAULT FALSE,
      is_auto_issue BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_listings_status_created_at
      ON listings(status, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_listings_seller_id
      ON listings(seller_id);

    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
      listing_title TEXT NOT NULL,
      listing_description TEXT NOT NULL DEFAULT '',
      price NUMERIC(20, 9) NOT NULL CHECK (price >= 0),
      currency TEXT NOT NULL DEFAULT 'TON',
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      seller_username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_orders_buyer_created_at
      ON orders(buyer_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_orders_seller_created_at
      ON orders(seller_id, created_at DESC);
  `);
}

export function requireDatabase(req, res, next) {
  if (!pool) {
    return res.status(503).json({
      error: "PostgreSQL is not configured. Set DATABASE_URL in backend/.env.",
    });
  }

  return next();
}
