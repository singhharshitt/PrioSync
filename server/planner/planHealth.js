/**
 * Plan health — COMPUTED from real data, never LLM-generated.
 * 100 = healthy. Penalties are fixed, documented weights; checks/warnings
 * explain exactly what is wrong so the user can act on it.
 */

const DAY = 86400000;

export const computePlanHealth = ({ tasks, availableMinutesPerDay, goalDeadline }) => {
    const checks = [];
    const warnings = [];
    let score = 100;

    const totalMinutes = tasks.reduce((a, t) => a + (t.estimatedMinutes || 30), 0);
    const deadlines = tasks.map((t) => t.deadline).filter(Boolean).map((d) => new Date(d));
    const horizonEnd = new Date(
        Math.min(
            ...(goalDeadline ? [new Date(goalDeadline).getTime()] : []),
            ...(deadlines.length > 0 ? deadlines.map((d) => d.getTime()) : [Date.now() + 7 * DAY])
        )
    );
    const days = Math.max(1, Math.ceil((horizonEnd - Date.now()) / DAY));
    const capacity = days * (availableMinutesPerDay || 0);

    // 1. Workload fits available time (heaviest weight)
    if (availableMinutesPerDay) {
        if (totalMinutes <= capacity) {
            checks.push('Workload fits your available time');
            if (capacity - totalMinutes >= totalMinutes * 0.2) checks.push('Healthy buffer (20%+) for slippage');
            else warnings.push('Little buffer — one slip day overloads the plan');
        } else {
            const over = Math.round(((totalMinutes - capacity) / capacity) * 100);
            warnings.push(`Overloaded by ~${over}% — cut scope or add ${Math.ceil((totalMinutes - capacity) / days)} min/day`);
            score -= Math.min(40, 15 + Math.round(over / 4));
        }
        // Day-level overload: even spread, is any day over budget?
        const perDay = totalMinutes / days;
        if (perDay > availableMinutesPerDay) {
            warnings.push(`Average day needs ${Math.round(perDay)} min vs ${availableMinutesPerDay} available`);
            score -= 10;
        }
    } else {
        warnings.push('Daily availability unknown — health assumes unlimited time');
        score -= 10;
    }

    // 2. Deadline realism
    const undated = tasks.filter((t) => !t.deadline && !goalDeadline).length;
    if (undated === 0) checks.push('Every task has a deadline');
    else {
        warnings.push(`${undated} task${undated > 1 ? 's have' : ' has'} no deadline`);
        score -= Math.min(15, undated * 5);
    }

    // 3. Estimate uncertainty (heuristic defaults are 30 min guesses)
    const uncertain = tasks.filter((t) => t.estimatedUncertain).length;
    if (uncertain > 0) {
        warnings.push(`${uncertain} estimate${uncertain > 1 ? 's are' : ' is'} a guess — confirm after first session`);
        score -= Math.min(10, uncertain * 2);
    }

    // 4. Dependency sanity (confirm-time graphs are built fresh, so this is a guard)
    const keys = new Set(tasks.map((t) => t.key));
    const dangling = tasks.flatMap((t) => t.dependsOn || []).filter((d) => !keys.has(d)).length;
    if (dangling > 0) {
        warnings.push(`${dangling} dangling dependenc${dangling > 1 ? 'ies' : 'y'} ignored`);
        score -= 5;
    } else {
        checks.push('Dependencies resolved');
    }

    return { score: Math.max(0, Math.min(100, score)), checks, warnings };
};
