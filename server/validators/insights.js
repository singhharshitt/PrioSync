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

/** Multi-project allocation (spec 39): horizon in days, optional capacity override. */
export const allocationQuery = z.object({
    days: z.coerce.number().int().min(1).max(30).default(1),
    perDay: z.coerce.number().int().min(0).max(1440).optional(),
});

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

/** Plan resilience / fragility (spec 27-28). */
export const resilienceQuery = scopeQuery.extend({
    days: z.coerce.number().int().min(1).max(90).default(7),
});

/** Impossible-plan detection + resolution (spec 31-32). */
export const resolveSchema = z.object({
    goalId: uuid.optional(),
    projectId: uuid.optional(),
    days: z.number().int().min(1).max(90).default(7),
});

/** Recovery planner (spec 33-34): lost time from an interruption, in minutes. */
export const recoverySchema = z.object({
    goalId: uuid.optional(),
    projectId: uuid.optional(),
    lostMinutes: z.number().int().min(0).max(10080).default(0),
});

/** Read-only simulation: synthetic mutations (spec section 29). */
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
            delayTasks: z
                .array(z.object({ taskId: uuid, days: z.number().int().min(-90).max(90) }))
                .max(50)
                .optional(),
            addTasks: z
                .array(
                    z.object({
                        id: uuid.optional(),
                        title: z.string().min(1).max(300),
                        estimatedMinutes: z.number().int().min(1).max(10080),
                        deadline: z.string().datetime({ offset: true }).optional(),
                        dependencies: z.array(uuid).max(20).optional(),
                        importance: z.number().int().min(1).max(5).optional(),
                        urgency: z.number().int().min(1).max(5).optional(),
                        difficulty: z.number().int().min(1).max(5).optional(),
                        category: z.string().max(80).optional(),
                    })
                )
                .max(20)
                .optional(),
            addDependencies: z.array(z.object({ taskId: uuid, dependsOn: uuid })).max(50).optional(),
            removeDependencies: z.array(z.object({ taskId: uuid, dependsOn: uuid })).max(50).optional(),
            changeDurations: z
                .array(z.object({ taskId: uuid, estimatedMinutes: z.number().int().min(1).max(10080) }))
                .max(50)
                .optional(),
            changeImportance: z
                .array(z.object({ taskId: uuid, importance: z.number().int().min(1).max(5) }))
                .max(50)
                .optional(),
            changePriority: z
                .array(z.object({ taskId: uuid, priorityScore: z.number().min(0).max(100) }))
                .max(50)
                .optional(),
            moveProject: z.object({ projectId: uuid, days: z.number().int().min(-90).max(90) }).optional(),
            loseEvening: z.boolean().optional(),
            loseMinutes: z.number().int().min(0).max(10080).optional(),
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
