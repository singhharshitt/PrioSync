/**
 * Mongo event repository — mirrors pgEvents.js contract.
 * Read-only access to the TaskEvent collection for drift/deviation analysis.
 */
import TaskEvent from '../models/TaskEvent.js';

export const listByUser = async (userId, { types = null, limit = 500 } = {}) => {
    const lim = Math.min(Math.max(Number(limit) || 500, 1), 2000);
    const filter = { user: userId };
    if (types && types.length > 0) filter.eventType = { $in: types };
    const docs = await TaskEvent.find(filter)
        .sort({ createdAt: -1 })
        .limit(lim)
        .lean();
    return docs.map((d) => ({
        eventType: d.eventType,
        taskId: d.task?.toString() ?? null,
        createdAt: d.createdAt,
    }));
};
