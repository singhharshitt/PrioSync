/**
 * Brain-Dump → structured plan, two paths:
 *  - LLM path (when LLM_API_KEY is set, or mode:'ai'): language understanding via model.
 *  - Heuristic path (default without a key, or mode:'heuristic'): deterministic regex/structure rules.
 * BOTH paths return data validated against aiPlanSchema. Neither assigns priority —
 * the deterministic engine does that at confirm time.
 */
import { aiPlanSchema } from './plannerSchema.js';
import { extractWithLlm, llmConfigured } from './llmClient.js';

const DAY = 86400000;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const atMidnightPlus = (base, days, hour = 18) => {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
};

/** Best-effort deadline sniffing. Returns ISO string or null (never hallucinated precision beyond the words). */
const sniffDeadline = (text, now = new Date()) => {
    const t = text.toLowerCase();
    let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        const d = new Date(`${m[1]}-${m[2]}-${m[3]}T18:00:00`);
        if (!Number.isNaN(d.getTime()) && d > now) return d.toISOString();
    }
    if (/\btomorrow\b/.test(t)) return atMidnightPlus(now, 1);
    if (/\bday after tomorrow\b/.test(t)) return atMidnightPlus(now, 2);
    m = t.match(/\bin (\d{1,2}) days?\b/);
    if (m) return atMidnightPlus(now, Number(m[1]));
    if (/\bnext week\b/.test(t)) return atMidnightPlus(now, 7);
    if (/\bthis weekend\b|\bweekend\b/.test(t)) {
        const d = new Date(now);
        const add = (6 - d.getDay() + 7) % 7 || 7;
        return atMidnightPlus(now, add);
    }
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        const name = WEEKDAYS[(d.getDay() + i) % 7];
        if (new RegExp(`\\b${name}\\b`).test(t)) return atMidnightPlus(now, i === 0 ? 7 : i);
    }
    m = t.match(/\bexam\b.*\b(\d{1,2})(st|nd|rd|th)?\b|\b(\d{1,2})(st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    void m;
    return null;
};

const EFFORT_RULES = [
    [/\b(learn|study|course|tutorial|chapter)\b/, 60],
    [/\b(assignment|project|build|implement|write report|essay)\b/, 90],
    [/\b(practice|problem set|exercise|workout)\b/, 30],
    [/\b(revise|review|revise|revise|revise)\b/, 25],
    [/\b(revise|review|recap|flashcards|notes)\b/, 25],
    [/\b(mock|test|exam|quiz|assessment)\b/, 60],
    [/\b(email|call|book|pay|form|apply)\b/, 15],
    [/\b(clean|cook|shop|laundry|chore)\b/, 30],
];

const guessEffort = (title) => {
    const t = title.toLowerCase();
    for (const [re, mins] of EFFORT_RULES) if (re.test(t)) return mins;
    return 30;
};

/** Declarative context ("My assessment is next week") — deadline fuel, not tasks. */
const CONTEXT_RE = /^(my|the|it|this|that|assessment|exam|deadline)\b.*\b(is|are|was|were|has|have)\b/i;
/** State-of-mind lines ("I haven't started X") — friction signal, not tasks. */
const STATE_RE = /^(i haven't|i havent|i don't know|i dunno|i'm|i am|i feel|i struggle)\b/i;

const cleanPhrase = (s) =>
    s
        .trim()
        .replace(/^(i need to|i have to|i want to|i've got|i (also )?(have|need|want)|we need to|let's|lets|please)\s+/i, '')
        .replace(/\s+(left|remaining|pending)\.?$/i, '')
        .replace(/\.+$/g, '')
        .trim();

/** Split a brain-dump into candidate task phrases. */
const splitTasks = (text) => {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.replace(/^(\s*([-*•\d]+[.)\]]?|\(?\d+\)?)\s*)/, '').trim())
        .filter(Boolean);
    const base = lines.length > 1 ? lines : [text];
    let phrases = [];
    for (const line of base) {
        const parts = line
            .split(/\s+and also\s+|\s*;\s*|\s+plus\s+/i)
            .map((s) => s.trim())
            .filter((s) => s.length > 2);
        for (const part of parts) {
            // "SQL, DSA and frontend" → ["SQL", "DSA", "frontend"]; short phrases stay whole.
            if (part.length > 18 && (/,/.test(part) || /\sand\s/i.test(part))) {
                phrases.push(...part.split(/\s*,\s*|\s+and\s+/i));
            } else {
                phrases.push(part);
            }
        }
    }
    const seen = new Set();
    return phrases
        .map(cleanPhrase)
        .map((p) => (p.length > 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
        .filter((p) => p.length >= 3 && p.length <= 150)
        .filter((p) => !CONTEXT_RE.test(p) && !STATE_RE.test(p) && !/^(hi|hello|hey)\b/i.test(p))
        .filter((p) => {
            const k = p.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        })
        .slice(0, 50);
};

const goalTitle = (text) => {
    const m = text.match(/prepare for ([^.!\n]{3,80})/i) || text.match(/(?:need|want|have) to ([^.!\n]{3,80})/i);
    if (m) {
        const s = m[1].trim().replace(/\s+/g, ' ');
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    const first = text.split(/[.!?\n]/).map((s) => s.trim()).find((s) => s.length > 3) || text;
    const t = first.replace(/\s+/g, ' ').slice(0, 80);
    return t.charAt(0).toUpperCase() + t.slice(1);
};

/** "X before Y" / "after X, Y" / "X then Y" between known task titles → Y depends on X. */
const sniffDependencies = (tasks) => {
    const deps = [];
    const titles = tasks.map((t) => t.title.toLowerCase());
    tasks.forEach((t, i) => {
        const low = t.title.toLowerCase();
        let m = low.match(/(.+?)\s+before\s+(.+)/) || low.match(/after\s+(.+?),\s*(.+)/);
        if (m) {
            const a = titles.findIndex((x, j) => j !== i && (x.includes(m[1].trim()) || m[1].trim().includes(x)));
            const b = titles.findIndex((x, j) => j !== i && (x.includes(m[2].trim()) || m[2].trim().includes(x)));
            if (a >= 0 && b >= 0 && a !== b) deps.push({ task: tasks[b].key, dependsOn: tasks[a].key });
        }
        void titles;
    });
    return deps;
};

export const heuristicParse = (text, context = {}) => {
    const now = new Date();
    const goal = goalTitle(text);
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const phrases = splitTasks(text).filter((p) => norm(p) !== norm(goal));
    const tasks = phrases.map((p, i) => ({
        key: `t${i + 1}`,
        title: p.charAt(0).toUpperCase() + p.slice(1),
        description: '',
        estimatedMinutes: guessEffort(p),
        importance: 3,
        urgency: 3,
        difficulty: /dsa|algorithm|hard|tough|haven't started/i.test(p) ? 4 : 3,
        friction: /haven't started|procrastinat|dread|boring/i.test(p) ? 4 : 3,
        deadline: null,
        projectKey: null,
    }));
    const deadline = sniffDeadline(text, now);
    if (deadline) {
        for (const t of tasks) t.deadline = deadline;
        const diffDays = Math.max(0, Math.round((new Date(deadline) - now) / DAY));
        if (diffDays <= 2) for (const t of tasks) t.urgency = 5;
        else if (diffDays <= 7) for (const t of tasks) t.urgency = 4;
    }
    const clarificationsNeeded = [];
    if (!deadline && !context.deadline) {
        clarificationsNeeded.push({ field: 'deadline', question: 'When is this due? (e.g. "Friday", "next week", "2026-10-15")' });
    }
    if (!context.availableMinutesPerDay) {
        clarificationsNeeded.push({
            field: 'availableMinutesPerDay',
            question: 'How much time can you give this per day? (e.g. 60, 120, 240 minutes)',
        });
    }
    if (tasks.length === 0) {
        clarificationsNeeded.push({ field: 'tasks', question: 'What specifically needs doing? List a few items.' });
    }
    return {
        goal: {
            title: goal,
            description: text.slice(0, 1000),
            deadline: context.deadline || deadline,
        },
        projects: [],
        tasks,
        dependencies: sniffDependencies(tasks),
        constraints: { availableMinutesPerDay: context.availableMinutesPerDay ?? null },
        clarificationsNeeded,
    };
};

/**
 * Main entry. mode: 'auto' (LLM if configured, else heuristic) | 'ai' | 'heuristic'.
 * Returns { plan, source } where plan is schema-validated.
 */
export const parseBrainDump = async (text, context = {}, mode = 'auto') => {
    const clean = String(text || '').trim();
    if (clean.length < 3) {
        throw { status: 400, message: 'Brain-dump text is too short.' };
    }
    let raw;
    let source;
    if ((mode === 'ai' || (mode === 'auto' && llmConfigured())) && clean) {
        if (mode === 'ai' && !llmConfigured()) {
            throw { status: 503, message: 'AI parsing requested but LLM_API_KEY is not configured.' };
        }
        raw = await extractWithLlm(clean);
        source = 'ai';
    } else {
        raw = heuristicParse(clean, context);
        source = 'heuristic';
    }
    const parsed = aiPlanSchema.safeParse(raw);
    if (!parsed.success) {
        throw {
            status: 502,
            message: `AI output failed validation: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        };
    }
    // Enforce key integrity deterministically (never trust model/task keys blindly).
    const keys = new Set(parsed.data.tasks.map((t) => t.key));
    parsed.data.dependencies = parsed.data.dependencies.filter(
        (d) => keys.has(d.task) && keys.has(d.dependsOn) && d.task !== d.dependsOn
    );
    const pkeys = new Set(parsed.data.projects.map((p) => p.key));
    for (const t of parsed.data.tasks) {
        if (t.projectKey && !pkeys.has(t.projectKey)) t.projectKey = null;
    }
    return { plan: parsed.data, source };
};
