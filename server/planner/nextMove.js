/**
 * Best Next Move engine - deterministic and pure (spec sections 25-26).
 *
 * Does NOT simply pick the highest priority score. Every open candidate is
 * scored on independent impact factors, feasibility-filtered (blocked work
 * and over-window tasks are excluded, never recommended), and the winner is
 * explained with explicit why-this / why-not tradeoffs.
 *
 * Inputs (plain data, no repositories, no clock reads):
 *   tasks       - full scope in insightService.normalizeTask shape (graph for CP/bottlenecks)
 *   candidates  - [{ task: presentedTask, explanation }] where explanation is
 *                 explainPriority output: { score, tier, breakdown, blocked, unlocks }
 *   options     - { budgetMinutes, energy, lastTask, capacityPerDay, riskLevel, now }
 *
 * Pipeline mirrors the architecture in spec section 40:
 *   candidates -> feasibility filter -> consequence factors -> impact -> explanation
 */
import { calculateCriticalPath } from './criticalPath.js';
import { findBottlenecks } from './criticalPath.js';
import { switchCost } from './contextSwitch.js';

const DAY = 86400000;
const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const taskIdOf = (t) => String(t.id ?? t._id);
const depIdOf = (d) => String(d?.id ?? d?._id ?? d);

// Documented weights - sum to 1, every factor traceable (spec section 25.1).
const WEIGHTS = {
    deadlineRiskReduction: 0.20,
    dependencyUnlock: 0.18,
    criticalPathImpact: 0.14,
    timeFit: 0.12,
    recoveryValue: 0.10,
    goalContribution: 0.10,
    effortEfficiency: 0.08,
    contextSwitchCost: 0.08,
};

