import { describe, it, expect } from 'vitest';
import {
    calculateCriticalPath,
    findBottlenecks,
    calculateBlockedWork,
    calculateDelayPropagation,
} from '../planner/criticalPath.js';

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

describe('critical path', () => {
    it('finds the longest chain through a diamond', () => {
        // a(30) -> b(120) -> d(30); a -> c(30) -> d. Longest: a,b,d = 180.
        const tasks = [
            t({ id: 'a', estimatedMinutes: 30 }),
            t({ id: 'b', estimatedMinutes: 120, dependencies: ['a'] }),
            t({ id: 'c', estimatedMinutes: 30, dependencies: ['a'] }),
            t({ id: 'd', estimatedMinutes: 30, dependencies: ['b', 'c'] }),
        ];
        const cp = calculateCriticalPath(tasks);
        expect(cp.path.map((p) => p.taskId)).toEqual(['a', 'b', 'd']);
        expect(cp.totalMinutes).toBe(180);
        expect(cp.path[2].cumulativeMinutes).toBe(180);
    });

    it('returns empty for zero tasks and single for one task', () => {
        expect(calculateCriticalPath([])).toEqual({ path: [], totalMinutes: 0, taskCount: 0 });
        const one = calculateCriticalPath([t({ id: 'solo', estimatedMinutes: 45 })]);
        expect(one.path.map((p) => p.taskId)).toEqual(['solo']);
        expect(one.totalMinutes).toBe(45);
    });

    it('excludes completed tasks from the path', () => {
        const tasks = [
            t({ id: 'done', status: 'completed', estimatedMinutes: 500 }),
            t({ id: 'a', estimatedMinutes: 30, dependencies: ['done'] }),
        ];
        const cp = calculateCriticalPath(tasks);
        expect(cp.path.map((p) => p.taskId)).toEqual(['a']);
    });

    it('survives circular input without hanging', () => {
        const tasks = [
            t({ id: 'a', dependencies: ['b'] }),
            t({ id: 'b', dependencies: ['a'] }),
        ];
        const cp = calculateCriticalPath(tasks);
        expect(cp.totalMinutes).toBeGreaterThan(0);
        expect(cp.taskCount).toBeLessThanOrEqual(2);
    });
});

describe('bottlenecks', () => {
    it('names the task gating the most downstream work', () => {
        const tasks = [
            t({ id: 'api', estimatedMinutes: 60 }),
            ...['d1', 'd2', 'd3'].map((id) => t({ id, estimatedMinutes: 30, dependencies: ['api'] })),
            t({ id: 'lone', estimatedMinutes: 30 }),
        ];
        const { primary, bottlenecks } = findBottlenecks(tasks);
        expect(primary.taskId).toBe('api');
        expect(primary.downstreamCount).toBe(3);
        expect(primary.explanation).toMatch(/gates 3 downstream tasks/);
        expect(bottlenecks[0].taskId).toBe('api');
    });

    it('returns null primary when nothing gates anything', () => {
        const { primary, bottlenecks } = findBottlenecks([t({ id: 'a' }), t({ id: 'b' })]);
        expect(primary).toBeNull();
        expect(bottlenecks).toEqual([]);
    });
});

describe('blocked work', () => {
    it('sums estimates of tasks with incomplete deps', () => {
        const tasks = [
            t({ id: 'open-dep', estimatedMinutes: 20 }),
            t({ id: 'x', estimatedMinutes: 40, dependencies: ['open-dep'] }),
            t({ id: 'y', estimatedMinutes: 50, dependencies: ['done-dep'] }),
            t({ id: 'done-dep', status: 'completed' }),
        ];
        const bw = calculateBlockedWork(tasks);
        expect(bw.blockedCount).toBe(1);
        expect(bw.blockedMinutes).toBe(40);
        expect(bw.tasks.find((x) => x.taskId === 'x').blockedBy).toEqual(['open-dep']);
    });
});

describe('delay propagation', () => {
    it('reports affected downstream work and critical-path hit', () => {
        const tasks = [
            t({ id: 'a', estimatedMinutes: 60 }),
            t({ id: 'b', estimatedMinutes: 30, dependencies: ['a'] }),
            t({ id: 'c', estimatedMinutes: 30, dependencies: ['b'] }),
            t({ id: 'side', estimatedMinutes: 15 }),
        ];
        const d = calculateDelayPropagation(tasks, 'a', 45);
        expect(d.affectedCount).toBe(2);
        expect(d.affectedMinutes).toBe(60);
        expect(d.onCriticalPath).toBe(true);
        const d2 = calculateDelayPropagation(tasks, 'side', 45);
        expect(d2.affectedCount).toBe(0);
        expect(d2.onCriticalPath).toBe(false);
    });
});
