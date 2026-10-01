import * as Replan from '../services/replanService.js';

export const getMissed = async (req, res, next) => {
    try {
        res.json({ success: true, missed: await Replan.detectMissed(req.user.id) });
    } catch (e) {
        next(e);
    }
};

export const propose = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Replan.proposeReplan(req.user.id, req.body)) });
    } catch (e) {
        next(e);
    }
};

export const accept = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Replan.acceptReplan(req.user.id, req.body)) });
    } catch (e) {
        if (e?.status === 400) return res.status(400).json({ success: false, message: e.message });
        next(e);
    }
};

export const log = async (req, res, next) => {
    try {
        res.json({ success: true, log: await Replan.decisionLog(req.user.id, req.query.limit) });
    } catch (e) {
        next(e);
    }
};

export const overrideRec = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Replan.recordOverride(req.user.id, req.body)) });
    } catch (e) {
        if (e?.status === 400) return res.status(400).json({ success: false, message: e.message });
        next(e);
    }
};

export const acceptRec = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Replan.recordAccept(req.user.id, req.body)) });
    } catch (e) {
        if (e?.status === 400) return res.status(400).json({ success: false, message: e.message });
        next(e);
    }
};

export const getAdherence = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Replan.adherence(req.user.id)) });
    } catch (e) {
        next(e);
    }
};
