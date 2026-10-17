import { getPool } from '../db/pgClient.js';
import * as Tasks from '../repositories/pgTasks.js';
import * as Sessions from '../repositories/pgSessions.js';
import * as Svc from '../services/pgTaskService.js';
import * as InsightSvc from '../services/insightService.js';
import { readThrough, bustUser } from '../cache/taskCache.js';
import { enqueueRecalc } from '../jobs/dispatch.js';
import { decideNextMove } from '../planner/nextMove.js';

const sendErr = (res, e) => {
    if (e && e.status === 400) return res.status(400).json({ success: false, message: e.message });
    throw e;
};

export const getTasks = async (req, res, next) => {
    try {
        const { status, sort = 'priority', page = 1, limit = 50 } = req.query;
        const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
        const offset = (Math.max(Number(page) || 1, 1) - 1) * lim;
        const [tasks, total] = await Promise.all([
            Tasks.listByUser(req.user.id, { status, sort, limit: lim, offset }),
            Tasks.countByUser(req.user.id, { status }),
        ]);
        res.json({ success: true, count: tasks.length, total, tasks: tasks.map(Svc.presentTask) });
    } catch (e) {
        next(e);
    }
};

export const getTask = async (req, res, next) => {
    try {
        const task = await Tasks.getById(req.user.id, req.params.id);
        if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });
        res.json({ success: true, task: Svc.presentTask(task) });
    } catch (e) {
        next(e);
    }
};

export const createTask = async (req, res, next) => {
    try {
        const task = await Svc.createTask(req.user.id, req.body);
        res.status(201).json({ success: true, task });
    } catch (e) {
        try {
            return sendErr(res, e);
        } catch (err) {
            next(err);
        }
    }
};

export const updateTask = async (req, res, next) => {
    try {
        const { version, ...fields } = req.body;
        const out = await Svc.updateTask(req.user.id, req.params.id, fields, {
            expectedVersion: version ?? null,
        });
        if (out.notFound) return res.status(404).json({ success: false, message: 'Task not found.' });
        if (out.conflict) {
            return res.status(409).json({
                success: false,
                message: 'Task changed elsewhere. Reload and retry.',
                task: out.row ?? out.current,
            });
        }
        res.json({ success: true, task: out.row });
    } catch (e) {
        try {
            return sendErr(res, e);
        } catch (err) {
            next(err);
        }
    }
};

export const deleteTask = async (req, res, next) => {
    try {
        const out = await Svc.deleteTask(req.user.id, req.params.id);
        if (out.notFound) return res.status(404).json({ success: false, message: 'Task not found.' });
        res.json({ success: true, message: 'Task deleted.' });
    } catch (e) {
        next(e);
    }
};

export const replaceDependencies = async (req, res, next) => {
    try {
        const out = await Svc.updateTask(req.user.id, req.params.id, {
            dependencies: req.body.dependencies,
        });
        if (out.notFound) return res.status(404).json({ success: false, message: 'Task not found.' });
        res.json({ success: true, task: out.row });
    } catch (e) {
        try {
            return sendErr(res, e);
        } catch (err) {
            next(err);
        }
    }
};

export const getTopTasks = async (req, res, next) => {
    try {
        const { data, cached } = await readThrough(req.user.id, 'top', () => Svc.getTopTasks(req.user.id, 5));
        res.set('X-Cache', cached ? 'HIT' : 'MISS');
        res.json({ success: true, tasks: data });
    } catch (e) {
        next(e);
    }
};

export const getStats = async (req, res, next) => {
    try {
        const { data: stats, cached } = await readThrough(req.user.id, 'stats', () => Svc.getStats(req.user.id));
        if (!cached) {
            await getPool().query(`UPDATE users SET productivity_score = $2 WHERE id = $1`, [
                req.user.id,
                stats.productivityScore,
            ]);
        }
        res.set('X-Cache', cached ? 'HIT' : 'MISS');
        res.json({ success: true, stats });
    } catch (e) {
        next(e);
    }
};

