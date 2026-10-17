import { describe, it, expect } from 'vitest';
import {
    createFocusSession,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    stopFocusSession,
    focusElapsedMs,
    focusPausedMs,
    focusRemainingMs,
    focusProgress,
    formatFocusClock,
    FOCUS_IDLE,
    FOCUS_RUNNING,
    FOCUS_PAUSED,
    FOCUS_DONE,
} from './focusSession.js';

const T0 = 1_700_000_000_000;

describe('focus session state machine', () => {
    it('runs idle -> running -> paused -> running -> done', () => {
        let s = createFocusSession({ taskId: 't1', plannedSeconds: 1500 });
        expect(s.state).toBe(FOCUS_IDLE);
        s = startFocusSession(s, T0);
        expect(s.state).toBe(FOCUS_RUNNING);
        s = pauseFocusSession(s, T0 + 60_000);
        expect(s.state).toBe(FOCUS_PAUSED);
        expect(focusElapsedMs(s, T0 + 60_000)).toBe(60_000);
        s = resumeFocusSession(s, T0 + 90_000);
        expect(s.state).toBe(FOCUS_RUNNING);
        expect(focusPausedMs(s, T0 + 90_000)).toBe(30_000);
        const { session: done, payload } = stopFocusSession(s, T0 + 150_000);
        expect(done.state).toBe(FOCUS_DONE);
        expect(payload.durationSeconds).toBe(120); // 60s + 60s, pause excluded
        expect(payload.pausedSeconds).toBe(30);
        expect(payload.plannedSeconds).toBe(1500);
        expect(payload.startedAt).toBe(new Date(T0).toISOString());
        expect(payload.endedAt).toBe(new Date(T0 + 150_000).toISOString());
    });

    it('ignores illegal transitions (pause idle, resume running, double start)', () => {
        const s = createFocusSession({});
        expect(pauseFocusSession(s, T0)).toBe(s);
        expect(resumeFocusSession(s, T0)).toBe(s);
        const r = startFocusSession(s, T0);
        expect(startFocusSession(r, T0)).toBe(r);
        expect(resumeFocusSession(r, T0)).toBe(r);
    });

    it('returns no payload when stopping an idle session', () => {
        const { session, payload } = stopFocusSession(createFocusSession({}), T0);
        expect(payload).toBeNull();
        expect(session.state).toBe(FOCUS_IDLE);
    });

    it('accumulates multiple pauses and can stop while paused', () => {
        let s = startFocusSession(createFocusSession({ taskId: 't2' }), T0);
        s = pauseFocusSession(s, T0 + 10_000);
        s = resumeFocusSession(s, T0 + 20_000);
        s = pauseFocusSession(s, T0 + 50_000);
        const { payload } = stopFocusSession(s, T0 + 80_000);
        expect(payload.durationSeconds).toBe(40); // 10s + 30s
        expect(payload.pausedSeconds).toBe(40); // 10s + 30s
    });

    it('computes remaining time, progress, and the clock face', () => {
        let s = startFocusSession(createFocusSession({ plannedSeconds: 600 }), T0);
        expect(focusRemainingMs(s, T0 + 120_000)).toBe(480_000);
        expect(focusProgress(s, T0 + 120_000)).toBeCloseTo(0.2);
        expect(focusProgress(s, T0 + 900_000)).toBe(1);
        expect(formatFocusClock(65)).toBe('1:05');
        expect(formatFocusClock(3661)).toBe('1:01:01');
        expect(formatFocusClock(0)).toBe('0:00');
    });
});
