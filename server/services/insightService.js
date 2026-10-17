/**
 * Insight service - orchestration over repositories + pure planning engines.
 * Read-only: every function computes from current state, never writes.
 * (What-if simulation in Phase 3 will reuse these engines on synthetic inputs.)
 */
import { getPool } from '../db/pgClient.js';
import * as Tasks from '../repositories/pgTasks.js';
import * as Sessions from '../repositories/pgSessions.js';
import * as Events from '../repositories/pgEvents.js';
import { assessDeadlineRisk } from '../planner/riskEngine.js';
import {
    calculateCriticalPath,
    findBottlenecks,
    calculateBlockedWork,
} from '../planner/criticalPath.js';
import { analyzeCapacity } from '../planner/capacity.js';
import { simulateScenario } from '../planner/scenario.js';
import { detectDeviations } from '../planner/deviations.js';
import { detectDrift } from '../planner/drift.js';
import { scheduleWithContext } from '../planner/contextSwitch.js';
import { buildDayPlan } from '../planner/dayPlan.js';
import { analyzeScope } from '../planner/scope.js';
import { proposeReplan } from './replanService.js';
import { buildPriorityExplanation } from '../planner/priorityExplain.js';
import { explainPriority } from './pgTaskService.js';
import { assessPlanResilience } from '../planner/resilience.js';
import { generateResolutionOptions } from '../planner/constraints.js';
import { buildRecoveryPlans } from '../planner/recovery.js';
import { buildTraceability, progressEfficiency } from '../planner/traceability.js';
import { computePlanDebt } from '../planner/planDebt.js';
import { buildUncertainty } from '../planner/uncertainty.js';
import { allocateCapacity } from '../planner/allocation.js';
import logger from '../utils/logger.js';

const DEFAULT_CAPACITY_PER_DAY = 240;
const CALIBRATION_MIN_SAMPLES = 3;

/** Normalize a snake_case PG row to the camelCase shape the engines consume. */
export const normalizeTask = (row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    estimatedMinutes: row.estimated_minutes ?? 30,
    deadline: row.deadline,
    dependencies: (row.dependencies || []).map((d) => (typeof d === 'object' && d !== null ? d.id || d._id : d)),
    priorityScore: row.priority_score ?? 0,
    priorityTier: row.priority_tier,
    importance: row.importance,
    urgency: row.urgency,
    difficulty: row.difficulty,
    category: row.category || 'General',
    energyFit: row.energy_fit || 'normal',
    commitmentType: row.commitment_type || 'personal',
    stakeholder: row.stakeholder || '',
    createdAt: row.created_at,
    goalId: row.goal_id,
    projectId: row.project_id,
});

const getCapacityPerDay = async (userId, override = null) => {
    if (override != null) return Math.max(0, Math.round(override));
    const pool = getPool();
    const r = await pool.query(`SELECT available_minutes_per_day FROM user_preferences WHERE user_id = $1`, [userId]);
    return r.rows[0]?.available_minutes_per_day ?? DEFAULT_CAPACITY_PER_DAY;
};

/**
 * Personal estimation calibration (read-only, Phase-2 substrate).
 * Compares estimated vs timed focus work on completed tasks:
 *   factor = actualMinutes / estimatedMinutes, clamped to [0.5, 3].
 * Fewer than 3 timed tasks -> { factor: 1, calibrated: false } (no guessing).
 * groupBy 'category' | 'project' adds per-dimension factors the same way -
 * the spec's "do NOT blindly use a global multiplier" without new tables.
 */
