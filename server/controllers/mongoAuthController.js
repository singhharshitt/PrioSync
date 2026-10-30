/**
 * Mongo v2 auth controller — mirrors pgAuthController.js contract.
 * Bcrypt hashing done here (cost 12); repository stores the hash.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as Users from '../repositories/mongoUsers.js';
import Task from '../models/Task.js';

const sign = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

const present = async (user) => {
    const id = (user._id || user.id).toString();
    const [total, done] = await Promise.all([
        Task.countDocuments({ owner: id }),
        Task.countDocuments({ owner: id, status: 'completed' }),
    ]);
    return {
        _id: id,
        id,
        name: user.name,
        email: user.email,
        productivityScore: user.productivityScore ?? 0,
        tasksCompleted: done,
        tasksCreated: total,
        createdAt: user.createdAt,
    };
};

export const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const existing = await Users.findByEmail(email);
        if (existing) return res.status(409).json({ success: false, message: 'Email already registered.' });
        const user = await Users.create({ email, passwordHash: await bcrypt.hash(password, 12), name });
        res.status(201).json({ success: true, token: sign(user._id || user.id), user: await present(user) });
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await Users.findByEmailWithHash(email);
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        const { password: _pw, ...safe } = user;
        void _pw;
        res.json({ success: true, token: sign(user._id.toString()), user: await present(safe) });
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
        const id = (req.user._id || req.user.id).toString();
        const user = await Users.updateName(id, String(name).trim().slice(0, 80));
        res.json({ success: true, user: await present(user) });
    } catch (error) {
        next(error);
    }
};
