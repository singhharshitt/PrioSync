/**
 * Reality drift detection - deterministic and pure.
 * Reports OBSERVED behavioral patterns from the user's own data, never
 * psychological claims. Each pattern carries its evidence and a concrete
 * planning adjustment - description, not diagnosis.
 *
 * Inputs:
 *   tasks: normalized [{ id, title, status, estimatedMinutes, category,
 *            projectId, dependencies[] }]
 *   sessions: [{ taskId, durationSeconds }]
 *   events: [{ eventType, taskId, createdAt }]
 *
 * Thresholds are deliberately conservative (minimum samples) so a new user
 * with two sessions does not get told they "always" do anything.
 */
const MIN_RESCHEDULES = 3; // same task rescheduled this often -> pattern
const MIN_CATEGORY_SAMPLES = 3; // timed tasks before a category factor counts
const UNDER_FACTOR = 1.3; // 30%+ over estimate = chronic underestimation
const MIN_SESSIONS_FRAGMENTED = 4; // open task touched this often without finishing

const taskIdOf = (t) => String(t.id ?? t._id);

export const detectDrift = ({ tasks = [], sessions = [], events = [] } = {}) => {
    const byId = new Map(tasks.map((t) => [taskIdOf(t), t]));
    const patterns = [];

    // 1. Repeated postponement: tasks rescheduled 3+ times.
    const reschedules = new Map();
    for (const e of events) {
        if (e?.eventType !== 'TASK_RESCHEDULED' || !e?.taskId) continue;
        const k = String(e.taskId);
        reschedules.set(k, (reschedules.get(k) || 0) + 1);
    }
    const chronic = [...reschedules.entries()].filter(([, n]) => n >= MIN_RESCHEDULES);
    if (chronic.length > 0) {
        const names = chronic
            .map(([id]) => byId.get(id)?.title || id.slice(0, 8))
            .slice(0, 3)
            .map((n) => `"${n}"`)
            .join(', ');
        patterns.push({
            pattern: 'repeated_postponement',
            scope: 'task',
            count: chronic.length,
            evidence: `${chronic.length} task${chronic.length === 1 ? ' has' : 's have'} been rescheduled ${MIN_RESCHEDULES}+ times (${names}).`,
            suggestion: 'Break these into smaller steps with nearer deadlines, or defer them out of this week explicitly.',
        });
    }

    // 2. Chronic underestimation by category.
    const secsByTask = new Map();
    for (const s of sessions) {
        if (!s?.taskId) continue;
        const k = String(s.taskId);
        secsByTask.set(k, (secsByTask.get(k) || 0) + (Number(s.durationSeconds) || 0));
    }
    const byCategory = new Map();
    for (const t of tasks) {
        if (t.status !== 'completed') continue;
        const secs = secsByTask.get(taskIdOf(t)) || 0;
        if (secs <= 0 || !(Number(t.estimatedMinutes) > 0)) continue;
        const cat = (t.category || 'General').trim() || 'General';
        if (!byCategory.has(cat)) byCategory.set(cat, { est: 0, actual: 0, n: 0 });
        const g = byCategory.get(cat);
        g.est += Number(t.estimatedMinutes);
        g.actual += secs / 60;
        g.n += 1;
    }
    for (const [cat, g] of byCategory) {
        if (g.n < MIN_CATEGORY_SAMPLES) continue;
        const factor = Math.round((g.actual / Math.max(g.est, 1)) * 100) / 100;
        if (factor >= UNDER_FACTOR) {
            const pct = Math.round((factor - 1) * 100);
            patterns.push({
                pattern: 'chronic_underestimation',
                scope: cat,
                scopeType: 'category',
                samples: g.n,
                factor,
                evidence: `Over the last ${g.n} completed ${cat} tasks, work took ${pct}% longer than estimated.`,
                suggestion: `Plans now pad ${cat} estimates x${factor} automatically in risk and scheduling math - or raise the estimates themselves.`,
            });
        }
    }

    // 3. Fragmented sessions: many sittings, still open.
    const fragmented = [];
    for (const [taskId, secs] of secsByTask) {
        const t = byId.get(taskId);
        if (!t || t.status === 'completed') continue;
        const sittings = sessions.filter((s) => String(s?.taskId) === taskId).length;
        if (sittings >= MIN_SESSIONS_FRAGMENTED) {
            fragmented.push({ title: t.title, sittings });
        }
    }
    if (fragmented.length > 0) {
        const names = fragmented
            .slice(0, 3)
            .map((f) => `"${f.title}" (${f.sittings} sittings)`)
            .join(', ');
        patterns.push({
            pattern: 'fragmented_sessions',
            scope: 'task',
            count: fragmented.length,
            evidence: `${fragmented.length} open task${fragmented.length === 1 ? ' has' : 's have'} ${MIN_SESSIONS_FRAGMENTED}+ separate sittings without finishing (${names}).`,
            suggestion: 'Schedule these in one protected block instead of scattered sessions.',
        });
    }

    return patterns;
};
