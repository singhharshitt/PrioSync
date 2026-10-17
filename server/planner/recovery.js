/**
 * Recovery Planner - deterministic and pure (spec sections 33-34).
 *
 * When disruption hits (interruption, overrun, missed session, capacity loss,
 * blocked dependency, deadline pressure) this engine builds 2-4 candidate
 * recovery plans, prices each through an isolated re-simulation, and returns
 * a CURRENT vs A vs B comparison. It NEVER applies anything: the user picks.
 *
 * Input task shape: insightService.normalizeTask.
 */
import { assessDeadlineRisk } from './riskEngine.js';
import { analyzeCapacity } from './capacity.js';
import { simulateScenario } from './scenario.js';
import { calculateCriticalPath, findBottlenecks } from './criticalPath.js';

const taskIdOf = (t) => String(t.id ?? t._id);
const isOpen = (t) => t.status === 'pending' || t.status === 'in-progress';

const detectTriggers = (tasks, { capacityPerDay, days, calibrationFactor, lostMinutes, now }) => {
    const risk = assessDeadlineRisk(tasks, { capacityPerDay, calibrationFactor, now, horizonDays: days });
    const cap = analyzeCapacity(tasks, { capacityPerDay, days, calibrationFactor });
    const blocked = risk.blockedCount;
    const triggers = [];
    if (lostMinutes > 0) triggers.push({ type: 'unexpected_interruption', text: `Unexpected interruption: ${lostMinutes} minutes lost.` });
    if (risk.overdueCount > 0) triggers.push({ type: 'missed_deadline', text: `${risk.overdueCount} task(s) already past their deadline.` });
    if (blocked > 0) triggers.push({ type: 'blocked_dependency', text: `${blocked} task(s) blocked by unfinished dependencies.` });
    if (cap.overloaded) triggers.push({ type: 'capacity_loss', text: `Capacity deficit of ${(cap.overloadMinutes / 60).toFixed(1)}h over ${days} day(s).` });
    if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
        triggers.push({ type: 'deadline_acceleration', text: `Deadline risk is ${risk.riskLevel}.` });
    }
    return { triggers, risk, cap };
};

const price = (tasks, changes, ctx) => {
    const horizon = ctx.horizonDays + (changes.addDays || 0);
    const sim = simulateScenario(tasks, changes, {
        capacityPerDay: ctx.capacityPerDay,
        calibrationFactor: ctx.calibrationFactor,
        now: ctx.now,
        horizonDays: ctx.horizonDays,
    });
    const removed = new Set((changes.removeTaskIds || []).map(String));
    const perDay = changes.capacityPerDay ?? ctx.capacityPerDay;
    const planned = tasks
        .filter(isOpen)
        .filter((t) => !removed.has(taskIdOf(t)))
        .reduce((s, t) => s + Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * ctx.calibrationFactor)), 0);
    const capacityMinutes = perDay * horizon;
    return {
        changes,
        projected: {
            riskLevel: sim.scenario.riskLevel,
            riskScore: sim.scenario.riskScore,
            riskDelta: sim.scenario.riskScore - sim.current.riskScore,
            overloaded: planned > capacityMinutes,
            slackMinutes: capacityMinutes - planned,
        },
    };
};

/**
 * @param tasks     full scope (normalized)
 * @param options   { capacityPerDay, calibrationFactor, now, horizonDays,
 *                    lostMinutes, deviations: [{type, title, message}] }
 * @returns { triggers, current, plans[], message }
 */
