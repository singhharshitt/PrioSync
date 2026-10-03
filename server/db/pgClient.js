import pg from 'pg';
import dns from 'dns';
import logger from '../utils/logger.js';
import { recordDb } from '../utils/metrics.js';

const { Pool } = pg;

/*
 * Prefer IPv4 DNS results process-wide. Neon hostnames resolve to both A and
 * AAAA; on IPv4-only hosts (typical Windows dev machines) the IPv6-first
 * default makes connection attempts wander before happy-eyeballs fallback.
 * Same class of fix as mongoose `family: 4` in config/db.js. Harmless where
 * IPv6 works — it only changes result ordering, not capability.
 */
try {
    dns.setDefaultResultOrder('ipv4first');
} catch {
    // Very old Node without the API — DNS order stays as-is.
}

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

const isLocalUri = (connectionString) =>
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

/**
 * Normalize the sslmode query param so pg-connection-string never sees an
 * "alias" mode (prefer/require/verify-ca) and warns about future semantics:
 * - remote (Neon): force `sslmode=verify-full` — identical to today's effective
 *   behavior (pg already treats require as verify-full; Neon certs verify).
 * - local (compose/dev): drop sslmode entirely so no SSL is attempted.
 * pg's parse() output overrides any explicit `ssl` pool option, so the URI is
 * the single source of truth for TLS — the pool no longer sets `ssl` itself.
 */
const normalizeSslMode = (connectionString) => {
    try {
        const url = new URL(connectionString);
        if (isLocalUri(connectionString)) url.searchParams.delete('sslmode');
        else url.searchParams.set('sslmode', 'verify-full');
        return url.toString();
    } catch {
        // Unparseable URI: pass through untouched (pg will surface a clear error).
        return connectionString;
    }
};

/**
 * Connect to PostgreSQL (Neon-compatible).
 * - Uses connection pooling (max 10, same as Mongo pool for parity).
 * - TLS is driven by the normalized sslmode in the connection string.
 * - Safe to call when no URI is set: returns null and leaves Mongo as primary.
 */
export const connectPostgres = async () => {
    if (pool) return pool;

    const rawUri = resolvePostgresUri();
    if (!rawUri) {
        console.warn('Postgres URI not set (POSTGRES_URI). Running on MongoDB only.');
        return null;
    }
    const connectionString = normalizeSslMode(rawUri);

    pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        // Generous on purpose: a suspended Neon compute can take many seconds
        // to wake on first contact. Transient wake stalls surface as 503s
        // (see errorHandler) and the boot loop retries — not as 500s.
        connectionTimeoutMillis: 20000,
    });

    pool.on('error', (err) => {
        logger.error({ err }, 'Postgres pool error');
    });

    // Fail fast if credentials/URI are wrong — do not retry silently here.
    // Runs BEFORE instrumentation: connect/probe time is not query latency.
    // On ANY probe failure (refused connect or failed SELECT) the half-built
    // pool is torn down so isPostgresReady() stays false: routes 503 fast
    // instead of hanging on dead sockets.
    let client = null;
    try {
        client = await pool.connect();
        await client.query('SELECT 1');
    } catch (probeError) {
        if (client) {
            try {
                client.release(probeError); // destroy the broken client, don't recycle it
            } catch {
                // Release of a broken client must not mask the probe error.
            }
        }
        try {
            await pool.end();
        } catch {
            // Ending a half-built pool is best-effort by definition.
        }
        pool = null;
        throw probeError;
    }
    try {
        client.release();
    } catch {
        // Best-effort release of the probe client.
    }

    // Instrument every checked-out client AFTER the probe. Pool.query routes
    // through a checked-out client, so client-level timing covers all queries
    // exactly once (pool-level wrapping would double-count them).
    const origConnect = pool.connect.bind(pool);
    const wrapClient = (client) => {
        if (client && !client.__instrumented) {
            instrument(client, 'query');
            client.__instrumented = true;
        }
        return client;
    };
    pool.connect = (...args) => {
        const last = args[args.length - 1];
        if (typeof last === 'function') {
            // pg callback style (used internally by pool.query): preserve contract.
            return origConnect((err, client, release) => last(err, wrapClient(client), release));
        }
        return origConnect(...args).then(wrapClient);
    };

    logger.info('Postgres connected.');
    return pool;
};

/** Wrap pool + checked-out txn clients so EVERY query is timed (no per-repo changes). */
const instrument = (target, label) => {
    const orig = target.query.bind(target);
    target.query = async (...args) => {
        const start = Date.now();
        try {
            return await orig(...args);
        } finally {
            const ms = Date.now() - start;
            recordDb(ms);
            const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text || '';
            if (ms > 200) logger.warn({ ms, sql: String(sql).slice(0, 120), via: label }, 'slow PG query');
        }
    };
};

export const query = async (text, params) => {
    if (!pool) throw new Error('Postgres pool not initialized. Call connectPostgres() first.');
    return pool.query(text, params);
};

export default { connectPostgres, isPostgresReady, getPool, query };
