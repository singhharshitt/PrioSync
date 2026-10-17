/**
 * AI layer controller (phase 3). All handlers return DATA: the AI never
 * applies changes, and every response carries source/model so the UI can
 * show exactly what came from the model vs the deterministic engine.
 */
import * as Tasks from '../repositories/pgTasks.js';
import { normalizeTask, getRisk } from '../services/insightService.js';
import { scenarioIntent, focusBrief, sessionReflection, smartNotes } from '../ai/aiIntents.js';
import { aiConfigured, aiProviderName } from '../ai/provider.js';
import { MODEL_ALLOWLIST, resolveModel } from '../ai/aiModels.js';
import logger from '../utils/logger.js';

export const getAiStatus = async (req, res) => {
    res.json({
        success: true,
        configured: aiConfigured(),
        provider: aiProviderName(),
        models: MODEL_ALLOWLIST,
        defaultModel: resolveModel(null),
        consentRequired: true,
    });
};

export const postScenarioIntent = async (req, res, next) => {
    try {
        const rows = await Tasks.allForScoring(req.user.id);
        const open = rows
            .map(normalizeTask)
            .filter((t) => t.status === 'pending' || t.status === 'in-progress')
            .map((t) => ({ id: t.id, title: t.title, deadline: t.deadline, estimatedMinutes: t.estimatedMinutes }));
        const out = await scenarioIntent(req.body.text, { tasks: open, model: req.body.model });
        logger.info({ userId: req.user.id, source: out.source, matched: out.matched }, 'ai.scenario_intent');
        res.json({ success: true, intent: out });
    } catch (e) {
        next(e);
    }
};

export const postFocusBrief = async (req, res, next) => {
    try {
        const rows = await Tasks.allForScoring(req.user.id);
        const scope = rows.map(normalizeTask);
        const top = scope
            .filter((t) => t.status === 'pending' || t.status === 'in-progress')
            .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))[0];
        const risk = await getRisk(req.user.id, {});
        const facts = {
            nextTask: top?.title ?? 'no open task',
            minutes: req.body.minutes ?? top?.estimatedMinutes ?? 30,
            riskLevel: risk.riskLevel,
        };
        const fallbackText = `Start with "${facts.nextTask}" (${facts.minutes}m). Plan risk: ${facts.riskLevel}.`;
        const out = await focusBrief({ facts, fallbackText, model: req.body.model });
        res.json({ success: true, brief: { ...out, facts } });
    } catch (e) {
        next(e);
    }
};

export const postSessionReflection = async (req, res, next) => {
    try {
        const { taskId, durationSeconds, estimatedMinutes, model } = req.body;
        let title = 'Focus session';
        if (taskId) {
            const r = await Tasks.getById(req.user.id, taskId);
            if (r) title = r.title;
        }
        const minutesWorked = Math.round(durationSeconds / 60);
        const facts = {
            task: title,
            minutesWorked,
            estimatedMinutes: estimatedMinutes ?? null,
        };
        if (facts.estimatedMinutes == null) delete facts.estimatedMinutes;
        const fallbackText = `Session on "${title}" ran ${minutesWorked}m${estimatedMinutes ? ` against a ${estimatedMinutes}m estimate` : ''}.`;
        const out = await sessionReflection({ facts, fallbackText, model });
        res.json({ success: true, reflection: { ...out, facts } });
    } catch (e) {
        next(e);
    }
};

export const postSmartNotes = async (req, res, next) => {
    try {
        const out = await smartNotes(req.body.notes, { taskTitle: req.body.taskTitle || '', model: req.body.model });
        res.json({ success: true, notes: out });
    } catch (e) {
        next(e);
    }
};
