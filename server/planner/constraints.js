/**
 * Impossible plan / constraint resolution - deterministic and pure
 * (spec sections 31-32).
 *
 * Detects mathematically infeasible plans (capacity deficit AND/OR deadline
 * deficit), enumerates the explicit constraints in play, and generates
 * OPTION A-D alternatives - each priced through an isolated re-simulation.
 * Options are DATA: nothing here mutates tasks, deadlines, or the database.
 *
 * Input task shape: insightService.normalizeTask.
 */
import { analyzeCapacity } from './capacity.js';
import { assessDeadlineRisk } from './riskEngine.js';
import { simulateScenario } from './scenario.js';

const taskIdOf = (t) => String(t.id ?? t._id);
const depIdOf = (d) => String(d?.id ?? d?._id ?? d);
const isOpen = (t) => t.status === 'pending' || t.status === 'in-progress';

/** Explicit constraints the plan is fighting (spec section 32 - only what helps). */
export const enumerateConstraints = (tasks, { capacityPerDay = 240, days = 7 } = {}) => {
    const scope = tasks || [];
    const open = scope.filter(isOpen);
    const byId = new Map(scope.map((t) => [taskIdOf(t), t]));
    const completed = new Set(scope.filter((t) => t.status === 'completed').map(taskIdOf));

    let orderLinks = 0;
    let crossProjectLinks = 0;
    for (const t of open) {
        for (const d of t.dependencies || []) {
            const dep = depIdOf(d);
            if (completed.has(dep)) continue;
            orderLinks++;
            const depTask = byId.get(dep);
            if (depTask && t.projectId != null && depTask.projectId != null && String(t.projectId) !== String(depTask.projectId)) {
                crossProjectLinks++;
            }
        }
    }
    const withDeadline = open.filter((t) => t.deadline).length;
    const energyBound = open.filter((t) => t.energyFit && t.energyFit !== 'normal').length;
    const commitments = open.filter((t) => t.commitmentType && t.commitmentType !== 'personal').length;
    const longBlocks = open.filter((t) => (Number(t.estimatedMinutes) || 30) >= 120).length;
    const categories = new Set(open.map((t) => t.category || 'General')).size;

    const list = [
        { type: 'capacity', count: open.length, detail: `${(capacityPerDay * days) / 60}h usable over ${days} day(s) for ${open.length} open task(s)` },
        { type: 'dependency_order', count: orderLinks, detail: `${orderLinks} "must happen before" link(s) still open` },
        { type: 'deadline', count: withDeadline, detail: `${withDeadline} task(s) carry hard dates` },
        { type: 'energy', count: energyBound, detail: `${energyBound} task(s) prefer a specific energy window` },
        { type: 'commitment', count: commitments, detail: `${commitments} non-personal commitment(s) with stakeholders` },
        { type: 'continuous_time', count: longBlocks, detail: `${longBlocks} task(s) need a 2h+ unbroken block` },
        { type: 'project_dependency', count: crossProjectLinks, detail: `${crossProjectLinks} cross-project dependency link(s)` },
        { type: 'context', count: categories, detail: `${categories} context(s) in play` },
    ];
    return list.filter((c) => c.count > 0 || c.type === 'capacity');
};

/**
 * Feasibility verdict with the arithmetic exposed:
 *   remaining work vs usable capacity  -> capacity deficit
 *   required days vs days to deadline  -> deadline deficit
 */
export const detectInfeasibility = (tasks, { capacityPerDay = 240, days = 7, calibrationFactor = 1, now = new Date() } = {}) => {
    const cap = analyzeCapacity(tasks, { capacityPerDay, days, calibrationFactor });
    const risk = assessDeadlineRisk(tasks, { capacityPerDay, calibrationFactor, now, horizonDays: days });
    const requiredDays = capacityPerDay > 0 ? Math.ceil(risk.remainingMinutes / capacityPerDay) : risk.remainingMinutes > 0 ? Infinity : 0;
    const deadlineDeficitDays = risk.deadline && Number.isFinite(requiredDays) && requiredDays > risk.daysLeft
        ? requiredDays - risk.daysLeft
        : 0;
    const reasons = [];
    if (cap.overloaded) {
        reasons.push(
            `Remaining work ${(cap.plannedMinutes / 60).toFixed(1)}h vs available capacity ${(cap.capacityMinutes / 60).toFixed(1)}h - deficit ${(cap.overloadMinutes / 60).toFixed(1)}h.`
        );
    }
    if (deadlineDeficitDays > 0) {
        reasons.push(
            `Work needs ${requiredDays} day(s) at ${capacityPerDay / 60}h/day but only ${risk.daysLeft} day(s) remain before the earliest deadline.`
        );
    }
    if (capacityPerDay <= 0 && risk.remainingMinutes > 0) {
        reasons.push('Available capacity is zero while work remains.');
    }
    return {
        infeasible: reasons.length > 0,
        remainingMinutes: risk.remainingMinutes,
        capacityMinutes: cap.capacityMinutes,
        deficitMinutes: cap.overloadMinutes,
        requiredDays: Number.isFinite(requiredDays) ? requiredDays : null,
        daysLeft: risk.deadline ? risk.daysLeft : null,
        deadlineDeficitDays,
        reasons,
    };
};

