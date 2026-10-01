import { getPool } from '../db/pgClient.js';
import * as Tasks from '../repositories/pgTasks.js';
import * as Sessions from '../repositories/pgSessions.js';
import * as Svc from '../services/pgTaskService.js';
import { readThrough, bustUser } from '../cache/taskCache.js';
import { enqueueRecalc } from '../jobs/dispatch.js';

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

/** POST /api/v2/tasks/recalc — rescore drifted priorities without blocking reads. */
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
        const explanation = await Svc.explainPriority(req.user.id, req.params.id);
        if (!explanation) return res.status(404).json({ success: false, message: 'Task not found.' });
        res.json({ success: true, explanation });
    } catch (e) {
        next(e);
    }
};

const ENERGY_BONUS = { low: { low: 6, normal: 2, high: 0 }, normal: {}, high: { high: 2 } };

/**
 * GET /api/v2/tasks/next?minutes=30&energy=low
 * Deterministic available-time + energy recommendation over engine scores.
 * Blocked tasks are never recommended (listed as excluded for transparency).
 */
export const getNext = async (req, res, next) => {
    try {
        const budget = req.query.minutes !== undefined ? Number(req.query.minutes) : null;
        const energy = ['low', 'normal', 'high'].includes(req.query.energy) ? req.query.energy : 'normal';
        if (budget !== null && (!Number.isFinite(budget) || budget <= 0 || budget > 1440)) {
            return res.status(400).json({ success: false, message: 'minutes must be 1–1440.' });
        }
        const candidates = await Svc.getTopTasks(req.user.id, 20);
        const picked = [];
        let excludedBlocked = 0;
        let excludedTooLong = 0;
        for (const t of candidates) {
            const expl = await Svc.explainPriority(req.user.id, t.id);
            if (!expl || expl.blocked) {
                excludedBlocked++;
                continue;
            }
            if (budget !== null && (t.estimatedMinutes || 30) > budget) {
                excludedTooLong++;
                continue;
            }
            const energyBonus = ENERGY_BONUS[energy]?.[t.energyFit] ?? 0;
            const why = [];
            if (expl.breakdown.deadlineContrib >= 20) why.push('Deadline approaching');
            if (expl.breakdown.importanceContrib >= 20) why.push('High importance');
            if (expl.unlocks > 0) why.push(`Blocks ${expl.unlocks} task${expl.unlocks > 1 ? 's' : ''}`);
            if (budget !== null) why.push(`Fits your ${budget}-minute window`);
            if (energyBonus > 0) why.push(`Matches ${energy} energy`);
            if (t.priorityTier === 'critical') why.push('Critical priority');
            picked.push({ task: t, score: expl.score + energyBonus, energyBonus, why });
        }
        picked.sort((a, b) => b.score - a.score);
        const [first, ...rest] = picked.slice(0, 3);
        if (!first) {
            return res.json({
                success: true,
                recommendation: null,
                message: 'Nothing fits right now — clear a blocker or add a shorter task.',
                excluded: { blocked: excludedBlocked, tooLong: excludedTooLong },
            });
        }
        res.json({
            success: true,
            recommendation: first,
            alternates: rest,
            excluded: { blocked: excludedBlocked, tooLong: excludedTooLong },
        });
    } catch (e) {
        next(e);
    }
};

export const logFocusSession = async (req, res, next) => {
    try {
        const { taskId, startedAt, endedAt, durationSeconds } = req.body;
        if (new Date(endedAt) <= new Date(startedAt)) {
            return res.status(400).json({ success: false, message: 'endedAt must be after startedAt.' });
        }
        const session = await Sessions.log(req.user.id, { taskId, startedAt, endedAt, durationSeconds });
        if (!session) return res.status(404).json({ success: false, message: 'Task not found.' });
        await bustUser(req.user.id); // weekly focus minutes feed stats
        res.status(201).json({ success: true, session });
    } catch (e) {
        next(e);
    }
};
