import { describe, it, expect } from 'vitest';
import { riskQuery, bottlenecksQuery, capacityQuery } from '../validators/insights.js';
import { focusSessionSchema } from '../validators/v2.js';

describe('insights query validators', () => {
    it('accepts empty scope', () => {
        expect(riskQuery.safeParse({}).success).toBe(true);
    });

    it('rejects non-uuid scope ids', () => {
        expect(riskQuery.safeParse({ goalId: 'not-a-uuid' }).success).toBe(false);
        expect(riskQuery.safeParse({ projectId: '123' }).success).toBe(false);
    });

    it('coerces numeric query strings with bounds', () => {
        const ok = bottlenecksQuery.safeParse({ top: '3' });
        expect(ok.success).toBe(true);
        expect(ok.data.top).toBe(3);
        expect(bottlenecksQuery.safeParse({ top: '99' }).success).toBe(false);
        const cap = capacityQuery.safeParse({ days: '7', perDay: '120' });
        expect(cap.success && cap.data.days === 7 && cap.data.perDay === 120).toBe(true);
        expect(capacityQuery.safeParse({ days: '0' }).success).toBe(false);
    });

    it('accepts Focus 2.0 session fields and rejects bad pause/note values', () => {
        const base = {
            taskId: null,
            startedAt: '2026-06-01T10:00:00.000Z',
            endedAt: '2026-06-01T10:25:00.000Z',
            durationSeconds: 1500,
        };
        const full = focusSessionSchema.safeParse({
            ...base,
            plannedSeconds: 1500,
            pausedSeconds: 120,
            note: 'Finished the schema draft.',
            completed: true,
        });
        expect(full.success).toBe(true);
        expect(focusSessionSchema.safeParse(base).success).toBe(true); // legacy payloads still valid
        expect(focusSessionSchema.safeParse({ ...base, pausedSeconds: -5 }).success).toBe(false);
        expect(focusSessionSchema.safeParse({ ...base, note: 'x'.repeat(1001) }).success).toBe(false);
        expect(focusSessionSchema.safeParse({ ...base, plannedSeconds: 30 }).success).toBe(false);
    });
});
