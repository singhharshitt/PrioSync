import * as Insights from '../services/insightService.js';

export const getRisk = async (req, res, next) => {
    try {
        res.json({ success: true, risk: await Insights.getRisk(req.user.id, req.validatedQuery) });
    } catch (e) {
        next(e);
    }
};

export const getCriticalPath = async (req, res, next) => {
    try {
        res.json({ success: true, criticalPath: await Insights.getCriticalPath(req.user.id, req.validatedQuery) });
    } catch (e) {
        next(e);
    }
};

export const getBottlenecks = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Insights.getBottlenecks(req.user.id, req.validatedQuery)) });
    } catch (e) {
        next(e);
    }
};

export const getCapacity = async (req, res, next) => {
    try {
        res.json({ success: true, capacity: await Insights.getCapacity(req.user.id, req.validatedQuery) });
    } catch (e) {
        next(e);
    }
};

export const simulate = async (req, res, next) => {
    try {
        res.json({ success: true, simulation: await Insights.simulate(req.user.id, req.body) });
    } catch (e) {
        next(e);
    }
};

export const getDeviations = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Insights.getDeviations(req.user.id, req.validatedQuery)) });
    } catch (e) {
        next(e);
    }
};

export const getDrift = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Insights.getDrift(req.user.id)) });
    } catch (e) {
        next(e);
    }
};

export const getCalibration = async (req, res, next) => {
    try {
        res.json({ success: true, calibration: await Insights.getCalibration(req.user.id, req.validatedQuery) });
    } catch (e) {
        next(e);
    }
};

export const autoReplan = async (req, res, next) => {
    try {
        res.json({ success: true, replan: await Insights.autoReplan(req.user.id, req.body) });
    } catch (e) {
        next(e);
    }
};

export const getContextOrder = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Insights.getContextOrder(req.user.id, req.validatedQuery)) });
    } catch (e) {
        next(e);
    }
};

export const getDayPlan = async (req, res, next) => {
    try {
        res.json({ success: true, dayPlan: await Insights.getDayPlan(req.user.id, req.validatedQuery) });
    } catch (e) {
        next(e);
    }
};

export const getScope = async (req, res, next) => {
    try {
        res.json({ success: true, scope: await Insights.getScope(req.user.id, req.validatedQuery) });
    } catch (e) {
        if (e?.status === 404) return res.status(404).json({ success: false, message: e.message });
        next(e);
    }
};

export const getCommitments = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await Insights.getCommitments(req.user.id)) });
    } catch (e) {
        next(e);
    }
};
