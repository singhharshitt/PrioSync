/**
 * What-if simulator - deterministic and pure.
 * Applies hypothetical changes to an in-memory COPY of the workload and
 * recomputes risk/capacity/bottlenecks/priority. NEVER touches production
 * data - callers pass plain arrays; nothing here imports repositories or SQL.
 *
 * changes: {
 *   moveDeadlines?: { taskId, deadline }[]  - postpone/advance deadlines
 *   removeTaskIds?: string[]                - drop tasks from the scenario
 *   capacityPerDay?: number                 - "what if I only have 3h tomorrow"
 *   addDays?: number                        - shift every in-scope deadline
 *   delayTasks?: { taskId, days }[]         - relative deadline delay
 *   addTasks?: { id?, title, estimatedMinutes, deadline?, dependencies? }[]
 *   addDependencies?: { taskId, dependsOn }[]
 *   removeDependencies?: { taskId, dependsOn }[]
 *   changeDurations?: { taskId, estimatedMinutes }[]
 *   changeImportance?: { taskId, importance }[]  - re-scores via priority engine
 *   changePriority?: { taskId, priorityScore }[] - direct score override
 *   moveProject?: { projectId, days }       - shift a whole project's deadlines
 *   loseEvening?: boolean                   - lose 120m/day of capacity
 *   loseMinutes?: number                    - lose N minutes across the horizon
 * }
 */
import { assessDeadlineRisk } from './riskEngine.js';
import { findBottlenecks } from './criticalPath.js';
import { analyzeCapacity } from './capacity.js';
import { calculatePriorityScore } from '../dsa-engine/priorityEngine.js';

const DAY = 86400000;
const taskIdOf = (t) => String(t.id ?? t._id);
const depIdOf = (d) => String(d?.id ?? d?._id ?? d);

export const applyScenarioChanges = (tasks, changes = {}) => {
    const {
        moveDeadlines = [],
        removeTaskIds = [],
        addDays = 0,
        delayTasks = [],
        addTasks = [],
        addDependencies = [],
        removeDependencies = [],
        changeDurations = [],
        changeImportance = [],
        changePriority = [],
        moveProject = null,
    } = changes;
    const removed = new Set(removeTaskIds.map(String));
    const moved = new Map(moveDeadlines.map((m) => [String(m.taskId), m.deadline]));
    const delayed = new Map(delayTasks.map((m) => [String(m.taskId), m.days]));
    const durations = new Map(changeDurations.map((m) => [String(m.taskId), m.estimatedMinutes]));
    const importanceOf = new Map(changeImportance.map((m) => [String(m.taskId), m.importance]));
    const priorityOf = new Map(changePriority.map((m) => [String(m.taskId), m.priorityScore]));
    const depAdd = new Map();
    for (const op of addDependencies) {
        const k = String(op.taskId);
        if (!depAdd.has(k)) depAdd.set(k, new Set());
        depAdd.get(k).add(String(op.dependsOn));
    }
    const depRemove = new Map();
    for (const op of removeDependencies) {
        const k = String(op.taskId);
        if (!depRemove.has(k)) depRemove.set(k, new Set());
        depRemove.get(k).add(String(op.dependsOn));
    }

    const base = (tasks || [])
        .filter((t) => !removed.has(taskIdOf(t)))
        .map((t) => {
            const id = taskIdOf(t);
            let deadline = moved.has(id) ? moved.get(id) : t.deadline;
            const shift = (addDays || 0) + (delayed.get(id) || 0);
            if (deadline && shift) {
                const d = new Date(deadline).getTime();
                if (!Number.isNaN(d)) deadline = new Date(d + shift * DAY).toISOString();
            }
            if (moveProject && t.projectId != null && String(t.projectId) === String(moveProject.projectId) && deadline) {
                const d = new Date(deadline).getTime();
                if (!Number.isNaN(d)) deadline = new Date(d + moveProject.days * DAY).toISOString();
            }
            const estimatedMinutes = durations.has(id) ? durations.get(id) : t.estimatedMinutes;
            const importance = importanceOf.has(id) ? importanceOf.get(id) : t.importance;
            const deps = (t.dependencies || [])
                .map(depIdOf)
                .filter((d) => !removed.has(d))
                .filter((d) => !(depRemove.get(id) && depRemove.get(id).has(d)));
            if (depAdd.has(id)) {
                for (const extra of depAdd.get(id)) if (!removed.has(extra) && !deps.includes(extra)) deps.push(extra);
            }
            return { ...t, deadline, estimatedMinutes, importance, dependencies: deps };
        });

    // Synthetic additions get `sim-<n>` ids so they can never collide with rows.
    const completedIds = new Set(base.filter((t) => t.status === 'completed').map(taskIdOf));
    const added = addTasks.map((t, i) => {
        const id = t.id ? String(t.id) : `sim-${i}`;
        const task = {
            ...t,
            id,
            status: 'pending',
            dependencies: (t.dependencies || []).map(depIdOf).filter((d) => !removed.has(d)),
        };
        const scored = calculatePriorityScore(task, {
            hasBlockedDependencies: task.dependencies.some((d) => !completedIds.has(d)),
        });
        return {
            ...task,
            priorityScore: priorityOf.has(id) ? priorityOf.get(id) : scored.score,
            priorityTier: scored.tier,
            category: task.category || 'General',
        };
    });

    // Re-score tasks whose importance or priority input changed.
    const rescored = base.map((t) => {
        const id = taskIdOf(t);
        if (priorityOf.has(id)) {
            return { ...t, priorityScore: priorityOf.get(id) };
        }
        if (importanceOf.has(id)) {
            const scored = calculatePriorityScore(t, {
                hasBlockedDependencies: (t.dependencies || []).some((d) => !completedIds.has(d)),
            });
            return { ...t, priorityScore: scored.score, priorityTier: scored.tier };
        }
        return t;
    });

    return [...rescored, ...added];
};