export const buildRecoveryPlans = (
    tasks,
    {
        capacityPerDay = 240,
        calibrationFactor = 1,
        now = new Date(),
        horizonDays = 7,
        lostMinutes = 0,
        deviations = [],
    } = {}
) => {
    const scope = tasks || [];
    const open = scope.filter(isOpen);
    const ctx = { capacityPerDay, horizonDays, calibrationFactor, now };
    if (open.length === 0) {
        return {
            triggers: [],
            current: { riskLevel: 'LOW', riskScore: 0, slackMinutes: capacityPerDay * horizonDays, overloaded: false },
            plans: [],
            message: 'No open work - nothing to recover.',
        };
    }

    const { triggers: detected, risk, cap } = detectTriggers(scope, {
        capacityPerDay,
        days: horizonDays,
        calibrationFactor,
        lostMinutes,
        now,
    });
    const triggers = [
        ...detected,
        ...deviations.map((d) => ({ type: d.type, text: d.message || `${d.title || 'Task'} deviated from plan.` })),
    ];

    const current = {
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
        slackMinutes: cap.balanceMinutes,
        overloaded: cap.overloaded,
    };

    const needed = Math.max(cap.overloadMinutes, 0) + lostMinutes;
    const cp = calculateCriticalPath(scope, { calibrationFactor });
    const cpSet = new Set(cp.path.map((p) => p.taskId));
    const { primary: bottleneck } = findBottlenecks(scope, { top: 1, calibrationFactor });
    const byImpact = [...open].sort((a, b) => (Number(a.priorityScore) || 0) - (Number(b.priorityScore) || 0));

    const candidates = [];

    // A: protect the critical path - defer the lowest-impact work OFF it.
    if (needed > 0 || cap.overloaded) {
        const deferIds = [];
        let freed = 0;
        for (const t of byImpact) {
            if (freed >= Math.max(needed, 1)) break;
            if (cpSet.has(taskIdOf(t))) continue;
            deferIds.push(taskIdOf(t));
            freed += Math.max(1, Number(t.estimatedMinutes) || 30);
        }
        if (deferIds.length > 0 && deferIds.length < open.length) {
            const titles = deferIds.slice(0, 4).map((id) => scope.find((t) => taskIdOf(t) === id)?.title || id);
            candidates.push({
                key: 'A',
                title: 'Protect the critical path',
                steps: [
                    ...(bottleneck ? [`Keep "${bottleneck.title}" moving`] : []),
                    ...titles.map((x) => `Postpone "${x}"`),
                    ...(deferIds.length > titles.length ? [`+${deferIds.length - titles.length} more low-impact task(s)`] : []),
                ],
                ...price(scope, { removeTaskIds: deferIds }, ctx),
            });
        }
    }

    // B: extend deadlines (adds runway to the horizon itself).
    if (risk.deadline || cap.overloaded) {
        const extraDays = Math.max(1, needed > 0 ? Math.ceil(needed / Math.max(capacityPerDay, 1)) : 1, risk.deadline ? Math.max(0, (risk.remainingMinutes > 0 && capacityPerDay > 0 ? Math.ceil(risk.remainingMinutes / capacityPerDay) - risk.daysLeft : 0)) : 0);
        candidates.push({
            key: 'B',
            title: 'Extend deadlines',
            steps: [`Shift in-scope deadlines out by ${extraDays} day(s)`, 'Preserve task order and dependencies'],
            ...price(scope, { addDays: extraDays }, ctx),
        });
    }

    // C: reclaim capacity (commit extra time to offset the loss).
    const deficitPerDay = Math.ceil((cap.overloadMinutes + lostMinutes) / horizonDays);
    const targetPerDay = Math.min(1440, capacityPerDay + Math.max(deficitPerDay, lostMinutes > 0 ? Math.ceil(lostMinutes / horizonDays) : 0, 60));
    if (targetPerDay > capacityPerDay) {
        candidates.push({
            key: 'C',
            title: 'Reclaim capacity',
            steps: [
                `Raise daily capacity ${capacityPerDay}m -> ${targetPerDay}m`,
                `Covers ${((targetPerDay - capacityPerDay) * horizonDays / 60).toFixed(1)}h over ${horizonDays} day(s)`,
            ],
            ...price(scope, { capacityPerDay: targetPerDay }, ctx),
        });
    }

    // D: drop optional scope (personal, non-critical work only).
    const dropIds = [];
    let dropped = 0;
    for (const t of byImpact) {
        if (dropped >= Math.max(needed, 1)) break;
        if (t.commitmentType === 'personal' && t.priorityTier !== 'critical') {
            dropIds.push(taskIdOf(t));
            dropped += Math.max(1, Number(t.estimatedMinutes) || 30);
        }
    }
    if (dropIds.length > 0 && dropIds.length < open.length) {
        candidates.push({
            key: 'D',
            title: 'Drop optional work',
            steps: dropIds.slice(0, 4).map((id) => `Drop "${scope.find((t) => taskIdOf(t) === id)?.title || id}"`),
            ...price(scope, { removeTaskIds: dropIds }, ctx),
        });
    }

    // Keep only plans that actually improve risk, resolve overload, or add slack.
    const improved = candidates.filter(
        (c) =>
            c.projected.riskScore < current.riskScore ||
            (current.overloaded && !c.projected.overloaded) ||
            c.projected.slackMinutes > current.slackMinutes
    );
    improved.sort(
        (a, b) =>
            a.projected.riskScore - b.projected.riskScore ||
            b.projected.slackMinutes - a.projected.slackMinutes ||
            a.key.localeCompare(b.key)
    );
    const plans = improved.slice(0, 3).map((p) => ({
        ...p,
        projected: {
            ...p.projected,
            slackDelta: p.projected.slackMinutes - current.slackMinutes,
        },
    }));

    return {
        triggers,
        current,
        plans,
        message:
            plans.length > 0
                ? 'Recovery plans are proposals - compare and choose; nothing changes until you accept one.'
                : 'No tested recovery improves the current trajectory - the plan stands.',
    };
};
