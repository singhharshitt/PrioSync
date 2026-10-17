/**
 * Plan Resilience / Fragility engine - deterministic and pure (spec sections 27-28).
 *
 * A plan can be FEASIBLE and still FRAGILE. Probes a baseline plan with
 * explicit perturbations, measures slack / recovery margin / delay tolerance,
 * and shows a sensitivity ladder of "what breaks first".
 *
 * Nothing here writes data or reads the clock (now is an input). All
 * perturbation work happens on in-memory clones.
 *
 * Input task shape: insightService.normalizeTask.
 */
import { assessDeadlineRisk } from './riskEngine.js';
import { analyzeCapacity } from './capacity.js';
import { calculateCriticalPath, findBottlenecks } from './criticalPath.js';

const DAY = 86400000;
const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const taskIdOf = (t) => String(t.id ?? t._id);
const depIdOf = (d) => String(d?.id ?? d?._id ?? d);
const isOpen = (t) => t.status === 'pending' || t.status === 'in-progress';
const LEVEL_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

const withMinutes = (tasks, taskId, extra) =>
    tasks.map((t) =>
        taskIdOf(t) === String(taskId) && isOpen(t)
            ? { ...t, estimatedMinutes: Math.max(1, (Number(t.estimatedMinutes) || 30) + extra) }
            : t
    );

const withUniformOverrun = (tasks, extra) =>
    tasks.map((t) => (isOpen(t) ? { ...t, estimatedMinutes: Math.max(1, (Number(t.estimatedMinutes) || 30) + extra) } : t));

const withDeadlinesShifted = (tasks, days) =>
    tasks.map((t) => {
        if (!t.deadline) return t;
        const ts = new Date(t.deadline).getTime();
        if (Number.isNaN(ts)) return t;
        return { ...t, deadline: new Date(ts + days * DAY).toISOString() };
    });

const withBlockedDownstream = (tasks, rootId) => {
    // Dependency delay: everything downstream of rootId gains an unfinished
    // synthetic prerequisite - the blast radius shows up as blocked work.
    const byId = new Map(tasks.map((t) => [taskIdOf(t), t]));
    const dependentsOf = new Map();
    for (const t of tasks) {
        for (const d of t.dependencies || []) {
            const k = depIdOf(d);
            if (!dependentsOf.has(k)) dependentsOf.set(k, []);
            dependentsOf.get(k).push(taskIdOf(t));
        }
    }
    const affected = new Set();
    const stack = [...(dependentsOf.get(String(rootId)) || [])];
    while (stack.length > 0) {
        const cur = stack.pop();
        if (affected.has(cur) || !byId.has(cur)) continue;
        affected.add(cur);
        stack.push(...(dependentsOf.get(cur) || []));
    }
    return tasks.map((t) =>
        affected.has(taskIdOf(t))
            ? { ...t, dependencies: [...(t.dependencies || []), `${taskIdOf(rootId)}-late-upstream`] }
            : t
    );
};

