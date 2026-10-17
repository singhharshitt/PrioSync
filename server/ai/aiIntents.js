/**
 * AI-assisted intents (phase 3): natural language -> DATA for the existing
 * deterministic engines. Nothing here applies changes - the client still
 * shows the simulation and asks for confirmation. Deterministic keyword
 * fallback runs whenever the provider is off, fails validation, or is
 * unavailable. AI never assigns priority, schedules, or risk.
 */
import { z } from 'zod';
import { chatJson, aiConfigured } from './provider.js';
import { resolveModel } from './aiModels.js';
import { factLockNarrate } from './narrator.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** AI mutations are restricted to this subset of simulateSchema.changes.
 * Strict: unknown keys reject the WHOLE model result (fallback wins). */
const aiChangesSchema = z.object({
    addDays: z.number().int().min(-90).max(90).optional(),
    removeTaskIds: z.array(z.string().uuid()).max(20).optional(),
    delayTasks: z.array(z.object({ taskId: z.string().uuid(), days: z.number().int().min(-90).max(90) })).max(20).optional(),
    moveDeadlines: z
        .array(z.object({ taskId: z.string().uuid(), deadline: z.string().datetime({ offset: true }) }))
        .max(20)
        .optional(),
    capacityPerDay: z.number().int().min(0).max(1440).optional(),
    loseEvening: z.boolean().optional(),
    loseMinutes: z.number().int().min(0).max(10080).optional(),
}).strict();

/** Deterministic keyword fallback - honest, small, always available. */
export const deterministicScenarioIntent = (text, tasks = []) => {
    const t = String(text || '').toLowerCase();
    const changes = {};
    const notes = [];
    for (const task of tasks) {
        const title = String(task.title || '').toLowerCase().trim();
        if (title.length < 4) continue;
        const re = new RegExp(`\\b(drop|remove|cut|delete|kill)\\b[^.\\n]{0,40}${escapeRe(title.slice(0, 24))}`);
        if (re.test(t)) {
            changes.removeTaskIds = [...(changes.removeTaskIds || []), String(task.id)];
            notes.push(`Matched drop for "${task.title}".`);
        }
    }
    const delay = t.match(/\b(delay|push|postpone|move)\b(?:\s+(?:everything|all|the plan))? by (\d{1,2}) days?/);
    if (delay) {
        changes.addDays = Number(delay[2]);
        notes.push(`Push everything by ${delay[2]} day(s).`);
    }
    if (/\b(lose|lost|drop|no)\b[^.\n]{0,12}\bevening\b/.test(t)) {
        changes.loseEvening = true;
        notes.push('Simulate losing the evening work block.');
    }
    return { changes, matched: Object.keys(changes).length > 0, notes };
};

/**
 * NL -> scenario mutations (validated, never applied).
 * @returns { changes, matched, source, notes, message }
 */
export const scenarioIntent = async (text, { tasks = [], model = null } = {}) => {
    const fallback = deterministicScenarioIntent(text, tasks);
    if (!aiConfigured()) {
        return { ...fallback, source: 'fallback', message: 'AI is off - used the keyword matcher.', model: null };
    }
    try {
        const taskList = tasks.map((t) => ({
            id: String(t.id),
            title: t.title,
            deadline: t.deadline || null,
            estimatedMinutes: t.estimatedMinutes,
        }));
        const out = await chatJson({
            system:
                'You translate a user sentence about changing their plan into JSON mutations. ' +
                'Allowed keys ONLY: addDays, removeTaskIds, delayTasks, moveDeadlines, capacityPerDay, loseEvening, loseMinutes. ' +
                'Use task ids exactly as given. If nothing matches, return {"changes":{}}. No explanations, JSON only.',
            user: JSON.stringify({ sentence: text, tasks: taskList, today: new Date().toISOString() }),
            temperature: 0.1,
            model,
        });
        const parsed = aiChangesSchema.safeParse(out?.changes || {});
        if (!parsed.success || Object.keys(parsed.data).length === 0) {
            return { ...fallback, source: 'fallback', message: 'AI returned no usable change - used the keyword matcher.', model: resolveModel(model) };
        }
        return { changes: parsed.data, matched: true, source: 'ai', notes: [], message: 'Mapped to a what-if scenario. Nothing is applied until you confirm.', model: resolveModel(model) };
    } catch (e) {
        return { ...fallback, source: 'fallback', message: `AI unavailable (${e?.reason || 'error'}) - used the keyword matcher.`, model: null };
    }
};

/** Focus brief: 2-3 sentences, fact-locked (next task title + minutes + risk). */
export const focusBrief = async ({ facts, fallbackText, model = null }) =>
    factLockNarrate({
        system:
            'You write a short 2-3 sentence focus brief for a task planner. Use ONLY the fact values provided - copy them verbatim, never recompute. Plain language, no hype, no emoji.',
        user: JSON.stringify(facts),
        facts,
        fallbackText,
        model,
    });

/** Session reflection: fact-locked summary of one completed focus session. */
export const sessionReflection = async ({ facts, fallbackText, model = null }) =>
    factLockNarrate({
        system:
            'You write a 1-2 sentence factual reflection on a completed focus session. Use ONLY the fact values provided - copy them verbatim. Neutral tone, no praise or guilt, no emoji.',
        user: JSON.stringify(facts),
        facts,
        fallbackText,
        model,
    });

const smartNotesSchema = z.object({
    summary: z.string().min(1).max(500),
    actionItems: z.array(z.string().min(1).max(200)).max(10).default([]),
});

/** Rough notes -> { summary, actionItems }. Fallback trims the notes honestly. */
export const smartNotes = async (notes, { taskTitle = '', model = null } = {}) => {
    const fallback = {
        summary: String(notes || '').trim().slice(0, 240),
        actionItems: [],
    };
    if (!aiConfigured()) return { ...fallback, source: 'fallback', reason: 'not_configured', model: null };
    try {
        const out = await chatJson({
            system:
                'Summarize rough work notes into JSON: {"summary": string (max 300 chars), "actionItems": string[] (max 8)}. ' +
                'Facts from the notes only - do not invent tasks. JSON only.',
            user: JSON.stringify({ taskTitle, notes }),
            temperature: 0.2,
            model,
        });
        const parsed = smartNotesSchema.safeParse(out);
        if (!parsed.success) return { ...fallback, source: 'fallback', reason: 'bad_output', model: resolveModel(model) };
        return { ...parsed.data, source: 'ai', reason: null, model: resolveModel(model) };
    } catch (e) {
        return { ...fallback, source: 'fallback', reason: e?.reason || 'error', model: null };
    }
};