const priceOption = (tasks, changes, ctx, optionHorizonDays) => {
    const horizon = optionHorizonDays ?? ctx.days;
    const sim = simulateScenario(tasks, changes, {
        capacityPerDay: ctx.capacityPerDay,
        calibrationFactor: ctx.calibrationFactor,
        now: ctx.now,
        horizonDays: horizon,
    });
    const removed = new Set((changes.removeTaskIds || []).map(String));
    const planned = tasks
        .filter(isOpen)
        .filter((t) => !removed.has(taskIdOf(t)))
        .reduce((s, t) => s + Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * ctx.calibrationFactor)), 0);
    const capMinutes = (changes.capacityPerDay ?? ctx.capacityPerDay) * horizon;
    return {
        changes,
        projected: {
            riskLevel: sim.scenario.riskLevel,
            riskScore: sim.scenario.riskScore,
            riskDelta: sim.scenario.riskScore - sim.current.riskScore,
            overloaded: planned > capMinutes,
            balanceMinutes: capMinutes - planned,
        },
    };
};

/**
 * OPTION A-D (deterministic, spec section 31). Each option carries the exact
 * synthetic changes that implement it plus its projected risk/capacity - the
 * user chooses; nothing is applied automatically.
 */
export const generateResolutionOptions = (tasks, ctx) => {
    const { capacityPerDay = 240, days = 7, calibrationFactor = 1, now = new Date() } = ctx;
    const simCtx = { capacityPerDay, days, calibrationFactor, now };
    const detection = detectInfeasibility(tasks, simCtx);
    const constraints = enumerateConstraints(tasks, { capacityPerDay, days });
    if (!detection.infeasible) {
        return { detection, constraints, options: [], message: 'Plan is feasible - no resolution needed.' };
    }

    const scope = tasks || [];
    const open = scope.filter(isOpen);
    const cap = analyzeCapacity(scope, { capacityPerDay, days, calibrationFactor });
    const risk = assessDeadlineRisk(scope, { capacityPerDay, calibrationFactor, now, horizonDays: days });
    const deficit = Math.max(cap.overloadMinutes, 0);
    const priceCtx = { capacityPerDay, days, calibrationFactor, now };
    const price = (label, summary, changes, optionHorizonDays) => ({
        label,
        summary,
        ...priceOption(scope, changes, priceCtx, optionHorizonDays),
    });

    // Relief picks: lowest engine priority first (same rule as capacity.js).
    const byImpact = [...open].sort((a, b) => (Number(a.priorityScore) || 0) - (Number(b.priorityScore) || 0));
    const reliefIds = [];
    let relieved = 0;
    for (const t of byImpact) {
        if (relieved >= Math.max(deficit, 1)) break;
        reliefIds.push(taskIdOf(t));
        relieved += Math.max(1, Number(t.estimatedMinutes) || 30);
    }
    // Scope reduction targets optional work only: personal + not critical.
    const optionalIds = [];
    let optionalMinutes = 0;
    for (const t of byImpact) {
        if (optionalIds.length > 0 && optionalMinutes >= Math.max(deficit, 1)) break;
        if (t.commitmentType === 'personal' && t.priorityTier !== 'critical' && !optionalIds.includes(taskIdOf(t))) {
            optionalIds.push(taskIdOf(t));
            optionalMinutes += Math.max(1, Number(t.estimatedMinutes) || 30);
        }
    }
    const extraDays = Math.max(1, Math.ceil(cap.overloadMinutes / Math.max(capacityPerDay, 1)), detection.deadlineDeficitDays || 0);
    const neededPerDay = Math.ceil(risk.remainingMinutes / days);

    const options = [];
    if (reliefIds.length > 0) {
        options.push({
            key: 'A',
            code: 'move_low_impact',
            ...price(
                'OPTION A - Move low-impact work',
                `Postpone ${reliefIds.length} lowest-priority task(s) out of this horizon to free ${(relieved / 60).toFixed(1)}h.`,
                { removeTaskIds: reliefIds }
            ),
        });
    }
    if (optionalIds.length > 0 && (optionalIds.join() !== reliefIds.join() || optionalIds.length < reliefIds.length)) {
        options.push({
            key: 'B',
            code: 'reduce_scope',
            ...price(
                'OPTION B - Reduce scope',
                `Remove ${optionalIds.length} optional task(s) (${(optionalMinutes / 60).toFixed(1)}h) from the plan.`,
                { removeTaskIds: optionalIds }
            ),
        });
    }
    options.push({
        key: 'C',
        code: 'extend_deadline',
        ...price(
            'OPTION C - Extend deadline',
            `Add ${extraDays} day(s) of runway: every in-scope deadline shifts out and the window grows.`,
            { addDays: extraDays },
            days + extraDays
        ),
    });
    if (neededPerDay > capacityPerDay) {
        options.push({
            key: 'D',
            code: 'raise_capacity',
            ...price(
                'OPTION D - Increase available capacity',
                `Raise daily capacity from ${capacityPerDay}m to ${neededPerDay}m (${Math.ceil(neededPerDay / 60)}h/day).`,
                { capacityPerDay: Math.min(1440, neededPerDay) }
            ),
        });
    } else if (detection.infeasible) {
        options.push({
            key: 'D',
            code: 'raise_capacity',
            ...price(
                'OPTION D - Increase available capacity',
                `Raise daily capacity from ${capacityPerDay}m to ${Math.min(1440, capacityPerDay + 60)}m to absorb the deficit.`,
                { capacityPerDay: Math.min(1440, capacityPerDay + Math.ceil(deficit / days) + 60) }
            ),
        });
    }

    return {
        detection,
        constraints,
        options,
        riskBaseline: { riskLevel: risk.riskLevel, riskScore: risk.riskScore },
        message: detection.infeasible
            ? 'Plan is mathematically infeasible - pick a resolution; nothing changes until you accept one.'
            : 'Plan is feasible.',
    };
};
