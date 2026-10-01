/**
 * Auto-replan — proposes, never imposes.
 * Detect missed (overdue active) tasks → greedy day-packing proposal →
 * user accepts/edits → transactional deadline moves + decision-log events.
 * Every automatic suggestion is explainable; every applied change is audited.
 */
import { getPool } from '../db/pgClient.js';
import * as Tasks from '../repositories/pgTasks.js';
import { presentTask } from './pgTaskService.js';
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

export const dayCapacity = async (userId, client) => {
    const q = client || getPool();
    const r = await q.query(`SELECT available_minutes_per_day FROM user_preferences WHERE user_id = $1`, [userId]);
    return r.rows[0]?.available_minutes_per_day ?? 240;
};

/** Overdue active tasks, highest priority first. Read-only. */
export const detectMissed = async (userId) => {
    const rows = await Tasks.allForScoring(userId);
    const now = new Date();
    return rows
        .filter((t) => (t.status === 'pending' || t.status === 'in-progress') && t.deadline && new Date(t.deadline) < now)
        .sort((a, b) => b.priority_score - a.priority_score)
        .map(presentTask);
};

/**
 * Greedy proposal: pack missed tasks into upcoming days (from tomorrow)
 * without exceeding daily capacity. Returns moves + per-day impact. No writes.
 */
export const proposeReplan = async (userId, { taskIds = null, availableMinutesPerDay = null } = {}) => {
    const pool = getPool();
    const missed = await detectMissed(userId);
    const wanted = taskIds ? new Set(taskIds) : null;
    const tasks = missed.filter((t) => !wanted || wanted.has(t.id));
    const capacity = availableMinutesPerDay || (await dayCapacity(userId, pool)) || 240;

    const dayLoad = new Map(); // dayKey -> minutes already assigned
    const moves = [];
    let offset = 1;
    for (const t of tasks) {
        const need = t.estimatedMinutes || 30;
        // Find first day with room (cap search at 60 days to stay sane).
        let guard = 0;
        while ((dayLoad.get(dayKey(atHour(Date.now(), offset))) || 0) + need > capacity && guard < 60) {
            offset++;
            guard++;
        }
        const slot = atHour(Date.now(), offset);
        const key = dayKey(slot);
        dayLoad.set(key, (dayLoad.get(key) || 0) + need);
        moves.push({
            taskId: t.id,
            title: t.title,
            oldDeadline: t.deadline,
            newDeadline: slot.toISOString(),
            estimatedMinutes: need,
            day: key,
            reason: `Missed ${new Date(t.deadline).toLocaleDateString()} — suggested next slot with room`,
        });
    }
    const impact = [...dayLoad.entries()].map(([day, addedMinutes]) => ({ day, addedMinutes }));
    return { moves, impact, capacity, assumedCapacity: !availableMinutesPerDay };
};

/** Apply user-approved moves transactionally + audit each one. */
export const acceptReplan = async (userId, { moves, reason = '' }) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const applied = [];
        for (const m of moves) {
            const before = await Tasks.getById(userId, m.taskId, client);
            if (!before || (before.status !== 'pending' && before.status !== 'in-progress')) continue;
            const r = await client.query(
                `UPDATE tasks SET deadline = $3, updated_at = now()
                 WHERE id = $1 AND user_id = $2 AND status IN ('pending','in-progress')
                 RETURNING id`,
                [m.taskId, userId, m.newDeadline]
            );
            if (r.rowCount === 0) continue;
            await client.query(
                `INSERT INTO task_events (user_id, task_id, event_type, payload)
                 VALUES ($1,$2,'TASK_RESCHEDULED',$3)`,
                [userId, m.taskId, JSON.stringify({ from: before.deadline, to: m.newDeadline, reason })]
            );
            applied.push({ taskId: m.taskId, from: before.deadline, to: m.newDeadline });
        }
        const plan = await client.query(
            `INSERT INTO plan_versions (user_id, health_details, reason)
             VALUES ($1,$2,$3) RETURNING id`,
            [userId, JSON.stringify({ moves: applied.length }), reason || 'replan accepted']
        );
        await client.query(
            `INSERT INTO task_events (user_id, task_id, event_type, payload)
             VALUES ($1,NULL,'PLAN_UPDATED',$2)`,
            [userId, JSON.stringify({ planId: plan.rows[0].id, moves: applied.length, reason })]
        );
        await client.query('COMMIT');
        await bustUser(userId);
        // Deadline moves shift pressure for siblings → rescore async, never blocks the response.
        const recalc = await enqueueRecalc(userId);
        return { planId: plan.rows[0].id, applied, recalc: recalc.queued ? 'queued' : 'inline' };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

