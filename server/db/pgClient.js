import pg from 'pg';

const { Pool } = pg;

/**
 * Resolve Postgres connection string.
 * Supports canonical POSTGRES_URI, legacy typo POSTGRESS_URI (backward compat),
 * and generic DATABASE_URL (Render/Neon convention).
 */
export const resolvePostgresUri = () => {
    return (
        process.env.POSTGRES_URI ||
        process.env.POSTGRESS_URI ||
        process.env.DATABASE_URL ||
        null
    );
};

export const getPostgresUriSource = () => {
    if (process.env.POSTGRES_URI) return 'POSTGRES_URI';
    if (process.env.POSTGRESS_URI) return 'POSTGRESS_URI (legacy typo — rename to POSTGRES_URI)';
    if (process.env.DATABASE_URL) return 'DATABASE_URL';
    return null;
};

let pool = null;

export const isPostgresReady = () => !!pool;

export const getPool = () => pool;

/**
 * Connect to PostgreSQL (Neon-compatible).
 * - Uses connection pooling (max 10, same as Mongo pool for parity).
 * - Neon pooler requires SSL; enable SSL for any non-localhost host.
 * - Safe to call when no URI is set: returns null and leaves Mongo as primary.
 */
export const connectPostgres = async () => {
    if (pool) return pool;

    const connectionString = resolvePostgresUri();
    if (!connectionString) {
        console.warn('Postgres URI not set (POSTGRES_URI). Running on MongoDB only.');
        return null;
    }

    const isLocal =
        connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: isLocal ? false : { rejectUnauthorized: false },
    });

    pool.on('error', (err) => {
        console.error(`Postgres pool error: ${err.message}`);
    });

    // Fail fast if credentials/URI are wrong — do not retry silently here.
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
    } finally {
        client.release();
    }

    console.log(`Postgres connected (${getPostgresUriSource()})`);
    return pool;
};

export const query = async (text, params) => {
    if (!pool) throw new Error('Postgres pool not initialized. Call connectPostgres() first.');
    const start = Date.now();
    const res = await pool.query(text, params);
    const ms = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && ms > 200) {
        console.warn(`Slow PG query (${ms}ms): ${text.slice(0, 120)}`);
    }
    return res;
};

export default { connectPostgres, isPostgresReady, getPool, query };
