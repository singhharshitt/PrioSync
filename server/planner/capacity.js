/**
 * Capacity analysis - deterministic and pure.
 *
 * Compares planned work against usable capacity over a horizon and, when
 * overloaded, produces explainable relief options as DATA (never actions):
 *   A: move low-impact tasks out
 *   B: extend the deadline
 *   C: raise daily capacity
 *   D: reduce scope (same candidates as A, framed as defer/drop)
 *
 * Input task shape: { id, title, status, estimatedMinutes, dependencies[],
 *                     priorityScore }
 */
const taskIdOf = (t) => String(t.id ?? t._id);
const isOpen = (t) => t.status === 'pending' || t.status === 'in-progress';

export const analyzeCapacity = (
    tasks,
    { capacityPerDay = 240, days = 7, calibrationFactor = 1 } = {}
) => {
    const perDay = Math.max(0, Math.round(Number(capacityPerDay) || 0));
    const horizon = Math.max(1, Math.round(Number(days) || 7));
    const open = (tasks || []).filter(isOpen);
    const adj = (t) => Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrationFactor));

    const plannedMinutes = open.reduce((s, t) => s + adj(t), 0);
    const capacityMinutes = perDay * horizon;
    const balanceMinutes = capacityMinutes - plannedMinutes;
    const overloaded = balanceMinutes < 0;
    const overloadMinutes = Math.max(0, -balanceMinutes);

    const base = {
        plannedMinutes,
        capacityMinutes,
        balanceMinutes,
        overloaded,
        overloadMinutes,
        days: horizon,
        capacityPerDay: perDay,
        taskCount: open.length,
    };
    if (!overloaded) return { ...base, options: [] };

    // Lowest engine priority first - these relieve overload with least damage.
    const byImpact = [...open].sort(
        (a, b) => (Number(a.priorityScore) || 0) - (Number(b.priorityScore) || 0)
    );
    const relief = [];
    let relieved = 0;
    for (const t of byImpact) {
        if (relieved >= overloadMinutes) break;
        const mins = adj(t);
        relief.push({ taskId: taskIdOf(t), title: t.title, estimatedMinutes: mins });
        relieved += mins;
    }

    const options = [
        {
            code: 'move_low_impact',
            label: 'OPTION A - Move low-impact tasks',
            detail:
                `Move ${relief.length} lowest-priority task${relief.length === 1 ? '' : 's'} ` +
                `(${relief.map((r) => `"${r.title}"`).join(', ')}) out of this horizon to free ` +
                `${(relieved / 60).toFixed(1)}h.`,
            taskIds: relief.map((r) => r.taskId),
            minutesRelieved: relieved,
        },
        {
            code: 'extend_deadline',
            label: 'OPTION B - Extend the deadline',
            detail:
                `At ${perDay / 60}h/day, the overload needs ` +
                `${Math.max(1, Math.ceil(overloadMinutes / Math.max(perDay, 1)))} extra day(s).`,
            extraDays: Math.max(1, Math.ceil(overloadMinutes / Math.max(perDay, 1))),
        },
        {
            code: 'raise_capacity',
            label: 'OPTION C - Raise daily capacity',
            detail:
                `Fitting ${(plannedMinutes / 60).toFixed(1)}h into ${horizon} day(s) needs ` +
                `${Math.ceil(plannedMinutes / horizon)} min/day ` +
                `(${Math.max(0, Math.ceil(plannedMinutes / horizon) - perDay)} more than now).`,
            neededPerDay: Math.ceil(plannedMinutes / horizon),
            extraPerDay: Math.max(0, Math.ceil(plannedMinutes / horizon) - perDay),
        },
        {
            code: 'reduce_scope',
            label: 'OPTION D - Reduce scope',
            detail:
                `Defer or drop ${relief.length} task${relief.length === 1 ? '' : 's'} ` +
                `(${relief.map((r) => `"${r.title}"`).join(', ')}) to remove ` +
                `${(relieved / 60).toFixed(1)}h from the plan.`,
            taskIds: relief.map((r) => r.taskId),
            minutesRelieved: relieved,
        },
    ];
    return { ...base, options };
};
