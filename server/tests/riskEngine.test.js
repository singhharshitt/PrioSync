import { describe, it, expect } from 'vitest';
import { assessDeadlineRisk } from '../planner/riskEngine.js';

const NOW = new Date('2026-10-05T09:00:00.000Z');
const H = 3600000;
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

describe('deadline risk engine', () => {
    it('is LOW when work fits comfortably', () => {
        const r = assessDeadlineRisk(
            [t({ deadline: new Date(NOW.getTime() + 5 * 24 * H).toISOString() })],
            { capacityPerDay: 240, now: NOW }
        );
        expect(r.riskLevel).toBe('LOW');
        expect(r.riskScore).toBeLessThan(30);
        expect(r.remainingMinutes).toBe(60);
        expect(r.summary).toMatch(/on track/i);
    });

    it('goes CRITICAL when load far exceeds capacity', () => {
        const tasks = Array.from({ length: 10 }, (_, i) =>
            t({ id: `t${i}`, estimatedMinutes: 120, deadline: new Date(NOW.getTime() + 24 * H).toISOString() })
        );
        const r = assessDeadlineRisk(tasks, { capacityPerDay: 120, now: NOW });
        expect(r.riskLevel).toBe('CRITICAL');
        expect(r.riskScore).toBeGreaterThanOrEqual(75);
        expect(r.factors[0].code).toBe('load');
    });

    it('adds blocked and overdue points with explanations', () => {
        const r = assessDeadlineRisk(
            [
                t({ id: 'a', estimatedMinutes: 60, deadline: new Date(NOW.getTime() - H).toISOString(), dependencies: ['ghost'] }),
                t({ id: 'b', estimatedMinutes: 60, deadline: new Date(NOW.getTime() + 5 * 24 * H).toISOString() }),
            ],
            { capacityPerDay: 480, now: NOW }
        );
        expect(r.overdueCount).toBe(1);
        expect(r.blockedCount).toBe(1);
        expect(r.factors.some((f) => f.code === 'overdue')).toBe(true);
        expect(r.factors.some((f) => f.code === 'blocked')).toBe(true);
        expect(r.summary).toMatch(/risk is (medium|high|critical) because/i);
    });

    it('returns LOW with zero tasks', () => {
        const r = assessDeadlineRisk([], { now: NOW });
        expect(r.riskLevel).toBe('LOW');
        expect(r.riskScore).toBe(0);
        expect(r.remainingMinutes).toBe(0);
    });

    it('caps at MEDIUM when nothing has a deadline', () => {
        const tasks = Array.from({ length: 20 }, (_, i) => t({ id: `t${i}`, estimatedMinutes: 300 }));
        const r = assessDeadlineRisk(tasks, { capacityPerDay: 60, now: NOW });
        expect(r.riskLevel).toBe('MEDIUM');
        expect(r.riskScore).toBeLessThanOrEqual(54);
        expect(r.factors.some((f) => f.code === 'no_deadline')).toBe(true);
    });

    it('treats zero daily capacity as maximum load', () => {
        const r = assessDeadlineRisk(
            [t({ deadline: new Date(NOW.getTime() + 24 * H).toISOString() })],
            { capacityPerDay: 0, now: NOW }
        );
        expect(['HIGH', 'CRITICAL']).toContain(r.riskLevel);
    });

    it('floors at MEDIUM when anything is already overdue', () => {
        const r = assessDeadlineRisk(
            [t({ deadline: new Date(NOW.getTime() - H).toISOString() })],
            { capacityPerDay: 10000, now: NOW }
        );
        expect(r.riskLevel).toBe('MEDIUM');
        expect(r.riskScore).toBeGreaterThanOrEqual(30);
    });

    it('applies the calibration factor to remaining work', () => {
        const tasks = [t({ estimatedMinutes: 60, deadline: new Date(NOW.getTime() + 24 * H).toISOString() })];
        const plain = assessDeadlineRisk(tasks, { capacityPerDay: 240, calibrationFactor: 1, now: NOW });
        const adj = assessDeadlineRisk(tasks, { capacityPerDay: 240, calibrationFactor: 2, calibrationSamples: 5, now: NOW });
        expect(adj.remainingMinutes).toBe(plain.remainingMinutes * 2);
        expect(adj.factors.some((f) => f.code === 'calibration')).toBe(true);
    });

    it('flags uncalibrated estimates without scoring them', () => {
        const r = assessDeadlineRisk([t({})], { calibrationSamples: 0, now: NOW });
        const f = r.factors.find((x) => x.code === 'uncalibrated');
        expect(f).toBeDefined();
        expect(f.points).toBe(0);
    });

    it('ignores completed tasks and clamps invalid durations', () => {
        const r = assessDeadlineRisk(
            [
                t({ id: 'done', status: 'completed', estimatedMinutes: 600 }),
                t({ id: 'neg', estimatedMinutes: -50 }),
            ],
            { capacityPerDay: 10000, now: NOW }
        );
        expect(r.remainingMinutes).toBe(1);
        expect(r.riskLevel).toBe('LOW');
    });

    it('is deterministic for a fixed now', () => {
        const tasks = [t({ deadline: new Date(NOW.getTime() + 2 * 24 * H).toISOString() })];
        const a = assessDeadlineRisk(tasks, { capacityPerDay: 200, now: NOW });
        const b = assessDeadlineRisk(tasks, { capacityPerDay: 200, now: NOW });
        expect(a).toEqual(b);
    });
});
