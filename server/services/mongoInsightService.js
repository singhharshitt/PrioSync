/**
 * Mongo insight service — mirrors insightService.js but sources data from
 * Mongoose. The pure planner/* engines are storage-agnostic; only the
 * data-loading calls change.
 */
import * as Tasks from '../repositories/mongoTasks.js';
import * as Sessions from '../repositories/mongoSessions.js';
import * as Events from '../repositories/mongoEvents.js';
import User from '../models/User.js';
import Goal from '../models/Goal.js';
import Project from '../models/Project.js';
import { assessDeadlineRisk } from '../planner/riskEngine.js';
import { calculateCriticalPath, findBottlenecks, calculateBlockedWork } from '../planner/criticalPath.js';
import { analyzeCapacity } from '../planner/capacity.js';
import { simulateScenario } from '../planner/scenario.js';
import { detectDeviations } from '../planner/deviations.js';
import { detectDrift } from '../planner/drift.js';
import { scheduleWithContext } from '../planner/contextSwitch.js';
import { buildDayPlan } from '../planner/dayPlan.js';
import { analyzeScope } from '../planner/scope.js';
import { proposeReplan } from './mongoReplanService.js';
import { buildPriorityExplanation } from '../planner/priorityExplain.js';
import { explainPriority } from './mongoTaskService.js';
import { assessPlanResilience } from '../planner/resilience.js';
import { generateResolutionOptions } from '../planner/constraints.js';
import { buildRecoveryPlans } from '../planner/recovery.js';
import { buildTraceability, progressEfficiency } from '../planner/traceability.js';
import { computePlanDebt } from '../planner/planDebt.js';
import { buildUncertainty } from '../planner/uncertainty.js';
import { allocateCapacity } from '../planner/allocation.js';
import PlanVersion from '../models/PlanVersion.js';
import TaskEvent from '../models/TaskEvent.js';
import WorkSession from '../models/WorkSession.js';
import Task from '../models/Task.js';
import logger from '../utils/logger.js';

const DEFAULT_CAPACITY = 240;
const CALIBRATION_MIN = 3;

/** Normalize an allForScoring row to the camelCase shape engines consume. */
export const normalizeTask = (row) => ({
    id: (row._id || row.id).toString(),
    title: row.title,
    status: row.status,
    estimatedMinutes: row.estimatedMinutes ?? row.estimated_minutes ?? 30,
    deadline: row.deadline,
    dependencies: (row.dependencies || []).map((d) =>
        typeof d === 'object' && d !== null ? (d.id || d._id || d).toString() : d?.toString()
    ),
    priorityScore: row.priorityScore ?? row.priority_score ?? 0,
    priorityTier: row.priorityTier ?? row.priority_tier,
    importance: row.importance,
    urgency: row.urgency,
    difficulty: row.difficulty,
    category: row.category || 'General',
    energyFit: row.energyFit ?? row.energy_fit ?? 'normal',
    commitmentType: row.commitmentType ?? row.commitment_type ?? 'personal',
    stakeholder: row.stakeholder || '',
    createdAt: row.createdAt ?? row.created_at,
    goalId: (row.goalId ?? row.goal_id)?.toString() ?? null,
    projectId: (row.projectId ?? row.project_id)?.toString() ?? null,
    parentTaskId: (row.parentTaskId ?? row.parent_task_id)?.toString() ?? null,
});

const getCapacityPerDay = async (userId, override = null) => {
    if (override != null) return Math.max(0, Math.round(override));
    const u = await User.findById(userId).select('preferences').lean();
    return u?.preferences?.availableMinutesPerDay ?? DEFAULT_CAPACITY;
};

