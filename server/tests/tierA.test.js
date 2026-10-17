import { describe, it, expect } from 'vitest';
import { buildTraceability, progressEfficiency } from '../planner/traceability.js';
import { computePlanDebt } from '../planner/planDebt.js';
import { buildUncertainty } from '../planner/uncertainty.js';
import { allocateCapacity } from '../planner/allocation.js';

const NOW = new Date('2026-06-01T00:00:00Z');
const days = (n) => new Date(NOW.getTime() + n * 86400000).toISOString();
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();

const task = (id, over = {}) => ({
    id,
    title: `Task ${id}`,
    status: 'pending',
    estimatedMinutes: 60,
    priorityScore: 50,
    priorityTier: 'medium',
    dependencies: [],
    deadline: null,
    goalId: null,
    projectId: null,
    parentTaskId: null,
    ...over,
});

describe('goal traceability (spec 35)', () => {
    const goals = [{ id: 'g1', title: 'Placement prep', createdAt: daysAgo(30) }];
    const projects = [{ id: 'p1', title: 'SQL track', goalId: 'g1' }];

    it('builds the goal -> project -> task -> subtask tree', () => {
        const tasks = [
            task('t1', { projectId: 'p1', goalId: 'g1' }),
            task('s1', { projectId: 'p1', goalId: 'g1', parentTaskId: 't1', title: 'Subtask one' }),
        ];
        const out = buildTraceability({ goals, projects, tasks }, { now: NOW });
        const g = out.tree[0];
        expect(g.goalId).toBe('g1');
        expect(g.projects[0].title).toBe('SQL track');
        expect(g.projects[0].tasks[0].subtasks).toHaveLength(1);
        expect(g.projects[0].tasks[0].subtasks[0].taskId).toBe('s1');
        expect(out.summary.orphanWorkCount).toBe(0);
    });

    it('detects orphan work, low-impact completed work, and blocked goal-critical tasks', () => {
        const tasks = [
            task('orphan', { title: 'Mystery task' }),
            task('low', { status: 'completed', priorityScore: 20, completedAt: daysAgo(2) }),
            task('crit', { goalId: 'g1', priorityTier: 'critical', dependencies: ['open-dep'] }),
            task('open-dep', { title: 'Still open dependency', projectId: 'p1', goalId: 'g1' }),
        ];
        const out = buildTraceability({ goals, projects, tasks }, { now: NOW });
        expect(out.detections.orphanWork.map((o) => o.taskId)).toEqual(['orphan']);
        expect(out.detections.lowImpactCompleted.map((o) => o.taskId)).toEqual(['low']);
        expect(out.detections.blockedGoalCritical.map((o) => o.taskId)).toEqual(['crit']);
    });

    it('flags starved goals (14+ days idle) with a factual reason', () => {
        const stale = [{ id: 'g2', title: 'Abandoned goal', createdAt: daysAgo(40) }];
        const tasks = [task('t9', { goalId: 'g2', createdAt: daysAgo(39) })];
        const out = buildTraceability({ goals: stale, projects: [], tasks }, { now: NOW });
        expect(out.detections.goalStarvation).toHaveLength(1);
        expect(out.detections.goalStarvation[0].reason).toContain('14+ days');
        expect(out.detections.goalStarvation[0].daysIdle).toBeGreaterThanOrEqual(14);
    });

    it('flags projects with no goal', () => {
        const out = buildTraceability({ goals: [], projects: [{ id: 'pX', title: 'Loose work', goalId: null }], tasks: [] }, { now: NOW });
        expect(out.detections.orphanProjects.map((p) => p.projectId)).toEqual(['pX']);
    });
});

describe('progress efficiency (spec 36)', () => {
    it('reports nothing to compare when no tasks are completed', () => {
        const out = progressEfficiency({ goals: [{ id: 'g1', title: 'G' }], tasks: [task('t1', { goalId: 'g1', priorityTier: 'critical' })] });
        expect(out.completedTasks).toBe(0);
        expect(out.observation).toContain('No completed tasks');
    });

    it('states the factual share of goal-critical work done', () => {
        const goals = [{ id: 'g1', title: 'G' }];
        const tasks = [
            task('c1', { goalId: 'g1', status: 'completed', priorityTier: 'critical', priorityScore: 80 }),
            task('x1', { status: 'completed', priorityScore: 40 }),
            task('x2', { status: 'completed', priorityScore: 45 }),
            task('x3', { status: 'completed', priorityScore: 55 }),
        ];
        const out = progressEfficiency({ goals, tasks });
        expect(out.goalCriticalCompleted).toBe(1);
        expect(out.completedTasks).toBe(4);
        expect(out.goalCriticalRatio).toBe(1); // all critical work completed (1/1)
        expect(out.observation).toContain('Most completed tasks were not goal-critical');
        expect(out.byGoal[0].criticalTotal).toBe(1);
    });
});

