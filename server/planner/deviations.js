/**
 * Execution deviation detection - deterministic and pure.
 * Compares planned vs actual: overruns (timed work far above estimate),
 * missed deadlines, and near-term blocked work. Returns evidence objects
 * the auto-replanner consumes as triggers - never acts by itself.
 *
 * tasks: normalized [{ id, title, status, estimatedMinutes, deadline,
 *          dependencies[], priorityScore }]
 * sessions: [{ taskId, durationSeconds, endedAt }]
 */
const DAY = 86400000;
const OVERRUN_RATIO = 1.5; // actual >= 150% of estimate counts as an overrun
const OVERRUN_MIN_EXCESS = 15; // ...with at least 15 min excess (ignore noise)

const taskIdOf = (t) => String(t.id ?? t._id);

export const detectDeviations = (tasks, sessions, { now = new Date() } = {}) => {
    const at = new Date(now).getTime();
    const open = (tasks || []).filter((t) => t.status === 'pending' || t.status === 'in-progress');
    const completedIds = new Set((tasks || []).filter((t) => t.status === 'completed').map(taskIdOf));
    const byId = new Map((tasks || []).map((t) => [taskIdOf(t), t]));

    const secsByTask = new Map();
    for (const s of sessions || []) {
        if (!s?.taskId) continue;
        const k = String(s.taskId);
        secsByTask.set(k, (secsByTask.get(k) || 0) + (Number(s.durationSeconds) || 0));
    }

    const out = [];

    // TASK_OVERRUN - completed or open tasks whose timed work dwarfs the estimate.
    for (const t of tasks || []) {
        const secs = secsByTask.get(taskIdOf(t)) || 0;
        if (secs <= 0) continue;
        const estMin = Math.max(1, Number(t.estimatedMinutes) || 30);
        const actualMin = secs / 60;
        if (actualMin >= estMin * OVERRUN_RATIO && actualMin - estMin >= OVERRUN_MIN_EXCESS) {
            const pct = Math.round(((actualMin - estMin) / estMin) * 100);
            out.push({
                type: 'TASK_OVERRUN',
                severity: pct >= 100 ? 'high' : 'medium',
                taskId: taskIdOf(t),
                title: t.title,
                estimatedMinutes: estMin,
                actualMinutes: Math.round(actualMin),
                overPercent: pct,
                message: `"${t.title}" took ${Math.round(actualMin)}m vs ${estMin}m estimated (+${pct}%).`,
            });
        }
    }

    // MISSED_DEADLINE - open work past its deadline.
    for (const t of open) {
        if (!t.deadline) continue;
        const due = new Date(t.deadline).getTime();
        if (Number.isNaN(due) || due >= at) continue;
        const daysOver = Math.max(1, Math.ceil((at - due) / DAY));
        out.push({
            type: 'MISSED_DEADLINE',
            severity: daysOver >= 3 ? 'high' : 'medium',
            taskId: taskIdOf(t),
            title: t.title,
            daysOverdue: daysOver,
            message: `"${t.title}" is ${daysOver} day${daysOver === 1 ? '' : 's'} overdue.`,
        });
    }

    // BLOCKED_AT_RISK - open, blocked, and due within 48h: the stall that will hurt.
    for (const t of open) {
        const blockedBy = (t.dependencies || [])
            .map((d) => String(d?.id ?? d?._id ?? d))
            .filter((d) => !completedIds.has(d));
        if (blockedBy.length === 0 || !t.deadline) continue;
        const due = new Date(t.deadline).getTime();
        if (Number.isNaN(due) || due - at > 2 * DAY || due < at) continue;
        const blockers = blockedBy.map((id) => byId.get(id)?.title || id.slice(0, 8));
        out.push({
            type: 'BLOCKED_AT_RISK',
            severity: 'medium',
            taskId: taskIdOf(t),
            title: t.title,
            blockedBy,
            message: `"${t.title}" is due within 48h but waits on ${blockers.map((b) => `"${b}"`).join(', ')}.`,
        });
    }

    const rank = { high: 0, medium: 1 };
    return out.sort(
        (a, b) => rank[a.severity] - rank[b.severity] || a.type.localeCompare(b.type)
    );
};
