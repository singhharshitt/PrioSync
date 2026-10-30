import { parseBrainDump } from '../ai/plannerParser.js';
import * as Planner from '../services/mongoPlannerService.js';

const sendErr = (res, e) => {
    if (e && (e.status === 400 || e.status === 502 || e.status === 503)) {
        return res.status(e.status).json({ success: false, message: e.message });
    }
    throw e;
};

export const parse = async (req, res, next) => {
    try {
        const { text, mode, context } = req.body;
        const { plan, source } = await parseBrainDump(text, context || {}, mode || 'auto');
        res.json({
            success: true, source, plan,
            note: plan.clarificationsNeeded.length > 0
                ? 'Answer the clarifications and confirm - or confirm as-is and refine later.'
                : 'Review, edit if needed, then confirm to create the plan.',
        });
    } catch (e) { try { return sendErr(res, e); } catch (err) { next(err); } }
};

export const confirm = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        const out = await Planner.confirmPlan(userId, req.body);
        res.status(201).json({ success: true, ...out });
    } catch (e) { try { return sendErr(res, e); } catch (err) { next(err); } }
};

export const listPlans = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        res.json({ success: true, plans: await Planner.listPlans(userId, req.query.limit) });
    } catch (e) { next(e); }
};

export const getPlan = async (req, res, next) => {
    try {
        const userId = (req.user._id || req.user.id).toString();
        const plan = await Planner.getPlan(userId, req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
        res.json({ success: true, plan });
    } catch (e) { next(e); }
};
