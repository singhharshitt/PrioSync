/**
 * Model allowlist for the Pollinations layer (spec section 40 + phase 3).
 * The model is DATA in every response; users may choose within the allowlist.
 * Nothing outside this list is ever sent - a defense against prompt-injected
 * model names in request bodies.
 */

export const MODEL_ALLOWLIST = Object.freeze([
    'openai/gpt-5.4-nano',
    'openai/gpt-5.4-mini',
    'openai/gpt-5.4',
    'mistral/mistral-small-3.2-24b-instruct',
]);

export const DEFAULT_MODEL = 'openai/gpt-5.4-nano';

export const isAllowedModel = (model) => typeof model === 'string' && MODEL_ALLOWLIST.includes(model);

/** Resolve a safe model: requested (if allowed) -> env (if allowed) -> default. */
export const resolveModel = (requested = null) => {
    if (isAllowedModel(requested)) return requested;
    if (isAllowedModel(process.env.AI_MODEL)) return process.env.AI_MODEL;
    return DEFAULT_MODEL;
};
