/**
 * Focus session state machine - pure, DOM-free, framework-free.
 * All time flows through the injected `now()` clock so tests are deterministic
 * and the UI stays a thin view over this logic.
 *
 * States: idle -> running <-> paused -> done
 * Pause time is excluded from elapsed work and reported as pausedSeconds so
 * the server can distinguish focus time from wall time.
 */

export const FOCUS_IDLE = 'idle';
export const FOCUS_RUNNING = 'running';
export const FOCUS_PAUSED = 'paused';
export const FOCUS_DONE = 'done';

export const createFocusSession = ({ taskId = null, plannedSeconds = 1500, now = () => Date.now() } = {}) => ({
    state: FOCUS_IDLE,
    taskId,
    plannedSeconds,
    anchorMs: null, // start of the current running stretch
    accumulatedMs: 0, // finished running stretches
    pauseAnchorMs: null, // start of the current pause
    pausedMs: 0, // finished pauses
    firstStartMs: null,
    endMs: null,
    now,
});

const withNow = (session, atMs) => (atMs != null ? atMs : session.now());

/** Milliseconds of actual focus work up to `atMs` (pauses excluded). */
export const focusElapsedMs = (session, atMs = null) => {
    const t = withNow(session, atMs);
    const live = session.state === FOCUS_RUNNING && session.anchorMs != null ? Math.max(0, t - session.anchorMs) : 0;
    return session.accumulatedMs + live;
};

/** Milliseconds spent paused up to `atMs` (open pause counted live). */
export const focusPausedMs = (session, atMs = null) => {
    const t = withNow(session, atMs);
    const live = session.state === FOCUS_PAUSED && session.pauseAnchorMs != null ? Math.max(0, t - session.pauseAnchorMs) : 0;
    return session.pausedMs + live;
};

export const focusRemainingMs = (session, atMs = null) =>
    Math.max(0, session.plannedSeconds * 1000 - focusElapsedMs(session, atMs));

export const focusProgress = (session, atMs = null) => {
    if (!session.plannedSeconds || session.plannedSeconds <= 0) return 0;
    return Math.min(1, focusElapsedMs(session, atMs) / (session.plannedSeconds * 1000));
};

export const startFocusSession = (session, atMs = null) => {
    if (session.state !== FOCUS_IDLE) return session;
    const t = withNow(session, atMs);
    return { ...session, state: FOCUS_RUNNING, anchorMs: t, firstStartMs: t };
};

export const pauseFocusSession = (session, atMs = null) => {
    if (session.state !== FOCUS_RUNNING || session.anchorMs == null) return session;
    const t = withNow(session, atMs);
    return {
        ...session,
        state: FOCUS_PAUSED,
        accumulatedMs: session.accumulatedMs + Math.max(0, t - session.anchorMs),
        anchorMs: null,
        pauseAnchorMs: t,
    };
};

export const resumeFocusSession = (session, atMs = null) => {
    if (session.state !== FOCUS_PAUSED || session.pauseAnchorMs == null) return session;
    const t = withNow(session, atMs);
    return {
        ...session,
        state: FOCUS_RUNNING,
        pausedMs: session.pausedMs + Math.max(0, t - session.pauseAnchorMs),
        pauseAnchorMs: null,
        anchorMs: t,
    };
};

/**
 * Finish the session. Returns { session, payload } where payload matches
 * POST /api/v2/tasks/focus-session (durationSeconds excludes pauses).
 */
export const stopFocusSession = (session, atMs = null) => {
    if (session.state === FOCUS_IDLE || session.state === FOCUS_DONE) return { session, payload: null };
    const t = withNow(session, atMs);
    const finished =
        session.state === FOCUS_RUNNING
            ? pauseFocusSession(session, t) // fold the open stretch into accumulatedMs
            : { ...session, pausedMs: session.pausedMs + (session.pauseAnchorMs != null ? Math.max(0, t - session.pauseAnchorMs) : 0) };
    const elapsedMs = finished.accumulatedMs;
    const pausedTotalMs = finished.pausedMs;
    const done = { ...finished, state: FOCUS_DONE, anchorMs: null, pauseAnchorMs: null, endMs: t };
    const payload = {
        taskId: done.taskId,
        startedAt: new Date(done.firstStartMs).toISOString(),
        endedAt: new Date(t).toISOString(),
        durationSeconds: Math.max(1, Math.floor(elapsedMs / 1000)),
        plannedSeconds: done.plannedSeconds,
        pausedSeconds: Math.floor(pausedTotalMs / 1000),
    };
    return { session: done, payload };
};

/** Human mm:ss or h:mm:ss for the timer face. */
export const formatFocusClock = (totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
};
