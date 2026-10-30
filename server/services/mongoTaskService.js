/**
 * Mongo task service — deterministic orchestration over Mongoose repositories
 * + DSA engine. Mirrors pgTaskService.js: same exported function names, same
 * return shapes, same optimistic-concurrency contract (version + 409).
 *
 * Every mutation records a TaskEvent (best-effort async; never blocks response).
 * No BEGIN/COMMIT wrappers — Mongo has no multi-document transactions in the
 * single-replica free-tier; we rely on ordered ops + best-effort events.
 */
import * as Tasks from '../repositories/mongoTasks.js';
import * as Users from '../repositories/mongoUsers.js';
import TaskEvent from '../models/TaskEvent.js';
import DAG from '../dsa-engine/dag.js';
import MaxHeap from '../dsa-engine/priorityQueue.js';
import {
    calculatePriorityScore,
    batchCalculatePriorities,
} from '../dsa-engine/priorityEngine.js';
import { scheduleTasksGreedy } from '../dsa-engine/scheduler.js';
import { bustUser } from '../cache/taskCache.js';
import WorkSession from '../models/WorkSession.js';

/** Map a repository row to the v1-compatible camelCase API shape. */
export const presentTask = (row) => row; // mongoTasks.toApiShape already returns camelCase

// ── Scoring helpers ──────────────────────────────────────────────────────────

