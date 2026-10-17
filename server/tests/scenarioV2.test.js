import { describe, it, expect } from 'vitest';
import { simulateScenario, applyScenarioChanges } from '../planner/scenario.js';

const D = (days) => new Date(Date.now() + days * 86400000).toISOString();
const t = (over, id = 't1') => ({
    id,
    title: `Task ${id}`,
    status: 'pending',
    estimatedMinutes: 60,
    deadline: null,
    dependencies: [],
    priorityScore: 50,
    importance: 3,
    urgency: 3,
    difficulty: 3,
    projectId: null,
    ...over,
});

const NOW = new Date('2026-06-01T09:00:00Z');
const base = () => [
    t({ id: 'a', estimatedMinutes: 240, deadline: D(2), projectId: 'p1' }),
    t({ id: 'b', estimatedMinutes: 120, deadline: D(2), dependencies: ['a'], projectId: 'p1' }),
    t({ id: 'c', estimatedMinutes: 60, deadline: D(9), projectId: 'p2' }),
];

describe('advanced counterfactual scenarios (spec 29-30)', () => {
    it('delayTasks shifts a deadline relatively', () => {
        const tasks = applyScenarioChanges(base(), { delayTasks: [{ taskId: 'c', days: 3 }] });
        const c = tasks.find((x) => x.id === 'c');
        expect(new Date(c.deadline).getTime()).toBeGreaterThan(new Date(base()[2].deadline).getTime());
    });

    it('addTasks injects scored synthetic work and reports it separately', () => {
        const out = simulateScenario(
            base(),
            { addTasks: [{ title: 'New synthetic', estimatedMinutes: 45, deadline: D(3) }] },
            { capacityPerDay: 240, now: NOW }
        );
        expect(out.affected.addedCount).toBe(1);
        expect(out.affected.addedMinutes).toBe(45);
        expect(out.propagation.flow.some((f) => /task.*added/i.test(f))).toBe(true);
    });

    it('addDependencies blocks downstream work in the scenario', () => {
        const tasks = applyScenarioChanges(base(), {
            addDependencies: [{ taskId: 'b', dependsOn: 'c' }],
        });
        const b = tasks.find((x) => x.id === 'b');
        expect(b.dependencies).toContain('c');
        const out = simulateScenario(base(), { addDependencies: [{ taskId: 'b', dependsOn: 'c' }] }, { capacityPerDay: 240, now: NOW });
        expect(out.propagation.direct.some((d) => /depends on/.test(d.effect))).toBe(true);
    });

    it('removeDependencies drops an edge', () => {
        const tasks = applyScenarioChanges(base(), { removeDependencies: [{ taskId: 'b', dependsOn: 'a' }] });
        expect(tasks.find((x) => x.id === 'b').dependencies).not.toContain('a');
    });

    it('changeDurations replaces estimated minutes', () => {
        const tasks = applyScenarioChanges(base(), { changeDurations: [{ taskId: 'a', estimatedMinutes: 90 }] });
        expect(tasks.find((x) => x.id === 'a').estimatedMinutes).toBe(90);
    });

    it('changeImportance re-scores through the priority engine', () => {
        const tasks = applyScenarioChanges(base(), { changeImportance: [{ taskId: 'c', importance: 5 }] });
        const c = tasks.find((x) => x.id === 'c');
        expect(c.importance).toBe(5);
        expect(c.priorityScore).toBeGreaterThan(50); // default 3/3/3 baseline
    });

    it('changePriority sets the score directly', () => {
        const tasks = applyScenarioChanges(base(), { changePriority: [{ taskId: 'c', priorityScore: 12 }] });
        expect(tasks.find((x) => x.id === 'c').priorityScore).toBe(12);
    });

    it('moveProject shifts every deadline in one project only', () => {
        const b = base();
        const tasks = applyScenarioChanges(b, { moveProject: { projectId: 'p1', days: 4 } });
        expect(new Date(tasks.find((x) => x.id === 'a').deadline).getTime()).toBeGreaterThan(new Date(b[0].deadline).getTime());
        expect(tasks.find((x) => x.id === 'c').deadline).toBe(b[2].deadline);
    });

    it('loseEvening and loseMinutes reduce scenario capacity', () => {
        const evening = simulateScenario(base(), { loseEvening: true }, { capacityPerDay: 480, now: NOW });
        expect(evening.capacity.capacityMinutes).toBe(360 * 7);
        const lost = simulateScenario(base(), { loseMinutes: 700 }, { capacityPerDay: 480, now: NOW });
        expect(lost.capacity.capacityMinutes).toBe((480 - 100) * 7);
    });

    it('builds a causal propagation chain and flow (spec 30)', () => {
        const out = simulateScenario(
            base(),
            { delayTasks: [{ taskId: 'a', days: 2 }] },
            { capacityPerDay: 240, now: NOW }
        );
        expect(out.propagation.direct.some((d) => /delayed 2 days/.test(d.effect))).toBe(true);
        expect(out.propagation.downstreamCount).toBeGreaterThanOrEqual(1); // b hangs off a
        expect(out.propagation.layers[0].depth).toBe(0);
        expect(out.propagation.flow.at(-1)).toMatch(/Deadline risk \d+ -> \d+/);
        expect(out.propagation.riskChange.before).toBe(out.current.riskScore);
        expect(out.propagation.riskChange.after).toBe(out.scenario.riskScore);
    });

    it('tolerates circular dependency input without throwing', () => {
        const tasks = [
            t({ id: 'a', deadline: D(3) }),
            t({ id: 'b', deadline: D(3) }),
        ];
        const out = simulateScenario(
            tasks,
            { addDependencies: [{ taskId: 'a', dependsOn: 'b' }, { taskId: 'b', dependsOn: 'a' }] },
            { capacityPerDay: 240, now: NOW }
        );
        expect(out.scenario.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('handles timezone-boundary deadlines (offset ISO)', () => {
        const shifted = applyScenarioChanges([t({ id: 'a', deadline: '2026-06-03T23:30:00+05:30' })], {
            delayTasks: [{ taskId: 'a', days: 1 }],
        });
        expect(shifted[0].deadline).toBe('2026-06-04T18:00:00.000Z'); // 18:00Z + 1d
    });

    it('never mutates the input workload with new mutations', () => {
        const tasks = base();
        const snapshot = JSON.stringify(tasks);
        simulateScenario(tasks, {
            delayTasks: [{ taskId: 'a', days: 1 }],
            addTasks: [{ title: 'X', estimatedMinutes: 15 }],
            changeImportance: [{ taskId: 'c', importance: 5 }],
            loseEvening: true,
        }, { capacityPerDay: 240, now: NOW });
        expect(JSON.stringify(tasks)).toBe(snapshot);
    });
});
