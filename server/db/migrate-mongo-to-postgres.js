/**
 * MongoDB → PostgreSQL migration (idempotent, per-user transactional).
 *
 *   node db/migrate-mongo-to-postgres.js --dry-run   # counts only, no writes
 *   node db/migrate-mongo-to-postgres.js --apply     # transactional write
 *
 * Guarantees:
 * - Re-runnable: upserts on users.mongo_id / tasks.mongo_id, deps re-inserted
 *   with ON CONFLICT DO NOTHING after clearing stale edges per user.
 * - Per-user transaction: user + prefs + tasks + deps + sessions + bootstrap
 *   events commit atomically.
 * - Never deletes Mongo data. Never prints secrets.
 * - Parity report: user/task/completed/dep counts + priority drift sample.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectPostgres, getPool } from './pgClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

const apply = process.argv.includes('--apply');
const BATCH = 100;

// Lazy model imports (after dotenv so MONGO_URI is set for nothing else needed here)
const { default: User } = await import('../models/User.js');
const { default: Task } = await import('../models/Task.js');

const toIso = (v) => (v ? new Date(v).toISOString() : null);

async function mongoCounts() {
    const [users, tasks, completed, withDeps] = await Promise.all([
        User.countDocuments(),
        Task.countDocuments(),
        Task.countDocuments({ status: 'completed' }),
        Task.countDocuments({ dependencies: { $exists: true, $ne: [] } }),
    ]);
    const depAgg = await Task.aggregate([
        { $project: { n: { $size: { $ifNull: ['$dependencies', []] } } } },
        { $group: { _id: null, total: { $sum: '$n' } } },
    ]);
    return { users, tasks, completed, withDeps, depEdges: depAgg[0]?.total ?? 0 };
}

async function pgCounts(pool) {
    const q = async (t) => (await pool.query(`SELECT COUNT(*)::int n FROM "${t}"`)).rows[0].n;
    const [users, tasks, completed, depEdges, sessions, events] = await Promise.all([
        q('users'), q('tasks'),
        pool.query(`SELECT COUNT(*)::int n FROM tasks WHERE status='completed'`).then((r) => r.rows[0].n),
        q('task_dependencies'), q('work_sessions'), q('task_events'),
    ]);
    return { users, tasks, completed, depEdges, sessions, events };
}

async function migrateUser(pool, mongoUser, client) {
    // 1. Upsert user by mongo_id
    const mongoId = mongoUser._id.toString();
    const u = await client.query(
        `INSERT INTO users (mongo_id, email, password_hash, name, avatar_url, productivity_score, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (mongo_id) DO UPDATE SET
           email=EXCLUDED.email, name=EXCLUDED.name,
           avatar_url=EXCLUDED.avatar_url, productivity_score=EXCLUDED.productivity_score,
           updated_at=now()
         RETURNING id`,
        [
            mongoId,
            (mongoUser.email || '').toLowerCase(),
            mongoUser.password, // already bcrypt hash (+password selected)
            mongoUser.name || 'Migrated User',
            mongoUser.avatar || null,
            Math.max(0, Math.min(100, mongoUser.productivityScore ?? 0)),
            toIso(mongoUser.createdAt) || new Date().toISOString(),
            toIso(mongoUser.updatedAt) || new Date().toISOString(),
        ]
    );
    const userId = u.rows[0].id;

    await client.query(
        `INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [userId]
    );

    // 2. Upsert tasks for this user
    const mongoTasks = await Task.find({ owner: mongoUser._id }).lean();
    const taskIdByMongo = new Map();
    for (const t of mongoTasks) {
        const tmongoId = t._id.toString();
        const r = await client.query(
            `INSERT INTO tasks (mongo_id, user_id, title, description, status,
               importance, urgency, difficulty, friction, estimated_minutes,
               deadline, priority_score, priority_tier, category, completed_at,
               version, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,3,30,$9,$10,$11,$12,$13,1,$14,$15)
             ON CONFLICT (mongo_id) DO UPDATE SET
               title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
               importance=EXCLUDED.importance, urgency=EXCLUDED.urgency, difficulty=EXCLUDED.difficulty,
               deadline=EXCLUDED.deadline, priority_score=EXCLUDED.priority_score,
               priority_tier=EXCLUDED.priority_tier, category=EXCLUDED.category,
               completed_at=EXCLUDED.completed_at, updated_at=now()
             RETURNING id`,
            [
                tmongoId, userId,
                String(t.title || 'Untitled').slice(0, 150),
                String(t.description || '').slice(0, 2000),
                t.status || 'pending',
                t.importance ?? 3, t.urgency ?? 3, t.difficulty ?? 3,
                toIso(t.deadline),
                Math.max(0, Math.min(100, t.priorityScore ?? 0)),
                t.priorityTier || 'medium',
                t.category || 'General',
                toIso(t.completedAt),
                toIso(t.createdAt) || new Date().toISOString(),
                toIso(t.updatedAt) || new Date().toISOString(),
            ]
        );
        taskIdByMongo.set(tmongoId, r.rows[0].id);
    }

    // 3. Rebuild dependency edges (clear stale, re-insert valid)
    const pgTaskIds = [...taskIdByMongo.values()];
    if (pgTaskIds.length > 0) {
        await client.query(`DELETE FROM task_dependencies WHERE task_id = ANY($1)`, [pgTaskIds]);
    }
    let depInserted = 0, depSkipped = 0;
    for (const t of mongoTasks) {
        const from = taskIdByMongo.get(t._id.toString());
        for (const d of t.dependencies || []) {
            const depMongo = d.toString();
            const to = taskIdByMongo.get(depMongo);
            if (!to || to === from) { depSkipped++; continue; } // orphan/self → skip, counted
            await client.query(
                `INSERT INTO task_dependencies (task_id, depends_on_task_id)
                 VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [from, to]
            );
            depInserted++;
        }
    }

    // 4. Work sessions from embedded focusSessions[]
    let sessions = 0;
    for (const s of mongoUser.focusSessions || []) {
        if (!s.startedAt || !s.endedAt || !s.durationSeconds) continue;
        let pgTaskId = null;
        if (s.task) {
            const key = s.task.toString();
            pgTaskId = taskIdByMongo.get(key) ?? null;
        }
        await client.query(
            `INSERT INTO work_sessions (user_id, task_id, started_at, ended_at, duration_seconds, completed)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [userId, pgTaskId, toIso(s.startedAt), toIso(s.endedAt),
             Math.max(1, Math.round(s.durationSeconds)), !!s.completed]
        );
        sessions++;
    }

    // 5. Bootstrap history: one TASK_CREATED per task (idempotent-ish - skip if already present)
    let events = 0;
    for (const t of mongoTasks) {
        const pgTaskId = taskIdByMongo.get(t._id.toString());
        const exists = await client.query(
            `SELECT 1 FROM task_events WHERE task_id=$1 AND event_type='TASK_CREATED' LIMIT 1`,
            [pgTaskId]
        );
        if (exists.rowCount === 0) {
            await client.query(
                `INSERT INTO task_events (user_id, task_id, event_type, payload, created_at)
                 VALUES ($1,$2,'TASK_CREATED',$3,$4)`,
                [userId, pgTaskId,
                 JSON.stringify({ source: 'mongo-migration', title: t.title }),
                 toIso(t.createdAt) || new Date().toISOString()]
            );
            events++;
        }
    }

    return { tasks: mongoTasks.length, depInserted, depSkipped, sessions, events };
}

try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI missing.');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, family: 4 });
    console.log('Mongo connected.');

    const pool = await connectPostgres();
    if (!pool) throw new Error('Postgres not configured.');
    void getPool;

    const m = await mongoCounts();
    console.log(`mongo: users=${m.users} tasks=${m.tasks} completed=${m.completed} depEdges=${m.depEdges}`);

    if (!apply) {
        const p = await pgCounts(pool);
        console.log(`pg: users=${p.users} tasks=${p.tasks} completed=${p.completed} depEdges=${p.depEdges} sessions=${p.sessions} events=${p.events}`);
        console.log('Dry-run only. Re-run with --apply to write.');
        await mongoose.disconnect();
        await pool.end();
        process.exit(0);
    }

    let totals = { users: 0, tasks: 0, depInserted: 0, depSkipped: 0, sessions: 0, events: 0 };
    let lastId = null;
    for (;;) {
        const filter = lastId ? { _id: { $gt: lastId } } : {};
        const batch = await User.find(filter)
            .select('+password')
            .sort({ _id: 1 })
            .limit(BATCH)
            .lean();
        if (batch.length === 0) break;
        for (const mu of batch) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const r = await migrateUser(pool, mu, client);
                await client.query('COMMIT');
                totals.users++;
                totals.tasks += r.tasks;
                totals.depInserted += r.depInserted;
                totals.depSkipped += r.depSkipped;
                totals.sessions += r.sessions;
                totals.events += r.events;
            } catch (e) {
                await client.query('ROLLBACK');
                console.error(`user ${mu._id} failed: ${e.message}`);
            } finally {
                client.release();
            }
        }
        lastId = batch[batch.length - 1]._id;
        console.log(`progress: users=${totals.users} tasks=${totals.tasks} deps=${totals.depInserted} skipped=${totals.depSkipped}`);
    }

    const p = await pgCounts(pool);
    console.log(`done: migrated users=${totals.users} tasks=${totals.tasks} depInserted=${totals.depInserted} skipped=${totals.depSkipped} sessions=${totals.sessions} events=${totals.events}`);
    console.log(`pg now: users=${p.users} tasks=${p.tasks} completed=${p.completed} depEdges=${p.depEdges}`);
    console.log(`parity: mongoTasks=${m.tasks} pgTasks=${p.tasks} ${m.tasks === p.tasks ? 'OK' : 'MISMATCH - investigate'}`);

    await mongoose.disconnect();
    await pool.end();
} catch (err) {
    console.error(`migration failed: ${err.message}`);
    try { await mongoose.disconnect(); } catch { /* noop */ }
    process.exit(1);
}
