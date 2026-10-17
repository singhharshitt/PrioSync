/**
 * Plan Debt - deterministic and pure (spec section 37).
 *
 * Accumulated plan strain from postponed work, repeated skips, compressed
 * sessions, and unresolved dependencies. Factual only - never a guilt
 * mechanism. Describes what the plan owes back to the user's attention.
 *
 * Inputs:
 *  tasks    - normalizeTask shape (+ estimatedMinutes for recovery math)
 *  events   - [{ eventType, taskId, createdAt }] (task_events, newest last ok)
 *  sessions - [{ taskId, durationSeconds, endedAt }] (work_sessions)
 *  blockedWork - result of capacity.analyzeBlockedWork()
 */
const DAY = 86400000;
const WINDOW_DAYS = 30;
const COMPRESSED_SESSION_SECONDS = 15 * 60; // <15m sessions count as compressed
const SKIP_RECOVERY_MINUTES = 25; // documented proxy until Phase 4 session data exists
const MOVE_TYPES = new Set(['TASK_RESCHEDULED', 'DEADLINE_CHANGED']);

const fmtMinutes = (m) => {
    const total = Math.max(0, Math.round(m));
    const h = Math.floor(total / 60);
    const min = total % 60;
    if (h === 0) return `${min}m`;
    if (min === 0) return `${h}h`;
    return `${h}h ${min}m`;
};

