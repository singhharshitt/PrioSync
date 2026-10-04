import { z } from 'zod';
import { validateBody } from './planner.js';

export { validateBody };

const energy = z.enum(['low', 'normal', 'high']);
const clockTime = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h).')
    .nullable();

export const preferencesSchema = z
    .object({
        availableMinutesPerDay: z.number().int().min(15).max(960).optional(),
        workStart: clockTime.optional(),
        workEnd: clockTime.optional(),
        defaultEnergy: energy.optional(),
        energyMorning: energy.optional(),
        energyAfternoon: energy.optional(),
        energyEvening: energy.optional(),
    })
    .refine(
        (v) => {
            const keys = [
                'availableMinutesPerDay',
                'workStart',
                'workEnd',
                'defaultEnergy',
                'energyMorning',
                'energyAfternoon',
                'energyEvening',
            ];
            return keys.some((k) => v[k] !== undefined);
        },
        { message: 'Provide at least one preference field.' }
    );
