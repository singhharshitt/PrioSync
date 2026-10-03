/**
 * Critical path + bottleneck detection — deterministic and pure.
 * Reuses the tested DAG implementation (dsa-engine/dag.js); cycle-creating
 * edges are rejected by addEdge itself, so adversarial input stays safe.
 *
 * Input task shape: { id, title, status, estimatedMinutes, deadline,
 *                     dependencies[], priorityScore }
 * Only pending/in-progress tasks participate; completed work is done and
 * cannot be on anyone's critical path.
 */
import DAG from '../dsa-engine/dag.js';

const taskIdOf = (t) => String(t.id ?? t._id);
const depIdOf = (d) => String(d?.id ?? d?._id ?? d);
const durOf = (t, calibrate) => Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrate));
const isOpen = (t) => t.status === 'pending' || t.status === 'in-progress';

const buildDag = (open) => {
    const dag = new DAG();
    for (const t of open) dag.addNode(taskIdOf(t));
    for (const t of open) {
        for (const d of t.dependencies || []) {
            const dep = depIdOf(d);
            // Skip dangling edges (dep not in scope); addEdge rejects cycles.
            if (dep !== taskIdOf(t)) dag.addEdge(taskIdOf(t), dep);
        }
    }
    return dag;
};

/**
 * Longest duration path through the dependency graph (estimated minutes).
 * Path order is execution order (prerequisites first).
 */
export const calculateCriticalPath = (tasks, { calibrationFactor = 1 } = {}) => {
    const open = (tasks || []).filter(isOpen);
    if (open.length === 0) return { path: [], totalMinutes: 0, taskCount: 0 };
    const byId = new Map(open.map((t) => [taskIdOf(t), t]));
    const dag = buildDag(open);

    // DP over topological (prerequisites-first) order: longest chain ending at each node.
    const dist = new Map();
    const prev = new Map();
    for (const id of dag.topologicalSort()) {
        if (!byId.has(id)) continue;
        let best = 0;
        let bestPrev = null;
        for (const dep of dag.getDependencies(id)) {
            if (!byId.has(dep)) continue;
            const v = dist.get(dep) || 0;
            if (v > best) {
                best = v;
                bestPrev = dep;
            }
        }
        dist.set(id, best + durOf(byId.get(id), calibrationFactor));
        prev.set(id, bestPrev);
    }
    let end = null;
    let bestTotal = 0;
    for (const [id, v] of dist) {
        if (v > bestTotal) {
            bestTotal = v;
            end = id;
        }
    }
    const chain = [];
    let cur = end;
    while (cur) {
        chain.unshift(cur);
        cur = prev.get(cur);
    }
    let cumulative = 0;
    const path = chain.map((id) => {
        const t = byId.get(id);
        const mins = durOf(t, calibrationFactor);
        cumulative += mins;
        return { taskId: id, title: t.title, estimatedMinutes: mins, cumulativeMinutes: cumulative };
    });
    return { path, totalMinutes: bestTotal, taskCount: path.length };
};

/**
 * Bottlenecks: open tasks ranked by how much downstream work they gate.
 * Primary bottleneck = most downstream tasks (ties → most downstream minutes).
 */
export const findBottlenecks = (tasks, { top = 5, calibrationFactor = 1 } = {}) => {
    const open = (tasks || []).filter(isOpen);
    const openSet = new Set(open.map(taskIdOf));
    const dag = buildDag(open);
    const rows = [];
    for (const t of open) {
        const id = taskIdOf(t);
        const seen = new Set();
        const stack = [...dag.getDependents(id)];
        let downstreamMinutes = 0;
        while (stack.length > 0) {
            const cur = stack.pop();
            if (seen.has(cur)) continue;
            seen.add(cur);
            if (openSet.has(cur)) {
                const d = open.find((x) => taskIdOf(x) === cur);
                if (d) downstreamMinutes += durOf(d, calibrationFactor);
            }
            stack.push(...dag.getDependents(cur));
        }
        seen.delete(id);
        if (seen.size === 0) continue;
        rows.push({
            taskId: id,
            title: t.title,
            status: t.status,
            estimatedMinutes: durOf(t, calibrationFactor),
            downstreamCount: seen.size,
            downstreamMinutes,
            explanation:
                `"${t.title}" gates ${seen.size} downstream task${seen.size === 1 ? '' : 's'} ` +
                `(${(downstreamMinutes / 60).toFixed(1)}h of dependent work).`,
        });
    }
    rows.sort((a, b) => b.downstreamCount - a.downstreamCount || b.downstreamMinutes - a.downstreamMinutes);
    const bottlenecks = rows.slice(0, Math.max(1, top));
    return { primary: bottlenecks[0] || null, bottlenecks, totalGatingTasks: rows.length };
};

/** Work that cannot start: open tasks with at least one incomplete dependency. */
export const calculateBlockedWork = (tasks, { calibrationFactor = 1 } = {}) => {
    const completed = new Set(
        (tasks || []).filter((t) => t.status === 'completed').map(taskIdOf)
    );
    const blocked = (tasks || []).filter(
        (t) => isOpen(t) && (t.dependencies || []).some((d) => !completed.has(depIdOf(d)))
    );
    const blockedMinutes = blocked.reduce((s, t) => s + durOf(t, calibrationFactor), 0);
    return {
        blockedCount: blocked.length,
        blockedMinutes,
        tasks: blocked.map((t) => ({
            taskId: taskIdOf(t),
            title: t.title,
            estimatedMinutes: durOf(t, calibrationFactor),
            blockedBy: (t.dependencies || []).map(depIdOf).filter((d) => !completed.has(d)),
        })),
    };
};

/**
 * Delay propagation preview (Phase-3 simulate primitive): if `taskId` slips
 * by `delayMinutes`, which open downstream work is affected.
 */
export const calculateDelayPropagation = (tasks, taskId, delayMinutes, { calibrationFactor = 1 } = {}) => {
    const open = (tasks || []).filter(isOpen);
    const openSet = new Set(open.map(taskIdOf));
    const dag = buildDag(open);
    const seen = new Set();
    const stack = [...dag.getDependents(String(taskId))];
    let affectedMinutes = 0;
    while (stack.length > 0) {
        const cur = stack.pop();
        if (seen.has(cur)) continue;
        seen.add(cur);
        if (openSet.has(cur)) {
            const d = open.find((x) => taskIdOf(x) === cur);
            if (d) affectedMinutes += durOf(d, calibrationFactor);
        }
        stack.push(...dag.getDependents(cur));
    }
    const cp = calculateCriticalPath(tasks, { calibrationFactor });
    return {
        taskId: String(taskId),
        delayMinutes,
        affectedCount: seen.size,
        affectedMinutes,
        affectedTaskIds: [...seen],
        onCriticalPath: cp.path.some((p) => p.taskId === String(taskId)),
    };
};