export const getCalibration = async (userId, { groupBy = null } = {}) => {
    const pool = getPool();
    const byProject = groupBy === 'project';
    const r = await pool.query(
        `SELECT t.estimated_minutes AS est, COALESCE(SUM(ws.duration_seconds), 0)::int AS secs,
                ${byProject ? 'p.title AS label' : "COALESCE(NULLIF(TRIM(t.category), ''), 'General') AS label"}
         FROM tasks t LEFT JOIN work_sessions ws ON ws.task_id = t.id AND ws.user_id = $1
         ${byProject ? 'LEFT JOIN projects p ON p.id = t.project_id' : ''}
         WHERE t.user_id = $1 AND t.status = 'completed' AND t.estimated_minutes > 0
         GROUP BY t.id${byProject ? ', p.title' : ', t.category'}`,
        [userId]
    );
    const timed = r.rows.filter((x) => x.secs > 0);
    const factorOf = (rows) => {
        if (rows.length < CALIBRATION_MIN_SAMPLES) return { factor: 1, samples: rows.length, calibrated: false };
        const est = rows.reduce((s, x) => s + Number(x.est), 0);
        const actual = rows.reduce((s, x) => s + x.secs / 60, 0);
        return {
            factor: Math.min(3, Math.max(0.5, Math.round((actual / Math.max(est, 1)) * 100) / 100)),
            samples: rows.length,
            calibrated: true,
        };
    };
    const out = { ...factorOf(timed), groups: {} };
    // Spec section 38: ratio distribution (p25/p75 + confidence), additive.
    out.uncertainty = buildUncertainty(timed.map((x) => x.secs / 60 / Number(x.est)));
    if (groupBy === 'category' || byProject) {
        const per = new Map();
        for (const row of timed) {
            const label = (row.label || (byProject ? 'No project' : 'General')).trim() || 'General';
            if (!per.has(label)) per.set(label, []);
            per.get(label).push(row);
        }
        for (const [label, rows] of per) out.groups[label] = factorOf(rows);
    }
    return out;
};

const getScopeTasks = async (userId, { goalId = null, projectId = null } = {}) => {
    let rows = await Tasks.allForScoring(userId);
    if (goalId) rows = rows.filter((t) => t.goal_id === goalId);
    if (projectId) rows = rows.filter((t) => t.project_id === projectId);
    return rows.map(normalizeTask);
};

export const getRisk = async (userId, { goalId = null, projectId = null } = {}) => {
    const started = Date.now();
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const [capacityPerDay, calibration] = await Promise.all([
        getCapacityPerDay(userId),
        getCalibration(userId),
    ]);
    const risk = assessDeadlineRisk(tasks, {
        capacityPerDay,
        calibrationFactor: calibration.factor,
        calibrationSamples: calibration.samples,
    });
    logger.info(
        { userId, riskLevel: risk.riskLevel, riskScore: risk.riskScore, ms: Date.now() - started, goalId, projectId },
        'planner.risk.calculated'
    );
    return { ...risk, capacityPerDay, scope: { goalId, projectId, taskCount: tasks.length } };
};

export const getCriticalPath = async (userId, { goalId = null, projectId = null } = {}) => {
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const calibration = await getCalibration(userId);
    const cp = calculateCriticalPath(tasks, { calibrationFactor: calibration.factor });
    logger.info(
        { userId, taskCount: cp.taskCount, totalMinutes: cp.totalMinutes, goalId, projectId },
        'planner.critical_path.calculated'
    );
    return { ...cp, scope: { goalId, projectId } };
};

export const getBottlenecks = async (userId, { goalId = null, projectId = null, top = 5 } = {}) => {
    const started = Date.now();
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const calibration = await getCalibration(userId);
    const found = findBottlenecks(tasks, { top, calibrationFactor: calibration.factor });
    const blockedWork = calculateBlockedWork(tasks, { calibrationFactor: calibration.factor });
    if (found.primary) {
        logger.info(
            {
                userId,
                bottleneckTaskId: found.primary.taskId,
                downstreamCount: found.primary.downstreamCount,
                ms: Date.now() - started,
            },
            'planner.bottleneck.detected'
        );
    }
    return { ...found, blockedWork, scope: { goalId, projectId } };
};

export const getCapacity = async (userId, { goalId = null, projectId = null, days = 7, perDay = null } = {}) => {
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const [capacityPerDay, calibration] = await Promise.all([
        getCapacityPerDay(userId, perDay),
        getCalibration(userId),
    ]);
    const analysis = analyzeCapacity(tasks, {
        capacityPerDay,
        days,
        calibrationFactor: calibration.factor,
    });
    if (analysis.overloaded) {
        logger.info(
            { userId, overloadMinutes: analysis.overloadMinutes, days, goalId, projectId },
            'planner.capacity.overloaded'
        );
    }
    return { ...analysis, calibration, scope: { goalId, projectId } };
};

