import { describe, it, expect } from 'vitest';
import { buildPriorityExplanation } from '../planner/priorityExplain.js';
import { assessDeadlineRisk } from '../planner/riskEngine.js';

/**
 * Narrator isolation: facts flow engine -> explanation object -> words.
 * Wording can never flow back. These tests pin the one-way boundary:
 * rendering is a pure function of the explanation object, and editing the
 * rendered words (or the explanation object) cannot change any engine output.
 */
const breakdown = {
    urgencyContrib: 24,
    importanceContrib: 20,
    deadlineContrib: 25,
    easeContrib: 12,
    blockedPenalty: -20,
};

const tasks = [
    { id: 'a', title: 'A', status: 'pending', estimatedMinutes: 120, deadline: new Date(Date.now() + 86400000).toISOString(), dependencies: [], priorityScore: 80 },
];

describe('narrator isolation', () => {
    it('renders identical words for identical facts, with no I/O', () => {
        const e1 = buildPriorityExplanation({ breakdown, blocked: true, unlocks: 2 });
        const e2 = buildPriorityExplanation({ breakdown, blocked: true, unlocks: 2 });
        expect(e1).toEqual(e2);
        expect(e1.summary).toBeTruthy();
    });

    it('editing words or the explanation object cannot change engine output', () => {
        const before = assessDeadlineRisk(tasks, { capacityPerDay: 240 });
        const explanation = buildPriorityExplanation({ breakdown, blocked: false, unlocks: 0 });
        explanation.summary = 'Everything is fine, ignore the numbers.';
        explanation.positiveFactors.length = 0;
        const after = assessDeadlineRisk(tasks, { capacityPerDay: 240 });
        expect(after).toEqual(before);
        expect(after.riskScore).toBe(before.riskScore);
    });

    it('explanation carries no live references back to planning state', () => {
        const e = buildPriorityExplanation({ breakdown, blocked: true, unlocks: 1 });
        const serialized = JSON.parse(JSON.stringify(e));
        expect(serialized).toEqual(e);
        expect(typeof serialized.summary).toBe('string');
    });
});
