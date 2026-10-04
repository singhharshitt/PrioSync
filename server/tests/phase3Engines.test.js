import { describe, it, expect } from 'vitest';
import { switchCost, scheduleWithContext } from '../planner/contextSwitch.js';
import { buildDayPlan, dayPeriods } from '../planner/dayPlan.js';
import { analyzeScope } from '../planner/scope.js';

const t = (over, id = 't1') => ({
    id,
    title: `Task ${id}`,
    status: 'pending',
    estimatedMinutes: 60,
    deadline: null,
    dependencies: [],
    priorityScore: 50,
    category: 'Work',
    projectId: null,
    energyFit: 'normal',
    ...over,
});

describe('context switching', () => {
    it('prices category, project, and energy distance', () => {
        expect(switchCost(null, t({}))).toBe(0);
        expect(switchCost(t({}), t({}))).toBe(0);
        expect(switchCost(t({ category: 'A' }), t({ category: 'B' }))).toBe(2);
        expect(
            switchCost(
                t({ category: 'A', projectId: 'p1', energyFit: 'low' }),
                t({ category: 'B', projectId: 'p2', energyFit: 'high' })
            )
        ).toBe(7);
        // Null projects never penalize (untagged work groups freely).
        expect(switchCost(t({ projectId: null }), t({ projectId: 'p1' }))).toBe(0);
    });

    it('never schedules before prerequisites, groups cheap runs otherwise', () => {
        const tasks = [
            t({ id: 'a', priorityScore: 90, category: 'X' }),
            t({ id: 'b', priorityScore: 50, category: 'X', dependencies: ['a'] }),
            t({ id: 'c', priorityScore: 80, category: 'Y' }),
        ];
        const { ordered, totalSwitchCost } = scheduleWithContext(tasks, { lambda: 0 });
        expect(ordered.map((o) => o.task.id)).toEqual(['a', 'c', 'b']);
        expect(ordered[0].switchCost).toBe(0);
        const grouped = scheduleWithContext(
            [
                t({ id: 'j1', priorityScore: 70, category: 'Java' }),
                t({ id: 's1', priorityScore: 69, category: 'SQL' }),
                t({ id: 'j2', priorityScore: 68, category: 'Java' }),
            ],
            { lambda: 5 }
        );
        expect(grouped.ordered.map((o) => o.task.id)).toEqual(['j1', 'j2', 's1']);
        expect(grouped.totalSwitchCost).toBe(2);
        expect(totalSwitchCost).toBeGreaterThanOrEqual(0);
    });

    it('drains safely on cyclic input', () => {
        const { ordered } = scheduleWithContext([
            t({ id: 'a', dependencies: ['b'] }),
            t({ id: 'b', dependencies: ['a'] }),
        ]);
        expect(ordered).toHaveLength(2);
    });
});

describe('day periods and plan', () => {
    it('splits the work window into thirds with defaults', () => {
        const ps = dayPeriods({});
        expect(ps.map((p) => p.key)).toEqual(['morning', 'afternoon', 'evening']);
        expect(ps[0]).toMatchObject({ from: '09:00', to: '12:00', energy: 'high', minutes: 180 });
        const custom = dayPeriods({
            workStart: '08:00',
            workEnd: '20:00',
            energy: { morning: 'low', afternoon: 'high', evening: 'normal' },
        });
        expect(custom[1]).toMatchObject({ from: '12:00', to: '16:00', energy: 'high' });
    });

    it('matches energy levels and respects the budget', () => {
        const tasks = [
            t({ id: 'deep', priorityScore: 95, estimatedMinutes: 120, energyFit: 'high' }),
            t({ id: 'admin', priorityScore: 40, estimatedMinutes: 60, energyFit: 'low' }),
        ];
        const plan = buildDayPlan(tasks, { capacityPerDay: 180 });
        const morning = plan.periods.find((p) => p.key === 'morning');
        const evening = plan.periods.find((p) => p.key === 'evening');
        expect(morning.tasks.map((x) => x.taskId)).toContain('deep');
        expect(morning.tasks[0].energyMatch).toBe(true);
        expect(evening.tasks.map((x) => x.taskId)).toContain('admin');
        expect(plan.totalMinutes).toBe(180);
        expect(plan.unscheduled).toEqual([]);
    });

    it('lists overflow as unscheduled instead of overfilling', () => {
        const tasks = [t({ id: 'a', estimatedMinutes: 300 }), t({ id: 'b', estimatedMinutes: 300 })];
        const plan = buildDayPlan(tasks, { capacityPerDay: 240 });
        expect(plan.totalMinutes).toBeLessThanOrEqual(240);
        expect(plan.unscheduled.length).toBeGreaterThanOrEqual(1);
    });
});

describe('scope creep', () => {
    const T = (id, createdAt) => ({ id, title: id, status: 'pending', createdAt });
    it('compares original vs current scope with growth math', () => {
        const tasks = [T('a', '2026-01-01T00:00:00Z'), T('b', '2026-01-01T00:00:00Z'), T('c', '2026-02-01T00:00:00Z')];
        const events = [{ eventType: 'TASK_RESCHEDULED', taskId: 'a', createdAt: '2026-03-01T00:00:00Z' }];
        const s = analyzeScope(tasks, events, { since: '2026-01-15T00:00:00Z', scopeLabel: 'goal' });
        expect(s).toMatchObject({ originalTasks: 2, currentTasks: 3, addedTasks: 1, removedTasks: 0, deadlineMoves: 1, growthPct: 50 });
        expect(s.message).toMatch(/\+50%/);
    });

    it('is calm on empty and steady scope', () => {
        expect(analyzeScope([], [], {}).message).toMatch(/No work in scope/);
        const steady = analyzeScope([T('a', '2026-01-01T00:00:00Z')], [], { since: '2026-06-01T00:00:00Z' });
        expect(steady.message).toMatch(/steady/);
    });

    it('counts removed tasks from the event trail', () => {
        const s = analyzeScope([T('a', '2026-01-01T00:00:00Z')], [
            { eventType: 'TASK_DELETED', taskId: 'gone', createdAt: '2026-02-01T00:00:00Z' },
        ]);
        expect(s.removedTasks).toBe(1);
    });
});
