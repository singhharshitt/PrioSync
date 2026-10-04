import { describe, it, expect } from 'vitest';
import { detectDeviations } from '../planner/deviations.js';
import { detectDrift } from '../planner/drift.js';

const NOW = new Date('2026-10-05T09:00:00.000Z').getTime();
const H = 3600000;
const t = (over, id = 't1') => ({
    id,
    title: `Task ${id}`,
    status: 'pending',
    estimatedMinutes: 60,
    deadline: null,
    dependencies: [],
    priorityScore: 50,
    category: 'Work',
    ...over,
});

describe('deviation detection', () => {
    it('flags tasks whose timed work dwarfs the estimate', () => {
        const tasks = [t({ id: 'a', estimatedMinutes: 60, status: 'completed' })];
        const sessions = [{ taskId: 'a', durationSeconds: 6600, endedAt: new Date(NOW).toISOString() }];
        const out = detectDeviations(tasks, sessions, { now: new Date(NOW) });
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ type: 'TASK_OVERRUN', overPercent: 83, severity: 'medium' });
        expect(out[0].message).toMatch(/110m vs 60m/);
    });

    it('ignores small excesses as noise', () => {
        const tasks = [t({ id: 'a', estimatedMinutes: 60 })];
        const sessions = [{ taskId: 'a', durationSeconds: 3900 }]; // 65m vs 60m
        expect(detectDeviations(tasks, sessions, { now: new Date(NOW) })).toEqual([]);
    });

    it('flags overdue open work and near-term blocked work', () => {
        const tasks = [
            t({ id: 'late', deadline: new Date(NOW - 3 * 24 * H).toISOString() }),
            t({ id: 'gate', deadline: new Date(NOW + 30 * H).toISOString(), dependencies: ['late'] }),
            t({ id: 'fine', deadline: new Date(NOW + 9 * 24 * H).toISOString() }),
        ];
        const out = detectDeviations(tasks, [], { now: new Date(NOW) });
        const missed = out.find((d) => d.type === 'MISSED_DEADLINE');
        expect(missed).toMatchObject({ taskId: 'late', daysOverdue: 3, severity: 'high' });
        const risk = out.find((d) => d.type === 'BLOCKED_AT_RISK');
        expect(risk?.taskId).toBe('gate');
        expect(out.some((d) => d.taskId === 'fine')).toBe(false);
    });

    it('is quiet on clean data', () => {
        expect(detectDeviations([t({})], [], { now: new Date(NOW) })).toEqual([]);
        expect(detectDeviations([], [], { now: new Date(NOW) })).toEqual([]);
    });
});

describe('reality drift', () => {
    it('reports repeatedly rescheduled tasks', () => {
        const tasks = [t({ id: 'a' })];
        const events = [1, 2, 3].map(() => ({ eventType: 'TASK_RESCHEDULED', taskId: 'a' }));
        const out = detectDrift({ tasks, sessions: [], events });
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ pattern: 'repeated_postponement', count: 1 });
        expect(out[0].evidence).toMatch(/rescheduled 3\+ times/);
    });

    it('reports chronic underestimation per category with minimum samples', () => {
        const tasks = [1, 2].map((i) => t({ id: `w${i}`, status: 'completed', estimatedMinutes: 60, category: 'Work' }));
        const sessions = tasks.map((x) => ({ taskId: x.id, durationSeconds: 3600 }));
        // Only 2 samples - stays quiet.
        expect(detectDrift({ tasks, sessions, events: [] })).toEqual([]);
        const tasks3 = [...tasks, t({ id: 'w3', status: 'completed', estimatedMinutes: 60, category: 'Work' })];
        const sessions3 = [...sessions, { taskId: 'w3', durationSeconds: 7200 }];
        const out = detectDrift({ tasks: tasks3, sessions: sessions3, events: [] });
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ pattern: 'chronic_underestimation', scope: 'Work' });
        expect(out[0].factor).toBeCloseTo(1.33, 1);
    });

    it('reports fragmented open work and stays quiet otherwise', () => {
        const tasks = [t({ id: 'a' })];
        const sessions = [1, 2, 3, 4].map(() => ({ taskId: 'a', durationSeconds: 600 }));
        const out = detectDrift({ tasks, sessions, events: [] });
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ pattern: 'fragmented_sessions', count: 1 });
        expect(detectDrift({ tasks: [], sessions: [], events: [] })).toEqual([]);
    });
});
