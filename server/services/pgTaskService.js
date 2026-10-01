/**
 * PG task service — deterministic orchestration over repositories + DSA engine.
 * The LLM/planner (future) may SUGGEST tasks; this module DECIDES scores/order.
 * Every mutation writes a task_events row in the same transaction.
 */
import { getPool } from '../db/pgClient.js';
import * as Tasks from '../repositories/pgTasks.js';
import DAG from '../dsa-engine/dag.js';
import MaxHeap from '../dsa-engine/priorityQueue.js';
import {
    calculatePriorityScore,
    batchCalculatePriorities,
} from '../dsa-engine/priorityEngine.js';
import { scheduleTasksGreedy } from '../dsa-engine/scheduler.js';

const toEngine = (row) => ({
    ...row,
    _id: row.id,
    dependencies: row.dependencies || [],
});

/** Map a PG row to the Mongo-compatible camelCase API shape (v1 compat). */
export const presentTask = (row) => {
    if (!row) return row;
    const { priority_score, priority_tier, estimated_minutes, scheduled_start, scheduled_end,
        completed_at, created_at, updated_at, parent_task_id, project_id, goal_id,
        user_id, energy_fit, dependencyDetails, ...rest } = row;
    return {
        ...rest,
        id: row.id,
        _id: row.id, // compat: Mongo clients key on _id
        userId: user_id,
        projectId: project_id,
        goalId: goal_id,
        parentTaskId: parent_task_id,
        estimatedMinutes: estimated_minutes,
        scheduledStart: scheduled_start,
        scheduledEnd: scheduled_end,
        priorityScore: priority_score,
        priorityTier: priority_tier,
        energyFit: energy_fit,
        completedAt: completed_at,
        createdAt: created_at,
        updatedAt: updated_at,
        dependencies: (row.dependencies || []).map((d) =>
            typeof d === 'object' && d !== null ? d.id || d._id : d
        ),
        dependencyDetails: (dependencyDetails || []).map((d) => presentTask({ ...d, dependencies: [] })),
    };
};

const event = async (client, userId, taskId, type, payload = {}) => {
    await client.query(
        `INSERT INTO task_events (user_id, task_id, event_type, payload) VALUES ($1,$2,$3,$4)`,
        [userId, taskId, type, JSON.stringify(payload)]
    );
};

/** Score one row against a completed-id set; returns { score, tier, breakdown }. */
const scoreRow = (row, completedSet) => {
    const deps = row.dependencies || [];
    const blocked = deps.some((d) => !completedSet.has(d));
    return calculatePriorityScore(
        {
            urgency: row.urgency,
            importance: row.importance,
            difficulty: row.difficulty,
            deadline: row.deadline,
        },
        { hasBlockedDependencies: blocked }
    );
};

/** Throw { status: 400 } when proposed dep edges would cycle or reference foreign tasks. */
const assertDepsValid = async (userId, taskIdOrNull, depIds, allRows, client) => {
    const owned = new Set(allRows.map((t) => t.id));
    for (const d of depIds) {
        if (!owned.has(d)) {
            throw { status: 400, message: 'Dependencies must reference your own tasks.' };
        }
        if (taskIdOrNull && d === taskIdOrNull) {
            throw { status: 400, message: 'A task cannot depend on itself.' };
        }
    }
    const dag = new DAG();
    for (const t of allRows) {
        dag.addNode(t.id);
        for (const d of t.dependencies || []) dag.addEdge(t.id, d);
    }
    const from = taskIdOrNull || '__new__';
    dag.addNode(from);
    for (const d of depIds) {
        if (!dag.addEdge(from, d)) {
            throw { status: 400, message: 'Cannot add dependency (would create cycle).' };
        }
    }
    void client;
};

