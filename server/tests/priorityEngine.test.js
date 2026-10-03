import { describe, it, expect } from 'vitest';
import { calculatePriorityScore, getPriorityTier, batchCalculatePriorities } from '../dsa-engine/priorityEngine.js';

const FAR = new Date(Date.now() + 60 * 86400000).toISOString(); // >1 month → deadlineScore 1
const PAST = new Date(Date.now() - 86400000).toISOString(); // overdue → deadlineScore 5

describe('priorityEngine', () => {
    it('scores a balanced far-deadline task at 50/medium', () => {
        const r = calculatePriorityScore({ urgency: 3, importance: 3, difficulty: 3, deadline: FAR });
        expect(r.score).toBe(50);
        expect(r.tier).toBe('medium');
    });

    it('boosts overdue tasks (70/high)', () => {
        const r = calculatePriorityScore({ urgency: 3, importance: 3, difficulty: 3, deadline: PAST });
        expect(r.score).toBe(70);
        expect(r.tier).toBe('high');
    });

    it('applies the -20 blocked penalty and itemizes the breakdown', () => {
        const open = calculatePriorityScore({ urgency: 3, importance: 3, difficulty: 3, deadline: PAST });
        const blocked = calculatePriorityScore(
            { urgency: 3, importance: 3, difficulty: 3, deadline: PAST },
            { hasBlockedDependencies: true }
        );
        expect(blocked.score).toBe(open.score - 20);
        expect(blocked.breakdown.blockedPenalty).toBe(-20);
        expect(open.breakdown.blockedPenalty).toBe(0);
    });

    it('clamps to [0, 100] and tiers correctly', () => {
        expect(getPriorityTier(80)).toBe('critical');
        expect(getPriorityTier(79)).toBe('high');
        expect(getPriorityTier(60)).toBe('high');
        expect(getPriorityTier(35)).toBe('medium');
        expect(getPriorityTier(34)).toBe('low');
    });

    it('batch-scores with dependency awareness', () => {
        const tasks = [
            { _id: 'a', urgency: 5, importance: 5, difficulty: 3, deadline: PAST, status: 'pending', dependencies: [] },
            { _id: 'b', urgency: 3, importance: 3, difficulty: 3, deadline: PAST, status: 'pending', dependencies: ['a'] },
        ];
        const out = batchCalculatePriorities(tasks, new Set());
        const b = out.find((t) => t._id === 'b');
        const open = calculatePriorityScore({ urgency: 3, importance: 3, difficulty: 3, deadline: PAST });
        expect(b.priorityScore).toBe(open.score - 20);
        // Completed dependency unblocks
        const unblocked = batchCalculatePriorities(tasks, new Set(['a']));
        expect(unblocked.find((t) => t._id === 'b').priorityScore).toBe(open.score);
    });
});
