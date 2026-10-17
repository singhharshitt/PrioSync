import { describe, it, expect } from 'vitest';
import {
    detectInfeasibility,
    enumerateConstraints,
    generateResolutionOptions,
} from '../planner/constraints.js';
import { buildRecoveryPlans } from '../planner/recovery.js';

const D = (days) => new Date(Date.now() + days * 86400000).toISOString();
const t = (over, id = 't1') => ({
    id,
    title: `Task ${id}`,
    status: 'pending',
    estimatedMinutes: 60,
    deadline: null,
    dependencies: [],
    priorityScore: 50,
    priorityTier: 'medium',
    commitmentType: 'personal',
    category: 'General',
    energyFit: 'normal',
    ...over,
});

const NOW = new Date('2026-06-01T09:00:00Z');
const Dn = (days) => new Date(NOW.getTime() + days * 86400000).toISOString();

describe('constraint resolution (spec 31-32)', () => {
    it('feasible plan reports no infeasibility and no options', () => {
        const tasks = [t({ estimatedMinutes: 60, deadline: D(5) })];
        const out = generateResolutionOptions(tasks, { capacityPerDay: 480, days: 7, now: NOW });
        expect(out.detection.infeasible).toBe(false);
        expect(out.options).toEqual([]);
        expect(out.message).toMatch(/feasible/);
    });

    it('zero tasks are never infeasible', () => {
        const out = detectInfeasibility([], { capacityPerDay: 240, days: 7, now: NOW });
        expect(out.infeasible).toBe(false);
        expect(out.remainingMinutes).toBe(0);
    });

    it('matches the spec example arithmetic: 18h work vs 11h capacity = 7h deficit', () => {
        const tasks = [t({ estimatedMinutes: 1080, deadline: new Date(NOW.getTime() + 86400000).toISOString() })];
        const out = detectInfeasibility(tasks, { capacityPerDay: 660, days: 1, now: NOW });
        expect(out.infeasible).toBe(true);
        expect(out.deficitMinutes).toBe(420);
        expect(out.reasons.join(' ')).toMatch(/7\.0h/);
        expect(out.requiredDays).toBe(2);
        expect(out.deadlineDeficitDays).toBe(1);
    });

    it('zero capacity with remaining work is infeasible', () => {
        const out = detectInfeasibility([t({ estimatedMinutes: 60 })], { capacityPerDay: 0, days: 7, now: NOW });
        expect(out.infeasible).toBe(true);
        expect(out.reasons.join(' ')).toMatch(/zero/);
    });

    it('generates deterministic OPTION A-D with projected risk', () => {
        const tasks = [
            t({ id: 'a', estimatedMinutes: 600, deadline: D(2), priorityScore: 90, priorityTier: 'critical' }),
            t({ id: 'b', estimatedMinutes: 600, deadline: D(3), priorityScore: 20 }),
            t({ id: 'c', estimatedMinutes: 300, deadline: D(4), priorityScore: 10, commitmentType: 'work' }),
        ];
        const out = generateResolutionOptions(tasks, { capacityPerDay: 60, days: 7, now: NOW });
        expect(out.detection.infeasible).toBe(true);
        const keys = out.options.map((o) => o.key);
        expect(keys).toEqual(expect.arrayContaining(['A', 'C', 'D']));
        for (const o of out.options) {
            expect(o.label).toMatch(/^OPTION [A-D]/);
            expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(o.projected.riskLevel);
            expect(typeof o.projected.riskScore).toBe('number');
            expect(o.changes).toBeTypeOf('object');
        }
        // Option A must actually clear the capacity deficit.
        const optA = out.options.find((o) => o.key === 'A');
        expect(optA.projected.overloaded).toBe(false);
        expect(optA.projected.riskScore).toBeLessThanOrEqual(out.riskBaseline.riskScore);
    });

    it('enumerates only real constraints plus capacity', () => {
        const tasks = [
            t({ id: 'a', deadline: D(2), commitmentType: 'work', estimatedMinutes: 180 }),
            t({ id: 'b', dependencies: ['a'], energyFit: 'low', deadline: D(3) }),
        ];
        const list = enumerateConstraints(tasks, { capacityPerDay: 240, days: 7 });
        const types = list.map((c) => c.type);
        expect(types).toContain('capacity');
        expect(types).toContain('dependency_order');
        expect(types).toContain('deadline');
        expect(types).toContain('energy');
        expect(types).toContain('commitment');
        expect(types).toContain('continuous_time');
        for (const c of list) expect(c.count).toBeGreaterThan(0);
    });

    it('never mutates input tasks', () => {
        const tasks = [t({ estimatedMinutes: 900, deadline: D(1) })];
        const snapshot = JSON.stringify(tasks);
        generateResolutionOptions(tasks, { capacityPerDay: 60, days: 7, now: NOW });
        expect(JSON.stringify(tasks)).toBe(snapshot);
    });
});