const scoreRow = (row, completedSet) => {
    const deps = (row.dependencies || []);
    const blocked = deps.some((d) => {
        const id = (d && typeof d === 'object' ? (d.id || d._id) : d)?.toString();
        return id && !completedSet.has(id);
    });
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

const event = (userId, taskId, type, payload = {}) => {
    TaskEvent.create({ user: userId, task: taskId || null, eventType: type, payload }).catch(() => {});
};

/** Cycle + foreign-task validation (same logic as pgTaskService.assertDepsValid). */
const assertDepsValid = async (userId, taskIdOrNull, depIds, allRows) => {
    const owned = new Set(allRows.map((t) => (t._id || t.id).toString()));
    for (const d of depIds) {
        if (!owned.has(d.toString())) {
            throw { status: 400, message: 'Dependencies must reference your own tasks.' };
        }
        if (taskIdOrNull && d.toString() === taskIdOrNull.toString()) {
            throw { status: 400, message: 'A task cannot depend on itself.' };
        }
    }
    const dag = new DAG();
    for (const t of allRows) {
        const id = (t._id || t.id).toString();
        dag.addNode(id);
        for (const dep of t.dependencies || []) {
            dag.addEdge(id, dep.toString());
        }
    }
    const from = taskIdOrNull ? taskIdOrNull.toString() : '__new__';
    dag.addNode(from);
    for (const d of depIds) {
        if (!dag.addEdge(from, d.toString())) {
            throw { status: 400, message: 'Cannot add dependency (would create cycle).' };
        }
    }
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const createTask = async (userId, input) => {
    const all = await Tasks.allForScoring(userId);
    await assertDepsValid(userId, null, (input.dependencies || []).map(String), all);

    const row = await Tasks.create(userId, input);
    const completed = await Tasks.completedIds(userId);
    const { score, tier } = scoreRow({ ...row, dependencies: (input.dependencies || []).map(String) }, completed);
    await Tasks.setScore(row.id, score, tier);

    event(userId, row.id, 'TASK_CREATED', { title: row.title });
    if ((input.dependencies || []).length > 0) {
        event(userId, row.id, 'DEPENDENCY_ADDED', { dependsOn: input.dependencies });
    }
    await bustUser(userId);
    return Tasks.getById(userId, row.id);
};

export const updateTask = async (userId, taskId, fields, { expectedVersion = null } = {}) => {
    const before = await Tasks.getById(userId, taskId);
    if (!before) return { notFound: true };

    if (fields.dependencies !== undefined) {
        const all = await Tasks.allForScoring(userId);
        const base = all.map((t) =>
            (t._id || t.id).toString() === taskId.toString()
                ? { ...t, dependencies: [] }
                : t
        );
        await assertDepsValid(userId, taskId, fields.dependencies.map(String), base);
    }

    const wasCompleted = before.status === 'completed';
    const out = await Tasks.update(userId, taskId, fields, { expectedVersion });
    if (out.conflict) return out;
    if (out.notFound) return out;

    if (fields.dependencies !== undefined) {
        await Tasks.replaceDependencies(userId, taskId, fields.dependencies);
        event(userId, taskId, 'DEPENDENCY_ADDED', { dependsOn: fields.dependencies });
    }

    // Rescore self.
    const self = await Tasks.getById(userId, taskId);
    const completed = await Tasks.completedIds(userId);
    const { score, tier } = scoreRow({ ...self, dependencies: (self.dependencies || []).map((d) => (d.id || d._id || d).toString()) }, completed);
    await Tasks.setScore(taskId, score, tier);

    if (fields.status && fields.status !== before.status) {
        event(userId, taskId, fields.status === 'completed' ? 'TASK_COMPLETED' : 'TASK_UPDATED', {
            from: before.status,
            to: fields.status,
        });
    } else {
        event(userId, taskId, 'TASK_UPDATED', { fields: Object.keys(fields) });
    }

    // Cascade rescore dependents when completion status flips.
    if (wasCompleted !== (self.status === 'completed')) {
        const dependents = await Tasks.dependentsOf(userId, taskId);
        const freshCompleted = await Tasks.completedIds(userId);
        for (const dep of dependents) {
            const ds = scoreRow(dep, freshCompleted);
            await Tasks.setScore(dep.id, ds.score, ds.tier);
        }
    }

    await bustUser(userId);
    const final = await Tasks.getById(userId, taskId);
    return { row: final };
};

export const deleteTask = async (userId, taskId) => {
    const existing = await Tasks.getById(userId, taskId);
    if (!existing) return { notFound: true };

    const { dependentIds } = await Tasks.remove(userId, taskId);
    event(userId, null, 'TASK_DELETED', { taskId, title: existing.title });

    // Rescore newly unblocked dependents.
    const completed = await Tasks.completedIds(userId);
    for (const depId of dependentIds) {
        const dep = await Tasks.getById(userId, depId);
        if (dep) {
            const ds = scoreRow({ ...dep, dependencies: (dep.dependencies || []).map((d) => (d.id || d._id || d).toString()) }, completed);
            await Tasks.setScore(depId, ds.score, ds.tier);
        }
    }
    await bustUser(userId);
    return { deleted: true };
};

export const rescoreUser = async (userId) => {
    const rows = await Tasks.allForScoring(userId);
    const completed = await Tasks.completedIds(userId);
    let rescored = 0;
    for (const row of rows) {
        if (row.status !== 'pending' && row.status !== 'in-progress') continue;
        const { score, tier } = scoreRow(row, completed);
        if (score !== row.priorityScore || tier !== row.priorityTier) {
            await Tasks.setScore(row.id, score, tier);
            rescored++;
        }
    }
    return { checked: rows.length, rescored };
};

// ── Read helpers ─────────────────────────────────────────────────────────────

export const getTopTasks = async (userId, limit = 5) => {
    const rows = await Tasks.allForScoring(userId);
    const active = rows.filter((t) => t.status === 'pending' || t.status === 'in-progress');
    const scheduled = scheduleTasksGreedy(active);
    return scheduled.slice(0, limit);
};

export const dependencyImpact = async (userId) => {
    const rows = await Tasks.allForScoring(userId);
    const dag = new DAG();
    for (const t of rows) {
        dag.addNode(t.id);
        for (const d of t.dependencies || []) dag.addEdge(t.id, d.toString());
    }
    const open = new Set(rows.filter((t) => t.status !== 'completed').map((t) => t.id));
    const impact = {};
    for (const t of rows) {
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
    const deps = (row.dependencies || []).map((d) => (d.id || d._id || d).toString());
    const { score, tier, breakdown } = scoreRow({ ...row, dependencies: deps }, completed);
    const impact = await dependencyImpact(userId);
    return {
        taskId,
        score,
        tier,
        breakdown,
        blocked: deps.some((d) => !completed.has(d)),
        unlocks: impact[taskId] ?? 0,
    };
};

export const getDAG = async (userId) => {
    const rows = await Tasks.allForScoring(userId);
    const heap = new MaxHeap();
    for (const t of rows) heap.insert({ id: t.id, score: t.priorityScore });
    void heap.peek();
    const nodes = rows.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priorityScore: t.priorityScore,
        priorityTier: t.priorityTier,
    }));
    const edges = rows.flatMap((t) =>
        (t.dependencies || []).map((d) => ({ from: t.id, to: d.toString() }))
    );
    return { nodes, edges };
};

