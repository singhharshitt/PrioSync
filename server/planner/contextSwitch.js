/**
 * Context-switch cost - deterministic and pure.
 *
 * Switching between unlike work has a real cost; most planners ignore it.
 * Cost scale 0-7 per transition, documented so schedules stay explainable:
 *   different category            +2
 *   different (non-null) project  +3
 *   energy distance               +0-2  (low=0, normal=1, high=2; |a-b|)
 *
 * scheduleWithContext() orders open work with Kahn's algorithm over the
 * dependency graph, picking the ready task with the best
 * (priorityScore - lambda x switchCost) at each step. Dependencies always
 * win over grouping: a task is never scheduled before its prerequisites.
 */
const ENERGY_IDX = { low: 0, normal: 1, high: 2 };

export const switchCost = (prev, next) => {
    if (!prev) return 0;
    let cost = 0;
    if ((prev.category || 'General') !== (next.category || 'General')) cost += 2;
    const pp = prev.projectId ?? null;
    const np = next.projectId ?? null;
    if (pp !== null && np !== null && pp !== np) cost += 3;
    const pe = ENERGY_IDX[prev.energyFit] ?? 1;
    const ne = ENERGY_IDX[next.energyFit] ?? 1;
    cost += Math.abs(pe - ne);
    return cost;
};

const taskIdOf = (t) => String(t.id ?? t._id);
const depIdOf = (d) => String(d?.id ?? d?._id ?? d);
const isOpen = (t) => t.status === 'pending' || t.status === 'in-progress';

export const scheduleWithContext = (tasks, { lambda = 1.5 } = {}) => {
    const open = (tasks || []).filter(isOpen);
    const openSet = new Set(open.map(taskIdOf));
    const byId = new Map(open.map((t) => [taskIdOf(t), t]));
    const remaining = new Set(openSet);
    const ordered = [];
    let prev = null;
    let totalSwitchCost = 0;

    while (remaining.size > 0) {
        let best = null;
        let bestValue = -Infinity;
        for (const id of remaining) {
            const t = byId.get(id);
            const deps = (t.dependencies || []).map(depIdOf);
            // Ready only when no prerequisite is still unplaced (completed
            // tasks and out-of-scope deps never block).
            if (deps.some((d) => openSet.has(d) && remaining.has(d))) continue;
            const value = (Number(t.priorityScore) || 0) - lambda * switchCost(prev, t);
            if (value > bestValue) {
                bestValue = value;
                best = t;
            }
        }
        if (!best) {
            // Defensive: cycle slipped through (API prevents them) - drain by priority.
            const rest = [...remaining].map((id) => byId.get(id)).sort(
                (a, b) => (Number(b.priorityScore) || 0) - (Number(a.priorityScore) || 0)
            );
            for (const t of rest) {
                const c = switchCost(prev, t);
                totalSwitchCost += c;
                ordered.push({ task: t, switchCost: c });
                prev = t;
                remaining.delete(taskIdOf(t));
            }
            break;
        }
        const c = switchCost(prev, best);
        totalSwitchCost += c;
        ordered.push({ task: best, switchCost: c });
        prev = best;
        remaining.delete(taskIdOf(best));
    }
    return { ordered, totalSwitchCost, taskCount: ordered.length };
};