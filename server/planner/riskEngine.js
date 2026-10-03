/**
 * Deadline Risk Engine - deterministic and pure.
 *
 * Estimates whether in-scope workload can realistically finish before its
 * deadline. NOT a prediction: a transparent arithmetic model over
 * remaining effort, usable capacity, blocked work, overdue items, and
 * downstream concentration. Every point of the score is attributable to a
 * named factor, and the summary sentence is generated from those factors.
 *
 * Input task shape (see insightService.normalizeTask):
 *   { id, title, status, estimatedMinutes, deadline, dependencies[], priorityScore }
 *
 * Risk model (documented so the number is never magic):
 *   loadPoints   0-55 from remaining/capacity ratio:
 *                  ratio ≤ 0.7 → ratio/0.7 × 25
 *                  ratio ≤ 1.0 → 25 + (ratio−0.7)/0.3 × 30
 *                  ratio > 1.0 → 55 + min(ratio−1, 1.5)/1.5 × 30
 *   blockedPoints  0-10 × (blocked minutes ÷ remaining minutes)
 *   overduePoints  3 per overdue task, capped at 12
 *   focusPoints    0-8 when one task's downstream holds > 40% of remaining work
 *   score = min(100, sum). Levels: <30 LOW, <55 MEDIUM, <75 HIGH, else CRITICAL.
 *   No in-scope deadline → assessed against a 7-day horizon, level capped at MEDIUM.
 */
const DAY = 86400000;

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const levelFor = (score) => {
    if (score < 30) return 'LOW';
    if (score < 55) return 'MEDIUM';
    if (score < 75) return 'HIGH';
    return 'CRITICAL';
};

const depIdOf = (d) => String(d?.id ?? d?._id ?? d);
const taskIdOf = (t) => String(t.id ?? t._id);

/** Downstream (dependent) ids of a task, BFS over the depends-on edges. Pure. */
const downstreamIds = (tasks, rootId) => {
    const byId = new Map(tasks.map((t) => [taskIdOf(t), t]));
    const dependentsOf = new Map();
    for (const t of tasks) {
        for (const dep of t.dependencies || []) {
            const k = depIdOf(dep);
            if (!dependentsOf.has(k)) dependentsOf.set(k, []);
            dependentsOf.get(k).push(taskIdOf(t));
        }
    }
    const seen = new Set();
    const stack = [...(dependentsOf.get(String(rootId)) || [])];
    while (stack.length > 0) {
        const cur = stack.pop();
        if (seen.has(cur) || !byId.has(cur)) continue;
        seen.add(cur);
        stack.push(...(dependentsOf.get(cur) || []));
    }
    return seen;
};