export const getCalibration = async (userId, { groupBy = null } = {}) => {
    const tasks = await Task.find({ owner: userId, status: 'completed', estimatedMinutes: { $gt: 0 } }).lean();
    const sessions = await WorkSession.find({ user: userId, task: { $ne: null } }).lean();
    const sessionsByTask = new Map();
    for (const s of sessions) {
        const tid = s.task.toString();
        if (!sessionsByTask.has(tid)) sessionsByTask.set(tid, 0);
        sessionsByTask.set(tid, sessionsByTask.get(tid) + s.durationSeconds);
    }
    const timed = tasks
        .map((t) => ({
            est: t.estimatedMinutes,
            secs: sessionsByTask.get(t._id.toString()) || 0,
            label: groupBy === 'project'
                ? (t.projectId?.toString() || 'No project')
                : (t.category || 'General'),
        }))
        .filter((x) => x.secs > 0);

    const factorOf = (rows) => {
        if (rows.length < CALIBRATION_MIN) return { factor: 1, samples: rows.length, calibrated: false };
        const est = rows.reduce((s, x) => s + Number(x.est), 0);
        const actual = rows.reduce((s, x) => s + x.secs / 60, 0);
        return {
            factor: Math.min(3, Math.max(0.5, Math.round((actual / Math.max(est, 1)) * 100) / 100)),
            samples: rows.length,
            calibrated: true,
        };
    };
    const out = { ...factorOf(timed), groups: {} };
    out.uncertainty = buildUncertainty(timed.map((x) => x.secs / 60 / Number(x.est)));
    if (groupBy === 'category' || groupBy === 'project') {
        const per = new Map();
        for (const row of timed) {
            const label = (row.label || 'General').trim() || 'General';
            if (!per.has(label)) per.set(label, []);
            per.get(label).push(row);
        }
        for (const [label, rows] of per) out.groups[label] = factorOf(rows);
    }
    return out;
};

const getScopeTasks = async (userId, { goalId = null, projectId = null } = {}) => {
    let rows = await Tasks.allForScoring(userId);
    if (goalId) rows = rows.filter((t) => (t.goalId || t.goal_id)?.toString() === goalId);
    if (projectId) rows = rows.filter((t) => (t.projectId || t.project_id)?.toString() === projectId);
    return rows.map(normalizeTask);
};

export const getRisk = async (userId, { goalId = null, projectId = null } = {}) => {
    const started = Date.now();
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const [capacityPerDay, calibration] = await Promise.all([getCapacityPerDay(userId), getCalibration(userId)]);
    const risk = assessDeadlineRisk(tasks, { capacityPerDay, calibrationFactor: calibration.factor, calibrationSamples: calibration.samples });
    logger.info({ userId, riskLevel: risk.riskLevel, riskScore: risk.riskScore, ms: Date.now() - started }, 'planner.risk.calculated');
    return { ...risk, capacityPerDay, scope: { goalId, projectId, taskCount: tasks.length } };
};

export const getCriticalPath = async (userId, { goalId = null, projectId = null } = {}) => {
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const calibration = await getCalibration(userId);
    return { ...calculateCriticalPath(tasks, { calibrationFactor: calibration.factor }), scope: { goalId, projectId } };
};

export const getBottlenecks = async (userId, { goalId = null, projectId = null, top = 5 } = {}) => {
    const started = Date.now();
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const calibration = await getCalibration(userId);
    const found = findBottlenecks(tasks, { top, calibrationFactor: calibration.factor });
    const blockedWork = calculateBlockedWork(tasks, { calibrationFactor: calibration.factor });
    if (found.primary) {
        logger.info({ userId, bottleneckTaskId: found.primary.taskId, ms: Date.now() - started }, 'planner.bottleneck.detected');
    }
    return { ...found, blockedWork, scope: { goalId, projectId } };
};

export const getCapacity = async (userId, { goalId = null, projectId = null, days = 7, perDay = null } = {}) => {
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const [capacityPerDay, calibration] = await Promise.all([getCapacityPerDay(userId, perDay), getCalibration(userId)]);
    return { ...analyzeCapacity(tasks, { capacityPerDay, days, calibrationFactor: calibration.factor }), calibration, scope: { goalId, projectId } };
};

export const explainTask = async (userId, taskId) => {
    const explanation = await explainPriority(userId, taskId);
    if (!explanation) return null;
    return { ...explanation, priorityExplanation: buildPriorityExplanation(explanation) };
};

export const simulate = async (userId, { goalId = null, projectId = null, changes = {} } = {}) => {
    const started = Date.now();
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const [capacityPerDay, calibration] = await Promise.all([getCapacityPerDay(userId), getCalibration(userId)]);
    const out = simulateScenario(tasks, changes, { capacityPerDay, calibrationFactor: calibration.factor, calibrationSamples: calibration.samples });
    logger.info({ userId, from: out.current.riskLevel, to: out.scenario.riskLevel, ms: Date.now() - started }, 'planner.scenario.simulated');
    return { ...out, scope: { goalId, projectId, taskCount: tasks.length } };
};

