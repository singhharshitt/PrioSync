/**
 * Mongo session repository — mirrors pgSessions.js contract.
 * Persists v2 focus sessions as WorkSession documents (normalized, not
 * embedded) and emits a FOCUS_COMPLETED TaskEvent in the same async block.
 */
import mongoose from 'mongoose';
import WorkSession from '../models/WorkSession.js';
import TaskEvent from '../models/TaskEvent.js';
import Task from '../models/Task.js';

/** Newest-first list for deviation/drift analysis (capped at 2000). */
export const listByUser = async (userId, { limit = 500 } = {}) => {
    const lim = Math.min(Math.max(Number(limit) || 500, 1), 2000);
    const docs = await WorkSession.find({ user: userId })
        .sort({ endedAt: -1 })
        .limit(lim)
        .lean();
    return docs.map((d) => ({
        taskId: d.task?.toString() ?? null,
        durationSeconds: d.durationSeconds,
        endedAt: d.endedAt,
        plannedSeconds: d.plannedSeconds ?? null,
    }));
};

/**
 * Persist a focus session and record a FOCUS_COMPLETED event.
 * Returns null if `taskId` is provided but not owned by the user.
 */
export const log = async (
    userId,
    { taskId = null, startedAt, endedAt, durationSeconds, plannedSeconds = null, pausedSeconds = 0, note = '', completed = false }
) => {
    if (taskId) {
        if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
        const owns = await Task.exists({ _id: taskId, owner: userId });
        if (!owns) return null;
    }

    const session = await WorkSession.create({
        user: userId,
        task: taskId || null,
        startedAt,
        endedAt,
        durationSeconds: Math.round(durationSeconds),
        completed: !!completed,
        plannedSeconds: plannedSeconds != null ? Math.round(plannedSeconds) : null,
        pausedSeconds: Math.max(0, Math.round(pausedSeconds || 0)),
        note: String(note || '').slice(0, 1000),
    });

    // Best-effort event (never fails the response).
    TaskEvent.create({
        user: userId,
        task: taskId || null,
        eventType: 'FOCUS_COMPLETED',
        payload: {
            durationSeconds: Math.round(durationSeconds),
            plannedSeconds: plannedSeconds != null ? Math.round(plannedSeconds) : null,
            pausedSeconds: Math.max(0, Math.round(pausedSeconds || 0)),
        },
    }).catch(() => {});

    return {
        id: session._id.toString(),
        taskId: session.task?.toString() ?? null,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSeconds: session.durationSeconds,
        completed: session.completed,
        plannedSeconds: session.plannedSeconds,
        pausedSeconds: session.pausedSeconds,
        note: session.note,
    };
};
