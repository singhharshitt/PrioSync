/**
 * PG user repository — raw SQL.
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
