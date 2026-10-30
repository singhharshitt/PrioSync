/**
 * Mongo planner service — mirrors plannerService.js.
 * Runs the full transactional "reviewed plan → durable state" flow on Mongoose.
 * Mongo doesn't have multi-doc transactions on free-tier Atlas, so we use
 * ordered operations and best-effort rollback cleanup on failure.
 */
import * as Tasks from '../repositories/mongoTasks.js';
import Goal from '../models/Goal.js';
import Project from '../models/Project.js';
import PlanVersion from '../models/PlanVersion.js';
import TaskEvent from '../models/TaskEvent.js';
import DAG from '../dsa-engine/dag.js';
import { calculatePriorityScore } from '../dsa-engine/priorityEngine.js';
import { scheduleTasksGreedy } from '../dsa-engine/scheduler.js';
import { computePlanHealth } from '../planner/planHealth.js';
import { bustUser } from '../cache/taskCache.js';

export const confirmPlan = async (userId, payload) => {
    const keys = new Set(payload.tasks.map((t) => t.key));
    const pkeys = new Set(payload.projects.map((p) => p.key));

    // Pre-checks (no DB).
    for (const t of payload.tasks) {
        if (t.projectKey && !pkeys.has(t.projectKey)) {
            throw { status: 400, message: `Task "${t.key}" references unknown project "${t.projectKey}".` };
        }
    }
    const cleanDeps = payload.dependencies.filter((d) => keys.has(d.task) && keys.has(d.dependsOn) && d.task !== d.dependsOn);
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

    const created = { goals: [], projects: [], tasks: [], plans: [] };
    try {
        // 1. Goal
        let goalDoc = null;
        if (payload.goal) {
            goalDoc = await Goal.create({
                user: userId,
                title: payload.goal.title,
                description: payload.goal.description || '',
                deadline: payload.goal.deadline || null,
            });
            created.goals.push(goalDoc._id);
        }

        // 2. Projects
        const projectIdByKey = new Map();
        const projectsOut = [];
        for (const p of payload.projects) {
            const doc = await Project.create({
                user: userId,
                goal: goalDoc?._id || null,
                title: p.title,
            });
            created.projects.push(doc._id);
            projectIdByKey.set(p.key, doc._id.toString());
            projectsOut.push({ key: p.key, id: doc._id.toString(), title: doc.title });
        }

        // 3. Tasks (no dependencies yet)
        const idByKey = new Map();
        const createdRows = [];
        for (const t of payload.tasks) {
            const row = await Tasks.create(userId, {
                title: t.title,
                description: t.description || '',
                importance: t.importance,
                urgency: t.urgency,
                difficulty: t.difficulty,
                friction: t.friction,
                estimatedMinutes: t.estimatedMinutes ?? 30,
                deadline: t.deadline || payload.goal?.deadline || null,
                projectId: t.projectKey ? projectIdByKey.get(t.projectKey) : null,
                goalId: goalDoc?._id?.toString() || null,
                dependencies: [],
            });
            created.tasks.push(row.id);
            idByKey.set(t.key, row.id);
            createdRows.push({ key: t.key, row, estimatedUncertain: t.estimatedMinutes == null });
            TaskEvent.create({ user: userId, task: row.id, eventType: 'TASK_CREATED', payload: { source: 'planner', key: t.key } }).catch(() => {});
        }

        // 4. Dependency edges
        for (const d of cleanDeps) {
            const taskId = idByKey.get(d.task);
            const depId = idByKey.get(d.dependsOn);
            if (taskId && depId) {
                await Tasks.replaceDependencies(userId, taskId, [
                    ...((await Tasks.getById(userId, taskId))?.dependencies || []).map((x) => (x.id || x._id || x).toString()),
                    depId,
                ]);
                TaskEvent.create({ user: userId, task: taskId, eventType: 'DEPENDENCY_ADDED', payload: { dependsOn: depId, source: 'planner' } }).catch(() => {});
            }
        }

        // 5. Score tasks
        const completed = await Tasks.completedIds(userId);
        const fullRows = [];
        for (const { row } of createdRows) {
            const full = await Tasks.getById(userId, row.id);
            const deps = (full.dependencies || []).map((d) => (d.id || d._id || d).toString());
            const blocked = deps.some((x) => !completed.has(x));
            const { score, tier } = calculatePriorityScore(
                { urgency: full.urgency, importance: full.importance, difficulty: full.difficulty, deadline: full.deadline },
                { hasBlockedDependencies: blocked }
            );
            await Tasks.setScore(row.id, score, tier);
            fullRows.push({ ...full, priorityScore: score, priorityTier: tier, priority_score: score, priority_tier: tier });
        }

        const ordered = scheduleTasksGreedy(fullRows.map((r) => ({ ...r, _id: r.id })));

        // 6. Plan health
        const depKeysByKey = new Map(createdRows.map(({ key }) => [key, []]));
        for (const d of cleanDeps) depKeysByKey.get(d.task)?.push(d.dependsOn);
        const health = computePlanHealth({
            tasks: createdRows.map(({ key, row, estimatedUncertain }) => {
                const full = fullRows.find((f) => f.id === row.id);
                return { key, estimatedMinutes: full.estimatedMinutes, deadline: full.deadline, dependsOn: depKeysByKey.get(key) || [], estimatedUncertain };
            }),
            availableMinutesPerDay: payload.constraints.availableMinutesPerDay,
            goalDeadline: payload.goal?.deadline || null,
        });

        // 7. Plan snapshot
        const plan = await PlanVersion.create({
            user: userId,
            goal: goalDoc?._id || null,
            healthScore: health.score,
            healthDetails: health,
            reason: payload.reason || '',
            items: ordered.map((t, i) => ({ task: t._id || t.id, position: i })),
        });
        created.plans.push(plan._id);
        TaskEvent.create({ user: userId, task: null, eventType: 'PLAN_CREATED', payload: { planId: plan._id.toString(), tasks: fullRows.length, health: health.score } }).catch(() => {});

        await bustUser(userId);
        return {
            planId: plan._id.toString(),
            goal: goalDoc ? { id: goalDoc._id.toString(), title: goalDoc.title, description: goalDoc.description, deadline: goalDoc.deadline, status: goalDoc.status } : null,
            projects: projectsOut,
            tasks: fullRows,
            schedule: ordered,
            health,
        };
    } catch (e) {
        // Best-effort cleanup (ordered, so later docs may reference earlier ones — skip if any delete fails).
        for (const id of created.plans) await PlanVersion.findByIdAndDelete(id).catch(() => {});
        for (const id of created.tasks) await Tasks.remove(userId, id).catch(() => {});
        for (const id of created.projects) await Project.findByIdAndDelete(id).catch(() => {});
        for (const id of created.goals) await Goal.findByIdAndDelete(id).catch(() => {});
        throw e;
    }
};

