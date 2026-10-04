/**
 * What-if simulator - deterministic and pure.
 * Applies hypothetical changes to an in-memory COPY of the workload and
 * recomputes risk/capacity/bottlenecks. NEVER touches production data -
 * callers pass plain arrays; nothing here imports repositories or SQL.
 *
 * changes: {
 *   moveDeadlines?: { taskId, deadline }[]  - postpone/advance deadlines
 *   removeTaskIds?: string[]                - drop tasks from the scenario
 *   capacityPerDay?: number                 - "what if I only have 3h tomorrow"
 *   addDays?: number                        - extend every in-scope deadline
 * }
 */
import { assessDeadlineRisk } from './riskEngine.js';
import { findBottlenecks } from './criticalPath.js';
import { analyzeCapacity } from './capacity.js';

const DAY = 86400000;

export const applyScenarioChanges = (tasks, changes = {}) => {
    const { moveDeadlines = [], removeTaskIds = [], addDays = 0 } = changes;
    const removed = new Set((removeTaskIds || []).map(String));
    const moved = new Map((moveDeadlines || []).map((m) => [String(m.taskId), m.deadline]));
    return (tasks || [])
        .filter((t) => !removed.has(String(t.id ?? t._id)))
        .map((t) => {
            const id = String(t.id ?? t._id);
            let deadline = moved.has(id) ? moved.get(id) : t.deadline;
            if (addDays && deadline) {
                const d = new Date(deadline).getTime();
                if (!Number.isNaN(d)) deadline = new Date(d + addDays * DAY).toISOString();
            }
            const deps = (t.dependencies || [])
                .map((d) => d?.id ?? d?._id ?? d)
                .filter((d) => !removed.has(String(d)));
            return { ...t, deadline, dependencies: deps };
        });
};

export const simulateScenario = (
    tasks,
    changes = {},
    { capacityPerDay = 240, calibrationFactor = 1, calibrationSamples = 0, now = new Date(), horizonDays = 7 } = {}
) => {
    const scenarioTasks = applyScenarioChanges(tasks, changes);
    const scenarioCapacity = changes.capacityPerDay ?? capacityPerDay;
    const current = assessDeadlineRisk(tasks, { capacityPerDay, calibrationFactor, calibrationSamples, now, horizonDays });
    const scenario = assessDeadlineRisk(scenarioTasks, {
        capacityPerDay: scenarioCapacity,
        calibrationFactor,
        calibrationSamples,
        now,
        horizonDays,
    });

    // Affected = changed tasks + their downstream (union).
    const changedIds = new Set([
        ...(changes.removeTaskIds || []).map(String),
        ...(changes.moveDeadlines || []).map((m) => String(m.taskId)),
    ]);
    // Affected = changed tasks + their downstream (union), traversed on the
    // ORIGINAL graph: removals delete edges in the scenario copy, which would
    // otherwise hide the very dependents they strand.
    const dependentsOf = new Map();
    for (const t of tasks || []) {
        for (const d of t.dependencies || []) {
            const k = String(d?.id ?? d?._id ?? d);
            if (!dependentsOf.has(k)) dependentsOf.set(k, []);
            dependentsOf.get(k).push(String(t.id ?? t._id));
        }
    }
    const affected = new Set(changedIds);
    const stack = [...changedIds];
    while (stack.length > 0) {
        const cur = stack.pop();
        for (const dep of dependentsOf.get(cur) || []) {
            if (!affected.has(dep)) {
                affected.add(dep);
                stack.push(dep);
            }
        }
    }
    let affectedMinutes = 0;
    for (const t of scenarioTasks) {
        if (affected.has(String(t.id ?? t._id))) {
            affectedMinutes += Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrationFactor));
        }
    }
    // Work removed outright is freed, not affected - report it separately.
    const removedIds = new Set((changes.removeTaskIds || []).map(String));
    let freedMinutes = 0;
    for (const t of tasks || []) {
        if (removedIds.has(String(t.id ?? t._id))) {
            freedMinutes += Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrationFactor));
        }
    }

    const before = findBottlenecks(tasks, { top: 1, calibrationFactor });
    const after = findBottlenecks(scenarioTasks, { top: 1, calibrationFactor });
    const capacity = analyzeCapacity(scenarioTasks, {
        capacityPerDay: scenarioCapacity,
        days: horizonDays,
        calibrationFactor,
    });

    return {
        current: { riskLevel: current.riskLevel, riskScore: current.riskScore, summary: current.summary },
        scenario: { riskLevel: scenario.riskLevel, riskScore: scenario.riskScore, summary: scenario.summary },
        affected: {
            count: affected.size,
            minutes: affectedMinutes,
            freedMinutes,
            taskIds: [...affected],
        },
        bottleneckShift: {
            from: before.primary ? { taskId: before.primary.taskId, title: before.primary.title } : null,
            to: after.primary ? { taskId: after.primary.taskId, title: after.primary.title } : null,
        },
        mitigation: capacity.overloaded ? capacity.options[0]?.detail || null : null,
        capacity: {
            plannedMinutes: capacity.plannedMinutes,
            capacityMinutes: capacity.capacityMinutes,
            overloaded: capacity.overloaded,
        },
    };
};
