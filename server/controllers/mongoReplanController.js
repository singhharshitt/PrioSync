import * as Replan from '../services/mongoReplanService.js';

export const getMissed = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, missed: await Replan.detectMissed(userId) });
    } catch (e) { next(e); }
};

export const propose = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, ...(await Replan.proposeReplan(userId, req.body)) });
    } catch (e) { next(e); }
};

export const accept = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, ...(await Replan.acceptReplan(userId, req.body)) });
    } catch (e) {
        if (e?.status === 400) return res.status(400).json({ success: false, message: e.message });
        next(e);
    }
};

export const log = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, log: await Replan.decisionLog(userId, req.query.limit) });
    } catch (e) { next(e); }
};

export const overrideRec = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, ...(await Replan.recordOverride(userId, req.body)) });
    } catch (e) {
        if (e?.status === 400) return res.status(400).json({ success: false, message: e.message });
        next(e);
    }
};

export const acceptRec = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, ...(await Replan.recordAccept(userId, req.body)) });
    } catch (e) {
        if (e?.status === 400) return res.status(400).json({ success: false, message: e.message });
        next(e);
    }
};

export const getAdherence = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, ...(await Replan.adherence(userId)) });
    } catch (e) { next(e); }
};