export const getStats = async (userId) => {
    const Task = (await import('../models/Task.js')).default;
    const week = new Date(Date.now() - 7 * 86400000);
    const streakWindow = new Date(Date.now() - 45 * 86400000);

    const [total, completed, inProgress, pending, cancelled, overdue, byTierRaw, recentCompletions, streakDocs] =
        await Promise.all([
            Task.countDocuments({ owner: userId }),
            Task.countDocuments({ owner: userId, status: 'completed' }),
            Task.countDocuments({ owner: userId, status: 'in-progress' }),
            Task.countDocuments({ owner: userId, status: 'pending' }),
            Task.countDocuments({ owner: userId, status: 'cancelled' }),
            Task.countDocuments({
                owner: userId,
                status: { $in: ['pending', 'in-progress'] },
                deadline: { $lt: new Date() },
            }),
            Task.aggregate([
                { $match: { owner: userId } },
                { $group: { _id: '$priorityTier', n: { $sum: 1 } } },
            ]),
            Task.find({ owner: userId, status: 'completed', completedAt: { $gte: week } })
                .select('completedAt')
                .lean(),
            Task.find({ owner: userId, status: 'completed', completedAt: { $gte: streakWindow } })
                .select('completedAt')
                .lean(),
        ]);

    // Weekly activity (last 7 days).
    const dayCount = new Map();
    for (const t of recentCompletions) {
        if (t.completedAt) {
            const d = new Date(t.completedAt);
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dayCount.set(k, (dayCount.get(k) || 0) + 1);
        }
    }
    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        weeklyActivity.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), count: dayCount.get(k) || 0 });
    }

    // Streak.
    const completionDays = new Set(
        streakDocs
            .filter((t) => t.completedAt)
            .map((t) => {
                const d = new Date(t.completedAt);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })
    );
    const key = (dt) => {
        const d = new Date(dt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    let streak = 0;
    let cursor = new Date();
    if (!completionDays.has(key(cursor))) {
        const y = new Date(cursor);
        y.setDate(y.getDate() - 1);
        cursor = completionDays.has(key(y)) ? y : null;
    }
    while (cursor && completionDays.has(key(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }

    // Focus sessions (last 7 days).
    const sessions = await WorkSession.find({
        user: userId,
        endedAt: { $gte: week },
    }).lean();
    const weeklyFocusMinutes = Math.round(
        sessions.reduce((s, x) => s + (x.durationSeconds || 0), 0) / 60
    );

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const velocity = recentCompletions.length;
    const completionSpeedScore = Math.min(100, Math.round((velocity / 7) * 100));
    const focusScore = Math.round(completionRate * 0.6 + completionSpeedScore * 0.4);
    const productivityScore = Math.max(
        0,
        Math.min(
            100,
            Math.round(
                completionRate * 0.6 +
                    (total > 0 ? Math.min(total * 1.5, 20) : 0) +
                    Math.min(Math.round(weeklyFocusMinutes / 30), 20)
            )
        )
    );
    const byTier = Object.fromEntries(byTierRaw.map((r) => [r._id, r.n]));

    return {
        total, completed, inProgress, pending, cancelled, overdue,
        completionRate, productivityScore, focusScore, streak, velocity,
        weeklyFocusMinutes, byTier, weeklyActivity,
    };
};

// Re-export for callers that need raw batch scoring + breakdowns.
export { batchCalculatePriorities };