export const getDeviations = async (userId, { goalId = null, projectId = null } = {}) => {
    const [tasks, sessions] = await Promise.all([getScopeTasks(userId, { goalId, projectId }), Sessions.listByUser(userId)]);
    const deviations = detectDeviations(tasks, sessions);
    return { deviations, count: deviations.length, scope: { goalId, projectId } };
};

export const getDrift = async (userId) => {
    const [rows, sessions, events] = await Promise.all([
        Tasks.allForScoring(userId),
        Sessions.listByUser(userId),
        Events.listByUser(userId, { types: ['TASK_RESCHEDULED'] }),
    ]);
    const patterns = detectDrift({ tasks: rows.map(normalizeTask), sessions, events });
    return { patterns, count: patterns.length };
};

const triggerText = (d) => {
    if (d.type === 'TASK_OVERRUN') return `Task "${d.title}" exceeded its estimate by ${d.overPercent}% (${d.actualMinutes}m vs ${d.estimatedMinutes}m).`;
    if (d.type === 'MISSED_DEADLINE') return `Task "${d.title}" is ${d.daysOverdue} day${d.daysOverdue === 1 ? '' : 's'} overdue.`;
    return d.message;
};

export const autoReplan = async (userId, { goalId = null, projectId = null, taskIds = null, reason = '' } = {}) => {
    const started = Date.now();
    const [tasks, sessions, capacityPerDay, calibration] = await Promise.all([
        getScopeTasks(userId, { goalId, projectId }),
        Sessions.listByUser(userId),
        getCapacityPerDay(userId),
        getCalibration(userId),
    ]);
    const deviations = detectDeviations(tasks, sessions);
    const relevant = taskIds ? deviations.filter((d) => taskIds.includes(d.taskId)) : deviations;
    if (relevant.length === 0) return { planId: null, version: null, trigger: 'none', applied: false, message: 'No deviations detected - the plan stands.' };
    const top = relevant[0];
    const trigger = top.type;
    const text = reason || triggerText(top);
    const proposal = await proposeReplan(userId, taskIds ? { taskIds } : {});
    if (!proposal.moves || proposal.moves.length === 0) return { planId: null, version: null, trigger, applied: false, message: 'Deviations found, but nothing fits a recovery proposal yet.' };
    const riskBefore = assessDeadlineRisk(tasks, { capacityPerDay, calibrationFactor: calibration.factor, calibrationSamples: calibration.samples });
    const after = simulateScenario(tasks, { moveDeadlines: proposal.moves.map((m) => ({ taskId: m.taskId, deadline: m.newDeadline })) }, { capacityPerDay, calibrationFactor: calibration.factor, calibrationSamples: calibration.samples });
    const versionNum = (await PlanVersion.countDocuments({ user: userId })) + 1;
    const healthDetails = {
        state: 'proposed', trigger, version: versionNum,
        riskBefore: { level: riskBefore.riskLevel, score: riskBefore.riskScore },
        riskAfter: { level: after.scenario.riskLevel, score: after.scenario.riskScore },
        moves: proposal.moves, impact: proposal.impact,
    };
    const plan = await PlanVersion.create({ user: userId, healthDetails, reason: text });
    TaskEvent.create({ user: userId, task: null, eventType: 'PLAN_CREATED', payload: { planId: plan._id.toString(), version: versionNum, trigger, state: 'proposed', moves: proposal.moves.length, text } }).catch(() => {});
    logger.info({ userId, planId: plan._id, version: versionNum, trigger, ms: Date.now() - started }, 'planner.replan.proposed');
    return { planId: plan._id.toString(), version: versionNum, trigger, reason: text, riskBefore: healthDetails.riskBefore, riskAfter: healthDetails.riskAfter, moves: proposal.moves, impact: proposal.impact, applied: false };
};

export const getContextOrder = async (userId, { goalId = null, projectId = null, lambda = 1.5 } = {}) => {
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const { ordered, totalSwitchCost } = scheduleWithContext(tasks, { lambda });
    return {
        order: ordered.map((o, i) => ({ position: i + 1, taskId: String(o.task.id ?? o.task._id), title: o.task.title, priorityScore: o.task.priorityScore ?? 0, estimatedMinutes: o.task.estimatedMinutes ?? 30, category: o.task.category || 'General', switchCost: o.switchCost })),
        totalSwitchCost, lambda, scope: { goalId, projectId },
    };
};

