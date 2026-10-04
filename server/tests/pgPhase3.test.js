/**
 * Phase 3 integration (service level). OPT-IN ONLY: RUN_PG_TESTS=1.
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
import * as Insights from '../services/insightService.js';

const pgEnabled = !!process.env.RUN_PG_TESTS;
const created = [];

const makeUser = async (tag) => {
    const u = await Users.create({
        email: `__test__p3__${tag}__${Date.now()}@example.com`,
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

const mkTask = (uid, over) =>
    Svc.createTask(uid, {
        title: 'T',
        importance: 3,
        urgency: 3,
        estimatedMinutes: 60,
        deadline: new Date(Date.now() + 3 * 86400000).toISOString(),
        ...over,
    });

describe.skipIf(!pgEnabled)('pg phase3', () => {
    it('reads and writes planner preferences', async () => {
        const uid = await makeUser('prefs');
        const before = await Users.getPreferences(uid);
        expect(before.available_minutes_per_day).toBe(240);
        const after = await Users.updatePreferences(uid, {
            availableMinutesPerDay: 180,
            energyMorning: 'low',
            energyEvening: 'high',
        });
        expect(after).toMatchObject({
            available_minutes_per_day: 180,
            energy_morning: 'low',
            energy_evening: 'high',
        });
        const reread = await Users.getPreferences(uid);
        expect(reread.energy_morning).toBe('low');
    });

    it('round-trips commitment fields on create and update', async () => {
        const uid = await makeUser('commit');
        const t = await Svc.createTask(uid, {
            title: 'Client launch',
            commitmentType: 'client',
            stakeholder: 'Acme',
        });
        expect(t.commitmentType).toBe('client');
        expect(t.stakeholder).toBe('Acme');
        const upd = await Svc.updateTask(uid, t.id, { commitmentType: 'team', stakeholder: 'Pods' });
        expect(upd.row.commitmentType).toBe('team');
        expect(upd.row.stakeholder).toBe('Pods');
    });

    it('persists camelCase estimate/energy/project updates (no silent drops)', async () => {
        const uid = await makeUser('camel');
        const t = await mkTask(uid, { title: 'Tunable' });
        const upd = await Svc.updateTask(uid, t.id, {
            estimatedMinutes: 150,
            energyFit: 'high',
            category: 'Study',
        });
        expect(upd.row.estimatedMinutes).toBe(150);
        expect(upd.row.energyFit).toBe('high');
        expect(upd.row.category).toBe('Study');
    });

    it('builds an energy-matched day plan within budget', async () => {
        const uid = await makeUser('dayplan');
        await Users.updatePreferences(uid, { availableMinutesPerDay: 240 });
        await mkTask(uid, { title: 'Deep work', estimatedMinutes: 120, energyFit: 'high', importance: 5, urgency: 5 });
        await mkTask(uid, { title: 'Email triage', estimatedMinutes: 30, energyFit: 'low', importance: 2, urgency: 2 });
        const plan = await Insights.getDayPlan(uid);
        expect(plan.totalMinutes).toBeLessThanOrEqual(240);
        const morning = plan.periods.find((p) => p.key === 'morning');
        expect(morning.tasks.some((x) => x.title === 'Deep work' && x.energyMatch)).toBe(true);
        const evening = plan.periods.find((p) => p.key === 'evening');
        expect(evening.tasks.some((x) => x.title === 'Email triage')).toBe(true);
    });

    it('reports scope growth against a goal baseline', async () => {
        const uid = await makeUser('scope');
        const pool = getPool();
        const g = await pool.query(
            `INSERT INTO goals (user_id, title, created_at) VALUES ($1,$2, now() - interval '30 days') RETURNING id`,
            [uid, 'Old goal']
        );
        const goalId = g.rows[0].id;
        await mkTask(uid, { title: 'New 1', goalId });
        await mkTask(uid, { title: 'New 2', goalId });
        const s = await Insights.getScope(uid, { goalId });
        expect(s).toMatchObject({ originalTasks: 0, currentTasks: 2, addedTasks: 2, growthPct: null });
        expect(s.message).toMatch(/2 added/);
        await expect(Insights.getScope(uid, { goalId: '00000000-0000-0000-0000-000000000000' })).rejects.toMatchObject({
            status: 404,
        });
    });

    it('flags at-risk external commitments', async () => {
        const uid = await makeUser('commit2');
        await mkTask(uid, {
            title: 'Client demo',
            commitmentType: 'client',
            stakeholder: 'Acme',
            deadline: new Date(Date.now() - 86400000).toISOString(),
        });
        await mkTask(uid, { title: 'Personal note', commitmentType: 'personal' });
        const out = await Insights.getCommitments(uid);
        expect(out.count).toBe(1);
        expect(out.atRiskCount).toBe(1);
        expect(out.commitments[0]).toMatchObject({ title: 'Client demo', stakeholder: 'Acme' });
        expect(out.commitments[0].riskFlags).toContain('overdue');
    });

    it('orders work with context grouping', async () => {
        const uid = await makeUser('ctx');
        await mkTask(uid, { title: 'J1', category: 'Java', importance: 4, urgency: 4 });
        await mkTask(uid, { title: 'S1', category: 'SQL', importance: 4, urgency: 4 });
        const out = await Insights.getContextOrder(uid, { lambda: 0 });
        expect(out.order).toHaveLength(2);
        expect(out.totalSwitchCost).toBeGreaterThanOrEqual(0);
    });
});
