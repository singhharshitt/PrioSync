import { getPool } from '../db/pgClient.js';

/** Sessions for deviation/drift analysis (newest first, capped). */
export const listByUser = async (userId, { limit = 500 } = {}, client) => {
    const q = client || getPool();
    const lim = Math.min(Math.max(Number(limit) || 500, 1), 2000);
    const r = await q.query(
        `SELECT task_id AS "taskId", duration_seconds AS "durationSeconds", ended_at AS "endedAt",
                planned_seconds AS "plannedSeconds"
         FROM work_sessions WHERE user_id = $1
         ORDER BY ended_at DESC LIMIT $2`,
        [userId, lim]
    );
    return r.rows;
};

/** Persist a focus/work session + history event atomically. */
export const log = async (
    userId,
    { taskId = null, startedAt, endedAt, durationSeconds, plannedSeconds = null, pausedSeconds = 0, note = '', completed = false },
    client
) => {
    const q = client || getPool();
    if (taskId) {
        const own = await q.query(`SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2`, [taskId, userId]);
        if (own.rowCount === 0) return null;
    }
    const r = await q.query(
        `INSERT INTO work_sessions (user_id, task_id, started_at, ended_at, duration_seconds, completed,
                                    planned_seconds, paused_seconds, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, task_id AS "taskId", started_at AS "startedAt", ended_at AS "endedAt",
                   duration_seconds AS "durationSeconds", completed,
                   planned_seconds AS "plannedSeconds", paused_seconds AS "pausedSeconds", note`,
        [
            userId,
            taskId,
            startedAt,
            endedAt,
            Math.round(durationSeconds),
            !!completed,
            plannedSeconds == null ? null : Math.round(plannedSeconds),
            Math.max(0, Math.round(pausedSeconds || 0)),
            String(note || '').slice(0, 1000),
        ]
    );
    await q.query(
        `INSERT INTO task_events (user_id, task_id, event_type, payload)
         VALUES ($1,$2,'FOCUS_COMPLETED',$3)`,
        [
            userId,
            taskId,
            JSON.stringify({
                durationSeconds: Math.round(durationSeconds),
                plannedSeconds: plannedSeconds == null ? null : Math.round(plannedSeconds),
                pausedSeconds: Math.max(0, Math.round(pausedSeconds || 0)),
            }),
        ]
    );
    return r.rows[0];
};
