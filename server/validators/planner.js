import { z } from 'zod';

const uuid = z.string().uuid();
const key = z.string().min(1).max(40);
const iso = z.string().datetime({ offset: true });

/** POST /api/v2/planner/parse */
export const parseSchema = z.object({
    text: z.string().trim().min(3).max(4000),
    mode: z.enum(['auto', 'ai', 'heuristic']).default('auto'),
    context: z
        .object({
            deadline: iso.nullable().optional(),
            availableMinutesPerDay: z.number().int().min(15).max(960).nullable().optional(),
        })
        .default({}),
});

/**
 * POST /api/v2/planner/confirm — staged plan the user reviewed/edited.
 * estimatedMinutes is OPTIONAL on purpose: absence flags the estimate as
 * uncertain for plan-health (vs. silently treating a default as truth).
 */
export const confirmSchema = z.object({
    goal: z
        .object({
            title: z.string().trim().min(1).max(150),
            description: z.string().max(1000).default(''),
            deadline: iso.nullable().default(null),
        })
        .nullable()
        .default(null),
    projects: z.array(z.object({ key, title: z.string().trim().min(1).max(150) })).max(20).default([]),
    tasks: z
        .array(
            z.object({
                key,
                title: z.string().trim().min(1).max(150),
                description: z.string().max(2000).default(''),
                estimatedMinutes: z.number().int().min(1).max(10080).nullable().default(null),
                importance: z.number().int().min(1).max(5).default(3),
                urgency: z.number().int().min(1).max(5).default(3),
                difficulty: z.number().int().min(1).max(5).default(3),
                friction: z.number().int().min(1).max(5).default(3),
                deadline: iso.nullable().default(null),
                projectKey: key.nullable().default(null),
            })
        )
        .min(1)
        .max(50),
    dependencies: z.array(z.object({ task: key, dependsOn: key })).max(100).default([]),
    constraints: z
        .object({ availableMinutesPerDay: z.number().int().min(15).max(960).nullable().default(null) })
        .default({}),
    reason: z.string().max(300).default(''),
});

export const validateBody = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
        });
    }
    req.body = parsed.data;
    next();
};

export { uuid };