export const computePlanDebt = ({ tasks = [], events = [], sessions = [], blockedWork = null, now = new Date() } = {}) => {
    const at = new Date(now).getTime();
    const since = at - WINDOW_DAYS * DAY;
    const taskById = new Map(tasks.map((t) => [String(t.id ?? t._id), t]));
    const inWindow = (iso) => {
        const ts = new Date(iso || 0).getTime();
        return !Number.isNaN(ts) && ts >= since && ts <= at;
    };

    // 1-2. Postponed / repeated deadline movement.
    const moveCounts = new Map(); // taskId -> { reschedules, deadlineChanges, moves }
    for (const e of events) {
        if (!MOVE_TYPES.has(e.eventType) || !inWindow(e.createdAt)) continue;
        const id = String(e.taskId ?? '');
        if (!id) continue;
        if (!moveCounts.has(id)) moveCounts.set(id, { reschedules: 0, deadlineChanges: 0 });
        const c = moveCounts.get(id);
        if (e.eventType === 'TASK_RESCHEDULED') c.reschedules += 1;
        else c.deadlineChanges += 1;
    }
    const postponed = [];
    const repeatedMoves = [];
    for (const [id, c] of moveCounts) {
        const task = taskById.get(id);
        const moves = c.reschedules + c.deadlineChanges;
        if (moves === 0) continue;
        postponed.push({ taskId: id, title: task?.title || 'Untitled task', moves, deadlineChanges: c.deadlineChanges });
        if (moves >= 2) repeatedMoves.push({ taskId: id, title: task?.title || 'Untitled task', moves });
    }

    // 3. Repeated skips.
    const skipCounts = new Map();
    for (const e of events) {
        if (e.eventType !== 'FOCUS_SKIPPED' || !inWindow(e.createdAt)) continue;
        const id = String(e.taskId ?? '');
        if (!id) continue;
        skipCounts.set(id, (skipCounts.get(id) || 0) + 1);
    }
    const skipped = [...skipCounts.entries()]
        .map(([id, count]) => ({ taskId: id, title: taskById.get(id)?.title || 'Untitled task', count }))
        .sort((a, b) => b.count - a.count);

    // 4. Compressed sessions. When a plan existed (Focus 2.0 planned_seconds),
    // compressed = finished at less than half the plan. Otherwise the legacy
    // <15m proxy from Phase 2 applies (documented until session data exists).
    const compressedTasks = new Set();
    let compressedSessions = 0;
    for (const s of sessions) {
        if (!inWindow(s.endedAt || s.startedAt)) continue;
        const actual = Number(s.durationSeconds) || 0;
        if (actual <= 0) continue;
        const planned = Number(s.plannedSeconds) || 0;
        const isCompressed = planned > 0 ? actual < planned * 0.5 : actual < COMPRESSED_SESSION_SECONDS;
        if (isCompressed) {
            compressedSessions += 1;
            if (s.taskId) compressedTasks.add(String(s.taskId));
        }
    }

    // 5. Unresolved dependencies (capacity.analyzeBlockedWork).
    const blockedCount = blockedWork?.blockedCount ?? 0;
    const blockedMinutes = blockedWork?.blockedMinutes ?? 0;

    // Recovery estimate: blocked minutes + half of repeatedly-moved open work
    // + skip proxy. Only open tasks contribute to recovery minutes.
    const isOpen = (t) => t && (t.status === 'pending' || t.status === 'in-progress');
    const movedOpenMinutes = repeatedMoves.reduce((sum, r) => {
        const t = taskById.get(r.taskId);
        return isOpen(t) ? sum + (t.estimatedMinutes || 0) / 2 : sum;
    }, 0);
    const skippedMinutes = skipped.reduce((sum, s) => sum + s.count * SKIP_RECOVERY_MINUTES, 0);
    const recoveryMinutes = Math.round(blockedMinutes + movedOpenMinutes + skippedMinutes);

    const items = [];
    if (postponed.length > 0) {
        items.push({
            kind: 'postponed',
            count: postponed.length,
            detail: `${postponed.length} task${postponed.length === 1 ? '' : 's'} moved in the last ${WINDOW_DAYS} days.`,
            why: 'Each move is legitimate; a repeated pattern usually means the estimate or capacity was optimistic.',
            tasks: postponed.slice(0, 10),
        });
    }
    if (repeatedMoves.length > 0) {
        items.push({
            kind: 'repeated_moves',
            count: repeatedMoves.length,
            detail: `${repeatedMoves.length} task${repeatedMoves.length === 1 ? '' : 's'} moved 2+ times.`,
            why: 'Tasks that keep moving tend to be the plan\'s hidden bottleneck - re-estimate or split them.',
            tasks: repeatedMoves,
        });
    }
    if (skipped.length > 0) {
        const totalSkips = skipped.reduce((s, x) => s + x.count, 0);
        items.push({
            kind: 'skips',
            count: skipped.length,
            detail: `${totalSkips} focus skip${totalSkips === 1 ? '' : 's'} across ${skipped.length} task${skipped.length === 1 ? '' : 's'}.`,
            why: 'Skipped starts usually track friction: unclear next step, wrong energy fit, or missing context.',
            tasks: skipped,
        });
    }
    if (compressedSessions > 0) {
        items.push({
            kind: 'compressed_sessions',
            count: compressedSessions,
            detail: `${compressedSessions} session${compressedSessions === 1 ? '' : 's'} under ${COMPRESSED_SESSION_SECONDS / 60} minutes.`,
            why: 'Very short sessions often mean the task was started without a usable working block.',
            tasks: [...compressedTasks].slice(0, 10).map((id) => ({ taskId: id, title: taskById.get(id)?.title || 'Untitled task' })),
        });
    }
    if (blockedCount > 0) {
        items.push({
            kind: 'unresolved_dependencies',
            count: blockedCount,
            detail: `${blockedCount} task${blockedCount === 1 ? '' : 's'} blocked (${fmtMinutes(blockedMinutes)} of gated work).`,
            why: 'Blocked work is pure plan debt: time reserved for tasks that cannot start yet.',
        });
    }

    return {
        items,
        counts: {
            postponed: postponed.length,
            repeatedMoves: repeatedMoves.length,
            skippedTasks: skipped.length,
            compressedSessions,
            blocked: blockedCount,
        },
        recoveryMinutes,
        recoveryText: fmtMinutes(recoveryMinutes),
        windowDays: WINDOW_DAYS,
        notice: 'Plan debt describes accumulated plan strain, not personal failing. Acting on the largest item is enough.',
    };
};
