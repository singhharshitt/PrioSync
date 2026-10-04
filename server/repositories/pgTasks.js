/**
 * PG task repository - raw SQL.
 * Dependency edges live in task_dependencies (relational DAG, not an array).
 * Callers orchestrate transactions; every mutator accepts a txn client.
 */
import { getPool } from '../db/pgClient.js';

const db = (client) => client || getPool();

const SORT = {
    priority: 't.priority_score DESC, t.created_at DESC',
    deadline: 't.deadline ASC NULLS LAST, t.priority_score DESC',
    created: 't.created_at DESC',
    title: 't.title ASC',
};

const ROW = `t.id, t.user_id, t.project_id, t.goal_id, t.parent_task_id,
    t.title, t.description, t.status, t.importance, t.urgency, t.difficulty,
    t.friction, t.estimated_minutes, t.deadline, t.scheduled_start, t.scheduled_end,
    t.priority_score, t.priority_tier, t.energy_fit, t.category,
    t.commitment_type, t.stakeholder,
    t.completed_at, t.version, t.created_at, t.updated_at`;

// UPDATE ... RETURNING cannot use the `t.` alias (no FROM clause) - same columns, unqualified.
const RET = `id, user_id, project_id, goal_id, parent_task_id,
    title, description, status, importance, urgency, difficulty,
    friction, estimated_minutes, deadline, scheduled_start, scheduled_end,
    priority_score, priority_tier, energy_fit, category,
    commitment_type, stakeholder,
    completed_at, version, created_at, updated_at`;

/** Attach `dependencies: [uuid...]` to rows in one extra query (avoids N+1). */
const attachDeps = async (rows, client) => {
    if (rows.length === 0) return rows;
    const ids = rows.map((r) => r.id);
    const r = await db(client).query(
        `SELECT task_id, depends_on_task_id FROM task_dependencies WHERE task_id = ANY($1)`,
        [ids]
    );
    const map = new Map(ids.map((id) => [id, []]));
    for (const e of r.rows) map.get(e.task_id)?.push(e.depends_on_task_id);
    return rows.map((row) => ({ ...row, dependencies: map.get(row.id) || [] }));
};

/**
 * Populate dependency details (title/status/score) for listed tasks in one
 * query - the same fields v1 returned via populate(), which TaskCard renders.
 */
const attachDepDetails = async (rows, client) => {
    const withDeps = rows.filter((r) => (r.dependencies || []).length > 0);
    if (withDeps.length === 0) return rows;
    const r = await db(client).query(
        `SELECT d.task_id, t.id, t.title, t.status, t.priority_score, t.priority_tier, t.deadline
         FROM task_dependencies d JOIN tasks t ON t.id = d.depends_on_task_id
         WHERE d.task_id = ANY($1)`,
        [withDeps.map((row) => row.id)]
    );
    const map = new Map();
    for (const d of r.rows) {
        if (!map.has(d.task_id)) map.set(d.task_id, []);
        map.get(d.task_id).push(d);
    }
    return rows.map((row) => ({
        ...row,
        dependencyDetails: map.get(row.id) || (row.dependencyDetails ?? []),
    }));
};