const levelFor = (score) => (score >= 70 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW');

const daysUntil = (deadline, now) => {
    if (!deadline) return null;
    const t = new Date(deadline).getTime();
    if (Number.isNaN(t)) return null;
    return Math.ceil((t - new Date(now).getTime()) / DAY);
};

/** Deterministic order: impact desc, priority desc, shorter first, stable id. */
const compareImpact = (a, b) =>
    b.impactScore - a.impactScore ||
    (b.priorityScore ?? 0) - (a.priorityScore ?? 0) ||
    (a.estimatedMinutes ?? 30) - (b.estimatedMinutes ?? 30) ||
    String(a.taskId).localeCompare(String(b.taskId));

export const decideNextMove = (
    tasks,
    candidates,
    { budgetMinutes = null, energy = 'normal', lastTask = null, now = new Date(), calibrationFactor = 1 } = {}
) => {
    const energyBonus = { low: { low: 6, normal: 2, high: 0 }, normal: {}, high: { high: 2 } };
    const scope = tasks || [];
    const open = scope.filter((t) => t.status === 'pending' || t.status === 'in-progress');
    const remainingMinutes = open.reduce(
        (s, t) => s + Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrationFactor)),
        0
    );
    const cp = calculateCriticalPath(scope, { calibrationFactor });
    const cpSet = new Set(cp.path.map((p) => p.taskId));
    const { bottlenecks } = findBottlenecks(scope, { top: 20, calibrationFactor });
    const gateBy = new Map(bottlenecks.map((b) => [b.taskId, b]));

    // FEASIBILITY FILTER - blocked or over-window tasks are excluded up front.
    const eligible = [];
    let excludedBlocked = 0;
    let excludedTooLong = 0;
    for (const c of candidates || []) {
        const { task, explanation } = c;
        if (!explanation || explanation.blocked) {
            excludedBlocked++;
            continue;
        }
        const minutes = Math.max(1, Number(task.estimatedMinutes) || 30);
        if (budgetMinutes !== null && minutes > budgetMinutes) {
            excludedTooLong++;
            continue;
        }
        eligible.push(c);
    }

    if (eligible.length === 0) {
        return {
            bestNextMove: null,
            alternates: [],
            excluded: { blocked: excludedBlocked, tooLong: excludedTooLong },
            factors: {},
            message: 'Nothing fits right now - clear a blocker or add a shorter task.',
        };
    }

    const scored = eligible.map(({ task, explanation }) => {
        const id = taskIdOf(task);
        const minutes = Math.max(1, Number(task.estimatedMinutes) || 30);
        const bd = explanation.breakdown || {};
        const gate = gateBy.get(id);
        const days = daysUntil(task.deadline, now);
        const overdue = days !== null && days < 0;
        const dueSoon = days !== null && days <= 2;

        const deadlineFactor = clamp01((bd.deadlineContrib || 0) / 25) * (overdue ? 1 : dueSoon ? 0.9 : 0.7);
        const unlockFactor =
            0.5 * clamp01((explanation.unlocks || 0) / 3) +
            0.5 * clamp01(((gate && gate.downstreamMinutes) || 0) / Math.max(remainingMinutes, 1));
        const cpFactor = cpSet.has(id) ? 1 : gate ? 0.4 : 0.1;
        const timeFitFactor =
            budgetMinutes === null ? 0.5 : clamp01(1 - (minutes / budgetMinutes) * 0.4);
        const recoveryFactor = overdue ? 1 : dueSoon ? 0.7 : clamp01((bd.deadlineContrib || 0) / 25) * 0.5;
        const goalFactor = clamp01((bd.importanceContrib || 0) / 25) + (task.priorityTier === 'critical' ? 0.2 : 0);
        const efficiencyFactor = clamp01((explanation.score || 0) / Math.max(minutes / 60, 0.5) / 150);
        const switchFactor = clamp01(1 - switchCost(lastTask, task) / 6);
        const energyMatch = energy === task.energyFit && energy !== 'normal';

        const factors = {
            deadlineRiskReduction: clamp01(deadlineFactor),
            dependencyUnlock: clamp01(unlockFactor),
            criticalPathImpact: clamp01(cpFactor),
            timeFit: clamp01(timeFitFactor),
            recoveryValue: clamp01(recoveryFactor),
            goalContribution: clamp01(goalFactor),
            effortEfficiency: clamp01(efficiencyFactor),
            contextSwitchCost: clamp01(switchFactor),
        };
        if (energyMatch) factors.timeFit = clamp01(factors.timeFit + 0.15);
        let weighted = 0;
        for (const k of Object.keys(WEIGHTS)) weighted += WEIGHTS[k] * factors[k];
        const impactScore = Math.round(clamp01(weighted) * 100);

        return {
            task,
            taskId: id,
            title: task.title,
            estimatedMinutes: minutes,
            priorityScore: explanation.score,
            priorityTier: task.priorityTier,
            category: task.category || 'General',
            deadline: task.deadline || null,
            daysLeft: days,
            overdue,
            unlocks: explanation.unlocks || 0,
            gatedMinutes: (gate && gate.downstreamMinutes) || 0,
            onCriticalPath: cpSet.has(id),
            energyBonus: (energyBonus[energy] && energyBonus[energy][task.energyFit]) || 0,
            factors,
            impactScore,
            impactLevel: levelFor(impactScore),
        };
    });

    scored.sort(compareImpact);
    const [winner, ...rest] = scored;

    const why = [];
    if (winner.overdue || (winner.daysLeft !== null && winner.daysLeft >= 0 && winner.daysLeft <= 2)) {
        why.push({ sign: '+', text: winner.daysLeft < 0 ? `Overdue by ${Math.abs(winner.daysLeft)} day${Math.abs(winner.daysLeft) === 1 ? '' : 's'}` : `Deadline in ${winner.daysLeft} day${winner.daysLeft === 1 ? '' : 's'}` });
    }
    if (winner.unlocks > 0) {
        why.push({ sign: '+', text: `Blocks ${winner.unlocks} task${winner.unlocks === 1 ? '' : 's'} (${(winner.gatedMinutes / 60).toFixed(1)}h of gated work)` });
    }
    if (winner.onCriticalPath) {
        why.push({ sign: '+', text: `On the critical path (${cp.totalMinutes}m chain)` });
    }
    if (budgetMinutes !== null) why.push({ sign: '+', text: `Fits your ${budgetMinutes}-minute window` });
    if (energy !== 'normal' && winner.task?.energyFit === energy) {
        why.push({ sign: '+', text: `Matches ${energy} energy` });
    }
    if (winner.factors.goalContribution >= 0.6) why.push({ sign: '+', text: 'High goal importance' });
    if (winner.priorityTier === 'critical') why.push({ sign: '+', text: 'Critical priority' });
    const sw = switchCost(lastTask, winner.task);
    if (sw > 0) why.push({ sign: '-', text: `Context-switch penalty (${winner.category}${lastTask ? ` after ${lastTask.category || 'General'}` : ''})` });
    if (budgetMinutes !== null && winner.estimatedMinutes > budgetMinutes * 0.8) {
        why.push({ sign: '-', text: `Uses ${winner.estimatedMinutes}m of your ${budgetMinutes}m window` });
    }
    if (why.length === 0) why.push({ sign: '+', text: 'Best overall impact across all factors' });

    const expectedBenefit =
        `${winner.estimatedMinutes}m of ${winner.priorityTier || 'open'} work; ` +
        (winner.unlocks > 0 ? `unblocks ${winner.unlocks} task${winner.unlocks === 1 ? '' : 's'} (${(winner.gatedMinutes / 60).toFixed(1)}h), ` : '') +
        (winner.onCriticalPath ? 'keeps the critical path moving' : 'does not disturb the critical path') +
        (winner.daysLeft !== null && winner.daysLeft <= 2 ? `, meets a deadline in ${winner.daysLeft}d` : '') +
        '.';

    const alternates = rest.slice(0, 3).map((alt) => {
        const whyNot = [];
        const worstFactor = Object.keys(WEIGHTS)
            .map((k) => ({ k, deficit: winner.factors[k] - alt.factors[k] }))
            .sort((a, b) => b.deficit - a.deficit)[0];
        if (budgetMinutes !== null && alt.estimatedMinutes > budgetMinutes * 0.8) {
            whyNot.push(`Needs ${alt.estimatedMinutes}m against your ${budgetMinutes}m window`);
        }
        if (worstFactor && worstFactor.deficit >= 0.3) {
            if (worstFactor.k === 'dependencyUnlock') whyNot.push(`Gates no work while "${winner.title}" gates ${winner.unlocks || 1}`);
            else if (worstFactor.k === 'criticalPathImpact' && !alt.onCriticalPath) whyNot.push('Not on the critical path');
            else if (worstFactor.k === 'deadlineRiskReduction') whyNot.push(alt.daysLeft === null ? 'No deadline pressure' : alt.daysLeft < 0 ? 'Already overdue, lower engine priority' : `Deadline is ${alt.daysLeft}d out`);
            else if (worstFactor.k === 'contextSwitchCost') whyNot.push('Costlier context switch');
            else whyNot.push(`Lower ${worstFactor.k} than "${winner.title}"`);
        }
        if (whyNot.length === 0) whyNot.push(`Lower overall impact than "${winner.title}"`);
        return {
            taskId: alt.taskId,
            title: alt.title,
            estimatedMinutes: alt.estimatedMinutes,
            priorityScore: alt.priorityScore,
            impactScore: alt.impactScore,
            impactLevel: alt.impactLevel,
            whyNot,
        };
    });

    return {
        bestNextMove: {
            taskId: winner.taskId,
            title: winner.title,
            estimatedMinutes: winner.estimatedMinutes,
            priorityScore: winner.priorityScore,
            priorityTier: winner.priorityTier,
            deadline: winner.deadline,
            impactScore: winner.impactScore,
            impactLevel: winner.impactLevel,
            energyBonus: winner.energyBonus,
            expectedBenefit,
            why,
            factors: winner.factors,
        },
        alternates,
        excluded: { blocked: excludedBlocked, tooLong: excludedTooLong },
        factors: WEIGHTS,
    };
};
