import { describe, it, expect, afterEach, vi } from 'vitest';
import { MODEL_ALLOWLIST, DEFAULT_MODEL, isAllowedModel, resolveModel } from '../ai/aiModels.js';
import { resolveAiKey, aiConfigured, aiProviderName, chatJson, AiUnavailableError } from '../ai/provider.js';
import { factLockNarrate, verifyFacts } from '../ai/narrator.js';
import { scenarioIntent, deterministicScenarioIntent, smartNotes } from '../ai/aiIntents.js';

const ENV_KEYS = ['POLLINATIONS_API_KEY', 'POLLEN_API', 'LLM_API_KEY', 'AI_MODEL', 'LLM_BASE_URL', 'POLLINATIONS_BASE_URL'];
const saved = {};
const setEnv = (patch) => {
    for (const k of ENV_KEYS) {
        if (!(k in saved)) saved[k] = process.env[k];
        if (patch[k] === undefined) delete process.env[k];
        else process.env[k] = patch[k];
    }
};

afterEach(() => {
    for (const k of ENV_KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
        delete saved[k];
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('model allowlist (phase 3)', () => {
    it('rejects unknown models and falls back to the default', () => {
        setEnv({});
        expect(isAllowedModel('gpt-4-turbo')).toBe(false);
        expect(resolveModel('evil/model-injection')).toBe(DEFAULT_MODEL);
        expect(MODEL_ALLOWLIST).toContain('openai/gpt-5.4-nano');
    });

    it('accepts allowlisted models and honors an allowed env override', () => {
        setEnv({ AI_MODEL: 'openai/gpt-5.4-mini' });
        expect(resolveModel('openai/gpt-5.4')).toBe('openai/gpt-5.4');
        expect(resolveModel(null)).toBe('openai/gpt-5.4-mini');
    });
});

describe('provider config (phase 3)', () => {
    it('reads POLLINATIONS_API_KEY with POLLEN_API fallback', () => {
        setEnv({ POLLEN_API: 'sk-local' });
        expect(resolveAiKey()).toBe('sk-local');
        expect(aiConfigured()).toBe(true);
        expect(aiProviderName()).toBe('pollinations');
        setEnv({ POLLINATIONS_API_KEY: 'sk-canonical', POLLEN_API: 'sk-local' });
        expect(resolveAiKey()).toBe('sk-canonical');
    });

    it('reports unconfigured when no key exists', () => {
        setEnv({});
        expect(aiConfigured()).toBe(false);
        expect(aiProviderName()).toBeNull();
    });

    it('throws a typed not_configured error without a key', async () => {
        setEnv({});
        await expect(chatJson({ system: 's', user: 'u' })).rejects.toMatchObject({
            name: 'AiUnavailableError',
            reason: 'not_configured',
            status: 503,
        });
    });
});

describe('fact-lock narrator (phase 40)', () => {
    it('falls back deterministically when unconfigured', async () => {
        setEnv({});
        const out = await factLockNarrate({
            system: 's',
            user: 'u',
            facts: { minutes: 90 },
            fallbackText: 'Start now.',
        });
        expect(out.source).toBe('fallback');
        expect(out.text).toBe('Start now.');
        expect(out.reason).toBe('not_configured');
    });

    it('falls back when the model output is missing a fact', async () => {
        setEnv({ POLLINATIONS_API_KEY: 'sk-test' });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: JSON.stringify({ text: 'Work on report soon, risk low.' }) } }] }),
        })));
        const out = await factLockNarrate({
            system: 's',
            user: 'u',
            facts: { minutes: 90, riskLevel: 'low' },
            fallbackText: 'Fallback brief.',
        });
        expect(out.source).toBe('fallback');
        expect(out.reason).toContain('fact_mismatch');
        expect(out.reason).toContain('minutes');
        expect(out.text).toBe('Fallback brief.');
    });

    it('returns AI text when every fact appears verbatim', async () => {
        setEnv({ POLLINATIONS_API_KEY: 'sk-test' });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify({ text: 'Do API integration (90m). Risk level: low.' }) } }],
            }),
        })));
        const out = await factLockNarrate({
            system: 's',
            user: 'u',
            facts: { minutes: 90, riskLevel: 'low' },
            fallbackText: 'Fallback.',
        });
        expect(out.source).toBe('ai');
        expect(out.provider).toBe('pollinations');
        expect(out.text).toContain('90m');
    });

    it('guarantees the word json in messages for azure-backed json_object mode', async () => {
        setEnv({ POLLINATIONS_API_KEY: 'sk-test' });
        const stub = vi.fn(async () => ({
            ok: true,
            json: async () => ({ choices: [{ message: { content: '{}' } }] }),
        }));
        vi.stubGlobal('fetch', stub);
        await chatJson({ system: 'Write a brief.', user: 'u' });
        const sent = JSON.parse(stub.mock.calls[0][1].body);
        expect(stub.mock.calls[0][0]).toContain('/chat/completions');
        expect(sent.messages[0].content).toMatch(/json/i);
        expect(sent.response_format).toEqual({ type: 'json_object' });
    });

    it('maps provider HTTP failures to typed reasons via fetch', async () => {
        setEnv({ POLLINATIONS_API_KEY: 'sk-test' });
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })));
        await expect(chatJson({ system: 's', user: 'u' })).rejects.toMatchObject({ reason: 'rate_limited' });
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
        await expect(chatJson({ system: 's', user: 'u' })).rejects.toMatchObject({ reason: 'auth' });
    });

    it('verifyFacts reports exactly which keys are missing', () => {
        const r = verifyFacts('Risk is low and 45m left.', { minutes: 45, riskLevel: 'medium' });
        expect(r.ok).toBe(false);
        expect(r.missing).toEqual(['riskLevel']);
    });

    it('verifyFacts accepts a faithfully rephrased title but never a wrong number', () => {
        const ok = verifyFacts('Integrate the API. Allocate 90 minutes. Risk level is LOW.', {
            nextTask: 'API integration',
            minutes: 90,
            riskLevel: 'LOW',
        });
        expect(ok).toEqual({ ok: true, missing: [] });
        const bad = verifyFacts('Integrate the API. Allocate 60 minutes. Risk level is LOW.', {
            nextTask: 'API integration',
            minutes: 90,
            riskLevel: 'LOW',
        });
        expect(bad.ok).toBe(false);
        expect(bad.missing).toEqual(['minutes']);
        const wrongTask = verifyFacts('Call mom. Allocate 90 minutes. Risk level is LOW.', {
            nextTask: 'API integration',
            minutes: 90,
            riskLevel: 'LOW',
        });
        expect(wrongTask.ok).toBe(false);
        expect(wrongTask.missing).toEqual(['nextTask']);
    });
});