export const assessDeadlineRisk = (
    tasks,
    { capacityPerDay = 240, calibrationFactor = 1, calibrationSamples = 0, now = new Date(), horizonDays = 7 } = {}
) => {
    const at = new Date(now).getTime();
    const open = (tasks || []).filter((t) => t.status === 'pending' || t.status === 'in-progress');
    const completedIds = new Set(
        (tasks || []).filter((t) => t.status === 'completed').map(taskIdOf)
    );
    const adj = (t) => Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrationFactor));
    const isBlocked = (t) => (t.dependencies || []).some((d) => !completedIds.has(depIdOf(d)));

    const remainingMinutes = open.reduce((s, t) => s + adj(t), 0);
    const withDeadline = open
        .map((t) => ({ t, due: t.deadline ? new Date(t.deadline).getTime() : NaN }))
        .filter((x) => !Number.isNaN(x.due));
    const scopeDeadline = withDeadline.length > 0 ? new Date(Math.min(...withDeadline.map((x) => x.due))) : null;
    // Whole calendar days left (deadline later today still leaves today's capacity).
    const daysLeft = scopeDeadline
        ? Math.max(0, Math.ceil((scopeDeadline.getTime() - at) / DAY))
        : horizonDays;
    const capacityMinutes = Math.max(0, Math.round(Number(capacityPerDay) || 0)) * Math.max(daysLeft, scopeDeadline ? 1 : horizonDays);

    const blocked = open.filter(isBlocked);
    const blockedMinutes = blocked.reduce((s, t) => s + adj(t), 0);
    const overdue = open.filter((t) => t.deadline && new Date(t.deadline).getTime() < at);
    const overdueMinutes = overdue.reduce((s, t) => s + adj(t), 0);

    const ratio = capacityMinutes > 0 ? remainingMinutes / capacityMinutes : remainingMinutes > 0 ? Infinity : 0;
    let loadPoints = 0;
    if (ratio > 0 && Number.isFinite(ratio)) {
        if (ratio <= 0.7) loadPoints = (ratio / 0.7) * 25;
        else if (ratio <= 1.0) loadPoints = 25 + ((ratio - 0.7) / 0.3) * 30;
        else loadPoints = 55 + (Math.min(ratio - 1, 1.5) / 1.5) * 30;
    } else if (ratio === Infinity) {
        loadPoints = 85;
    }
    loadPoints = Math.round(loadPoints);
    const blockedPoints = remainingMinutes > 0 ? Math.round((blockedMinutes / remainingMinutes) * 10) : 0;
    const overduePoints = Math.min(overdue.length * 3, 12);

    // Concentration: the task holding the most downstream work.
    let focusPoints = 0;
    let focusTask = null;
    if (remainingMinutes > 0) {
        for (const t of open) {
            const ids = downstreamIds(open, taskIdOf(t));
            let mins = 0;
            for (const id of ids) {
                const d = open.find((x) => taskIdOf(x) === id);
                if (d) mins += adj(d);
            }
            const share = mins / remainingMinutes;
            if (share > 0.4 && share * 20 > focusPoints) {
                focusPoints = Math.round(share * 20);
                focusTask = { taskId: taskIdOf(t), title: t.title, downstreamMinutes: mins };
            }
        }
        focusPoints = Math.min(focusPoints, 8);
    }

    const factors = [];
    const push = (code, severity, points, message, extra = {}) =>
        factors.push({ code, severity, points, message, ...extra });

    if (open.length === 0) {
        return {
            riskLevel: 'LOW',
            riskScore: 0,
            summary: 'No open work in scope - nothing at risk.',
            factors: [{ code: 'empty', severity: 'info', points: 0, message: 'No pending or in-progress tasks in scope.' }],
            remainingMinutes: 0,
            capacityMinutes,
            daysLeft,
            deadline: scopeDeadline ? scopeDeadline.toISOString() : null,
            blockedMinutes: 0,
            blockedCount: 0,
            overdueCount: 0,
            calibration: { factor: calibrationFactor, samples: calibrationSamples, calibrated: calibrationSamples >= 3 },
        };
    }

    push(
        'load',
        loadPoints >= 55 ? 'critical' : loadPoints >= 25 ? 'warning' : 'info',
        loadPoints,
        `${(remainingMinutes / 60).toFixed(1)}h of estimated work remains against ${(capacityMinutes / 60).toFixed(1)}h of usable capacity` +
            (scopeDeadline ? ` before ${scopeDeadline.toISOString().slice(0, 10)}` : ` over the next ${horizonDays} days`) +
            ` (load ${(ratio === Infinity ? '∞' : ratio.toFixed(2))}×).`,
        { remainingMinutes, capacityMinutes, loadRatio: ratio === Infinity ? null : Math.round(ratio * 100) / 100 }
    );
    if (blocked.length > 0) {
        push(
            'blocked',
            blockedPoints >= 6 ? 'critical' : 'warning',
            blockedPoints,
            `${blocked.length} task${blocked.length === 1 ? ' is' : 's are'} blocked by unfinished dependencies ` +
                `(${(blockedMinutes / 60).toFixed(1)}h cannot start yet).`
        );
    }
    if (overdue.length > 0) {
        push(
            'overdue',
            'critical',
            overduePoints,
            `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'} (${(overdueMinutes / 60).toFixed(1)}h past deadline).`,
            { taskIds: overdue.map(taskIdOf) }
        );
    }
    if (focusTask) {
        push(
            'concentration',
            'warning',
            focusPoints,
            `"${focusTask.title}" holds ${(focusTask.downstreamMinutes / 60).toFixed(1)}h of downstream work - a single stall propagates widely.`,
            { taskId: focusTask.taskId }
        );
    }
    if (calibrationSamples < 3) {
        push(
            'uncalibrated',
            'info',
            0,
            `Estimates are uncalibrated (only ${calibrationSamples} timed session${calibrationSamples === 1 ? '' : 's'} on completed work) - durations are taken at face value.`
        );
    } else if (calibrationFactor !== 1) {
        push(
            'calibration',
            'info',
            0,
            `Durations adjusted ×${calibrationFactor} from ${calibrationSamples} timed sessions on completed work.`
        );
    }
    if (!scopeDeadline) {
        push('no_deadline', 'info', 0, 'No deadlines in scope - assessed against a 7-day capacity horizon.');
    }

    let riskScore = Math.min(
        100,
        loadPoints + blockedPoints + overduePoints + focusPoints
    );
    let riskLevel = levelFor(riskScore);
    if (!scopeDeadline && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL')) {
        riskLevel = 'MEDIUM'; // No deadline pressure: cap the alarm.
        riskScore = Math.min(riskScore, 54);
    }

    const top = [...factors].sort((a, b) => b.points - a.points).filter((f) => f.points > 0).slice(0, 2);
    const summary =
        riskLevel === 'LOW'
            ? `On track: ${factors[0].message}`
            : `Deadline risk is ${riskLevel.toLowerCase()} because ${top.map((f) => f.message.charAt(0).toLowerCase() + f.message.slice(1)).join(' ')}`;

    return {
        riskLevel,
        riskScore,
        summary,
        factors: factors.sort((a, b) => b.points - a.points),
        remainingMinutes,
        capacityMinutes,
        daysLeft,
        deadline: scopeDeadline ? scopeDeadline.toISOString() : null,
        blockedMinutes,
        blockedCount: blocked.length,
        overdueCount: overdue.length,
        calibration: { factor: calibrationFactor, samples: calibrationSamples, calibrated: calibrationSamples >= 3 },
    };
};
