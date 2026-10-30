/**
 * Mongo user repository — mirrors the pgUsers.js contract so services
 * call the same function names with the same signatures.
 * Snake_case aliases are NOT used here; callers receive camelCase rows.
 */
import User from '../models/User.js';

export const findById = async (id) => {
    const u = await User.findById(id).select('-password').lean();
    return u || null;
};

export const findByEmail = async (email) => {
    const u = await User.findOne({ email: String(email).toLowerCase() })
        .select('-password')
        .lean();
    return u || null;
};

/** Returns the user WITH the password hash for bcrypt comparison. */
export const findByEmailWithHash = async (email) => {
    const u = await User.findOne({ email: String(email).toLowerCase() })
        .select('+password')
        .lean();
    return u || null;
};

/** Create user and initialize preferences sub-document. */
export const create = async ({ email, passwordHash, name }) => {
    const u = await User.create({
        email: String(email).toLowerCase(),
        password: passwordHash, // stored as-is (already hashed by controller)
        name,
        preferences: {},
    });
    return findById(u._id);
};

export const updateName = async (id, name) => {
    const u = await User.findByIdAndUpdate(
        id,
        { name: String(name).trim().slice(0, 80) },
        { new: true, runValidators: true }
    ).select('-password').lean();
    return u || null;
};

/** Update cached productivity_score (called after stats computation). */
export const updateAggregates = async (id, { productivityScore }) => {
    await User.findByIdAndUpdate(id, { productivityScore });
};

export const deleteById = async (id) => {
    const r = await User.findByIdAndDelete(id);
    return r ? 1 : 0;
};

// ── Preferences ─────────────────────────────────────────────────────────────

const DEFAULTS = {
    availableMinutesPerDay: 240,
    workStart: null,
    workEnd: null,
    defaultEnergy: 'normal',
    energyMorning: 'high',
    energyAfternoon: 'normal',
    energyEvening: 'low',
    aiNarration: true,
};

export const getPreferences = async (id) => {
    const u = await User.findById(id).select('preferences').lean();
    return { ...DEFAULTS, ...(u?.preferences || {}) };
};

const ALLOWED_PREFS = [
    'availableMinutesPerDay',
    'workStart',
    'workEnd',
    'defaultEnergy',
    'energyMorning',
    'energyAfternoon',
    'energyEvening',
    'aiNarration',
];

export const updatePreferences = async (id, fields) => {
    const update = {};
    for (const k of ALLOWED_PREFS) {
        if (fields[k] !== undefined) {
            update[`preferences.${k}`] = fields[k];
        }
    }
    if (Object.keys(update).length === 0) return getPreferences(id);
    const u = await User.findByIdAndUpdate(id, { $set: update }, { new: true }).select('preferences').lean();
    return { ...DEFAULTS, ...(u?.preferences || {}) };
};
