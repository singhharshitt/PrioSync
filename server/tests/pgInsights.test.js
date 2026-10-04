/**
 * Insights integration (service level, same pattern as pgFlows).
 * OPT-IN ONLY: RUN_PG_TESTS=1, temp __test__ users, cascade cleanup.
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
import * as Svc from '../services/pgTaskService.js';
import * as TaskRepo from '../repositories/pgTasks.js';
import * as Insights from '../services/insightService.js';

const pgEnabled = !!process.env.RUN_PG_TESTS;
const created = [];

const makeUser = async (tag) => {
    const u = await Users.create({
        email: `__test__insights__${tag}__${Date.now()}@example.com`,
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

const DAY = 86400000;
const mkTask = (uid, over) =>
    Svc.createTask(uid, {
        title: 'T',
        importance: 3,
        urgency: 3,
        estimatedMinutes: 60,
        deadline: new Date(Date.now() + 3 * DAY).toISOString(),
        ...over,
    });

describe.skipIf(!pgEnabled)('pg insights', () => {
    it('assesses risk, critical path, bottlenecks, and capacity over real rows', async () => {
        const uid = await makeUser('a');
        const a = await mkTask(uid, { title: 'API', estimatedMinutes: 120 });
        const b = await mkTask(uid, { title: 'DB', estimatedMinutes: 60, dependencies: [a.id] });
        await mkTask(uid, { title: 'Docs', estimatedMinutes: 30 });

        const risk = await Insights.getRisk(uid);
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(risk.riskLevel);
        expect(risk.remainingMinutes).toBe(210);
        expect(risk.summary).toBeTruthy();

        const cp = await Insights.getCriticalPath(uid);
        expect(cp.path.map((p) => p.taskId)).toEqual([a.id, b.id]);
        expect(cp.totalMinutes).toBe(180);

        const bn = await Insights.getBottlenecks(uid);
        expect(bn.primary.taskId).toBe(a.id);
        expect(bn.primary.downstreamCount).toBe(1);
        expect(bn.blockedWork.blockedCount).toBe(1);

        const cap = await Insights.getCapacity(uid, { days: 7 });
        expect(cap.plannedMinutes).toBe(210);
        expect(cap.overloaded).toBe(false);
        expect(cap.options).toEqual([]);
    });

    it('isolates users and scopes by project', async () => {
        const u1 = await makeUser('b1');
        const u2 = await makeUser('b2');
        await mkTask(u1, { title: 'Mine' });
        const risk2 = await Insights.getRisk(u2);
        expect(risk2.riskLevel).toBe('LOW');
        expect(risk2.scope.taskCount).toBe(0);
        const cp2 = await Insights.getCriticalPath(u2);
        expect(cp2.path).toEqual([]);
    });

    it('calibrates from timed sessions on completed work', async () => {
        const uid = await makeUser('c');
        const now = Date.now();
        for (let i = 0; i < 3; i++) {
            const t = await mkTask(uid, { title: `C${i}`, estimatedMinutes: 30 });
            await Sessions.log(uid, {
                taskId: t.id,
                startedAt: new Date(now - 3600000).toISOString(),
                endedAt: new Date(now).toISOString(),
                durationSeconds: 3600, // 60 min actual vs 30 estimated
            });
            await Svc.updateTask(uid, t.id, { status: 'completed' });
        }
        const cal = await Insights.getCalibration(uid);
        expect(cal.calibrated).toBe(true);
        expect(cal.samples).toBe(3);
        expect(cal.factor).toBe(2);
    });

    it('extends explain with the explanation object without breaking old fields', async () => {
        const uid = await makeUser('d');
        const a = await mkTask(uid, { title: 'Base' });
        const b = await mkTask(uid, { title: 'Blocked', dependencies: [a.id] });
        const out = await Insights.explainTask(uid, b.id);
        expect(out.blocked).toBe(true); // legacy field intact
        expect(out.breakdown).toBeDefined(); // legacy field intact
        expect(out.priorityExplanation.positiveFactors.length).toBeGreaterThan(0);
        expect(out.priorityExplanation.negativeFactors[0].code).toBe('blocked');
        expect(out.priorityExplanation.summary).toMatch(/pulls it down/);
        expect(await Insights.explainTask(uid, '00000000-0000-0000-0000-000000000000')).toBeNull();
    });

    it('simulates scenarios read-only without mutating production rows', async () => {
        const uid = await makeUser('e');
        const a = await mkTask(uid, { title: 'API', estimatedMinutes: 240 });
        await mkTask(uid, { title: 'UI', estimatedMinutes: 60, dependencies: [a.id] });
        const before = await TaskRepo.getById(uid, a.id);

        const out = await Insights.simulate(uid, {
            changes: {
                moveDeadlines: [{ taskId: a.id, deadline: new Date(Date.now() + 86400000).toISOString() }],
            },
        });
        expect(out.current.riskLevel).toBeDefined();
        expect(out.scenario.riskLevel).toBeDefined();
        expect(out.affected.taskIds).toEqual(expect.arrayContaining([a.id]));
        expect(out.bottleneckShift.from?.taskId).toBe(a.id);

        const after = await TaskRepo.getById(uid, a.id);
        expect(new Date(after.deadline).getTime()).toBe(new Date(before.deadline).getTime());
    });

    it('detects overruns and missed work as deviations', async () => {
        const uid = await makeUser('f');
        const over = await Svc.createTask(uid, { title: 'Heavy', estimatedMinutes: 60 });
        const now = Date.now();
        await Sessions.log(uid, {
            taskId: over.id,
            startedAt: new Date(now - 6600000).toISOString(),
            endedAt: new Date(now).toISOString(),
            durationSeconds: 6600,
        });
        await mkTask(uid, { title: 'Late', deadline: new Date(now - 86400000).toISOString() });
        const out = await Insights.getDeviations(uid);
        expect(out.deviations.some((d) => d.type === 'TASK_OVERRUN' && d.taskId === over.id)).toBe(true);
        expect(out.deviations.some((d) => d.type === 'MISSED_DEADLINE')).toBe(true);
    });

    it('reports drift patterns from reschedule history', async () => {
        const uid = await makeUser('g');
        const t = await mkTask(uid, { title: 'Slippery' });
        const pool = getPool();
        for (let i = 0; i < 3; i++) {
            await pool.query(
                `INSERT INTO task_events (user_id, task_id, event_type, payload) VALUES ($1,$2,'TASK_RESCHEDULED',$3)`,
                [uid, t.id, JSON.stringify({ from: null, to: null, reason: 'test' })]
            );
        }
        const out = await Insights.getDrift(uid);
        expect(out.patterns.some((p) => p.pattern === 'repeated_postponement')).toBe(true);
    });

    it('calibrates per category without guessing on thin data', async () => {
        const uid = await makeUser('h');
        const now = Date.now();
        for (let i = 0; i < 3; i++) {
            const t = await Svc.createTask(uid, { title: `W${i}`, estimatedMinutes: 30, category: 'Work' });
            await Sessions.log(uid, {
                taskId: t.id,
                startedAt: new Date(now - 3600000).toISOString(),
                endedAt: new Date(now).toISOString(),
                durationSeconds: 3600,
            });
            await Svc.updateTask(uid, t.id, { status: 'completed' });
        }
        const solo = await Svc.createTask(uid, { title: 'Solo', estimatedMinutes: 30, category: 'Study' });
        await Sessions.log(uid, {
            taskId: solo.id,
            startedAt: new Date(now - 3600000).toISOString(),
            endedAt: new Date(now).toISOString(),
            durationSeconds: 3600,
        });
        await Svc.updateTask(uid, solo.id, { status: 'completed' });
        const cal = await Insights.getCalibration(uid, { groupBy: 'category' });
        expect(cal.factor).toBe(2);
        expect(cal.groups.Work).toMatchObject({ factor: 2, calibrated: true });
        expect(cal.groups.Study.calibrated).toBe(false); // 1 sample: no guessing
    });

    it('proposes an auto-replan version with trigger and risk delta', async () => {
        const uid = await makeUser('i');
        await mkTask(uid, { title: 'OverdueBig', estimatedMinutes: 300, deadline: new Date(Date.now() - 86400000).toISOString() });
        const out = await Insights.autoReplan(uid);
        expect(out.applied).toBe(false);
        expect(out.planId).toBeTruthy();
        expect(out.trigger).toBe('MISSED_DEADLINE');
        expect(out.moves.length).toBeGreaterThan(0);
        expect(out.riskBefore).toBeDefined();
        expect(out.riskAfter).toBeDefined();
        const pool = getPool();
        const v = await pool.query(`SELECT reason, health_details FROM plan_versions WHERE id = $1`, [out.planId]);
        expect(v.rows[0].reason).toMatch(/overdue/i);
        expect(v.rows[0].health_details.state).toBe('proposed');
    });

    it('auto-replan stands down when nothing deviates', async () => {
        const uid = await makeUser('j');
        await mkTask(uid, { title: 'Fine' });
        const out = await Insights.autoReplan(uid);
        expect(out.planId).toBeNull();
        expect(out.trigger).toBe('none');
    });
});
