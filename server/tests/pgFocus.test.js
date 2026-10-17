/**
 * Focus 2.0 persistence. OPT-IN ONLY: RUN_PG_TESTS=1 (same discipline as pgFlows).
 * Requires migration 002-focus.sql (planned_seconds, paused_seconds, note,
 * user_preferences.ai_narration).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { connectPostgres, getPool } from '../db/pgClient.js';
import * as Users from '../repositories/pgUsers.js';
import * as Sessions from '../repositories/pgSessions.js';

beforeAll(async () => {
    if (process.env.RUN_PG_TESTS) await connectPostgres();
}, 30000);

afterAll(async () => {
    if (process.env.RUN_PG_TESTS) await getPool()?.end();
});

const pgEnabled = !!process.env.RUN_PG_TESTS;
const created = [];

const makeUser = async (tag) => {
    const u = await Users.create({
        email: `__test__${tag}__${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash('password123', 4),
        name: 'Test',
    });
    created.push(u.id);
    return u.id;
};

afterEach(async () => {
    while (created.length > 0) {
        const id = created.pop();
        try {
            await Users.deleteById(id);
        } catch {
            /* cleanup best-effort */
        }
    }
});

describe.skipIf(!pgEnabled)('pg focus sessions', () => {
    it('applies migration 002 columns', async () => {
        const pool = getPool();
        const cols = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'work_sessions'`
        );
        const names = cols.rows.map((r) => r.column_name);
        for (const c of ['planned_seconds', 'paused_seconds', 'note']) {
            expect(names).toContain(c);
        }
        const prefs = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'ai_narration'`
        );
        expect(prefs.rowCount).toBe(1);
    });

    it('logs a session with planned/paused/note/completed and reads them back', async () => {
        const uid = await makeUser('focus');
        const start = new Date(Date.now() - 30 * 60000).toISOString();
        const end = new Date().toISOString();
        const s = await Sessions.log(uid, {
            taskId: null,
            startedAt: start,
            endedAt: end,
            durationSeconds: 1500,
            plannedSeconds: 1800,
            pausedSeconds: 300,
            note: 'Finished the draft, needs review.',
            completed: true,
        });
        expect(s.plannedSeconds).toBe(1800);
        expect(s.pausedSeconds).toBe(300);
        expect(s.note).toBe('Finished the draft, needs review.');
        expect(s.completed).toBe(true);
        const listed = await Sessions.listByUser(uid);
        expect(listed[0].plannedSeconds).toBe(1800);
    });

    it('keeps legacy sessions valid (defaults, no plan)', async () => {
        const uid = await makeUser('focuslegacy');
        const start = new Date(Date.now() - 10 * 60000).toISOString();
        const s = await Sessions.log(uid, {
            taskId: null,
            startedAt: start,
            endedAt: new Date().toISOString(),
            durationSeconds: 600,
        });
        expect(s.plannedSeconds).toBeNull();
        expect(s.pausedSeconds).toBe(0);
        expect(s.note).toBe('');
        expect(s.completed).toBe(false);
    });
});
