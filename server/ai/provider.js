/**
 * Provider abstraction for the optional AI layer (spec section 40):
 * - Reads POLLINATIONS_API_KEY with POLLEN_API fallback (user's local key name),
 *   then legacy LLM_API_KEY for the existing OpenAI-compatible path.
 * - Native fetch, no SDK. Every failure is typed so callers fall back to the
 *   deterministic engine - the AI layer NEVER blocks a workflow.
 */
import { resolveModel } from './aiModels.js';
import { aiStats } from '../utils/metrics.js';

const TIMEOUT_MS = 20000;

export const resolveAiKey = () =>
    process.env.POLLINATIONS_API_KEY || process.env.POLLEN_API || process.env.LLM_API_KEY || null;

const pollinationsKey = () => process.env.POLLINATIONS_API_KEY || process.env.POLLEN_API || null;

export const aiConfigured = () => !!resolveAiKey();

export const aiProviderName = () => (pollinationsKey() ? 'pollinations' : process.env.LLM_API_KEY ? 'openai-compatible' : null);

const resolveBase = () => {
    if (pollinationsKey()) {
        return (process.env.POLLINATIONS_BASE_URL || 'https://gen.pollinations.ai/v1').replace(/\/+$/, '');
    }
    return (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
};

/** Typed failure. Callers catch and use the deterministic fallback. */
export class AiUnavailableError extends Error {
    constructor(reason, detail = '') {
        super(`AI unavailable (${reason})${detail ? `: ${detail}` : ''}`);
        this.name = 'AiUnavailableError';
        this.reason = reason; // not_configured | auth | rate_limited | upstream | timeout | network | bad_json | bad_output
        this.status = 503;
    }
}

const mapStatus = (status) => {
    if (status === 401 || status === 402 || status === 403) return 'auth';
    if (status === 429) return 'rate_limited';
    return 'upstream';
};

/**
 * JSON chat completion against the configured provider.
 * Returns the parsed JSON object from the model. Throws AiUnavailableError
 * on ANY transport/shape problem - never returns partial garbage.
 */
export async function chatJson({ system, user, temperature = 0.3, model = null, maxTokens = 800 }) {
    aiStats.calls++;
    const key = resolveAiKey();
    if (!key) {
        aiStats.failures++;
        throw new AiUnavailableError('not_configured');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // Azure-backed gateways reject response_format json_object unless the word
    // "json" appears in the messages. Guarantee it here so no caller can break
    // the contract - the narrator always expects a JSON object back.
    const systemWithJson = /json/i.test(system) ? system : `${system}\nReturn valid JSON.`;
    try {
        const res = await fetch(`${resolveBase()}/chat/completions`, {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: resolveModel(model),
                temperature,
                max_tokens: maxTokens,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemWithJson },
                    { role: 'user', content: user },
                ],
            }),
        });
        if (!res.ok) {
            aiStats.failures++;
            throw new AiUnavailableError(mapStatus(res.status), `status ${res.status}`);
        }
        const data = await res.json().catch(() => {
            aiStats.failures++;
            throw new AiUnavailableError('bad_json', 'provider body');
        });
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            aiStats.failures++;
            throw new AiUnavailableError('bad_output', 'empty content');
        }
        try {
            return JSON.parse(content);
        } catch {
            aiStats.failures++;
            throw new AiUnavailableError('bad_json', 'content not JSON');
        }
    } catch (e) {
        if (e instanceof AiUnavailableError) throw e;
        if (e?.name === 'AbortError') {
            aiStats.failures++;
            throw new AiUnavailableError('timeout');
        }
        aiStats.failures++;
        throw new AiUnavailableError('network', e?.message || 'fetch failed');
    } finally {
        clearTimeout(timer);
    }
}