export const assessPlanResilience = (
    tasks,
    { capacityPerDay = 240, calibrationFactor = 1, calibrationSamples = 0, now = new Date(), horizonDays = 7 } = {}
) => {
    const opts = { capacityPerDay, calibrationFactor, calibrationSamples, now, horizonDays };
    const scope = tasks || [];
    const open = scope.filter(isOpen);
    if (open.length === 0) {
        return {
            feasibility: {
                feasible: true,
                remainingMinutes: 0,
                capacityMinutes: capacityPerDay * horizonDays,
                deficitMinutes: 0,
                requiredDays: 0,
                daysLeft: null,
                deadlineFeasible: true,
            },
            resilience: { level: 'HIGH', basis: 'No open work - nothing to break.' },
            recoveryMargin: { perTaskMinutes: 0, totalMinutes: 0 },
            delayToleranceDays: null,
            slackMinutes: capacityPerDay * horizonDays,
            bufferConsumption: 0,
            criticalPath: { totalMinutes: 0, minutesToOverload: capacityPerDay * horizonDays },
            perturbations: [],
            sensitivity: [],
            failurePoints: 0,
            largestFragility: null,
            summary: 'No open work in scope - the plan cannot break.',
        };
    }

    const base = assessDeadlineRisk(scope, opts);
    const cap = analyzeCapacity(scope, { capacityPerDay, days: horizonDays, calibrationFactor });
    const requiredDays =
        capacityPerDay > 0 ? Math.ceil(base.remainingMinutes / capacityPerDay) : base.remainingMinutes > 0 ? Infinity : 0;
    const deadlineFeasible = base.deadline ? requiredDays <= base.daysLeft : true;
    const feasible = !cap.overloaded && deadlineFeasible;

    const cp = calculateCriticalPath(scope, { calibrationFactor });
    const { primary: bottleneck } = findBottlenecks(scope, { top: 1, calibrationFactor });

    // --- Perturbation probes (each deterministic, each on a clone) ---
    const probe = (code, label, mutatedTasks, mutatedCapacity) => {
        const after = assessDeadlineRisk(mutatedTasks, { ...opts, capacityPerDay: mutatedCapacity });
        const capAfter = analyzeCapacity(mutatedTasks, {
            capacityPerDay: mutatedCapacity,
            days: horizonDays,
            calibrationFactor,
        });
        const flipped = LEVEL_RANK[after.riskLevel] > LEVEL_RANK[base.riskLevel];
        return {
            code,
            label,
            riskBefore: base.riskScore,
            riskAfter: after.riskScore,
            delta: after.riskScore - base.riskScore,
            levelBefore: base.riskLevel,
            levelAfter: after.riskLevel,
            flipped,
            capacityExceeded: capAfter.overloaded,
            note: flipped
                ? `Plan moves from ${base.riskLevel} to ${after.riskLevel} risk.`
                : after.riskScore > base.riskScore
                  ? `Risk rises by ${after.riskScore - base.riskScore} points but the level holds.`
                  : capAfter.overloaded && !cap.overloaded
                    ? 'Capacity balance goes negative.'
                    : 'Plan absorbs this with the same risk level.',
        };
    };

    const bottleneckId = bottleneck ? bottleneck.taskId : taskIdOf(open[0]);
    const lostDayCapacity = Math.max(0, capacityPerDay - Math.round(capacityPerDay / horizonDays));
    const interruptionCapacity = Math.max(0, capacityPerDay - Math.round(120 / horizonDays));

    const perturbations = [
        probe('task_overrun', 'Primary task overruns by 30m', withMinutes(scope, bottleneckId, 30), capacityPerDay),
        probe('lost_capacity', 'Usable capacity drops 20%', scope, Math.round(capacityPerDay * 0.8)),
        probe('task_delay', 'One working day is lost to delay', scope, lostDayCapacity),
        probe('deadline_acceleration', 'Deadlines arrive 2 days sooner', withDeadlinesShifted(scope, -2), capacityPerDay),
        probe('unexpected_interruption', 'Unexpected interruption eats 2h this week', scope, interruptionCapacity),
        probe('dependency_delay', 'Upstream dependency of the gatekeeper slips', withBlockedDownstream(scope, bottleneckId), capacityPerDay),
    ];

    const failurePoints = perturbations.filter((p) => p.flipped || p.capacityExceeded).length;

    // --- Recovery margin: largest uniform per-task overrun the plan absorbs
    // while keeping the baseline risk level and a non-negative balance. ---
    let marginPerTask = 0;
    for (let x = 5; x <= 300; x += 5) {
        const overrunTasks = withUniformOverrun(scope, x);
        const r = assessDeadlineRisk(overrunTasks, opts);
        const c = analyzeCapacity(overrunTasks, { capacityPerDay, days: horizonDays, calibrationFactor });
        if (LEVEL_RANK[r.riskLevel] > LEVEL_RANK[base.riskLevel] || c.overloaded) break;
        marginPerTask = x;
    }
    const recoveryMargin = { perTaskMinutes: marginPerTask, totalMinutes: marginPerTask * open.length };

    // --- Delay tolerance: days deadlines can slip before the level rises. ---
    let delayToleranceDays = null;
    if (base.deadline) {
        delayToleranceDays = 0;
        for (let d = 1; d <= 30; d++) {
            const r = assessDeadlineRisk(withDeadlinesShifted(scope, d), opts);
            if (LEVEL_RANK[r.riskLevel] > LEVEL_RANK[base.riskLevel]) break;
            delayToleranceDays = d;
        }
    }

    const slackMinutes = cap.balanceMinutes;
    const bufferConsumption = cap.capacityMinutes > 0 ? clamp01(1 - slackMinutes / cap.capacityMinutes) : 1;
    const minutesToOverload = cap.capacityMinutes - cap.plannedMinutes;
    const deficitMinutes = Math.max(cap.overloadMinutes || 0, deadlineFeasible ? 0 : (requiredDays - base.daysLeft) * capacityPerDay);

    // --- Sensitivity ladder (spec section 28): what breaks first. ---
    const sensitivity = [15, 30, 60, 90].map((x) => {
        const overrunTasks = withUniformOverrun(scope, x);
        const r = assessDeadlineRisk(overrunTasks, opts);
        const c = analyzeCapacity(overrunTasks, { capacityPerDay, days: horizonDays, calibrationFactor });
        const afterBottleneck = findBottlenecks(overrunTasks, { top: 1, calibrationFactor }).primary;
        let outcome;
        if (LEVEL_RANK[r.riskLevel] > LEVEL_RANK[base.riskLevel]) outcome = `deadline becomes ${r.riskLevel} risk`;
        else if (c.overloaded && !cap.overloaded) outcome = 'capacity exceeded';
        else if (r.riskScore >= base.riskScore + 10) outcome = 'buffer reduced';
        else if (afterBottleneck && bottleneck && afterBottleneck.taskId !== bottleneck.taskId) outcome = 'schedule shifts';
        else outcome = 'plan remains feasible';
        return { overrunMinutes: x, riskScore: r.riskScore, riskLevel: r.riskLevel, overloaded: c.overloaded, outcome };
    });

    // Resilience level: deterministic thresholds over failure points + margin.
    const level = failurePoints === 0 && marginPerTask >= 60 ? 'HIGH' : failurePoints <= 2 ? 'MEDIUM' : 'LOW';

    const worst = [...perturbations].sort(
        (a, b) => LEVEL_RANK[b.levelAfter] - LEVEL_RANK[a.levelAfter] || b.delta - a.delta
    )[0];
    const largestFragility = bottleneck
        ? {
              taskId: bottleneck.taskId,
              title: bottleneck.title,
              trigger: worst.code,
              triggerLabel: worst.label,
              text:
                  `"${bottleneck.title}" gates ${bottleneck.downstreamCount} task${bottleneck.downstreamCount === 1 ? '' : 's'} ` +
                  `(${(bottleneck.downstreamMinutes / 60).toFixed(1)}h of dependent work); ${worst.label.toLowerCase()} hits this plan first.`,
          }
        : null;

    const summary = !feasible
        ? `Plan is infeasible - ${Math.ceil(deficitMinutes / 60)}h of work has no capacity inside the window.`
        : level === 'LOW'
          ? `Plan is feasible but fragile: ${failurePoints} of ${perturbations.length} disruptions flip the risk level (margin ${marginPerTask}m per task).`
          : level === 'MEDIUM'
            ? `Plan holds under most shocks: ${failurePoints} of ${perturbations.length} disruptions escalate it (margin ${marginPerTask}m per task).`
            : `Plan is resilient: all ${perturbations.length} tested disruptions hold at ${base.riskLevel} risk (margin ${marginPerTask}m per task).`;

    return {
        feasibility: {
            feasible,
            remainingMinutes: base.remainingMinutes,
            capacityMinutes: cap.capacityMinutes,
            deficitMinutes: Math.round(deficitMinutes),
            requiredDays: Number.isFinite(requiredDays) ? requiredDays : null,
            daysLeft: base.deadline ? base.daysLeft : null,
            deadlineFeasible,
        },
        resilience: { level, failurePoints, tested: perturbations.length },
        recoveryMargin: { ...recoveryMargin, totalMinutes: Math.round(recoveryMargin.totalMinutes) },
        delayToleranceDays,
        slackMinutes: Math.round(slackMinutes),
        bufferConsumption: Math.round(bufferConsumption * 100) / 100,
        criticalPath: { totalMinutes: cp.totalMinutes, taskCount: cp.taskCount, minutesToOverload: Math.round(minutesToOverload) },
        perturbations,
        sensitivity,
        failurePoints,
        largestFragility,
        summary,
        scope: { taskCount: scope.length, openCount: open.length },
    };
};
