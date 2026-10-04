import { z } from 'zod';
import { uuid, validateBody } from './planner.js';

export { validateBody };

const scopeQuery = z.object({
    goalId: uuid.optional(),
    projectId: uuid.optional(),
});

export const riskQuery = scopeQuery;
export const criticalPathQuery = scopeQuery;

export const bottlenecksQuery = scopeQuery.extend({
    top: z.coerce.number().int().min(1).max(20).default(5),
});

export const capacityQuery = scopeQuery.extend({
    days: z.coerce.number().int().min(1).max(90).default(7),
    perDay: z.coerce.number().int().min(0).max(1440).optional(),
});

export const deviationsQuery = scopeQuery;
export const driftQuery = z.object({});

export const calibrationQuery = z.object({
    groupBy: z.enum(['category', 'project']).optional(),
});

/** Auto-replan proposal: optional scope + task filter, free-text reason. */
export const autoReplanSchema = z.object({
    goalId: uuid.optional(),
    projectId: uuid.optional(),
    taskIds: z.array(uuid).max(50).optional(),
    reason: z.string().max(300).default(''),
});

export const contextOrderQuery = scopeQuery.extend({
    lambda: z.coerce.number().min(0).max(10).default(1.5),
});

export const dayPlanQuery = scopeQuery.extend({
    minutes: z.coerce.number().int().min(15).max(1440).optional(),
    lambda: z.coerce.number().min(0).max(10).default(1.5),
});

export const goalScopeQuery = z.object({
    goalId: uuid.optional(),
});

/** Read-only simulation: synthetic deadline moves, removals, capacity. */
export const simulateSchema = z.object({
    goalId: uuid.optional(),
    projectId: uuid.optional(),
    changes: z
        .object({
            moveDeadlines: z
                .array(z.object({ taskId: uuid, deadline: z.string().datetime({ offset: true }) }))
                .max(50)
                .optional(),
            removeTaskIds: z.array(uuid).max(50).optional(),
            capacityPerDay: z.number().int().min(0).max(1440).optional(),
            addDays: z.number().int().min(-90).max(90).optional(),
        })
        .default({}),
});

/** Validate req.query (query strings need coercion, unlike JSON bodies). */
export const validateQuery = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
        });
    }
    req.validatedQuery = parsed.data;
    next();
};
