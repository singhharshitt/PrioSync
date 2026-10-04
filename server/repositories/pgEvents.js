import { getPool } from '../db/pgClient.js';

/** Read-only event access for drift/deviation analysis. */
export const listByUser = async (userId, { types = null, limit = 500 } = {}, client) => {
    const q = client || getPool();
    const lim = Math.min(Math.max(Number(limit) || 500, 1), 2000);
    if (types && types.length > 0) {
        const r = await q.query(
            `SELECT event_type AS "eventType", task_id AS "taskId", created_at AS "createdAt"
             FROM task_events WHERE user_id = $1 AND event_type = ANY($2)
             ORDER BY created_at DESC LIMIT $3`,
            [userId, types, lim]
        );
        return r.rows;
    }
    const r = await q.query(
        `SELECT event_type AS "eventType", task_id AS "taskId", created_at AS "createdAt"
         FROM task_events WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [userId, lim]
    );
    return r.rows;
};
