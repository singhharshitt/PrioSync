import { describe, it, expect } from 'vitest';
import { decideNextMove } from '../planner/nextMove.js';

const D = (days) => new Date(Date.now() + days * 86400000).toISOString();

const task = (over) => ({
    id: 't1',
    title: 'Task',
    status: 'pending',
    estimatedMinutes: 60,
    deadline: null,
    dependencies: [],
    priorityScore: 50,
    priorityTier: 'medium',
    category: 'General',
    energyFit: 'normal',
    commitmentType: 'personal',
    ...over,
});

const expl = (over = {}) => ({
    score: 50,
    tier: 'medium',
    breakdown: { urgencyContrib: 15, importanceContrib: 15, deadlineContrib: 15, easeContrib: 10, blockedPenalty: 0 },
    blocked: false,
    unlocks: 0,
    ...over,
});

const cand = (t, e) => ({ task: t, explanation: e });

describe('best next move engine (spec 25-26)', () => {
    // Spec example: A has priority 91 / 120m / blocks 0; B has 84 / 35m / blocks 5.
    const scope = () => [
        task({ id: 'a', title: 'Deep work A', estimatedMinutes: 120, deadline: D(1), priorityScore: 91, priorityTier: 'high' }),
        task({ id: 'b', title: 'Ship B', estimatedMinutes: 35, deadline: D(1), priorityScore: 84 }),
        task({ id: 'c', title: 'Test C', estimatedMinutes: 60, deadline: D(3), dependencies: ['b'] }),
        task({ id: 'd', title: 'Docs D', estimatedMinutes: 60, deadline: D(3), dependencies: ['b'] }),
        task({ id: 'e', title: 'QA E', estimatedMinutes: 60, deadline: D(3), dependencies: ['b'] }),
    ];
    const candidates = () => [
        cand(
            task({ id: 'a', title: 'Deep work A', estimatedMinutes: 120, deadline: D(1), priorityScore: 91, priorityTier: 'high' }),
            expl({ score: 91, breakdown: { urgencyContrib: 24, importanceContrib: 25, deadlineContrib: 25, easeContrib: 10, blockedPenalty: 0 } })
        ),
        cand(
            task({ id: 'b', title: 'Ship B', estimatedMinutes: 35, deadline: D(1), priorityScore: 84 }),
            expl({ score: 84, unlocks: 5, breakdown: { urgencyContrib: 24, importanceContrib: 25, deadlineContrib: 25, easeContrib: 10, blockedPenalty: 0 } })
        ),
    ];

    it('picks the unblocking task over raw priority (spec example)', () => {
        const out = decideNextMove(scope(), candidates(), { now: new Date() });
        expect(out.bestNextMove.taskId).toBe('b');
        expect(out.bestNextMove.impactScore).toBeGreaterThan(out.alternates[0].impactScore);
        expect(out.alternates[0].taskId).toBe('a');
    });

    it('exposes impactScore, expectedBenefit, why and why-not', () => {
        const out = decideNextMove(scope(), candidates(), { now: new Date() });
        const m = out.bestNextMove;
        expect(m.impactScore).toBeGreaterThanOrEqual(0);
        expect(m.impactScore).toBeLessThanOrEqual(100);
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(m.impactLevel);
        expect(m.expectedBenefit).toMatch(/\d/);
        expect(m.why.length).toBeGreaterThan(0);
        expect(m.why.some((w) => w.sign === '+')).toBe(true);
        expect(out.alternates[0].whyNot.length).toBeGreaterThan(0);
        expect(Object.keys(m.factors)).toContain('dependencyUnlock');
    });

    it('returns null with a message when there are zero tasks', () => {
        const out = decideNextMove([], [], {});
        expect(out.bestNextMove).toBeNull();
        expect(out.alternates).toEqual([]);
        expect(out.message).toMatch(/Nothing fits|No open/i);
    });

    it('breaks equal-impact ties deterministically (stable id order)', () => {
        const t1 = task({ id: 'x1', estimatedMinutes: 60 });
        const t2 = task({ id: 'x2', estimatedMinutes: 60 });
        const c1 = [cand(t1, expl()), cand(t2, expl())];
        const c2 = [cand(t2, expl()), cand(t1, expl())];
        const out1 = decideNextMove([t1, t2], c1, {});
        const out2 = decideNextMove([t1, t2], c2, {});
        expect(out1.bestNextMove.taskId).toBe(out2.bestNextMove.taskId);
        expect(out1.bestNextMove.taskId).toBe('x1');
    });

    it('never recommends blocked tasks and counts them as excluded', () => {
        const a = task({ id: 'a', dependencies: ['missing'] });
        const out = decideNextMove([a], [cand(a, expl({ blocked: true }))], {});
        expect(out.bestNextMove).toBeNull();
        expect(out.excluded.blocked).toBe(1);
    });

    it('excludes tasks longer than the window and reports tooLong', () => {
        const a = task({ id: 'a', estimatedMinutes: 120 });
        const out = decideNextMove([a], [cand(a, expl())], { budgetMinutes: 60 });
        expect(out.bestNextMove).toBeNull();
        expect(out.excluded.tooLong).toBe(1);
    });

    it('handles tasks with no deadline (no NaN in scores)', () => {
        const a = task({ id: 'a', deadline: null });
        const out = decideNextMove([a], [cand(a, expl())], {});
        expect(Number.isFinite(out.bestNextMove.impactScore)).toBe(true);
    });

    it('adds an energy-match reason when energy matches', () => {
        const a = task({ id: 'a', energyFit: 'low' });
        const out = decideNextMove([a], [cand(a, expl())], { energy: 'low' });
        expect(out.bestNextMove.why.some((w) => /energy/.test(w.text))).toBe(true);
        expect(out.bestNextMove.energyBonus).toBe(6);
    });

    it('is deterministic: same input, same output', () => {
        const s = scope();
        const c = candidates();
        const out1 = decideNextMove(s, c, { now: new Date('2026-01-01T00:00:00Z') });
        const out2 = decideNextMove(s, c, { now: new Date('2026-01-01T00:00:00Z') });
        expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
    });

    it('does not mutate the input task array', () => {
        const s = scope();
        const snapshot = JSON.stringify(s);
        decideNextMove(s, candidates(), { budgetMinutes: 90 });
        expect(JSON.stringify(s)).toBe(snapshot);
    });
});