export const simulateScenario = (
    tasks,
    changes = {},
    { capacityPerDay = 240, calibrationFactor = 1, calibrationSamples = 0, now = new Date(), horizonDays = 7 } = {}
) => {
    const scenarioTasks = applyScenarioChanges(tasks, changes);
    const {
        removeTaskIds = [],
        moveDeadlines = [],
        delayTasks = [],
        changeDurations = [],
        changeImportance = [],
        changePriority = [],
        addDependencies = [],
        removeDependencies = [],
        moveProject = null,
    } = changes;
    // Scenario capacity: explicit override wins, then lose-evening / lose-minutes.
    let scenarioCapacity = changes.capacityPerDay ?? capacityPerDay;
    if (changes.capacityPerDay === undefined) {
        if (changes.loseEvening) scenarioCapacity = Math.max(0, capacityPerDay - 120);
        else if (changes.loseMinutes) scenarioCapacity = Math.max(0, capacityPerDay - Math.round(changes.loseMinutes / horizonDays));
    }
    const current = assessDeadlineRisk(tasks, { capacityPerDay, calibrationFactor, calibrationSamples, now, horizonDays });
    const scenario = assessDeadlineRisk(scenarioTasks, {
        capacityPerDay: scenarioCapacity,
        calibrationFactor,
        calibrationSamples,
        now,
        horizonDays,
    });

    // Affected = changed tasks + their downstream (union), traversed on the
    // ORIGINAL graph: removals delete edges in the scenario copy, which would
    // otherwise hide the very dependents they strand.
    const changedIds = new Set([
        ...removeTaskIds.map(String),
        ...moveDeadlines.map((m) => String(m.taskId)),
        ...delayTasks.map((m) => String(m.taskId)),
        ...changeDurations.map((m) => String(m.taskId)),
        ...changeImportance.map((m) => String(m.taskId)),
        ...changePriority.map((m) => String(m.taskId)),
        ...addDependencies.map((m) => String(m.taskId)),
        ...removeDependencies.map((m) => String(m.taskId)),
    ]);
    if (moveProject) {
        for (const t of tasks || []) {
            if (t.projectId != null && String(t.projectId) === String(moveProject.projectId)) {
                changedIds.add(taskIdOf(t));
            }
        }
    }
    const byId = new Map((tasks || []).map((t) => [taskIdOf(t), t]));
    const dependentsOf = new Map();
    for (const t of tasks || []) {
        for (const d of t.dependencies || []) {
            const k = depIdOf(d);
            if (!dependentsOf.has(k)) dependentsOf.set(k, []);
            dependentsOf.get(k).push(taskIdOf(t));
        }
    }
    const depth = new Map([...changedIds].map((id) => [id, 0]));
    const stack = [...changedIds];
    while (stack.length > 0) {
        const cur = stack.pop();
        const d = depth.get(cur) || 0;
        for (const dep of dependentsOf.get(cur) || []) {
            if (!depth.has(dep)) {
                depth.set(dep, d + 1);
                stack.push(dep);
            }
        }
    }
    const affected = new Set(depth.keys());
    let affectedMinutes = 0;
    for (const t of scenarioTasks) {
        if (affected.has(taskIdOf(t))) {
            affectedMinutes += Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrationFactor));
        }
    }
    // Work removed outright is freed, not affected - report it separately.
    const removedIds = new Set(removeTaskIds.map(String));
    let freedMinutes = 0;
    for (const t of tasks || []) {
        if (removedIds.has(taskIdOf(t))) {
            freedMinutes += Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrationFactor));
        }
    }
    const addedTasks = scenarioTasks.filter((t) => String(t.id).startsWith('sim-'));
    const addedMinutes = addedTasks.reduce((s, t) => s + Math.max(1, Number(t.estimatedMinutes) || 30), 0);

    const before = findBottlenecks(tasks, { top: 1, calibrationFactor });
    const after = findBottlenecks(scenarioTasks, { top: 1, calibrationFactor });
    const capacity = analyzeCapacity(scenarioTasks, {
        capacityPerDay: scenarioCapacity,
        days: horizonDays,
        calibrationFactor,
    });
    const currentCapacity = analyzeCapacity(tasks, { capacityPerDay, days: horizonDays, calibrationFactor });

    // --- Causal explanation (spec section 30): propagation as data. ---
    const direct = [];
    const titleOf = (id) => byId.get(id)?.title || addedTasks.find((t) => t.id === id)?.title || id;
    for (const m of moveDeadlines) direct.push({ taskId: String(m.taskId), title: titleOf(String(m.taskId)), effect: `deadline moved to ${String(m.deadline).slice(0, 10)}` });
    for (const m of delayTasks) direct.push({ taskId: String(m.taskId), title: titleOf(String(m.taskId)), effect: `delayed ${m.days} day${Math.abs(m.days) === 1 ? '' : 's'}` });
    for (const m of changeDurations) direct.push({ taskId: String(m.taskId), title: titleOf(String(m.taskId)), effect: `duration set to ${m.estimatedMinutes}m` });
    for (const m of changeImportance) direct.push({ taskId: String(m.taskId), title: titleOf(String(m.taskId)), effect: `importance set to ${m.importance}` });
    for (const m of changePriority) direct.push({ taskId: String(m.taskId), title: titleOf(String(m.taskId)), effect: `priority set to ${m.priorityScore}` });
    for (const id of removeTaskIds) direct.push({ taskId: String(id), title: titleOf(String(id)), effect: 'removed from scope' });
    for (const m of addDependencies) direct.push({ taskId: String(m.taskId), title: titleOf(String(m.taskId)), effect: `now depends on ${titleOf(String(m.dependsOn))}` });
    for (const m of removeDependencies) direct.push({ taskId: String(m.taskId), title: titleOf(String(m.taskId)), effect: `dependency on ${titleOf(String(m.dependsOn))} removed` });
    if (moveProject) {
        for (const t of tasks || []) {
            if (t.projectId != null && String(t.projectId) === String(moveProject.projectId)) {
                direct.push({ taskId: taskIdOf(t), title: t.title, effect: `project deadline shifted ${moveProject.days}d` });
            }
        }
    }

    const layers = [];
    const maxDepth = depth.size > 0 ? Math.max(...depth.values()) : 0;
    for (let d = 0; d <= Math.min(maxDepth, 6); d++) {
        const ids = [...depth.entries()].filter(([, v]) => v === d).map(([k]) => k);
        if (ids.length > 0) layers.push({ depth: d, tasks: ids.map((id) => ({ taskId: id, title: titleOf(id) })) });
    }

    const flow = [];
    for (const d of direct.slice(0, 3)) flow.push(`${d.title}: ${d.effect}`);
    const downstream = layers.filter((l) => l.depth > 0).reduce((s, l) => s + l.tasks.length, 0);
    if (downstream > 0) flow.push(`${downstream} downstream task${downstream === 1 ? '' : 's'} affected`);
    if (addedTasks.length > 0) flow.push(`${addedTasks.length} task${addedTasks.length === 1 ? '' : 's'} added (+${addedMinutes}m)`);
    const capacityDelta = (scenarioCapacity - capacityPerDay) * horizonDays;
    if (capacityDelta !== 0) flow.push(`Usable capacity ${capacityPerDay}m/day -> ${scenarioCapacity}m/day (${capacityDelta > 0 ? '+' : ''}${Math.round(capacityDelta)}m over ${horizonDays}d)`);
    if (capacity.overloaded && !currentCapacity.overloaded) flow.push('Buffer consumed: capacity balance goes negative');
    flow.push(`Deadline risk ${current.riskScore} -> ${scenario.riskScore}${current.riskLevel !== scenario.riskLevel ? ` (${current.riskLevel} -> ${scenario.riskLevel})` : ''}`);

    const propagation = {
        direct,
        layers,
        downstreamCount: downstream,
        affectedMinutes,
        capacity: {
            perDayBefore: capacityPerDay,
            perDayAfter: scenarioCapacity,
            plannedBefore: currentCapacity.plannedMinutes,
            plannedAfter: capacity.plannedMinutes,
            overloadedBefore: currentCapacity.overloaded,
            overloadedAfter: capacity.overloaded,
        },
        riskChange: {
            before: current.riskScore,
            after: scenario.riskScore,
            levelBefore: current.riskLevel,
            levelAfter: scenario.riskLevel,
        },
        mitigation: capacity.overloaded ? capacity.options[0]?.detail || null : null,
        flow,
    };

    return {
        current: { riskLevel: current.riskLevel, riskScore: current.riskScore, summary: current.summary },
        scenario: { riskLevel: scenario.riskLevel, riskScore: scenario.riskScore, summary: scenario.summary },
        affected: {
            count: affected.size,
            minutes: affectedMinutes,
            freedMinutes,
            addedMinutes,
            addedCount: addedTasks.length,
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
        propagation,
    };
};
