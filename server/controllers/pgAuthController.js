import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getPool } from '../db/pgClient.js';
import * as Users from '../repositories/pgUsers.js';

const sign = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

/** v1-compatible user payload (+ PG-native id alongside _id). */
const present = async (user) => {
    const pool = getPool();
    const r = await pool.query(
        `SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status='completed')::int done
         FROM tasks WHERE user_id = $1`,
        [user.id]
    );
    return {
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        productivityScore: user.productivity_score,
        tasksCompleted: r.rows[0].done,
        tasksCreated: r.rows[0].total,
        createdAt: user.created_at,
    };
};

export const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const existing = await Users.findByEmail(email);
        if (existing) {
            return res.status(409).json({ success: false, message: 'Email already registered.' });
        }
        const user = await Users.create({
            email,
            passwordHash: await bcrypt.hash(password, 12),
            name,
        });
        res.status(201).json({ success: true, token: sign(user.id), user: await present(user) });
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await Users.findByEmailWithHash(email);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        const { password_hash: _ph, ...safe } = user;
        void _ph;
        res.json({ success: true, token: sign(user.id), user: await present(safe) });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        res.json({ success: true, user: await present(req.user) });
    } catch (error) {
        next(error);
    }
};

export const updateProfile = async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || String(name).trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Name is required.' });
        }
        const user = await Users.updateName(req.user.id, String(name).trim().slice(0, 80));
        res.json({ success: true, user: await present(user) });
    } catch (error) {
        next(error);
    }
};