export const listByUser = async (userId, { status, sort = 'priority', limit = 50, offset = 0 } = {}, client) => {
    const order = SORT[sort] || SORT.priority;
    const params = [userId];
    let where = 't.user_id = $1';
    if (status) {
        params.push(status);
        where += ` AND t.status = $${params.length}`;
    }
    params.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
    params.push(Math.max(Number(offset) || 0, 0));
    const r = await db(client).query(
        `SELECT ${ROW} FROM tasks t WHERE ${where} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );
    return attachDepDetails(await attachDeps(r.rows, client), client);
};

export const countByUser = async (userId, { status } = {}, client) => {
    const params = [userId];
    let where = 'user_id = $1';
    if (status) {
        params.push(status);
        where += ' AND status = $2';
    }
    const r = await db(client).query(`SELECT COUNT(*)::int n FROM tasks WHERE ${where}`, params);
    return r.rows[0].n;
};

/** All user tasks for scoring/scheduling (single round-trip + one edge query). */
export const allForScoring = async (userId, client) => {
    const r = await db(client).query(`SELECT ${ROW} FROM tasks t WHERE t.user_id = $1`, [userId]);
    return attachDeps(r.rows, client);
};

export const getById = async (userId, taskId, client) => {
    const r = await db(client).query(`SELECT ${ROW} FROM tasks t WHERE t.id = $1 AND t.user_id = $2`, [
        taskId,
        userId,
    ]);
    if (!r.rows[0]) return null;
    const [row] = await attachDeps([r.rows[0]], client);
    const deps = await db(client).query(
        `SELECT t.id, t.title, t.status, t.priority_score, t.priority_tier, t.deadline
         FROM task_dependencies d JOIN tasks t ON t.id = d.depends_on_task_id
         WHERE d.task_id = $1`,
        [taskId]
    );
    return { ...row, dependencyDetails: deps.rows };
};

export const completedIds = async (userId, client) => {
    const r = await db(client).query(`SELECT id FROM tasks WHERE user_id = $1 AND status = 'completed'`, [
        userId,
    ]);
    return new Set(r.rows.map((x) => x.id));
};

export const dependentsOf = async (userId, taskId, client) => {
    const r = await db(client).query(
        `SELECT ${ROW} FROM task_dependencies d JOIN tasks t ON t.id = d.task_id
         WHERE d.depends_on_task_id = $1 AND t.user_id = $2`,
        [taskId, userId]
    );
    return attachDeps(r.rows, client);
};

export const create = async (
    userId,
    { title, description = '', status = 'pending', importance = 3, urgency = 3, difficulty = 3,
      friction = 3, estimatedMinutes = 30, deadline = null, category = 'General',
      commitmentType = 'personal', stakeholder = '', energyFit = 'normal',
      projectId = null, goalId = null, parentTaskId = null, dependencies = [] },
    client
) => {
    const q = db(client);
    const r = await q.query(
        `INSERT INTO tasks (user_id, project_id, goal_id, parent_task_id, title, description, status,
           importance, urgency, difficulty, friction, estimated_minutes, deadline, category,
           commitment_type, stakeholder, energy_fit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING ${'id, user_id, title, description, status, importance, urgency, difficulty, friction, estimated_minutes, deadline, priority_score, priority_tier, category, commitment_type, stakeholder, energy_fit, completed_at, version, created_at, updated_at'}`,
        [userId, projectId, goalId, parentTaskId, title, description, status,
         importance, urgency, difficulty, friction, estimatedMinutes, deadline, category,
         commitmentType, stakeholder, energyFit]
    );
    const row = r.rows[0];
    const clean = [...new Set(dependencies)].filter((d) => d && d !== row.id);
    for (const depId of clean) {
        await q.query(
            `INSERT INTO task_dependencies (task_id, depends_on_task_id)
             SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM tasks WHERE id = $2 AND user_id = $3)
             ON CONFLICT DO NOTHING`,
            [row.id, depId, userId]
        );
    }
    const [full] = await attachDeps([{ ...row, project_id: projectId, goal_id: goalId, parent_task_id: parentTaskId }], client);
    return full;
};

export const setScore = async (taskId, score, tier, client) => {
    await db(client).query(`UPDATE tasks SET priority_score = $2, priority_tier = $3 WHERE id = $1`, [
        taskId,
        score,
        tier,
    ]);
};

/**
 * Optimistic-concurrency update. Pass expectedVersion to enforce;
 * omit for backward-compat blind writes.
 * Accepts camelCase (API) or snake_case (repo) keys - camelCase wins only
 * when the snake_case twin is absent. Returns { row } or { conflict: true, current }.
 */
const FIELD_MAP = {
    estimatedMinutes: 'estimated_minutes',
    energyFit: 'energy_fit',
    projectId: 'project_id',
    goalId: 'goal_id',
    parentTaskId: 'parent_task_id',
    commitmentType: 'commitment_type',
};

export const update = async (userId, taskId, fields, { expectedVersion = null, client = null } = {}) => {
    const q = db(client);
    const normalized = { ...fields };
    for (const [camel, snake] of Object.entries(FIELD_MAP)) {
        if (normalized[camel] !== undefined && normalized[snake] === undefined) {
            normalized[snake] = normalized[camel];
        }
        delete normalized[camel];
    }
    const allowed = [
        'title', 'description', 'deadline', 'importance', 'urgency', 'difficulty',
        'friction', 'estimated_minutes', 'status', 'category', 'commitment_type',
        'stakeholder', 'project_id', 'goal_id', 'parent_task_id', 'scheduled_start',
        'scheduled_end', 'energy_fit',
    ];
    const sets = [];
    const params = [];
    for (const k of allowed) {
        if (normalized[k] !== undefined) {
            params.push(normalized[k]);
            sets.push(`${k} = $${params.length}`);
        }
    }
    if (normalized.status === 'completed') {
        sets.push(`completed_at = COALESCE(completed_at, now())`);
    } else if (normalized.status !== undefined) {
        sets.push(`completed_at = NULL`);
    }
    sets.push(`version = version + 1`, `updated_at = now()`);

    params.push(taskId, userId);
    let sql = `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length}`;
    if (expectedVersion !== null && expectedVersion !== undefined) {
        params.push(Number(expectedVersion));
        sql += ` AND version = $${params.length}`;
    }
    sql += ` RETURNING ${RET}`;
    const r = await q.query(sql, params);
    if (r.rows[0]) {
        const [row] = await attachDeps(r.rows, client);
        return { row };
    }
    const cur = await q.query(`SELECT ${ROW} FROM tasks t WHERE t.id = $1 AND t.user_id = $2`, [taskId, userId]);
    if (!cur.rows[0]) return { notFound: true };
    const [current] = await attachDeps([cur.rows[0]], client);
    return { conflict: true, current };
};

export const replaceDependencies = async (userId, taskId, depIds, client) => {
    const q = db(client);
    await q.query(`DELETE FROM task_dependencies WHERE task_id = $1`, [taskId]);
    const clean = [...new Set(depIds)].filter((d) => d && d !== taskId);
    for (const depId of clean) {
        await q.query(
            `INSERT INTO task_dependencies (task_id, depends_on_task_id)
             SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM tasks WHERE id = $2 AND user_id = $3)
             ON CONFLICT DO NOTHING`,
            [taskId, depId, userId]
        );
    }
};

/** Delete returns dependent ids (for rescore) before FK cascade removes edges. */
export const remove = async (userId, taskId, client) => {
    const q = db(client);
    const dep = await q.query(
        `SELECT t.id FROM task_dependencies d JOIN tasks t ON t.id = d.task_id
         WHERE d.depends_on_task_id = $1 AND t.user_id = $2`,
        [taskId, userId]
    );
    const r = await q.query(`DELETE FROM tasks WHERE id = $1 AND user_id = $2`, [taskId, userId]);
    return { deleted: r.rowCount, dependentIds: dep.rows.map((x) => x.id) };
};