export const createTask = async (userId, input) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const all = await Tasks.allForScoring(userId, client);
        await assertDepsValid(userId, null, input.dependencies || [], all, client);
        const row = await Tasks.create(userId, input, client);
        const completed = await Tasks.completedIds(userId, client);
        const { score, tier } = scoreRow({ ...row, dependencies: row.dependencies }, completed);
        await Tasks.setScore(row.id, score, tier, client);
        await event(client, userId, row.id, 'TASK_CREATED', { title: row.title });
        if ((row.dependencies || []).length > 0) {
            await event(client, userId, row.id, 'DEPENDENCY_ADDED', { dependsOn: row.dependencies });
        }
        await client.query('COMMIT');
        return presentTask(await Tasks.getById(userId, row.id));
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const updateTask = async (userId, taskId, fields, { expectedVersion = null } = {}) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const before = await Tasks.getById(userId, taskId, client);
        if (!before) {
            await client.query('ROLLBACK');
            return { notFound: true };
        }
        if (fields.dependencies !== undefined) {
            const all = await Tasks.allForScoring(userId, client);
            // Exclude self-edges from the base graph so the check sees the replacement, not the union.
            const base = all.map((t) =>
                t.id === taskId ? { ...t, dependencies: [] } : t
            );
            await assertDepsValid(userId, taskId, fields.dependencies, base, client);
        }
        const wasCompleted = before.status === 'completed';
        const res = await Tasks.update(userId, taskId, fields, { expectedVersion, client });
        if (res.conflict) {
            await client.query('ROLLBACK');
            return { conflict: true, current: presentTask(res.current) };
        }
        if (res.notFound) {
            await client.query('ROLLBACK');
            return res;
        }
        if (fields.dependencies !== undefined) {
            await Tasks.replaceDependencies(userId, taskId, fields.dependencies, client);
            await event(client, userId, taskId, 'DEPENDENCY_ADDED', { dependsOn: fields.dependencies });
        }
        // Rescore self
        const self = await Tasks.getById(userId, taskId, client);
        const completed = await Tasks.completedIds(userId, client);
        const s = scoreRow(self, completed);
        await Tasks.setScore(taskId, s.score, s.tier, client);
        if (fields.status && fields.status !== before.status) {
            await event(client, userId, taskId, fields.status === 'completed' ? 'TASK_COMPLETED' : 'TASK_UPDATED', {
                from: before.status,
                to: fields.status,
            });
        } else {
            await event(client, userId, taskId, 'TASK_UPDATED', { fields: Object.keys(fields) });
        }
        // Cascade: status flips unblock/reblock dependents
        if (wasCompleted !== (self.status === 'completed')) {
            const dependents = await Tasks.dependentsOf(userId, taskId, client);
            const freshCompleted = await Tasks.completedIds(userId, client);
            for (const dep of dependents) {
                const ds = scoreRow(dep, freshCompleted);
                await Tasks.setScore(dep.id, ds.score, ds.tier, client);
            }
        }
        await client.query('COMMIT');
        return { row: presentTask(await Tasks.getById(userId, taskId)) };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const deleteTask = async (userId, taskId) => {
    const pool = getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existing = await Tasks.getById(userId, taskId, client);
        if (!existing) {
            await client.query('ROLLBACK');
            return { notFound: true };
        }
        const { dependentIds } = await Tasks.remove(userId, taskId, client);
        await event(client, userId, null, 'TASK_DELETED', { taskId, title: existing.title });
        // Rescore newly unblocked dependents
        const completed = await Tasks.completedIds(userId, client);
        for (const depId of dependentIds) {
            const dep = await Tasks.getById(userId, depId, client);
            if (dep) {
                const ds = scoreRow(dep, completed);
                await Tasks.setScore(depId, ds.score, ds.tier, client);
            }
        }
        await client.query('COMMIT');
        return { deleted: true };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

/** Top-N executable tasks via the greedy MaxHeap scheduler (deterministic). */
export const getTopTasks = async (userId, limit = 5) => {
    const rows = await Tasks.allForScoring(userId);
    const active = rows.filter((t) => t.status === 'pending' || t.status === 'in-progress');
    const scheduled = scheduleTasksGreedy(active.map(toEngine));
    return scheduled.slice(0, limit).map((t) =>
        presentTask({ ...t, id: t._id || t.id, dependencies: t.dependencies || [] })
    );
};

/** Dependency impact: how many unfinished tasks each task transitively unlocks. */
export const dependencyImpact = async (userId) => {
    const rows = await Tasks.allForScoring(userId);
    const dag = new DAG();
    for (const t of rows) {
        dag.addNode(t.id);
        for (const d of t.dependencies || []) dag.addEdge(t.id, d);
    }
    const open = new Set(rows.filter((t) => t.status !== 'completed').map((t) => t.id));
    const impact = {};
    for (const t of rows) {
        // BFS over reverse edges (dependents), counting open tasks unlocked.
        const seen = new Set();
        const stack = [...dag.getDependents(t.id)];
        while (stack.length > 0) {
            const cur = stack.pop();
            if (seen.has(cur)) continue;
            seen.add(cur);
            stack.push(...dag.getDependents(cur));
        }
        impact[t.id] = [...seen].filter((id) => open.has(id) && id !== t.id).length;
    }
    return impact;
};

export const explainPriority = async (userId, taskId) => {
    const row = await Tasks.getById(userId, taskId);
    if (!row) return null;
    const completed = await Tasks.completedIds(userId);
    const { score, tier, breakdown } = scoreRow(row, completed);
    const impact = await dependencyImpact(userId);
    return {
        taskId,
        score,
        tier,
        breakdown,
        blocked: (row.dependencies || []).some((d) => !completed.has(d)),
        unlocks: impact[taskId] ?? 0,
    };
};

/**
 * Dashboard stats — genuine SQL aggregation (GROUP BY + date_trunc CTE),
 * streak computed in JS (gaps-and-islands in SQL is possible but opaque at this scale).
 */
export const getStats = async (userId) => {
    const pool = getPool();
    const byStatus = await pool.query(
        `SELECT status, COUNT(*)::int n FROM tasks WHERE user_id = $1 GROUP BY status`,
        [userId]
    );
    const counts = { total: 0, completed: 0, inProgress: 0, pending: 0, cancelled: 0 };
    for (const r of byStatus.rows) {
        counts.total += r.n;
        if (r.status === 'completed') counts.completed = r.n;
        else if (r.status === 'in-progress') counts.inProgress = r.n;
        else if (r.status === 'pending') counts.pending = r.n;
        else if (r.status === 'cancelled') counts.cancelled = r.n;
    }
    const overdue = await pool.query(
        `SELECT COUNT(*)::int n FROM tasks
         WHERE user_id = $1 AND status IN ('pending','in-progress') AND deadline < now()`,
        [userId]
    );
    const byTier = await pool.query(
        `SELECT priority_tier AS tier, COUNT(*)::int n FROM tasks WHERE user_id = $1 GROUP BY priority_tier`,
        [userId]
    );
    const weekly = await pool.query(
        `WITH days AS (
           SELECT generate_series(date_trunc('day', now() - interval '6 days'), date_trunc('day', now()), interval '1 day') AS d
         )
         SELECT to_char(days.d, 'Dy') AS day, COUNT(t.id)::int AS count
         FROM days LEFT JOIN tasks t
           ON t.user_id = $1 AND t.status = 'completed'
           AND date_trunc('day', t.completed_at) = days.d
         GROUP BY days.d ORDER BY days.d`,
        [userId]
    );
    const focus = await pool.query(
        `SELECT COALESCE(SUM(duration_seconds),0)::int AS secs
         FROM work_sessions WHERE user_id = $1 AND ended_at >= now() - interval '7 days'`,
        [userId]
    );
    // Streak: consecutive completion days ending today/yesterday.
    const days = await pool.query(
        `SELECT DISTINCT date_trunc('day', completed_at)::date AS d FROM tasks
         WHERE user_id = $1 AND status = 'completed' AND completed_at >= now() - interval '45 days'`,
        [userId]
    );
    const set = new Set(days.rows.map((r) => r.d.toISOString().slice(0, 10)));
    const key = (dt) => dt.toISOString().slice(0, 10);
    let streak = 0;
    let cursor = new Date();
    if (!set.has(key(cursor))) {
        const y = new Date(cursor);
        y.setDate(y.getDate() - 1);
        cursor = set.has(key(y)) ? y : null;
    }
    while (cursor && set.has(key(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }

    const completionRate = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
    const velocity = weekly.rows.reduce((a, r) => a + r.count, 0);
    const weeklyFocusMinutes = Math.round((focus.rows[0]?.secs || 0) / 60);
    const productivityScore = Math.max(
        0,
        Math.min(
            100,
            Math.round(
                completionRate * 0.6 +
                    (counts.total > 0 ? Math.min(counts.total * 1.5, 20) : 0) +
                    Math.min(Math.round(weeklyFocusMinutes / 30), 20)
            )
        )
    );
    return {
        ...counts,
        overdue: overdue.rows[0].n,
        completionRate,
        productivityScore,
        streak,
        velocity,
        weeklyFocusMinutes,
        byTier: Object.fromEntries(byTier.rows.map((r) => [r.tier, r.n])),
        weeklyActivity: weekly.rows,
    };
};

export const getDAG = async (userId) => {
    const pool = getPool();
    const tasks = await pool.query(
        `SELECT id, title, status, priority_score, priority_tier FROM tasks WHERE user_id = $1`,
        [userId]
    );
    const edges = await pool.query(
        `SELECT d.task_id AS "from", d.depends_on_task_id AS "to"
         FROM task_dependencies d JOIN tasks t ON t.id = d.task_id WHERE t.user_id = $1`,
        [userId]
    );
    // MaxHeap sanity use (keeps the heap in the scheduling path identity).
    const heap = new MaxHeap();
    for (const t of tasks.rows) heap.insert({ id: t.id, score: t.priority_score });
    void heap.peek();
    return { nodes: tasks.rows, edges: edges.rows };
};

// Re-export for callers that need raw batch scoring + breakdowns.
export { batchCalculatePriorities };
