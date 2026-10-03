/**
 * Planner confirm - turns a REVIEWED staged plan into durable state.
 * Transactional: goals → projects → tasks → deps → scores → events → plan snapshot.
 * Priority/schedule/health are deterministic (engine), never LLM output.
 */
import { getPool } from '../db/pgClient.js';
import * as Tasks from '../repositories/pgTasks.js';
import DAG from '../dsa-engine/dag.js';
import { calculatePriorityScore } from '../dsa-engine/priorityEngine.js';
import { scheduleTasksGreedy } from '../dsa-engine/scheduler.js';
import { computePlanHealth } from '../planner/planHealth.js';
import { presentTask } from './pgTaskService.js';
import { bustUser } from '../cache/taskCache.js';

const toEngine = (row) => ({ ...row, _id: row.id, dependencies: row.dependencies || [] });

export const confirmPlan = async (userId, payload) => {
    const pool = getPool();
    const keys = new Set(payload.tasks.map((t) => t.key));
    const pkeys = new Set(payload.projects.map((p) => p.key));

    // --- Deterministic pre-checks (before touching the DB) ---
    for (const t of payload.tasks) {
        if (t.projectKey && !pkeys.has(t.projectKey)) {
            throw { status: 400, message: `Task "${t.key}" references unknown project "${t.projectKey}".` };
        }
    }
    const cleanDeps = payload.dependencies.filter(
        (d) => keys.has(d.task) && keys.has(d.dependsOn) && d.task !== d.dependsOn
    );
    if (cleanDeps.length !== payload.dependencies.length) {
        throw { status: 400, message: 'Dependencies reference unknown tasks or self-edges.' };
    }
    const dag = new DAG();
    for (const t of payload.tasks) dag.addNode(t.key);
    for (const d of cleanDeps) {
        if (!dag.addEdge(d.task, d.dependsOn)) {
            throw { status: 400, message: `Dependency ${d.task} → ${d.dependsOn} would create a cycle.` };
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let goalRow = null;
        if (payload.goal) {
            const g = await client.query(
                `INSERT INTO goals (user_id, title, description, deadline)
                 VALUES ($1,$2,$3,$4) RETURNING id, title, description, deadline, status, created_at`,
                [userId, payload.goal.title, payload.goal.description || '', payload.goal.deadline]
            );
            goalRow = g.rows[0];
        }

        const projectIdByKey = new Map();
        const projectsOut = [];
        for (const p of payload.projects) {
            const r = await client.query(
                `INSERT INTO projects (user_id, goal_id, title) VALUES ($1,$2,$3) RETURNING id, title`,
                [userId, goalRow?.id || null, p.title]
            );
            projectIdByKey.set(p.key, r.rows[0].id);
            projectsOut.push({ key: p.key, id: r.rows[0].id, title: r.rows[0].title });
        }

        // Tasks (goal deadline cascades to undated tasks so the engine sees pressure honestly)
        const idByKey = new Map();
        const createdRows = [];
        for (const t of payload.tasks) {
            const row = await Tasks.create(
                userId,
                {
                    title: t.title,
                    description: t.description || '',
                    importance: t.importance,
                    urgency: t.urgency,
                    difficulty: t.difficulty,
                    friction: t.friction,
                    estimatedMinutes: t.estimatedMinutes ?? 30,
                    deadline: t.deadline || payload.goal?.deadline || null,
                    projectId: t.projectKey ? projectIdByKey.get(t.projectKey) : null,
                    goalId: goalRow?.id || null,
                    dependencies: [],
                },
                client
            );
            idByKey.set(t.key, row.id);
            createdRows.push({ key: t.key, row, estimatedUncertain: t.estimatedMinutes == null });
            await client.query(
                `INSERT INTO task_events (user_id, task_id, event_type, payload)
                 VALUES ($1,$2,'TASK_CREATED',$3)`,
                [userId, row.id, JSON.stringify({ source: 'planner', key: t.key })]
            );
        }

        for (const d of cleanDeps) {
            await client.query(
                `INSERT INTO task_dependencies (task_id, depends_on_task_id)
                 VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [idByKey.get(d.task), idByKey.get(d.dependsOn)]
            );
            await client.query(
                `INSERT INTO task_events (user_id, task_id, event_type, payload)
                 VALUES ($1,$2,'DEPENDENCY_ADDED',$3)`,
                [userId, idByKey.get(d.task), JSON.stringify({ dependsOn: idByKey.get(d.dependsOn), source: 'planner' })]
            );
        }

        // Deterministic scoring over the fresh graph (+ user's existing completions)
        const completed = await Tasks.completedIds(userId, client);
        const fullRows = [];
        for (const { row } of createdRows) {
            const full = await Tasks.getById(userId, row.id, client);
            const blocked = (full.dependencies || []).some((x) => !completed.has(x));
            const { score, tier } = calculatePriorityScore(
                { urgency: full.urgency, importance: full.importance, difficulty: full.difficulty, deadline: full.deadline },
                { hasBlockedDependencies: blocked }
            );
            await Tasks.setScore(row.id, score, tier, client);
            fullRows.push({ ...full, priority_score: score, priority_tier: tier });
        }

        const ordered = scheduleTasksGreedy(fullRows.map(toEngine));

        // Health reasons over plan KEYS (not DB UUIDs) so dep resolution is checkable.
        const depKeysByKey = new Map(createdRows.map(({ key }) => [key, []]));
        for (const d of cleanDeps) depKeysByKey.get(d.task)?.push(d.dependsOn);
        const health = computePlanHealth({
            tasks: createdRows.map(({ key, row, estimatedUncertain }) => {
                const full = fullRows.find((f) => f.id === row.id);
                return {
                    key,
                    estimatedMinutes: full.estimated_minutes,
                    deadline: full.deadline,
                    dependsOn: depKeysByKey.get(key) || [],
                    estimatedUncertain,
                };
            }),
            availableMinutesPerDay: payload.constraints.availableMinutesPerDay,
            goalDeadline: payload.goal?.deadline || null,
        });

        const plan = await client.query(
            `INSERT INTO plan_versions (user_id, goal_id, health_score, health_details, reason)
             VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
            [userId, goalRow?.id || null, health.score, JSON.stringify(health), payload.reason || '']
        );
        const planId = plan.rows[0].id;
        let pos = 0;
        for (const t of ordered) {
            const id = t._id || t.id;
            await client.query(
                `INSERT INTO plan_items (plan_id, task_id, position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
                [planId, id, pos++]
            );
        }
        await client.query(
            `INSERT INTO task_events (user_id, task_id, event_type, payload)
             VALUES ($1,NULL,'PLAN_CREATED',$2)`,
            [userId, JSON.stringify({ planId, tasks: fullRows.length, health: health.score })]
        );

        await client.query('COMMIT');
        await bustUser(userId);
        return {
            planId,
            goal: goalRow,
            projects: projectsOut,
            tasks: fullRows.map(presentTask),
            schedule: ordered.map((t) => presentTask({ ...t, id: t._id || t.id, dependencies: t.dependencies || [] })),
            health,
        };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const listPlans = async (userId, limit = 20) => {
    const pool = getPool();
    const r = await pool.query(
        `SELECT p.id, p.goal_id AS "goalId", p.health_score AS "healthScore",
                p.health_details AS "health", p.reason, p.created_at AS "createdAt",
                COUNT(i.task_id)::int AS "taskCount"
         FROM plan_versions p LEFT JOIN plan_items i ON i.plan_id = p.id
         WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC LIMIT $2`,
        [userId, Math.min(Math.max(Number(limit) || 20, 1), 50)]
    );
    return r.rows;
};

export const getPlan = async (userId, planId) => {
    const pool = getPool();
    const p = await pool.query(
        `SELECT id, goal_id AS "goalId", health_score AS "healthScore",
                health_details AS "health", reason, created_at AS "createdAt"
         FROM plan_versions WHERE id = $1 AND user_id = $2`,
        [planId, userId]
    );
    if (!p.rows[0]) return null;
    const items = await pool.query(
        `SELECT t.id, t.title, t.status, t.priority_score AS "priorityScore",
                t.priority_tier AS "priorityTier", t.estimated_minutes AS "estimatedMinutes",
                t.deadline, i.position
         FROM plan_items i JOIN tasks t ON t.id = i.task_id
         WHERE i.plan_id = $1 ORDER BY i.position`,
        [planId]
    );
    return { ...p.rows[0], items: items.rows };
};
