/**
 * PG schema verify / apply utility.
 *   node db/verify.js          — read-only: ping + list tables + counts
 *   node db/verify.js --apply  — apply schema.sql, then verify
 * Never prints connection strings or secrets.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { connectPostgres, getPool, getPostgresUriSource } from './pgClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

const apply = process.argv.includes('--apply');

try {
    const pool = await connectPostgres();
    if (!pool) {
        console.error('Postgres not configured. Set POSTGRES_URI (canonical).');
        process.exit(1);
    }
    console.log(`Using ${getPostgresUriSource()}`);

    if (pool) {
        // pgcrypto provides gen_random_uuid(); citext needed for case-insensitive email.
        await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
        try {
            await pool.query('CREATE EXTENSION IF NOT EXISTS "citext"');
        } catch (e) {
            console.warn(`citext extension unavailable: ${e.message}`);
            console.warn('If schema apply fails on CITEXT, enable it in Neon dashboard → Extensions → citext.');
        }
    }

    if (apply) {
        const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(sql);
        console.log('schema.sql applied.');
    }

    const tables = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    console.log(`tables (${tables.rowCount}): ${tables.rows.map((r) => r.tablename).join(', ')}`);

    for (const { tablename } of tables.rows) {
        const c = await pool.query(`SELECT COUNT(*)::int AS n FROM "${tablename}"`);
        console.log(`  ${tablename}: ${c.rows[0].n}`);
    }

    // Index sanity on hot paths
    const idx = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('tasks','task_events') ORDER BY indexname`
    );
    console.log(`indexes (tasks/task_events): ${idx.rows.map((r) => r.indexname).join(', ') || '(none)'}`);

    await pool.end();
    console.log(apply ? 'Postgres schema ready.' : 'Postgres reachable (read-only check).');
} catch (err) {
    console.error(`Postgres verify failed: ${err.message}`);
    process.exit(1);
}
