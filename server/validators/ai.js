import { z } from 'zod';
import { uuid } from './planner.js';

export const scenarioIntentSchema = z.object({
    text: z.string().min(3).max(1000),
    model: z.string().max(80).optional(),
});

export const focusBriefSchema = z.object({
    minutes: z.number().int().min(5).max(1440).optional(),
    energy: z.enum(['low', 'normal', 'high']).optional(),
    model: z.string().max(80).optional(),
});

export const sessionReflectionSchema = z.object({
    taskId: uuid.optional(),
    durationSeconds: z.number().int().min(1).max(86400),
    estimatedMinutes: z.number().int().min(1).max(10080).optional(),
    model: z.string().max(80).optional(),
});

export const smartNotesSchema = z.object({
    notes: z.string().min(3).max(4000),
    taskTitle: z.string().max(300).optional(),
    model: z.string().max(80).optional(),
});
