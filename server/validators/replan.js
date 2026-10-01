import { z } from 'zod';
import { validateBody, uuid } from './planner.js';

const iso = z.string().datetime({ offset: true });

export const proposeSchema = z.object({
    taskIds: z.array(uuid).max(50).optional(),
    availableMinutesPerDay: z.number().int().min(15).max(960).nullable().optional(),
});

export const acceptSchema = z.object({
    moves: z.array(z.object({ taskId: uuid, newDeadline: iso })).min(1).max(50),
    reason: z.string().max(300).default(''),
});

export const overrideSchema = z.object({
    recommendedTaskId: uuid,
    chosenTaskId: uuid.nullable().default(null),
    reason: z.enum(['more_energy', 'not_urgent', 'prefer_first', 'other']),
    note: z.string().max(300).default(''),
});

export const acceptRecSchema = z.object({ recommendedTaskId: uuid });

export { validateBody };
