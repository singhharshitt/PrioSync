/**
 * Uncertainty ranges - deterministic and pure (spec section 38).
 *
 * Calibration is ratio-based: actualMinutes / estimatedMinutes from completed
 * timed sessions. Output explains what a 120-minute estimate means in the
 * user's own history. Language stays factual: no confidence theater.
 */

const round2 = (x) => Math.round(x * 100) / 100;

/** Nearest-rank percentile on a pre-sorted array. */
const percentile = (sorted, p) => {
    if (sorted.length === 0) return null;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
};

/**
 * @param {number[]} ratios - actual/estimated per timed session (e.g. 1.4 = took 40% longer)
 * @param {object} opts - { exampleMinutes } the estimate to illustrate (default 120)
 */
export const buildUncertainty = (ratios = [], { exampleMinutes = 120 } = {}) => {
    const clean = ratios.filter((r) => Number.isFinite(r) && r > 0).sort((a, b) => a - b);
    const n = clean.length;

    const base = {
        sampleSize: n,
        exampleMinutes,
        notice: 'Ranges come from your completed timed sessions. More sessions sharpen the range.',
    };

    if (n < 3) {
        return {
            ...base,
            confidence: 'uncalibrated',
            p25: null,
            p50: null,
            p75: null,
            spread: null,
            exampleRange: null,
            message: `Only ${n} timed session${n === 1 ? '' : 's'} so far - complete a few more to unlock calibrated ranges.`,
        };
    }

    const p25 = percentile(clean, 25);
    const p50 = percentile(clean, 50);
    const p75 = percentile(clean, 75);
    const spread = round2(p75 - p25);

    let confidence;
    if (n >= 10 && spread <= 0.3) confidence = 'high';
    else if (n >= 5 && spread <= 0.6) confidence = 'medium';
    else confidence = 'low';

    const low = Math.max(1, Math.floor(exampleMinutes * p25));
    const high = Math.ceil(exampleMinutes * p75);

    return {
        ...base,
        confidence,
        p25: round2(p25),
        p50: round2(p50),
        p75: round2(p75),
        spread,
        exampleRange: { lowMinutes: low, highMinutes: high },
        message:
            `Your ${exampleMinutes}-minute estimates typically land between ${low} and ${high} minutes ` +
            `(median factor ${round2(p50)}x over ${n} session${n === 1 ? '' : 's'}).`,
    };
};

/** Extract ratios from completed timed sessions + their task estimates. */
export const ratiosFromSessions = (sessions = [], taskEstimates = new Map()) => {
    const ratios = [];
    for (const s of sessions) {
        if (!s?.taskId || !s?.actualMinutes) continue;
        const est = taskEstimates.get(String(s.taskId));
        if (!est || est <= 0) continue;
        const r = s.actualMinutes / est;
        if (Number.isFinite(r) && r > 0) ratios.push(r);
    }
    return ratios;
};