describe('recovery planner (spec 33-34)', () => {
    it('handles zero tasks', () => {
        const out = buildRecoveryPlans([], { capacityPerDay: 240, now: NOW });
        expect(out.plans).toEqual([]);
        expect(out.message).toMatch(/No open work/);
    });

    it('triggers on lost capacity and produces a comparison', () => {
        const tasks = [
            t({ id: 'a', estimatedMinutes: 480, deadline: D(3), priorityScore: 90, priorityTier: 'critical' }),
            t({ id: 'b', estimatedMinutes: 300, deadline: D(4), priorityScore: 30 }),
            t({ id: 'c', estimatedMinutes: 300, deadline: D(5), priorityScore: 20 }),
        ];
        const out = buildRecoveryPlans(tasks, { capacityPerDay: 120, now: NOW, lostMinutes: 90 });
        expect(out.triggers.some((x) => x.type === 'unexpected_interruption')).toBe(true);
        expect(out.current).toHaveProperty('riskScore');
        expect(out.current).toHaveProperty('slackMinutes');
        expect(out.plans.length).toBeGreaterThan(0);
        for (const p of out.plans) {
            expect(p.steps.length).toBeGreaterThan(0);
            expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(p.projected.riskLevel);
            expect(p.projected).toHaveProperty('slackDelta');
            const improved =
                p.projected.riskScore < out.current.riskScore ||
                (out.current.overloaded && !p.projected.overloaded) ||
                p.projected.slackMinutes > out.current.slackMinutes;
            expect(improved).toBe(true);
        }
        expect(out.message).toMatch(/choose|stands/);
    });

    it('plans never apply: changes stay as data proposals', () => {
        const tasks = [t({ estimatedMinutes: 600, deadline: D(2) })];
        const snapshot = JSON.stringify(tasks);
        const out = buildRecoveryPlans(tasks, { capacityPerDay: 60, now: NOW, lostMinutes: 120 });
        expect(JSON.stringify(tasks)).toBe(snapshot);
        for (const p of out.plans) {
            expect(p.changes.removeTaskIds || p.changes.addDays || p.changes.capacityPerDay).toBeDefined();
        }
    });

    it('comfortable plan with no disruption yields honest messaging', () => {
        const tasks = [t({ estimatedMinutes: 60, deadline: D(6) })];
        const out = buildRecoveryPlans(tasks, { capacityPerDay: 480, now: NOW });
        expect(out.triggers.filter((x) => x.type === 'unexpected_interruption')).toHaveLength(0);
        expect(typeof out.message).toBe('string');
        expect(out.current.riskLevel).toMatch(/LOW|MEDIUM|HIGH|CRITICAL/);
    });

    it('is deterministic: same input, same plans', () => {
        const tasks = [t({ estimatedMinutes: 900, deadline: D(2) }), t({ estimatedMinutes: 300, deadline: D(3) }, 't2')];
        const a = buildRecoveryPlans(tasks, { capacityPerDay: 90, now: NOW, lostMinutes: 60 });
        const b = buildRecoveryPlans(tasks, { capacityPerDay: 90, now: NOW, lostMinutes: 60 });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('handles simultaneous disruptions (overdue + blocked + overload)', () => {
        const tasks = [
            t({ id: 'a', estimatedMinutes: 600, deadline: Dn(-2) }),
            t({ id: 'b', dependencies: ['missing'], estimatedMinutes: 300, deadline: Dn(-1) }),
        ];
        const out = buildRecoveryPlans(tasks, { capacityPerDay: 60, now: NOW, lostMinutes: 120 });
        const types = out.triggers.map((x) => x.type);
        expect(types).toContain('unexpected_interruption');
        expect(types).toContain('missed_deadline');
        expect(types).toContain('blocked_dependency');
        expect(types).toContain('capacity_loss');
        expect(out.plans.length).toBeGreaterThan(0);
    });
});
