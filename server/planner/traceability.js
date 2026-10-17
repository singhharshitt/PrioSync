/**
 * Goal -> Work traceability + progress efficiency - deterministic and pure
 * (spec sections 35-36).
 *
 * Maps Goal -> Project -> Task -> Subtask (parent_task_id), then detects
 * orphan work, goal starvation, low-impact completed work, and blocked
 * goal-critical work. Progress efficiency compares completed volume against
 * meaningful goal contribution in factual language only.
 *
 * Input shapes: goals [{id,title,createdAt}], projects [{id,title,goalId}],
 * tasks in insightService.normalizeTask shape (+ parentTaskId, completedAt).
 */
const taskIdOf = (t) => String(t.id ?? t._id);
const DAY = 86400000;
const isOpen = (t) => t.status === 'pending' || t.status === 'in-progress';
const isGoalCritical = (t) => (t.priorityTier === 'critical' || t.priorityTier === 'high');

export const buildTraceability = ({ goals = [], projects = [], tasks = [] }, { now = new Date() } = {}) => {
    const at = new Date(now).getTime();
    const byGoal = new Map(goals.map((g) => [String(g.id), { goal: g, projects: [] }]));
    const projectById = new Map(projects.map((p) => [String(p.id), p]));
    const tasksByProject = new Map();
    for (const t of tasks) {
        const pid = t.projectId != null ? String(t.projectId) : 'none';
        if (!tasksByProject.has(pid)) tasksByProject.set(pid, []);
        tasksByProject.get(pid).push(t);
    }

    const tree = goals.map((g) => {
        const goalProjects = projects.filter((p) => p.goalId != null && String(p.goalId) === String(g.id));
        const goalTaskIds = new Set(tasks.filter((t) => t.goalId != null && String(t.goalId) === String(g.id)).map(taskIdOf));
        const openCount = tasks.filter((t) => goalTaskIds.has(taskIdOf(t)) && isOpen(t)).length;
        const doneCount = tasks.filter((t) => goalTaskIds.has(taskIdOf(t)) && t.status === 'completed').length;
        return {
            goalId: String(g.id),
            title: g.title,
            openTasks: openCount,
            completedTasks: doneCount,
            completion: openCount + doneCount > 0 ? Math.round((doneCount / (openCount + doneCount)) * 100) : 0,
            projects: goalProjects.map((p) => {
                const pts = tasksByProject.get(String(p.id)) || [];
                const roots = pts.filter((t) => !t.parentTaskId);
                return {
                    projectId: String(p.id),
                    title: p.title,
                    open: pts.filter(isOpen).length,
                    completed: pts.filter((t) => t.status === 'completed').length,
                    tasks: roots.map((t) => ({
                        taskId: taskIdOf(t),
                        title: t.title,
                        status: t.status,
                        priorityTier: t.priorityTier,
                        subtasks: pts
                            .filter((s) => s.parentTaskId != null && String(s.parentTaskId) === taskIdOf(t))
                            .map((s) => ({ taskId: taskIdOf(s), title: s.title, status: s.status })),
                    })),
                };
            }),
        };
    });

    // --- Detections ---
    const orphanWork = tasks
        .filter((t) => isOpen(t) && t.goalId == null && t.projectId == null)
        .map((t) => ({ taskId: taskIdOf(t), title: t.title, reason: 'No goal and no project - work sits outside every plan.' }));

    const goalStarvation = goals
        .map((g) => {
            const gt = tasks.filter((t) => t.goalId != null && String(t.goalId) === String(g.id));
            const lastActivity = gt.reduce((max, t) => {
                const ts = new Date(t.completedAt || t.updatedAt || t.createdAt || 0).getTime();
                return Number.isNaN(ts) ? max : Math.max(max, ts);
            }, new Date(g.createdAt || 0).getTime() || 0);
            const daysIdle = Math.floor((at - lastActivity) / DAY);
            const createdDays = Math.floor((at - new Date(g.createdAt || 0).getTime()) / DAY);
            const hasOpen = gt.some(isOpen);
            return { goalId: String(g.id), title: g.title, daysSinceCreation: createdDays, daysIdle, openTasks: gt.filter(isOpen).length, completedTasks: gt.filter((t) => t.status === 'completed').length, hasOpen };
        })
        .filter((g) => g.daysSinceCreation >= 14 && g.daysIdle >= 14)
        .map(({ hasOpen, completedTasks, ...g }) => ({
            ...g,
            completedTasks,
            reason: completedTasks === 0 ? 'Goal has open work but no completed work in 14+ days.' : 'Goal saw no activity for 14+ days.',
        }));

    const lowImpactCompleted = tasks
        .filter((t) => t.status === 'completed' && (t.priorityScore ?? 0) < 35)
        .map((t) => ({ taskId: taskIdOf(t), title: t.title, priorityScore: t.priorityScore ?? 0, goalId: t.goalId || null }))
        .sort((a, b) => a.priorityScore - b.priorityScore);

    const completedIds = new Set(tasks.filter((t) => t.status === 'completed').map(taskIdOf));
    const blockedGoalCritical = tasks
        .filter(
            (t) =>
                isOpen(t) &&
                t.goalId != null &&
                isGoalCritical(t) &&
                (t.dependencies || []).some((d) => !completedIds.has(String(d?.id ?? d?._id ?? d)))
        )
        .map((t) => ({
            taskId: taskIdOf(t),
            title: t.title,
            goalId: String(t.goalId),
            blockedBy: (t.dependencies || []).map((d) => String(d?.id ?? d?._id ?? d)).filter((d) => !completedIds.has(d)),
        }));

    // Orphaned projects (no goal) are plan gaps too.
    const orphanProjects = projects
        .filter((p) => p.goalId == null)
        .map((p) => ({ projectId: String(p.id), title: p.title, reason: 'Project is not attached to any goal.' }));

    return {
        tree,
        detections: {
            orphanWork,
            orphanProjects,
            goalStarvation,
            lowImpactCompleted: lowImpactCompleted.slice(0, 10),
            blockedGoalCritical,
        },
        summary: {
            goals: goals.length,
            projects: projects.length,
            tasks: tasks.length,
            openTasks: tasks.filter(isOpen).length,
            orphanWorkCount: orphanWork.length,
            starvedGoalCount: goalStarvation.length,
            lowImpactCompletedCount: lowImpactCompleted.length,
            blockedCriticalCount: blockedGoalCritical.length,
        },
    };
};