describe('scenario intent (phase 3)', () => {
    const tasks = [
        { id: '11111111-1111-4111-8111-111111111111', title: 'Write final report', deadline: null, estimatedMinutes: 120 },
        { id: '22222222-2222-4222-8222-222222222222', title: 'Polish slides', deadline: null, estimatedMinutes: 60 },
    ];

    it('keyword fallback matches drop, delay, and evening loss', () => {
        const drop = deterministicScenarioIntent('please drop write final report, keep the rest', tasks);
        expect(drop.matched).toBe(true);
        expect(drop.changes.removeTaskIds).toEqual([tasks[0].id]);
        const delay = deterministicScenarioIntent('push everything by 3 days', tasks);
        expect(delay.changes.addDays).toBe(3);
        const evening = deterministicScenarioIntent("I can lose the evening block", tasks);
        expect(evening.changes.loseEvening).toBe(true);
    });

    it('uses the fallback path (and says so) when no key is configured', async () => {
        setEnv({});
        const out = await scenarioIntent('drop polish slides', { tasks });
        expect(out.source).toBe('fallback');
        expect(out.matched).toBe(true);
        expect(out.changes.removeTaskIds).toEqual([tasks[1].id]);
        expect(out.message).toContain('keyword matcher');
    });

    it('validates AI changes against the allowlist and rejects unknown mutations', async () => {
        setEnv({ POLLINATIONS_API_KEY: 'sk-test' });
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify({ changes: { addDays: 2, priorityScore: 99 } }) } }],
            }),
        })));
        // priorityScore is not in aiChangesSchema - entire AI result rejected -> fallback
        const out = await scenarioIntent('delay everything', { tasks });
        expect(out.source).toBe('fallback');
    });
});

describe('smart notes (phase 3)', () => {
    it('trims notes honestly when unconfigured', async () => {
        setEnv({});
        const out = await smartNotes('Discussed API design. Next: write tests for parser.', { taskTitle: 'API work' });
        expect(out.source).toBe('fallback');
        expect(out.summary).toContain('API design');
        expect(out.actionItems).toEqual([]);
    });
});
