import { describe, it, expect } from 'vitest';
import { simulateScenario, applyScenarioChanges } from '../planner/scenario.js';

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
const D = (days) => new Date(Date.now() + days * 86400000).toISOString();

describe('what-if simulator', () => {
    const base = () => [
        t({ id: 'a', estimatedMinutes: 240, deadline: D(2) }),
        t({ id: 'b', estimatedMinutes: 120, deadline: D(2), dependencies: ['a'] }),
        t({ id: 'c', estimatedMinutes: 60, deadline: D(9) }),
    ];

    it('never mutates the input workload', () => {
        const tasks = base();
        const snapshot = JSON.stringify(tasks);
        simulateScenario(tasks, { removeTaskIds: ['c'], capacityPerDay: 30 });
        expect(JSON.stringify(tasks)).toBe(snapshot);
    });

    it('shows risk rising when a deadline moves forward', () => {
        const out = simulateScenario(base(), {
            moveDeadlines: [{ taskId: 'c', deadline: D(1) }],
        });
        expect(out.scenario.riskScore).toBeGreaterThanOrEqual(out.current.riskScore);
        expect(out.affected.taskIds).toContain('c');
    });

    it('shows relief when a heavy task is removed', () => {
        const loaded = base().map((x) => ({ ...x, deadline: D(1) }));
        const out = simulateScenario(loaded, { removeTaskIds: ['a'] }, { capacityPerDay: 120 });
        expect(out.scenario.riskScore).toBeLessThan(out.current.riskScore);
        expect(out.affected.taskIds).toEqual(expect.arrayContaining(['a', 'b']));
        expect(out.affected.minutes).toBe(120); // b still in plan and stranded
        expect(out.affected.freedMinutes).toBe(240); // a removed outright
    });

    it('models a low-capacity day and suggests mitigation when overloaded', () => {
        const out = simulateScenario(base(), { capacityPerDay: 30 }, { capacityPerDay: 480 });
        expect(out.scenario.riskScore).toBeGreaterThan(out.current.riskScore);
        expect(out.mitigation).toMatch(/Move|Extend|capacity|scope/i);
        expect(out.capacity.overloaded).toBe(true);
    });

    it('detects bottleneck shifts', () => {
        const out = simulateScenario(base(), { removeTaskIds: ['a'] });
        expect(out.bottleneckShift.from?.taskId).toBe('a');
        expect(out.bottleneckShift.to).toBeNull();
    });

    it('extends deadlines with addDays', () => {
        const tasks = applyScenarioChanges(base(), { addDays: 5 });
        const c = tasks.find((x) => x.id === 'c');
        expect(new Date(c.deadline).getTime()).toBeGreaterThan(new Date(base()[2].deadline).getTime());
    });
});
