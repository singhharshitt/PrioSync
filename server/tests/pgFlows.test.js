/**
 * Postgres integration flows. OPT-IN ONLY: RUN_PG_TESTS=1
 * Uses temp __test__ users on the configured database with cascade cleanup —
 * point at a throwaway Neon branch in CI, never at production data.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { connectPostgres, getPool } from '../db/pgClient.js';
import * as Users from '../repositories/pgUsers.js';

beforeAll(async () => {
    if (process.env.RUN_PG_TESTS) await connectPostgres();
}, 30000);

afterAll(async () => {
    if (process.env.RUN_PG_TESTS) await getPool()?.end();
});
import * as Svc from '../services/pgTaskService.js';
import * as Planner from '../services/plannerService.js';
import * as Replan from '../services/replanService.js';

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

const TOMORROW = () => new Date(Date.now() + 86400000).toISOString();

describe.skipIf(!pgEnabled)('pg task flows', () => {
    it('creates, scores, blocks, and orders tasks', async () => {
        const uid = await makeUser('tasks');
        const a = await Svc.createTask(uid, { title: 'A', deadline: TOMORROW(), importance: 5, urgency: 5 });
        const b = await Svc.createTask(uid, { title: 'B', deadline: TOMORROW(), dependencies: [a.id] });
        expect(a.priorityScore).toBe(90);
        expect(b.priorityScore).toBe(48);
        const top = await Svc.getTopTasks(uid, 5);
        expect(top.map((t) => t.id)).toEqual([a.id, b.id]);
        const expl = await Svc.explainPriority(uid, a.id);
        expect(expl.unlocks).toBe(1);
        expect(expl.blocked).toBe(false);
    });

    it('rejects cycles and stale versions', async () => {
        const uid = await makeUser('guard');
        const a = await Svc.createTask(uid, { title: 'A', deadline: TOMORROW() });
        const b = await Svc.createTask(uid, { title: 'B', deadline: TOMORROW(), dependencies: [a.id] });
        await expect(Svc.updateTask(uid, a.id, { dependencies: [b.id] })).rejects.toMatchObject({ status: 400 });
        const stale = await Svc.updateTask(uid, b.id, { title: 'x' }, { expectedVersion: 999 });
        expect(stale.conflict).toBe(true);
        const ok = await Svc.updateTask(uid, b.id, { title: 'B2' }, { expectedVersion: b.version });
        expect(ok.row.title).toBe('B2');
    });

    it('confirms a planner dump into a healthy scheduled plan', async () => {
        const uid = await makeUser('planner');
        const dl = new Date(Date.now() + 7 * 86400000).toISOString();
        const out = await Planner.confirmPlan(uid, {
            goal: { title: 'G', description: '', deadline: dl },
            projects: [],
            tasks: [
                { key: 't1', title: 'A', estimatedMinutes: 60, deadline: dl },
                { key: 't2', title: 'B', estimatedMinutes: 60, deadline: dl },
            ],
            dependencies: [{ task: 't2', dependsOn: 't1' }],
            constraints: { availableMinutesPerDay: 120 },
            reason: 'test',
        });
        expect(out.schedule).toHaveLength(2);
        expect(out.health.score).toBe(100);
        expect(out.tasks.every((t) => typeof t.priorityScore === 'number')).toBe(true);
        const plans = await Planner.listPlans(uid);
        expect(plans).toHaveLength(1);
        const detail = await Planner.getPlan(uid, out.planId);
        expect(detail.items).toHaveLength(2);
    });

    it('detects, proposes, accepts, and logs replans + feedback', async () => {
        const uid = await makeUser('replan');
        const past = new Date(Date.now() - 2 * 86400000).toISOString();
        const m1 = await Svc.createTask(uid, { title: 'Missed', deadline: past, estimatedMinutes: 30 });
        const missed = await Replan.detectMissed(uid);
        expect(missed.map((t) => t.id)).toContain(m1.id);
        const prop = await Replan.proposeReplan(uid, { availableMinutesPerDay: 60 });
        expect(prop.moves).toHaveLength(1);
        const acc = await Replan.acceptReplan(uid, {
            moves: prop.moves.map((m) => ({ taskId: m.taskId, newDeadline: m.newDeadline })),
            reason: 'test',
        });
        expect(acc.applied).toHaveLength(1);
        const log = await Replan.decisionLog(uid);
        expect(log.map((e) => e.eventType)).toContain('TASK_RESCHEDULED');
        await Replan.recordOverride(uid, { recommendedTaskId: m1.id, chosenTaskId: null, reason: 'prefer_first' });
        await Replan.recordAccept(uid, { recommendedTaskId: m1.id });
        const adh = await Replan.adherence(uid);
        expect(adh).toMatchObject({ accepted: 1, overridden: 1, adherenceRate: 50 });
    });
});
