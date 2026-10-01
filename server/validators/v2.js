import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(6).max(128),
});

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
});

const uuid = z.string().uuid();

export const taskCreateSchema = z.object({
    title: z.string().trim().min(1).max(150),
    description: z.string().max(2000).default(''),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    importance: z.number().int().min(1).max(5).default(3),
    urgency: z.number().int().min(1).max(5).default(3),
    difficulty: z.number().int().min(1).max(5).default(3),
    friction: z.number().int().min(1).max(5).default(3),
    estimatedMinutes: z.number().int().min(1).max(10080).default(30),
    status: z.enum(['pending', 'in-progress', 'completed', 'cancelled']).default('pending'),
    category: z.string().trim().max(50).default('General'),
    energyFit: z.enum(['low', 'normal', 'high']).default('normal'),
    projectId: uuid.nullable().optional(),
    goalId: uuid.nullable().optional(),
    parentTaskId: uuid.nullable().optional(),
    dependencies: z.array(uuid).default([]),
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
    // Opt-in optimistic concurrency: when present, stale writes get 409.
    version: z.number().int().min(1).optional(),
});

export const dependenciesSchema = z.object({
    dependencies: z.array(uuid),
});

export const focusSessionSchema = z.object({
    taskId: uuid.nullable().optional(),
    startedAt: z.string().datetime({ offset: true }),
    endedAt: z.string().datetime({ offset: true }),
    durationSeconds: z.number().int().min(1).max(86400),
});

export const validate = (schema) => (req, res, next) => {
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
