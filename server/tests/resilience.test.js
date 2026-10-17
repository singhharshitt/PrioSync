import { describe, it, expect } from 'vitest';
import { assessPlanResilience } from '../planner/resilience.js';

const D = (days) => new Date(Date.now() + days * 86400000).toISOString();
const t = (over, id = 't1') => ({
    id,
    title: `Task ${id}`,
    status: 'pending',
    estimatedMinutes: 60,
    deadline: null,
    dependencies: [],
    priorityScore: 50,
    ...over,
});

const NOW = new Date('2026-06-01T09:00:00Z');

describe('plan resilience engine (spec 27-28)', () => {
    it('handles zero tasks: cannot break', () => {
        const out = assessPlanResilience([], { capacityPerDay: 240, now: NOW });
        expect(out.feasibility.feasible).toBe(true);
        expect(out.resilience.level).toBe('HIGH');
        expect(out.perturbations).toEqual([]);
        expect(out.summary).toMatch(/cannot break/);
    });

    it('comfortable plan is feasible with a positive recovery margin', () => {
        const tasks = [t({ deadline: D(6) }), t({ estimatedMinutes: 30, deadline: D(6) }, 't2')];
        const out = assessPlanResilience(tasks, { capacityPerDay: 480, now: NOW });
        expect(out.feasibility.feasible).toBe(true);
        expect(out.recoveryMargin.perTaskMinutes).toBeGreaterThanOrEqual(0);
        expect(out.slackMinutes).toBeGreaterThan(0);
        expect(out.bufferConsumption).toBeGreaterThanOrEqual(0);
        expect(out.bufferConsumption).toBeLessThanOrEqual(1);
    });

    it('overloaded / zero-capacity plan is infeasible with failure points', () => {
        const tasks = [t({ estimatedMinutes: 600, deadline: D(2) }), t({ estimatedMinutes: 600, deadline: D(2) }, 't2')];
        const out = assessPlanResilience(tasks, { capacityPerDay: 0, now: NOW });
        expect(out.feasibility.feasible).toBe(false);
        expect(out.feasibility.requiredDays).toBeNull(); // infinite at zero capacity
        expect(out.failurePoints).toBeGreaterThan(0);
        expect(out.resilience.level).toBe('LOW');
        expect(out.recoveryMargin.perTaskMinutes).toBe(0);
        expect(out.summary).toMatch(/infeasible/);
    });

    it('probes all six documented perturbations', () => {
        const tasks = [t({ deadline: D(3), dependencies: [] }), t({ deadline: D(4) }, 't2')];
        const out = assessPlanResilience(tasks, { capacityPerDay: 240, now: NOW });
        const codes = out.perturbations.map((p) => p.code);
        expect(codes).toEqual([
            'task_overrun',
            'lost_capacity',
            'task_delay',
            'deadline_acceleration',
            'unexpected_interruption',
            'dependency_delay',
        ]);
        for (const p of out.perturbations) {
            expect(p.riskAfter).toBeGreaterThanOrEqual(0);
            expect(typeof p.note).toBe('string');
        }
    });

    it('builds a sensitivity ladder of four steps with outcomes', () => {
        const tasks = [t({ estimatedMinutes: 300, deadline: D(4) }), t({ estimatedMinutes: 300, deadline: D(4) }, 't2')];
        const out = assessPlanResilience(tasks, { capacityPerDay: 300, now: NOW });
        expect(out.sensitivity).toHaveLength(4);
        expect(out.sensitivity.map((s) => s.overrunMinutes)).toEqual([15, 30, 60, 90]);
        for (const s of out.sensitivity) {
            expect(s.outcome).toMatch(/feasible|buffer reduced|schedule shifts|capacity exceeded|risk/);
            expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(s.riskLevel);
        }
        // Higher overrun can never reduce the risk score.
        for (let i = 1; i < out.sensitivity.length; i++) {
            expect(out.sensitivity[i].riskScore).toBeGreaterThanOrEqual(out.sensitivity[i - 1].riskScore);
        }
    });

    it('reports delay tolerance only when a deadline exists', () => {
        const withDeadline = assessPlanResilience([t({ deadline: D(5) })], { capacityPerDay: 240, now: NOW });
        const noDeadline = assessPlanResilience([t({ deadline: null })], { capacityPerDay: 240, now: NOW });
        expect(withDeadline.delayToleranceDays).not.toBeNull();
        expect(withDeadline.delayToleranceDays).toBeGreaterThanOrEqual(0);
        expect(noDeadline.delayToleranceDays).toBeNull();
    });

    it('names the largest fragility when a bottleneck exists', () => {
        const tasks = [
            t({ id: 'gate', estimatedMinutes: 90, deadline: D(3) }),
            t({ id: 'down', dependencies: ['gate'], deadline: D(4) }),
        ];
        const out = assessPlanResilience(tasks, { capacityPerDay: 240, now: NOW });
        expect(out.largestFragility).not.toBeNull();
        expect(out.largestFragility.text).toMatch(/gates 1 task/);
        expect(out.largestFragility.trigger).toBeTruthy();
    });

    it('is deterministic and never mutates the input', () => {
        const tasks = [t({ deadline: D(3) }), t({ estimatedMinutes: 120, deadline: D(2) }, 't2')];
        const snapshot = JSON.stringify(tasks);
        const a = assessPlanResilience(tasks, { capacityPerDay: 240, now: NOW });
        const b = assessPlanResilience(tasks, { capacityPerDay: 240, now: NOW });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(JSON.stringify(tasks)).toBe(snapshot);
    });

    it('handles overdue tasks without crashing', () => {
        const out = assessPlanResilience([t({ deadline: D(-3) })], { capacityPerDay: 240, now: NOW });
        expect(out.feasibility).toBeDefined();
        expect(out.perturbations).toHaveLength(6);
    });
});
