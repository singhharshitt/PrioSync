import { describe, it, expect } from 'vitest';
import { riskQuery, bottlenecksQuery, capacityQuery } from '../validators/insights.js';

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
});