export const listPlans = async (userId, limit = 20) => {
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const plans = await PlanVersion.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(lim)
        .lean();
    return plans.map((p) => ({
        id: p._id.toString(),
        goalId: p.goal?.toString() ?? null,
        healthScore: p.healthScore,
        health: p.healthDetails,
        reason: p.reason,
        createdAt: p.createdAt,
        taskCount: (p.items || []).length,
    }));
};

export const getPlan = async (userId, planId) => {
    const plan = await PlanVersion.findOne({ _id: planId, user: userId }).lean();
    if (!plan) return null;
    const populated = await PlanVersion.findById(planId)
        .populate({ path: 'items.task', select: 'title status priorityScore priorityTier estimatedMinutes deadline' })
        .lean();
    return {
        id: plan._id.toString(),
        goalId: plan.goal?.toString() ?? null,
        healthScore: plan.healthScore,
        health: plan.healthDetails,
        reason: plan.reason,
        createdAt: plan.createdAt,
        items: (populated.items || []).map((item) => ({
            id: item.task?._id?.toString(),
            title: item.task?.title,
            status: item.task?.status,
            priorityScore: item.task?.priorityScore,
            priorityTier: item.task?.priorityTier,
            estimatedMinutes: item.task?.estimatedMinutes,
            deadline: item.task?.deadline,
            position: item.position,
        })),
    };
};