/** Spec section 36: completed volume vs meaningful goal contribution (factual). */
export const progressEfficiency = ({ goals = [], tasks = [] }) => {
    const completed = tasks.filter((t) => t.status === 'completed');
    const critical = tasks.filter((t) => t.goalId != null && isGoalCritical(t));
    const criticalCompleted = critical.filter((t) => t.status === 'completed').length;

    const byGoal = goals.map((g) => {
        const gt = tasks.filter((t) => t.goalId != null && String(t.goalId) === String(g.id));
        const gCritical = gt.filter(isGoalCritical);
        return {
            goalId: String(g.id),
            title: g.title,
            completed: gt.filter((t) => t.status === 'completed').length,
            criticalTotal: gCritical.length,
            criticalCompleted: gCritical.filter((t) => t.status === 'completed').length,
        };
    });

    const ratio = critical.length > 0 ? criticalCompleted / critical.length : null;
    const share = completed.length > 0 && critical.length > 0 ? criticalCompleted / completed.length : null;
    let observation;
    if (completed.length === 0) {
        observation = 'No completed tasks yet - nothing to compare.';
    } else if (share === null) {
        observation = `${completed.length} task(s) completed; none are linked to a goal, so goal contribution cannot be measured yet.`;
    } else if (share < 0.5) {
        observation =
            `Most completed tasks were not goal-critical: ${criticalCompleted} of ${completed.length} completed tasks ` +
            `advanced goal-critical work (${criticalCompleted}/${critical.length} goal-critical tasks done).`;
    } else {
        observation =
            `${criticalCompleted} of ${completed.length} completed tasks advanced goal-critical work ` +
            `(${criticalCompleted}/${critical.length} goal-critical tasks done).`;
    }

    return {
        completedTasks: completed.length,
        goalCriticalCompleted: criticalCompleted,
        goalCriticalTotal: critical.length,
        goalCriticalRatio: ratio === null ? null : Math.round(ratio * 100) / 100,
        observation,
        byGoal,
    };
};
