import { describe, it, expect } from 'vitest';
import { scheduleTasksGreedy, buildTaskDAG } from '../dsa-engine/scheduler.js';

const PAST = new Date(Date.now() - 86400000).toISOString();
const FAR = new Date(Date.now() + 60 * 86400000).toISOString();

const t = (id, patch = {}) => ({
    _id: id,
    urgency: 3,
    importance: 3,
    difficulty: 3,
    deadline: FAR,
    status: 'pending',
    dependencies: [],
    ...patch,
});

describe('greedy scheduler', () => {
    it('orders by score; the -20 blocked penalty sinks dependents below their blocker', () => {
        const tasks = [
            t('low', { urgency: 1, importance: 1 }),
            t('high', { urgency: 5, importance: 5, deadline: PAST }),
            t('blocked', { urgency: 5, importance: 5, deadline: PAST, dependencies: ['high'] }),
            t('mid'),
        ];
        const ranked = scheduleTasksGreedy(tasks);
        const order = ranked.map((x) => x._id);
        // high=92, blocked=72, mid=50, low=28
        expect(order).toEqual(['high', 'blocked', 'mid', 'low']);
        const byId = Object.fromEntries(ranked.map((x) => [x._id, x.priorityScore]));
        expect(byId.high - byId.blocked).toBe(20);
    });

    it('returns [] for empty input', () => {
        expect(scheduleTasksGreedy([])).toEqual([]);
    });

    it('serializes the DAG for the graph visualizer', () => {
        const g = buildTaskDAG([t('a'), t('b', { dependencies: ['a'] })]);
        expect(g.nodes).toHaveLength(2);
        expect(g.edges).toEqual([{ from: 'b', to: 'a' }]);
    });
});