/** Existing explain output + the reusable explanation object (additive field). */
export const explainTask = async (userId, taskId) => {
    const explanation = await explainPriority(userId, taskId);
    if (!explanation) return null;
    return {
        ...explanation,
        priorityExplanation: buildPriorityExplanation(explanation),
    };
};

/**
 * Read-only what-if simulation. Scope tasks are loaded, cloned, modified
 * in memory, and recomputed - production rows are never touched.
 */
export const simulate = async (userId, { goalId = null, projectId = null, changes = {} } = {}) => {
    const started = Date.now();
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    // Baseline uses real capacity; a capacityPerDay override lives inside
    // `changes` and applies to the scenario side only (see scenario.js).
    const [capacityPerDay, calibration] = await Promise.all([
        getCapacityPerDay(userId),
        getCalibration(userId),
    ]);
    const out = simulateScenario(tasks, changes, {
        capacityPerDay,
        calibrationFactor: calibration.factor,
        calibrationSamples: calibration.samples,
    });
    logger.info(
        {
            userId,
            from: out.current.riskLevel,
            to: out.scenario.riskLevel,
            affected: out.affected.count,
            ms: Date.now() - started,
        },
        'planner.scenario.simulated'
    );
    return { ...out, scope: { goalId, projectId, taskCount: tasks.length } };
};

export const getDeviations = async (userId, { goalId = null, projectId = null } = {}) => {    const [tasks, sessions] = await Promise.all([
        getScopeTasks(userId, { goalId, projectId }),
        Sessions.listByUser(userId),
    ]);
    const deviations = detectDeviations(tasks, sessions);
    return { deviations, count: deviations.length, scope: { goalId, projectId } };
};

export const getDrift = async (userId) => {
    const pool = getPool();
    const [rows, sessions, events] = await Promise.all([
        Tasks.allForScoring(userId),
        Sessions.listByUser(userId),
        Events.listByUser(userId, { types: ['TASK_RESCHEDULED'] }),
    ]);
    const patterns = detectDrift({ tasks: rows.map(normalizeTask), sessions, events });
    return { patterns, count: patterns.length };
};

const triggerText = (d) => {
    if (d.type === 'TASK_OVERRUN') {
        return `Task "${d.title}" exceeded its estimate by ${d.overPercent}% (${d.actualMinutes}m vs ${d.estimatedMinutes}m).`;
    }
    if (d.type === 'MISSED_DEADLINE') {
        return `Task "${d.title}" is ${d.daysOverdue} day${d.daysOverdue === 1 ? '' : 's'} overdue.`;
    }
    return d.message;
};

/**
 * Automatic replan PROPOSAL (never a silent mutation).
 * Detects the top deviation, builds day-packed moves with the existing
 * proposer, prices risk before/after, and persists a PROPOSED plan version
 * with trigger + reasons. Applying stays on the existing /replans/accept
 * path, which records its own APPLIED version - full audit trail, no schema
 * changes (state lives in health_details).
 */
