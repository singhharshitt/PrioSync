/**
 * Energy-aware day plan - deterministic and pure.
 * Splits the user's work window into thirds (morning / afternoon / evening),
 * each carrying the user's chosen energy level, then places dependency-ready
 * work where energy matches: exact energy fit first, nearest level otherwise.
 * High-energy tasks never land in a low-energy period while a better slot
 * has room - but priority still decides WITHIN an energy level.
 *
 * This is a user-controlled planning preference, not a diagnosis of anything.
 */
import { scheduleWithContext } from './contextSwitch.js';

const ENERGY_IDX = { low: 0, normal: 1, high: 2 };
const PERIODS = ['morning', 'afternoon', 'evening'];

const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
};

const fmtClock = (mins) => {
    const h = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
};

/** Thirds of the work window; defaults 09:00-18:00 when unset. */
export const dayPeriods = ({ workStart = null, workEnd = null, energy = null } = {}) => {
    const start = workStart ? toMinutes(workStart) : 9 * 60;
    let end = workEnd ? toMinutes(workEnd) : 18 * 60;
    if (!(end > start)) end = start + 8 * 60; // overnight/invalid -> 8h fallback
    const third = (end - start) / 3;
    const map = energy || { morning: 'high', afternoon: 'normal', evening: 'low' };
    return PERIODS.map((key, i) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        energy: map[key] || 'normal',
        from: fmtClock(Math.round(start + third * i)),
        to: fmtClock(Math.round(start + third * (i + 1))),
        minutes: Math.round(third),
    }));
};

const taskIdOf = (t) => String(t.id ?? t._id);
const isOpen = (t) => t.status === 'pending' || t.status === 'in-progress';

export const buildDayPlan = (
    tasks,
    {
        capacityPerDay = 240,
        calibrationFactor = 1,
        preferences = {},
        lambda = 1.5,
        minutes = null, // optional time-box override (Focus "I have N minutes")
    } = {}
) => {
    const budget = Math.max(0, minutes ?? Math.max(0, Math.round(Number(capacityPerDay) || 0)));
    const periods = dayPeriods({
        workStart: preferences.workStart ?? preferences.work_start ?? null,
        workEnd: preferences.workEnd ?? preferences.work_end ?? null,
        energy: {
            morning: preferences.energyMorning ?? preferences.energy_morning ?? 'high',
            afternoon: preferences.energyAfternoon ?? preferences.energy_afternoon ?? 'normal',
            evening: preferences.energyEvening ?? preferences.energy_evening ?? 'low',
        },
    }).map((p) => ({ ...p, remaining: p.minutes, tasks: [] }));

    // Global context-aware order first (deps + priority + grouping), then
    // place into periods: exact energy match preferred, nearest otherwise.
    const { ordered } = scheduleWithContext(tasks, { lambda });
    const adj = (t) => Math.max(1, Math.round((Number(t.estimatedMinutes) || 30) * calibrationFactor));
    const placedIds = new Set();
    const unscheduled = [];
    let used = 0;

    for (const { task } of ordered) {
        const need = adj(task);
        if (used + need > budget) {
            unscheduled.push(task);
            continue;
        }
        const want = ENERGY_IDX[task.energyFit] ?? 1;
        const cands = periods
            .map((p) => ({ p, dist: Math.abs((ENERGY_IDX[p.energy] ?? 1) - want) }))
            .filter(({ p }) => p.remaining >= need)
            .sort((a, b) => a.dist - b.dist);
        if (cands.length === 0) {
            unscheduled.push(task);
            continue;
        }
        const slot = cands[0].p;
        slot.remaining -= need;
        used += need;
        placedIds.add(taskIdOf(task));
        slot.tasks.push({
            taskId: taskIdOf(task),
            title: task.title,
            estimatedMinutes: need,
            energyFit: task.energyFit || 'normal',
            energyMatch: cands[0].dist === 0,
            priorityScore: task.priorityScore ?? 0,
        });
    }
    // Anything the context pass could not place (budget/period fit) stays listed.
    for (const { task } of ordered) {
        if (!placedIds.has(taskIdOf(task)) && !unscheduled.includes(task)) unscheduled.push(task);
    }

    return {
        periods: periods.map(({ remaining, ...p }) => ({
            ...p,
            usedMinutes: p.minutes - remaining,
            tasks: p.tasks,
        })),
        unscheduled: unscheduled.map((t) => ({ taskId: taskIdOf(t), title: t.title, estimatedMinutes: adj(t) })),
        totalMinutes: used,
        budgetMinutes: budget,
    };
};
