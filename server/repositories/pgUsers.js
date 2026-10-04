/**
 * PG user repository - raw SQL.
 * All functions take an optional queryable (pool or txn client) defaulting to the pool.
 * Password hashing stays in the service layer; this module stores password_hash verbatim.
 */
import { getPool } from '../db/pgClient.js';

const db = (client) => client || getPool();

export const findById = async (id, client) => {
    const r = await db(client).query(
        `SELECT id, email, name, avatar_url, productivity_score, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
    );
    return r.rows[0] || null;
};

export const findByEmail = async (email, client) => {
    const r = await db(client).query(
        `SELECT id, email, name, avatar_url, productivity_score, created_at, updated_at
         FROM users WHERE email = $1`,
        [String(email).toLowerCase()]
    );
    return r.rows[0] || null;
};

export const findByEmailWithHash = async (email, client) => {
    const r = await db(client).query(`SELECT * FROM users WHERE email = $1`, [
        String(email).toLowerCase(),
    ]);
    return r.rows[0] || null;
};

export const create = async ({ email, passwordHash, name }, client) => {
    const r = await db(client).query(
        `INSERT INTO users (email, password_hash, name)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, avatar_url, productivity_score, created_at, updated_at`,
        [String(email).toLowerCase(), passwordHash, name]
    );
    const user = r.rows[0];
    await db(client).query(
        `INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [user.id]
    );
    return user;
};

export const updateName = async (id, name, client) => {
    const r = await db(client).query(
        `UPDATE users SET name = $2, updated_at = now()
         WHERE id = $1
         RETURNING id, email, name, avatar_url, productivity_score, created_at, updated_at`,
        [id, name]
    );
    return r.rows[0] || null;
};

/** Reconcile cached aggregates after stats computation (single UPDATE, no N+1). */
export const updateAggregates = async (id, { productivityScore, tasksCompleted, tasksCreated }, client) => {
    await db(client).query(
        `UPDATE users SET productivity_score = $2, updated_at = now() WHERE id = $1`,
        [id, productivityScore]
    );
    return { tasksCompleted, tasksCreated };
};

export const deleteById = async (id, client) => {
    // Cascades to tasks, prefs, events, sessions, plans via FKs.
    const r = await db(client).query(`DELETE FROM users WHERE id = $1`, [id]);
    return r.rowCount;
};

const PREF_COLUMNS = [
    'available_minutes_per_day',
    'work_start',
    'work_end',
    'default_energy',
    'energy_morning',
    'energy_afternoon',
    'energy_evening',
];

/** Planner preferences row (created alongside the user); null-safe shape. */
export const getPreferences = async (id, client) => {
    const r = await db(client).query(
        `SELECT ${PREF_COLUMNS.join(', ')} FROM user_preferences WHERE user_id = $1`,
        [id]
    );
    return (
        r.rows[0] || {
            available_minutes_per_day: 240,
            work_start: null,
            work_end: null,
            default_energy: 'normal',
            energy_morning: 'high',
            energy_afternoon: 'normal',
            energy_evening: 'low',
        }
    );
};

const CAMEL_PREFS = {
    availableMinutesPerDay: 'available_minutes_per_day',
    workStart: 'work_start',
    workEnd: 'work_end',
    defaultEnergy: 'default_energy',
    energyMorning: 'energy_morning',
    energyAfternoon: 'energy_afternoon',
    energyEvening: 'energy_evening',
};

/** Partial preference update; unknown keys ignored, validated upstream by Zod. */
export const updatePreferences = async (id, fields, client) => {
    const sets = [];
    const params = [];
    for (const [camel, col] of Object.entries(CAMEL_PREFS)) {
        if (fields[camel] !== undefined) {
            params.push(fields[camel]);
            sets.push(`${col} = $${params.length}`);
        }
    }
    if (sets.length === 0) return getPreferences(id, client);
    sets.push('updated_at = now()');
    params.push(id);
    const r = await db(client).query(
        `UPDATE user_preferences SET ${sets.join(', ')} WHERE user_id = $${params.length} RETURNING ${PREF_COLUMNS.join(', ')}`,
        params
    );
    return r.rows[0] || null;
};