export const autoReplan = async (userId, { goalId = null, projectId = null, taskIds = null, reason = '' } = {}) => {
    const started = Date.now();
    const pool = getPool();
    const [tasks, sessions, capacityPerDay, calibration] = await Promise.all([
        getScopeTasks(userId, { goalId, projectId }),
        Sessions.listByUser(userId),
        getCapacityPerDay(userId),
        getCalibration(userId),
    ]);
    const deviations = detectDeviations(tasks, sessions);
    const relevant = taskIds
        ? deviations.filter((d) => taskIds.includes(d.taskId))
        : deviations;
    if (relevant.length === 0) {
        return { planId: null, version: null, trigger: 'none', applied: false, message: 'No deviations detected - the plan stands.' };
    }
    const top = relevant[0];
    const trigger = top.type;
    const text = reason || triggerText(top);

    const proposal = await proposeReplan(userId, taskIds ? { taskIds } : {});
    if (!proposal.moves || proposal.moves.length === 0) {
        return { planId: null, version: null, trigger, applied: false, message: 'Deviations found, but nothing fits a recovery proposal yet.' };
    }
    const riskBefore = assessDeadlineRisk(tasks, {
        capacityPerDay,
        calibrationFactor: calibration.factor,
        calibrationSamples: calibration.samples,
    });
    const after = simulateScenario(
        tasks,
        { moveDeadlines: proposal.moves.map((m) => ({ taskId: m.taskId, deadline: m.newDeadline })) },
        { capacityPerDay, calibrationFactor: calibration.factor, calibrationSamples: calibration.samples }
    );

    const count = await pool.query(`SELECT COUNT(*)::int n FROM plan_versions WHERE user_id = $1`, [userId]);
    const version = count.rows[0].n + 1;
    const healthDetails = {
        state: 'proposed',
        trigger,
        version,
        riskBefore: { level: riskBefore.riskLevel, score: riskBefore.riskScore },
        riskAfter: { level: after.scenario.riskLevel, score: after.scenario.riskScore },
        moves: proposal.moves,
        impact: proposal.impact,
    };
    const plan = await pool.query(
        `INSERT INTO plan_versions (user_id, health_details, reason) VALUES ($1,$2,$3) RETURNING id`,
        [userId, JSON.stringify(healthDetails), text]
    );
    await pool.query(
        `INSERT INTO task_events (user_id, task_id, event_type, payload) VALUES ($1,NULL,'PLAN_CREATED',$2)`,
        [userId, JSON.stringify({ planId: plan.rows[0].id, version, trigger, state: 'proposed', moves: proposal.moves.length, text })]
    );
    logger.info(
        {
            userId,
            planId: plan.rows[0].id,
            version,
            trigger,
            riskBefore: riskBefore.riskLevel,
            riskAfter: after.scenario.riskLevel,
            ms: Date.now() - started,
        },
        'planner.replan.proposed'
    );
    return {
        planId: plan.rows[0].id,
        version,
        trigger,
        reason: text,
        riskBefore: healthDetails.riskBefore,
        riskAfter: healthDetails.riskAfter,
        moves: proposal.moves,
        impact: proposal.impact,
        applied: false,
    };
};

export const getContextOrder = async (userId, { goalId = null, projectId = null, lambda = 1.5 } = {}) => {
    const tasks = await getScopeTasks(userId, { goalId, projectId });
    const { ordered, totalSwitchCost } = scheduleWithContext(tasks, { lambda });
    return {
        order: ordered.map((o, i) => ({
            position: i + 1,
            taskId: String(o.task.id ?? o.task._id),
            title: o.task.title,
            priorityScore: o.task.priorityScore ?? 0,
            estimatedMinutes: o.task.estimatedMinutes ?? 30,
            category: o.task.category || 'General',
            switchCost: o.switchCost,
        })),
        totalSwitchCost,
        lambda,
        scope: { goalId, projectId },
    };
};

export const getDayPlan = async (userId, { goalId = null, projectId = null, minutes = null, lambda = 1.5 } = {}) => {
    const pool = getPool();
    const [tasks, calibration, prefs] = await Promise.all([
        getScopeTasks(userId, { goalId, projectId }),
        getCalibration(userId),
        pool.query(`SELECT * FROM user_preferences WHERE user_id = $1`, [userId]).then((r) => r.rows[0] || {}),
    ]);
    const capacityPerDay = prefs.available_minutes_per_day ?? 240;
    const plan = buildDayPlan(tasks, {
        capacityPerDay,
        calibrationFactor: calibration.factor,
        preferences: prefs,
        lambda,
        minutes,
    });
    logger.info(
        { userId, placed: plan.periods.reduce((s, p) => s + p.tasks.length, 0), unscheduled: plan.unscheduled.length },
        'planner.day_plan.built'
    );
    return { ...plan, calibration, scope: { goalId, projectId } };
};

