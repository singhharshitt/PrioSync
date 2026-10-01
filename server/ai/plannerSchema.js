import { z } from 'zod';

/**
 * Strict schema for Brain-Dump AI output. Raw LLM JSON is NEVER trusted —
 * it must pass this before anything reaches the preview, let alone the DB.
 * Scores/priority are deliberately ABSENT: the deterministic engine decides those.
 */

export const aiTaskSchema = z.object({
    key: z.string().min(1).max(40),
    title: z.string().trim().min(1).max(150),
    description: z.string().max(500).default(''),
    estimatedMinutes: z.number().int().min(5).max(10080).default(30),
    importance: z.number().int().min(1).max(5).default(3),
    urgency: z.number().int().min(1).max(5).default(3),
    difficulty: z.number().int().min(1).max(5).default(3),
    friction: z.number().int().min(1).max(5).default(3),
    deadline: z.string().datetime({ offset: true }).nullable().default(null),
    projectKey: z.string().min(1).max(40).nullable().default(null),
});

export const aiProjectSchema = z.object({
    key: z.string().min(1).max(40),
    title: z.string().trim().min(1).max(150),
});

export const aiPlanSchema = z.object({
    goal: z.object({
        title: z.string().trim().min(1).max(150),
        description: z.string().max(1000).default(''),
        deadline: z.string().datetime({ offset: true }).nullable().default(null),
    }),
    projects: z.array(aiProjectSchema).max(20).default([]),
    tasks: z.array(aiTaskSchema).min(1).max(50),
    dependencies: z
        .array(z.object({ task: z.string().min(1), dependsOn: z.string().min(1) }))
        .max(100)
        .default([]),
    constraints: z
        .object({ availableMinutesPerDay: z.number().int().min(15).max(960).nullable().default(null) })
        .default({}),
    clarificationsNeeded: z
        .array(z.object({ field: z.string().min(1), question: z.string().min(1).max(300) }))
        .max(10)
        .default([]),
});
