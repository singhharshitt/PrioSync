import { describe, it, expect } from 'vitest';
import { computePlanHealth } from '../planner/planHealth.js';

const task = (patch = {}) => ({
    key: 't1',
    estimatedMinutes: 60,
    deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    dependsOn: [],
    estimatedUncertain: false,
    ...patch,
});

describe('planHealth', () => {
    it('scores 100 for a fitting, dated, certain plan', () => {
        const h = computePlanHealth({
            tasks: [task({ key: 't1' }), task({ key: 't2' })],
            availableMinutesPerDay: 120,
            goalDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        });
        expect(h.score).toBe(100);
        expect(h.warnings).toEqual([]);
        expect(h.checks.length).toBeGreaterThan(0);
    });

    it('penalizes overload with actionable warnings', () => {
        const h = computePlanHealth({
            tasks: Array.from({ length: 10 }, (_, i) => task({ key: `t${i}`, estimatedMinutes: 120 })),
            availableMinutesPerDay: 60,
            goalDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
        });
        expect(h.score).toBeLessThan(100);
        expect(h.warnings.some((w) => /Overloaded/.test(w))).toBe(true);
    });

    it('flags unknown availability instead of assuming', () => {
        const h = computePlanHealth({ tasks: [task()], availableMinutesPerDay: null, goalDeadline: null });
        expect(h.warnings.some((w) => /unknown/.test(w))).toBe(true);
    });
});