export const getScope = async (userId, { goalId = null } = {}) => {
    const pool = getPool();
    const [rows, events] = await Promise.all([
        Tasks.allForScoring(userId),
        Events.listByUser(userId, { types: ['TASK_DELETED', 'TASK_RESCHEDULED'] }),
    ]);
    const tasks = rows.map(normalizeTask);
    let since = null;
    let label = 'workload';
    if (goalId) {
        const g = await pool.query(`SELECT id, title, created_at FROM goals WHERE id = $1 AND user_id = $2`, [goalId, userId]);
        if (!g.rows[0]) throw { status: 404, message: 'Goal not found.' };
        since = g.rows[0].created_at;
        label = g.rows[0].title;
    }
    const inScope = goalId ? tasks.filter((t) => t.goalId === goalId) : tasks;
    return { ...analyzeScope(inScope, events, { since, scopeLabel: label }), goalId };
};

export const getCommitments = async (userId) => {
    const rows = await Tasks.allForScoring(userId);
    const now = Date.now();
    const open = rows
        .map(normalizeTask)
        .filter((t) => (t.status === 'pending' || t.status === 'in-progress') && t.commitmentType && t.commitmentType !== 'personal');
    const completed = new Set(rows.filter((t) => t.status === 'completed').map((t) => String(t.id)));
    const list = open.map((t) => {
        const due = t.deadline ? new Date(t.deadline).getTime() : NaN;
        const blocked = (t.dependencies || []).some((d) => !completed.has(String(d?.id ?? d?._id ?? d)));
        const flags = [];
        if (!Number.isNaN(due) && due < now) flags.push('overdue');
        else if (!Number.isNaN(due) && due - now < 2 * 86400000) flags.push('due_soon');
        if (blocked) flags.push('blocked');
        if (!t.deadline) flags.push('no_deadline');
        return {
            taskId: String(t.id),
            title: t.title,
            status: t.status,
            commitmentType: t.commitmentType,
            stakeholder: t.stakeholder || null,
            deadline: t.deadline || null,
            priorityScore: t.priorityScore ?? 0,
            riskFlags: flags,
            atRisk: flags.includes('overdue') || flags.includes('blocked') || flags.includes('due_soon'),
        };
    });
    const atRisk = list.filter((c) => c.atRisk).length;
    return { commitments: list, count: list.length, atRiskCount: atRisk };
};

/** Plan resilience / fragility with sensitivity ladder (spec sections 27-28). */
export const getResilience = async (userId, { goalId = null, projectId = null, days = 7 } = {}) => {
    const started = Date.now();
    const [tasks, capacityPerDay, calibration] = await Promise.all([
        getScopeTasks(userId, { goalId, projectId }),
        getCapacityPerDay(userId),
        getCalibration(userId),
    ]);
    const out = assessPlanResilience(tasks, {
        capacityPerDay,
        calibrationFactor: calibration.factor,
        calibrationSamples: calibration.samples,
        horizonDays: days,
    });
    logger.info(
        { userId, level: out.resilience.level, failurePoints: out.failurePoints, ms: Date.now() - started },
        'planner.resilience.calculated'
    );
    return { ...out, scope: { goalId, projectId } };
};

/** Impossible-plan detection + deterministic OPTION A-D (spec sections 31-32). */
export const resolveConstraints = async (userId, { goalId = null, projectId = null, days = 7 } = {}) => {
    const started = Date.now();
    const [tasks, capacityPerDay, calibration] = await Promise.all([
        getScopeTasks(userId, { goalId, projectId }),
        getCapacityPerDay(userId),
        getCalibration(userId),
    ]);
    const out = generateResolutionOptions(tasks, { capacityPerDay, days, calibrationFactor: calibration.factor });
    logger.info(
        { userId, infeasible: out.detection?.infeasible, options: out.options.length, ms: Date.now() - started },
        'planner.constraints.resolved'
    );
    return { ...out, scope: { goalId, projectId, taskCount: tasks.length } };
};

