import { describe, it, expect } from 'vitest';
import { analyzeCapacity } from '../planner/capacity.js';
import { buildPriorityExplanation } from '../planner/priorityExplain.js';

const t = (over, id = 't1') => ({
    id,
    title: `Task ${id}`,
    status: 'pending',
    estimatedMinutes: 60,
    dependencies: [],
    priorityScore: 50,
    ...over,
});

describe('capacity analysis', () => {
    it('reports balance when work fits', () => {
        const c = analyzeCapacity([t({}), t({})], { capacityPerDay: 240, days: 7 });
        expect(c.plannedMinutes).toBe(120);
        expect(c.capacityMinutes).toBe(1680);
        expect(c.overloaded).toBe(false);
        expect(c.options).toEqual([]);
    });

    it('detects overload and prices all four relief options', () => {
        const tasks = [
            t({ id: 'big', estimatedMinutes: 600, priorityScore: 90 }),
            t({ id: 'small', estimatedMinutes: 120, priorityScore: 10 }),
        ];
        const c = analyzeCapacity(tasks, { capacityPerDay: 240, days: 1 });
        expect(c.overloaded).toBe(true);
        expect(c.overloadMinutes).toBe(480);
        expect(c.options.map((o) => o.code)).toEqual([
            'move_low_impact',
            'extend_deadline',
            'raise_capacity',
            'reduce_scope',
        ]);
        const move = c.options[0];
        expect(move.taskIds).toEqual(['small', 'big']); // lowest priority first until overload covered
        expect(move.minutesRelieved).toBe(720);
        expect(c.options[1].extraDays).toBe(2); // 480 / 240
        expect(c.options[2].neededPerDay).toBe(720);
    });

    it('handles zero capacity and empty scope', () => {
        const zero = analyzeCapacity([t({})], { capacityPerDay: 0, days: 7 });
        expect(zero.overloaded).toBe(true);
        expect(zero.options[1].extraDays).toBeGreaterThanOrEqual(1);
        const empty = analyzeCapacity([], { capacityPerDay: 240, days: 7 });
        expect(empty.overloaded).toBe(false);
        expect(empty.plannedMinutes).toBe(0);
    });

    it('scales estimates by the calibration factor', () => {
        const c = analyzeCapacity([t({ estimatedMinutes: 60 })], {
            capacityPerDay: 10000,
            days: 1,
            calibrationFactor: 1.5,
        });
        expect(c.plannedMinutes).toBe(90);
    });
});

describe('priority explanation', () => {
    const breakdown = {
        urgencyContrib: 24,
        importanceContrib: 20,
        deadlineContrib: 25,
        easeContrib: 12,
        blockedPenalty: 0,
    };

    it('splits positive/negative factors and summarizes the top driver', () => {
        const e = buildPriorityExplanation({ breakdown, blocked: false, unlocks: 3 });
        expect(e.positiveFactors[0]).toMatchObject({ code: 'deadline', points: 25 });
        expect(e.positiveFactors.map((f) => f.points)).toEqual([25, 24, 20, 12]);
        expect(e.negativeFactors).toEqual([]);
        expect(e.info[0].code).toBe('unlocks');
        expect(e.summary).toMatch(/Deadline pressure \(\+25\) drives this score/);
        expect(e.summary).toMatch(/unlocks 3 downstream tasks/);
    });

    it('lists the blocked penalty as a negative factor', () => {
        const e = buildPriorityExplanation({
            breakdown: { ...breakdown, blockedPenalty: -20 },
            blocked: true,
            unlocks: 0,
        });
        expect(e.negativeFactors).toEqual([
            { code: 'blocked', label: 'Blocked by unfinished dependencies', points: -20 },
        ]);
        expect(e.summary).toMatch(/pulls it down/);
    });

    it('factor points reconstruct the engine score', () => {
        const e = buildPriorityExplanation({ breakdown, blocked: false, unlocks: 0 });
        const total = e.factors.reduce((s, f) => s + f.points, 0);
        expect(total).toBe(24 + 20 + 25 + 12); // 81 = engine score for 4/4/4.5/3-ish inputs
    });
});
