import * as Insights from '../services/mongoInsightService.js';

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res, next); } catch (e) { next(e); } };

export const getRisk = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, risk: await Insights.getRisk(userId, req.validatedQuery) });
});
export const getCriticalPath = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, criticalPath: await Insights.getCriticalPath(userId, req.validatedQuery) });
});
export const getBottlenecks = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, ...(await Insights.getBottlenecks(userId, req.validatedQuery)) });
});
export const getCapacity = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, capacity: await Insights.getCapacity(userId, req.validatedQuery) });
});
export const simulate = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, simulation: await Insights.simulate(userId, req.body) });
});
export const getDeviations = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, ...(await Insights.getDeviations(userId, req.validatedQuery)) });
});
export const getDrift = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, ...(await Insights.getDrift(userId)) });
});
export const getCalibration = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, calibration: await Insights.getCalibration(userId, req.validatedQuery) });
});
export const autoReplan = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, replan: await Insights.autoReplan(userId, req.body) });
});
export const getContextOrder = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, ...(await Insights.getContextOrder(userId, req.validatedQuery)) });
});
export const getDayPlan = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, dayPlan: await Insights.getDayPlan(userId, req.validatedQuery) });
});
export const getScope = wrap(async (req, res, next) => {
    const userId = (req.user._id || req.user.id).toString();
    try {
        res.json({ success: true, scope: await Insights.getScope(userId, req.validatedQuery) });
    } catch (e) {
        if (e?.status === 404) return res.status(404).json({ success: false, message: e.message });
        next(e);
    }
});
export const getCommitments = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, ...(await Insights.getCommitments(userId)) });
});
export const getResilience = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, resilience: await Insights.getResilience(userId, req.validatedQuery) });
});
export const resolveConstraints = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, ...(await Insights.resolveConstraints(userId, req.body)) });
});
export const getRecovery = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, recovery: await Insights.getRecovery(userId, req.body) });
});
export const getTraceability = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, ...(await Insights.getTraceability(userId)) });
});
export const getEfficiency = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, ...(await Insights.getEfficiency(userId, req.validatedQuery)) });
});
export const getPlanDebt = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, planDebt: await Insights.getPlanDebt(userId) });
});
export const getAllocation = wrap(async (req, res) => {
    const userId = (req.user._id || req.user.id).toString();
    res.json({ success: true, allocation: await Insights.getAllocation(userId, req.validatedQuery) });
});
