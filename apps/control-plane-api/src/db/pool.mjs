/**
 * PostgreSQL connection pool for the control-plane API.
 * Uses the `pg` library directly — no ORM.
 */
import pg from 'pg';

const { Pool } = pg;

let pool = null;

/**
 * Get or create the shared PG pool.
 * @returns {pg.Pool}
 */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.CONTROL_PLANE_PG_URL;
    if (!connectionString) {
      throw new Error(
        'CONTROL_PLANE_PG_URL is not set. Cannot connect to PostgreSQL. ' +
        'See apps/control-plane-api/.env.example for required env vars.'
      );
    }
    pool = new Pool({ connectionString, max: 10 });
  }
  return pool;
}

/**
 * Run a SQL query against the pool.
 * @param {string} text
 * @param {any[]} [params]
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  return getPool().query(text, params);
}

/**
 * Get a client from the pool for transactional work.
 * Caller MUST call client.release() when done.
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  return getPool().connect();
}

/**
 * Gracefully shut down the pool.
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