describe('plan debt (spec 37)', () => {
    it('collects postponed work, repeated moves, skips, compressed sessions, and blocked work', () => {
        const tasks = [
            task('a', { title: 'Moved twice', estimatedMinutes: 120, status: 'pending' }),
            task('b', { title: 'Skipped task' }),
            task('c', { title: 'Rushed task' }),
        ];
        const events = [
            { eventType: 'TASK_RESCHEDULED', taskId: 'a', createdAt: daysAgo(3) },
            { eventType: 'DEADLINE_CHANGED', taskId: 'a', createdAt: daysAgo(1) },
            { eventType: 'FOCUS_SKIPPED', taskId: 'b', createdAt: daysAgo(2) },
            { eventType: 'FOCUS_SKIPPED', taskId: 'b', createdAt: daysAgo(1) },
            { eventType: 'TASK_RESCHEDULED', taskId: 'a', createdAt: daysAgo(90) }, // outside window
        ];
        const sessions = [
            { taskId: 'c', durationSeconds: 400, endedAt: daysAgo(1) },
            { taskId: 'b', durationSeconds: 3600, endedAt: daysAgo(2) },
        ];
        const blockedWork = { blockedCount: 1, blockedMinutes: 90 };
        const out = computePlanDebt({ tasks, events, sessions, blockedWork, now: NOW });
        expect(out.counts.postponed).toBe(1);
        expect(out.counts.repeatedMoves).toBe(1);
        expect(out.counts.skippedTasks).toBe(1);
        expect(out.counts.compressedSessions).toBe(1);
        expect(out.counts.blocked).toBe(1);
        // 90 blocked + (120/2) moved-open + (2 skips * 25) = 90+60+50
        expect(out.recoveryMinutes).toBe(200);
        expect(out.recoveryText).toBe('3h 20m');
        expect(out.items.every((i) => i.why || i.detail)).toBe(true);
        expect(out.notice).toContain('not personal failing');
    });

    it('returns an empty, honest result when there is no debt', () => {
        const out = computePlanDebt({ tasks: [task('a')], events: [], sessions: [], blockedWork: null, now: NOW });
        expect(out.items).toHaveLength(0);
        expect(out.recoveryMinutes).toBe(0);
        expect(out.recoveryText).toBe('0m');
    });

    it('uses planned_seconds for compression when present (Focus 2.0)', () => {
        const sessions = [
            { taskId: 'c', durationSeconds: 1500, plannedSeconds: 3600, endedAt: daysAgo(1) },
            { taskId: 'd', durationSeconds: 2000, plannedSeconds: 3600, endedAt: daysAgo(1) },
        ];
        const out = computePlanDebt({ tasks: [task('c'), task('d')], events: [], sessions, blockedWork: null, now: NOW });
        expect(out.counts.compressedSessions).toBe(1);
    });
});

describe('uncertainty ranges (spec 38)', () => {
    it('stays uncalibrated below three samples', () => {
        const out = buildUncertainty([1.1, 1.2], { exampleMinutes: 120 });
        expect(out.confidence).toBe('uncalibrated');
        expect(out.exampleRange).toBeNull();
    });

    it('computes high confidence from a tight, sufficient distribution', () => {
        const ratios = [1.0, 1.05, 1.1, 1.12, 1.15, 1.18, 1.2, 1.02, 1.08, 1.14];
        const out = buildUncertainty(ratios, { exampleMinutes: 120 });
        expect(out.confidence).toBe('high');
        expect(out.sampleSize).toBe(10);
        expect(out.p25).toBeLessThanOrEqual(out.p50);
        expect(out.p50).toBeLessThanOrEqual(out.p75);
        expect(out.exampleRange.lowMinutes).toBeLessThanOrEqual(out.exampleRange.highMinutes);
        expect(out.message).toContain('120-minute');
    });

    it('falls to low confidence on a wide spread', () => {
        const ratios = [0.5, 0.6, 0.7, 1.5, 1.8, 2.0, 2.5];
        const out = buildUncertainty(ratios, { exampleMinutes: 60 });
        expect(out.confidence).toBe('low');
        expect(out.spread).toBeGreaterThan(0.6);
    });
});

describe('multi-project allocation (spec 39)', () => {
    it('covers full demand when capacity is sufficient', () => {
        const tasks = [
            task('a', { projectId: 'p1', estimatedMinutes: 120, deadline: days(1), priorityScore: 70 }),
            task('b', { projectId: 'p2', estimatedMinutes: 60, deadline: days(5), priorityScore: 40 }),
        ];
        const out = allocateCapacity(tasks, { capacityPerDay: 240, days: 2, now: NOW });
        expect(out.scarce).toBe(false);
        expect(out.placements).toHaveLength(2);
        expect(out.placements.find((p) => p.projectId === 'p1').allocatedMinutes).toBe(120); // nearer deadline fully covered
        expect(out.totalAllocated).toBeLessThanOrEqual(180); // never allocates beyond demand
        expect(out.totalAllocated + out.unallocatedMinutes).toBe(240);
        expect(out.rationale.length).toBeGreaterThan(0);
    });

    it('splits scarce capacity by due-minutes and risk, never exceeding capacity', () => {
        const tasks = [
            task('a', { projectId: 'p1', estimatedMinutes: 300, deadline: days(1), priorityScore: 80, title: 'Urgent project work' }),
            task('b', { projectId: 'p2', estimatedMinutes: 300, deadline: days(10), priorityScore: 30 }),
        ];
        const out = allocateCapacity(tasks, { capacityPerDay: 120, days: 2, now: NOW });
        expect(out.scarce).toBe(true);
        expect(out.totalAllocated).toBeLessThanOrEqual(120);
        const p1 = out.placements.find((p) => p.projectId === 'p1');
        const p2 = out.placements.find((p) => p.projectId === 'p2');
        expect(p1.allocatedMinutes).toBeGreaterThan(p2.allocatedMinutes);
        expect(out.winnerProjectId).toBe('p1');
        expect(out.rationale.join(' ')).toContain('below total demand');
    });

    it('reports honestly with no open tasks', () => {
        const out = allocateCapacity([], { capacityPerDay: 240, now: NOW });
        expect(out.placements).toHaveLength(0);
        expect(out.rationale[0]).toContain('No open tasks');
    });
});
