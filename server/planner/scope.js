/**
 * Scope-creep detection - deterministic and pure.
 * Compares the work as it stands against the work as it started:
 *   original scope + added tasks - removed tasks + deadline moves.
 * Reads task creation timestamps and the TASK_DELETED / TASK_RESCHEDULED
 * event trail - no new tables, no guessing.
 *
 * tasks: normalized + createdAt ISO. events: [{ eventType, taskId, createdAt }].
 * since: ISO/string - the plan or goal start. Defaults to the earliest
 * task creation (whole-workload scope).
 */
export const analyzeScope = (tasks, events, { since = null, scopeLabel = 'workload' } = {}) => {
    const all = tasks || [];
    const created = all
        .map((t) => new Date(t.createdAt).getTime())
        .filter((n) => !Number.isNaN(n));
    const start = since ? new Date(since).getTime() : created.length ? Math.min(...created) : Date.now();
    const after = (iso) => {
        const n = new Date(iso).getTime();
        return !Number.isNaN(n) && n > start;
    };

    const original = all.filter((t) => {
        const n = new Date(t.createdAt).getTime();
        return !Number.isNaN(n) && n <= start;
    });
    const added = all.filter((t) => {
        const n = new Date(t.createdAt).getTime();
        return !Number.isNaN(n) && n > start;
    });
    const removed = (events || []).filter((e) => e?.eventType === 'TASK_DELETED' && after(e.createdAt));
    const deadlineMoves = (events || []).filter((e) => e?.eventType === 'TASK_RESCHEDULED' && after(e.createdAt));

    const growthPct =
        original.length > 0 ? Math.round(((all.length - original.length) / original.length) * 100) : null;

    let message;
    if (all.length === 0) {
        message = 'No work in scope - nothing to compare.';
    } else if (added.length === 0 && removed.length === 0) {
        message = `Scope steady at ${all.length} task${all.length === 1 ? '' : 's'} since tracking began.`;
    } else {
        const bits = [];
        if (added.length > 0) bits.push(`${added.length} added`);
        if (removed.length > 0) bits.push(`${removed.length} removed`);
        if (deadlineMoves.length > 0) bits.push(`${deadlineMoves.length} deadline move${deadlineMoves.length === 1 ? '' : 's'}`);
        message =
            `Scope moved since tracking began (${bits.join(', ')}) - ` +
            `${original.length} original vs ${all.length} current` +
            (growthPct !== null ? ` (${growthPct >= 0 ? '+' : ''}${growthPct}%).` : '.');
    }

    return {
        scope: scopeLabel,
        since: new Date(start).toISOString(),
        originalTasks: original.length,
        currentTasks: all.length,
        addedTasks: added.length,
        removedTasks: removed.length,
        deadlineMoves: deadlineMoves.length,
        growthPct,
        added: added.map((t) => ({ taskId: String(t.id ?? t._id), title: t.title })),
        message,
    };
};
