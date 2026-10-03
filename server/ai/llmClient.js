/**
 * Minimal OpenAI-compatible chat-completions client (fetch-based, no SDK).
 * Typed failures so callers can distinguish: no key, network/timeout, bad JSON.
 */
import { PLANNER_SYSTEM_PROMPT, buildUserPrompt } from './plannerPrompt.js';
import { aiStats } from '../utils/metrics.js';

export const llmConfigured = () => !!process.env.LLM_API_KEY;

const TIMEOUT_MS = 30000;

export async function extractWithLlm(text) {
    aiStats.calls++;
    const fail = (e) => {
        aiStats.failures++;
        throw e;
    };
    const base = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.LLM_API_KEY}`,
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: PLANNER_SYSTEM_PROMPT },
                    { role: 'user', content: buildUserPrompt(text, new Date().toISOString()) },
                ],
            }),
        });
        if (!res.ok) {
            throw fail({ status: 502, message: `AI provider error (${res.status}). Try heuristic mode.` });
        }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw fail({ status: 502, message: 'AI returned an empty response. Try heuristic mode.' });
        try {
            return JSON.parse(content);
        } catch {
            throw fail({ status: 502, message: 'AI returned malformed JSON. Try heuristic mode.' });
        }
    } catch (e) {
        if (e?.status) throw e;
        if (e?.name === 'AbortError') {
            throw fail({ status: 502, message: 'AI request timed out. Try heuristic mode.' });
        }
        throw fail({ status: 502, message: `AI request failed: ${e.message}. Try heuristic mode.` });
    } finally {
        clearTimeout(timer);
    }
}