/** POST /api/v2/tasks/recalc - rescore drifted priorities without blocking reads. */
export const recalc = async (req, res, next) => {
    try {
        const out = await enqueueRecalc(req.user.id);
        res.json({ success: true, mode: out.queued ? 'queued' : 'inline', ...(out.result ? { result: out.result } : {}) });
    } catch (e) {
        next(e);
    }
};

export const getDAG = async (req, res, next) => {
    try {
        const graph = await Svc.getDAG(req.user.id);
        res.json({ success: true, graph });
    } catch (e) {
        next(e);
    }
};

export const getExplain = async (req, res, next) => {
    try {
        const explanation = await InsightSvc.explainTask(req.user.id, req.params.id);
        if (!explanation) return res.status(404).json({ success: false, message: 'Task not found.' });
        res.json({ success: true, explanation });
    } catch (e) {
        next(e);
    }
};

/**
 * GET /api/v2/tasks/next?minutes=30&energy=low
 * Best Next Move (spec 25-26): feasibility filter + multi-factor deterministic
 * impact over the full scope graph, with why-this / why-not explanations.
 * Legacy recommendation/alternates shape preserved; `decision` is additive.
 * Blocked tasks are never recommended (listed as excluded for transparency).
 */
export const getNext = async (req, res, next) => {
    try {
        const budget = req.query.minutes !== undefined ? Number(req.query.minutes) : null;
        const energy = ['low', 'normal', 'high'].includes(req.query.energy) ? req.query.energy : 'normal';
        if (budget !== null && (!Number.isFinite(budget) || budget <= 0 || budget > 1440)) {
            return res.status(400).json({ success: false, message: 'minutes must be 1-1440.' });
        }
        const [rows, candidates] = await Promise.all([
            Tasks.allForScoring(req.user.id),
            Svc.getTopTasks(req.user.id, 20),
        ]);
        const scope = rows.map(InsightSvc.normalizeTask);
        const withExplanations = [];
        for (const t of candidates) {
            const explanation = await Svc.explainPriority(req.user.id, t.id);
            withExplanations.push({ task: t, explanation });
        }
        const decision = decideNextMove(scope, withExplanations, { budgetMinutes: budget, energy });
        if (!decision.bestNextMove) {
            return res.json({
                success: true,
                recommendation: null,
                alternates: [],
                excluded: decision.excluded,
                decision,
                message: decision.message,
            });
        }
        const byId = new Map(candidates.map((t) => [String(t.id), t]));
        const winner = decision.bestNextMove;
        res.json({
            success: true,
            recommendation: {
                task: byId.get(winner.taskId),
                score: winner.priorityScore + winner.energyBonus,
                energyBonus: winner.energyBonus,
                why: winner.why.map((w) => w.text),
            },
            alternates: decision.alternates.map((a) => ({
                task: byId.get(a.taskId),
                score: a.priorityScore,
                why: a.whyNot,
            })),
            excluded: decision.excluded,
            decision,
        });
    } catch (e) {
        next(e);
    }
};

export const logFocusSession = async (req, res, next) => {
    try {
        const { taskId, startedAt, endedAt, durationSeconds, plannedSeconds, pausedSeconds, note, completed } = req.body;
        if (new Date(endedAt) <= new Date(startedAt)) {
            return res.status(400).json({ success: false, message: 'endedAt must be after startedAt.' });
        }
        const session = await Sessions.log(req.user.id, {
            taskId,
            startedAt,
            endedAt,
            durationSeconds,
            plannedSeconds,
            pausedSeconds,
            note,
            completed,
        });
        if (!session) return res.status(404).json({ success: false, message: 'Task not found.' });
        await bustUser(req.user.id); // weekly focus minutes feed stats
        res.status(201).json({ success: true, session });
    } catch (e) {
        next(e);
    }
};
