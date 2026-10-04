/**
 * Migration runner: applies db/migrations/*.sql in filename order.
 *   node db/migrate.js
 * Tracks applied files in schema_migrations; each file must be idempotent
 * (IF NOT EXISTS / guards) so re-runs and fresh installs converge.
 * Never prints connection strings or secrets.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { connectPostgres } from './pgClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

try {
    const pool = await connectPostgres();
    if (!pool) {
        console.error('Postgres not configured. Set POSTGRES_URI (canonical).');
        process.exit(1);
    }
    await pool.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    );
    const done = new Set(
        (await pool.query(`SELECT filename FROM schema_migrations`)).rows.map((r) => r.filename)
    );
    const dir = path.join(__dirname, 'migrations');
    const files = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
        : [];
    let applied = 0;
    for (const f of files) {
        if (done.has(f)) {
            console.log(`skip (applied): ${f}`);
            continue;
        }
        const sql = fs.readFileSync(path.join(dir, f), 'utf8');
        await pool.query(sql);
        await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [f]);
        applied += 1;
        console.log(`applied: ${f}`);
    }
    await pool.end();
    console.log(applied === 0 ? 'Migrations up to date.' : `Done. ${applied} migration(s) applied.`);
} catch (err) {
    console.error(`Migration failed: ${err.message}`);
    process.exit(1);
}
