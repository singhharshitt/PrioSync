/**
 * Multi-project capacity allocation - deterministic and pure (spec section 39).
 *
 * Spreads a daily capacity across projects by what must move (deadline demand,
 * weighted by deadline risk), what advances goals (average priority), and keeps
 * continuity (completion progress never zeroes a project's claim). Output is
 * advice + numbers: nothing is applied.
 */
import { assessDeadlineRisk } from './riskEngine.js';

const DAY = 86400000;

export const allocateCapacity = (tasks = [], { capacityPerDay = 240, days = 1, now = new Date() } = {}) => {
    const horizon = new Date(now).getTime() + Math.max(1, days) * DAY;
    const at = new Date(now).getTime();
    const open = tasks.filter((t) => t.status === 'pending' || t.status === 'in-progress');

    const groups = new Map();
    for (const t of open) {
        const key = t.projectId != null ? String(t.projectId) : 'none';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(t);
    }

    const placements = [];
    for (const [projectId, ts] of groups) {
        const demandMinutes = ts.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
        const dueMinutes = ts.reduce((s, t) => {
            if (!t.deadline) return s;
            const dl = new Date(t.deadline).getTime();
            return !Number.isNaN(dl) && dl <= horizon ? s + (t.estimatedMinutes || 0) : s;
        }, 0);
        const risk = assessDeadlineRisk(ts, { now });
        const avgPriority = ts.length > 0 ? ts.reduce((s, t) => s + (t.priorityScore ?? 0), 0) / ts.length : 0;
        const completedCount = tasks.filter(
            (t) => t.projectId != null && String(t.projectId) === projectId && t.status === 'completed'
        ).length;
        const totalCount = completedCount + ts.length;
        const progress = totalCount > 0 ? completedCount / totalCount : 0;

        // Weight: deadline demand dominates (scaled by risk); flexible minutes
        // contribute by average priority; light continuity bonus for started work.
        const riskScale = 1 + (risk.riskScore ?? 0) / 100;
        const rawWeight = dueMinutes * riskScale + (demandMinutes - dueMinutes) * (avgPriority / 100) + demandMinutes * 0.05 * progress;

        placements.push({
            projectId,
            title: ts[0]?.projectTitle || ts[0]?.project || (projectId === 'none' ? 'Unassigned' : projectId),
            allocatedMinutes: 0,
            demandMinutes,
            dueMinutes,
            avgPriority: Math.round(avgPriority),
            riskLevel: risk.riskLevel,
            riskScore: risk.riskScore,
            openTasks: ts.length,
            progress: Math.round(progress * 100) / 100,
            rawWeight: Math.round(rawWeight),
            reason: null,
        });
    }

    // Largest-remainder allocation proportional to rawWeight, capped at demand.
    const totalWeight = placements.reduce((s, p) => s + p.rawWeight, 0);
    let remaining = Math.max(0, Math.round(capacityPerDay));
    if (totalWeight > 0) {
        const exact = placements.map((p) => ({
            p,
            quota: (p.rawWeight / totalWeight) * remaining,
        }));
        for (const { p, quota } of exact) {
            p.allocatedMinutes = Math.min(p.demandMinutes, Math.floor(quota));
        }
        let left = remaining - placements.reduce((s, p) => s + p.allocatedMinutes, 0);
        const remainders = exact
            .map(({ p, quota }) => ({ p, rem: quota - Math.floor(quota), capLeft: p.demandMinutes - p.allocatedMinutes }))
            .filter((x) => x.capLeft > 0)
            .sort((a, b) => b.rem - a.rem);
        for (const r of remainders) {
            if (left <= 0) break;
            const give = Math.min(r.capLeft, left);
            r.p.allocatedMinutes += give;
            left -= give;
        }
    } else {
        // No weights (no tasks): spread evenly across placements with demand.
        const withDemand = placements.filter((p) => p.demandMinutes > 0);
        const share = withDemand.length > 0 ? Math.floor(remaining / withDemand.length) : 0;
        for (const p of withDemand) p.allocatedMinutes = Math.min(p.demandMinutes, share);
    }

    const totalDemand = placements.reduce((s, p) => s + p.demandMinutes, 0);
    const totalAllocated = placements.reduce((s, p) => s + p.allocatedMinutes, 0);
    const scarce = totalDemand > remaining;
    const unallocatedMinutes = Math.max(0, remaining - totalAllocated);

    placements.sort((a, b) => b.allocatedMinutes - a.allocatedMinutes || b.rawWeight - a.rawWeight);
    const winner = placements.find((p) => p.allocatedMinutes > 0) || null;

    for (const p of placements) {
        if (p.allocatedMinutes === 0 && p.demandMinutes === 0) {
            p.reason = 'No open work in this project right now.';
        } else if (p.demandMinutes > 0 && p.allocatedMinutes >= p.demandMinutes) {
            p.reason = `Full demand fits: ${p.demandMinutes}m of work covered.`;
        } else if (scarce) {
            p.reason =
                `${p.allocatedMinutes}m of ${p.demandMinutes}m demand at risk level ${p.riskLevel} ` +
                `(${p.dueMinutes}m due within ${days}d).`;
        } else {
            p.reason = `Capacity covers ${p.allocatedMinutes}m of ${p.demandMinutes}m demand.`;
        }
    }

    const rationale = [];
    if (winner && scarce) {
        rationale.push(
            `${winner.title} receives the largest share (${winner.allocatedMinutes}m): ` +
                `${winner.dueMinutes}m due within ${days}d at risk level ${winner.riskLevel}.`
        );
    }
    if (scarce) {
        rationale.push(`Capacity ${capacityPerDay}m/day is below total demand ${totalDemand}m - consider deferring optional work.`);
    } else if (totalDemand > 0) {
        rationale.push(`Capacity ${capacityPerDay}m/day covers total demand ${totalDemand}m for the next ${days} day${days === 1 ? '' : 's'}.`);
    } else {
        rationale.push('No open tasks to allocate against.');
    }

    return {
        capacityPerDay,
        days,
        placements,
        totalDemand,
        totalAllocated,
        unallocatedMinutes,
        scarce,
        winnerProjectId: winner ? winner.projectId : null,
        rationale,
    };
};