export const getDayPlan = async (userId, { goalId = null, projectId = null, minutes = null, lambda = 1.5 } = {}) => {
    const u = await User.findById(userId).select('preferences').lean();
    const prefs = u?.preferences || {};
    const [tasks, calibration] = await Promise.all([getScopeTasks(userId, { goalId, projectId }), getCalibration(userId)]);
    const capacityPerDay = prefs.availableMinutesPerDay ?? DEFAULT_CAPACITY;
    const plan = buildDayPlan(tasks, { capacityPerDay, calibrationFactor: calibration.factor, preferences: prefs, lambda, minutes });
    logger.info({ userId, placed: plan.periods.reduce((s, p) => s + p.tasks.length, 0), unscheduled: plan.unscheduled.length }, 'planner.day_plan.built');
    return { ...plan, calibration, scope: { goalId, projectId } };
};

export const getScope = async (userId, { goalId = null } = {}) => {
    const [rows, events] = await Promise.all([
        Tasks.allForScoring(userId),
        Events.listByUser(userId, { types: ['TASK_DELETED', 'TASK_RESCHEDULED'] }),
    ]);
    const tasks = rows.map(normalizeTask);
    let since = null;
    let label = 'workload';
    if (goalId) {
        const g = await Goal.findOne({ _id: goalId, user: userId }).lean();
        if (!g) throw { status: 404, message: 'Goal not found.' };
        since = g.createdAt;
        label = g.title;
    }
    const inScope = goalId ? tasks.filter((t) => t.goalId === goalId) : tasks;
    return { ...analyzeScope(inScope, events, { since, scopeLabel: label }), goalId };
};

export const getCommitments = async (userId) => {
    const rows = await Tasks.allForScoring(userId);
    const now = Date.now();
    const open = rows.map(normalizeTask).filter((t) => (t.status === 'pending' || t.status === 'in-progress') && t.commitmentType && t.commitmentType !== 'personal');
    const completed = new Set(rows.filter((t) => t.status === 'completed').map((t) => t.id));
    const list = open.map((t) => {
        const due = t.deadline ? new Date(t.deadline).getTime() : NaN;
        const blocked = (t.dependencies || []).some((d) => !completed.has(String(d?.id ?? d?._id ?? d)));
        const flags = [];
        if (!Number.isNaN(due) && due < now) flags.push('overdue');
        else if (!Number.isNaN(due) && due - now < 2 * 86400000) flags.push('due_soon');
        if (blocked) flags.push('blocked');
        if (!t.deadline) flags.push('no_deadline');
        return { taskId: String(t.id), title: t.title, status: t.status, commitmentType: t.commitmentType, stakeholder: t.stakeholder || null, deadline: t.deadline || null, priorityScore: t.priorityScore ?? 0, riskFlags: flags, atRisk: flags.includes('overdue') || flags.includes('blocked') || flags.includes('due_soon') };
    });
    return { commitments: list, count: list.length, atRiskCount: list.filter((c) => c.atRisk).length };
};

export const getResilience = async (userId, { goalId = null, projectId = null, days = 7 } = {}) => {
    const started = Date.now();
    const [tasks, capacityPerDay, calibration] = await Promise.all([getScopeTasks(userId, { goalId, projectId }), getCapacityPerDay(userId), getCalibration(userId)]);
    const out = assessPlanResilience(tasks, { capacityPerDay, calibrationFactor: calibration.factor, calibrationSamples: calibration.samples, horizonDays: days });
    logger.info({ userId, level: out.resilience.level, ms: Date.now() - started }, 'planner.resilience.calculated');
    return { ...out, scope: { goalId, projectId } };
};

export const resolveConstraints = async (userId, { goalId = null, projectId = null, days = 7 } = {}) => {
    const started = Date.now();
    const [tasks, capacityPerDay, calibration] = await Promise.all([getScopeTasks(userId, { goalId, projectId }), getCapacityPerDay(userId), getCalibration(userId)]);
    const out = generateResolutionOptions(tasks, { capacityPerDay, days, calibrationFactor: calibration.factor });
    logger.info({ userId, infeasible: out.detection?.infeasible, ms: Date.now() - started }, 'planner.constraints.resolved');
    return { ...out, scope: { goalId, projectId, taskCount: tasks.length } };
};

