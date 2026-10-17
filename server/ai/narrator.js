/**
 * Fact-lock narrator (spec section 40): AI explains, numbers come from the
 * deterministic engines. The model NEVER invents or recomputes facts - after
 * generation we verify every supplied fact value appears in the text, and any
 * mismatch drops to the deterministic fallback. Pure narration only.
 */
import { chatJson, aiConfigured, aiProviderName } from './provider.js';
import { resolveModel } from './aiModels.js';

const fallbackResult = (text, reason, extra = {}) => ({
    text,
    source: 'fallback',
    provider: aiProviderName(),
    model: null,
    reason,
    ...extra,
});

/**
 * @param {object} args
 * @param {string} args.system - instructions incl. "use ONLY these values"
 * @param {string} args.user - the facts + task for narration
 * @param {Record<string, string|number>} args.facts - values that MUST appear verbatim
 * @param {string} args.fallbackText - deterministic text used on any failure
 */
export const factLockNarrate = async ({ system, user, facts = {}, fallbackText, temperature = 0.4, model = null }) => {
    if (!aiConfigured()) return fallbackResult(fallbackText, 'not_configured');
    // Pin the output shape: without it the model invents its own keys and every
    // call degrades to fallback despite a healthy provider.
    const shaped = `${system}\nReturn JSON with exactly this shape: {"text": "..."}.`;
    try {
        const out = await chatJson({ system: shaped, user, temperature, model });
        const text = String(out?.text ?? out?.narration ?? '').trim();
        if (!text) return fallbackResult(fallbackText, 'bad_output');
        const { ok, missing } = verifyFacts(text, facts);
        if (!ok) {
            return fallbackResult(fallbackText, `fact_mismatch:${missing.join(',')}`);
        }
        return {
            text,
            source: 'ai',
            provider: aiProviderName(),
            model: resolveModel(model),
            reason: null,
        };
    } catch (e) {
        return fallbackResult(fallbackText, e?.reason || 'error');
    }
};

/** Plain fact check for tests and callers that already hold text + facts. */
export const verifyFacts = (text, facts = {}) => {
    const hay = String(text || '');
    const low = hay.toLowerCase();
    const missing = [];
    for (const [k, v] of Object.entries(facts)) {
        if (v == null || v === '') continue;
        // Numbers/booleans are load-bearing: require the exact value verbatim.
        if (typeof v === 'number' || typeof v === 'boolean') {
            if (!hay.includes(String(v))) missing.push(k);
            continue;
        }
        // Titles get word-level verification: the model may rephrase ("API
        // integration" -> "Integrate the API") but must keep the substance.
        const words = String(v)
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length > 2);
        const hit = words.length === 0 ? low.includes(String(v).toLowerCase()) : words.filter((w) => low.includes(w)).length / words.length;
        if (hit < 0.5) missing.push(k);
    }
    return { ok: missing.length === 0, missing };
};