const LOG_TYPES = ['TASK_RESCHEDULED', 'PLAN_CREATED', 'PLAN_UPDATED', 'PLAN_OVERRIDDEN', 'RECOMMENDATION_ACCEPTED', 'RECOMMENDATION_OVERRIDDEN'];

/** Decision log: what changed, why, old→new, impact, when. */
export const decisionLog = async (userId, limit = 20) => {
    const pool = getPool();
    const r = await pool.query(
        `SELECT e.event_type AS "eventType", e.task_id AS "taskId", t.title AS "taskTitle",
                e.payload, e.created_at AS "at"
         FROM task_events e LEFT JOIN tasks t ON t.id = e.task_id
         WHERE e.user_id = $1 AND e.event_type = ANY($2)
         ORDER BY e.created_at DESC LIMIT $3`,
        [userId, LOG_TYPES, Math.min(Math.max(Number(limit) || 20, 1), 100)]
    );
    return r.rows;
};

/**
 * Recommendation feedback — the personalization substrate. Stores what was
 * suggested vs what the user actually chose and why. No ML yet; first we
 * collect high-quality (recommendation → decision → outcome) triples.
 */
export const recordOverride = async (userId, { recommendedTaskId, chosenTaskId = null, reason, note = '' }) => {
    const pool = getPool();
    const check = async (id) => {
        if (!id) return true;
        const r = await pool.query(`SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2`, [id, userId]);
        return r.rowCount > 0;
    };
    if (!(await check(recommendedTaskId)) || !(await check(chosenTaskId))) {
        throw { status: 400, message: 'Recommendation tasks must be your own tasks.' };
    }
    await pool.query(
        `INSERT INTO task_events (user_id, task_id, event_type, payload)
         VALUES ($1,$2,'RECOMMENDATION_OVERRIDDEN',$3)`,
        [userId, chosenTaskId, JSON.stringify({ recommendedTaskId, chosenTaskId, reason, note })]
    );
    return { recorded: true };
};

export const recordAccept = async (userId, { recommendedTaskId }) => {
    const pool = getPool();
    const r = await pool.query(`SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2`, [recommendedTaskId, userId]);
    if (r.rowCount === 0) throw { status: 400, message: 'Recommended task must be your own task.' };
    await pool.query(
        `INSERT INTO task_events (user_id, task_id, event_type, payload)
         VALUES ($1,$2,'RECOMMENDATION_ACCEPTED',$3)`,
        [userId, recommendedTaskId, JSON.stringify({ recommendedTaskId })]
    );
    return { recorded: true };
};

/** Adherence = accepted / (accepted + overridden). Honest descriptive stat, not "AI accuracy". */
export const adherence = async (userId) => {
    const pool = getPool();
    const r = await pool.query(
        `SELECT event_type, COUNT(*)::int n FROM task_events
         WHERE user_id = $1 AND event_type IN ('RECOMMENDATION_ACCEPTED','RECOMMENDATION_OVERRIDDEN')
         GROUP BY event_type`,
        [userId]
    );
    const m = Object.fromEntries(r.rows.map((x) => [x.event_type, x.n]));
    const accepted = m.RECOMMENDATION_ACCEPTED || 0;
    const overridden = m.RECOMMENDATION_OVERRIDDEN || 0;
    const total = accepted + overridden;
    return { accepted, overridden, total, adherenceRate: total > 0 ? Math.round((accepted / total) * 100) : null };
};