export const getRecovery = async (userId, { goalId = null, projectId = null, lostMinutes = 0 } = {}) => {
    const started = Date.now();
    const [tasks, sessions, capacityPerDay, calibration] = await Promise.all([getScopeTasks(userId, { goalId, projectId }), Sessions.listByUser(userId), getCapacityPerDay(userId), getCalibration(userId)]);
    const deviations = detectDeviations(tasks, sessions);
    const out = buildRecoveryPlans(tasks, { capacityPerDay, calibrationFactor: calibration.factor, horizonDays: 7, lostMinutes, deviations });
    logger.info({ userId, triggers: out.triggers.length, plans: out.plans.length, ms: Date.now() - started }, 'planner.recovery.built');
    return { ...out, scope: { goalId, projectId, taskCount: tasks.length } };
};

export const getTraceability = async (userId) => {
    const [goals, projects, rows] = await Promise.all([
        Goal.find({ user: userId }).sort({ createdAt: 1 }).lean(),
        Project.find({ user: userId }).lean(),
        Tasks.allForScoring(userId),
    ]);
    const tasks = rows.map((r) => ({
        ...normalizeTask(r),
        parentTaskId: (r.parentTaskId || r.parent_task_id)?.toString() ?? null,
        completedAt: r.completedAt,
        updatedAt: r.updatedAt,
    }));
    const out = buildTraceability({
        goals: goals.map((g) => ({ id: g._id.toString(), title: g.title, createdAt: g.createdAt })),
        projects: projects.map((p) => ({ id: p._id.toString(), title: p.title, goalId: p.goal?.toString() ?? null })),
        tasks,
    });
    logger.info({ userId, orphans: out.summary.orphanWorkCount, starved: out.summary.starvedGoalCount }, 'planner.traceability.built');
    return out;
};

export const getEfficiency = async (userId, { goalId = null } = {}) => {
    const [goals, rows] = await Promise.all([
        Goal.find({ user: userId }).lean(),
        Tasks.allForScoring(userId),
    ]);
    let tasks = rows.map(normalizeTask);
    if (goalId) tasks = tasks.filter((t) => t.goalId === goalId);
    const goalsList = goalId
        ? goals.filter((g) => g._id.toString() === goalId).map((g) => ({ id: g._id.toString(), title: g.title }))
        : goals.map((g) => ({ id: g._id.toString(), title: g.title }));
    return { ...progressEfficiency({ goals: goalsList, tasks }), goalId };
};

export const getPlanDebt = async (userId) => {
    const [rows, sessions, events, calibration] = await Promise.all([
        Tasks.allForScoring(userId),
        Sessions.listByUser(userId),
        Events.listByUser(userId, { types: ['TASK_RESCHEDULED', 'DEADLINE_CHANGED', 'FOCUS_SKIPPED'] }),
        getCalibration(userId),
    ]);
    const tasks = rows.map(normalizeTask);
    const blockedWork = calculateBlockedWork(tasks, { calibrationFactor: calibration.factor });
    const out = computePlanDebt({ tasks, events, sessions, blockedWork });
    logger.info({ userId, items: out.items.length, recoveryMinutes: out.recoveryMinutes }, 'planner.plan_debt.computed');
    return out;
};

export const getUncertainty = async (userId) => getCalibration(userId);

export const getAllocation = async (userId, { days = 1, perDay = null } = {}) => {
    const [rows, capacityPerDay, calibration] = await Promise.all([Tasks.allForScoring(userId), getCapacityPerDay(userId, perDay), getCalibration(userId)]);
    const tasks = rows.map((r) => { const t = normalizeTask(r); return { ...t, estimatedMinutes: Math.round((t.estimatedMinutes || 30) * calibration.factor) }; });
    const out = allocateCapacity(tasks, { capacityPerDay, days });
    logger.info({ userId, scarce: out.scarce, totalDemand: out.totalDemand, totalAllocated: out.totalAllocated, days }, 'planner.allocation.computed');
    return { ...out, calibration: { factor: calibration.factor, samples: calibration.samples } };
};
