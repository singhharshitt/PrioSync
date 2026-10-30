import * as Users from '../repositories/mongoUsers.js';

export const getPreferences = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, preferences: await Users.getPreferences(userId) });
    } catch (e) { next(e); }
};

export const updatePreferences = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        const row = await Users.updatePreferences(userId, req.body);
        if (!row) return res.status(404).json({ success: false, message: 'Preferences not found.' });
        res.json({ success: true, preferences: row });
    } catch (e) { next(e); }
};