/** Recovery plans priced and compared, never applied (spec sections 33-34). */
export const getRecovery = async (userId, { goalId = null, projectId = null, lostMinutes = 0 } = {}) => {
    const started = Date.now();
    const [tasks, sessions, capacityPerDay, calibration] = await Promise.all([
        getScopeTasks(userId, { goalId, projectId }),
        Sessions.listByUser(userId),
        getCapacityPerDay(userId),
        getCalibration(userId),
    ]);
    const deviations = detectDeviations(tasks, sessions);
    const out = buildRecoveryPlans(tasks, {
        capacityPerDay,
        calibrationFactor: calibration.factor,
        horizonDays: 7,
        lostMinutes,
        deviations,
    });
    logger.info(
        { userId, triggers: out.triggers.length, plans: out.plans.length, ms: Date.now() - started },
        'planner.recovery.built'
    );
    return { ...out, scope: { goalId, projectId, taskCount: tasks.length } };
};

/** Goal -> Project -> Task -> Subtask traceability + gap detections (spec section 35). */
export const getTraceability = async (userId) => {
    const pool = getPool();
    const [goalsR, projectsR, rows] = await Promise.all([
        pool.query(`SELECT id, title, created_at FROM goals WHERE user_id = $1 ORDER BY created_at`, [userId]),
        pool.query(`SELECT id, title, goal_id FROM projects WHERE user_id = $1`, [userId]),
        Tasks.allForScoring(userId),
    ]);
    const tasks = rows.map((r) => ({
        ...normalizeTask(r),
        parentTaskId: r.parent_task_id,
        completedAt: r.completed_at,
        updatedAt: r.updated_at,
    }));
    const out = buildTraceability({
        goals: goalsR.rows.map((g) => ({ id: g.id, title: g.title, createdAt: g.created_at })),
        projects: projectsR.rows.map((p) => ({ id: p.id, title: p.title, goalId: p.goal_id })),
        tasks,
    });
    logger.info(
        { userId, orphans: out.summary.orphanWorkCount, starved: out.summary.starvedGoalCount, blockedCritical: out.summary.blockedCriticalCount },
        'planner.traceability.built'
    );
    return out;
};

/** Completed volume vs goal-critical contribution, factual language (spec section 36). */
export const getEfficiency = async (userId, { goalId = null } = {}) => {
    const pool = getPool();
    const [goalsR, rows] = await Promise.all([
        pool.query(`SELECT id, title FROM goals WHERE user_id = $1`, [userId]),
        Tasks.allForScoring(userId),
    ]);
    let tasks = rows.map(normalizeTask);
    if (goalId) tasks = tasks.filter((t) => t.goalId === goalId);
    const goals = goalId
        ? goalsR.rows.filter((g) => g.id === goalId).map((g) => ({ id: g.id, title: g.title }))
        : goalsR.rows.map((g) => ({ id: g.id, title: g.title }));
    return { ...progressEfficiency({ goals, tasks }), goalId };
};

/** Postponed work, skips, compressed sessions, unresolved deps (spec section 37). */
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

/** Calibrated uncertainty narrative (spec section 38, additive on calibration). */
export const getUncertainty = async (userId) => getCalibration(userId);

/** Multi-project capacity allocation advice, never applied (spec section 39). */
export const getAllocation = async (userId, { days = 1, perDay = null } = {}) => {
    const [rows, capacityPerDay, calibration] = await Promise.all([
        Tasks.allForScoring(userId),
        getCapacityPerDay(userId, perDay),
        getCalibration(userId),
    ]);
    // Calibrate estimates for allocation only - production rows untouched.
    const tasks = rows.map((r) => {
        const t = normalizeTask(r);
        return { ...t, estimatedMinutes: Math.round((t.estimatedMinutes || 30) * calibration.factor) };
    });
    const out = allocateCapacity(tasks, { capacityPerDay, days });
    logger.info(
        { userId, scarce: out.scarce, totalDemand: out.totalDemand, totalAllocated: out.totalAllocated, days },
        'planner.allocation.computed'
    );
    return { ...out, calibration: { factor: calibration.factor, samples: calibration.samples } };
};
