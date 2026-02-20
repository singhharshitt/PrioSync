import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Generate signed JWT token
 */
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};

/**
 * POST /api/auth/register
 * Creates new user account
 */
export const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Email already registered.' });
        }

        const user = await User.create({ name, email, password });
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                productivityScore: user.productivityScore,
                tasksCompleted: user.tasksCompleted,
                tasksCreated: user.tasksCreated,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/login
 * Validates credentials and returns token
 */
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        // Explicitly select password (it's excluded by default)
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                productivityScore: user.productivityScore,
                tasksCompleted: user.tasksCompleted,
                tasksCreated: user.tasksCreated,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/me
 * Returns current authenticated user profile
 */
export const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({ success: true, user });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/auth/profile
 * Update user profile name
 */
export const updateProfile = async (req, res, next) => {
    try {
        const { name } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name },
            { new: true, runValidators: true }
        );
        res.json({ success: true, user });
    } catch (error) {
        next(error);
    }
};
