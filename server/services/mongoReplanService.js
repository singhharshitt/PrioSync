/**
 * Mongo replan service — mirrors replanService.js.
 * Proposes, never imposes. Applying moves stays an explicit user action.
 */
import * as Tasks from '../repositories/mongoTasks.js';
import User from '../models/User.js';
import PlanVersion from '../models/PlanVersion.js';
import TaskEvent from '../models/TaskEvent.js';
import { bustUser } from '../cache/taskCache.js';
import { enqueueRecalc } from '../jobs/dispatch.js';

const atHour = (base, dayOffset, hour = 18) => {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d;
};
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const dayCapacity = async (userId) => {
    const u = await User.findById(userId).select('preferences').lean();
    return u?.preferences?.availableMinutesPerDay ?? 240;
};

export const detectMissed = async (userId) => {
    const rows = await Tasks.allForScoring(userId);
    const now = new Date();
    return rows
        .filter((t) => (t.status === 'pending' || t.status === 'in-progress') && t.deadline && new Date(t.deadline) < now)
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .map((t) => ({ ...t, id: t.id, estimatedMinutes: t.estimatedMinutes || t.estimated_minutes || 30 }));
};

export const proposeReplan = async (userId, { taskIds = null, availableMinutesPerDay = null } = {}) => {
    const missed = await detectMissed(userId);
    const wanted = taskIds ? new Set(taskIds) : null;
    const tasks = missed.filter((t) => !wanted || wanted.has(t.id));
    const capacity = availableMinutesPerDay || (await dayCapacity(userId)) || 240;
    const dayLoad = new Map();
    const moves = [];
    let offset = 1;
    for (const t of tasks) {
        const need = t.estimatedMinutes || 30;
        let guard = 0;
        while ((dayLoad.get(dayKey(atHour(Date.now(), offset))) || 0) + need > capacity && guard < 60) {
            offset++;
            guard++;
        }
        const slot = atHour(Date.now(), offset);
        const k = dayKey(slot);
        dayLoad.set(k, (dayLoad.get(k) || 0) + need);
        moves.push({
            taskId: t.id,
            title: t.title,
            oldDeadline: t.deadline,
            newDeadline: slot.toISOString(),
            estimatedMinutes: need,
            day: k,
            reason: `Missed ${new Date(t.deadline).toLocaleDateString()} - suggested next slot with room`,
        });
    }
    const impact = [...dayLoad.entries()].map(([day, addedMinutes]) => ({ day, addedMinutes }));
    return { moves, impact, capacity, assumedCapacity: !availableMinutesPerDay };
};

export const acceptReplan = async (userId, { moves, reason = '' }) => {
    const applied = [];
    for (const m of moves) {
        const before = await Tasks.getById(userId, m.taskId);
        if (!before || (before.status !== 'pending' && before.status !== 'in-progress')) continue;
        const r = await Tasks.update(userId, m.taskId, { deadline: new Date(m.newDeadline) });
        if (r.notFound || r.conflict) continue;
        applied.push({ taskId: m.taskId, from: before.deadline, to: m.newDeadline });
        TaskEvent.create({
            user: userId,
            task: m.taskId,
            eventType: 'TASK_RESCHEDULED',
            payload: { from: before.deadline, to: m.newDeadline, reason },
        }).catch(() => {});
    }
    const plan = await PlanVersion.create({
        user: userId,
        healthDetails: { moves: applied.length },
        reason: reason || 'replan accepted',
    });
    TaskEvent.create({
        user: userId,
        task: null,
        eventType: 'PLAN_UPDATED',
        payload: { planId: plan._id.toString(), moves: applied.length, reason },
    }).catch(() => {});
    await bustUser(userId);
    const recalc = await enqueueRecalc(userId);
    return { planId: plan._id.toString(), applied, recalc: recalc.queued ? 'queued' : 'inline' };
};

const LOG_TYPES = ['TASK_RESCHEDULED', 'PLAN_CREATED', 'PLAN_UPDATED', 'PLAN_OVERRIDDEN', 'RECOMMENDATION_ACCEPTED', 'RECOMMENDATION_OVERRIDDEN'];

export const decisionLog = async (userId, limit = 20) => {
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const docs = await TaskEvent.find({ user: userId, eventType: { $in: LOG_TYPES } })
        .populate({ path: 'task', select: 'title' })
        .sort({ createdAt: -1 })
        .limit(lim)
        .lean();
    return docs.map((d) => ({
        eventType: d.eventType,
        taskId: d.task?._id?.toString() ?? null,
        taskTitle: d.task?.title ?? null,
        payload: d.payload,
        at: d.createdAt,
    }));
};

export const recordOverride = async (userId, { recommendedTaskId, chosenTaskId = null, reason, note = '' }) => {
    const check = async (id) => {
        if (!id) return true;
        return !!(await Tasks.getById(userId, id));
    };
    if (!(await check(recommendedTaskId)) || !(await check(chosenTaskId))) {
        throw { status: 400, message: 'Recommendation tasks must be your own tasks.' };
    }
    await TaskEvent.create({ user: userId, task: chosenTaskId || null, eventType: 'RECOMMENDATION_OVERRIDDEN', payload: { recommendedTaskId, chosenTaskId, reason, note } });
    return { recorded: true };
};

export const recordAccept = async (userId, { recommendedTaskId }) => {
    const t = await Tasks.getById(userId, recommendedTaskId);
    if (!t) throw { status: 400, message: 'Recommended task must be your own task.' };
    await TaskEvent.create({ user: userId, task: recommendedTaskId, eventType: 'RECOMMENDATION_ACCEPTED', payload: { recommendedTaskId } });
    return { recorded: true };
};

export const adherence = async (userId) => {
    const docs = await TaskEvent.aggregate([
        { $match: { user: userId, eventType: { $in: ['RECOMMENDATION_ACCEPTED', 'RECOMMENDATION_OVERRIDDEN'] } } },
        { $group: { _id: '$eventType', n: { $sum: 1 } } },
    ]);
    const m = Object.fromEntries(docs.map((x) => [x._id, x.n]));
    const accepted = m.RECOMMENDATION_ACCEPTED || 0;
    const overridden = m.RECOMMENDATION_OVERRIDDEN || 0;
    const total = accepted + overridden;
    return { accepted, overridden, total, adherenceRate: total > 0 ? Math.round((accepted / total) * 100) : null };
};
